import { html, nothing, type TemplateResult } from 'lit';
import { domainOf, toDatetimeLocal, translate, type ServiceCommand } from '@octa/ha-core';
import { defineWidget, type RenderContext } from './define.ts';
import { icon } from './icons.ts';
import { parseDuration } from './timer-display.ts';

export type InputViewModel =
  | { kind: 'select'; id: string; value: string; options: string[] }
  | { kind: 'number'; id: string; value: number; min: number; max: number; step: number; label: string }
  | { kind: 'text'; id: string; value: string; password: boolean; maxLength: number | null }
  | { kind: 'datetime'; id: string; value: string; inputType: 'date' | 'time' | 'datetime-local' }
  | { kind: 'timer'; id: string; label: string; finishesAt: string | null; seconds: number; running: boolean }
  | { kind: 'button'; id: string; name: string; last: string | null };

const numberOf = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const inputCommands = {
  select: (id: string, option: string): ServiceCommand => ({ domain: domainOf(id), service: 'select_option', entityId: id, data: { option } }),
  setValue: (id: string, value: string | number): ServiceCommand => ({ domain: domainOf(id), service: 'set_value', entityId: id, data: { value } }),
  datetime: (id: string, kind: 'date' | 'time' | 'datetime-local', value: string): ServiceCommand => {
    if (kind === 'date') return { domain: 'input_datetime', service: 'set_datetime', entityId: id, data: { date: value } };
    if (kind === 'time') return { domain: 'input_datetime', service: 'set_datetime', entityId: id, data: { time: value } };
    return { domain: 'input_datetime', service: 'set_datetime', entityId: id, data: { datetime: `${value.replace('T', ' ')}:00` } };
  },
  timerStart: (id: string): ServiceCommand => ({ domain: 'timer', service: 'start', entityId: id }),
  timerPause: (id: string): ServiceCommand => ({ domain: 'timer', service: 'pause', entityId: id }),
  timerCancel: (id: string): ServiceCommand => ({ domain: 'timer', service: 'cancel', entityId: id }),
  press: (id: string): ServiceCommand => ({ domain: domainOf(id), service: 'press', entityId: id }),
};

function renderSelect(vm: Extract<InputViewModel, { kind: 'select' }>, context: RenderContext): TemplateResult {
  return html`<select class="field" aria-label=${vm.id} ?disabled=${context.disabled} @change=${(event: Event) => context.run(inputCommands.select(vm.id, (event.target as HTMLSelectElement).value))}>
    ${vm.options.map((option) => html`<option .selected=${option === vm.value} value=${option}>${option}</option>`)}
  </select>`;
}

function renderNumber(vm: Extract<InputViewModel, { kind: 'number' }>, context: RenderContext): TemplateResult {
  const send = (value: number): void => {
    if (Number.isFinite(value) && value >= vm.min && value <= vm.max) context.run(inputCommands.setValue(vm.id, value));
  };
  return html`<div class="led tight-gap">
    <octa-slider class="grow" .appearance=${context.appearance} .label=${vm.label} .min=${vm.min} .max=${vm.max} .step=${vm.step} .value=${vm.value} .disabled=${context.disabled} @octa-change=${(event: CustomEvent<{ value: number }>) => send(event.detail.value)}></octa-slider>
    <input class="field narrow" type="number" aria-label=${vm.label} min=${vm.min} max=${vm.max} step=${vm.step} .value=${String(vm.value)} ?disabled=${context.disabled} @change=${(event: Event) => send(Number((event.target as HTMLInputElement).value))} />
  </div>`;
}

function renderText(vm: Extract<InputViewModel, { kind: 'text' }>, context: RenderContext): TemplateResult {
  return html`<input
    class="field"
    type=${vm.password ? 'password' : 'text'}
    autocomplete="off"
    aria-label=${vm.id}
    maxlength=${vm.maxLength ?? nothing}
    placeholder=${translate(context.language, 'enter_text')}
    .value=${vm.value}
    ?disabled=${context.disabled}
    @change=${(event: Event) => context.run(inputCommands.setValue(vm.id, (event.target as HTMLInputElement).value))}
  />`;
}

function renderDatetime(vm: Extract<InputViewModel, { kind: 'datetime' }>, context: RenderContext): TemplateResult {
  return html`<input class="field large" type=${vm.inputType} aria-label=${vm.id} .value=${vm.value} ?disabled=${context.disabled} @change=${(event: Event) => context.run(inputCommands.datetime(vm.id, vm.inputType, (event.target as HTMLInputElement).value))} />`;
}

function renderTimer(vm: Extract<InputViewModel, { kind: 'timer' }>, context: RenderContext): TemplateResult {
  const main = vm.running ? inputCommands.timerPause(vm.id) : inputCommands.timerStart(vm.id);
  return html`<div class="row">
    <octa-timer-display .finishesAt=${vm.finishesAt} .seconds=${vm.seconds}></octa-timer-display>
    <div class="controls">
      <octa-button class="icon" .appearance=${context.appearance} .label=${translate(context.language, vm.running ? 'pause' : 'start')} active .disabled=${context.disabled} .busy=${context.busy} @click=${() => context.run(main)}>${icon(vm.running ? 'pause' : 'play', 16)}</octa-button>
      <octa-button class="icon" .appearance=${context.appearance} .label=${translate(context.language, 'stop')} .disabled=${context.disabled} .busy=${context.busy} @click=${() => context.run(inputCommands.timerCancel(vm.id))}>${icon('stop', 14)}</octa-button>
    </div>
  </div>`;
}

function renderButton(vm: Extract<InputViewModel, { kind: 'button' }>, context: RenderContext): TemplateResult {
  return html`<button type="button" class="press" aria-label=${vm.name} ?disabled=${context.disabled || context.busy} @click=${() => context.run(inputCommands.press(vm.id))}>
    ${icon('zap', 32)}<span class="press-note">${vm.last === null ? vm.name : translate(context.language, 'last_pressed', { time: vm.last })}</span>
  </button>`;
}

const DATETIME_TYPES = { both: 'datetime-local', date: 'date', time: 'time' } as const;

const lastPressed = (state: string | undefined, language: string): string | null => {
  const time = state ? new Date(state) : undefined;
  return time && !Number.isNaN(time.getTime()) ? time.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' }) : null;
};

export const inputWidget = defineWidget<InputViewModel>({
  element: 'octa-input-card',
  name: 'Octa Home UI Eingaben',
  description: 'Auswahl, Zahl, Text, Datum, Timer oder Taste',
  spec: {
    variants: ['input_select', 'input_number', 'input_text', 'input_datetime', 'timer', 'button'],
    defaultVariant: 'input_select',
    roles: { main: { domains: ['input_select', 'select', 'input_number', 'number', 'input_text', 'text', 'input_datetime', 'timer', 'button', 'input_button'], required: true } },
  },
  columns: 6,
  toViewModel(target, _config, port) {
    const { entity, id, domain } = target;
    const attributes = entity?.attributes ?? {};
    const state = entity?.state ?? '';
    switch (domain) {
      case 'input_number':
      case 'number': {
        const min = numberOf(attributes.min, 0);
        return { kind: 'number', id, value: numberOf(state, min), min, max: numberOf(attributes.max, 100), step: numberOf(attributes.step, 1), label: target.name };
      }
      case 'input_text':
      case 'text':
        return { kind: 'text', id, value: target.status === 'ok' ? state : '', password: attributes.mode === 'password', maxLength: typeof attributes.max === 'number' ? attributes.max : null };
      case 'input_datetime': {
        const key = attributes.has_date && attributes.has_time ? 'both' : attributes.has_date ? 'date' : 'time';
        const inputType = DATETIME_TYPES[key];
        const value = target.status !== 'ok' ? '' : key === 'both' ? toDatetimeLocal(state) : key === 'time' ? state.slice(0, 5) : state;
        return { kind: 'datetime', id, value, inputType };
      }
      case 'timer':
        return {
          kind: 'timer',
          id,
          label: target.stateLabel,
          running: state === 'active',
          finishesAt: state === 'active' && typeof attributes.finishes_at === 'string' ? attributes.finishes_at : null,
          seconds: parseDuration(state === 'paused' ? attributes.remaining : attributes.duration),
        };
      case 'button':
      case 'input_button':
        return { kind: 'button', id, name: target.name, last: lastPressed(state, port.language) };
      default:
        return { kind: 'select', id, value: state, options: Array.isArray(attributes.options) ? attributes.options.filter((item): item is string => typeof item === 'string') : [] };
    }
  },
  render(vm, context) {
    switch (vm.kind) {
      case 'number':
        return renderNumber(vm, context);
      case 'text':
        return renderText(vm, context);
      case 'datetime':
        return renderDatetime(vm, context);
      case 'timer':
        return renderTimer(vm, context);
      case 'button':
        return renderButton(vm, context);
      default:
        return renderSelect(vm, context);
    }
  },
});
