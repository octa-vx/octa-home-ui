import { LitElement, css, html, nothing, type PropertyDeclarations, type PropertyValues, type TemplateResult } from 'lit';
import { confirmationText, createHassPort, executeCommand, normalizeEntity, supports, translate, type HassLike, type ForecastEntry, type CommandResult, type HassPort, type HistoryPoint, type ServiceCommand } from '@octa/ha-core';
import { parseCardConfig, type CardConfig } from '@octa/schema';
import type { RenderContext, WidgetDefinition } from './define.ts';

const cardStyles = css`
  :host {
    color: var(--primary-text-color);
    display: block;
    font-family: var(--ha-font-family-body, inherit);
    height: 100%;
    line-height: 1.5;
  }
  .label {
    color: var(--secondary-text-color);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.18em;
    line-height: 16px;
    margin-bottom: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .stack {
    display: grid;
    gap: 12px;
  }
  .row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
  }
  .glow {
    color: var(--octa-theme-glow, var(--state-light-active-color, #ffc107));
    display: flex;
  }
  .muted {
    color: var(--secondary-text-color);
    display: flex;
  }
  .small {
    color: var(--secondary-text-color);
    font-size: 14px;
    line-height: 20px;
  }
  .tiny {
    color: var(--secondary-text-color);
    font-size: 12px;
    line-height: 16px;
  }
  .big {
    font-size: 36px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 40px;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
  .icon::part(button) {
    color: var(--secondary-text-color);
    height: 44px;
    padding: 0;
    width: 44px;
  }
  .well-row {
    align-items: center;
    background: var(--octa-theme-well-soft, var(--octa-theme-well, rgb(0 0 0 / 0.06)));
    border-radius: 999px;
    border-top: 2px solid var(--octa-theme-shade-dark, transparent);
    box-shadow: var(--octa-theme-shadow-inset, none);
    display: flex;
    justify-content: space-between;
    padding: 8px;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* The visible pill stays small like the original, the padding keeps the touch target at 44 px. */
  .pill {
    cursor: pointer;
    margin-block: -7px;
    padding-block: 7px;
  }
  .pill::part(button) {
    font-size: 12px;
    line-height: 16px;
    min-height: 30px;
    min-width: 0;
    padding: 6px 12px;
  }
  .pill:not([active])::part(button) {
    color: var(--secondary-text-color);
  }
  .tilt {
    align-items: center;
    display: flex;
    gap: 12px;
  }
  .slats {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .slats span {
    background: var(--primary-text-color);
    border-radius: 2px;
    display: block;
    height: 4px;
    width: 40px;
  }
  .unit {
    color: var(--secondary-text-color);
    font-size: 20px;
    font-weight: 400;
  }
  .center {
    display: flex;
    justify-content: center;
  }
  octa-gauge {
    width: 100%;
  }
  .dot {
    border-radius: 50%;
    flex-shrink: 0;
    height: 56px;
    width: 56px;
  }
  .dot.good {
    background: var(--octa-theme-fill-bottom, var(--primary-color));
    box-shadow: 0 0 18px -4px var(--octa-theme-fill-bottom, var(--primary-color));
  }
  .dot.moderate {
    background: var(--warning-color);
    box-shadow: 0 0 18px -4px var(--warning-color);
  }
  .dot.poor {
    background: var(--error-color);
    box-shadow: 0 0 18px -4px var(--error-color);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    text-align: center;
  }
  .stats b {
    font-size: 20px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 28px;
  }
  .chart {
    display: block;
    height: 112px;
    width: 100%;
  }
  .chart polyline {
    fill: none;
    stroke: var(--primary-color);
    stroke-linejoin: round;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .badge {
    align-items: center;
    border: 4px solid var(--primary-color);
    border-radius: 999px;
    display: flex;
    flex-shrink: 0;
    font-size: 20px;
    font-weight: 700;
    justify-content: center;
    min-height: 56px;
    min-width: 56px;
    padding-inline: 8px;
  }
  .confirm-question {
    margin-top: 16px;
  }
  .confirm-question + .confirm {
    margin-top: 8px;
  }
  .row.end {
    align-items: flex-end;
  }
  .right {
    text-align: right;
  }
  .right-icon {
    justify-content: flex-end;
  }
  .stack.tight {
    gap: 8px;
  }
  .node {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ring {
    align-items: center;
    border: 2px solid currentColor;
    border-radius: 50%;
    display: flex;
    height: 56px;
    justify-content: center;
    width: 56px;
  }
  .tone-glow {
    color: var(--octa-theme-glow, #ffc107);
  }
  .tone-muted {
    color: var(--secondary-text-color);
  }
  .tone-primary {
    color: var(--primary-color);
  }
  .node-value {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .node-label {
    color: var(--secondary-text-color);
    font-size: 10px;
  }
  .flow-row {
    align-items: center;
    display: flex;
    justify-content: space-between;
  }
  .flow {
    animation: octa-flow 1s linear infinite;
    background: repeating-linear-gradient(90deg, var(--primary-color) 0 6px, transparent 6px 12px);
    background-size: 24px 100%;
    flex: 1;
    height: 2px;
  }
  .flow.vertical {
    background: repeating-linear-gradient(180deg, var(--primary-color) 0 6px, transparent 6px 12px);
    background-size: 100% 24px;
    height: 16px;
    margin-inline: auto;
    width: 2px;
  }
  @keyframes octa-flow {
    to {
      background-position: 24px 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flow,
    .pulse.on {
      animation: none;
    }
  }
  .solid-pill,
  .solid,
  .status-bar {
    color: var(--text-primary-color);
    font-weight: 600;
  }
  .ok {
    background: var(--primary-color);
  }
  .bad {
    background: var(--error-color);
  }
  .solid-pill {
    border-radius: 999px;
    display: inline-block;
    font-size: 14px;
    line-height: 20px;
    padding: 8px 16px;
  }
  .solid {
    align-items: center;
    border: 0;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    font: inherit;
    font-weight: 600;
    gap: 8px;
    justify-content: center;
    min-height: 48px;
    width: 100%;
  }
  .solid:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .solid:focus-visible {
    outline: 2px solid var(--primary-text-color);
    outline-offset: 2px;
  }
  .centered {
    text-align: center;
  }
  .status-bar {
    align-items: center;
    border-radius: 20px;
    display: flex;
    font-size: 14px;
    gap: 6px;
    justify-content: center;
    line-height: 20px;
    padding: 4px;
  }
  .pulse {
    background: color-mix(in oklab, var(--secondary-text-color) 40%, transparent);
    border-radius: 50%;
    flex-shrink: 0;
    height: 16px;
    width: 16px;
  }
  .pulse.on {
    animation: octa-pulse 2s ease-in-out infinite;
    background: var(--error-color);
  }
  @keyframes octa-pulse {
    50% {
      opacity: 0.5;
    }
  }
  .strong {
    font-weight: 600;
  }
  .avatar {
    align-items: center;
    background: var(--primary-color);
    border-radius: 50%;
    color: var(--text-primary-color);
    display: flex;
    flex-shrink: 0;
    font-size: 18px;
    font-weight: 700;
    height: 48px;
    justify-content: center;
    object-fit: cover;
    width: 48px;
  }
  .frame {
    aspect-ratio: 16 / 9;
    background: var(--octa-theme-well, rgb(0 0 0 / 0.08));
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }
  .frame octa-camera-image {
    display: block;
    height: 100%;
  }
  .frame-empty {
    align-items: center;
    color: var(--secondary-text-color);
    display: flex;
    height: 100%;
    justify-content: center;
  }
  .tag {
    background: var(--card-background-color, #fff);
    border-radius: 4px;
    color: var(--primary-text-color);
    font-size: 10px;
    font-weight: 600;
    left: 8px;
    padding: 2px 8px;
    position: absolute;
    top: 8px;
  }
  .tag.rec,
  .tag.alarm {
    background: var(--error-color);
    color: var(--text-primary-color);
  }
  .tag.rec {
    left: auto;
    right: 8px;
  }
  .tag.alarm {
    bottom: 8px;
    top: auto;
  }
  .pad {
    display: grid;
    gap: 4px;
    grid-template-columns: repeat(3, 44px);
    justify-content: center;
  }
  .media {
    align-items: center;
    display: flex;
    gap: 12px;
  }
  .art {
    background: linear-gradient(180deg, var(--octa-theme-fill-top, var(--primary-color)), var(--octa-theme-fill-bottom, var(--primary-color)));
    border-radius: 20px;
    flex-shrink: 0;
    height: 64px;
    object-fit: cover;
    width: 64px;
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .track,
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .track {
    font-weight: 600;
  }
  .art.empty {
    display: grid;
    place-items: center;
    color: #fff;
  }
  .contact-grid {
    display: grid;
    gap: 12px 8px;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  }
  .contact-tile {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    text-align: center;
  }
  .contact-tile svg {
    color: var(--primary-color);
  }
  .contact-tile.open svg {
    color: var(--octa-danger);
  }
  .contact-tile.unknown svg {
    color: var(--disabled-text-color, currentColor);
    opacity: 0.5;
  }
  .contact-tile .ellipsis {
    max-width: 100%;
  }
  .room-head {
    align-items: flex-start;
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }
  .room-head .contact-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    justify-content: flex-end;
    margin-inline-start: auto;
    min-width: 0;
  }
  .room-head .contact-tile {
    max-width: 72px;
  }
  .room-climate {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: auto 1fr auto;
    text-align: center;
  }
  .room-target {
    justify-self: center;
    white-space: nowrap;
  }
  .room-lights {
    display: grid;
    gap: 14px 8px;
    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
    padding-block: 7px;
  }
  .room-lights octa-button::part(button) {
    width: 100%;
  }
  .room-light-label {
    align-items: center;
    display: inline-flex;
    gap: 6px;
    justify-content: center;
    max-width: 100%;
    min-width: 0;
  }
  .room-media {
    border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.25));
    padding-top: 12px;
  }
  .room-media .ellipsis {
    min-width: 0;
  }
  .stale-tag {
    display: none;
  }
  octa-camera-image[stale] {
    filter: grayscale(1);
    opacity: 0.55;
  }
  octa-camera-image[stale] ~ .primary-tag {
    display: none;
  }
  octa-camera-image[stale] ~ .stale-tag {
    display: inline-block;
  }
  .speak {
    align-items: center;
    display: flex;
    gap: 8px;
  }
  .speak .field {
    flex: 1;
    min-width: 0;
  }
  .player-controls {
    justify-content: center;
  }
  .controls.top {
    margin-top: 8px;
  }
  .led.tight-gap {
    gap: 12px;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .number {
    font-variant-numeric: tabular-nums;
    text-align: right;
    width: 32px;
  }
  .remote {
    align-items: center;
    display: flex;
    gap: 8px;
    justify-content: space-around;
  }
  .rocker {
    align-items: center;
    background: var(--octa-theme-well-soft, var(--octa-theme-well, rgb(0 0 0 / 0.06)));
    border-radius: 999px;
    border-top: 2px solid var(--octa-theme-shade-dark, transparent);
    box-shadow: var(--octa-theme-shadow-inset, none);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
  }
  .rocker-label {
    color: var(--secondary-text-color);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .muted-text {
    color: var(--secondary-text-color);
  }
  .forecast {
    display: grid;
    gap: 4px;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin-top: 4px;
    text-align: center;
  }
  .status-dot {
    border-radius: 50%;
    display: inline-block;
    height: 10px;
    width: 10px;
  }
  .field {
    background: var(--octa-theme-well-soft, var(--octa-theme-well, transparent));
    border: 0;
    border-radius: 12px;
    border-top: 2px solid var(--octa-theme-shade-dark, transparent);
    box-shadow: var(--octa-theme-shadow-inset, none);
    box-sizing: border-box;
    color: var(--primary-text-color);
    font: inherit;
    font-size: 14px;
    min-height: 44px;
    padding: 8px 12px;
    width: 100%;
  }
  .field.narrow {
    flex-shrink: 0;
    width: 80px;
  }
  .field.large {
    font-size: 24px;
  }
  .field:focus-visible,
  .press:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .press {
    align-items: center;
    background: linear-gradient(180deg, var(--octa-theme-loud-top, var(--primary-color)), var(--octa-theme-loud-bottom, var(--primary-color)));
    border: 0;
    border-radius: 12px;
    color: var(--text-primary-color);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: 4px;
    padding-block: 20px;
    width: 100%;
  }
  .press:active:not(:disabled) {
    transform: scale(0.95);
  }
  .press:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .press-note {
    font-size: 12px;
  }
  .with-icon {
    align-items: center;
    display: inline-flex;
    gap: 8px;
  }
  .bar {
    background: var(--octa-theme-well, rgb(0 0 0 / 0.08));
    border-radius: 999px;
    height: 8px;
    overflow: hidden;
  }
  .bar span {
    background: var(--octa-theme-fill-bottom, var(--primary-color));
    border-radius: 999px;
    display: block;
    height: 100%;
  }
  .bar.warning span {
    background: var(--warning-color);
  }
  .bar.danger span {
    background: var(--error-color);
  }
  .body {
    font-size: 14px;
    line-height: 20px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
  }
  .led {
    align-items: center;
    display: flex;
    gap: 16px;
  }
  input[type='color'] {
    background: transparent;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    flex-shrink: 0;
    height: 64px;
    padding: 0;
    width: 64px;
  }
  input[type='color']::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  input[type='color']::-webkit-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  input[type='color']::-moz-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatches button {
    border: 0;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--octa-theme-shade-dark, rgb(0 0 0 / 0.15));
    cursor: pointer;
    height: 24px;
    padding: 0;
    width: 24px;
  }
  .swatches button:disabled,
  input[type='color']:disabled {
    cursor: not-allowed;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    align-items: center;
    background: var(--octa-theme-well, rgb(0 0 0 / 0.08));
    border-radius: 999px;
    color: var(--secondary-text-color);
    display: inline-flex;
    font-size: 12px;
    gap: 4px;
    line-height: 16px;
    padding: 4px 8px;
  }
  .chip.on {
    background: color-mix(in oklab, var(--octa-theme-glow, #ffc107) 20%, transparent);
    color: var(--primary-text-color);
  }
  .confirm {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  octa-switch {
    margin-block: -4px;
  }
  octa-slider {
    margin-block: -10px;
  }
`;

/** A confirmation must not wait around for someone else to press it later. */
const CONFIRM_TIMEOUT_MS = 15000;
const HISTORY_HOURS = 24;
const HISTORY_REFRESH_MS = 300000;

const editorLabels: Record<string, [string, string]> = {
  entity: ['Entity', 'Entity'],
  name: ['Name', 'Name'],
  variant: ['Variante', 'Variant'],
  appearance: ['Stil', 'Style'],
  min: ['Minimum', 'Minimum'],
  max: ['Maximum', 'Maximum'],
  warning: ['Warnung ab', 'Warning from'],
  danger: ['Kritisch ab', 'Critical from'],
  stations: ['Sender', 'Stations'],
  remote_apps: ['App-Knöpfe', 'App buttons'],
  sensors: ['Sensoren', 'Sensors'],
  windows: ['Fenster', 'Windows'],
  lights: ['Licht und Schalter', 'Lights and switches'],
  remote_keys: ['Tastencodes (YAML)', 'Key codes (YAML)'],
  containers: ['Container', 'Containers'],
};

function pickEntity(hass: HassLike | undefined, domains: readonly string[], fallback: string): string {
  const ids = Object.keys(hass?.states ?? {});
  return ids.find((id) => domains.includes(id.split('.')[0] as string)) ?? fallback;
}

/** Creates the custom element of a widget: configuration, updates, state matrix and command handling. */
export function createCardElement<ViewModel>(widget: WidgetDefinition<ViewModel>): CustomElementConstructor {
  const domains = widget.spec.roles.main?.domains ?? [];
  const extraRoles = Object.keys(widget.spec.roles).filter((role) => role !== 'main');

  return class extends LitElement {
    static override properties: PropertyDeclarations = {
      hass: { attribute: false },
      port: { attribute: false },
      preview: { type: Boolean },
      config: { state: true },
      pending: { state: true },
      busy: { state: true },
      history: { state: true },
      forecast: { state: true },
      selection: { state: true },
    };

    static override styles = cardStyles;

    hass: HassLike | undefined;
    /** Replaces `hass` outside of Home Assistant, for example in the gallery. */
    port: HassPort | undefined;
    /** Set by HA while the card is shown in the card picker or editor. Actions are off then. */
    preview = false;
    config: CardConfig | undefined;
    pending: ServiceCommand | undefined;
    busy = false;
    history: HistoryPoint[] = [];
    forecast: ForecastEntry[] = [];
    selection: string | undefined;
    private historyTimer: ReturnType<typeof setInterval> | undefined;
    private historyLoaded = false;
    private confirmTimer: ReturnType<typeof setTimeout> | undefined;
    /** Timers can stand still while a phone sleeps, the clock cannot. */
    private confirmDeadline = 0;
    private runningCommands = 0;
    private historyRequest = 0;
    private readonly dropPendingWhenHidden = (): void => {
      if (document.hidden) this.setPending(undefined);
    };

    static getStubConfig(hass?: HassLike): Record<string, unknown> {
      return { entity: pickEntity(hass, domains, `${domains[0] ?? 'light'}.example`) };
    }

    static getConfigForm(): Record<string, unknown> {
      const german = document.documentElement.lang.startsWith('de');
      const { variants } = widget.spec;
      const editorFields = widget.editor?.(german) ?? [];
      return {
        schema: [
          { name: 'entity', required: widget.spec.roles.main?.required === true, selector: { entity: { domain: [...domains] } } },
          { name: 'name', selector: { text: {} } },
          ...(extraRoles.length > 0
            ? [{ type: 'expandable', name: 'roles', title: german ? 'Weitere Entities' : 'More entities', schema: extraRoles.map((role) => ({ name: role, selector: { entity: { domain: [...(widget.spec.roles[role]?.domains ?? domains)] } } })) }]
            : []),
          ...(variants.length > 1 ? [{ name: 'variant', selector: { select: { options: [...variants] } } }] : []),
          { name: 'appearance', selector: { select: { options: ['soft', 'flat'] } } },
          ...editorFields,
          ...(widget.spec.extras ?? []).filter((name) => !editorFields.some((field) => field.name === name) && !widget.editorHidden?.includes(name)).map((name) => ({ name, selector: { object: {} } })),
          ...(widget.spec.options ?? []).map((name) => ({ name, selector: { number: { mode: 'box', step: 'any' } } })),
        ],
        computeLabel: (field: { name: string }) => (field.name === 'entity' ? widget.entityLabel : undefined)?.[german ? 0 : 1] ?? editorLabels[field.name]?.[german ? 0 : 1] ?? field.name,
      };
    }

    setConfig(raw: unknown): void {
      const result = parseCardConfig(raw, widget.spec);
      if (!result.ok) throw new Error(result.issues.map((issue) => `${issue.path || 'config'}: ${issue.code}`).join(', '));
      const previousEntity = this.entityId;
      this.config = result.config;
      this.setPending(undefined);
      if (this.entityId !== previousEntity) this.resetHistory();
    }

    private resetHistory(): void {
      clearInterval(this.historyTimer);
      this.historyTimer = undefined;
      this.historyLoaded = false;
      this.historyRequest += 1;
      this.history = [];
      this.forecast = [];
    }

    getCardSize(): number {
      return 3;
    }

    getGridOptions(): Record<string, unknown> {
      const { columns } = widget;
      return { columns: typeof columns === 'function' ? columns(this.config?.variant ?? widget.spec.defaultVariant) : columns, rows: 'auto', min_columns: 6 };
    }

    override connectedCallback(): void {
      super.connectedCallback();
      document.addEventListener('visibilitychange', this.dropPendingWhenHidden);
    }

    override disconnectedCallback(): void {
      super.disconnectedCallback();
      document.removeEventListener('visibilitychange', this.dropPendingWhenHidden);
      clearInterval(this.historyTimer);
      this.setPending(undefined);
      this.historyTimer = undefined;
      this.historyLoaded = false;
    }

    private async loadHistory(): Promise<void> {
      const port = this.activePort;
      if (!port || !this.config) return;
      this.historyRequest += 1;
      const request = this.historyRequest;
      let history: HistoryPoint[] = [];
      let forecast: ForecastEntry[] = [];
      try {
        if (widget.needsForecast) forecast = await this.loadForecast(port);
        else history = await port.fetchHistory(this.entityId, HISTORY_HOURS);
      } catch {
        // An empty chart is the failure state.
      }
      if (request !== this.historyRequest) return;
      this.history = history;
      this.forecast = forecast;
    }

    private async loadForecast(port: HassPort): Promise<ForecastEntry[]> {
      const entity = port.getEntity(this.entityId);
      if (!entity) return [];
      const type = supports(entity, 'weather', 'FORECAST_DAILY') ? 'daily' : supports(entity, 'weather', 'FORECAST_TWICE_DAILY') ? 'twice_daily' : supports(entity, 'weather', 'FORECAST_HOURLY') ? 'hourly' : null;
      return type ? port.fetchForecast(this.entityId, type) : [];
    }

    protected override updated(): void {
      if (this.historyLoaded || !this.config || !this.activePort || !(widget.needsForecast || widget.needsHistory?.(this.config.variant))) return;
      this.historyLoaded = true;
      void this.loadHistory();
      this.historyTimer = setInterval(() => void this.loadHistory(), HISTORY_REFRESH_MS);
    }

    private get activePort(): HassPort | undefined {
      return this.port ?? (this.hass ? createHassPort(this.hass, this) : undefined);
    }

    private get entityId(): string {
      const roles = this.config?.roles ?? {};
      return roles.main ?? Object.values(roles)[0] ?? '';
    }

    /** HA replaces `hass` on every state change anywhere, so only the own entity may trigger a render. */
    protected override shouldUpdate(changed: PropertyValues): boolean {
      if (changed.size !== 1 || !changed.has('hass')) return true;
      const previous = changed.get('hass') as HassLike | undefined;
      if (previous?.language !== this.hass?.language) return true;
      const watched = [...Object.values(this.config?.roles ?? {}), ...(this.config ? (widget.watch?.(this.config) ?? []) : [])];
      return watched.some((id) => previous?.states[id] !== this.hass?.states[id]) || this.isGroupChanged(previous);
    }

    /** A light group lists its members in an attribute, their changes must reach the chips too. */
    private isGroupChanged(previous: HassLike | undefined): boolean {
      const members = this.hass?.states[this.entityId]?.attributes.entity_id;
      return Array.isArray(members) && members.some((id: string) => previous?.states[id] !== this.hass?.states[id]);
    }

    private setPending(command: ServiceCommand | undefined): void {
      clearTimeout(this.confirmTimer);
      this.pending = command;
      if (!command) return;
      this.confirmDeadline = Date.now() + CONFIRM_TIMEOUT_MS;
      this.confirmTimer = setTimeout(() => (this.pending = undefined), CONFIRM_TIMEOUT_MS);
    }

    /** The prompt goes away before anything is sent, so a double tap cannot send the command twice. */
    private confirmPending(): void {
      const command = this.pending;
      const inTime = Date.now() <= this.confirmDeadline;
      this.setPending(undefined);
      if (command && inTime) void this.send(command, true);
    }

    /** What was to be confirmed no longer applies once the device has changed. */
    protected override willUpdate(changed: PropertyValues): void {
      if (!this.pending || !changed.has('hass')) return;
      const previous = changed.get('hass') as HassLike | undefined;
      if (!previous) return;
      // Attributes such as the battery level change all the time and say nothing about the action.
      const before = previous.states[this.pending.entityId];
      const now = this.hass?.states[this.pending.entityId];
      if (before?.state !== now?.state || before?.attributes.current_position !== now?.attributes.current_position) this.setPending(undefined);
    }

    private async send(command: ServiceCommand, confirmed: boolean): Promise<CommandResult | undefined> {
      const port = this.activePort;
      if (!port || this.preview) return undefined;
      const pendingBefore = this.pending;
      this.runningCommands += 1;
      this.busy = true;
      const result = await executeCommand(port, command, { confirmed });
      this.runningCommands -= 1;
      this.busy = this.runningCommands > 0;
      if (result === 'needs_confirmation') this.setPending(command);
      // A question asked while this command was running belongs to a newer tap.
      else if (this.pending === pendingBefore) this.setPending(undefined);
      return result;
    }

    private async sendAll(commands: ServiceCommand[]): Promise<void> {
      for (const command of commands) if ((await this.send(command, false)) !== 'sent') return;
    }

    private confirmation(port: HassPort, appearance: CardConfig['appearance']): TemplateResult | typeof nothing {
      const pending = this.pending;
      if (!pending) return nothing;
      const { language } = port;
      const name = (pending.entityId === this.entityId ? this.config?.name : undefined) ?? normalizeEntity(port, pending.entityId).name;
      return html`<div class="small confirm-question">${confirmationText(language, pending, name)}</div>
        <div class="confirm">
        <octa-button .appearance=${appearance} tone="danger" @click=${() => this.confirmPending()}>${translate(language, 'confirm')}</octa-button>
        <octa-button .appearance=${appearance} @click=${() => this.setPending(undefined)}>${translate(language, 'cancel')}</octa-button>
      </div>`;
    }

    protected override render(): TemplateResult | typeof nothing {
      const port = this.activePort;
      const config = this.config;
      if (!port || !config) return nothing;

      const aggregate = typeof widget.aggregate === 'function' ? widget.aggregate(config) : widget.aggregate === true;
      const target = normalizeEntity(port, this.entityId);
      const title = config.name ?? widget.defaultTitle?.(port.language, config.variant) ?? target.name;
      const { appearance } = config;

      if (target.status === 'missing' && !aggregate) {
        return html`<octa-surface .appearance=${appearance}>
          <octa-status .appearance=${appearance} kind="missing" .text=${target.stateLabel}></octa-status>
        </octa-surface>`;
      }

      const context: RenderContext = {
        appearance,
        disabled: !aggregate && target.status === 'unavailable',
        busy: this.busy,
        language: port.language,
        selection: this.selection,
        select: (value) => (this.selection = value),
        run: (command, options) => void this.send(command, options?.confirmed === true),
        runAll: (commands) => void this.sendAll(commands),
      };
      const unavailable = !aggregate && target.status === 'unavailable';
      return html`<octa-surface .appearance=${appearance} .unavailable=${unavailable}>
        <div class="label">${title}</div>
        ${unavailable ? html`<octa-status .appearance=${appearance} kind="unavailable" .text=${target.stateLabel}></octa-status>` : widget.render(widget.toViewModel(target, config, port, this.history, this.forecast), context)}
        ${this.confirmation(port, appearance)}
      </octa-surface>`;
    }
  };
}

declare global {
  interface Window {
    customCards?: { type: string; name: string; description: string; preview: boolean }[];
  }
}

export function registerWidget<ViewModel>(widget: WidgetDefinition<ViewModel>): void {
  if (customElements.get(widget.element)) return;
  customElements.define(widget.element, createCardElement(widget));
  (window.customCards ??= []).push({ type: widget.element, name: widget.name, description: widget.description, preview: true });
}
