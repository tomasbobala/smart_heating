"""0.21.2: stav zony sa pri kazdom prepocte nesmie na chvilu vratit na odhad.

Prepocet (_compute) zapise entity hned, aplikovanie (_async_apply) az potom doplni
skutocny stav (hvac_action, zdroj, poruchy z meracov a pomaleho nabehu). Ked
_compute tieto udaje zahodil, kazdy prepocet zapisal 'kuri' -> 'nekuri' a poruchy
'zmiznu' -> 'su spat': binary_sensor v_chode blikal (zle 'Kurenie dnes'),
historia sa nafukovala a riadok poruch na karte skakal (stranka poskakovala)."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "z1"


def _coord(hass):
    zone = {"name": "Spalna", "zone_type": "floor", "climate_entity": "climate.floor"}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: zone}, "language": "sk"})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._lang = "sk"
    return c


async def _apply(c):
    with patch.object(c, "_apply_device", new=AsyncMock()), patch.object(c, "_notify", new=AsyncMock()):
        await c._async_apply()


async def test_recompute_keeps_actual_action_and_source(hass):
    # termostat ma svoju teplotu - rele vypnute, hlasi idle
    hass.states.async_set("climate.floor", "heat", {"hvac_action": "idle", "current_temperature": 21.5, "temperature": 21})
    c = _coord(hass)
    c.data = c._compute()
    await _apply(c)
    assert c.data["zones"][Z]["actual_action"] == "idle"
    source = c.data["zones"][Z]["heat_source"]
    assert source

    fresh = c._compute()          # toto sa zapise do entit pred dalsim aplikovanim
    assert fresh["zones"][Z].get("actual_action") == "idle"
    assert fresh["zones"][Z].get("heat_source") == source


async def test_recompute_keeps_dynamic_problems(hass):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 18, "temperature": 22})
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    hass.states.async_set("number.smart_heating_z1_teplota_den", "22")
    c = _coord(hass)
    c._startup_time = dt_util.now() - timedelta(hours=1)
    c.data = c._compute()
    c._rt(Z)["slow_since"] = dt_util.now() - timedelta(hours=5)
    await _apply(c)
    problems = c.data["zones"][Z]["problems"]
    assert any("dohriať" in p for p in problems), problems

    fresh = c._compute()
    assert fresh["zones"][Z]["problems"] == problems


async def _calls(hass, c, entity, mode, target):
    calls = []
    for svc in ("set_temperature", "set_hvac_mode"):
        calls.append(async_mock_service(hass, "climate", svc))
    await c._apply_device(entity, mode, target)
    await hass.async_block_till_done()
    return [("climate", x.service, dict(x.data)) for lst in calls for x in lst]


async def test_apply_skips_unavailable_device(hass):
    c = _coord(hass)
    hass.states.async_set("climate.floor", "unavailable", {})
    assert await _calls(hass, c, "climate.floor", "heat", 21) == []


async def test_apply_rounds_target_to_device_step(hass):
    """Daikin ma krok 1 °C: 21,5 ulozi ako 22 - dalsi prepocet uz nic neposiela."""
    c = _coord(hass)
    hass.states.async_set("climate.ac", "heat", {"temperature": 22, "target_temp_step": 1})
    assert await _calls(hass, c, "climate.ac", "heat", 21.5) == []
    hass.states.async_set("climate.ac", "heat", {"temperature": 20, "target_temp_step": 1})
    calls = await _calls(hass, c, "climate.ac", "heat", 21.5)
    assert calls == [("climate", "set_temperature", {"entity_id": "climate.ac", "temperature": 22.0})]


async def test_apply_float_target_equal(hass):
    c = _coord(hass)
    hass.states.async_set("climate.floor", "heat", {"temperature": 21.0, "target_temp_step": 0.5})
    assert await _calls(hass, c, "climate.floor", "heat", 21) == []


def test_volatile_and_config_attributes_not_recorded():
    from custom_components.smart_heating.sensor import PvCascadeSensor, ZoneReasonSensor
    assert {"prebytok_w", "pridanie_za_min"} <= PvCascadeSensor._unrecorded_attributes
    assert {"power_entities", "sources", "presence_entities"} <= ZoneReasonSensor._unrecorded_attributes
    assert "problemy" not in ZoneReasonSensor._unrecorded_attributes
