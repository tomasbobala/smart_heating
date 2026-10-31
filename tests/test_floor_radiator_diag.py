"""0.17.0: hystereza max. podlahy, min. teplota podlahy, typ radiator + podlaha,
diagnostika a logovanie nabehov."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "z1"


def _entry(hass, zone, **opts):
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: zone}, "language": "sk", **opts})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._lang = "sk"
    return c


def _floor_zone(**over):
    z = {"name": "Kupelna", "zone_type": "floor", "climate_entity": "climate.floor",
         "floor_temp_entity": "sensor.floor"}
    z.update(over)
    return z


def _radiator_zone(**over):
    z = _floor_zone(zone_type="radiator_floor", radiator_entity="switch.radiator",
                    external_temp_entity="sensor.air")
    z.update(over)
    return z


def _set(hass, **states):
    for eid, val in states.items():
        hass.states.async_set(eid.replace("__", "."), str(val), {})


async def _run(c):
    """Rovnako ako realny refresh: vypocet a potom aplikovanie na zariadenia."""
    c.data = c._compute()
    calls = {"device": [], "switch": []}

    async def dev(entity, mode, target):
        calls["device"].append((entity, mode, target))

    async def sw(entity, on):
        calls["switch"].append((entity, on))

    with patch.object(c, "_apply_device", new=AsyncMock(side_effect=dev)), \
         patch.object(c, "_apply_switch", new=AsyncMock(side_effect=sw)), \
         patch.object(c, "_notify", new=AsyncMock()) as notify:
        await c._async_apply()
    return c.data["zones"][Z], calls, notify


@pytest.fixture
def base(hass):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 21, "temperature": 21})
    return hass


# ---------------------------------------------------------------- max. podlahy

async def test_floor_max_hysteresis(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=28.0)                       # max 28 (default)
    z, _, _ = await _run(c)
    assert z["floor_override"] and not z["heating_allowed"]
    _set(hass, sensor__floor=27.2)                       # v pasme hysterezie (1.5) -> stale blok
    z, _, _ = await _run(c)
    assert z["floor_override"] and not z["heating_allowed"]
    assert "26.5" in z["reason"]                         # povie, kedy sa obnovi
    _set(hass, sensor__floor=26.5)                       # max - hystereza -> uvolni
    z, _, _ = await _run(c)
    assert not z["floor_override"] and z["heating_allowed"]


# ---------------------------------------------------------------- min. podlahy

async def test_floor_min_off_by_default_for_existing_zones(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=15, number__smart_heating_z1_floor_min=24)
    z, calls, _ = await _run(c)
    assert not z["floor_guard"]


async def test_floor_min_heats_floor_even_when_air_warm(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=22, number__smart_heating_z1_floor_min=24,
         switch__smart_heating_z1_udrzat_min_podlahy="on")
    z, calls, _ = await _run(c)
    assert z["floor_guard"]
    # termostat dostane max. podlahy ako setpoint, aby kuril aj pri teplom vzduchu
    assert ("climate.floor", "heat", 28.0) in calls["device"]
    assert z["heat_source"] == "Podlaha (min. teplota podlahy)"
    _set(hass, sensor__floor=24.5)                       # v hystereze (24 .. 25.5) -> stale
    z, _, _ = await _run(c)
    assert z["floor_guard"]
    _set(hass, sensor__floor=25.5)                       # min + hystereza -> stop
    z, _, _ = await _run(c)
    assert not z["floor_guard"]


async def test_floor_min_not_in_frost_mode(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=15, number__smart_heating_z1_floor_min=24,
         switch__smart_heating_z1_udrzat_min_podlahy="on", select__smart_heating_z1_rezim="Mraz")
    z, _, _ = await _run(c)
    assert not z["floor_guard"]


# ---------------------------------------------------------------- radiator + podlaha

async def test_radiator_regulates_air_with_hysteresis(base):
    hass = base
    c = _entry(hass, _radiator_zone())
    _set(hass, sensor__floor=26, select__smart_heating_z1_rezim="Den", number__smart_heating_z1_teplota_den=22)   # ciel = teplota_den 22
    _set(hass, sensor__air=21.4)                         # <= 22 - 0.5 -> zapni
    z, calls, _ = await _run(c)
    assert ("switch.radiator", True) in calls["switch"]
    assert z["heat_source"] == "Radiátor" and z["actual_action"] == "heating"
    _set(hass, sensor__air=21.8)                         # v hystereze -> drzi zapnute
    z, calls, _ = await _run(c)
    assert ("switch.radiator", True) in calls["switch"]
    _set(hass, sensor__air=22.0)                         # na cieli -> vypni
    z, calls, _ = await _run(c)
    assert ("switch.radiator", False) in calls["switch"]
    assert z["actual_action"] == "idle"


async def test_radiator_and_floor_are_independent(base):
    """Vzduch je teply (radiator stoji), podlaha je studena -> podlaha kuri sama."""
    hass = base
    c = _entry(hass, _radiator_zone())
    _set(hass, sensor__air=23, sensor__floor=20, number__smart_heating_z1_floor_min=24,
         select__smart_heating_z1_rezim="Den", number__smart_heating_z1_teplota_den=22)
    z, calls, _ = await _run(c)
    assert ("switch.radiator", False) in calls["switch"]
    assert ("climate.floor", "heat", 28.0) in calls["device"]
    assert z["heat_source"] == "Podlaha (min. teplota podlahy)"


async def test_radiator_floor_min_enabled_by_default(base):
    hass = base
    c = _entry(hass, _radiator_zone())
    _set(hass, sensor__air=23, sensor__floor=20, number__smart_heating_z1_floor_min=24)
    z, _, _ = await _run(c)
    assert z["floor_guard"]


async def test_hot_floor_blocks_only_floor_in_radiator_zone(base):
    hass = base
    c = _entry(hass, _radiator_zone())
    _set(hass, sensor__air=20, sensor__floor=29, select__smart_heating_z1_rezim="Den", number__smart_heating_z1_teplota_den=22)
    z, calls, _ = await _run(c)
    assert z["floor_override"] and z["heating_allowed"]
    assert ("switch.radiator", True) in calls["switch"]
    assert ("climate.floor", "off", None) in calls["device"]


async def test_radiator_without_air_temperature_stays_off(base):
    hass = base
    c = _entry(hass, _radiator_zone())
    _set(hass, sensor__floor=26, select__smart_heating_z1_rezim="Den", number__smart_heating_z1_teplota_den=22)   # sensor.air neexistuje
    _, calls, _ = await _run(c)
    assert ("switch.radiator", False) in calls["switch"]


async def test_tariff_block_turns_off_radiator_and_floor(base):
    hass = base
    c = _entry(hass, _radiator_zone(), tariff_entity="input_boolean.tarifa")
    _set(hass, sensor__air=19, sensor__floor=20, input_boolean__tarifa="off",
         number__smart_heating_z1_floor_min=24)
    _, calls, _ = await _run(c)
    assert ("switch.radiator", False) in calls["switch"]
    assert ("climate.floor", "off", None) in calls["device"]


async def test_external_thermometer_and_radiator_are_tracked(base):
    c = _entry(base, _radiator_zone())
    ids = c._tracked_entity_ids()
    assert "sensor.air" in ids and "switch.radiator" in ids


# ---------------------------------------------------------------- diagnostika

async def test_unavailable_device_reported_after_15_min_and_notified(base):
    hass = base
    c = _entry(hass, _floor_zone())
    c._startup_time = dt_util.now() - timedelta(hours=1)
    _set(hass, sensor__floor=22)
    hass.states.async_set("climate.floor", "unavailable", {})
    z, _, notify = await _run(c)
    assert z["problems"] == []                           # este nie je 15 min
    c._rt(Z)["unavail_since"]["climate.floor"] = dt_util.now() - timedelta(minutes=16)
    z, _, notify = await _run(c)
    assert len(z["problems"]) == 1 and "nedostupné" in z["problems"][0]
    assert notify.await_count == 1 and "⚠️" in notify.await_args.args[0]
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 21, "temperature": 21})
    z, _, notify = await _run(c)
    assert z["problems"] == []
    assert notify.await_count == 1 and "vyriešené" in notify.await_args.args[0]


async def test_implausible_floor_value(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=85)
    z, _, _ = await _run(c)
    assert any("podlahy" in p for p in z["problems"])


async def test_zone_not_reaching_target(base):
    hass = base
    c = _entry(hass, _floor_zone())
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 18, "temperature": 22})
    _set(hass, sensor__floor=22, select__smart_heating_z1_rezim="Den", number__smart_heating_z1_teplota_den=22)
    z, _, _ = await _run(c)
    assert z["problems"] == []
    c._rt(Z)["slow_since"] = dt_util.now() - timedelta(hours=3, minutes=5)
    z, _, _ = await _run(c)
    assert any("dohriať" in p for p in z["problems"])


async def test_no_notifications_in_startup_grace(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=85)
    _, _, notify = await _run(c)
    assert notify.await_count == 0


# ---------------------------------------------------------------- nabehy

async def test_warmup_is_logged_and_summarized(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=22, select__smart_heating_z1_rezim="Den", number__smart_heating_z1_teplota_den=22)
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 20, "temperature": 22,
                                                    "hvac_action": "heating"})
    await _run(c)
    assert c._rt(Z)["warmup"] is not None
    c._rt(Z)["warmup"]["start"] = dt_util.now() - timedelta(minutes=60)
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 22, "temperature": 22,
                                                    "hvac_action": "idle"})
    with patch.object(c._warmup_store, "async_delay_save") as save:
        await _run(c)
    runs = c._warmup_data[Z]
    assert len(runs) == 1 and runs[0]["from"] == 20 and runs[0]["to"] == 22
    assert 59 <= runs[0]["minutes"] <= 61
    save.assert_called_once()
    assert c._warmup_summary(Z) == (30, 1)               # 60 min / 2 °C


async def test_warmup_aborted_when_target_changes(base):
    hass = base
    c = _entry(hass, _floor_zone())
    _set(hass, sensor__floor=22, select__smart_heating_z1_rezim="Den", number__smart_heating_z1_teplota_den=22)
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 20, "temperature": 22,
                                                    "hvac_action": "heating"})
    await _run(c)
    _set(hass, select__smart_heating_z1_rezim="Noc")
    await _run(c)
    assert c._rt(Z)["warmup"] is None and Z not in c._warmup_data
