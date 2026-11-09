import { generateDashboard, generateSection, type StrategyConfig, type StrategyHass } from './generate.ts';

export * from './classify.ts';
export * from './generate.ts';

declare global {
  interface Window {
    customStrategies?: { type: string; strategyType: string; name: string; description: string }[];
  }
}

const TYPE = 'octa-home-ui';

function register(tag: string, generate: (config: StrategyConfig, hass: StrategyHass) => Record<string, unknown>): void {
  if (customElements.get(tag)) return;
  customElements.define(
    tag,
    class extends HTMLElement {
      static async generate(config: StrategyConfig, hass: StrategyHass): Promise<Record<string, unknown>> {
        return generate(config, hass);
      }
    },
  );
}

export function registerStrategies(): void {
  register(`ll-strategy-dashboard-${TYPE}`, generateDashboard);
  register(`ll-strategy-section-${TYPE}`, generateSection);
  const list = (window.customStrategies ??= []);
  if (list.some((entry) => entry.type === TYPE)) return;
  list.push(
    { type: TYPE, strategyType: 'dashboard', name: 'Octa Home UI', description: 'Erzeugt eine Übersicht und eine Ansicht je Bereich' },
    { type: TYPE, strategyType: 'section', name: 'Octa Home UI Raum', description: 'Alle Geräte eines Bereichs als Abschnitt' },
  );
}
