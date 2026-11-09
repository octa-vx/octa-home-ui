import { describe, expect, it } from 'vitest';
import { confirmationText, createHassPort, executeCommand, normalizeEntity, requiresConfirmation, type HassEntity, type HassLike } from '@octa/ha-core';
import type { CardConfig } from '@octa/schema';
import { MockHass, fixtures, sceneNever } from '@octa/testing';
import { airCommands, airWidget, fanLevels } from './air.ts';
import { chartPoints, co2Level, sensorWidget, statistics } from './sensor.ts';
import { energyWidget, splitUnit, toKilowatts } from './energy.ts';
import { securityCommands, securityWidget } from './security.ts';
import { cameraCommands, cameraWidget, safePicture } from './camera.ts';
import { DEFAULT_KEYS, mediaCommands, mediaWidget, parseRemoteApps, parseStations, type RemoteApp } from './media.ts';
import { applianceCommands, applianceWidget } from './appliance.ts';
import { inputCommands, inputWidget } from './input.ts';
import { systemWidget, parseContainers } from './system.ts';
import { formatDuration, parseDuration } from './timer-display.ts';
import { forecastDays, weatherWidget } from './weather.ts';
import { sceneCommands, sceneWidget } from './scene.ts';
import { switchCommands, switchWidget } from './switch.ts';
import { climateCommands, climateWidget, stepTarget } from './climate.ts';
import { coverCommands, coverWidget } from './cover.ts';
import { contactsWidget, parseSensors } from './contacts.ts';
import { parseLights, roomWidget } from './room.ts';
import { hexToRgb, lightCommands, lightWidget, rgbToHex } from './light.ts';

const config: CardConfig = { type: 'x', version: 1, variant: 'x', appearance: 'soft', roles: {} };
const target = (entity: HassEntity) => {
  const port = new MockHass([entity]);
  return [normalizeEntity(port, entity.entity_id), config, port] as const;
};

describe('light', () => {
  it('shows the brightness of a dimmable light', () => {
    expect(lightWidget.toViewModel(...target(fixtures.lightDimmable))).toMatchObject({ id: 'light.dimmable', on: true, brightness: 50, label: '50 %', color: null, kelvin: null, members: [] });
  });

  it('hides the slider of an on/off light', () => {
    const vm = lightWidget.toViewModel(...target(fixtures.lightOnOff));
    expect(vm.brightness).toBeNull();
    expect(vm.label).toBe('on');
  });

  it('shows the state of a light that is off', () => {
    const vm = lightWidget.toViewModel(...target(fixtures.lightColor));
    expect(vm).toMatchObject({ on: false, brightness: 0, label: 'off' });
  });

  it('toggles to the opposite state', () => {
    expect(lightCommands.toggle('light.a', true).service).toBe('turn_off');
    expect(lightCommands.toggle('light.a', false).service).toBe('turn_on');
  });

  it('turns off at zero brightness instead of sending 0', () => {
    expect(lightCommands.brightness('light.a', 0)).toEqual({ domain: 'light', service: 'turn_off', entityId: 'light.a' });
    expect(lightCommands.brightness('light.a', 40).data).toEqual({ brightness_pct: 40 });
  });
});

describe('light variants', () => {
  const withVariant = (entity: HassEntity, variant: string, others: HassEntity[] = []) => {
    const port = new MockHass([entity, ...others]);
    return lightWidget.toViewModel(normalizeEntity(port, entity.entity_id), { ...config, variant }, port);
  };

  it('reads color and white temperature', () => {
    expect(withVariant(fixtures.lightColorOn, 'color').color).toBe('#ff9933');
    expect(withVariant(fixtures.lightColorOn, 'temperature').kelvin).toEqual({ value: 3000, known: true, min: 2200, max: 6500 });
  });

  it('offers no color or white on a light that cannot do it', () => {
    expect(withVariant(fixtures.lightDimmable, 'color').color).toBeNull();
    expect(withVariant(fixtures.lightDimmable, 'temperature').kelvin).toBeNull();
  });

  it('marks an unknown white temperature instead of inventing a value', () => {
    expect(withVariant(fixtures.lightColor, 'temperature').kelvin).toMatchObject({ known: false });
  });

  it('lists the group members with their state and skips unknown ones', () => {
    expect(withVariant(fixtures.lightGroup, 'group', [fixtures.lightDimmable]).members).toEqual([{ name: 'dimmable', on: true }]);
  });

  it('converts colors both ways', () => {
    expect(rgbToHex([255, 77, 0])).toBe('#ff4d00');
    expect(rgbToHex('nope')).toBeNull();
    expect(hexToRgb('#ff4d00')).toEqual([255, 77, 0]);
  });

  it('sends color and temperature', () => {
    expect(lightCommands.color('light.a', '#ff4d00').data).toEqual({ rgb_color: [255, 77, 0] });
    expect(lightCommands.temperature('light.a', 4000).data).toEqual({ color_temp_kelvin: 4000 });
  });
});

describe('climate', () => {
  it('reads target and current temperature', () => {
    expect(climateWidget.toViewModel(...target(fixtures.climate))).toMatchObject({ target: 21, current: 19.5, min: 7, max: 35, step: 0.5 });
  });

  it('has no dial without a single target temperature', () => {
    const range = { ...fixtures.climate, attributes: { ...fixtures.climate.attributes, supported_features: 2 } };
    expect(climateWidget.toViewModel(...target(range)).target).toBeNull();
  });

  it('does not send a temperature to a device without that feature', async () => {
    const entity = { ...fixtures.climate, attributes: { ...fixtures.climate.attributes, supported_features: 2 } };
    const port = new MockHass([entity]);
    expect(await executeCommand(port, climateCommands.temperature(entity.entity_id, 22))).toBe('unsupported');
    expect(port.calls).toEqual([]);
  });

  it('sends the target temperature', async () => {
    const port = new MockHass([fixtures.climate]);
    await executeCommand(port, climateCommands.temperature(fixtures.climate.entity_id, 22.5));
    expect(port.calls).toEqual([{ domain: 'climate', service: 'set_temperature', data: { temperature: 22.5 }, entityId: 'climate.heater' }]);
  });
});

describe('climate variants', () => {
  const vm = (entity: HassEntity, variant: string) => {
    const port = new MockHass([entity]);
    return climateWidget.toViewModel(normalizeEntity(port, entity.entity_id), { ...config, variant }, port);
  };

  it('offers only the modes the device reports', () => {
    expect(vm(fixtures.climateModes, 'mode')).toMatchObject({ mode: 'cool', modes: ['off', 'heat', 'cool', 'auto'] });
    expect(vm(fixtures.climate, 'mode').modes).toEqual(['off', 'heat']);
  });

  it('hides modes the card has no label for', () => {
    const custom = { ...fixtures.climate, attributes: { ...fixtures.climate.attributes, hvac_modes: ['heat', 'vendor_mode'] } };
    expect(vm(custom, 'mode').modes).toEqual(['heat']);
  });

  it('sends the mode', () => {
    expect(climateCommands.mode('climate.a', 'cool')).toEqual({ domain: 'climate', service: 'set_hvac_mode', entityId: 'climate.a', data: { hvac_mode: 'cool' } });
  });

  it('steps within the limits', () => {
    const base = { target: 21, min: 21, max: 22, step: 0.5 };
    expect(stepTarget(base, 1)).toBe(21.5);
    expect(stepTarget(base, -1)).toBeNull();
    expect(stepTarget({ ...base, target: 22 }, 1)).toBeNull();
    expect(stepTarget({ ...base, target: null }, 1)).toBeNull();
  });

  it('does not accumulate floating point errors', () => {
    expect(stepTarget({ target: 21.1, min: 7, max: 35, step: 0.1 }, 1)).toBe(21.2);
  });
});

describe('cover', () => {
  it('offers the supported buttons and the position', () => {
    expect(coverWidget.toViewModel(...target(fixtures.coverPosition))).toMatchObject({
      id: 'cover.blind',
      label: 'open',
      position: 40,
      canOpen: true,
      canStop: true,
      canClose: true,
    });
  });

  it('hides what a simple cover cannot do', () => {
    expect(coverWidget.toViewModel(...target(fixtures.coverGarage))).toMatchObject({ position: null, canOpen: true, canStop: false, canClose: true });
  });

  it('reads slats only when they can be set', () => {
    expect(coverWidget.toViewModel(...target(fixtures.coverTilt)).tilt).toBe(50);
    expect(coverWidget.toViewModel(...target(fixtures.coverPosition)).tilt).toBeNull();
    const fixed = { ...fixtures.coverTilt, attributes: { ...fixtures.coverTilt.attributes, supported_features: 15 } };
    expect(coverWidget.toViewModel(...target(fixed)).tilt).toBeNull();
  });

  it('checks position and slat commands against the features', async () => {
    const port = new MockHass([fixtures.coverGarage]);
    expect(await executeCommand(port, coverCommands.position(fixtures.coverGarage.entity_id, 50))).toBe('unsupported');
    expect(await executeCommand(port, coverCommands.tilt(fixtures.coverGarage.entity_id, 50))).toBe('unsupported');
    expect(port.calls).toEqual([]);
  });

  it('sends position and slats', () => {
    expect(coverCommands.position('cover.a', 30).data).toEqual({ position: 30 });
    expect(coverCommands.tilt('cover.a', 30).data).toEqual({ tilt_position: 30 });
  });

  it('never opens a garage without confirmation', async () => {
    const port = new MockHass([fixtures.coverGarage]);
    expect(await executeCommand(port, coverCommands.open(fixtures.coverGarage.entity_id))).toBe('needs_confirmation');
    expect(port.calls).toEqual([]);
    expect(await executeCommand(port, coverCommands.open(fixtures.coverGarage.entity_id), { confirmed: true })).toBe('sent');
  });

  it('does not let the position slider bypass the garage confirmation', () => {
    expect(requiresConfirmation(coverCommands.position(fixtures.coverGarage.entity_id, 50), fixtures.coverGarage)).toBe(true);
    expect(requiresConfirmation(coverCommands.position(fixtures.coverPosition.entity_id, 50), fixtures.coverPosition)).toBe(false);
  });

  it('treats gates like garage doors', () => {
    const gate = { ...fixtures.coverGarage, attributes: { ...fixtures.coverGarage.attributes, device_class: 'gate' } };
    expect(requiresConfirmation(coverCommands.open(gate.entity_id), gate)).toBe(true);
  });

  it('treats motorised doors like garage doors, but not blinds without a class', () => {
    const withClass = (device_class: string | undefined) => ({ ...fixtures.coverGarage, attributes: { ...fixtures.coverGarage.attributes, device_class } });
    expect(requiresConfirmation(coverCommands.open('cover.x'), withClass('door'))).toBe(true);
    expect(requiresConfirmation(coverCommands.open('cover.x'), withClass(undefined))).toBe(false);
    expect(requiresConfirmation(coverCommands.open('cover.x'), withClass('shutter'))).toBe(false);
  });

  it('asks for the slider only when it opens further or the position is unknown', () => {
    const at = (current_position: number | undefined) => ({ ...fixtures.coverGarage, attributes: { ...fixtures.coverGarage.attributes, current_position } });
    expect(requiresConfirmation(coverCommands.position('cover.x', 80), at(60))).toBe(true);
    expect(requiresConfirmation(coverCommands.position('cover.x', 60), at(60))).toBe(false);
    expect(requiresConfirmation(coverCommands.position('cover.x', 0), at(60))).toBe(false);
    expect(requiresConfirmation(coverCommands.position('cover.x', 0), at(undefined))).toBe(true);
  });

  it('names device, action and value in the question', () => {
    expect(confirmationText('de', coverCommands.position('cover.x', 80), 'Tor')).toBe('Tor auf 80 % fahren?');
    expect(confirmationText('en', coverCommands.position('cover.x', 80), 'Gate')).toBe('Move Gate to 80%?');
    expect(confirmationText('de', coverCommands.open('cover.x'), 'Tor')).toBe('Tor öffnen?');
    expect(confirmationText('de', securityCommands.unlock('lock.x'), 'Tür')).toBe('Tür entriegeln?');
    expect(confirmationText('de', securityCommands.alarm('alarm_control_panel.x', 'alarm_disarm', undefined), 'Haus')).toBe('Haus unscharf schalten?');
  });

  it('closes a garage directly', async () => {
    const port = new MockHass([fixtures.coverGarage]);
    expect(await executeCommand(port, coverCommands.close(fixtures.coverGarage.entity_id))).toBe('sent');
  });
});

describe('switch', () => {
  it('targets the domain of the entity', () => {
    expect(switchCommands.toggle('input_boolean.a', false)).toEqual({ domain: 'input_boolean', service: 'turn_on', entityId: 'input_boolean.a' });
    expect(switchCommands.toggle('switch.a', true).service).toBe('turn_off');
  });

  it('reflects the state', () => {
    expect(switchWidget.toViewModel(...target(fixtures.switch))).toEqual({ id: 'switch.plug', on: true, label: 'on' });
  });
});

describe('scenes', () => {
  const port = new MockHass([fixtures.sceneEvening, fixtures.sceneMovie, sceneNever]);
  const roles = { main: 'scene.evening', scene_2: 'scene.movie', scene_3: 'scene.never', scene_4: 'scene.gone' };
  const vm = sceneWidget.toViewModel(normalizeEntity(port, 'scene.evening'), { ...config, roles }, port);

  it('marks the most recently activated scene and skips missing ones', () => {
    expect(vm.scenes).toEqual([
      { id: 'scene.evening', name: 'Abend', active: false },
      { id: 'scene.movie', name: 'Film', active: true },
      { id: 'scene.never', name: 'Lesen', active: false },
    ]);
  });

  it('marks nothing when no scene ever ran', () => {
    const fresh = new MockHass([sceneNever]);
    const result = sceneWidget.toViewModel(normalizeEntity(fresh, 'scene.never'), { ...config, roles: { main: 'scene.never' } }, fresh);
    expect(result.scenes[0]?.active).toBe(false);
  });

  it('activates a scene', () => {
    expect(sceneCommands.activate('scene.a')).toEqual({ domain: 'scene', service: 'turn_on', entityId: 'scene.a' });
  });
});

describe('fan and valve', () => {
  const vm = (entity: HassEntity) => airWidget.toViewModel(...target(entity));

  it('derives levels from the step and falls back to a slider for fine steps', () => {
    expect(fanLevels(33.33)).toEqual([33, 67, 100]);
    expect(fanLevels(1)).toEqual([]);
    expect(fanLevels(undefined)).toEqual([]);
  });

  it('reads a stepped fan', () => {
    expect(vm(fixtures.fanSteps)).toMatchObject({ kind: 'fan', levels: [33, 67, 100], percentage: 67, on: true });
  });

  it('reads presets', () => {
    expect(vm(fixtures.fanPreset)).toMatchObject({ presets: ['eco', 'boost'], preset: 'eco', percentage: null });
  });

  it('turns the fan off at zero', () => {
    expect(airCommands.percentage('fan.a', 0)).toEqual({ domain: 'fan', service: 'turn_off', entityId: 'fan.a' });
    expect(airCommands.percentage('fan.a', 33).data).toEqual({ percentage: 33 });
  });

  it('does not set a speed the fan cannot do', async () => {
    const port = new MockHass([fixtures.fanPreset]);
    expect(await executeCommand(port, airCommands.percentage(fixtures.fanPreset.entity_id, 50))).toBe('unsupported');
  });

  it('reads a valve with and without position', () => {
    expect(vm(fixtures.valvePosition)).toMatchObject({ kind: 'valve', position: 35, on: true, canToggle: true });
    expect(vm(fixtures.valve)).toMatchObject({ kind: 'valve', position: null, on: false, canToggle: true });
  });

  it('closes an open valve and opens a closed one', () => {
    expect(airCommands.valveToggle('valve.a', true).service).toBe('close_valve');
    expect(airCommands.valveToggle('valve.a', false).service).toBe('open_valve');
  });
});

describe('sensor', () => {
  const vm = (entity: HassEntity) => sensorWidget.toViewModel(...target(entity), []);
  const point = (time: number, value: number) => ({ time, value });

  it('splits value and unit from the formatted state', () => {
    const port = new MockHass([fixtures.sensorTemperature]);
    port.formatState = () => '21,5 °C';
    expect(sensorWidget.toViewModel(normalizeEntity(port, 'sensor.temperature'), config, port)).toMatchObject({ value: '21,5', unit: '°C', number: 21.5 });
  });

  it('marks text states as not numeric', () => {
    expect(vm(fixtures.sensorText)).toMatchObject({ value: 'eco', number: null });
  });

  it('does not treat unknown as a number', () => {
    expect(vm({ ...fixtures.sensorTemperature, state: 'unknown' }).number).toBeNull();
  });

  it('uses the configured gauge range', () => {
    const port = new MockHass([fixtures.sensorPercent]);
    const result = sensorWidget.toViewModel(normalizeEntity(port, 'sensor.humidity'), { ...config, options: { min: 10, max: 40, warning: 20 } }, port);
    expect(result).toMatchObject({ min: 10, max: 40, warning: 20, danger: undefined });
  });

  it('grades CO₂', () => {
    expect([co2Level(799), co2Level(800), co2Level(1399), co2Level(1400)]).toEqual(['good', 'moderate', 'moderate', 'poor']);
  });

  it('computes statistics', () => {
    expect(statistics([point(1, 10), point(2, 20), point(3, 30)])).toEqual({ min: 10, mean: 20, max: 30 });
    expect(statistics([])).toBeNull();
  });

  it('scales the chart to the full width', () => {
    expect(chartPoints([point(0, 10), point(100, 20)])).toBe('0,104 300,8');
  });

  it('draws a single reading as a flat line and nothing without data', () => {
    expect(chartPoints([point(5, 10)])).toBe('0,56 300,56');
    expect(chartPoints([])).toBe('');
  });
});

describe('history access', () => {
  const hass = (reply: unknown): HassLike => ({ states: {}, callService: async () => undefined, callWS: async () => reply });

  it('reads the compressed history format and drops non-numeric states', async () => {
    const port = createHassPort(hass({ 'sensor.a': [{ s: '1.5', lu: 10 }, { s: 'unavailable', lu: 11 }, { s: '2', lu: 12 }] }));
    expect(await port.fetchHistory('sensor.a', 24)).toEqual([{ time: 10000, value: 1.5 }, { time: 12000, value: 2 }]);
  });

  it('returns nothing without history support', async () => {
    expect(await createHassPort({ states: {}, callService: async () => undefined }).fetchHistory('sensor.a', 24)).toEqual([]);
  });
});

describe('energy', () => {
  it('splits a unit and keeps other labels', () => {
    expect(splitUnit('850 W', 'W')).toBe('850');
    expect(splitUnit('eco', '')).toBe('eco');
  });

  it('normalizes power to kilowatts', () => {
    expect(toKilowatts(fixtures.sensorPower)).toBe(0.85);
    expect(toKilowatts(fixtures.sensorSolar)).toBe(2.4);
    expect(toKilowatts({ ...fixtures.sensorPower, state: 'unknown' })).toBeNull();
    expect(toKilowatts(undefined)).toBeNull();
  });

  it('builds the flow from its roles and leaves out missing ones', () => {
    const port = new MockHass([fixtures.sensorPower, fixtures.sensorGrid]);
    const flow = energyWidget.toViewModel(normalizeEntity(port, 'sensor.power'), { ...config, variant: 'power_flow', roles: { main: 'sensor.power', grid: 'sensor.grid', solar: 'sensor.solar' } }, port).flow;
    expect(flow).toEqual({ home: 0.85, grid: 0.3, solar: null, battery: null });
  });

  it('lists batteries and skips unavailable ones', () => {
    const port = new MockHass([fixtures.batteryLow, { ...fixtures.batteryMid, state: 'unavailable' }, fixtures.batteryFull]);
    const roles = { main: 'sensor.door_battery', battery_2: 'sensor.window_battery', battery_3: 'sensor.motion_battery' };
    expect(energyWidget.toViewModel(normalizeEntity(port, roles.main), { ...config, variant: 'battery_list', roles }, port).batteries).toEqual([
      { name: 'Haustür', percent: 12 },
      { name: 'Bewegung', percent: 92 },
    ]);
  });
});

describe('security', () => {
  const vm = (entity: HassEntity, variant = 'contact') => {
    const port = new MockHass([entity]);
    return securityWidget.toViewModel(normalizeEntity(port, entity.entity_id), { ...config, variant }, port);
  };

  it('reads contacts and motion', () => {
    expect(vm(fixtures.binarySensorOpen)).toMatchObject({ kind: 'contact', open: true });
    expect(vm(fixtures.binarySensorMotion, 'motion')).toMatchObject({ kind: 'motion', detected: true });
    expect(vm(fixtures.binarySensorMotion, 'motion')).not.toMatchObject({ last: null });
  });

  it('flags a jammed lock', () => {
    expect(vm(fixtures.lockJammed)).toMatchObject({ kind: 'lock', jammed: true, locked: false });
  });

  it('marks moving locks', () => {
    expect(vm({ ...fixtures.lock, state: 'unlocking' })).toMatchObject({ moving: true });
  });

  it('does not offer control of a lock that needs a code', () => {
    expect(vm(fixtures.lockCode)).toMatchObject({ codeRequired: true });
  });

  it('never unlocks without confirmation, but locks directly', async () => {
    const port = new MockHass([fixtures.lock]);
    expect(await executeCommand(port, securityCommands.unlock('lock.front_door'))).toBe('needs_confirmation');
    expect(port.calls).toEqual([]);
    expect(await executeCommand(port, securityCommands.lock('lock.front_door'))).toBe('sent');
  });

  it('never disarms without confirmation', async () => {
    const port = new MockHass([fixtures.alarm]);
    expect(await executeCommand(port, securityCommands.alarm(fixtures.alarm.entity_id, 'alarm_disarm', undefined))).toBe('needs_confirmation');
    expect(port.calls).toEqual([]);
  });

  it('sends the code only inside the service call', async () => {
    const port = new MockHass([fixtures.alarm]);
    await executeCommand(port, securityCommands.alarm(fixtures.alarm.entity_id, 'alarm_disarm', '4711'), { confirmed: true });
    expect(port.calls[0]?.data).toEqual({ code: '4711' });
  });

  it('sends no code when none was entered', () => {
    expect(securityCommands.alarm('alarm_control_panel.a', 'alarm_arm_home', undefined).data).toBeUndefined();
  });

  it('blocks arm modes the panel does not support', async () => {
    const port = new MockHass([fixtures.alarmNoCode]);
    expect(await executeCommand(port, securityCommands.alarm(fixtures.alarmNoCode.entity_id, 'alarm_arm_away', undefined))).toBe('unsupported');
  });

  it('offers only supported arm modes', () => {
    expect(vm(fixtures.alarmDisarmed)).toMatchObject({ kind: 'alarm', disarmed: true, codeFormat: null, armServices: [{ service: 'alarm_arm_home' }, { service: 'alarm_arm_away' }] });
  });

  it('asks for a code to disarm', () => {
    expect(vm(fixtures.alarm)).toMatchObject({ disarmed: false, codeFormat: 'number' });
    expect(vm(fixtures.alarmText)).toMatchObject({ codeFormat: 'text' });
    expect(vm(fixtures.alarmNoCode)).toMatchObject({ codeFormat: null });
  });

  it('flags a triggered alarm', () => {
    expect(vm(fixtures.alarmTriggered)).toMatchObject({ triggered: true });
  });

  it('shows a person with an initial', () => {
    expect(vm(fixtures.person)).toMatchObject({ kind: 'person', initial: 'R', picture: null });
  });
});

describe('camera', () => {
  const vm = (entity: HassEntity, variant = 'camera', build: (port: MockHass) => void = () => undefined) => {
    const port = new MockHass([entity, fixtures.binarySensorMotion]);
    build(port);
    return cameraWidget.toViewModel(normalizeEntity(port, entity.entity_id), { ...config, variant, roles: { main: entity.entity_id, motion: fixtures.binarySensorMotion.entity_id } }, port);
  };

  it('accepts only authenticated Home Assistant paths', () => {
    expect(safePicture('/api/camera_proxy/camera.a?token=x')).toBe('/api/camera_proxy/camera.a?token=x');
    expect(safePicture('https://example.invalid/a.jpg')).toBeNull();
    expect(safePicture('javascript:alert(1)')).toBeNull();
    expect(safePicture(undefined)).toBeNull();
  });

  it('reads recording, motion and detection', () => {
    expect(vm(fixtures.cameraSample, 'security_cam')).toMatchObject({ recording: false, motion: true, motionDetection: true });
    expect(vm(fixtures.cameraRecording, 'security_cam')).toMatchObject({ recording: true, motionDetection: false });
  });

  it('has no picture when HA reports none', () => {
    expect(vm(fixtures.cameraNoPicture).picture).toBeNull();
  });

  it('offers movement only with the ONVIF service', () => {
    expect(vm(fixtures.cameraSample, 'ptz').canMove).toBe(false);
    expect(vm(fixtures.cameraSample, 'ptz', (port) => port.services.add('onvif.ptz')).canMove).toBe(true);
  });

  it('sends movement and motion detection', () => {
    expect(cameraCommands.move('camera.a', 'pan', 'LEFT').data).toMatchObject({ pan: 'LEFT', move_mode: 'ContinuousMove' });
    expect(cameraCommands.motionDetection('camera.a', true).service).toBe('disable_motion_detection');
    expect(cameraCommands.motionDetection('camera.a', false).service).toBe('enable_motion_detection');
  });
});

describe('room', () => {
  const port = new MockHass([fixtures.climate, fixtures.lightDimmable, fixtures.switch, fixtures.windowOpen, fixtures.mediaPlaying]);
  const room = (overrides: Partial<CardConfig>) => roomWidget.toViewModel(normalizeEntity(port, ''), { ...config, ...overrides }, port);

  it('brings heating, lights, windows and media together', () => {
    const vm = room({ roles: { main: fixtures.climate.entity_id, media: fixtures.mediaPlaying.entity_id }, extras: { lights: [fixtures.lightDimmable.entity_id, { entity: fixtures.switch.entity_id, name: 'Lampe' }], windows: [fixtures.windowOpen.entity_id] } });
    expect(vm.climate).toMatchObject({ current: 19.5, target: 21, higher: 21.5, lower: 20.5 });
    expect(vm.lights.map((light) => light.id)).toEqual([fixtures.lightDimmable.entity_id, fixtures.switch.entity_id]);
    expect(vm.lights[1]?.name).toBe('Lampe');
    expect(vm.windows[0]?.state).toBe('open');
    expect(vm.media).toMatchObject({ playing: true, canPlay: true });
  });

  it('shows only what is configured, and skips what does not exist', () => {
    expect(room({ roles: {} })).toEqual({ climate: null, lights: [], windows: [], media: null });
    expect(room({ roles: { main: 'climate.gibt_es_nicht', media: 'media_player.gibt_es_nicht' } })).toMatchObject({ climate: null, media: null });
  });

  it('accepts only lights and switches as lights', () => {
    expect(parseLights(['light.a', 'switch.b', 'sensor.c', { entity: 'cover.d' }]).map((item) => item.entity)).toEqual(['light.a', 'switch.b']);
  });
});

describe('contacts', () => {
  it('reads plain ids and named entries, and drops anything else', () => {
    expect(parseSensors(['binary_sensor.a', { entity: 'binary_sensor.b', name: 'B' }, { entity: 'light.c' }, 'sensor.d', 5, { name: 'x' }])).toEqual([{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b', name: 'B' }]);
    expect(parseSensors('binary_sensor.a')).toEqual([]);
  });

  it('shows open, closed and unknown without one sensor affecting the others', () => {
    const port = new MockHass([fixtures.windowOpen, fixtures.windowClosed]);
    const vm = contactsWidget.toViewModel(normalizeEntity(port, ''), { ...config, extras: { sensors: [fixtures.windowOpen.entity_id, { entity: fixtures.windowClosed.entity_id, name: 'Bad' }, 'binary_sensor.fehlt'] } }, port);
    expect(vm.tiles.map((tile) => [tile.name, tile.state])).toEqual([['Küche', 'open'], ['Bad', 'closed'], [expect.any(String), 'unknown']]);
  });
});

describe('media', () => {
  const vm = (entity: HassEntity, overrides: Partial<CardConfig> = {}, others: HassEntity[] = []) => {
    const port = new MockHass([entity, ...others]);
    return mediaWidget.toViewModel(normalizeEntity(port, entity.entity_id), { ...config, ...overrides, roles: { main: entity.entity_id, ...overrides.roles } }, port);
  };

  it('reads app buttons and ignores incomplete ones', () => {
    const apps = [{ name: 'YouTube', script: 'script.tv', variables: { quelle: 'YouTube' } }, { name: 'Netflix', app_id: '1' }, { name: 'Kaputt' }, { name: 'Fremd', script: 'light.x' }, { script: 'script.tv' }];
    expect(parseRemoteApps(apps).map((app) => app.name)).toEqual(['YouTube', 'Netflix']);
    const [script, app] = parseRemoteApps(apps) as [RemoteApp, RemoteApp];
    expect(mediaCommands.startApp('media_player.tv', script)).toMatchObject({ domain: 'script', service: 'turn_on', entityId: 'script.tv', data: { variables: { quelle: 'YouTube' } } });
    expect(mediaCommands.startApp('media_player.tv', app)).toMatchObject({ service: 'play_media', entityId: 'media_player.tv', data: { media_content_id: '1', media_content_type: 'app' } });
  });

  it('names where the sound comes from', () => {
    const attrs = (attributes: Record<string, unknown>): HassEntity => ({ ...fixtures.mediaPlaying, attributes: { supported_features: 21437, ...attributes } });
    expect(vm(attrs({ app_name: 'Spotify' }))).toMatchObject({ origin: 'Spotify' });
    expect(vm(attrs({ app_name: 'YouTube Music' }))).toMatchObject({ origin: 'YouTube Music' });
    expect(vm(attrs({ app_name: 'Default Media Receiver', media_content_id: 'http://ha/api/tts_proxy/a.mp3' }))).toMatchObject({ origin: 'Text-to-Speech' });
    expect(vm(attrs({ app_name: 'Default Media Receiver', media_content_id: 'https://radio/stream.mp3' }))).toMatchObject({ origin: 'Stream oder Radio' });
    expect(vm(attrs({ media_content_id: 'media-source://tts/tts.x?message=a' }))).toMatchObject({ origin: 'Text-to-Speech' });
    expect(vm(attrs({ source: 'HDMI 1' }))).toMatchObject({ origin: 'HDMI 1' });
    expect(vm(attrs({}))).toMatchObject({ origin: null });
    expect(vm(attrs({ app_name: 'Spotify', media_artist: 'M83' }))).toMatchObject({ performer: 'M83', origin: 'Spotify' });
  });

  it('offers play only when there is something to resume', () => {
    const at = (state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ ...fixtures.mediaPlaying, state, attributes: { supported_features: 21437, ...attributes } });
    for (const state of ['idle', 'off', 'standby']) expect(vm(at(state))).toMatchObject({ canPlay: false });
    expect(vm(at('idle', { media_title: 'Titel' }))).toMatchObject({ canPlay: true });
    expect(vm(at('off', { media_content_id: 'x' }))).toMatchObject({ canPlay: true });
    expect(vm(at('paused'))).toMatchObject({ canPlay: true });
    expect(vm(at('on'))).toMatchObject({ canPlay: true });
  });

  it('reads what is playing and the controls', () => {
    expect(vm(fixtures.mediaPlaying)).toMatchObject({ title: 'Midnight City', artist: 'M83', playing: true, canPrevious: true, canPlay: true, canNext: true, volume: 40 });
  });

  it('hides what the player cannot do', () => {
    expect(vm(fixtures.mediaBare)).toMatchObject({ canPrevious: false, canPlay: false, canNext: false, canVolumeSet: false, canMute: false, sources: [] });
  });

  it('offers sources only with the feature', () => {
    expect(vm(fixtures.mediaSources).sources).toEqual(['Wohnzimmer', 'Küche', 'Hobbyraum']);
    const without = { ...fixtures.mediaSources, attributes: { ...fixtures.mediaSources.attributes, supported_features: 0 } };
    expect(vm(without).sources).toEqual([]);
  });

  it('sends volume as a fraction and flips mute', () => {
    expect(mediaCommands.volume('m.a', 35).data).toEqual({ volume_level: 0.35 });
    expect(mediaCommands.mute('m.a', true).data).toEqual({ is_volume_muted: false });
  });

  it('does not send what the player cannot do', async () => {
    const port = new MockHass([fixtures.mediaBare]);
    expect(await executeCommand(port, mediaCommands.source('media_player.bare', 'x'))).toBe('unsupported');
    expect(await executeCommand(port, mediaCommands.play('media_player.bare', { name: 'a', media_id: 'b', media_type: 'music' }))).toBe('unsupported');
  });

  it('validates stations and defaults the type', () => {
    expect(parseStations([{ name: 'A', media_id: 'u' }, { name: '', media_id: 'u' }, 'x', { name: 'B' }])).toEqual([{ name: 'A', media_id: 'u', media_type: 'music' }]);
    expect(parseStations('nope')).toEqual([]);
  });

  it('lists the main player first among the targets', () => {
    expect(vm(fixtures.mediaPlaying, { roles: { target_2: 'media_player.kitchen' } }, [fixtures.mediaKitchen]).targets).toEqual([
      { id: 'media_player.speaker', name: 'Wohnzimmer' },
      { id: 'media_player.kitchen', name: 'Küche' },
    ]);
  });

  it('plays a station on the given target', () => {
    expect(mediaCommands.play('media_player.kitchen', { name: 'A', media_id: 'u', media_type: 'music' })).toMatchObject({ entityId: 'media_player.kitchen', data: { media_content_id: 'u', media_content_type: 'music' } });
  });

  it('uses Samsung keys unless configured otherwise', () => {
    expect(vm(fixtures.tv).keys).toEqual(DEFAULT_KEYS);
    expect(vm(fixtures.tv, { extras: { remote_keys: { up: 'DPAD_UP', unknown: 'x', down: 7 } } }).keys).toMatchObject({ up: 'DPAD_UP', down: 'KEY_DOWN' });
    expect(mediaCommands.key('remote.tv', 'KEY_UP')).toEqual({ domain: 'remote', service: 'send_command', entityId: 'remote.tv', data: { command: 'KEY_UP' } });
  });
});

const vmOf = <T>(widget: { toViewModel: (...args: never[]) => T }, entity: HassEntity, overrides: Partial<CardConfig> = {}, others: HassEntity[] = []): T => {
  const port = new MockHass([entity, ...others]);
  const call = widget.toViewModel as unknown as (...args: unknown[]) => T;
  return call(normalizeEntity(port, entity.entity_id), { ...config, ...overrides, roles: { main: entity.entity_id, ...overrides.roles } }, port);
};

describe('weather', () => {
  it('shows real values and hides missing attributes', () => {
    const vm = vmOf(weatherWidget, fixtures.weather);
    expect(vm).toMatchObject({ temperature: 12, unit: '°C', condition: 'partlycloudy' });
    expect(vm.rows.map((row) => row.label)).toEqual(['humidity', 'cloud_coverage', 'wind']);
  });

  it('builds forecast days and skips broken entries', () => {
    const days = forecastDays([{ datetime: '2026-11-10T12:00:00+00:00', condition: 'sunny', temperature: 14, templow: 6 }, { datetime: 'nope' }], 'de');
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ condition: 'sunny', high: 14, low: 6 });
  });

  it('calls the forecast service with a response', async () => {
    let sent: unknown;
    const port = createHassPort({ states: {}, callService: async () => undefined, callWS: async (message) => { sent = message; return { response: { 'weather.a': { forecast: [{ datetime: 'x' }] } } }; } });
    expect(await port.fetchForecast('weather.a', 'daily')).toEqual([{ datetime: 'x' }]);
    expect(sent).toMatchObject({ type: 'call_service', service: 'get_forecasts', service_data: { type: 'daily' }, return_response: true });
  });
});

describe('system', () => {
  it('lists only metrics that exist', () => {
    const vm = vmOf(systemWidget, fixtures.containerUp, { roles: { cpu: 'sensor.processor_use', memory: 'sensor.gone' } }, [fixtures.cpu]);
    expect(vm.rows).toEqual([{ label: 'Status', value: 'on', ok: true }, { label: 'CPU', value: '12', ok: null }]);
  });

  it('marks stopped containers', () => {
    const vm = vmOf(systemWidget, fixtures.containerUp, { variant: 'docker_status', extras: { containers: [{ name: 'A', status: 'binary_sensor.docker_z2m' }] } }, [fixtures.containerDown]);
    expect(vm.rows.at(-1)).toEqual({ label: 'A', value: 'off', ok: false });
  });

  it('validates containers', () => {
    expect(parseContainers([{ name: 'A', status: 'binary_sensor.a', cpu: 3 }, { status: 'x' }, 1])).toEqual([{ name: 'A', status: 'binary_sensor.a' }]);
  });

  it('has no commands at all', () => {
    expect(Object.keys(systemWidget)).not.toContain('commands');
  });
});

describe('appliance', () => {
  it('offers only what the vacuum can do', () => {
    expect(vmOf(applianceWidget, fixtures.vacuumFull)).toMatchObject({ kind: 'vacuum', canStart: true, canPause: true, canReturn: true, fanSpeed: 'Standard' });
    expect(vmOf(applianceWidget, fixtures.vacuum)).toMatchObject({ canStart: true, canPause: false, fanSpeeds: [] });
  });

  it('checks vacuum commands against the features', async () => {
    const port = new MockHass([fixtures.vacuum]);
    expect(await executeCommand(port, applianceCommands.pause('vacuum.robot'))).toBe('unsupported');
    expect(await executeCommand(port, applianceCommands.start('vacuum.robot'))).toBe('sent');
  });

  it('reads the washer and its program', () => {
    expect(vmOf(applianceWidget, fixtures.washerMinutes, { variant: 'washer', roles: { program: 'sensor.washer_program' } }, [fixtures.washerProgram])).toEqual({ kind: 'washer', label: '47', minutes: 47, program: 'Baumwolle 40°' });
  });

  it('lists parts', () => {
    expect(vmOf(applianceWidget, fixtures.filterMain, { variant: 'filter', roles: { part_2: 'sensor.brush' } }, [fixtures.filterBrush])).toMatchObject({ kind: 'filter', parts: [{ name: 'Filter', percent: 80 }, { name: 'Hauptbürste', percent: 30 }] });
  });
});

describe('inputs', () => {
  it('reads selects and numbers', () => {
    expect(vmOf(inputWidget, fixtures.inputSelect)).toMatchObject({ kind: 'select', value: 'Gäste', options: ['Normal', 'Gäste', 'Urlaub'] });
    expect(vmOf(inputWidget, fixtures.inputNumber)).toMatchObject({ kind: 'number', value: 50, min: 0, max: 100, step: 5 });
  });

  it('keeps password fields masked', () => {
    expect(vmOf(inputWidget, fixtures.inputPassword)).toMatchObject({ kind: 'text', password: true });
    expect(vmOf(inputWidget, fixtures.inputText)).toMatchObject({ password: false });
  });

  it('picks the matching date input', () => {
    expect(vmOf(inputWidget, fixtures.inputDate)).toMatchObject({ inputType: 'date', value: '2026-11-09' });
    expect(vmOf(inputWidget, fixtures.inputTime)).toMatchObject({ inputType: 'time', value: '07:00' });
    expect(vmOf(inputWidget, fixtures.inputBoth)).toMatchObject({ inputType: 'datetime-local', value: '2026-11-09T07:00' });
  });

  it('reads timers', () => {
    expect(vmOf(inputWidget, fixtures.timerIdle)).toMatchObject({ kind: 'timer', running: false, seconds: 300, finishesAt: null });
    expect(vmOf(inputWidget, fixtures.timerPaused)).toMatchObject({ seconds: 210 });
  });

  it('formats durations', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3700)).toBe('1:01:40');
    expect(formatDuration(-5)).toBe('00:00');
    expect(parseDuration('0:05:00')).toBe(300);
    expect(parseDuration('x')).toBe(0);
  });

  it('sends to the domain of the entity', () => {
    expect(inputCommands.select('select.a', 'b')).toMatchObject({ domain: 'select', service: 'select_option', data: { option: 'b' } });
    expect(inputCommands.setValue('number.a', 3)).toMatchObject({ domain: 'number', data: { value: 3 } });
    expect(inputCommands.press('input_button.a')).toMatchObject({ domain: 'input_button', service: 'press' });
    expect(inputCommands.datetime('input_datetime.a', 'datetime-local', '2026-11-09T07:00').data).toEqual({ datetime: '2026-11-09 07:00:00' });
  });
});
