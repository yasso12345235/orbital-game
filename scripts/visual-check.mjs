/**
 * visual-check — automated visual walkthrough for ORBITAL.
 *
 * Drives the real UI through a full mission flow in headless Chrome and saves
 * screenshots plus a machine-readable summary for review. Unlike the original
 * script it is portable (no hard-coded absolute paths), starts the dev server
 * when needed, and exits non-zero when the run is not clean, so it can gate CI.
 *
 * Usage:
 *   npm run test:visual
 *   BASE_URL=http://localhost:5174/ npm run test:visual
 *
 * Environment:
 *   BASE_URL     target URL (default http://localhost:5174/)
 *   CHROME_PATH  path to a Chrome/Chromium binary (auto-detected otherwise)
 *   VISUAL_OUT   screenshot directory (default <repo>/artifacts/visual-check)
 *   HEADLESS=0   run a visible browser
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5174/';
const OUT = path.resolve(process.env.VISUAL_OUT ?? path.join(ROOT, 'artifacts', 'visual-check'));
const HEADLESS = process.env.HEADLESS !== '0';

mkdirSync(OUT, { recursive: true });

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const consoleErrors = [];
const checks = [];
const screenshots = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
  return ok;
}

async function reachable(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status < 500) return true;
    } catch {
      /* server not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

/* ---------------------------------------------------------------- server */

let server = null;
if (!(await reachable(BASE_URL, 1200))) {
  const url = new URL(BASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    console.error(`Server at ${BASE_URL} is not reachable and is not local; start it first.`);
    process.exit(1);
  }
  const port = url.port || '5174';
  console.log(`starting dev server on port ${port}…`);
  server = spawn('npm', ['run', 'dev', '--', '--port', port, '--strictPort'], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
  });
  if (!(await reachable(BASE_URL, 120000))) {
    killTree(server);
    console.error('dev server did not become reachable within 120 s');
    process.exit(1);
  }
}

/* --------------------------------------------------------------- browser */

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : { channel: 'chrome' }),
  headless: HEADLESS,
  args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Deterministic start: never inherit a developer's local save.
await context.addInitScript(() => {
  try {
    // Clear once per tab session: a mid-run reload must see the save it wrote.
    if (!sessionStorage.getItem('ma-visual-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('ma-visual-cleared', '1');
    }
  } catch {
    /* storage disabled */
  }
});

const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

const shot = async (name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  screenshots.push(file);
  console.log('shot', path.basename(file));
};

const waitFor = async (sel, label, timeout = 20000) => {
  await page.waitForSelector(sel, { timeout });
  console.log('ok —', label);
  return true;
};

const countCanvases = (sel) =>
  page.evaluate((s) => document.querySelectorAll(`${s} canvas`).length, sel);

const nav = async (name) => {
  await page.getByRole('button', { name, exact: true }).first().click();
};

let flowError = null;

try {
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  await shot('01-home');

  // Home → Mission Select (wormhole transition)
  await nav('Mission Select');
  await page.waitForTimeout(650);
  const wormhole = await page.evaluate(() => {
    const el = document.querySelector('[data-wormhole]');
    return el ? el.getAttribute('data-mode') ?? 'canvas' : 'absent';
  });
  console.log('wormhole mode mid-transition:', wormhole);
  await shot('02-wormhole');
  await waitFor('[data-scene="mission-globe"] canvas', 'mission globe canvas');
  await page.waitForTimeout(1500);
  check('mission select renders 3D globe', (await countCanvases('[data-scene="mission-globe"]')) === 1);
  await shot('03-mission-select');

  // GO → Builder (dispatch: the floating AI chip can sit over the corner CTA)
  await page.locator('button[aria-label^="Go to builder"]').dispatchEvent('click');
  await waitFor('[data-scene="builder-preview"] canvas', 'builder preview canvas');
  await page.waitForTimeout(1800);
  check('builder renders preview canvas', (await countCanvases('[data-scene="builder-preview"]')) >= 1);
  await shot('04-builder');

  // → Orbit Designer
  await nav('Orbit Designer');
  await waitFor('[data-scene="orbit-designer"] canvas', 'orbit designer canvas');
  await page.waitForTimeout(1800);
  check('orbit designer renders canvas', (await countCanvases('[data-scene="orbit-designer"]')) >= 1);
  await shot('05-orbit');

  // LAUNCH (needs a valid design + launcher)
  let launched = false;
  try {
    const btn = page.getByRole('button', { name: /LAUNCH/ }).first();
    await btn.waitFor({ timeout: 8000 });
    const disabled = await btn.isDisabled();
    check('launch button is enabled for the prefilled design', !disabled, disabled ? 'disabled' : '');
    if (!disabled) {
      await btn.dispatchEvent('click');
      launched = true;
    }
  } catch (e) {
    console.log('LAUNCH button not usable:', e.message.split('\n')[0]);
  }

  if (launched) {
    await page.waitForTimeout(2000);
    await shot('06a-launch-countdown');
    await page.waitForTimeout(11000);
    await shot('06b-launch-ignition');
    await page.waitForTimeout(6000);
    await shot('06c-launch-ascent');
    await page.waitForTimeout(6000);
    await shot('06d-launch-burnout');
    await page.waitForTimeout(6000);
    await shot('06e-launch-orbit');
    try {
      await page.getByRole('button', { name: /Skip sequence/ }).first().dispatchEvent('click');
      console.log('ok — skipped launch tail');
    } catch {
      console.log('launch ended on its own');
    }
    await waitFor('[data-scene="orbit-ops"] canvas', 'orbit ops canvas', 25000);
    await page.waitForTimeout(3000);
    check('ops renders orbit canvas', (await countCanvases('[data-scene="orbit-ops"]')) >= 1);
    await shot('07-simulation-ops');

    // Time-warp ×10 so event nodes surface on the orbit
    try {
      await page.getByRole('button', { name: /WARP/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(6500);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(600);
      await shot('07b-ops-events');
    } catch (e) {
      console.log('warp speed-up skipped:', e.message.split('\n')[0]);
    }

    // v1.5 — a reload mid-mission must resume operations, not reset the run.
    try {
      const persisted = await page.evaluate(() => {
        const raw = localStorage.getItem('ma_save_v2');
        return raw ? JSON.parse(raw) : null;
      });
      const run = persisted?.run ?? null;
      check(
        'autosave stores the live run',
        persisted?.version === 2 && run?.screen === 'simulation' && run?.launch?.phase === 'ops' && !!run?.sim,
        run?.sim ? `day ${run.sim.elapsedDays.toFixed(1)}` : 'no run',
      );
      check(
        'autosave keeps the simulation clock',
        (run?.sim?.elapsedDays ?? 0) > 0,
        `day ${run?.sim?.elapsedDays ?? 0}`,
      );

      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1200);
      await waitFor('[data-scene="orbit-ops"] canvas', 'ops canvas after reload', 30000);
      await page.waitForTimeout(2400);
      const activeNav = await page.evaluate(
        () =>
          document.querySelector('nav[aria-label="Screens"] .ma-navbtn.is-active')?.textContent?.trim() ?? '',
      );
      check('reload lands back on the operations screen', activeNav === 'Simulation', activeNav || 'none');
      const resumedDay = await page.evaluate(() => {
        const raw = localStorage.getItem('ma_save_v2');
        return raw ? JSON.parse(raw)?.run?.sim?.elapsedDays ?? 0 : 0;
      });
      check('mission clock survives the reload', resumedDay > 0, `day ${Number(resumedDay).toFixed(1)}`);
      await shot('07c-resume-after-reload');
    } catch (e) {
      console.log('resume check failed:', e.message.split('\n')[0]);
      check('mid-mission reload resumes operations', false, e.message.split('\n')[0]);
    }

    // End the mission → Results with the orbital replay
    try {      await page.getByRole('button', { name: /End mission now|إنهاء المهمة الآن/ }).first().click({ timeout: 6000 });
      await waitFor('[data-scene="results-replay"] canvas', 'results replay canvas', 25000);
      await page.waitForTimeout(2400);
      check('results replay renders canvas', (await countCanvases('[data-scene="results-replay"]')) >= 1);
      await shot('10-results');
    } catch (e) {
      console.log('results step failed:', e.message.split('\n')[0]);
    }

    // Tech tree backdrop
    try {
      await nav('Tech Tree');
      await waitFor('[data-scene="tech-backdrop"] canvas', 'tech backdrop canvas', 25000);
      await page.waitForTimeout(2200);
      await shot('11-tech-tree');
    } catch (e) {
      console.log('tech tree step failed:', e.message.split('\n')[0]);
    }
  }

  // Style Guide embeds
  await nav('Home');
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Style Guide', exact: true }).first().click();
  await waitFor('[data-ops-section]', 'ops section', 25000);
  await page.waitForTimeout(2600);
  await page.evaluate(() => document.querySelector('[data-ops-section]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1300);
  await shot('08-styleguide-ops');
  await waitFor('[data-launch-section]', 'launch section', 25000);
  await page.evaluate(() => document.querySelector('[data-launch-section]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2000);
  await shot('08b-styleguide-launch');
  await page.evaluate(() =>
    document.querySelector('[data-screens-section]')?.scrollIntoView({ block: 'center' }),
  );
  await page.waitForTimeout(1300);
  await shot('09-styleguide-screens');

  // RTL pass: switch language through the real settings panel.
  // The screen nav is only rendered on non-home screens, so every hop below
  // starts from a screen that actually has it.
  try {
    await nav('Hangar');
    await page.waitForTimeout(900);
    await page.getByRole('tab', { name: /system/i }).click();
    await page.waitForTimeout(600);

    // v1.5 — backup UI: export writes a real file; re-import and corrupt import.
    const exportBtn = page.getByRole('button', { name: /Export progress/ }).first();
    const importBtn = page.getByRole('button', { name: /Import progress/ }).first();
    check(
      'hangar exposes save export/import',
      (await exportBtn.count()) === 1 && (await importBtn.count()) === 1,
    );

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      exportBtn.click(),
    ]);
    const exportedPath = await download.path();
    check(
      'export downloads a JSON save',
      !!exportedPath && /\.json$/i.test(download.suggestedFilename()),
      download.suggestedFilename(),
    );

    await page.setInputFiles('[data-testid="save-import-input"]', exportedPath ?? { name: 'missing.json', mimeType: 'application/json', buffer: Buffer.from('') });
    await page.waitForTimeout(900);
    const importNote =
      (await page.locator('[data-testid="save-import-note"]').textContent()) ?? '';
    check(
      're-importing the export is accepted',
      !!exportedPath && /Imported:/.test(importNote),
      importNote.trim() || 'no export file',
    );

    await page.setInputFiles('[data-testid="save-import-input"]', {
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not json'),
    });
    await page.waitForTimeout(700);
    const badNote =
      (await page.locator('[data-testid="save-import-note"]').textContent()) ?? '';
    check('a corrupt import is rejected safely', /not valid JSON/i.test(badNote), badNote.trim());

    await page.locator('select.ma-input').first().selectOption('ar');
    await page.waitForTimeout(1600);
    await shot('12-rtl-hangar');
    await nav('اختيار المهمة');
    await page.waitForTimeout(2400);
    await shot('14-rtl-mission-select');
    const dir = await page.evaluate(() => {
      const root = document.querySelector('.ma-root');
      return root ? getComputedStyle(root).direction : 'no-root';
    });
    console.log('computed direction:', dir);
    check('Arabic switches the shell to RTL', dir === 'rtl', dir);

    try {
      await nav('النتائج');
      await page.waitForTimeout(2000);
      await shot('15-rtl-results');
    } catch {
      console.log('rtl results screen not reachable in this run (no completed mission)');
    }

    await nav('الرئيسية');
    await page.waitForTimeout(2200);
    await shot('13-rtl-home');
  } catch (e) {
    console.log('rtl pass failed:', e.message.split('\n')[0]);
    check('Arabic RTL pass completed', false, e.message.split('\n')[0]);
  }
} catch (e) {
  flowError = e.message.split('\n')[0];
  console.log('FLOW ERROR:', flowError);
  try {
    await shot('99-error-state');
  } catch {
    /* nothing left to capture */
  }
}

/* ------------------------------------------- corrupt-save recovery drill */

try {
  const valid = await page.evaluate(() => localStorage.getItem('ma_save_v2'));
  check('a valid v2 save exists for the corruption drill', !!valid);

  // Seed a fresh context *before* the app boots: a corrupt primary plus the
  // valid payload as the backup. A reload in the main tab cannot be used here
  // because its pagehide flush would overwrite the injected corruption.
  const recovery = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await recovery.addInitScript(
    (raw) => {
      localStorage.setItem('ma_save_v2', '{broken json');
      if (raw) localStorage.setItem('ma_save_v2_backup', raw);
    },
    valid,
  );
  const rp = await recovery.newPage();
  rp.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`recovery console: ${m.text()}`);
  });
  rp.on('pageerror', (e) => consoleErrors.push(`recovery pageerror: ${e.message}`));
  await rp.goto(BASE_URL, { waitUntil: 'load' });
  await rp.waitForSelector('.ma-loadwarning', { timeout: 20000 });
  const banner = (await rp.locator('.ma-loadwarning').innerText()).replace(/\s+/g, ' ');
  const quarantined = await rp.evaluate(
    () => localStorage.getItem('ma_save_v2_corrupt') === '{broken json',
  );
  check(
    'corrupt save is quarantined and the backup is restored',
    quarantined && /backup was restored/i.test(banner),
    banner.slice(0, 90),
  );
  await rp.waitForTimeout(1600);
  await rp.screenshot({ path: path.join(OUT, '18-save-recovery.png') });
  screenshots.push(path.join(OUT, '18-save-recovery.png'));
  await rp.close();
  await recovery.close();
} catch (e) {
  console.log('corrupt-save drill failed:', e.message.split('\n')[0]);
  check('corrupt save recovery drill', false, e.message.split('\n')[0]);
}

/* ------------------------------------------- reduced motion (fresh page) */

try {
  const rm = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  rm.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`rm console: ${m.text()}`);
  });
  rm.on('pageerror', (e) => consoleErrors.push(`rm pageerror: ${e.message}`));
  await rm.goto(BASE_URL, { waitUntil: 'load' });
  await rm.waitForTimeout(3200);
  await rm.screenshot({ path: path.join(OUT, '16-reduced-motion-home.png') });
  screenshots.push(path.join(OUT, '16-reduced-motion-home.png'));
  await rm.getByRole('button', { name: 'Mission Select', exact: true }).first().click();
  await rm.waitForTimeout(700);
  const rmMode = await rm.evaluate(
    () => document.querySelector('[data-wormhole]')?.getAttribute('data-mode') ?? 'absent',
  );
  console.log('reduced-motion wormhole mode:', rmMode);
  check('reduced motion skips the full wormhole', rmMode !== 'canvas', rmMode);
  await rm.waitForSelector('[data-scene="mission-globe"] canvas', { timeout: 25000 });
  await rm.waitForTimeout(1500);
  await rm.screenshot({ path: path.join(OUT, '17-reduced-motion-mission-select.png') });
  screenshots.push(path.join(OUT, '17-reduced-motion-mission-select.png'));
  await rm.close();
  console.log('ok — reduced-motion pass');
} catch (e) {
  console.log('reduced-motion pass failed:', e.message.split('\n')[0]);
  check('reduced-motion pass completed', false, e.message.split('\n')[0]);
}

/* -------------------------------------------------------------- verdict */

const failedChecks = checks.filter((c) => !c.ok);
const ok = !flowError && consoleErrors.length === 0 && failedChecks.length === 0;

const summary = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  outDir: OUT,
  chrome: chromePath ?? 'playwright channel:chrome',
  ok,
  flowError,
  consoleErrors,
  checks,
  screenshots,
};

writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

console.log('');
console.log(`checks: ${checks.length - failedChecks.length}/${checks.length} passed`);
console.log(`screenshots: ${screenshots.length}`);
console.log(`CONSOLE ERRORS: ${consoleErrors.length ? JSON.stringify(consoleErrors, null, 1) : 'none'}`);
console.log(ok ? 'VISUAL CHECK PASS' : 'VISUAL CHECK FAIL');

await browser.close();
killTree(server);

process.exitCode = ok ? 0 : 1;
