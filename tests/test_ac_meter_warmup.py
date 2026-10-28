"""0.25.0: prahy merača klímy (pohotovosť), spotreba v pohotovosti, logovanie nábehov
bez akumulácie FVE a dynamické predkúrenie podľa nauceného nábehu."""
from datetime import datetime, time, timedelta
from unittest.mock import patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "o1"
ZONE = {
    "name": "Obyvacka", "zone_type": "floor_ac", "climate_entity": "climate.obyv", "ac_entity": "climate.daikin",
    "floor_power_entities": ["sensor.f_w"], "ac_power_entities": ["sensor.ac_w"],
}


def make(hass, **opts):
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: dict(ZONE)}, "language": "sk", **opts})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._startup_time = dt_util.now() - timedelta(hours=1)
    return c


def watts(hass, entity, w):
    hass.states.async_set(entity, str(w), {"unit_of_measurement": "W"})


# ------------------------------------------------------------------ prahy merača

async def test_ac_standby_is_not_running_but_floor_is(hass):
    c = make(hass)
    watts(hass, "sensor.ac_w", 25)
    watts(hass, "sensor.f_w", 25)
    assert c._meter_on(["sensor.ac_w"]) is False          # klíma 25 W = pohotovosť
    assert c._meter_on(["sensor.f_w"]) is True            # podlaha 25 W = kúri (prah 20 W)
    watts(hass, "sensor.ac_w", 577)
    assert c._meter_on(["sensor.ac_w"]) is True


async def test_ac_threshold_is_configurable(hass):
    c = make(hass, meter_ac_on_w=30)
    watts(hass, "sensor.ac_w", 35)
    assert c._meter_on(["sensor.ac_w"]) is True
    watts(hass, "sensor.ac_w", 29)
    assert c._meter_on(["sensor.ac_w"]) is False


async def test_ac_no_false_nopower_when_daikin_reports_heating(hass):
    """Daikin hlási heating aj pri stojacom kompresore - porucha 'neťahá' sa pre klímu nehlási."""
    c = make(hass)
    hass.states.async_set("climate.daikin", "heat", {"hvac_action": "heating"})
    watts(hass, "sensor.ac_w", 25)
    zdata = {"src_cmd": {"ac": True, "floor": False}}
    assert c._meter_check(Z, zdata) == []
    for key in list(c._rt(Z)["meter_since"]):
        c._rt(Z)["meter_since"][key] = dt_util.now() - timedelta(minutes=30)
    assert c._meter_check(Z, zdata) == []


async def test_ac_stuck_uses_ac_threshold(hass):
    c = make(hass)
    hass.states.async_set("climate.daikin", "off", {"hvac_action": "off"})
    zdata = {"src_cmd": {"ac": False, "floor": False}}
    watts(hass, "sensor.ac_w", 250)                       # pohotovosť v mraze - nie je porucha
    c._meter_check(Z, zdata)
    assert "meter:ac:stuck" not in c._rt(Z)["meter_since"]
    watts(hass, "sensor.ac_w", 450)
    c._meter_check(Z, zdata)
    c._rt(Z)["meter_since"]["meter:ac:stuck"] = dt_util.now() - timedelta(minutes=11)
    found = c._meter_check(Z, zdata)
    assert [k for k, _ in found] == ["meter:ac:stuck"]


async def test_standby_energy_accumulates_only_below_threshold(hass):
    c = make(hass)
    watts(hass, "sensor.ac_w", 25)
    c._standby_at = dt_util.now() - timedelta(hours=0.1)
    c._accumulate_standby()
    assert abs(c.standby_kwh_today(Z) - 0.0025) < 0.0002   # 25 W x 0,1 h
    watts(hass, "sensor.ac_w", 600)                        # kompresor beží -> nie pohotovosť
    c._standby_at = dt_util.now() - timedelta(hours=0.1)
    c._accumulate_standby()
    assert abs(c.standby_kwh_today(Z) - 0.0025) < 0.0002


async def test_sources_attribute_shows_running_and_standby(hass):
    hass.states.async_set("climate.obyv", "heat", {"current_temperature": 22, "temperature": 22})
    watts(hass, "sensor.ac_w", 25)
    watts(hass, "sensor.f_w", 0)
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: dict(ZONE)}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    a = hass.states.get(f"sensor.smart_heating_{Z}_stav").attributes
    ac = next(s for s in a["sources"] if s["key"] == "ac")
    assert ac["on"] is False and ac["on_w"] == 150 and "standby_kwh_dnes" in ac
    assert "nabehy" in a and a["nabehy"]["potrebne"] == 6
    assert a["dynamicke_predkurenie"]["enabled"] is False


# ------------------------------------------------------------------ logovanie nábehov

def zd(**kw):
    base = {"current_temperature": 20.0, "target_temperature": 22.0, "actual_action": "heating",
            "heating_allowed": True, "outdoor_temperature": 3.0, "heat_source": "Podlaha", "pv_active": False,
            "warmup_ctx": "rano"}
    base.update(kw)
    return base


async def test_pv_accumulation_is_not_logged(hass):
    c = make(hass)
    c._warmup_track(Z, zd(pv_active=True))
    assert c._rt(Z).get("warmup") is None
    c._warmup_track(Z, zd())
    assert c._rt(Z)["warmup"]["kind"] == "rano"
    c._warmup_track(Z, zd(pv_active=True))            # počas nábehu prišiel prebytok
    assert c._rt(Z)["warmup"] is None


async def test_finished_run_has_kind(hass):
    c = make(hass)
    c._warmup_track(Z, zd(warmup_ctx="predkurenie"))
    c._rt(Z)["warmup"]["start"] = dt_util.now() - timedelta(minutes=30)
    c._warmup_track(Z, zd(current_temperature=22.0, warmup_ctx="predkurenie"))
    rec = c._warmup_data[Z][-1]
    assert rec["kind"] == "predkurenie" and rec["minutes"] >= 29


def legacy(hour, minutes=20, frm=21.0, to=23.0, outdoor=2.0, kind=None):
    start = dt_util.as_local(dt_util.now()).replace(hour=hour, minute=0)
    r = {"start": start.isoformat(), "minutes": minutes, "from": frm, "to": to, "outdoor": outdoor, "source": "Podlaha"}
    if kind:
        r["kind"] = kind
    return r


async def test_legacy_midday_and_fve_runs_are_not_used(hass):
    c = make(hass)
    assert c._warmup_usable(legacy(5)) is True
    assert c._warmup_usable(legacy(12)) is False          # starý záznam cez obed = asi akumulácia FVE
    assert c._warmup_usable(legacy(12, kind="ine")) is True
    assert c._warmup_usable(legacy(5, kind="fve")) is False
    assert c._warmup_usable(legacy(5, frm=22.0, to=22.2)) is False   # malý deficit


async def test_model_ready_and_prefers_similar_outdoor(hass):
    c = make(hass)
    c._warmup_data[Z] = [legacy(5, minutes=20, outdoor=1.0) for _ in range(5)]
    m = c._warmup_model(Z, 1.0)
    assert m["ready"] is False and m["usable"] == 5          # treba 6
    c._warmup_data[Z] += [legacy(5, minutes=60, outdoor=15.0) for _ in range(3)]
    m = c._warmup_model(Z, 1.0)
    assert m["ready"] is True and m["basis"] == "near" and m["rate"] == 10.0   # 20 min / 2 °C
    m = c._warmup_model(Z, 15.0)
    assert m["basis"] == "near" and m["rate"] == 30.0
    st = c.warmup_stats(Z, 1.0)
    band = next(b for b in st["pasma"] if b["od"] == 0)
    assert band["n"] == 5 and band["min_na_c"] == 10.0
    assert st["pripravene"] is True and len(st["posledne"]) == 8


# ------------------------------------------------------------------ dynamické predkúrenie

def at(hh, mm):
    return dt_util.as_local(dt_util.now()).replace(hour=hh, minute=mm, second=0, microsecond=0)


async def test_dynamic_day_start_earlier_and_latched(hass):
    c = make(hass)
    c._warmup_data[Z] = [legacy(5, minutes=20, outdoor=2.0) for _ in range(6)]   # 10 min/°C
    hass.states.async_set(f"switch.smart_heating_{Z}_dynamicke_predkurenie", "on")
    args = dict(den=21.0, outdoor=2.0, den_od=time(6, 0), preheat_od=time(15, 0), preheat_allowed=True, presence=True)
    with patch.object(dt_util, "now", return_value=at(5, 20)):
        d = c._dynamic_preheat(Z, current=19.0, **args)      # 2 °C x 10 + 10 = 30 min -> od 5:30
    assert d["lead"] == 30 and d["day_early"] is False and d["start_day"] == "05:30"
    with patch.object(dt_util, "now", return_value=at(5, 35)):
        d = c._dynamic_preheat(Z, current=19.0, **args)
    assert d["day_early"] is True
    with patch.object(dt_util, "now", return_value=at(5, 50)):
        d = c._dynamic_preheat(Z, current=20.9, **args)      # takmer nahriate - predstih 0, ale drží sa
    assert d["lead"] == 0 and d["day_early"] is True
    with patch.object(dt_util, "now", return_value=at(6, 0)):
        d = c._dynamic_preheat(Z, current=21.0, **args)      # riadny začiatok dňa - posun končí
    assert d["day_early"] is False


async def test_dynamic_preheat_before_arrival_only_when_away(hass):
    c = make(hass, preheat_max_lead=45)
    c._warmup_data[Z] = [legacy(5, minutes=40, outdoor=2.0) for _ in range(6)]   # 20 min/°C
    hass.states.async_set(f"switch.smart_heating_{Z}_dynamicke_predkurenie", "on")
    args = dict(den=21.0, outdoor=2.0, den_od=time(6, 0), preheat_od=time(15, 0), preheat_allowed=True)
    with patch.object(dt_util, "now", return_value=at(14, 20)):
        d = c._dynamic_preheat(Z, current=18.0, presence=False, **args)   # 3 x 20 + 10 = 70 -> max 45
    assert d["lead"] == 45 and d["preheat_early"] is True and d["start_preheat"] == "14:15"
    with patch.object(dt_util, "now", return_value=at(14, 20)):
        d = c._dynamic_preheat(Z, current=18.0, presence=True, **args)    # doma -> riadi prítomnosť
    assert d["preheat_early"] is False


async def test_dynamic_preheat_off_or_not_enough_data(hass):
    c = make(hass)
    c._warmup_data[Z] = [legacy(5, minutes=20, outdoor=2.0) for _ in range(6)]
    args = dict(den=21.0, outdoor=2.0, den_od=time(6, 0), preheat_od=time(15, 0), preheat_allowed=True, presence=True)
    with patch.object(dt_util, "now", return_value=at(5, 50)):
        d = c._dynamic_preheat(Z, current=19.0, **args)                  # prepínač vypnutý (predvolene)
    assert d["day_early"] is False and d["enabled"] is False
    hass.states.async_set(f"switch.smart_heating_{Z}_dynamicke_predkurenie", "on")
    c._warmup_data[Z] = c._warmup_data[Z][:3]
    with patch.object(dt_util, "now", return_value=at(5, 50)):
        d = c._dynamic_preheat(Z, current=19.0, **args)                  # málo dát
    assert d["day_early"] is False and d["ready"] is False


async def test_dynamic_shifts_target_in_compute(hass):
    """Celý prepočet: o 5:40 je ešte noc, ale dynamické predkúrenie už nastaví dennú teplotu."""
    c = make(hass)
    c._warmup_data[Z] = [legacy(5, minutes=20, outdoor=2.0) for _ in range(6)]
    hass.states.async_set(f"switch.smart_heating_{Z}_dynamicke_predkurenie", "on")
    hass.states.async_set("climate.obyv", "heat", {"current_temperature": 19.0, "temperature": 19})
    hass.states.async_set(f"number.smart_heating_{Z}_teplota_den", "21")
    hass.states.async_set(f"number.smart_heating_{Z}_teplota_noc", "19")
    hass.states.async_set(f"time.smart_heating_{Z}_den_od_tyzden", "06:00:00")
    hass.states.async_set(f"time.smart_heating_{Z}_den_od_vikend", "06:00:00")
    hass.states.async_set("input_boolean.doma", "on")
    c.entry.options["zones"][Z]["manual_presence_entities"] = ["input_boolean.doma"]
    with patch.object(dt_util, "now", return_value=at(5, 40)):
        data = c._compute()
    z = data["zones"][Z]
    assert z["target_temperature"] == 21.0
    assert "dynamické predkúrenie" in z["reason"]
    assert z["warmup_ctx"] == "rano"
