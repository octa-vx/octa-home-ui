# Roadmap: Octa Home UI 1.0

Stand: 09.11.2026, Version 0.1.7. Zielsystem ist Home Assistant Container 2026.9.4.

English version: [ROADMAP.md](ROADMAP.md).

## Überblick

| Phase | Ergebnis | Status |
|---|---|---|
| 0 | Machbarkeit auf 2026.9.4 | fertig |
| 1 | Design-Kern und Galerie | fertig |
| 2 | Theme | fertig, installiert |
| 3 | Licht, Schalter, Szenen, Klima, Lüfter und Ventile, Abdeckungen | fertig |
| 4 | Sensor, Energie, Sicherheit, Kamera | fertig |
| 5 | Medien mit Player, Quellen und TV-Fernbedienung | fertig, Spotify zurückgestellt |
| 6 | Wetter, System, Docker, Haushalt, Eingaben | fertig |
| 7 | Dashboard-Strategie und Vorlagen | fertig, Praxistest offen |
| Neu | Raum-Block, Fenster-Block, Listen im grafischen Editor, englische Doku | fertig |
| G | GitHub und HACS | Vorbereitung läuft |
| 8 | Abnahme und Release 1.0 | offen |

## Geräte und Teststand

**Echt** heißt mit echten Geräten in einem produktiven Home Assistant. **Echte Daten** heißt in einer getrennten Testinstanz mit realen Quellen. **Simuliert** heißt mit der Demo-Integration von Home Assistant, dabei sind Logik und Oberfläche geprüft, aber keine Eigenheiten der Hersteller.

| Karte | Stand | Geprüft mit |
|---|---|---|
| Licht `octa-light-card` | Echt | Schalten, Testkarte |
| Schalter `octa-switch-card` | Echt | Schalten |
| Klima `octa-climate-card` | Echt | Zieltemperatur am Thermostat |
| Wetter `octa-weather-card` | Echt | Werte und Vorhersage |
| Medien `octa-media-card`, `player` | Echt | Google Mini: Radio, Sprachausgabe, MP3-Link, Pause |
| Medien `octa-media-card`, `tv_remote` | Echt | Samsung-Fernseher: Tasten, Home, Zurück, App-Knöpfe |
| Fenster `octa-contacts-card` | Echt | Fensterkontakte |
| Raum `octa-room-card` | Echt | Thermostat, Licht, Fenster, Medien |
| Kamera `octa-camera-card` | Echt und echte Daten | Öffentliches Bild über Generic Camera, Ausfall einer Quelle. Kein Videostream |
| System `octa-system-card` | Echte Daten | System Monitor. Laufzeit nicht geprüft |
| Docker `octa-system-card`, `docker_status` | Echte Daten | Werte aus `docker stats` |
| Abdeckungen, Garagentor | Simuliert | Sicherheitsabfrage eingeschlossen |
| Schloss und Alarm | Simuliert | Sicherheitsregeln eingeschlossen |
| Szenen, Lüfter und Ventile, Sensor, Energie | Simuliert | |
| Saugroboter, Waschmaschine, Eingaben | Simuliert | |
| Dashboard-Strategie | Simuliert | Neues Gerät erscheint ohne Neuladen |

## Offen bis 1.0

- [x] Grafischen Editor mit echter Listenbearbeitung abnehmen
- [ ] Sicherheitsabfragen auf einem echten Smartphone prüfen
- [ ] Sicherheitscode durch eine zweite Person prüfen lassen
- [ ] Automatische Vorlage auf einem echten System prüfen
- [ ] Datenquelle für die Docker-Karte auf einem echten System
- [ ] Videostream einer echten Kamera prüfen

## Phase G: GitHub und HACS

- [x] README, Teststand und Anleitungen auf Deutsch und Englisch
- [x] `hacs.json` für die Karten
- [x] Lizenz: MIT
- [x] Autorenangabe: octadot.de
- [x] Name: Octa Home UI, Repository `octa-home-ui`
- [x] Technische Namen umgestellt: `custom:octa-…-card`, `octa-home-ui.js`
- [x] Alle Dokumente auf Deutsch und Englisch
- [ ] GitHub-Konto festlegen
- [ ] CI mit Tests und HACS-Prüfung
- [ ] Release mit der Kartendatei, Installation über HACS testen
- [ ] Theme über HACS bereitstellen

## Abnahmekriterien 1.0

| Kriterium | Stand |
|---|---|
| Theme, Karten und Strategie per ZIP auf 2026.9.4 installierbar und aktualisierbar | erfüllt |
| Installation und Update über HACS | offen |
| Installation aus dem GitHub-Release | offen |
| Wetterkarte mit realen Werten und Vorhersage | erfüllt |
| Serverkarte mit realen Werten | erfüllt in der Testinstanz |
| Dockerkarte mit realen Zuständen ohne Schreibzugriff | erfüllt in der Testinstanz |
| Schloss und Alarm erfüllen die Sicherheitsregeln | erfüllt, simuliert |
| Alle Karten erfüllen die Zustandsmatrix hell und dunkel | erfüllt |
| Keine axe-Verstöße | erfüllt |
| Kein Token, keine PIN und kein Demo-Wert in Konfiguration oder Bundle | erfüllt |

## Zurückgestellt

- Spotify: vorbereitet, aber nie an einem echten Konto getestet und daher im Editor ausgeblendet.

## Nach 1.0

- Test auf neueren Home-Assistant-Versionen
- Weitere Blöcke: Heizung gesamt, Schalter, Multiroom, Batterien, Aktionen
- Türklingel, Solar und Wallbox, Bewässerung, Kalender und Einkaufsliste
