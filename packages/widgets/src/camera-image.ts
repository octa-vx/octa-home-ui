import { LitElement, css, html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit';

const SNAPSHOT_INTERVAL_MS = 10000;
const RETRY_MS = 3000;

const streamUrl = (picture: string): string => picture.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
const freshUrl = (picture: string): string => `${picture}${picture.includes('?') ? '&' : '?'}t=${Date.now()}`;

/**
 * Shows a camera image. The token inside the address changes regularly, so the address is always
 * taken from the current state. A frame stays visible until its replacement has loaded.
 */
/** Two misses in a row, so a single dropped request or a rotating token is not reported as an outage. */
const STALE_AFTER_FAILURES = 2;
/** A stream can simply freeze without an error, so its source is checked separately. */
const STREAM_CHECK_MS = 15000;

export class OctaCameraImage extends LitElement {
  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    live: { type: Boolean },
    label: { attribute: false },
    stale: { type: Boolean, reflect: true },
    shown: { state: true },
  };

  static override styles = css`
    img {
      display: block;
      height: 100%;
      object-fit: cover;
      width: 100%;
    }
  `;

  picture = '';
  /** Keeps one stream open instead of refreshing still images. */
  live = false;
  label = '';
  /** The picture on screen is no longer current because the camera stopped answering. */
  stale = false;
  private shown = '';
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private streamCheck: ReturnType<typeof setTimeout> | undefined;
  private started = false;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.timer);
    clearTimeout(this.streamCheck);
    this.started = false;
    this.shown = '';
    this.failures = 0;
    this.stale = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.picture) this.start();
  }

  protected override updated(): void {
    if (this.picture && !this.started) this.start();
  }

  private start(): void {
    this.started = true;
    if (this.live) {
      this.shown = streamUrl(this.picture);
      this.scheduleStreamCheck();
    } else this.refresh();
  }

  private report(ok: boolean): void {
    this.failures = ok ? 0 : this.failures + 1;
    this.stale = this.failures >= STALE_AFTER_FAILURES;
  }

  private scheduleStreamCheck(): void {
    clearTimeout(this.streamCheck);
    this.streamCheck = setTimeout(() => {
      const probe = new Image();
      probe.onload = () => this.report(true);
      probe.onerror = () => this.report(false);
      probe.src = freshUrl(this.picture);
      this.scheduleStreamCheck();
    }, STREAM_CHECK_MS);
  }

  private refresh(): void {
    const url = freshUrl(this.picture);
    const next = new Image();
    next.onload = () => {
      this.shown = url;
      this.report(true);
    };
    next.onerror = () => this.report(false);
    // A failed refresh keeps the last frame. The next attempt uses the then current token.
    next.src = url;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), SNAPSHOT_INTERVAL_MS);
  }

  private onStreamError = (): void => {
    if (!this.live) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.shown = streamUrl(this.picture);
    }, RETRY_MS);
  };

  protected override render(): TemplateResult | typeof nothing {
    return this.shown ? html`<img src=${this.shown} alt=${this.label} @error=${this.onStreamError} />` : nothing;
  }
}
