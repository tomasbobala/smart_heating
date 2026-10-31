"""Teplotny senzor zony - zdroj statistik pre priemer 24 h a min/max 48 h na karte."""
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN


async def test_zone_temperature_sensor_is_statistics_ready(hass):
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 22.4, "temperature": 21})
    entry = MockConfigEntry(
        domain=DOMAIN,
        version=2,
        data={},
        options={
            "zones": {
                "z1": {
                    "name": "Obyvacka",
                    "zone_type": "floor",
                    "climate_entity": "climate.obyvacka",
                }
            }
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    state = hass.states.get("sensor.smart_heating_z1_teplota")
    assert state is not None
    assert float(state.state) == 22.4
    # bez tychto troch atributov by HA nepocital statistiky (mean/min/max)
    assert state.attributes["device_class"] == "temperature"
    assert state.attributes["state_class"] == "measurement"
    assert state.attributes["unit_of_measurement"] == "°C"


async def test_stav_sensor_exposes_entities_for_overview_card(hass):
    """Prehladova karta cita vonkajsi senzor a pritomnost z atributov senzora stav."""
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 22.4, "temperature": 21})
    hass.states.async_set("sensor.vonku", "5.0")
    entry = MockConfigEntry(
        domain=DOMAIN,
        version=2,
        data={},
        options={
            "outdoor_sensor": "sensor.vonku",
            "zones": {
                "z1": {
                    "name": "Obyvacka",
                    "zone_type": "floor",
                    "climate_entity": "climate.obyvacka",
                    "presence_entities": ["person.a"],
                    "manual_presence_entities": ["input_boolean.navsteva"],
                }
            },
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    attrs = hass.states.get("sensor.smart_heating_z1_stav").attributes
    assert attrs["outdoor_entity"] == "sensor.vonku"
    assert attrs["presence_entities"] == ["person.a"]
    assert attrs["manual_presence_entities"] == ["input_boolean.navsteva"]


async def test_running_binary_sensor_and_tariff_pv_attributes(hass):
    """binary_sensor ..._v_chode + entity tarify a FVE v atributoch senzora stav."""
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 18.0, "temperature": 21})
    hass.states.async_set("input_boolean.tarifa", "on")
    hass.states.async_set("input_boolean.fve", "off")
    entry = MockConfigEntry(
        domain=DOMAIN,
        version=2,
        data={},
        options={
            "tariff_entity": "input_boolean.tarifa",
            "pv_surplus_entity": "input_boolean.fve",
            "zones": {
                "z1": {"name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.obyvacka"}
            },
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    attrs = hass.states.get("sensor.smart_heating_z1_stav").attributes
    assert attrs["tariff_entity"] == "input_boolean.tarifa"
    assert attrs["pv_surplus_entity"] == "input_boolean.fve"

    running = hass.states.get("binary_sensor.smart_heating_z1_v_chode")
    assert running is not None
    assert running.state in ("on", "off")
    assert running.attributes["device_class"] == "running"
    action = hass.states.get("climate.smart_heating_z1").attributes.get("hvac_action")
    assert (running.state == "on") == (action in ("heating", "cooling"))
