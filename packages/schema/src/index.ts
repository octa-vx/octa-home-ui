export const CONFIG_VERSION = 1;

export type Appearance = 'soft' | 'flat';

export interface RoleSpec {
  domains?: readonly string[];
  required?: boolean;
}

export interface CardSpec {
  variants: readonly string[];
  defaultVariant: string;
  roles: Readonly<Record<string, RoleSpec>>;
  /** Numeric settings the card accepts. */
  options?: readonly string[];
  /** Structured settings, passed through for the card to validate. */
  extras?: readonly string[];
}

export interface CardConfig {
  type: string;
  version: number;
  variant: string;
  appearance: Appearance;
  name?: string;
  roles: Record<string, string>;
  options?: Record<string, number>;
  extras?: Record<string, unknown>;
}

export interface ConfigIssue {
  path: string;
  code:
    | 'not_an_object'
    | 'missing_type'
    | 'unsupported_version'
    | 'unknown_variant'
    | 'invalid_appearance'
    | 'invalid_name'
    | 'invalid_entity'
    | 'invalid_option'
    | 'unknown_role'
    | 'missing_role'
    | 'wrong_domain'
    | 'forbidden_secret';
}

export type ParseResult = { ok: true; config: CardConfig } | { ok: false; issues: ConfigIssue[] };

/** Keys that must never be stored in a dashboard configuration. */
const SECRET_KEYS = /^(code|pin|passcode|password|token|access_token|api_key)$/i;

const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function findSecrets(value: unknown, path: string, issues: ConfigIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSecrets(item, `${path}[${index}]`, issues));
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (SECRET_KEYS.test(key)) issues.push({ path: childPath, code: 'forbidden_secret' });
      else findSecrets(child, childPath, issues);
    }
  }
}

/** Brings older configurations to the current shape. Unversioned input counts as version 1. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const { entity, ...rest } = raw;
  const roles = isRecord(raw.roles) ? Object.fromEntries(Object.entries(raw.roles).filter(([, value]) => value !== '' && value !== undefined && value !== null)) : {};
  if (typeof entity === 'string' && roles.main === undefined) roles.main = entity;
  return { ...rest, roles };
}

export function parseCardConfig(raw: unknown, spec: CardSpec): ParseResult {
  if (!isRecord(raw)) return { ok: false, issues: [{ path: '', code: 'not_an_object' }] };

  const issues: ConfigIssue[] = [];
  findSecrets(raw, '', issues);

  const version = raw.version ?? CONFIG_VERSION;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > CONFIG_VERSION) {
    issues.push({ path: 'version', code: 'unsupported_version' });
  }

  const migrated = migrate(raw);
  if (typeof migrated.type !== 'string' || migrated.type === '') issues.push({ path: 'type', code: 'missing_type' });

  const variant = migrated.variant ?? spec.defaultVariant;
  if (typeof variant !== 'string' || !spec.variants.includes(variant)) {
    issues.push({ path: 'variant', code: 'unknown_variant' });
  }

  const appearance = migrated.appearance ?? 'soft';
  if (appearance !== 'soft' && appearance !== 'flat') issues.push({ path: 'appearance', code: 'invalid_appearance' });

  if (migrated.name !== undefined && typeof migrated.name !== 'string') issues.push({ path: 'name', code: 'invalid_name' });

  const roles = migrated.roles as Record<string, unknown>;
  for (const [role, entityId] of Object.entries(roles)) {
    const roleSpec = spec.roles[role];
    if (!roleSpec) {
      issues.push({ path: `roles.${role}`, code: 'unknown_role' });
    } else if (typeof entityId !== 'string' || !ENTITY_ID.test(entityId)) {
      issues.push({ path: `roles.${role}`, code: 'invalid_entity' });
    } else if (roleSpec.domains && !roleSpec.domains.includes(entityId.split('.')[0] as string)) {
      issues.push({ path: `roles.${role}`, code: 'wrong_domain' });
    }
  }
  for (const [role, roleSpec] of Object.entries(spec.roles)) {
    if (roleSpec.required && roles[role] === undefined) issues.push({ path: `roles.${role}`, code: 'missing_role' });
  }

  const options: Record<string, number> = {};
  for (const key of spec.options ?? []) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) options[key] = value;
    else issues.push({ path: key, code: 'invalid_option' });
  }

  const extras: Record<string, unknown> = {};
  for (const key of spec.extras ?? []) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') extras[key] = value;
    else issues.push({ path: key, code: 'invalid_option' });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    config: {
      type: migrated.type as string,
      version: CONFIG_VERSION,
      variant: variant as string,
      appearance: appearance as Appearance,
      ...(migrated.name === undefined ? {} : { name: migrated.name as string }),
      roles: roles as Record<string, string>,
      ...(Object.keys(options).length > 0 ? { options } : {}),
      ...(Object.keys(extras).length > 0 ? { extras } : {}),
    },
  };
}
