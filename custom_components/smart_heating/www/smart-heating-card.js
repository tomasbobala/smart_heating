/* Smart Heating Card
 * Standalone Lovelace cards for the Smart Heating integration.
 * No build step - pure JS web components.
 *
 * Zone card:
 *   type: custom:smart-heating-card
 *   zone_id: "287f437c"
 *   name: "Living room"   # optional, otherwise uses the climate entity's name
 *   language: auto        # optional: auto | en | sk  (auto = follow HA language)
 *
 * Overview card (whole house):
 *   type: custom:smart-heating-overview
 *   outdoor_entity: sensor.outdoor_temperature   # optional, default = the integration's outdoor sensor
 *   zones: ["287f437c", ...]                     # optional, default = all zones
 *   tiles:                                       # optional, default = heating, presence, guests, pv, tariff, krb
 *     - heating
 *     - pv
 *     - entity: input_boolean.guests
 *       name: Guests
 *       icon: mdi:account-group
 *     - name: Home
 *       icon: mdi:home-account
 *       entities: [person.a, person.b]
 */

const CARD_VERSION = "0.23.0";

const MODES = ["Auto", "Den", "Noc", "Min", "Mraz", "Vypnute"];
const QUICK_MODES = ["Auto", "Den", "Noc", "Min"];
const SEASONS = ["Kurenie", "Chladenie", "Auto"];

const MODE_LABELS = {
  Auto: { en: "Auto", sk: "Auto" },
  Den: { en: "Day", sk: "Deň" },
  Noc: { en: "Night", sk: "Noc" },
  Min: { en: "Min", sk: "Min" },
  Mraz: { en: "Frost", sk: "Mráz" },
  Vypnute: { en: "Off", sk: "Vypnuté" },
};
const SEASON_LABELS = {
  Kurenie: { en: "Heating", sk: "Kúrenie" },
  Chladenie: { en: "Cooling", sk: "Chladenie" },
  Auto: { en: "Auto", sk: "Auto" },
};

const I18N = {
  section_mode: { en: "Mode", sk: "Režim" },
  section_season: { en: "Season", sk: "Sezóna" },
  section_temps: { en: "Temperatures", sk: "Teploty" },
  section_cooling: { en: "Cooling", sk: "Chladenie" },
  section_times: { en: "Schedule", sk: "Časy" },
  section_toggles: { en: "Switches", sk: "Prepínače" },
  section_boost: { en: "Boost", sk: "Boost" },

  target: { en: "target", sk: "cieľ" },
  floor: { en: "Floor", sk: "Podlaha" },
  source: { en: "Source", sk: "Zdroj" },
  h24: { en: "24 h", sk: "24 h" },
  delta_ok: { en: "on target", sk: "v cieli" },
  delta_above: { en: "above", sk: "nad" },
  delta_below: { en: "below", sk: "pod" },
  increase: { en: "Increase target", sk: "Zvýšiť cieľ" },
  decrease: { en: "Decrease target", sk: "Znížiť cieľ" },

  badge_emergency: { en: "Emergency protection", sk: "Núdzová ochrana" },
  badge_tariff: { en: "Blocked by tariff", sk: "Zablokované tarifou" },
  badge_floor: { en: "Floor at max", sk: "Podlaha na maxime" },
  badge_floor_sensor: { en: "Floor sensor lost", sk: "Senzor podlahy výpadok" },
  badge_krb: { en: "Fireplace", sk: "Krb" },
  badge_pv: { en: "Solar surplus", sk: "FVE prebytok" },
  badge_cold: { en: "Cold outside", sk: "Mráz vonku" },
  badge_boost: { en: "Boost", sk: "Boost" },

  temp_day: { en: "Day temperature", sk: "Teplota - deň" },
  temp_night: { en: "Night temperature", sk: "Teplota - noc" },
  temp_min: { en: "Min temperature (baseline)", sk: "Teplota - min (baseline)" },
  temp_frost: { en: "Frost protection temperature", sk: "Teplota - protimrazová" },
  temp_outdoor_threshold: { en: "Outdoor threshold (forces heating)", sk: "Vonkajšia hranica (vynúti kúrenie)" },
  temp_ac_setpoint: { en: "AC physical setpoint (when heating)", sk: "AC fyzický setpoint (keď kúri)" },
  temp_ac_hysteresis: { en: "AC hysteresis", sk: "AC hysterézia" },
  temp_ac_priority_diff: { en: "AC priority - temperature difference (floor kicks in)", sk: "AC priorita - rozdiel teploty (nástup podlahy)" },
  temp_ac_priority_minutes: { en: "AC priority - time before floor kicks in (min)", sk: "AC priorita - čas do nástupu podlahy (min)" },

  cool_target: { en: "Cooling target temperature", sk: "Cieľová teplota chladenia" },
  cool_battery: { en: "Solar battery - min. % for cooling", sk: "Batérka FVE - min. % pre chladenie" },
  cool_outdoor_threshold: { en: "Outdoor threshold for Auto season", sk: "Vonkajšia hranica pre Auto-sezónu" },

  times_workday: { en: "Weekday", sk: "Prac. deň" },
  times_weekend: { en: "Weekend", sk: "Víkend" },
  times_day_start: { en: "Day starts", sk: "Začiatok dňa" },
  times_night_start: { en: "Night starts", sk: "Začiatok noci" },
  times_preheat: { en: "Pre-heating", sk: "Predkúrenie" },
  times_start: { en: "Start", sk: "Začiatok" },
  times_end: { en: "End", sk: "Koniec" },

  toggle_preheat: { en: "Pre-heating allowed (Mon-Fri)", sk: "Predkúrenie povolené (Po-Pia)" },
  toggle_krb: { en: "React to fireplace", sk: "Reaguj na krb" },
  toggle_pv: { en: "Use solar surplus", sk: "Využi FVE prebytok" },
  toggle_pv_acc: { en: "Store heat from surplus", sk: "Akumulovať teplo z prebytku" },
  pv_acc_hint: { en: "raises the target step by step while there is surplus", sk: "pri prebytku postupne zvyšuje cieľ" },
  temp_pv_max: { en: "Max. temperature from surplus", sk: "Max. teplota z prebytku" },
  badge_pv_acc: { en: "Solar storage {t}° / max {m}°", sk: "FVE akumulácia {t}° / max {m}°" },
  toggle_fixed_ac_setpoint: { en: "Use fixed AC setpoint even without external thermometer", sk: "Použiť pevný AC setpoint aj bez externého teplomera" },

  boost_running: { en: "Boost running", sk: "Boost beží" },
  boost_start: { en: "Start Boost", sk: "Spustiť Boost" },

  settings: { en: "Settings", sk: "Nastavenia" },
  status_heating: { en: "Heating", sk: "Kúri" },
  status_cooling: { en: "Cooling", sk: "Chladí" },
  status_idle_heat: { en: "Not heating", sk: "Nekúri" },
  status_idle_cool: { en: "Not cooling", sk: "Nechladí" },
  status_off: { en: "Off", sk: "Vypnuté" },

  select_zone_first: { en: "Select a zone in the card settings.", sk: "Vyber zónu v nastaveniach karty." },
  zone_not_found: { en: "Entities for zone '{zone}' were not found. Check zone_id in the card configuration.", sk: "Entity pre zónu '{zone}' sa nenašli. Skontroluj zone_id v konfigurácii karty." },
  no_zones: { en: "No Smart Heating zones found.", sk: "Nenašli sa žiadne zóny Smart Heating." },

  editor_zone: { en: "Zone", sk: "Zóna" },
  editor_zone_placeholder: { en: "-- select a zone --", sk: "-- vyber zónu --" },
  editor_name: { en: "Custom name (optional)", sk: "Vlastný názov (voliteľné)" },
  editor_language: { en: "Language", sk: "Jazyk" },

  ov_outside: { en: "outside", sk: "vonku" },
  ov_in3h: { en: "in 3 h", sk: "za 3 h" },
  ov_today: { en: "today", sk: "dnes" },
  ov_heating: { en: "Heating", sk: "Kúri sa" },
  ov_cooling: { en: "Cooling", sk: "Chladí sa" },
  ov_rooms: { en: "{n} of {m} rooms", sk: "{n} {z} {m} izieb" },
  ov_pv: { en: "Solar surplus", sk: "FVE prebytok" },
  ov_pv_on: { en: "In use", sk: "Využíva sa" },
  ov_tariff: { en: "Tariff", sk: "Tarifa" },
  ov_tariff_blocked: { en: "Blocks heating", sk: "Blokuje kúrenie" },
  ov_tariff_ok: { en: "Allowed", sk: "Povolená" },
  ov_tariff_active: { en: "Active", sk: "Aktívna" },
  ov_krb: { en: "Fireplace", sk: "Krb" },
  ov_krb_on: { en: "Stops {n} zones", sk: "Vypína zóny: {n}" },
  ov_krb_off: { en: "No effect", sk: "Bez vplyvu" },
  ov_emergency: { en: "Emergency", sk: "Núdzová ochrana" },
  ov_boost: { en: "Boost", sk: "Boost" },
  ov_active_in: { en: "{n} zones", sk: "zóny: {n}" },
  ov_yes: { en: "Yes", sk: "Áno" },
  ov_no: { en: "No", sk: "Nie" },
  ov_nobody: { en: "Nobody", sk: "Nikto" },
  ov_home: { en: "Home", sk: "Doma" },
  ov_guests: { en: "Guests", sk: "Návšteva" },
  ov_on_target: { en: "On target", sk: "V cieli" },
  ov_above: { en: "Above target", sk: "Nad cieľom" },
  ov_below: { en: "Below target", sk: "Pod cieľom" },
  section_floor: { en: "Floor", sk: "Podlaha" },
  cons_today: { en: "today", sk: "dnes" },
  src_floor: { en: "Floor", sk: "Podlaha" },
  src_ac: { en: "AC", sk: "Klíma" },
  src_radiator: { en: "Radiator", sk: "Radiátor" },
  src_other: { en: "Other", sk: "Ostatné" },
  st_btn: { en: "Statistics", sk: "Štatistiky" },
  st_title: { en: "Heating statistics", sk: "Štatistiky kúrenia" },
  st_today: { en: "Today", sk: "Dnes" },
  st_7: { en: "7 days", sk: "7 dní" },
  st_30: { en: "30 days", sk: "30 dní" },
  st_total: { en: "Consumption", sk: "Spotreba" },
  st_fve: { en: "From solar", sk: "Z FVE" },
  st_fve_surplus: { en: "of which surplus {kwh}", sk: "z toho prebytok {kwh}" },
  st_bat: { en: "From battery", sk: "Z batérie" },
  st_unknown: { en: "unsplit {kwh} (before metering)", sk: "nerozdelené {kwh} (pred meraním)" },
  st_no_compare: { en: "not enough data to compare", sk: "málo dát na porovnanie" },
  st_leg_bat: { en: "battery", sk: "batéria" },
  st_leg_unknown: { en: "unsplit", sk: "nerozdelené" },
  st_hum: { en: "Humidity (average)", sk: "Vlhkosť (priemer)" },
  st_hum_out: { en: "Outside", sk: "Vonku" },
  st_tap_hint: { en: "Tap a bar for details", sk: "Ťuknite na stĺpec pre detail" },
  st_fve_none: { en: "no data yet", sk: "zatiaľ bez dát" },
  st_grid: { en: "From the grid", sk: "Zo siete" },
  st_eff: { en: "Per degree-day", sk: "Na 1 stupeňodeň" },
  st_better: { en: "{p} % better than the previous period", sk: "o {p} % lepšie ako predchádzajúce obdobie" },
  st_worse: { en: "{p} % worse than the previous period", sk: "o {p} % horšie ako predchádzajúce obdobie" },
  st_by_day: { en: "Consumption by day", sk: "Spotreba po dňoch" },
  st_by_hour: { en: "Consumption by hour", sk: "Spotreba po hodinách" },
  st_leg_fve: { en: "solar", sk: "FVE" },
  st_leg_grid: { en: "grid", sk: "sieť" },
  st_rank: { en: "Rooms", sk: "Poradie izieb" },
  st_meters: { en: "Meter check", sk: "Kontrola meračov" },
  st_meters_ok: { en: "All meters are fine", sk: "Všetky merače sú v poriadku" },
  st_no_meters: { en: "No energy meters are set for the zones (Edit zone).", sk: "Pri zónach nie sú nastavené merače energie (Upraviť zónu)." },
  st_error: { en: "Statistics could not be loaded.", sk: "Štatistiky sa nepodarilo načítať." },
  st_fve_note: { en: "Split by source: in every hour heating gets the same grid / solar / battery mix as the whole house. Surplus = energy used while the solar cascade was heating.", sk: "Rozdelenie podľa zdroja: v každej hodine má kúrenie rovnaký pomer sieť / FVE / batéria ako celý dom. Prebytok = energia, keď kúrila kaskáda FVE." },
  hum_felt: { en: "feels like", sk: "pocitovo" },
  hum_dew: { en: "dew point", sk: "rosný bod" },
  vent_helps: { en: "airing helps", sk: "vetranie pomôže" },
  vent_worse: { en: "airing won't help", sk: "vetranie nepomôže" },
  hum_alert_high: { en: "humid", sk: "vlhko" },
  hum_alert_low: { en: "dry air", sk: "suchý vzduch" },
  cons_power: { en: "Power", sk: "Príkon" },
  ov_power_now: { en: "Heating power", sk: "Príkon kúrenia" },
  ov_energy_today: { en: "Consumption today", sk: "Spotreba dnes" },
  pv_priority: { en: "Solar priority", sk: "Priorita FVE" },
  pv_priority_hint: { en: "1 = first; 2 and 3 join once higher priorities are warm", sk: "1 = prvá; 2 a 3 sa pridajú, keď sú vyššie nahriate" },
  badge_pv_waiting: { en: "Solar – waiting for priority rooms", sk: "FVE – čaká na prioritné izby" },
  temp_floor_min: { en: "Min. floor temperature", sk: "Min. teplota podlahy" },
  temp_floor_max: { en: "Max. floor temperature", sk: "Max. teplota podlahy" },
  temp_floor_hyst: { en: "Floor hysteresis", sk: "Hysteréza podlahy" },
  temp_radiator_hyst: { en: "Radiator hysteresis", sk: "Hysteréza radiátora" },
  toggle_floor_min: { en: "Keep min. floor temperature", sk: "Udržiavať min. teplotu podlahy" },
  badge_floor_min: { en: "Floor – min. temp.", sk: "Podlaha – min. teplota" },
  badge_problem: { en: "Fault", sk: "Porucha" },
  ov_problems: { en: "Faults", sk: "Poruchy" },
  ov_settings: { en: "Integration settings", sk: "Nastavenia integrácie" },
  ov_settings_all: { en: "All settings", sk: "Všetky nastavenia" },
  ov_save: { en: "Save", sk: "Uložiť" },
  ov_cancel: { en: "Cancel", sk: "Zrušiť" },
  ov_saving: { en: "Saving…", sk: "Ukladám…" },
  ov_loading: { en: "Loading…", sk: "Načítavam…" },
  ov_saved: { en: "Saved – the integration is reloading.", sk: "Uložené – integrácia sa načíta nanovo." },
  ov_settings_error: { en: "Settings could not be loaded (administrator only).", sk: "Nastavenia sa nepodarilo načítať (len pre administrátora)." },
  ov_grp_general: { en: "General", sk: "Všeobecné" },
  ov_grp_notify: { en: "Notifications", sk: "Notifikácie" },
  of_holiday_active: { en: "Holiday", sk: "Dovolenka" },
  ov_grp_pv: { en: "Solar surplus", sk: "FVE prebytok" },
  ov_pv_prio: { en: "P1–{tier}", sk: "P1–{tier}" },
  of_pv_auto: { en: "Control by power", sk: "Riadiť podľa výkonu" },
  of_grid_export_negative: { en: "Grid export is negative", sk: "Export do siete je záporný" },
  of_battery_charge_positive: { en: "Battery charging is positive", sk: "Nabíjanie batérie je kladné" },
  of_pv_add_power: { en: "Add priority at surplus", sk: "Pridať prioritu pri prebytku" },
  of_pv_add_minutes: { en: "…lasting", sk: "…trvajúcom" },
  of_pv_shed_power: { en: "Remove at discharge / import over", sk: "Odobrať pri vybíjaní / odbere nad" },
  of_pv_shed_minutes: { en: "…lasting (each next step)", sk: "…trvajúcom (aj každý ďalší krok)" },
  of_pv_min_power: { en: "Insufficient production below", sk: "Nedostatočná výroba pod" },
  of_pv_start_soc: { en: "Battery charge is surplus from", sk: "Nabíjanie batérie je prebytok od" },
  of_pv_stop_soc: { en: "Everything off below battery", sk: "Všetko vypnúť pri batérii pod" },
  of_pv_acc_step: { en: "Storage: raise target by", sk: "Akumulácia: zvýšiť cieľ o" },
  of_pv_acc_minutes: { en: "…at most every", sk: "…najskôr každých" },
  of_nudzova_teplota: { en: "Emergency temperature", sk: "Núdzová teplota" },
  of_krb_threshold: { en: "Fireplace threshold", sk: "Hranica krbu" },
  of_notify_tariff: { en: "Tariff", sk: "Tarifa" },
  of_notify_floor: { en: "Floor", sk: "Podlaha" },
  of_notify_krb: { en: "Fireplace", sk: "Krb" },
  of_notify_emergency: { en: "Emergency protection", sk: "Núdzová ochrana" },
  of_notify_boost: { en: "Boost", sk: "Boost" },
  of_notify_cooling: { en: "Cooling", sk: "Chladenie" },
  of_notify_holiday: { en: "Holiday", sk: "Dovolenka" },
  of_notify_preheat: { en: "Pre-heating", sk: "Predkúrenie" },
  of_notify_ac_backup: { en: "AC backup", sk: "AC záloha" },
  of_notify_cold_outdoor: { en: "Outdoor threshold", sk: "Vonkajšia hranica" },
  of_notify_diagnostics: { en: "Faults", sk: "Poruchy" },
  of_notify_humidity: { en: "Humidity in rooms", sk: "Vlhkosť v izbách" },
  ov_heated_today: { en: "Heating today", sk: "Kúrenie dnes" },
  ov_cooled_today: { en: "Cooling today", sk: "Chladenie dnes" },
};

const STATS_REFRESH_MS = 15 * 60 * 1000;
const OVERVIEW_REFRESH_MS = 10 * 60 * 1000;
const DELTA_OK = 0.5;
const DAY_MS = 24 * 3600 * 1000;

// Material Design Icons (z @mdi/js) - vektorove ikony priamo v karte, bez emoji.
const MDI = {
  "chart-bar": "M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z",
  "check": "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  "account-group": "M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z",
  "account-multiple": "M16 17V19H2V17S2 13 9 13 16 17 16 17M12.5 7.5A3.5 3.5 0 1 0 9 11A3.5 3.5 0 0 0 12.5 7.5M15.94 13A5.32 5.32 0 0 1 18 17V19H22V17S22 13.37 15.94 13M15 4A3.39 3.39 0 0 0 13.07 4.59A5 5 0 0 1 13.07 10.41A3.39 3.39 0 0 0 15 11A3.5 3.5 0 0 0 15 4Z",
  "airplane": "M20.56 3.91C21.15 4.5 21.15 5.45 20.56 6.03L16.67 9.92L18.79 19.11L17.38 20.53L13.5 13.1L9.6 17L9.96 19.47L8.89 20.53L7.13 17.35L3.94 15.58L5 14.5L7.5 14.87L11.37 11L3.94 7.09L5.36 5.68L14.55 7.8L18.44 3.91C19 3.33 20 3.33 20.56 3.91Z",
  "alert": "M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z",
  "alert-circle-outline": "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  "bell-outline": "M10 21H14C14 22.1 13.1 23 12 23S10 22.1 10 21M21 19V20H3V19L5 17V11C5 7.9 7 5.2 10 4.3V4C10 2.9 10.9 2 12 2S14 2.9 14 4V4.3C17 5.2 19 7.9 19 11V17L21 19M17 11C17 8.2 14.8 6 12 6S7 8.2 7 11V18H17V11Z",
  "clock-outline": "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  "cog": "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  "fireplace": "M22,22H2V20H22V22M22,6H2V3H22V6M20,7V19H17V11C17,11 14.5,10 12,10C9.5,10 7,11 7,11V19H4V7H20M14.5,14.67H14.47L14.81,15.22L14.87,15.34C15.29,16.35 15,17.5 14.21,18.24C13.5,18.9 12.5,19.07 11.58,18.95C10.71,18.84 9.9,18.29 9.45,17.53C9.3,17.3 9.19,17.03 9.13,16.77L9,16.11C8.96,15.15 9.34,14.14 10.06,13.54C9.73,14.26 9.81,15.16 10.3,15.79L10.36,15.87C10.44,15.94 10.55,15.97 10.64,15.92C10.73,15.89 10.8,15.8 10.8,15.7L10.76,15.56C10.23,14.17 10.68,12.55 11.79,11.63C12.1,11.38 12.5,11.15 12.87,11.05C12.46,11.87 12.61,12.93 13.25,13.57L14.14,14.3L14.5,14.67M13.11,17.44V17.44C13.37,17.2 13.53,16.8 13.5,16.44V16.25C13.38,15.65 12.85,15.46 12.5,15L12.26,14.55C12.13,14.85 12.12,15.13 12.17,15.46C12.23,15.8 12.37,16.09 12.29,16.44C12.2,16.83 11.9,17.22 11.37,17.35C11.67,17.64 12.15,17.87 12.64,17.71L13.11,17.44Z",
  "flash": "M7,2V13H10V22L17,10H13L17,2H7Z",
  "floor-plan": "M10,5V10H9V5H5V13H9V12H10V17H9V14H5V19H12V17H13V19H19V17H21V21H3V3H21V15H19V10H13V15H12V9H19V5H10Z",
  "heat-wave": "M8.5 4.5L5.4 9.5L8.5 14.7L5.2 20.5L3.4 19.6L6.1 14.7L3 9.5L6.7 3.6L8.5 4.5M14.7 4.4L11.6 9.5L14.7 14.5L11.4 20.3L9.6 19.4L12.3 14.5L9.2 9.5L12.9 3.5L14.7 4.4M21 4.4L17.9 9.5L21 14.5L17.7 20.3L15.9 19.4L18.6 14.5L15.5 9.5L19.2 3.5L21 4.4",
  "help-circle-outline": "M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z",
  "home-account": "M12,3L2,12H5V20H19V12H22L12,3M12,8.75A2.25,2.25 0 0,1 14.25,11A2.25,2.25 0 0,1 12,13.25A2.25,2.25 0 0,1 9.75,11A2.25,2.25 0 0,1 12,8.75M12,15C13.5,15 16.5,15.75 16.5,17.25V18H7.5V17.25C7.5,15.75 10.5,15 12,15Z",
  "information-outline": "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
  "open-in-new": "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  "radiator": "M7.95,3L6.53,5.19L7.95,7.4H7.94L5.95,10.5L4.22,9.6L5.64,7.39L4.22,5.19L6.22,2.09L7.95,3M13.95,2.89L12.53,5.1L13.95,7.3L13.94,7.31L11.95,10.4L10.22,9.5L11.64,7.3L10.22,5.1L12.22,2L13.95,2.89M20,2.89L18.56,5.1L20,7.3V7.31L18,10.4L16.25,9.5L17.67,7.3L16.25,5.1L18.25,2L20,2.89M2,22V14A2,2 0 0,1 4,12H20A2,2 0 0,1 22,14V22H20V20H4V22H2M6,14A1,1 0 0,0 5,15V17A1,1 0 0,0 6,18A1,1 0 0,0 7,17V15A1,1 0 0,0 6,14M10,14A1,1 0 0,0 9,15V17A1,1 0 0,0 10,18A1,1 0 0,0 11,17V15A1,1 0 0,0 10,14M14,14A1,1 0 0,0 13,15V17A1,1 0 0,0 14,18A1,1 0 0,0 15,17V15A1,1 0 0,0 14,14M18,14A1,1 0 0,0 17,15V17A1,1 0 0,0 18,18A1,1 0 0,0 19,17V15A1,1 0 0,0 18,14Z",
  "rocket-launch": "M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M21.61 2.39C21.61 2.39 16.66 .269 11 5.93C8.81 8.12 7.5 10.53 6.65 12.64C6.37 13.39 6.56 14.21 7.11 14.77L9.24 16.89C9.79 17.45 10.61 17.63 11.36 17.35C13.5 16.53 15.88 15.19 18.07 13C23.73 7.34 21.61 2.39 21.61 2.39M14.54 9.46C13.76 8.68 13.76 7.41 14.54 6.63S16.59 5.85 17.37 6.63C18.14 7.41 18.15 8.68 17.37 9.46C16.59 10.24 15.32 10.24 14.54 9.46M8.88 16.53L7.47 15.12L8.88 16.53M6.24 22L9.88 18.36C9.54 18.27 9.21 18.12 8.91 17.91L4.83 22H6.24M2 22H3.41L8.18 17.24L6.76 15.83L2 20.59V22M2 19.17L6.09 15.09C5.88 14.79 5.73 14.47 5.64 14.12L2 17.76V19.17Z",
  "shield-alert-outline": "M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21M11,7H13V13H11V7M11,15H13V17H11V15Z",
  "snowflake": "M20.79,13.95L18.46,14.57L16.46,13.44V10.56L18.46,9.43L20.79,10.05L21.31,8.12L19.54,7.65L20,5.88L18.07,5.36L17.45,7.69L15.45,8.82L13,7.38V5.12L14.71,3.41L13.29,2L12,3.29L10.71,2L9.29,3.41L11,5.12V7.38L8.5,8.82L6.5,7.69L5.92,5.36L4,5.88L4.47,7.65L2.7,8.12L3.22,10.05L5.55,9.43L7.55,10.56V13.45L5.55,14.58L3.22,13.96L2.7,15.89L4.47,16.36L4,18.12L5.93,18.64L6.55,16.31L8.55,15.18L11,16.62V18.88L9.29,20.59L10.71,22L12,20.71L13.29,22L14.7,20.59L13,18.88V16.62L15.5,15.17L17.5,16.3L18.12,18.63L20,18.12L19.53,16.35L21.3,15.88L20.79,13.95M9.5,10.56L12,9.11L14.5,10.56V13.44L12,14.89L9.5,13.44V10.56Z",
  "solar-power-variant": "M3.33 16H11V13H4L3.33 16M13 16H20.67L20 13H13V16M21.11 18H13V22H22L21.11 18M2 22H11V18H2.89L2 22M11 8H13V11H11V8M15.76 7.21L17.18 5.79L19.3 7.91L17.89 9.33L15.76 7.21M4.71 7.91L6.83 5.79L8.24 7.21L6.12 9.33L4.71 7.91M3 2H6V4H3V2M18 2H21V4H18V2M12 7C14.76 7 17 4.76 17 2H7C7 4.76 9.24 7 12 7Z",
  "sync": "M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z",
  "thermometer": "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
  "toggle-switch-outline": "M17 6H7C3.69 6 1 8.69 1 12S3.69 18 7 18H17C20.31 18 23 15.31 23 12S20.31 6 17 6M17 16H7C4.79 16 3 14.21 3 12S4.79 8 7 8H17C19.21 8 21 9.79 21 12S19.21 16 17 16M17 9C15.34 9 14 10.34 14 12S15.34 15 17 15 20 13.66 20 12 18.66 9 17 9Z",
  "tune": "M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z",
};

function mdiSvg(icon) {
  const d = MDI[String(icon || "").replace(/^mdi:/, "")];
  return d ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>` : null;
}

// ---- spotreba: prikon zo stavov, energia za dnes zo statistik HA
function powerW(state) {
  if (!state) return null;
  const v = parseFloat(state.state);
  if (isNaN(v)) return null;
  const u = String((state.attributes && state.attributes.unit_of_measurement) || "W").toLowerCase();
  if (u === "kw") return v * 1000;
  if (u === "mw") return v / 1000;
  return v;
}

function sumPowerW(hass, ids) {
  let total = null;
  for (const id of ids || []) {
    const w = powerW(hass.states[id]);
    if (w != null) total = (total || 0) + w;
  }
  return total;
}

function fmtPower(w, lang) {
  if (w == null) return "–";
  if (Math.abs(w) < 1000) return `${Math.round(w)} W`;
  // Math.round namiesto toFixed: toFixed(1) by 1.45 zaokruhlilo na 1.4 (binarna presnost)
  return `${(Math.round(w / 100) / 10).toFixed(1).replace(".", lang === "sk" ? "," : ".")} kW`;
}

function fmtKwh(v, lang) {
  if (v == null) return "–";
  const dec = v < 10 ? 2 : 1;
  const f = 10 ** dec;
  return `${(Math.round(v * f) / f).toFixed(dec).replace(".", lang === "sk" ? "," : ".")} kWh`;
}

async function fetchEnergyToday(hass, ids) {
  // 5-minutove statistiky od polnoci, typ "change" = spotreba v kazdom useku;
  // funguje pre kumulativne merace aj denne utility_meter (reset o polnoci).
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const res = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: midnight.toISOString(),
    end_time: new Date().toISOString(),
    statistic_ids: ids,
    period: "5minute",
    types: ["change"],
    units: { energy: "kWh" },
  });
  let total = 0;
  let any = false;
  for (const id of ids) {
    for (const r of (res && res[id]) || []) {
      if (r.change != null && !isNaN(Number(r.change))) { total += Number(r.change); any = true; }
    }
  }
  return any ? total : null;
}

const ENERGY_REFRESH_MS = 5 * 60 * 1000;

/** Agregacia statistik pre panel Statistiky (cista funkcia - testovatelna). */
function computeStats(res, o) {
  // Kazdy riadok statistiky moze mat vlastnu dlzku (dur = podiel dna): predchadzajuce
  // obdobie po dnoch, aktualne po hodinach, dnesok po 5 minutach.
  const keyOf = (ms) => {
    const d = new Date(ms);
    return o.hourly ? `${d.toDateString()} ${d.getHours()}` : d.toDateString();
  };
  const ts = (v) => (typeof v === "number" ? v : Date.parse(v));
  const house = o.houseIds || {};
  const houseOf = {};
  for (const [k, id] of Object.entries(house)) if (id) houseOf[id] = k;
  const energySet = new Set(o.energyIds);
  const humIds = (o.humidity || []).map((h) => h.id);
  const sumBy = {};      // id -> bucket -> kWh
  const tempBy = {};     // bucket -> [{t, dur}]
  const humBy = {};      // id -> {sum, dur} (len aktualne obdobie)
  const slots = {};      // start ms -> {h, siet, fve, bateria} (len aktualne obdobie)
  for (const id of Object.keys(res)) {
    for (const r of res[id] || []) {
      const t0 = ts(r.start);
      const k = keyOf(t0);
      const dur = r.dur != null ? r.dur : (o.hourly ? 1 / 24 : 1);   // podiel dna, ktory riadok pokryva
      if (id === o.outdoorId) {
        if (r.mean != null) (tempBy[k] = tempBy[k] || []).push({ t: Number(r.mean), dur });
      }
      if (humIds.includes(id)) {
        if (r.mean != null && t0 >= o.start) {
          const h = (humBy[id] = humBy[id] || { sum: 0, dur: 0 });
          h.sum += Number(r.mean) * dur; h.dur += dur;
        }
        continue;
      }
      if (id === o.outdoorId || r.change == null || isNaN(Number(r.change))) continue;
      const v = Number(r.change);
      sumBy[id] = sumBy[id] || {};
      sumBy[id][k] = (sumBy[id][k] || 0) + v;
      if (t0 >= o.start && (energySet.has(id) || houseOf[id])) {
        const sl = (slots[t0] = slots[t0] || { h: 0, siet: 0, fve: 0, bateria: 0 });
        if (energySet.has(id)) sl.h += v;
        if (houseOf[id]) sl[houseOf[id]] += Math.max(0, v);
      }
    }
  }
  const step = o.hourly ? 3600000 : 86400000;
  const keysFrom = (from, count) => {
    const out = [];
    for (let i = 0; i < count; i++) out.push(keyOf(from + i * step + (o.hourly ? 0 : 43200000)));
    return out;
  };
  const curKeys = o.hourly ? keysFrom(o.start, 24) : keysFrom(o.start, o.days);
  const prevKeys = o.hourly ? keysFrom(o.prevStart, 24) : keysFrom(o.prevStart, o.days);
  const total = (keys, ids) => ids.reduce((a, id) => a + keys.reduce((b, k) => b + ((sumBy[id] || {})[k] || 0), 0), 0);
  // stupnodni = suma (18 °C - priemer) * dlzka useku v dnoch, len za cas, ktory naozaj uplynul
  const hdd = (keys) => keys.reduce((a, k) => a + (tempBy[k] || []).reduce((b, x) => b + Math.max(0, HDD_BASE - x.t) * x.dur, 0), 0);
  const cur = total(curKeys, o.energyIds);
  const prev = total(prevKeys, o.energyIds);
  const hddCur = hdd(curKeys), hddPrev = hdd(prevKeys);
  const eff = hddCur >= 1 ? cur / hddCur : null;
  const effPrev = hddPrev >= 1 ? prev / hddPrev : null;
  // porovnanie len pri porovnatelnom obdobi: dost stupnodni a dat (inak napr. koniec
  // leta vs. kurenie v oktobri dava "o 167 % horsie")
  const prevCovered = prevKeys.filter((k) => o.energyIds.some((id) => (sumBy[id] || {})[k] != null)).length;
  const comparable = effPrev != null && hddPrev >= 0.3 * hddCur && prevCovered >= 0.8 * prevKeys.length;
  const surplus = o.fveId ? total(curKeys, [o.fveId]) : null;

  // rozdelenie kurenia podla zdroja v kazdom useku podla mixu celeho domu
  const split = {};      // bucket -> {siet, fve, bateria, unknown}
  const hasHouse = Object.keys(houseOf).length > 0;
  for (const [t0, sl] of Object.entries(slots)) {
    const k = keyOf(Number(t0));
    const b = (split[k] = split[k] || { siet: 0, fve: 0, bateria: 0, unknown: 0 });
    const src = sl.siet + sl.fve + sl.bateria;
    if (!hasHouse || src <= 0) { b.unknown += sl.h; continue; }
    for (const key of ["siet", "fve", "bateria"]) b[key] += sl.h * (sl[key] / src);
  }
  const sumSplit = (key) => curKeys.reduce((a, k) => a + ((split[k] || {})[key] || 0), 0);

  const wd = { sk: ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
  const buckets = curKeys.map((k, i) => {
    const t = o.start + i * step;
    const d = new Date(t);
    const label = o.hourly ? String(d.getHours()) : (o.days <= 7 ? ((wd[o.lang] || wd.en)[d.getDay()]) : `${d.getDate()}.`);
    const sp = split[k] || { siet: 0, fve: 0, bateria: 0, unknown: 0 };
    const tot = total([k], o.energyIds);
    // rozdiel medzi suctom slotov a suctom bucketu (napr. zaokruhlenie) ide do "nerozdelene"
    const known = sp.siet + sp.fve + sp.bateria;
    return { t, label, total: tot, siet: sp.siet, fve: sp.fve, bateria: sp.bateria,
      unknown: Math.max(0, tot - known), surplus: o.fveId ? total([k], [o.fveId]) : 0 };
  });
  const ranking = o.zones.map((z) => {
    const parts = z.srcs.map((s) => ({ key: s.key, kwh: total(curKeys, s.energy) }));
    return { name: z.name, total: parts.reduce((a, p) => a + p.kwh, 0), parts };
  }).filter((r) => r.parts.length).sort((a, b) => b.total - a.total);
  const known = { siet: sumSplit("siet"), fve: sumSplit("fve"), bateria: sumSplit("bateria") };
  const humidity = (o.humidity || []).map((h) => ({ name: h.name, value: humBy[h.id] && humBy[h.id].dur > 0 ? humBy[h.id].sum / humBy[h.id].dur : null }))
    .filter((h) => h.value != null);
  return {
    total: cur, prevTotal: prev, eff, effPrev, comparable,
    effDelta: comparable && eff != null ? (eff - effPrev) / effPrev : null,
    surplus, fve: surplus,          // fve: spatna kompatibilita (prebytok z kaskady)
    split: hasHouse ? { ...known, unknown: Math.max(0, cur - known.siet - known.fve - known.bateria) } : null,
    buckets, ranking, zones: o.zones, hourly: o.hourly, humidity,
  };
}

/** "Pekny" krok osi: 1, 2, 2.5, 5 x 10^n tak, aby vyslo ~3-4 ciary. */
function niceStep(max) {
  const raw = Math.max(max, 0.1) / 3.5;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

const HDD_BASE = 18;

/** SVG graf spotreby po dnoch/hodinach: stlpce FVE / bateria / siet / nerozdelene,
 * mriezka s osou kWh a hodnota nad stlpcom, ked sa zmesti. Kreslene v skutocnej
 * sirke (bez preserveAspectRatio=none), takze text nie je natiahnuty. */
function statsChartSvg(st, W, lang) {
  const b = st.buckets;
  const H = 220, top = 22, base = H - 26, left = 40, right = 8;
  const n = Math.max(1, b.length);
  const slot = (W - left - right) / n;
  const bw = Math.max(3, Math.min(56, slot * 0.66));
  const max = Math.max(0.1, ...b.map((x) => x.total));
  const stepV = niceStep(max);
  let axisMax = Math.ceil(max / stepV) * stepV;
  if (axisMax - max < 0.1 * axisMax) axisMax += stepV;     // miesto na hodnotu nad najvyssim stlpcom
  const sc = (v) => (v / axisMax) * (base - top);
  const fmt = (v, d) => {
    const t = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
    return lang === "sk" ? t.replace(".", ",") : t;
  };
  const stepDec = stepV < 1 ? (stepV < 0.5 ? 2 : 1) : 0;
  let g = "";
  for (let v = 0; v <= axisMax + 1e-9; v += stepV) {
    const y = base - sc(v);
    g += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${W - right}" y2="${y.toFixed(1)}" class="${v === 0 ? "ax" : "gr"}"></line>`;
    g += `<text x="${left - 6}" y="${(y + 3.5).toFixed(1)}" class="yl">${fmt(v, stepDec)}</text>`;
  }
  g += `<text x="${left - 6}" y="${top - 10}" class="yl">kWh</text>`;
  // hodnoty nad vsetkymi stlpcami, ked je miesto; inak len maximum (detail tuknutim)
  const valDec = max < 10 ? 1 : 0;
  const labelAll = slot >= (max < 10 ? 26 : 22);
  const maxIdx = b.reduce((m, x, i) => (x.total > b[m].total ? i : m), 0);
  const order = st.split ? ["siet", "bateria", "fve", "unknown"] : ["unknown"];
  const every = Math.max(1, Math.ceil(28 / slot));
  b.forEach((x, i) => {
    const xx = left + i * slot + (slot - bw) / 2;
    let y = base;
    const parts = st.split ? x : { unknown: x.total };
    const segs = order.map((k) => [k, parts[k] || 0]).filter(([, v]) => v > 0);
    segs.forEach(([k, v], si) => {
      const h = sc(v);
      if (h < 0.4) return;
      y -= h;
      const r = si === segs.length - 1 ? 3 : 0;    // zaoblenie len navrchu
      g += `<rect x="${xx.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" class="${k}"></rect>`;
    });
    if (x.total > 0 && (labelAll || i === maxIdx)) {
      g += `<text x="${(xx + bw / 2).toFixed(1)}" y="${(base - sc(x.total) - 5).toFixed(1)}" class="vl">${fmt(x.total, valDec)}</text>`;
    }
    if (i % every === 0 || i === b.length - 1) {
      g += `<text x="${(xx + bw / 2).toFixed(1)}" y="${base + 16}" class="lb">${esc(x.label)}</text>`;
    }
    // neviditelna plocha cez cely stlpec - tuknutie / prejdenie mysou ukaze detail
    g += `<rect x="${(left + i * slot).toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${base - top}" class="hit" data-bi="${i}"><title>${esc(x.label)}: ${fmt(x.total, 1)} kWh</title></rect>`;
  });
  return `<svg class="sho-chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img">${g}</svg>`;
}



const ICONS = {
  drop: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c-.3 0-.6.2-.8.4C9.6 5 5 10.6 5 14.5a7 7 0 0 0 14 0c0-3.9-4.6-9.5-6.2-11.6a1 1 0 0 0-.8-.4z"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c3 4 6 6.5 6 11a6 6 0 0 1-12 0c0-2.6 1.4-4.6 3-6 .2 1.6 1 2.6 2 3 .3-3 1.2-5.6 1-8z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></svg>`,
  power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>`,
  floor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 20h18M6 16c0-2 2-2 2-4s-2-2-2-4M12 16c0-2 2-2 2-4s-2-2-2-4M18 16c0-2 2-2 2-4s-2-2-2-4"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
};

function eid(zoneId, domain, key) {
  return `${domain}.smart_heating_${zoneId}${key ? "_" + key : ""}`;
}

function findZones(hass) {
  const zones = [];
  for (const entityId of Object.keys(hass.states)) {
    const m = entityId.match(/^climate\.smart_heating_([a-f0-9]+)$/);
    if (m) {
      const state = hass.states[entityId];
      zones.push({ zone_id: m[1], name: state.attributes.friendly_name || m[1] });
    }
  }
  zones.sort((a, b) => a.name.localeCompare(b.name));
  return zones;
}

function resolveLang(hass, configLang) {
  if (configLang === "en" || configLang === "sk") return configLang;
  const hLang = (hass && hass.language) || (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  const l = hLang.toLowerCase();
  return l.startsWith("sk") || l.startsWith("cs") ? "sk" : "en";
}

function translate(lang, key, vars) {
  const entry = I18N[key];
  let text = entry ? entry[lang] || entry.en || key : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(v);
  }
  return text;
}

const num = (v) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const tsOf = (v) => (typeof v === "number" ? (v < 1e11 ? v * 1000 : v) : Date.parse(v));

function fmtNum(v, lang, digits = 1) {
  if (v == null) return "–";
  const s = Number(v).toFixed(digits);
  return lang === "sk" ? s.replace(".", ",") : s;
}

/** 23 -> "23", 22.5 -> "22,5" */
function fmtShort(v, lang) {
  if (v == null) return "–";
  const n = Math.round(Number(v) * 10) / 10;
  return Number.isInteger(n) ? String(n) : fmtNum(n, lang, 1);
}

function fmtSigned(v, lang) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return sign + fmtNum(Math.abs(v), lang, 1);
}

function fmtDuration(minutes, lang) {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** "z" alebo "zo" pred cislom (zo 4, zo 6, zo 7, zo 14 ...) */
function skPrep(n) {
  const zo = new Set([4, 6, 7, 14, 16, 17]);
  if (zo.has(n)) return "zo";
  if (n >= 40 && /^[467]/.test(String(n))) return "zo";
  return "z";
}

function zoneDelta(current, target) {
  if (current == null || target == null) return null;
  return Math.round((Number(current) - Number(target)) * 10) / 10;
}

function deltaClass(d) {
  if (d == null) return "";
  if (Math.abs(d) <= DELTA_OK) return "ok";
  return d > 0 ? "up" : "dn";
}

function fireMoreInfo(node, entityId) {
  node.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

const SHARED_TOKENS = `
  --sh-heat: #ff8a3d;
  --sh-cool: #4fa3ff;
  --sh-ok: #4caf7d;
  --sh-warn: #e8a838;
  --sh-err: #e5484d;
  --sh-mode: #7c6cf0;
  --sh-fill: rgba(127, 127, 127, 0.12);
  --sh-fill-hover: rgba(127, 127, 127, 0.2);
  --sh-txt: var(--primary-text-color);
  --sh-sub: var(--secondary-text-color);
`;

// ============================================================== KARTA ZONY

class SmartHeatingCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._settingsOpen = false;
    this._stats = null;
    this._statsFetchedAt = 0;
    this._statsLoading = false;
    this._pendingTarget = null;
    this._targetTimer = null;
  }

  setConfig(config) {
    if (!config.zone_id) {
      throw new Error("smart-heating-card: missing required field 'zone_id'");
    }
    this._config = config;
    this._zoneId = config.zone_id;
    this._cachedEntityIds = null;
    this._built = false;
    if (this._hass) {
      this._buildSkeleton();
      this._built = true;
      this._updateContent();
    }
  }

  get _lang() {
    return resolveLang(this._hass, this._config.language);
  }

  _t(key, vars) {
    return translate(this._lang, key, vars);
  }

  _modeLabel(mode) {
    const entry = MODE_LABELS[mode];
    return entry ? entry[this._lang] || entry.en : mode;
  }

  _seasonLabel(season) {
    const entry = SEASON_LABELS[season];
    return entry ? entry[this._lang] || entry.en : season;
  }

  set hass(hass) {
    const prevHass = this._hass;
    this._hass = hass;
    if (!this._built) {
      this._buildSkeleton();
      this._built = true;
    }
    if (prevHass && prevHass.language === hass.language) {
      const relevantChanged = this._entityIds().some((id) => hass.states[id] !== prevHass.states[id]);
      if (!relevantChanged) {
        // prikon sa meni casto - prekresli len riadok spotreby, nie celu kartu
        if (this._consIds("power_entities").some((id) => hass.states[id] !== prevHass.states[id])) {
          this._renderConsumption();
        }
        this._maybeFetchEnergy();
        return;
      }
    }
    this._updateContent();
    this._renderConsumption();
    this._maybeFetchEnergy();
  }

  _consIds(key) {
    const st = this._hass && this._zoneId ? this._hass.states[eid(this._zoneId, "sensor", "stav")] : null;
    const ids = st && st.attributes ? st.attributes[key] : null;
    return Array.isArray(ids) ? ids : [];
  }

  _renderConsumption() {
    const wrap = this.querySelector(".sh-cons");
    if (!wrap) return;
    const pIds = this._consIds("power_entities");
    const eIds = this._consIds("energy_entities");
    if (!pIds.length && !eIds.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const st = this._hass.states[eid(this._zoneId, "sensor", "stav")];
    const srcs = ((st && st.attributes && st.attributes.sources) || []).filter((x) => (x.power || []).length);
    const pEl = wrap.querySelector(".sh-cons-p");
    const lbl = wrap.querySelector(".sh-cons-lbl");
    if (srcs.length >= 2) {
      // viac zdrojov: rozpad, napr. Podlaha 0,8 kW · Klima 1,2 kW
      lbl.hidden = true;
      pEl.innerHTML = srcs.map((x) =>
        `<span class="sh-src"><i class="seg ${esc(x.key)}"></i>${esc(this._t("src_" + x.key))} <b>${esc(fmtPower(sumPowerW(this._hass, x.power), this._lang))}</b></span>`).join("");
    } else {
      lbl.hidden = false;
      pEl.textContent = pIds.length ? fmtPower(sumPowerW(this._hass, pIds), this._lang) : "";
    }
    wrap.querySelector(".sh-cons-e").textContent = eIds.length && this._energyToday != null
      ? `${this._t("cons_today")} ${fmtKwh(this._energyToday, this._lang)}` : "";
  }

  _maybeFetchEnergy() {
    const ids = this._consIds("energy_entities");
    const hass = this._hass;
    if (!ids.length || !hass || typeof hass.callWS !== "function" || this._energyLoading) return;
    const day = new Date().toDateString();
    if (this._energyDay === day && Date.now() - (this._energyAt || 0) < ENERGY_REFRESH_MS) return;
    this._energyLoading = true;
    fetchEnergyToday(hass, ids)
      .then((v) => { this._energyToday = v; this._energyDay = day; this._energyAt = Date.now(); this._renderConsumption(); })
      .catch(() => { this._energyAt = Date.now(); this._energyDay = day; })
      .finally(() => { this._energyLoading = false; });
  }

  _entityIds() {
    if (this._cachedEntityIds) return this._cachedEntityIds;
    const z = this._zoneId;
    this._cachedEntityIds = [
      eid(z, "climate"),
      eid(z, "select", "rezim"),
      eid(z, "select", "sezona"),
      eid(z, "sensor", "stav"),
      eid(z, "sensor", "teplota"),
      eid(z, "number", "teplota_den"),
      eid(z, "number", "teplota_noc"),
      eid(z, "number", "teplota_min"),
      eid(z, "number", "teplota_mraz"),
      eid(z, "number", "boost_hodiny"),
      eid(z, "number", "vonkajsia_hranica"),
      eid(z, "number", "vonkajsia_hranica_chladenie"),
      eid(z, "number", "teplota_chladenie"),
      eid(z, "number", "bateria_hranica_chladenie"),
      eid(z, "number", "ac_setpoint_teplota"),
      eid(z, "number", "ac_hysterezia"),
      eid(z, "number", "ac_priorita_rozdiel"),
      eid(z, "number", "ac_priorita_minuty"),
      eid(z, "time", "den_od_tyzden"),
      eid(z, "time", "den_od_vikend"),
      eid(z, "time", "noc_od_tyzden"),
      eid(z, "time", "noc_od_vikend"),
      eid(z, "time", "predkurenie_od"),
      eid(z, "time", "predkurenie_do"),
      eid(z, "switch", "predkurenie_povolene"),
      eid(z, "switch", "reaguj_na_krb"),
      eid(z, "switch", "vyuzi_fve_prebytok"),
      eid(z, "switch", "pouzit_pevny_ac_setpoint"),
      eid(z, "switch", "udrzat_min_podlahy"),
      eid(z, "select", "fve_priorita"),
      eid(z, "switch", "fve_akumulacia"),
      eid(z, "number", "fve_max_teplota"),
      eid(z, "number", "floor_min"),
      eid(z, "number", "floor_max"),
      eid(z, "number", "floor_hysterezia"),
      eid(z, "number", "radiator_hysterezia"),
    ];
    return this._cachedEntityIds;
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  static getConfigElement() {
    return document.createElement("smart-heating-card-editor");
  }

  static getStubConfig(hass) {
    const zones = findZones(hass);
    return { type: "custom:smart-heating-card", zone_id: zones[0]?.zone_id || "" };
  }

  // ------------------------------------------------------------------ DOM

  _buildSkeleton() {
    const section = (cls, icon, key, body, extra = "") =>
      `<details class="sh-section ${cls}" ${extra}>
         <summary class="sh-section-label"><span class="sh-icon">${icon}</span>${this._t(key)}<span class="sh-sum-val"></span></summary>
         ${body}
       </details>`;

    this.innerHTML = `
      <ha-card>
        <style>${this._styles()}</style>
        <div class="sh-root">
          <div class="sh-accent"></div>
          <div class="sh-hd">
            <div class="sh-hd-txt">
              <div class="sh-title"></div>
              <div class="sh-subtitle"></div>
            </div>
            <span class="sh-pill"></span>
          </div>

          <div class="sh-mid">
            <button class="sh-temp" type="button"></button>
            <div class="sh-chart">
              <svg class="sh-spark" viewBox="0 0 260 46" preserveAspectRatio="none" aria-hidden="true"></svg>
              <div class="sh-lg"><span class="sh-lg-span">${this._t("h24")}</span><span class="sh-lg-v"></span></div>
            </div>
          </div>

          <div class="sh-feel" hidden></div>

          <div class="sh-row2">
            <span class="sh-delta"></span>
            <span class="sh-chip-floor"></span>
            <div class="sh-tgt">
              <button type="button" data-tgt="-1" aria-label="${this._t("decrease")}">−</button>
              <span class="sh-tgt-v" title="${this._t("target")}"><span class="lbl">${this._t("target")} </span><b></b></span>
              <button type="button" data-tgt="1" aria-label="${this._t("increase")}">+</button>
            </div>
          </div>

          <div class="sh-cons" hidden>
            <span class="sh-cons-i">${mdiSvg("flash")}</span>
            <span class="sh-cons-lbl">${this._t("cons_power")}</span>
            <span class="sh-cons-p"></span>
            <span class="sh-cons-e"></span>
          </div>

          <div class="sh-ft">
            <div class="sh-seg" role="group" aria-label="${this._t("section_mode")}"></div>
            <button class="sh-gear" type="button" aria-expanded="false" aria-label="${this._t("settings")}" title="${this._t("settings")}">${ICONS.gear}</button>
          </div>
          <div class="sh-prob"></div>
          <div class="sh-why"><span class="sh-badges"></span><span class="sh-why-t"></span></div>

          <div class="sh-settings" hidden>
            ${section("sh-section--mode", mdiSvg("tune"), "section_mode", `<div class="sh-chips sh-mode-chips"></div>`)}
            ${section("sh-section--mode sh-season-section", mdiSvg("sync"), "section_season", `<div class="sh-chips sh-season-chips"></div>`, 'style="display:none"')}
            ${section("sh-section--temp", mdiSvg("thermometer"), "section_temps", `<div class="sh-temps"></div>`)}
            ${section("sh-section--floor", mdiSvg("heat-wave"), "section_floor", `<div class="sh-floor"></div>`)}
            ${section("sh-section--temp sh-cooling-section", mdiSvg("snowflake"), "section_cooling", `<div class="sh-cooling"></div>`, 'style="display:none"')}
            ${section("sh-section--time", mdiSvg("clock-outline"), "section_times", `<div class="sh-times"></div>`)}
            ${section("sh-section--toggle", mdiSvg("toggle-switch-outline"), "section_toggles", `<div class="sh-toggles"></div>`)}
            ${section("sh-section--boost", mdiSvg("rocket-launch"), "section_boost", `<div class="sh-boost"></div>`)}
          </div>
        </div>
      </ha-card>
    `;

    const gear = this.querySelector(".sh-gear");
    gear.addEventListener("click", () => {
      this._settingsOpen = !this._settingsOpen;
      gear.setAttribute("aria-expanded", String(this._settingsOpen));
      this.querySelector(".sh-settings").hidden = !this._settingsOpen;
      if (this._settingsOpen) this._renderSettings();
    });

    this.querySelectorAll(".sh-tgt button").forEach((btn) => {
      btn.addEventListener("click", () => this._stepTarget(Number(btn.dataset.tgt)));
    });

    this.querySelector(".sh-temp").addEventListener("click", () => {
      const id = this._hass && this._hass.states[eid(this._zoneId, "sensor", "teplota")]
        ? eid(this._zoneId, "sensor", "teplota")
        : eid(this._zoneId, "climate");
      fireMoreInfo(this, id);
    });
  }

  _styles() {
    return `
      smart-heating-card { display: block; height: 100%; }
      smart-heating-card > ha-card { height: 100%; display: flex; flex-direction: column; overflow: hidden; position: relative; }
      .sh-root { ${SHARED_TOKENS}
        position: relative; flex: 1; padding: 16px 18px 14px 20px; display: flex; flex-direction: column;
        container-type: inline-size; color: var(--sh-txt); --sh-acc: rgba(127,127,127,0.35); }
      .sh-root.is-heat { --sh-acc: var(--sh-heat); background: linear-gradient(135deg, rgba(255,138,61,0.10), transparent 55%); }
      .sh-root.is-cool { --sh-acc: var(--sh-cool); background: linear-gradient(135deg, rgba(79,163,255,0.10), transparent 55%); }
      .sh-root.is-off { --sh-acc: rgba(127,127,127,0.18); }
      .sh-root.is-stale { opacity: .55; pointer-events: none; }
      .sh-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--sh-acc); transition: background .4s ease; }

      .sh-hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .sh-hd-txt { min-width: 0; }
      .sh-title { font-size: 18px; font-weight: 650; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sh-subtitle { font-size: 12px; color: var(--sh-sub); opacity: .85; margin-top: 1px; min-height: 1.3em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .sh-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 650; padding: 5px 10px;
        border-radius: 999px; white-space: nowrap; background: var(--sh-fill); color: var(--sh-sub); flex-shrink: 0; }
      .sh-pill svg { width: 13px; height: 13px; }
      .sh-pill.heat { background: rgba(255,138,61,0.16); color: var(--sh-heat); }
      .sh-pill.cool { background: rgba(79,163,255,0.16); color: var(--sh-cool); }
      .sh-pill.off { opacity: .7; }
      .sh-pill.heat svg, .sh-pill.cool svg { animation: sh-pulse 1.6s ease-in-out infinite; }
      @keyframes sh-pulse { 50% { opacity: .35; } }

      .sh-mid { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; margin: 12px 0 2px; }
      .sh-mid.no-chart { grid-template-columns: auto; }
      .sh-mid.no-chart .sh-chart { display: none; }
      .sh-temp { all: unset; cursor: pointer; font-size: 48px; font-weight: 700; letter-spacing: -0.03em; line-height: 1;
        font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--sh-txt); border-radius: 8px; }
      .sh-temp small { font-size: 22px; font-weight: 600; color: var(--sh-sub); margin-left: 1px; letter-spacing: 0; }
      .sh-temp:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 3px; }
      .sh-chart { min-width: 0; }
      .sh-spark { display: block; width: 100%; height: 46px; overflow: visible; color: var(--sh-sub); }
      .sh-root.is-heat .sh-spark { color: var(--sh-heat); }
      .sh-root.is-cool .sh-spark { color: var(--sh-cool); }
      .sh-lg { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--sh-sub); opacity: .8;
        font-variant-numeric: tabular-nums; margin-top: 3px; white-space: nowrap; }
      .sh-lg-v { overflow: hidden; text-overflow: ellipsis; }

      .sh-row2 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
      /* vlhkost: pevne jeden riadok (vyska karty sa nesmie menit) */
      .sh-feel { display: flex; align-items: center; gap: 6px; height: 18px; margin-top: 8px; font-size: 12px; color: var(--sh-sub);
        white-space: nowrap; overflow: hidden; font-variant-numeric: tabular-nums; }
      .sh-feel[hidden] { display: none; }
      .sh-feel svg { width: 14px; height: 14px; flex-shrink: 0; color: #4fa3ff; }
      .sh-feel b { color: var(--sh-txt); font-weight: 600; }
      .sh-feel .t { overflow: hidden; text-overflow: ellipsis; }
      .sh-feel.dry svg, .sh-feel .dry { color: var(--sh-warn, #e8a838); }
      .sh-feel.wet svg, .sh-feel .wet { color: var(--sh-err, #e5484d); }
      .sh-delta { font-size: 12px; font-weight: 650; padding: 4px 9px; border-radius: 8px; white-space: nowrap; }
      .sh-delta:empty, .sh-chip-floor:empty { display: none; }
      .sh-cons { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--sh-sub, var(--secondary-text-color)); margin: 2px 0 6px; }
      /* porucha na vlastnom riadku a zalomena, nie orezana */
      .sh-prob { margin-top: 8px; font-size: 11.5px; font-weight: 650; line-height: 1.4; color: var(--sh-err, #e5484d); }
      .sh-prob:empty { display: none; }
      .sh-prob div::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor;
        margin-right: 5px; vertical-align: 1px; }
      .sh-cons[hidden] { display: none; }
      .sh-cons-i { display: inline-flex; color: var(--sh-warn, #e8a838); }
      .sh-cons-i svg { width: 15px; height: 15px; display: block; }
      .sh-cons-p { font-weight: 650; color: var(--sh-txt, var(--primary-text-color)); font-variant-numeric: tabular-nums; }
      .sh-cons-e { font-variant-numeric: tabular-nums; }
      .sh-cons { flex-wrap: wrap; }
      .sh-src { display: inline-flex; align-items: center; gap: 5px; margin-right: 10px; font-weight: 400; color: var(--sh-sub, var(--secondary-text-color)); }
      .sh-src b { color: var(--sh-txt, var(--primary-text-color)); font-weight: 650; }
      .sh-src i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .sh-src .seg.floor { background: #f0883e; } .sh-src .seg.ac { background: #4fa3ff; }
      .sh-src .seg.radiator { background: #2fa98a; } .sh-src .seg.other { background: #9a9aa2; }
      .sh-cons-e:not(:empty)::before { content: "·"; margin: 0 6px 0 2px; opacity: .6; }
      .sh-delta.up { color: var(--sh-warn); background: rgba(232,168,56,0.13); }
      .sh-delta.ok { color: var(--sh-ok); background: rgba(76,175,125,0.13); }
      .sh-delta.dn { color: var(--sh-cool); background: rgba(79,163,255,0.13); }
      .sh-chip-floor { font-size: 12px; padding: 4px 9px; border-radius: 8px; background: var(--sh-fill); color: var(--sh-sub); white-space: nowrap; }
      .sh-chip-floor b { color: var(--sh-txt); font-weight: 600; }
      .sh-chip-floor svg { display: none; width: 13px; height: 13px; vertical-align: -2px; margin-right: 4px; }
      .sh-tgt { margin-left: auto; display: flex; align-items: center; background: var(--sh-fill); border-radius: 12px; padding: 3px; }
      .sh-tgt button { all: unset; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center;
        color: var(--sh-sub); font-size: 18px; cursor: pointer; user-select: none; }
      .sh-tgt button:hover { background: var(--sh-fill-hover); color: var(--sh-txt); }
      .sh-tgt button:focus-visible { outline: 2px solid var(--primary-color); }
      .sh-tgt button:disabled { opacity: .3; cursor: default; background: none; }
      .sh-tgt-v { min-width: 66px; text-align: center; font-size: 13px; color: var(--sh-sub); white-space: nowrap; }
      .sh-tgt-v b { color: var(--sh-txt); font-size: 16px; font-variant-numeric: tabular-nums; }
      .sh-tgt.pending .sh-tgt-v b { color: var(--primary-color); }

      .sh-ft { display: flex; gap: 6px; align-items: center; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--divider-color); }
      .sh-row2 + .sh-ft { margin-top: 14px; }
      .sh-seg { display: flex; flex-wrap: wrap; background: var(--sh-fill); border-radius: 10px; padding: 3px; gap: 2px; }
      .sh-seg button { all: unset; font-size: 12px; padding: 5px 9px; border-radius: 8px; color: var(--sh-sub); cursor: pointer; user-select: none; }
      .sh-seg button:hover { color: var(--sh-txt); background: var(--sh-fill); }
      .sh-seg button:focus-visible { outline: 2px solid var(--primary-color); }
      .sh-seg button.a { background: var(--sh-mode); color: #fff; font-weight: 600; cursor: default; }
      .sh-seg button.a.special { background: rgba(127,127,127,0.45); }
      .sh-gear { all: unset; margin-left: auto; width: 30px; height: 30px; border-radius: 9px; background: var(--sh-fill);
        display: grid; place-items: center; color: var(--sh-sub); cursor: pointer; flex-shrink: 0; }
      .sh-gear svg { width: 15px; height: 15px; transition: transform .3s ease; }
      .sh-gear:hover { color: var(--sh-txt); background: var(--sh-fill-hover); }
      .sh-gear:focus-visible { outline: 2px solid var(--primary-color); }
      .sh-gear[aria-expanded="true"] { color: var(--sh-txt); background: var(--sh-fill-hover); }
      .sh-gear[aria-expanded="true"] svg { transform: rotate(60deg); }

      .sh-why { font-size: 11.5px; color: var(--sh-sub); opacity: .85; margin-top: 8px; line-height: 1.45; height: 2.9em; flex-shrink: 0;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .sh-badges:empty { display: none; }
      .sh-badge { font-weight: 650; margin-right: 6px; white-space: nowrap; }
      .sh-badge::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor;
        margin-right: 4px; vertical-align: 1px; }
      .sh-badge.warn { color: var(--sh-warn); }
      .sh-badge.err { color: var(--sh-err); }
      .sh-badge.ok { color: var(--sh-ok); }
      .sh-badge.info { color: var(--sh-cool); }

      @container (max-width: 360px) {
        .sh-chip-floor .lbl { display: none; }
        .sh-chip-floor svg { display: inline-block; }
        .sh-tgt button { width: 26px; height: 28px; }
        .sh-tgt-v { min-width: 52px; }
      }
      @container (max-width: 300px) {
        .sh-tgt-v .lbl { display: none; }
        .sh-tgt-v { min-width: 40px; }
      }
      @container (max-width: 270px) {
        .sh-temp { font-size: 40px; }
        .sh-temp small { font-size: 18px; }
        .sh-seg button { padding: 5px 7px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .sh-pill svg { animation: none !important; }
        .sh-gear svg, .sh-accent { transition: none; }
      }

      .sh-settings { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: start; margin-top: 14px; }
      .sh-settings[hidden] { display: none; }
      @container (min-width: 480px) { .sh-settings { grid-template-columns: 1fr 1fr; } }

      .sh-section { border-radius: 10px; }
      .sh-section-label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 500;
        color: var(--primary-text-color); padding: 9px 12px; border-radius: 9px; background: var(--sh-fill); }
      .sh-icon { font-size: 0.95rem; line-height: 1; display: inline-flex; color: var(--sh-sub, var(--secondary-text-color)); }
      .sh-icon svg { width: 17px; height: 17px; display: block; }
      .sh-row-hint { font-size: 11.5px; color: var(--sh-sub, var(--secondary-text-color)); margin-top: 2px; }
      .sh-pv-prio .sh-chip { min-width: 34px; padding: 4px 10px; }
      .sh-sum-val { margin-left: auto; font-size: 0.78rem; font-weight: 400; color: var(--secondary-text-color); }
      details.sh-section > summary.sh-section-label { cursor: pointer; list-style: none; user-select: none; }
      details.sh-section > summary.sh-section-label::-webkit-details-marker { display: none; }
      details.sh-section > summary.sh-section-label::after { content: "\\25B8"; font-size: 0.7rem; margin-left: 10px;
        color: var(--secondary-text-color); transition: transform .15s ease; }
      details.sh-section[open] > summary.sh-section-label::after { transform: rotate(90deg); }
      details.sh-section > summary.sh-section-label:hover { background: var(--sh-fill-hover); }
      details.sh-section > summary:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      details.sh-section > div { margin-top: 12px; padding: 0 2px; }

      .sh-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .sh-chip { font: inherit; font-size: 0.85rem; border: 1px solid var(--divider-color); border-radius: 999px; padding: 6px 14px;
        cursor: pointer; color: var(--primary-text-color); background: transparent; user-select: none; }
      .sh-chip.active { background: var(--sh-mode); border-color: var(--sh-mode); color: #fff; }
      .sh-temps, .sh-cooling { display: flex; flex-direction: column; gap: 10px; }
      .sh-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .sh-row-label { font-size: 0.88rem; color: var(--primary-text-color); flex: 1; }
      .sh-stepper { display: flex; align-items: center; gap: 8px; }
      .sh-stepper button { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--divider-color);
        background: var(--card-background-color); color: var(--primary-text-color); font-size: 1rem; cursor: pointer; line-height: 1; }
      .sh-stepper .sh-val { min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
      .sh-time-input { border: 1px solid var(--divider-color); border-radius: 6px; background: var(--card-background-color);
        color: var(--primary-text-color); padding: 4px 6px; font-size: 0.85rem; width: 90px; }
      .sh-toggles { display: flex; flex-direction: column; gap: 10px; }
      .sh-switch { position: relative; width: 40px; height: 22px; border-radius: 999px; background: var(--divider-color); cursor: pointer; flex-shrink: 0; }
      .sh-switch.on { background: var(--sh-ok); }
      .sh-switch .knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s ease; }
      .sh-switch.on .knob { left: 20px; }
      .sh-boost { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .sh-boost-btn { font: inherit; font-size: 0.88rem; border: none; border-radius: 8px; background: var(--sh-heat); color: #fff; padding: 8px 16px; cursor: pointer; }
      .sh-boost-btn:disabled { opacity: .5; cursor: default; }
      .sh-boost-status { font-size: 0.8rem; color: var(--secondary-text-color); }

      .sh-times-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 14px; }
      .sh-times-table:last-child { margin-bottom: 0; }
      .sh-times-table th { text-align: left; font-weight: 500; color: var(--secondary-text-color); font-size: 0.78rem; padding-bottom: 6px; }
      .sh-times-table td { padding: 4px 6px 4px 0; color: var(--primary-text-color); }
      .sh-times-table--predkurenie { max-width: 220px; }
      .sh-msg { padding: 16px; font-size: 0.9rem; color: var(--secondary-text-color); }
    `;
  }

  // ------------------------------------------------------------------ update

  _showMessage(text) {
    const root = this.querySelector(".sh-root");
    if (root) {
      root.className = "sh-root";
      root.innerHTML = `<div class="sh-msg">${esc(text)}</div>`;
    }
    this._built = false;
  }

  _updateContent() {
    if (!this._zoneId) {
      this._showMessage(this._t("select_zone_first"));
      return;
    }
    const hass = this._hass;
    const zoneId = this._zoneId;
    const climate = hass.states[eid(zoneId, "climate")];
    const stavSensor = hass.states[eid(zoneId, "sensor", "stav")];

    if (!climate || !stavSensor) {
      // Pri reloade integracie (napr. po ulozeni nastaveni) entity na chvilu zmiznu.
      // Keby sa karta zmenila na kratku spravu, stranka by poskocila - nechame
      // posledny obsah a len ho stlmime.
      const root = this.querySelector(".sh-root");
      if (this._rendered && root && this.querySelector(".sh-pill")) {
        root.classList.add("is-stale");
        return;
      }
      this._showMessage(this._t("zone_not_found", { zone: zoneId }));
      return;
    }
    this._rendered = true;
    if (!this.querySelector(".sh-pill")) {
      this._buildSkeleton();
      this._built = true;
    }

    const attrs = climate.attributes;
    const zAttrs = stavSensor.attributes;
    const current = num(attrs.current_temperature);
    const mode = attrs.rezim || "Auto";

    if (this._pendingTarget != null && num(attrs.temperature) === this._pendingTarget && !this._targetTimer) {
      this._pendingTarget = null;
    }
    const target = this._pendingTarget != null ? this._pendingTarget : num(attrs.temperature);

    this.querySelector(".sh-title").textContent = this._config.name || attrs.friendly_name || zoneId;
    this.querySelector(".sh-subtitle").textContent = zAttrs.zdroj_kurenia ? `${this._t("source")}: ${zAttrs.zdroj_kurenia}` : "";

    const state = this._renderStatus(attrs, zAttrs);
    this.querySelector(".sh-root").className = `sh-root is-${state}`;

    this._renderTemp(current);
    this._renderRow2(current, target, zAttrs, mode);
    this._renderModeSeg(mode);
    this._renderBadges(zAttrs);
    this._renderHumidity(zAttrs);
    this.querySelector(".sh-why-t").textContent = stavSensor.state || "";

    const hasAc = !!hass.states[eid(zoneId, "select", "sezona")];
    this.querySelector(".sh-season-section").style.display = hasAc ? "" : "none";
    this.querySelector(".sh-cooling-section").style.display = hasAc ? "" : "none";
    this._renderSummaries(attrs, zAttrs, hasAc);
    if (this._settingsOpen) this._renderSettings();

    this._renderChart();
    this._maybeFetchStats();
  }

  _renderStatus(attrs, zAttrs) {
    const action = attrs.hvac_action;
    const isCoolSeason = (zAttrs.season || attrs.sezona) === "Chladenie";
    let cls = "idle";
    let key = isCoolSeason ? "status_idle_cool" : "status_idle_heat";
    let icon = ICONS.pause;
    if ((attrs.rezim || "") === "Vypnute" || action === "off") { cls = "off"; key = "status_off"; icon = ICONS.power; }
    if (action === "heating") { cls = "heat"; key = "status_heating"; icon = ICONS.flame; }
    if (action === "cooling") { cls = "cool"; key = "status_cooling"; icon = ICONS.snow; }
    const el = this.querySelector(".sh-pill");
    el.className = `sh-pill ${cls}`;
    el.innerHTML = `${icon}<span>${this._t(key)}</span>`;
    return cls;
  }

  _renderTemp(current) {
    const el = this.querySelector(".sh-temp");
    if (current == null) {
      el.innerHTML = `--<small>°</small>`;
      return;
    }
    const [i, f] = Number(current).toFixed(1).split(".");
    const sep = this._lang === "sk" ? "," : ".";
    el.innerHTML = `${i.replace("-", "−")}<small>${sep}${f}°</small>`;
  }

  _renderRow2(current, target, zAttrs, mode) {
    const lang = this._lang;
    const d = zoneDelta(current, target);
    const dc = deltaClass(d);
    const deltaEl = this.querySelector(".sh-delta");
    deltaEl.className = `sh-delta ${dc}`;
    deltaEl.textContent = d == null || mode === "Vypnute" ? ""
      : dc === "ok" ? this._t("delta_ok")
      : `${fmtSigned(d, lang)}° ${this._t(d > 0 ? "delta_above" : "delta_below")}`;

    const floor = num(zAttrs.floor_temperature);
    this.querySelector(".sh-chip-floor").innerHTML = floor == null ? ""
      : `${ICONS.floor}<span class="lbl">${this._t("floor")} </span><b>${fmtNum(floor, lang)}°</b>`;

    const tgt = this.querySelector(".sh-tgt");
    tgt.querySelector("b").textContent = target != null ? `${fmtShort(target, lang)}°` : "–";
    tgt.classList.toggle("pending", this._pendingTarget != null);
    const disabled = mode === "Vypnute" || target == null;
    tgt.querySelectorAll("button").forEach((b) => { b.disabled = disabled; });
  }

  _stepTarget(dir) {
    const climate = this._hass && this._hass.states[eid(this._zoneId, "climate")];
    if (!climate) return;
    const a = climate.attributes;
    const base = this._pendingTarget != null ? this._pendingTarget : num(a.temperature);
    if (base == null) return;
    const step = num(a.target_temp_step) || 0.5;
    let next = Math.round((base + dir * step) * 10) / 10;
    if (num(a.min_temp) != null) next = Math.max(num(a.min_temp), next);
    if (num(a.max_temp) != null) next = Math.min(num(a.max_temp), next);
    this._pendingTarget = next;
    clearTimeout(this._targetTimer);
    this._targetTimer = setTimeout(() => {
      this._targetTimer = null;
      const value = this._pendingTarget;
      Promise.resolve(
        this._hass.callService("climate", "set_temperature", { entity_id: eid(this._zoneId, "climate"), temperature: value })
      ).catch(() => { this._pendingTarget = null; this._updateContent(); });
      setTimeout(() => {
        if (this._pendingTarget === value && !this._targetTimer) {
          this._pendingTarget = null;
          this._updateContent();
        }
      }, 6000);
    }, 700);
    this._updateContent();
  }

  _renderModeSeg(mode) {
    const wrap = this.querySelector(".sh-seg");
    const list = QUICK_MODES.includes(mode) ? QUICK_MODES : [...QUICK_MODES, mode];
    const html = list.map((m) => {
      const active = m === mode;
      const special = active && !QUICK_MODES.includes(m);
      return `<button type="button" data-mode="${esc(m)}" class="${active ? "a" : ""}${special ? " special" : ""}" aria-pressed="${active}">${esc(this._modeLabel(m))}</button>`;
    }).join("");
    if (wrap.innerHTML === html) return;
    wrap.innerHTML = html;
    wrap.querySelectorAll("button").forEach((btn) => {
      btn.onclick = () => {
        if (btn.classList.contains("a")) return;
        wrap.querySelectorAll("button").forEach((b) => b.classList.remove("a"));
        btn.classList.add("a");
        this._hass.callService("select", "select_option", {
          entity_id: eid(this._zoneId, "select", "rezim"),
          option: btn.dataset.mode,
        });
      };
    });
  }

  /** Vlhkost v zone (len sledovanie): "💧 45 % · pocitovo 21,8° · rosný bod 11,1°".
   * Riadok sa ukaze, len ked ma zona nastaveny senzor vlhkosti (nemeni sa za behu). */
  _renderHumidity(zAttrs) {
    const el = this.querySelector(".sh-feel");
    if (!el) return;
    if (!zAttrs.humidity_entity) { el.hidden = true; return; }
    el.hidden = false;
    const lang = this._lang;
    const rh = num(zAttrs.humidity);
    const lvl = rh == null ? "" : rh < 35 ? "dry" : rh > 60 ? "wet" : "";
    el.className = `sh-feel ${lvl}`;
    const parts = [rh == null ? "<b>–</b>" : `<b>${Math.round(rh)} %</b>`];
    if (num(zAttrs.felt_temperature) != null) parts.push(`${esc(this._t("hum_felt"))} <b>${esc(fmtNum(zAttrs.felt_temperature, lang))}°</b>`);
    const alert = zAttrs.humidity_alert === "high" ? "hum_alert_high" : zAttrs.humidity_alert === "low" ? "hum_alert_low" : null;
    if (alert) {
      let txt = this._t(alert);
      if (zAttrs.humidity_alert === "high" && (zAttrs.ventilation === "helps" || zAttrs.ventilation === "worse")) {
        txt += `, ${this._t(zAttrs.ventilation === "helps" ? "vent_helps" : "vent_worse")}`;
      }
      parts.push(`<span class="${zAttrs.humidity_alert === "high" ? "wet" : "dry"}">${esc(txt)}</span>`);
    }
    // rosny bod az na konci - pri uzkej karte sa oreze ako prvy
    if (num(zAttrs.dew_point) != null) parts.push(`${esc(this._t("hum_dew"))} ${esc(fmtNum(zAttrs.dew_point, lang))}°`);
    const html = `${ICONS.drop}<span class="t">${parts.join(" · ")}</span>`;
    if (el.innerHTML !== html) el.innerHTML = html;
    el.title = el.textContent;
  }

  _renderBadges(zAttrs) {
    const badges = [];
    if (zAttrs.emergency_active) badges.push(["err", this._t("badge_emergency")]);
    if (zAttrs.tariff_blocked) badges.push(["warn", this._t("badge_tariff")]);
    if (zAttrs.floor_override) badges.push(["err", this._t("badge_floor")]);
    if (zAttrs.floor_sensor_lost) badges.push(["err", this._t("badge_floor_sensor")]);
    if (zAttrs.krb_override) badges.push(["warn", this._t("badge_krb")]);
    const reasonLc = String((this._hass.states[eid(this._zoneId, "sensor", "stav")] || {}).state || "").toLowerCase();
    // dovod akumulacie uz obsahuje ciel aj max - odznak by ho len opakoval
    if (zAttrs.pv_active && !(reasonLc.includes("akumul") || reasonLc.includes("storing heat"))) {
      badges.push(num(zAttrs.fve_akumulacia_ciel) != null && num(zAttrs.fve_akumulacia_max) != null
        ? ["ok", this._t("badge_pv_acc", { t: fmtShort(zAttrs.fve_akumulacia_ciel, this._lang), m: fmtShort(zAttrs.fve_akumulacia_max, this._lang) })]
        : ["ok", this._t("badge_pv")]);
    }
    if (zAttrs.cold_outdoor_active) badges.push(["info", this._t("badge_cold")]);
    if (zAttrs.boost_active) badges.push(["info", this._t("badge_boost")]);
    if (zAttrs.floor_guard) badges.push(["info", this._t("badge_floor_min")]);
    if (zAttrs.fve_caka) badges.push(["info", this._t("badge_pv_waiting")]);
    const problems = Array.isArray(zAttrs.problemy) ? zAttrs.problemy : [];
    const reason = String((this._hass.states[eid(this._zoneId, "sensor", "stav")] || {}).state || "").toLowerCase();
    this.querySelector(".sh-badges").innerHTML = badges
      .filter(([, label]) => !reason.includes(label.toLowerCase()))
      .map(([cls, label]) => `<span class="sh-badge ${cls}">${esc(label)}</span>`).join("");
    // poruchy na vlastnom riadku (riadok dovodu je orezany na 2 riadky)
    const prob = this.querySelector(".sh-prob");
    if (prob) prob.innerHTML = problems.map((p) => `<div>${esc(this._t("badge_problem"))}: ${esc(p)}</div>`).join("");
  }

  _renderSummaries(attrs, zAttrs, hasAc) {
    const set = (cls, text) => {
      const el = this.querySelector(`${cls} .sh-sum-val`);
      if (el) el.textContent = text;
    };
    set(".sh-section--mode:not(.sh-season-section)", this._modeLabel(attrs.rezim || "Auto"));
    if (hasAc) set(".sh-season-section", this._seasonLabel(zAttrs.sezona || zAttrs.season || "Auto"));
    const durState = this._hass.states[eid(this._zoneId, "number", "boost_hodiny")];
    set(".sh-section--boost", zAttrs.boost_active
      ? this._t("boost_running")
      : (durState ? `${fmtNum(parseFloat(durState.state), this._lang)} h` : ""));
  }

  _renderSettings() {
    const hass = this._hass;
    const climate = hass.states[eid(this._zoneId, "climate")];
    const stavSensor = hass.states[eid(this._zoneId, "sensor", "stav")];
    if (!climate || !stavSensor) return;
    const attrs = climate.attributes;
    const zAttrs = stavSensor.attributes;
    const hasAc = !!hass.states[eid(this._zoneId, "select", "sezona")];

    this._renderModeChips(attrs.rezim || "Auto");
    if (hasAc) {
      const seasonState = hass.states[eid(this._zoneId, "select", "sezona")];
      this._renderSeasonChips((seasonState && seasonState.state) || zAttrs.sezona || "Auto");
      this._renderCooling();
    }
    this._renderTemps();
    this._renderFloor();
    this._renderTimes();
    this._renderToggles();
    this._renderBoost(zAttrs);
  }

  // ------------------------------------------------------------------ graf 24 h

  _statId() {
    return eid(this._zoneId, "sensor", "teplota");
  }

  _maybeFetchStats() {
    const hass = this._hass;
    if (!hass || typeof hass.callWS !== "function" || this._statsLoading) return;
    if (!hass.states[this._statId()]) return;
    if (Date.now() - this._statsFetchedAt < STATS_REFRESH_MS) return;
    this._statsLoading = true;
    const now = Date.now();
    const statId = this._statId();
    hass
      .callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(now - DAY_MS).toISOString(),
        end_time: new Date(now).toISOString(),
        statistic_ids: [statId],
        period: "5minute",
        types: ["mean", "min", "max"],
      })
      .then((res) => {
        const rows = (res && res[statId]) || [];
        const points = [];
        let mn = null;
        let mx = null;
        let sum = 0;
        let cnt = 0;
        for (const r of rows) {
          const t = tsOf(r.start);
          const mean = num(r.mean);
          if (mean != null && !isNaN(t)) {
            points.push([t, mean]);
            sum += mean;
            cnt += 1;
          }
          const lo = num(r.min);
          const hi = num(r.max);
          if (lo != null) mn = mn == null ? lo : Math.min(mn, lo);
          if (hi != null) mx = mx == null ? hi : Math.max(mx, hi);
        }
        this._stats = { points: smooth(downsample(points, 48)), avg: cnt ? sum / cnt : null, min: mn, max: mx, at: now };
        this._statsFetchedAt = Date.now();
        this._renderChart();
      })
      .catch(() => { this._statsFetchedAt = Date.now(); })
      .finally(() => { this._statsLoading = false; });
  }

  _renderChart() {
    const mid = this.querySelector(".sh-mid");
    if (!mid) return;
    const hasSensor = !!(this._hass && this._hass.states[this._statId()]);
    mid.classList.toggle("no-chart", !hasSensor);
    if (!hasSensor) return;

    const lang = this._lang;
    const climate = this._hass.states[eid(this._zoneId, "climate")];
    const current = num(climate && climate.attributes.current_temperature);
    const target = this._pendingTarget != null ? this._pendingTarget : num(climate && climate.attributes.temperature);
    const st = this._stats || {};

    const lg = this.querySelector(".sh-lg-v");
    lg.textContent = st.avg != null
      ? `min ${fmtNum(st.min, lang)}° · Ø ${fmtNum(st.avg, lang)}° · max ${fmtNum(st.max, lang)}°`
      : "";

    // Kym sa statistiky nenazbieraju za cely den (napr. hned po instalacii),
    // graf sa roztiahne na dostupny usek a popis ukaze jeho skutocnu dlzku.
    const now = Date.now();
    const pts = (st.points || []).filter(([t]) => t >= now - DAY_MS);
    let t0 = now - DAY_MS;
    if (pts.length >= 2 && pts[0][0] > t0 + 3600 * 1000) t0 = pts[0][0];
    const hours = Math.max(1, Math.round((now - t0) / 3600000));
    this.querySelector(".sh-lg-span").textContent = hours >= 23 ? this._t("h24") : `${hours} h`;
    if (current != null) pts.push([now, current]);
    this.querySelector(".sh-spark").innerHTML = sparkSvg(pts, target, t0, now);
  }

  // ------------------------------------------------------------------ nastavenia

  _renderModeChips(current) {
    const wrap = this.querySelector(".sh-mode-chips");
    wrap.innerHTML = MODES.map(
      (m) => `<button class="sh-chip ${m === current ? "active" : ""}" data-mode="${m}">${this._modeLabel(m)}</button>`
    ).join("");
    wrap.querySelectorAll(".sh-chip").forEach((btn) => {
      btn.onclick = () => {
        this._hass.callService("select", "select_option", {
          entity_id: eid(this._zoneId, "select", "rezim"),
          option: btn.dataset.mode,
        });
      };
    });
  }

  _renderSeasonChips(current) {
    const wrap = this.querySelector(".sh-season-chips");
    wrap.innerHTML = SEASONS.map(
      (s) => `<button class="sh-chip ${s === current ? "active" : ""}" data-season="${s}">${this._seasonLabel(s)}</button>`
    ).join("");
    wrap.querySelectorAll(".sh-chip").forEach((btn) => {
      btn.onclick = () => {
        this._hass.callService("select", "select_option", {
          entity_id: eid(this._zoneId, "select", "sezona"),
          option: btn.dataset.season,
        });
      };
    });
  }

  _numberRow(label, key, step, unit) {
    const state = this._hass.states[eid(this._zoneId, "number", key)];
    const val = state ? parseFloat(state.state) : NaN;
    return `
      <div class="sh-row" data-number-row="${key}">
        <div class="sh-row-label">${label}</div>
        <div class="sh-stepper">
          <button data-act="dec" data-key="${key}" data-step="${step}">-</button>
          <span class="sh-val">${isNaN(val) ? "--" : fmtNum(val, this._lang) + (unit || "")}</span>
          <button data-act="inc" data-key="${key}" data-step="${step}">+</button>
        </div>
      </div>`;
  }

  _wireNumberRows(wrap) {
    wrap.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        const state = this._hass.states[eid(this._zoneId, "number", key)];
        if (!state) return;
        const step = num(state.attributes.step) || parseFloat(btn.dataset.step);
        const current = parseFloat(state.state);
        const delta = btn.dataset.act === "inc" ? step : -step;
        let next = Math.round((current + delta) * 10) / 10;
        if (state.attributes.min != null) next = Math.max(state.attributes.min, next);
        if (state.attributes.max != null) next = Math.min(state.attributes.max, next);
        this._hass.callService("number", "set_value", { entity_id: eid(this._zoneId, "number", key), value: next });
      };
    });
  }

  _renderTemps() {
    const wrap = this.querySelector(".sh-temps");
    const hasAc = !!this._hass.states[eid(this._zoneId, "select", "sezona")];
    wrap.innerHTML =
      this._numberRow(this._t("temp_day"), "teplota_den", 0.5, "°C") +
      this._numberRow(this._t("temp_night"), "teplota_noc", 0.5, "°C") +
      this._numberRow(this._t("temp_min"), "teplota_min", 0.5, "°C") +
      this._numberRow(this._t("temp_frost"), "teplota_mraz", 0.5, "°C") +
      this._numberRow(this._t("temp_outdoor_threshold"), "vonkajsia_hranica", 0.5, "°C") +
      (hasAc
        ? this._numberRow(this._t("temp_ac_priority_diff"), "ac_priorita_rozdiel", 0.5, "°C") +
          this._numberRow(this._t("temp_ac_priority_minutes"), "ac_priorita_minuty", 0.5, " min") +
          this._numberRow(this._t("temp_ac_setpoint"), "ac_setpoint_teplota", 0.5, "°C") +
          this._numberRow(this._t("temp_ac_hysteresis"), "ac_hysterezia", 0.5, "°C")
        : "");
    this._wireNumberRows(wrap);
  }

  _renderFloor() {
    const wrap = this.querySelector(".sh-floor");
    if (!wrap) return;
    const has = (key) => !!this._hass.states[eid(this._zoneId, "number", key)];
    const row = (label, key) => (has(key) ? this._numberRow(this._t(label), key, 0.5, "°C") : "");
    wrap.innerHTML =
      row("temp_floor_min", "floor_min") +
      row("temp_floor_max", "floor_max") +
      row("temp_floor_hyst", "floor_hysterezia") +
      (has("radiator_hysterezia") ? this._numberRow(this._t("temp_radiator_hyst"), "radiator_hysterezia", 0.1, "°C") : "");
    this._wireNumberRows(wrap);
  }

  _renderCooling() {
    const wrap = this.querySelector(".sh-cooling");
    wrap.innerHTML =
      this._numberRow(this._t("cool_target"), "teplota_chladenie", 0.5, "°C") +
      this._numberRow(this._t("cool_battery"), "bateria_hranica_chladenie", 0.5, "%") +
      this._numberRow(this._t("cool_outdoor_threshold"), "vonkajsia_hranica_chladenie", 0.5, "°C");
    this._wireNumberRows(wrap);
  }

  _timeVal(key) {
    const state = this._hass.states[eid(this._zoneId, "time", key)];
    return state ? state.state.slice(0, 5) : "";
  }

  _renderTimes() {
    const wrap = this.querySelector(".sh-times");
    if (wrap.contains(document.activeElement)) return;
    const input = (key) =>
      `<input class="sh-time-input" type="time" value="${this._timeVal(key)}" data-time-key="${key}" />`;
    wrap.innerHTML = `
      <table class="sh-times-table">
        <tr><th></th><th>${this._t("times_workday")}</th><th>${this._t("times_weekend")}</th></tr>
        <tr><td>${this._t("times_day_start")}</td><td>${input("den_od_tyzden")}</td><td>${input("den_od_vikend")}</td></tr>
        <tr><td>${this._t("times_night_start")}</td><td>${input("noc_od_tyzden")}</td><td>${input("noc_od_vikend")}</td></tr>
      </table>
      <table class="sh-times-table sh-times-table--predkurenie">
        <tr><th colspan="2">${this._t("times_preheat")}</th></tr>
        <tr><td>${this._t("times_start")}</td><td>${input("predkurenie_od")}</td></tr>
        <tr><td>${this._t("times_end")}</td><td>${input("predkurenie_do")}</td></tr>
      </table>
    `;
    wrap.querySelectorAll("input[data-time-key]").forEach((el) => {
      el.onchange = () => {
        if (!el.value) return;
        this._hass.callService("time", "set_value", {
          entity_id: eid(this._zoneId, "time", el.dataset.timeKey),
          time: el.value.length === 5 ? el.value + ":00" : el.value,
        });
      };
    });
  }

  _switchRow(label, key) {
    const state = this._hass.states[eid(this._zoneId, "switch", key)];
    const on = !!state && state.state === "on";
    return `
      <div class="sh-row">
        <div class="sh-row-label">${label}</div>
        <div class="sh-switch ${on ? "on" : ""}" data-switch-key="${key}" role="switch" aria-checked="${on}" tabindex="0"><div class="knob"></div></div>
      </div>`;
  }

  _renderToggles() {
    const wrap = this.querySelector(".sh-toggles");
    const hasAc = !!this._hass.states[eid(this._zoneId, "select", "sezona")];
    wrap.innerHTML =
      this._switchRow(this._t("toggle_preheat"), "predkurenie_povolene") +
      this._switchRow(this._t("toggle_krb"), "reaguj_na_krb") +
      this._switchRow(this._t("toggle_pv"), "vyuzi_fve_prebytok") +
      this._pvPriorityRow() +
      this._pvAccRows() +
      (this._hass.states[eid(this._zoneId, "switch", "udrzat_min_podlahy")]
        ? this._switchRow(this._t("toggle_floor_min"), "udrzat_min_podlahy") : "") +
      (hasAc ? this._switchRow(this._t("toggle_fixed_ac_setpoint"), "pouzit_pevny_ac_setpoint") : "");
    this._wireNumberRows(wrap);
    wrap.querySelectorAll(".sh-switch").forEach((el) => {
      const toggle = () => {
        const isOn = el.classList.contains("on");
        this._hass.callService("switch", isOn ? "turn_off" : "turn_on", {
          entity_id: eid(this._zoneId, "switch", el.dataset.switchKey),
        });
      };
      el.onclick = toggle;
      el.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } };
    });
    wrap.querySelectorAll("[data-pv-prio]").forEach((el) => {
      el.onclick = () => this._hass.callService("select", "select_option", {
        entity_id: eid(this._zoneId, "select", "fve_priorita"), option: el.dataset.pvPrio,
      });
    });
  }

  /** Akumulacia z prebytku FVE: prepinac + max. teplota (len ked zona FVE vyuziva). */
  _pvAccRows() {
    const sw = this._hass.states[eid(this._zoneId, "switch", "vyuzi_fve_prebytok")];
    const acc = this._hass.states[eid(this._zoneId, "switch", "fve_akumulacia")];
    if (!acc || (sw && sw.state !== "on")) return "";
    const on = acc.state === "on";
    return `<div class="sh-row"><div class="sh-row-label">${esc(this._t("toggle_pv_acc"))}
        <div class="sh-row-hint">${esc(this._t("pv_acc_hint"))}</div></div>
        <div class="sh-switch ${on ? "on" : ""}" data-switch-key="fve_akumulacia" role="switch" aria-checked="${on}" tabindex="0"><div class="knob"></div></div></div>` +
      (on && this._hass.states[eid(this._zoneId, "number", "fve_max_teplota")]
        ? this._numberRow(this._t("temp_pv_max"), "fve_max_teplota", 0.5, "°C") : "");
  }

  _pvPriorityRow() {
    const sel = this._hass.states[eid(this._zoneId, "select", "fve_priorita")];
    const sw = this._hass.states[eid(this._zoneId, "switch", "vyuzi_fve_prebytok")];
    if (!sel || (sw && sw.state !== "on")) return "";   // len ked zona FVE vyuziva
    const opts = (sel.attributes && sel.attributes.options) || ["1", "2", "3"];
    return `<div class="sh-row sh-pv-prio"><div class="sh-row-label">${esc(this._t("pv_priority"))}
        <div class="sh-row-hint">${esc(this._t("pv_priority_hint"))}</div></div>
      <div class="sh-chips">${opts.map((o) =>
        `<button type="button" class="sh-chip ${sel.state === o ? "active" : ""}" data-pv-prio="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
  }

  _renderBoost(zAttrs) {
    const durState = this._hass.states[eid(this._zoneId, "number", "boost_hodiny")];
    const dur = durState ? parseFloat(durState.state) : 2;
    const active = !!zAttrs.boost_active;
    const wrap = this.querySelector(".sh-boost");
    wrap.innerHTML = `
      <div class="sh-stepper">
        <button data-boost-act="dec">-</button>
        <span class="sh-val">${fmtNum(dur, this._lang)} h</span>
        <button data-boost-act="inc">+</button>
      </div>
      <div class="sh-boost-status">${active ? this._t("boost_running") : ""}</div>
      <button class="sh-boost-btn" ${active ? "disabled" : ""}>${this._t("boost_start")}</button>
    `;
    const setDur = (v) =>
      this._hass.callService("number", "set_value", { entity_id: eid(this._zoneId, "number", "boost_hodiny"), value: v });
    wrap.querySelector('[data-boost-act="dec"]').onclick = () => setDur(Math.max(0.5, Math.round((dur - 0.5) * 10) / 10));
    wrap.querySelector('[data-boost-act="inc"]').onclick = () => setDur(Math.round((dur + 0.5) * 10) / 10);
    wrap.querySelector(".sh-boost-btn").onclick = () =>
      this._hass.callService("button", "press", { entity_id: eid(this._zoneId, "button", "boost") });
  }
}

/** Zhrnie body do max. 'max' skupin (priemer casu aj hodnoty). */
function downsample(points, max) {
  if (points.length <= max) return points;
  const size = points.length / max;
  const out = [];
  for (let i = 0; i < max; i++) {
    const chunk = points.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    if (!chunk.length) continue;
    out.push([
      chunk.reduce((a, p) => a + p[0], 0) / chunk.length,
      chunk.reduce((a, p) => a + p[1], 0) / chunk.length,
    ]);
  }
  return out;
}

/** Kĺzavý priemer cez 3 body - zjemni schodiky zo senzorov s krokom 0,5 °C. */
function smooth(points) {
  if (points.length < 3) return points;
  return points.map(([t, v], i) => {
    if (i === 0 || i === points.length - 1) return [t, v];
    return [t, (points[i - 1][1] + v + points[i + 1][1]) / 3];
  });
}

function sparkSvg(points, target, t0, t1) {
  const W = 260;
  const H = 46;
  const values = points.map((p) => p[1]);
  if (target != null) values.push(target);
  if (!values.length) return "";
  let lo = Math.min(...values) - 0.3;
  let hi = Math.max(...values) + 0.3;
  if (hi - lo < 2) {
    const c = (hi + lo) / 2;
    lo = c - 1;
    hi = c + 1;
  }
  const x = (t) => ((t - t0) / (t1 - t0)) * W;
  const y = (v) => H - 3 - ((v - lo) / (hi - lo)) * (H - 6);
  let out = "";
  if (target != null) {
    const ty = y(target).toFixed(1);
    out += `<line x1="0" x2="${W}" y1="${ty}" y2="${ty}" stroke="var(--sh-ok)" stroke-width="1.2" stroke-dasharray="3 4" opacity=".8" vector-effect="non-scaling-stroke"/>`;
  }
  if (points.length >= 2) {
    const d = points.map(([t, v], k) => `${k ? "L" : "M"}${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const first = x(points[0][0]).toFixed(1);
    const last = x(points[points.length - 1][0]).toFixed(1);
    out += `<path d="${d} L${last} ${H} L${first} ${H} Z" fill="currentColor" opacity=".10"/>`;
    out += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  if (points.length) {
    const [lt, lv] = points[points.length - 1];
    const cx = x(lt).toFixed(1);
    const cy = y(lv).toFixed(1);
    out += `<path d="M${cx} ${cy} L${cx} ${cy}" stroke="var(--sh-txt)" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  return out;
}

// ============================================================== PREHLAD DOMU

const DEFAULT_TILES = ["heating", "presence", "guests", "pv", "tariff", "krb"];
const TOGGLE_DOMAINS = ["input_boolean", "switch", "light", "fan"];
const ON_STATES = new Set(["on", "home", "true", "open", "heat", "heating", "active", "detected"]);

class SmartHeatingOverview extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._outdoorHist = null;
    this._outdoorFetchedAt = 0;
    this._runtime = null;
    this._runtimeFetchedAt = 0;
    this._loading = false;
  }

  setConfig(config) {
    if (config.tiles != null && !Array.isArray(config.tiles)) {
      throw new Error("smart-heating-overview: 'tiles' must be a list");
    }
    if (config.zones != null && !Array.isArray(config.zones)) {
      throw new Error("smart-heating-overview: 'zones' must be a list of zone_id");
    }
    this._config = config || {};
    this._outdoorFetchedAt = 0;
    this._runtimeFetchedAt = 0;
    if (this._hass) this._render();
  }

  get _lang() {
    return resolveLang(this._hass, this._config.language);
  }

  _t(key, vars) {
    return translate(this._lang, key, vars);
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (prev && prev.language === hass.language) {
      const changed = this._watched().some((id) => hass.states[id] !== prev.states[id]);
      if (!changed) {
        // prikon sa meni casto - prekresli len suhrn
        if (this._allCons("power_entities").some((id) => hass.states[id] !== prev.states[id]) && this.querySelector(".sho-sum")) {
          this._renderSummary(this._zoneData());
        }
        // vonkajsia vlhkost / tlak - prekresli len blok Vonku
        const outIds = [...this._zoneEntities("outdoor_humidity_entity"), ...this._zoneEntities("outdoor_pressure_entity")];
        if (outIds.some((id) => hass.states[id] !== prev.states[id]) && this.querySelector(".sho-out")) {
          this._renderOutdoor(this._zoneData());
        }
        this._maybeFetchEnergyAll();
        return;
      }
    }
    this._render();
    this._maybeFetchEnergyAll();
  }

  _allCons(key) {
    const out = [];
    for (const z of this._zones()) {
      const st = this._hass.states[eid(z, "sensor", "stav")];
      const ids = st && st.attributes ? st.attributes[key] : null;
      if (Array.isArray(ids)) out.push(...ids);
    }
    return out;
  }

  _maybeFetchEnergyAll() {
    const ids = this._allCons("energy_entities");
    const hass = this._hass;
    if (!ids.length || !hass || typeof hass.callWS !== "function" || this._energyLoading) return;
    const day = new Date().toDateString();
    if (this._energyDay === day && Date.now() - (this._energyAt || 0) < ENERGY_REFRESH_MS) return;
    this._energyLoading = true;
    fetchEnergyToday(hass, ids)
      .then((v) => {
        this._energyToday = v; this._energyDay = day; this._energyAt = Date.now();
        if (this.querySelector(".sho-sum")) this._renderSummary(this._zoneData());
      })
      .catch(() => { this._energyAt = Date.now(); this._energyDay = day; })
      .finally(() => { this._energyLoading = false; });
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: "full", min_columns: 6 };
  }

  static getStubConfig() {
    return { type: "custom:smart-heating-overview" };
  }

  _zones() {
    const all = findZones(this._hass).map((z) => z.zone_id);
    return Array.isArray(this._config.zones) && this._config.zones.length
      ? this._config.zones.filter((z) => all.includes(String(z))).map(String)
      : all;
  }

  /** Entity z konfiguracie integracie (atributy senzora stav), zjednotene cez zony. */
  _zoneEntities(attr) {
    const out = [];
    for (const z of this._zones()) {
      const s = this._hass.states[eid(z, "sensor", "stav")];
      const v = s && s.attributes[attr];
      for (const e of Array.isArray(v) ? v : v ? [v] : []) if (!out.includes(e)) out.push(e);
    }
    return out;
  }

  _outdoorEntity() {
    return this._config.outdoor_entity || this._zoneEntities("outdoor_entity")[0] || null;
  }

  _watched() {
    const ids = [];
    for (const z of this._zones()) ids.push(eid(z, "climate"), eid(z, "sensor", "stav"));
    const outdoor = this._outdoorEntity();
    if (outdoor) ids.push(outdoor);
    ids.push("sensor.smart_heating_fve_kaskada");
    ids.push(
      ...this._zoneEntities("presence_entities"),
      ...this._zoneEntities("manual_presence_entities"),
      ...this._zoneEntities("tariff_entity"),
      ...this._zoneEntities("pv_surplus_entity"),
    );
    for (const tile of this._config.tiles || []) {
      if (tile && typeof tile === "object") {
        if (tile.entity) ids.push(tile.entity);
        for (const e of tile.entities || []) ids.push(e);
      }
    }
    return ids;
  }

  _zoneData() {
    const out = [];
    for (const z of this._zones()) {
      const c = this._hass.states[eid(z, "climate")];
      const s = this._hass.states[eid(z, "sensor", "stav")];
      if (!c || !s) continue;
      out.push({ id: z, name: c.attributes.friendly_name || z, c: c.attributes, s: s.attributes });
    }
    return out;
  }

  _styles() {
    return `
      smart-heating-overview { display: block; }
      smart-heating-overview > ha-card { background: none; border: none; box-shadow: none; overflow: visible; container-type: inline-size; }
      .sho-root { ${SHARED_TOKENS}
        color: var(--sh-txt);
        display: grid; grid-template-columns: minmax(180px, auto) 1fr minmax(200px, auto); gap: 14px; align-items: stretch; }
      .sho-blk { background: var(--ha-card-background, var(--card-background-color, #1c1d20));
        border-radius: var(--ha-card-border-radius, 12px);
        border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, transparent));
        box-shadow: var(--ha-card-box-shadow, none); padding: 14px 18px; min-width: 0; }
      .sho-out { display: flex; flex-direction: column; justify-content: center; cursor: pointer; }
      .sho-out .v { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.05; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .sho-out .l { font-size: 12.5px; color: var(--sh-sub); margin-top: 2px; }
      .sho-out .tr { font-size: 12.5px; color: var(--sh-sub); margin-top: 8px; font-variant-numeric: tabular-nums; }
      .sho-out .tr:empty, .sho-out .hp:empty { display: none; }
      .sho-out .hp { font-size: 12.5px; color: var(--sh-sub); margin-top: 4px; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .sho-blk .i svg, .sho-tile .i svg { width: 20px; height: 20px; display: block; }
      .sho-gear { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 4px 0; border: 0; background: none;
        color: var(--sh-sub); font: inherit; font-size: 12.5px; cursor: pointer; }
      .sho-gear svg { width: 15px; height: 15px; }
      .sho-gear:hover { color: var(--sh-txt); }
      .sho-set { grid-column: 1 / -1; }
      .sho-statsbtn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; min-height: 40px;
        border-radius: 10px; border: 1px solid var(--divider-color, #333); background: none; color: var(--sh-txt); font: inherit; font-size: 13.5px;
        font-weight: 600; cursor: pointer; width: 100%; }
      .sho-statsbtn svg { width: 17px; height: 17px; }
      .sho-statsbtn[aria-expanded="true"] { background: rgba(124,108,240,.22); border-color: var(--primary-color, #7c6cf0); }
      .sho-stats { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 18px; }
      .sho-stats[hidden] { display: none; }
      .sho-st-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .sho-st-h h2 { margin: 0; font-size: 18px; font-weight: 650; display: flex; align-items: center; gap: 8px; }
      .sho-st-h h2 svg { width: 20px; height: 20px; color: var(--sh-sub); }
      .sho-pers { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgba(127,127,127,.12); }
      .sho-per { min-height: 34px; padding: 0 14px; border: 0; border-radius: 8px; background: none; color: var(--sh-sub); font: inherit; font-size: 13.5px; cursor: pointer; }
      .sho-per.on { background: var(--primary-color, #7c6cf0); color: var(--text-primary-color, #fff); font-weight: 600; }
      .sho-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
      .sho-kpi { background: rgba(127,127,127,.08); border-radius: 12px; padding: 14px 16px; }
      .sho-kpi .l { font-size: 12.5px; color: var(--sh-sub); }
      .sho-kpi .v { font-size: 26px; font-weight: 650; margin-top: 2px; font-variant-numeric: tabular-nums; }
      .sho-kpi .v span { font-size: 14px; font-weight: 500; color: var(--sh-sub); }
      .sho-kpi .v.fve { color: #f2b84b; }
      .sho-kpi .s { font-size: 12.5px; color: var(--sh-sub); margin-top: 2px; }
      .sho-kpi .good { color: var(--sh-ok, #4caf7d); } .sho-kpi .bad { color: var(--sh-warn, #e8a838); }
      .sho-leg { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--sh-sub); margin-bottom: 8px; }
      .sho-leg b { color: var(--sh-txt); font-size: 13px; }
      .sho-leg span { display: inline-flex; align-items: center; gap: 6px; }
      .sho-leg i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
      .sho-leg i.fve, .sho-chart .fve { background: #f2b84b; fill: #f2b84b; }
      .sho-leg i.bateria, .sho-chart .bateria { background: #3fb68b; fill: #3fb68b; }
      .sho-leg i.siet, .sho-chart .siet { background: #6b6f7a; fill: #6b6f7a; }
      .sho-leg i.unknown { background: transparent; border: 1px dashed rgba(127,127,127,.8); box-sizing: border-box; }
      .sho-chart .unknown { fill: rgba(127,127,127,.12); stroke: rgba(127,127,127,.75); stroke-width: 1; stroke-dasharray: 3 3; }
      .sho-chart { width: 100%; height: 220px; display: block; overflow: visible; }
      .sho-chart .ax { stroke: var(--divider-color, #3a3a3f); }
      .sho-chart .gr { stroke: var(--divider-color, #3a3a3f); stroke-dasharray: 3 4; opacity: .7; }
      .sho-chart .yl { fill: var(--sh-sub); font-size: 10.5px; text-anchor: end; font-variant-numeric: tabular-nums; }
      .sho-chart .lb { fill: var(--sh-sub); font-size: 11px; text-anchor: middle; }
      .sho-chart .vl { fill: var(--sh-txt); font-size: 11px; font-weight: 600; text-anchor: middle; font-variant-numeric: tabular-nums; }
      .sho-chart .hit { fill: transparent; cursor: pointer; }
      .sho-chart .hit:hover, .sho-chart .hit.on { fill: rgba(127,127,127,.10); }
      .sho-st-sel { font-size: 12.5px; color: var(--sh-sub); min-height: 1.5em; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sho-st-sel b { color: var(--sh-txt); font-weight: 600; }
      .sho-kpi .v.bat { color: #3fb68b; }
      .sho-hum-h { margin-top: 14px; }
      .sho-hum { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; color: var(--sh-sub); }
      .sho-hum b { color: var(--sh-txt); font-weight: 600; font-variant-numeric: tabular-nums; }
      .sho-st-low { display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px; }
      @container (max-width: 700px) { .sho-st-low { grid-template-columns: 1fr; } }
      .sho-rk { display: grid; grid-template-columns: 96px 1fr 76px; align-items: center; gap: 12px; font-size: 13.5px; padding: 5px 0; }
      .sho-rk .bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: rgba(127,127,127,.12); }
      .sho-rk b { text-align: right; font-variant-numeric: tabular-nums; }
      .seg.floor { background: #f0883e; } .seg.ac { background: #4fa3ff; } .seg.radiator { background: #2fa98a; } .seg.other { background: #9a9aa2; }
      .sho-mt { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; padding: 9px 12px; border-radius: 10px; }
      .sho-mt svg { width: 18px; height: 18px; flex-shrink: 0; }
      .sho-mt.warn { background: rgba(242,184,75,.12); color: var(--sh-txt); } .sho-mt.warn svg { color: #f2b84b; }
      .sho-mt.ok { color: var(--sh-sub); } .sho-mt.ok svg { color: var(--sh-ok, #4caf7d); }
      .sho-note { font-size: 11.5px; color: var(--sh-sub); margin-top: 12px; }
      .sho-set[hidden] { display: none; }
      .sho-set-h { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 12px; }
      .sho-set-h svg { width: 18px; height: 18px; color: var(--sh-sub); }
      .sho-grps { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 28px; }
      .sho-grp .h { font-size: 12px; color: var(--sh-sub); margin: 4px 0 6px; }
      .sho-f { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 13.5px; }
      .sho-sw { position: relative; width: 36px; height: 20px; border-radius: 999px; border: 0; padding: 0; cursor: pointer;
        background: var(--divider-color, #444); flex-shrink: 0; }
      .sho-sw i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .15s; }
      .sho-sw.on { background: var(--sh-ok, #4caf7d); }
      .sho-sw.on i { left: 18px; }
      .sho-num { display: inline-flex; align-items: center; gap: 8px; font-variant-numeric: tabular-nums; flex-shrink: 0; }
      .sho-num b { white-space: nowrap; min-width: 52px; text-align: center; }
      .sho-num button { width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--divider-color, #444); background: none; color: var(--sh-txt); cursor: pointer; font: inherit; }
      .sho-set-f { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--divider-color, #333); }
      .sho-set-f .sp { flex: 1; }
      .sho-all { display: inline-flex; align-items: center; gap: 6px; color: var(--sh-sub); font-size: 12.5px; text-decoration: none; }
      .sho-all svg { width: 14px; height: 14px; }
      .sho-btn { font: inherit; font-size: 13px; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--divider-color, #444);
        background: none; color: var(--sh-txt); cursor: pointer; }
      .sho-btn.pri { background: var(--primary-color, #03a9f4); border-color: transparent; color: var(--text-primary-color, #fff); }
      .sho-btn:disabled { opacity: .45; cursor: default; }
      .sho-tiles { display: grid; grid-template-columns: repeat(var(--sho-cols, 3), minmax(0, 1fr)); gap: 10px; padding: 12px; }
      .sho-tile { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; background: var(--sh-fill); min-width: 0; }
      .sho-tile.click { cursor: pointer; }
      .sho-tile.click:hover { filter: brightness(1.15); }
      .sho-tile.click:active { transform: scale(0.98); }
      .sho-tile.click:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .sho-tile.busy { opacity: .6; }
      .sho-tile .i { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; flex-shrink: 0;
        background: var(--sh-fill); color: var(--sh-sub); --mdc-icon-size: 18px; }
      .sho-tile .tx { min-width: 0; }
      .sho-tile .k { font-size: 11.5px; color: var(--sh-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sho-tile .s { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sho-tile.on { background: rgba(76,175,125,0.12); box-shadow: inset 0 0 0 1px rgba(76,175,125,0.45); }
      .sho-tile.on .i { background: rgba(76,175,125,0.25); color: var(--sh-ok); }
      .sho-tile.hot { background: rgba(255,138,61,0.10); box-shadow: inset 0 0 0 1px rgba(255,138,61,0.4); }
      .sho-tile.hot .i { background: rgba(255,138,61,0.22); color: var(--sh-heat); }
      .sho-tile.cold { background: rgba(79,163,255,0.10); box-shadow: inset 0 0 0 1px rgba(79,163,255,0.4); }
      .sho-tile.cold .i { background: rgba(79,163,255,0.22); color: var(--sh-cool); }
      .sho-tile.warn { background: rgba(232,168,56,0.10); box-shadow: inset 0 0 0 1px rgba(232,168,56,0.45); }
      .sho-tile.warn .i { background: rgba(232,168,56,0.22); color: var(--sh-warn); }
      .sho-tile.err { background: rgba(229,72,77,0.10); box-shadow: inset 0 0 0 1px rgba(229,72,77,0.5); }
      .sho-tile.err .i { background: rgba(229,72,77,0.22); color: var(--sh-err); }
      .sho-sum { display: flex; flex-direction: column; justify-content: center; gap: 6px; }
      .sho-sum .r { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; color: var(--sh-sub); }
      .sho-sum .r > span { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sho-sum .r b { color: var(--sh-txt); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .sho-sum .r .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; vertical-align: 1px; }
      .sho-msg { padding: 16px; color: var(--sh-sub); }
      @container (max-width: 760px) {
        .sho-root { grid-template-columns: 1fr 1fr; }
        .sho-tiles { grid-column: 1 / -1; order: 3; }
      }
      @container (max-width: 560px) {
        .sho-tiles { grid-template-columns: 1fr 1fr; }
      }
      @container (max-width: 420px) {
        .sho-tiles { padding: 10px; gap: 8px; }
        .sho-tile { padding: 7px 9px; gap: 8px; }
      }
    `;
  }

  _render() {
    if (!this._hass) return;
    if (!this.querySelector(".sho-root")) {
      this.innerHTML = `<ha-card><style>${this._styles()}</style><div class="sho-root">
        <div class="sho-blk sho-out"><div class="v"></div><div class="l">${this._t("ov_outside")}</div><div class="tr"></div><div class="hp"></div></div>
        <div class="sho-blk sho-tiles"></div>
        <div class="sho-blk sho-sum"></div>
        <div class="sho-blk sho-set" hidden></div>
        <div class="sho-blk sho-stats" hidden></div>
      </div></ha-card>`;
      this.querySelector(".sho-sum").addEventListener("click", (e) => {
        if (e.target.closest(".sho-gear")) { if (this._statsOpen) this._toggleStats(); this._toggleSettings(); }
        if (e.target.closest(".sho-statsbtn")) this._toggleStats();
      });
      this.querySelector(".sho-set").addEventListener("click", (e) => this._onSettingsClick(e));
      this.querySelector(".sho-stats").addEventListener("click", (e) => {
        const b = e.target.closest("[data-days]");
        if (b) this._loadStats(Number(b.dataset.days));
        const bar = e.target.closest("[data-bi]");
        if (bar && this._stats) {
          const i = Number(bar.getAttribute("data-bi"));
          this._statSel = this._statSel === i ? null : i;
          const sel = this.querySelector(".sho-st-sel");
          if (sel) sel.innerHTML = this._statSelText();
          this.querySelectorAll(".sho-chart .hit").forEach((h) => h.classList.toggle("on", Number(h.getAttribute("data-bi")) === this._statSel));
        }
      });
      this.querySelector(".sho-out").addEventListener("click", () => {
        const outdoor = this._outdoorEntity();
        if (outdoor) fireMoreInfo(this, outdoor);
      });
      const tiles = this.querySelector(".sho-tiles");
      const activate = (tile) => {
        const entityId = tile.dataset.entity;
        if (tile.dataset.tap !== "toggle") {
          fireMoreInfo(this, entityId);
          return;
        }
        const domain = entityId.split(".")[0];
        tile.classList.add("busy");
        Promise.resolve(
          this._hass.callService(TOGGLE_DOMAINS.includes(domain) ? domain : "homeassistant", "toggle", { entity_id: entityId })
        ).catch(() => {}).finally(() => setTimeout(() => tile.classList.remove("busy"), 3000));
      };
      tiles.addEventListener("click", (e) => {
        const tile = e.target.closest(".sho-tile[data-entity]");
        if (tile) activate(tile);
      });
      tiles.addEventListener("keydown", (e) => {
        const tile = e.target.closest(".sho-tile[data-entity]");
        if (tile && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); activate(tile); }
      });
    }
    const zones = this._zoneData();
    this._renderOutdoor(zones);
    this._renderTiles(zones);
    this._renderSummary(zones);
    this._maybeFetch(zones);
  }

  // ------------------------------------------------------------------ vonku

  _outdoorNow(zones) {
    const e = this._outdoorEntity();
    if (e && this._hass.states[e]) return num(this._hass.states[e].state);
    for (const z of zones) {
      const v = num(z.s.outdoor_temperature ?? z.c.vonkajsia_teplota);
      if (v != null) return v;
    }
    return null;
  }

  _renderOutdoor(zones) {
    const lang = this._lang;
    const v = this._outdoorNow(zones);
    this.querySelector(".sho-out .v").textContent = v == null ? "– °C" : `${fmtNum(v, lang)} °C`;
    const h = this._outdoorHist;
    let tr = "";
    if (h && v != null) {
      const parts = [];
      if (h.ago3h != null) {
        const d = Math.round((v - h.ago3h) * 10) / 10;
        const arrow = d > 0.1 ? "▲" : d < -0.1 ? "▼" : "▶";
        parts.push(`${arrow} ${fmtNum(Math.abs(d), lang)}° ${this._t("ov_in3h")}`);
      }
      if (h.min != null && h.max != null) {
        parts.push(`${this._t("ov_today")} ${fmtNum(Math.min(h.min, v), lang)}–${fmtNum(Math.max(h.max, v), lang)}°`);
      }
      tr = parts.join(" · ");
    }
    this.querySelector(".sho-out .tr").textContent = tr;

    // vonkajsia vlhkost a tlak (len ked su nastavene - riadok sa za behu neobjavuje/nestraca)
    const hp = [];
    const rhId = this._zoneEntities("outdoor_humidity_entity")[0];
    const pId = this._zoneEntities("outdoor_pressure_entity")[0];
    const val = (id) => (id && this._hass.states[id] ? num(this._hass.states[id].state) : null);
    if (rhId) {
      const rh = val(rhId);
      hp.push(`💧 ${rh == null ? "–" : Math.round(rh)} %`);
    }
    if (pId) {
      const p = val(pId);
      let txt = `${p == null ? "–" : Math.round(p)} hPa`;
      if (p != null && h && h.p3h != null) {
        const d = Math.round(p - h.p3h);
        txt += ` ${d >= 1 ? "▲" : d <= -1 ? "▼" : "▶"}${d ? " " + Math.abs(d) : ""}`;
      }
      hp.push(txt);
    }
    this.querySelector(".sho-out .hp").textContent = hp.join(" · ");
  }

  // ------------------------------------------------------------------ dlazdice

  _builtinTile(key, zones) {
    const lang = this._lang;
    const n = (pred) => zones.filter(pred).length;
    switch (key) {
      case "heating": {
        const active = zones.filter((z) => z.c.rezim !== "Vypnute");
        const cooling = n((z) => z.c.hvac_action === "cooling");
        const heating = n((z) => z.c.hvac_action === "heating");
        const isCool = cooling > 0 && heating === 0;
        const cnt = isCool ? cooling : heating;
        const m = active.length;
        return {
          icon: isCool ? "mdi:snowflake" : "mdi:radiator",
          label: this._t(isCool ? "ov_cooling" : "ov_heating"),
          value: this._t("ov_rooms", { n: cnt, m, z: skPrep(m) }),
          cls: cnt ? (isCool ? "cold" : "hot") : "",
        };
      }
      case "pv": {
        // pv_active = zona ma kvoli prebytku zvyseny ciel; "vyuziva sa" je to,
        // az ked takato zona naozaj kuri (v cieli uz prebytok nespotrebuva).
        const boosted = n((z) => z.s.pv_active);
        const used = n((z) => z.s.pv_active && z.c.hvac_action === "heating");
        const casc = this._hass.states["sensor.smart_heating_fve_kaskada"];
        if (casc && casc.attributes && casc.attributes.rezim === "vykon") {
          // FVE riadena podla vykonu: aktivne priority + dostupny prebytok
          const tier = Number(casc.state) || 0;
          const kw = Number(casc.attributes.prebytok_w || 0) / 1000;
          const kwTxt = `${kw.toFixed(1).replace(".", this._lang === "sk" ? "," : ".")} kW`;
          return {
            icon: "mdi:solar-power-variant",
            label: this._t("ov_pv"),
            value: tier ? `${tier === 1 ? "P1" : this._t("ov_pv_prio", { tier })} · ${kwTxt}` : `${this._t("ov_no")} · ${kwTxt}`,
            cls: used ? "on" : "",
            entity: "sensor.smart_heating_fve_kaskada",
            tap: "more-info",
          };
        }
        const ent = this._zoneEntities("pv_surplus_entity")[0];
        const surplus = ent ? this._isOn(ent) : boosted > 0;
        return {
          icon: "mdi:solar-power-variant",
          label: this._t("ov_pv"),
          value: used ? this._t("ov_pv_on") : surplus ? this._t("ov_yes") : this._t("ov_no"),
          cls: used ? "on" : "",
          entity: ent,
          tap: "more-info",
        };
      }
      case "tariff": {
        const blocked = n((z) => z.s.tariff_blocked);
        const ent = this._zoneEntities("tariff_entity")[0];
        if (ent) {
          const on = this._isOn(ent);
          return {
            icon: "mdi:flash",
            label: this._t("ov_tariff"),
            value: this._t(on ? "ov_tariff_active" : "ov_tariff_blocked"),
            cls: on ? "on" : "warn",
            entity: ent,
            tap: "more-info",
          };
        }
        return { icon: "mdi:flash", label: this._t("ov_tariff"), value: this._t(blocked ? "ov_tariff_blocked" : "ov_tariff_ok"), cls: blocked ? "warn" : "" };
      }
      case "presence": {
        const ents = this._zoneEntities("presence_entities");
        if (!ents.length) return null;
        return this._entityTile({ name: this._t("ov_home"), icon: "mdi:home-account", entities: ents });
      }
      case "guests": {
        const ents = this._zoneEntities("manual_presence_entities");
        if (!ents.length) return null;
        const on = ents.some((e) => this._isOn(e));
        return {
          icon: "mdi:account-group",
          label: this._t("ov_guests"),
          value: this._t(on ? "ov_yes" : "ov_no"),
          cls: on ? "on" : "",
          entity: ents[0],
          tap: TOGGLE_DOMAINS.includes(ents[0].split(".")[0]) ? "toggle" : "more-info",
        };
      }
      case "krb": {
        const c = n((z) => z.s.krb_override);
        return { icon: "mdi:fireplace", label: this._t("ov_krb"), value: c ? this._t("ov_krb_on", { n: c }) : this._t("ov_krb_off"), cls: c ? "hot" : "" };
      }
      case "emergency": {
        const c = n((z) => z.s.emergency_active);
        return { icon: "mdi:alert", label: this._t("ov_emergency"), value: c ? this._t("ov_active_in", { n: c }) : this._t("ov_no"), cls: c ? "err" : "" };
      }
      case "boost": {
        const c = n((z) => z.s.boost_active);
        return { icon: "mdi:rocket-launch", label: this._t("ov_boost"), value: c ? this._t("ov_active_in", { n: c }) : this._t("ov_no"), cls: c ? "hot" : "" };
      }
      default:
        return null;
    }
  }

  _isOn(entityId) {
    const st = this._hass.states[entityId];
    return !!st && ON_STATES.has(String(st.state).toLowerCase());
  }

  _entityTile(tile) {
    const hass = this._hass;
    const color = tile.color || "on";
    if (Array.isArray(tile.entities)) {
      const states = tile.entities.map((e) => hass.states[e]).filter(Boolean);
      const on = states.filter((s) => ON_STATES.has(String(s.state).toLowerCase()));
      const names = on.map((s) => String(s.attributes.friendly_name || s.entity_id).split(" ")[0]);
      return {
        icon: tile.icon || "mdi:account-multiple",
        label: tile.name || "",
        value: on.length ? names.join(", ") : tile.off_text || this._t("ov_nobody"),
        cls: on.length ? color : "",
        entity: tile.entities[0],
        tap: tile.tap_action || "more-info",
      };
    }
    const st = hass.states[tile.entity];
    if (!st) {
      return { icon: tile.icon || "mdi:help-circle-outline", label: tile.name || tile.entity, value: "–", cls: "", entity: tile.entity };
    }
    const domain = tile.entity.split(".")[0];
    const isOn = ON_STATES.has(String(st.state).toLowerCase());
    const binary = ["input_boolean", "binary_sensor", "switch", "light", "fan"].includes(domain);
    let value;
    if (binary) {
      value = isOn ? tile.on_text || this._t("ov_yes") : tile.off_text || this._t("ov_no");
    } else if (typeof hass.formatEntityState === "function") {
      value = hass.formatEntityState(st);
    } else {
      value = `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`;
    }
    return {
      icon: tile.icon || st.attributes.icon || "mdi:information-outline",
      label: tile.name || st.attributes.friendly_name || tile.entity,
      value,
      cls: isOn ? color : "",
      entity: tile.entity,
      tap: tile.tap_action || (TOGGLE_DOMAINS.includes(domain) ? "toggle" : "more-info"),
    };
  }

  _renderTiles(zones) {
    const list = Array.isArray(this._config.tiles) && this._config.tiles.length ? this._config.tiles : DEFAULT_TILES;
    const tiles = [];
    for (const item of list) {
      const t = typeof item === "string" ? this._builtinTile(item, zones) : item && this._entityTile(item);
      if (t) tiles.push(t);
    }
    const keys = list.filter((x) => typeof x === "string");
    if (!keys.includes("emergency") && zones.some((z) => z.s.emergency_active)) tiles.unshift(this._builtinTile("emergency", zones));
    if (!keys.includes("boost") && zones.some((z) => z.s.boost_active)) tiles.push(this._builtinTile("boost", zones));

    const html = tiles.map((t) => `
      <div class="sho-tile ${t.cls}${t.entity && t.tap !== "none" ? " click" : ""}"${t.entity && t.tap !== "none" ? ` data-entity="${esc(t.entity)}" data-tap="${esc(t.tap || "more-info")}" role="button" tabindex="0"` : ""}>
        <div class="i">${mdiSvg(t.icon) || `<ha-icon icon="${esc(t.icon)}"></ha-icon>`}</div>
        <div class="tx"><div class="k">${esc(t.label)}</div><div class="s">${esc(t.value)}</div></div>
      </div>`).join("");
    const wrap = this.querySelector(".sho-tiles");
    wrap.style.setProperty("--sho-cols", String(tiles.length > 4 ? Math.ceil(tiles.length / 2) : Math.max(1, tiles.length)));
    if (wrap._html !== html) {
      wrap.innerHTML = html;
      wrap._html = html;
    }
  }

  // ------------------------------------------------------------------ suhrn

  _renderSummary(zones) {
    const wrap = this.querySelector(".sho-sum");
    if (!zones.length) {
      if (this._hadZones) return; // reload integracie - nemen vysku karty
      wrap.innerHTML = `<div class="sho-msg">${this._t("no_zones")}</div>`;
      return;
    }
    this._hadZones = true;
    let ok = 0;
    let up = 0;
    let dn = 0;
    for (const z of zones) {
      if (z.c.rezim === "Vypnute") continue;
      const c = deltaClass(zoneDelta(num(z.c.current_temperature), num(z.c.temperature)));
      if (c === "ok") ok += 1;
      else if (c === "up") up += 1;
      else if (c === "dn") dn += 1;
    }
    const cooling = zones.some((z) => (z.s.season || z.c.sezona) === "Chladenie");
    const rt = this._runtime;
    const runtime = rt == null ? "–" : fmtDuration(cooling ? rt.cool : rt.heat, this._lang);
    const row = (color, label, val) =>
      `<div class="r"><span>${color ? `<span class="dot" style="background:${color}"></span>` : ""}${esc(label)}</span><b>${esc(val)}</b></div>`;
    const faulty = zones.filter((z) => Array.isArray(z.s.problemy) && z.s.problemy.length).length;
    wrap.innerHTML =
      row("var(--sh-ok)", this._t("ov_on_target"), ok) +
      row("var(--sh-warn)", this._t("ov_above"), up) +
      row("var(--sh-cool)", this._t("ov_below"), dn) +
      row(faulty ? "var(--sh-err, #e5484d)" : "", this._t("ov_problems"), faulty) +
      row("", this._t(cooling ? "ov_cooled_today" : "ov_heated_today"), runtime) +
      (this._allCons("power_entities").length
        ? row("", this._t("ov_power_now"), fmtPower(sumPowerW(this._hass, this._allCons("power_entities")), this._lang)) : "") +
      (this._allCons("energy_entities").length
        ? row("", this._t("ov_energy_today"), fmtKwh(this._energyToday, this._lang)) : "") +
      `<button type="button" class="sho-statsbtn" aria-expanded="${this._statsOpen ? "true" : "false"}">${mdiSvg("chart-bar")}<span>${esc(this._t("st_btn"))}</span></button>` +
      `<button type="button" class="sho-gear" aria-expanded="${this._setOpen ? "true" : "false"}">${mdiSvg("cog")}<span>${esc(this._t("ov_settings"))}</span></button>`;
  }

  // -------------------------------------------------- nastavenia integracie (options flow)


  // -------------------------------------------------- statistiky (spotreba, FVE, stupnodni, poradie)

  _toggleStats() {
    const panel = this.querySelector(".sho-stats");
    if (!panel) return;
    if (this._statsOpen) {
      this._statsOpen = false;
      panel.hidden = true;
      panel.innerHTML = "";
      this._renderSummary(this._zoneData());
      return;
    }
    if (this._setOpen) this._closeSettings(true);
    this._statsOpen = true;
    panel.hidden = false;
    this._renderSummary(this._zoneData());
    this._loadStats(this._statsDays || 7);
  }

  async _loadStats(days) {
    this._statsDays = days;
    const panel = this.querySelector(".sho-stats");
    const zones = this._zoneData();
    const zoneIds = zones.map((z) => {
      const srcs = Array.isArray(z.s.sources) && z.s.sources.length
        ? z.s.sources
        : [{ key: "other", energy: z.s.energy_entities || [] }];
      return { id: z.id, name: z.name, problems: z.s.meter_problems || [], srcs: srcs.filter((x) => (x.energy || []).length) };
    });
    const energyIds = [...new Set(zoneIds.flatMap((z) => z.srcs.flatMap((x) => x.energy)))];
    if (!energyIds.length) {
      panel.innerHTML = this._statsHead() + `<div class="sho-msg">${esc(this._t("st_no_meters"))}</div>`;
      return;
    }
    panel.innerHTML = this._statsHead() + `<div class="sho-msg">${esc(this._t("ov_loading"))}</div>`;
    const has = (id) => (this._hass.states[id] ? id : null);
    const fveId = has("sensor.smart_heating_energia_z_fve");
    const houseIds = {
      siet: has("sensor.smart_heating_energia_domu_zo_siete"),
      fve: has("sensor.smart_heating_energia_domu_z_fve"),
      bateria: has("sensor.smart_heating_energia_domu_z_baterie"),
    };
    const outdoorId = this._outdoorEntity();
    const humidity = zones.filter((z) => z.s.humidity_entity && this._hass.states[z.s.humidity_entity])
      .map((z) => ({ name: z.name, id: z.s.humidity_entity }));
    const outHum = this._zoneEntities("outdoor_humidity_entity")[0];
    if (outHum && this._hass.states[outHum]) humidity.push({ name: this._t("st_hum_out"), id: outHum });
    const hourly = days === 1;
    const DAY = 86400000;
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const start = midnight.getTime() - (days - 1) * DAY;
    const prevStart = start - days * DAY;
    try {
      // Dlhodobe statistiky (hodina/den) vznikaju az po skonceni obdobia, preto
      // dokoncene useky citame z nich a dnesok z 5-minutovych (tie su aktualne -
      // rovnako ako riadok "Spotreba dnes" v suhrne). Aktualne obdobie ide po
      // hodinach: rozdelenie sieť / FVE / batéria sa robi v kazdej hodine zvlast.
      const ids = [...energyIds, ...(fveId ? [fveId] : []), ...Object.values(houseIds).filter(Boolean),
        ...(outdoorId ? [outdoorId] : []), ...humidity.map((h) => h.id)];
      const req = {
        type: "recorder/statistics_during_period",
        statistic_ids: [...new Set(ids)],
        types: ["change", "mean"],
        units: { energy: "kWh", temperature: "°C" },
      };
      const iso = (t) => new Date(t).toISOString();
      const jobs = [
        // predchadzajuce obdobie (porovnanie): vcera po hodinach, inak po dnoch
        this._hass.callWS({ ...req, start_time: iso(prevStart), end_time: iso(start), period: hourly ? "hour" : "day" }),
        this._hass.callWS({ ...req, start_time: midnight.toISOString(), end_time: new Date().toISOString(), period: "5minute" }),
      ];
      if (!hourly) {
        jobs.push(this._hass.callWS({ ...req, start_time: iso(start), end_time: midnight.toISOString(), period: "hour" }));
      }
      const [prev, today, curPast] = await Promise.all(jobs);
      const res = {};
      const add = (src, dur) => {
        for (const [id, rows] of Object.entries(src || {})) {
          for (const r of rows || []) (res[id] = res[id] || []).push({ ...r, dur });
        }
      };
      add(prev, hourly ? 1 / 24 : 1);
      add(curPast, 1 / 24);
      add(today, 1 / 288);
      if (this._statsDays !== days || !this._statsOpen) return;   // medzicasom prepnute
      this._stats = computeStats(res, {
        zones: zoneIds, energyIds, fveId, houseIds, outdoorId, humidity, start, prevStart, hourly, days, lang: this._lang,
      });
      this._statSel = null;
      this._renderStats();
    } catch (err) {
      panel.innerHTML = this._statsHead() + `<div class="sho-msg">${esc(this._t("st_error"))}</div>`;
    }
  }

  _statsHead() {
    const d = this._statsDays || 7;
    const btn = (n, key) => `<button type="button" class="sho-per${d === n ? " on" : ""}" data-days="${n}" aria-pressed="${d === n}">${esc(this._t(key))}</button>`;
    return `<div class="sho-st-h"><h2>${mdiSvg("chart-bar") || ""}${esc(this._t("st_title"))}</h2>
      <div class="sho-pers" role="group">${btn(1, "st_today")}${btn(7, "st_7")}${btn(30, "st_30")}</div></div>`;
  }

  _renderStats() {
    const st = this._stats;
    const panel = this.querySelector(".sho-stats");
    if (!st || !panel) return;
    const L = this._lang;
    const num = (v, dec = 1) => (v == null ? "–" : (Math.round(v * 10 ** dec) / 10 ** dec).toFixed(dec).replace(".", L === "sk" ? "," : "."));
    const kwh = (v) => `${num(v)} kWh`;
    // podiel z rozdelenej casti (nerozdelene obdobie pred meranim by podiely skreslilo)
    const knownTotal = st.split ? st.split.fve + st.split.bateria + st.split.siet : 0;
    const pct = (v) => (knownTotal > 0 && v != null ? `${Math.round((v / knownTotal) * 100)} %` : "");
    const kpi = (label, val, unit, sub, cls = "") =>
      `<div class="sho-kpi"><div class="l">${esc(label)}</div><div class="v ${cls}">${val}${unit ? ` <span>${esc(unit)}</span>` : ""}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
    let effSub = "";
    if (st.effDelta != null) {
      const p = Math.round(Math.abs(st.effDelta) * 100);
      effSub = st.effDelta <= 0
        ? `<span class="good">${esc(this._t("st_better", { p }))}</span>`
        : `<span class="bad">${esc(this._t("st_worse", { p }))}</span>`;
    } else if (st.eff != null) {
      effSub = esc(this._t("st_no_compare"));
    }
    const sp = st.split;
    const unknownSub = sp && sp.unknown > 0.05 ? esc(this._t("st_unknown", { kwh: kwh(sp.unknown) })) : "";
    const surplusSub = st.surplus != null && st.surplus > 0.005 ? esc(this._t("st_fve_surplus", { kwh: kwh(st.surplus) })) : "";
    const part = (v) => (sp ? num(v) : "–");
    const kpis = kpi(this._t("st_total"), num(st.total), "kWh", unknownSub) +
      kpi(this._t("st_fve"), part(sp && sp.fve), sp ? "kWh" : "", [pct(sp && sp.fve), surplusSub].filter(Boolean).join(" · "), "fve") +
      kpi(this._t("st_bat"), part(sp && sp.bateria), sp ? "kWh" : "", pct(sp && sp.bateria), "bat") +
      kpi(this._t("st_grid"), part(sp && sp.siet), sp ? "kWh" : "", pct(sp && sp.siet)) +
      kpi(this._t("st_eff"), num(st.eff, 2), st.eff == null ? "" : "kWh", effSub);

    // graf: skutocna sirka panela (bez deformacie textu), mriezka, hodnoty nad stlpcami
    const chartEl = panel.querySelector(".sho-st-chart");
    const W = Math.max(280, Math.round((chartEl && chartEl.clientWidth) || panel.clientWidth || 900));
    this._chartW = W;
    const legKeys = sp ? ["fve", "bateria", "siet", ...(sp.unknown > 0.05 ? ["unknown"] : [])] : ["unknown"];
    const legName = { fve: "st_leg_fve", bateria: "st_leg_bat", siet: "st_leg_grid", unknown: "st_leg_unknown" };
    const chart = `<div class="sho-leg"><b>${esc(this._t(st.hourly ? "st_by_hour" : "st_by_day"))}</b>
        ${legKeys.map((k) => `<span><i class="${k}"></i>${esc(this._t(legName[k]))}</span>`).join("")}</div>
      ${statsChartSvg(st, W, L)}
      <div class="sho-st-sel">${this._statSelText()}</div>`;

    // poradie izieb
    const maxZone = Math.max(0.01, ...st.ranking.map((r) => r.total));
    const rank = st.ranking.map((r) => {
      const segs = r.parts.filter((p) => p.kwh > 0).map((p) =>
        `<span class="seg ${p.key}" style="width:${((p.kwh / maxZone) * 100).toFixed(1)}%" title="${esc(this._t("src_" + p.key))} ${num(p.kwh)} kWh"></span>`).join("");
      return `<div class="sho-rk"><span>${esc(r.name)}</span><span class="bar">${segs}</span><b>${num(r.total)} kWh</b></div>`;
    }).join("");
    const usedKeys = [...new Set(st.ranking.flatMap((r) => r.parts.filter((p) => p.kwh > 0).map((p) => p.key)))];
    const rankLeg = usedKeys.map((k) => `<span><i class="seg ${k}"></i>${esc(this._t("src_" + k))}</span>`).join("");

    // kontrola meracov
    const issues = st.zones.flatMap((z) => z.problems.map((p) => ({ zone: z.name, p })));
    const meters = issues.length
      ? issues.map((x) => `<div class="sho-mt warn">${mdiSvg("alert") || ""}<span><b>${esc(x.zone)}</b><br>${esc(x.p)}</span></div>`).join("")
      : `<div class="sho-mt ok">${mdiSvg("check") || "✓"}<span>${esc(this._t("st_meters_ok"))}</span></div>`;
    const hum = (st.humidity || []).length
      ? `<div class="sho-leg sho-hum-h"><b>${esc(this._t("st_hum"))}</b></div>` +
        st.humidity.map((h) => `<div class="sho-hum"><span>${esc(h.name)}</span><b>${Math.round(h.value)} %</b></div>`).join("")
      : "";

    panel.innerHTML = this._statsHead() +
      `<div class="sho-kpis">${kpis}</div>
       <div class="sho-st-chart">${chart}</div>
       <div class="sho-st-low">
         <div><div class="sho-leg"><b>${esc(this._t("st_rank"))}</b>${rankLeg}</div>${rank}</div>
         <div><div class="sho-leg"><b>${esc(this._t("st_meters"))}</b></div>${meters}${hum}
           <div class="sho-note">${esc(this._t("st_fve_note"))}</div></div>
       </div>`;
    this._watchChartWidth();
  }

  /** Text pod grafom: detail zvoleneho stlpca (tuknutie) alebo napoveda. */
  _statSelText() {
    const st = this._stats;
    const b = st && this._statSel != null ? st.buckets[this._statSel] : null;
    if (!b) return esc(this._t("st_tap_hint"));
    const L = this._lang;
    const n = (v) => fmtNum(v, L);
    const d = new Date(b.t);
    const when = st.hourly ? `${d.getHours()}:00–${d.getHours() + 1}:00` : `${d.getDate()}. ${d.getMonth() + 1}.`;
    const parts = [];
    if (st.split) {
      for (const [k, key] of [["fve", "st_leg_fve"], ["bateria", "st_leg_bat"], ["siet", "st_leg_grid"], ["unknown", "st_leg_unknown"]]) {
        if (b[k] > 0.005) parts.push(`${esc(this._t(key))} ${n(b[k])}`);
      }
    }
    return `<b>${esc(when)}: ${n(b.total)} kWh</b>${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }

  /** Pri zmene sirky (otocenie mobilu, okno) graf prekresli v novej sirke. */
  _watchChartWidth() {
    if (this._chartRO || typeof ResizeObserver === "undefined") return;
    this._chartRO = new ResizeObserver(() => {
      const el = this.querySelector(".sho-st-chart");
      if (!el || !this._statsOpen || !this._stats) return;
      if (Math.abs(el.clientWidth - (this._chartW || 0)) > 40) this._renderStats();
    });
    const panel = this.querySelector(".sho-stats");
    if (panel) this._chartRO.observe(panel);
  }

  _entryId() {
    const z = this._zoneData().find((x) => x.s.config_entry_id);
    return z ? z.s.config_entry_id : null;
  }

  async _toggleSettings() {
    const panel = this.querySelector(".sho-set");
    if (this._setOpen) return this._closeSettings(true);
    this._setOpen = true;
    panel.hidden = false;
    this._renderSummary(this._zoneData());
    panel.innerHTML = `<div class="sho-msg">${esc(this._t("ov_loading"))}</div>`;
    try {
      const entryId = this._entryId();
      if (!entryId) throw new Error("no entry");
      let step = await this._hass.callApi("POST", "config/config_entries/options/flow", { handler: entryId, show_advanced_options: false });
      if (step.type === "menu") {
        step = await this._hass.callApi("POST", `config/config_entries/options/flow/${step.flow_id}`, { next_step_id: "global" });
      }
      if (step.type !== "form") throw new Error("unexpected step");
      this._flow = step;
      this._changes = {};
      this._renderSettingsPanel();
    } catch (err) {
      this._flow = null;
      panel.innerHTML = `<div class="sho-msg">${esc(this._t("ov_settings_error"))}</div>${this._settingsFooter(false)}`;
    }
  }

  _settingsFields() {
    const fields = (this._flow && this._flow.data_schema) || [];
    const out = [];
    for (const f of fields) {
      const label = I18N[`of_${f.name}`];
      if (!label) continue;                       // len polia, ktorym karta rozumie
      const sel = f.selector || {};
      if (sel.boolean || f.type === "boolean") out.push({ ...f, kind: "bool" });
      else if (sel.number || f.type === "float" || f.type === "integer") {
        const n = sel.number || {};
        out.push({ ...f, kind: "num", step: n.step && n.step !== "any" ? Number(n.step) : 0.5, min: n.min, max: n.max,
          unit: n.unit_of_measurement || "°" });
      }
    }
    return out;
  }

  _fieldValue(f) {
    return Object.prototype.hasOwnProperty.call(this._changes, f.name) ? this._changes[f.name] : f.default;
  }

  _fmtNum(v, f) {
    const dec = f.step && f.step < 1 ? 1 : 0;
    const txt = Number(v).toFixed(dec).replace(".", this._lang === "sk" ? "," : ".");
    const unit = f.unit || "°";
    if (unit === "°" || unit === "°C") return `${txt}°`;
    return `${txt} ${unit}`;
  }

  _renderSettingsPanel() {
    const panel = this.querySelector(".sho-set");
    const fields = this._settingsFields();
    const isPv = (f) => f.name.startsWith("pv_") || f.name === "grid_export_negative" || f.name === "battery_charge_positive";
    const general = fields.filter((f) => !f.name.startsWith("notify_") && !isPv(f));
    const notify = fields.filter((f) => f.name.startsWith("notify_"));
    const pv = fields.filter(isPv);
    const fieldHtml = (f) => {
      const label = esc(this._t(`of_${f.name}`));
      if (f.kind === "bool") {
        const on = !!this._fieldValue(f);
        return `<label class="sho-f"><span>${label}</span><button type="button" class="sho-sw ${on ? "on" : ""}" role="switch" aria-checked="${on}" data-f="${esc(f.name)}"><i></i></button></label>`;
      }
      const v = this._fieldValue(f);
      return `<div class="sho-f"><span>${label}</span><span class="sho-num">
        <button type="button" data-f="${esc(f.name)}" data-d="-1">−</button><b>${v == null ? "–" : esc(this._fmtNum(v, f))}</b>
        <button type="button" data-f="${esc(f.name)}" data-d="1">+</button></span></div>`;
    };
    const group = (title, list) => (list.length ? `<div class="sho-grp"><div class="h">${esc(this._t(title))}</div>${list.map(fieldHtml).join("")}</div>` : "");
    panel.innerHTML = `<div class="sho-set-h">${mdiSvg("cog")}<span>${esc(this._t("ov_settings"))}</span></div>
      <div class="sho-grps">${group("ov_grp_general", general)}${group("ov_grp_pv", pv)}${group("ov_grp_notify", notify)}</div>
      ${this._settingsFooter(true)}`;
  }

  _settingsFooter(canSave) {
    const dirty = this._changes && Object.keys(this._changes).length > 0;
    return `<div class="sho-set-f">
      <a href="#" class="sho-all">${mdiSvg("open-in-new")}${esc(this._t("ov_settings_all"))}</a>
      <span class="sp"></span>
      <button type="button" class="sho-btn sho-cancel">${esc(this._t("ov_cancel"))}</button>
      ${canSave ? `<button type="button" class="sho-btn pri sho-save" ${dirty ? "" : "disabled"}>${esc(this._t("ov_save"))}</button>` : ""}
    </div>`;
  }

  _onSettingsClick(e) {
    const t = e.target;
    if (t.closest(".sho-all")) {
      e.preventDefault();
      this._closeSettings(true);
      history.pushState(null, "", "/config/integrations/integration/smart_heating");
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      return;
    }
    if (t.closest(".sho-cancel")) return this._closeSettings(true);
    if (t.closest(".sho-save")) return this._saveSettings();
    const ctl = t.closest("[data-f]");
    if (!ctl || !this._flow) return;
    const f = this._settingsFields().find((x) => x.name === ctl.dataset.f);
    if (!f) return;
    if (f.kind === "bool") this._changes[f.name] = !this._fieldValue(f);
    else {
      let v = Number(this._fieldValue(f) || 0) + Number(ctl.dataset.d) * f.step;
      if (f.min != null) v = Math.max(Number(f.min), v);
      if (f.max != null) v = Math.min(Number(f.max), v);
      this._changes[f.name] = Math.round(v * 100) / 100;
    }
    this._renderSettingsPanel();
  }

  async _saveSettings() {
    if (!this._flow) return;
    const payload = {};
    // vsetky polia s aktualnou hodnotou (default = sucasne nastavenie) + zmeny
    for (const f of this._flow.data_schema || []) {
      if (Object.prototype.hasOwnProperty.call(f, "default")) payload[f.name] = f.default;
    }
    Object.assign(payload, this._changes);
    const panel = this.querySelector(".sho-set");
    const btn = panel.querySelector(".sho-save");
    if (btn) { btn.disabled = true; btn.textContent = this._t("ov_saving"); }
    try {
      await this._hass.callApi("POST", `config/config_entries/options/flow/${this._flow.flow_id}`, payload);
      this._flow = null;
      panel.innerHTML = `<div class="sho-msg">${esc(this._t("ov_saved"))}</div>`;
      setTimeout(() => this._closeSettings(false), 2500);
    } catch (err) {
      panel.innerHTML = `<div class="sho-msg">${esc(this._t("ov_settings_error"))}</div>${this._settingsFooter(false)}`;
    }
  }

  _closeSettings(abort) {
    const flow = this._flow;
    this._flow = null;
    this._changes = {};
    this._setOpen = false;
    const panel = this.querySelector(".sho-set");
    if (panel) { panel.hidden = true; panel.innerHTML = ""; }
    if (abort && flow && this._hass) {
      Promise.resolve(this._hass.callApi("DELETE", `config/config_entries/options/flow/${flow.flow_id}`)).catch(() => {});
    }
    this._renderSummary(this._zoneData());
  }

  // ------------------------------------------------------------------ historia

  _maybeFetch(zones) {
    const hass = this._hass;
    if (!hass || typeof hass.callWS !== "function" || this._loading) return;
    const now = Date.now();
    const jobs = [];
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const outdoor = this._outdoorEntity();
    const pressure = this._zoneEntities("outdoor_pressure_entity")[0];
    if (outdoor && hass.states[outdoor] && now - this._outdoorFetchedAt > OVERVIEW_REFRESH_MS) {
      const start = Math.min(midnight.getTime(), now - 3 * 3600 * 1000);
      const histIds = [outdoor, ...(pressure && hass.states[pressure] ? [pressure] : [])];
      jobs.push(
        hass.callWS({
          type: "history/history_during_period",
          start_time: new Date(start).toISOString(),
          end_time: new Date(now).toISOString(),
          entity_ids: histIds,
          minimal_response: true,
          no_attributes: true,
          significant_changes_only: false,
        }).then((res) => {
          const rows = (res && res[outdoor]) || [];
          const series = rows
            .map((r) => [tsOf(r.lu ?? r.last_updated ?? r.lc ?? r.last_changed), num(r.s ?? r.state)])
            .filter(([t, v]) => !isNaN(t) && v != null);
          const today = series.filter(([t]) => t >= midnight.getTime()).map(([, v]) => v);
          if (series.length && series[0][0] < midnight.getTime()) today.push(lastBefore(series, midnight.getTime()));
          const pRows = (pressure && res && res[pressure]) || [];
          const pSeries = pRows
            .map((r) => [tsOf(r.lu ?? r.last_updated ?? r.lc ?? r.last_changed), num(r.s ?? r.state)])
            .filter(([t, v]) => !isNaN(t) && v != null);
          this._outdoorHist = {
            p3h: pSeries.length ? lastBefore(pSeries, now - 3 * 3600 * 1000) : null,
            ago3h: lastBefore(series, now - 3 * 3600 * 1000),
            min: today.length ? Math.min(...today) : null,
            max: today.length ? Math.max(...today) : null,
          };
          this._outdoorOk = true;
        }).catch(() => { this._outdoorOk = false; })
          .finally(() => { this._outdoorFetchedAt = retryAt(this._outdoorOk); })
      );
    }

    if (zones.length && now - this._runtimeFetchedAt > OVERVIEW_REFRESH_MS) {
      // Od 0.16.2 ma kazda zona binary_sensor ..._v_chode - jeho historia je bez
      // atributov a drobna. Starsie verzie: historia climate s atributmi.
      const useBinary = zones.every((z) => hass.states[eid(z.id, "binary_sensor", "v_chode")]);
      const ids = zones.map((z) => (useBinary ? eid(z.id, "binary_sensor", "v_chode") : eid(z.id, "climate")));
      const onAction = {};
      zones.forEach((z, i) => { onAction[ids[i]] = (z.s.season || z.c.sezona) === "Chladenie" ? "cooling" : "heating"; });
      jobs.push(
        hass.callWS({
          type: "history/history_during_period",
          start_time: midnight.toISOString(),
          end_time: new Date(now).toISOString(),
          entity_ids: ids,
          minimal_response: useBinary,
          no_attributes: useBinary,
          significant_changes_only: false,
        }).then((res) => {
          this._runtime = runtimeUnion(res || {}, ids, midnight.getTime(), now, useBinary ? onAction : null);
          this._runtimeOk = true;
        }).catch(() => { this._runtimeOk = false; })
          .finally(() => { this._runtimeFetchedAt = retryAt(this._runtimeOk); })
      );
    }

    if (!jobs.length) return;
    this._loading = true;
    Promise.allSettled(jobs).then(() => {
      this._loading = false;
      const z = this._zoneData();
      this._renderOutdoor(z);
      this._renderSummary(z);
    });
  }
}

/** Po chybe skusi znova o 2 minuty, inak az o OVERVIEW_REFRESH_MS. */
function retryAt(ok) {
  return ok ? Date.now() : Date.now() - OVERVIEW_REFRESH_MS + 2 * 60 * 1000;
}

function lastBefore(series, t) {
  let v = null;
  for (const [ts, val] of series) {
    if (ts <= t) v = val;
    else break;
  }
  return v;
}

/** Minuty dnes, ked aspon jedna zona kurila / chladila (zjednotenie, nie sucet). */
function runtimeUnion(res, ids, t0, t1, onAction) {
  const minutes = Math.max(1, Math.ceil((t1 - t0) / 60000));
  const heat = new Uint8Array(minutes);
  const cool = new Uint8Array(minutes);
  for (const id of ids) {
    const rows = res[id] || [];
    let action = null;
    let since = null;
    const mark = (arr, a, b) => {
      const i0 = Math.max(0, Math.round((a - t0) / 60000));
      const i1 = Math.min(minutes, Math.round((b - t0) / 60000));
      for (let i = i0; i < i1; i++) arr[i] = 1;
    };
    const flush = (until) => {
      if (since == null) return;
      if (action === "heating") mark(heat, since, until);
      if (action === "cooling") mark(cool, since, until);
    };
    for (const r of rows) {
      const t = Math.max(t0, tsOf(r.lu ?? r.last_updated ?? r.lc ?? r.last_changed));
      if (isNaN(t)) continue;
      let next = action;
      if (onAction) {
        const s = r.s ?? r.state;
        next = s === "on" ? onAction[id] : "idle";
      } else {
        const attrs = r.a || r.attributes;
        if (attrs && "hvac_action" in attrs) next = attrs.hvac_action;
      }
      if (next !== action) {
        flush(t);
        action = next;
        since = t;
      } else if (since == null) {
        since = t;
      }
    }
    flush(t1);
  }
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  return { heat: sum(heat), cool: sum(cool) };
}

// ============================================================== VIZUALNY EDITOR

class SmartHeatingCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _t(key) {
    return translate(resolveLang(this._hass, this._config.language), key);
  }

  _render() {
    if (!this._hass) return;
    const zones = findZones(this._hass);
    const currentZoneId = this._config?.zone_id || "";

    if (!this._built) {
      this.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; padding:8px 0;">
          <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
            <span class="sh-ed-zone-label"></span>
            <select class="sh-ed-zone" style="padding:8px; border-radius:6px;"></select>
          </label>
          <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
            <span class="sh-ed-name-label"></span>
            <input class="sh-ed-name" type="text" style="padding:8px; border-radius:6px;" />
          </label>
          <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
            <span class="sh-ed-lang-label"></span>
            <select class="sh-ed-lang" style="padding:8px; border-radius:6px;">
              <option value="auto">Auto</option>
              <option value="en">English</option>
              <option value="sk">Slovenčina</option>
            </select>
          </label>
        </div>
      `;
      this._built = true;
      this.querySelector(".sh-ed-zone").addEventListener("change", (e) => this._emit({ zone_id: e.target.value }));
      this.querySelector(".sh-ed-name").addEventListener("input", (e) => this._emit({ name: e.target.value || undefined }));
      this.querySelector(".sh-ed-lang").addEventListener("change", (e) => this._emit({ language: e.target.value === "auto" ? undefined : e.target.value }));
    }

    this.querySelector(".sh-ed-zone-label").textContent = this._t("editor_zone");
    this.querySelector(".sh-ed-name-label").textContent = this._t("editor_name");
    this.querySelector(".sh-ed-lang-label").textContent = this._t("editor_language");

    const select = this.querySelector(".sh-ed-zone");
    const optionsHtml =
      `<option value="" disabled ${!currentZoneId ? "selected" : ""}>${this._t("editor_zone_placeholder")}</option>` +
      zones
        .map((z) => `<option value="${z.zone_id}" ${z.zone_id === currentZoneId ? "selected" : ""}>${esc(z.name)} (${z.zone_id})</option>`)
        .join("");
    if (select._html !== optionsHtml) {
      select.innerHTML = optionsHtml;
      select._html = optionsHtml;
    }

    const nameInput = this.querySelector(".sh-ed-name");
    if (document.activeElement !== nameInput) nameInput.value = this._config.name || "";

    this.querySelector(".sh-ed-lang").value = this._config.language || "auto";
  }

  _emit(patch) {
    const newConfig = { ...this._config, type: "custom:smart-heating-card", ...patch };
    if (!newConfig.name) delete newConfig.name;
    if (!newConfig.language) delete newConfig.language;
    this._config = newConfig;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true }));
  }
}

// ============================================================== REGISTRACIA

if (!customElements.get("smart-heating-card")) {
  customElements.define("smart-heating-card", SmartHeatingCard);
}
if (!customElements.get("smart-heating-card-editor")) {
  customElements.define("smart-heating-card-editor", SmartHeatingCardEditor);
}
if (!customElements.get("smart-heating-overview")) {
  customElements.define("smart-heating-overview", SmartHeatingOverview);
}

window.customCards = window.customCards || [];
for (const card of [
  { type: "smart-heating-card", name: "Smart Heating", description: "Control card for a single Smart Heating zone." },
  { type: "smart-heating-overview", name: "Smart Heating – overview", description: "Whole-house overview: outside temperature, conditions and zone summary." },
]) {
  if (!window.customCards.some((c) => c.type === card.type)) window.customCards.push({ ...card, preview: true });
}

console.info(`%c SMART-HEATING-CARD %c ${CARD_VERSION} `, "background:#ff8a3d;color:#fff;font-weight:700", "background:#2b2d31;color:#fff");
