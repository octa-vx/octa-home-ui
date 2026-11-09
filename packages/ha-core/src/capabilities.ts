import type { HassEntity } from './port.ts';

/** Feature flags as defined by Home Assistant 2026.9.4. */
export const FEATURES = {
  light: { EFFECT: 4, FLASH: 8, TRANSITION: 32 },
  climate: {
    TARGET_TEMPERATURE: 1,
    TARGET_TEMPERATURE_RANGE: 2,
    TARGET_HUMIDITY: 4,
    FAN_MODE: 8,
    PRESET_MODE: 16,
    SWING_MODE: 32,
    TURN_OFF: 128,
    TURN_ON: 256,
    SWING_HORIZONTAL_MODE: 512,
  },
  cover: {
    OPEN: 1,
    CLOSE: 2,
    SET_POSITION: 4,
    STOP: 8,
    OPEN_TILT: 16,
    CLOSE_TILT: 32,
    STOP_TILT: 64,
    SET_TILT_POSITION: 128,
    SPEED: 256,
  },
  fan: { SET_SPEED: 1, OSCILLATE: 2, DIRECTION: 4, PRESET_MODE: 8, TURN_OFF: 16, TURN_ON: 32 },
  valve: { OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8 },
  lock: { OPEN: 1 },
  alarm_control_panel: { ARM_HOME: 1, ARM_AWAY: 2, ARM_NIGHT: 4, TRIGGER: 8, ARM_CUSTOM_BYPASS: 16, ARM_VACATION: 32 },
  media_player: {
    PAUSE: 1,
    SEEK: 2,
    VOLUME_SET: 4,
    VOLUME_MUTE: 8,
    PREVIOUS_TRACK: 16,
    NEXT_TRACK: 32,
    TURN_ON: 128,
    TURN_OFF: 256,
    PLAY_MEDIA: 512,
    VOLUME_STEP: 1024,
    SELECT_SOURCE: 2048,
    STOP: 4096,
    CLEAR_PLAYLIST: 8192,
    PLAY: 16384,
    SHUFFLE_SET: 32768,
    SELECT_SOUND_MODE: 65536,
    BROWSE_MEDIA: 131072,
    REPEAT_SET: 262144,
    GROUPING: 524288,
    MEDIA_ANNOUNCE: 1048576,
    MEDIA_ENQUEUE: 2097152,
    SEARCH_MEDIA: 4194304,
  },
  vacuum: {
    TURN_ON: 1,
    TURN_OFF: 2,
    PAUSE: 4,
    STOP: 8,
    RETURN_HOME: 16,
    FAN_SPEED: 32,
    STATUS: 128,
    SEND_COMMAND: 256,
    LOCATE: 512,
    CLEAN_SPOT: 1024,
    MAP: 2048,
    STATE: 4096,
    START: 8192,
    CLEAN_AREA: 16384,
  },
  camera: { ON_OFF: 1, STREAM: 2 },
  weather: { FORECAST_DAILY: 1, FORECAST_HOURLY: 2, FORECAST_TWICE_DAILY: 4 },
} as const;

export type FeatureDomain = keyof typeof FEATURES;
export type FeatureOf<D extends FeatureDomain> = keyof (typeof FEATURES)[D] & string;

export function supports<D extends FeatureDomain>(entity: HassEntity, domain: D, feature: FeatureOf<D>): boolean {
  const flags = entity.attributes.supported_features;
  if (typeof flags !== 'number') return false;
  return (flags & (FEATURES[domain][feature] as number)) !== 0;
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const COLOR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
const BRIGHTNESS_MODES = [...COLOR_MODES, 'brightness', 'color_temp', 'white'];

export function lightCapabilities(entity: HassEntity) {
  const modes = stringList(entity.attributes.supported_color_modes);
  return {
    brightness: modes.some((mode) => BRIGHTNESS_MODES.includes(mode)),
    colorTemp: modes.includes('color_temp'),
    color: modes.some((mode) => COLOR_MODES.includes(mode)),
    effects: supports(entity, 'light', 'EFFECT') ? stringList(entity.attributes.effect_list) : [],
  };
}

export function climateCapabilities(entity: HassEntity) {
  return {
    hvacModes: stringList(entity.attributes.hvac_modes),
    targetTemperature: supports(entity, 'climate', 'TARGET_TEMPERATURE'),
    targetRange: supports(entity, 'climate', 'TARGET_TEMPERATURE_RANGE'),
    fanModes: supports(entity, 'climate', 'FAN_MODE') ? stringList(entity.attributes.fan_modes) : [],
    presets: supports(entity, 'climate', 'PRESET_MODE') ? stringList(entity.attributes.preset_modes) : [],
    swingModes: supports(entity, 'climate', 'SWING_MODE') ? stringList(entity.attributes.swing_modes) : [],
  };
}

export function fanCapabilities(entity: HassEntity) {
  return {
    percentage: supports(entity, 'fan', 'SET_SPEED'),
    presets: supports(entity, 'fan', 'PRESET_MODE') ? stringList(entity.attributes.preset_modes) : [],
    oscillate: supports(entity, 'fan', 'OSCILLATE'),
    direction: supports(entity, 'fan', 'DIRECTION'),
  };
}
