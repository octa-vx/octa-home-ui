import { html, nothing, type TemplateResult } from 'lit';
import { normalizeEntity, translate, type MessageKey, type ServiceCommand } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon, type IconName } from './icons.ts';

export interface CameraViewModel {
  id: string;
  variant: string;
  name: string;
  /** Authenticated image path of Home Assistant, `null` when there is none. */
  picture: string | null;
  recording: boolean;
  last: string | null;
  /** Reading of the motion sensor role, `null` without one. */
  motion: boolean | null;
  /** HA only reports this attribute while detection is on, so a missing value means off. */
  motionDetection: boolean;
  canMove: boolean;
}

/** Safety rule: the card only ever loads images through Home Assistant's own authenticated paths. */
export function safePicture(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('/api/') ? value : null;
}

const PTZ_MOVE = { move_mode: 'ContinuousMove', speed: 0.5, continuous_duration: 0.5 };

export const cameraCommands = {
  move: (id: string, axis: 'pan' | 'tilt', direction: string): ServiceCommand => ({ domain: 'onvif', service: 'ptz', entityId: id, data: { [axis]: direction, ...PTZ_MOVE } }),
  motionDetection: (id: string, on: boolean): ServiceCommand => ({ domain: 'camera', service: on ? 'disable_motion_detection' : 'enable_motion_detection', entityId: id }),
};

const timeOf = (value: unknown, language: string): string | null => {
  if (typeof value !== 'string') return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
};

function frame(vm: CameraViewModel, context: RenderContext, live: boolean, overlays: TemplateResult | typeof nothing = nothing): TemplateResult {
  return html`<div class="frame">
    ${vm.picture
      ? html`<octa-camera-image .picture=${vm.picture} .live=${live} .label=${vm.name}></octa-camera-image>`
      : html`<div class="frame-empty">${icon('camera', 24)}</div>`}
    <span class="tag primary-tag">${live ? translate(context.language, 'live') : (vm.last ?? '—')}</span>
    <span class="tag stale-tag">${translate(context.language, 'camera_stale')}</span>
    ${overlays}
  </div>`;
}

function renderSecurity(vm: CameraViewModel, context: RenderContext): TemplateResult {
  const overlays = html`${vm.recording ? html`<span class="tag rec">REC</span>` : nothing}
  ${vm.motion ? html`<span class="tag alarm">⚠ ${translate(context.language, 'motion_detected')}</span>` : nothing}`;
  return html`<div class="stack">
    ${frame(vm, context, true, overlays)}
    <div class="row">
      <span class="small">${translate(context.language, 'motion_detection')}</span>
      <octa-switch
        .appearance=${context.appearance}
        .checked=${vm.motionDetection}
        .disabled=${context.disabled}
        .label=${translate(context.language, 'motion_detection')}
        @octa-change=${() => context.run(cameraCommands.motionDetection(vm.id, vm.motionDetection))}
      ></octa-switch>
    </div>
  </div>`;
}

function renderPtz(vm: CameraViewModel, context: RenderContext): TemplateResult {
  const arrow = (name: IconName, label: MessageKey, axis: 'pan' | 'tilt', direction: string): TemplateResult =>
    html`<octa-button class="icon" .appearance=${context.appearance} .label=${translate(context.language, label)} .disabled=${context.disabled} @click=${() => context.run(cameraCommands.move(vm.id, axis, direction))}>${icon(name, 16)}</octa-button>`;
  return html`<div class="stack">
    ${frame(vm, context, true)}
    ${vm.canMove
      ? html`<div class="pad">
          <span></span>${arrow('up', 'move_up', 'tilt', 'UP')}<span></span>
          ${arrow('left', 'move_left', 'pan', 'LEFT')}<span></span>${arrow('right', 'move_right', 'pan', 'RIGHT')}
          <span></span>${arrow('down', 'move_down', 'tilt', 'DOWN')}<span></span>
        </div>`
      : html`<div class="tiny">${translate(context.language, 'ptz_unavailable')}</div>`}
  </div>`;
}

export const cameraWidget = defineWidget<CameraViewModel>({
  element: 'octa-camera-card',
  name: 'Octa Home UI Kamera',
  description: 'Livebild, Standbild, Schwenken oder Überwachung',
  spec: {
    variants: ['camera', 'snapshot', 'ptz', 'security_cam'],
    defaultVariant: 'camera',
    roles: { main: { domains: ['camera'], required: true }, motion: { domains: ['binary_sensor'] } },
  },
  columns: 12,
  toViewModel(target, config, port) {
    const attributes = target.entity?.attributes ?? {};
    const motionId = config.roles.motion;
    const motion = motionId ? normalizeEntity(port, motionId) : undefined;
    return {
      id: target.id,
      variant: config.variant,
      name: target.name,
      picture: safePicture(attributes.entity_picture),
      recording: target.entity?.state === 'recording',
      last: timeOf(target.entity?.last_changed, port.language),
      motion: motion ? motion.active : null,
      motionDetection: attributes.motion_detection === true,
      canMove: port.hasService('onvif', 'ptz'),
    };
  },
  render(vm, context) {
    if (vm.variant === 'security_cam') return renderSecurity(vm, context);
    if (vm.variant === 'ptz') return renderPtz(vm, context);
    return frame(vm, context, vm.variant === 'camera');
  },
});
