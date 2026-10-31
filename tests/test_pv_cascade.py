"""Kaskada FVE prebytku: priorita 1 kuri prva, nizsie priority az ked su vyssie
nahriate; pri vychladnuti vyssej priority sa nizsie hned odpoja."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

ZONES = {"obyv": "Obyvacka", "kupe": "Kupelna", "spal": "Spalna", "alex": "Alex"}


def _setup(hass, priorities, temps, pv="on"):
    zones = {z: {"name": n, "zone_type": "floor", "climate_entity": f"climate.{z}"} for z, n in ZONES.items()}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={
        "zones": zones, "language": "sk", "pv_surplus_entity": "input_boolean.fve"})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    hass.states.async_set("input_boolean.fve", pv)
    for z in ZONES:
        # den aj noc 22 -> FVE ciel 22 bez ohladu na cas testu
        hass.states.async_set(f"number.smart_heating_{z}_teplota_den", "22")
        hass.states.async_set(f"number.smart_heating_{z}_teplota_noc", "22")
        hass.states.async_set(f"select.smart_heating_{z}_fve_priorita", str(priorities.get(z, 1)))
    set_temps(hass, temps)
    return c


def set_temps(hass, temps):
    for z, t in temps.items():
        hass.states.async_set(f"climate.{z}", "heat", {"current_temperature": t, "temperature": 22})


async def run(c):
    c.data = c._compute()
    with patch.object(c, "_apply_device", new=AsyncMock()), patch.object(c, "_notify", new=AsyncMock()):
        await c._async_apply()
    return {z: (d["pv_active"], d["pv_waiting"]) for z, d in c.data["zones"].items()}


TOMAS = {"obyv": 1, "kupe": 1, "spal": 2, "alex": 3}


async def test_default_all_priority_1_behaves_as_before(hass):
    c = _setup(hass, {}, {z: 19 for z in ZONES})
    r = await run(c)
    assert all(active and not waiting for active, waiting in r.values())


async def test_only_priority_1_heats_while_it_is_cold(hass):
    c = _setup(hass, TOMAS, {"obyv": 20, "kupe": 22, "spal": 19, "alex": 19})
    r = await run(c)
    assert r["obyv"] == (True, False) and r["kupe"] == (True, False)
    assert r["spal"] == (False, True) and r["alex"] == (False, True)


async def test_next_priority_joins_after_delay_when_priority_1_is_warm(hass):
    c = _setup(hass, TOMAS, {"obyv": 22, "kupe": 21.9, "spal": 19, "alex": 19})
    await run(c)                                     # prvy beh: zisti FVE ciele
    r = await run(c)
    assert r["spal"] == (False, True)                # este nie 10 min
    c._global_rt["pv_sat_since"] = dt_util.now() - timedelta(minutes=11)
    r = await run(c)
    assert r["spal"] == (True, False)                # priorita 2 sa pridala
    assert r["alex"] == (False, True)                # priorita 3 caka na Spalnu
    set_temps(hass, {"spal": 22})
    await run(c)
    c._global_rt["pv_sat_since"] = dt_util.now() - timedelta(minutes=11)
    r = await run(c)
    assert r["alex"] == (True, False)


async def test_lower_priorities_released_immediately_when_priority_1_cools(hass):
    c = _setup(hass, TOMAS, {"obyv": 22, "kupe": 22, "spal": 19, "alex": 19})
    await run(c)
    c._global_rt["pv_sat_since"] = dt_util.now() - timedelta(minutes=11)
    r = await run(c)
    assert r["spal"] == (True, False)
    set_temps(hass, {"kupe": 21.6})                  # len 0.4 pod -> v hystereze, drzi
    r = await run(c)
    assert r["spal"] == (True, False)
    set_temps(hass, {"kupe": 21.4})                  # 0.6 pod -> priorita sa vracia Kupelni
    r = await run(c)
    assert r["spal"] == (False, True) and r["kupe"] == (True, False)


async def test_zone_without_pv_switch_is_ignored(hass):
    c = _setup(hass, TOMAS, {"obyv": 18, "kupe": 22, "spal": 19, "alex": 19})
    hass.states.async_set("switch.smart_heating_obyv_vyuzi_fve_prebytok", "off")
    await run(c)
    c._global_rt["pv_sat_since"] = dt_util.now() - timedelta(minutes=11)
    r = await run(c)
    assert r["obyv"] == (False, False)               # nevyuziva FVE, neblokuje kaskadu
    assert r["spal"] == (True, False)


async def test_no_surplus_resets_cascade(hass):
    c = _setup(hass, TOMAS, {"obyv": 22, "kupe": 22, "spal": 19, "alex": 19})
    await run(c)
    c._global_rt["pv_sat_since"] = dt_util.now() - timedelta(minutes=11)
    await run(c)
    hass.states.async_set("input_boolean.fve", "off")
    r = await run(c)
    assert all(v == (False, False) for v in r.values())
    assert c._global_rt["pv_tier"] is None
