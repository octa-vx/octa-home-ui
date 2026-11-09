import { html, type TemplateResult } from 'lit';
import { climateCapabilities, translate, type MessageKey, type ServiceCommand } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon } from './icons.ts';

export interface ClimateViewModel {
  id: string;
  variant: string;
  label: string;
  /** `null` when there is no single target temperature, for example in heat/cool range mode. */
  target: number | null;
  current: number | null;
  min: number;
  max: number;
  step: number;
  mode: string;
  /** Only the modes this device reports. */
  modes: string[];
}

const numeric = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Avoids results such as 21.100000000000001 when stepping by tenths. */
const round = (value: number): number => Math.round(value * 100) / 100;

export const climateCommands = {
  temperature: (id: string, temperature: number): ServiceCommand => ({
    domain: 'climate',
    service: 'set_temperature',
    entityId: id,
    data: { temperature },
    requires: { domain: 'climate', feature: 'TARGET_TEMPERATURE' },
  }),
  mode: (id: string, hvac_mode: string): ServiceCommand => ({ domain: 'climate', service: 'set_hvac_mode', entityId: id, data: { hvac_mode } }),
};

/** The next target temperature for a button press, `null` at the limit. */
export function stepTarget(vm: Pick<ClimateViewModel, 'target' | 'min' | 'max' | 'step'>, direction: 1 | -1): number | null {
  if (vm.target === null) return null;
  const next = round(vm.target + direction * vm.step);
  return next < vm.min || next > vm.max ? null : next;
}

const fallback = (vm: ClimateViewModel): TemplateResult =>
  html`<div class="big">${vm.current === null ? vm.label : `${vm.current}°`}</div><div class="small">${vm.label}</div>`;

function renderThermostat(vm: ClimateViewModel, context: RenderContext): TemplateResult {
  if (vm.target === null) return fallback(vm);
  return html`<octa-dial
    .appearance=${context.appearance}
    .label=${translate(context.language, 'target_temperature')}
    unit="°"
    .note=${vm.current === null ? '' : translate(context.language, 'current', { value: String(vm.current) })}
    .hint=${translate(context.language, 'turn_hint')}
    .min=${vm.min}
    .max=${vm.max}
    .step=${vm.step}
    .value=${vm.target}
    .disabled=${context.disabled}
    @octa-change=${(event: CustomEvent<{ value: number }>) => context.run(climateCommands.temperature(vm.id, event.detail.value))}
  ></octa-dial>`;
}

function renderButtons(vm: ClimateViewModel, context: RenderContext): TemplateResult {
  if (vm.target === null) return fallback(vm);
  const stepper = (direction: 1 | -1, label: MessageKey, name: 'plus' | 'minus'): TemplateResult => {
    const next = stepTarget(vm, direction);
    return html`<octa-button
      class="icon"
      .appearance=${context.appearance}
      .label=${translate(context.language, label)}
      .disabled=${context.disabled || next === null}
      .busy=${context.busy}
      @click=${() => next !== null && context.run(climateCommands.temperature(vm.id, next))}
      >${icon(name, 18)}</octa-button
    >`;
  };
  return html`<div class="well-row">
    ${stepper(-1, 'decrease', 'minus')}
    <div class="big">${vm.target.toFixed(1)}°</div>
    ${stepper(1, 'increase', 'plus')}
  </div>`;
}

function renderMode(vm: ClimateViewModel, context: RenderContext): TemplateResult {
  if (vm.modes.length === 0) return html`<div class="small">${vm.label}</div>`;
  return html`<div class="pills">
    ${vm.modes.map((mode) => {
      const key = `hvac_${mode}` as MessageKey;
      return html`<octa-button
        class="pill"
        .appearance=${context.appearance}
        .active=${mode === vm.mode}
        .disabled=${context.disabled}
        .busy=${context.busy}
        @click=${() => mode !== vm.mode && !context.disabled && context.run(climateCommands.mode(vm.id, mode))}
        >${translate(context.language, key)}</octa-button
      >`;
    })}
  </div>`;
}

const RENDERERS: Record<string, (vm: ClimateViewModel, context: RenderContext) => TemplateResult> = {
  thermostat: renderThermostat,
  buttons: renderButtons,
  mode: renderMode,
};

const KNOWN_MODES = ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'];

export const climateWidget = defineWidget<ClimateViewModel>({
  element: 'octa-climate-card',
  name: 'Octa Home UI Klima',
  description: 'Thermostat mit Drehregler, Plus-Minus-Tasten oder Betriebsart',
  spec: { variants: ['thermostat', 'buttons', 'mode'], defaultVariant: 'thermostat', roles: { main: { domains: ['climate'], required: true } } },
  columns: 12,
  toViewModel(target, config) {
    const attributes = target.entity?.attributes ?? {};
    const capabilities = target.entity ? climateCapabilities(target.entity) : undefined;
    return {
      id: target.id,
      variant: config.variant,
      label: target.stateLabel,
      target: capabilities?.targetTemperature === true ? numeric(attributes.temperature) : null,
      current: numeric(attributes.current_temperature),
      min: numeric(attributes.min_temp) ?? 7,
      max: numeric(attributes.max_temp) ?? 35,
      step: numeric(attributes.target_temp_step) ?? 0.5,
      mode: target.entity?.state ?? '',
      modes: (capabilities?.hvacModes ?? []).filter((mode) => KNOWN_MODES.includes(mode)),
    };
  },
  render(vm, context) {
    return (RENDERERS[vm.variant] ?? renderThermostat)(vm, context);
  },
});
