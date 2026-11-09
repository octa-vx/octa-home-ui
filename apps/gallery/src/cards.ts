// Shows every card in every row of the state matrix, backed by the mock.
import { html, type TemplateResult } from 'lit';
import type { HassEntity } from '@octa/ha-core';
import { fixtures, matrixCases, portForCase, sampleForecast, sampleHistory, sceneNever, type MatrixCase } from '@octa/testing';

const CASES: Record<MatrixCase, string> = { as_given: 'Normal', unavailable: 'Nicht verfügbar', unknown: 'Unbekannt', missing: 'Entity fehlt' };

interface Row {
  title: string;
  element: string;
  entity: HassEntity;
  variant?: string;
  others?: HassEntity[];
  roles?: Record<string, string>;
  history?: boolean;
  services?: string[];
  forecast?: boolean;
  config?: Record<string, unknown>;
  options?: Record<string, number>;
}

const rows: Row[] = [
  { title: 'Licht, dimmbar', element: 'octa-light-card', entity: fixtures.lightDimmable },
  { title: 'Licht, nur Schalter', element: 'octa-light-card', entity: fixtures.lightOnOff },
  { title: 'Licht, aus', element: 'octa-light-card', entity: fixtures.lightColor },
  { title: 'Helligkeit', element: 'octa-light-card', entity: fixtures.lightDimmable, variant: 'slider' },
  { title: 'Farbe', element: 'octa-light-card', entity: fixtures.lightColorOn, variant: 'color' },
  { title: 'Farbtemperatur', element: 'octa-light-card', entity: fixtures.lightColorOn, variant: 'temperature' },
  { title: 'Lichtgruppe', element: 'octa-light-card', entity: fixtures.lightGroup, variant: 'group', others: [fixtures.lightDimmable, fixtures.lightColor] },
  { title: 'Farbe nicht unterstützt', element: 'octa-light-card', entity: fixtures.lightDimmable, variant: 'color' },
  { title: 'Thermostat', element: 'octa-climate-card', entity: fixtures.climate },
  { title: 'Plus-Minus-Tasten', element: 'octa-climate-card', entity: fixtures.climate, variant: 'buttons' },
  { title: 'Plus-Minus an der unteren Grenze', element: 'octa-climate-card', entity: fixtures.climateModes, variant: 'buttons' },
  { title: 'Betriebsart', element: 'octa-climate-card', entity: fixtures.climateModes, variant: 'mode' },
  { title: 'Rollladen', element: 'octa-cover-card', entity: fixtures.coverPosition },
  { title: 'Position', element: 'octa-cover-card', entity: fixtures.coverPosition, variant: 'position' },
  { title: 'Lamellen', element: 'octa-cover-card', entity: fixtures.coverTilt, variant: 'tilt' },
  { title: 'Lamellen nicht unterstützt', element: 'octa-cover-card', entity: fixtures.coverPosition, variant: 'tilt' },
  { title: 'Garagentor', element: 'octa-cover-card', entity: fixtures.coverGarage },
  { title: 'Schalter', element: 'octa-switch-card', entity: fixtures.switch },
  { title: 'Eingabe-Schalter', element: 'octa-switch-card', entity: fixtures.inputBoolean, variant: 'input_boolean' },
  { title: 'Szenen', element: 'octa-scene-card', entity: fixtures.sceneEvening, others: [fixtures.sceneMovie, sceneNever], roles: { scene_2: fixtures.sceneMovie.entity_id, scene_3: sceneNever.entity_id } },
  { title: 'Lüfter, Stufen', element: 'octa-air-card', entity: fixtures.fanSteps },
  { title: 'Lüfter, Presets', element: 'octa-air-card', entity: fixtures.fanPreset },
  { title: 'Lüfter, stufenlos', element: 'octa-air-card', entity: fixtures.fanPercent },
  { title: 'Ventil', element: 'octa-air-card', entity: fixtures.valve, variant: 'valve' },
  { title: 'Ventil mit Position', element: 'octa-air-card', entity: fixtures.valvePosition, variant: 'valve' },
  { title: 'Sensor', element: 'octa-sensor-card', entity: fixtures.sensorTemperature },
  { title: 'Sensor, Text', element: 'octa-sensor-card', entity: fixtures.sensorText },
  { title: 'Tacho', element: 'octa-sensor-card', entity: fixtures.sensorPercent, variant: 'gauge', options: { warning: 50, danger: 90 } },
  { title: 'CO₂', element: 'octa-sensor-card', entity: fixtures.sensorCo2, variant: 'co2' },
  { title: 'Statistik', element: 'octa-sensor-card', entity: fixtures.sensorTemperature, variant: 'statistic', history: true },
  { title: 'Statistik ohne Daten', element: 'octa-sensor-card', entity: fixtures.sensorTemperature, variant: 'statistic' },
  { title: 'Verlauf', element: 'octa-sensor-card', entity: fixtures.sensorTemperature, variant: 'history', history: true },
  { title: 'Plakette', element: 'octa-sensor-card', entity: fixtures.sensorPercent, variant: 'badge' },
  { title: 'Leistung', element: 'octa-energy-card', entity: fixtures.sensorPower, others: [fixtures.sensorEnergy], roles: { energy: fixtures.sensorEnergy.entity_id } },
  { title: 'Energiefluss', element: 'octa-energy-card', entity: fixtures.sensorPower, variant: 'power_flow', others: [fixtures.sensorSolar, fixtures.sensorGrid, fixtures.sensorBattery], roles: { solar: fixtures.sensorSolar.entity_id, grid: fixtures.sensorGrid.entity_id, battery: fixtures.sensorBattery.entity_id } },
  { title: 'Energiefluss nur Netz', element: 'octa-energy-card', entity: fixtures.sensorPower, variant: 'power_flow', others: [fixtures.sensorGrid], roles: { grid: fixtures.sensorGrid.entity_id } },
  { title: 'Batterien', element: 'octa-energy-card', entity: fixtures.batteryLow, variant: 'battery_list', others: [fixtures.batteryMid, fixtures.batteryFull], roles: { battery_2: fixtures.batteryMid.entity_id, battery_3: fixtures.batteryFull.entity_id } },
  { title: 'Kontakt geschlossen', element: 'octa-security-card', entity: fixtures.binarySensorWindow },
  { title: 'Kontakt offen', element: 'octa-security-card', entity: fixtures.binarySensorOpen },
  { title: 'Bewegung', element: 'octa-security-card', entity: fixtures.binarySensorMotion, variant: 'motion' },
  { title: 'Schloss verriegelt', element: 'octa-security-card', entity: fixtures.lock, variant: 'lock' },
  { title: 'Schloss offen', element: 'octa-security-card', entity: fixtures.lockOpen, variant: 'lock' },
  { title: 'Schloss blockiert', element: 'octa-security-card', entity: fixtures.lockJammed, variant: 'lock' },
  { title: 'Schloss mit Code', element: 'octa-security-card', entity: fixtures.lockCode, variant: 'lock' },
  { title: 'Alarm scharf', element: 'octa-security-card', entity: fixtures.alarm, variant: 'alarm' },
  { title: 'Alarm unscharf', element: 'octa-security-card', entity: fixtures.alarmDisarmed, variant: 'alarm' },
  { title: 'Alarm ohne Code', element: 'octa-security-card', entity: fixtures.alarmNoCode, variant: 'alarm' },
  { title: 'Alarm mit Text-Code', element: 'octa-security-card', entity: fixtures.alarmText, variant: 'alarm' },
  { title: 'Alarm ausgelöst', element: 'octa-security-card', entity: fixtures.alarmTriggered, variant: 'alarm' },
  { title: 'Person', element: 'octa-security-card', entity: fixtures.person, variant: 'person' },
  { title: 'Wiedergabe', element: 'octa-media-card', entity: fixtures.mediaPlaying },
  { title: 'Wiedergabe, ohne Funktionen', element: 'octa-media-card', entity: fixtures.mediaBare },
  { title: 'Raum', element: 'octa-room-card', entity: fixtures.climate, others: [fixtures.lightDimmable, fixtures.switch, fixtures.windowOpen, fixtures.windowClosed, fixtures.mediaPlaying], roles: { media: fixtures.mediaPlaying.entity_id }, config: { name: 'Wohnzimmer', lights: [fixtures.lightDimmable.entity_id, { entity: fixtures.switch.entity_id, name: 'Stehlampe' }], windows: [{ entity: fixtures.windowOpen.entity_id, name: 'Links' }, { entity: fixtures.windowClosed.entity_id, name: 'Rechts' }] } },
  { title: 'Fenster im Block', element: 'octa-contacts-card', entity: fixtures.windowOpen, others: [fixtures.windowClosed], config: { sensors: [{ entity: fixtures.windowClosed.entity_id, name: 'Badezimmer' }, 'binary_sensor.gibt_es_nicht'] } },
  { title: 'Player, Spotify', element: 'octa-media-card', entity: fixtures.castSpotify, variant: 'player' },
  { title: 'Player, Sprachausgabe', element: 'octa-media-card', entity: fixtures.castTts, variant: 'player' },
  { title: 'Player, nichts geladen', element: 'octa-media-card', entity: fixtures.castIdle, variant: 'player' },
  { title: 'Player, Quellen', element: 'octa-media-card', entity: fixtures.castIdle, variant: 'player', others: [fixtures.ttsGoogle, fixtures.spotifyAccount], roles: { tts: fixtures.ttsGoogle.entity_id, spotify: fixtures.spotifyAccount.entity_id }, config: { stations: [{ name: '1LIVE', media_id: 'http://example.invalid/1live.mp3', media_type: 'music' }], spotify: { playlists: [{ name: 'Favoriten', media_id: 'spotify:playlist:abc' }] } } },
  { title: 'Player, Spotify schläft', element: 'octa-media-card', entity: fixtures.castIdle, variant: 'player', others: [fixtures.spotifyAccount], roles: { spotify: fixtures.spotifyAccount.entity_id }, config: { spotify: { device: 'Bad' } } },
  { title: 'Lautstärke', element: 'octa-media-card', entity: fixtures.mediaPlaying, variant: 'volume' },
  { title: 'Lautstärke, stumm', element: 'octa-media-card', entity: fixtures.mediaMuted, variant: 'volume' },
  { title: 'Quelle, Zielgerät', element: 'octa-media-card', entity: fixtures.mediaSources, variant: 'source' },
  { title: 'Sender mit Zielgerät', element: 'octa-media-card', entity: fixtures.mediaPlaying, variant: 'stations', others: [fixtures.mediaKitchen], roles: { target_2: fixtures.mediaKitchen.entity_id }, config: { stations: [{ name: '1LIVE', media_id: 'http://example.invalid/1live.mp3', media_type: 'music' }, { name: 'Chill Mix', media_id: 'http://example.invalid/chill.mp3' }] } },
  { title: 'Sender, leer', element: 'octa-media-card', entity: fixtures.mediaPlaying, variant: 'stations' },
  { title: 'TV-Fernbedienung', element: 'octa-media-card', entity: fixtures.tv, variant: 'tv_remote', others: [fixtures.tvRemote, fixtures.tvScript], roles: { remote: fixtures.tvRemote.entity_id }, config: { remote_apps: [{ name: 'YouTube', script: fixtures.tvScript.entity_id, variables: { quelle: 'YouTube' } }, { name: 'Netflix', app_id: '3201907018807' }] } },
  { title: 'Wetter mit Vorhersage', element: 'octa-weather-card', entity: fixtures.weather, forecast: true },
  { title: 'Wetter ohne Vorhersage', element: 'octa-weather-card', entity: fixtures.weatherNoForecast },
  { title: 'Server', element: 'octa-system-card', entity: fixtures.containerUp, others: [fixtures.cpu, fixtures.ram], roles: { cpu: fixtures.cpu.entity_id, memory: fixtures.ram.entity_id } },
  { title: 'Docker', element: 'octa-system-card', entity: fixtures.containerUp, variant: 'docker_status', others: [fixtures.containerDown, fixtures.cpu, fixtures.ram], config: { containers: [{ name: 'Home Assistant', status: fixtures.containerUp.entity_id, cpu: fixtures.cpu.entity_id, memory: fixtures.ram.entity_id }, { name: 'Zigbee2MQTT', status: fixtures.containerDown.entity_id }] } },
  { title: 'Saugroboter', element: 'octa-appliance-card', entity: fixtures.vacuumFull },
  { title: 'Verschleißteile', element: 'octa-appliance-card', entity: fixtures.filterMain, variant: 'filter', others: [fixtures.filterBrush], roles: { part_2: fixtures.filterBrush.entity_id } },
  { title: 'Waschmaschine', element: 'octa-appliance-card', entity: fixtures.washerMinutes, variant: 'washer', others: [fixtures.washerProgram], roles: { program: fixtures.washerProgram.entity_id } },
  { title: 'Auswahl', element: 'octa-input-card', entity: fixtures.inputSelect },
  { title: 'Zahl', element: 'octa-input-card', entity: fixtures.inputNumber, variant: 'input_number' },
  { title: 'Text', element: 'octa-input-card', entity: fixtures.inputText, variant: 'input_text' },
  { title: 'Passwort-Text', element: 'octa-input-card', entity: fixtures.inputPassword, variant: 'input_text' },
  { title: 'Datum', element: 'octa-input-card', entity: fixtures.inputDate, variant: 'input_datetime' },
  { title: 'Uhrzeit', element: 'octa-input-card', entity: fixtures.inputTime, variant: 'input_datetime' },
  { title: 'Datum und Uhrzeit', element: 'octa-input-card', entity: fixtures.inputBoth, variant: 'input_datetime' },
  { title: 'Timer', element: 'octa-input-card', entity: fixtures.timerIdle, variant: 'timer' },
  { title: 'Timer pausiert', element: 'octa-input-card', entity: fixtures.timerPaused, variant: 'timer' },
  { title: 'Taste', element: 'octa-input-card', entity: fixtures.buttonRestart, variant: 'button' },
  { title: 'Livebild', element: 'octa-camera-card', entity: fixtures.cameraSample },
  { title: 'Standbild', element: 'octa-camera-card', entity: fixtures.cameraSample, variant: 'snapshot' },
  { title: 'Kamera ohne Bild', element: 'octa-camera-card', entity: fixtures.cameraNoPicture },
  { title: 'Überwachung', element: 'octa-camera-card', entity: fixtures.cameraSample, variant: 'security_cam', others: [fixtures.binarySensorMotion], roles: { motion: fixtures.binarySensorMotion.entity_id } },
  { title: 'Überwachung, Aufnahme', element: 'octa-camera-card', entity: fixtures.cameraRecording, variant: 'security_cam' },
  { title: 'Schwenken', element: 'octa-camera-card', entity: fixtures.cameraSample, variant: 'ptz', services: ['onvif.ptz'] },
  { title: 'Schwenken nicht möglich', element: 'octa-camera-card', entity: fixtures.cameraSample, variant: 'ptz' },
];

const keyOf = (row: number, matrixCase: MatrixCase): string => `${row}:${matrixCase}`;

declare global {
  interface Window {
    __ports?: Record<string, { calls: unknown[] }>;
  }
}

export function mountCards(root: HTMLElement, appearance: string): void {
  rows.forEach(({ element, entity, variant, others, roles, history, options, services, config, forecast }, row) => {
    for (const matrixCase of matrixCases) {
      const card = root.querySelector(`[data-card="${keyOf(row, matrixCase)}"]`) as (HTMLElement & { setConfig(raw: unknown): void; port: unknown }) | null;
      if (!card) throw new Error(`Missing ${element}`);
      card.setConfig({ type: `custom:${element}`, entity: entity.entity_id, appearance, ...(variant ? { variant } : {}), ...(roles ? { roles } : {}), ...options, ...config });
      const port = portForCase(entity, matrixCase, others);
      if (history && matrixCase !== 'missing') port.history = sampleHistory;
      if (forecast && matrixCase !== 'missing') port.forecast = sampleForecast;
      services?.forEach((service) => port.services.add(service));
      card.port = port;
      (window.__ports ??= {})[`${rows[row]?.title}:${matrixCase}`] = port;
    }
  });
}

export function cardsView(): TemplateResult {
  const card = (element: string, id: string): HTMLElement => {
    const node = document.createElement(element);
    node.dataset.card = id;
    return node;
  };
  return html`<main class="cards-view">
    <h1>Karten, Zustandsmatrix</h1>
    ${rows.map(
      ({ title, element }, row) => html`<section>
        <h2>${title}</h2>
        <div class="grid">
          ${matrixCases.map((matrixCase) => html`<div class="cell"><h3>${CASES[matrixCase]}</h3>${card(element, keyOf(row, matrixCase))}</div>`)}
        </div>
      </section>`,
    )}
  </main>`;
}
