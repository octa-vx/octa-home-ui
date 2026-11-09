import { html, nothing, type TemplateResult } from 'lit';
import { brightnessToPercent, lightCapabilities, translate, type HassEntity, type HassPort, type ServiceCommand } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon } from './icons.ts';

export interface LightMember {
  name: string;
  on: boolean;
}

export interface LightViewModel {
  id: string;
  variant: string;
  on: boolean;
  label: string;
  /** `null` when the light cannot be dimmed. */
  brightness: number | null;
  /** Current color as hex, `null` when the light has no color. */
  color: string | null;
  /** `null` when the light has no adjustable white. */
  kelvin: { value: number; known: boolean; min: number; max: number } | null;
  members: LightMember[];
}

export const SWATCHES = ['#ff4d4d', '#ffb347', '#ffe066', '#5ce1e6', '#4d7cff', '#c77dff', '#ffffff'];

const FALLBACK_COLOR = '#ffffff';
const KELVIN_STEP = 100;

export function rgbToHex(rgb: unknown): string | null {
  if (!Array.isArray(rgb) || rgb.length < 3 || !rgb.slice(0, 3).every((channel) => typeof channel === 'number')) return null;
  return `#${(rgb.slice(0, 3) as number[]).map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const numeric = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export const lightCommands = {
  toggle: (id: string, on: boolean): ServiceCommand => ({ domain: 'light', service: on ? 'turn_off' : 'turn_on', entityId: id }),
  brightness: (id: string, percent: number): ServiceCommand =>
    percent > 0
      ? { domain: 'light', service: 'turn_on', entityId: id, data: { brightness_pct: percent } }
      : { domain: 'light', service: 'turn_off', entityId: id },
  color: (id: string, hex: string): ServiceCommand => ({ domain: 'light', service: 'turn_on', entityId: id, data: { rgb_color: hexToRgb(hex) } }),
  temperature: (id: string, kelvin: number): ServiceCommand => ({ domain: 'light', service: 'turn_on', entityId: id, data: { color_temp_kelvin: kelvin } }),
};

function members(entity: HassEntity | undefined, port: HassPort): LightMember[] {
  const ids = entity?.attributes.entity_id;
  if (!Array.isArray(ids)) return [];
  return ids
    .filter((id): id is string => typeof id === 'string')
    .map((id) => port.getEntity(id))
    .filter((member): member is HassEntity => member !== undefined)
    .map((member) => ({ name: port.formatName(member), on: member.state === 'on' }));
}

function toggle(vm: LightViewModel, context: RenderContext): TemplateResult {
  return html`<octa-switch
    .appearance=${context.appearance}
    .checked=${vm.on}
    .disabled=${context.disabled}
    .label=${vm.id}
    @octa-change=${() => context.run(lightCommands.toggle(vm.id, vm.on))}
  ></octa-switch>`;
}

function brightnessSlider(vm: LightViewModel, context: RenderContext, value: number): TemplateResult {
  const send = (event: CustomEvent<{ value: number }>): void => context.run(lightCommands.brightness(vm.id, event.detail.value));
  return html`<octa-slider
    .appearance=${context.appearance}
    .label=${translate(context.language, 'brightness')}
    unit="%"
    .min=${0}
    .max=${100}
    .value=${value}
    .disabled=${context.disabled}
    @octa-input=${send}
    @octa-change=${send}
  ></octa-slider>`;
}

function renderTile(vm: LightViewModel, context: RenderContext): TemplateResult {
  return html`<div class="stack">
    <div class="row">
      <span class=${vm.on ? 'glow' : 'muted'}>${icon('lightbulb', 24)}</span>
      ${toggle(vm, context)}
    </div>
    <div class="small">${vm.label}</div>
    ${vm.brightness === null ? nothing : brightnessSlider(vm, context, vm.brightness)}
  </div>`;
}

function renderSlider(vm: LightViewModel, context: RenderContext): TemplateResult {
  if (vm.brightness === null) return html`<div class="small">${vm.label}</div>`;
  return html`<div class="stack">
    <div class="big">${vm.brightness}%</div>
    ${brightnessSlider(vm, context, vm.brightness)}
  </div>`;
}

function renderColor(vm: LightViewModel, context: RenderContext): TemplateResult {
  if (vm.color === null) return html`<div class="small">${vm.label}</div>`;
  const send = (hex: string): void => context.run(lightCommands.color(vm.id, hex));
  return html`<div class="led">
    <input
      type="color"
      aria-label=${translate(context.language, 'color', { value: vm.color })}
      .value=${vm.color}
      ?disabled=${context.disabled}
      @change=${(event: Event) => send((event.target as HTMLInputElement).value)}
    />
    <div class="swatches">
      ${SWATCHES.map(
        (color) =>
          html`<button
            type="button"
            aria-label=${translate(context.language, 'color', { value: color })}
            style="background:${color}"
            ?disabled=${context.disabled}
            @click=${() => send(color)}
          ></button>`,
      )}
    </div>
  </div>`;
}

function renderTemperature(vm: LightViewModel, context: RenderContext): TemplateResult {
  const { kelvin } = vm;
  if (kelvin === null) return html`<div class="small">${vm.label}</div>`;
  const send = (event: CustomEvent<{ value: number }>): void => context.run(lightCommands.temperature(vm.id, event.detail.value));
  return html`<div class="stack">
    <div class="big">${kelvin.known ? `${kelvin.value} K` : '–'}</div>
    <octa-slider
      track="temperature"
      .appearance=${context.appearance}
      .label=${translate(context.language, 'color_temperature')}
      unit="K"
      .min=${kelvin.min}
      .max=${kelvin.max}
      .step=${KELVIN_STEP}
      .value=${kelvin.value}
      .disabled=${context.disabled}
      @octa-change=${send}
    ></octa-slider>
    <div class="ends tiny"><span>${translate(context.language, 'warm_white')}</span><span>${translate(context.language, 'cool_white')}</span></div>
  </div>`;
}

function renderGroup(vm: LightViewModel, context: RenderContext): TemplateResult {
  return html`<div class="stack">
    <div class="row">
      <span class="body">${vm.members.length > 0 ? translate(context.language, 'lamps', { count: String(vm.members.length) }) : vm.label}</span>
      ${toggle(vm, context)}
    </div>
    ${vm.members.length === 0
      ? nothing
      : html`<div class="chips">
          ${vm.members.map((member) => html`<span class=${member.on ? 'chip on' : 'chip'}>${icon('lightbulb', 12)}${member.name}</span>`)}
        </div>`}
  </div>`;
}

const RENDERERS: Record<string, (vm: LightViewModel, context: RenderContext) => TemplateResult> = {
  tile: renderTile,
  slider: renderSlider,
  color: renderColor,
  temperature: renderTemperature,
  group: renderGroup,
};

export const lightWidget = defineWidget<LightViewModel>({
  element: 'octa-light-card',
  name: 'Octa Home UI Licht',
  description: 'Licht mit Schalter, Helligkeit, Farbe, Farbtemperatur oder als Gruppe',
  spec: {
    variants: ['tile', 'slider', 'color', 'temperature', 'group'],
    defaultVariant: 'tile',
    roles: { main: { domains: ['light'], required: true } },
  },
  columns: 6,
  toViewModel(target, config, port) {
    const { entity } = target;
    const capabilities = entity ? lightCapabilities(entity) : undefined;
    const attributes = entity?.attributes ?? {};
    const dimmable = capabilities?.brightness === true;
    const percent = target.active ? brightnessToPercent(attributes.brightness) : 0;
    const known = typeof attributes.color_temp_kelvin === 'number';
    const min = numeric(attributes.min_color_temp_kelvin, 2000);
    return {
      id: target.id,
      variant: config.variant,
      on: target.active,
      brightness: dimmable ? percent : null,
      label: dimmable && target.active ? `${percent} %` : target.stateLabel,
      color: capabilities?.color === true ? (rgbToHex(attributes.rgb_color) ?? FALLBACK_COLOR) : null,
      kelvin: capabilities?.colorTemp === true ? { value: numeric(attributes.color_temp_kelvin, min), known, min, max: numeric(attributes.max_color_temp_kelvin, 6500) } : null,
      members: members(entity, port),
    };
  },
  render(vm, context) {
    return (RENDERERS[vm.variant] ?? renderTile)(vm, context);
  },
});
