import { html, nothing, type TemplateResult } from 'lit';
import { normalizeEntity, translate, type HassEntity, type HassPort } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon, type IconName } from './icons.ts';

export interface BatteryEntry {
  name: string;
  percent: number;
}

export interface EnergyViewModel {
  variant: string;
  label: string;
  value: string;
  unit: string;
  /** Today's energy as text, `null` without an energy sensor. */
  today: string | null;
  flow: { solar: number | null; grid: number | null; home: number | null; battery: number | null };
  batteries: BatteryEntry[];
}

export const BATTERY_ROLES = ['main', 'battery_2', 'battery_3', 'battery_4', 'battery_5', 'battery_6', 'battery_7', 'battery_8'] as const;

/** Splits HA's formatted state, so the number keeps HA's precision and locale. */
export function splitUnit(label: string, unit: string): string {
  return unit && label.endsWith(unit) ? label.slice(0, -unit.length).trim() : label;
}

const unitOf = (entity: HassEntity | undefined): string => {
  const unit = entity?.attributes.unit_of_measurement;
  return typeof unit === 'string' ? unit : '';
};

/** Power in kilowatts, `null` when the sensor has no numeric reading. */
export function toKilowatts(entity: HassEntity | undefined): number | null {
  if (!entity || entity.state === '') return null;
  const value = Number(entity.state);
  if (!Number.isFinite(value)) return null;
  const unit = unitOf(entity);
  const kilowatts = unit === 'W' ? value / 1000 : unit === 'MW' ? value * 1000 : value;
  return Math.round(kilowatts * 100) / 100;
}

function renderPower(vm: EnergyViewModel, context: RenderContext): TemplateResult {
  return html`<div class="row end">
    <div class="big">${vm.value}${vm.unit ? html` <span class="unit">${vm.unit}</span>` : nothing}</div>
    ${vm.today === null
      ? nothing
      : html`<div class="small right"><span class="glow right-icon">${icon('zap', 14)}</span>${vm.today} ${translate(context.language, 'today')}</div>`}
  </div>`;
}

function node(name: IconName, tone: string, label: string, kilowatts: number): TemplateResult {
  return html`<div class="node">
    <div class="ring ${tone}">${icon(name, 20)}</div>
    <div class="node-value">${kilowatts} kW</div>
    <div class="node-label">${label}</div>
  </div>`;
}

function renderFlow(vm: EnergyViewModel, context: RenderContext): TemplateResult {
  const { flow } = vm;
  const label = (key: 'solar' | 'grid' | 'home' | 'battery'): string => translate(context.language, key);
  return html`<div class="stack tight">
    ${flow.solar === null
      ? nothing
      : html`<div class="center">${node('sun', 'tone-glow', label('solar'), flow.solar)}</div>
          <div class="flow vertical"></div>`}
    <div class="flow-row">
      ${flow.grid === null ? nothing : html`${node('zap', 'tone-muted', label('grid'), flow.grid)}<div class="flow"></div>`}
      ${flow.home === null ? nothing : node('house', 'tone-primary', label('home'), flow.home)}
      ${flow.battery === null ? nothing : html`<div class="flow"></div>${node('battery', 'tone-primary', label('battery'), flow.battery)}`}
    </div>
  </div>`;
}

const barTone = (percent: number): string => (percent < 20 ? 'bar danger' : percent < 50 ? 'bar warning' : 'bar');

function renderBatteries(vm: EnergyViewModel, context: RenderContext): TemplateResult {
  if (vm.batteries.length === 0) return html`<div class="small">${translate(context.language, 'no_data')}</div>`;
  return html`<div class="stack">
    ${vm.batteries.map(
      (battery) => html`<div>
        <div class="row body"><span class="with-icon">${icon('battery', 14)}${battery.name}</span><span>${battery.percent}%</span></div>
        <div class=${barTone(battery.percent)}><span style="width:${Math.max(0, Math.min(100, battery.percent))}%"></span></div>
      </div>`,
    )}
  </div>`;
}

const RENDERERS: Record<string, (vm: EnergyViewModel, context: RenderContext) => TemplateResult> = {
  power: renderPower,
  power_flow: renderFlow,
  battery_list: renderBatteries,
};

function batteries(port: HassPort, roles: Record<string, string>): BatteryEntry[] {
  return BATTERY_ROLES.map((role) => roles[role])
    .filter((id): id is string => id !== undefined)
    .map((id) => normalizeEntity(port, id))
    .filter((target) => target.status === 'ok' && Number.isFinite(Number(target.entity?.state)))
    .map((target) => ({ name: target.name, percent: Number(target.entity?.state) }));
}

const WIDE = ['power_flow'];

export const energyWidget = defineWidget<EnergyViewModel>({
  element: 'octa-energy-card',
  name: 'Octa Home UI Energie',
  description: 'Leistung, Energiefluss oder Batterieliste',
  spec: {
    variants: ['power', 'power_flow', 'battery_list'],
    defaultVariant: 'power',
    roles: {
      main: { domains: ['sensor'], required: true },
      energy: { domains: ['sensor'] },
      solar: { domains: ['sensor'] },
      grid: { domains: ['sensor'] },
      battery: { domains: ['sensor'] },
      ...Object.fromEntries(BATTERY_ROLES.slice(1).map((role) => [role, { domains: ['sensor'] }])),
    },
  },
  columns: (variant) => (WIDE.includes(variant) ? 12 : 6),
  toViewModel(target, config, port) {
    const unit = unitOf(target.entity);
    const energyId = config.roles.energy;
    const energy = energyId ? normalizeEntity(port, energyId) : undefined;
    const entityOf = (id: string | undefined): HassEntity | undefined => (id ? port.getEntity(id) : undefined);
    return {
      variant: config.variant,
      label: target.stateLabel,
      value: splitUnit(target.stateLabel, unit),
      unit,
      today: energy?.status === 'ok' ? energy.stateLabel : null,
      flow: {
        solar: toKilowatts(entityOf(config.roles.solar)),
        grid: toKilowatts(entityOf(config.roles.grid)),
        home: toKilowatts(target.entity),
        battery: toKilowatts(entityOf(config.roles.battery)),
      },
      batteries: batteries(port, config.roles),
    };
  },
  render(vm, context) {
    return (RENDERERS[vm.variant] ?? renderPower)(vm, context);
  },
});
