import { translate, type ForecastEntry, type HassEntity, type HassPort, type HistoryPoint } from '@octa/ha-core';

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
  entityId: string;
}

export class MockHass implements HassPort {
  readonly calls: ServiceCall[] = [];
  readonly notifications: string[] = [];
  failNextCall = false;
  history: HistoryPoint[] = [];
  readonly services = new Set<string>();
  forecast: ForecastEntry[] = [];
  private readonly entities = new Map<string, HassEntity>();

  constructor(
    entities: HassEntity[] = [],
    readonly language = 'de',
  ) {
    entities.forEach((entity) => this.entities.set(entity.entity_id, entity));
  }

  getEntity(entityId: string): HassEntity | undefined {
    return this.entities.get(entityId);
  }

  async callService(domain: string, service: string, data: Record<string, unknown>, entityId: string): Promise<void> {
    if (this.failNextCall) {
      this.failNextCall = false;
      throw new Error('Mock service failure');
    }
    this.calls.push({ domain, service, data, entityId });
  }

  formatName(entity: HassEntity): string {
    const friendly = entity.attributes.friendly_name;
    return typeof friendly === 'string' ? friendly : entity.entity_id;
  }

  formatState(entity: HassEntity): string {
    if (entity.state === 'unavailable' || entity.state === 'unknown') return translate(this.language, entity.state);
    return entity.state;
  }

  hasService(domain: string, service: string): boolean {
    return this.services.has(`${domain}.${service}`);
  }

  async fetchForecast(): Promise<ForecastEntry[]> {
    return this.forecast;
  }

  async fetchHistory(): Promise<HistoryPoint[]> {
    return this.history;
  }

  notify(message: string): void {
    this.notifications.push(message);
  }
}

const entity = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id,
  state,
  attributes: { friendly_name: entity_id.split('.')[1], ...attributes },
});

/** One representative entity per domain and capability set, including devices the home does not have. */
export const fixtures = {
  lightOnOff: entity('light.on_off', 'on', { supported_color_modes: ['onoff'], supported_features: 0 }),
  lightDimmable: entity('light.dimmable', 'on', { supported_color_modes: ['brightness'], brightness: 128, supported_features: 0 }),
  lightColor: entity('light.color', 'off', { supported_color_modes: ['color_temp', 'rgb'], supported_features: 4, effect_list: ['rainbow'] }),
  lightColorOn: entity('light.color_on', 'on', { supported_color_modes: ['color_temp', 'rgb'], brightness: 200, rgb_color: [255, 153, 51], color_temp_kelvin: 3000, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500, supported_features: 0 }),
  lightGroup: entity('light.group', 'on', { supported_color_modes: ['brightness'], brightness: 200, entity_id: ['light.dimmable', 'light.color'], supported_features: 0 }),
  switch: entity('switch.plug', 'on'),
  climate: entity('climate.heater', 'heat', { hvac_modes: ['off', 'heat'], supported_features: 1, temperature: 21, current_temperature: 19.5 }),
  climateModes: entity('climate.modes', 'cool', { hvac_modes: ['off', 'heat', 'cool', 'auto'], supported_features: 1, temperature: 21, target_temp_step: 1, min_temp: 21, current_temperature: 22 }),
  coverPosition: entity('cover.blind', 'open', { supported_features: 15, current_position: 40 }),
  coverTilt: entity('cover.slats', 'open', { supported_features: 255, current_position: 60, current_tilt_position: 50 }),
  coverGarage: entity('cover.garage', 'closed', { device_class: 'garage', supported_features: 3 }),
  fanPercent: entity('fan.percent', 'on', { supported_features: 1, percentage: 50 }),
  fanPreset: entity('fan.preset', 'on', { supported_features: 8, preset_modes: ['eco', 'boost'], preset_mode: 'eco' }),
  valve: entity('valve.water', 'closed', { supported_features: 3 }),
  valvePosition: entity('valve.heating', 'open', { supported_features: 7, current_position: 35 }),
  fanSteps: entity('fan.steps', 'on', { supported_features: 1, percentage: 67, percentage_step: 33.33 }),
  inputBoolean: entity('input_boolean.guest', 'off'),
  sceneEvening: entity('scene.evening', '2026-11-09T18:00:00+00:00', { friendly_name: 'Abend' }),
  sceneMovie: entity('scene.movie', '2026-11-09T20:00:00+00:00', { friendly_name: 'Film' }),
  lock: entity('lock.front_door', 'locked', { supported_features: 1 }),
  lockOpen: entity('lock.side_door', 'unlocked', { supported_features: 0 }),
  lockCode: entity('lock.safe', 'locked', { supported_features: 0, code_format: 'number' }),
  lockJammed: entity('lock.back_door', 'jammed', { supported_features: 0 }),
  alarm: entity('alarm_control_panel.home', 'armed_away', { supported_features: 3, code_format: 'number' }),
  alarmDisarmed: entity('alarm_control_panel.flat', 'disarmed', { supported_features: 3, code_format: 'number', code_arm_required: false }),
  alarmNoCode: entity('alarm_control_panel.simple', 'armed_home', { supported_features: 1 }),
  alarmText: entity('alarm_control_panel.text', 'armed_home', { supported_features: 1, code_format: 'text' }),
  alarmTriggered: entity('alarm_control_panel.garage', 'triggered', { supported_features: 3 }),
  camera: entity('camera.door', 'streaming', { entity_picture: '/api/camera_proxy/camera.door?token=mock', supported_features: 2 }),
  cameraSample: { ...entity('camera.yard', 'streaming', { entity_picture: '/api/sample-camera.svg?token=mock', supported_features: 2, motion_detection: true, friendly_name: 'Hof' }), last_changed: '2026-11-09T18:42:00+00:00' },
  cameraRecording: entity('camera.drive', 'recording', { entity_picture: '/api/sample-camera.svg?token=mock', supported_features: 2, friendly_name: 'Einfahrt' }),
  cameraNoPicture: entity('camera.off', 'idle', { supported_features: 0 }),
  mediaPlayer: entity('media_player.mini', 'playing', { supported_features: 21437, media_title: 'Titel', media_artist: 'Interpret', volume_level: 0.4 }),
  sensorTemperature: entity('sensor.temperature', '21.5', { device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement' }),
  mediaPlaying: entity('media_player.speaker', 'playing', { supported_features: 21437, media_title: 'Midnight City', media_artist: 'M83', volume_level: 0.4, friendly_name: 'Wohnzimmer' }),
  mediaSources: entity('media_player.spotify', 'playing', { supported_features: 23485, source: 'Küche', source_list: ['Wohnzimmer', 'Küche', 'Hobbyraum'], volume_level: 0.2, friendly_name: 'Spotify' }),
  mediaMuted: entity('media_player.muted', 'paused', { supported_features: 21437, volume_level: 0.4, is_volume_muted: true }),
  castSpotify: entity('media_player.cast_spotify', 'playing', { supported_features: 21437, app_name: 'Spotify', media_title: 'Midnight City', media_artist: 'M83', volume_level: 0.4, friendly_name: 'Küche' }),
  castTts: entity('media_player.cast_tts', 'playing', { supported_features: 21437, app_name: 'Default Media Receiver', media_content_id: 'http://ha.local/api/tts_proxy/abc.mp3', volume_level: 0.6, friendly_name: 'Küche' }),
  ttsGoogle: entity('tts.google_translate_en_com', '2026-11-09T18:00:00+00:00', { friendly_name: 'Google Translate' }),
  spotifyAccount: entity('media_player.spotify_konto', 'idle', { supported_features: 2560, source_list: ['Küche', 'Wohnen'], friendly_name: 'Spotify' }),
  castIdle: entity('media_player.cast_idle', 'off', { supported_features: 21437, volume_level: 0.3, friendly_name: 'Küche' }),
  mediaBare: entity('media_player.bare', 'idle', { supported_features: 0 }),
  mediaKitchen: entity('media_player.kitchen', 'idle', { supported_features: 512, friendly_name: 'Küche' }),
  windowOpen: entity('binary_sensor.fenster_kueche', 'on', { device_class: 'window', friendly_name: 'Küche' }),
  windowClosed: entity('binary_sensor.fenster_bad', 'off', { device_class: 'window', friendly_name: 'Bad' }),
  tvScript: entity('script.tv_source', 'off', { friendly_name: 'TV Quelle' }),
  tv: entity('media_player.tv', 'on', { supported_features: 22460, source: 'HDMI 1', source_list: ['HDMI 1', 'TV'], volume_level: 0.3, friendly_name: 'Fernseher' }),
  tvRemote: entity('remote.tv', 'on'),
  sensorPercent: entity('sensor.humidity', '54', { device_class: 'humidity', unit_of_measurement: '%', state_class: 'measurement' }),
  sensorCo2: entity('sensor.co2', '950', { device_class: 'carbon_dioxide', unit_of_measurement: 'ppm', state_class: 'measurement' }),
  sensorPower: entity('sensor.power', '850', { device_class: 'power', unit_of_measurement: 'W' }),
  sensorSolar: entity('sensor.solar', '2.4', { device_class: 'power', unit_of_measurement: 'kW' }),
  sensorGrid: entity('sensor.grid', '300', { device_class: 'power', unit_of_measurement: 'W' }),
  sensorBattery: entity('sensor.home_battery', '1.1', { device_class: 'power', unit_of_measurement: 'kW' }),
  sensorEnergy: entity('sensor.energy_today', '12.4 kWh'),
  batteryLow: entity('sensor.door_battery', '12', { device_class: 'battery', unit_of_measurement: '%', friendly_name: 'Haustür' }),
  batteryMid: entity('sensor.window_battery', '38', { device_class: 'battery', unit_of_measurement: '%', friendly_name: 'Fenster' }),
  batteryFull: entity('sensor.motion_battery', '92', { device_class: 'battery', unit_of_measurement: '%', friendly_name: 'Bewegung' }),
  sensorText: entity('sensor.mode', 'eco'),
  binarySensorWindow: entity('binary_sensor.window', 'off', { device_class: 'window' }),
  binarySensorOpen: entity('binary_sensor.door', 'on', { device_class: 'door' }),
  binarySensorMotion: { ...entity('binary_sensor.hall', 'on', { device_class: 'motion' }), last_changed: '2026-11-09T18:30:00+00:00' },
  weather: entity('weather.home', 'partlycloudy', { temperature: 12, temperature_unit: '°C', humidity: 60, cloud_coverage: 40, wind_speed: 14, wind_speed_unit: 'km/h', supported_features: 3 }),
  weatherNoForecast: entity('weather.bare', 'sunny', { temperature: 20, supported_features: 0 }),
  vacuum: entity('vacuum.robot', 'docked', { supported_features: 8192 }),
  vacuumFull: entity('vacuum.full', 'cleaning', { supported_features: 8244, fan_speed: 'Standard', fan_speed_list: ['Leise', 'Standard', 'Turbo'], friendly_name: 'Saugroboter' }),
  filterMain: entity('sensor.filter', '80', { unit_of_measurement: '%', friendly_name: 'Filter' }),
  filterBrush: entity('sensor.brush', '30', { unit_of_measurement: '%', friendly_name: 'Hauptbürste' }),
  washerMinutes: entity('sensor.washer_remaining', '47', { unit_of_measurement: 'min', friendly_name: 'Waschmaschine' }),
  washerProgram: entity('sensor.washer_program', 'Baumwolle 40°'),
  cpu: entity('sensor.processor_use', '12', { unit_of_measurement: '%' }),
  ram: entity('sensor.memory_use', '48', { unit_of_measurement: '%' }),
  containerUp: entity('binary_sensor.docker_ha', 'on'),
  containerDown: entity('binary_sensor.docker_z2m', 'off'),
  inputSelect: entity('input_select.mode', 'Gäste', { options: ['Normal', 'Gäste', 'Urlaub'] }),
  inputNumber: entity('input_number.limit', '50', { min: 0, max: 100, step: 5, mode: 'slider' }),
  inputText: entity('input_text.note', 'Hallo', { max: 100, mode: 'text' }),
  inputPassword: entity('input_text.secret', 'geheim', { max: 100, mode: 'password' }),
  inputDate: entity('input_datetime.date', '2026-11-09', { has_date: true, has_time: false }),
  inputTime: entity('input_datetime.wake', '07:00:00', { has_date: false, has_time: true }),
  inputBoth: entity('input_datetime.both', '2026-11-09 07:00:00', { has_date: true, has_time: true }),
  timerIdle: entity('timer.tea', 'idle', { duration: '0:05:00' }),
  timerPaused: entity('timer.pasta', 'paused', { duration: '0:10:00', remaining: '0:03:30' }),
  buttonRestart: entity('button.restart', '2026-11-09T18:00:00+00:00', { friendly_name: 'Neustart' }),
  person: entity('person.resident', 'home'),
} as const;

/** A scene that never ran reports `unknown`, so it cannot be part of the state matrix fixtures. */
export const sceneNever = entity('scene.never', 'unknown', { friendly_name: 'Lesen' });

/** A fixed day of readings, so screenshots stay stable. */
export const sampleHistory: HistoryPoint[] = Array.from({ length: 24 }, (_, hour) => ({
  time: 1762646400000 + hour * 3600000,
  value: Math.round((20 + Math.sin(hour / 3) * 1.5 + Math.cos(hour) * 0.4) * 10) / 10,
}));

export const sampleForecast: ForecastEntry[] = ['sunny', 'partlycloudy', 'rainy', 'snowy', 'cloudy'].map((condition, day) => ({
  datetime: `2026-11-${String(10 + day).padStart(2, '0')}T12:00:00+00:00`,
  condition,
  temperature: 14 - day,
  templow: 6 - day,
}));

export type MatrixCase = 'as_given' | 'unavailable' | 'unknown' | 'missing';

export const matrixCases: readonly MatrixCase[] = ['as_given', 'unavailable', 'unknown', 'missing'];

/** Builds a port holding `base` in the given matrix state. */
export function portForCase(base: HassEntity, matrixCase: MatrixCase, others: HassEntity[] = []): MockHass {
  if (matrixCase === 'missing') return new MockHass(others);
  if (matrixCase === 'as_given') return new MockHass([base, ...others]);
  return new MockHass([{ ...base, state: matrixCase }, ...others]);
}
