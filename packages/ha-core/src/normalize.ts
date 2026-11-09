import { translate } from './i18n.ts';
import type { HassEntity, HassPort } from './port.ts';

export type EntityStatus = 'ok' | 'unavailable' | 'unknown' | 'missing';

export interface NormalizedEntity {
  id: string;
  domain: string;
  status: EntityStatus;
  /** Device is on, open, playing and so on. Always false unless status is `ok`. */
  active: boolean;
  /** State needs attention, such as a jammed lock or a triggered alarm. */
  alert: boolean;
  name: string;
  stateLabel: string;
  entity?: HassEntity;
}

const INACTIVE_BY_DOMAIN: Record<string, readonly string[]> = {
  light: ['off'],
  switch: ['off'],
  input_boolean: ['off'],
  binary_sensor: ['off'],
  fan: ['off'],
  humidifier: ['off'],
  siren: ['off'],
  remote: ['off'],
  climate: ['off'],
  water_heater: ['off'],
  cover: ['closed'],
  valve: ['closed'],
  lock: ['locked', 'locking'],
  alarm_control_panel: ['disarmed'],
  media_player: ['off', 'standby', 'idle'],
  vacuum: ['docked', 'idle'],
  person: ['not_home'],
  device_tracker: ['not_home'],
};

const ALERT_BY_DOMAIN: Record<string, readonly string[]> = {
  lock: ['jammed'],
  alarm_control_panel: ['triggered'],
  vacuum: ['error'],
};

export const domainOf = (entityId: string): string => entityId.split('.', 1)[0] ?? '';

function isActive(domain: string, state: string): boolean {
  const inactive = INACTIVE_BY_DOMAIN[domain];
  return inactive !== undefined && !inactive.includes(state);
}

export function normalizeEntity(port: HassPort, entityId: string): NormalizedEntity {
  const domain = domainOf(entityId);
  const entity = port.getEntity(entityId);
  if (!entity) {
    return {
      id: entityId,
      domain,
      status: 'missing',
      active: false,
      alert: false,
      name: entityId,
      stateLabel: translate(port.language, 'missing', { id: entityId }),
    };
  }

  const status: EntityStatus = entity.state === 'unavailable' || entity.state === 'unknown' ? entity.state : 'ok';
  return {
    id: entityId,
    domain,
    status,
    active: status === 'ok' && isActive(domain, entity.state),
    alert: status === 'ok' && (ALERT_BY_DOMAIN[domain]?.includes(entity.state) ?? false),
    name: port.formatName(entity),
    stateLabel: port.formatState(entity),
    entity,
  };
}
