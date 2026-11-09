import { readFileSync } from 'node:fs';
import { parseCardConfig, type CardSpec } from '@octa/schema';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { airWidget } from './air.ts';
import { applianceWidget } from './appliance.ts';
import { cameraWidget } from './camera.ts';
import { climateWidget } from './climate.ts';
import { contactsWidget } from './contacts.ts';
import { coverWidget } from './cover.ts';
import { energyWidget } from './energy.ts';
import { inputWidget } from './input.ts';
import { lightWidget } from './light.ts';
import { mediaWidget } from './media.ts';
import { roomWidget } from './room.ts';
import { sceneWidget } from './scene.ts';
import { securityWidget } from './security.ts';
import { sensorWidget } from './sensor.ts';
import { switchWidget } from './switch.ts';
import { systemWidget } from './system.ts';
import { weatherWidget } from './weather.ts';

const specs: Record<string, CardSpec> = Object.fromEntries(
  [airWidget, applianceWidget, cameraWidget, climateWidget, contactsWidget, roomWidget, coverWidget, energyWidget, inputWidget, lightWidget, mediaWidget, sceneWidget, securityWidget, sensorWidget, switchWidget, systemWidget, weatherWidget].map((widget) => [
    `custom:${widget.element}`,
    widget.spec as CardSpec,
  ]),
);

type Card = Record<string, unknown> & { type: string };

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

function cardsIn(value: unknown): Card[] {
  if (Array.isArray(value)) return value.flatMap(cardsIn);
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  if (typeof record.type === 'string' && /^custom:octa-.*-card$/.test(record.type)) return [record as Card];
  return Object.values(record).flatMap(cardsIn);
}

const cardsOf = (text: string): Card[] => [...text.matchAll(/```yaml\n(.*?)```/gs)].flatMap((match) => cardsIn(parse(match[1] as string)));

describe.each(['docs/YAML-REFERENCE.de.md', 'docs/YAML-REFERENCE.md'])('YAML reference %s', (path) => {
  const reference = read(path);
  const documented = cardsOf(reference);

  it.each([...documented, ...cardsIn(parse(read('examples/cards.yaml')))].map((card, index) => [index, card] as const))('example %i is a valid card', (_index, card) => {
    const spec = specs[card.type];
    expect(spec, card.type).toBeDefined();
    expect(parseCardConfig(card, spec as CardSpec)).toMatchObject({ ok: true });
  });

  it.each(Object.entries(specs))('shows every variant of %s', (type, spec) => {
    const shown = new Set(documented.filter((card) => card.type === type).map((card) => card.variant ?? spec.defaultVariant));
    expect([...shown].sort()).toEqual([...spec.variants].sort());
  });

  it('documents every option and extra', () => {
    for (const spec of Object.values(specs)) for (const key of [...(spec.options ?? []), ...(spec.extras ?? [])]) expect(reference).toContain(`\`${key}\``);
  });
});

describe.each(['EXAMPLES.md', 'EXAMPLES.de.md'])('examples document %s', (path) => {
  const cards = cardsOf(read(path));

  it('has examples', () => {
    expect(cards.length).toBeGreaterThan(8);
  });

  it.each(cards.map((card, index) => [index, card] as const))('example %i is a valid card', (_index, card) => {
    const spec = specs[card.type];
    expect(spec, card.type).toBeDefined();
    expect(parseCardConfig(card, spec as CardSpec)).toMatchObject({ ok: true });
  });
});
