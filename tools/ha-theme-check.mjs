// Measures the readability of Home Assistant's own cards under the theme, against HA's default theme.
// Fails if the theme adds a contrast violation that HA's default theme does not have.
// Environment: see ha-session.mjs. OCTA_SHOT_DIR overrides the screenshot directory.
/* global getComputedStyle, Node, Element, SVGElement, CustomEvent */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { BASE, api, installZip, signedInContext, wsCall } from './ha-session.mjs';

const THEME = 'Octa Home UI';
const SLUG = 'octa-theme';
const shots = process.env.OCTA_SHOT_DIR ?? 'test-results/ha-theme';
mkdirSync(shots, { recursive: true });

await installZip();

const states = await (await api('states')).json();
const pick = (domain) => states.find((state) => state.entity_id.startsWith(`${domain}.`))?.entity_id;
const numeric = states.find((state) => state.entity_id.startsWith('sensor.') && Number.isFinite(Number(state.state)))?.entity_id;

const light = pick('light');
const candidates = [
  { type: 'heading', heading: 'Standardkarten' },
  { type: 'tile', entity: light },
  { type: 'tile', entity: pick('climate') },
  { type: 'entities', entities: [light, pick('switch'), pick('cover'), numeric, pick('lock')].filter(Boolean) },
  { type: 'button', entity: pick('switch'), show_state: true },
  { type: 'gauge', entity: numeric },
  { type: 'glance', entities: [light, numeric, pick('binary_sensor')].filter(Boolean) },
  { type: 'markdown', content: '## Titel\nFließtext mit [Link](https://example.invalid) und `code`.' },
  { type: 'thermostat', entity: pick('climate') },
  { type: 'weather-forecast', entity: pick('weather') },
  { type: 'media-control', entity: pick('media_player') },
  { type: 'alarm-panel', entity: pick('alarm_control_panel') },
  { type: 'history-graph', entities: [numeric].filter(Boolean) },
];
const cards = candidates.filter((card) => !('entity' in card) || card.entity);

const dashboards = (await wsCall({ type: 'lovelace/dashboards/list' })).result;
if (!dashboards.some((dashboard) => dashboard.url_path === SLUG)) {
  await wsCall({
    type: 'lovelace/dashboards/create',
    url_path: SLUG,
    title: 'Theme',
    icon: 'mdi:palette',
    show_in_sidebar: true,
    require_admin: false,
    mode: 'storage',
  });
}
await wsCall({ type: 'lovelace/config/save', url_path: SLUG, config: { views: [{ title: 'Theme', cards }] } });

// axe leaves most of HA's text undecided ("incomplete"), so the contrast is measured here.
// Text over images or gradients cannot be decided and is counted as `unknown`, never as passed.
function auditContrast(rootTag) {
  const parse = (value) => {
    let match = /^rgba?\(([^)]+)\)$/.exec(value);
    if (match) {
      const [r, g, b, a = 1] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [r, g, b, a];
    }
    match = /^color\(srgb ([^)]+)\)$/.exec(value);
    if (match) {
      const [r, g, b, a = 1] = match[1].split(/[\s/]+/).filter(Boolean).map(Number);
      return [r * 255, g * 255, b * 255, a];
    }
    return null;
  };
  const over = (top, bottom) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const luminance = (color) => {
    const [r, g, b] = color.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const parent = (element) => element.assignedSlot ?? element.parentElement ?? element.getRootNode().host ?? null;

  const elements = [];
  const walk = (root) => {
    for (const element of root.querySelectorAll('*')) {
      elements.push(element);
      if (element.shadowRoot) walk(element.shadowRoot);
    }
  };
  walk(document);
  const root = rootTag ? elements.find((element) => element.localName === rootTag) : null;
  if (rootTag && !root) return { error: `${rootTag} not found`, failing: [], checked: 0, unknown: 0 };

  const inside = (element) => {
    for (let node = element; node; node = parent(node)) if (node === root) return true;
    return false;
  };
  const skipped = new Set(['style', 'script', 'title', 'noscript', 'template']);
  // These paint their background outside the element tree: artwork, or an internal chip layer.
  const undecidable = new Set(['hui-media-control-card', 'hui-marquee', 'ha-assist-chip']);
  const failing = [];
  let checked = 0;
  let unknown = 0;

  for (const element of elements) {
    if (skipped.has(element.localName) || (root && !inside(element))) continue;
    if (element instanceof SVGElement) continue;
    const text = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim();
    if (!text) continue;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (style.visibility !== 'visible' || style.display === 'none' || box.width === 0 || box.height === 0) continue;

    if (undecidable.has(element.getRootNode().host?.localName)) {
      unknown += 1;
      continue;
    }

    let opacity = 1;
    let disabled = false;
    let image = false;
    const layers = [];
    let opaque = false;
    for (let node = element; node; node = parent(node)) {
      if (!(node instanceof Element)) continue;
      const current = getComputedStyle(node);
      if (current.display === 'none') opacity = 0;
      opacity *= Number(current.opacity);
      if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') disabled = true;
      if (opaque) continue;
      if (current.backgroundImage !== 'none') image = true;
      const background = parse(current.backgroundColor);
      if (!background) image = true;
      else if (background[3] > 0) {
        layers.push(background);
        if (background[3] === 1) opaque = true;
      }
    }
    if (opacity === 0 || disabled) continue;
    const foreground = parse(style.color);
    if (!foreground || image || !opaque) {
      unknown += 1;
      continue;
    }
    const background = layers.reduceRight((below, layer) => over(layer, below), [255, 255, 255, 1]);
    const painted = over([foreground[0], foreground[1], foreground[2], foreground[3] * opacity], background);
    const size = Number.parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const value = ratio(painted, background);
    checked += 1;
    if (value < (large ? 3 : 4.5)) {
      failing.push({
        target: `${element.localName}|${text.slice(0, 40)}`,
        host: element.getRootNode().host?.localName ?? 'document',
        foreground: style.color,
        background: `rgb(${background.slice(0, 3).map(Math.round).join(' ')})`,
        ratio: Math.round(value * 100) / 100,
      });
    }
  }
  return { failing, checked, unknown };
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
}

const viewports = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const browser = await chromium.launch();
const runs = [];

for (const theme of ['default', THEME]) {
  for (const dark of [false, true]) {
    for (const [viewportName, viewport] of Object.entries(viewports)) {
      const context = await signedInContext(browser, { viewport }, { theme, dark });
      const page = await context.newPage();
      await page.goto(`${BASE}/${SLUG}/0`);
      await settle(page);

      const applied = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim(),
      );
      const label = `${theme === THEME ? 'octa' : 'default'}-${dark ? 'dark' : 'light'}-${viewportName}`;
      await page.screenshot({ path: `${shots}/${label}-dashboard.png`, fullPage: true });
      const dashboard = await page.evaluate(auditContrast, null);

      await page.evaluate((entityId) => {
        document.querySelector('home-assistant').dispatchEvent(
          new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }),
        );
      }, light);
      await settle(page);
      await page.screenshot({ path: `${shots}/${label}-dialog.png` });
      const dialog = await page.evaluate(auditContrast, 'ha-more-info-dialog');

      runs.push({ label, theme, dark, viewportName, applied, dashboard, dialog });
      await context.close();
    }
  }
}
await browser.close();

const key = (node) => node.target;
const failures = [];
const remaining = [];
for (const run of runs.filter((candidate) => candidate.theme === THEME)) {
  const baseline = runs.find(
    (candidate) => candidate.theme === 'default' && candidate.dark === run.dark && candidate.viewportName === run.viewportName,
  );
  for (const area of ['dashboard', 'dialog']) {
    const known = new Set(baseline[area].failing.map(key));
    const added = run[area].failing.filter((node) => !known.has(key(node)));
    if (added.length > 0) failures.push({ run: run.label, area, added });
    if (run[area].failing.length > 0) remaining.push({ run: run.label, area, failing: run[area].failing });
    if (run[area].error) failures.push({ run: run.label, area, error: run[area].error });
  }
}

console.log(
  JSON.stringify(
    {
      cards: cards.map((card) => card.type),
      runs: runs.map((run) => ({
        label: run.label,
        applied: run.applied,
        dashboard: [run.dashboard.checked, run.dashboard.failing.length, run.dashboard.unknown],
        dialog: [run.dialog.checked, run.dialog.failing.length, run.dialog.unknown],
      })),
      legend: 'checked, below minimum, unknown',
      remaining,
      failures,
    },
    null,
    1,
  ),
);
if (failures.length > 0 || runs.some((run) => run.theme === THEME && !run.applied)) process.exit(1);
