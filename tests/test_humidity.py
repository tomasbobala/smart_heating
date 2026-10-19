"""0.22.0: vlhkost (len sledovanie) - pocitova teplota, rosny bod, vetranie, upozornenia."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating import comfort
from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "z1"


# ------------------------------------------------------------------ vypocty

def test_apparent_temperature_reference_values():
    assert abs(comfort.apparent_temperature(22, 40) - 21.5) < 0.1
    assert abs(comfort.apparent_temperature(22, 60) - 23.2) < 0.1
    assert comfort.apparent_temperature(22, 60) > comfort.apparent_temperature(22, 40)


def test_dew_point_and_absolute_humidity():
    assert abs(comfort.dew_point(22, 50) - 11.1) < 0.2
    assert abs(comfort.dew_point(20, 100) - 20) < 0.1
    assert abs(comfort.absolute_humidity(22, 50) - 9.7) < 0.2


def test_ventilation_compares_absolute_humidity():
    # zima: vonku 90 %, ale 5 °C -> v m3 menej vody nez v izbe -> vetranie pomoze
    assert comfort.ventilation_effect(22, 60, 5, 90) == "helps"
    # leto: dusno vonku -> vetranie nepomoze
    assert comfort.ventilation_effect(24, 50, 30, 70) == "worse"
    assert comfort.ventilation_effect(22, 50, 21.5, 50) == "neutral"
    assert comfort.ventilation_effect(22, 50, None, 50) is None


# ------------------------------------------------------------------ coordinator

def _coord(hass, notify=False, humidity=True):
    zone = {"name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.floor"}
    if humidity:
        zone["humidity_entity"] = "sensor.rh"
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={
        "zones": {Z: zone}, "language": "sk", "outdoor_sensor": "sensor.out_t",
        "outdoor_humidity_sensor": "sensor.out_rh", "notify_humidity": notify,
        "notify_entity": ["notify.phone"],
    })
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._lang = "sk"
    return c


def _states(hass, rh="45", temp=22):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": temp, "temperature": 21})
    hass.states.async_set("sensor.rh", rh)
    hass.states.async_set("sensor.out_t", "5")
    hass.states.async_set("sensor.out_rh", "90")


async def test_zone_humidity_attributes(hass):
    _states(hass, rh="60")
    c = _coord(hass)
    z = c._compute()["zones"][Z]
    assert z["humidity"] == 60
    assert abs(z["felt_temperature"] - 23.2) < 0.1
    assert abs(z["dew_point"] - 13.9) < 0.2
    assert z["ventilation"] == "helps"
    assert z["humidity_alert"] is None


async def test_zone_without_humidity_sensor(hass):
    _states(hass)
    c = _coord(hass, humidity=False)
    z = c._compute()["zones"][Z]
    assert z["humidity"] is None and z["felt_temperature"] is None


async def test_invalid_humidity_ignored(hass):
    _states(hass, rh="unavailable")
    c = _coord(hass)
    assert c._compute()["zones"][Z]["humidity"] is None
    _states(hass, rh="140")
    assert c._compute()["zones"][Z]["humidity"] is None


async def test_humidity_alert_after_an_hour_and_notification(hass):
    _states(hass, rh="72")
    c = _coord(hass, notify=True)
    c._startup_time = dt_util.now() - timedelta(hours=2)
    sent = []
    c._notify = AsyncMock(side_effect=lambda m: sent.append(m))
    assert c._compute()["zones"][Z]["humidity_alert"] is None      # este nie hodinu
    c._rt(Z)["hum_since"]["high"] = dt_util.now() - timedelta(minutes=61)
    z = c._compute()["zones"][Z]
    await hass.async_block_till_done()
    assert z["humidity_alert"] == "high"
    assert len(sent) == 1 and "72 %" in sent[0] and "Vetranie pomôže" in sent[0]
    c._compute()
    await hass.async_block_till_done()
    assert len(sent) == 1                                           # len pri zmene
    _states(hass, rh="50")
    z = c._compute()["zones"][Z]
    await hass.async_block_till_done()
    assert z["humidity_alert"] is None
    assert len(sent) == 2 and "v norme" in sent[1]


async def test_humidity_notification_off_by_default(hass):
    _states(hass, rh="20")
    c = _coord(hass, notify=False)
    c._startup_time = dt_util.now() - timedelta(hours=2)
    c._notify = AsyncMock()
    c._compute()
    c._rt(Z)["hum_since"]["low"] = dt_util.now() - timedelta(minutes=61)
    assert c._compute()["zones"][Z]["humidity_alert"] == "low"
    await hass.async_block_till_done()
    assert c._notify.await_count == 0


async def test_humidity_sensor_is_tracked(hass):
    c = _coord(hass)
    ids = c._tracked_entity_ids()
    assert "sensor.rh" in ids and "sensor.out_rh" in ids


# ------------------------------------------------------------------ nastavenia

async def _entry(hass):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    return (await hass.config_entries.flow.async_configure(result["flow_id"], user_input={}))["result"]


async def test_global_outdoor_humidity_and_pressure_with_clear(hass):
    entry = await _entry(hass)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    form = await hass.config_entries.options.async_configure(flow["flow_id"], user_input={"next_step_id": "global"})
    await hass.config_entries.options.async_configure(form["flow_id"], user_input={
        "outdoor_humidity_sensor": "sensor.out_rh", "outdoor_pressure_sensor": "sensor.out_p", "notify_humidity": True,
    })
    assert entry.options["outdoor_humidity_sensor"] == "sensor.out_rh"
    assert entry.options["outdoor_pressure_sensor"] == "sensor.out_p"
    assert entry.options["notify_humidity"] is True

    flow = await hass.config_entries.options.async_init(entry.entry_id)
    form = await hass.config_entries.options.async_configure(flow["flow_id"], user_input={"next_step_id": "global"})
    names = {str(k) for k in form["data_schema"].schema}
    assert {"clear_outdoor_humidity_sensor", "clear_outdoor_pressure_sensor"} <= names
    res = await hass.config_entries.options.async_configure(form["flow_id"], user_input={"clear_outdoor_pressure_sensor": True})
    assert res["type"] == FlowResultType.CREATE_ENTRY
    assert "outdoor_pressure_sensor" not in entry.options
    assert entry.options["outdoor_humidity_sensor"] == "sensor.out_rh"
    assert not any(k.startswith("clear_") for k in entry.options)


async def test_zone_humidity_entity_and_clear(hass):
    entry = await _entry(hass)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    form = await hass.config_entries.options.async_configure(flow["flow_id"], user_input={"next_step_id": "add_zone"})
    await hass.config_entries.options.async_configure(form["flow_id"], user_input={
        "name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.o", "humidity_entity": "sensor.rh",
    })
    zid = next(iter(entry.options["zones"]))
    assert entry.options["zones"][zid]["humidity_entity"] == "sensor.rh"
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    menu = await hass.config_entries.options.async_configure(flow["flow_id"], user_input={"next_step_id": "edit_zone"})
    form = await hass.config_entries.options.async_configure(menu["flow_id"], user_input={"zone_id": zid})
    assert "clear_humidity_entity" in {str(k) for k in form["data_schema"].schema}
    await hass.config_entries.options.async_configure(form["flow_id"], user_input={
        "name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.o", "clear_humidity_entity": True,
    })
    assert entry.options["zones"][zid]["humidity_entity"] is None


# ------------------------------------------------------------------ cele nastavenie (entity v HA)

async def test_full_setup_exposes_humidity_and_house_energy(hass):
    hass.states.async_set("climate.obyvacka", "heat", {"current_temperature": 22, "temperature": 21})
    hass.states.async_set("sensor.rh", "60")
    hass.states.async_set("sensor.out_t", "5")
    hass.states.async_set("sensor.out_rh", "90")
    hass.states.async_set("sensor.out_p", "1013")
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={
        "outdoor_sensor": "sensor.out_t", "outdoor_humidity_sensor": "sensor.out_rh",
        "outdoor_pressure_sensor": "sensor.out_p",
        "zones": {"z1": {"name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.obyvacka",
                         "humidity_entity": "sensor.rh"}},
    })
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    stav = hass.states.get("sensor.smart_heating_z1_stav").attributes
    assert stav["humidity"] == 60 and stav["humidity_entity"] == "sensor.rh"
    assert abs(stav["felt_temperature"] - 23.2) < 0.1
    assert stav["ventilation"] == "helps"
    assert stav["outdoor_humidity_entity"] == "sensor.out_rh"
    assert stav["outdoor_pressure_entity"] == "sensor.out_p"
    assert hass.states.get("climate.smart_heating_z1").attributes["current_humidity"] == 60
    for suffix in ("zo_siete", "z_fve", "z_baterie"):
        st = hass.states.get(f"sensor.smart_heating_energia_domu_{suffix}")
        assert st is not None and st.attributes["state_class"] == "total_increasing"

    # zmena vlhkosti sa prejavi bez cakania na 5-minutovy tick (sledovana entita)
    from datetime import timedelta
    from pytest_homeassistant_custom_component.common import async_fire_time_changed
    hass.states.async_set("sensor.rh", "45")
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=3))
    await hass.async_block_till_done()
    assert hass.states.get("sensor.smart_heating_z1_stav").attributes["humidity"] == 45
