# Octa Home UI: Beispiele

Alle Entity-IDs sind Platzhalter und müssen durch die eigenen ersetzt werden. Jeder Block passt direkt unter `cards:`, außer dem kompletten Dashboard am Ende. Jede Option steht in der [YAML-Referenz](docs/YAML-REFERENCE.de.md). English version: [EXAMPLES.md](EXAMPLES.md).

## Raum

Heizung, Licht, Fenster und Medien eines Raums in einem Block. Jeder Teil erscheint nur, wenn er eingetragen ist.

```yaml
- type: custom:octa-room-card
  name: Wohnzimmer
  entity: climate.living_room
  lights:
    - light.ceiling
    - entity: switch.floor_lamp
      name: Stehlampe
  windows:
    - entity: binary_sensor.window_left
      name: Links
    - entity: binary_sensor.window_right
      name: Rechts
  roles:
    media: media_player.living_room
```

## Fenster und Türen

Beliebig viele Kontakte in einem Block, der Zustand als Icon.

```yaml
- type: custom:octa-contacts-card
  name: Fenster
  sensors:
    - entity: binary_sensor.window_kitchen
      name: Küche
    - entity: binary_sensor.window_bedroom
      name: Schlafzimmer
```

## Lautsprecher mit Radio, Sprache und Links

Cover oder Icon, Titel, Quelle, Zurück, Play/Pause, Weiter und Lautstärke in einem Block. Darunter lassen sich Quellen wählen: deine Sender, Sprachausgabe oder ein Link zu einer Audiodatei. Bei `.m3u`- und `.pls`-Playlists spielt Google Cast nur den ersten Eintrag ab.

```yaml
- type: custom:octa-media-card
  entity: media_player.kitchen
  variant: player
  roles:
    tts: tts.google_translate_en_com
  stations:
    - name: Nachrichten
      media_id: https://example.com/stream.mp3
      media_type: music
    - name: Musik
      media_id: https://example.com/other-stream.mp3
      media_type: music
```

## TV-Fernbedienung mit App-Knöpfen

Die App-IDs in diesem Beispiel gelten für Samsung-Fernseher.

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

Ignoriert dein Fernseher `app_id`, kann ein Knopf stattdessen ein eigenes Skript starten:

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

## Kamera

Jede `camera`-Entity funktioniert, auch ein Standbild, das über die Integration Generic Camera eingebunden ist.

```yaml
- type: custom:octa-camera-card
  entity: camera.driveway
  name: Einfahrt
- type: custom:octa-camera-card
  entity: camera.driveway
  variant: snapshot
  name: Standbild
```

## Serverstatus

Die Sensoren kommen aus der Integration System Monitor. Die benötigten lassen sich dort unter den Entitäten aktivieren.

```yaml
- type: custom:octa-system-card
  variant: system_status
  roles:
    cpu: sensor.processor_use
    memory: sensor.memory_usage
    temperature: sensor.processor_temperature
    disk: sensor.disk_usage
```

## Docker-Status

Nur Anzeige. Home Assistant kann Docker nicht von selbst lesen, die Sensoren müssen also aus einer anderen Quelle kommen, zum Beispiel per MQTT.

```yaml
- type: custom:octa-system-card
  variant: docker_status
  containers:
    - name: homeassistant
      status: sensor.homeassistant_status
      cpu: sensor.homeassistant_cpu
      memory: sensor.homeassistant_memory
```

## Komplettes Dashboard

Das in den Rohkonfigurations-Editor eines neuen Dashboards einfügen.

```yaml
title: Zuhause
views:
  - title: Übersicht
    type: sections
    sections:
      - type: grid
        cards:
          - type: custom:octa-weather-card
            entity: weather.forecast_home
          - type: custom:octa-room-card
            name: Wohnzimmer
            entity: climate.living_room
            lights:
              - light.ceiling
            windows:
              - entity: binary_sensor.window_left
                name: Links
            roles:
              media: media_player.living_room
          - type: custom:octa-media-card
            entity: media_player.kitchen
            variant: player
```
