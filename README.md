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
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/dashboard.png" width="100%" alt="Smart Heating - overview card and zone cards">
  <br>
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/statistics.png" width="100%" alt="Statistics panel in the overview card">
  <br>
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/overview-settings.png" width="100%" alt="Integration settings right in the overview card">
  <br>
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/card-settings.png" width="32%" alt="Smart Heating zone card - settings open">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/global-settings.png" width="32%" alt="Global settings form">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/edit-zone.png" width="32%" alt="Edit zone form">
</p>

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Decision logic - Heating](#decision-logic---heating)
- [Decision logic - Cooling](#decision-logic---cooling)
- [External thermometer and precise AC control](#external-thermometer-and-precise-ac-control)
- [Solar surplus cascade](#solar-surplus-cascade)
- [Energy consumption](#energy-consumption)
- [Diagnostics](#diagnostics)
- [Notifications](#notifications)
- [Language (i18n)](#language-i18n)
- [Tests and CI](#tests-and-ci)
- [Off mode - how it works](#off-mode---how-it-works)
- [Installation](#installation)
- [Setup](#setup)
- [Entities created by the integration](#entities-created-by-the-integration)
- [Lovelace cards](#lovelace-cards)
- [Usage examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

---

## Features

|   |   |
|---|---|
| 🏠 **Multi-zone** | Each room has its own mode, temperatures and schedule, sharing common global settings. |
| 🔥 **Floor heating** | Electric floor heating with a max floor temperature (with hysteresis, so the relay doesn't chatter) and an optional minimum floor temperature that keeps the floor warm even when the air is. |
| ♨️ **Radiator + floor zone** | Two independent controls in one room (e.g. a bathroom): an electric radiator on a relay holds the air, the floor holds its own minimum. |
| ❄️ **AC heating & cooling** | Air conditioning as the primary heat source, plus a deliberately simpler cooling logic driven by solar battery charge. |
| 🪵 **Fireplace aware** | Turns off heating in a room once it's warm enough near the fireplace. |
| 💶 **Tariff aware** | A global block on heating during high-tariff periods. |
| ☀️ **Solar surplus cascade** | Rooms heat from the surplus by priority (1 → 2 → 3). Controlled by real power: a priority is added while there's surplus and removed, lowest first, when the battery discharges or the grid is used - with adjustable thresholds and delays. |
| ⚡ **Energy consumption** | Meters per heat source (floor, AC, radiator): current power and today's consumption per room and for the house, a meter check, and a statistics panel (solar vs grid, kWh per degree-day, room ranking). |
| 🩺 **Diagnostics** | Notifies about unavailable devices, implausible readings and rooms that can't reach their target. |
| 🥶 **Frost protection** | Emergency protection prevents actual freezing, even during a tariff block. |
| 🧊 **Forced heating in cold** | A per-zone configurable outdoor threshold triggers comfort heating in Auto mode. |
| ⏰ **Pre-heating** | A fixed time window before arrival, independent of actual presence. |
| 🌡️ **External thermometer** | More accurate control when the AC's/floor's built-in sensor is off. |
| 🚀 **Boost** | Instant, temporary comfort heating on demand. |
| 🎛️ **Custom Lovelace cards** | One card per zone with a 24 h chart and full control without YAML, plus a whole-house overview card where the integration settings can be changed directly. |
| 📈 **Warm-up logging** | Every warm-up is recorded (minutes per °C) - groundwork for adaptive pre-heating. |
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
  - `radiator_floor` - two independent controls (e.g. a bathroom): an electric
    radiator on a relay holds the **air** temperature, the floor independently
    holds the **minimum floor temperature**. Needs the radiator relay and an
    external thermometer
- Floor `climate` thermostat (required)
- AC `climate` entity (only for `floor_ac`)
- Radiator relay - switch / input_boolean / light (only for `radiator_floor`)
- Floor temperature sensor (optional, for the max/min floor temperature)
- **External zone thermometer** (optional) - replaces the built-in sensor in all calculations
- People tracked via GPS (`person.x`)
- Manual presence override (e.g. `input_boolean.guest` for a visitor)
- React to fireplace (yes/no)
- Keep minimum floor temperature (yes/no)
- **Power sensors** and **energy sensors** (optional, several are summed) - for the consumption shown on the cards

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

## Solar surplus cascade

Every zone with *Use solar surplus* on has a **solar priority** (1 / 2 / 3).
Priority 1 rooms heat from the surplus first, the others only when there is
still surplus left.

**Controlled by power** (Global settings → *Control solar surplus by power*,
recommended). Inputs: PV production, grid power, battery power and battery
SOC, with selectable sign conventions. Evaluated every 30 s.

- **Adding:** available surplus = grid export + battery charging (charging only
  counts above *battery charge is surplus from SOC*, so the battery is charged
  first). When it stays above *add at surplus* for *lasting*, the next priority
  joins - then the next one after the same time again.
- **Removing (hysteresis):** battery discharge or grid import above *remove at*,
  or production below *insufficient production*, for *lasting* → the lowest
  active priority is removed; if it continues, the next one after the same time.
  Below *switch everything off below battery SOC* everything stops at once.
- Between the two thresholds nothing changes, so a passing cloud doesn't switch
  rooms on and off.

`sensor.smart_heating_fve_kaskada` shows the active priority (0 = none) and the
measured powers, so other automations can use it. All values can be tuned in
the Global settings and in the overview card.

**Without power sensors** a plain on/off surplus entity can be used; the
cascade then adds lower priorities once all higher-priority rooms have been at
their target for 10 minutes and releases them as soon as a higher one cools
down.

## Energy consumption

Each zone can have **power** (W) and **energy** (kWh) meters **per heat
source**: floor, AC and radiator (each a list, e.g. two floor circuits), plus
"other" sensors. The zone card then shows the power per source.

- A source with a power meter counts as **running above 20 W** - this drives the
  zone's state, `v_chode` and "heated today" more reliably than `hvac_action`.
- **Meter check:** heating reported but 0 W for 10 min (heating element failed),
  or over 50 W while it should be off (stuck relay) → a fault with notification.

- The zone card shows the current power and today's consumption.
- The overview card shows the total for the whole house.
- Today's consumption comes from Home Assistant's 5-minute statistics, so any
  energy sensor with long-term statistics works (cumulative meters as well as
  daily utility meters). It refreshes every 5 minutes; power updates live
  without redrawing the whole card.

### Statistics

The **Statistics** button in the overview card opens a panel for today, 7 or
30 days: total consumption split into **solar / battery / grid** (solar +
battery + grid = consumption), of which surplus from the solar cascade, **kWh
per heating degree-day** (base 18 °C) compared with the previous period (only
when comparable), a chart by day or hour with grid lines and values (tap a bar
for details), rooms ranking, meter check and average humidity.

Split by source: every 30 s the integration splits the house load by source
from the solar, grid and battery power sensors (Global settings) into
`sensor.smart_heating_energia_domu_zo_siete`, `..._z_fve` and `..._z_baterie`
(proportionally). The panel splits heating in every hour with the same mix as
the whole house - this also works for sources with only an energy meter (AC).
Time before these sensors existed is shown as "unsplit".

### Solar cascade panel

Tap the **Solar surplus** tile in the overview to open a panel: cascade state
and since when, flows (production, export, import, battery, surplus vs. the
threshold), what the cascade does and why with a countdown (adding / removing a
priority), priorities 1–5 with each room's state (heating, storing and time to
the next step, at max, waiting, blocked) and today's timeline. Priorities are 1–5.

**Max. heating power from the surplus** (`pv_max_heat_power`, default 7000 W,
0 = no limit) keeps a reserve for the house: another priority is added only if
heating plus the next zone fits the limit; above the limit the lowest priority
is removed. Heating power = sum of the zones' power meters.

### Storing solar surplus

While there is a solar surplus the zone starts at the day temperature and each
time it reaches the target (at most every `pv_acc_minutes`, default 15 min) the
target is raised by `pv_acc_step` (default 1 °C) - up to the zone's **max.
temperature from surplus** (`number.*_fve_max_teplota`, default 24 °C). When
the surplus ends the target returns to normal. Switch `switch.*_fve_akumulacia`
turns it off; everything is editable on the cards. In an AC zone the AC heats
first; when the fireplace area reaches the fireplace threshold the AC stops and
the floor keeps storing heat up to the max. floor temperature.

### Humidity (monitoring only)

Optional humidity sensor per zone and outdoor humidity and pressure sensors in
the Global settings. The zone gets a felt temperature (Steadman, no wind), dew
point and an airing hint (absolute humidity inside vs outside); the zone card
shows them on one line, the overview shows outdoor humidity and pressure with a
3 h trend. Optional notification when humidity stays above 65 % or below 30 %
for an hour. Heating is not controlled by humidity yet.

## Diagnostics

Reported as faults (badge on the zone card, *Faults* row in the overview and a
notification when a fault appears and when it's resolved):

- a thermostat, AC, radiator relay or sensor unavailable for over 15 min,
- an implausible room or floor temperature,
- a room heating for 3 h while still more than 1 °C below target.

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
- **JavaScript** (`node:test` + `jsdom`) - both cards, i18n, render-skipping optimization

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

### 3. The card is added automatically - no manual steps

Since 0.12.0, the Lovelace card is bundled **inside**
`custom_components/smart_heating/` and self-registers itself at Home
Assistant startup - as a static file **and** an auto-injected dashboard
resource. This means:

- HACS deploys it automatically along with the rest of the code (since it
  lives under `custom_components/`, not a separate `www/` folder)
- **No** manual copying into `config/www/`
- **No** manually adding a resource under Settings -> Dashboards -> Resources
- Cache-busting is automatic too - the injected URL includes the installed
  version, so a HA restart after an update is always enough

Just add the card to your dashboard via the UI (Edit dashboard -> Add card ->
Smart Heating) - a visual zone picker opens, no need to type `zone_id` by
hand. Or directly in YAML:

```yaml
type: custom:smart-heating-card
zone_id: "xxxxxxxx"
name: "Living room"     # optional, otherwise uses the climate entity's name
language: auto           # optional: auto | en | sk
```

If the card doesn't show up after installing/updating, a **full Home
Assistant restart** is required (not just a HACS "reload") - the
registration only happens once, at startup.

---

## Entities created by the integration

The hub has **no** entities of its own - everything global lives in Global
settings.

### Per zone (`<id>` = the zone's internal ID)

| Entity | Description |
|---|---|
| `climate.smart_heating_<id>` | the main virtual thermostat - the primary control point (supports Cool for `floor_ac`) |
| `select.smart_heating_<id>_rezim` | Auto / Day / Night / Min / Frost / Off |
| `select.smart_heating_<id>_sezona` | **`floor_ac` only**: Heating / Cooling / Auto |
| `number..._teplota_den` / `_teplota_noc` / `_teplota_min` / `_teplota_mraz` | heating temperatures |
| `number..._floor_max` / `_floor_hysterezia` | floor max: heating stops at max, resumes below max - hysteresis. If the floor sensor has no valid value for 10 min, floor heating stops (attribute `floor_sensor_lost`) |
| `number..._floor_min` + `switch..._udrzat_min_podlahy` | minimum floor temperature: floor heats below it even when the air is warm |
| `sensor.smart_heating_fve_kaskada` | solar by power: active priority (0 = none), powers, available surplus, when the next priority is added / removed |
| `select..._fve_priorita` | solar surplus cascade: 1 heats first; 2 and 3 join once higher priorities have been warm for 10 min and are released as soon as a higher one drops > 0.5 °C below target |
| `number..._radiator_hysterezia` | radiator zones only: radiator on at target - hysteresis, off at target |
| `sensor..._stav` attributes `problemy`, `nabeh_min_na_stupen`, `nabehy_pocet` | current faults; warm-up log (median minutes per °C, count) |
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
| `binary_sensor.smart_heating_<id>_v_chode` | on while the zone is actually heating or cooling (`action` attribute: heating / cooling / idle / off) - cheap history for the overview card, usable in `history_stats` |
| `sensor..._stav` | the diagnostic reason for the current decision + attributes (`heating_allowed`, `season`, `release_control`, `zdroj_kurenia`, `tariff_blocked`, `floor_override`, `krb_override`, `emergency_active`, `pv_active`, `boost_active`, `outdoor_temperature`, `cold_outdoor_active`, plus `outdoor_entity`, `presence_entities`, `manual_presence_entities` for the overview card) |

---

## Lovelace cards

`custom_components/smart_heating/www/smart-heating-card.js` - plain JavaScript web components, no build
step. The file contains two cards.

### Zone card - `custom:smart-heating-card`

One card = one zone:

- **State at a glance** - a coloured accent bar and a status pill: Heating
  (orange, pulsing) / Not heating / Cooling / Off. The state comes from what
  is actually running (the device's own `hvac_action` when it reports one),
  not just from heating being allowed
- **Big current temperature** and next to it a **24 h chart** with the target
  drawn as a dashed line, plus min · avg · max for the last 24 h. The data
  comes from Home Assistant's own 5-minute statistics of the zone temperature
  sensor (`sensor.smart_heating_<id>_teplota`), so loading it is cheap. Keep
  that sensor in the recorder; the chart fills up over the first day.
  Clicking the temperature opens its history
- **Deviation chip** - `on target` (within ±0.5 °C), `+1.0° above`,
  `−1.6° below` - and the floor temperature
- **Target − / +** right on the card. Repeated clicks are merged into one
  `climate.set_temperature` call; the value is stored for the currently
  active sub-mode (Day / Night / Min)
- **Mode bar** Auto / Day / Night / Min. Frost and Off appear there only while
  active; all six modes are in the settings
- **Reason line** - why the integration decided what it did, with coloured
  badges (tariff, solar surplus, fireplace, emergency protection, Boost...)
- The **gear** opens the settings as collapsible sections: mode, season (AC
  zones only), temperatures, cooling, schedule, switches and Boost. Their
  content is only rendered while open, which keeps the card light on phones
- **Visual editor** when adding the card (zone dropdown, language picker)

```yaml
type: custom:smart-heating-card
zone_id: "xxxxxxxx"
name: "Living room"     # optional, otherwise uses the climate entity's name
language: auto           # optional: auto | en | sk
```

### Overview card - `custom:smart-heating-overview`

One card for the whole house, best placed full-width above the zone cards.
It needs no configuration - `type: custom:smart-heating-overview` is enough;
the outside sensor and presence entities come from the integration:

- **Outside temperature** with the change over the last 3 h and today's range
- **Condition tiles** - built-in: `heating` (N of M rooms heating), `presence`
  (who is home, from the zones' presence entities), `guests` (manual presence),
  `pv`
  (solar surplus in use), `tariff` (tariff blocks heating), `krb` (fireplace
  stops zones), `emergency`, `boost`; plus any of your own entities. Emergency
  protection and Boost appear automatically while active. Tapping a Guests
  tile or an `input_boolean` / `switch` / `light` / `fan` tile toggles it,
  other tiles open the more-info dialog (per tile: `tap_action: more-info |
  toggle | none`)
- **Summary** - rooms on target / above / below, and how long the house heated
  today (time when at least one zone was heating)

```yaml
type: custom:smart-heating-overview
outdoor_entity: sensor.outdoor_temperature   # optional, default = the integration's outdoor sensor
zones: ["xxxxxxxx", "yyyyyyyy"]              # optional, default = all zones
tiles:                                       # optional, default = heating, presence, guests, pv, tariff, krb
  - name: Home
    icon: mdi:home-account
    entities: [person.alice, person.bob]     # shows who is home
  - entity: input_boolean.guests
    name: Guests
    icon: mdi:account-group
  - entity: input_boolean.fireplace
    name: Fireplace
    icon: mdi:fireplace
    on_text: Burning
    off_text: Out
    color: hot                               # on (green) | hot | cold | warn
    tap_action: toggle                       # default for input_boolean/switch/light/fan
  - tariff
  - pv
  - heating
grid_options:
  columns: full
```

Both cards only re-render when something they display actually changes (not
on every state change in the whole of Home Assistant) - important for
performance with many cards on one dashboard. History and statistics are
fetched at most every 10-15 minutes.

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

**A card (JS) change didn't take effect** -> do a **full Home Assistant
restart** (not just a HACS "reload"). The card is registered once, at
integration startup, with the installed version baked into the URL - a
restart on the new version is both necessary and sufficient, no manual cache
bump needed. If it still looks stale after that, a browser hard-refresh
(Safari: Shift-click reload) rules out the last bit of browser-side caching.

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
