/* Smart Heating Card
 * Standalone Lovelace card for the Smart Heating integration.
 * No build step - pure JS web component, just add it as a Lovelace resource.
 *
 * Config (YAML, or use the visual editor when adding the card):
 *   type: custom:smart-heating-card
 *   zone_id: "287f437c"
 *   name: "Living room"   # optional, otherwise uses the climate entity's name
 *   language: auto        # optional: auto | en | sk  (auto = follow HA language)
 */

const CARD_VERSION = "0.14.0";

const MODES = ["Auto", "Den", "Noc", "Min", "Mraz", "Vypnute"];
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
  outdoor: { en: "Outdoor", sk: "Vonku" },
  source: { en: "Source", sk: "Zdroj" },

  badge_emergency: { en: "Emergency protection", sk: "Núdzová ochrana" },
  badge_tariff: { en: "Blocked by tariff", sk: "Zablokované tarifou" },
  badge_floor: { en: "Floor - max temperature", sk: "Podlaha - max teplota" },
  badge_krb: { en: "Fireplace - off", sk: "Krb - vypnuté" },
  badge_pv: { en: "Solar surplus", sk: "FVE prebytok" },
  badge_cold: { en: "Low outdoor temperature", sk: "Nízka vonkajšia teplota" },
  badge_boost: { en: "Boost active", sk: "Boost aktívny" },

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
  toggle_fixed_ac_setpoint: { en: "Use fixed AC setpoint even without external thermometer", sk: "Použiť pevný AC setpoint aj bez externého teplomera" },

  boost_running: { en: "Boost running", sk: "Boost beží" },

  settings: { en: "Settings", sk: "Nastavenia" },
  status_heating: { en: "Heating", sk: "Kúri" },
  status_cooling: { en: "Cooling", sk: "Chladí" },
  status_idle_heat: { en: "Not heating", sk: "Nekúri" },
  status_idle_cool: { en: "Not cooling", sk: "Nechladí" },
  status_off: { en: "Off", sk: "Vypnuté" },
  chart_span: { en: "last 24 h", sk: "posledných 24 h" },
  boost_start: { en: "Start Boost", sk: "Spustiť Boost" },

  select_zone_first: { en: "Select a zone in the card settings.", sk: "Vyber zónu v nastaveniach karty." },
  zone_not_found: { en: "Entities for zone '{zone}' were not found. Check zone_id in the card configuration.", sk: "Entity pre zónu '{zone}' sa nenašli. Skontroluj zone_id v konfigurácii karty." },

  editor_zone: { en: "Zone", sk: "Zóna" },
  editor_zone_placeholder: { en: "-- select a zone --", sk: "-- vyber zónu --" },
  editor_name: { en: "Custom name (optional)", sk: "Vlastný názov (voliteľné)" },
  editor_language: { en: "Language", sk: "Jazyk" },
};

// Farebna skala teploty: do 18 °C modra, okolo 21,5 °C jantarova, od 25 °C cervena.
// Interpolacia cez odtien (HSL), nie RGB - inak by stred medzi modrou a
// jantarovou vysiel spinavo sivy.
const TEMP_COLD = 18;
const TEMP_HOT = 25;
const HUE_STOPS = [[18, 217], [21.5, 40], [25, -3]];   // [teplota, odtien]
const COLOR_COLD = [76, 141, 246];   // #4C8DF6 - modra (chladi, studena)
const COLOR_HOT = [229, 72, 77];     // #E5484D - cervena (kuri, teplo)
const HISTORY_REFRESH_MS = 5 * 60 * 1000;

function tempColor(t) {
  if (t == null || isNaN(t)) return "var(--primary-text-color)";
  const [a, b, c] = HUE_STOPS;
  let hue;
  if (t <= a[0]) hue = a[1];
  else if (t >= c[0]) hue = c[1];
  else if (t <= b[0]) hue = a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0]));
  else hue = b[1] + (c[1] - b[1]) * ((t - b[0]) / (c[0] - b[0]));
  return `hsl(${((hue % 360) + 360) % 360}, 82%, 60%)`;
}

const rgbStr = (c) => `rgb(${c.join(",")})`;

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
  return hLang.toLowerCase().startsWith("sk") ? "sk" : "en";
}

// ============================================================== HLAVNA KARTA

class SmartHeatingCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._settingsOpen = false;
    this._history = [];
    this._historyFetchedAt = 0;
    this._historyLoading = false;
    this._uid = Math.random().toString(36).slice(2, 9);
  }

  setConfig(config) {
    if (!config.zone_id) {
      throw new Error("smart-heating-card: missing required field 'zone_id'");
    }
    this._config = config;
    this._zoneId = config.zone_id;
    this._built = false;
  }

  _t(key, vars) {
    const entry = I18N[key];
    const lang = resolveLang(this._hass, this._config.language);
    let text = entry ? entry[lang] || entry.en || key : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
    }
    return text;
  }

  _modeLabel(mode) {
    const lang = resolveLang(this._hass, this._config.language);
    const entry = MODE_LABELS[mode];
    return entry ? entry[lang] || entry.en : mode;
  }

  _seasonLabel(season) {
    const lang = resolveLang(this._hass, this._config.language);
    const entry = SEASON_LABELS[season];
    return entry ? entry[lang] || entry.en : season;
  }

  set hass(hass) {
    const prevHass = this._hass;
    this._hass = hass;
    if (!this._built) {
      this._buildSkeleton();
      this._built = true;
    }
    if (prevHass) {
      const relevantChanged = this._entityIds().some(
        (id) => hass.states[id] !== prevHass.states[id]
      );
      if (!relevantChanged) return;
    }
    this._updateContent();
  }

  _entityIds() {
    if (this._cachedEntityIds) return this._cachedEntityIds;
    const z = this._zoneId;
    this._cachedEntityIds = [
      eid(z, "climate"),
      eid(z, "select", "rezim"),
      eid(z, "select", "sezona"),
      eid(z, "sensor", "stav"),
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
      eid(z, "time", "den_od_tyzden"),
      eid(z, "time", "den_od_vikend"),
      eid(z, "time", "noc_od_tyzden"),
      eid(z, "time", "noc_od_vikend"),
      eid(z, "time", "predkurenie_od"),
      eid(z, "time", "predkurenie_do"),
      eid(z, "switch", "predkurenie_povolene"),
      eid(z, "switch", "reaguj_na_krb"),
      eid(z, "switch", "vyuzi_fve_prebytok"),
    ];
    return this._cachedEntityIds;
  }

  getCardSize() {
    return 6;
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
          <div class="sh-header">
            <div class="sh-title-wrap">
              <div class="sh-title"></div>
              <div class="sh-subtitle"></div>
            </div>
            <div class="sh-temp-wrap">
              <div class="sh-current-temp"></div>
              <div class="sh-target-line">
                <span class="sh-status"><span class="sh-status-dot"></span><span class="sh-status-text"></span></span>
                <span class="sh-target-temp"></span>
              </div>
            </div>
          </div>

          <div class="sh-chart" hidden>
            <div class="sh-chart-plot"></div>
            <div class="sh-chart-legend"><span class="sh-chart-span"></span><span class="sh-chart-range"></span></div>
          </div>

          <div class="sh-meta"></div>
          <div class="sh-reason"></div>
          <div class="sh-badges"></div>

          <button class="sh-settings-toggle" type="button" aria-expanded="false">
            <span class="sh-icon">⚙️</span><span>${this._t("settings")}</span><span class="sh-chev"></span>
          </button>

          <div class="sh-settings" hidden>
            ${section("sh-section--mode", "🧭", "section_mode", `<div class="sh-chips sh-mode-chips"></div>`)}
            ${section("sh-section--mode sh-season-section", "🔄", "section_season", `<div class="sh-chips sh-season-chips"></div>`, 'style="display:none"')}
            ${section("sh-section--temp", "🌡️", "section_temps", `<div class="sh-temps"></div>`)}
            ${section("sh-section--temp sh-cooling-section", "❄️", "section_cooling", `<div class="sh-cooling"></div>`, 'style="display:none"')}
            ${section("sh-section--time", "⏰", "section_times", `<div class="sh-times"></div>`)}
            ${section("sh-section--toggle", "🔀", "section_toggles", `<div class="sh-toggles"></div>`)}
            ${section("sh-section--boost", "🚀", "section_boost", `<div class="sh-boost"></div>`)}
          </div>

          <div class="sh-version">v${CARD_VERSION}</div>
        </div>
      </ha-card>
    `;

    const toggle = this.querySelector(".sh-settings-toggle");
    toggle.addEventListener("click", () => {
      this._settingsOpen = !this._settingsOpen;
      toggle.setAttribute("aria-expanded", String(this._settingsOpen));
      this.querySelector(".sh-settings").hidden = !this._settingsOpen;
      if (this._settingsOpen) this._renderSettings();
    });
  }

  _styles() {
    return `
      .sh-root { padding: 18px 18px 12px; display: flex; flex-direction: column; gap: 14px; container-type: inline-size; }

      .sh-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .sh-title { font-size: 1.15rem; font-weight: 500; color: var(--primary-text-color); line-height: 1.3; }
      .sh-subtitle { font-size: 0.8rem; color: var(--secondary-text-color); margin-top: 3px; }
      .sh-temp-wrap { text-align: right; flex-shrink: 0; }
      .sh-current-temp { font-size: 2.5rem; font-weight: 400; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; transition: color .6s ease; }
      .sh-target-line { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 8px; }
      .sh-target-temp { font-size: 0.8rem; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }

      .sh-status { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 500;
        padding: 3px 9px 3px 7px; border-radius: 999px; background: rgba(127,127,127,0.12); color: var(--secondary-text-color); }
      .sh-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
      .sh-status.heating { color: ${rgbStr(COLOR_HOT)}; background: rgba(229,72,77,0.14); }
      .sh-status.cooling { color: ${rgbStr(COLOR_COLD)}; background: rgba(76,141,246,0.14); }
      .sh-status.off { opacity: 0.7; }
      .sh-status.heating .sh-status-dot, .sh-status.cooling .sh-status-dot { animation: sh-pulse 1.8s ease-in-out infinite; }
      @keyframes sh-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      @media (prefers-reduced-motion: reduce) {
        .sh-status-dot { animation: none !important; }
        .sh-current-temp { transition: none; }
      }

      .sh-chart { display: flex; flex-direction: column; gap: 4px; }
      .sh-chart[hidden] { display: none; }
      .sh-chart-plot { position: relative; height: 64px; }
      .sh-chart-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
      .sh-chart-now { position: absolute; right: -4px; width: 8px; height: 8px; border-radius: 50%;
        transform: translateY(-50%); box-shadow: 0 0 0 3px var(--card-background-color, #1c1c1c); }
      .sh-chart-legend { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }

      .sh-meta { display: flex; gap: 16px; font-size: 0.8rem; color: var(--secondary-text-color); }
      .sh-meta span b { color: var(--primary-text-color); font-weight: 500; }
      .sh-reason { font-size: 0.8rem; color: var(--secondary-text-color); line-height: 1.4; }
      .sh-badges { display: flex; flex-wrap: wrap; gap: 6px; }
      .sh-badges:empty { display: none; }
      .sh-badge { font-size: 0.72rem; padding: 3px 9px; border-radius: 999px; font-weight: 500; }
      .sh-badge.warn { background: rgba(255,152,0,0.16); color: #d98a1a; }
      .sh-badge.err { background: rgba(229,72,77,0.16); color: ${rgbStr(COLOR_HOT)}; }
      .sh-badge.ok { background: rgba(76,175,80,0.16); color: #4caf7d; }
      .sh-badge.info { background: rgba(76,141,246,0.16); color: ${rgbStr(COLOR_COLD)}; }

      .sh-settings-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px;
        border: 1px solid var(--divider-color); border-radius: 10px; background: transparent; cursor: pointer;
        color: var(--primary-text-color); font: inherit; font-size: 0.85rem; text-align: left; }
      .sh-settings-toggle:hover { background: rgba(127,127,127,0.07); }
      .sh-settings-toggle:focus-visible, details.sh-section > summary:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .sh-chev { margin-left: auto; width: 7px; height: 7px; border-right: 1.5px solid var(--secondary-text-color);
        border-bottom: 1.5px solid var(--secondary-text-color); transform: rotate(45deg); transition: transform .2s ease; margin-top: -3px; }
      .sh-settings-toggle[aria-expanded="true"] .sh-chev { transform: rotate(-135deg); margin-top: 3px; }

      .sh-settings { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: start; }
      .sh-settings[hidden] { display: none; }
      @container (min-width: 480px) { .sh-settings { grid-template-columns: 1fr 1fr; } }

      .sh-section { border-radius: 10px; }
      .sh-section-label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 500;
        color: var(--primary-text-color); padding: 9px 12px; border-radius: 9px; background: rgba(127,127,127,0.07); }
      .sh-icon { font-size: 0.95rem; line-height: 1; }
      .sh-sum-val { margin-left: auto; font-size: 0.78rem; font-weight: 400; color: var(--secondary-text-color); }
      details.sh-section > summary.sh-section-label { cursor: pointer; list-style: none; user-select: none; }
      details.sh-section > summary.sh-section-label::-webkit-details-marker { display: none; }
      details.sh-section > summary.sh-section-label::after { content: "\\25B8"; font-size: 0.7rem; margin-left: 10px;
        color: var(--secondary-text-color); transition: transform .15s ease; }
      details.sh-section[open] > summary.sh-section-label::after { transform: rotate(90deg); }
      details.sh-section > summary.sh-section-label:hover { background: rgba(127,127,127,0.12); }
      details.sh-section > div { margin-top: 12px; padding: 0 2px; }

      .sh-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .sh-chip { font: inherit; font-size: 0.85rem; border: 1px solid var(--divider-color); border-radius: 999px; padding: 6px 14px;
        cursor: pointer; color: var(--primary-text-color); background: transparent; user-select: none; }
      .sh-chip.active { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
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
      .sh-switch.on { background: #4caf7d; }
      .sh-switch .knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s ease; }
      .sh-switch.on .knob { left: 20px; }
      .sh-boost { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .sh-boost-btn { font: inherit; font-size: 0.88rem; border: none; border-radius: 8px; background: ${rgbStr(COLOR_HOT)}; color: #fff; padding: 8px 16px; cursor: pointer; }
      .sh-boost-btn:disabled { opacity: .5; cursor: default; }
      .sh-boost-status { font-size: 0.8rem; color: var(--secondary-text-color); }
      .sh-version { font-size: 0.66rem; color: var(--secondary-text-color); opacity: 0.5; text-align: right; margin-top: -4px; }

      .sh-times-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 14px; }
      .sh-times-table:last-child { margin-bottom: 0; }
      .sh-times-table th { text-align: left; font-weight: 500; color: var(--secondary-text-color); font-size: 0.78rem; padding-bottom: 6px; }
      .sh-times-table td { padding: 4px 6px 4px 0; color: var(--primary-text-color); }
      .sh-times-table--predkurenie { max-width: 220px; }
    `;
  }

  // ------------------------------------------------------------------ update

  _updateContent() {
    if (!this._zoneId) {
      if (this.querySelector(".sh-root")) {
        this.querySelector(".sh-root").innerHTML = `<div class="sh-reason">${this._t("select_zone_first")}</div>`;
      }
      return;
    }
    const hass = this._hass;
    const zoneId = this._zoneId;
    const climate = hass.states[eid(zoneId, "climate")];
    const stavSensor = hass.states[eid(zoneId, "sensor", "stav")];

    if (!climate || !stavSensor) {
      this.querySelector(".sh-root").innerHTML =
        `<div class="sh-reason">${this._t("zone_not_found", { zone: zoneId })}</div>`;
      return;
    }

    const zoneName = this._config.name || climate.attributes.friendly_name || zoneId;
    const attrs = climate.attributes;
    const zAttrs = stavSensor.attributes;
    const current = attrs.current_temperature;

    this.querySelector(".sh-title").textContent = zoneName;
    this.querySelector(".sh-subtitle").textContent =
      zAttrs.zdroj_kurenia ? `${this._t("source")}: ${zAttrs.zdroj_kurenia}` : "";

    const tempEl = this.querySelector(".sh-current-temp");
    tempEl.textContent = current != null ? `${current}°` : "--°";
    tempEl.style.color = tempColor(current != null ? Number(current) : null);

    this.querySelector(".sh-target-temp").textContent =
      attrs.temperature != null ? `${this._t("target")} ${attrs.temperature}°` : "";
    this._renderStatus(attrs, zAttrs);
    this.querySelector(".sh-reason").textContent = stavSensor.state || "";

    this._renderMeta(zAttrs);
    this._renderBadges(zAttrs);

    const hasAc = !!hass.states[eid(zoneId, "select", "sezona")];
    this.querySelector(".sh-season-section").style.display = hasAc ? "" : "none";
    this.querySelector(".sh-cooling-section").style.display = hasAc ? "" : "none";
    this._renderSummaries(attrs, zAttrs, hasAc);

    // Obsah nastaveni sa kresli len ked su otvorene - setri vykon (hlavne na mobile).
    if (this._settingsOpen) this._renderSettings();

    this._renderChart(current != null ? Number(current) : null, attrs.temperature);
    this._maybeFetchHistory();
  }

  _renderStatus(attrs, zAttrs) {
    const action = attrs.hvac_action;
    const isCoolSeason = (zAttrs.season || zAttrs.sezona) === "Chladenie";
    let cls = "idle";
    let key = isCoolSeason ? "status_idle_cool" : "status_idle_heat";
    if ((attrs.rezim || "") === "Vypnute" || action === "off") { cls = "off"; key = "status_off"; }
    if (action === "heating") { cls = "heating"; key = "status_heating"; }
    if (action === "cooling") { cls = "cooling"; key = "status_cooling"; }
    const el = this.querySelector(".sh-status");
    el.className = `sh-status ${cls}`;
    el.querySelector(".sh-status-text").textContent = this._t(key);
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
      : (durState ? `${parseFloat(durState.state).toFixed(1)} h` : ""));
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
      this._renderSeasonChips(zAttrs.sezona || "Auto");
      this._renderCooling();
    }
    this._renderTemps();
    this._renderTimes();
    this._renderToggles();
    this._renderBoost(zAttrs);
  }

  // ------------------------------------------------------------------ graf

  _maybeFetchHistory() {
    const hass = this._hass;
    if (!hass || typeof hass.callWS !== "function" || this._historyLoading) return;
    if (Date.now() - this._historyFetchedAt < HISTORY_REFRESH_MS) return;
    const entityId = eid(this._zoneId, "climate");
    this._historyLoading = true;
    const start = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    hass
      .callWS({
        type: "history/history_during_period",
        start_time: start,
        entity_ids: [entityId],
        minimal_response: false,
        no_attributes: false,
        significant_changes_only: false,
      })
      .then((res) => {
        const rows = (res && res[entityId]) || [];
        const pts = [];
        let last = null;
        for (const r of rows) {
          const a = r.a || r.attributes;
          const v = a && a.current_temperature != null ? Number(a.current_temperature) : last;
          const t = r.lu != null ? r.lu * 1000 : Date.parse(r.last_updated || r.last_changed);
          if (v != null && !isNaN(v) && !isNaN(t)) { pts.push({ t, v }); last = v; }
        }
        this._history = pts;
        this._historyFetchedAt = Date.now();
        const c = this._hass.states[entityId];
        this._renderChart(c ? Number(c.attributes.current_temperature) : null, c ? c.attributes.temperature : null);
      })
      .catch(() => { this._historyFetchedAt = Date.now(); })
      .finally(() => { this._historyLoading = false; });
  }

  _renderChart(current, target) {
    const wrap = this.querySelector(".sh-chart");
    if (!wrap) return;
    const now = Date.now();
    let pts = this._history.filter((p) => p.t >= now - 24 * 3600 * 1000);
    if (current != null && !isNaN(current)) pts = pts.concat([{ t: now, v: current }]);
    if (pts.length < 2) { wrap.hidden = true; return; }

    // max ~150 bodov - na mobile netreba viac
    if (pts.length > 150) {
      const step = Math.ceil(pts.length / 150);
      pts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    }

    const vals = pts.map((p) => p.v);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const tgt = target != null ? Number(target) : null;
    if (tgt != null && tgt >= lo - 2 && tgt <= hi + 2) { lo = Math.min(lo, tgt); hi = Math.max(hi, tgt); }
    if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.5; hi = m + 0.5; }
    const pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;

    const W = 300, H = 64;
    const t0 = now - 24 * 3600 * 1000;
    const x = (t) => ((Math.max(t, t0) - t0) / (now - t0)) * W;
    const y = (v) => H - ((v - lo) / (hi - lo)) * H;

    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = `${line} L${x(pts[pts.length - 1].t).toFixed(1)},${H} L${x(pts[0].t).toFixed(1)},${H} Z`;
    const gid = `sh-g-${this._uid}`;
    const aid = `sh-a-${this._uid}`;
    const yHot = y(TEMP_HOT).toFixed(1), yCold = y(TEMP_COLD).toFixed(1);
    const stops = (op) => {
      let out = "";
      for (let tv = TEMP_HOT; tv >= TEMP_COLD - 1e-9; tv -= 0.5) {
        const off = (TEMP_HOT - tv) / (TEMP_HOT - TEMP_COLD);
        out += `<stop offset="${off.toFixed(3)}" stop-color="${tempColor(tv)}" stop-opacity="${op}"/>`;
      }
      return out;
    };
    const targetLine = tgt != null && tgt > lo && tgt < hi
      ? `<line x1="0" x2="${W}" y1="${y(tgt).toFixed(1)}" y2="${y(tgt).toFixed(1)}" stroke="var(--secondary-text-color)" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`
      : "";

    const lastV = pts[pts.length - 1].v;
    this.querySelector(".sh-chart-plot").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${this._t("chart_span")}">
        <defs>
          <linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${yHot}" x2="0" y2="${yCold}">${stops(1)}</linearGradient>
          <linearGradient id="${aid}" gradientUnits="userSpaceOnUse" x1="0" y1="${yHot}" x2="0" y2="${yCold}">${stops(0.18)}</linearGradient>
        </defs>
        <path d="${area}" fill="url(#${aid})" stroke="none"/>
        ${targetLine}
        <path d="${line}" fill="none" stroke="url(#${gid})" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg>
      <span class="sh-chart-now" style="top:${((y(lastV) / H) * 100).toFixed(1)}%; background:${tempColor(lastV)}"></span>`;

    const fmt = (v) => `${v.toFixed(1)}°`;
    this.querySelector(".sh-chart-span").textContent = this._t("chart_span");
    this.querySelector(".sh-chart-range").textContent = `${fmt(Math.min(...vals))} – ${fmt(Math.max(...vals))}`;
    wrap.hidden = false;
  }

  _renderMeta(zAttrs) {
    const parts = [];
    if (zAttrs.floor_temperature != null) parts.push(`<span>${this._t("floor")}: <b>${zAttrs.floor_temperature}°C</b></span>`);
    if (zAttrs.outdoor_temperature != null) parts.push(`<span>${this._t("outdoor")}: <b>${zAttrs.outdoor_temperature}°C</b></span>`);
    const wrap = this.querySelector(".sh-meta");
    wrap.innerHTML = parts.join("");
    wrap.style.display = parts.length ? "flex" : "none";
  }

  _renderBadges(zAttrs) {
    const badges = [];
    if (zAttrs.emergency_active) badges.push(["err", this._t("badge_emergency")]);
    if (zAttrs.tariff_blocked) badges.push(["warn", this._t("badge_tariff")]);
    if (zAttrs.floor_override) badges.push(["err", this._t("badge_floor")]);
    if (zAttrs.krb_override) badges.push(["warn", this._t("badge_krb")]);
    if (zAttrs.pv_active) badges.push(["ok", this._t("badge_pv")]);
    if (zAttrs.cold_outdoor_active) badges.push(["info", this._t("badge_cold")]);
    if (zAttrs.boost_active) badges.push(["info", this._t("badge_boost")]);
    const wrap = this.querySelector(".sh-badges");
    wrap.innerHTML = badges.map(([cls, label]) => `<span class="sh-badge ${cls}">${label}</span>`).join("");
    wrap.style.display = badges.length ? "flex" : "none";
  }

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
    const val = state ? parseFloat(state.state) : null;
    return `
      <div class="sh-row" data-number-row="${key}">
        <div class="sh-row-label">${label}</div>
        <div class="sh-stepper">
          <button data-act="dec" data-key="${key}" data-step="${step}">-</button>
          <span class="sh-val">${val != null ? val.toFixed(1) + (unit || "") : "--"}</span>
          <button data-act="inc" data-key="${key}" data-step="${step}">+</button>
        </div>
      </div>`;
  }

  _wireNumberRows(wrap) {
    wrap.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        const step = parseFloat(btn.dataset.step);
        const state = this._hass.states[eid(this._zoneId, "number", key)];
        if (!state) return;
        const current = parseFloat(state.state);
        const delta = btn.dataset.act === "inc" ? step : -step;
        let next = Math.round((current + delta) * 10) / 10;
        const min = state.attributes.min;
        const max = state.attributes.max;
        if (min != null) next = Math.max(min, next);
        if (max != null) next = Math.min(max, next);
        this._hass.callService("number", "set_value", {
          entity_id: eid(this._zoneId, "number", key),
          value: next,
        });
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
    wrap.innerHTML = `
      <table class="sh-times-table">
        <tr><th></th><th>${this._t("times_workday")}</th><th>${this._t("times_weekend")}</th></tr>
        <tr>
          <td>${this._t("times_day_start")}</td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("den_od_tyzden")}" data-time-key="den_od_tyzden" /></td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("den_od_vikend")}" data-time-key="den_od_vikend" /></td>
        </tr>
        <tr>
          <td>${this._t("times_night_start")}</td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("noc_od_tyzden")}" data-time-key="noc_od_tyzden" /></td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("noc_od_vikend")}" data-time-key="noc_od_vikend" /></td>
        </tr>
      </table>
      <table class="sh-times-table sh-times-table--predkurenie">
        <tr><th colspan="2">${this._t("times_preheat")}</th></tr>
        <tr>
          <td>${this._t("times_start")}</td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("predkurenie_od")}" data-time-key="predkurenie_od" /></td>
        </tr>
        <tr>
          <td>${this._t("times_end")}</td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("predkurenie_do")}" data-time-key="predkurenie_do" /></td>
        </tr>
      </table>
    `;
    wrap.querySelectorAll("input[data-time-key]").forEach((input) => {
      input.onchange = () => {
        const key = input.dataset.timeKey;
        if (!input.value) return;
        this._hass.callService("time", "set_value", {
          entity_id: eid(this._zoneId, "time", key),
          time: input.value.length === 5 ? input.value + ":00" : input.value,
        });
      };
    });
  }

  _switchRow(label, key) {
    const state = this._hass.states[eid(this._zoneId, "switch", key)];
    const on = state ? state.state === "on" : false;
    return `
      <div class="sh-row">
        <div class="sh-row-label">${label}</div>
        <div class="sh-switch ${on ? "on" : ""}" data-switch-key="${key}"><div class="knob"></div></div>
      </div>`;
  }

  _renderToggles() {
    const wrap = this.querySelector(".sh-toggles");
    const hasAc = !!this._hass.states[eid(this._zoneId, "select", "sezona")];
    wrap.innerHTML =
      this._switchRow(this._t("toggle_preheat"), "predkurenie_povolene") +
      this._switchRow(this._t("toggle_krb"), "reaguj_na_krb") +
      this._switchRow(this._t("toggle_pv"), "vyuzi_fve_prebytok") +
      (hasAc ? this._switchRow(this._t("toggle_fixed_ac_setpoint"), "pouzit_pevny_ac_setpoint") : "");
    wrap.querySelectorAll(".sh-switch").forEach((el) => {
      el.onclick = () => {
        const key = el.dataset.switchKey;
        const isOn = el.classList.contains("on");
        this._hass.callService("switch", isOn ? "turn_off" : "turn_on", {
          entity_id: eid(this._zoneId, "switch", key),
        });
      };
    });
  }

  _renderBoost(zAttrs) {
    const durState = this._hass.states[eid(this._zoneId, "number", "boost_hodiny")];
    const dur = durState ? parseFloat(durState.state) : 2;
    const active = !!zAttrs.boost_active;
    const wrap = this.querySelector(".sh-boost");
    wrap.innerHTML = `
      <div class="sh-stepper">
        <button data-boost-act="dec">-</button>
        <span class="sh-val">${dur.toFixed(1)} h</span>
        <button data-boost-act="inc">+</button>
      </div>
      <div class="sh-boost-status">${active ? this._t("boost_running") : ""}</div>
      <button class="sh-boost-btn" ${active ? "disabled" : ""}>${this._t("boost_start")}</button>
    `;
    wrap.querySelector('[data-boost-act="dec"]').onclick = () =>
      this._hass.callService("number", "set_value", {
        entity_id: eid(this._zoneId, "number", "boost_hodiny"),
        value: Math.max(0.5, Math.round((dur - 0.5) * 10) / 10),
      });
    wrap.querySelector('[data-boost-act="inc"]').onclick = () =>
      this._hass.callService("number", "set_value", {
        entity_id: eid(this._zoneId, "number", "boost_hodiny"),
        value: Math.round((dur + 0.5) * 10) / 10,
      });
    wrap.querySelector(".sh-boost-btn").onclick = () =>
      this._hass.callService("button", "press", { entity_id: eid(this._zoneId, "button", "boost") });
  }
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
    const entry = I18N[key];
    const lang = resolveLang(this._hass, this._config.language);
    return entry ? entry[lang] || entry.en || key : key;
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
        .map((z) => `<option value="${z.zone_id}" ${z.zone_id === currentZoneId ? "selected" : ""}>${z.name} (${z.zone_id})</option>`)
        .join("");
    if (select.innerHTML !== optionsHtml) select.innerHTML = optionsHtml;

    const nameInput = this.querySelector(".sh-ed-name");
    if (document.activeElement !== nameInput) nameInput.value = this._config.name || "";

    const langSelect = this.querySelector(".sh-ed-lang");
    langSelect.value = this._config.language || "auto";
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

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "smart-heating-card")) {
  window.customCards.push({
    type: "smart-heating-card",
    name: "Smart Heating",
    description: "Control card for a single Smart Heating zone.",
  });
}
