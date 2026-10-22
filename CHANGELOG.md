# Changelog

All notable changes to this project are documented in this file.

## 0.24.2
- Fixed: after the solar surplus ended a zone kept heating to the raised
  storage temperature (e.g. bedroom 24.5 °C instead of 21 °C). The storage
  target was written into the **day temperature**: during storage the zone card
  showed the raised target and −/+ (and any client sending the target back,
  e.g. HomeKit / voice assistant) saved it via `climate.set_temperature` into
  `number.*_teplota_den`. Now during storage the card's control shows and changes
  the normal day temperature ("day 21°"), and the climate entity ignores a
  request equal to the current storage target.

## 0.24.1
- Fixed: in the solar cascade panel the countdown text and bar were moved to
  the bottom, with a dashed frame and a huge bar. The card has no shadow DOM and
  the dashboard section styles its own `.add` class (the "add card" button);
  the panel now uses prefixed classes (`is-add` / `is-shed`).

## 0.24.0
- **Solar priorities 1–5** (was 1–3); the zone card shows five chips.
- **Solar cascade panel** - tap the "Solar surplus" tile in the overview card:
  state and since when the level is active, flows (production, export, import,
  battery + SOC, surplus vs. the add threshold), what the cascade is doing and
  why in plain words with a countdown bar (next priority joins in / priority is
  removed in, battery discharging, low battery...), priorities 1–5 with every
  zone's state (heating, heating to X°, storing X° of max Y° and time to the next
  step, at max, waiting for higher priorities, blocked by fireplace / floor) and
  today's timeline of the active level. The sensor `fve_kaskada` has new
  attributes `uroven_od`, `urovne`, `nastavenia`; zones `fve_akumulacia_od`.
- **Max. heating power from the solar surplus** (global setting
  `pv_max_heat_power`, default 7000 W, 0 = no limit; editable in the overview
  card settings). The cascade adds another priority only if heating + the add
  threshold stays within the limit ("holding - heating X of max Y"); when heating
  goes over the limit for the shed time, the lowest priority is removed. Heating
  power = sum of all zones' power meters (new attribute `kurenie_w`), shown in
  the cascade panel as "Heating X of max Y".
- **Statistics open on "Today"** every time.
- On a phone the opened panels are shown under the tiles.

## 0.23.0
- **Storing solar surplus as heat.** While a zone heats from the solar surplus,
  its target starts at the day temperature and is raised by a step (default
  1 °C) each time the zone reaches it - at most every N minutes (default 15) -
  up to the zone's **max. temperature from surplus** (new number
  `number.*_fve_max_teplota`, default 24 °C; it also caps a higher day
  temperature). When the surplus ends the target goes back to normal. Per-zone
  switch `switch.*_fve_akumulacia` (on by default); step and interval in the
  global settings (`pv_acc_step`, `pv_acc_minutes`). All of it is editable on
  the cards (zone card -> Toggles, overview card -> integration settings).
- **AC zone (floor_ac) with surplus: AC first, then the floor.** The deficit
  "floor as AC backup" is not used while storing heat. When the fireplace area
  reaches the fireplace threshold, the AC stops and the floor keeps storing heat
  (setpoint = max. floor temperature) as long as the floor is below its maximum.
  The AC setpoint follows the storage target when it goes above the fixed AC
  setpoint.
- floor_ac: an overheated floor now stops only the floor - the AC keeps heating.
- Zone attributes `fve_akumulacia_ciel`, `fve_akumulacia_max`, `fve_krb_podlaha`.

## 0.22.0
- **Statistics: heating split into solar / battery / grid.** "From the grid" was
  total minus the solar-cascade energy, which was wrong - heating outside the
  cascade also runs on solar or battery. New sensors
  `sensor.smart_heating_energia_domu_zo_siete`, `..._z_fve`, `..._z_baterie`
  integrate the house load by source every 30 s (proportional: sources = PV +
  grid import + battery discharge). The statistics panel splits heating in every
  hour by that mix - it also works for sources that only have an energy meter
  (e.g. the AC). Tiles: Consumption | From solar (of which surplus) | From
  battery | From the grid | Per degree-day; solar + battery + grid = consumption.
  Time before the sensors existed is shown as "unsplit".
- **Chart:** stacked solar / battery / grid bars, grid lines with a kWh axis, the
  value above every bar when it fits (Today and 30 days too; on a phone the
  maximum, tap a bar for its value and split). Drawn at the real width - text is
  no longer stretched. Re-drawn when the width changes.
- The per-degree-day comparison is shown only when the previous period is
  comparable (enough degree-days and data), otherwise "not enough data to
  compare" (end of summer vs October gave "167 % worse").
- **Humidity (monitoring only, no control yet).** Optional humidity sensor per
  zone and outdoor humidity / pressure sensors in the global settings. The zone
  gets `humidity`, felt temperature (Steadman, no wind), dew point and an airing
  hint (absolute humidity inside vs outside); the climate entity reports
  `current_humidity`. Zone card: one fixed line "💧 67 % · feels like 25,1° ·
  humid, airing helps · dew point 16,9°". Overview: outdoor humidity and
  pressure with a 3 h trend; statistics: average humidity per room and outside.
  Optional notification (off by default) when humidity stays above 65 % or below
  30 % for an hour.
- **Notifications:** every target is sent separately and awaited with a 15 s
  timeout. A target that is off (e.g. TV: `Host is unreachable`) no longer fills
  the log with tracebacks - one warning per target per hour - and the other
  targets still get the message. Unavailable targets are skipped.

## 0.21.2
- Fixed: the page jumped back up a bit when scrolled to the very bottom. Cards
  changed height on ordinary updates (reason line 1 vs 2 lines, the "Faults"
  row in the overview appearing and disappearing) and when the browser was at
  the end of the page it had to scroll up. The reason line now always reserves
  two lines and the "Faults" row is always shown (0 when everything is fine).
- Fixed: during an integration reload (e.g. after saving settings from the
  overview card) zone cards collapsed into a short "zone not found" message for
  a moment. They now keep their content, dimmed, until the entities are back.
- Fixed: every recompute briefly wrote an estimated state before the real one -
  `hvac_action` / `binary_sensor.*_v_chode` blinked "heating" for idle zones,
  the heat source went empty and faults from meters / slow warm-up disappeared
  and came back (blinking fault line on the card, doubled history rows). The
  last applied values are now kept until the next apply.
- Devices that are unavailable no longer get `set_hvac_mode` /
  `set_temperature` on every recompute (log noise).
- The target sent to a device is rounded to its `target_temp_step` (Daikin
  1 °C) and compared with a tolerance, so it is not resent on every recompute.
- **Floor sensor failsafe.** When a configured floor sensor has no valid value
  (unavailable or outside -10..45 °C, e.g. a disconnected NTC) for 10 minutes,
  floor heating stops: a `floor` zone as a whole, in `floor_ac` and
  `radiator_floor` zones only the floor (AC / radiator keep heating). Before,
  the max. floor temperature protection silently switched off. An overheat
  block is kept during a short outage, solar surplus does not override the
  stop, the emergency frost protection still does. New attribute
  `floor_sensor_lost` and a badge on the zone card.
- Recorder: static configuration attributes of `sensor.*_stav` and the 30 s
  power values of `sensor.smart_heating_fve_kaskada` are no longer stored in
  history (smaller database).

## 0.21.1
- Fixed: the statistics panel under-counted today (e.g. 1.5 kWh vs 3.14 kWh in
  the summary) - hourly/daily long-term statistics only exist for finished
  periods. Finished days now come from long-term statistics and today from the
  5-minute statistics, the same source as "Consumption today".
- Fixed: kWh per degree-day compared a partial day against full days ("91 %
  better"). Degree-days are now weighted by the time each row covers, so only
  the elapsed part of today counts.

## 0.21.0
- **Meters per heat source.** New zone fields for floor, AC and radiator power
  and energy meters (lists, e.g. two floor circuits). The zone card shows the
  power per source ("Floor 0.8 kW · AC 1.2 kW"); the old lists stay as "other".
- **Actual state from the meter.** A source with a power meter counts as
  running above 20 W - more reliable than the device's `hvac_action` or an
  estimate (fixes over-counted "heated today" for the AC). Evaluated every
  30 s; the zone is recomputed only when a meter switches on/off.
- **Meter check.** A source reporting heating while its meter shows 0 W, or
  drawing over 50 W while it should be off (stuck relay), for 10 minutes is a
  fault (zone card, overview, notification). Attribute `meter_problems`.
- **Statistics panel** in the overview card (button "Statistics"): today /
  7 / 30 days - consumption, share from solar surplus and from the grid,
  kWh per heating degree-day (base 18 °C) compared with the previous period,
  consumption by day/hour (solar vs grid), rooms ranked with a per-source
  split and the meter check. Read from HA statistics in one query.
- New `sensor.smart_heating_energia_z_fve` (kWh, total increasing): heating
  energy used while zones heated from the solar surplus, integrated from the
  power meters every 30 s; source of the solar share.

## 0.20.0
- **Energy consumption on the cards.** New optional zone fields: power sensors
  (W) and energy sensors (kWh), each a list that is summed (e.g. floor
  thermostat + AC). The zone card shows current power and today's consumption,
  the overview card the totals for the whole house ("Heating power",
  "Consumption today"). Today's consumption is read from the 5-minute
  statistics (`recorder/statistics_during_period`, type `change`, from local
  midnight, every 5 minutes); power changes redraw only the consumption line,
  not the whole card.
- Faults are shown on their own line on the zone card (the reason line is
  limited to two lines and cut them off).
- Overview settings panel: values no longer wrap, decimal comma in Slovak.
- Power is rounded correctly (1450 W showed as 1.4 kW).
- README and screenshots updated for 0.17–0.20 (dashboard, zone card settings,
  integration settings in the overview card).

## 0.19.0
- **Solar surplus controlled by power** (Global settings → "Control solar
  surplus by power"; replaces the surplus on/off switch and the automation
  behind it). Inputs: PV production, grid and battery power (+ battery SOC),
  with selectable sign conventions. Evaluated every 30 s, not on every sensor
  update.
  - Adding: available surplus = grid export + battery charging (charging only
    counts above `pv_start_soc`, so the battery is charged first) >=
    `pv_add_power` for `pv_add_minutes` -> next priority; the following one
    after the same time again.
  - Removing (hysteresis): battery discharge or grid import over
    `pv_shed_power`, or production below `pv_min_power`, for `pv_shed_minutes`
    -> the lowest active priority is removed; if it continues, the next one
    after the same time. Below `pv_stop_soc` everything stops at once.
  - Defaults: 1000 W / 5 min to add, 200 W / 10 min to remove, 500 W minimum
    production, battery counts from 90 %, stop below 40 %.
- New `sensor.smart_heating_fve_kaskada`: active priority (0 = none) with
  production, export, import, battery, SOC, available surplus and what is about
  to happen (`pridanie_za_min` / `odobratie_za_min`) - usable in other
  automations instead of the old surplus switch.
- Overview card: the solar tile shows active priorities and surplus
  ("P1–2 · 1.8 kW"); all solar parameters can be tuned in the settings panel
  (W / min / % units).

## 0.18.0
- **Solar surplus cascade.** New per-zone select `select.smart_heating_<id>_fve_priorita`
  (1 / 2 / 3, default 1 = previous behaviour). Zones with priority 1 heat from
  the surplus first; the next priority joins once all higher-priority zones are
  at their solar target (within 0.2 °C) for 10 minutes; lower priorities are
  released immediately when a higher-priority zone drops more than 0.5 °C below
  target. Zones that can't use the surplus (floor over max, fireplace, cooling,
  mode Off) don't block the cascade. Attributes `fve_priorita` and `fve_caka`,
  "Solar – waiting for priority rooms" badge, priority chips next to the
  "Use solar surplus" switch.
- Fixed (0.17.0): the zone card didn't re-render when the new floor numbers or
  the min-floor switch changed.

## 0.17.0
- **Floor max with hysteresis.** Heating stops at `floor_max` and resumes only
  below `floor_max - floor_hysterezia` (new number, default 1.5 °C), so the relay
  no longer clicks around a single value. The reason text says when it resumes.
- **Minimum floor temperature.** `floor_min` was exposed but never used. New
  switch `udrzat_min_podlahy`: when on, the floor heats below `floor_min` even if
  the air is warm (until `floor_min + hysteresis`; not in Frost mode or on
  holiday). Off for existing zones, on for new zones (harmless at the default
  5 °C) and for the new radiator zone type.
- **New zone type "Radiator (air) + floor (independent)"** (`radiator_floor`):
  a radiator relay (switch / input_boolean / light) holds the AIR temperature
  (on at target - `radiator_hysterezia`, off at target), the floor
  independently holds the FLOOR temperature via `floor_min`. An overheated floor
  blocks only the floor. Requires the relay and an external (air) thermometer.
- **Diagnostics.** Device or sensor unavailable for over 15 min, implausible
  room/floor values, or a zone heating for 3 h while still more than 1 °C below
  target are reported as faults: `problemy` attribute, badge on the zone card,
  "Faults" row in the overview and notifications (new toggle
  `notify_diagnostics`, start and resolve).
- **Warm-up logging** (groundwork for adaptive pre-heating): every warm-up
  from heating start to reaching target is stored (last 30 per zone, persisted);
  `nabeh_min_na_stupen` (median minutes per °C) and `nabehy_pocet` attributes.
- **Integration settings in the overview card**: holiday, emergency
  temperature, fireplace threshold and all notification toggles, saved through
  the integration's own options flow (admin only); link to all settings.
- Cards use vector MDI icons everywhere (no emoji), new Floor section in zone
  settings.
- Fixed: changes of the external thermometer and of the fixed AC setpoint
  switch were not tracked, so they took effect only on the 5-minute tick.

## 0.16.3
- Fixed: the overview's "Solar surplus" tile said "In use" whenever some zone
  had its target raised because of the surplus (`pv_active`), even if that
  zone was already at its target and not heating. It now says "In use" only
  when such a zone is actually heating; available-but-unused surplus shows
  "Yes" (and the tile is no longer highlighted).
- Fixed: a zone was reported as heating whenever heating was allowed if its
  thermostat doesn't report its own `hvac_action` - e.g. a floor thermostat
  already at its setpoint showed "Heating". The state is now estimated from
  the device's own current temperature vs. its setpoint (a reported
  `hvac_action` still wins). This also corrects "Heating in N rooms" and the
  `v_chode` binary sensor.

## 0.16.2
- New per-zone `binary_sensor.smart_heating_<id>_v_chode` (device_class
  running): on while the zone is actually heating or cooling. Its history has
  no attributes, so the overview card's "heating today" is now a tiny query
  instead of the climate history with all attributes (that query could time
  out and leave "–"). Older installs fall back to the climate history.
- Overview: a failed history request is retried after 2 minutes instead of 10.
- Overview tiles:
  - **Tariff** follows the configured tariff entity: green "Active" while it
    allows heating, amber "Blocks heating" otherwise.
  - **Solar surplus** follows the configured surplus entity (green when there
    is a surplus, "In use" when a zone heats from it).
  - **Guests** and custom `input_boolean` / `switch` / `light` / `fan` tiles
    toggle on tap instead of opening the more-info dialog. Override per tile
    with `tap_action: more-info | toggle | none`.
- `sensor..._stav` exposes `tariff_entity` and `pv_surplus_entity`.

## 0.16.1
- Overview card works without any configuration: the outside temperature
  sensor and the presence entities are taken from the integration (new
  attributes `outdoor_entity`, `presence_entities`,
  `manual_presence_entities` on `sensor.smart_heating_<id>_stav`), so the
  3 h trend, today's range and the new **Home** and **Guests** tiles show up
  automatically. Default tiles: heating, presence, guests, pv, tariff, krb.
- Zone chart: while the statistics cover less than a day (e.g. right after
  installing), the chart stretches over the available period and the label
  shows its real length (e.g. "9 h") instead of a mostly empty 24 h axis.
- Smoother chart line (30-minute buckets, light moving average) - sensors
  with a 0.5 °C step no longer draw a saw-tooth.

## 0.16.0
- **Zone card redesign.** Coloured accent bar and status pill (Heating /
  Not heating / Cooling / Off), big current temperature with a 24 h chart
  (target as a dashed line, min · avg · max for 24 h, from the 5-minute
  statistics of `sensor.smart_heating_<id>_teplota`), deviation chip
  (on target within ±0.5 °C / above / below) and floor temperature.
- Target temperature − / + directly on the card; repeated clicks are merged
  into one `climate.set_temperature` call.
- Mode bar Auto / Day / Night / Min on the card (Frost and Off shown only
  while active), gear button for the settings, reason line with badges.
- Removed the version label and the per-zone outdoor temperature from the
  card; min/max now cover 24 h instead of 48 h.
- **New overview card** `custom:smart-heating-overview`: outside temperature
  with 3 h trend and today's range, condition tiles (built-in heating / pv /
  tariff / krb / emergency / boost plus any custom entities), summary of rooms
  on target / above / below and heating time today.
- Card tests rewritten for the new layout, plus overview tests.

## 0.15.0
- Removed the 24 h chart from the card: every card downloaded the full 24 h
  history of its climate entity including all attributes, which was very slow
  with several cards on one dashboard.
- Instead the card shows average over 24 h and min/max over 48 h, read from
  Home Assistant's 5-minute statistics (`recorder/statistics_during_period`,
  a few hundred tiny rows, refreshed every 15 min).
- New per-zone sensor `sensor.smart_heating_<id>_teplota` (device_class
  temperature, state_class measurement) - the temperature the integration
  decides on; HA computes the statistics from it automatically.
- Card layout: larger centred zone name, more prominent target temperature,
  status and badges without pill backgrounds, equal card heights (cards
  stretch to the grid row and reserve space for the reason and badges).

## 0.14.0
- **Card redesign.** Everything except the zone overview now lives behind a
  single Settings button as collapsible sections (mode, season,
  temperatures, cooling, schedule, switches, Boost). Collapsed mode, season
  and Boost show their current value. Section content is only rendered while
  Settings is open - lighter on phones.
- New zone state next to the target temperature: Heating / Not heating /
  Cooling / Off.
- New 24 h room temperature chart; the line and the big current temperature
  share one colour scale (blue <= 18 °C, amber ~21.5 °C, red >= 25 °C,
  interpolated through hue so the middle never turns grey).
- `climate.hvac_action` now reports what is **actually** running
  (`actual_action` from the coordinator): the device's own `hvac_action`
  wins when it reports one, otherwise it's derived from what the integration
  switched on. Previously it said "heating" whenever heating was merely
  allowed, e.g. also while the AC was waiting on hysteresis.

## 0.13.3
- CI fix: `tests/test_frontend_registration.py` still tested the 0.12.0
  behaviour (card injected via `add_extra_js_url`). Since 0.13.x the card is
  added as a regular Lovelace resource after HA start, with `add_extra_js_url`
  only as a YAML-mode fallback. Tests now cover: resource created, no
  duplicates, old `?v=` updated in place, YAML fallback.
- Added `CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)`
  (hassfest warning for integrations with `async_setup`).
- CI: `actions/setup-python@v6` (Node 24; v5 triggered the Node 20
  deprecation warning).
- `package.json` and the version label on the card aligned with the
  integration version.

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
