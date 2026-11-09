import type { PropertyDeclarations } from 'lit';
import { OctaElement } from './base.ts';
import { snap, throttle, ValueHold } from './interaction.ts';

const SEND_INTERVAL_MS = 150;

/** Shared behavior of slider and dial: drag with local value, throttled sending, keyboard. */
export abstract class ValueControl extends OctaElement {
  static override properties: PropertyDeclarations = {
    ...OctaElement.properties,
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String },
    unit: { type: String },
    disabled: { type: Boolean, reflect: true },
  };

  value = 0;
  min = 0;
  max = 100;
  step = 1;
  label = '';
  unit = '';
  disabled = false;

  private hold = new ValueHold();
  private releaseTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly sendInput = throttle((value: number) => this.emit('octa-input', { value }), SEND_INTERVAL_MS);

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sendInput.cancel();
    clearTimeout(this.releaseTimer);
  }

  /** The value to show. Only the hold can make this differ from `value`. */
  protected get displayValue(): number {
    return this.hold.read(this.value, Date.now());
  }

  protected get valueText(): string {
    return `${this.displayValue}${this.unit ? ` ${this.unit}` : ''}`;
  }

  protected dragStart(event: PointerEvent, value: number): void {
    if (this.disabled || event.button !== 0) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.hold.begin(value);
    this.sendInput(value);
    this.requestUpdate();
  }

  protected dragMove(value: number): void {
    if (!this.hold.active) return;
    this.hold.move(value);
    this.sendInput(value);
    this.requestUpdate();
  }

  protected get dragging(): boolean {
    return this.hold.active;
  }

  protected dragEnd = (): void => {
    if (!this.hold.active) return;
    this.sendInput.cancel();
    const value = this.displayValue;
    this.finish(value);
  };

  protected dragCancel = (): void => {
    this.sendInput.cancel();
    this.hold.cancel();
    this.requestUpdate();
  };

  private finish(value: number): void {
    this.hold.end(Date.now());
    this.emit('octa-change', { value });
    this.requestUpdate();
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => this.requestUpdate(), this.hold.holdMs + 20);
  }

  protected onKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled) return;
    const current = this.displayValue;
    const page = this.step * 10;
    const targets: Record<string, number> = {
      ArrowRight: current + this.step,
      ArrowUp: current + this.step,
      ArrowLeft: current - this.step,
      ArrowDown: current - this.step,
      PageUp: current + page,
      PageDown: current - page,
      Home: this.min,
      End: this.max,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const value = snap(target, this.min, this.max, this.step);
    this.hold.begin(value);
    this.finish(value);
  };
}
