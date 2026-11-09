import { classify, type CardConfig, type Category, type Classified, type Override, type StrategyEntity } from './classify.ts';

export interface StrategyHass {
  language?: string;
  states: Record<string, StrategyEntity | undefined>;
  entities?: Record<string, { area_id?: string | null; device_id?: string | null; hidden?: boolean; entity_category?: string | null } | undefined>;
  devices?: Record<string, { area_id?: string | null } | undefined>;
  areas?: Record<string, { area_id: string; name: string; icon?: string | null } | undefined>;
}

export interface StrategyConfig {
  areas_order?: string[];
  hide_entities?: string[];
  overrides?: Record<string, Override>;
  title?: string;
}

const ORDER: Category[] = ['light', 'climate', 'cover', 'switch', 'scene', 'air', 'media', 'security', 'camera', 'sensor', 'energy', 'appliance', 'input', 'other'];

const HEADINGS: Record<Category, [string, string]> = {
  light: ['Licht', 'Lights'],
  climate: ['Klima', 'Climate'],
  cover: ['Beschattung', 'Covers'],
  switch: ['Schalter', 'Switches'],
  scene: ['Szenen', 'Scenes'],
  air: ['Lüfter und Ventile', 'Fans and valves'],
  media: ['Medien', 'Media'],
  security: ['Sicherheit', 'Security'],
  camera: ['Kameras', 'Cameras'],
  sensor: ['Sensoren', 'Sensors'],
  energy: ['Energie', 'Energy'],
  appliance: ['Haushalt', 'Appliances'],
  input: ['Eingaben', 'Inputs'],
  other: ['Weitere', 'Other'],
};

const TEXTS = {
  overview: ['Übersicht', 'Overview'],
  unassigned: ['Ohne Bereich', 'No area'],
  people: ['Personen', 'People'],
  open: ['Offen', 'Open'],
  energy: ['Energie', 'Energy'],
  weather: ['Wetter', 'Weather'],
} as const;

const MAX_SCENES = 6;
const MAX_BATTERIES = 8;
const MAX_OVERVIEW_POWER = 3;
const OPEN_CLASSES = ['door', 'window', 'opening', 'garage_door'];

const isGerman = (hass: StrategyHass): boolean => (hass.language ?? 'en').toLowerCase().startsWith('de');
const pick = (hass: StrategyHass, pair: readonly [string, string]): string => pair[isGerman(hass) ? 0 : 1];

interface Placed extends Classified {
  area: string | null;
}

function areaOf(hass: StrategyHass, id: string): string | null {
  const entry = hass.entities?.[id];
  if (entry?.area_id) return entry.area_id;
  return entry?.device_id ? (hass.devices?.[entry.device_id]?.area_id ?? null) : null;
}

/** Every entity that belongs on a dashboard, with its card and area. */
function collect(hass: StrategyHass, config: StrategyConfig): Placed[] {
  const hidden = new Set(config.hide_entities ?? []);
  return Object.values(hass.states).flatMap((entity) => {
    if (!entity || hidden.has(entity.entity_id)) return [];
    const entry = hass.entities?.[entity.entity_id];
    const override = config.overrides?.[entity.entity_id];
    if (!override && (entry?.hidden || entry?.entity_category)) return [];
    const classified = classify(entity, override);
    return classified ? [{ ...classified, area: areaOf(hass, entity.entity_id) }] : [];
  });
}

/** Scenes become one card with several buttons, batteries one list. */
function mergeGroup(cards: CardConfig[], roleName: string, limit: number): CardConfig[] {
  const groups: CardConfig[] = [];
  for (let start = 0; start < cards.length; start += limit) {
    const [first, ...rest] = cards.slice(start, start + limit) as [CardConfig, ...CardConfig[]];
    groups.push({ ...first, ...(rest.length > 0 ? { roles: Object.fromEntries(rest.map((card, index) => [`${roleName}_${index + 2}`, card.entity])) } : {}) });
  }
  return groups;
}

const isBatteryList = (card: CardConfig): boolean => card.type === 'custom:octa-energy-card' && card.variant === 'battery_list';

function mergeCards(category: Category, cards: CardConfig[]): CardConfig[] {
  if (category === 'scene') return mergeGroup(cards, 'scene', MAX_SCENES);
  if (category !== 'energy') return cards;
  const batteries = cards.filter(isBatteryList);
  return [...cards.filter((card) => !isBatteryList(card)), ...mergeGroup(batteries, 'battery', MAX_BATTERIES)];
}

const heading = (text: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ type: 'heading', heading: text, ...extra });

function sectionsFor(hass: StrategyHass, items: Placed[]): Record<string, unknown>[] {
  return ORDER.flatMap((category) => {
    const cards = items.filter((item) => item.category === category).map((item) => item.card);
    if (cards.length === 0) return [];
    return [{ type: 'grid', cards: [heading(pick(hass, HEADINGS[category])), ...mergeCards(category, cards)] }];
  });
}

function orderedAreas(hass: StrategyHass, config: StrategyConfig, used: Set<string>): { area_id: string; name: string; icon?: string | null }[] {
  const areas = Object.values(hass.areas ?? {}).filter((area): area is NonNullable<typeof area> => area !== undefined && used.has(area.area_id));
  const rank = (id: string): number => {
    const index = (config.areas_order ?? []).indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return areas.sort((a, b) => rank(a.area_id) - rank(b.area_id) || a.name.localeCompare(b.name));
}

function overview(hass: StrategyHass, config: StrategyConfig): Record<string, unknown> {
  const hidden = new Set(config.hide_entities ?? []);
  const states = Object.values(hass.states).filter((entity): entity is StrategyEntity => entity !== undefined && !hidden.has(entity.entity_id) && !hass.entities?.[entity.entity_id]?.hidden);
  const ofDomain = (domain: string): StrategyEntity[] => states.filter((entity) => entity.entity_id.startsWith(`${domain}.`));
  const sections: Record<string, unknown>[] = [];

  const weather = ofDomain('weather')[0];
  if (weather) sections.push({ type: 'grid', cards: [heading(pick(hass, TEXTS.weather)), { type: 'custom:octa-weather-card', entity: weather.entity_id }] });

  const people = ofDomain('person');
  if (people.length > 0) sections.push({ type: 'grid', cards: [heading(pick(hass, TEXTS.people)), ...people.map((person) => ({ type: 'custom:octa-security-card', entity: person.entity_id, variant: 'person' }))] });

  const openings = ofDomain('binary_sensor').filter((entity) => OPEN_CLASSES.includes(String(entity.attributes.device_class)) && !hass.entities?.[entity.entity_id]?.entity_category);
  if (openings.length > 0) {
    const isOpen = (entity: StrategyEntity): Record<string, unknown> => ({ condition: 'state', entity: entity.entity_id, state: 'on' });
    sections.push({
      type: 'grid',
      cards: [
        heading(pick(hass, TEXTS.open), { visibility: [{ condition: 'or', conditions: openings.map(isOpen) }] }),
        ...openings.map((entity) => ({ type: 'custom:octa-security-card', entity: entity.entity_id, visibility: [isOpen(entity)] })),
      ],
    });
  }

  const power = ofDomain('sensor').filter((entity) => entity.attributes.device_class === 'power' && !hass.entities?.[entity.entity_id]?.entity_category).slice(0, MAX_OVERVIEW_POWER);
  if (power.length > 0) sections.push({ type: 'grid', cards: [heading(pick(hass, TEXTS.energy)), ...power.map((entity) => ({ type: 'custom:octa-energy-card', entity: entity.entity_id }))] });

  return { title: pick(hass, TEXTS.overview), path: 'overview', icon: 'mdi:home', type: 'sections', max_columns: 4, sections };
}

export function generateDashboard(config: StrategyConfig, hass: StrategyHass): Record<string, unknown> {
  const items = collect(hass, config);
  const used = new Set(items.flatMap((item) => (item.area ? [item.area] : [])));
  const views = orderedAreas(hass, config, used).map((area) => ({
    title: area.name,
    path: area.area_id,
    icon: area.icon ?? 'mdi:texture-box',
    type: 'sections',
    max_columns: 4,
    sections: sectionsFor(hass, items.filter((item) => item.area === area.area_id)),
  }));
  const unassigned = items.filter((item) => item.area === null);
  return {
    ...(config.title ? { title: config.title } : {}),
    views: [
      overview(hass, config),
      ...views,
      ...(unassigned.length > 0 ? [{ title: pick(hass, TEXTS.unassigned), path: 'no-area', icon: 'mdi:help-box', type: 'sections', max_columns: 4, sections: sectionsFor(hass, unassigned) }] : []),
    ],
  };
}

/** One room as a single section, for manually built dashboards. */
export function generateSection(config: StrategyConfig & { area?: string }, hass: StrategyHass): Record<string, unknown> {
  const items = collect(hass, config).filter((item) => item.area === (config.area ?? null));
  const cards = ORDER.flatMap((category) => mergeCards(category, items.filter((item) => item.category === category).map((item) => item.card)));
  const area = config.area ? hass.areas?.[config.area] : undefined;
  return { type: 'grid', cards: [...(area ? [heading(area.name)] : []), ...cards] };
}
