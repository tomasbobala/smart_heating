"""0.24.0: priority FVE 1-5 a podklady pre vizualizaciu kaskady."""
from datetime import timedelta

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN, PV_PRIORITIES
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator
from custom_components.smart_heating.sensor import PvCascadeSensor

ZONES = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}
OPTS = {"pv_auto": True, "pv_power_entity": "sensor.pv", "grid_power_entity": "sensor.grid",
        "battery_power_entity": "sensor.bat", "battery_soc_entity": "sensor.soc"}


def make(hass):
    zones = {z: {"name": z, "zone_type": "floor", "climate_entity": f"climate.{z}"} for z in ZONES}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": zones, "language": "sk", **OPTS})
    entry.add_to_hass(hass)
    for z, prio in ZONES.items():
        hass.states.async_set(f"select.smart_heating_{z}_fve_priorita", str(prio))
        hass.states.async_set(f"climate.{z}", "heat", {"current_temperature": 20, "temperature": 22})
    hass.states.async_set("sensor.pv", "6000")
    hass.states.async_set("sensor.grid", "-5000")
    hass.states.async_set("sensor.bat", "0")
    hass.states.async_set("sensor.soc", "100")
    return SmartHeatingCoordinator(hass, entry)


def test_five_priorities():
    assert PV_PRIORITIES == ["1", "2", "3", "4", "5"]


async def test_cascade_climbs_to_priority_5(hass):
    c = make(hass)
    tiers = []
    c._pv_engine_step()
    for _ in range(6):
        c._pv_engine_state()["add_since"] = dt_util.now() - timedelta(minutes=5.1)
        tiers.append(c._pv_engine_step())
    assert tiers[:5] == [1, 2, 3, 4, 5]
    assert tiers[5] == 5                     # vyssia uz nie je


async def test_snapshot_has_level_since_levels_and_settings(hass):
    c = make(hass)
    c._pv_engine_step()
    snap = c._pv_snapshot(False)
    assert snap["levels"] == [1, 2, 3, 4, 5]
    assert snap["tier_since"] is not None
    since0 = snap["tier_since"]
    c._pv_engine_state()["add_since"] = dt_util.now() - timedelta(minutes=5.1)
    c._pv_engine_step()
    snap = c._pv_snapshot(True)
    assert snap["tier"] == 1 and snap["tier_since"] != since0     # zmena urovne = novy cas
    assert snap["params"]["pv_add_power"] == 1000 and snap["params"]["pv_acc_step"] == 1.0
    c.data = {"pv_engine": snap}
    attrs = PvCascadeSensor(c).extra_state_attributes
    assert attrs["uroven_od"] == snap["tier_since"]
    assert attrs["urovne"] == [1, 2, 3, 4, 5]
    assert attrs["nastavenia"]["pv_add_minutes"] == 5
    assert {"urovne", "nastavenia"} <= PvCascadeSensor._unrecorded_attributes


async def test_zone_exposes_accumulation_step_time(hass):
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {"z": {
        "name": "Z", "zone_type": "floor", "climate_entity": "climate.z"}}, "pv_surplus_entity": "input_boolean.pv"})
    entry.add_to_hass(hass)
    hass.states.async_set("climate.z", "heat", {"current_temperature": 20, "temperature": 21})
    hass.states.async_set("input_boolean.pv", "on")
    c = SmartHeatingCoordinator(hass, entry)
    c._lang = "sk"
    z = c._compute()["zones"]["z"]
    assert z["pv_active"] and z["pv_acc_since"] is not None


# ------------------------------------------------------------------ limit prikonu kurenia

def make_limited(hass, limit=7000, heat=(1500, 1500)):
    zones = {}
    for i, z in enumerate(ZONES):
        zones[z] = {"name": z, "zone_type": "floor", "climate_entity": f"climate.{z}",
                    "floor_power_entities": [f"sensor.p_{z}"]}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={
        "zones": zones, "language": "sk", **OPTS, "pv_max_heat_power": limit})
    entry.add_to_hass(hass)
    for z, prio in ZONES.items():
        hass.states.async_set(f"select.smart_heating_{z}_fve_priorita", str(prio))
        hass.states.async_set(f"climate.{z}", "heat", {"current_temperature": 20, "temperature": 22})
        hass.states.async_set(f"sensor.p_{z}", "0", {"unit_of_measurement": "W"})
    for z, w in zip(ZONES, heat):
        hass.states.async_set(f"sensor.p_{z}", str(w), {"unit_of_measurement": "W"})
    hass.states.async_set("sensor.pv", "9000")
    hass.states.async_set("sensor.grid", "-4000")
    hass.states.async_set("sensor.bat", "0")
    hass.states.async_set("sensor.soc", "100")
    return SmartHeatingCoordinator(hass, entry)


async def test_limit_stops_adding_priorities(hass):
    c = make_limited(hass, heat=(3000, 3500))          # kuri 6,5 kW, dalsia zona by limit 7 kW prekrocila
    c._pv_engine_state()["tier"] = 2
    c._pv_engine_step()
    c._pv_engine_state()["add_since"] = dt_util.now() - timedelta(minutes=10)
    assert c._pv_engine_step() == 2
    assert c._pv_engine_state()["reason"] == "limit_hold"
    assert c._pv_snapshot(True)["heat"] == 6500


async def test_room_under_limit_adds(hass):
    c = make_limited(hass, heat=(2000, 2000))          # 4 kW + 1 kW dalsia zona <= 7 kW
    c._pv_engine_state()["tier"] = 2
    c._pv_engine_step()
    c._pv_engine_state()["add_since"] = dt_util.now() - timedelta(minutes=5.1)
    assert c._pv_engine_step() == 3


async def test_over_limit_sheds_lowest_priority(hass):
    c = make_limited(hass, heat=(4000, 3500))          # 7,5 kW > 7 kW
    c._pv_engine_state()["tier"] = 2
    c._pv_engine_step()
    assert c._pv_engine_state()["reason"] == "shed:limit"
    c._pv_engine_state()["bad_since"] = dt_util.now() - timedelta(minutes=10.1)
    assert c._pv_engine_step() == 1


async def test_zero_means_no_limit(hass):
    c = make_limited(hass, limit=0, heat=(9000, 9000))
    c._pv_engine_state()["tier"] = 2
    c._pv_engine_step()
    c._pv_engine_state()["add_since"] = dt_util.now() - timedelta(minutes=5.1)
    assert c._pv_engine_step() == 3


async def test_default_limit_is_7000(hass):
    c = make(hass)
    assert c._pv_param("pv_max_heat_power") == 7000
    assert c._pv_snapshot(False)["params"]["pv_max_heat_power"] == 7000
