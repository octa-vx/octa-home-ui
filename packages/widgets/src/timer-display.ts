import { LitElement, css, html, type PropertyDeclarations, type TemplateResult } from 'lit';

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${pad(minutes)}:${pad(seconds % 60)}`;
}

/** `H:MM:SS` as HA reports durations, in seconds. */
export function parseDuration(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const parts = value.split(':').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return 0;
  return (parts[0] as number) * 3600 + (parts[1] as number) * 60 + (parts[2] as number);
}

/** Counts down on its own, because HA only reports the end time of a running timer. */
export class OctaTimerDisplay extends LitElement {
  static override properties: PropertyDeclarations = {
    finishesAt: { attribute: false },
    seconds: { attribute: false },
    now: { state: true },
  };

  static override styles = css`
    :host {
      font-size: 36px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      line-height: 40px;
    }
  `;

  /** Set while the timer runs. */
  finishesAt: string | null = null;
  /** Shown while the timer is idle or paused. */
  seconds = 0;
  private now = Date.now();
  private ticker: ReturnType<typeof setInterval> | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.ticker = setInterval(() => {
      if (this.finishesAt) this.now = Date.now();
    }, 1000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this.ticker);
  }

  protected override render(): TemplateResult {
    const left = this.finishesAt ? (Date.parse(this.finishesAt) - this.now) / 1000 : this.seconds;
    return html`${formatDuration(left)}`;
  }
}
