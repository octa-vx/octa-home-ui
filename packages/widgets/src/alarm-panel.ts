import { LitElement, css, html, nothing, type PropertyDeclarations, type PropertyValues, type TemplateResult } from 'lit';

export interface AlarmAction {
  service: string;
  label: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
const MAX_CODE_LENGTH = 16;
/** A half entered code must not stay behind for the next person at the panel. */
const CODE_TIMEOUT_MS = 30000;

/**
 * Holds the code only while it is being entered. It is never reflected to an attribute or the
 * page, and it is cleared after every action and whenever the alarm changes.
 */
export class OctaAlarmPanel extends LitElement {
  static override properties: PropertyDeclarations = {
    actions: { attribute: false },
    confirmAction: { attribute: false },
    codeFormat: { attribute: false },
    disabled: { type: Boolean },
    resetKey: { attribute: false },
    okLabel: { attribute: false },
    codeLabel: { attribute: false },
    clearLabel: { attribute: false },
    code: { state: true },
  };

  static override styles = css`
    :host {
      display: grid;
      gap: 8px;
    }
    .dots {
      font-size: 16px;
      height: 24px;
      letter-spacing: 0.5em;
      line-height: 24px;
      text-align: center;
    }
    .keys {
      display: grid;
      gap: 4px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    button {
      background: var(--octa-theme-well, rgb(0 0 0 / 0.08));
      border: 0;
      border-radius: 20px;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      min-height: 44px;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    input {
      background: var(--octa-theme-well-soft, var(--octa-theme-well, transparent));
      border: 0;
      border-radius: 12px;
      box-sizing: border-box;
      color: var(--primary-text-color);
      font: inherit;
      min-height: 44px;
      padding: 8px 12px;
      width: 100%;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .actions button {
      flex: 1 1 auto;
      padding-inline: 12px;
    }
  `;

  /** Arm actions and the like. They send the entered code, if any. */
  actions: AlarmAction[] = [];
  /** The action behind the OK key, usually disarm. */
  confirmAction: AlarmAction | undefined;
  codeFormat: 'number' | 'text' | null = null;
  disabled = false;
  /** Any change, such as a new alarm state, discards a code that is being entered. */
  resetKey = '';
  okLabel = 'OK';
  codeLabel = 'Code';
  clearLabel = 'C';
  private code = '';
  private codeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Timers can stand still while a phone sleeps, the clock cannot. */
  private codeDeadline = 0;
  private readonly dropCodeWhenHidden = (): void => {
    if (document.hidden) this.setCode('');
  };

  private setCode(value: string): void {
    clearTimeout(this.codeTimer);
    this.code = value;
    if (value === '') return;
    this.codeDeadline = Date.now() + CODE_TIMEOUT_MS;
    this.codeTimer = setTimeout(() => (this.code = ''), CODE_TIMEOUT_MS);
  }

  private dropExpiredCode(): void {
    if (this.code !== '' && Date.now() > this.codeDeadline) this.setCode('');
  }

  private get codeMissing(): boolean {
    return this.codeFormat !== null && this.code === '';
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('resetKey') && changed.get('resetKey') !== undefined) this.setCode('');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.dropCodeWhenHidden);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.dropCodeWhenHidden);
    this.setCode('');
  }

  private submit(service: string): void {
    this.dropExpiredCode();
    if (this.codeMissing) return;
    const code = this.code;
    this.setCode('');
    this.dispatchEvent(new CustomEvent('octa-alarm', { detail: { service, code: code === '' ? undefined : code } }));
  }

  private press(key: string): void {
    this.dropExpiredCode();
    if (key === 'C') this.setCode('');
    else if (key === 'OK') {
      if (this.confirmAction) this.submit(this.confirmAction.service);
    } else this.setCode((this.code + key).slice(0, MAX_CODE_LENGTH));
  }

  private label(key: string): string {
    if (key === 'OK') return this.okLabel;
    return key === 'C' ? this.clearLabel : key;
  }

  private keypad(): TemplateResult {
    return html`<div class="dots" aria-live="off">${'•'.repeat(this.code.length)}</div>
      <div class="keys">
        ${KEYS.map(
          (key) =>
            html`<button type="button" aria-label=${this.label(key)} ?disabled=${this.disabled || (key === 'OK' && (!this.confirmAction || this.codeMissing))} @click=${() => this.press(key)}>
              ${key}
            </button>`,
        )}
      </div>`;
  }

  private textField(): TemplateResult {
    return html`<input
      type="password"
      autocomplete="off"
      aria-label=${this.codeLabel}
      placeholder=${this.codeLabel}
      .value=${this.code}
      ?disabled=${this.disabled}
      @input=${(event: Event) => this.setCode((event.target as HTMLInputElement).value)}
    />`;
  }

  protected override render(): TemplateResult {
    const withoutKeypad = this.codeFormat !== 'number';
    const buttons = withoutKeypad && this.confirmAction ? [this.confirmAction, ...this.actions] : this.actions;
    return html`${this.codeFormat === 'number' ? this.keypad() : nothing} ${this.codeFormat === 'text' ? this.textField() : nothing}
    ${buttons.length > 0
      ? html`<div class="actions">
          ${buttons.map((action) => html`<button type="button" ?disabled=${this.disabled || this.codeMissing} @click=${() => this.submit(action.service)}>${action.label}</button>`)}
        </div>`
      : nothing}`;
  }
}
