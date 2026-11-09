# Roadmap: Octa Home UI 1.0

As of 2026-11-09, version 0.1.9. The target system is Home Assistant Container 2026.9.4.

German version: [ROADMAP.de.md](ROADMAP.de.md).

## Overview

| Phase | Result | Status |
|---|---|---|
| 0 | Feasibility on 2026.9.4 | done |
| 1 | Design core and gallery | done |
| 2 | Theme | done, installed |
| 3 | Lights, switches, scenes, climate, fans and valves, covers | done |
| 4 | Sensors, energy, security, camera | done |
| 5 | Media with player, sources and TV remote | done, Spotify on hold |
| 6 | Weather, system, Docker, appliances, inputs | done |
| 7 | Dashboard strategy and templates | done, real-world test open |
| New | Room block, window block, lists in the visual editor, English documentation | done |
| G | GitHub and HACS | published, cards installable through HACS |
| 8 | Acceptance and release 1.0 | open |

## Devices and test status

**Real** means with real devices in a production Home Assistant. **Real data** means in a separate test instance with real sources. **Simulated** means with the Home Assistant demo integration, which checks logic and interface but no vendor specifics.

| Card | Status | Checked with |
|---|---|---|
| Light `octa-light-card` | Real | switching, test card |
| Switch `octa-switch-card` | Real | switching |
| Climate `octa-climate-card` | Real | target temperature on a thermostat |
| Weather `octa-weather-card` | Real | values and forecast |
| Media `octa-media-card`, `player` | Real | Google Mini: radio, speech, MP3 link, pause |
| Media `octa-media-card`, `tv_remote` | Real | Samsung TV: keys, home, back, app buttons |
| Windows `octa-contacts-card` | Real | window contacts |
| Room `octa-room-card` | Real | thermostat, light, windows, media |
| Camera `octa-camera-card` | Real and real data | public image through Generic Camera, outage of a source. No video stream |
| System `octa-system-card` | Real data | System Monitor. Uptime not checked |
| Docker `octa-system-card`, `docker_status` | Real data | figures from `docker stats` |
| Covers, garage door | Simulated | including the safety question |
| Lock and alarm | Simulated | including the safety rules |
| Scenes, fans and valves, sensors, energy | Simulated | |
| Vacuum, washer, inputs | Simulated | |
| Dashboard strategy | Simulated | new device appears without a reload |

## Open until 1.0

- [x] Accept the visual editor with real list editing
- [ ] Check the safety questions on a real smartphone
- [ ] Have the safety code reviewed by a second person
- [ ] Check the automatic template on a real system
- [ ] Data source for the Docker card on a real system
- [ ] Check the video stream of a real camera

## Phase G: GitHub and HACS

- [x] README, test status and guides in German and English
- [x] `hacs.json` for the cards
- [x] License: MIT
- [x] Author: octadot.de
- [x] Name: Octa Home UI, repository `octa-home-ui`
- [x] Technical names changed: `custom:octa-…-card`, `octa-home-ui.js`
- [x] All documents in German and English
- [x] Published as `octa-vx/octa-home-ui`
- [x] CI with tests and HACS validation
- [x] Release with the card file, installation through HACS tested as a custom repository
- [x] Update through HACS tested
- [ ] Provide the theme through HACS
- [ ] Listing in the official HACS catalog

## Acceptance criteria 1.0

| Criterion | Status |
|---|---|
| Theme, cards and strategy can be installed and updated by ZIP on 2026.9.4 | met |
| Installation through HACS | met, as a custom repository, cards only |
| Update through HACS | met, as a custom repository |
| Installation from the GitHub release | met |
| Weather card with real values and forecast | met |
| Server card with real values | met in the test instance |
| Docker card with real states and no write access | met in the test instance |
| Lock and alarm meet the safety rules | met, simulated |
| All cards meet the state matrix in light and dark | met |
| No axe violations | met |
| No token, PIN or demo value in configuration or bundle | met |

## On hold

- Spotify: prepared, but never tested with a real account, and therefore hidden in the editor.

## After 1.0

- Test on newer Home Assistant versions
- More blocks: whole-home heating, switches, multiroom, batteries, actions
- Doorbell, solar and wallbox, irrigation, calendar and shopping list
