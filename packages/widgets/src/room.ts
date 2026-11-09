import { html, nothing, type TemplateResult } from 'lit';
import { normalizeEntity, translate, type HassPort, type MessageKey } from '@octa/ha-core';
import { climateCommands, climateWidget, stepTarget } from './climate.ts';
import { contactTiles, parseEntries, parseSensors, renderContactTiles, type ContactTile } from './contacts.ts';
import { defineWidget, type RenderContext } from './define.ts';
import { icon } from './icons.ts';
import { iconButton, mediaCommands, mediaWidget } from './media.ts';
import { switchCommands } from './switch.ts';
import type { CardConfig } from '@octa/schema';

const LIGHT_ID = /^(light|switch)\.[a-z0-9_]+$/;

export interface RoomLight {
  id: string;
  name: string;
  on: boolean;
  available: boolean;
}

export interface RoomClimate {
  id: string;
  label: string;
  current: number | null;
  target: number | null;
  lower: number | null;
  higher: number | null;
  available: boolean;
}

export interface RoomMedia {
  id: string;
  text: string;
  playing: boolean;
  canPlay: boolean;
  available: boolean;
}

export interface RoomViewModel {
  climate: RoomClimate | null;
  lights: RoomLight[];
  windows: ContactTile[];
  media: RoomMedia | null;
}

export const parseLights = (value: unknown): { entity: string; name?: string }[] => parseEntries(value, LIGHT_ID);

function roomClimate(config: CardConfig, port: HassPort): RoomClimate | null {
  const id = config.roles.main;
  if (!id) return null;
  const target = normalizeEntity(port, id);
  if (target.status === 'missing') return null;
  const vm = climateWidget.toViewModel(target, { ...config, variant: 'buttons' }, port);
  return { id, label: target.stateLabel, current: vm.current, target: vm.target, lower: stepTarget(vm, -1), higher: stepTarget(vm, 1), available: target.status === 'ok' };
}

function roomMedia(config: CardConfig, port: HassPort): RoomMedia | null {
  const id = config.roles.media;
  if (!id) return null;
  const target = normalizeEntity(port, id);
  if (target.status === 'missing') return null;
  const vm = mediaWidget.toViewModel(target, { ...config, variant: 'media', roles: { main: id } }, port);
  return { id, text: vm.title || vm.label, playing: vm.playing, canPlay: vm.canPlay, available: target.status === 'ok' };
}

function renderClimate(climate: RoomClimate, context: RenderContext): TemplateResult {
  const step = (label: MessageKey, name: 'plus' | 'minus', next: number | null): TemplateResult => html`<octa-button
    class="icon"
    .appearance=${context.appearance}
    .label=${translate(context.language, label)}
    .disabled=${!climate.available || next === null}
    .busy=${context.busy}
    @click=${() => climate.available && next !== null && context.run(climateCommands.temperature(climate.id, next))}
    >${icon(name, 18)}</octa-button
  >`;
  return html`<div class="room-climate">
    ${step('decrease', 'minus', climate.lower)}
    <div class="strong room-target">${translate(context.language, 'room_target', { value: String(climate.target) })}</div>
    ${step('increase', 'plus', climate.higher)}
  </div>`;
}

/** Status first: what the room is like right now, before anything that changes it. */
function renderHead(vm: RoomViewModel): TemplateResult | typeof nothing {
  if (!vm.climate && vm.windows.length === 0) return nothing;
  const { climate } = vm;
  return html`<div class="room-head">
    ${climate ? html`<div class="big">${climate.current === null ? climate.label : `${climate.current}°`}</div>` : nothing}
    ${vm.windows.length > 0 ? renderContactTiles(vm.windows, 24) : nothing}
  </div>`;
}

function renderMedia(media: RoomMedia, context: RenderContext): TemplateResult {
  return html`<div class="row room-media">
    <span class="small with-icon ellipsis">${icon('volume', 16)}${media.text}</span>
    ${iconButton(context, media.playing ? 'pause' : 'play', media.playing ? 'pause' : 'play', 16, mediaCommands.playPause(media.id), media.playing, !media.canPlay || !media.available)}
  </div>`;
}

function render(vm: RoomViewModel, context: RenderContext): TemplateResult {
  if (!vm.climate && !vm.media && vm.lights.length === 0 && vm.windows.length === 0) return html`<div class="small">${translate(context.language, 'room_empty')}</div>`;
  return html`<div class="stack room">
    ${renderHead(vm)}
    ${vm.climate && vm.climate.target !== null ? renderClimate(vm.climate, context) : nothing}
    ${vm.lights.length > 0
      ? html`<div class="room-lights">
          ${vm.lights.map(
            (light) => html`<octa-button class="pill" .appearance=${context.appearance} .active=${light.on} .disabled=${!light.available} @click=${() => light.available && context.run(switchCommands.toggle(light.id, light.on))}>
              <span class="room-light-label">${icon('lightbulb', 16)}<span class="ellipsis">${light.name}</span></span>
            </octa-button>`,
          )}
        </div>`
      : nothing}
    ${vm.media ? renderMedia(vm.media, context) : nothing}
  </div>`;
}

export const roomWidget = defineWidget<RoomViewModel>({
  element: 'octa-room-card',
  name: 'Octa Home UI Raum',
  description: 'Heizung, Licht, Fenster und Medien eines Raums in einem Block',
  spec: { variants: ['room'], defaultVariant: 'room', roles: { main: { domains: ['climate'] }, media: { domains: ['media_player'] } }, extras: ['lights', 'windows'] },
  columns: 12,
  aggregate: true,
  entityLabel: ['Thermostat', 'Thermostat'],
  defaultTitle: (language) => translate(language, 'room'),
  watch: (config) => [...parseLights(config.extras?.lights), ...parseSensors(config.extras?.windows)].map((item) => item.entity),
  editor: () => [
    { name: 'lights', selector: { entity: { multiple: true, domain: ['light', 'switch'] } } },
    {
      name: 'windows',
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
    return {
      climate: roomClimate(config, port),
      lights: parseLights(config.extras?.lights).map(({ entity, name }) => {
        const target = normalizeEntity(port, entity);
        return { id: entity, name: name ?? target.name, on: target.active, available: target.status === 'ok' };
      }),
      windows: contactTiles(port, parseSensors(config.extras?.windows)),
      media: roomMedia(config, port),
    };
  },
  render,
});
