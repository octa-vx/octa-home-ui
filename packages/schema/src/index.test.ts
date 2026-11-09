import { describe, expect, it } from 'vitest';
import { parseCardConfig, type CardSpec, type ParseResult } from './index.ts';

const spec: CardSpec = {
  variants: ['tile', 'slider'],
  defaultVariant: 'tile',
  roles: { main: { domains: ['light'], required: true }, extra: {} },
};

const issueCodes = (result: ParseResult): string[] => (result.ok ? [] : result.issues.map((issue) => issue.code));

describe('parseCardConfig', () => {
  it('applies defaults and maps the entity shorthand to the main role', () => {
    const result = parseCardConfig({ type: 'custom:x', entity: 'light.a' }, spec);
    expect(result).toEqual({
      ok: true,
      config: { type: 'custom:x', version: 1, variant: 'tile', appearance: 'soft', roles: { main: 'light.a' } },
    });
  });

  it('keeps an explicit main role over the shorthand', () => {
    const result = parseCardConfig({ type: 'x', entity: 'light.a', roles: { main: 'light.b' } }, spec);
    expect(result.ok && result.config.roles.main).toBe('light.b');
  });

  it('rejects versions from the future', () => {
    expect(issueCodes(parseCardConfig({ type: 'x', entity: 'light.a', version: 2 }, spec))).toContain('unsupported_version');
  });

  it.each([
    ['not an object', 'text', 'not_an_object'],
    ['missing type', { entity: 'light.a' }, 'missing_type'],
    ['unknown variant', { type: 'x', entity: 'light.a', variant: 'nope' }, 'unknown_variant'],
    ['bad appearance', { type: 'x', entity: 'light.a', appearance: 'glass' }, 'invalid_appearance'],
    ['missing role', { type: 'x' }, 'missing_role'],
    ['bad entity id', { type: 'x', entity: 'Light A' }, 'invalid_entity'],
    ['wrong domain', { type: 'x', entity: 'switch.a' }, 'wrong_domain'],
    ['unknown role', { type: 'x', entity: 'light.a', roles: { other: 'light.b' } }, 'unknown_role'],
  ])('reports %s', (_label, raw, code) => {
    expect(issueCodes(parseCardConfig(raw, spec))).toContain(code);
  });

  it.each(['code', 'PIN', 'token', 'password'])('refuses a stored secret named %s at any depth', (key) => {
    const raw = { type: 'x', entity: 'light.a', tap_action: { service_data: { [key]: '1234' } } };
    expect(issueCodes(parseCardConfig(raw, spec))).toContain('forbidden_secret');
  });
});
