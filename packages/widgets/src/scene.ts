import { html } from 'lit';
import { translate, type HassEntity, type ServiceCommand } from '@octa/ha-core';
import { defineWidget } from './define.ts';

export interface SceneEntry {
  id: string;
  name: string;
  active: boolean;
}

export interface SceneViewModel {
  scenes: SceneEntry[];
}

export const SCENE_ROLES = ['main', 'scene_2', 'scene_3', 'scene_4', 'scene_5', 'scene_6'] as const;

export const sceneCommands = {
  activate: (id: string): ServiceCommand => ({ domain: 'scene', service: 'turn_on', entityId: id }),
};

/** A scene's state is the time it was last activated, so the newest one counts as active. */
const activatedAt = (scene: HassEntity): number => {
  const time = Date.parse(scene.state);
  return Number.isNaN(time) ? 0 : time;
};

export const sceneWidget = defineWidget<SceneViewModel>({
  element: 'octa-scene-card',
  name: 'Octa Home UI Szenen',
  description: 'Mehrere Szenen als Tasten',
  spec: {
    variants: ['scenes'],
    defaultVariant: 'scenes',
    roles: Object.fromEntries(SCENE_ROLES.map((role, index) => [role, { domains: ['scene'], required: index === 0 }])),
  },
  columns: 12,
  defaultTitle: (language) => translate(language, 'scenes'),
  toViewModel(_target, config, port) {
    const entities = SCENE_ROLES.map((role) => config.roles[role])
      .filter((id): id is string => id !== undefined)
      .map((id) => port.getEntity(id))
      .filter((entity): entity is HassEntity => entity !== undefined);
    const newest = Math.max(0, ...entities.map(activatedAt));
    return { scenes: entities.map((scene) => ({ id: scene.entity_id, name: port.formatName(scene), active: newest > 0 && activatedAt(scene) === newest })) };
  },
  render(vm, context) {
    return html`<div class="pills">
      ${vm.scenes.map(
        (scene) =>
          html`<octa-button
            class="pill"
            .appearance=${context.appearance}
            .active=${scene.active}
            .disabled=${context.disabled}
            .busy=${context.busy}
            @click=${() => !context.disabled && context.run(sceneCommands.activate(scene.id))}
            >${scene.name}</octa-button
          >`,
      )}
    </div>`;
  },
});
