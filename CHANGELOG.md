# Changelog

All notable changes to this project are documented in this file.

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
