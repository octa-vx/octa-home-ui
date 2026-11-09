import { translate } from './i18n.ts';
import { normalizeEntity } from './normalize.ts';
import { supports, type FeatureDomain, type FeatureOf } from './capabilities.ts';
import type { HassEntity, HassPort } from './port.ts';

type FeatureRequirement = { [D in FeatureDomain]: { domain: D; feature: FeatureOf<D> } }[FeatureDomain];

export interface ServiceCommand {
  domain: string;
  service: string;
  entityId: string;
  data?: Record<string, unknown>;
  /** The command is only sent when the entity reports this feature. */
  requires?: FeatureRequirement;
}

function meets(entity: HassEntity, requirement: FeatureRequirement): boolean {
  // The union keeps call sites type-safe, but TypeScript cannot correlate its two fields here.
  return supports(entity, requirement.domain as 'cover', requirement.feature as FeatureOf<'cover'>);
}

export type CommandResult = 'sent' | 'needs_confirmation' | 'missing' | 'unavailable' | 'unsupported' | 'failed';

const ENTRANCE_OPENING = ['open_cover', 'toggle'];
const ENTRANCE_CLASSES = ['garage', 'gate', 'door'];

/** Moving down is closing, which is as harmless as the close button. Without a known position it may be opening. */
function opensFurther(command: ServiceCommand, entity: HassEntity): boolean {
  const current = entity.attributes.current_position;
  const target = command.data?.position;
  return typeof current !== 'number' || typeof target !== 'number' || target > current;
}

/** Safety rule: actions that could open up the home are never sent without explicit confirmation. */
export function requiresConfirmation(command: ServiceCommand, entity: HassEntity): boolean {
  if (command.domain === 'lock') return command.service === 'unlock' || command.service === 'open';
  if (command.domain === 'alarm_control_panel') return command.service === 'alarm_disarm';
  if (command.domain === 'cover') {
    if (!ENTRANCE_CLASSES.includes(String(entity.attributes.device_class))) return false;
    return ENTRANCE_OPENING.includes(command.service) || (command.service === 'set_cover_position' && opensFurther(command, entity));
  }
  return false;
}

/** Says what exactly is about to happen, because a slider has already snapped back by the time this is read. */
export function confirmationText(language: string, command: ServiceCommand, name: string): string {
  if (command.service === 'unlock') return translate(language, 'confirm_unlock', { name });
  if (command.service === 'open' || command.service === 'open_cover') return translate(language, 'confirm_open', { name });
  if (command.service === 'alarm_disarm') return translate(language, 'confirm_disarm', { name });
  if (command.service === 'toggle') return translate(language, 'confirm_toggle', { name });
  if (command.service === 'set_cover_position') return translate(language, 'confirm_position', { name, position: String(command.data?.position) });
  return translate(language, 'confirm_question');
}

export async function executeCommand(
  port: HassPort,
  command: ServiceCommand,
  options: { confirmed?: boolean } = {},
): Promise<CommandResult> {
  const target = normalizeEntity(port, command.entityId);
  if (target.status === 'missing' || !target.entity) return 'missing';
  if (target.status === 'unavailable') return 'unavailable';

  if (command.requires && !meets(target.entity, command.requires)) {
    port.notify(translate(port.language, 'action_unsupported', { name: target.name }));
    return 'unsupported';
  }
  if (requiresConfirmation(command, target.entity) && options.confirmed !== true) return 'needs_confirmation';

  try {
    await port.callService(command.domain, command.service, command.data ?? {}, command.entityId);
    return 'sent';
  } catch {
    port.notify(translate(port.language, 'action_failed', { name: target.name }));
    return 'failed';
  }
}
