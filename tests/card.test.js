"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const CARD_SRC = fs.readFileSync(
  path.join(__dirname, "..", "custom_components", "smart_heating", "www", "smart-heating-card.js"),
  "utf8"
);

/** Nacita kartu do noveho, izolovaneho jsdom okna (kazdy test dostane cisty
 * customElements registry, aby sa navzajom neovplyvnovali). */
function loadCard() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  window.eval(CARD_SRC);
  return {
    window,
    document: window.document,
    CardClass: window.customElements.get("smart-heating-card"),
    EditorClass: window.customElements.get("smart-heating-card-editor"),
    OverviewClass: window.customElements.get("smart-heating-overview"),
  };
}

const ZONE_ID = "abc12345";

function openSettings(card) {
  card.querySelector(".sh-gear").click();
}

function buildHass(overrides = {}) {
  const z = ZONE_ID;
  const climateAttrs = Object.assign(
    {
      friendly_name: "Obyvacka",
      current_temperature: 22.5,
      temperature: 23,
      rezim: "Auto",
      sezona: undefined,
      zone_type: "floor",
      zdroj_kurenia: undefined,
    },
    overrides.climateAttrs || {}
  );
  const stavAttrs = Object.assign(
    {
      zone_id: z,
      season: "Kurenie",
      release_control: false,
      floor_temperature: 21,
      outdoor_temperature: 5,
      floor_override: false,
      krb_override: false,
      tariff_blocked: false,
      emergency_active: false,
      pv_active: false,
      cold_outdoor_active: false,
      boost_active: false,
      heating_allowed: true,
      zdroj_kurenia: undefined,
    },
    overrides.stavAttrs || {}
  );

  const states = {
    [`climate.smart_heating_${z}`]: { state: "heat", attributes: climateAttrs },
    [`sensor.smart_heating_${z}_stav`]: { state: "Auto: test dovod", attributes: stavAttrs },
    [`number.smart_heating_${z}_teplota_den`]: { state: "23" },
    [`number.smart_heating_${z}_teplota_noc`]: { state: "19" },
    [`number.smart_heating_${z}_teplota_min`]: { state: "17" },
    [`number.smart_heating_${z}_teplota_mraz`]: { state: "10" },
    [`number.smart_heating_${z}_vonkajsia_hranica`]: { state: "-5" },
    [`number.smart_heating_${z}_boost_hodiny`]: { state: "2" },
    [`switch.smart_heating_${z}_predkurenie_povolene`]: { state: "on" },
    [`switch.smart_heating_${z}_reaguj_na_krb`]: { state: "off" },
    [`switch.smart_heating_${z}_vyuzi_fve_prebytok`]: { state: "on" },
    [`time.smart_heating_${z}_den_od_tyzden`]: { state: "05:00:00" },
    [`time.smart_heating_${z}_den_od_vikend`]: { state: "06:45:00" },
    [`time.smart_heating_${z}_noc_od_tyzden`]: { state: "20:00:00" },
    [`time.smart_heating_${z}_noc_od_vikend`]: { state: "21:00:00" },
    [`time.smart_heating_${z}_predkurenie_od`]: { state: "15:00:00" },
    [`time.smart_heating_${z}_predkurenie_do`]: { state: "17:30:00" },
  };

  if (overrides.hasAc) {
    states[`select.smart_heating_${z}_sezona`] = { state: stavAttrs.season || "Kurenie" };
    states[`number.smart_heating_${z}_teplota_chladenie`] = { state: "26" };
    states[`number.smart_heating_${z}_bateria_hranica_chladenie`] = { state: "50" };
    states[`number.smart_heating_${z}_vonkajsia_hranica_chladenie`] = { state: "24" };
    states[`number.smart_heating_${z}_ac_setpoint_teplota`] = { state: "26" };
    states[`number.smart_heating_${z}_ac_hysterezia`] = { state: "0.3" };
  }

  return { states, language: overrides.language || "sk", callService: () => {} };
}

test("setConfig throws without zone_id", () => {
  const { CardClass } = loadCard();
  const card = new CardClass();
  assert.throws(() => card.setConfig({}), /zone_id/);
});

test("shows 'not found' message when zone entities are missing", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: "doesnotexist" });
  card.hass = buildHass();
  document.body.appendChild(card);
  const reason = card.querySelector(".sh-msg").textContent;
  assert.match(reason, /doesnotexist/);
});

test("renders zone name, current and target temperature", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-title").textContent, "Obyvacka");
  assert.strictEqual(card.querySelector(".sh-temp").textContent, "22,5°");
  assert.strictEqual(card.querySelector(".sh-tgt b").textContent, "23°");
});

test("custom name in config overrides climate friendly_name", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, name: "Moja izba" });
  card.hass = buildHass();
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-title").textContent, "Moja izba");
});

test("language: en renders English section labels", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "en" });
  card.hass = buildHass();
  document.body.appendChild(card);
  const labels = Array.from(card.querySelectorAll(".sh-section-label")).map((el) => el.textContent);
  assert.ok(labels.some((l) => l.includes("Mode")));
  assert.ok(labels.some((l) => l.includes("Temperatures")));
});

test("language: sk (default/explicit) renders Slovak section labels", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  card.hass = buildHass();
  document.body.appendChild(card);
  const labels = Array.from(card.querySelectorAll(".sh-section-label")).map((el) => el.textContent);
  assert.ok(labels.some((l) => l.includes("Režim")));
  assert.ok(labels.some((l) => l.includes("Teploty")));
});

test("language: auto follows hass.language", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID }); // no explicit language -> auto
  card.hass = buildHass({ language: "en" });
  document.body.appendChild(card);
  const labels = Array.from(card.querySelectorAll(".sh-section-label")).map((el) => el.textContent);
  assert.ok(labels.some((l) => l.includes("Mode")));
});

test("mode chip matching climate attrs.rezim is marked active", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ climateAttrs: { rezim: "Noc" } });
  document.body.appendChild(card);
  openSettings(card);
  const active = card.querySelector(".sh-mode-chips .sh-chip.active");
  assert.strictEqual(active.dataset.mode, "Noc");
});

test("season/cooling sections hidden when zone has no AC", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ hasAc: false });
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-season-section").style.display, "none");
  assert.strictEqual(card.querySelector(".sh-cooling-section").style.display, "none");
});

test("season/cooling sections visible when zone has AC (sezona select present)", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ hasAc: true });
  document.body.appendChild(card);
  assert.notStrictEqual(card.querySelector(".sh-season-section").style.display, "none");
  assert.notStrictEqual(card.querySelector(".sh-cooling-section").style.display, "none");
});

test("fixed AC setpoint toggle shown only for AC zones", () => {
  const { CardClass, document } = loadCard();

  const cardAc = new CardClass();
  cardAc.setConfig({ zone_id: ZONE_ID });
  cardAc.hass = buildHass({ hasAc: true });
  document.body.appendChild(cardAc);
  openSettings(cardAc);
  const rowsAc = Array.from(cardAc.querySelectorAll(".sh-row-label")).map((el) => el.textContent);
  assert.ok(rowsAc.some((t) => /pevný AC setpoint/i.test(t)));

  const cardFloor = new CardClass();
  cardFloor.setConfig({ zone_id: ZONE_ID });
  cardFloor.hass = buildHass({ hasAc: false });
  document.body.appendChild(cardFloor);
  openSettings(cardFloor);
  const rowsFloor = Array.from(cardFloor.querySelectorAll(".sh-row-label")).map((el) => el.textContent);
  assert.ok(!rowsFloor.some((t) => /pevný AC setpoint/i.test(t)));
});

test("fixed AC setpoint toggle reflects entity state and toggles via click", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const hass = buildHass({ hasAc: true });
  hass.states[`switch.smart_heating_${ZONE_ID}_pouzit_pevny_ac_setpoint`] = { state: "on" };
  const calls = [];
  hass.callService = (domain, service, data) => calls.push({ domain, service, data });
  card.hass = hass;
  document.body.appendChild(card);
  openSettings(card);

  const rows = Array.from(card.querySelectorAll(".sh-row"));
  const row = rows.find((r) => /pevný AC setpoint/i.test(r.querySelector(".sh-row-label").textContent));
  const toggle = row.querySelector(".sh-switch");
  assert.ok(toggle.classList.contains("on"));

  toggle.click();
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].service, "turn_off");
  assert.strictEqual(calls[0].data.entity_id, `switch.smart_heating_${ZONE_ID}_pouzit_pevny_ac_setpoint`);
});

test("badges render for active safety/status flags", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ stavAttrs: { emergency_active: true, tariff_blocked: true } });
  document.body.appendChild(card);
  const badgeTexts = Array.from(card.querySelectorAll(".sh-badge")).map((el) => el.textContent);
  assert.ok(badgeTexts.some((t) => /núdzová|emergency/i.test(t)));
  assert.ok(badgeTexts.some((t) => /tarifou|tariff/i.test(t)));
});

test("no badges shown when nothing is active", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  assert.strictEqual(card.querySelectorAll(".sh-badge").length, 0);
});

test("getStubConfig picks the first zone alphabetically", () => {
  const { CardClass } = loadCard();
  const hass = {
    states: {
      "climate.smart_heating_zzz": { attributes: { friendly_name: "Zeta" } },
      "climate.smart_heating_aaa": { attributes: { friendly_name: "Alpha" } },
    },
  };
  const stub = CardClass.getStubConfig(hass);
  assert.strictEqual(stub.zone_id, "aaa");
});

test("editor renders zone dropdown from available zones and emits config-changed", () => {
  const { EditorClass, document } = loadCard();
  const editor = new EditorClass();
  const hass = {
    language: "sk",
    states: {
      [`climate.smart_heating_${ZONE_ID}`]: { attributes: { friendly_name: "Obyvacka" } },
    },
  };
  editor.setConfig({});
  editor.hass = hass;
  document.body.appendChild(editor);

  const options = Array.from(editor.querySelectorAll(".sh-ed-zone option")).map((o) => o.value);
  assert.ok(options.includes(ZONE_ID));

  let emitted = null;
  editor.addEventListener("config-changed", (e) => {
    emitted = e.detail.config;
  });
  const select = editor.querySelector(".sh-ed-zone");
  select.value = ZONE_ID;
  select.dispatchEvent(new editor.ownerDocument.defaultView.Event("change"));

  assert.ok(emitted);
  assert.strictEqual(emitted.zone_id, ZONE_ID);
});

test("card only re-renders when a relevant entity actually changed", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const hass1 = buildHass();
  card.hass = hass1;
  document.body.appendChild(card);

  let renderCount = 0;
  const originalUpdate = card._updateContent.bind(card);
  card._updateContent = (...args) => {
    renderCount += 1;
    return originalUpdate(...args);
  };

  // Rovnaky obsah (nove objekty, ale rovnake hodnoty) - hass su ROVNAKE referencie,
  // takze by nemalo dojst k prekresleniu.
  card.hass = hass1;
  assert.strictEqual(renderCount, 0);

  // Zmena relevantnej entity (nova referencia stavu) - malo by prekreslit.
  const hass2 = buildHass();
  hass2.states[`climate.smart_heating_${ZONE_ID}`] = {
    ...hass2.states[`climate.smart_heating_${ZONE_ID}`],
    attributes: { ...hass2.states[`climate.smart_heating_${ZONE_ID}`].attributes, current_temperature: 30 },
  };
  card.hass = hass2;
  assert.strictEqual(renderCount, 1);
});

test("settings are closed by default and their content is not rendered", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-settings").hidden, true);
  assert.strictEqual(card.querySelector(".sh-mode-chips").children.length, 0);
  openSettings(card);
  assert.strictEqual(card.querySelector(".sh-settings").hidden, false);
  assert.ok(card.querySelector(".sh-mode-chips").children.length > 0);
});

test("mode summary shows current mode even when collapsed", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  card.hass = buildHass({ climateAttrs: { rezim: "Noc" } });
  document.body.appendChild(card);
  const val = card.querySelector(".sh-section--mode:not(.sh-season-section) .sh-sum-val").textContent;
  assert.strictEqual(val, "Noc");
});

function statusText(hassOverrides) {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  card.hass = buildHass(hassOverrides);
  document.body.appendChild(card);
  const el = card.querySelector(".sh-pill");
  return { text: el.textContent, cls: el.className, root: card.querySelector(".sh-root").className };
}

test("status: heating", () => {
  const r = statusText({ climateAttrs: { hvac_action: "heating" } });
  assert.strictEqual(r.text, "Kúri");
  assert.match(r.cls, /\bheat\b/);
  assert.match(r.root, /is-heat/);
});

test("status: idle in heating season = Nekúri", () => {
  assert.strictEqual(statusText({ climateAttrs: { hvac_action: "idle" } }).text, "Nekúri");
});

test("status: idle in cooling season = Nechladí", () => {
  const r = statusText({ climateAttrs: { hvac_action: "idle" }, stavAttrs: { season: "Chladenie" } });
  assert.strictEqual(r.text, "Nechladí");
});

test("status: cooling", () => {
  assert.strictEqual(statusText({ climateAttrs: { hvac_action: "cooling" } }).text, "Chladí");
});

test("status: mode Vypnute = Vypnuté", () => {
  assert.strictEqual(statusText({ climateAttrs: { rezim: "Vypnute", hvac_action: "off" } }).text, "Vypnuté");
});

function statsHass(rowsFn) {
  const hass = buildHass();
  hass.states[`sensor.smart_heating_${ZONE_ID}_teplota`] = { state: "22", attributes: {} };
  const calls = [];
  hass.callWS = async (msg) => { calls.push(msg); return rowsFn(msg); };
  return { hass, calls };
}

test("chart legend: min / avg / max over 24 h from 5-minute statistics", async () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const now = Date.now();
  const sid = `sensor.smart_heating_${ZONE_ID}_teplota`;
  const { hass, calls } = statsHass(() => ({
    [sid]: [
      { start: now - 2 * 3600e3, mean: 21, min: 20.5, max: 21.5 },
      { start: new Date(now - 1 * 3600e3).toISOString(), mean: 23, min: 22.5, max: 23.5 },
    ],
  }));
  card.hass = hass;
  document.body.appendChild(card);
  await new Promise((r) => setTimeout(r, 20));

  assert.strictEqual(calls[0].type, "recorder/statistics_during_period");
  assert.deepStrictEqual(Array.from(calls[0].statistic_ids), [sid]);
  assert.strictEqual(calls[0].period, "5minute");
  const span = Date.parse(calls[0].end_time) - Date.parse(calls[0].start_time);
  assert.ok(Math.abs(span - 24 * 3600e3) < 5000);
  assert.strictEqual(card.querySelector(".sh-lg-v").textContent, "min 20,5° · Ø 22,0° · max 23,5°");
  assert.ok(card.querySelector(".sh-spark path"), "sparkline path rendered");
  assert.ok(!card.querySelector(".sh-mid").classList.contains("no-chart"));
});

test("chart hidden when the integration has no temperature sensor (old version)", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const hass = buildHass();
  let called = false;
  hass.callWS = async () => { called = true; return {}; };
  card.hass = hass;
  document.body.appendChild(card);
  assert.ok(card.querySelector(".sh-mid").classList.contains("no-chart"));
  assert.strictEqual(called, false);
});

test("chart legend is empty while there is no data yet", async () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const { hass } = statsHass(() => ({}));
  card.hass = hass;
  document.body.appendChild(card);
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(card.querySelector(".sh-lg-v").textContent, "");
});

test("stats are not re-fetched on every state update", async () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const { hass, calls } = statsHass(() => ({}));
  card.hass = hass;
  document.body.appendChild(card);
  await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 5; i++) {
    const h = { ...hass, states: { ...hass.states } };
    const cid = `climate.smart_heating_${ZONE_ID}`;
    h.states[cid] = { ...h.states[cid], attributes: { ...h.states[cid].attributes, current_temperature: 20 + i } };
    card.hass = h;
  }
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(calls.length, 1);
});

function deltaOf(current, target) {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  card.hass = buildHass({ climateAttrs: { current_temperature: current, temperature: target } });
  document.body.appendChild(card);
  const el = card.querySelector(".sh-delta");
  return { text: el.textContent, cls: el.className };
}

test("delta chip: on target within ±0.5 °C, otherwise above / below", () => {
  assert.deepStrictEqual(deltaOf(23.4, 23), { text: "v cieli", cls: "sh-delta ok" });
  assert.deepStrictEqual(deltaOf(24.5, 23), { text: "+1,5° nad", cls: "sh-delta up" });
  assert.deepStrictEqual(deltaOf(21.4, 23), { text: "−1,6° pod", cls: "sh-delta dn" });
});

test("floor chip shows floor temperature", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  card.hass = buildHass({ stavAttrs: { floor_temperature: 26.5 } });
  document.body.appendChild(card);
  assert.match(card.querySelector(".sh-chip-floor").textContent, /Podlaha\s*26,5°/);
});

test("target +/- buttons are debounced into one climate.set_temperature call", async () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  const hass = buildHass({ climateAttrs: { temperature: 23, min_temp: 7, max_temp: 35 } });
  const calls = [];
  hass.callService = (domain, service, data) => { calls.push({ domain, service, data }); return Promise.resolve(); };
  card.hass = hass;
  document.body.appendChild(card);

  const plus = card.querySelector('.sh-tgt button[data-tgt="1"]');
  plus.click();
  plus.click();
  assert.strictEqual(card.querySelector(".sh-tgt b").textContent, "24°");
  assert.strictEqual(calls.length, 0);
  await new Promise((r) => setTimeout(r, 800));
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].domain, "climate");
  assert.strictEqual(calls[0].service, "set_temperature");
  assert.strictEqual(calls[0].data.temperature, 24);
});

test("target buttons are disabled in mode Vypnute", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ climateAttrs: { rezim: "Vypnute", hvac_action: "off" } });
  document.body.appendChild(card);
  card.querySelectorAll(".sh-tgt button").forEach((b) => assert.strictEqual(b.disabled, true));
  assert.strictEqual(card.querySelector(".sh-delta").textContent, "");
});

test("mode bar: quick modes, active one highlighted, click selects option", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const hass = buildHass({ climateAttrs: { rezim: "Auto" } });
  const calls = [];
  hass.callService = (domain, service, data) => calls.push({ domain, service, data });
  card.hass = hass;
  document.body.appendChild(card);
  const modes = Array.from(card.querySelectorAll(".sh-seg button")).map((b) => b.dataset.mode);
  assert.deepStrictEqual(modes, ["Auto", "Den", "Noc", "Min"]);
  assert.strictEqual(card.querySelector(".sh-seg button.a").dataset.mode, "Auto");
  card.querySelector('.sh-seg button[data-mode="Noc"]').click();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0])), {
    domain: "select",
    service: "select_option",
    data: { entity_id: `select.smart_heating_${ZONE_ID}_rezim`, option: "Noc" },
  });
});

test("mode bar shows Mraz / Vypnute only while it is the active mode", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ climateAttrs: { rezim: "Mraz" } });
  document.body.appendChild(card);
  const active = card.querySelector(".sh-seg button.a");
  assert.strictEqual(active.dataset.mode, "Mraz");
  assert.ok(active.classList.contains("special"));
  assert.strictEqual(card.querySelectorAll(".sh-seg button").length, 5);
});

test("reason line shows the stav sensor state; no version label on the card", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-why-t").textContent, "Auto: test dovod");
  assert.strictEqual(card.querySelector(".sh-version"), null);
});

// ------------------------------------------------------------------ overview

function overviewHass() {
  const zones = [
    ["aaa11111", "Alpha", 22.0, 22, "heating", "Auto", { pv_active: true }],
    ["bbb22222", "Beta", 24.0, 22, "idle", "Auto", {}],
    ["ccc33333", "Gamma", 20.0, 22, "idle", "Noc", { tariff_blocked: true }],
    ["ddd44444", "Delta", 15.0, 8, "off", "Vypnute", {}],
  ];
  const states = {};
  for (const [id, name, cur, tgt, action, mode, flags] of zones) {
    states[`climate.smart_heating_${id}`] = {
      state: "heat",
      attributes: { friendly_name: name, current_temperature: cur, temperature: tgt, hvac_action: action, rezim: mode },
    };
    states[`sensor.smart_heating_${id}_stav`] = {
      state: "x",
      attributes: Object.assign({ season: "Kurenie", outdoor_temperature: 7.5 }, flags),
    };
  }
  states["input_boolean.navsteva"] = { state: "on", attributes: { friendly_name: "Navsteva" } };
  states["person.a"] = { state: "home", attributes: { friendly_name: "Tomas B" } };
  states["person.b"] = { state: "not_home", attributes: { friendly_name: "Monika B" } };
  return { states, language: "sk", callService: () => {} };
}

function renderOverview(config, hass) {
  const { OverviewClass, document } = loadCard();
  const card = new OverviewClass();
  card.setConfig({ type: "custom:smart-heating-overview", ...config });
  card.hass = hass || overviewHass();
  document.body.appendChild(card);
  return card;
}

function pvTile(card) {
  return Array.from(card.querySelectorAll(".sho-tile")).find((t) => /FVE/.test(t.textContent));
}

test("overview: solar tile says 'in use' only when a solar-boosted zone actually heats", () => {
  const card = renderOverview({});            // Alpha: pv_active + heating
  assert.match(pvTile(card).textContent, /Využíva sa/);
});

test("overview: solar surplus active but no zone heating is not 'in use'", () => {
  const hass = overviewHass();
  hass.states["climate.smart_heating_aaa11111"].attributes.hvac_action = "idle"; // v cieli
  const card = renderOverview({}, hass);
  const text = pvTile(card).textContent;
  assert.doesNotMatch(text, /Využíva sa/);
  assert.match(text, /Áno/);
});

test("overview: outdoor temperature falls back to the integration attribute", () => {
  const card = renderOverview({});
  assert.strictEqual(card.querySelector(".sho-out .v").textContent, "7,5 °C");
});

test("overview: default tiles and heating count (off zones not counted)", () => {
  const card = renderOverview({});
  const tiles = Array.from(card.querySelectorAll(".sho-tile")).map((t) => ({
    k: t.querySelector(".k").textContent,
    s: t.querySelector(".s").textContent,
    cls: t.className,
  }));
  assert.deepStrictEqual(tiles.map((t) => t.k), ["Kúri sa", "FVE prebytok", "Tarifa", "Krb"]);
  assert.strictEqual(tiles[0].s, "1 z 3 izieb");
  assert.match(tiles[0].cls, /hot/);
  assert.match(tiles[1].cls, /\bon\b/);
  assert.match(tiles[2].cls, /warn/);
});

test("overview: custom entity tiles and multi-entity presence tile", () => {
  const card = renderOverview({
    tiles: [
      { entity: "input_boolean.navsteva", name: "Návšteva" },
      { name: "Doma", entities: ["person.a", "person.b"] },
    ],
  });
  const tiles = Array.from(card.querySelectorAll(".sho-tile"));
  assert.strictEqual(tiles[0].querySelector(".s").textContent, "Áno");
  assert.strictEqual(tiles[0].dataset.entity, "input_boolean.navsteva");
  assert.strictEqual(tiles[1].querySelector(".s").textContent, "Tomas");
});

test("overview: summary counts on target / above / below, skipping Vypnute", () => {
  const card = renderOverview({});
  const rows = Array.from(card.querySelectorAll(".sho-sum .r")).map((r) => r.querySelector("b").textContent);
  assert.deepStrictEqual(rows.slice(0, 3), ["1", "1", "1"]);
});

test("overview: heating time today is the union of zone heating intervals", async () => {
  const hass = overviewHass();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime() / 1000;
  const now = Date.now() / 1000;
  hass.callWS = async (msg) => {
    if (msg.type !== "history/history_during_period") return {};
    const out = {};
    for (const id of msg.entity_ids) out[id] = [{ s: "heat", a: { hvac_action: "idle" }, lu: t0 }];
    if (now - t0 > 3 * 3600) {
      // Alpha 60 min, Beta 60 min s prekryvom 30 min -> spolu 90 min
      out[msg.entity_ids[0]].push({ s: "heat", a: { hvac_action: "heating" }, lu: now - 3 * 3600 });
      out[msg.entity_ids[0]].push({ s: "heat", a: { hvac_action: "idle" }, lu: now - 2 * 3600 });
      out[msg.entity_ids[1]].push({ s: "heat", a: { hvac_action: "heating" }, lu: now - 2.5 * 3600 });
      out[msg.entity_ids[1]].push({ s: "heat", a: { hvac_action: "idle" }, lu: now - 1.5 * 3600 });
    }
    return out;
  };
  const card = renderOverview({}, hass);
  await new Promise((r) => setTimeout(r, 30));
  const last = Array.from(card.querySelectorAll(".sho-sum .r")).pop();
  const expected = now - t0 > 3 * 3600 ? "1 h 30 min" : "0 min";
  assert.strictEqual(last.querySelector("b").textContent, expected);
});

test("overview: without config uses the integration's outdoor sensor and presence entities", () => {
  const hass = overviewHass();
  for (const id of Object.keys(hass.states)) {
    if (id.endsWith("_stav")) {
      Object.assign(hass.states[id].attributes, {
        outdoor_entity: "sensor.vonku",
        presence_entities: ["person.a", "person.b"],
        manual_presence_entities: ["input_boolean.navsteva"],
      });
    }
  }
  hass.states["sensor.vonku"] = { state: "3.2", attributes: {} };
  const card = renderOverview({}, hass);
  assert.strictEqual(card.querySelector(".sho-out .v").textContent, "3,2 °C");
  const tiles = Array.from(card.querySelectorAll(".sho-tile")).map((t) => [
    t.querySelector(".k").textContent,
    t.querySelector(".s").textContent,
  ]);
  assert.deepStrictEqual(tiles.slice(0, 3), [["Kúri sa", "1 z 3 izieb"], ["Doma", "Tomas"], ["Návšteva", "Áno"]]);
  assert.strictEqual(tiles.length, 6);
});

test("chart label shows the real span while statistics cover less than a day", async () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const now = Date.now();
  const sid = `sensor.smart_heating_${ZONE_ID}_teplota`;
  const rows = [];
  for (let k = 0; k < 9 * 12; k++) rows.push({ start: now - 9 * 3600e3 + k * 300e3, mean: 22, min: 22, max: 22 });
  const { hass } = statsHass(() => ({ [sid]: rows }));
  card.hass = hass;
  document.body.appendChild(card);
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(card.querySelector(".sh-lg-span").textContent, "9 h");
});

function withIntegrationAttrs(hass, attrs) {
  for (const id of Object.keys(hass.states)) {
    if (id.endsWith("_stav")) Object.assign(hass.states[id].attributes, attrs);
  }
  return hass;
}

test("overview: guests tile toggles the input_boolean instead of opening more-info", () => {
  const hass = withIntegrationAttrs(overviewHass(), { manual_presence_entities: ["input_boolean.navsteva"] });
  const calls = [];
  hass.callService = (domain, service, data) => { calls.push({ domain, service, data }); return Promise.resolve(); };
  const card = renderOverview({ tiles: ["guests"] }, hass);
  let moreInfo = 0;
  card.addEventListener("hass-more-info", () => { moreInfo += 1; });
  card.querySelector(".sho-tile").click();
  assert.strictEqual(moreInfo, 0);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].domain, "input_boolean");
  assert.strictEqual(calls[0].service, "toggle");
  assert.strictEqual(calls[0].data.entity_id, "input_boolean.navsteva");
});

test("overview: custom tile tap_action more-info opens the dialog", () => {
  const card = renderOverview({ tiles: [{ entity: "input_boolean.navsteva", tap_action: "more-info" }] });
  let opened = null;
  card.addEventListener("hass-more-info", (e) => { opened = e.detail.entityId; });
  card.querySelector(".sho-tile").click();
  assert.strictEqual(opened, "input_boolean.navsteva");
});

test("overview: tariff tile lights up when the tariff entity allows heating", () => {
  const hass = withIntegrationAttrs(overviewHass(), { tariff_entity: "input_boolean.tarifa", tariff_blocked: false });
  hass.states["input_boolean.tarifa"] = { state: "on", attributes: {} };
  let card = renderOverview({ tiles: ["tariff"] }, hass);
  let tile = card.querySelector(".sho-tile");
  assert.match(tile.className, /\bon\b/);
  assert.strictEqual(tile.querySelector(".s").textContent, "Aktívna");
  hass.states["input_boolean.tarifa"] = { state: "off", attributes: {} };
  card = renderOverview({ tiles: ["tariff"] }, hass);
  tile = card.querySelector(".sho-tile");
  assert.match(tile.className, /warn/);
  assert.strictEqual(tile.querySelector(".s").textContent, "Blokuje kúrenie");
});

test("overview: heating time uses the light binary_sensor history when available", async () => {
  const hass = overviewHass();
  const ids = Object.keys(hass.states).filter((id) => id.startsWith("climate.")).map((id) => id.replace("climate.", "binary_sensor.") + "_v_chode");
  for (const id of ids) hass.states[id] = { state: "off", attributes: {} };
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime() / 1000;
  const now = Date.now() / 1000;
  let msg = null;
  hass.callWS = async (m) => {
    msg = m;
    const out = {};
    for (const id of m.entity_ids) out[id] = [{ s: "off", lu: t0 }];
    if (now - t0 > 2 * 3600) {
      out[m.entity_ids[0]].push({ s: "on", lu: now - 2 * 3600 }, { s: "off", lu: now - 3600 });
    }
    return out;
  };
  const card = renderOverview({}, hass);
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(msg.entity_ids.every((id) => id.startsWith("binary_sensor.")));
  assert.strictEqual(msg.no_attributes, true);
  const last = Array.from(card.querySelectorAll(".sho-sum .r")).pop();
  assert.strictEqual(last.querySelector("b").textContent, now - t0 > 2 * 3600 ? "1 h" : "0 min");
});

test("overview: rejects non-list tiles", () => {
  const { OverviewClass } = loadCard();
  const card = new OverviewClass();
  assert.throws(() => card.setConfig({ tiles: "heating" }), /tiles/);
});

test("loading the card script twice does not throw (double-registration guard)", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  dom.window.eval(CARD_SRC);
  assert.doesNotThrow(() => dom.window.eval(CARD_SRC));
});
