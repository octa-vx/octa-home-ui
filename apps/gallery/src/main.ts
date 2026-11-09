import { html, render, type TemplateResult } from 'lit';
import { mdiLightbulb, mdiLock, mdiPower } from '@mdi/js';
import type { StatusKind } from '@octa/primitives';
import { registerWidgets } from '@octa/widgets';
import { themeVariables, type Appearance, type Mode } from '@octa/tokens';
import { cardsView, mountCards } from './cards.ts';
import { originalView } from './original.ts';
import './gallery.css';

/** Stands in for Home Assistant's own icon element outside of HA. */
class HaIconStub extends HTMLElement {
  connectedCallback(): void {
    const paths: Record<string, string> = { 'mdi:lightbulb': mdiLightbulb, 'mdi:lock': mdiLock, 'mdi:power': mdiPower };
    const path = paths[this.getAttribute('icon') ?? ''] ?? '';
    this.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="${path}"></path></svg>`;
  }
}
customElements.define('ha-icon', HaIconStub);
registerWidgets();

declare global {
  interface Window {
    __galleryReady?: boolean;
    __events: { id: string; type: string; value: unknown }[];
  }
}

window.__events = [];

const params = new URLSearchParams(location.search);
const mode: Mode = params.get('mode') === 'dark' ? 'dark' : 'light';
const appearance: Appearance = params.get('appearance') === 'soft' ? 'soft' : 'flat';

for (const [name, value] of Object.entries(themeVariables(mode))) {
  document.documentElement.style.setProperty(`--${name}`, value);
}
document.documentElement.style.colorScheme = mode;

const state = { checked: true, slider: 40, dial: 21.5 };

const log = (id: string) => (event: Event) => {
  const { type } = event;
  window.__events.push({ id, type, value: (event as CustomEvent<unknown>).detail });
};

const go = (next: Partial<{ mode: Mode; appearance: Appearance }>): void => {
  const query = new URLSearchParams({ mode, appearance, ...next });
  location.search = query.toString();
};

const statuses: [StatusKind, string][] = [
  ['active', 'Ein'],
  ['inactive', 'Aus'],
  ['unavailable', 'Nicht verfügbar'],
  ['unknown', 'Unbekannt'],
  ['missing', 'Entity fehlt: light.flur'],
  ['alert', 'Blockiert'],
  ['busy', 'Wird ausgeführt'],
];

const section = (title: string, body: TemplateResult): TemplateResult =>
  html`<section>
    <h2>${title}</h2>
    <div class="grid">${body}</div>
  </section>`;

const cell = (title: string, body: TemplateResult): TemplateResult =>
  html`<div class="cell">
    <h3>${title}</h3>
    ${body}
  </div>`;

function view(): TemplateResult {
  const a = appearance;
  return html`
    <header>
      <h1>Octa Home UI Galerie</h1>
      <label>
        Modus
        <select @change=${(e: Event) => go({ mode: (e.target as HTMLSelectElement).value as Mode })}>
          <option value="light" ?selected=${mode === 'light'}>Hell</option>
          <option value="dark" ?selected=${mode === 'dark'}>Dunkel</option>
        </select>
      </label>
      <label>
        Stil
        <select @change=${(e: Event) => go({ appearance: (e.target as HTMLSelectElement).value as Appearance })}>
          <option value="flat" ?selected=${a === 'flat'}>Flat</option>
          <option value="soft" ?selected=${a === 'soft'}>Soft</option>
        </select>
      </label>
    </header>
    <main>
      ${section(
        'Fläche',
        html`${cell('Standard', html`<octa-surface .appearance=${a}>Inhalt</octa-surface>`)}
        ${cell('Vertieft', html`<octa-surface .appearance=${a} tone="well">Inhalt</octa-surface>`)}
        ${cell('Nicht verfügbar', html`<octa-surface .appearance=${a} unavailable><octa-status .appearance=${a} kind="unavailable" text="Nicht verfügbar"></octa-status></octa-surface>`)}`,
      )}
      ${section(
        'Taste',
        html`${cell('Standard', html`<octa-button .appearance=${a}>Szene</octa-button>`)}
        ${cell('Nur Icon', html`<octa-button .appearance=${a} label="Licht"><ha-icon icon="mdi:lightbulb"></ha-icon></octa-button>`)}
        ${cell('Aktiv', html`<octa-button .appearance=${a} active><ha-icon icon="mdi:power"></ha-icon>Ein</octa-button>`)}
        ${cell('Gefahr', html`<octa-button .appearance=${a} tone="danger"><ha-icon icon="mdi:lock"></ha-icon>Entriegeln</octa-button>`)}
        ${cell('Läuft', html`<octa-button .appearance=${a} busy>Läuft</octa-button>`)}
        ${cell('Gesperrt', html`<octa-button .appearance=${a} disabled>Gesperrt</octa-button>`)}`,
      )}
      ${section(
        'Schalter',
        html`${cell(
          'Bedienbar',
          html`<octa-switch
            id="lab-switch"
            .appearance=${a}
            label="Bedienbarer Schalter"
            ?checked=${state.checked}
            @octa-change=${(e: CustomEvent<{ checked: boolean }>) => {
              log('lab-switch')(e);
              state.checked = e.detail.checked;
              draw();
            }}
          ></octa-switch>`,
        )}
        ${cell('Aus', html`<octa-switch .appearance=${a} label="Schalter aus"></octa-switch>`)}
        ${cell('Gesperrt ein', html`<octa-switch .appearance=${a} label="Gesperrt ein" checked disabled></octa-switch>`)}
        ${cell('Gesperrt aus', html`<octa-switch .appearance=${a} label="Gesperrt aus" disabled></octa-switch>`)}`,
      )}
      ${section(
        'Slider',
        html`${cell(
          'Bedienbar',
          html`<octa-slider
            id="lab-slider"
            .appearance=${a}
            label="Helligkeit"
            unit="%"
            .value=${state.slider}
            @octa-input=${log('lab-slider')}
            @octa-change=${log('lab-slider')}
          ></octa-slider>`,
        )}
        ${cell('Gesperrt', html`<octa-slider .appearance=${a} label="Gesperrter Slider" .value=${60} disabled></octa-slider>`)}`,
      )}
      ${section(
        'Drehregler',
        html`${cell(
          'Bedienbar',
          html`<octa-dial
            id="lab-dial"
            .appearance=${a}
            label="Zieltemperatur"
            note="Ist 20,4°"
            hint="Drehen ⟳"
            unit="°C"
            .min=${5}
            .max=${30}
            .step=${0.5}
            .value=${state.dial}
            @octa-input=${log('lab-dial')}
            @octa-change=${log('lab-dial')}
          ></octa-dial>`,
        )}
        ${cell('Gesperrt', html`<octa-dial .appearance=${a} label="Gesperrter Regler" unit="°C" .min=${5} .max=${30} .value=${18} disabled></octa-dial>`)}`,
      )}
      ${section(
        'Tacho',
        html`${cell('Normal', html`<octa-gauge .appearance=${a} label="Prozessor" unit="%" .value=${35} .warning=${70} .danger=${90}></octa-gauge>`)}
        ${cell('Warnung', html`<octa-gauge .appearance=${a} label="Speicher" unit="%" .value=${78} .warning=${70} .danger=${90}></octa-gauge>`)}
        ${cell('Kritisch', html`<octa-gauge .appearance=${a} label="Festplatte" unit="%" .value=${95} .warning=${70} .danger=${90}></octa-gauge>`)}
        ${cell('Kein Wert', html`<octa-gauge .appearance=${a} label="Sensor" unit="%" .value=${null}></octa-gauge>`)}`,
      )}
      ${section(
        'Pill',
        html`${cell('Neutral', html`<octa-pill .appearance=${a}>Wohnzimmer</octa-pill>`)}
        ${cell('Akzent', html`<octa-pill .appearance=${a} tone="accent">Heizen</octa-pill>`)}
        ${cell('Warnung', html`<octa-pill .appearance=${a} tone="warning">Fenster offen</octa-pill>`)}
        ${cell('Gefahr', html`<octa-pill .appearance=${a} tone="danger">Alarm</octa-pill>`)}`,
      )}
      ${section('Status', html`${statuses.map(([kind, text]) => cell(kind, html`<octa-status .appearance=${a} kind=${kind} text=${text}></octa-status>`))}`)}
    </main>
  `;
}

function draw(): void {
  const page = params.get('view');
  const app = document.getElementById('app') as HTMLElement;
  document.body.classList.toggle('original-body', page === 'original');
  render(page === 'original' ? originalView() : page === 'cards' ? cardsView() : view(), app);
  if (page === 'cards') mountCards(app, appearance);
}

draw();
await customElements.whenDefined('octa-gauge');
await Promise.all(
  [...document.querySelectorAll('*')].filter((el) => el.tagName.startsWith('OCTA-')).map((el) => (el as unknown as { updateComplete: Promise<unknown> }).updateComplete),
);
await document.fonts.ready;
window.__galleryReady = true;
