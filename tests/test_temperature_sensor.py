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
