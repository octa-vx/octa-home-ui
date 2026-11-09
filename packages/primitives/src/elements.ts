import { css, html, nothing, svg, type PropertyDeclarations, type TemplateResult } from 'lit';
import { baseStyles, define, OctaElement } from './base.ts';
import { ValueControl } from './value-control.ts';
import { angleFromPoint, arcPath, DIAL_START, DIAL_SWEEP, isWrapJump, polarPoint, ratioFromAngle, ratioOf, valueFromRatio } from './interaction.ts';

const edge = css`
  .edge {
    border: 1px solid var(--octa-outline);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
  }
  :host([appearance='soft']) .edge {
    box-shadow: var(--octa-shadow-raised);
  }
`;

export class OctaSurface extends OctaElement {
  static override properties: PropertyDeclarations = {
    ...OctaElement.properties,
    tone: { type: String, reflect: true },
    unavailable: { type: Boolean, reflect: true },
  };

  static override styles = [
    baseStyles,
    edge,
    css`
      :host {
        display: block;
      }
      .surface {
        background: var(--octa-surface);
        border-radius: var(--octa-radius-card);
        padding: var(--octa-space-card);
        height: 100%;
      }
      :host([tone='well']) .surface {
        background: var(--octa-well);
        box-shadow: none;
      }
      :host([appearance='soft']) .surface.edge {
        border: 0;
      }
      :host([appearance='soft'][tone='well']) .surface.edge {
        background: var(--octa-well-soft);
        border-top: 2px solid var(--octa-shade-dark);
        box-shadow: var(--octa-shadow-inset);
      }
      /* Dimmed through color, because opacity would break text contrast. */
      :host([unavailable]) .surface {
        --octa-text: var(--octa-text-muted);
        --octa-accent: var(--octa-text-muted);
        background: var(--octa-well);
        box-shadow: none;
        color: var(--octa-text-muted);
      }
    `,
  ];

  tone: 'raised' | 'well' = 'raised';
  unavailable = false;

  override render(): TemplateResult {
    return html`<div class="surface edge" part="surface"><slot></slot></div>`;
  }
}

export class OctaButton extends OctaElement {
  static override shadowRootOptions = { ...OctaElement.shadowRootOptions, delegatesFocus: true };

  static override properties: PropertyDeclarations = {
    ...OctaElement.properties,
    label: { type: String },
    tone: { type: String, reflect: true },
    active: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
  };

  static override styles = [
    baseStyles,
    edge,
    css`
      :host {
        display: inline-block;
      }
      button {
        align-items: center;
        background: var(--octa-surface);
        border-radius: var(--octa-radius-control);
        color: var(--octa-text);
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-weight: 600;
        gap: calc(var(--octa-space) * 2);
        justify-content: center;
        min-height: var(--octa-target);
        min-width: var(--octa-target);
        padding: 0 calc(var(--octa-space) * 4);
        transition: background var(--octa-duration), color var(--octa-duration);
      }
      button:disabled {
        background: var(--octa-well);
        box-shadow: none;
        color: var(--octa-text-muted);
        cursor: not-allowed;
      }
      :host([active]) button {
        background: var(--octa-accent);
        color: var(--octa-on-accent);
      }
      :host([tone='danger']) button {
        color: var(--octa-danger);
      }
      :host([busy]) button {
        cursor: progress;
      }
      :host([appearance='soft']) button.edge {
        border-radius: var(--octa-radius-pill);
        font-size: 0.875rem;
        background: var(--octa-knob);
        border-color: var(--octa-edge);
        box-shadow: var(--octa-shadow-knob);
      }
      :host([appearance='soft'][active]) button.edge {
        background: var(--octa-knob);
        border: 0;
        box-shadow: var(--octa-shadow-pressed);
        color: var(--octa-accent);
      }
      :host([appearance='soft']) button.edge:active:not(:disabled) {
        box-shadow: var(--octa-shadow-pressed);
        transform: translateY(1px);
      }
      :host([appearance='soft']) button.edge:disabled {
        background: var(--octa-well);
        border-color: var(--octa-outline);
        box-shadow: none;
      }
    `,
  ];

  /** Accessible name. Required when the slot contains only an icon. */
  label = '';
  tone: 'neutral' | 'danger' = 'neutral';
  active = false;
  disabled = false;
  busy = false;

  override render(): TemplateResult {
    return html`<button
      class="edge"
      type="button"
      part="button"
      ?disabled=${this.disabled}
      aria-busy=${this.busy ? 'true' : nothing}
      aria-label=${this.label || nothing}
    >
      <slot></slot>
    </button>`;
  }
}

export class OctaSwitch extends OctaElement {
  static override shadowRootOptions = { ...OctaElement.shadowRootOptions, delegatesFocus: true };

  static override properties: PropertyDeclarations = {
    ...OctaElement.properties,
    checked: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    label: { type: String },
  };

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }
      button {
        align-items: center;
        background: none;
        border: 0;
        cursor: pointer;
        display: flex;
        height: var(--octa-target);
        padding: 0;
        width: 56px;
      }
      .track {
        background: var(--octa-well);
        border: 1px solid var(--octa-outline);
        border-radius: var(--octa-radius-pill);
        display: block;
        height: 32px;
        position: relative;
        transition: background var(--octa-duration);
        width: 56px;
      }
      .thumb {
        background: var(--octa-text-muted);
        border-radius: 50%;
        height: 24px;
        left: 3px;
        position: absolute;
        top: 3px;
        transition: transform var(--octa-duration), background var(--octa-duration);
        width: 24px;
      }
      :host([checked]) .track {
        background: var(--octa-accent);
        border-color: var(--octa-accent);
      }
      :host([checked]) .thumb {
        background: var(--octa-on-accent);
        transform: translateX(24px);
      }
      button:disabled {
        cursor: not-allowed;
      }
      :host([appearance='soft']) button {
        width: 72px;
      }
      :host([appearance='soft']) .track {
        height: 36px;
        width: 72px;
      }
      :host([appearance='soft']) .thumb {
        height: 28px;
        left: 4px;
        top: 4px;
        width: 28px;
      }
      :host([appearance='soft'][checked]) .thumb {
        transform: translateX(36px);
      }
      :host([appearance='soft']) button:not(:disabled) .track {
        background: var(--octa-well);
        border: 0;
        box-shadow: inset 0 4px 8px var(--octa-shade-darker);
      }
      :host([appearance='soft']) button:not(:disabled) .thumb {
        background: var(--octa-knob);
        border: 1px solid var(--octa-edge);
        box-shadow: var(--octa-shadow-knob);
      }
      :host([appearance='soft'][checked]) button:not(:disabled) .thumb {
        background: var(--octa-fill);
        border: 0;
        box-shadow: 0 3px 6px var(--octa-shade-darker);
      }
      :host button:disabled .track {
        background: var(--octa-well);
        border-color: var(--octa-outline);
        border-style: dashed;
        box-shadow: none;
      }
      :host button:disabled .thumb {
        background: var(--octa-outline);
      }
    `,
  ];

  checked = false;
  disabled = false;
  label = '';

  private onClick = (): void => {
    this.emit('octa-change', { checked: !this.checked });
  };

  override render(): TemplateResult {
    return html`<button
      type="button"
      role="switch"
      aria-checked=${this.checked ? 'true' : 'false'}
      aria-label=${this.label}
      ?disabled=${this.disabled}
      @click=${this.onClick}
    >
      <span class="track"><span class="thumb"></span></span>
    </button>`;
  }
}

const SOFT_THUMB = 24;

export class OctaSlider extends ValueControl {
  static override properties: PropertyDeclarations = {
    ...ValueControl.properties,
    track: { type: String, reflect: true },
  };

  /** `temperature` paints the warm to cool white scale instead of a fill. */
  track: 'default' | 'temperature' = 'default';

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .root {
        align-items: center;
        cursor: pointer;
        display: flex;
        height: var(--octa-target);
        position: relative;
        touch-action: pan-y;
        user-select: none;
      }
      :host([disabled]) .root {
        cursor: not-allowed;
      }
      .track {
        background: var(--octa-well);
        border: 1px solid var(--octa-outline);
        border-radius: var(--octa-radius-pill);
        height: 12px;
        overflow: hidden;
        width: 100%;
      }
      .fill {
        background: var(--octa-accent);
        height: 100%;
      }
      .thumb {
        background: var(--octa-surface);
        border: 2px solid var(--octa-accent);
        border-radius: 50%;
        height: 28px;
        margin-left: -14px;
        position: absolute;
        top: 8px;
        width: 28px;
      }
      :host([disabled]) .fill {
        background: var(--octa-outline);
      }
      :host([disabled]) .thumb {
        border-color: var(--octa-outline);
      }
      :host([appearance='soft']) .track {
        border: 0;
        box-shadow: var(--octa-shadow-track);
        height: 10px;
      }
      :host([appearance='soft']) .fill,
      :host([track='temperature']) .fill {
        display: none;
      }
      :host([track='temperature']) .track {
        background: linear-gradient(90deg, oklch(0.8 0.14 60), oklch(0.97 0 0), oklch(0.82 0.08 230));
      }
      :host([appearance='soft']) .thumb {
        height: 24px;
        margin-left: -12px;
        top: 10px;
        width: 24px;
      }
      :host([appearance='soft']:not([disabled])) .thumb {
        background: var(--octa-knob);
        border: 0;
        box-shadow: 0 3px 6px var(--octa-shade-darker), inset 0 2px 2px var(--octa-shade-light);
      }
    `,
  ];

  /** In the soft style the thumb stops at the track ends instead of overhanging them. */
  private get inset(): number {
    return this.appearance === 'soft' ? SOFT_THUMB / 2 : 0;
  }

  private valueAt(event: PointerEvent): number {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    return valueFromRatio((event.clientX - box.left - this.inset) / (box.width - 2 * this.inset), this.min, this.max, this.step);
  }

  private onDown = (event: PointerEvent): void => this.dragStart(event, this.valueAt(event));
  private onMove = (event: PointerEvent): void => {
    if (this.dragging) this.dragMove(this.valueAt(event));
  };

  override render(): TemplateResult {
    const ratio = ratioOf(this.displayValue, this.min, this.max);
    const percent = ratio * 100;
    const inset = this.inset;
    return html`<div
      class="root"
      @pointerdown=${this.onDown}
      @pointermove=${this.onMove}
      @pointerup=${this.dragEnd}
      @pointercancel=${this.dragCancel}
    >
      <div class="track"><div class="fill" style="width:${percent}%"></div></div>
      <div
        class="thumb"
        style="left:calc(${inset}px + (100% - ${2 * inset}px) * ${ratio})"
        role="slider"
        tabindex=${this.disabled ? -1 : 0}
        aria-label=${this.label}
        aria-valuemin=${this.min}
        aria-valuemax=${this.max}
        aria-valuenow=${this.displayValue}
        aria-valuetext=${this.valueText}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        @keydown=${this.onKeyDown}
      ></div>
    </div>`;
  }
}

const arcStyles = css`
  svg {
    display: block;
    height: auto;
    width: 100%;
  }
  .track-edge,
  .track,
  .value {
    fill: none;
    stroke-linecap: round;
  }
  .track-edge {
    stroke: var(--octa-outline);
    stroke-width: 16;
  }
  .track {
    stroke: var(--octa-well);
    stroke-width: 14;
  }
  .value {
    stroke: var(--octa-accent);
    stroke-width: 14;
  }
  .number {
    fill: var(--octa-text);
    font-size: 36px;
    font-weight: 700;
    text-anchor: middle;
  }
  .caption {
    fill: var(--octa-text-muted);
    font-size: 15px;
    text-anchor: middle;
  }
`;

const RADIUS = 80;
const arcEnd = DIAL_START + DIAL_SWEEP;

function arcTemplate(ratio: number, number: string, caption: string, thumb: boolean): TemplateResult {
  const angle = DIAL_START + ratio * DIAL_SWEEP;
  const [thumbX, thumbY] = polarPoint(RADIUS, angle);
  return html`<svg viewBox="0 0 200 180" aria-hidden="true" focusable="false">
    ${svg`
      <path class="track-edge" d=${arcPath(RADIUS, DIAL_START, arcEnd)}></path>
      <path class="track" d=${arcPath(RADIUS, DIAL_START, arcEnd)}></path>
      ${ratio > 0 ? svg`<path class="value" d=${arcPath(RADIUS, DIAL_START, angle)}></path>` : nothing}
      ${thumb ? svg`<circle class="thumb" cx=${thumbX} cy=${thumbY} r="13"></circle>` : nothing}
      <text class="number" x="100" y="105">${number}</text>
      <text class="caption" x="100" y="130">${caption}</text>
    `}
  </svg>`;
}

export class OctaDial extends ValueControl {
  static override properties: PropertyDeclarations = {
    ...ValueControl.properties,
    note: { type: String },
    hint: { type: String },
  };

  static override styles = [
    baseStyles,
    arcStyles,
    css`
      :host {
        display: block;
        max-width: 240px;
      }
      .root {
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      :host([disabled]) .root {
        cursor: not-allowed;
      }
      .thumb {
        fill: var(--octa-surface);
        stroke: var(--octa-accent);
        stroke-width: 3;
      }
      :host([disabled]) .value,
      :host([disabled]) .thumb {
        stroke: var(--octa-outline);
      }
      :host([appearance='soft']) {
        container-type: inline-size;
        max-width: none;
      }
      @container (max-width: 235px) {
        :host([appearance='soft']) .root {
          flex-direction: column;
        }
      }
      :host([appearance='soft']) .root {
        align-items: center;
        cursor: default;
        display: flex;
        gap: calc(var(--octa-space) * 4);
        justify-content: space-around;
        touch-action: pan-y;
      }
      .well {
        background: var(--octa-well-soft);
        border-radius: 50%;
        border-top: 2px solid var(--octa-shade-dark);
        box-shadow: var(--octa-shadow-inset);
        cursor: grab;
        display: grid;
        height: 144px;
        min-width: 132px;
        place-items: center;
        touch-action: none;
        width: 144px;
      }
      .well:active {
        cursor: grabbing;
      }
      :host([disabled]) .well {
        cursor: not-allowed;
      }
      .knob {
        background: var(--octa-knob);
        border: 1px solid var(--octa-edge);
        border-radius: 50%;
        box-shadow: var(--octa-shadow-knob);
        height: 112px;
        position: relative;
        width: 112px;
      }
      :host(:not([disabled])) .well:active .knob {
        box-shadow: var(--octa-shadow-pressed);
      }
      :host([disabled]) .knob {
        background: var(--octa-well);
        box-shadow: none;
      }
      .dot {
        background: var(--octa-heat);
        border-radius: 50%;
        box-shadow: 0 0 18px -4px var(--octa-heat);
        height: 10px;
        left: 50%;
        position: absolute;
        top: 12px;
        transform: translateX(-50%);
        width: 10px;
      }
      :host([disabled]) .dot {
        background: var(--octa-outline);
        box-shadow: none;
      }
      .read {
        text-align: center;
      }
      .big {
        font-size: 2.25rem;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        line-height: 2.5rem;
      }
      .note {
        color: var(--octa-text-muted);
        font-size: 0.75rem;
      }
      .hint {
        color: var(--octa-text-muted);
        font-size: 10px;
        letter-spacing: 0.1em;
        margin-top: var(--octa-space);
        text-transform: uppercase;
      }
    `,
  ];

  /** Soft style: a line under the value, for example the current temperature. */
  note = '';
  /** Soft style: a short operating hint. */
  hint = '';

  private ratio = 0;

  private get well(): Element | null {
    return this.renderRoot.querySelector('.well');
  }

  private ratioAt(event: PointerEvent): number {
    const well = this.well;
    if (well) {
      const center = well.getBoundingClientRect();
      return ratioFromAngle(angleFromPoint(center.left + center.width / 2, center.top + center.height / 2, event.clientX, event.clientY));
    }
    const box = (event.currentTarget as Element).getBoundingClientRect();
    const scale = box.width / 200;
    return ratioFromAngle(angleFromPoint(box.left + 100 * scale, box.top + 100 * scale, event.clientX, event.clientY));
  }

  private onDown = (event: PointerEvent): void => {
    const well = this.well;
    if (well && !event.composedPath().includes(well)) return;
    this.ratio = this.ratioAt(event);
    this.dragStart(event, valueFromRatio(this.ratio, this.min, this.max, this.step));
  };

  private onMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const next = this.ratioAt(event);
    if (isWrapJump(this.ratio, next)) return;
    this.ratio = next;
    this.dragMove(valueFromRatio(next, this.min, this.max, this.step));
  };

  override render(): TemplateResult {
    const ratio = ratioOf(this.displayValue, this.min, this.max);
    return html`<div
      class="root"
      role="slider"
      tabindex=${this.disabled ? -1 : 0}
      aria-label=${this.label}
      aria-valuemin=${this.min}
      aria-valuemax=${this.max}
      aria-valuenow=${this.displayValue}
      aria-valuetext=${this.valueText}
      aria-disabled=${this.disabled ? 'true' : 'false'}
      @keydown=${this.onKeyDown}
      @pointerdown=${this.onDown}
      @pointermove=${this.onMove}
      @pointerup=${this.dragEnd}
      @pointercancel=${this.dragCancel}
    >
      ${this.appearance === 'soft' ? this.softKnob(ratio) : arcTemplate(ratio, String(this.displayValue), this.unit, true)}
    </div>`;
  }

  private softKnob(ratio: number): TemplateResult {
    const angle = ratio * DIAL_SWEEP - DIAL_SWEEP / 2;
    const decimals = Number.isInteger(this.step) ? 0 : 1;
    const unit = this.unit.startsWith('°') ? '°' : this.unit;
    return html`<div class="well"><div class="knob" style="transform:rotate(${angle}deg)"><span class="dot"></span></div></div>
      <div class="read">
        <div class="big">${this.displayValue.toFixed(decimals)}${unit}</div>
        ${this.note ? html`<div class="note">${this.note}</div>` : nothing}
        ${this.hint ? html`<div class="hint">${this.hint}</div>` : nothing}
      </div>`;
  }
}

export class OctaGauge extends OctaElement {
  static override properties: PropertyDeclarations = {
    ...OctaElement.properties,
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    label: { type: String },
    unit: { type: String },
    warning: { type: Number },
    danger: { type: Number },
  };

  static override styles = [
    baseStyles,
    arcStyles,
    css`
      :host {
        display: block;
        max-width: 200px;
      }
      .warning .value {
        stroke: var(--octa-warning);
      }
      .danger .value {
        stroke: var(--octa-danger);
      }
      :host([appearance='soft']) {
        max-width: 176px;
      }
      .soft-track,
      .soft-value {
        fill: none;
        stroke-linecap: round;
        stroke-width: 10;
      }
      .soft-track {
        stroke: var(--octa-well);
      }
      .soft-value {
        stroke: color-mix(in oklab, var(--octa-fill-top), var(--octa-fill-bottom));
      }
      .warning .soft-value {
        stroke: var(--octa-warning);
      }
      .danger .soft-value {
        stroke: var(--octa-danger);
      }
      .soft-number {
        fill: var(--octa-text);
        font-size: 20px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        text-anchor: middle;
      }
    `,
  ];

  /** `null` means no reading is available. */
  value: number | null = null;
  min = 0;
  max = 100;
  label = '';
  unit = '';
  warning: number | undefined;
  danger: number | undefined;

  private get level(): string {
    if (this.value === null) return '';
    if (this.danger !== undefined && this.value >= this.danger) return 'danger';
    if (this.warning !== undefined && this.value >= this.warning) return 'warning';
    return '';
  }

  override render(): TemplateResult {
    const hasValue = this.value !== null;
    return html`<div
      class=${this.level}
      role="meter"
      aria-label=${this.label}
      aria-valuemin=${this.min}
      aria-valuemax=${this.max}
      aria-valuenow=${hasValue ? (this.value as number) : this.min}
      aria-valuetext=${hasValue ? `${this.value} ${this.unit}`.trim() : '–'}
    >
      ${this.appearance === 'soft' ? this.softArc(hasValue) : arcTemplate(hasValue ? ratioOf(this.value as number, this.min, this.max) : 0, hasValue ? String(this.value) : '–', this.unit, false)}
    </div>`;
  }

  private softArc(hasValue: boolean): TemplateResult {
    const path = 'M10 60 A50 50 0 0 1 110 60';
    const ratio = hasValue ? ratioOf(this.value as number, this.min, this.max) : 0;
    return html`<svg viewBox="0 0 120 70" aria-hidden="true" focusable="false">
      ${svg`
        <path class="soft-track" d=${path}></path>
        ${ratio > 0 ? svg`<path class="soft-value" d=${path} stroke-dasharray="${ratio * 157} 157"></path>` : nothing}
        <text class="soft-number" x="60" y="58">${hasValue ? `${this.value}${this.unit}` : '–'}</text>
      `}
    </svg>`;
  }
}

export class OctaPill extends OctaElement {
  static override properties: PropertyDeclarations = {
    ...OctaElement.properties,
    tone: { type: String, reflect: true },
  };

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }
      span {
        align-items: center;
        background: var(--octa-surface);
        border: 1px solid var(--octa-outline);
        border-radius: var(--octa-radius-pill);
        color: var(--octa-text);
        display: inline-flex;
        font-size: 0.875rem;
        font-weight: 600;
        min-height: 28px;
        padding: 0 calc(var(--octa-space) * 3);
      }
      :host([tone='accent']) span {
        background: var(--octa-accent);
        border-color: var(--octa-accent);
        color: var(--octa-on-accent);
      }
      :host([appearance='soft']) span {
        background: var(--octa-knob);
        border-color: var(--octa-edge);
        box-shadow: 0 2px 4px var(--octa-shade-darker);
      }
      :host([appearance='soft'][tone='accent']) span {
        background: var(--octa-loud);
        border-color: transparent;
      }
      :host([tone='warning']) span {
        border-color: var(--octa-warning);
        color: var(--octa-warning);
      }
      :host([tone='danger']) span {
        border-color: var(--octa-danger);
        color: var(--octa-danger);
      }
    `,
  ];

  tone: 'neutral' | 'accent' | 'warning' | 'danger' = 'neutral';

  override render(): TemplateResult {
    return html`<span><slot></slot></span>`;
  }
}

export type StatusKind = 'active' | 'inactive' | 'unavailable' | 'unknown' | 'missing' | 'alert' | 'busy';

/** The glyph differs per state, so the status never depends on color alone. */
const STATUS_GLYPH: Record<StatusKind, string> = {
  active: '●',
  inactive: '○',
  unavailable: '⊘',
  unknown: '?',
  missing: '⚠',
  alert: '!',
  busy: '…',
};

export class OctaStatus extends OctaElement {
  static override properties: PropertyDeclarations = {
    ...OctaElement.properties,
    kind: { type: String, reflect: true },
    text: { type: String },
  };

  static override styles = [
    baseStyles,
    css`
      :host {
        align-items: center;
        color: var(--octa-text-muted);
        display: inline-flex;
        font-size: 0.875rem;
        gap: calc(var(--octa-space) * 2);
      }
      .glyph {
        font-weight: 700;
        text-align: center;
        width: 1em;
      }
      :host([kind='active']) .glyph {
        color: var(--octa-accent);
      }
      :host([kind='missing']),
      :host([kind='alert']) {
        color: var(--octa-danger);
        font-weight: 600;
      }
    `,
  ];

  kind: StatusKind = 'inactive';
  text = '';

  override render(): TemplateResult {
    return html`<span class="glyph" aria-hidden="true">${STATUS_GLYPH[this.kind]}</span><span>${this.text}</span>`;
  }
}

export function registerPrimitives(): void {
  define('octa-surface', OctaSurface);
  define('octa-button', OctaButton);
  define('octa-switch', OctaSwitch);
  define('octa-slider', OctaSlider);
  define('octa-dial', OctaDial);
  define('octa-gauge', OctaGauge);
  define('octa-pill', OctaPill);
  define('octa-status', OctaStatus);
}
