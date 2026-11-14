"""Hysterezia krbu, nastup podlahy podla rychlosti klimy a spotreba nabehov po zdrojoch."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "o1"


def make(hass, zone=None, **opts):
    zone = zone or {"name": "Obyvacka", "zone_type": "floor_ac", "climate_entity": "climate.floor",
                    "ac_entity": "climate.ac", "external_temp_entity": "sensor.t",
                    "ac_energy_entities": ["sensor.ac_kwh"], "floor_energy_entities": ["sensor.fl_kwh"]}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: zone}, "language": "sk", **opts})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._startup_time = dt_util.now() - timedelta(hours=1)
    hass.states.async_set("select.smart_heating_o1_rezim", "Den")
    hass.states.async_set("number.smart_heating_o1_teplota_den", "22")
    hass.states.async_set("number.smart_heating_o1_ac_priorita_rozdiel", "1")
    hass.states.async_set("number.smart_heating_o1_ac_priorita_minuty", "30")
    for e in ("climate.floor", "climate.ac"):
        hass.states.async_set(e, "heat", {"temperature": 22, "current_temperature": 20, "hvac_action": "heating", "min_temp": 5, "max_temp": 32})
    return c


async def apply(c):
    c.hass.services.async_services()  # noqa
    for d, s in (("climate", "set_hvac_mode"), ("climate", "set_temperature")):
        if not c.hass.services.has_service(d, s):
            async_mock_service(c.hass, d, s)
    c.data = c._compute()
    with patch.object(c, "_notify", new=AsyncMock()):
        await c._async_apply()
    await c.hass.async_block_till_done()
    return c.data["zones"][Z]


def temp_history(c, values, minutes_apart=5):
    """Vlozi historiu teplot (najstarsia prva) do okna rychlosti klimy."""
    now = dt_util.now()
    n = len(values)
    c._rt(Z)["ac_hist"] = [(now - timedelta(minutes=minutes_apart * (n - i)), v) for i, v in enumerate(values)]


def deficit_for(c, minutes):
    c._rt(Z)["ac_deficit_since"] = dt_util.now() - timedelta(minutes=minutes)


# ------------------------------------------------------------- klima vs podlaha

async def test_floor_waits_while_ac_warms_fast_enough(hass):
    c = make(hass)
    hass.states.async_set("sensor.t", "20.6")
    await apply(c)
    deficit_for(c, 31)
    temp_history(c, [19.6, 19.85, 20.1, 20.35])          # ~3 °C/h -> 1,4 °C za ~28 min
    z = await apply(c)
    assert not c._rt(Z).get("floor_backup")
    assert z["src_cmd"]["floor"] is False and z["ac_eta_min"] is not None and z["ac_eta_min"] <= 30
    assert "dohreje o" in z["heat_source"]


async def test_floor_joins_when_ac_is_too_slow(hass):
    c = make(hass)
    hass.states.async_set("sensor.t", "20.0")
    await apply(c)
    deficit_for(c, 31)
    temp_history(c, [19.9, 19.92, 19.95, 19.98])          # ~0,3 °C/h
    z = await apply(c)
    assert z["src_cmd"]["floor"] is True and c._rt(Z)["floor_backup"]


async def test_floor_joins_without_rate_and_when_switch_off(hass):
    c = make(hass)
    hass.states.async_set("sensor.t", "20.0")
    await apply(c)
    deficit_for(c, 31)
    c._rt(Z)["ac_hist"] = []                              # bez historie -> povodne spravanie
    z = await apply(c)
    assert z["src_cmd"]["floor"] is True
    c2 = make(hass)
    hass.states.async_set("switch.smart_heating_o1_podlaha_ked_klima_nestiha", "off")
    await apply(c2)
    deficit_for(c2, 31)
    temp_history(c2, [19.0, 19.5, 20.0, 20.5])
    z = await apply(c2)
    assert z["src_cmd"]["floor"] is True


async def test_engaged_floor_stays_until_deficit_ends(hass):
    c = make(hass)
    hass.states.async_set("sensor.t", "20.0")
    await apply(c)
    c._rt(Z)["floor_backup"] = True
    deficit_for(c, 40)
    temp_history(c, [18.0, 19.0, 20.0])                   # rychlo, ale podlaha uz bezi
    z = await apply(c)
    assert z["src_cmd"]["floor"] is True
    hass.states.async_set("sensor.t", "22.0")             # bez deficitu
    z = await apply(c)
    assert z["src_cmd"]["floor"] is False and not c._rt(Z)["floor_backup"]


# ------------------------------------------------------------- krb s hysterezou

async def test_fireplace_hysteresis(hass):
    c = make(hass, fireplace_temp_entity="sensor.krb", krb_threshold=25, krb_hysterezia=1.0)
    hass.states.async_set("switch.smart_heating_o1_reaguj_na_krb", "on")
    hass.states.async_set("sensor.t", "21")
    for t, expect in ((24.5, False), (25.0, True), (24.5, True), (24.1, True), (23.9, False), (24.5, False)):
        hass.states.async_set("sensor.krb", str(t))
        z = await apply(c)
        assert z["krb_override"] is expect, (t, z["krb_override"])


async def test_fireplace_without_hysteresis_keeps_old_behaviour(hass):
    c = make(hass, fireplace_temp_entity="sensor.krb", krb_threshold=25, krb_hysterezia=0)
    hass.states.async_set("switch.smart_heating_o1_reaguj_na_krb", "on")
    hass.states.async_set("sensor.t", "21")
    hass.states.async_set("sensor.krb", "25")
    assert (await apply(c))["krb_override"]
    hass.states.async_set("sensor.krb", "24.9")
    assert not (await apply(c))["krb_override"]


# ------------------------------------------------------------- spotreba nabehov

async def test_warmup_records_energy_per_source_and_efficiency(hass):
    c = make(hass)
    hass.states.async_set("sensor.ac_kwh", "10.0", {"unit_of_measurement": "kWh"})
    hass.states.async_set("sensor.fl_kwh", "5000", {"unit_of_measurement": "Wh"})
    zd = {"actual_action": "heating", "current_temperature": 20.0, "target_temperature": 22.0,
          "heating_allowed": True, "outdoor_temperature": 5}
    with patch.object(c._warmup_store, "async_delay_save"):
        c._warmup_track(Z, zd)
        c._rt(Z)["warmup"]["start"] = dt_util.now() - timedelta(minutes=40)
        hass.states.async_set("sensor.ac_kwh", "10.8", {"unit_of_measurement": "kWh"})
        c._warmup_track(Z, {**zd, "current_temperature": 22.0})
    rec = c._warmup_data[Z][-1]
    assert rec["kwh"] == {"ac": 0.8, "floor": 0.0}
    c._warmup_data[Z].append({"start": "x", "minutes": 60, "from": 19, "to": 21, "kwh": {"ac": 0.4, "floor": 2.6}})
    eff = c._warmup_efficiency(Z)
    assert eff == {"klima": 0.4, "klima_n": 1, "podlaha": 1.5, "podlaha_n": 1}
