"""FVE prebytok riadeny podla vykonu: kaskada priorit s hysterezou pri pridavani
aj odoberani (namiesto prepinaca FVE prebytku)."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

ZONES = {"obyv": 1, "kupe": 1, "spal": 2, "alex": 3}
OPTS = {
    "pv_auto": True,
    "pv_power_entity": "sensor.pv",
    "grid_power_entity": "sensor.grid",          # + odber, - export (konvencia HA energie)
    "battery_power_entity": "sensor.bat",        # + nabijanie, - vybijanie
    "battery_soc_entity": "sensor.soc",
}


def make(hass, **extra):
    zones = {z: {"name": z, "zone_type": "floor", "climate_entity": f"climate.{z}"} for z in ZONES}
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={},
                            options={"zones": zones, "language": "sk", **OPTS, **extra})
    entry.add_to_hass(hass)
    for z, prio in ZONES.items():
        hass.states.async_set(f"select.smart_heating_{z}_fve_priorita", str(prio))
        hass.states.async_set(f"climate.{z}", "heat", {"current_temperature": 20, "temperature": 22})
    return SmartHeatingCoordinator(hass, entry)


def power(hass, pv=4000, grid=0, bat=0, soc=95):
    hass.states.async_set("sensor.pv", str(pv))
    hass.states.async_set("sensor.grid", str(grid))
    hass.states.async_set("sensor.bat", str(bat))
    hass.states.async_set("sensor.soc", str(soc))


def age(c, key, minutes):
    """Posun casovaca dozadu (namiesto cakania)."""
    c._pv_engine_state()[key] = dt_util.now() - timedelta(minutes=minutes)


async def test_priorities_added_one_by_one_while_exporting(hass):
    c = make(hass)
    power(hass, grid=-1500)                       # export 1,5 kW
    assert c._pv_engine_step() == 0               # zacal sa merat cas
    age(c, "add_since", 5.1)
    assert c._pv_engine_step() == 1
    assert c._pv_engine_step() == 1               # dalsia priorita az po dalsich 5 min
    age(c, "add_since", 5.1)
    assert c._pv_engine_step() == 2
    age(c, "add_since", 5.1)
    assert c._pv_engine_step() == 3


async def test_battery_discharge_sheds_priority_2_then_1(hass):
    """Tomasov scenar: kuri prio 1 a 2, bateria vybija > 10 min -> vypne 2,
    po dalsich 10 min aj 1."""
    c = make(hass)
    c._pv_engine_state()["tier"] = 2
    power(hass, bat=-800)
    assert c._pv_engine_step() == 2
    age(c, "bad_since", 9)
    assert c._pv_engine_step() == 2               # este nie 10 min
    age(c, "bad_since", 10.1)
    assert c._pv_engine_step() == 1
    assert c._pv_engine_step() == 1               # dalsich 10 min odznova
    age(c, "bad_since", 10.1)
    assert c._pv_engine_step() == 0


async def test_low_production_sheds(hass):
    c = make(hass)
    c._pv_engine_state()["tier"] = 1
    power(hass, pv=200, bat=0)
    c._pv_engine_step()
    age(c, "bad_since", 10.1)
    assert c._pv_engine_step() == 0


async def test_hysteresis_band_holds_and_resets_timers(hass):
    """Male vybijanie (pod 200 W) a maly prebytok (pod 1000 W) = nic sa nemeni."""
    c = make(hass)
    c._pv_engine_state()["tier"] = 2
    power(hass, bat=-150, grid=-300)
    assert c._pv_engine_step() == 2
    eng = c._pv_engine_state()
    assert eng["add_since"] is None and eng["bad_since"] is None and eng["reason"] == "hold"


async def test_battery_charges_first_below_start_soc(hass):
    c = make(hass)
    power(hass, bat=2500, soc=70)                 # nabija, ale SOC pod 90 % -> nie je to prebytok
    c._pv_engine_step()
    assert c._pv_engine_state()["add_since"] is None
    power(hass, bat=2500, soc=92)                 # nad 90 % -> uz je
    c._pv_engine_step()
    assert c._pv_engine_state()["add_since"] is not None


async def test_low_soc_switches_everything_off_immediately(hass):
    c = make(hass)
    c._pv_engine_state()["tier"] = 3
    power(hass, soc=35)
    assert c._pv_engine_step() == 0


async def test_discharge_interrupts_adding(hass):
    c = make(hass)
    power(hass, grid=-2000)
    c._pv_engine_step()
    age(c, "add_since", 4)
    power(hass, grid=-2000, bat=-500)             # zaroven vybija -> nepridavaj
    c._pv_engine_step()
    assert c._pv_engine_state()["add_since"] is None


async def test_sign_options(hass):
    c = make(hass, grid_export_negative=False, battery_charge_positive=False)
    power(hass, grid=1500, bat=0)                 # tu je export kladny
    c._pv_engine_step()
    assert c._pv_engine_state()["values"]["export"] == 1500
    power(hass, bat=600)                          # tu je kladne = vybijanie
    c._pv_engine_state()["tier"] = 1
    c._pv_engine_step()
    assert c._pv_engine_state()["reason"].startswith("shed")


async def test_tier_controls_which_zones_heat_from_surplus(hass):
    c = make(hass)
    c._pv_engine_state()["tier"] = 1
    c.data = c._compute()
    z = c.data["zones"]
    assert z["obyv"]["pv_active"] and z["kupe"]["pv_active"]
    assert not z["spal"]["pv_active"] and z["spal"]["pv_waiting"]
    assert c.data["pv_engine"]["mode"] == "power" and c.data["pv_engine"]["tier"] == 1


async def test_surplus_switch_is_ignored_in_power_mode(hass):
    c = make(hass, pv_surplus_entity="input_boolean.fve")
    hass.states.async_set("input_boolean.fve", "on")
    c.data = c._compute()
    assert not any(zd["pv_active"] for zd in c.data["zones"].values())   # tier 0


async def test_tick_recomputes_only_on_tier_change(hass):
    c = make(hass)
    c.data = c._compute()
    power(hass, grid=-1500)
    with patch.object(c, "async_recompute_and_apply", new=AsyncMock()) as rec:
        await c._pv_engine_tick()
        rec.assert_not_awaited()
        age(c, "add_since", 5.1)
        await c._pv_engine_tick()
        rec.assert_awaited_once()
