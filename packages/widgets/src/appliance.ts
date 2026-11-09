import { html, nothing, type TemplateResult } from 'lit';
import { normalizeEntity, supports, translate, type FeatureOf, type HassPort, type MessageKey, type ServiceCommand } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon, type IconName } from './icons.ts';

export interface VacuumViewModel {
  kind: 'vacuum';
  id: string;
  label: string;
  canStart: boolean;
  canPause: boolean;
  canReturn: boolean;
  fanSpeed: string | null;
  fanSpeeds: string[];
}

export interface FilterViewModel {
  kind: 'filter';
  parts: { name: string; percent: number }[];
  label: string;
}

export interface WasherViewModel {
  kind: 'washer';
  label: string;
  minutes: number | null;
  program: string | null;
}

export type ApplianceViewModel = VacuumViewModel | FilterViewModel | WasherViewModel;

export const PART_ROLES = ['main', 'part_2', 'part_3', 'part_4', 'part_5', 'part_6'] as const;

type VacuumFeature = FeatureOf<'vacuum'>;

const vacuum = (id: string, service: string, feature: VacuumFeature, data?: Record<string, unknown>): ServiceCommand => ({
  domain: 'vacuum',
  service,
  entityId: id,
  ...(data ? { data } : {}),
  requires: { domain: 'vacuum', feature },
});

export const applianceCommands = {
  start: (id: string): ServiceCommand => vacuum(id, 'start', 'START'),
  pause: (id: string): ServiceCommand => vacuum(id, 'pause', 'PAUSE'),
  home: (id: string): ServiceCommand => vacuum(id, 'return_to_base', 'RETURN_HOME'),
  fanSpeed: (id: string, fan_speed: string): ServiceCommand => vacuum(id, 'set_fan_speed', 'FAN_SPEED', { fan_speed }),
};

function button(context: RenderContext, label: MessageKey, name: IconName, command: ServiceCommand): TemplateResult {
  return html`<octa-button class="icon" .appearance=${context.appearance} .label=${translate(context.language, label)} .disabled=${context.disabled} .busy=${context.busy} @click=${() => context.run(command)}>${icon(name, 16)}</octa-button>`;
}

function renderVacuum(vm: VacuumViewModel, context: RenderContext): TemplateResult {
  return html`<div class="stack">
    <div class="body">${translate(context.language, 'status')}: <b>${vm.label}</b></div>
    <div class="controls">
      ${vm.canStart ? button(context, 'start', 'play', applianceCommands.start(vm.id)) : nothing}
      ${vm.canPause ? button(context, 'pause', 'pause', applianceCommands.pause(vm.id)) : nothing}
      ${vm.canReturn ? button(context, 'return_home', 'house', applianceCommands.home(vm.id)) : nothing}
    </div>
    ${vm.fanSpeeds.length === 0
      ? nothing
      : html`<div class="pills">
          ${vm.fanSpeeds.map(
            (speed) =>
              html`<octa-button class="pill" .appearance=${context.appearance} .active=${speed === vm.fanSpeed} .disabled=${context.disabled} @click=${() => speed !== vm.fanSpeed && !context.disabled && context.run(applianceCommands.fanSpeed(vm.id, speed))}>${speed}</octa-button>`,
          )}
        </div>`}
  </div>`;
}

const barTone = (percent: number): string => (percent < 20 ? 'bar danger' : percent < 50 ? 'bar warning' : 'bar');

function renderFilter(vm: FilterViewModel): TemplateResult {
  if (vm.parts.length === 0) return html`<div class="small">${vm.label}</div>`;
  return html`<div class="stack">
    ${vm.parts.map(
      (part) => html`<div>
        <div class="row body"><span>${part.name}</span><span>${part.percent}%</span></div>
        <div class=${barTone(part.percent)}><span style="width:${Math.max(0, Math.min(100, part.percent))}%"></span></div>
      </div>`,
    )}
  </div>`;
}

function renderWasher(vm: WasherViewModel): TemplateResult {
  return html`<div>
    <div class="big">${vm.minutes === null ? vm.label : html`${vm.minutes} <span class="unit">min</span>`}</div>
    ${vm.program ? html`<div class="small">${vm.program}</div>` : nothing}
  </div>`;
}

function parts(port: HassPort, roles: Record<string, string>): FilterViewModel['parts'] {
  return PART_ROLES.map((role) => roles[role])
    .filter((id): id is string => id !== undefined)
    .map((id) => normalizeEntity(port, id))
    .filter((target) => target.status === 'ok' && Number.isFinite(Number(target.entity?.state)))
    .map((target) => ({ name: target.name, percent: Number(target.entity?.state) }));
}

export const applianceWidget = defineWidget<ApplianceViewModel>({
  element: 'octa-appliance-card',
  name: 'Octa Home UI Haushalt',
  description: 'Saugroboter, Verschleißteile oder Waschmaschine',
  spec: {
    variants: ['vacuum', 'filter', 'washer'],
    defaultVariant: 'vacuum',
    roles: {
      main: { domains: ['vacuum', 'sensor'], required: true },
      program: { domains: ['sensor'] },
      ...Object.fromEntries(PART_ROLES.slice(1).map((role) => [role, { domains: ['sensor'] }])),
    },
  },
  columns: 6,
  toViewModel(target, config, port) {
    const { entity } = target;
    const attributes = entity?.attributes ?? {};
    if (target.domain === 'vacuum') {
      const has = (feature: VacuumFeature): boolean => entity !== undefined && supports(entity, 'vacuum', feature);
      const speeds = attributes.fan_speed_list;
      return {
        kind: 'vacuum',
        id: target.id,
        label: target.stateLabel,
        canStart: has('START'),
        canPause: has('PAUSE'),
        canReturn: has('RETURN_HOME'),
        fanSpeed: typeof attributes.fan_speed === 'string' ? attributes.fan_speed : null,
        fanSpeeds: has('FAN_SPEED') && Array.isArray(speeds) ? speeds.filter((item): item is string => typeof item === 'string') : [],
      };
    }
    if (config.variant === 'washer') {
      const programId = config.roles.program;
      const program = programId ? normalizeEntity(port, programId) : undefined;
      const minutes = entity && entity.state !== '' ? Number(entity.state) : Number.NaN;
      return { kind: 'washer', label: target.stateLabel, minutes: target.status === 'ok' && Number.isFinite(minutes) ? minutes : null, program: program?.status === 'ok' ? program.stateLabel : null };
    }
    return { kind: 'filter', parts: parts(port, config.roles), label: target.stateLabel };
  },
  render(vm, context) {
    if (vm.kind === 'vacuum') return renderVacuum(vm, context);
    return vm.kind === 'washer' ? renderWasher(vm) : renderFilter(vm);
  },
});
