import { translate } from './i18n.ts';

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
}

export interface HistoryPoint {
  /** Milliseconds since the epoch. */
  time: number;
  value: number;
}

export interface ForecastEntry {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
}

/** The only view of Home Assistant that widgets get, so they can run without a live instance. */
export interface HassPort {
  readonly language: string;
  getEntity(entityId: string): HassEntity | undefined;
  callService(domain: string, service: string, data: Record<string, unknown>, entityId: string): Promise<void>;
  formatName(entity: HassEntity): string;
  formatState(entity: HassEntity): string;
  notify(message: string): void;
  hasService(domain: string, service: string): boolean;
  /** Numeric readings of the last hours, oldest first. Empty when there is no history. */
  fetchHistory(entityId: string, hours: number): Promise<HistoryPoint[]>;
  /** Upcoming periods of a weather entity. Empty when the entity offers no forecast. */
  fetchForecast(entityId: string, type: 'daily' | 'twice_daily' | 'hourly'): Promise<ForecastEntry[]>;
}

/** The part of the frontend `hass` object this adapter touches. Formatters are optional on purpose. */
export interface HassLike {
  states: Record<string, HassEntity | undefined>;
  language?: string;
  callService(domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string }): Promise<unknown>;
  services?: Record<string, Record<string, unknown> | undefined>;
  callWS?: (message: Record<string, unknown>) => Promise<unknown>;
  formatEntityName?: (entity: HassEntity, name: undefined) => string;
  formatEntityState?: (entity: HassEntity) => string;
}

function fallbackName(entity: HassEntity): string {
  const friendly = entity.attributes.friendly_name;
  return typeof friendly === 'string' && friendly !== '' ? friendly : entity.entity_id;
}

function fallbackState(language: string, entity: HassEntity): string {
  if (entity.state === 'unavailable' || entity.state === 'unknown') return translate(language, entity.state);
  return entity.state;
}

function attempt(format: (() => string) | undefined, fallback: string): string {
  if (!format) return fallback;
  try {
    return format() || fallback;
  } catch {
    return fallback;
  }
}

export function createHassPort(hass: HassLike, host?: EventTarget): HassPort {
  const language = hass.language ?? 'en';
  return {
    language,
    getEntity: (entityId) => hass.states[entityId],
    callService: async (domain, service, data, entityId) => {
      await hass.callService(domain, service, data, { entity_id: entityId });
    },
    formatName: (entity) =>
      attempt(hass.formatEntityName && (() => hass.formatEntityName!(entity, undefined)), fallbackName(entity)),
    formatState: (entity) =>
      attempt(hass.formatEntityState && (() => hass.formatEntityState!(entity)), fallbackState(language, entity)),
    hasService: (domain, service) => hass.services?.[domain]?.[service] !== undefined,
    fetchForecast: async (entityId, type) => {
      if (!hass.callWS) return [];
      const reply = (await hass.callWS({
        type: 'call_service',
        domain: 'weather',
        service: 'get_forecasts',
        service_data: { type },
        target: { entity_id: entityId },
        return_response: true,
      })) as { response?: Record<string, { forecast?: ForecastEntry[] } | undefined> };
      return reply.response?.[entityId]?.forecast ?? [];
    },
    fetchHistory: async (entityId, hours) => {
      if (!hass.callWS) return [];
      const end = Date.now();
      const result = (await hass.callWS({
        type: 'history/history_during_period',
        start_time: new Date(end - hours * 3600000).toISOString(),
        end_time: new Date(end).toISOString(),
        entity_ids: [entityId],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      })) as Record<string, { s: string; lu: number }[] | undefined>;
      return (result[entityId] ?? [])
        .map((point) => ({ time: point.lu * 1000, value: Number(point.s) }))
        .filter((point) => Number.isFinite(point.value));
    },
    notify: (message) => {
      host?.dispatchEvent(new CustomEvent('hass-notification', { bubbles: true, composed: true, detail: { message } }));
    },
  };
}
