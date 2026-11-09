# Octa Home UI: Installation

Getestet mit Home Assistant 2026.9.4. English version: [INSTALLATION.md](INSTALLATION.md).

## Installation per ZIP

1. Den Inhalt des ZIP-Archivs in den Home-Assistant-Ordner `config/` entpacken.
2. Unter Einstellungen → Dashboards → Ressourcen eintragen: `/local/octa-home-ui/octa-home-ui.js?v=<version>`, Typ JavaScript-Modul.
3. Für das Theme muss in der `configuration.yaml` stehen:

   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```

   Ist der Eintrag neu, einmal neu starten. Sonst reicht die Aktion `frontend.reload_themes`. Gab es den Ordner `config/www` vorher nicht, ist ebenfalls einmal ein Neustart nötig.

4. Das Theme auswählen: unten links in der Seitenleiste auf den eigenen Namen klicken, dann unter „Allgemein“ bei „Theme“ den Eintrag `Octa Home UI` wählen. Darunter lässt sich Automatisch, Hell oder Dunkel einstellen.

## Eigene Dashboards

Die Karten lassen sich einzeln in eigenen Dashboards verwenden, im grafischen Karten-Editor oder per YAML. Der Einstieg steht in [EXAMPLES.de.md](EXAMPLES.de.md), alle Karten, Varianten und Optionen in der [YAML-Referenz](docs/YAML-REFERENCE.de.md). In der ZIP liegen diese Dokumente in `octa-home-ui-docs/`.

## Update

Neue Version **zuerst** genauso entpacken und erst danach `?v=<version>` in der Ressource anpassen. Anschließend den Browser neu laden.

Browser behalten diese Datei unter derselben Adresse bis zu 31 Tage, ohne neue Versionsnummer bleibt also die alte in Betrieb. Meldet eine Karte, dass sie nicht existiert, alle Tabs von Home Assistant schließen und die Website-Daten der Adresse löschen.

## Entfernen

1. Theme im Profil zurückstellen, Dashboards mit diesen Karten löschen und die Ressource entfernen.
2. `www/octa-home-ui/`, `themes/octa-home-ui.yaml`, `octa-home-ui-docs/`, `INSTALL.md` und `INSTALL.en.md` aus `config/` löschen und den `frontend:`-Eintrag entfernen, wenn nichts anderes ihn braucht.
3. Home Assistant neu starten.

Vor der Installation am besten `config/` sichern, um zum vorherigen Stand zurückkehren zu können.
