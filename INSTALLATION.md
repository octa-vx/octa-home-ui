# Octa Home UI: installation

Tested with Home Assistant 2026.9.4. German version: [INSTALLATION.de.md](INSTALLATION.de.md).

## Install with HACS

Tested with HACS 2.0.5.

1. In HACS, open the menu at the top right and choose **Custom repositories**.
2. Enter `octa-vx/octa-home-ui`, choose the type **Dashboard** and add it.
3. Open **Octa Home UI** in HACS and download it. HACS adds the resource itself and keeps it current on updates.
4. HACS installs the cards only. For the theme, take `themes/octa-home-ui.yaml` from the ZIP of a [release](https://github.com/octa-vx/octa-home-ui/releases), put it into `config/themes/` and continue with steps 3 and 4 below.

## Install from the ZIP

1. Extract the content of the ZIP archive into the Home Assistant folder `config/`.
2. Under Settings → Dashboards → Resources, add `/local/octa-home-ui/octa-home-ui.js?v=<version>`, type JavaScript module.
3. For the theme, `configuration.yaml` must contain:

   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```

   If the entry is new, restart once. Otherwise the action `frontend.reload_themes` is enough. If the folder `config/www` did not exist before, one restart is required as well.

4. Select the theme: click your own name at the bottom left of the sidebar, then choose `Octa Home UI` under "General" at "Theme". Automatic, light or dark can be set below it.

## Your own dashboards

The cards can be used individually in your own dashboards, either in the visual card editor or in YAML. Start with [EXAMPLES.md](EXAMPLES.md). All cards, variants and options are in the [YAML reference](docs/YAML-REFERENCE.md). In the ZIP, these documents are in `octa-home-ui-docs/`.

## Update

Extract the new version the same way **first**, and only then change `?v=<version>` in the resource. Reload the browser afterwards.

Browsers keep this file for up to 31 days under the same address, so without a new version number the old file stays in use. If a card is reported as missing, close all tabs of Home Assistant and clear the site data of its address.

## Remove

1. Switch the theme in your profile back, delete the dashboards that use these cards, and remove the resource.
2. Delete `www/octa-home-ui/`, `themes/octa-home-ui.yaml`, `octa-home-ui-docs/`, `INSTALL.md` and `INSTALL.en.md` from `config/`, and remove the `frontend:` entry if nothing else needs it.
3. Restart Home Assistant.

Make a backup of `config/` before installing, so you can return to the previous state.
