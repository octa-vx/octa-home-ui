// Operates the cards against real entities of the isolated test instance on HA 2026.9.4.
// Environment: see ha-session.mjs. OCTA_SHOT_DIR overrides the screenshot directory.
/* global setTimeout, window, CustomEvent */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { BASE, api, installZip, signedInContext, wsCall } from './ha-session.mjs';

const THEME = 'Octa Home UI';
const SLUG = 'octa-cards';
const shots = process.env.OCTA_SHOT_DIR ?? 'test-results/ha-cards';
mkdirSync(shots, { recursive: true });

await installZip();

const read = async (id) => (await api(`states/${id}`)).json();
const service = (domain, name, data) => api(`services/${domain}/${name}`, { method: 'POST', body: JSON.stringify(data) });
async function until(id, test) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = await read(id);
    if (test(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}
const fetchFlow = (path, body) => api(`config/config_entries/flow${path}`, { method: 'POST', body: JSON.stringify(body) });

const states = await (await api('states')).json();
const find = (domain, test) => states.find((state) => state.entity_id.startsWith(`${domain}.`) && test(state.attributes))?.entity_id;
const light = find('light', (a) => (a.supported_color_modes ?? []).some((mode) => mode !== 'onoff'));
const climate = find('climate', (a) => (a.supported_features & 1) !== 0 && typeof a.temperature === 'number');
const cover = find('cover', (a) => (a.supported_features & 11) === 11 && typeof a.current_position === 'number');
if (!light || !climate || !cover) throw new Error(`Missing demo entities: ${JSON.stringify({ light, climate, cover })}`);

const colorLight = find('light', (a) => (a.supported_color_modes ?? []).some((mode) => ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(mode)));
const whiteLight = find('light', (a) => (a.supported_color_modes ?? []).includes('color_temp'));
if (!colorLight || !whiteLight) throw new Error(`Missing demo lights: ${JSON.stringify({ colorLight, whiteLight })}`);

const modeClimate = find('climate', (a) => (a.hvac_modes ?? []).length >= 2);
const slatCover = find('cover', (a) => (a.supported_features & 128) !== 0 && (a.supported_features & 4) !== 0 && typeof a.current_position === 'number');
if (!modeClimate || !slatCover) throw new Error(`Missing demo devices: ${JSON.stringify({ modeClimate, slatCover })}`);

const sw = find('switch', () => true);
const fan = find('fan', (a) => (a.supported_features & 1) !== 0);
const valve = find('valve', (a) => (a.supported_features & 3) === 3);
const garage = find('cover', (a) => a.device_class === 'garage');
if (!sw || !fan || !valve || !garage) throw new Error(`Missing devices: ${JSON.stringify({ sw, fan, valve, garage })}`);

await service('scene', 'create', { scene_id: 'octa_one', snapshot_entities: [sw] });
await service('scene', 'create', { scene_id: 'octa_two', snapshot_entities: [sw] });
await until('scene.octa_two', (state) => state.state !== undefined && state.entity_id === 'scene.octa_two');

async function lightGroup() {
  const known = states.find((state) => state.entity_id.startsWith('light.') && state.attributes.friendly_name === 'Octa Gruppe');
  if (known) return known.entity_id;
  const flow = await (await fetchFlow('', { handler: 'group' })).json();
  await fetchFlow(`/${flow.flow_id}`, { next_step_id: 'light' });
  await fetchFlow(`/${flow.flow_id}`, { name: 'Octa Gruppe', entities: [light, colorLight], hide_members: false, all: false });
  await until('light.octa_gruppe', (state) => Array.isArray(state.attributes?.entity_id));
  return 'light.octa_gruppe';
}
const group = await lightGroup();

const temperature = find('sensor', (a) => a.device_class === 'temperature');
const humidity = find('sensor', (a) => a.device_class === 'humidity');
const co2 = find('sensor', (a) => a.device_class === 'carbon_dioxide');
if (!temperature || !humidity || !co2) throw new Error(`Missing sensors: ${JSON.stringify({ temperature, humidity, co2 })}`);

const power = find('sensor', (a) => a.device_class === 'power');
const energyToday = find('sensor', (a) => a.device_class === 'energy');
const batteryA = find('sensor', (a) => a.device_class === 'battery');
const batteryB = states.filter((state) => state.entity_id.startsWith('sensor.') && state.attributes.device_class === 'battery')[1]?.entity_id;
const wet = find('binary_sensor', (a) => a.device_class === 'moisture');
const motion = find('binary_sensor', (a) => a.device_class === 'motion');
const alarm = find('alarm_control_panel', () => true);
if (!power || !energyToday || !batteryA || !batteryB || !wet || !motion || !alarm) throw new Error('Missing energy or security devices');
const LOCK = 'lock.front_door';
const JAM = 'lock.poorly_installed_door';
const DEMO_ALARM_CODE = '1234'; // Fixed code of HA's demo alarm, not a real secret.

const CAMERA = 'camera.demo_camera';

async function ensureHelper(kind, name, data) {
  const id = `${kind}.${name}`;
  if (!states.some((state) => state.entity_id === id)) {
    await wsCall({ type: `${kind}/create`, name, ...data });
    await until(id, (state) => state.entity_id === id);
  }
  return id;
}
const inSelect = await ensureHelper('input_select', 'octa_auswahl', { options: ['Eins', 'Zwei'] });
const inNumber = await ensureHelper('input_number', 'octa_zahl', { min: 0, max: 100, step: 1, mode: 'slider' });
const inText = await ensureHelper('input_text', 'octa_text', {});
const inDate = await ensureHelper('input_datetime', 'octa_zeit', { has_date: false, has_time: true });
const inTimer = await ensureHelper('timer', 'octa_timer', { duration: '00:05:00' });
const inButton = await ensureHelper('input_button', 'octa_taste', {});
const inBoolean = await ensureHelper('input_boolean', 'octa_schalter', {});
const weather = find('weather', (a) => (a.supported_features & 3) !== 0);
const vacuum = find('vacuum', (a) => (a.supported_features & 8192) !== 0 && (a.supported_features & 16) !== 0);
if (!weather || !vacuum) throw new Error(`Missing devices: ${JSON.stringify({ weather, vacuum })}`);
const FEATURE = { PAUSE: 1, VOLUME_SET: 4, VOLUME_MUTE: 8, PLAY_MEDIA: 512, SELECT_SOURCE: 2048 };
const ttsEntity = states.find((state) => state.entity_id.startsWith('tts.'))?.entity_id;
const players = states.filter((state) => state.entity_id.startsWith('media_player.'));
const withFeatures = (flags) => players.filter((state) => (state.attributes.supported_features & flags) === flags).map((state) => state.entity_id);
const playable = withFeatures(FEATURE.PAUSE | FEATURE.VOLUME_SET | FEATURE.VOLUME_MUTE)[0];
const sourced = players.find((state) => (state.attributes.supported_features & FEATURE.SELECT_SOURCE) !== 0 && (state.attributes.source_list ?? []).length > 1)?.entity_id;
const playTargets = players.filter((state) => state.entity_id.includes('youtube') || state.attributes.app_name === 'YouTube' || state.entity_id === 'media_player.living_room').map((state) => state.entity_id);
const mediaTarget = playTargets[0] ?? withFeatures(FEATURE.PLAY_MEDIA)[0];
const secondTarget = withFeatures(FEATURE.PLAY_MEDIA).find((id) => id !== mediaTarget);
const tvRemote = find('remote', () => true);
if (!playable || !sourced || !mediaTarget || !secondTarget || !tvRemote) throw new Error(`Missing media devices: ${JSON.stringify({ playable, sourced, mediaTarget, secondTarget, tvRemote })}`);
const TEST_MEDIA_ID = 'bM7SZ5SBzyY';

const cards = [
  { type: 'custom:octa-weather-card', entity: weather },
  { type: 'custom:octa-system-card', entity: motion, roles: { cpu: power, memory: humidity } },
  { type: 'custom:octa-system-card', entity: motion, variant: 'docker_status', containers: [{ name: 'Test', status: wet, cpu: power, memory: humidity }] },
  { type: 'custom:octa-appliance-card', entity: vacuum },
  { type: 'custom:octa-appliance-card', entity: humidity, variant: 'filter' },
  { type: 'custom:octa-appliance-card', entity: humidity, variant: 'washer' },
  { type: 'custom:octa-input-card', entity: inSelect },
  { type: 'custom:octa-input-card', entity: inNumber, variant: 'input_number' },
  { type: 'custom:octa-input-card', entity: inText, variant: 'input_text' },
  { type: 'custom:octa-input-card', entity: inDate, variant: 'input_datetime' },
  { type: 'custom:octa-input-card', entity: inTimer, variant: 'timer' },
  { type: 'custom:octa-input-card', entity: inButton, variant: 'button' },
  { type: 'custom:octa-switch-card', entity: inBoolean, variant: 'input_boolean' },
  { type: 'custom:octa-media-card', entity: playable },
  { type: 'custom:octa-media-card', entity: playable, variant: 'volume' },
  { type: 'custom:octa-media-card', entity: sourced, variant: 'source' },
  { type: 'custom:octa-media-card', entity: secondTarget, variant: 'stations', roles: { target_2: mediaTarget }, stations: [{ name: 'Test', media_id: TEST_MEDIA_ID, media_type: 'tvshow' }] },
  { type: 'custom:octa-media-card', entity: playable, variant: 'tv_remote', roles: { remote: tvRemote } },
  { type: 'custom:octa-media-card', entity: playable, variant: 'player', ...(ttsEntity ? { roles: { tts: ttsEntity } } : {}) },
  { type: 'custom:octa-room-card', name: 'Raum', entity: climate, lights: [light, sw], windows: [wet], roles: { media: playable } },
  { type: 'custom:octa-contacts-card', sensors: [{ entity: wet, name: 'A' }, motion, 'binary_sensor.gibt_es_nicht'] },
  { type: 'custom:octa-camera-card', entity: CAMERA },
  { type: 'custom:octa-camera-card', entity: CAMERA, variant: 'snapshot' },
  { type: 'custom:octa-camera-card', entity: CAMERA, variant: 'security_cam', roles: { motion } },
  { type: 'custom:octa-camera-card', entity: CAMERA, variant: 'ptz' },
  { type: 'custom:octa-energy-card', entity: power, roles: { energy: energyToday } },
  { type: 'custom:octa-energy-card', entity: power, variant: 'power_flow', roles: { solar: power, grid: power, battery: power } },
  { type: 'custom:octa-energy-card', entity: batteryA, variant: 'battery_list', roles: { battery_2: batteryB } },
  { type: 'custom:octa-security-card', entity: wet },
  { type: 'custom:octa-security-card', entity: motion, variant: 'motion' },
  { type: 'custom:octa-security-card', entity: LOCK, variant: 'lock' },
  { type: 'custom:octa-security-card', entity: JAM, variant: 'lock' },
  { type: 'custom:octa-security-card', entity: alarm, variant: 'alarm' },
  { type: 'custom:octa-security-card', entity: 'person.test', variant: 'person' },
  { type: 'custom:octa-sensor-card', entity: temperature },
  { type: 'custom:octa-sensor-card', entity: humidity, variant: 'gauge', warning: 40, danger: 80 },
  { type: 'custom:octa-sensor-card', entity: co2, variant: 'co2' },
  { type: 'custom:octa-sensor-card', entity: temperature, variant: 'statistic' },
  { type: 'custom:octa-sensor-card', entity: temperature, variant: 'history' },
  { type: 'custom:octa-sensor-card', entity: humidity, variant: 'badge' },
  { type: 'custom:octa-light-card', entity: group, variant: 'group' },
  { type: 'custom:octa-switch-card', entity: sw },
  { type: 'custom:octa-scene-card', entity: 'scene.octa_one', roles: { scene_2: 'scene.octa_two' } },
  { type: 'custom:octa-air-card', entity: fan },
  { type: 'custom:octa-air-card', entity: valve, variant: 'valve' },
  { type: 'custom:octa-cover-card', entity: garage },
  { type: 'custom:octa-light-card', entity: light },
  { type: 'custom:octa-light-card', entity: light, variant: 'slider' },
  { type: 'custom:octa-light-card', entity: colorLight, variant: 'color' },
  { type: 'custom:octa-light-card', entity: whiteLight, variant: 'temperature' },
  { type: 'custom:octa-climate-card', entity: climate },
  { type: 'custom:octa-climate-card', entity: climate, variant: 'buttons' },
  { type: 'custom:octa-climate-card', entity: modeClimate, variant: 'mode' },
  { type: 'custom:octa-cover-card', entity: cover },
  { type: 'custom:octa-cover-card', entity: slatCover, variant: 'position' },
  { type: 'custom:octa-cover-card', entity: slatCover, variant: 'tilt' },
];

const dashboards = (await wsCall({ type: 'lovelace/dashboards/list' })).result;
if (!dashboards.some((dashboard) => dashboard.url_path === SLUG)) {
  await wsCall({ type: 'lovelace/dashboards/create', url_path: SLUG, title: 'Karten', icon: 'mdi:cards', show_in_sidebar: true, require_admin: false, mode: 'storage' });
}
await wsCall({
  type: 'lovelace/config/save',
  url_path: SLUG,
  config: { views: [{ title: 'Karten', type: 'sections', sections: [{ type: 'grid', cards }] }] },
});


// Every run dims the light, so it starts from a fixed brightness.
await service('light', 'turn_on', { entity_id: light, brightness_pct: 60 });
await until(light, (state) => state.state === 'on');
await service('light', 'turn_off', { entity_id: light });
await until(light, (state) => state.state === 'off');
const heatBefore = (await read(climate)).attributes;
const coverBefore = await read(cover);

const browser = await chromium.launch();
const errors = [];
const results = {};

for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  for (const dark of [false, true]) {
    const context = await signedInContext(browser, { viewport }, { theme: THEME, dark });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${BASE}/${SLUG}/0`);
    await page.waitForSelector('octa-light-card octa-switch button', { timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${shots}/${dark ? 'dark' : 'light'}-${name}.png`, fullPage: true });
    await context.close();
  }
}

const context = await signedInContext(browser, { viewport: { width: 1280, height: 900 } }, { theme: THEME, dark: false });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(`${BASE}/${SLUG}/0`);
await page.waitForSelector('octa-light-card octa-switch button', { timeout: 45000 });
await page.waitForTimeout(1000);

const weatherCard = page.locator('octa-weather-card');
await weatherCard.locator('.forecast > div').first().waitFor({ timeout: 15000 });
const systemCard = (index) => page.locator('octa-system-card').nth(index);
const inputCard = (index) => page.locator('octa-input-card').nth(index);
results.weather = { temperature: await weatherCard.locator('.big').innerText(), rows: await weatherCard.locator('.row').count(), days: await weatherCard.locator('.forecast > div').count() };
results.system = { rows: await systemCard(0).locator('.row').count(), dockerRows: await systemCard(1).locator('.row').count(), controlsInDocker: await systemCard(1).locator('button, octa-button, octa-switch, octa-slider, input, select').count() };

await service('vacuum', 'return_to_base', { entity_id: vacuum });
await until(vacuum, (state) => ['docked', 'returning'].includes(state.state));
await page.waitForTimeout(500);
await page.locator('octa-appliance-card').first().locator('.controls octa-button').first().click();
results.vacuumStarted = (await until(vacuum, (state) => state.state === 'cleaning')) !== null;
await service('vacuum', 'return_to_base', { entity_id: vacuum });

await inputCard(0).locator('select').selectOption('Zwei');
results.inputSelect = (await until(inSelect, (state) => state.state === 'Zwei')) !== null;
await service('input_select', 'select_option', { entity_id: inSelect, option: 'Eins' });
await inputCard(1).locator('input[type=number]').fill('33');
await inputCard(1).locator('input[type=number]').press('Enter');
await inputCard(1).locator('input[type=number]').blur();
results.inputNumber = (await until(inNumber, (state) => Number(state.state) === 33)) !== null;
await inputCard(2).locator('input').fill('hallo');
await inputCard(2).locator('input').blur();
results.inputText = (await until(inText, (state) => state.state === 'hallo')) !== null;
await inputCard(3).locator('input').fill('08:15');
await inputCard(3).locator('input').blur();
results.inputTime = (await until(inDate, (state) => state.state.startsWith('08:15'))) !== null;
await service('timer', 'cancel', { entity_id: inTimer });
await page.waitForTimeout(500);
await inputCard(4).locator('octa-button').first().click();
results.timerStarted = (await until(inTimer, (state) => state.state === 'active')) !== null;
await page.waitForTimeout(2200);
results.timerCounts = (await inputCard(4).locator('octa-timer-display').innerText()) !== '05:00';
await inputCard(4).locator('octa-button').nth(1).click();
results.timerCancelled = (await until(inTimer, (state) => state.state === 'idle')) !== null;
const pressBefore = (await read(inButton)).state;
await inputCard(5).locator('button.press').click();
results.buttonPressed = (await until(inButton, (state) => state.state !== pressBefore)) !== null;
const boolBefore = (await read(inBoolean)).state;
await page.locator('octa-switch-card').nth(0).locator('octa-switch button').click();
results.inputBoolean = (await until(inBoolean, (state) => state.state !== boolBefore)) !== null;

const mediaCard = (index) => page.locator('octa-media-card').nth(index);
await service('media_player', 'turn_on', { entity_id: [playable, sourced, mediaTarget] });
await service('media_player', 'media_play', { entity_id: playable });
await until(playable, (state) => state.state === 'playing');
await page.waitForTimeout(600);
await mediaCard(0).locator('octa-button[active]').click();
const paused = await until(playable, (state) => state.state === 'paused');
await page.waitForTimeout(600);
const volumeBefore = (await read(playable)).attributes.volume_level;
await mediaCard(1).locator('[role=slider]').focus();
await page.keyboard.press(volumeBefore > 0.5 ? 'ArrowLeft' : 'ArrowRight');
const volumeMoved = await until(playable, (state) => state.attributes.volume_level !== volumeBefore);
await page.waitForTimeout(400);
await mediaCard(1).locator('octa-button').first().click();
const muted = await until(playable, (state) => state.attributes.is_volume_muted === true);
await service('media_player', 'volume_mute', { entity_id: playable, is_volume_muted: false });
const sourceBefore = await read(sourced);
const otherIndex = sourceBefore.attributes.source_list.findIndex((item) => item !== sourceBefore.attributes.source);
await mediaCard(2).locator('.pill').nth(otherIndex).click();
const sourceChanged = await until(sourced, (state) => state.attributes.source === sourceBefore.attributes.source_list[otherIndex]);
await mediaCard(3).locator('.pills').first().locator('.pill').nth(1).click();
await page.waitForTimeout(300);
await mediaCard(3).locator('.pills').nth(1).locator('.pill').first().click();
const stationPlayed = await until(mediaTarget, (state) => state.attributes.media_content_id === TEST_MEDIA_ID);
results.media = { paused: paused !== null, volumeMoved: volumeMoved !== null, muted: muted !== null, sourceChanged: sourceChanged !== null, stationOnChosenTarget: stationPlayed !== null, remotePad: await mediaCard(4).locator('.pad octa-button').count() };
const playerCard = page.locator('octa-media-card').nth(5);
await service('media_player', 'media_play', { entity_id: playable });
await until(playable, (state) => state.state === 'playing');
await page.waitForTimeout(500);
await playerCard.locator('.player-controls octa-button').nth(1).click();
const playerPaused = await until(playable, (state) => state.state === 'paused');
let speech = 'no tts entity in this instance';
if (ttsEntity) {
  await playerCard.locator('.sources octa-button', { hasText: 'Sprache' }).or(playerCard.locator('.sources octa-button', { hasText: 'Speech' })).first().click();
  await playerCard.locator('.speak input').fill('Test');
  await playerCard.locator('.speak octa-button').click();
  // The entity only records a time once a real device fetches the audio, a demo player never does.
  speech = (await until(playable, (state) => String(state.attributes.media_content_id).includes(`tts/${ttsEntity}`))) !== null;
}
results.player = { controls: await playerCard.locator('.player-controls octa-button').count(), sliders: await playerCard.locator('octa-slider').count(), paused: playerPaused !== null, speech };

const cameraCard = (index) => page.locator('octa-camera-card').nth(index);
const loadedImage = async (index) => {
  const image = cameraCard(index).locator('octa-camera-image img');
  await image.waitFor({ timeout: 15000 });
  await page.waitForFunction(
    (i) => {
      const walk = (root, out = []) => {
        for (const element of root.querySelectorAll('*')) {
          if (element.localName === 'octa-camera-card') out.push(element);
          if (element.shadowRoot) walk(element.shadowRoot, out);
        }
        return out;
      };
      const img = walk(document)[i]?.shadowRoot.querySelector('octa-camera-image')?.shadowRoot.querySelector('img');
      return img !== undefined && img !== null && img.complete && img.naturalWidth > 0;
    },
    index,
    { timeout: 20000 },
  );
  return image.getAttribute('src');
};
const liveSrc = await loadedImage(0);
const stillSrc = await loadedImage(1);
await page.locator('octa-camera-card').nth(1).evaluate((card) => {
  card.shadowRoot.querySelector('octa-camera-image').picture = '/api/camera_proxy/camera.demo_camera?token=invalid';
});
await page.waitForTimeout(11500);
const keptSrc = await loadedImage(1);
const detectionBefore = (await read(CAMERA)).attributes.motion_detection;
await cameraCard(2).locator('octa-switch button').click();
results.camera = {
  stream: liveSrc.startsWith('/api/camera_proxy_stream/'),
  still: stillSrc.startsWith('/api/camera_proxy/'),
  keepsFrameOnBadToken: keptSrc === stillSrc,
  motionDetectionToggled: (await until(CAMERA, (state) => state.attributes.motion_detection !== detectionBefore)) !== null,
  ptzHidden: (await cameraCard(3).locator('.pad').count()) === 0,
  recordingBadge: await cameraCard(2).locator('.tag.rec').count(),
};
await service('camera', detectionBefore ? 'enable_motion_detection' : 'disable_motion_detection', { entity_id: CAMERA });

const energyCard = (index) => page.locator('octa-energy-card').nth(index);
const securityCard = (index) => page.locator('octa-security-card').nth(index);
results.energy = {
  power: await energyCard(0).locator('.big').innerText(),
  today: await energyCard(0).locator('.right').innerText(),
  flowNodes: await energyCard(1).locator('.node').count(),
  batteries: await energyCard(2).locator('.bar').count(),
};
results.contact = await securityCard(0).locator('.solid-pill').innerText();
const roomCard = page.locator('octa-room-card').first();
results.room = { lights: await roomCard.locator('.room-lights octa-button').count(), windows: await roomCard.locator('.contact-tile').count(), hasClimate: await roomCard.locator('.room-climate').count(), hasMedia: await roomCard.locator('.room-media').count() };
const contactsCard = page.locator('octa-contacts-card').first();
results.contacts = { tiles: await contactsCard.locator('.contact-tile').count(), unknown: await contactsCard.locator('.contact-tile.unknown').count(), named: await contactsCard.locator('.contact-tile', { hasText: 'A' }).count() };
results.motion = await securityCard(1).locator('.strong').innerText();

await service('lock', 'lock', { entity_id: LOCK });
await until(LOCK, (state) => state.state === 'locked');
await page.waitForTimeout(500);
const lockCard = securityCard(2);
await lockCard.locator('button.solid').click();
await lockCard.locator('.confirm').waitFor();
await page.waitForTimeout(800);
const stillLocked = (await read(LOCK)).state === 'locked';
await lockCard.locator('.confirm octa-button').nth(1).click();
await lockCard.locator('button.solid').click();
await lockCard.locator('.confirm octa-button').first().click();
const unlocked = await until(LOCK, (state) => state.state === 'unlocked');
await page.waitForTimeout(500);
await lockCard.locator('button.solid').click();
const relocked = await until(LOCK, (state) => state.state === 'locked');
results.lock = { stillLockedUntilConfirmed: stillLocked, unlockedAfterConfirm: unlocked !== null, lockedDirectly: relocked !== null };

await securityCard(3).locator('button.solid').click();
const jammed = await until(JAM, (state) => state.state === 'jammed');
await page.waitForTimeout(800);
results.jammed = { state: jammed !== null, alertShown: (await securityCard(3).locator('octa-status[kind=alert]').count()) === 1 };
await service('lock', 'unlock', { entity_id: JAM });

await service('alarm_control_panel', 'alarm_disarm', { entity_id: alarm, code: DEMO_ALARM_CODE });
await until(alarm, (state) => state.state === 'disarmed');
await page.waitForTimeout(500);
const panel = securityCard(4).locator('octa-alarm-panel');
for (const key of DEMO_ALARM_CODE) await panel.getByRole('button', { name: key, exact: true }).click();
await panel.locator('.actions button').nth(1).click();
const armed = await until(alarm, (state) => state.state !== 'disarmed');
await page.waitForTimeout(800);
for (const key of ['9', '9', '9', '9']) await panel.getByRole('button', { name: key, exact: true }).click();
await panel.getByRole('button', { name: 'Disarm' }).click();
await page.waitForTimeout(1000);
const wrongCodeKept = (await read(alarm)).state !== 'disarmed';
const dotsCleared = (await panel.locator('.dots').innerText()) === '';
for (const key of DEMO_ALARM_CODE) await panel.getByRole('button', { name: key, exact: true }).click();
await panel.getByRole('button', { name: 'Disarm' }).click();
const disarmed = await until(alarm, (state) => state.state === 'disarmed');
const storedConfig = JSON.stringify((await wsCall({ type: 'lovelace/config', url_path: SLUG })).result);
results.alarm = { armed: armed !== null, wrongCodeRejected: wrongCodeKept, dotsCleared, disarmedWithCode: disarmed !== null, codeNotInConfig: !storedConfig.includes(DEMO_ALARM_CODE) };
results.person = await securityCard(5).locator('.strong').innerText();

const sensorCard = (index) => page.locator('octa-sensor-card').nth(index);
await sensorCard(3).locator('.stats b').first().waitFor({ timeout: 15000 });
await sensorCard(4).locator('polyline').waitFor({ state: 'attached', timeout: 15000 });
const temperatureState = (await read(temperature)).state;
results.sensor = {
  value: (await sensorCard(0).locator('.big').innerText()).replace(',', '.').includes(temperatureState),
  gauge: await sensorCard(1).locator('octa-gauge [role=meter]').getAttribute('aria-valuenow'),
  co2: (await sensorCard(2).locator('.dot').getAttribute('class')).trim(),
  statistics: await sensorCard(3).locator('.stats b').allInnerTexts(),
  chart: ((await sensorCard(4).locator('polyline').getAttribute('points')) ?? '').length > 0,
  badge: await sensorCard(5).locator('.badge').innerText(),
};

const switchBefore = await read(sw);
await page.locator('octa-switch-card').nth(1).locator('octa-switch button').click();
results.switchToggled = (await until(sw, (state) => state.state !== switchBefore.state)) !== null;

const sceneBefore = await read('scene.octa_one');
await page.locator('octa-scene-card octa-button').first().click();
results.sceneActivated = (await until('scene.octa_one', (state) => state.state !== sceneBefore.state)) !== null;

const groupChips = await page.locator('octa-light-card').first().locator('.chip').count();
results.groupChips = groupChips;

const fanBefore = await read(fan);
const fanTarget = page.locator('octa-air-card').first();
if ((await fanTarget.locator('.pill').count()) > 1) await fanTarget.locator('.pill').nth(fanBefore.state === 'off' ? 1 : 0).click();
else {
  await fanTarget.locator('[role=slider]').focus();
  await page.keyboard.press('ArrowRight');
}
results.fanChanged = (await until(fan, (state) => state.state !== fanBefore.state || state.attributes.percentage !== fanBefore.attributes.percentage)) !== null;

const valveBefore = await read(valve);
await page.locator('octa-air-card').nth(1).locator('octa-switch button').click();
results.valveChanged = (await until(valve, (state) => state.state !== valveBefore.state)) !== null;

await service('cover', 'close_cover', { entity_id: garage });
const closedGarage = await until(garage, (state) => state.state === 'closed');
await page.waitForTimeout(800);
const garageCard = page.locator('octa-cover-card').first();
await garageCard.locator('.controls octa-button').first().click();
await garageCard.locator('.confirm').waitFor();
await page.waitForTimeout(800);
const untouched = (await read(garage)).state === 'closed';
await garageCard.locator('.confirm octa-button').nth(1).click();
const cancelled = (await garageCard.locator('.confirm').count()) === 0 && (await read(garage)).state === 'closed';
await garageCard.locator('.controls octa-button').first().click();
await garageCard.locator('.confirm octa-button').first().click();
const opened = await until(garage, (state) => ['opening', 'open'].includes(state.state));
results.garageConfirm = { closedFirst: closedGarage !== null, untouchedUntilConfirmed: untouched, cancelled, openedAfterConfirm: opened !== null };
await service('cover', 'close_cover', { entity_id: garage });


await page.locator('octa-light-card').nth(1).locator('octa-switch button').click();
results.lightOn = (await until(light, (state) => state.state === 'on')) !== null;

const slider = page.locator('octa-light-card').nth(1).locator('octa-slider [role=slider]');
await slider.waitFor();
for (let attempt = 0; attempt < 50 && Number(await slider.getAttribute('aria-valuenow')) === 0; attempt += 1) await page.waitForTimeout(100);
const percentBefore = Number(await slider.getAttribute('aria-valuenow'));
results.lightStartPercent = percentBefore;
await slider.focus();
for (let press = 0; press < 5; press += 1) await page.keyboard.press('ArrowLeft');
const dimmed = await until(light, (state) => state.state === 'on' && Math.round((state.attributes.brightness / 255) * 100) <= percentBefore - 3);
results.lightDimmed = dimmed !== null;

await service('light', 'turn_on', { entity_id: colorLight, rgb_color: [255, 0, 0] });
await until(colorLight, (state) => state.state === 'on');
await page.waitForTimeout(500);
await page.locator('octa-light-card').nth(3).locator('.swatches button').nth(3).click();
results.lightColored = (await until(colorLight, (state) => Array.isArray(state.attributes.rgb_color) && state.attributes.rgb_color[0] < 200)) !== null;

await service('light', 'turn_on', { entity_id: whiteLight, color_temp_kelvin: 3000 });
await until(whiteLight, (state) => state.attributes.color_temp_kelvin === 3000);
await page.waitForTimeout(500);
const white = page.locator('octa-light-card').nth(4).locator('[role=slider]');
await white.focus();
await page.keyboard.press('ArrowRight');
results.lightWhite = (await until(whiteLight, (state) => state.attributes.color_temp_kelvin > 3000)) !== null;

const dial = page.locator('octa-climate-card [role=slider]');
const targetBefore = Number(await dial.getAttribute('aria-valuenow'));
const step = heatBefore.target_temp_step ?? 0.5;
await dial.focus();
await page.keyboard.press('ArrowUp');
results.climateRaised = (await until(climate, (state) => state.attributes.temperature === targetBefore + step)) !== null;

await until(climate, (state) => state.attributes.temperature === targetBefore + step);
await page.waitForTimeout(500);
await page.locator('octa-climate-card').nth(1).locator('octa-button').nth(1).click();
results.climateButton = (await until(climate, (state) => state.attributes.temperature === targetBefore + 2 * step)) !== null;

const modeBefore = await read(modeClimate);
const nextMode = modeBefore.attributes.hvac_modes.find((mode) => mode !== modeBefore.state);
const modeIndex = modeBefore.attributes.hvac_modes.indexOf(nextMode);
await page.locator('octa-climate-card').nth(2).locator('octa-button').nth(modeIndex).click();
results.climateMode = (await until(modeClimate, (state) => state.state === nextMode)) !== null;

const slatBefore = await read(slatCover);
const positionSlider = page.locator('octa-cover-card').nth(2).locator('[role=slider]');
await positionSlider.focus();
await page.keyboard.press(slatBefore.attributes.current_position > 0 ? 'ArrowLeft' : 'ArrowRight');
results.coverPosition = (await until(slatCover, (state) => state.attributes.current_position !== slatBefore.attributes.current_position || ['opening', 'closing'].includes(state.state))) !== null;
const tiltSlider = page.locator('octa-cover-card').nth(3).locator('[role=slider]');
await tiltSlider.focus();
await page.keyboard.press(slatBefore.attributes.current_tilt_position > 0 ? 'ArrowLeft' : 'ArrowRight');
results.coverTilt = (await until(slatCover, (state) => state.attributes.current_tilt_position !== slatBefore.attributes.current_tilt_position)) !== null;

const closing = coverBefore.attributes.current_position > 0;
await page.locator('octa-cover-card').nth(1).locator('octa-button').nth(closing ? 2 : 0).click();
results.coverMoved = (await until(cover, (state) => state.state === (closing ? 'closing' : 'opening') || state.attributes.current_position !== coverBefore.attributes.current_position)) !== null;

results.editor = await page.evaluate(() => {
  const element = customElements.get('octa-light-card');
  const invalid = document.createElement('octa-light-card');
  let rejected = false;
  try {
    invalid.setConfig({ type: 'custom:octa-light-card', entity: 'switch.not_a_light' });
  } catch {
    rejected = true;
  }
  return { fields: element.getConfigForm().schema.map((field) => field.name), rejected, picker: window.customCards.map((card) => card.type) };
});
await page.goto(`${BASE}/${SLUG}/0?edit=1`);
await page.waitForSelector('hui-card-edit-mode', { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const walk = (root, found = []) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.localName === 'hui-card-edit-mode') found.push(element);
      if (element.shadowRoot) walk(element.shadowRoot, found);
    }
    return found;
  };
  const editor = walk(document).find((element) => element.querySelector('octa-light-card'));
  editor.dispatchEvent(new CustomEvent('ll-edit-card', { bubbles: true, composed: true, detail: { path: editor.path } }));
});
try {
  await page.waitForSelector('hui-dialog-edit-card ha-form', { timeout: 20000 });
  await page.waitForTimeout(1500);
  results.editorDialog = await page.evaluate(() => {
    const walk = (root, found = {}) => {
      for (const element of root.querySelectorAll('*')) {
        if (element.localName === 'hui-dialog-edit-card') found.dialog = element;
        if (element.shadowRoot) walk(element.shadowRoot, found);
      }
      return found;
    };
    const walkIn = (root, tag, out = []) => {
      for (const element of root.querySelectorAll('*')) {
        if (element.localName === tag) out.push(element);
        if (element.shadowRoot) walkIn(element.shadowRoot, tag, out);
      }
      return out;
    };
    const { dialog } = walk(document);
    const form = walkIn(dialog.shadowRoot, 'ha-form')[0];
    const preview = walkIn(dialog.shadowRoot, 'octa-light-card');
    return { fields: form.schema.map((field) => field.name), previewCards: preview.length, previewFlag: preview[0]?.preview ?? null };
  });
  await page.screenshot({ path: `${shots}/editor.png` });
} catch (error) {
  results.editorDialog = { error: error.message.slice(0, 160) };
}
// The lists must really open as fields in the real editor, not as YAML.
await page.goto(`${BASE}/${SLUG}/0?edit=1`);
await page.waitForSelector('hui-card-edit-mode', { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const walk = (root, found = []) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.localName === 'hui-card-edit-mode') found.push(element);
      if (element.shadowRoot) walk(element.shadowRoot, found);
    }
    return found;
  };
  const editor = walk(document).find((element) => element.querySelector('octa-room-card'));
  editor.dispatchEvent(new CustomEvent('ll-edit-card', { bubbles: true, composed: true, detail: { path: editor.path } }));
});
try {
  await page.waitForSelector('hui-dialog-edit-card ha-form', { timeout: 20000 });
  await page.waitForTimeout(1500);
  results.roomEditor = await page.evaluate(() => {
    const walkIn = (root, tag, out = []) => {
      for (const element of root.querySelectorAll('*')) {
        if (element.localName === tag) out.push(element);
        if (element.shadowRoot) walkIn(element.shadowRoot, tag, out);
      }
      return out;
    };
    return { objectLists: walkIn(document, 'ha-selector-object').length, entityLists: walkIn(document, 'ha-selector-entity').length, yamlEditors: walkIn(document, 'ha-yaml-editor').length };
  });
  await page.screenshot({ path: `${shots}/room-editor.png` });
} catch (error) {
  results.roomEditor = { error: error.message.slice(0, 160) };
}
await page.screenshot({ path: `${shots}/after.png`, fullPage: true });
await browser.close();

await service('light', 'turn_off', { entity_id: [light, colorLight, whiteLight] });
await service(sw.split('.')[0], switchBefore.state === 'on' ? 'turn_on' : 'turn_off', { entity_id: sw });
await service('fan', fanBefore.state === 'on' ? 'turn_on' : 'turn_off', { entity_id: fan });
await service('valve', valveBefore.state === 'open' ? 'open_valve' : 'close_valve', { entity_id: valve });
await service('climate', 'set_temperature', { entity_id: climate, temperature: heatBefore.temperature });
await service('climate', 'set_hvac_mode', { entity_id: modeClimate, hvac_mode: modeBefore.state });
await service('cover', 'stop_cover', { entity_id: [cover, slatCover] });
await service('cover', 'set_cover_position', { entity_id: slatCover, position: slatBefore.attributes.current_position });
await service('cover', 'set_cover_tilt_position', { entity_id: slatCover, tilt_position: slatBefore.attributes.current_tilt_position });
await service('cover', 'set_cover_position', { entity_id: cover, position: coverBefore.attributes.current_position });

console.log(JSON.stringify({ entities: { light, climate, cover }, results, pageErrors: errors }, null, 1));
const garageOk = Object.values(results.garageConfirm).every(Boolean);
const sensorOk = results.sensor.value && results.sensor.gauge === (await read(humidity)).state && results.sensor.statistics.length === 3 && results.sensor.chart;
const cameraOk = results.camera.stream && results.camera.still && results.camera.keepsFrameOnBadToken && results.camera.motionDetectionToggled && results.camera.ptzHidden;
const roomOk = results.room.lights === 2 && results.room.windows === 1 && results.room.hasClimate === 1 && results.room.hasMedia === 1 && results.roomEditor.objectLists >= 1 && results.roomEditor.entityLists >= 1;
const contactsOk = results.contacts.tiles === 3 && results.contacts.unknown === 1 && results.contacts.named >= 1;
const mediaOk = roomOk && contactsOk && results.player.speech !== false && results.player.paused && results.player.controls === 3 && results.player.sliders === 1 && results.media.paused && results.media.volumeMoved && results.media.muted && results.media.sourceChanged && results.media.stationOnChosenTarget && results.media.remotePad === 5;
const restOk = results.weather.days > 0 && results.system.controlsInDocker === 0 && results.vacuumStarted && results.inputSelect && results.inputNumber && results.inputText && results.inputTime && results.timerStarted && results.timerCounts && results.timerCancelled && results.buttonPressed && results.inputBoolean;
const safetyOk = restOk && mediaOk && cameraOk && [results.lock, results.jammed, results.alarm].every((group) => Object.values(group).every(Boolean));
const passed = safetyOk && results.energy.flowNodes === 4 && results.energy.batteries === 2 && garageOk && sensorOk && results.switchToggled && results.sceneActivated && results.groupChips === 2 && results.fanChanged && results.valveChanged && results.lightOn && results.lightDimmed && results.lightColored && results.lightWhite && results.climateRaised && results.climateButton && results.climateMode && results.coverPosition && results.coverTilt && results.coverMoved && results.editor.rejected;
if (!passed || errors.length > 0) process.exit(1);
