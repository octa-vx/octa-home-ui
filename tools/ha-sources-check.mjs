// Exercises the camera and system cards with real data sources in the isolated test instance:
// a public webcam, a camera whose image disappears on purpose, System Monitor and real container figures.
// Environment: see ha-session.mjs. OCTA_DOCKER_STATS (file with lines "name|status|cpu|memory") is required,
// OCTA_WEBCAM_URL and OCTA_SHOT_DIR are optional overrides.
/* global AbortSignal, setTimeout */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { BASE, api, installZip, signedInContext, wsCall } from './ha-session.mjs';

const SLUG = 'octa-sources';
const WEBCAM = process.env.OCTA_WEBCAM_URL ?? 'https://www.foto-webcam.eu/webcam/zugspitze/current/1200.jpg';
const LOCAL_FILE = join(process.env.OCTA_HA_CONFIG, 'www', 'octa-camera-test.jpg');
const shots = process.env.OCTA_SHOT_DIR ?? 'test-results/ha-sources';
mkdirSync(shots, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (response) => response.json();
const flow = (path, body) => api(`config/config_entries/flow${path}`, { method: 'POST', body: JSON.stringify(body) }).then(json);
const entries = async () => (await api('config/config_entries/entry')).json();
const removeEntries = async (domain) => {
  for (const entry of await entries()) if (entry.domain === domain) await api(`config/config_entries/entry/${entry.entry_id}`, { method: 'DELETE' });
};
const allStates = async () => (await api('states')).json();
const read = async (id) => (await api(`states/${id}`)).json();

async function addGeneric(title, data) {
  const before = new Set((await allStates()).map((state) => state.entity_id));
  const start = await flow('', { handler: 'generic' });
  let step = await flow(`/${start.flow_id}`, { still_image_url: data.still, ...(data.stream ? { stream_source: data.stream } : {}), advanced: { authentication: 'basic', framerate: 2, verify_ssl: true } });
  if (step.errors && Object.keys(step.errors).length > 0) throw new Error(`generic ${title}: ${JSON.stringify(step.errors)}`);
  if (step.step_id === 'user_confirm') step = await flow(`/${start.flow_id}`, { confirmed_ok: true });
  if (step.type !== 'create_entry') throw new Error(`generic ${title}: ${JSON.stringify(step).slice(0, 300)}`);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const added = (await allStates()).find((state) => state.entity_id.startsWith('camera.') && !before.has(state.entity_id));
    if (added) return added.entity_id;
    await sleep(250);
  }
  throw new Error(`generic ${title}: no entity`);
}

// A camera served by the test instance itself, so its image can change and disappear on demand.
const painter = await chromium.launch();
const paint = async (width, height, color) => {
  const painted = await painter.newPage({ viewport: { width, height } });
  await painted.setContent(`<body style="margin:0;background:${color}"></body>`);
  const picture = await painted.screenshot({ type: 'jpeg' });
  await painted.close();
  return picture;
};
const large = await paint(1200, 675, '#35506b');
const small = await paint(400, 225, '#6b5035');
await painter.close();

// The public source is asked once per run and is optional, it may be down or limit requests.
const webcamReachable = await fetch(WEBCAM, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) }).then((response) => response.ok).catch(() => false);

await installZip();
writeFileSync(LOCAL_FILE, large);
await removeEntries('generic');
await removeEntries('systemmonitor');
const results = { pageErrors: [] };
const posted = [];

const webcam = webcamReachable ? await addGeneric('webcam', { still: WEBCAM }) : null;
results.webcamReachable = webcamReachable;
const localCam = await addGeneric('local', { still: 'http://127.0.0.1:8123/local/octa-camera-test.jpg' });

// System Monitor. Most figures are disabled by default, so they are switched on first.
const started = await flow('', { handler: 'systemmonitor' });
if (started.type === 'form') await flow(`/${started.flow_id}`, {});
const entry = (await entries()).find((item) => item.domain === 'systemmonitor');
const registry = (await wsCall({ type: 'config/entity_registry/list' })).result.filter((item) => item.platform === 'systemmonitor');
const wanted = { cpu: /processor_use/, memory: /memory_usage|memory_use_percent/, disk: /disk_usage|disk_use_percent/, uptime: /last_boot/, temperature: /processor_temperature/ };
const pick = (pattern) => registry.find((item) => pattern.test(item.entity_id) && !/swap/.test(item.entity_id));
const roles = Object.fromEntries(Object.entries(wanted).flatMap(([role, pattern]) => (pick(pattern) ? [[role, pick(pattern).entity_id]] : [])));
for (const id of Object.values(roles)) await wsCall({ type: 'config/entity_registry/update', entity_id: id, disabled_by: null });
await api(`config/config_entries/entry/${entry.entry_id}/reload`, { method: 'POST' });
for (let attempt = 0; attempt < 240; attempt += 1) {
  const ready = await Promise.all(Object.values(roles).map(read));
  if (ready.every((state) => state.state && !['unknown', 'unavailable'].includes(state.state))) break;
  await sleep(500);
}

// Real container figures as plain sensors, so the Docker socket is not exposed to anything.
const containers = readFileSync(process.env.OCTA_DOCKER_STATS, 'utf8').trim().split('\n').map((line) => line.split('|')).map(([name, status, cpu, memory], index) => ({ name, status, cpu: Number.parseFloat(cpu), memory: Number.parseFloat(memory), index }));
const put = async (id, state, attributes) => {
  posted.push(id);
  await api(`states/${id}`, { method: 'POST', body: JSON.stringify({ state: String(state), attributes }) });
};
const dockerList = [];
for (const item of containers) {
  const base = `sensor.octa_docker_${item.index}`;
  await put(`${base}_status`, item.status, { friendly_name: `${item.name} Status` });
  await put(`${base}_cpu`, item.cpu, { unit_of_measurement: '%', friendly_name: `${item.name} CPU` });
  await put(`${base}_memory`, item.memory, { unit_of_measurement: '%', friendly_name: `${item.name} RAM` });
  dockerList.push({ name: item.name, status: `${base}_status`, cpu: `${base}_cpu`, memory: `${base}_memory` });
}

const dashboards = (await wsCall({ type: 'lovelace/dashboards/list' })).result;
if (!dashboards.some((item) => item.url_path === SLUG)) await wsCall({ type: 'lovelace/dashboards/create', url_path: SLUG, title: 'Quellen', mode: 'storage', show_in_sidebar: false, require_admin: false });
const cameraCards = [
  ...(webcam
    ? [
        { type: 'custom:octa-camera-card', entity: webcam, name: 'Webcam' },
        { type: 'custom:octa-camera-card', entity: webcam, variant: 'snapshot', name: 'Webcam Standbild' },
      ]
    : []),
  { type: 'custom:octa-camera-card', entity: localCam, variant: 'snapshot', name: 'Lokal' },
  { type: 'custom:octa-camera-card', entity: localCam, name: 'Lokal live' },
  { type: 'custom:octa-camera-card', entity: localCam, variant: 'ptz', name: 'PTZ' },
];
const at = (name) => cameraCards.findIndex((card) => card.name === name);
const cards = [
  ...cameraCards,
  { type: 'custom:octa-system-card', variant: 'system_status', roles },
  { type: 'custom:octa-system-card', variant: 'server_status', roles: { cpu: roles.cpu, memory: roles.memory } },
  { type: 'custom:octa-system-card', variant: 'docker_status', containers: dockerList },
];
await wsCall({ type: 'lovelace/config/save', url_path: SLUG, config: { views: [{ title: 'Quellen', type: 'sections', max_columns: 2, sections: [{ type: 'grid', cards }] }] } });

const browser = await chromium.launch();
const context = await signedInContext(browser, { viewport: { width: 1280, height: 1000 } }, { theme: 'Octa Home UI', dark: false });
const page = await context.newPage();
page.on('pageerror', (error) => results.pageErrors.push(error.message));
await page.goto(`${BASE}/${SLUG}/0`);
await page.waitForSelector('octa-system-card', { timeout: 45000 });

const camera = (index) => page.locator('octa-camera-card').nth(index);
const image = (index) => camera(index).locator('octa-camera-image img').first();
const loaded = async (index) => {
  try {
    await page.waitForFunction(
      async ([cardIndex]) => {
        const walk = (root, out = []) => {
          for (const element of root.querySelectorAll('*')) {
            if (element.localName === 'octa-camera-card') out.push(element);
            if (element.shadowRoot) walk(element.shadowRoot, out);
          }
          return out;
        };
        const img = walk(document)[cardIndex]?.shadowRoot.querySelector('octa-camera-image')?.shadowRoot?.querySelector('img');
        return img && img.complete && img.naturalWidth > 0;
      },
      [index],
      { timeout: 30000 },
    );
    return image(index).evaluate((element) => ({ width: element.naturalWidth, height: element.naturalHeight }));
  } catch {
    return null;
  }
};
if (webcam) {
  results.webcamStill = await loaded(at('Webcam Standbild'));
  results.webcamLiveShown = (await image(at('Webcam')).count()) === 1;
}
const LOCAL = at('Lokal');
const LOCAL_LIVE = at('Lokal live');
results.localFrame = await loaded(LOCAL);
results.ptzHidden = (await camera(at('PTZ')).locator('.pad').count()) === 0;

const widthOf = () => image(LOCAL).evaluate((element) => element.naturalWidth).catch(() => 0);
const widthBefore = await widthOf();
writeFileSync(LOCAL_FILE, small);
let widthAfter = widthBefore;
for (let attempt = 0; attempt < 30 && widthAfter === widthBefore; attempt += 1) {
  await page.waitForTimeout(1000);
  widthAfter = await widthOf();
}
results.newFrameArrives = { before: widthBefore, after: widthAfter };
await page.locator('body').screenshot({ path: `${shots}/online.png` });

rmSync(LOCAL_FILE);
await page.waitForTimeout(36000);
const isStale = (index) => camera(index).locator('octa-camera-image[stale]').count();
const staleVisible = (index) => camera(index).locator('.stale-tag').isVisible();
results.offline = {
  cardStillThere: (await camera(LOCAL).count()) === 1,
  keepsLastFrame: (await widthOf()) === widthAfter && widthAfter > 0,
  entityState: (await read(localCam)).state,
};
await camera(LOCAL_LIVE).screenshot({ path: `${shots}/offline.png` });

writeFileSync(LOCAL_FILE, large);
let widthBack = 0;
for (let attempt = 0; attempt < 30 && widthBack !== widthBefore; attempt += 1) {
  await page.waitForTimeout(1000);
  widthBack = await widthOf();
}
results.recovers = widthBack === widthBefore;

// Generic cameras keep answering with their last frame, so "no image" is forced at the proxy instead.
const setPicture = (index, change) =>
  camera(index).evaluate((card, code) => {
    const element = card.shadowRoot.querySelector('octa-camera-image');
    if (code === 'break') {
      element.dataset.picture = element.picture;
      element.picture = '/api/camera_proxy/camera.gibt_es_nicht?token=invalid';
    } else element.picture = element.dataset.picture;
  }, change);
await setPicture(LOCAL, 'break');
await setPicture(LOCAL_LIVE, 'break');
await page.waitForTimeout(36000);
results.noImage = {
  snapshotMarked: (await isStale(LOCAL)) === 1 && (await staleVisible(LOCAL)),
  liveMarked: (await isStale(LOCAL_LIVE)) === 1 && (await staleVisible(LOCAL_LIVE)),
  liveTagHidden: !(await camera(LOCAL_LIVE).locator('.primary-tag').isVisible()),
};
await camera(LOCAL_LIVE).screenshot({ path: `${shots}/stale.png` });
await setPicture(LOCAL, 'restore');
await setPicture(LOCAL_LIVE, 'restore');
await page.waitForTimeout(32000);
results.noImage.clearsAgain = (await isStale(LOCAL)) === 0 && (await isStale(LOCAL_LIVE)) === 0;

const system = (index) => page.locator('octa-system-card').nth(index);
const rows = (card) => card.locator('.row').allInnerTexts();
results.system = await rows(system(0));
results.server = await rows(system(1));
const docker = system(2);
const dockerRows = await rows(docker);
results.docker = {
  containers: containers.length,
  rows: dockerRows.length,
  missing: await docker.locator('octa-status').count(),
  controls: await docker.evaluate((element) => element.shadowRoot.querySelectorAll('octa-button, octa-switch, octa-slider, button, input').length),
};
results.roles = Object.keys(roles);
results.registryBoot = registry.filter((item) => /boot/.test(item.entity_id)).map((item) => item.entity_id);
await system(0).screenshot({ path: `${shots}/system.png` });
await docker.screenshot({ path: `${shots}/docker.png` });
await browser.close();

rmSync(LOCAL_FILE, { force: true });
for (const id of posted) await api(`states/${id}`, { method: 'DELETE' });
await removeEntries('generic');
await removeEntries('systemmonitor');

console.log(JSON.stringify(results, null, 1));
const passed = (!webcam || (results.webcamStill && results.webcamLiveShown)) && results.localFrame && results.ptzHidden && results.newFrameArrives.after !== results.newFrameArrives.before && results.offline.cardStillThere && results.offline.keepsLastFrame && Object.values(results.noImage).every(Boolean) && results.recovers && results.system.length >= 3 && results.server.length >= 2 && results.docker.rows >= containers.length && results.docker.missing === 0 && results.docker.controls === 0 && results.pageErrors.length === 0;
if (!passed) process.exit(1);
