# Octa Home UI: YAML-Referenz

Getestet mit Home Assistant 2026.9.4. Alle Entity-IDs in den Beispielen sind Platzhalter und müssen durch die eigenen ersetzt werden.

## Eigenes Dashboard anlegen

Voraussetzung ist die [Installation](../INSTALLATION.de.md), also die eingetragene Ressource. Beispiele zum Kopieren stehen in [EXAMPLES.de.md](../EXAMPLES.de.md). English version: [YAML-REFERENCE.md](YAML-REFERENCE.md).

Alle Listen wie Sender, Fenster, Licht oder App-Knöpfe lassen sich auch im grafischen Karten-Editor pflegen. YAML ist nur eine Alternative. Wer beide Wege mischt, trägt Listen am besten in der Form mit `entity` und `name` ein, die der Editor auch selbst schreibt.

1. Einstellungen → Dashboards → Dashboard hinzufügen → neues Dashboard von Grund auf anlegen.
2. Dashboard öffnen, Bearbeiten, Menü oben rechts → Rohkonfiguration.
3. YAML einfügen und speichern.

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

Fertige Vorlagen liegen in `octa-home-ui-docs/examples/`. Die Blöcke unten sind Listen und passen direkt unter `cards:`.

## Für alle Karten

| Schlüssel | Pflicht | Bedeutung |
|---|---|---|
| `type` | ja | `custom:octa-…-card` |
| `entity` | meist | Hauptgerät, Kurzform für `roles: { main: … }` |
| `variant` | nein | Darstellung, ohne Angabe die erste Variante der Karte |
| `name` | nein | ersetzt den angezeigten Namen |
| `appearance` | nein | `soft` (Standard) oder `flat` |
| `roles` | nein | weitere Geräte der Karte, siehe jeweilige Tabelle |

**Keine Geheimnisse in YAML:** Schlüssel wie `code`, `pin`, `password`, `token`, `access_token`, `passcode` oder `api_key` werden abgelehnt. Der Alarm-Code wird nur auf der Karte eingegeben.

Eine ungültige Konfiguration zeigt Home Assistant als Kartenfehler in der Form `Pfad: Fehlercode` an:

| Fehlercode | Ursache |
|---|---|
| `unknown_variant` | Variante gibt es bei dieser Karte nicht |
| `invalid_appearance` | weder `soft` noch `flat` |
| `missing_role` | Pflichtgerät fehlt, meist `entity` |
| `unknown_role` | Rolle gibt es bei dieser Karte nicht |
| `invalid_entity` | keine gültige Entity-ID |
| `wrong_domain` | Gerät hat die falsche Domain für diese Rolle |
| `invalid_option` | Wert hat den falschen Typ |
| `forbidden_secret` | Geheimnis in der Konfiguration |

## Sicherheit

Diese Aktionen fragen immer nach und nennen dabei Gerät und Wert: Entriegeln und Öffnen von Schlössern, Unscharfschalten ohne Code-Eingabe sowie das Öffnen von Abdeckungen der Klassen `garage`, `gate` und `door`. Die Rückfrage verfällt nach 15 Sekunden. Die Klasse kommt aus Home Assistant und lässt sich dort je Gerät setzen. Abdeckungen ohne Klasse fragen nicht nach.

## Licht: `octa-light-card`

Rolle: `main` (`light`, Pflicht).

| Variante | Darstellung |
|---|---|
| `tile` | Kachel, Standard |
| `slider` | Helligkeit als Schieberegler |
| `color` | Farbauswahl |
| `temperature` | Farbtemperatur |
| `group` | Lichtgruppe mit ihren Mitgliedern |

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

## Schalter: `octa-switch-card`

Rolle: `main` (`switch` oder `input_boolean`, Pflicht). Varianten: `toggle` (Standard), `input_boolean`.

```yaml
- type: custom:octa-switch-card
  entity: switch.steckdose
- type: custom:octa-switch-card
  entity: input_boolean.gaeste
  variant: input_boolean
```

## Szenen: `octa-scene-card`

Rollen: `main` (`scene`, Pflicht), `scene_2` bis `scene_6` (`scene`). Variante: `scenes`.

```yaml
- type: custom:octa-scene-card
  entity: scene.abend
  roles:
    scene_2: scene.film
    scene_3: scene.morgen
```

## Klima: `octa-climate-card`

Rolle: `main` (`climate`, Pflicht). Varianten: `thermostat` (Standard, Drehregler), `buttons` (Plus und Minus), `mode` (Betriebsarten).

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

## Luft und Ventile: `octa-air-card`

Rolle: `main` (`fan` oder `valve`, Pflicht). Varianten: `speed` (Standard, Lüfter), `valve` (Ventil).

```yaml
- type: custom:octa-air-card
  entity: fan.lueftung
- type: custom:octa-air-card
  entity: valve.bewaesserung
  variant: valve
```

## Abdeckungen: `octa-cover-card`

Rolle: `main` (`cover`, Pflicht). Varianten: `cover` (Standard, Tasten), `position` (Schieberegler), `tilt` (Lamellen).

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

## Sensoren: `octa-sensor-card`

Rolle: `main` (`sensor`, Pflicht). Optionen, alle Zahlen: `min`, `max`, `warning`, `danger`.

| Variante | Darstellung |
|---|---|
| `sensor` | Wert, Standard |
| `gauge` | Anzeige mit Skala |
| `co2` | CO₂ mit Ampel |
| `statistic` | Kennzahlen der letzten 24 Stunden |
| `history` | Verlauf der letzten 24 Stunden |
| `badge` | kompaktes Abzeichen |

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

## Energie: `octa-energy-card`

Alle Rollen sind `sensor`.

| Variante | Darstellung | Rollen |
|---|---|---|
| `power` | aktuelle Leistung, Standard | `main` (Pflicht), `energy` |
| `power_flow` | Energiefluss | `main` (Pflicht, Haus), `solar`, `grid`, `battery` |
| `battery_list` | Akkustände | `main` (Pflicht), `battery_2` bis `battery_8` |

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

## Sicherheit: `octa-security-card`

Rolle: `main` (Pflicht), Domain je nach Variante.

| Variante | Domain |
|---|---|
| `contact` | `binary_sensor`, Standard |
| `motion` | `binary_sensor` |
| `lock` | `lock` |
| `alarm` | `alarm_control_panel` |
| `person` | `person` oder `device_tracker` |

Schlösser, die einen Code verlangen, zeigen derzeit nur ihren Zustand.

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

## Raum: `octa-room-card`

Heizung, Licht, Fenster und Medien eines Raums in einem Block. Jeder Teil erscheint nur, wenn er eingetragen ist, und ein fehlendes Gerät stört die anderen nicht.

| Schlüssel | Bedeutung |
|---|---|
| `entity` | Thermostat (`climate`), optional, mit Plus und Minus für die Zieltemperatur |
| `lights` | Liste aus `light`- und `switch`-Entities, als Entity-ID oder mit `entity` und `name` |
| `windows` | Liste aus `binary_sensor`-Entities, wie bei `sensors` unten |
| `roles` | `media` (`media_player`) für Titel und Play/Pause |

Variante: `room`. `name` setzt die Überschrift, zum Beispiel den Raumnamen.

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

## Fenster und Türen im Block: `octa-contacts-card`

Beliebig viele Kontakte in einem Block, der Zustand als Icon statt als Text. Offen ist rot, geschlossen grün, unbekannt oder nicht verfügbar grau. Ein fehlender Sensor stört die anderen nicht.

Variante: `group`. `sensors` ist eine Liste aus Entity-IDs (`binary_sensor`) oder aus `entity` mit optionalem `name`. `name` auf der Karte ändert die Überschrift, Standard ist „Fenster“.

```yaml
- type: custom:octa-contacts-card
  name: Erdgeschoss
  sensors:
    - entity: binary_sensor.fenster_kueche
      name: Küche
    - binary_sensor.fenster_wohnzimmer
```

## Kamera: `octa-camera-card`

Rollen: `main` (`camera`, Pflicht), `motion` (`binary_sensor`). Varianten: `camera` (Standard), `snapshot`, `ptz`, `security_cam`.

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

## Medien: `octa-media-card`

Rollen: `main` (`media_player`, Pflicht), `remote` (`remote`), `target_2` bis `target_6` (`media_player`), für `player` außerdem `tts` (`tts`) und `spotify` (`media_player`).

| Variante | Darstellung | Zusatz |
|---|---|---|
| `media` | Wiedergabe, Standard | |
| `player` | alles in einem Block: Cover oder Icon, Titel, Quelle (zum Beispiel Spotify, YouTube, Text-to-Speech), Zurück, Play/Pause, Weiter, Lautstärke | |
| `volume` | Lautstärke | |
| `source` | Quellenwahl | |
| `stations` | Senderliste | `stations`: Liste aus `name`, `media_id`, optional `media_type` |
| `tv_remote` | Fernbedienung | Rolle `remote`, optional `remote_keys`, `remote_apps` |

`player` bekommt eine Quellen-Auswahl, sobald etwas dafür eingetragen ist. Jede Quelle erscheint nur, wenn sie konfiguriert ist:

| Quelle | Eintrag |
|---|---|
| Radio | `stations` wie oben |
| Sprache | Rolle `tts` mit einer `tts`-Entity |
| Link | nichts, erscheint bei jedem Gerät, das Medien abspielen kann. Eingabe einer `http(s)`-Adresse zu einer Audiodatei oder Playlist |

Bei Playlists im Format `.m3u` oder `.pls` spielt Google Cast nur den ersten Eintrag ab, praktisch also für Radio-Streams. Links von Spotify oder YouTube funktionieren hier nicht.

Spotify ist vorbereitet, aber zurückgestellt und nicht an einem echten Konto getestet: Rolle `spotify` und der Schlüssel `spotify` mit `playlists` und `device`.

`remote_keys` ersetzt einzelne Tastenbefehle. Mögliche Tasten: `up`, `down`, `left`, `right`, `ok`, `channel_up`, `channel_down`, `home`, `back`.

`remote_apps` legt App-Knöpfe an. Jeder Eintrag hat einen `name` und entweder `app_id` (die App-ID des Fernsehers, gestartet über `media_player.play_media`) oder `script` mit optionalen `variables`, falls der Fernseher Apps nur über einen eigenen Weg startet.

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

## Wetter: `octa-weather-card`

Rolle: `main` (`weather`, Pflicht). Variante: `weather`. Gezeigt werden nur Werte, die das Gerät liefert.

```yaml
- type: custom:octa-weather-card
  entity: weather.forecast_home
```

## System: `octa-system-card`

Nur Anzeige, ohne Bedienelemente. Rollen, alle optional: `main` (`binary_sensor` oder `sensor`), `cpu`, `memory`, `temperature`, `disk`, `uptime` (`sensor`).

Varianten: `server_status` (Standard), `system_status`, `docker_status`. Für Docker kommt `containers` dazu, eine Liste aus `name` und optional `status`, `cpu`, `memory` als Entity-IDs.

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

## Haushalt: `octa-appliance-card`

| Variante | Rollen |
|---|---|
| `vacuum` | `main` (`vacuum`, Pflicht), Standard |
| `filter` | `main` (`sensor`, Pflicht), `part_2` bis `part_6` (`sensor`), je ein Verschleißteil |
| `washer` | `main` (`sensor`, Pflicht, Restzeit), `program` (`sensor`) |

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

## Eingaben: `octa-input-card`

Rolle: `main` (Pflicht), Domain je nach Variante.

| Variante | Domain |
|---|---|
| `input_select` | `input_select` oder `select`, Standard |
| `input_number` | `input_number` oder `number` |
| `input_text` | `input_text` oder `text` |
| `input_datetime` | `input_datetime` |
| `timer` | `timer` |
| `button` | `button` oder `input_button` |

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

## Optional: automatisches Dashboard

Statt Karten einzeln zu setzen, kann die Strategie ein ganzes Dashboard aus Geräten und Bereichen erzeugen. Wählbar beim Anlegen unter der Vorlage „Octa Home UI“ oder in der Rohkonfiguration. Alle Angaben sind optional.

| Schlüssel | Bedeutung |
|---|---|
| `areas_order` | Reihenfolge der Bereiche, als Bereichs-IDs |
| `hide_entities` | auszublendende Entity-IDs |
| `overrides` | andere Karte oder Variante für einzelne Entities |

Vorlagen: `examples/dashboard-strategy.yaml` für das ganze Dashboard, `examples/room-section.yaml` für einen einzelnen Bereich als Abschnitt in einem eigenen Dashboard.
