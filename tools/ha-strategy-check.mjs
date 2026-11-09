// Generates the dashboard in the isolated test instance and checks that a new device appears by itself.
/* global setTimeout, window */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { BASE, api, installZip, signedInContext, wsCall } from './ha-session.mjs';

const SLUG = 'octa-auto';
const shots = process.env.OCTA_SHOT_DIR ?? 'test-results/ha-strategy';
mkdirSync(shots, { recursive: true });

await installZip();

const ok = (reply, what) => {
  if (reply.success === false && reply.error?.code !== 'home_assistant_error' && reply.error?.code !== 'already_exists') throw new Error(`${what}: ${JSON.stringify(reply.error)}`);
  return reply;
};

const areaName = 'Octa Testraum';
const areas = (await wsCall({ type: 'config/area_registry/list' })).result;
const area = areas.find((item) => item.name === areaName) ?? (await wsCall({ type: 'config/area_registry/create', name: areaName })).result;

const LIGHT = 'light.kitchen_lights';
ok(await wsCall({ type: 'config/entity_registry/update', entity_id: LIGHT, area_id: area.area_id }), 'assign area');

const dashboards = (await wsCall({ type: 'lovelace/dashboards/list' })).result;
if (!dashboards.some((dashboard) => dashboard.url_path === SLUG)) {
  await wsCall({ type: 'lovelace/dashboards/create', url_path: SLUG, title: 'Auto', icon: 'mdi:auto-fix', show_in_sidebar: true, require_admin: false, mode: 'storage' });
}
await wsCall({ type: 'lovelace/config/save', url_path: SLUG, config: { strategy: { type: 'custom:octa-home-ui', areas_order: [area.area_id] } } });

const browser = await chromium.launch();
const context = await signedInContext(browser, { viewport: { width: 1280, height: 900 } }, { theme: 'Octa Home UI', dark: false });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const tabs = () => page.evaluate(() => {
  const found = [];
  const walk = (root) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.localName === 'hui-root' && element.lovelace?.config?.views) found.push(element.lovelace.config.views.map((view) => view.title));
      if (element.shadowRoot) walk(element.shadowRoot);
    }
  };
  walk(document);
  return found[0] ?? [];
});

await page.goto(`${BASE}/${SLUG}/${area.area_id}`);
await page.locator('octa-light-card').first().waitFor({ timeout: 45000 });
await page.waitForTimeout(1500);

const views = await tabs();
const inPicker = await page.evaluate(() => window.customStrategies.filter((entry) => entry.type === 'octa-home-ui').map((entry) => entry.strategyType));
const areaLights = await page.locator('octa-light-card').count();
await page.screenshot({ path: `${shots}/area.png`, fullPage: true });
const areaSwitches = await page.locator('octa-switch-card').count();

// A device added while the dashboard is open has to show up without a reload.
const NEW = `octa_neu_${Date.now()}`;
const created = (await wsCall({ type: 'input_boolean/create', name: NEW })).result;
const newId = `input_boolean.${created.id}`;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const reply = await api(`states/${newId}`);
  if (reply.ok) break;
  await new Promise((resolve) => setTimeout(resolve, 200));
}
ok(await wsCall({ type: 'config/entity_registry/update', entity_id: newId, area_id: area.area_id }), 'assign new');
let appeared = false;
for (let attempt = 0; attempt < 60 && !appeared; attempt += 1) {
  appeared = (await page.locator('octa-switch-card').count()) > areaSwitches;
  if (!appeared) await new Promise((resolve) => setTimeout(resolve, 500));
}
await page.screenshot({ path: `${shots}/after-new-device.png`, fullPage: true });

await page.goto(`${BASE}/${SLUG}/overview`);
await page.locator('octa-weather-card').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${shots}/overview.png`, fullPage: true });
const overviewCards = { weather: await page.locator('octa-weather-card').count(), people: await page.locator('octa-security-card').count() };
await browser.close();

await wsCall({ type: 'input_boolean/delete', input_boolean_id: created.id });

const result = { views, inPicker, areaLights, appeared, overviewCards, pageErrors: errors };
console.log(JSON.stringify(result, null, 1));
if (views.length < 3 || !views.includes(areaName) || inPicker.length !== 2 || areaLights < 1 || !appeared || overviewCards.weather !== 1 || errors.length > 0) process.exit(1);
