/**
 * visual-check — automated visual walkthrough for Mission Architect.
 * Drives the real UI through a full mission flow in headless Chrome
 * (system Chrome via executablePath) and saves screenshots for review.
 *
 * Usage: node scripts/visual-check.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\opencode\\ma-step6';
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}\\${name}.png` });
  console.log('shot', name);
};
const waitFor = async (sel, label, timeout = 20000) => {
  await page.waitForSelector(sel, { timeout });
  console.log('ok —', label);
};
const countCanvases = (sel) => page.evaluate((s) => document.querySelectorAll(`${s} canvas`).length, sel);
const nav = async (name) => {
  await page.getByRole('button', { name, exact: true }).first().click();
};

try {
  await page.goto('http://localhost:5174/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  await shot('01-home');

  // Home → Mission Select (wormhole transition)
  await nav('Mission Select');
  await page.waitForTimeout(650);
  const wm = await page.evaluate(() => {
    const el = document.querySelector('[data-wormhole]');
    return el ? el.getAttribute('data-mode') ?? 'canvas' : 'absent';
  });
  console.log('wormhole mode mid-transition:', wm);
  await shot('02-wormhole');
  await waitFor('[data-scene="mission-globe"] canvas', 'mission globe canvas');
  await page.waitForTimeout(1500);
  console.log('mission-globe canvases:', await countCanvases('[data-scene="mission-globe"]'));
  await shot('03-mission-select');

  // GO → Builder (dispatch: the floating AI chip can sit over the corner CTA)
  await page.locator('button[aria-label^="Go to builder"]').dispatchEvent('click');
  await waitFor('[data-scene="builder-preview"] canvas', 'builder preview canvas');
  await page.waitForTimeout(1800);
  console.log('builder-preview canvases:', await countCanvases('[data-scene="builder-preview"]'));
  await shot('04-builder');

  // → Orbit Designer
  await nav('Orbit Designer');
  await waitFor('[data-scene="orbit-designer"] canvas', 'orbit designer canvas');
  await page.waitForTimeout(1800);
  console.log('orbit-designer canvases:', await countCanvases('[data-scene="orbit-designer"]'));
  await shot('05-orbit');

  // LAUNCH (needs a valid design + launcher)
  let launched = false;
  try {
    const btn = page.getByRole('button', { name: /LAUNCH/ }).first();
    await btn.waitFor({ timeout: 8000 });
    const disabled = await btn.isDisabled();
    console.log('LAUNCH disabled:', disabled);
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
    await page.waitForTimeout(11000); // T-0 + ~5.5s → p≈0.21, flame on
    await shot('06b-launch-ignition');
    await page.waitForTimeout(6000); // p≈0.44
    await shot('06c-launch-ascent');
    await page.waitForTimeout(6000); // p≈0.67 burnout
    await shot('06d-launch-burnout');
    await page.waitForTimeout(6000); // p≈0.90
    await shot('06e-launch-orbit');
    try {
      await page.getByRole('button', { name: /Skip sequence/ }).first().dispatchEvent('click');
      console.log('ok — skipped launch tail');
    } catch {
      console.log('launch ended on its own');
    }
    await waitFor('[data-scene="orbit-ops"] canvas', 'orbit ops canvas', 25000);
    await page.waitForTimeout(3000);
    console.log('orbit-ops canvases:', await countCanvases('[data-scene="orbit-ops"]'));
    await shot('07-simulation-ops');

    // Time-warp ×10 so event nodes surface on the orbit (severity-tinted DataNodes)
    try {
      await page.getByRole('button', { name: /WARP/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(6500);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(600);
      await shot('07b-ops-events');
    } catch (e) {
      console.log('warp speed-up skipped:', e.message.split('\n')[0]);
    }

    // Step 8 — end the mission → Results with the orbital replay
    try {
      await page.getByRole('button', { name: /End mission now|إنهاء المهمة الآن/ }).first().click({ timeout: 6000 });
      await waitFor('[data-scene="results-replay"] canvas', 'results replay canvas', 25000);
      await page.waitForTimeout(2400);
      console.log('results replay canvases:', await countCanvases('[data-scene="results-replay"]'));
      await shot('10-results');
    } catch (e) {
      console.log('results step failed:', e.message.split('\n')[0]);
    }

    // Step 8 — tech tree backdrop
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
  await page.evaluate(() => document.querySelector('[data-screens-section]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1300);
  await shot('09-styleguide-screens');

  // Step 9 — RTL pass: switch language through the real settings panel
  try {
    await nav('Home');
    await page.waitForTimeout(900);
    await nav('Hangar');
    await page.waitForTimeout(900);
    await page.getByRole('tab', { name: /system/i }).click();
    await page.waitForTimeout(600);
    await page.locator('select.ma-input').first().selectOption('ar');
    await page.waitForTimeout(1600);
    await shot('12-rtl-hangar');
    await nav('الرئيسية');
    await page.waitForTimeout(2200);
    await shot('13-rtl-home');
    await nav('اختيار المهمة');
    await page.waitForTimeout(2400);
    await shot('14-rtl-mission-select');
    await nav('النتائج');
    await page.waitForTimeout(2400);
    await shot('15-rtl-results');
    const dir = await page.evaluate(() => {
      const root = document.querySelector('.ma-root');
      return root ? getComputedStyle(root).direction : 'no-root';
    });
    console.log('computed direction:', dir);
  } catch (e) {
    console.log('rtl pass failed:', e.message.split('\n')[0]);
  }

  // Step 9 — prefers-reduced-motion (fresh context, media emulation)
  try {
    const rm = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    rm.on('console', (m) => {
      if (m.type() === 'error') errors.push(`rm console: ${m.text()}`);
    });
    rm.on('pageerror', (e) => errors.push(`rm pageerror: ${e.message}`));
    await rm.goto('http://localhost:5174/', { waitUntil: 'load' });
    await rm.waitForTimeout(3200);
    await rm.screenshot({ path: `${OUT}\\16-reduced-motion-home.png` });
    await rm.getByRole('button', { name: 'Mission Select', exact: true }).first().click();
    await rm.waitForTimeout(700);
    const rmMode = await rm.evaluate(() => document.querySelector('[data-wormhole]')?.getAttribute('data-mode') ?? 'absent');
    console.log('reduced-motion wormhole mode:', rmMode);
    await rm.waitForSelector('[data-scene="mission-globe"] canvas', { timeout: 25000 });
    await rm.waitForTimeout(1500);
    await rm.screenshot({ path: `${OUT}\\17-reduced-motion-mission-select.png` });
    await rm.close();
    console.log('ok — reduced-motion pass');
  } catch (e) {
    console.log('reduced-motion pass failed:', e.message.split('\n')[0]);
  }
} catch (e) {
  console.log('FLOW ERROR:', e.message.split('\n')[0]);
  try {
    await shot('99-error-state');
  } catch {}
} finally {
  console.log('CONSOLE ERRORS:', errors.length ? JSON.stringify(errors, null, 1) : 'none');
  await browser.close();
}
