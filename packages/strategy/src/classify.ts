export interface StrategyEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export type Category =
  | 'light'
  | 'climate'
  | 'cover'
  | 'switch'
  | 'scene'
  | 'air'
  | 'media'
  | 'security'
  | 'camera'
  | 'sensor'
  | 'energy'
  | 'appliance'
  | 'input'
  | 'other';

export type CardConfig = { type: string; entity: string } & Record<string, unknown>;

export interface Classified {
  category: Category;
  card: CardConfig;
}

export interface Override {
  card: string;
  variant?: string;
}

const CONTACT_CLASSES = ['door', 'window', 'opening', 'garage_door', 'moisture', 'smoke', 'gas', 'safety', 'tamper', 'carbon_monoxide', 'lock'];
const MOTION_CLASSES = ['motion', 'occupancy', 'presence'];
const SENSOR_CLASSES = ['temperature', 'humidity', 'illuminance', 'pressure', 'pm25', 'pm10', 'volatile_organic_compounds', 'atmospheric_pressure', 'moisture'];

/** Domains that are not devices someone operates on a dashboard. */
const IGNORED_DOMAINS = [
  'automation', 'conversation', 'device_tracker', 'event', 'image', 'notify', 'persistent_notification',
  'remote', 'stt', 'sun', 'tag', 'todo', 'tts', 'update', 'wake_word', 'zone', 'calendar', 'assist_satellite', 'counter',
];

const CATEGORY_OF_CARD: Record<string, Category> = {
  'octa-light-card': 'light',
  'octa-switch-card': 'switch',
  'octa-scene-card': 'scene',
  'octa-climate-card': 'climate',
  'octa-air-card': 'air',
  'octa-sensor-card': 'sensor',
  'octa-energy-card': 'energy',
  'octa-cover-card': 'cover',
  'octa-security-card': 'security',
  'octa-media-card': 'media',
  'octa-camera-card': 'camera',
  'octa-appliance-card': 'appliance',
  'octa-input-card': 'input',
  'octa-weather-card': 'other',
  'octa-system-card': 'other',
};

const custom = (name: string, entity: string, variant?: string): CardConfig => ({
  type: `custom:${name}`,
  entity,
  ...(variant ? { variant } : {}),
});

function classifySensor(id: string, deviceClass: unknown): Classified | null {
  if (deviceClass === 'power') return { category: 'energy', card: custom('octa-energy-card', id) };
  if (deviceClass === 'battery') return { category: 'energy', card: custom('octa-energy-card', id, 'battery_list') };
  if (deviceClass === 'carbon_dioxide') return { category: 'sensor', card: custom('octa-sensor-card', id, 'co2') };
  if (typeof deviceClass === 'string' && SENSOR_CLASSES.includes(deviceClass)) return { category: 'sensor', card: custom('octa-sensor-card', id) };
  return null;
}

function classifyBinary(id: string, deviceClass: unknown): Classified | null {
  if (typeof deviceClass !== 'string') return null;
  if (MOTION_CLASSES.includes(deviceClass)) return { category: 'security', card: custom('octa-security-card', id, 'motion') };
  if (CONTACT_CLASSES.includes(deviceClass)) return { category: 'security', card: custom('octa-security-card', id, 'contact') };
  return null;
}

/** Finds the card for one entity. `null` means the entity does not belong on the dashboard. */
export function classify(entity: StrategyEntity, override?: Override): Classified | null {
  const id = entity.entity_id;
  if (override) {
    const category = CATEGORY_OF_CARD[override.card] ?? 'other';
    return { category, card: custom(override.card, id, override.variant) };
  }

  const domain = id.split('.', 1)[0] as string;
  const deviceClass = entity.attributes.device_class;
  switch (domain) {
    case 'light':
      return { category: 'light', card: custom('octa-light-card', id) };
    case 'switch':
      return { category: 'switch', card: custom('octa-switch-card', id) };
    case 'input_boolean':
      return { category: 'switch', card: custom('octa-switch-card', id, 'input_boolean') };
    case 'scene':
      return { category: 'scene', card: custom('octa-scene-card', id) };
    case 'climate':
      return { category: 'climate', card: custom('octa-climate-card', id) };
    case 'cover':
      return { category: 'cover', card: custom('octa-cover-card', id) };
    case 'fan':
      return { category: 'air', card: custom('octa-air-card', id) };
    case 'valve':
      return { category: 'air', card: custom('octa-air-card', id, 'valve') };
    case 'media_player':
      return { category: 'media', card: custom('octa-media-card', id) };
    case 'camera':
      return { category: 'camera', card: custom('octa-camera-card', id) };
    case 'lock':
      return { category: 'security', card: custom('octa-security-card', id, 'lock') };
    case 'alarm_control_panel':
      return { category: 'security', card: custom('octa-security-card', id, 'alarm') };
    case 'vacuum':
      return { category: 'appliance', card: custom('octa-appliance-card', id) };
    case 'input_select':
      return { category: 'input', card: custom('octa-input-card', id) };
    case 'input_number':
      return { category: 'input', card: custom('octa-input-card', id, 'input_number') };
    case 'input_text':
      return { category: 'input', card: custom('octa-input-card', id, 'input_text') };
    case 'input_datetime':
      return { category: 'input', card: custom('octa-input-card', id, 'input_datetime') };
    case 'timer':
      return { category: 'input', card: custom('octa-input-card', id, 'timer') };
    case 'input_button':
      return { category: 'input', card: custom('octa-input-card', id, 'button') };
    case 'sensor':
      return classifySensor(id, deviceClass);
    case 'binary_sensor':
      return classifyBinary(id, deviceClass);
    // Devices expose their settings through these domains. They stay reachable through `overrides`.
    case 'select':
    case 'number':
    case 'text':
    case 'person':
    case 'weather':
    case 'button':
      return null;
    default:
      return IGNORED_DOMAINS.includes(domain) ? null : { category: 'other', card: { type: 'tile', entity: id } };
  }
}
