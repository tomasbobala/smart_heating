"""0.22.0: spotreba domu podla zdroja (siet / FVE / bateria) a odolne notifikacie."""
from datetime import timedelta
import logging

import pytest
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator


def _coord(hass, **opts):
    base = {"zones": {}, "pv_power_entity": "sensor.pv", "grid_power_entity": "sensor.grid",
            "battery_power_entity": "sensor.bat", "grid_export_negative": True, "battery_charge_positive": True}
    base.update(opts)
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options=base)
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._lang = "sk"
    return c


def _flows(hass, pv, grid, bat, unit="W"):
    for eid, v in (("sensor.pv", pv), ("sensor.grid", grid), ("sensor.bat", bat)):
        hass.states.async_set(eid, str(v), {"unit_of_measurement": unit})


def _tick(c, minutes=60):
    c._house_energy_at = dt_util.now() - timedelta(minutes=minutes)
    c._accumulate_house_energy()


def _reset(c):
    c._house_energy_kwh = {"siet": 0.0, "fve": 0.0, "bateria": 0.0}


async def test_night_all_from_grid(hass):
    c = _coord(hass)
    _flows(hass, 0, 1500, 0)
    _tick(c, 12)                      # 12 min * 1,5 kW = 0,3 kWh
    e = c._house_energy_kwh
    assert abs(e["siet"] - 0.3) < 1e-6 and e["fve"] == 0 and e["bateria"] == 0


async def test_sunny_export_and_charging_all_from_pv(hass):
    c = _coord(hass)
    _flows(hass, 3000, -1000, 500)    # dom berie 1,5 kW, zvysok do siete a baterie
    _tick(c, 12)
    e = c._house_energy_kwh
    assert abs(e["fve"] - 0.3) < 1e-6 and e["siet"] == 0 and e["bateria"] == 0


async def test_mixed_sources_are_proportional(hass):
    c = _coord(hass)
    _flows(hass, 1000, 1000, -1000)   # dom 3 kW = 1/3 FVE, 1/3 siet, 1/3 bateria
    _tick(c, 6)                       # 0,3 kWh spolu
    e = c._house_energy_kwh
    for k in ("fve", "siet", "bateria"):
        assert abs(e[k] - 0.1) < 1e-6
    assert abs(sum(e.values()) - 0.3) < 1e-6


async def test_kw_units_and_sign_conventions(hass):
    c = _coord(hass, grid_export_negative=False, battery_charge_positive=False)
    _flows(hass, 0, -1.2, 0.3, unit="kW")   # odber 1,2 kW (kladny export = zaporny odber), vybijanie 0,3 kW
    _tick(c, 12)                       # 1,5 kW * 0,2 h
    e = c._house_energy_kwh
    assert abs(e["siet"] - 0.24) < 1e-6 and abs(e["bateria"] - 0.06) < 1e-6


async def test_missing_data_or_long_gap_not_counted(hass):
    c = _coord(hass)
    hass.states.async_set("sensor.pv", "unavailable")
    hass.states.async_set("sensor.grid", "500", {"unit_of_measurement": "W"})
    _tick(c, 5)
    assert sum(c._house_energy_kwh.values()) == 0
    _flows(hass, 0, 1000, 0)
    _tick(c, 30)                       # 30 min bez dat = vypadok, neodhadujeme
    assert sum(c._house_energy_kwh.values()) == 0


async def test_house_energy_sensors_restore_and_report(hass):
    from custom_components.smart_heating.sensor import HOUSE_SOURCES, HouseEnergySensor
    c = _coord(hass)
    c._house_energy_kwh["siet"] = 1.23456
    s = HouseEnergySensor(c, "siet")
    assert s.native_value == 1.235
    assert s.entity_id == "sensor.smart_heating_energia_domu_zo_siete"
    assert set(HOUSE_SOURCES) == {"siet", "fve", "bateria"}


# ------------------------------------------------------------------ notifikacie

async def test_notify_failing_target_does_not_raise_and_others_get_it(hass, caplog):
    c = _coord(hass, notify_entity=["notify.tv", "notify.phone"])
    got = []

    async def handler(call):
        if call.data["entity_id"] == "notify.tv":
            raise HomeAssistantError("Host is unreachable")
        got.append(call.data["message"])

    hass.services.async_register("notify", "send_message", handler)
    caplog.set_level(logging.WARNING)
    await c._notify("ahoj")
    await c._notify("ahoj2")
    assert got == ["ahoj", "ahoj2"]
    warnings = [r for r in caplog.records if "notify.tv" in r.getMessage()]
    assert len(warnings) == 1                     # najviac raz za hodinu
    assert "Traceback" not in caplog.text


async def test_notify_skips_unavailable_target(hass):
    c = _coord(hass, notify_entity=["notify.tv"])
    calls = []

    async def handler(call):
        calls.append(call)

    hass.services.async_register("notify", "send_message", handler)
    hass.states.async_set("notify.tv", "unavailable")
    await c._notify("x")
    assert calls == []
