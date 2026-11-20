"""Virtualny termostat zony - jednotky teploty (HA 2026.11 natívne API) a prevody."""
import logging

from homeassistant.components.climate import ClimateEntity
from homeassistant.util.unit_system import METRIC_SYSTEM, US_CUSTOMARY_SYSTEM
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating import climate as sh_climate
from custom_components.smart_heating.const import DOMAIN

Z = "z1"


async def _setup(hass):
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 22.4, "temperature": 21})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {
        Z: {"name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.obyvacka"}}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.states.get(f"climate.smart_heating_{Z}")


def test_no_deprecated_temperature_members_on_new_ha():
    cls = sh_climate.SmartHeatingZoneClimate
    names = vars(cls)
    assert "_attr_native_temperature_unit" in names
    if hasattr(ClimateEntity, "native_temperature_unit"):
        # HA 2026.11+: stare nazvy by vypisali varovanie "provides the deprecated ..."
        for old in ("_attr_temperature_unit", "temperature_unit", "current_temperature", "target_temperature"):
            assert old not in names, old
    else:
        assert "_attr_temperature_unit" in names  # starsie HA pozna len stary nazov


async def test_values_unchanged_metric(hass, caplog):
    hass.config.units = METRIC_SYSTEM
    with caplog.at_level(logging.WARNING):
        state = await _setup(hass)
    assert "deprecated" not in caplog.text
    assert state.attributes["current_temperature"] == 22.4
    target = state.attributes["temperature"]
    num = float(hass.states.get(f"number.smart_heating_{Z}_teplota_den").state)
    assert target is not None
    # minimum/maximum zostavaju predvolene hodnoty HA v °C
    assert state.attributes["min_temp"] == 7
    assert state.attributes["max_temp"] == 35
    assert num > 0


async def test_conversion_to_fahrenheit_system(hass):
    """Entita hlasi °C; pri imperialnom systeme ich HA prepocita na °F."""
    hass.config.units = US_CUSTOMARY_SYSTEM
    state = await _setup(hass)
    assert state.attributes["current_temperature"] == 72   # 22,4 °C -> 72,3 °F (presnost 1)


async def test_set_temperature_writes_celsius_number(hass):
    hass.config.units = METRIC_SYSTEM
    state = await _setup(hass)
    key = {"Den": "teplota_den", "Noc": "teplota_noc", "Min": "teplota_min", "Mraz": "teplota_mraz"}.get(
        state.attributes["aktivny_podrezim"], "teplota_den")
    number = hass.states.get(f"number.smart_heating_{Z}_{key}")
    value = float(number.attributes["min"]) + 1.5      # urcite v rozsahu a ina nez aktualna
    await hass.services.async_call(
        "climate", "set_temperature", {"entity_id": f"climate.smart_heating_{Z}", "temperature": value}, blocking=True,
    )
    await hass.async_block_till_done()
    assert float(hass.states.get(f"number.smart_heating_{Z}_{key}").state) == value


async def test_set_temperature_from_fahrenheit_system_converts_to_celsius(hass):
    hass.config.units = US_CUSTOMARY_SYSTEM
    state = await _setup(hass)
    key = {"Den": "teplota_den", "Noc": "teplota_noc", "Min": "teplota_min", "Mraz": "teplota_mraz"}.get(
        state.attributes["aktivny_podrezim"], "teplota_den")
    number = hass.states.get(f"number.smart_heating_{Z}_{key}")
    celsius = float(number.attributes["min"]) + 2   # number je v °C, HA ho zobrazi v °F
    fahrenheit = celsius * 9 / 5 + 32
    await hass.services.async_call(
        "climate", "set_temperature", {"entity_id": f"climate.smart_heating_{Z}", "temperature": fahrenheit}, blocking=True,
    )
    await hass.async_block_till_done()
    # HA prepocita °F zo sluzby na °C entity; number zony uklada °C
    assert float(hass.states.get(f"number.smart_heating_{Z}_{key}").state) == celsius
