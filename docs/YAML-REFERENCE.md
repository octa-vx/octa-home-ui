# Octa Home UI: YAML reference

Tested with Home Assistant 2026.9.4. All entity IDs in the examples are placeholders and must be replaced with your own.

## Create your own dashboard

This requires the [installation](../INSTALLATION.md), including the registered resource. Copy-ready blocks are in [EXAMPLES.md](../EXAMPLES.md). German version: [YAML-REFERENCE.de.md](YAML-REFERENCE.de.md).

All lists, such as stations, windows, lights or app buttons, can also be maintained in the visual card editor. YAML is only an alternative. If you mix both, write lists in the form with `entity` and `name`, which is what the editor writes itself.

1. Settings → Dashboards → Add dashboard → create a new dashboard from scratch.
2. Open the dashboard, edit it, then top right menu → Raw configuration editor.
3. Paste the YAML and save.

```yaml
views:
  - title: Wohnzimmer
    type: sections
    sections:
      - type: grid
        cards:
          - type: custom:octa-light-card
            entity: light.deckenlicht
          - type: custom:octa-climate-card
            entity: climate.wohnzimmer
```

Ready-made templates are in `octa-home-ui-docs/examples/`. The blocks below are lists and fit directly under `cards:`.

## For all cards

| Key | Required | Meaning |
|---|---|---|
| `type` | yes | `custom:octa-…-card` |
| `entity` | usually | main device, short form of `roles: { main: … }` |
| `variant` | no | presentation, defaults to the first variant of the card |
| `name` | no | replaces the displayed name |
| `appearance` | no | `soft` (default) or `flat` |
| `roles` | no | further devices of the card, see the respective table |

**No secrets in YAML:** keys such as `code`, `pin`, `password`, `token`, `access_token`, `passcode` or `api_key` are rejected. The alarm code is only entered on the card.

Home Assistant shows an invalid configuration as a card error in the form `path: error code`:

| Error code | Cause |
|---|---|
| `unknown_variant` | this card has no such variant |
| `invalid_appearance` | neither `soft` nor `flat` |
| `missing_role` | a required device is missing, usually `entity` |
| `unknown_role` | this card has no such role |
| `invalid_entity` | not a valid entity ID |
| `wrong_domain` | the device has the wrong domain for this role |
| `invalid_option` | the value has the wrong type |
| `forbidden_secret` | a secret in the configuration |

## Safety

These actions always ask first and name the device and value: unlocking and opening locks, disarming without entering a code, and opening covers of the classes `garage`, `gate` and `door`. The question expires after 15 seconds. The class comes from Home Assistant and can be set there per device. Covers without a class do not ask.

## Light: `octa-light-card`

Role: `main` (`light`, required).

| Variant | Presentation |
|---|---|
| `tile` | tile, default |
| `slider` | brightness slider |
| `color` | color picker |
| `temperature` | color temperature |
| `group` | light group with its members |

```yaml
- type: custom:octa-light-card
  entity: light.deckenlicht
- type: custom:octa-light-card
  entity: light.deckenlicht
  variant: slider
- type: custom:octa-light-card
  entity: light.led_strip
  variant: color
- type: custom:octa-light-card
  entity: light.led_strip
  variant: temperature
- type: custom:octa-light-card
  entity: light.alle_lampen
  variant: group
```

## Switch: `octa-switch-card`

Role: `main` (`switch` or `input_boolean`, required). Variants: `toggle` (default), `input_boolean`.

```yaml
- type: custom:octa-switch-card
  entity: switch.steckdose
- type: custom:octa-switch-card
  entity: input_boolean.gaeste
  variant: input_boolean
```

## Scenes: `octa-scene-card`

Roles: `main` (`scene`, required), `scene_2` to `scene_6` (`scene`). Variant: `scenes`.

```yaml
- type: custom:octa-scene-card
  entity: scene.abend
  roles:
    scene_2: scene.film
    scene_3: scene.morgen
```

## Climate: `octa-climate-card`

Role: `main` (`climate`, required). Variants: `thermostat` (default, dial), `buttons` (plus and minus), `mode` (operating modes).

```yaml
- type: custom:octa-climate-card
  entity: climate.wohnzimmer
- type: custom:octa-climate-card
  entity: climate.wohnzimmer
  variant: buttons
- type: custom:octa-climate-card
  entity: climate.wohnzimmer
  variant: mode
```

## Air and valves: `octa-air-card`

Role: `main` (`fan` or `valve`, required). Variants: `speed` (default, fan), `valve`.

```yaml
- type: custom:octa-air-card
  entity: fan.lueftung
- type: custom:octa-air-card
  entity: valve.bewaesserung
  variant: valve
```

## Covers: `octa-cover-card`

Role: `main` (`cover`, required). Variants: `cover` (default, buttons), `position` (slider), `tilt` (slats).

```yaml
- type: custom:octa-cover-card
  entity: cover.rollladen_sued
- type: custom:octa-cover-card
  entity: cover.rollladen_sued
  variant: position
- type: custom:octa-cover-card
  entity: cover.jalousie
  variant: tilt
```

## Sensors: `octa-sensor-card`

Role: `main` (`sensor`, required). Options, all numbers: `min`, `max`, `warning`, `danger`.

| Variant | Presentation |
|---|---|
| `sensor` | value, default |
| `gauge` | gauge with a scale |
| `co2` | CO₂ with a traffic light |
| `statistic` | figures for the last 24 hours |
| `history` | chart of the last 24 hours |
| `badge` | compact badge |

```yaml
- type: custom:octa-sensor-card
  entity: sensor.temperatur
- type: custom:octa-sensor-card
  entity: sensor.temperatur
  variant: gauge
  min: 0
  max: 40
  warning: 28
  danger: 35
- type: custom:octa-sensor-card
  entity: sensor.co2
  variant: co2
- type: custom:octa-sensor-card
  entity: sensor.temperatur
  variant: statistic
- type: custom:octa-sensor-card
  entity: sensor.temperatur
  variant: history
- type: custom:octa-sensor-card
  entity: sensor.temperatur
  variant: badge
```

## Energy: `octa-energy-card`

All roles are `sensor`.

| Variant | Presentation | Roles |
|---|---|---|
| `power` | current power, default | `main` (required), `energy` |
| `power_flow` | energy flow | `main` (required, house), `solar`, `grid`, `battery` |
| `battery_list` | battery levels | `main` (required), `battery_2` to `battery_8` |

```yaml
- type: custom:octa-energy-card
  entity: sensor.leistung_haus
  roles:
    energy: sensor.energie_heute
- type: custom:octa-energy-card
  entity: sensor.leistung_haus
  variant: power_flow
  roles:
    solar: sensor.leistung_solar
    grid: sensor.leistung_netz
    battery: sensor.leistung_akku
- type: custom:octa-energy-card
  entity: sensor.akku_tuer
  variant: battery_list
  roles:
    battery_2: sensor.akku_fenster
```

## Security: `octa-security-card`

Role: `main` (required), domain depends on the variant.

| Variant | Domain |
|---|---|
| `contact` | `binary_sensor`, default |
| `motion` | `binary_sensor` |
| `lock` | `lock` |
| `alarm` | `alarm_control_panel` |
| `person` | `person` or `device_tracker` |

Locks that require a code currently only show their state.

```yaml
- type: custom:octa-security-card
  entity: binary_sensor.haustuer
- type: custom:octa-security-card
  entity: binary_sensor.bewegung_flur
  variant: motion
- type: custom:octa-security-card
  entity: lock.haustuer
  variant: lock
- type: custom:octa-security-card
  entity: alarm_control_panel.haus
  variant: alarm
- type: custom:octa-security-card
  entity: person.anna
  variant: person
```

## Room: `octa-room-card`

Heating, lights, windows and media of one room in one block. Each part only appears when it is configured, and a missing device does not affect the others.

| Key | Meaning |
|---|---|
| `entity` | thermostat (`climate`), optional, with plus and minus for the target temperature |
| `lights` | list of `light` and `switch` entities, as an entity ID or with `entity` and `name` |
| `windows` | list of `binary_sensor` entities, as for `sensors` below |
| `roles` | `media` (`media_player`) for title and play/pause |

Variant: `room`. `name` sets the heading, for example the name of the room.

```yaml
- type: custom:octa-room-card
  name: Wohnzimmer
  entity: climate.living_room
  lights:
    - light.ceiling
    - entity: switch.stehlampe
      name: Stehlampe
  windows:
    - entity: binary_sensor.fenster_wohnzimmer_1
      name: Links
    - binary_sensor.fenster_wohnzimmer_2
  roles:
    media: media_player.living_room
```

## Windows and doors in one block: `octa-contacts-card`

Any number of contacts in one block, with the state as an icon instead of text. Open is red, closed is green, unknown or unavailable is grey. A missing sensor does not affect the others.

Variant: `group`. `sensors` is a list of entity IDs (`binary_sensor`) or of `entity` with an optional `name`. `name` on the card changes the heading, the default is "Windows".

```yaml
- type: custom:octa-contacts-card
  name: Erdgeschoss
  sensors:
    - entity: binary_sensor.fenster_kueche
      name: Küche
    - binary_sensor.fenster_wohnzimmer
```

## Camera: `octa-camera-card`

Roles: `main` (`camera`, required), `motion` (`binary_sensor`). Variants: `camera` (default), `snapshot`, `ptz`, `security_cam`.

```yaml
- type: custom:octa-camera-card
  entity: camera.einfahrt
- type: custom:octa-camera-card
  entity: camera.einfahrt
  variant: snapshot
- type: custom:octa-camera-card
  entity: camera.garten
  variant: ptz
- type: custom:octa-camera-card
  entity: camera.einfahrt
  variant: security_cam
  roles:
    motion: binary_sensor.bewegung_einfahrt
```

## Media: `octa-media-card`

Roles: `main` (`media_player`, required), `remote` (`remote`), `target_2` to `target_6` (`media_player`), and for `player` also `tts` (`tts`) and `spotify` (`media_player`).

| Variant | Presentation | Additional |
|---|---|---|
| `media` | playback, default | |
| `player` | everything in one block: cover or icon, title, source (for example Spotify, YouTube, text-to-speech), previous, play/pause, next, volume | |
| `volume` | volume | |
| `source` | source selection | |
| `stations` | station list | `stations`: list of `name`, `media_id`, optional `media_type` |
| `tv_remote` | remote control | role `remote`, optional `remote_keys`, `remote_apps` |

`player` gets a source selection as soon as something is configured for it. Each source only appears when it is configured:

| Source | Setting |
|---|---|
| Radio | `stations` as above |
| Speech | role `tts` with a `tts` entity |
| Link | nothing, appears on every device that can play media. Enter an `http(s)` address of an audio file or playlist |

For playlists in `.m3u` or `.pls` format, Google Cast only plays the first entry, which suits radio streams. Links from Spotify or YouTube do not work here.

Spotify is prepared but on hold and has not been tested with a real account: role `spotify` and the key `spotify` with `playlists` and `device`.

`remote_keys` replaces individual key commands. Available keys: `up`, `down`, `left`, `right`, `ok`, `channel_up`, `channel_down`, `home`, `back`.

`remote_apps` creates app buttons. Each entry has a `name` and either `app_id` (the app ID of the TV, started with `media_player.play_media`) or `script` with optional `variables`, in case the TV only starts apps in its own way.

```yaml
- type: custom:octa-media-card
  entity: media_player.living_room
- type: custom:octa-media-card
  entity: media_player.living_room
  variant: player
  roles:
    tts: tts.google_translate_en_com
  stations:
    - name: Radio
      media_id: http://example.invalid/stream.mp3
      media_type: music
- type: custom:octa-media-card
  entity: media_player.living_room
  variant: volume
- type: custom:octa-media-card
  entity: media_player.living_room
  variant: source
- type: custom:octa-media-card
  entity: media_player.living_room
  variant: stations
  roles:
    target_2: media_player.kueche
  stations:
    - name: Radio
      media_id: http://example.invalid/stream.mp3
      media_type: music
- type: custom:octa-media-card
  entity: media_player.fernseher
  variant: tv_remote
  roles:
    remote: remote.fernseher
  remote_keys:
    ok: KEY_ENTER
  remote_apps:
    - name: Netflix
      app_id: "3201907018807"
    - name: YouTube
      script: script.tv_source
      variables:
        source: YouTube
```

## Weather: `octa-weather-card`

Role: `main` (`weather`, required). Variant: `weather`. Only values the device provides are shown.

```yaml
- type: custom:octa-weather-card
  entity: weather.forecast_home
```

## System: `octa-system-card`

Display only, without controls. Roles, all optional: `main` (`binary_sensor` or `sensor`), `cpu`, `memory`, `temperature`, `disk`, `uptime` (`sensor`).

Variants: `server_status` (default), `system_status`, `docker_status`. Docker adds `containers`, a list of `name` and optional `status`, `cpu`, `memory` as entity IDs.

```yaml
- type: custom:octa-system-card
  entity: binary_sensor.server
  roles:
    cpu: sensor.prozessor
    memory: sensor.arbeitsspeicher
- type: custom:octa-system-card
  variant: system_status
  roles:
    disk: sensor.festplatte
    uptime: sensor.laufzeit
- type: custom:octa-system-card
  variant: docker_status
  containers:
    - name: homeassistant
      status: sensor.ha_container_status
      cpu: sensor.ha_container_cpu
      memory: sensor.ha_container_speicher
```

## Appliances: `octa-appliance-card`

| Variant | Roles |
|---|---|
| `vacuum` | `main` (`vacuum`, required), default |
| `filter` | `main` (`sensor`, required), `part_2` to `part_6` (`sensor`), one wear part each |
| `washer` | `main` (`sensor`, required, remaining time), `program` (`sensor`) |

```yaml
- type: custom:octa-appliance-card
  entity: vacuum.saugroboter
- type: custom:octa-appliance-card
  entity: sensor.filter_haupt
  variant: filter
  roles:
    part_2: sensor.filter_buerste
- type: custom:octa-appliance-card
  entity: sensor.waschmaschine_restzeit
  variant: washer
  roles:
    program: sensor.waschmaschine_programm
```

## Inputs: `octa-input-card`

Role: `main` (required), domain depends on the variant.

| Variant | Domain |
|---|---|
| `input_select` | `input_select` or `select`, default |
| `input_number` | `input_number` or `number` |
| `input_text` | `input_text` or `text` |
| `input_datetime` | `input_datetime` |
| `timer` | `timer` |
| `button` | `button` or `input_button` |

```yaml
- type: custom:octa-input-card
  entity: input_select.tv_source
- type: custom:octa-input-card
  entity: input_number.zieltemperatur
  variant: input_number
- type: custom:octa-input-card
  entity: input_text.notiz
  variant: input_text
- type: custom:octa-input-card
  entity: input_datetime.wecker
  variant: input_datetime
- type: custom:octa-input-card
  entity: timer.kueche
  variant: timer
- type: custom:octa-input-card
  entity: input_button.klingel
  variant: button
```

## Optional: automatic dashboard

Instead of placing cards individually, the strategy can generate a whole dashboard from devices and areas. It can be chosen when creating a dashboard under the template "Octa Home UI", or in the raw configuration. All settings are optional.

| Key | Meaning |
|---|---|
| `areas_order` | order of the areas, as area IDs |
| `hide_entities` | entity IDs to hide |
| `overrides` | a different card or variant for individual entities |

Templates: `examples/dashboard-strategy.yaml` for a whole dashboard, `examples/room-section.yaml` for a single area as a section in your own dashboard.
