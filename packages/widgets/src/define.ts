import type { TemplateResult } from 'lit';
import type { ForecastEntry, HassPort, HistoryPoint, NormalizedEntity, ServiceCommand } from '@octa/ha-core';
import type { Appearance, CardConfig, CardSpec } from '@octa/schema';

export interface RenderContext {
  appearance: Appearance;
  /** The entity cannot be controlled right now. */
  disabled: boolean;
  /** A command of this card is on its way. */
  busy: boolean;
  language: string;
  /** A choice that only lives in this card, such as the target speaker. */
  selection: string | undefined;
  select(value: string): void;
  run(command: ServiceCommand, options?: { confirmed?: boolean }): void;
  /** Sends the commands one after the other and stops at the first one that does not go through. */
  runAll(commands: ServiceCommand[]): void;
}

export interface WidgetDefinition<ViewModel> {
  element: string;
  name: string;
  description: string;
  spec: CardSpec;
  /** Card title when the configuration sets none. Defaults to the entity name. */
  defaultTitle?: (language: string, variant: string) => string;
  /** Width in the 12 column grid of the sections view. */
  columns: number | ((variant: string) => number);
  /** The variant shows readings from the past, which the card then loads and refreshes. */
  needsHistory?: (variant: string) => boolean;
  /** The card shows a weather forecast, which it then loads and refreshes. */
  needsForecast?: boolean;
  /** The card shows many entities, so one that is missing or unavailable must not replace the whole card. */
  aggregate?: boolean | ((config: CardConfig) => boolean);
  /** What the editor calls the main entity, as German and English text. */
  entityLabel?: [string, string];
  /** Editor fields for structured settings. Settings without a field stay plain YAML in the editor. */
  editor?: (german: boolean) => Record<string, unknown>[];
  /** Settings that are deliberately not offered in the editor. */
  editorHidden?: readonly string[];
  /** Entities outside of the roles whose changes must update the card. */
  watch?: (config: CardConfig) => string[];
  /** Pure: turns configuration and entity into what the card shows. */
  toViewModel(target: NormalizedEntity, config: CardConfig, port: HassPort, history?: HistoryPoint[], forecast?: ForecastEntry[]): ViewModel;
  render(viewModel: ViewModel, context: RenderContext): TemplateResult;
}

export const defineWidget = <ViewModel>(definition: WidgetDefinition<ViewModel>): WidgetDefinition<ViewModel> => definition;
