import { html, nothing, type TemplateResult } from 'lit';
import { supports, translate, type FeatureOf, type HassEntity, type HassPort, type MessageKey, type ServiceCommand } from '@octa/ha-core';
import type { CardConfig } from '@octa/schema';
import { defineWidget, type RenderContext } from './define.ts';
import { icon, type IconName } from './icons.ts';

export interface Station {
  name: string;
  media_id: string;
  media_type: string;
}

export interface SpotifySource {
  id: string;
  /** Name of this speaker in the Spotify device list. */
  device: string;
  /** Spotify only lists devices that are awake, playing on any other would fail. */
  deviceVisible: boolean;
  playlists: Station[];
}

export interface MediaTarget {
  id: string;
  name: string;
}

export interface RemoteKeys {
  up: string;
  down: string;
  left: string;
  right: string;
  ok: string;
  channel_up: string;
  channel_down: string;
  home: string;
  back: string;
}

export interface RemoteApp {
  name: string;
  /** Either a script of the user or an app of the TV. */
  script: { id: string; variables: Record<string, unknown> } | null;
  appId: string | null;
}

export interface MediaViewModel {
  id: string;
  variant: string;
  label: string;
  title: string;
  artist: string;
  /** Only the performer, without the name of the app as a stand-in. */
  performer: string;
  /** Where the sound comes from, for example Spotify or Text-to-Speech. */
  origin: string | null;
  picture: string | null;
  on: boolean;
  playing: boolean;
  canPrevious: boolean;
  canPlay: boolean;
  canNext: boolean;
  canPlayMedia: boolean;
  canPower: boolean;
  canVolumeSet: boolean;
  canVolumeStep: boolean;
  canMute: boolean;
  volume: number | null;
  muted: boolean;
  source: string | null;
  sources: string[];
  stations: Station[];
  tts: string | null;
  spotify: SpotifySource | null;
  targets: MediaTarget[];
  remote: string | null;
  keys: RemoteKeys;
  apps: RemoteApp[];
}

export const TARGET_ROLES = ['target_2', 'target_3', 'target_4', 'target_5', 'target_6'] as const;

/** Key names of the Samsung integration. Other TVs set their own under `remote_keys`. */
export const DEFAULT_KEYS: RemoteKeys = {
  up: 'KEY_UP',
  down: 'KEY_DOWN',
  left: 'KEY_LEFT',
  right: 'KEY_RIGHT',
  home: 'KEY_HOME',
  back: 'KEY_RETURN',
  ok: 'KEY_ENTER',
  channel_up: 'KEY_CHUP',
  channel_down: 'KEY_CHDOWN',
};

type MediaFeature = FeatureOf<'media_player'>;

const player = (id: string, service: string, feature?: MediaFeature, data?: Record<string, unknown>): ServiceCommand => ({
  domain: 'media_player',
  service,
  entityId: id,
  ...(data ? { data } : {}),
  ...(feature ? { requires: { domain: 'media_player' as const, feature } } : {}),
});

export const mediaCommands = {
  playPause: (id: string): ServiceCommand => player(id, 'media_play_pause'),
  startApp: (tv: string, app: RemoteApp): ServiceCommand =>
    app.script ? { domain: 'script', service: 'turn_on', entityId: app.script.id, data: { variables: app.script.variables } } : player(tv, 'play_media', 'PLAY_MEDIA', { media_content_id: app.appId, media_content_type: 'app' }),
  speak: (tts: string, speaker: string, message: string, language: string): ServiceCommand => ({ domain: 'tts', service: 'speak', entityId: tts, data: { media_player_entity_id: speaker, message, language } }),
  previous: (id: string): ServiceCommand => player(id, 'media_previous_track', 'PREVIOUS_TRACK'),
  next: (id: string): ServiceCommand => player(id, 'media_next_track', 'NEXT_TRACK'),
  volume: (id: string, percent: number): ServiceCommand => player(id, 'volume_set', 'VOLUME_SET', { volume_level: Math.round(percent) / 100 }),
  volumeStep: (id: string, up: boolean): ServiceCommand => player(id, up ? 'volume_up' : 'volume_down'),
  mute: (id: string, muted: boolean): ServiceCommand => player(id, 'volume_mute', 'VOLUME_MUTE', { is_volume_muted: !muted }),
  source: (id: string, source: string): ServiceCommand => player(id, 'select_source', 'SELECT_SOURCE', { source }),
  play: (id: string, station: Station): ServiceCommand => player(id, 'play_media', 'PLAY_MEDIA', { media_content_id: station.media_id, media_content_type: station.media_type }),
  power: (id: string, on: boolean): ServiceCommand => player(id, on ? 'turn_off' : 'turn_on', on ? 'TURN_OFF' : 'TURN_ON'),
  key: (remote: string, command: string): ServiceCommand => ({ domain: 'remote', service: 'send_command', entityId: remote, data: { command } }),
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function parseStations(value: unknown, defaultType = 'music'): Station[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { name, media_id: id, media_type: type } = item as Record<string, unknown>;
    if (typeof name !== 'string' || typeof id !== 'string' || name === '' || id === '') return [];
    return [{ name, media_id: id, media_type: typeof type === 'string' && type !== '' ? type : defaultType }];
  });
}

export function parseRemoteApps(value: unknown): RemoteApp[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown): RemoteApp[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { name, script, variables, app_id: appId } = item as Record<string, unknown>;
    if (typeof name !== 'string' || name === '') return [];
    if (typeof script === 'string' && script.startsWith('script.')) {
      return [{ name, script: { id: script, variables: typeof variables === 'object' && variables !== null ? (variables as Record<string, unknown>) : {} }, appId: null }];
    }
    return typeof appId === 'string' && appId !== '' ? [{ name, script: null, appId }] : [];
  });
}

function parseKeys(value: unknown): RemoteKeys {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return DEFAULT_KEYS;
  const custom = Object.fromEntries(Object.entries(value).filter(([key, command]) => key in DEFAULT_KEYS && typeof command === 'string' && command !== ''));
  return { ...DEFAULT_KEYS, ...custom };
}

export function iconButton(context: RenderContext, label: MessageKey, name: IconName, size: number, command: ServiceCommand, active = false, unavailable = false): TemplateResult {
  const disabled = context.disabled || unavailable;
  return html`<octa-button class="icon" .appearance=${context.appearance} .label=${translate(context.language, label)} .active=${active} .disabled=${disabled} .busy=${context.busy} @click=${() => !disabled && context.run(command)}>${icon(name, size)}</octa-button>`;
}

function pill(context: RenderContext, label: string, active: boolean, onPress: () => void): TemplateResult {
  return html`<octa-button class="pill" .appearance=${context.appearance} .active=${active} .disabled=${context.disabled} @click=${() => !context.disabled && onPress()}>${label}</octa-button>`;
}

/** A speaker that is not playing anything has nothing to resume, Cast devices answer such a command with an error. */
function nothingLoaded(entity: HassEntity | undefined): boolean {
  if (!entity || !['idle', 'off', 'standby'].includes(entity.state)) return false;
  return !entity.attributes.media_content_id && !entity.attributes.media_title;
}

function renderMedia(vm: MediaViewModel, context: RenderContext): TemplateResult {
  return html`<div class="media">
    ${vm.picture ? html`<img class="art" src=${vm.picture} alt="" />` : html`<div class="art"></div>`}
    <div class="info">
      <div class="track">${vm.title || vm.label}</div>
      <div class="tiny ellipsis">${vm.artist}</div>
      <div class="controls top">
        ${vm.canPrevious ? iconButton(context, 'previous', 'back', 16, mediaCommands.previous(vm.id)) : nothing}
        ${vm.canPlay ? iconButton(context, vm.playing ? 'pause' : 'play', vm.playing ? 'pause' : 'play', 16, mediaCommands.playPause(vm.id), true) : nothing}
        ${vm.canNext ? iconButton(context, 'next', 'forward', 16, mediaCommands.next(vm.id)) : nothing}
      </div>
    </div>
  </div>`;
}

/** A text field with a button. The browser explains a value that does not fit the pattern. */
function renderEntry(context: RenderContext, placeholder: MessageKey, action: MessageKey, onSend: (value: string) => void, pattern?: string): TemplateResult {
  const send = (event: Event): void => {
    const field = (event.currentTarget as HTMLElement).closest('.speak')?.querySelector('input');
    const value = field?.value.trim();
    if (!field || !value || context.disabled) return;
    field.value = value;
    if (!field.reportValidity()) return;
    onSend(value);
    field.value = '';
  };
  return html`<div class="speak">
    <input
      class="field"
      type="text"
      autocomplete="off"
      maxlength="2000"
      pattern=${pattern ?? nothing}
      aria-label=${translate(context.language, placeholder)}
      placeholder=${translate(context.language, placeholder)}
      ?disabled=${context.disabled}
      @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && send(event)}
    />
    <octa-button class="pill" .appearance=${context.appearance} .disabled=${context.disabled} @click=${send}>${translate(context.language, action)}</octa-button>
  </div>`;
}

function renderSpeech(vm: MediaViewModel, tts: string, context: RenderContext): TemplateResult {
  return renderEntry(context, 'speak_placeholder', 'speak', (message) => context.run(mediaCommands.speak(tts, vm.id, message, context.language.slice(0, 2))));
}

function renderLink(vm: MediaViewModel, context: RenderContext): TemplateResult {
  return renderEntry(context, 'link_placeholder', 'link_play', (url) => context.run(mediaCommands.play(vm.id, { name: url, media_id: url, media_type: 'music' })), 'https?://\\S+');
}

function renderSpotify(vm: MediaViewModel, spotify: SpotifySource, context: RenderContext): TemplateResult {
  if (!spotify.deviceVisible) return html`<div class="small">${translate(context.language, 'spotify_device_missing', { name: spotify.device })}</div>`;
  if (spotify.playlists.length === 0) return html`<div class="small">${translate(context.language, 'no_playlists')}</div>`;
  return html`<div class="pills">
    ${spotify.playlists.map((playlist) => pill(context, playlist.name, false, () => context.runAll([mediaCommands.source(spotify.id, spotify.device), mediaCommands.play(spotify.id, playlist)])))}
  </div>`;
}

/** Cast has no list of sources, so the block offers whatever is set up for this speaker. */
function renderSources(vm: MediaViewModel, context: RenderContext): TemplateResult | typeof nothing {
  const { spotify, tts } = vm;
  const tabs: { key: string; label: MessageKey; panel: () => TemplateResult }[] = [
    ...(vm.stations.length > 0
      ? [{ key: 'radio', label: 'source_radio' as const, panel: () => html`<div class="pills">${vm.stations.map((station) => pill(context, station.name, false, () => context.run(mediaCommands.play(vm.id, station))))}</div>` }]
      : []),
    ...(tts ? [{ key: 'speech', label: 'source_speech' as const, panel: () => renderSpeech(vm, tts, context) }] : []),
    ...(vm.canPlayMedia ? [{ key: 'link', label: 'source_link' as const, panel: () => renderLink(vm, context) }] : []),
    ...(spotify ? [{ key: 'spotify', label: 'source_spotify' as const, panel: () => renderSpotify(vm, spotify, context) }] : []),
  ];
  if (tabs.length === 0) return nothing;
  const open = tabs.find((tab) => tab.key === context.selection);
  return html`<div class="stack sources">
    <div class="tiny">${translate(context.language, 'source_choose')}</div>
    <div class="pills">${tabs.map((tab) => pill(context, translate(context.language, tab.label), tab === open, () => context.select(tab === open ? '' : tab.key)))}</div>
    ${open ? open.panel() : nothing}
  </div>`;
}

/** Everything about one speaker in one block. Controls stay in place and are only greyed out. */
function renderPlayer(vm: MediaViewModel, context: RenderContext): TemplateResult {
  return html`<div class="stack">
    <div class="media">
      ${vm.picture ? html`<img class="art" src=${vm.picture} alt="" />` : html`<div class="art empty">${icon('volume', 24)}</div>`}
      <div class="info">
        <div class="track">${vm.title || vm.label}</div>
        ${vm.performer ? html`<div class="tiny ellipsis">${vm.performer}</div>` : nothing}
        ${vm.origin ? html`<div class="tiny ellipsis origin">${vm.origin}</div>` : nothing}
      </div>
    </div>
    <div class="controls player-controls">
      ${iconButton(context, 'previous', 'back', 16, mediaCommands.previous(vm.id), false, !vm.canPrevious)}
      ${iconButton(context, vm.playing ? 'pause' : 'play', vm.playing ? 'pause' : 'play', 16, mediaCommands.playPause(vm.id), true, !vm.canPlay)}
      ${iconButton(context, 'next', 'forward', 16, mediaCommands.next(vm.id), false, !vm.canNext)}
    </div>
    ${vm.canVolumeSet || vm.canMute ? renderVolume(vm, context) : nothing}
    ${renderSources(vm, context)}
  </div>`;
}

function renderVolume(vm: MediaViewModel, context: RenderContext): TemplateResult {
  const send = (event: CustomEvent<{ value: number }>): void => context.run(mediaCommands.volume(vm.id, event.detail.value));
  const shown = vm.muted ? 0 : (vm.volume ?? 0);
  if (!vm.canVolumeSet && !vm.canMute) return html`<div class="small">${vm.label}</div>`;
  return html`<div class="led tight-gap">
    ${vm.canMute ? iconButton(context, vm.muted ? 'unmute' : 'mute', vm.muted ? 'muted' : 'volume', 16, mediaCommands.mute(vm.id, vm.muted), vm.muted) : nothing}
    ${vm.canVolumeSet
      ? html`<octa-slider class="grow" .appearance=${context.appearance} .label=${translate(context.language, 'volume')} unit="%" .min=${0} .max=${100} .value=${shown} .disabled=${context.disabled} @octa-input=${send} @octa-change=${send}></octa-slider>
          <span class="body number">${shown}</span>`
      : nothing}
  </div>`;
}

function renderSource(vm: MediaViewModel, context: RenderContext): TemplateResult {
  if (vm.sources.length === 0) return html`<div class="small">${vm.source ?? vm.label}</div>`;
  return html`<div class="pills">${vm.sources.map((source) => pill(context, source, source === vm.source, () => source !== vm.source && context.run(mediaCommands.source(vm.id, source))))}</div>`;
}

function renderStations(vm: MediaViewModel, context: RenderContext): TemplateResult {
  if (vm.stations.length === 0) return html`<div class="small">${translate(context.language, 'no_stations')}</div>`;
  const selected = vm.targets.some((target) => target.id === context.selection) ? (context.selection as string) : vm.id;
  return html`<div class="stack">
    ${vm.targets.length > 1
      ? html`<div class="tiny">${translate(context.language, 'play_on')}</div>
          <div class="pills">${vm.targets.map((target) => pill(context, target.name, target.id === selected, () => context.select(target.id)))}</div>`
      : nothing}
    <div class="pills">${vm.stations.map((station) => pill(context, station.name, false, () => context.run(mediaCommands.play(selected, station))))}</div>
  </div>`;
}

function renderRemote(vm: MediaViewModel, context: RenderContext): TemplateResult {
  const { remote, keys } = vm;
  const key = (label: MessageKey, name: IconName, command: string): TemplateResult | typeof nothing =>
    remote ? iconButton(context, label, name, 16, mediaCommands.key(remote, command)) : nothing;
  const canVolume = vm.canVolumeStep || vm.canVolumeSet;
  return html`<div class="stack">
    <div class="row">
      <span class="small with-icon">${icon('tv', 16)}${vm.title || vm.source || vm.label}</span>
      ${vm.canPower ? iconButton(context, 'power', 'power', 16, mediaCommands.power(vm.id, vm.on), vm.on) : nothing}
    </div>
    <div class="remote">
      ${canVolume
        ? html`<div class="rocker">
            ${iconButton(context, 'volume_up', 'plus', 16, mediaCommands.volumeStep(vm.id, true))}
            <span class="rocker-label">Vol</span>
            ${iconButton(context, 'volume_down', 'minus', 16, mediaCommands.volumeStep(vm.id, false))}
          </div>`
        : nothing}
      ${remote
        ? html`<div class="pad">
              <span></span>${key('move_up', 'up', keys.up)}<span></span>
              ${key('move_left', 'left', keys.left)}
              <octa-button class="icon" .appearance=${context.appearance} .label=${'OK'} active .disabled=${context.disabled} @click=${() => context.run(mediaCommands.key(remote, keys.ok))}>OK</octa-button>
              ${key('move_right', 'right', keys.right)}
              <span></span>${key('move_down', 'down', keys.down)}<span></span>
            </div>
            <div class="rocker">
              ${key('channel_up', 'plus', keys.channel_up)}
              <span class="rocker-label">CH</span>
              ${key('channel_down', 'minus', keys.channel_down)}
            </div>`
        : nothing}
    </div>
    ${remote ? html`<div class="controls player-controls">${key('tv_home', 'home', keys.home)} ${key('tv_back', 'undo', keys.back)}</div>` : nothing}
    ${vm.apps.length > 0 ? html`<div class="pills tv-apps">${vm.apps.map((app) => pill(context, app.name, false, () => context.run(mediaCommands.startApp(vm.id, app))))}</div>` : nothing}
  </div>`;
}

const RENDERERS: Record<string, (vm: MediaViewModel, context: RenderContext) => TemplateResult> = {
  media: renderMedia,
  player: renderPlayer,
  volume: renderVolume,
  source: renderSource,
  stations: renderStations,
  tv_remote: renderRemote,
};

function spotifySource(entity: HassEntity | undefined, config: CardConfig, port: HassPort): SpotifySource | null {
  const id = config.roles.spotify;
  const account = id ? port.getEntity(id) : undefined;
  if (!id || !account || !entity) return null;
  const settings = (config.extras?.spotify ?? {}) as { device?: unknown; playlists?: unknown };
  const device = typeof settings.device === 'string' && settings.device !== '' ? settings.device : port.formatName(entity);
  const devices = account.attributes.source_list;
  return { id, device, deviceVisible: Array.isArray(devices) && devices.includes(device), playlists: parseStations(settings.playlists, 'playlist') };
}

/** Cast names the app, but plays both spoken text and plain streams in its default receiver. */
function originOf(attributes: HassEntity['attributes'], language: string): string | null {
  const content = text(attributes.media_content_id);
  if (content.includes('/api/tts_proxy/') || content.startsWith('media-source://tts/')) return 'Text-to-Speech';
  const app = text(attributes.app_name);
  if (app === 'Default Media Receiver') return translate(language, 'origin_stream');
  return app || text(attributes.source) || null;
}

function targets(mainEntity: HassEntity | undefined, config: CardConfig, nameOf: (entity: HassEntity) => string, getEntity: (id: string) => HassEntity | undefined): MediaTarget[] {
  const entities = [mainEntity, ...TARGET_ROLES.map((role) => (config.roles[role] ? getEntity(config.roles[role] as string) : undefined))];
  return entities.filter((entity): entity is HassEntity => entity !== undefined).map((entity) => ({ id: entity.entity_id, name: nameOf(entity) }));
}

export const mediaWidget = defineWidget<MediaViewModel>({
  element: 'octa-media-card',
  name: 'Octa Home UI Medien',
  description: 'Wiedergabe, Lautstärke, Quelle, Sender oder TV-Fernbedienung',
  spec: {
    variants: ['media', 'player', 'volume', 'source', 'stations', 'tv_remote'],
    defaultVariant: 'media',
    roles: {
      main: { domains: ['media_player'], required: true },
      remote: { domains: ['remote'] },
      tts: { domains: ['tts'] },
      spotify: { domains: ['media_player'] },
      ...Object.fromEntries(TARGET_ROLES.map((role) => [role, { domains: ['media_player'] }])),
    },
    extras: ['stations', 'remote_keys', 'remote_apps', 'spotify'],
  },
  editorHidden: ['spotify'],
  editor: (german) => [
    {
      name: 'stations',
      selector: {
        object: {
          multiple: true,
          label_field: 'name',
          fields: {
            name: { label: 'Name', required: true, selector: { text: {} } },
            media_id: { label: german ? 'Adresse des Streams' : 'Stream address', required: true, selector: { text: {} } },
            media_type: { label: german ? 'Medientyp (Standard: music)' : 'Media type (default: music)', selector: { text: {} } },
          },
        },
      },
    },
    {
      name: 'remote_apps',
      selector: {
        object: {
          multiple: true,
          label_field: 'name',
          fields: {
            name: { label: 'Name', required: true, selector: { text: {} } },
            app_id: { label: german ? 'App-ID des Fernsehers' : 'TV app ID', selector: { text: {} } },
            script: { label: german ? 'oder Skript' : 'or script', selector: { entity: { domain: ['script'] } } },
            variables: { label: german ? 'Variablen des Skripts' : 'Script variables', selector: { object: {} } },
          },
        },
      },
    },
  ],
  columns: (variant) => (['media', 'player', 'tv_remote', 'stations'].includes(variant) ? 12 : 6),
  toViewModel(target, config, port) {
    const { entity } = target;
    const attributes = entity?.attributes ?? {};
    const has = (feature: MediaFeature): boolean => entity !== undefined && supports(entity, 'media_player', feature);
    const level = attributes.volume_level;
    const picture = attributes.entity_picture;
    const sources = attributes.source_list;
    return {
      id: target.id,
      variant: config.variant,
      label: target.stateLabel,
      title: text(attributes.media_title),
      artist: text(attributes.media_artist) || text(attributes.app_name),
      performer: text(attributes.media_artist),
      origin: originOf(attributes, port.language),
      picture: typeof picture === 'string' ? picture : null,
      on: target.status === 'ok' && entity?.state !== 'off' && entity?.state !== 'standby',
      playing: entity?.state === 'playing',
      canPrevious: has('PREVIOUS_TRACK'),
      canPlay: (has('PAUSE') || has('PLAY')) && !nothingLoaded(entity),
      canNext: has('NEXT_TRACK'),
      canPlayMedia: has('PLAY_MEDIA'),
      canPower: has('TURN_ON') && has('TURN_OFF'),
      canVolumeSet: has('VOLUME_SET'),
      canVolumeStep: has('VOLUME_STEP'),
      canMute: has('VOLUME_MUTE'),
      volume: typeof level === 'number' ? Math.round(level * 100) : null,
      muted: attributes.is_volume_muted === true,
      source: typeof attributes.source === 'string' ? attributes.source : null,
      sources: has('SELECT_SOURCE') && Array.isArray(sources) ? sources.filter((item): item is string => typeof item === 'string') : [],
      stations: parseStations(config.extras?.stations),
      tts: config.roles.tts && port.getEntity(config.roles.tts) ? config.roles.tts : null,
      spotify: spotifySource(entity, config, port),
      targets: targets(entity, config, (item) => port.formatName(item), (id) => port.getEntity(id)),
      remote: config.roles.remote ?? null,
      keys: parseKeys(config.extras?.remote_keys),
      apps: parseRemoteApps(config.extras?.remote_apps),
    };
  },
  render(vm, context) {
    return (RENDERERS[vm.variant] ?? renderMedia)(vm, context);
  },
});
