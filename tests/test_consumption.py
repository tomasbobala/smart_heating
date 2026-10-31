"""Spotreba zony: zoznamy senzorov prikonu a energie sa ulozia a karty ich
najdu v atributoch senzora stavu."""
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN


async def test_power_and_energy_entities_exposed_for_cards(hass):
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 22, "temperature": 22})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {"z1": {
        "name": "Obyvacka", "zone_type": "floor_ac", "climate_entity": "climate.obyvacka",
        "ac_entity": "climate.daikin",
        "power_entities": ["sensor.podlaha_power", "sensor.daikin_power"],
        "energy_entities": ["sensor.podlaha_kwh", "sensor.daikin_kwh"],
    }}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    attrs = hass.states.get("sensor.smart_heating_z1_stav").attributes
    assert attrs["power_entities"] == ["sensor.podlaha_power", "sensor.daikin_power"]
    assert attrs["energy_entities"] == ["sensor.podlaha_kwh", "sensor.daikin_kwh"]


async def test_zone_without_consumption_sensors_has_empty_lists(hass):
    hass.states.async_set("climate.alex", "heat", {"current_temperature": 22, "temperature": 22})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {"z2": {
        "name": "Alex", "zone_type": "floor", "climate_entity": "climate.alex"}}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    attrs = hass.states.get("sensor.smart_heating_z2_stav").attributes
    assert attrs["power_entities"] == [] and attrs["energy_entities"] == []
