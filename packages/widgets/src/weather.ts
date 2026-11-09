import { html, nothing, type TemplateResult } from 'lit';
import { translate, type ForecastEntry, type MessageKey } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon, type IconName } from './icons.ts';

export interface WeatherDay {
  day: string;
  condition: string;
  high: number | null;
  low: number | null;
}

export interface WeatherViewModel {
  label: string;
  condition: string;
  temperature: number | null;
  unit: string;
  rows: { label: MessageKey; value: string }[];
  days: WeatherDay[];
}

const CONDITION_ICONS: Record<string, IconName> = {
  sunny: 'sun',
  'clear-night': 'moon',
  partlycloudy: 'cloudSun',
  cloudy: 'cloud',
  fog: 'cloudFog',
  rainy: 'cloudRain',
  pouring: 'cloudRain',
  snowy: 'cloudSnow',
  'snowy-rainy': 'cloudSnow',
  lightning: 'cloudLightning',
  'lightning-rainy': 'cloudLightning',
  hail: 'cloudSnow',
  windy: 'wind',
  'windy-variant': 'wind',
  exceptional: 'cloud',
};

const FORECAST_DAYS = 5;

const numeric = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function forecastDays(entries: ForecastEntry[], language: string): WeatherDay[] {
  return entries.slice(0, FORECAST_DAYS).flatMap((entry) => {
    const time = new Date(entry.datetime);
    if (Number.isNaN(time.getTime())) return [];
    return [{ day: time.toLocaleDateString(language, { weekday: 'short' }), condition: text(entry.condition), high: numeric(entry.temperature), low: numeric(entry.templow) }];
  });
}

function render(vm: WeatherViewModel, context: RenderContext): TemplateResult {
  return html`<div class="stack">
    <div class="led">
      <span class="tone-glow">${icon(CONDITION_ICONS[vm.condition] ?? 'cloud', 40)}</span>
      <div>
        <div class="big">${vm.temperature === null ? '–' : `${vm.temperature}${vm.unit}`}</div>
        <div class="small">${vm.label}</div>
      </div>
    </div>
    ${vm.rows.map((row) => html`<div class="row body"><span class="muted-text">${translate(context.language, row.label)}</span><strong>${row.value}</strong></div>`)}
    ${vm.days.length === 0
      ? nothing
      : html`<div class="forecast">
          ${vm.days.map(
            (day) => html`<div>
              <div class="tiny">${day.day}</div>
              <span class="tone-muted">${icon(CONDITION_ICONS[day.condition] ?? 'cloud', 20)}</span>
              <div class="body">${day.high === null ? '–' : `${day.high}°`}</div>
              ${day.low === null ? nothing : html`<div class="tiny">${day.low}°</div>`}
            </div>`,
          )}
        </div>`}
  </div>`;
}

export const weatherWidget = defineWidget<WeatherViewModel>({
  element: 'octa-weather-card',
  name: 'Octa Home UI Wetter',
  description: 'Aktuelles Wetter mit Vorhersage',
  spec: { variants: ['weather'], defaultVariant: 'weather', roles: { main: { domains: ['weather'], required: true } } },
  columns: 12,
  needsForecast: true,
  toViewModel(target, _config, port, _history, forecast = []) {
    const attributes = target.entity?.attributes ?? {};
    const candidates: [MessageKey, unknown, string][] = [
      ['humidity', attributes.humidity, '%'],
      ['cloud_coverage', attributes.cloud_coverage, '%'],
      ['precipitation', attributes.precipitation, text(attributes.precipitation_unit) || ' mm'],
      ['wind', attributes.wind_speed, text(attributes.wind_speed_unit) ? ` ${text(attributes.wind_speed_unit)}` : ''],
    ];
    return {
      label: target.stateLabel,
      condition: target.entity?.state ?? '',
      temperature: numeric(attributes.temperature),
      unit: text(attributes.temperature_unit) || '°',
      rows: candidates.filter(([, value]) => numeric(value) !== null).map(([label, value, unit]) => ({ label, value: `${value as number}${unit}` })),
      days: forecastDays(forecast, port.language),
    };
  },
  render,
});
