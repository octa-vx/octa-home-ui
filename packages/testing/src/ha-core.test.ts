import { describe, expect, it } from 'vitest';
import {
  brightnessToPercent,
  climateCapabilities,
  createHassPort,
  executeCommand,
  fanCapabilities,
  lightCapabilities,
  normalizeEntity,
  supports,
  toDatetimeLocal,
  translate,
  type HassEntity,
  type HassLike,
} from '@octa/ha-core';
import { fixtures, matrixCases, MockHass, portForCase } from './index.ts';

const all = Object.values(fixtures) as HassEntity[];

describe.each(all.map((item) => [item.entity_id, item] as const))('state matrix for %s', (id, base) => {
  it.each(matrixCases)('%s', (matrixCase) => {
    const result = normalizeEntity(portForCase(base, matrixCase), id);
    const expected = matrixCase === 'as_given' ? 'ok' : matrixCase;
    expect(result.status).toBe(expected);
    if (matrixCase !== 'as_given') {
      expect(result.active).toBe(false);
      expect(result.alert).toBe(false);
    }
    expect(result.stateLabel).not.toBe('');
  });
});

describe('normalizeEntity', () => {
  it.each([
    ['light.a', 'on', true],
    ['light.a', 'off', false],
    ['cover.a', 'closed', false],
    ['cover.a', 'opening', true],
    ['lock.a', 'locked', false],
    ['lock.a', 'unlocked', true],
    ['climate.a', 'off', false],
    ['climate.a', 'heat', true],
    ['media_player.a', 'idle', false],
    ['media_player.a', 'playing', true],
    ['sensor.a', '21', false],
  ])('%s in state %s has active=%s', (id, state, active) => {
    expect(normalizeEntity(new MockHass([{ entity_id: id, state, attributes: {} }]), id).active).toBe(active);
  });

  it.each([fixtures.lockJammed, fixtures.alarmTriggered])('flags %o as alert', (entity) => {
    expect(normalizeEntity(new MockHass([entity]), entity.entity_id).alert).toBe(true);
  });

  it('never reports a jammed lock as unlocked-and-fine by name', () => {
    const result = normalizeEntity(new MockHass([fixtures.lockJammed]), fixtures.lockJammed.entity_id);
    expect(result.stateLabel).toBe('jammed');
  });
});

describe('capabilities', () => {
  it('reads light color modes', () => {
    expect(lightCapabilities(fixtures.lightOnOff)).toMatchObject({ brightness: false, color: false, colorTemp: false });
    expect(lightCapabilities(fixtures.lightDimmable)).toMatchObject({ brightness: true, color: false });
    expect(lightCapabilities(fixtures.lightColor)).toEqual({ brightness: true, colorTemp: true, color: true, effects: ['rainbow'] });
  });

  it('offers only the HVAC modes the device reports', () => {
    expect(climateCapabilities(fixtures.climate).hvacModes).toEqual(['off', 'heat']);
  });

  it('distinguishes percentage fans from preset fans', () => {
    expect(fanCapabilities(fixtures.fanPercent)).toMatchObject({ percentage: true, presets: [] });
    expect(fanCapabilities(fixtures.fanPreset)).toMatchObject({ percentage: false, presets: ['eco', 'boost'] });
  });

  it('treats absent flags as unsupported', () => {
    expect(supports(fixtures.switch, 'cover', 'OPEN')).toBe(false);
  });
});

describe('executeCommand', () => {
  const unlock = { domain: 'lock', service: 'unlock', entityId: fixtures.lock.entity_id };

  it('holds unlocking until confirmed', async () => {
    const port = new MockHass([fixtures.lock]);
    expect(await executeCommand(port, unlock)).toBe('needs_confirmation');
    expect(port.calls).toHaveLength(0);
    expect(await executeCommand(port, unlock, { confirmed: true })).toBe('sent');
    expect(port.calls).toHaveLength(1);
  });

  it('locks without confirmation', async () => {
    const port = new MockHass([fixtures.lock]);
    expect(await executeCommand(port, { domain: 'lock', service: 'lock', entityId: fixtures.lock.entity_id })).toBe('sent');
  });

  it('requires confirmation to disarm an alarm', async () => {
    const port = new MockHass([fixtures.alarm]);
    expect(await executeCommand(port, { domain: 'alarm_control_panel', service: 'alarm_disarm', entityId: fixtures.alarm.entity_id })).toBe('needs_confirmation');
  });

  it('asks before opening a garage but not an ordinary blind', async () => {
    const port = new MockHass([fixtures.coverGarage, fixtures.coverPosition]);
    expect(await executeCommand(port, { domain: 'cover', service: 'open_cover', entityId: fixtures.coverGarage.entity_id })).toBe('needs_confirmation');
    expect(await executeCommand(port, { domain: 'cover', service: 'close_cover', entityId: fixtures.coverGarage.entity_id })).toBe('sent');
    expect(await executeCommand(port, { domain: 'cover', service: 'open_cover', entityId: fixtures.coverPosition.entity_id })).toBe('sent');
  });

  it('refuses a feature the device lacks and tells the user', async () => {
    const port = new MockHass([fixtures.switch]);
    const result = await executeCommand(port, {
      domain: 'cover',
      service: 'stop_cover',
      entityId: fixtures.switch.entity_id,
      requires: { domain: 'cover', feature: 'STOP' },
    });
    expect(result).toBe('unsupported');
    expect(port.calls).toHaveLength(0);
    expect(port.notifications).toHaveLength(1);
  });

  it('blocks unavailable and missing entities', async () => {
    const command = { domain: 'light', service: 'toggle', entityId: fixtures.lightOnOff.entity_id };
    expect(await executeCommand(portForCase(fixtures.lightOnOff, 'unavailable'), command)).toBe('unavailable');
    expect(await executeCommand(portForCase(fixtures.lightOnOff, 'missing'), command)).toBe('missing');
  });

  it('still allows operation in state unknown', async () => {
    const command = { domain: 'light', service: 'toggle', entityId: fixtures.lightOnOff.entity_id };
    expect(await executeCommand(portForCase(fixtures.lightOnOff, 'unknown'), command)).toBe('sent');
  });

  it('reports failures to the user', async () => {
    const port = new MockHass([fixtures.lightOnOff]);
    port.failNextCall = true;
    expect(await executeCommand(port, { domain: 'light', service: 'toggle', entityId: fixtures.lightOnOff.entity_id })).toBe('failed');
    expect(port.notifications[0]).toContain('fehlgeschlagen');
  });
});

describe('createHassPort', () => {
  const baseHass = (extra: Partial<HassLike> = {}): HassLike => ({
    states: { 'light.a': { entity_id: 'light.a', state: 'unavailable', attributes: { friendly_name: 'Lampe' } } },
    language: 'de',
    callService: async () => undefined,
    ...extra,
  });
  const entity = baseHass().states['light.a'] as HassEntity;

  it('falls back when formatters do not exist', () => {
    const port = createHassPort(baseHass());
    expect(port.formatName(entity)).toBe('Lampe');
    expect(port.formatState(entity)).toBe('Nicht verfügbar');
  });

  it('survives a throwing formatter', () => {
    const port = createHassPort(baseHass({ formatEntityName: () => { throw new Error('boom'); } }));
    expect(port.formatName(entity)).toBe('Lampe');
  });

  it('prefers the frontend formatters', () => {
    const port = createHassPort(baseHass({ formatEntityName: () => 'Aus HA', formatEntityState: () => 'Status HA' }));
    expect(port.formatName(entity)).toBe('Aus HA');
    expect(port.formatState(entity)).toBe('Status HA');
  });

  it('passes the entity as a target', async () => {
    const seen: unknown[] = [];
    const port = createHassPort(baseHass({ callService: async (...args) => { seen.push(args); } }));
    await port.callService('light', 'toggle', {}, 'light.a');
    expect(seen).toEqual([['light', 'toggle', {}, { entity_id: 'light.a' }]]);
  });
});

describe('format and i18n', () => {
  it('produces the separator datetime-local requires', () => {
    expect(toDatetimeLocal('2026-11-09 08:15:30')).toBe('2026-11-09T08:15');
    expect(toDatetimeLocal('garbage')).toBe('');
  });

  it('scales brightness', () => {
    expect(brightnessToPercent(255)).toBe(100);
    expect(brightnessToPercent(undefined)).toBe(0);
  });

  it('translates German and falls back to English', () => {
    expect(translate('de-AT', 'unknown')).toBe('Unbekannt');
    expect(translate('fr', 'unknown')).toBe('Unknown');
    expect(translate('de', 'missing', { id: 'light.a' })).toBe('Entity fehlt: light.a');
  });
});
