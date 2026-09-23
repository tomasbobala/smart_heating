<p align="center">
  <a href="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/custom_components/smart_heating/brand/icon.png">
    <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/custom_components/smart_heating/brand/icon.png" width="120" alt="Smart Heating logo">
  </a>
</p>

# Smart Heating

**Multi-zone heating & cooling for Home Assistant**

Floor heating · AC heating & cooling · fireplace · solar surplus & battery · tariff aware

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/tomasbobala/smart_heating?style=for-the-badge&color=C2410C)](https://github.com/tomasbobala/smart_heating/releases)
[![License: MIT](https://img.shields.io/github/license/tomasbobala/smart_heating?style=for-the-badge&color=4caf7d)](LICENSE)
[![Validate](https://img.shields.io/github/actions/workflow/status/tomasbobala/smart_heating/validate.yml?style=for-the-badge&label=validate)](https://github.com/tomasbobala/smart_heating/actions/workflows/validate.yml)

**English** · [Slovensky](README.sk.md)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=tomasbobala&repository=smart_heating&category=integration)

A general-purpose Home Assistant integration for multi-zone **heating and cooling**
- electric floor heating, air conditioning as a primary heat/cool source, a
fireplace, solar (surplus and battery) and electricity tariffs, all in one
system with its own decision logic and a Lovelace card.

Built for a real house with multiple independent zones (rooms), where each
zone has its own rules but shares common global settings.

<p align="center">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/card-collapsed.png" width="45%" alt="Smart Heating card - collapsed view">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/card-expanded.png" width="45%" alt="Smart Heating card - Temperatures section expanded">
  <br>
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/global-settings.png" width="45%" alt="Global settings form">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/edit-zone.png" width="45%" alt="Edit zone form">
</p>

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Decision logic - Heating](#decision-logic---heating)
- [Decision logic - Cooling](#decision-logic---cooling)
- [External thermometer and precise AC control](#external-thermometer-and-precise-ac-control)
- [Notifications](#notifications)
- [Language (i18n)](#language-i18n)
- [Tests and CI](#tests-and-ci)
- [Off mode - how it works](#off-mode---how-it-works)
- [Installation](#installation)
- [Setup](#setup)
- [Entities created by the integration](#entities-created-by-the-integration)
- [Lovelace card](#lovelace-card)
- [Usage examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

---

## Features

|   |   |
|---|---|
| 🏠 **Multi-zone** | Each room has its own mode, temperatures and schedule, sharing common global settings. |
| 🔥 **Floor heating** | Electric floor heating with a floor-temperature safety limit. |
| ❄️ **AC heating & cooling** | Air conditioning as the primary heat source, plus a deliberately simpler cooling logic driven by solar battery charge. |
| 🪵 **Fireplace aware** | Turns off heating in a room once it's warm enough near the fireplace. |
| 💶 **Tariff aware** | A global block on heating during high-tariff periods. |
| ☀️ **Solar surplus** | Uses PV surplus for heating and battery charge for cooling. |
| 🥶 **Frost protection** | Emergency protection prevents actual freezing, even during a tariff block. |
| 🧊 **Forced heating in cold** | A per-zone configurable outdoor threshold triggers comfort heating in Auto mode. |
| ⏰ **Pre-heating** | A fixed time window before arrival, independent of actual presence. |
| 🌡️ **External thermometer** | More accurate control when the AC's/floor's built-in sensor is off. |
| 🚀 **Boost** | Instant, temporary comfort heating on demand. |
| 🎛️ **Custom Lovelace card** | One card per zone, full control without YAML. |
| 🌍 **English & Slovak** | Both the card and the backend-generated text (reasons, notifications) support both languages. |

---

## Architecture

### Hub (one per Home Assistant instance)

All global settings are managed via **Configure -> Global settings**
(not as separate entities - everything lives in one place):

| Setting | Description |
|---|---|
| Outdoor temperature sensor | also used for forced heating in cold and the Auto season |
| Tariff / heating-allowed entity | `on` = heating allowed (the highest-priority block) |
| Fireplace - temperature sensor | temperature near the fireplace |
| Fireplace - threshold temperature (C) | above which heating turns off in zones reacting to the fireplace |
| Solar surplus entity | `on` = solar is producing a surplus and the battery is charged (for heating) |
| Solar battery - state of charge (%) | numeric SOC sensor, used for simple cooling |
| Emergency frost protection (C) | overrides even the tariff block |
| Holiday / Away | forces Min in all zones (Auto mode) |
| Notification targets | can select multiple; where alerts are sent |
| Language | `auto \| en \| sk` - language for backend-generated reasons/notifications |

### Zone (as many as you have rooms)

Added via **Options Flow** (Settings -> Devices & Services -> Smart Heating
-> Configure -> Add zone):

- **Zone type:**
  - `floor` - floor heating only
  - `floor_ac` - air conditioning (heating and cooling) as the primary source,
    floor as backup top-up (heating only - it can't cool)
- Floor `climate` thermostat (required)
- AC `climate` entity (only for `floor_ac`)
- Floor temperature sensor (optional, for the safety limit)
- **External zone thermometer** (optional) - replaces the built-in sensor in all calculations
- People tracked via GPS (`person.x`)
- Manual presence override (e.g. `input_boolean.guest` for a visitor)
- React to fireplace (yes/no)

---

## Decision logic - Heating

For a zone in the **Heating** season (see below for how the season is
determined), the target is resolved in this order (higher items override lower ones):

```
0. EMERGENCY PROTECTION
   current_temp < emergency threshold (default 8C)
   -> briefly turns on heating, OVERRIDES THE TARIFF (not floor/fireplace safety)

0.5 SOLAR SURPLUS
   Solar entity = on AND zone has "Use solar surplus" enabled
   -> target = Day/Night comfort, OVERRIDES THE TARIFF (not floor/fireplace)

1. TARIFF
   "heating allowed" entity != on -> TURN EVERYTHING OFF (floor and AC)

2. FLOOR SAFETY
   Floor temperature >= max (per zone) -> TURN OFF, no exceptions

3. FIREPLACE
   Zone has "React to fireplace" enabled AND fireplace temperature >= threshold -> TURN OFF

4. MANUAL MODE (if zone isn't in Auto)
   Day / Night / Min / Frost / Off - direct temperature, no further evaluation

5. AUTO
   a. Determine the Day/Night comfort temperature for the current time
      (separate thresholds for weekdays and weekends)
   b. Is anyone actually home? (GPS or manual override) -> Comfort
   c. Is the pre-heating window active? (Mon-Fri only, fixed time) -> Comfort
   d. Outdoor temperature <= per-zone threshold? -> Comfort (forced heating in cold)
   e. Otherwise -> Min (maintenance baseline only)
```

**Boost** (button, temporary for X hours) is evaluated before step 4 - it
overrides manual mode and Auto, but **respects** the tariff, floor safety and
fireplace safety. It doesn't depend on actual presence.

### `floor_ac` zone in Heating - AC -> floor priority

1. The AC is set to the computed target first (primary source) - see also
   [External thermometer](#external-thermometer-and-precise-ac-control) below
   if the AC has an inaccurate built-in sensor
2. If the current temperature lags the target by more than a configured
   difference (C) for longer than a configured time (minutes), the floor also
   turns on as a top-up
3. Once the AC catches up to the target, the floor turns off

---

## Decision logic - Cooling

Applies only to `floor_ac` zones. The floor never engages during cooling.

### How the season (Heating vs Cooling) is determined

Each `floor_ac` zone has its own **Season** selector: `Heating` / `Cooling` / `Auto`.

- **Heating** / **Cooling** - manually forced, ignores outdoor temperature
- **Auto** - outdoor temperature >= per-zone threshold -> **Cooling**, otherwise **Heating**

### Logic in Cooling season (deliberately simpler than heating)

No presence, no Day/Night, no pre-heating - just:

```
1. Manual mode = Off? -> AC off, done

2. Solar battery (%) >= configured threshold?
   -> NO -> AC off
   -> YES -> continue

3. Does the zone have an external thermometer?
   -> NO -> cools (relies on the AC's own sensor, as before)
   -> YES -> hysteresis based on the external thermometer:
       thermometer <= target - hysteresis -> turn cooling off
       thermometer >= target + hysteresis -> turn cooling on
       (in between) -> keep the previous state (anti-cycling)
```

The `Cooling target temperature` serves both as the hysteresis reference and
as the physical value actually sent to the AC.

---

## External thermometer and precise AC control

A common problem: the AC's built-in sensor can be inaccurate or not reflect
the real room temperature (e.g. it's near a window, or the room has another
heat source like a fireplace). Solution:

1. Assign an **External zone thermometer** in the zone settings (e.g. a
   thermometer near the fireplace)
2. This value **replaces** the built-in sensor in **all** calculations for
   that zone (displayed current temperature, emergency protection, AC<->floor
   priority, hysteresis for both heating and cooling)
3. For heating specifically: the AC is commanded to heat at a **fixed
   physical setpoint** (`AC physical setpoint`, e.g. 26C) instead of the
   computed comfort target - because its own sensor and control loop are
   inaccurate. **Whether** the AC runs at all is decided by `AC hysteresis`
   against the external thermometer, not by the AC itself.

If a zone has **no** external thermometer configured, everything works exactly
as before (the AC is controlled by its own sensor and control loop).

---

## Notifications

10 separate categories, each with its own toggle in **Global settings**
(all enabled by default):

| Category | Scope | Example |
|---|---|---|
| Tariff | once, house-wide | `Global: heating blocked by high tariff.` |
| Floor | per zone | `{zone}: heating off - floor reached max temperature {temp}.` |
| Fireplace | once, with the list of zones | `Fireplace: heating turned off in zones: {list}.` |
| Emergency protection | once, with the list of zones | `Emergency protection activated in zones: {list}!` |
| Boost | per zone | `Boost activated in zone {zone} for {hours} h.` |
| Cooling | per zone | `{zone}: cooling started (battery {%}, target {C}).` |
| Holiday | once, house-wide | `Holiday mode activated - all zones to Min.` |
| Pre-heating | per zone | `{zone}: pre-heating started before arrival.` |
| AC/floor backup | per zone, `floor_ac` only | `{zone}: AC can't keep up, floor engaged as backup.` |
| Outdoor threshold (cold) | per zone | `{zone}: low outdoor temperature forced heating.` |

Most categories also send a "back to normal" message (e.g. "heating
restored"). There's a 3-minute grace window after HA starts during which no
notifications are sent (the baseline state is just quietly recorded) - this
prevents false alerts for a condition that already existed before the
restart. **Notification targets** supports selecting **multiple** targets at
once (e.g. both partners' phones).

---

## Language (i18n)

Both the integration and the card support English and Slovak:

- **Card**: `language: auto | en | sk` in the card config (`auto` follows HA's language)
- **Backend** (decision reasons, heat source, notifications): a **Language**
  field in the integration's Global settings (`auto | en | sk`)

They're independent - you can have the card in English and notifications in
Slovak, if you want.

---

## Tests and CI

The project has a real test suite (not just manual verification):

- **Python** (`pytest` + `pytest-homeassistant-custom-component`) - decision
  logic, i18n, notifications, config/options flow (including regression tests
  for specific bugs found during development)
- **JavaScript** (`node:test` + `jsdom`) - the card, i18n, render-skipping optimization

```bash
# Python
pip install -r requirements-test.txt
pytest

# JS
npm install
npm test
```

GitHub Actions (`.github/workflows/validate.yml`) runs both on every
push/PR, alongside the official HACS and `hassfest` validation.

---

## Off mode - how it works

On **transition** into Off mode (a change from another mode), `off` is sent
**once**. While the zone **stays** in Off, the coordinator no longer touches
the device at all - you're free to control it entirely yourself (e.g. switch
the AC to cooling outside of Smart Heating) until you switch to another mode
again. This applies equally to heating and cooling.

---

## Installation

### Via HACS (recommended)

1. HACS -> the three-dot menu, top right -> **Custom repositories**
2. URL: `https://github.com/tomasbobala/smart_heating`
3. Category: **Integration**
4. Search for "Smart Heating" in HACS and install it
5. Restart Home Assistant

### Manually

1. Copy `custom_components/smart_heating` into `config/custom_components/smart_heating`
2. Restart Home Assistant

---

## Setup

### 1. Add the integration (hub)

**Settings -> Devices & Services -> Add Integration -> Smart Heating**

Every field is optional - you can fill them in later via "Configure -> Global settings".

### 2. Add a zone

On the integration's tile, click **Configure** -> **Add zone**:

- Enter a name, pick the zone type and the floor/AC `climate` entity
- Optionally assign an external thermometer and a floor temperature sensor
- Assign people to track for presence
- Save

Adding a zone creates ~19-26 entities (depending on zone type) with sensible
defaults, which you fine-tune via the entities or directly through the
Lovelace card.

### 3. Add the card to your dashboard

Add the JS resource (**Settings -> Dashboards -> Resources**):

```
URL: /local/smart-heating-card.js   (copy www/smart-heating-card.js there)
Type: JavaScript Module
```

Then add the card to your dashboard via the UI (Edit dashboard -> Add card ->
Smart Heating) - a visual zone picker opens, no need to type `zone_id` by
hand. Or directly in YAML:

```yaml
type: custom:smart-heating-card
zone_id: "xxxxxxxx"
name: "Living room"     # optional, otherwise uses the climate entity's name
language: auto           # optional: auto | en | sk
```

---

## Entities created by the integration

The hub has **no** entities of its own - everything global lives in Global
settings (Options Flow).

### Per zone (`<id>` = the zone's internal ID)

| Entity | Description |
|---|---|
| `climate.smart_heating_<id>` | the main virtual thermostat - the primary control point (supports Cool for `floor_ac`) |
| `select.smart_heating_<id>_rezim` | Auto / Day / Night / Min / Frost / Off |
| `select.smart_heating_<id>_sezona` | **`floor_ac` only**: Heating / Cooling / Auto |
| `number..._teplota_den` / `_teplota_noc` / `_teplota_min` / `_teplota_mraz` | heating temperatures |
| `number..._floor_min` / `_floor_max` | floor temperature safety limits |
| `number..._vonkajsia_hranica` | threshold for forced heating in cold |
| `number..._boost_hodiny` | Boost duration |
| `number..._ac_priorita_rozdiel` / `_ac_priorita_minuty` | **`floor_ac` only**: when the floor kicks in as backup |
| `number..._ac_setpoint_teplota` | **`floor_ac` only**: the AC's physical setpoint when heating (with ext. thermometer) |
| `number..._ac_hysterezia` | **`floor_ac` only**: hysteresis for turning the AC on/off (heating and cooling) |
| `number..._teplota_chladenie` | **`floor_ac` only**: cooling target/setpoint |
| `number..._bateria_hranica_chladenie` | **`floor_ac` only**: min. battery SOC % for cooling |
| `number..._vonkajsia_hranica_chladenie` | **`floor_ac` only**: threshold for the Auto season |
| `time..._den_od_tyzden` / `_vikend`, `_noc_od_tyzden` / `_vikend` | Day/Night time thresholds |
| `time..._predkurenie_od` / `_do` | pre-heating window (Mon-Fri only) |
| `switch..._predkurenie_povolene` | enable/disable pre-heating |
| `switch..._reaguj_na_krb` | enable/disable reacting to the fireplace |
| `switch..._vyuzi_fve_prebytok` | enable/disable using solar surplus (heating) |
| `button..._boost` | trigger Boost immediately |
| `sensor..._stav` | the diagnostic reason for the current decision + attributes (`heating_allowed`, `season`, `release_control`, `zdroj_kurenia`, `tariff_blocked`, `floor_override`, `krb_override`, `emergency_active`, `pv_active`, `boost_active`, `outdoor_temperature`, `cold_outdoor_active`) |

---

## Lovelace card

`www/smart-heating-card.js` - a plain JavaScript web component, no build
step. One card = one zone. Includes:

- Current/target temperature, floor and outdoor temperature, the decision
  reason, colored badges
- Mode switching (chips) and **season** switching (AC zones only)
- Steppers for every temperature, including cooling- and AC-specific ones
- Time fields (weekday / weekend / pre-heating)
- Toggles (pre-heating, fireplace, solar)
- Boost (duration + button)
- Collapsible sections (temperatures, cooling, schedule, switches) - mode,
  season and Boost stay expanded; a two-column layout kicks in on wider cards
- **Visual editor** when adding the card (zone dropdown instead of typing
  `zone_id` by hand, plus a language picker)

The card only re-renders when something from its own zone actually changes
(not on every state change in the whole of Home Assistant) - important for
performance with many cards on one dashboard.

---

## Usage examples

### "I want heating to start before we get home"

Set `pre-heating from` (e.g. 15:00) and `pre-heating to` (e.g. 18:00, as a
fallback in case nobody arrives) - only active on weekdays.

### "We go to bed later and wake up later on weekends"

Set `night starts (weekend)` and `day starts (weekend)` differently from the
weekday values.

### "I don't want to send solar surplus to the grid in winter"

Assign a "solar surplus" entity in the hub (your own template `binary_sensor`
combining "solar is producing" + "battery above X%"). Zones with "Use solar
surplus" enabled heat to comfort even without presence.

### "In summer I want cooling only when the solar battery is charged"

Set the battery threshold for cooling (e.g. 50%), assign the battery SOC
sensor in Global settings, and set the zone's Season to `Auto` or `Cooling`.

### "The AC's built-in sensor is inaccurate, heating/cooling triggers wrong"

Assign an **External thermometer** to the zone (a real thermometer in the
room). The system uses it instead of the AC's sensor from then on, including
for the on/off hysteresis logic.

### "I'm heading home, I want it warm even during a high tariff"

Press **Boost** - forces comfort for a configured number of hours. Still
respects the tariff (waits for it to drop) and floor/fireplace safety.

### "I want to control the AC directly for a while, outside Smart Heating"

Switch the zone to **Off** - after the one-time `off`, the integration stops
touching the device until you switch to another mode again.

---

## Troubleshooting

**A Python file change didn't take effect** -> you need a **full restart** of
Home Assistant, not just an integration reload (especially true when adding
or changing a platform).

**A card (JS) change didn't take effect** -> almost always **browser cache**.
In Safari: Shift-click the reload button, or bump the resource URL to `?v=N`
(increase the number on every change) in Settings -> Dashboards -> Resources.

**Options Flow throws a 500 Internal Server Error** -> since HA 2024.12,
`config_entry` in `OptionsFlow` must not be set manually in `__init__` (this
is already fixed in this integration; only relevant if you fork the code).

**No custom entities appeared after adding a zone** -> check **Settings ->
System -> Logs**, filter for `smart_heating` - common causes: a wrong
`EntityCategory` (must be an enum, not a string), or a wrong constant import
from `homeassistant.components.climate`.

**The AC keeps running long after reaching its target (heating or cooling)** ->
assign an external thermometer to the zone and check the `AC hysteresis`
value - too high a value causes a large dead-band.

**The AC "turns itself off" when I control it directly** -> check the zone's
mode. In **Off**, the system is supposed to leave the device alone after the
first `off` - if that's not happening, check your version (you need at least 0.6.0).

---

## Known limitations

- Boost, AC<->floor deficit tracking, hysteresis and notification flags are
  in-memory (RAM) only - they reset on a Home Assistant restart (by design,
  they're short-lived state)
- Floor temperature safety limits require a dedicated floor temperature
  sensor assigned to the zone - without one, that protection isn't evaluated
- Cooling is deliberately simplified (battery +/- external thermometer only) -
  no presence, Day/Night or pre-heating like heating has
- The card has no visual editor for a zone's structural fields (zone type,
  entities) - those are set via the integration's Options Flow, not the card

---

## License

This project is licensed under the [MIT License](LICENSE) - you're free to
use, modify and distribute it, including commercially, as long as you keep
the original copyright notice.

[MIT](https://github.com/tomasbobala/smart_heating/blob/main/LICENSE) © 2026 Tomáš Bobala
