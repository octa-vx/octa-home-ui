import { html, nothing, svg, type TemplateResult } from 'lit';
import { translate, type HistoryPoint } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { splitUnit } from './energy.ts';

export type Co2Level = 'good' | 'moderate' | 'poor';

export interface SensorViewModel {
  id: string;
  variant: string;
  name: string;
  label: string;
  /** The formatted state without its unit, for example `15,6`. */
  value: string;
  unit: string;
  /** `null` when the state is not a number. */
  number: number | null;
  min: number;
  max: number;
  warning: number | undefined;
  danger: number | undefined;
  stats: { min: number; mean: number; max: number } | null;
  /** Points of the 300 × 112 chart, empty without data. */
  points: string;
}

const CHART_WIDTH = 300;
const CHART_HEIGHT = 112;
const CHART_PADDING = 8;

const CO2_MODERATE = 800;
const CO2_POOR = 1400;

export function co2Level(ppm: number): Co2Level {
  if (ppm < CO2_MODERATE) return 'good';
  return ppm < CO2_POOR ? 'moderate' : 'poor';
}

const round = (value: number): number => Math.round(value * 10) / 10;

export function statistics(history: HistoryPoint[]): SensorViewModel['stats'] {
  if (history.length === 0) return null;
  const values = history.map((point) => point.value);
  return { min: round(Math.min(...values)), mean: round(values.reduce((sum, value) => sum + value, 0) / values.length), max: round(Math.max(...values)) };
}

/** A single reading has no time span, so it is drawn as a flat line. */
export function chartPoints(history: HistoryPoint[]): string {
  if (history.length === 0) return '';
  const times = history.map((point) => point.time);
  const values = history.map((point) => point.value);
  const [firstTime, lastTime] = [Math.min(...times), Math.max(...times)];
  const [low, high] = [Math.min(...values), Math.max(...values)];
  const y = (value: number): number => {
    if (high === low) return CHART_HEIGHT / 2;
    return CHART_HEIGHT - CHART_PADDING - ((value - low) / (high - low)) * (CHART_HEIGHT - 2 * CHART_PADDING);
  };
  if (firstTime === lastTime) return `0,${y(values[0] as number)} ${CHART_WIDTH},${y(values[0] as number)}`;
  return history.map((point) => `${round(((point.time - firstTime) / (lastTime - firstTime)) * CHART_WIDTH)},${round(y(point.value))}`).join(' ');
}

const reading = (vm: SensorViewModel): TemplateResult =>
  html`<div class="big">${vm.value}${vm.unit ? html` <span class="unit">${vm.unit}</span>` : nothing}</div>`;

function renderGauge(vm: SensorViewModel, context: RenderContext): TemplateResult {
  if (vm.number === null) return html`<div class="small">${vm.label}</div>`;
  return html`<div class="center">
    <octa-gauge .appearance=${context.appearance} .label=${vm.name} .unit=${vm.unit} .min=${vm.min} .max=${vm.max} .value=${vm.number} .warning=${vm.warning} .danger=${vm.danger}></octa-gauge>
  </div>`;
}

function renderCo2(vm: SensorViewModel, context: RenderContext): TemplateResult {
  if (vm.number === null) return html`<div class="small">${vm.label}</div>`;
  const level = co2Level(vm.number);
  return html`<div class="led">
    <div class="dot ${level}"></div>
    <div>
      <div class="big">${vm.value}</div>
      <div class="small">ppm · ${translate(context.language, `co2_${level}`)}</div>
    </div>
  </div>`;
}

function renderStatistic(vm: SensorViewModel, context: RenderContext): TemplateResult {
  if (vm.stats === null) return html`<div class="small">${translate(context.language, 'no_data')}</div>`;
  const { stats } = vm;
  return html`<div class="stats">
    ${(['min', 'mean', 'max'] as const).map(
      (key) => html`<div><div class="tiny">${translate(context.language, `stat_${key}`)}</div><b>${stats[key]}${vm.unit}</b></div>`,
    )}
  </div>`;
}

function renderHistory(vm: SensorViewModel, context: RenderContext): TemplateResult {
  if (vm.points === '') return html`<div class="small">${translate(context.language, 'no_data')}</div>`;
  return html`<svg class="chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" preserveAspectRatio="none" role="img" aria-label=${`${vm.name}: ${vm.label}`}>
    ${svg`<polyline points=${vm.points}></polyline>`}
  </svg>`;
}

function renderBadge(vm: SensorViewModel): TemplateResult {
  return html`<div class="led">
    <div class="badge">${vm.value}</div>
    <span class="small">${vm.unit || vm.label}</span>
  </div>`;
}

const RENDERERS: Record<string, (vm: SensorViewModel, context: RenderContext) => TemplateResult> = {
  sensor: reading,
  gauge: renderGauge,
  co2: renderCo2,
  statistic: renderStatistic,
  history: renderHistory,
  badge: renderBadge,
};

const WIDE = ['history'];

export const sensorWidget = defineWidget<SensorViewModel>({
  element: 'octa-sensor-card',
  name: 'Octa Home UI Sensor',
  description: 'Messwert, Tacho, CO₂, Statistik, Verlauf oder Plakette',
  spec: {
    variants: ['sensor', 'gauge', 'co2', 'statistic', 'history', 'badge'],
    defaultVariant: 'sensor',
    roles: { main: { domains: ['sensor'], required: true } },
    options: ['min', 'max', 'warning', 'danger'],
  },
  columns: (variant) => (WIDE.includes(variant) ? 12 : 6),
  needsHistory: (variant) => variant === 'statistic' || variant === 'history',
  toViewModel(target, config, _port, history = []) {
    const unitValue = target.entity?.attributes.unit_of_measurement;
    const unit = typeof unitValue === 'string' ? unitValue : '';
    const label = target.stateLabel;
    const raw = Number(target.entity?.state);
    return {
      id: target.id,
      variant: config.variant,
      name: target.name,
      label,
      value: splitUnit(label, unit),
      unit,
      number: target.status === 'ok' && target.entity?.state !== '' && Number.isFinite(raw) ? raw : null,
      min: config.options?.min ?? 0,
      max: config.options?.max ?? 100,
      warning: config.options?.warning,
      danger: config.options?.danger,
      stats: statistics(history),
      points: chartPoints(history),
    };
  },
  render(vm, context) {
    return (RENDERERS[vm.variant] ?? reading)(vm, context);
  },
});
