/**
 * mobile-check — responsive gate for ORBITAL at 375×812 and 768×1024.
 *
 * Drives the real UI through every gameplay screen (including a full launch →
 * operations → results cycle), then asserts the things that actually broke on
 * phones:
 *   • the document never scrolls horizontally,
 *   • the screen rail stays on one row instead of wrapping into a tall block,
 *   • every persistent control has a ≥44px hit area (checkbox rows count via
 *     their label target),
 *   • the mission carousel and tech tree are really scrollable (not clipped),
 *   • no console errors along the way.
 *
 * Portable like visual-check: discovers Chrome, starts the dev server when
 * needed, and exits non-zero so `npm run verify` can gate on it.
 *
 * Usage:
 *   npm run test:mobile
 *   BASE_URL=http://localhost:5174/ npm run test:mobile
 *
 * Environment:
 *   BASE_URL      target URL (default http://localhost:5174/)
 *   CHROME_PATH   path to a Chrome/Chromium binary (auto-detected otherwise)
 *   MOBILE_OUT    screenshot directory (default <repo>/artifacts/mobile-check)
 *   HEADLESS=0    run a visible browser
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5174/';
const OUT = path.resolve(process.env.MOBILE_OUT ?? path.join(ROOT, 'artifacts', 'mobile-check'));
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

const checks = [];
const consoleErrors = [];
const screenshots = [];
const metrics = [];

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

const VIEWPORTS = [
  { width: 375, height: 812, tag: '375' },
  { width: 768, height: 1024, tag: '768' },
];

/* ---------------------------------------------------------------- helpers */

async function measureLayout(page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    const nav = document.querySelector('nav[aria-label="Screens"]');
    const navRect = nav?.getBoundingClientRect();
    const interactive = Array.from(
      document.querySelectorAll(
        'button, [role="button"], [role="tab"], [role="option"], select, input[type="checkbox"], a[href]',
      ),
    );
    const small = [];
    let checkboxRows = 0;
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest('[data-scene]') || el.tagName === 'CANVAS') continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        const label = el.closest('label');
        const lr = label?.getBoundingClientRect();
        if (lr && lr.width >= 44 && lr.height >= 44) {
          checkboxRows += 1;
          continue;
        }
      }
      if (r.width < 43.5 || r.height < 43.5) {
        small.push({
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
          cls: String(el.className || '').split(' ').slice(0, 2).join('.'),
        });
      }
    }
    return {
      vw: window.innerWidth,
      docW: document.documentElement.scrollWidth,
      bodyW: document.body.scrollWidth,
      headerH: header ? Math.round(header.getBoundingClientRect().height) : 0,
      hasNav: !!nav,
      navH: navRect ? Math.round(navRect.height) : 0,
      navScrollW: nav ? nav.scrollWidth : 0,
      navClientW: nav ? nav.clientWidth : 0,
      navScrollH: nav ? nav.scrollHeight : 0,
      navClientH: nav ? nav.clientHeight : 0,
      small,
      checkboxRows,
    };
  });
}

/* ------------------------------------------------------------- viewports */

async function runViewport({ width, height, tag }) {
  const context = await browser.newContext({ viewport: { width, height } });
  // Deterministic start: a developer save must never leak into the gate.
  // Clear once per tab session so mid-run reloads would still see written data.
  await context.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('ma-mobile-cleared')) {
        localStorage.clear();
        sessionStorage.setItem('ma-mobile-cleared', '1');
      }
    } catch {
      /* storage disabled */
    }
  });

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${tag}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[${tag}] pageerror: ${e.message}`));

  const shot = async (name) => {
    const file = path.join(OUT, `${tag}-${name}.png`);
    await page.screenshot({ path: file });
    screenshots.push(file);
    console.log('shot', path.basename(file));
  };

  const nav = async (name, wait = 1100) => {
    const btn = page.locator('nav[aria-label="Screens"] button').filter({ hasText: name }).first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForTimeout(wait);
  };

  const inspect = async (label) => {
    const data = await measureLayout(page);
    metrics.push({ tag, label, ...data });
    check(
      `${tag} ${label}: no horizontal page scroll`,
      data.docW <= data.vw + 1 && data.bodyW <= data.vw + 1,
      `docW ${data.docW} / vw ${data.vw}`,
    );
    check(
      `${tag} ${label}: touch targets ≥44px`,
      data.small.length === 0,
      data.small.length
        ? data.small.map((s) => `${s.label || s.cls} ${s.w}×${s.h}`).join(', ')
        : `all pass${data.checkboxRows ? ` (${data.checkboxRows} checkbox rows via 44px labels)` : ''}`,
    );
    if (data.hasNav) {
      check(
        `${tag} ${label}: screen rail is one row`,
        data.navScrollH <= data.navClientH + 2,
        `${data.navScrollH}px content / ${data.navClientH}px rail`,
      );
      check(`${tag} ${label}: header stays compact`, data.headerH <= 140, `${data.headerH}px`);
    } else {
      check(`${tag} ${label}: header stays compact`, data.headerH <= 96, `${data.headerH}px`);
    }
    await shot(label);
    return data;
  };

  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(3200);
  await inspect('01-home');

  // ---- Mission Select + carousel rail
  // Home has no screen rail; enter through the command menu.
  await page.getByRole('button', { name: 'Mission Select', exact: true }).first().click();
  await page.waitForTimeout(700);
  try {
    await page.waitForSelector('[data-scene="mission-globe"] canvas', { timeout: 25000 });
  } catch {
    check(`${tag} mission select renders the globe`, false, 'canvas timeout');
  }
  await page.waitForTimeout(1400);
  await inspect('02-mission-select');

  const carousel = await page.evaluate(() => {
    const el = document.querySelector('.ma-carousel');
    if (!el) return null;
    const items = el.querySelectorAll('[role="option"]');
    return {
      sw: el.scrollWidth,
      cw: el.clientWidth,
      items: items.length,
    };
  });
  check(
    `${tag} mission carousel scrolls sideways`,
    !!carousel && carousel.sw > carousel.cw + 4,
    carousel ? `${carousel.sw}px / ${carousel.cw}px, ${carousel.items} missions` : 'carousel missing',
  );
  const carouselHint = await page.locator('.ma-swipe-hint').first().isVisible();
  check(`${tag} mission carousel shows a swipe hint`, carouselHint);
  if (carousel) {
    await page.locator('.ma-carousel').evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await page.waitForTimeout(500);
    const moved = await page.locator('.ma-carousel').evaluate((el) => Math.abs(el.scrollLeft) > 4);
    check(`${tag} mission carousel actually scrolls`, moved);
    const last = await page.locator('.ma-carousel [role="option"]').last().boundingBox();
    check(
      `${tag} last mission is reachable by scrolling`,
      !!last && last.x >= -1 && last.x + last.width <= width + 1,
      last ? `x ${Math.round(last.x)}…${Math.round(last.x + last.width)}` : 'no item',
    );
  }

  // ---- Screen rail: every destination reachable without wrapping
  try {
    const rail = page.locator('nav[aria-label="Screens"]');
    const railInfo = await rail.evaluate((el) => ({
      sw: el.scrollWidth,
      cw: el.clientWidth,
      sh: el.scrollHeight,
      ch: el.clientHeight,
    }));
    check(
      `${tag} screen rail scrolls instead of wrapping`,
      railInfo.sw > railInfo.cw,
      `${railInfo.sw}px / ${railInfo.cw}px`,
    );
    const buttons = rail.locator('button');
    const count = await buttons.count();
    const railBox = await rail.boundingBox();
    let reachable = 0;
    const unreachable = [];
    for (let i = 0; i < count; i += 1) {
      const btn = buttons.nth(i);
      await btn.evaluate((el) => el.scrollIntoView({ inline: 'center', block: 'nearest' }));
      const box = await btn.boundingBox();
      const inside =
        !!box &&
        !!railBox &&
        box.x >= railBox.x - 1 &&
        box.x + box.width <= railBox.x + railBox.width + 1;
      if (inside) reachable += 1;
      else unreachable.push((await btn.textContent())?.trim() ?? `#${i}`);
    }
    check(
      `${tag} every nav destination is reachable`,
      reachable === count,
      `${reachable}/${count} inside the rail after scrolling${unreachable.length ? ` — ${unreachable.join(', ')}` : ''}`,
    );
  } catch (e) {
    check(`${tag} nav rail reached every destination`, false, e.message.split('\n')[0]);
  }

  // ---- Builder
  await page.locator('button[aria-label^="Go to builder"]').first().dispatchEvent('click');
  await page.waitForTimeout(2200);
  await inspect('03-builder');

  // ---- Launcher
  await nav('Launcher', 1000);
  await inspect('04-launcher');

  // ---- Orbit Designer
  await nav('Orbit Designer', 700);
  try {
    await page.waitForSelector('[data-scene="orbit-designer"] canvas', { timeout: 25000 });
  } catch {
    check(`${tag} orbit designer renders`, false, 'canvas timeout');
  }
  await page.waitForTimeout(1500);
  await inspect('05-orbit');

  // ---- Launch → operations
  let launched = false;
  try {
    const btn = page.getByRole('button', { name: /LAUNCH/ }).first();
    await btn.waitFor({ timeout: 8000 });
    const disabled = await btn.isDisabled();
    check(`${tag} LAUNCH is enabled for the prefilled design`, !disabled, disabled ? 'disabled' : '');
    if (!disabled) {
      await btn.dispatchEvent('click');
      launched = true;
    }
  } catch (e) {
    check(`${tag} LAUNCH button is usable`, false, e.message.split('\n')[0]);
  }

  if (launched) {
    await page.waitForTimeout(1800);
    await shot('06-launch');
    try {
      await page.getByRole('button', { name: /Skip sequence/ }).first().dispatchEvent('click');
    } catch {
      console.log(`${tag}: launch sequence finished on its own`);
    }
    try {
      await page.waitForSelector('[data-scene="orbit-ops"] canvas', { timeout: 45000 });
      await page.waitForTimeout(2600);
      await inspect('07-simulation');

      await page.getByRole('button', { name: /End mission now/ }).first().click({ timeout: 8000 });
      await page.waitForSelector('[data-scene="results-replay"] canvas', { timeout: 25000 });
      await page.waitForTimeout(2200);
      await inspect('08-results');
    } catch (e) {
      check(`${tag} launch cycle reaches results`, false, e.message.split('\n')[0]);
    }
  }

  // ---- Tech Tree
  await nav('Tech Tree', 700);
  try {
    await page.waitForSelector('[data-scene="tech-backdrop"] canvas', { timeout: 25000 });
  } catch {
    /* backdrop is decorative; the tree itself still counts */
  }
  await page.waitForTimeout(1400);
  await inspect('09-tech-tree');
  const tech = await page.evaluate(() => {
    const scroller = document.querySelector('[data-scene="tech-backdrop"]')?.closest('.overflow-x-auto')
      ?? Array.from(document.querySelectorAll('.overflow-x-auto')).find((el) => el.querySelector('svg[role="img"]'));
    if (!scroller) return null;
    return { sw: scroller.scrollWidth, cw: scroller.clientWidth };
  });
  check(
    `${tag} tech tree pans horizontally`,
    !!tech && tech.sw > tech.cw + 4,
    tech ? `${tech.sw}px / ${tech.cw}px` : 'scroller not found',
  );
  const techHint = await page.locator('.ma-swipe-hint').first().isVisible();
  check(`${tag} tech tree shows a pan hint`, techHint);

  // ---- Hangar + System tab
  await nav('Hangar', 1200);
  await inspect('10-hangar');
  try {
    await page.getByRole('tab', { name: /system/i }).click();
    await page.waitForTimeout(900);
    await inspect('11-hangar-system');

    // RTL spot-check: Arabic is the other first-class layout and flips the
    // whole shell, including the scroll rail and the mission carousel.
    await page.locator('select.ma-input').first().selectOption('ar');
    await page.waitForTimeout(1400);
    const dir = await page.evaluate(() => {
      const root = document.querySelector('.ma-root');
      return root ? getComputedStyle(root).direction : 'no-root';
    });
    check(`${tag} Arabic switches the shell to RTL`, dir === 'rtl', dir);
    await inspect('12-hangar-system-rtl');
    await nav('اختيار المهمة', 1400);
    await inspect('13-mission-select-rtl');
    const rtlCarousel = await page.evaluate(() => {
      const el = document.querySelector('.ma-carousel');
      return el ? { sw: el.scrollWidth, cw: el.clientWidth } : null;
    });
    check(
      `${tag} RTL carousel still scrolls`,
      !!rtlCarousel && rtlCarousel.sw > rtlCarousel.cw + 4,
      rtlCarousel ? `${rtlCarousel.sw}px / ${rtlCarousel.cw}px` : 'carousel missing',
    );
  } catch (e) {
    check(`${tag} hangar system tab opens`, false, e.message.split('\n')[0]);
  }

  await context.close();
}

try {
  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.width}×${vp.height} ===`);
    await runViewport(vp);
  }
} catch (e) {
  check('mobile walkthrough completed', false, e.message.split('\n')[0]);
  try {
    // best-effort error capture from the last page state
    const pages = browser.contexts().flatMap((c) => c.pages());
    const last = pages[pages.length - 1];
    if (last) {
      await last.screenshot({ path: path.join(OUT, '99-error-state.png') });
      screenshots.push(path.join(OUT, '99-error-state.png'));
    }
  } catch {
    /* nothing left to capture */
  }
}

/* -------------------------------------------------------------- verdict */

const failedChecks = checks.filter((c) => !c.ok);
const ok = failedChecks.length === 0 && consoleErrors.length === 0;

const summary = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  outDir: OUT,
  chrome: chromePath ?? 'playwright channel:chrome',
  viewports: VIEWPORTS.map((v) => `${v.width}x${v.height}`),
  ok,
  consoleErrors,
  checks,
  metrics,
  screenshots,
};

writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

console.log('');
console.log(`checks: ${checks.length - failedChecks.length}/${checks.length} passed`);
console.log(`screenshots: ${screenshots.length}`);
console.log(`CONSOLE ERRORS: ${consoleErrors.length ? JSON.stringify(consoleErrors, null, 1) : 'none'}`);
console.log(ok ? 'MOBILE CHECK PASS' : 'MOBILE CHECK FAIL');

await browser.close();
killTree(server);

process.exitCode = ok ? 0 : 1;
