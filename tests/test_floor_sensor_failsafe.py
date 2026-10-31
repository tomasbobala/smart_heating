"""0.21.2: vypadok senzora podlahy - ochrana max. teploty podlahy nesmie ticho vypadnut.

Po 10 min bez platnej teploty podlahy (nedostupny / nezmyselny senzor) sa podlahovka
vypne. Zona typu floor cela, floor_ac a radiator_floor len podlaha (klima / radiator
kuria dalej). Nudzova protimrazova ochrana ma prednost."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "z1"


def _coord(hass, **zone_over):
    zone = {"name": "Spalna", "zone_type": "floor", "climate_entity": "climate.floor",
            "floor_temp_entity": "sensor.floor"}
    zone.update(zone_over)
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: zone}, "language": "sk"})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._lang = "sk"
    return c


def _heat_demand(hass, air=18):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": air, "temperature": 22})
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    hass.states.async_set("number.smart_heating_z1_teplota_den", "22")


async def _run(c):
    c.data = c._compute()
    calls = {"device": [], "switch": []}

    async def dev(entity, mode, target):
        calls["device"].append((entity, mode))

    async def sw(entity, on):
        calls["switch"].append((entity, on))

    with patch.object(c, "_apply_device", new=AsyncMock(side_effect=dev)), \
         patch.object(c, "_apply_switch", new=AsyncMock(side_effect=sw)), \
         patch.object(c, "_notify", new=AsyncMock()):
        await c._async_apply()
    return c.data["zones"][Z], calls


def _age(c, minutes=11):
    c._rt(Z)["floor_lost_since"] = dt_util.now() - timedelta(minutes=minutes)


async def test_floor_zone_stops_after_grace(hass):
    _heat_demand(hass)
    hass.states.async_set("sensor.floor", "unavailable")
    c = _coord(hass)
    z, _ = await _run(c)
    assert z["heating_allowed"] is True          # kratky vypadok - este kuri
    assert z["floor_sensor_lost"] is False
    _age(c)
    z, calls = await _run(c)
    assert z["floor_sensor_lost"] is True
    assert z["heating_allowed"] is False
    assert "senzor podlahy" in z["reason"]
    assert ("climate.floor", "off") in calls["device"]


async def test_implausible_value_counts_as_lost(hass):
    _heat_demand(hass)
    hass.states.async_set("sensor.floor", "-40")   # odpojene NTC
    c = _coord(hass)
    await _run(c)
    _age(c)
    z, _ = await _run(c)
    assert z["floor_sensor_lost"] is True and z["heating_allowed"] is False


async def test_heating_resumes_when_sensor_returns(hass):
    _heat_demand(hass)
    hass.states.async_set("sensor.floor", "unavailable")
    c = _coord(hass)
    await _run(c)
    _age(c)
    await _run(c)
    hass.states.async_set("sensor.floor", "24")
    z, calls = await _run(c)
    assert z["floor_sensor_lost"] is False
    assert z["heating_allowed"] is True
    assert ("climate.floor", "heat") in calls["device"]


async def test_overheat_block_kept_during_short_outage(hass):
    _heat_demand(hass)
    hass.states.async_set("sensor.floor", "29")      # nad max 28
    c = _coord(hass)
    z, _ = await _run(c)
    assert z["floor_override"] is True
    hass.states.async_set("sensor.floor", "unavailable")
    z, _ = await _run(c)
    assert z["floor_override"] is True and z["heating_allowed"] is False   # nepustime naslepo


async def test_emergency_still_heats(hass):
    _heat_demand(hass, air=6)                          # pod nudzovou teplotou 8
    hass.states.async_set("sensor.floor", "unavailable")
    c = _coord(hass)
    await _run(c)
    _age(c)
    z, _ = await _run(c)
    assert z["floor_sensor_lost"] is True
    assert z["emergency_active"] is True and z["heating_allowed"] is True


async def test_pv_surplus_does_not_override(hass):
    _heat_demand(hass)
    hass.states.async_set("sensor.floor", "unavailable")
    hass.states.async_set("input_boolean.pv", "on")
    c = _coord(hass)
    c.hass.config_entries.async_update_entry(c.entry, options={**c.entry.options, "pv_surplus_entity": "input_boolean.pv"})
    await _run(c)
    _age(c)
    z, _ = await _run(c)
    assert z["pv_active"] is False and z["heating_allowed"] is False


async def test_floor_ac_keeps_ac_but_not_floor(hass):
    _heat_demand(hass, air=17)
    hass.states.async_set("climate.ac", "heat", {})
    hass.states.async_set("sensor.floor", "unavailable")
    c = _coord(hass, zone_type="floor_ac", ac_entity="climate.ac")
    await _run(c)
    _age(c)
    c._rt(Z)["ac_deficit_since"] = dt_util.now() - timedelta(hours=2)   # klima davno nestiha
    z, calls = await _run(c)
    assert z["heating_allowed"] is True
    assert ("climate.ac", "heat") in calls["device"]
    assert ("climate.floor", "off") in calls["device"]
    assert ("climate.floor", "heat") not in calls["device"]


async def test_radiator_floor_keeps_radiator(hass):
    _heat_demand(hass, air=17)
    hass.states.async_set("sensor.air", "17")
    hass.states.async_set("switch.radiator", "off")
    hass.states.async_set("sensor.floor", "unavailable")
    c = _coord(hass, zone_type="radiator_floor", radiator_entity="switch.radiator", external_temp_entity="sensor.air")
    await _run(c)
    _age(c)
    z, calls = await _run(c)
    assert z["floor_sensor_lost"] is True
    assert ("switch.radiator", True) in calls["switch"]
    assert ("climate.floor", "heat") not in calls["device"]


async def test_zone_without_floor_sensor_unaffected(hass):
    _heat_demand(hass)
    c = _coord(hass, floor_temp_entity=None)
    z, _ = await _run(c)
    assert z["floor_sensor_lost"] is False and z["heating_allowed"] is True
