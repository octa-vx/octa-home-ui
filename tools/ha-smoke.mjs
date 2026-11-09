// Installs the built ZIP into the isolated test instance and checks that it loads on HA 2026.9.4.
import { chromium } from '@playwright/test';
import { BASE, installZip, signedInContext, version, wsCall } from './ha-session.mjs';

await installZip();

const url = `/local/octa-home-ui/octa-home-ui.js?v=${version}`;
const resources = (await wsCall({ type: 'lovelace/resources' })).result;
const existing = resources.find((resource) => resource.url.includes('octa-home-ui.js'));
await wsCall(
  existing
    ? { type: 'lovelace/resources/update', resource_id: existing.id, res_type: 'module', url }
    : { type: 'lovelace/resources/create', res_type: 'module', url },
);

const themes = (await wsCall({ type: 'frontend/get_themes' })).result.themes;
const themeModes = Object.keys(themes['Octa Home UI']?.modes ?? {}).sort();

const browser = await chromium.launch();
const context = await signedInContext(browser, { viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
const logs = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => logs.push(message.text()));

await page.goto(`${BASE}/octa-zip/0`);
try {
  await page.waitForFunction(() => customElements.get('octa-gauge') !== undefined, undefined, { timeout: 45000 });
} catch (error) {
  console.error(JSON.stringify({ url: page.url(), resources: (await wsCall({ type: 'lovelace/resources' })).result, pageErrors: errors, logs: logs.slice(-15) }));
  await browser.close();
  throw error;
}
const rendered = await page.evaluate(async () => {
  const dial = document.createElement('octa-dial');
  dial.label = 'Test';
  dial.value = 42;
  document.body.append(dial);
  await dial.updateComplete;
  return dial.shadowRoot.querySelector('[role=slider]').getAttribute('aria-valuenow');
});
await browser.close();

const loaded = logs.some((line) => line === `octa-home-ui ${version}`);
const result = { version, loaded, rendered, themeModes, pageErrors: errors };
console.log(JSON.stringify(result));
if (!loaded || rendered !== '42' || themeModes.join() !== 'dark,light' || errors.length > 0) process.exit(1);
