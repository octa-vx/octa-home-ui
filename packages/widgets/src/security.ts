import { html, nothing, type TemplateResult } from 'lit';
import { supports, translate, type FeatureOf, type MessageKey, type ServiceCommand } from '@octa/ha-core';
import type { AlarmAction } from './alarm-panel.ts';
import { defineWidget, type RenderContext } from './define.ts';
import { icon } from './icons.ts';

export interface ContactViewModel {
  kind: 'contact';
  open: boolean;
  label: string;
}

export interface MotionViewModel {
  kind: 'motion';
  detected: boolean;
  /** Formatted time of the last change, `null` when HA does not report one. */
  last: string | null;
}

export interface LockViewModel {
  kind: 'lock';
  id: string;
  label: string;
  locked: boolean;
  moving: boolean;
  jammed: boolean;
  /** The lock wants a code. The card does not take codes for locks yet, so it only shows the state. */
  codeRequired: boolean;
}

export interface AlarmViewModel {
  kind: 'alarm';
  id: string;
  label: string;
  disarmed: boolean;
  triggered: boolean;
  /** How the code is entered, `null` when the next action needs none. */
  codeFormat: 'number' | 'text' | null;
  armServices: { service: string; label: MessageKey }[];
}

export interface PersonViewModel {
  kind: 'person';
  name: string;
  initial: string;
  picture: string | null;
  label: string;
}

export type SecurityViewModel = ContactViewModel | MotionViewModel | LockViewModel | AlarmViewModel | PersonViewModel;

type ArmFeature = FeatureOf<'alarm_control_panel'>;

const ARM_ACTIONS: { service: string; feature: ArmFeature; label: MessageKey }[] = [
  { service: 'alarm_arm_home', feature: 'ARM_HOME', label: 'alarm_home' },
  { service: 'alarm_arm_away', feature: 'ARM_AWAY', label: 'alarm_away' },
  { service: 'alarm_arm_night', feature: 'ARM_NIGHT', label: 'alarm_night' },
  { service: 'alarm_arm_vacation', feature: 'ARM_VACATION', label: 'alarm_vacation' },
  { service: 'alarm_arm_custom_bypass', feature: 'ARM_CUSTOM_BYPASS', label: 'alarm_custom' },
];

const FEATURE_OF = Object.fromEntries(ARM_ACTIONS.map(({ service, feature }) => [service, feature]));

export const securityCommands = {
  lock: (id: string): ServiceCommand => ({ domain: 'lock', service: 'lock', entityId: id }),
  unlock: (id: string): ServiceCommand => ({ domain: 'lock', service: 'unlock', entityId: id }),
  alarm: (id: string, service: string, code: string | undefined): ServiceCommand => {
    const feature = FEATURE_OF[service];
    return {
      domain: 'alarm_control_panel',
      service,
      entityId: id,
      ...(code === undefined ? {} : { data: { code } }),
      ...(feature ? { requires: { domain: 'alarm_control_panel' as const, feature } } : {}),
    };
  },
};

function renderContact(vm: ContactViewModel): TemplateResult {
  return html`<span class="solid-pill ${vm.open ? 'bad' : 'ok'}">${vm.label}</span>`;
}

function renderMotion(vm: MotionViewModel, context: RenderContext): TemplateResult {
  return html`<div class="led">
    <span class="pulse ${vm.detected ? 'on' : ''}"></span>
    <div>
      <div class="strong">${translate(context.language, vm.detected ? 'motion_detected' : 'motion_none')}</div>
      <div class="tiny">${vm.last === null ? '—' : translate(context.language, 'motion_last', { time: vm.last })}</div>
    </div>
  </div>`;
}

function renderLock(vm: LockViewModel, context: RenderContext): TemplateResult {
  const status = vm.jammed ? html`<octa-status .appearance=${context.appearance} kind="alert" .text=${vm.label}></octa-status>` : nothing;
  if (vm.codeRequired) {
    return html`<div class="stack">
      ${status}
      <span class="solid-pill ${vm.locked ? 'ok' : 'bad'}">${vm.label}</span>
      <div class="tiny">${translate(context.language, 'lock_code_required')}</div>
    </div>`;
  }
  // Whatever is not clearly locked may be locked directly. Only a locked door offers unlocking.
  const command = vm.locked ? securityCommands.unlock(vm.id) : securityCommands.lock(vm.id);
  const action = translate(context.language, vm.locked ? 'unlock' : 'lock');
  return html`<div class="stack">
    ${status}
    <button
      type="button"
      class="solid ${vm.locked ? 'ok' : 'bad'}"
      aria-label=${action}
      ?disabled=${context.disabled || context.busy || vm.moving}
      @click=${() => context.run(command)}
    >
      ${icon(vm.locked ? 'lock' : 'lockOpen', 18)}${vm.label}
    </button>
    <div class="tiny centered">${action}</div>
  </div>`;
}

function renderAlarm(vm: AlarmViewModel, context: RenderContext): TemplateResult {
  const { language } = context;
  const actions: AlarmAction[] = vm.disarmed ? vm.armServices.map(({ service, label }) => ({ service, label: translate(language, label) })) : [];
  const disarm: AlarmAction | undefined = vm.disarmed ? undefined : { service: 'alarm_disarm', label: translate(language, 'alarm_disarm') };
  const send = (event: CustomEvent<{ service: string; code: string | undefined }>): void => {
    const { service, code } = event.detail;
    // Entering the code and pressing OK is the explicit confirmation of the disarm.
    context.run(securityCommands.alarm(vm.id, service, code), { confirmed: code !== undefined });
  };
  return html`<div class="stack">
    <div class="status-bar ${vm.disarmed ? 'ok' : 'bad'}">${vm.triggered ? icon('alert', 16) : nothing}${vm.label}</div>
    <octa-alarm-panel
      .actions=${actions}
      .confirmAction=${disarm}
      .codeFormat=${vm.codeFormat}
      .disabled=${context.disabled || context.busy}
      .resetKey=${vm.label}
      .okLabel=${disarm?.label ?? 'OK'}
      .codeLabel=${translate(language, 'code')}
      .clearLabel=${translate(language, 'clear')}
      @octa-alarm=${send}
    ></octa-alarm-panel>
  </div>`;
}

function renderPerson(vm: PersonViewModel): TemplateResult {
  return html`<div class="led">
    ${vm.picture ? html`<img class="avatar" src=${vm.picture} alt="" />` : html`<div class="avatar">${vm.initial}</div>`}
    <div>
      <div class="strong">${vm.name}</div>
      <div class="small">${vm.label}</div>
    </div>
  </div>`;
}

const lastChange = (value: unknown, language: string): string | null => {
  if (typeof value !== 'string') return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
};

const WIDE = ['alarm'];

export const securityWidget = defineWidget<SecurityViewModel>({
  element: 'octa-security-card',
  name: 'Octa Home UI Sicherheit',
  description: 'Kontakt, Bewegung, Schloss, Alarm oder Person',
  spec: {
    variants: ['contact', 'motion', 'lock', 'alarm', 'person'],
    defaultVariant: 'contact',
    roles: { main: { domains: ['binary_sensor', 'lock', 'alarm_control_panel', 'person', 'device_tracker'], required: true } },
  },
  columns: (variant) => (WIDE.includes(variant) ? 12 : 6),
  toViewModel(target, config, port) {
    const { entity } = target;
    const attributes = entity?.attributes ?? {};
    if (target.domain === 'lock') {
      const state = entity?.state ?? '';
      return {
        kind: 'lock',
        id: target.id,
        label: target.stateLabel,
        locked: state === 'locked',
        moving: state === 'locking' || state === 'unlocking' || state === 'opening',
        jammed: target.alert,
        codeRequired: typeof attributes.code_format === 'string' && attributes.code_format !== '',
      };
    }
    if (target.domain === 'alarm_control_panel') {
      const disarmed = entity?.state === 'disarmed';
      const format = attributes.code_format;
      const armingWithoutCode = disarmed && attributes.code_arm_required === false;
      return {
        kind: 'alarm',
        id: target.id,
        label: target.stateLabel,
        disarmed,
        triggered: target.alert,
        codeFormat: !armingWithoutCode && (format === 'number' || format === 'text') ? format : null,
        armServices: ARM_ACTIONS.filter(({ feature }) => entity !== undefined && supports(entity, 'alarm_control_panel', feature)).map(({ service, label }) => ({ service, label })),
      };
    }
    if (target.domain === 'person' || target.domain === 'device_tracker') {
      const picture = attributes.entity_picture;
      return { kind: 'person', name: target.name, initial: target.name.charAt(0).toUpperCase(), picture: typeof picture === 'string' ? picture : null, label: target.stateLabel };
    }
    if (config.variant === 'motion') return { kind: 'motion', detected: target.active, last: lastChange(entity?.last_changed, port.language) };
    return { kind: 'contact', open: target.active, label: target.stateLabel };
  },
  render(vm, context) {
    switch (vm.kind) {
      case 'contact':
        return renderContact(vm);
      case 'motion':
        return renderMotion(vm, context);
      case 'lock':
        return renderLock(vm, context);
      case 'alarm':
        return renderAlarm(vm, context);
      default:
        return renderPerson(vm);
    }
  },
});
