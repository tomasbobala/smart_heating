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
  };
}

const ZONE_ID = "abc12345";

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
  const reason = card.querySelector(".sh-reason").textContent;
  assert.match(reason, /doesnotexist/);
});

test("renders zone name, current and target temperature", () => {
  const { CardClass, document } = loadCard();
  const card = new CardClass();
  card.setConfig({ zone_id: ZONE_ID });
  card.hass = buildHass();
  document.body.appendChild(card);
  assert.strictEqual(card.querySelector(".sh-title").textContent, "Obyvacka");
  assert.match(card.querySelector(".sh-current-temp").textContent, /22\.5/);
  assert.match(card.querySelector(".sh-target-temp").textContent, /23/);
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
  const rowsAc = Array.from(cardAc.querySelectorAll(".sh-row-label")).map((el) => el.textContent);
  assert.ok(rowsAc.some((t) => /pevný AC setpoint/i.test(t)));

  const cardFloor = new CardClass();
  cardFloor.setConfig({ zone_id: ZONE_ID });
  cardFloor.hass = buildHass({ hasAc: false });
  document.body.appendChild(cardFloor);
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

test("loading the card script twice does not throw (double-registration guard)", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  dom.window.eval(CARD_SRC);
  assert.doesNotThrow(() => dom.window.eval(CARD_SRC));
});
