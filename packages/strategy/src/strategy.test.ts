import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { parseCardConfig } from '@octa/schema';
import { widgets } from '@octa/widgets';
import { classify, generateDashboard, generateSection, type StrategyEntity, type StrategyHass } from './index.ts';

const entity = (entity_id: string, attributes: Record<string, unknown> = {}, state = 'on'): StrategyEntity => ({ entity_id, state, attributes });

const base: StrategyHass = {
  language: 'de',
  areas: {
    kueche: { area_id: 'kueche', name: 'Küche' },
    wohnen: { area_id: 'wohnen', name: 'Wohnzimmer', icon: 'mdi:sofa' },
    leer: { area_id: 'leer', name: 'Leer' },
  },
  devices: { d1: { area_id: 'wohnen' } },
  entities: {
    'light.deckenlicht': { device_id: 'd1' },
    'light.herd': { area_id: 'kueche' },
    'sensor.versteckt': { hidden: true, area_id: 'wohnen' },
    'sensor.diagnose': { entity_category: 'diagnostic', area_id: 'wohnen' },
  },
  states: {
    'light.deckenlicht': entity('light.deckenlicht'),
    'light.herd': entity('light.herd'),
    'light.flur': entity('light.flur'),
    'sensor.versteckt': entity('sensor.versteckt', { device_class: 'temperature' }),
    'sensor.diagnose': entity('sensor.diagnose', { device_class: 'temperature' }),
    'weather.home': entity('weather.home', {}, 'sunny'),
    'person.a': entity('person.a', {}, 'home'),
    'automation.x': entity('automation.x'),
  },
};

const views = (hass: StrategyHass, config = {}): Record<string, unknown>[] => generateDashboard(config, hass).views as Record<string, unknown>[];
const cardsOf = (view: Record<string, unknown> | undefined): Record<string, unknown>[] => (view?.sections as { cards: Record<string, unknown>[] }[]).flatMap((section) => section.cards).filter((card) => card.type !== 'heading');

describe('classify', () => {
  const type = (id: string, attributes = {}): string | undefined => classify(entity(id, attributes))?.card.type;

  it('maps domains to the matching card', () => {
    expect(type('light.a')).toBe('custom:octa-light-card');
    expect(type('climate.a')).toBe('custom:octa-climate-card');
    expect(type('lock.a')).toBe('custom:octa-security-card');
    expect(type('media_player.a')).toBe('custom:octa-media-card');
  });

  it('maps sensors by device class', () => {
    expect(classify(entity('sensor.a', { device_class: 'carbon_dioxide' }))?.card.variant).toBe('co2');
    expect(type('sensor.a', { device_class: 'power' })).toBe('custom:octa-energy-card');
    expect(classify(entity('binary_sensor.a', { device_class: 'motion' }))?.card.variant).toBe('motion');
    expect(classify(entity('binary_sensor.a', { device_class: 'window' }))?.card.variant).toBe('contact');
  });

  it('leaves out what is not a device to show', () => {
    expect(classify(entity('sensor.a'))).toBeNull();
    expect(classify(entity('binary_sensor.a'))).toBeNull();
    expect(classify(entity('automation.a'))).toBeNull();
    expect(classify(entity('update.a'))).toBeNull();
  });

  it('never offers buttons on its own, they can restart devices', () => {
    expect(classify(entity('button.restart'))).toBeNull();
  });

  it('leaves device settings out but keeps helpers', () => {
    for (const id of ['select.mode', 'number.limit', 'text.name']) expect(classify(entity(id))).toBeNull();
    expect(type('input_select.a')).toBe('custom:octa-input-card');
    expect(classify(entity('number.limit'), { card: 'octa-input-card', variant: 'input_number' })?.category).toBe('input');
  });

  it('falls back to the HA tile for unknown domains', () => {
    expect(classify(entity('humidifier.a'))?.card).toEqual({ type: 'tile', entity: 'humidifier.a' });
  });

  it('applies overrides', () => {
    expect(classify(entity('sensor.w'), { card: 'octa-appliance-card', variant: 'washer' })).toEqual({ category: 'appliance', card: { type: 'custom:octa-appliance-card', entity: 'sensor.w', variant: 'washer' } });
  });
});

describe('dashboard', () => {
  it('builds overview, areas with devices and a view for the rest', () => {
    expect(views(base).map((view) => view.title)).toEqual(['Übersicht', 'Küche', 'Wohnzimmer', 'Ohne Bereich']);
  });

  it('finds the area through the device', () => {
    expect(cardsOf(views(base)[2]).map((card) => card.entity)).toEqual(['light.deckenlicht']);
  });

  it('keeps entities without an area', () => {
    expect(cardsOf(views(base)[3]).map((card) => card.entity)).toEqual(['light.flur']);
  });

  it('skips hidden and diagnostic entities', () => {
    const all = views(base).flatMap(cardsOf).map((card) => card.entity);
    expect(all).not.toContain('sensor.versteckt');
    expect(all).not.toContain('sensor.diagnose');
  });

  it('respects the area order and hidden entities', () => {
    expect(views(base, { areas_order: ['wohnen'] }).map((view) => view.title)).toEqual(['Übersicht', 'Wohnzimmer', 'Küche', 'Ohne Bereich']);
    expect(views(base, { hide_entities: ['light.flur'] }).map((view) => view.title)).not.toContain('Ohne Bereich');
  });

  it('shows weather and people in the overview', () => {
    expect(cardsOf(views(base)[0]).map((card) => card.entity)).toEqual(['weather.home', 'person.a']);
  });

  it('shows openings in the overview only while open', () => {
    const hass = { ...base, states: { ...base.states, 'binary_sensor.tuer': entity('binary_sensor.tuer', { device_class: 'door' }, 'off') } };
    const card = cardsOf(views(hass)[0]).find((item) => item.entity === 'binary_sensor.tuer');
    expect(card?.visibility).toEqual([{ condition: 'state', entity: 'binary_sensor.tuer', state: 'on' }]);
  });

  it('merges scenes into one card', () => {
    const hass = { ...base, states: { 'scene.a': entity('scene.a'), 'scene.b': entity('scene.b') } };
    expect(cardsOf(views(hass).at(-1))).toEqual([{ type: 'custom:octa-scene-card', entity: 'scene.a', roles: { scene_2: 'scene.b' } }]);
  });

  it('merges batteries and splits at the limit', () => {
    const states = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`sensor.b${index}`, entity(`sensor.b${index}`, { device_class: 'battery' })]));
    const cards = cardsOf(views({ ...base, states }).at(-1));
    expect(cards).toHaveLength(2);
    expect(Object.keys(cards[0]?.roles as object)).toHaveLength(7);
  });

  it('survives a hass without registries', () => {
    expect(views({ states: { 'light.a': entity('light.a') } }).map((view) => view.title)).toEqual(['Overview', 'No area']);
  });

  it('produces only configurations the cards accept', () => {
    const hass = { ...base, states: { ...base.states, 'scene.a': entity('scene.a'), 'scene.b': entity('scene.b'), 'lock.a': entity('lock.a'), 'sensor.p': entity('sensor.p', { device_class: 'power' }), 'sensor.bat': entity('sensor.bat', { device_class: 'battery' }), 'sensor.bat2': entity('sensor.bat2', { device_class: 'battery' }) } };
    for (const card of views(hass).flatMap(cardsOf)) {
      const widget = widgets.find((item) => `custom:${item.element}` === card.type);
      if (widget) expect(parseCardConfig(card, widget.spec)).toMatchObject({ ok: true });
    }
  });
});

describe('section', () => {
  it('collects one room', () => {
    const section = generateSection({ area: 'kueche' }, base);
    expect(section.cards).toEqual([{ type: 'heading', heading: 'Küche' }, { type: 'custom:octa-light-card', entity: 'light.herd' }]);
  });
});

describe('examples', () => {
  const directory = new URL('../../../examples/', import.meta.url);
  const files = readdirSync(directory).filter((name) => name.endsWith('.yaml'));

  const collectCards = (node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] => {
    if (Array.isArray(node)) node.forEach((item) => collectCards(item, found));
    else if (typeof node === 'object' && node !== null) {
      const record = node as Record<string, unknown>;
      if (typeof record.type === 'string' && record.type.match(/^custom:octa-.*-card$/)) found.push(record);
      Object.values(record).forEach((value) => collectCards(value, found));
    }
    return found;
  };

  it('exist', () => {
    expect(files.length).toBeGreaterThan(1);
  });

  it.each(files)('%s is valid YAML with valid cards', (name) => {
    const document: unknown = parse(readFileSync(new URL(name, directory), 'utf8'));
    for (const card of collectCards(document)) {
      const widget = widgets.find((item) => `custom:${item.element}` === card.type);
      expect(widget, String(card.type)).toBeDefined();
      expect(parseCardConfig(card, widget!.spec), JSON.stringify(card)).toMatchObject({ ok: true });
    }
  });
});
