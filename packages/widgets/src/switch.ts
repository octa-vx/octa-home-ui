import { html } from 'lit';
import { domainOf, type ServiceCommand } from '@octa/ha-core';
import { defineWidget } from './define.ts';
import { icon } from './icons.ts';

export interface SwitchViewModel {
  id: string;
  on: boolean;
  label: string;
}

export const switchCommands = {
  toggle: (id: string, on: boolean): ServiceCommand => ({ domain: domainOf(id), service: on ? 'turn_off' : 'turn_on', entityId: id }),
};

export const switchWidget = defineWidget<SwitchViewModel>({
  element: 'octa-switch-card',
  name: 'Octa Home UI Schalter',
  description: 'Schalter und Eingabe-Schalter',
  spec: { variants: ['toggle', 'input_boolean'], defaultVariant: 'toggle', roles: { main: { domains: ['switch', 'input_boolean'], required: true } } },
  columns: 6,
  toViewModel: (target) => ({ id: target.id, on: target.active, label: target.stateLabel }),
  render(vm, context) {
    return html`<div class="row">
      <span class="small with-icon">${icon('plug', 16)}${vm.label}</span>
      <octa-switch
        .appearance=${context.appearance}
        .checked=${vm.on}
        .disabled=${context.disabled}
        .label=${vm.id}
        @octa-change=${() => context.run(switchCommands.toggle(vm.id, vm.on))}
      ></octa-switch>
    </div>`;
  },
});
