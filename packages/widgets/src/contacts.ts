import { html, type TemplateResult } from 'lit';
import { normalizeEntity, translate, type HassPort } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon } from './icons.ts';

export interface ContactSensor {
  entity: string;
  name?: string;
}

export interface ContactTile {
  id: string;
  name: string;
  state: 'open' | 'closed' | 'unknown';
  stateLabel: string;
}

export interface ContactsViewModel {
  tiles: ContactTile[];
}

const SENSOR_ID = /^binary_sensor\.[a-z0-9_]+$/;

/** Entries may be a plain entity id or an entity with a name of its own. */
export function parseEntries(value: unknown, pattern: RegExp): ContactSensor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown): ContactSensor[] => {
    if (typeof item === 'string') return pattern.test(item) ? [{ entity: item }] : [];
    if (typeof item !== 'object' || item === null) return [];
    const { entity, name } = item as Record<string, unknown>;
    if (typeof entity !== 'string' || !pattern.test(entity)) return [];
    return [{ entity, ...(typeof name === 'string' && name !== '' ? { name } : {}) }];
  });
}

export const parseSensors = (value: unknown): ContactSensor[] => parseEntries(value, SENSOR_ID);

export function contactTiles(port: HassPort, sensors: ContactSensor[]): ContactTile[] {
  return sensors.map(({ entity, name }) => {
    const target = normalizeEntity(port, entity);
    return { id: entity, name: name ?? target.name, state: target.status === 'ok' ? (target.active ? 'open' : 'closed') : 'unknown', stateLabel: target.stateLabel };
  });
}

export function renderContactTiles(tiles: ContactTile[], iconSize = 28): TemplateResult {
  return html`<div class="contact-grid">
    ${tiles.map(
      (tile) => html`<div class="contact-tile ${tile.state}" role="img" aria-label="${tile.name}: ${tile.stateLabel}" title=${tile.stateLabel}>
        ${icon(tile.state === 'open' ? 'window_open' : 'window_closed', iconSize)}
        <span class="tiny ellipsis">${tile.name}</span>
      </div>`,
    )}
  </div>`;
}

function render(vm: ContactsViewModel, context: RenderContext): TemplateResult {
  if (vm.tiles.length === 0) return html`<div class="small">${translate(context.language, 'no_sensors')}</div>`;
  return renderContactTiles(vm.tiles);
}

export const contactsWidget = defineWidget<ContactsViewModel>({
  element: 'octa-contacts-card',
  name: 'Octa Home UI Fenster und Türen',
  description: 'Beliebig viele Kontakte in einem Block, der Zustand als Icon',
  spec: { variants: ['group'], defaultVariant: 'group', roles: { main: { domains: ['binary_sensor'] } }, extras: ['sensors'] },
  columns: 12,
  aggregate: true,
  defaultTitle: (language) => translate(language, 'windows'),
  watch: (config) => parseSensors(config.extras?.sensors).map((sensor) => sensor.entity),
  editor: () => [
    {
      name: 'sensors',
      selector: {
        object: {
          multiple: true,
          label_field: 'name',
          fields: {
            entity: { label: 'Sensor', required: true, selector: { entity: { domain: ['binary_sensor'] } } },
            name: { label: 'Name', selector: { text: {} } },
          },
        },
      },
    },
  ],
  toViewModel(_target, config, port) {
    const listed = parseSensors(config.extras?.sensors);
    const sensors = config.roles.main ? [{ entity: config.roles.main }, ...listed] : listed;
    return { tiles: contactTiles(port, sensors) };
  },
  render,
});
