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

const CARD_VERSION = "0.16.2";

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
  ov_heated_today: { en: "Heating today", sk: "Kúrenie dnes" },
  ov_cooled_today: { en: "Cooling today", sk: "Chladenie dnes" },
};

const STATS_REFRESH_MS = 15 * 60 * 1000;
const OVERVIEW_REFRESH_MS = 10 * 60 * 1000;
const DELTA_OK = 0.5;
const DAY_MS = 24 * 3600 * 1000;

const ICONS = {
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

          <div class="sh-row2">
            <span class="sh-delta"></span>
            <span class="sh-chip-floor"></span>
            <div class="sh-tgt">
              <button type="button" data-tgt="-1" aria-label="${this._t("decrease")}">−</button>
              <span class="sh-tgt-v" title="${this._t("target")}"><span class="lbl">${this._t("target")} </span><b></b></span>
              <button type="button" data-tgt="1" aria-label="${this._t("increase")}">+</button>
            </div>
          </div>

          <div class="sh-ft">
            <div class="sh-seg" role="group" aria-label="${this._t("section_mode")}"></div>
            <button class="sh-gear" type="button" aria-expanded="false" aria-label="${this._t("settings")}" title="${this._t("settings")}">${ICONS.gear}</button>
          </div>
          <div class="sh-why"><span class="sh-badges"></span><span class="sh-why-t"></span></div>

          <div class="sh-settings" hidden>
            ${section("sh-section--mode", "🧭", "section_mode", `<div class="sh-chips sh-mode-chips"></div>`)}
            ${section("sh-section--mode sh-season-section", "🔄", "section_season", `<div class="sh-chips sh-season-chips"></div>`, 'style="display:none"')}
            ${section("sh-section--temp", "🌡️", "section_temps", `<div class="sh-temps"></div>`)}
            ${section("sh-section--temp sh-cooling-section", "❄️", "section_cooling", `<div class="sh-cooling"></div>`, 'style="display:none"')}
            ${section("sh-section--time", "⏰", "section_times", `<div class="sh-times"></div>`)}
            ${section("sh-section--toggle", "🔀", "section_toggles", `<div class="sh-toggles"></div>`)}
            ${section("sh-section--boost", "🚀", "section_boost", `<div class="sh-boost"></div>`)}
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
      .sh-delta { font-size: 12px; font-weight: 650; padding: 4px 9px; border-radius: 8px; white-space: nowrap; }
      .sh-delta:empty, .sh-chip-floor:empty { display: none; }
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

      .sh-why { font-size: 11.5px; color: var(--sh-sub); opacity: .85; margin-top: 8px; line-height: 1.45; min-height: 1.45em;
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
      .sh-icon { font-size: 0.95rem; line-height: 1; }
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
      this._showMessage(this._t("zone_not_found", { zone: zoneId }));
      return;
    }
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

  _renderBadges(zAttrs) {
    const badges = [];
    if (zAttrs.emergency_active) badges.push(["err", this._t("badge_emergency")]);
    if (zAttrs.tariff_blocked) badges.push(["warn", this._t("badge_tariff")]);
    if (zAttrs.floor_override) badges.push(["err", this._t("badge_floor")]);
    if (zAttrs.krb_override) badges.push(["warn", this._t("badge_krb")]);
    if (zAttrs.pv_active) badges.push(["ok", this._t("badge_pv")]);
    if (zAttrs.cold_outdoor_active) badges.push(["info", this._t("badge_cold")]);
    if (zAttrs.boost_active) badges.push(["info", this._t("badge_boost")]);
    const reason = String((this._hass.states[eid(this._zoneId, "sensor", "stav")] || {}).state || "").toLowerCase();
    this.querySelector(".sh-badges").innerHTML = badges
      .filter(([, label]) => !reason.includes(label.toLowerCase()))
      .map(([cls, label]) => `<span class="sh-badge ${cls}">${esc(label)}</span>`).join("");
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
      (hasAc ? this._switchRow(this._t("toggle_fixed_ac_setpoint"), "pouzit_pevny_ac_setpoint") : "");
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
      if (!changed) return;
    }
    this._render();
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
      .sho-out .tr:empty { display: none; }
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
        <div class="sho-blk sho-out"><div class="v"></div><div class="l">${this._t("ov_outside")}</div><div class="tr"></div></div>
        <div class="sho-blk sho-tiles"></div>
        <div class="sho-blk sho-sum"></div>
      </div></ha-card>`;
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
        const used = n((z) => z.s.pv_active);
        const ent = this._zoneEntities("pv_surplus_entity")[0];
        const surplus = ent ? this._isOn(ent) : used > 0;
        return {
          icon: "mdi:solar-power-variant",
          label: this._t("ov_pv"),
          value: used ? this._t("ov_pv_on") : surplus ? this._t("ov_yes") : this._t("ov_no"),
          cls: surplus || used ? "on" : "",
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
        <div class="i"><ha-icon icon="${esc(t.icon)}"></ha-icon></div>
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
      wrap.innerHTML = `<div class="sho-msg">${this._t("no_zones")}</div>`;
      return;
    }
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
    wrap.innerHTML =
      row("var(--sh-ok)", this._t("ov_on_target"), ok) +
      row("var(--sh-warn)", this._t("ov_above"), up) +
      row("var(--sh-cool)", this._t("ov_below"), dn) +
      row("", this._t(cooling ? "ov_cooled_today" : "ov_heated_today"), runtime);
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
    if (outdoor && hass.states[outdoor] && now - this._outdoorFetchedAt > OVERVIEW_REFRESH_MS) {
      const start = Math.min(midnight.getTime(), now - 3 * 3600 * 1000);
      jobs.push(
        hass.callWS({
          type: "history/history_during_period",
          start_time: new Date(start).toISOString(),
          end_time: new Date(now).toISOString(),
          entity_ids: [outdoor],
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
          this._outdoorHist = {
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
