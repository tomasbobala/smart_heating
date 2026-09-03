/* Smart Heating Card
 * Vlastna Lovelace karta pre integraciu Smart Heating.
 * Ziadny build krok - cisty JS web component, staci nahrat ako Lovelace resource.
 *
 * Konfiguracia (YAML v karte, alebo pouzi vizualny editor pri pridavani karty):
 *   type: custom:smart-heating-card
 *   zone_id: "287f437c"
 *   name: "Obyvacka"   # volitelne, inak sa pouzije meno z climate entity
 */

const MODES = ["Auto", "Den", "Noc", "Min", "Mraz", "Vypnute"];
const SEASONS = ["Kurenie", "Chladenie", "Auto"];

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

// ============================================================== HLAVNA KARTA

class SmartHeatingCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    if (!config.zone_id) {
      throw new Error("smart-heating-card: chyba povinne pole 'zone_id'");
    }
    this._config = config;
    this._zoneId = config.zone_id;
    this._built = false;
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
              <div class="sh-target-temp"></div>
            </div>
          </div>

          <div class="sh-meta"></div>
          <div class="sh-reason"></div>
          <div class="sh-badges"></div>

          <div class="sh-section sh-section--mode">
            <div class="sh-section-label"><span class="sh-icon">🧭</span>Rezim</div>
            <div class="sh-chips sh-mode-chips"></div>
          </div>

          <div class="sh-section sh-section--mode sh-season-section" style="display:none">
            <div class="sh-section-label"><span class="sh-icon">🔄</span>Sezona</div>
            <div class="sh-chips sh-season-chips"></div>
          </div>

          <div class="sh-collapsible-grid">
            <details class="sh-section sh-section--temp">
              <summary class="sh-section-label"><span class="sh-icon">🌡️</span>Teploty</summary>
              <div class="sh-temps"></div>
            </details>

            <details class="sh-section sh-section--temp sh-cooling-section" style="display:none">
              <summary class="sh-section-label"><span class="sh-icon">❄️</span>Chladenie</summary>
              <div class="sh-cooling"></div>
            </details>

            <details class="sh-section sh-section--time">
              <summary class="sh-section-label"><span class="sh-icon">⏰</span>Casy</summary>
              <div class="sh-times"></div>
            </details>

            <details class="sh-section sh-section--toggle">
              <summary class="sh-section-label"><span class="sh-icon">🔀</span>Prepinace</summary>
              <div class="sh-toggles"></div>
            </details>
          </div>

          <div class="sh-section sh-section--boost">
            <div class="sh-section-label"><span class="sh-icon">🚀</span>Boost</div>
            <div class="sh-boost"></div>
          </div>
        </div>
      </ha-card>
    `;
  }

  _styles() {
    return `
      .sh-root { padding: 16px; display: flex; flex-direction: column; gap: 20px; container-type: inline-size; }
      .sh-header { display: flex; justify-content: space-between; align-items: flex-start; }
      .sh-title { font-size: 1.25rem; font-weight: 500; color: var(--primary-text-color); }
      .sh-subtitle { font-size: 0.85rem; color: var(--secondary-text-color); margin-top: 2px; }
      .sh-temp-wrap { text-align: right; }
      .sh-current-temp { font-size: 1.6rem; font-weight: 600; color: var(--primary-text-color); line-height: 1.1; }
      .sh-target-temp { font-size: 0.85rem; color: var(--secondary-text-color); }
      .sh-meta { display: flex; gap: 14px; font-size: 0.8rem; color: var(--secondary-text-color); }
      .sh-meta span b { color: var(--primary-text-color); font-weight: 600; }
      .sh-reason { font-size: 0.85rem; color: var(--secondary-text-color); background: var(--secondary-background-color, rgba(127,127,127,0.08)); border-radius: 8px; padding: 8px 10px; }
      .sh-badges { display: flex; flex-wrap: wrap; gap: 6px; }
      .sh-badge { font-size: 0.72rem; padding: 3px 8px; border-radius: 999px; font-weight: 600; }
      .sh-badge.warn { background: rgba(255,152,0,0.18); color: #b26a00; }
      .sh-badge.err { background: rgba(244,67,54,0.18); color: #c62828; }
      .sh-badge.ok { background: rgba(76,175,80,0.18); color: #2e7d32; }
      .sh-badge.info { background: rgba(33,150,243,0.18); color: #1565c0; }

      .sh-section { border-radius: 10px; }
      .sh-section-label {
        display: flex; align-items: center; gap: 8px;
        font-size: 0.85rem; font-weight: 500; color: var(--primary-text-color);
        padding: 9px 12px; border-radius: 9px;
        background: rgba(127,127,127,0.07);
      }
      .sh-icon { font-size: 0.95rem; line-height: 1; }
      details.sh-section > summary.sh-section-label { cursor: pointer; list-style: none; user-select: none; }
      details.sh-section > summary.sh-section-label::-webkit-details-marker { display: none; }
      details.sh-section > summary.sh-section-label::after { content: "\\25B8"; font-size: 0.7rem; margin-left: auto; color: var(--secondary-text-color); transition: transform .15s ease; }
      details.sh-section[open] > summary.sh-section-label::after { transform: rotate(90deg); }
      details.sh-section > summary.sh-section-label:hover { background: rgba(127,127,127,0.12); }
      details.sh-section > div { margin-top: 12px; padding: 0 2px; }

      .sh-collapsible-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
      @container (min-width: 480px) {
        .sh-collapsible-grid { grid-template-columns: 1fr 1fr; }
      }

      .sh-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .sh-chip { border: 1px solid var(--divider-color); border-radius: 999px; padding: 6px 14px; font-size: 0.85rem; cursor: pointer; color: var(--primary-text-color); background: transparent; user-select: none; }
      .sh-chip.active { background: #8e6ecb; border-color: #8e6ecb; color: #fff; }
      .sh-temps, .sh-cooling { display: flex; flex-direction: column; gap: 10px; }
      .sh-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .sh-row-label { font-size: 0.9rem; color: var(--primary-text-color); flex: 1; }
      .sh-stepper { display: flex; align-items: center; gap: 8px; }
      .sh-stepper button { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font-size: 1rem; cursor: pointer; line-height: 1; }
      .sh-stepper .sh-val { min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
      .sh-time-input { border: 1px solid var(--divider-color); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); padding: 4px 6px; font-size: 0.85rem; width: 90px; }
      .sh-toggles { display: flex; flex-direction: column; gap: 10px; }
      .sh-switch { position: relative; width: 40px; height: 22px; border-radius: 999px; background: var(--divider-color); cursor: pointer; flex-shrink: 0; }
      .sh-switch.on { background: #4caf7d; }
      .sh-switch .knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s ease; }
      .sh-switch.on .knob { left: 20px; }
      .sh-boost { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
      .sh-boost-btn { border: none; border-radius: 8px; background: #e0577a; color: #fff; padding: 8px 16px; font-size: 0.9rem; cursor: pointer; }
      .sh-boost-btn:disabled { opacity: .5; cursor: default; }
      .sh-boost-status { font-size: 0.8rem; color: var(--secondary-text-color); }

      .sh-times-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 14px; }
      .sh-times-table:last-child { margin-bottom: 0; }
      .sh-times-table th { text-align: left; font-weight: 500; color: var(--secondary-text-color); font-size: 0.78rem; padding-bottom: 6px; }
      .sh-times-table td { padding: 4px 6px 4px 0; color: var(--primary-text-color); }
      .sh-times-table td:first-child { padding-left: 0; }
      .sh-times-table--predkurenie { max-width: 220px; }
    `;
  }

  // ------------------------------------------------------------------ update

  _updateContent() {
    if (!this._zoneId) {
      if (this.querySelector(".sh-root")) {
        this.querySelector(".sh-root").innerHTML = `<div class="sh-reason">Vyber zonu v nastaveniach karty.</div>`;
      }
      return;
    }
    const hass = this._hass;
    const zoneId = this._zoneId;
    const climate = hass.states[eid(zoneId, "climate")];
    const stavSensor = hass.states[eid(zoneId, "sensor", "stav")];

    if (!climate || !stavSensor) {
      this.querySelector(".sh-root").innerHTML =
        `<div class="sh-reason">Entity pre zonu '${zoneId}' sa nenasli. Skontroluj zone_id v konfiguracii karty.</div>`;
      return;
    }

    const zoneName = this._config.name || climate.attributes.friendly_name || zoneId;
    const attrs = climate.attributes;
    const zAttrs = stavSensor.attributes;

    this.querySelector(".sh-title").textContent = zoneName;
    this.querySelector(".sh-subtitle").textContent =
      zAttrs.zdroj_kurenia ? `Zdroj: ${zAttrs.zdroj_kurenia}` : "";
    this.querySelector(".sh-current-temp").textContent =
      attrs.current_temperature != null ? `${attrs.current_temperature}°` : "--°";
    this.querySelector(".sh-target-temp").textContent =
      attrs.temperature != null ? `ciel ${attrs.temperature}°` : "";
    this.querySelector(".sh-reason").textContent = stavSensor.state || "";

    this._renderMeta(zAttrs);
    this._renderBadges(zAttrs);
    this._renderModeChips(attrs.rezim || "Auto");

    const hasAc = !!hass.states[eid(zoneId, "select", "sezona")];
    this.querySelector(".sh-season-section").style.display = hasAc ? "" : "none";
    this.querySelector(".sh-cooling-section").style.display = hasAc ? "" : "none";
    if (hasAc) {
      this._renderSeasonChips(zAttrs.sezona || "Auto");
      this._renderCooling();
    }

    this._renderTemps();
    this._renderTimes();
    this._renderToggles();
    this._renderBoost(zAttrs);
  }

  _renderMeta(zAttrs) {
    const parts = [];
    if (zAttrs.floor_temperature != null) parts.push(`<span>Podlaha: <b>${zAttrs.floor_temperature}°C</b></span>`);
    if (zAttrs.outdoor_temperature != null) parts.push(`<span>Vonku: <b>${zAttrs.outdoor_temperature}°C</b></span>`);
    const wrap = this.querySelector(".sh-meta");
    wrap.innerHTML = parts.join("");
    wrap.style.display = parts.length ? "flex" : "none";
  }

  _renderBadges(zAttrs) {
    const badges = [];
    if (zAttrs.emergency_active) badges.push(["err", "Nudzova ochrana"]);
    if (zAttrs.tariff_blocked) badges.push(["warn", "Zablokovane tarifou"]);
    if (zAttrs.floor_override) badges.push(["err", "Podlaha - max teplota"]);
    if (zAttrs.krb_override) badges.push(["warn", "Krb - vypnute"]);
    if (zAttrs.pv_active) badges.push(["ok", "FVE prebytok"]);
    if (zAttrs.cold_outdoor_active) badges.push(["info", "Nizka vonkajsia teplota"]);
    if (zAttrs.boost_active) badges.push(["info", "Boost aktivny"]);
    const wrap = this.querySelector(".sh-badges");
    wrap.innerHTML = badges.map(([cls, label]) => `<span class="sh-badge ${cls}">${label}</span>`).join("");
    wrap.style.display = badges.length ? "flex" : "none";
  }

  _renderModeChips(current) {
    const wrap = this.querySelector(".sh-mode-chips");
    wrap.innerHTML = MODES.map(
      (m) => `<button class="sh-chip ${m === current ? "active" : ""}" data-mode="${m}">${m}</button>`
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
      (s) => `<button class="sh-chip ${s === current ? "active" : ""}" data-season="${s}">${s}</button>`
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
        const next = Math.round((current + delta) * 10) / 10;
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
      this._numberRow("Teplota - den", "teplota_den", 0.5, "°C") +
      this._numberRow("Teplota - noc", "teplota_noc", 0.5, "°C") +
      this._numberRow("Teplota - min (baseline)", "teplota_min", 0.5, "°C") +
      this._numberRow("Teplota - protimrazova", "teplota_mraz", 0.5, "°C") +
      this._numberRow("Vonkajsia hranica (vynuti kurenie)", "vonkajsia_hranica", 0.5, "°C") +
      (hasAc
        ? this._numberRow("AC fyzicky setpoint (ked kuri)", "ac_setpoint_teplota", 0.5, "°C") +
          this._numberRow("AC hysterezia", "ac_hysterezia", 0.1, "°C")
        : "");
    this._wireNumberRows(wrap);
  }

  _renderCooling() {
    const wrap = this.querySelector(".sh-cooling");
    wrap.innerHTML =
      this._numberRow("Cielova teplota chladenia", "teplota_chladenie", 0.5, "°C") +
      this._numberRow("Baterka FVE - min. % pre chladenie", "bateria_hranica_chladenie", 5, "%") +
      this._numberRow("Vonkajsia hranica pre Auto-sezonu", "vonkajsia_hranica_chladenie", 0.5, "°C");
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
        <tr><th></th><th>Prac. den</th><th>Vikend</th></tr>
        <tr>
          <td>Zaciatok dna</td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("den_od_tyzden")}" data-time-key="den_od_tyzden" /></td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("den_od_vikend")}" data-time-key="den_od_vikend" /></td>
        </tr>
        <tr>
          <td>Zaciatok noci</td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("noc_od_tyzden")}" data-time-key="noc_od_tyzden" /></td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("noc_od_vikend")}" data-time-key="noc_od_vikend" /></td>
        </tr>
      </table>
      <table class="sh-times-table sh-times-table--predkurenie">
        <tr><th colspan="2">Predkurenie</th></tr>
        <tr>
          <td>Zaciatok</td>
          <td><input class="sh-time-input" type="time" value="${this._timeVal("predkurenie_od")}" data-time-key="predkurenie_od" /></td>
        </tr>
        <tr>
          <td>Koniec</td>
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
    wrap.innerHTML =
      this._switchRow("Predkurenie povolene (Po-Pia)", "predkurenie_povolene") +
      this._switchRow("Reaguj na krb", "reaguj_na_krb") +
      this._switchRow("Vyuzi FVE prebytok", "vyuzi_fve_prebytok");
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
      <div class="sh-boost-status">${active ? "Boost bezi" : ""}</div>
      <button class="sh-boost-btn" ${active ? "disabled" : ""}>Spustit Boost</button>
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

  _render() {
    if (!this._hass) return;
    const zones = findZones(this._hass);
    const currentZoneId = this._config?.zone_id || "";

    if (!this._built) {
      this.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; padding:8px 0;">
          <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
            Zona
            <select class="sh-ed-zone" style="padding:8px; border-radius:6px;"></select>
          </label>
          <label style="display:flex; flex-direction:column; gap:4px; font-size:0.9rem;">
            Vlastny nazov (volitelne)
            <input class="sh-ed-name" type="text" style="padding:8px; border-radius:6px;" />
          </label>
        </div>
      `;
      this._built = true;
      this.querySelector(".sh-ed-zone").addEventListener("change", (e) => this._emit({ zone_id: e.target.value }));
      this.querySelector(".sh-ed-name").addEventListener("input", (e) => this._emit({ name: e.target.value || undefined }));
    }

    const select = this.querySelector(".sh-ed-zone");
    const optionsHtml =
      `<option value="" disabled ${!currentZoneId ? "selected" : ""}>-- vyber zonu --</option>` +
      zones
        .map((z) => `<option value="${z.zone_id}" ${z.zone_id === currentZoneId ? "selected" : ""}>${z.name} (${z.zone_id})</option>`)
        .join("");
    if (select.innerHTML !== optionsHtml) select.innerHTML = optionsHtml;

    const nameInput = this.querySelector(".sh-ed-name");
    if (document.activeElement !== nameInput) nameInput.value = this._config.name || "";
  }

  _emit(patch) {
    const newConfig = { ...this._config, type: "custom:smart-heating-card", ...patch };
    if (!newConfig.name) delete newConfig.name;
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
    description: "Ovladacia karta pre jednu zonu Smart Heating integracie.",
  });
}
