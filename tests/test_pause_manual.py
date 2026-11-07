"""Pauza kurenia z FVE a rucne prevzatie termostatu."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "z1"


def make(hass, **opts):
    zone = {"name": "Spalna", "zone_type": "floor", "climate_entity": "climate.floor"}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: zone}, "language": "sk", **opts})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._startup_time = dt_util.now() - timedelta(hours=1)
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    hass.states.async_set("number.smart_heating_z1_teplota_den", "21")
    return c


def floor(hass, mode="heat", temp=21, **attrs):
    hass.states.async_set("climate.floor", mode, {"temperature": temp, "current_temperature": 20, "hvac_action": "idle",
                                                  "min_temp": 5, "max_temp": 35, "target_temp_step": 0.5, **attrs})


_MOCKS = {}


def _mocks(hass):
    if id(hass) not in _MOCKS:
        _MOCKS.clear()
        _MOCKS[id(hass)] = {(d, k): async_mock_service(hass, d, k) for d, k in (
            ("climate", "set_hvac_mode"), ("climate", "set_temperature"))}
    return _MOCKS[id(hass)]


async def apply(c):
    """Prepocet + aplikovanie; vrati zonu, zoznam poslanych prikazov (domena, sluzba) a mock notifikacii."""
    mocks = _mocks(c.hass)
    before = {k: len(v) for k, v in mocks.items()}
    c.data = c._compute()
    with patch.object(c, "_notify", new=AsyncMock()) as notify:
        await c._async_apply()
    await c.hass.async_block_till_done()
    sent = [k for k, v in mocks.items() for _ in range(len(v) - before[k])]
    return c.data["zones"][Z], sent, notify


def age_cmd(c, entity="climate.floor", minutes=2):
    c._last_cmd[entity]["at"] = dt_util.now() - timedelta(minutes=minutes)


# ------------------------------------------------------------------ pauza FVE

async def test_pause_switches_pv_off_and_back(hass):
    c = make(hass, pv_surplus_entity="input_boolean.fve")
    hass.states.async_set("input_boolean.fve", "on")
    floor(hass)
    z, _, _ = await apply(c)
    assert z["pv_active"]
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()):
        await c.async_pv_pause(60)
    z, _, _ = await apply(c)
    assert not z["pv_active"]                              # bezna teplota, nie FVE
    assert c.data["pv_engine"]["paused_until"] is not None
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()):
        await c.async_pv_resume()
    z, _, _ = await apply(c)
    assert z["pv_active"]


async def test_pause_until_midnight_and_expiry(hass):
    c = make(hass)
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()):
        await c.async_pv_pause(until_midnight=True)
    until = dt_util.as_local(c._pv_pause_until)
    assert (until.hour, until.minute) == (0, 0) and until > dt_util.now()
    c._pv_pause_until = dt_util.now() - timedelta(seconds=1)
    c.data = c._compute()
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()) as rec:
        await c._fast_tick()
    assert c._pv_pause_until is None and rec.await_count >= 1


async def test_pause_default_length_from_settings(hass):
    c = make(hass, pv_pause_minutes=45)
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()):
        await c.async_pv_pause()
    left = (c._pv_pause_until - dt_util.now()).total_seconds() / 60
    assert 44 < left <= 45


async def test_power_engine_stays_off_while_paused(hass):
    c = make(hass, pv_auto=True, grid_power_entity="sensor.grid", battery_power_entity="sensor.bat",
             pv_power_entity="sensor.pv", battery_soc_entity="sensor.soc")
    for e, v in (("sensor.grid", "-3000"), ("sensor.bat", "0"), ("sensor.pv", "5000"), ("sensor.soc", "99")):
        hass.states.async_set(e, v)
    c._pv_engine_state()["tier"] = 1
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()):
        await c.async_pv_pause(30)
    c._pv_engine_state()["add_since"] = dt_util.now() - timedelta(minutes=30)
    assert c._pv_engine_step() == 0
    assert c._pv_engine_state()["reason"] == "paused"
    assert c._pv_engine_state()["values"]["export"] == 3000      # vykony sa meraju dalej


# ------------------------------------------------------------------ rucne prevzatie

async def test_device_switched_off_by_hand_pauses_automation(hass):
    c = make(hass, manual_minutes=30)
    floor(hass)
    await apply(c)                                     # integracia si zapamata svoj prikaz
    age_cmd(c)
    floor(hass, mode="off")                            # pouzivatel vypol termostat
    z, call, _ = await apply(c)
    assert z["manual_until"] is not None
    assert call == []                                  # zariadeniu nic neposiela
    assert z["reason"].startswith("Zmenené ručne na zariadení")
    left = (dt_util.parse_datetime(z["manual_until"]) - dt_util.now()).total_seconds() / 60
    assert 29 < left <= 30


async def test_automation_returns_after_time(hass):
    c = make(hass)
    floor(hass)
    await apply(c)
    age_cmd(c)
    floor(hass, mode="off")
    await apply(c)
    c._rt(Z)["manual_until"] = dt_util.now() - timedelta(seconds=1)
    z, call, _ = await apply(c)
    assert z["manual_until"] is None
    assert ("climate", "set_hvac_mode") in call          # termostat sa znova zapne


async def test_temperature_change_by_hand(hass):
    c = make(hass)
    floor(hass)
    await apply(c)
    age_cmd(c)
    floor(hass, temp=25)
    z, _, _ = await apply(c)
    assert z["manual_until"] is not None


async def test_temperature_change_ignored_when_disabled_or_program(hass):
    c = make(hass, manual_on_temp=False)
    floor(hass)
    await apply(c)
    age_cmd(c)
    floor(hass, temp=25)
    z, _, _ = await apply(c)
    assert z["manual_until"] is None
    c2 = make(hass)
    floor(hass)
    await apply(c2)
    age_cmd(c2)
    floor(hass, temp=25, preset_mode="program")
    z, _, _ = await apply(c2)
    assert z["manual_until"] is None


async def test_own_command_is_not_manual(hass):
    c = make(hass)
    floor(hass, mode="off")
    z, call, _ = await apply(c)                        # integracia posle heat
    assert call
    z, _, _ = await apply(c)                           # zariadenie este neodpovedalo (do 60 s)
    assert z["manual_until"] is None


async def test_zone_switch_disables_detection(hass):
    c = make(hass)
    hass.states.async_set("switch.smart_heating_z1_rucne_prevzatie", "off")
    floor(hass)
    await apply(c)
    age_cmd(c)
    floor(hass, mode="off")
    z, _, _ = await apply(c)
    assert z["manual_until"] is None


async def test_resume_and_notification(hass):
    c = make(hass, notify_manual=True)
    floor(hass)
    await apply(c)
    age_cmd(c)
    floor(hass, mode="off")
    z, _, notify = await apply(c)
    await hass.async_block_till_done()
    assert z["manual_until"] is not None
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()):
        await c.async_resume_zone(Z)
    assert "manual_until" not in c._rt(Z) and "climate.floor" not in c._last_cmd


async def test_target_clamped_to_device_range(hass):
    c = make(hass)
    hass.states.async_set("number.smart_heating_z1_teplota_den", "38")
    floor(hass, max_temp=30)
    await apply(c)
    assert c._last_cmd["climate.floor"]["temp"] == 30.0


async def test_entities_and_services(hass):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 21, "temperature": 21})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: {
        "name": "Spalna", "zone_type": "floor", "climate_entity": "climate.floor"}}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get("switch.smart_heating_fve_pauza").state == "off"
    assert hass.states.get("button.smart_heating_z1_obnovit_automatiku") is not None
    assert hass.states.get("switch.smart_heating_z1_rucne_prevzatie").state == "on"
    a = hass.states.get("sensor.smart_heating_z1_stav").attributes
    assert a["devices"] == [{"key": "floor", "entity": "climate.floor"}] and a["manual_until"] is None
    await hass.services.async_call(DOMAIN, "pause_solar", {"minutes": 30}, blocking=True)
    await hass.async_block_till_done()
    st = hass.states.get("switch.smart_heating_fve_pauza")
    assert st.state == "on" and st.attributes["do"]
    await hass.services.async_call(DOMAIN, "resume_solar", {}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get("switch.smart_heating_fve_pauza").state == "off"
