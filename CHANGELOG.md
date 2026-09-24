# Changelog

All notable changes to this project are documented in this file.

## 0.12.0
- **The Lovelace card no longer needs to be manually copied or registered.**
  It now lives inside `custom_components/smart_heating/www/` and
  self-registers as a static file + auto-injected dashboard resource at
  integration startup (`async_setup` in `__init__.py`, using
  `hass.http.async_register_static_paths` + `add_extra_js_url`). Since it's
  now inside `custom_components/`, HACS deploys it automatically along with
  the rest of the code - a HA restart after an update is the only step
  needed, ever again.
- Added `http` and `frontend` as manifest dependencies (required for the
  above); added `home-assistant-frontend` to `requirements-test.txt`.
- New tests (`test_frontend_registration.py`) verifying the static path
  registration and dashboard auto-injection against a real HA test instance.

## 0.11.3
- Added `custom_components/smart_heating/brand/` icon assets to the
  repository (previously only delivered out-of-band, never actually
  committed)
- README: added a (now superseded by 0.12.0) warning about the card needing
  manual deployment

## 0.11.2
- New structural field "Use fixed AC setpoint even without external
  thermometer" in the zone edit form, mirroring the existing runtime switch

## 0.11.1
- Fixed a missing card toggle row for the 0.11.0 switch (backend entity
  existed, but the card never rendered it)

## 0.11.0
- New per-zone switch "Use fixed AC setpoint even without external
  thermometer" - lets the integration take over AC on/off control (via
  hysteresis against the floor thermostat's own sensor) without requiring a
  separate external thermometer entity
- Integration version now shown in Global settings and at the bottom of the
  card, to make version mismatches easy to spot

## 0.10.3
- Fixed a real bug: `heat_source` ("Zdroj: ...") was computed *after*
  entities were already notified of new data, so it never actually reached
  Home Assistant's state machine until an unrelated later update. Also now
  set for plain `floor` zones and the cooling season (previously only set
  for `floor_ac` heating).

## 0.10.2
- Fixed the "clear" bug on optional `EntitySelector` fields in the zone edit
  form (voluptuous silently re-applied the old default when the frontend
  omitted a cleared field) via dedicated "Clear ..." checkboxes for the
  floor and external temperature sensor fields

## 0.10.1
- Restored `custom_components/smart_heating/brand/` icon assets after they
  were accidentally lost during a folder overwrite

## 0.8.1
- Fixed `codeowners` in `manifest.json` (invalid GitHub username format)
- Raised `hacs.json` minimum Home Assistant version to `2024.12.0` (matches an
  actual code dependency: `OptionsFlow.config_entry` as a read-only property)
- Added GitHub Actions CI: `validate.yml` (HACS, hassfest, pytest, node tests),
  `release.yml` (release/manifest version consistency check)

## 0.8.0
- Full i18n for backend-generated text: decision reasons, heat source labels,
  and all notifications (new `i18n.py` module, new `language` hub setting)

## 0.7.3
- Fixed `strings.json`/`translations` to follow the proper Home Assistant
  convention (`strings.json` = English canonical source, `translations/sk.json`
  = real Slovak translation); added several config-flow labels that were
  missing since 0.7.0

## 0.7.2
- "Pre-heating ended" notification now only fires when it actually changes
  something (nobody home) - not when presence quietly takes over as the reason

## 0.7.1
- Fixed missing imports for the new `CONF_NOTIFY_*` constants introduced in 0.7.0

## 0.7.0
- Rebuilt the notification system: global aggregation (tariff/fireplace/
  emergency/holiday), per-zone start/stop pairs, full diacritics, 10 separate
  toggles in Global settings
- Notification targets field now supports selecting multiple entities

## 0.6.5
- Startup notification suppression widened from a single check to a 3-minute
  grace window (handles entities that load in late after a restart)

## 0.6.3
- Granular per-category notification toggles in Global settings
- Fixed spurious notifications firing right after a Home Assistant restart

## 0.6.2
- Cooling also supports the external zone thermometer + hysteresis (same
  principle as heating)

## 0.6.1
- External zone thermometer; fixed AC setpoint + hysteresis for heating

## 0.6.0
- Season selector (Heating/Cooling/Auto) for `floor_ac` zones; simple
  battery-driven cooling logic
- Off mode now sends `off` once on transition, then leaves the device alone

## 0.5.0 - 0.5.1
- All hub values moved into config flow (no longer separate entities)
- Outdoor temperature threshold gained a real function (forces heating in cold)
- Visual zone editor in the Lovelace card

## 0.4.0
- Removed the weekly schedule grid; day/night start times split into
  weekday/weekend variants

## 0.3.0 - 0.3.3
- Weekly schedule grid + Store (later removed in 0.4.0), debounced recompute

## 0.2.0 - 0.2.2
- Redesign: Day/Night/Min temperatures, presence, emergency protection,
  `floor_ac` zones, fireplace guard, Boost, notifications, pre-heating

## 0.1.0 - 0.1.3
- Initial MVP: hub + floor zones
