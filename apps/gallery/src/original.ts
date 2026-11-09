// Rebuilds the dashboard of the original reference app from the primitives, to compare the two 1:1.
import { html, type TemplateResult } from 'lit';
import { icon, type IconName } from '@octa/widgets';

const iconButton = (label: string, name: IconName, size: number, active = false): TemplateResult =>
  html`<octa-button class="icon" appearance="soft" label=${label} ?active=${active}>${icon(name, size)}</octa-button>`;

const card = (title: string, body: TemplateResult, wide = false): TemplateResult =>
  html`<octa-surface appearance="soft" class=${wide ? 'wide' : ''}>
    <div class="label">${title}</div>
    ${body}
  </octa-surface>`;

const rooms: [string, string, number][] = [
  ['🛋️', 'Wohnzimmer', 5],
  ['🍳', 'Küche', 4],
  ['🚪', 'Flur', 4],
  ['⚙️', 'System', 3],
];

const swatches = ['#ff4d4d', '#ffb347', '#ffe066', '#5ce1e6', '#4d7cff', '#c77dff', '#ffffff'];

export function originalView(): TemplateResult {
  return html`<main class="original">
    <header>
      <div>
        <p class="date">Montag, 9. November</p>
        <h1>Zuhause</h1>
      </div>
      <octa-button class="admin" appearance="soft">${icon('settings', 16)}Admin</octa-button>
    </header>
    <nav aria-label="Räume">
      ${rooms.map(
        ([emoji, name, count], index) =>
          html`<octa-button class="tab" appearance="soft" ?active=${index === 0}><span>${emoji}</span>${name}<span class="count">${count}</span></octa-button>`,
      )}
    </nav>
    <div class="cards">
      ${card(
        'Deckenlicht',
        html`<div class="stack">
          <div class="row">
            <span class="glow">${icon('lightbulb', 24)}</span>
            <octa-switch appearance="soft" checked label="Deckenlicht"></octa-switch>
          </div>
          <div class="small">70 %</div>
          <octa-slider appearance="soft" label="Helligkeit" unit="%" .min=${0} .max=${100} .value=${70}></octa-slider>
        </div>`,
      )}
      ${card(
        'Thermostat-Karte',
        html`<octa-dial appearance="soft" label="Zieltemperatur" unit="°" note="Ist 20.4°" hint="Drehen ⟳" .min=${10} .max=${30} .step=${0.5} .value=${21}></octa-dial>`,
      )}
      ${card(
        'Medienwiedergabe-Karte',
        html`<div class="media">
          <div class="art"></div>
          <div class="info">
            <div class="track">Midnight City</div>
            <div class="artist">M83</div>
            <div class="controls">
              ${iconButton('Zurück', 'back', 16)} ${iconButton('Wiedergabe', 'play', 16, true)} ${iconButton('Weiter', 'forward', 16)}
            </div>
          </div>
        </div>`,
        true,
      )}
      ${card(
        'Rollladen Süd',
        html`<div class="row">
          <div>
            <div class="big">100%</div>
            <div class="artist">Offen</div>
          </div>
          <div class="controls">
            ${iconButton('Öffnen', 'up', 18)} ${iconButton('Stopp', 'stop', 14)} ${iconButton('Schließen', 'down', 18)}
          </div>
        </div>`,
      )}
      ${card(
        'LED-Strip',
        html`<div class="led">
          <input type="color" value="#ff9933" aria-label="Farbe" />
          <div class="swatches">
            ${swatches.map((color) => html`<button type="button" aria-label=${`Farbe ${color}`} style="background:${color}"></button>`)}
          </div>
        </div>`,
      )}
    </div>
  </main>`;
}
