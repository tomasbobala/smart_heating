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

// ---------------------------------------------------------------- 0.17.0

test("zone card: section icons are vector SVG, no emoji", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  const labels = Array.from(card.querySelectorAll(".sh-section-label"));
  assert.ok(labels.length >= 7);
  for (const l of labels) assert.ok(l.querySelector(".sh-icon svg path"), l.textContent);
  assert.doesNotMatch(card.innerHTML, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{23F0}]/u);
});

test("zone card: floor section shows floor limits and radiator hysteresis when present", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  const hass = buildHass();
  for (const [k, v] of [["floor_min", "24"], ["floor_max", "28"], ["floor_hysterezia", "1.5"], ["radiator_hysterezia", "0.5"]]) {
    hass.states[`number.smart_heating_${ZONE_ID}_${k}`] = { state: v, attributes: { min: 0, max: 40 } };
  }
  hass.states[`switch.smart_heating_${ZONE_ID}_udrzat_min_podlahy`] = { state: "on", attributes: {} };
  card.hass = hass;
  document.body.appendChild(card);
  card.querySelector(".sh-gear").click();
  const floorText = card.querySelector(".sh-floor").textContent;
  for (const t of ["Min. teplota podlahy", "Max. teplota podlahy", "Hysteréza podlahy", "Hysteréza radiátora"]) {
    assert.match(floorText, new RegExp(t));
  }
  assert.match(card.querySelector(".sh-toggles").textContent, /Udržiavať min. teplotu podlahy/);
});

test("zone card: faults and min-floor are shown as badges", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  card.hass = buildHass({ stavAttrs: { problemy: ["T Kupelna je nedostupné viac ako 15 min"], floor_guard: true } });
  document.body.appendChild(card);
  assert.match(card.querySelector(".sh-prob").textContent, /Porucha: T Kupelna je nedostupné viac ako 15 min/);
  assert.match(card.querySelector(".sh-badges").textContent, /Podlaha – min. teplota/);
});

test("overview: tiles use vector icons", () => {
  const card = renderOverview({});
  const icons = Array.from(card.querySelectorAll(".sho-tile .i"));
  assert.ok(icons.length > 0);
  assert.ok(icons.every((i) => i.querySelector("svg path")));
});

test("overview: faults row shows 0 without faults and is highlighted with a fault", () => {
  let card = renderOverview({});
  assert.match(card.querySelector(".sho-sum").textContent, /Poruchy\s*0/);
  assert.strictEqual(card.querySelector(".sho-sum .dot[style*='sh-err']"), null);
  const hass = overviewHass();
  hass.states["sensor.smart_heating_bbb22222_stav"].attributes.problemy = ["x"];
  card = renderOverview({}, hass);
  assert.match(card.querySelector(".sho-sum").textContent, /Poruchy\s*1/);
  assert.ok(card.querySelector(".sho-sum .dot[style*='sh-err']"));
});

function settingsHass() {
  const hass = overviewHass();
  hass.states["sensor.smart_heating_aaa11111_stav"].attributes.config_entry_id = "ENTRY1";
  const calls = [];
  hass.callApi = async (method, path, data) => {
    calls.push({ method, path, data });
    if (method === "POST" && path === "config/config_entries/options/flow") return { type: "menu", flow_id: "F1" };
    if (method === "POST" && data && data.next_step_id === "global") {
      return {
        type: "form", flow_id: "F1", step_id: "global",
        data_schema: [
          { name: "outdoor_sensor", selector: { entity: {} }, default: "sensor.out" },
          { name: "holiday_active", selector: { boolean: {} }, default: false },
          { name: "nudzova_teplota", selector: { number: { min: 3, max: 15, step: 0.5 } }, default: 8 },
          { name: "notify_tariff", selector: { boolean: {} }, default: true },
          { name: "notify_diagnostics", selector: { boolean: {} }, default: true },
          { name: "language", selector: { select: {} }, default: "auto" },
        ],
      };
    }
    return { type: "create_entry" };
  };
  return { hass, calls };
}

const tick = () => new Promise((r) => setTimeout(r, 15));

test("overview settings: opens the integration options flow and renders known fields", async () => {
  const { hass, calls } = settingsHass();
  const card = renderOverview({}, hass);
  card.querySelector(".sho-gear").click();
  await tick();
  assert.deepStrictEqual(
    { ...calls[0], data: { ...calls[0].data } },
    { method: "POST", path: "config/config_entries/options/flow", data: { handler: "ENTRY1", show_advanced_options: false } },
  );
  const text = card.querySelector(".sho-set").textContent;
  for (const t of ["Dovolenka", "Núdzová teplota", "Tarifa", "Poruchy"]) assert.match(text, new RegExp(t));
  assert.ok(card.querySelector(".sho-save").disabled, "bez zmeny sa neda ulozit");
});

test("overview settings: save submits current values plus changes", async () => {
  const { hass, calls } = settingsHass();
  const card = renderOverview({}, hass);
  card.querySelector(".sho-gear").click();
  await tick();
  card.querySelector('.sho-sw[data-f="holiday_active"]').click();
  card.querySelector('[data-f="nudzova_teplota"][data-d="1"]').click();
  card.querySelector(".sho-save").click();
  await tick();
  const submit = calls.find((c) => c.path === "config/config_entries/options/flow/F1" && c.data && !c.data.next_step_id);
  assert.ok(submit);
  assert.strictEqual(submit.data.holiday_active, true);
  assert.strictEqual(submit.data.nudzova_teplota, 8.5);
  assert.strictEqual(submit.data.outdoor_sensor, "sensor.out");   // nezmenene hodnoty idu s nimi
  assert.strictEqual(submit.data.language, "auto");
});

test("overview settings: cancel aborts the flow", async () => {
  const { hass, calls } = settingsHass();
  const card = renderOverview({}, hass);
  card.querySelector(".sho-gear").click();
  await tick();
  card.querySelector(".sho-cancel").click();
  await tick();
  assert.ok(calls.some((c) => c.method === "DELETE" && c.path === "config/config_entries/options/flow/F1"));
  assert.strictEqual(card.querySelector(".sho-set").hidden, true);
});

test("overview settings: error message when not allowed", async () => {
  const hass = overviewHass();
  hass.states["sensor.smart_heating_aaa11111_stav"].attributes.config_entry_id = "ENTRY1";
  hass.callApi = async () => { throw new Error("401"); };
  const card = renderOverview({}, hass);
  card.querySelector(".sho-gear").click();
  await tick();
  assert.match(card.querySelector(".sho-set").textContent, /administrátora/);
});

// ---------------------------------------------------------------- kaskada FVE

function pvHass(prio, pvOn = "on", extra = {}) {
  const hass = buildHass({ stavAttrs: extra });
  hass.states[`switch.smart_heating_${ZONE_ID}_vyuzi_fve_prebytok`] = { state: pvOn, attributes: {} };
  hass.states[`select.smart_heating_${ZONE_ID}_fve_priorita`] = { state: prio, attributes: { options: ["1", "2", "3"] } };
  return hass;
}

test("pv priority: chips shown with the switch on, selecting calls select_option", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  const hass = pvHass("2");
  const calls = [];
  hass.callService = (d, s, data) => calls.push({ d, s, data });
  card.hass = hass;
  document.body.appendChild(card);
  card.querySelector(".sh-gear").click();
  const row = card.querySelector(".sh-pv-prio");
  assert.ok(row);
  assert.strictEqual(row.querySelector(".sh-chip.active").textContent, "2");
  row.querySelector('[data-pv-prio="1"]').click();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls.at(-1))), {
    d: "select", s: "select_option",
    data: { entity_id: `select.smart_heating_${ZONE_ID}_fve_priorita`, option: "1" },
  });
});

test("pv priority: hidden when the zone doesn't use solar surplus", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = pvHass("1", "off");
  document.body.appendChild(card);
  card.querySelector(".sh-gear").click();
  assert.strictEqual(card.querySelector(".sh-pv-prio"), null);
});

test("pv priority: waiting badge", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  card.hass = pvHass("2", "on", { fve_caka: true });
  document.body.appendChild(card);
  assert.match(card.querySelector(".sh-badges").textContent, /FVE – čaká na prioritné izby/);
});

test("card re-renders when floor settings or solar priority change", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = pvHass("1");
  document.body.appendChild(card);
  const ids = card._entityIds();
  for (const k of ["number.%_floor_min", "number.%_floor_max", "number.%_floor_hysterezia",
    "number.%_radiator_hysterezia", "switch.%_udrzat_min_podlahy", "select.%_fve_priorita"]) {
    assert.ok(ids.includes(k.replace("%", `smart_heating_${ZONE_ID}`)), k);
  }
});

// ---------------------------------------------------------------- FVE podla vykonu

test("overview: solar tile in power mode shows active priorities and surplus", () => {
  const hass = overviewHass();
  hass.states["sensor.smart_heating_fve_kaskada"] = {
    state: "2", attributes: { rezim: "vykon", prebytok_w: 1840 },
  };
  const card = renderOverview({}, hass);
  const text = pvTile(card).textContent;
  assert.match(text, /P1–2 · 1,8 kW/);
  assert.match(text, /1,8 kW/);
});

test("overview: solar tile in power mode with nothing active", () => {
  const hass = overviewHass();
  hass.states["sensor.smart_heating_fve_kaskada"] = { state: "0", attributes: { rezim: "vykon", prebytok_w: 300 } };
  const card = renderOverview({}, hass);
  assert.match(pvTile(card).textContent, /Nie · 0,3 kW/);
});

test("overview settings: solar group with units W / min / %", async () => {
  const { hass } = settingsHass();
  const base = hass.callApi;
  hass.callApi = async (method, path, data) => {
    const r = await base(method, path, data);
    if (r.type === "form") {
      r.data_schema.push(
        { name: "pv_auto", selector: { boolean: {} }, default: true },
        { name: "pv_add_power", selector: { number: { min: 100, max: 10000, step: 100, unit_of_measurement: "W" } }, default: 1000 },
        { name: "pv_shed_minutes", selector: { number: { min: 1, max: 60, step: 1, unit_of_measurement: "min" } }, default: 10 },
        { name: "pv_stop_soc", selector: { number: { min: 0, max: 100, step: 5, unit_of_measurement: "%" } }, default: 40 },
      );
    }
    return r;
  };
  const card = renderOverview({}, hass);
  card.querySelector(".sho-gear").click();
  await tick();
  const text = card.querySelector(".sho-set").textContent;
  assert.match(text, /FVE prebytok/);
  assert.match(text, /1000 W/);
  assert.match(text, /10 min/);
  assert.match(text, /40 %/);
  assert.match(text, /8,0°/);                       // teplotne pole so stupnom a slovenskou ciarkou
  card.querySelector('[data-f="pv_add_power"][data-d="1"]').click();
  assert.match(card.querySelector(".sho-set").textContent, /1100 W/);
});

// ---------------------------------------------------------------- spotreba

function consHass(extraStates = {}) {
  const hass = buildHass({ stavAttrs: {
    power_entities: ["sensor.podlaha_power", "sensor.daikin_power"],
    energy_entities: ["sensor.podlaha_kwh", "sensor.daikin_kwh"],
  } });
  hass.states["sensor.podlaha_power"] = { state: "850", attributes: { unit_of_measurement: "W" } };
  hass.states["sensor.daikin_power"] = { state: "0.6", attributes: { unit_of_measurement: "kW" } };
  Object.assign(hass.states, extraStates);
  const calls = [];
  hass.callWS = async (msg) => {
    calls.push(msg);
    return {
      "sensor.podlaha_kwh": [{ change: 1.2 }, { change: 0.8 }],
      "sensor.daikin_kwh": [{ change: 1.5 }, { change: null }],
    };
  };
  return { hass, calls };
}

test("zone card: current power (W + kW summed) and energy today from statistics", async () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  const { hass, calls } = consHass();
  card.hass = hass;
  document.body.appendChild(card);
  await new Promise((r) => setTimeout(r, 15));
  const wrap = card.querySelector(".sh-cons");
  assert.strictEqual(wrap.hidden, false);
  assert.strictEqual(wrap.querySelector(".sh-cons-p").textContent, "1,5 kW");
  assert.strictEqual(wrap.querySelector(".sh-cons-e").textContent, "dnes 3,50 kWh");
  const q = calls.find((c) => c.type === "recorder/statistics_during_period" && c.types && c.types[0] === "change");
  assert.ok(q);
  assert.deepStrictEqual(Array.from(q.statistic_ids), ["sensor.podlaha_kwh", "sensor.daikin_kwh"]);
  assert.strictEqual(q.period, "5minute");
  assert.strictEqual(q.units.energy, "kWh");
});

test("zone card: consumption row hidden without consumption sensors", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-cons").hidden, true);
});

test("zone card: a power change updates only the consumption row, not the whole card", async () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  const { hass, calls } = consHass();
  card.hass = hass;
  document.body.appendChild(card);
  await new Promise((r) => setTimeout(r, 15));
  let full = 0;
  const orig = card._updateContent.bind(card);
  card._updateContent = () => { full += 1; orig(); };
  const h2 = { ...hass, states: { ...hass.states, "sensor.podlaha_power": { state: "120", attributes: { unit_of_measurement: "W" } } } };
  card.hass = h2;
  assert.strictEqual(full, 0);
  assert.strictEqual(card.querySelector(".sh-cons-p").textContent, "720 W");
  const energyCalls = calls.filter((c) => c.types && c.types[0] === "change").length;
  assert.strictEqual(energyCalls, 1);                 // statistiky sa nestahuju pri kazdej zmene
});

test("overview: heating power and consumption today summed over zones", async () => {
  const hass = overviewHass();
  hass.states["sensor.smart_heating_aaa11111_stav"].attributes.power_entities = ["sensor.p1"];
  hass.states["sensor.smart_heating_aaa11111_stav"].attributes.energy_entities = ["sensor.e1"];
  hass.states["sensor.smart_heating_bbb22222_stav"].attributes.power_entities = ["sensor.p2"];
  hass.states["sensor.smart_heating_bbb22222_stav"].attributes.energy_entities = ["sensor.e2"];
  hass.states["sensor.p1"] = { state: "1200", attributes: { unit_of_measurement: "W" } };
  hass.states["sensor.p2"] = { state: "800", attributes: { unit_of_measurement: "W" } };
  hass.callWS = async (msg) => (msg.types && msg.types[0] === "change"
    ? { "sensor.e1": [{ change: 4 }], "sensor.e2": [{ change: 8.25 }] } : {});
  const card = renderOverview({}, hass);
  await new Promise((r) => setTimeout(r, 15));
  const text = card.querySelector(".sho-sum").textContent.replace(/\s+/g, " ");
  assert.match(text, /Príkon kúrenia\s*2,0 kW/);
  assert.match(text, /Spotreba dnes\s*12,3 kWh/);
});

// ---------------------------------------------------------------- statistiky + zdroje

function statsRes(start, prevStart, { withFve = true } = {}) {
  const DAY = 86400000;
  const res = { "sensor.a_floor": [], "sensor.a_ac": [], "sensor.b_floor": [], "sensor.out": [] };
  if (withFve) res["sensor.smart_heating_energia_z_fve"] = [];
  for (let i = 0; i < 7; i++) {
    const cur = start + i * DAY + 3600000, prev = prevStart + i * DAY + 3600000;
    res["sensor.a_floor"].push({ start: cur, change: 2 }, { start: prev, change: 3 });
    res["sensor.a_ac"].push({ start: cur, change: 1 }, { start: prev, change: 1 });
    res["sensor.b_floor"].push({ start: cur, change: 1 }, { start: prev, change: 1 });
    res["sensor.out"].push({ start: cur, mean: 8 }, { start: prev, mean: 8 });   // 10 stupnodni/den
    if (withFve) res["sensor.smart_heating_energia_z_fve"].push({ start: cur, change: 1 });
  }
  return res;
}

/** Mock recorder: vrati riadky statsRes, ktore patria do pozadovaneho rozsahu
 * (predchadzajuce obdobie po dnoch, aktualne po hodinach - ako realny HA). */
function statsByRange(msg) {
  const DAY = 86400000;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime() - 6 * DAY, prevStart = start - 7 * DAY;
  const all = statsRes(start, prevStart);
  const from = Date.parse(msg.start_time), to = Date.parse(msg.end_time);
  const out = {};
  for (const [id, rows] of Object.entries(all)) {
    const r = rows.filter((x) => x.start >= from && x.start < to);
    if (r.length) out[id] = r;
  }
  return out;
}

function statsZones() {
  return [
    { id: "a", name: "Obývačka", problems: [], srcs: [{ key: "floor", energy: ["sensor.a_floor"] }, { key: "ac", energy: ["sensor.a_ac"] }] },
    { id: "b", name: "Spálňa", problems: ["Podlaha hlási kúrenie, ale merač ukazuje 0 W viac ako 10 min"], srcs: [{ key: "floor", energy: ["sensor.b_floor"] }] },
  ];
}

test("computeStats: totals, solar share, kWh per degree-day vs previous period, ranking", () => {
  const { window } = loadCard();
  const DAY = 86400000;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime() - 6 * DAY, prevStart = start - 7 * DAY;
  const st = window.computeStats(statsRes(start, prevStart), {
    zones: statsZones(), energyIds: ["sensor.a_floor", "sensor.a_ac", "sensor.b_floor"],
    fveId: "sensor.smart_heating_energia_z_fve", outdoorId: "sensor.out", start, prevStart, hourly: false, days: 7, lang: "sk",
  });
  assert.strictEqual(st.total, 28);                 // (2+1+1) * 7
  assert.strictEqual(st.prevTotal, 35);             // (3+1+1) * 7
  assert.strictEqual(st.fve, 7);
  assert.strictEqual(st.eff, 28 / 70);              // 70 stupnodni
  assert.ok(Math.abs(st.effDelta - (-0.2)) < 1e-9); // o 20 % lepsie
  assert.strictEqual(st.buckets.length, 7);
  assert.deepStrictEqual(st.ranking.map((r) => [r.name, r.total]), [["Obývačka", 21], ["Spálňa", 7]]);
  assert.deepStrictEqual(st.ranking[0].parts.map((p) => [p.key, p.kwh]), [["floor", 14], ["ac", 7]]);
});

function statsOverview(resFn) {
  const hass = overviewHass();
  const a = hass.states["sensor.smart_heating_aaa11111_stav"].attributes;
  a.sources = [{ key: "floor", power: [], energy: ["sensor.a_floor"] }, { key: "ac", power: [], energy: ["sensor.a_ac"] }];
  a.energy_entities = ["sensor.a_floor", "sensor.a_ac"];
  a.meter_problems = ["Podlaha hlási kúrenie, ale merač ukazuje 0 W viac ako 10 min"];
  hass.states["sensor.smart_heating_energia_z_fve"] = { state: "3", attributes: {} };
  const calls = [];
  hass.callWS = async (msg) => {
    calls.push(msg);
    if (msg.type === "recorder/statistics_during_period" && msg.types && msg.types.includes("mean")) return resFn(msg);
    return {};
  };
  return { hass, calls };
}

test("overview: Statistics button opens the panel with KPIs, ranking and meter check", async () => {
  const { hass, calls } = statsOverview(statsByRange);
  const card = renderOverview({}, hass);
  card.querySelector(".sho-statsbtn").click();
  await new Promise((r) => setTimeout(r, 20));
  card.querySelector('.sho-per[data-days="7"]').click();
  await new Promise((r) => setTimeout(r, 20));
  const q = calls.find((c) => c.types && c.types.includes("mean") && c.period === "hour");
  assert.ok(q);
  assert.ok(Array.from(q.statistic_ids).includes("sensor.smart_heating_energia_z_fve"));
  const text = card.querySelector(".sho-stats").textContent.replace(/\s+/g, " ");
  assert.match(text, /Štatistiky kúrenia/);
  assert.match(text, /Spotreba\s*21,0 kWh/);
  assert.match(text, /z toho prebytok 7,0 kWh/);
  assert.match(text, /Alpha\s*21,0 kWh/);
  assert.match(text, /merač ukazuje 0 W/);
  assert.match(text, /Na 1 stupeňodeň\s*–/);
  assert.ok(card.querySelectorAll(".sho-chart rect").length >= 7);
});

test("overview: period switch to Today asks for hourly statistics", async () => {
  const { hass, calls } = statsOverview(() => ({}));
  const card = renderOverview({}, hass);
  card.querySelector(".sho-statsbtn").click();
  await new Promise((r) => setTimeout(r, 10));
  card.querySelector('.sho-per[data-days="1"]').click();
  await new Promise((r) => setTimeout(r, 10));
  const periods = calls.filter((c) => c.types && c.types.includes("mean")).slice(-2).map((c) => c.period).sort();
  assert.deepStrictEqual(periods, ["5minute", "hour"]);
});

test("overview: today's consumption comes from 5-minute statistics (hourly ones lag behind)", async () => {
  // o 9:00 hodinove statistiky este nemaju hodinu 8-9, 5-minutove ano
  const { hass } = statsOverview((msg) => {
    if (msg.period !== "5minute") return {};
    const t0 = Date.parse(msg.start_time);
    const rows = [];
    for (let i = 0; i < 12; i++) rows.push({ start: t0 + i * 300000, change: 0.2617 });   // 3,14 kWh
    return { "sensor.a_floor": rows };
  });
  const card = renderOverview({}, hass);
  card.querySelector(".sho-statsbtn").click();
  await new Promise((r) => setTimeout(r, 10));
  card.querySelector('.sho-per[data-days="1"]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.match(card.querySelector(".sho-stats").textContent, /Spotreba\s*3,1 kWh/);
});

test("computeStats: degree-days of a partial day count only the elapsed time", () => {
  const { window } = loadCard();
  const DAY = 86400000;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime(), prevStart = start - DAY;
  const res = { "sensor.e": [], "sensor.out": [] };
  for (let h = 0; h < 24; h++) {                 // vcera: 24 h po 1 kWh pri 8 °C -> 24 kWh / 10 stupnodni
    res["sensor.e"].push({ start: prevStart + h * 3600000, change: 1, dur: 1 / 24 });
    res["sensor.out"].push({ start: prevStart + h * 3600000, mean: 8, dur: 1 / 24 });
  }
  for (let i = 0; i < 72; i++) {                 // dnes 6 h: rovnaka spotreba na hodinu pri 8 °C
    res["sensor.e"].push({ start: start + i * 300000, change: 1 / 12, dur: 1 / 288 });
    res["sensor.out"].push({ start: start + i * 300000, mean: 8, dur: 1 / 288 });
  }
  const st = window.computeStats(res, {
    zones: [{ id: "z", name: "Z", problems: [], srcs: [{ key: "floor", energy: ["sensor.e"] }] }],
    energyIds: ["sensor.e"], fveId: null, outdoorId: "sensor.out", start, prevStart, hourly: true, days: 1, lang: "sk",
  });
  assert.ok(Math.abs(st.total - 6) < 1e-9);
  assert.ok(Math.abs(st.eff - 2.4) < 1e-9);        // rovnake ako vcera, nie 10x "lepsie"
  assert.ok(Math.abs(st.effDelta) < 1e-9);
});

test("overview: statistics panel without energy meters explains what to set", async () => {
  const hass = overviewHass();
  const card = renderOverview({}, hass);
  card.querySelector(".sho-statsbtn").click();
  await new Promise((r) => setTimeout(r, 10));
  assert.match(card.querySelector(".sho-stats").textContent, /nie sú nastavené merače energie/);
});

test("zone card: power broken down by source when two sources have meters", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID, language: "sk" });
  const hass = buildHass({ stavAttrs: {
    power_entities: ["sensor.fw", "sensor.aw"], energy_entities: [],
    sources: [{ key: "floor", power: ["sensor.fw"], energy: [] }, { key: "ac", power: ["sensor.aw"], energy: [] }],
  } });
  hass.states["sensor.fw"] = { state: "800", attributes: { unit_of_measurement: "W" } };
  hass.states["sensor.aw"] = { state: "1.2", attributes: { unit_of_measurement: "kW" } };
  card.hass = hass;
  document.body.appendChild(card);
  const t = card.querySelector(".sh-cons").textContent.replace(/\s+/g, " ");
  assert.match(t, /Podlaha 800 W/);
  assert.match(t, /Klíma 1,2 kW/);
});

// --- stabilna vyska kariet (stranka nesmie poskakovat pri scrollovani na koniec) ---

test("zone card: keeps its content (dimmed) while zone entities briefly disappear on reload", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  const gone = buildHass();
  delete gone.states[`climate.smart_heating_${ZONE_ID}`];
  delete gone.states[`sensor.smart_heating_${ZONE_ID}_stav`];
  card.hass = gone;
  assert.strictEqual(card.querySelector(".sh-msg"), null);
  assert.ok(card.querySelector(".sh-pill"));
  assert.ok(card.querySelector(".sh-root").classList.contains("is-stale"));
  card.hass = buildHass();
  assert.ok(!card.querySelector(".sh-root").classList.contains("is-stale"));
});

test("zone card: reason line always reserves two lines", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  const css = card.querySelector("style").textContent;
  const rule = css.match(/\.sh-why \{[^}]*\}/)[0];
  assert.match(rule, /[^-]height: 2\.9em/);
});

test("overview: summary has the same rows with and without faults", () => {
  const ok = renderOverview({});
  const rowsOk = ok.querySelectorAll(".sho-sum .r").length;
  const hass = overviewHass();
  hass.states["sensor.smart_heating_bbb22222_stav"].attributes.problemy = ["Termostat neodpovedá"];
  const bad = renderOverview({}, hass);
  assert.strictEqual(bad.querySelectorAll(".sho-sum .r").length, rowsOk);
  assert.match(ok.querySelector(".sho-sum").textContent, /Poruchy\s*0/);
});

test("overview: keeps the summary while zones briefly disappear on reload", () => {
  const card = renderOverview({});
  const before = card.querySelector(".sho-sum").innerHTML;
  card.hass = { states: {}, language: "sk", callService: () => {} };
  card._render();
  assert.strictEqual(card.querySelector(".sho-sum").innerHTML, before);
});

test("zone card: badge when the floor sensor is lost", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ stavAttrs: { floor_sensor_lost: true } });
  document.body.appendChild(card);
  assert.match(card.querySelector(".sh-badges").textContent, /Senzor podlahy výpadok/);
});

// ---------------------------------------------------------------- 0.22: rozdelenie sieť / FVE / batéria, graf, vlhkosť

function splitRes(start) {
  const H = 3600000;
  // hodina 0: kurenie 2 kWh, dom 1 zo siete + 1 z FVE -> 1/1
  // hodina 1: kurenie 1 kWh, dom 2 z baterie -> 1 bateria
  // hodina 2: kurenie 1 kWh, dom bez dat (pred meranim) -> nerozdelene
  return {
    "sensor.e": [{ start: start, change: 2, dur: 1 / 24 }, { start: start + H, change: 1, dur: 1 / 24 }, { start: start + 2 * H, change: 1, dur: 1 / 24 }],
    "sensor.h_siet": [{ start: start, change: 1, dur: 1 / 24 }, { start: start + H, change: 0, dur: 1 / 24 }],
    "sensor.h_fve": [{ start: start, change: 1, dur: 1 / 24 }, { start: start + H, change: 0, dur: 1 / 24 }],
    "sensor.h_bat": [{ start: start, change: 0, dur: 1 / 24 }, { start: start + H, change: 2, dur: 1 / 24 }],
    "sensor.rh": [{ start: start, mean: 40, dur: 1 / 24 }, { start: start + H, mean: 60, dur: 1 / 24 }],
  };
}

function splitOpts(start, extra = {}) {
  return {
    zones: [{ id: "z", name: "Z", problems: [], srcs: [{ key: "floor", energy: ["sensor.e"] }] }],
    energyIds: ["sensor.e"], fveId: null, outdoorId: null, start, prevStart: start - 86400000, hourly: true, days: 1, lang: "sk",
    houseIds: { siet: "sensor.h_siet", fve: "sensor.h_fve", bateria: "sensor.h_bat" },
    humidity: [{ name: "Obývačka", id: "sensor.rh" }], ...extra,
  };
}

test("computeStats: heating split by the house mix in every hour, unsplit before metering", () => {
  const { window } = loadCard();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const st = window.computeStats(splitRes(start.getTime()), splitOpts(start.getTime()));
  assert.ok(Math.abs(st.total - 4) < 1e-9);
  assert.ok(Math.abs(st.split.siet - 1) < 1e-9);
  assert.ok(Math.abs(st.split.fve - 1) < 1e-9);
  assert.ok(Math.abs(st.split.bateria - 1) < 1e-9);
  assert.ok(Math.abs(st.split.unknown - 1) < 1e-9);
  const b0 = st.buckets[0], b2 = st.buckets[2];
  assert.ok(Math.abs(b0.siet - 1) < 1e-9 && Math.abs(b0.fve - 1) < 1e-9);
  assert.ok(Math.abs(b2.unknown - 1) < 1e-9);
  assert.strictEqual(Math.round(st.humidity[0].value), 50);
});

test("computeStats: without house sensors there is no split (all unsplit)", () => {
  const { window } = loadCard();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const st = window.computeStats(splitRes(start.getTime()), splitOpts(start.getTime(), { houseIds: {} }));
  assert.strictEqual(st.split, null);
});

test("computeStats: no comparison when the previous period has few degree-days", () => {
  const { window } = loadCard();
  const DAY = 86400000;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime() - 6 * DAY, prevStart = start - 7 * DAY;
  const res = statsRes(start, prevStart);
  // predchadzajuci tyzden: koniec leta, 17 °C -> 7 stupnodni oproti 70
  res["sensor.out"] = res["sensor.out"].map((r) => (r.start < start ? { ...r, mean: 17 } : r));
  const st = window.computeStats(res, {
    zones: statsZones(), energyIds: ["sensor.a_floor", "sensor.a_ac", "sensor.b_floor"],
    fveId: null, outdoorId: "sensor.out", start, prevStart, hourly: false, days: 7, lang: "sk",
  });
  assert.ok(st.eff != null);
  assert.strictEqual(st.comparable, false);
  assert.strictEqual(st.effDelta, null);
});

test("niceStep gives round axis steps", () => {
  const { window } = loadCard();
  assert.strictEqual(window.niceStep(11.6), 5);
  assert.strictEqual(window.niceStep(1.7), 0.5);
  assert.strictEqual(window.niceStep(30), 10);
});

test("chart: value above every bar when there is room, only the max when narrow; grid lines", () => {
  const { window } = loadCard();
  const buckets = Array.from({ length: 30 }, (_, i) => ({ t: i, label: `${i + 1}.`, total: i === 7 ? 9 : 2, siet: 1, fve: 1, bateria: 0, unknown: 0 }));
  buckets[7].siet = 5; buckets[7].fve = 4;
  const st = { buckets, split: { siet: 1 }, hourly: false };
  const wide = window.statsChartSvg(st, 1400, "sk");
  const narrow = window.statsChartSvg(st, 360, "sk");
  const count = (svg) => (svg.match(/class="vl"/g) || []).length;
  assert.strictEqual(count(wide), 30);
  assert.strictEqual(count(narrow), 1);
  assert.match(narrow, />9,0</);
  assert.ok((wide.match(/class="gr"/g) || []).length >= 2);
  assert.strictEqual((wide.match(/class="hit"/g) || []).length, 30);
  assert.doesNotMatch(wide, /preserveAspectRatio="none"/);
});

test("overview: statistics show solar, battery and grid tiles from the house split", async () => {
  const { hass } = statsOverview((msg) => {
    if (msg.period !== "5minute") return {};
    const t0 = Date.parse(msg.start_time);
    return {
      "sensor.a_floor": [{ start: t0, change: 2 }],
      "sensor.smart_heating_energia_domu_zo_siete": [{ start: t0, change: 1 }],
      "sensor.smart_heating_energia_domu_z_fve": [{ start: t0, change: 2 }],
      "sensor.smart_heating_energia_domu_z_baterie": [{ start: t0, change: 1 }],
    };
  });
  for (const k of ["zo_siete", "z_fve", "z_baterie"]) hass.states[`sensor.smart_heating_energia_domu_${k}`] = { state: "1", attributes: {} };
  const card = renderOverview({}, hass);
  card.querySelector(".sho-statsbtn").click();
  await new Promise((r) => setTimeout(r, 10));
  card.querySelector('.sho-per[data-days="1"]').click();
  await new Promise((r) => setTimeout(r, 20));
  const text = card.querySelector(".sho-stats").textContent.replace(/\s+/g, " ");
  assert.match(text, /Spotreba\s*2,0 kWh/);
  assert.match(text, /Z FVE\s*1,0 kWh\s*50 %/);
  assert.match(text, /Z batérie\s*0,5 kWh\s*25 %/);
  assert.match(text, /Zo siete\s*0,5 kWh\s*25 %/);
  // tuknutie na stlpec ukaze detail
  const hits = card.querySelectorAll(".sho-chart .hit");
  hits[0].dispatchEvent(new card.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));
  assert.match(card.querySelector(".sho-st-sel").textContent, /0:00–1:00: 2,0 kWh/);
});

test("zone card: humidity line with felt temperature, dew point and airing hint", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ stavAttrs: {
    humidity_entity: "sensor.rh", humidity: 68, felt_temperature: 23.6, dew_point: 15.8,
    humidity_alert: "high", ventilation: "helps",
  } });
  document.body.appendChild(card);
  const el = card.querySelector(".sh-feel");
  assert.strictEqual(el.hidden, false);
  const t = el.textContent.replace(/\s+/g, " ");
  assert.match(t, /68 %/);
  assert.match(t, /pocitovo 23,6°/);
  assert.match(t, /rosný bod 15,8°/);
  assert.match(t, /vlhko, vetranie pomôže/);
  assert.ok(el.classList.contains("wet"));
});

test("zone card: humidity line stays (with –) when the sensor drops out, hidden without sensor", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass({ stavAttrs: { humidity_entity: "sensor.rh", humidity: null } });
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-feel").hidden, false);
  assert.match(card.querySelector(".sh-feel").textContent, /–/);
  const card2 = new CardClass();
  card2.setConfig({ zone_id: ZONE_ID });
  card2.hass = buildHass();
  document.body.appendChild(card2);
  assert.strictEqual(card2.querySelector(".sh-feel").hidden, true);
});

test("overview: outdoor humidity and pressure with 3 h trend", async () => {
  const hass = overviewHass();
  for (const id of Object.keys(hass.states)) {
    if (id.endsWith("_stav")) Object.assign(hass.states[id].attributes, {
      outdoor_entity: "sensor.out", outdoor_humidity_entity: "sensor.out_rh", outdoor_pressure_entity: "sensor.out_p",
    });
  }
  hass.states["sensor.out"] = { state: "6.7", attributes: {} };
  hass.states["sensor.out_rh"] = { state: "84.6", attributes: {} };
  hass.states["sensor.out_p"] = { state: "1012.4", attributes: {} };
  const now = Date.now();
  hass.callWS = async (msg) => {
    if (msg.type !== "history/history_during_period") return {};
    return {
      "sensor.out": [{ s: "5", lu: (now - 4 * 3600000) / 1000 }],
      "sensor.out_p": [{ s: "1016", lu: (now - 4 * 3600000) / 1000 }, { s: "1012", lu: (now - 600000) / 1000 }],
    };
  };
  const card = renderOverview({}, hass);
  await new Promise((r) => setTimeout(r, 20));
  const t = card.querySelector(".sho-out .hp").textContent;
  assert.match(t, /💧 85 %/);
  assert.match(t, /1012 hPa ▼ 4/);
});

// ---------------------------------------------------------------- 0.23: akumulacia z prebytku FVE

test("zone card: solar storage switch and max temperature in settings, badge with target / max", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const hass = buildHass({ stavAttrs: { pv_active: true, fve_akumulacia_ciel: 23, fve_akumulacia_max: 25 } });
  hass.states[`sensor.smart_heating_${ZONE_ID}_stav`].state = "Núdzová ochrana";   // iny dovod -> odznak ukaze akumulaciu
  hass.states[`switch.smart_heating_${ZONE_ID}_fve_akumulacia`] = { state: "on" };
  hass.states[`number.smart_heating_${ZONE_ID}_fve_max_teplota`] = { state: "25", attributes: { min: 18, max: 28, step: 0.5 } };
  hass.states[`select.smart_heating_${ZONE_ID}_fve_priorita`] = { state: "1", attributes: { options: ["1", "2", "3"] } };
  const calls = [];
  hass.callService = (d, s, data) => calls.push([d, s, data]);
  card.hass = hass;
  document.body.appendChild(card);
  assert.match(card.querySelector(".sh-badges").textContent, /FVE akumulácia 23° \/ max 25°/);
  card.querySelector(".sh-gear").click();
  const t = card.querySelector(".sh-toggles").textContent.replace(/\s+/g, " ");
  assert.match(t, /Akumulovať teplo z prebytku/);
  assert.match(t, /Max\. teplota z prebytku\s*-\s*25,0°C/);
  card.querySelector('.sh-toggles button[data-key="fve_max_teplota"][data-act="inc"]').click();
  assert.strictEqual(JSON.stringify(calls.pop()), JSON.stringify(["number", "set_value", { entity_id: `number.smart_heating_${ZONE_ID}_fve_max_teplota`, value: 25.5 }]));
  card.querySelector('.sh-toggles [data-switch-key="fve_akumulacia"]').click();
  assert.strictEqual(JSON.stringify(calls.pop()), JSON.stringify(["switch", "turn_off", { entity_id: `switch.smart_heating_${ZONE_ID}_fve_akumulacia` }]));
});

test("zone card: no storage settings when the zone does not use solar surplus", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const hass = buildHass();
  hass.states[`switch.smart_heating_${ZONE_ID}_vyuzi_fve_prebytok`] = { state: "off" };
  hass.states[`switch.smart_heating_${ZONE_ID}_fve_akumulacia`] = { state: "on" };
  card.hass = hass;
  document.body.appendChild(card);
  card.querySelector(".sh-gear").click();
  assert.doesNotMatch(card.querySelector(".sh-toggles").textContent, /Akumulovať/);
});

test("overview settings: storage step and interval are editable in the card", async () => {
  const { window } = loadCard();
  assert.ok(window.translate("sk", "of_pv_acc_step").includes("Akumulácia"));
  assert.ok(window.translate("sk", "of_pv_acc_minutes").includes("každých"));
});


// ---------------------------------------------------------------- 0.24: Dnes, priority 1-5, panel kaskady

test("overview: Statistics always open on Today", async () => {
  const { hass, calls } = statsOverview(() => ({}));
  const card = renderOverview({}, hass);
  card.querySelector(".sho-statsbtn").click();
  await tick();
  assert.ok(card.querySelector('.sho-per[data-days="1"]').classList.contains("on"));
  card.querySelector('.sho-per[data-days="30"]').click();
  await tick();
  card.querySelector(".sho-statsbtn").click();            // zavriet
  card.querySelector(".sho-statsbtn").click();            // znova otvorit
  await tick();
  assert.ok(card.querySelector('.sho-per[data-days="1"]').classList.contains("on"));
  assert.ok(calls.some((c) => c.period === "5minute"));
});

function cascadeHass(attrs = {}, state = "1") {
  const hass = overviewHass();
  const prio = { aaa11111: "1", bbb22222: "1", ccc33333: "4", ddd44444: "5" };
  for (const [z, p] of Object.entries(prio)) hass.states[`select.smart_heating_${z}_fve_priorita`] = { state: p, attributes: {} };
  hass.states["sensor.smart_heating_aaa11111_stav"].attributes = Object.assign(hass.states["sensor.smart_heating_aaa11111_stav"].attributes, {
    pv_active: true, fve_akumulacia_ciel: 23, fve_akumulacia_max: 25, fve_akumulacia_od: new Date(Date.now() - 5 * 60000).toISOString(),
  });
  hass.states["climate.smart_heating_aaa11111"].attributes.current_temperature = 23;
  hass.states["sensor.smart_heating_bbb22222_stav"].attributes.pv_active = true;
  hass.states["sensor.smart_heating_ccc33333_stav"].attributes.fve_caka = true;
  hass.states["switch.smart_heating_ddd44444_vyuzi_fve_prebytok"] = { state: "off", attributes: {} };
  hass.states["sensor.smart_heating_fve_kaskada"] = { state, attributes: Object.assign({
    rezim: "vykon", dovod: "add", pridanie_za_min: 1.7, odobratie_za_min: null, vyroba_w: 6691, export_w: 6325, odber_w: 0,
    bateria_w: 0, soc: 100, prebytok_w: 6325, uroven_od: new Date(Date.now() - 35 * 60000).toISOString(), urovne: [1, 4],
    nastavenia: { pv_add_power: 1000, pv_add_minutes: 5, pv_shed_power: 500, pv_shed_minutes: 10, pv_stop_soc: 40, pv_acc_step: 1, pv_acc_minutes: 15 },
  }, attrs) };
  hass.callWS = async (msg) => (msg.type === "history/history_during_period" && msg.entity_ids.includes("sensor.smart_heating_fve_kaskada")
    ? { "sensor.smart_heating_fve_kaskada": [{ s: "0", lu: (Date.now() - 3 * 3600000) / 1000 }, { s: "1", lu: (Date.now() - 35 * 60000) / 1000 }] }
    : {});
  return hass;
}

test("overview: solar tile opens the cascade panel with flows, countdown, priorities and timeline", async () => {
  const card = renderOverview({}, cascadeHass());
  const tile = Array.from(card.querySelectorAll(".sho-tile")).find((t) => /FVE/.test(t.textContent));
  tile.click();
  await tick();
  const p = card.querySelector(".sho-pv");
  assert.strictEqual(p.hidden, false);
  const t = p.textContent.replace(/\s+/g, " ");
  assert.match(t, /Kaskáda FVE/);
  assert.match(t, /Aktívna P1/);
  assert.match(t, /od \d+:\d\d \(35 min\)/);
  assert.match(t, /Výroba\s*6,7 kW/);
  assert.match(t, /Do siete\s*6,3 kW/);
  assert.match(t, /Batéria\s*0 W · 100 %/);
  assert.match(t, /pridá od 1,0 kW/);
  assert.match(t, /Prebytok stačí – P4 sa pridá o 2 min/);
  assert.match(t, /Alpha\s*23° z max 25° · ďalšie \+1° o 10 min/);
  assert.match(t, /Gamma\s*čaká na vyššie priority/);
  assert.match(t, /Nevyužívajú prebytok\s*Delta/);
  assert.ok(p.querySelector(".sho-pvbar i"));
  assert.ok(p.querySelector(".sho-pvtl rect.lv"));
  assert.ok(p.querySelector(".sho-pvl.on"));
  tile.click();
  assert.strictEqual(card.querySelector(".sho-pv").hidden, true);
});

test("cascade panel: shedding reason in Slovak and low battery", async () => {
  const card = renderOverview({}, cascadeHass({ dovod: "shed:battery,import", pridanie_za_min: null, odobratie_za_min: 4 }));
  Array.from(card.querySelectorAll(".sho-tile")).find((t) => /FVE/.test(t.textContent)).click();
  await tick();
  assert.match(card.querySelector(".sho-pv").textContent, /Batéria sa vybíja, Odber zo siete – P1 sa odoberie o 4 min/);
  const card2 = renderOverview({}, cascadeHass({ dovod: "low_soc", pridanie_za_min: null }, "0"));
  Array.from(card2.querySelectorAll(".sho-tile")).find((t) => /FVE/.test(t.textContent)).click();
  await tick();
  const t2 = card2.querySelector(".sho-pv").textContent;
  assert.match(t2, /Batéria pod 40 % – všetko vypnuté/);
  assert.match(t2, /Neaktívna/);
});

test("zone card: five solar priority chips", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  const hass = buildHass();
  hass.states[`select.smart_heating_${ZONE_ID}_fve_priorita`] = { state: "4", attributes: { options: ["1", "2", "3", "4", "5"] } };
  card.hass = hass;
  document.body.appendChild(card);
  card.querySelector(".sh-gear").click();
  const chips = card.querySelectorAll("[data-pv-prio]");
  assert.strictEqual(chips.length, 5);
  assert.ok(chips[3].classList.contains("active"));
});

test("cascade panel: heating power vs limit and holding at the limit", async () => {
  const hass = cascadeHass({ dovod: "limit_hold", pridanie_za_min: null, kurenie_w: 6500 });
  hass.states["sensor.smart_heating_fve_kaskada"].attributes.nastavenia.pv_max_heat_power = 7000;
  const card = renderOverview({}, hass);
  Array.from(card.querySelectorAll(".sho-tile")).find((t) => /FVE/.test(t.textContent)).click();
  await tick();
  const t = card.querySelector(".sho-pv").textContent.replace(/\s+/g, " ");
  assert.match(t, /Kúrenie\s*6,5 kW\s*z max 7,0 kW/);
  assert.match(t, /Drží sa – kúrenie 6,5 kW z max 7,0 kW/);
  const { window } = loadCard();
  assert.match(window.translate("sk", "of_pv_max_heat_power"), /Max\. príkon kúrenia/);
});


test("cascade panel: no bare .add / .shed classes (HA grid section styles .add with a dashed outline)", async () => {
  const card = renderOverview({}, cascadeHass());
  Array.from(card.querySelectorAll(".sho-tile")).find((t) => /FVE/.test(t.textContent)).click();
  await tick();
  assert.strictEqual(card.querySelectorAll(".sho-pv .add, .sho-pv .shed").length, 0);
  assert.ok(card.querySelector(".sho-pvmsg.is-add") && card.querySelector(".sho-pvbar.is-add"));
});
