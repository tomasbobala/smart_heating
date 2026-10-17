"""Merace po zdrojoch: skutocny stav z prikonu, kontrola meracov, energia z FVE."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "z1"


def make(hass, zone=None, **opts):
    zone = zone or {"name": "Spalna", "zone_type": "floor", "climate_entity": "climate.floor",
                    "floor_power_entities": ["sensor.floor_w"], "floor_energy_entities": ["sensor.floor_kwh"]}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: zone}, "language": "sk", **opts})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._startup_time = dt_util.now() - timedelta(hours=1)
    return c


async def run(c):
    c.data = c._compute()
    with patch.object(c, "_apply_device", new=AsyncMock()), patch.object(c, "_apply_switch", new=AsyncMock()), \
         patch.object(c, "_notify", new=AsyncMock()) as notify:
        await c._async_apply()
    return c.data["zones"][Z], notify


def floor(hass, action, watts, current=20, target=22):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": current, "temperature": target, "hvac_action": action})
    hass.states.async_set("sensor.floor_w", str(watts), {"unit_of_measurement": "W"})


async def test_meter_decides_actual_state(hass):
    c = make(hass)
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    floor(hass, "idle", 850)                     # termostat hovori idle, merac taha
    z, _ = await run(c)
    assert z["actual_action"] == "heating"
    floor(hass, "heating", 0)                    # termostat hovori kuri, merac 0 W
    z, _ = await run(c)
    assert z["actual_action"] == "idle"


async def test_kw_unit_is_converted(hass):
    c = make(hass)
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    floor(hass, "idle", 0)
    hass.states.async_set("sensor.floor_w", "0.9", {"unit_of_measurement": "kW"})
    z, _ = await run(c)
    assert z["actual_action"] == "heating"


async def test_meter_no_power_reported_after_10_min(hass):
    c = make(hass)
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    floor(hass, "heating", 0)
    z, _ = await run(c)
    assert z["meter_problems"] == []
    c._rt(Z)["meter_since"]["meter:floor:nopower"] = dt_util.now() - timedelta(minutes=11)
    z, notify = await run(c)
    assert z["meter_problems"] == ["Podlaha hlási kúrenie, ale merač ukazuje 0 W viac ako 10 min"]
    assert notify.await_count == 1
    floor(hass, "heating", 900)                  # ohrev sa rozbehol -> porucha zmizne
    z, _ = await run(c)
    assert z["meter_problems"] == [] and "meter:floor:nopower" not in c._rt(Z)["meter_since"]


async def test_meter_stuck_relay(hass):
    c = make(hass, tariff_entity="input_boolean.tarifa")
    hass.states.async_set("input_boolean.tarifa", "off")      # kurenie zakazane -> podlaha ma byt vypnuta
    floor(hass, "idle", 1200)
    await run(c)
    c._rt(Z)["meter_since"]["meter:floor:stuck"] = dt_util.now() - timedelta(minutes=11)
    z, _ = await run(c)
    assert z["meter_problems"] == ["Podlaha má byť vypnutá, ale ťahá 1200 W viac ako 10 min"]


async def test_pv_energy_accumulates_only_while_pv_active(hass):
    c = make(hass)
    floor(hass, "heating", 1000)
    c.data = {"zones": {Z: {"pv_active": True}}}
    c._pv_energy_at = dt_util.now() - timedelta(minutes=6)
    c._accumulate_pv_energy()
    assert 0.09 < c._pv_energy_kwh < 0.11          # 1 kW * 0,1 h
    c.data = {"zones": {Z: {"pv_active": False}}}
    c._pv_energy_at = dt_util.now() - timedelta(minutes=6)
    c._accumulate_pv_energy()
    assert 0.09 < c._pv_energy_kwh < 0.11          # bez FVE nepribuda


async def test_fast_tick_recomputes_only_when_meter_state_changes(hass):
    c = make(hass)
    floor(hass, "idle", 0)
    c.data = c._compute()
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()) as rec:
        await c._fast_tick()                     # prve nacitanie meracov
        await c._fast_tick()
        hass.states.async_set("sensor.floor_w", "5")   # stale "vypnute" (pod 20 W)
        await c._fast_tick()
        assert rec.await_count == 1
        hass.states.async_set("sensor.floor_w", "900")
        await c._fast_tick()
        assert rec.await_count == 2


async def test_sources_exposed_without_duplicates(hass):
    hass.states.async_set("climate.obyv", "heat", {"current_temperature": 22, "temperature": 22})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {"o1": {
        "name": "Obyvacka", "zone_type": "floor_ac", "climate_entity": "climate.obyv", "ac_entity": "climate.daikin",
        "floor_power_entities": ["sensor.f_w"], "floor_energy_entities": ["sensor.f_kwh"],
        "ac_power_entities": ["sensor.ac_w"], "ac_energy_entities": ["sensor.ac_kwh"],
        "power_entities": ["sensor.f_w"],            # omylom aj v ostatnych
    }}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    a = hass.states.get("sensor.smart_heating_o1_stav").attributes
    assert a["power_entities"] == ["sensor.f_w", "sensor.ac_w"]
    assert [s["key"] for s in a["sources"]] == ["floor", "ac", "other"]
    assert hass.states.get("sensor.smart_heating_energia_z_fve") is not None
