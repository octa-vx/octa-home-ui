import { LitElement, css, unsafeCSS, type CSSResultGroup, type PropertyDeclarations } from 'lit';
import { tokensCss, type Appearance } from '@octa/tokens';

export const baseStyles = css`
  ${unsafeCSS(tokensCss())}
  :host {
    box-sizing: border-box;
    color: var(--octa-text);
    font-family: var(--ha-font-family-body, inherit);
  }
  :host([hidden]) {
    display: none;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :focus-visible {
    outline: 2px solid var(--octa-accent);
    outline-offset: 2px;
  }
`;

export class OctaElement extends LitElement {
  static override properties: PropertyDeclarations = {
    appearance: { type: String, reflect: true },
  };

  static override styles: CSSResultGroup = baseStyles;

  appearance: Appearance = 'flat';

  protected emit(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

/** Safe when the bundle is loaded twice, for example during an update. */
export function define(tag: string, element: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, element);
}
