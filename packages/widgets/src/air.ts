import { html, nothing, type TemplateResult } from 'lit';
import { fanCapabilities, supports, translate, type ServiceCommand } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';

export interface FanViewModel {
  kind: 'fan';
  id: string;
  on: boolean;
  label: string;
  presets: string[];
  preset: string | null;
  /** Offered speeds in percent, empty when the fan is continuously variable or has no speed. */
  levels: number[];
  /** Current speed in percent, `null` when the fan has no speed control. */
  percentage: number | null;
}

export interface ValveViewModel {
  kind: 'valve';
  id: string;
  on: boolean;
  label: string;
  position: number | null;
  canToggle: boolean;
}

export type AirViewModel = FanViewModel | ValveViewModel;

/** More levels than this do not fit as pills, the card shows a slider instead. */
const MAX_LEVELS = 6;

export const airCommands = {
  fanOff: (id: string): ServiceCommand => ({ domain: 'fan', service: 'turn_off', entityId: id }),
  fanToggle: (id: string, on: boolean): ServiceCommand => ({ domain: 'fan', service: on ? 'turn_off' : 'turn_on', entityId: id }),
  percentage: (id: string, percentage: number): ServiceCommand =>
    percentage > 0
      ? { domain: 'fan', service: 'set_percentage', entityId: id, data: { percentage }, requires: { domain: 'fan', feature: 'SET_SPEED' } }
      : { domain: 'fan', service: 'turn_off', entityId: id },
  preset: (id: string, preset_mode: string): ServiceCommand => ({ domain: 'fan', service: 'set_preset_mode', entityId: id, data: { preset_mode }, requires: { domain: 'fan', feature: 'PRESET_MODE' } }),
  valveToggle: (id: string, open: boolean): ServiceCommand => ({ domain: 'valve', service: open ? 'close_valve' : 'open_valve', entityId: id, requires: { domain: 'valve', feature: open ? 'CLOSE' : 'OPEN' } }),
};

export function fanLevels(step: unknown): number[] {
  if (typeof step !== 'number' || step <= 0) return [];
  const count = Math.round(100 / step);
  if (count > MAX_LEVELS) return [];
  return Array.from({ length: count }, (_, index) => Math.round((index + 1) * step));
}

function pill(context: RenderContext, label: string, active: boolean, command: ServiceCommand): TemplateResult {
  return html`<octa-button
    class="pill"
    .appearance=${context.appearance}
    .active=${active}
    .disabled=${context.disabled}
    .busy=${context.busy}
    @click=${() => !active && !context.disabled && context.run(command)}
    >${label}</octa-button
  >`;
}

function toggle(id: string, on: boolean, context: RenderContext, command: ServiceCommand): TemplateResult {
  return html`<octa-switch .appearance=${context.appearance} .checked=${on} .disabled=${context.disabled} .label=${id} @octa-change=${() => context.run(command)}></octa-switch>`;
}

function renderFan(vm: FanViewModel, context: RenderContext): TemplateResult {
  const off = translate(context.language, 'hvac_off');
  if (vm.presets.length > 0) {
    return html`<div class="pills">
      ${pill(context, off, !vm.on, airCommands.fanOff(vm.id))}
      ${vm.presets.map((preset) => pill(context, preset, vm.on && preset === vm.preset, airCommands.preset(vm.id, preset)))}
    </div>`;
  }
  if (vm.levels.length > 0) {
    const current = vm.percentage ?? 0;
    const nearest = vm.levels.reduce((best, level) => (Math.abs(level - current) < Math.abs(best - current) ? level : best));
    return html`<div class="pills">
      ${pill(context, off, !vm.on, airCommands.fanOff(vm.id))}
      ${vm.levels.map((level) => pill(context, `${level}%`, vm.on && level === nearest, airCommands.percentage(vm.id, level)))}
    </div>`;
  }
  if (vm.percentage !== null) {
    return html`<div class="stack">
      <div class="big">${vm.percentage}%</div>
      <octa-slider
        .appearance=${context.appearance}
        .label=${translate(context.language, 'speed')}
        unit="%"
        .min=${0}
        .max=${100}
        .value=${vm.percentage}
        .disabled=${context.disabled}
        @octa-change=${(event: CustomEvent<{ value: number }>) => context.run(airCommands.percentage(vm.id, event.detail.value))}
      ></octa-slider>
    </div>`;
  }
  return html`<div class="row"><span class="small">${vm.label}</span>${toggle(vm.id, vm.on, context, airCommands.fanToggle(vm.id, vm.on))}</div>`;
}

function barTone(percent: number): string {
  if (percent < 20) return 'bar danger';
  return percent < 50 ? 'bar warning' : 'bar';
}

function renderValve(vm: ValveViewModel, context: RenderContext): TemplateResult {
  const control = vm.canToggle ? toggle(vm.id, vm.on, context, airCommands.valveToggle(vm.id, vm.on)) : nothing;
  if (vm.position === null) return html`<div class="row"><span class="small">${vm.label}</span>${control}</div>`;
  return html`<div class="stack">
    <div class="row"><div class="big">${vm.position}%</div>${control}</div>
    <div class=${barTone(vm.position)}><span style="width:${Math.max(0, Math.min(100, vm.position))}%"></span></div>
    <div class="tiny">${vm.label}</div>
  </div>`;
}

export const airWidget = defineWidget<AirViewModel>({
  element: 'octa-air-card',
  name: 'Octa Home UI Lüfter und Ventil',
  description: 'Lüfterstufen oder Ventil',
  spec: { variants: ['speed', 'valve'], defaultVariant: 'speed', roles: { main: { domains: ['fan', 'valve'], required: true } } },
  columns: 12,
  toViewModel(target) {
    const { entity } = target;
    const attributes = entity?.attributes ?? {};
    if (target.domain === 'valve') {
      const position = attributes.current_position;
      return {
        kind: 'valve',
        id: target.id,
        on: target.active,
        label: target.stateLabel,
        position: typeof position === 'number' ? position : null,
        canToggle: entity !== undefined && supports(entity, 'valve', 'OPEN') && supports(entity, 'valve', 'CLOSE'),
      };
    }
    const capabilities = entity ? fanCapabilities(entity) : undefined;
    const percentage = attributes.percentage;
    return {
      kind: 'fan',
      id: target.id,
      on: target.active,
      label: target.stateLabel,
      presets: capabilities?.presets ?? [],
      preset: typeof attributes.preset_mode === 'string' ? attributes.preset_mode : null,
      levels: capabilities?.percentage ? fanLevels(attributes.percentage_step) : [],
      percentage: capabilities?.percentage ? (typeof percentage === 'number' ? percentage : 0) : null,
    };
  },
  render(vm, context) {
    return vm.kind === 'valve' ? renderValve(vm, context) : renderFan(vm, context);
  },
});
