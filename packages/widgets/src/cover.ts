import { html, nothing, type TemplateResult } from 'lit';
import { supports, translate, type MessageKey, type ServiceCommand } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon, type IconName } from './icons.ts';

export interface CoverViewModel {
  id: string;
  variant: string;
  label: string;
  /** `null` when the cover does not report a position. */
  position: number | null;
  /** `null` when the cover has no adjustable slats. */
  tilt: number | null;
  canOpen: boolean;
  canStop: boolean;
  canClose: boolean;
  canSetPosition: boolean;
}

export const coverCommands = {
  open: (id: string): ServiceCommand => ({ domain: 'cover', service: 'open_cover', entityId: id, requires: { domain: 'cover', feature: 'OPEN' } }),
  stop: (id: string): ServiceCommand => ({ domain: 'cover', service: 'stop_cover', entityId: id, requires: { domain: 'cover', feature: 'STOP' } }),
  close: (id: string): ServiceCommand => ({ domain: 'cover', service: 'close_cover', entityId: id, requires: { domain: 'cover', feature: 'CLOSE' } }),
  position: (id: string, position: number): ServiceCommand => ({
    domain: 'cover',
    service: 'set_cover_position',
    entityId: id,
    data: { position },
    requires: { domain: 'cover', feature: 'SET_POSITION' },
  }),
  tilt: (id: string, tilt_position: number): ServiceCommand => ({
    domain: 'cover',
    service: 'set_cover_tilt_position',
    entityId: id,
    data: { tilt_position },
    requires: { domain: 'cover', feature: 'SET_TILT_POSITION' },
  }),
};

function button(context: RenderContext, label: MessageKey, name: IconName, size: number, command: ServiceCommand): TemplateResult {
  return html`<octa-button
    class="icon"
    .appearance=${context.appearance}
    .label=${translate(context.language, label)}
    .disabled=${context.disabled}
    .busy=${context.busy}
    @click=${() => context.run(command)}
    >${icon(name, size)}</octa-button
  >`;
}

function renderCover(vm: CoverViewModel, context: RenderContext): TemplateResult {
  return html`<div class="row">
    <div>
      ${vm.position === null ? nothing : html`<div class="big">${vm.position}%</div>`}
      <div class=${vm.position === null ? 'small' : 'tiny'}>${vm.label}</div>
    </div>
    <div class="controls">
      ${vm.canOpen ? button(context, 'open', 'up', 18, coverCommands.open(vm.id)) : nothing}
      ${vm.canStop ? button(context, 'stop', 'stop', 14, coverCommands.stop(vm.id)) : nothing}
      ${vm.canClose ? button(context, 'close', 'down', 18, coverCommands.close(vm.id)) : nothing}
    </div>
  </div>`;
}

function slider(context: RenderContext, label: MessageKey, value: number, send: (value: number) => void): TemplateResult {
  return html`<octa-slider
    .appearance=${context.appearance}
    .label=${translate(context.language, label)}
    unit="%"
    .min=${0}
    .max=${100}
    .value=${value}
    .disabled=${context.disabled}
    @octa-change=${(event: CustomEvent<{ value: number }>) => send(event.detail.value)}
  ></octa-slider>`;
}

function renderPosition(vm: CoverViewModel, context: RenderContext): TemplateResult {
  if (vm.position === null || !vm.canSetPosition) return renderCover(vm, context);
  return html`<div class="stack">
    <div class="big">${vm.position}%</div>
    ${slider(context, 'position', vm.position, (value) => context.run(coverCommands.position(vm.id, value)))}
  </div>`;
}

function renderTilt(vm: CoverViewModel, context: RenderContext): TemplateResult {
  if (vm.tilt === null) return html`<div class="small">${vm.label}</div>`;
  const angle = (vm.tilt / 100) * 45;
  return html`<div class="stack">
    <div class="tilt">
      <div class="big">${vm.tilt}%</div>
      <div class="slats" aria-hidden="true">${[0, 1, 2].map(() => html`<span style="transform:rotate(${angle}deg)"></span>`)}</div>
    </div>
    ${slider(context, 'tilt', vm.tilt, (value) => context.run(coverCommands.tilt(vm.id, value)))}
  </div>`;
}

const RENDERERS: Record<string, (vm: CoverViewModel, context: RenderContext) => TemplateResult> = {
  cover: renderCover,
  position: renderPosition,
  tilt: renderTilt,
};

export const coverWidget = defineWidget<CoverViewModel>({
  element: 'octa-cover-card',
  name: 'Octa Home UI Beschattung',
  description: 'Rollladen mit Tasten, Position oder Lamellen',
  spec: { variants: ['cover', 'position', 'tilt'], defaultVariant: 'cover', roles: { main: { domains: ['cover'], required: true } } },
  columns: 12,
  toViewModel(target, config) {
    const entity = target.entity;
    const position = entity?.attributes.current_position;
    const tilt = entity?.attributes.current_tilt_position;
    const hasTilt = entity !== undefined && supports(entity, 'cover', 'SET_TILT_POSITION');
    return {
      id: target.id,
      variant: config.variant,
      label: target.stateLabel,
      position: typeof position === 'number' ? position : null,
      tilt: hasTilt && typeof tilt === 'number' ? tilt : null,
      canOpen: entity !== undefined && supports(entity, 'cover', 'OPEN'),
      canStop: entity !== undefined && supports(entity, 'cover', 'STOP'),
      canClose: entity !== undefined && supports(entity, 'cover', 'CLOSE'),
      canSetPosition: entity !== undefined && supports(entity, 'cover', 'SET_POSITION'),
    };
  },
  render(vm, context) {
    return (RENDERERS[vm.variant] ?? renderCover)(vm, context);
  },
});
