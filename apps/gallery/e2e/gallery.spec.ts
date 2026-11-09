import AxeBuilder from '@axe-core/playwright';
import { expect, test, type CDPSession, type Page } from '@playwright/test';

const open = async (page: Page, query = ''): Promise<void> => {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__galleryReady === true);
};

const events = (page: Page, id: string, type: string): Promise<unknown[]> =>
  page.evaluate(([i, t]) => window.__events.filter((e) => e.id === i && e.type === t).map((e) => e.value), [id, type]);

const SLIDER = '#lab-slider [role=slider]';
const DIAL = '#lab-dial [role=slider]';
const nowOf = async (page: Page, selector: string): Promise<number> =>
  Number(await page.locator(selector).getAttribute('aria-valuenow'));

/** Simulates a device sending state updates faster than any user interaction. */
const startNoise = (page: Page, selector: string, values: [number, number]): Promise<void> =>
  page.evaluate(
    ([s, a, b]) => {
      const el = document.querySelector(s as string) as HTMLElement & { value: number };
      let flip = false;
      (window as unknown as { __noise: number }).__noise = window.setInterval(() => {
        flip = !flip;
        el.value = (flip ? a : b) as number;
      }, 10);
    },
    [selector, ...values] as const,
  );

const stopNoise = (page: Page): Promise<void> =>
  page.evaluate(() => clearInterval((window as unknown as { __noise: number }).__noise));

for (const mode of ['light', 'dark']) {
  for (const appearance of ['flat', 'soft']) {
    const query = `?mode=${mode}&appearance=${appearance}`;

    test(`${mode} ${appearance}: no accessibility violations`, async ({ page }) => {
      await open(page, query);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }))).toEqual([]);
    });

    test(`${mode} ${appearance}: matches the screenshot`, async ({ page }) => {
      await open(page, query);
      await expect(page).toHaveScreenshot(`${mode}-${appearance}.png`, { fullPage: true, animations: 'disabled' });
    });
  }
}

for (const mode of ['light', 'dark']) {
  const query = `?view=cards&mode=${mode}&appearance=soft`;

  test(`${mode}: cards match the screenshot`, async ({ page }) => {
    await open(page, query);
    await expect(page).toHaveScreenshot(`cards-${mode}.png`, { fullPage: true, animations: 'disabled' });
  });

  test(`${mode}: cards have no accessibility violations`, async ({ page }) => {
    await open(page, query);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }))).toEqual([]);
  });
}

test('alarm code stays out of the page and is sent once', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const panel = page.locator('section:has(h2:text-is("Alarm scharf")) octa-security-card').first().locator('octa-alarm-panel');
  for (const key of ['4', '7', '1', '1']) await panel.getByRole('button', { name: key, exact: true }).click();
  expect(await panel.locator('.dots').innerText()).toBe('••••');
  const html = await page.evaluate(() => {
    const walk = (root: ParentNode, out: string[]): string[] => {
      for (const element of root.querySelectorAll('*')) {
        out.push(element.outerHTML);
        if (element.shadowRoot) walk(element.shadowRoot, out);
      }
      return out;
    };
    return walk(document, []).join('');
  });
  expect(html).not.toContain('4711');
  await panel.getByRole('button', { name: 'Deaktivieren' }).click();
  const calls = await page.evaluate(() => window.__ports?.['Alarm scharf:as_given']?.calls);
  expect(calls).toEqual([{ domain: 'alarm_control_panel', service: 'alarm_disarm', data: { code: '4711' }, entityId: 'alarm_control_panel.home' }]);
  expect(await panel.locator('.dots').innerText()).toBe('');
});

test('unlocking asks first and cancel sends nothing', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Schloss verriegelt")) octa-security-card').first();
  const calls = () => page.evaluate(() => window.__ports?.['Schloss verriegelt:as_given']?.calls);
  await card.locator('button.solid').click();
  await card.locator('.confirm').waitFor();
  expect(await calls()).toEqual([]);
  await card.locator('.confirm octa-button').nth(1).click();
  expect(await card.locator('.confirm').count()).toBe(0);
  expect(await calls()).toEqual([]);
  await card.locator('button.solid').click();
  await card.locator('.confirm octa-button').first().click();
  await expect.poll(calls).toEqual([{ domain: 'lock', service: 'unlock', data: {}, entityId: 'lock.front_door' }]);
});

test('an unanswered confirmation expires', async ({ page }) => {
  await page.clock.install();
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Schloss verriegelt")) octa-security-card').first();
  await card.locator('button.solid').click();
  await card.locator('.confirm').waitFor();
  await page.clock.fastForward(16000);
  await expect(card.locator('.confirm')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ports?.['Schloss verriegelt:as_given']?.calls)).toEqual([]);
});

test('a half entered alarm code is discarded', async ({ page }) => {
  await page.clock.install();
  await open(page, '?view=cards&appearance=soft');
  const panel = page.locator('section:has(h2:text-is("Alarm scharf")) octa-security-card').first().locator('octa-alarm-panel');
  await panel.getByRole('button', { name: '4', exact: true }).click();
  await expect(panel.locator('.dots')).toHaveText('•');
  await page.clock.fastForward(31000);
  await expect(panel.locator('.dots')).toHaveText('');
});

const lockCard = (page: Page) => page.locator('section:has(h2:text-is("Schloss verriegelt")) octa-security-card').first();
const lockCalls = (page: Page) => page.evaluate(() => window.__ports?.['Schloss verriegelt:as_given']?.calls);
const alarmPanel = (page: Page) => page.locator('section:has(h2:text-is("Alarm scharf")) octa-security-card').first().locator('octa-alarm-panel');
type Hidden = (hidden: boolean) => void;
const setHidden: Hidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

test('the question names the action and a double tap sends once', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = lockCard(page);
  await card.locator('button.solid').click();
  await expect(card.locator('.confirm-question')).toContainText('entriegeln?');
  await card.locator('.confirm octa-button').first().evaluate((button: HTMLElement) => {
    button.click();
    button.click();
  });
  await expect.poll(() => lockCalls(page)).toHaveLength(1);
  await page.waitForTimeout(100);
  expect(await lockCalls(page)).toHaveLength(1);
  await expect(card.locator('.confirm')).toHaveCount(0);
});

test('a confirmation past its deadline sends nothing, even if the timer stood still', async ({ page }) => {
  await page.clock.install();
  await open(page, '?view=cards&appearance=soft');
  const card = lockCard(page);
  await card.locator('button.solid').click();
  await card.locator('.confirm').waitFor();
  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(now + 60000);
  await card.locator('.confirm octa-button').first().click();
  await expect(card.locator('.confirm')).toHaveCount(0);
  expect(await lockCalls(page)).toEqual([]);
});

test('leaving the page drops the confirmation and a half entered code', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = lockCard(page);
  await card.locator('button.solid').click();
  await card.locator('.confirm').waitFor();
  await alarmPanel(page).getByRole('button', { name: '4', exact: true }).click();
  await expect(alarmPanel(page).locator('.dots')).toHaveText('•');
  await page.evaluate(setHidden, true);
  await expect(card.locator('.confirm')).toHaveCount(0);
  await expect(alarmPanel(page).locator('.dots')).toHaveText('');
});

test('reconfiguring a card drops its confirmation', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = lockCard(page);
  await card.locator('button.solid').click();
  await card.locator('.confirm').waitFor();
  await card.evaluate((element) => (element as unknown as { setConfig(config: unknown): void }).setConfig({ type: 'custom:octa-security-card', entity: 'lock.front_door' }));
  await expect(card.locator('.confirm')).toHaveCount(0);
});

test('a confirmation survives attribute updates but not a state change', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = lockCard(page);
  const update = (state: string, battery: number) =>
    card.evaluate(
      (element, [s, b]) => {
        (element as unknown as { hass: unknown }).hass = { language: 'de', states: { 'lock.front_door': { entity_id: 'lock.front_door', state: s, attributes: { battery: b } } } };
      },
      [state, battery] as const,
    );
  await update('locked', 90);
  await card.locator('button.solid').click();
  await card.locator('.confirm').waitFor();
  await update('locked', 89);
  await page.waitForTimeout(100);
  await expect(card.locator('.confirm')).toHaveCount(1);
  await update('unlocked', 89);
  await expect(card.locator('.confirm')).toHaveCount(0);
});

test('an older command finishing keeps a newer question', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Garagentor")) octa-cover-card').first();
  await page.evaluate(() => {
    const port = window.__ports?.['Garagentor:as_given'] as unknown as { callService: () => Promise<void> };
    port.callService = () => new Promise((resolve) => ((window as unknown as { release: () => void }).release = resolve));
  });
  await card.locator('.controls octa-button').last().click();
  await card.locator('.controls octa-button').first().click();
  await card.locator('.confirm').waitFor();
  await page.evaluate(() => (window as unknown as { release: () => void }).release());
  await page.waitForTimeout(100);
  await expect(card.locator('.confirm')).toHaveCount(1);
});

test('an alarm action needs a code once the panel asks for one', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const ok = alarmPanel(page).getByRole('button', { name: 'Deaktivieren' });
  await expect(ok).toBeDisabled();
  await alarmPanel(page).getByRole('button', { name: '4', exact: true }).click();
  await expect(ok).toBeEnabled();
});

test('a new entity does not keep the chart of the old one', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Verlauf")) octa-sensor-card').first();
  const length = () => card.evaluate((element) => (element as unknown as { history: unknown[] }).history.length);
  await expect.poll(length).toBeGreaterThan(0);
  await page.evaluate(() => {
    (window.__ports?.['Verlauf:as_given'] as unknown as { history: unknown[] }).history = [];
  });
  await card.evaluate((element) => (element as unknown as { setConfig(config: unknown): void }).setConfig({ type: 'custom:octa-sensor-card', entity: 'sensor.other', variant: 'history' }));
  await expect.poll(length).toBe(0);
});

test('the player has everything in one block and greys out what cannot work', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const playing = page.locator('section:has(h2:text-is("Player, Spotify")) octa-media-card').first();
  await expect(playing.locator('.info .track')).toHaveText('Midnight City');
  await expect(playing.locator('.origin')).toHaveText('Spotify');
  await expect(playing.locator('.player-controls octa-button')).toHaveCount(3);
  await expect(playing.locator('octa-slider')).toHaveCount(1);
  await playing.locator('.player-controls octa-button').nth(1).click();
  await expect.poll(() => page.evaluate(() => window.__ports?.['Player, Spotify:as_given']?.calls)).toEqual([{ domain: 'media_player', service: 'media_play_pause', data: {}, entityId: 'media_player.cast_spotify' }]);

  const empty = page.locator('section:has(h2:text-is("Player, nichts geladen")) octa-media-card').first();
  await expect(empty.locator('.player-controls octa-button').nth(1).locator('button')).toBeDisabled();
  await empty.locator('.player-controls octa-button').nth(1).dispatchEvent('click');
  expect(await page.evaluate(() => window.__ports?.['Player, nichts geladen:as_given']?.calls)).toEqual([]);
  await expect(empty.locator('octa-slider')).toHaveCount(1);
});

test('the player starts radio, speech and spotify on this speaker', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Player, Quellen")) octa-media-card').first();
  const calls = () => page.evaluate(() => window.__ports?.['Player, Quellen:as_given']?.calls);
  const tab = (name: string) => card.locator('.sources > .pills').first().locator('octa-button', { hasText: name });
  await tab('Radio').click();
  await card.locator('.sources > .pills').nth(1).locator('octa-button', { hasText: '1LIVE' }).click();
  await expect.poll(calls).toEqual([{ domain: 'media_player', service: 'play_media', data: { media_content_id: 'http://example.invalid/1live.mp3', media_content_type: 'music' }, entityId: 'media_player.cast_idle' }]);

  await tab('Sprache').click();
  await card.locator('.speak input').fill('  Essen ist fertig  ');
  await card.locator('.speak octa-button').click();
  await expect.poll(async () => (await calls())?.at(-1)).toEqual({ domain: 'tts', service: 'speak', data: { media_player_entity_id: 'media_player.cast_idle', message: 'Essen ist fertig', language: 'de' }, entityId: 'tts.google_translate_en_com' });
  await expect(card.locator('.speak input')).toHaveValue('');
  await card.locator('.speak octa-button').click();
  await page.waitForTimeout(100);
  expect(await calls()).toHaveLength(2);

  await tab('Link').click();
  const link = card.locator('.speak input');
  await link.fill('kein link');
  await card.locator('.speak octa-button').click();
  await page.waitForTimeout(100);
  expect(await calls()).toHaveLength(2);
  await expect(link).toHaveValue('kein link');
  await link.fill(' https://example.invalid/musik.mp3 ');
  await card.locator('.speak octa-button').click();
  await expect.poll(async () => (await calls())?.at(-1)).toEqual({ domain: 'media_player', service: 'play_media', data: { media_content_id: 'https://example.invalid/musik.mp3', media_content_type: 'music' }, entityId: 'media_player.cast_idle' });
  await expect(link).toHaveValue('');

  await tab('Spotify').click();
  await card.locator('.sources > .pills').nth(1).locator('octa-button', { hasText: 'Favoriten' }).click();
  await expect.poll(async () => (await calls())?.slice(3)).toEqual([
    { domain: 'media_player', service: 'select_source', data: { source: 'Küche' }, entityId: 'media_player.spotify_konto' },
    { domain: 'media_player', service: 'play_media', data: { media_content_id: 'spotify:playlist:abc', media_content_type: 'playlist' }, entityId: 'media_player.spotify_konto' },
  ]);
});

test('spotify does nothing when it cannot see the speaker', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Player, Spotify schläft")) octa-media-card').first();
  await card.locator('.sources octa-button', { hasText: 'Spotify' }).click();
  await expect(card.locator('.sources')).toContainText('Bad ist bei Spotify gerade nicht sichtbar');
  expect(await page.evaluate(() => window.__ports?.['Player, Spotify schläft:as_given']?.calls)).toEqual([]);
});

test('the remote has home, back and app buttons', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("TV-Fernbedienung")) octa-media-card').first();
  const calls = () => page.evaluate(() => window.__ports?.['TV-Fernbedienung:as_given']?.calls);
  await card.locator('.player-controls octa-button').nth(0).click();
  await card.locator('.player-controls octa-button').nth(1).click();
  await card.locator('.tv-apps octa-button', { hasText: 'YouTube' }).click();
  await card.locator('.tv-apps octa-button', { hasText: 'Netflix' }).click();
  await expect.poll(calls).toHaveLength(4);
  expect(await calls()).toEqual([
    { domain: 'remote', service: 'send_command', data: { command: 'KEY_HOME' }, entityId: 'remote.tv' },
    { domain: 'remote', service: 'send_command', data: { command: 'KEY_RETURN' }, entityId: 'remote.tv' },
    { domain: 'script', service: 'turn_on', data: { variables: { quelle: 'YouTube' } }, entityId: 'script.tv_quelle' },
    { domain: 'media_player', service: 'play_media', data: { media_content_id: '3201907018807', media_content_type: 'app' }, entityId: 'media_player.tv' },
  ]);
});

test('windows share one block and show their state as an icon', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Fenster im Block")) octa-contacts-card').first();
  await expect(card.locator('.contact-tile')).toHaveCount(3);
  await expect(card.locator('.contact-tile.open')).toHaveCount(1);
  await expect(card.locator('.contact-tile.closed')).toContainText('Badezimmer');
  await expect(card.locator('.contact-tile.unknown')).toHaveCount(1);
  await expect(card.locator('.contact-tile.open svg')).toHaveCount(1);
  expect(await card.locator('.contact-grid').innerText()).not.toMatch(/offen|geschlossen|\bon\b|\boff\b/i);
  expect(await card.locator('.contact-tile.closed').getAttribute('aria-label')).toContain('Badezimmer');
});

test('a room brings heating, lights, windows and media into one block', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const card = page.locator('section:has(h2:text-is("Raum")) octa-room-card').first();
  const calls = () => page.evaluate(() => window.__ports?.['Raum:as_given']?.calls);
  await expect(card.locator('.big')).toHaveText('19.5°');
  await expect(card.locator('.room-lights octa-button')).toHaveCount(2);
  await expect(card.locator('.contact-tile.open')).toHaveCount(1);
  await expect(card.locator('.room-media')).toContainText('Midnight City');
  await card.locator('.room-climate octa-button').last().click();
  await card.locator('.room-lights octa-button', { hasText: 'Stehlampe' }).click();
  await card.locator('.room-media octa-button').click();
  await expect.poll(calls).toEqual([
    { domain: 'climate', service: 'set_temperature', data: { temperature: 21.5 }, entityId: 'climate.heater' },
    { domain: 'switch', service: 'turn_off', data: {}, entityId: 'switch.plug' },
    { domain: 'media_player', service: 'media_play_pause', data: {}, entityId: 'media_player.speaker' },
  ]);
});

test('lists can be filled in the card editor instead of YAML', async ({ page }) => {
  await open(page, '?view=cards&appearance=soft');
  const schema = (tag: string) =>
    page.evaluate((name) => {
      const card = customElements.get(name) as unknown as { getConfigForm(): { schema: { name: string; selector?: { object?: { fields?: Record<string, unknown> }; entity?: { multiple?: boolean } } }[] } };
      return card.getConfigForm().schema.map((field) => ({ name: field.name, fields: Object.keys(field.selector?.object?.fields ?? {}), multiple: field.selector?.entity?.multiple === true }));
    }, tag);
  const media = await schema('octa-media-card');
  expect(media.find((field) => field.name === 'stations')?.fields).toEqual(['name', 'media_id', 'media_type']);
  expect(media.find((field) => field.name === 'remote_apps')?.fields).toEqual(['name', 'app_id', 'script', 'variables']);
  expect(media.some((field) => field.name === 'spotify')).toBe(false);
  expect((await schema('octa-contacts-card')).find((field) => field.name === 'sensors')?.fields).toEqual(['entity', 'name']);
  const room = await schema('octa-room-card');
  expect(room.find((field) => field.name === 'lights')?.multiple).toBe(true);
  expect(room.find((field) => field.name === 'windows')?.fields).toEqual(['entity', 'name']);
  expect((await schema('octa-system-card')).find((field) => field.name === 'containers')?.fields).toEqual(['name', 'status', 'cpu', 'memory']);
});

test('rebuilt original dashboard matches the screenshot', async ({ page }) => {
  await open(page, '?view=original');
  await expect(page).toHaveScreenshot('original.png', { fullPage: true, animations: 'disabled' });
});

test('rebuilt original dashboard has no accessibility violations', async ({ page }) => {
  await open(page, '?view=original');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }))).toEqual([]);
});

test('nothing overflows the viewport', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('interactive elements meet the 44 px target', async ({ page }) => {
  await open(page);
  const targets = page.locator('octa-button button, octa-switch button, octa-slider .root');
  const boxes = await targets.evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect()).map((r) => [r.width, r.height]));
  expect(boxes.length).toBeGreaterThan(10);
  for (const [width, height] of boxes) {
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  }
});

test.describe('keyboard', () => {
  test('slider follows arrow keys and bounds', async ({ page }) => {
    await open(page);
    await page.locator(SLIDER).focus();
    await page.keyboard.press('ArrowRight');
    expect(await nowOf(page, SLIDER)).toBe(41);
    await page.keyboard.press('End');
    expect(await nowOf(page, SLIDER)).toBe(100);
    await page.keyboard.press('ArrowRight');
    expect(await nowOf(page, SLIDER)).toBe(100);
  });

  test('dial respects its step', async ({ page }) => {
    await open(page);
    await page.locator(DIAL).focus();
    await page.keyboard.press('ArrowUp');
    expect(await nowOf(page, DIAL)).toBe(22);
  });

  test('switch toggles with space', async ({ page }) => {
    await open(page);
    await page.locator('#lab-switch button').focus();
    await page.keyboard.press('Space');
    expect(await events(page, 'lab-switch', 'octa-change')).toEqual([{ checked: false }]);
    await expect(page.locator('#lab-switch button')).toHaveAttribute('aria-checked', 'false');
  });

  test('a disabled slider ignores input', async ({ page }) => {
    await open(page);
    const disabled = page.locator('octa-slider[disabled] [role=slider]');
    await expect(disabled).toHaveAttribute('tabindex', '-1');
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('mouse', () => {
  test.skip(({ hasTouch }) => hasTouch, 'mouse only');

  test('slider stays stable under rapid state changes', async ({ page }) => {
    await open(page);
    const box = (await page.locator('#lab-slider .root').boundingBox())!;
    const y = box.y + box.height / 2;
    const xAt = (ratio: number): number => box.x + box.width * ratio;

    await startNoise(page, '#lab-slider', [10, 90]);
    await page.mouse.move(xAt(0.5), y);
    await page.mouse.down();

    const seen: number[] = [];
    for (let i = 0; i <= 20; i += 1) {
      await page.mouse.move(xAt(0.5 + i * 0.01), y);
      seen.push(await nowOf(page, SLIDER));
    }
    // Every sample tracks the pointer and never one of the injected values.
    expect(seen).not.toContain(10);
    expect(seen).not.toContain(90);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(seen.at(-1)).toBeGreaterThanOrEqual(68);

    await page.mouse.up();
    const held = await nowOf(page, SLIDER);
    await page.waitForTimeout(400);
    expect(await nowOf(page, SLIDER)).toBe(held);

    const inputs = await events(page, 'lab-slider', 'octa-input');
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.length).toBeLessThan(21);
    expect(await events(page, 'lab-slider', 'octa-change')).toEqual([{ value: held }]);

    await stopNoise(page);
    await page.evaluate(() => {
      (document.querySelector('#lab-slider') as HTMLElement & { value: number }).value = 33;
    });
    await expect(page.locator(SLIDER)).toHaveAttribute('aria-valuenow', '33', { timeout: 3000 });
  });

  test('dial drags along the arc and does not flip across the gap', async ({ page }) => {
    await open(page);
    const box = (await page.locator('#lab-dial .root').boundingBox())!;
    const scale = box.width / 200;
    const at = (angle: number): [number, number] => [
      box.x + 100 * scale + 80 * scale * Math.cos((angle * Math.PI) / 180),
      box.y + 100 * scale + 80 * scale * Math.sin((angle * Math.PI) / 180),
    ];

    await page.mouse.move(...at(-90));
    await page.mouse.down();
    expect(await nowOf(page, DIAL)).toBe(17.5);
    for (const angle of [-45, 0, 30, 44]) await page.mouse.move(...at(angle));
    expect(await nowOf(page, DIAL)).toBe(30);
    // Continue past the top end into the gap and out at the low end.
    await page.mouse.move(...at(100));
    await page.mouse.move(...at(140));
    expect(await nowOf(page, DIAL)).toBe(30);
    await page.mouse.up();
    expect(await events(page, 'lab-dial', 'octa-change')).toEqual([{ value: 30 }]);
  });
});

test('soft knob turns by mouse and stays inside its range', async ({ page }) => {
  await open(page, '?appearance=soft');
  await page.locator('#lab-dial').scrollIntoViewIfNeeded();
  const well = (await page.locator('#lab-dial .well').boundingBox())!;
  const cx = well.x + well.width / 2;
  const cy = well.y + well.height / 2;
  const at = (angle: number): [number, number] => [cx + 50 * Math.cos((angle * Math.PI) / 180), cy + 50 * Math.sin((angle * Math.PI) / 180)];

  await page.mouse.move(...at(-90));
  await page.mouse.down();
  expect(await nowOf(page, DIAL)).toBe(17.5);
  for (const angle of [-45, 0, 30, 44]) await page.mouse.move(...at(angle));
  expect(await nowOf(page, DIAL)).toBe(30);
  await page.mouse.move(...at(100));
  await page.mouse.move(...at(140));
  expect(await nowOf(page, DIAL)).toBe(30);
  await page.mouse.up();
  expect(await events(page, 'lab-dial', 'octa-change')).toEqual([{ value: 30 }]);
});

test('soft knob ignores presses next to it', async ({ page }) => {
  await open(page, '?appearance=soft');
  const before = await nowOf(page, DIAL);
  await page.locator('#lab-dial .read').click();
  expect(await nowOf(page, DIAL)).toBe(before);
  expect(await events(page, 'lab-dial', 'octa-change')).toEqual([]);
});

test.describe('touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch only');

  const touch = (client: CDPSession, type: string, x?: number, y?: number) =>
    client.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: x === undefined ? [] : [{ x, y: y as number }] });

  test('slider drags by touch under rapid state changes', async ({ page }) => {
    await open(page);
    await page.locator('#lab-slider').scrollIntoViewIfNeeded();
    const box = (await page.locator('#lab-slider .root').boundingBox())!;
    const y = box.y + box.height / 2;
    const client = await page.context().newCDPSession(page);

    await startNoise(page, '#lab-slider', [10, 90]);
    await touch(client, 'touchStart', box.x + box.width * 0.3, y);
    const seen: number[] = [];
    for (let i = 1; i <= 15; i += 1) {
      await touch(client, 'touchMove', box.x + box.width * (0.3 + i * 0.02), y);
      seen.push(await nowOf(page, SLIDER));
    }
    await touch(client, 'touchEnd');
    await stopNoise(page);

    expect(seen).not.toContain(10);
    expect(seen).not.toContain(90);
    expect(seen.at(-1)).toBeGreaterThanOrEqual(58);
    expect(await events(page, 'lab-slider', 'octa-change')).toHaveLength(1);
  });

  test('soft knob turns by touch', async ({ page }) => {
    await open(page, '?appearance=soft');
    await page.locator('#lab-dial').scrollIntoViewIfNeeded();
    const well = (await page.locator('#lab-dial .well').boundingBox())!;
    const cx = well.x + well.width / 2;
    const cy = well.y + well.height / 2;
    const client = await page.context().newCDPSession(page);
    const scrolled = await page.evaluate(() => window.scrollY);

    await touch(client, 'touchStart', cx, cy - 50);
    await touch(client, 'touchMove', cx + 35, cy - 35);
    await touch(client, 'touchEnd');
    expect(await nowOf(page, DIAL)).toBeGreaterThan(20);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
  });

  test('dial drags by touch', async ({ page }) => {
    await open(page);
    await page.locator('#lab-dial').scrollIntoViewIfNeeded();
    const box = (await page.locator('#lab-dial .root').boundingBox())!;
    const scale = box.width / 200;
    const cx = box.x + 100 * scale;
    const cy = box.y + 100 * scale;
    const client = await page.context().newCDPSession(page);

    await touch(client, 'touchStart', cx, cy - 80 * scale);
    await touch(client, 'touchMove', cx + 56 * scale, cy - 56 * scale);
    await touch(client, 'touchEnd');
    expect(await nowOf(page, DIAL)).toBeGreaterThan(20);
  });
});
