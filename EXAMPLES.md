# Octa Home UI: examples

All entity IDs are placeholders, replace them with your own. Each block fits directly under `cards:`, except the complete dashboard at the end. Every option is explained in the [YAML reference](docs/YAML-REFERENCE.md). German version: [EXAMPLES.de.md](EXAMPLES.de.md).

## Room

Heating, lights, windows and media of one room in one block. Each part only appears when it is configured.

```yaml
- type: custom:octa-room-card
  name: Living room
  entity: climate.living_room
  lights:
    - light.ceiling
    - entity: switch.floor_lamp
      name: Floor lamp
  windows:
    - entity: binary_sensor.window_left
      name: Left
    - entity: binary_sensor.window_right
      name: Right
  roles:
    media: media_player.living_room
```

## Windows and doors

Any number of contacts in one block, with the state as an icon.

```yaml
- type: custom:octa-contacts-card
  name: Windows
  sensors:
    - entity: binary_sensor.window_kitchen
      name: Kitchen
    - entity: binary_sensor.window_bedroom
      name: Bedroom
```

## Speaker with radio, speech and links

Cover or icon, title, source, previous, play/pause, next and volume in one block. Below it, sources can be chosen: your stations, text-to-speech, or a link to an audio file. For `.m3u` and `.pls` playlists, Google Cast only plays the first entry.

```yaml
- type: custom:octa-media-card
  entity: media_player.kitchen
  variant: player
  roles:
    tts: tts.google_translate_en_com
  stations:
    - name: News
      media_id: https://example.com/stream.mp3
      media_type: music
    - name: Music
      media_id: https://example.com/other-stream.mp3
      media_type: music
```

## TV remote with app buttons

The app IDs in this example are those of Samsung TVs.

```yaml
- type: custom:octa-media-card
  entity: media_player.tv
  variant: tv_remote
  roles:
    remote: remote.tv
  remote_apps:
    - name: YouTube
      app_id: "111299001912"
    - name: Netflix
      app_id: "3201907018807"
    - name: Prime
      app_id: "3201910019365"
```

If your TV ignores `app_id`, a button can start one of your own scripts instead:

```yaml
- type: custom:octa-media-card
  entity: media_player.tv
  variant: tv_remote
  roles:
    remote: remote.tv
  remote_apps:
    - name: YouTube
      script: script.tv_source
      variables:
        source: YouTube
```

## Camera

Any `camera` entity works, including a still image added with the Generic Camera integration.

```yaml
- type: custom:octa-camera-card
  entity: camera.driveway
  name: Driveway
- type: custom:octa-camera-card
  entity: camera.driveway
  variant: snapshot
  name: Still image
```

## Server status

The sensors come from the System Monitor integration. Enable the ones you need under its entities.

```yaml
- type: custom:octa-system-card
  variant: system_status
  roles:
    cpu: sensor.processor_use
    memory: sensor.memory_usage
    temperature: sensor.processor_temperature
    disk: sensor.disk_usage
```

## Docker status

Read only. Home Assistant cannot read Docker by itself, so the sensors must come from another source, for example over MQTT.

```yaml
- type: custom:octa-system-card
  variant: docker_status
  containers:
    - name: homeassistant
      status: sensor.homeassistant_status
      cpu: sensor.homeassistant_cpu
      memory: sensor.homeassistant_memory
```

## Complete dashboard

Paste this into the raw configuration editor of a new dashboard.

```yaml
title: Home
views:
  - title: Overview
    type: sections
    sections:
      - type: grid
        cards:
          - type: custom:octa-weather-card
            entity: weather.forecast_home
          - type: custom:octa-room-card
            name: Living room
            entity: climate.living_room
            lights:
              - light.ceiling
            windows:
              - entity: binary_sensor.window_left
                name: Left
            roles:
              media: media_player.living_room
          - type: custom:octa-media-card
            entity: media_player.kitchen
            variant: player
```
