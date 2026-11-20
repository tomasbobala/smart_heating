"""Zbytocne prepisovanie entit a zapisy do recorderu v 30 s ticku."""
from datetime import timedelta
from unittest.mock import patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN

Z = "z1"


async def _setup(hass):
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 21.0, "temperature": 21})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {
        Z: {"name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.obyvacka"}}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DOMAIN][entry.entry_id]


async def test_fast_tick_updates_only_fast_entities(hass):
    c = await _setup(hass)
    await c._fast_tick()                       # prve nacitanie meracov
    full, fast = [], []
    c.async_add_listener(lambda: full.append(1))
    c.async_add_fast_listener(lambda: fast.append(1))
    await c._fast_tick()
    await c._fast_tick()
    assert full == []                          # ~200 zonovych entit sa neprepisuje
    assert len(fast) >= 2                      # kaskada, energie, senzor stav ano


async def test_fast_listener_can_be_removed(hass):
    c = await _setup(hass)
    calls = []
    remove = c.async_add_fast_listener(lambda: calls.append(1))
    remove()
    c.async_update_fast_listeners()
    assert calls == []


async def test_energy_sensor_written_at_most_every_5_minutes(hass):
    c = await _setup(hass)
    eid = "sensor.smart_heating_energia_domu_zo_siete"
    c.async_update_fast_listeners()            # prvy zapis
    first = hass.states.get(eid).state
    c._house_energy_kwh["siet"] += 0.004       # 30 s pri ~500 W
    c.async_update_fast_listeners()
    await hass.async_block_till_done()
    assert hass.states.get(eid).state == first  # o 30 s este nie

    later = dt_util.utcnow() + timedelta(minutes=5, seconds=1)
    with patch("custom_components.smart_heating.sensor.dt_util.utcnow", return_value=later):
        c.async_update_fast_listeners()
    await hass.async_block_till_done()
    assert float(hass.states.get(eid).state) == round(c._house_energy_kwh["siet"], 3)


async def test_zone_entities_still_update_on_recompute(hass):
    c = await _setup(hass)
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 19.5, "temperature": 21})
    await c.async_recompute_and_apply()
    await hass.async_block_till_done()
    assert hass.states.get(f"climate.smart_heating_{Z}").attributes["current_temperature"] == 19.5
