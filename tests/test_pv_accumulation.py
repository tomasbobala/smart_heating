"""0.23.0: akumulacia prebytku FVE - postupne zvysovanie cielovej teploty az do maxima
zony; v zone s klimou krb zastavi klimu a akumuluje podlaha, ak je chladna."""
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator

Z = "z1"


def _coord(hass, zone_type="floor", **opts):
    zone = {"name": "Obyvacka", "zone_type": zone_type, "climate_entity": "climate.floor",
            "floor_temp_entity": "sensor.floor", "use_fireplace_guard": True}
    if zone_type == "floor_ac":
        zone["ac_entity"] = "climate.ac"
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={
        "zones": {Z: zone}, "language": "sk", "pv_surplus_entity": "input_boolean.pv",
        "fireplace_temp_entity": "sensor.krb", "krb_threshold": 25.0, **opts})
    entry.add_to_hass(hass)
    c = SmartHeatingCoordinator(hass, entry)
    c._lang = "sk"
    return c


def _states(hass, air=21.0, floor=22.0, krb=22.0, pv="on", max_t="24", den="21", acc="on"):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": air, "temperature": 21})
    hass.states.async_set("climate.ac", "heat", {"current_temperature": air, "temperature": 26})
    hass.states.async_set("sensor.floor", str(floor))
    hass.states.async_set("sensor.krb", str(krb))
    hass.states.async_set("input_boolean.pv", pv)
    hass.states.async_set("select.smart_heating_z1_rezim", "Auto")
    hass.states.async_set("number.smart_heating_z1_teplota_den", den)
    hass.states.async_set("number.smart_heating_z1_teplota_noc", den)   # nezavisle od hodiny testu
    hass.states.async_set("number.smart_heating_z1_fve_max_teplota", max_t)
    hass.states.async_set("switch.smart_heating_z1_fve_akumulacia", acc)


def _age(c, minutes=16):
    c._rt(Z)["pv_acc"]["since"] = dt_util.now() - timedelta(minutes=minutes)


def _z(c):
    return c._compute()["zones"][Z]


async def test_starts_at_day_temperature(hass):
    _states(hass, air=20.0)
    z = _z(_coord(hass))
    assert z["pv_active"] and z["target_temperature"] == 21
    assert z["pv_acc_target"] == 21 and z["pv_acc_max"] == 24
    assert "akumulácia" in z["reason"]


async def test_raises_one_degree_after_reaching_target_and_interval(hass):
    _states(hass, air=21.0)
    c = _coord(hass)
    assert _z(c)["target_temperature"] == 21
    assert _z(c)["target_temperature"] == 21          # dosiahnute, ale este nepreslo 15 min
    _age(c)
    assert _z(c)["target_temperature"] == 22
    _age(c)
    assert _z(c)["target_temperature"] == 22          # 22 este nedosiahnute (vzduch 21)
    _states(hass, air=21.9)
    assert _z(c)["target_temperature"] == 23          # 21,9 >= 22 - 0,2


async def test_never_above_zone_maximum(hass):
    _states(hass, air=30.0, max_t="23")
    c = _coord(hass)
    for _ in range(6):
        _z(c)
        _age(c)
    assert _z(c)["target_temperature"] == 23
    _states(hass, air=30.0, max_t="22")                 # znizene maximum plati hned
    assert _z(c)["target_temperature"] == 22


async def test_maximum_caps_even_a_higher_day_temperature(hass):
    _states(hass, den="25", max_t="23")
    assert _z(_coord(hass))["target_temperature"] == 23


async def test_step_and_interval_from_global_settings(hass):
    _states(hass, air=21.0, max_t="26")
    c = _coord(hass, pv_acc_step=2.0, pv_acc_minutes=30)
    _z(c)
    _age(c, 20)
    assert _z(c)["target_temperature"] == 21          # 20 min < 30 min
    _age(c, 31)
    assert _z(c)["target_temperature"] == 23


async def test_surplus_lost_resets_accumulation(hass):
    _states(hass, air=30.0)
    c = _coord(hass)
    _z(c); _age(c); _z(c)
    assert c._rt(Z)["pv_acc"]["target"] == 22
    _states(hass, air=30.0, pv="off")
    z = _z(c)
    assert not z["pv_active"] and c._rt(Z)["pv_acc"] is None
    _states(hass, air=30.0, pv="on")
    assert _z(c)["target_temperature"] == 21          # znovu od dennej teploty


async def test_accumulation_switch_off_keeps_day_temperature(hass):
    _states(hass, air=30.0, acc="off")
    c = _coord(hass)
    _z(c)
    assert c._rt(Z)["pv_acc"] is None
    z = _z(c)
    assert z["target_temperature"] == 21 and z["pv_acc_target"] is None


async def test_floor_max_still_blocks_floor_zone(hass):
    _states(hass, floor=28.5)
    z = _z(_coord(hass))
    assert not z["pv_active"] and not z["heating_allowed"]


async def test_krb_still_blocks_floor_only_zone(hass):
    _states(hass, krb=26.0)
    z = _z(_coord(hass))
    assert z["krb_override"] and not z["pv_active"] and not z["heating_allowed"]


# ------------------------------------------------------------------ floor_ac: klima, potom podlaha

async def _apply(c):
    calls = []

    async def dev(entity, mode, target):
        calls.append((entity, mode, target))

    with patch.object(c, "_apply_device", new=AsyncMock(side_effect=dev)), patch.object(c, "_notify", new=AsyncMock()):
        await c._async_apply()
    return calls, c.data["zones"][Z]


async def test_floor_ac_accumulates_with_ac_first(hass):
    _states(hass, air=19.5)                                              # 1,5 °C pod cielom
    hass.states.async_set("switch.smart_heating_z1_pouzit_pevny_ac_setpoint", "on")
    c = _coord(hass, zone_type="floor_ac")
    c.data = c._compute()
    c._rt(Z)["ac_deficit_since"] = dt_util.now() - timedelta(hours=2)   # inak by nastupila podlaha
    calls, z = await _apply(c)
    assert ("climate.ac", "heat", 26.0) in calls
    assert ("climate.floor", "off", None) in calls


async def test_floor_ac_setpoint_follows_accumulation_above_fixed(hass):
    _states(hass, air=26.0, max_t="28")
    hass.states.async_set("switch.smart_heating_z1_pouzit_pevny_ac_setpoint", "on")
    c = _coord(hass, zone_type="floor_ac")
    for _ in range(6):
        c._compute(); _age(c)
    c.data = c._compute()
    assert c.data["zones"][Z]["target_temperature"] == 27
    c._rt(Z)["ac_running"] = True
    calls, _ = await _apply(c)
    assert ("climate.ac", "heat", 28) in calls       # setpoint klimy nad cielom akumulacie


async def test_floor_ac_krb_stops_ac_and_floor_stores_heat(hass):
    _states(hass, air=24.0, krb=26.0, floor=23.0)
    c = _coord(hass, zone_type="floor_ac")
    c.data = c._compute()
    z = c.data["zones"][Z]
    assert z["pv_active"] and z["pv_krb_floor"] and z["heating_allowed"]
    assert "klíma stop" in z["reason"]
    calls, z = await _apply(c)
    assert ("climate.ac", "off", None) in calls
    assert ("climate.floor", "heat", 28.0) in calls  # setpoint = max. teplota podlahy
    assert z["heat_source"] == "Podlaha (akumulácia FVE)"


async def test_floor_ac_krb_and_warm_floor_stops_floor_too(hass):
    _states(hass, air=24.0, krb=26.0, floor=28.2)
    c = _coord(hass, zone_type="floor_ac")
    c.data = c._compute()
    calls, z = await _apply(c)
    assert ("climate.ac", "off", None) in calls
    assert ("climate.floor", "heat", 28.0) not in calls
    assert z["actual_action"] == "idle"


async def test_floor_ac_overheated_floor_does_not_stop_ac(hass):
    _states(hass, air=20.0, floor=28.5, pv="off")
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    c = _coord(hass, zone_type="floor_ac")
    c.data = c._compute()
    z = c.data["zones"][Z]
    assert z["floor_override"] and z["heating_allowed"]
    calls, _ = await _apply(c)
    assert any(e == "climate.ac" and m == "heat" for e, m, _ in calls)
    assert ("climate.floor", "off", None) in calls


async def test_accumulation_entities_exist_after_setup(hass):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 22, "temperature": 21})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: {
        "name": "Obyvacka", "zone_type": "floor", "climate_entity": "climate.floor"}}})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get("number.smart_heating_z1_fve_max_teplota").state == "24.0"
    assert hass.states.get("switch.smart_heating_z1_fve_akumulacia").state == "on"
    assert "fve_akumulacia_ciel" in hass.states.get("sensor.smart_heating_z1_stav").attributes


async def test_echo_of_accumulation_target_is_not_written_to_day_temperature(hass):
    from homeassistant.components.climate import DOMAIN as CLIMATE
    from pytest_homeassistant_custom_component.common import async_mock_service
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 22, "temperature": 21})
    entry = MockConfigEntry(domain=DOMAIN, version=2, data={}, options={"zones": {Z: {
        "name": "Spalna", "zone_type": "floor", "climate_entity": "climate.floor"}},
        "pv_surplus_entity": "input_boolean.pv"})
    hass.states.async_set("input_boolean.pv", "on")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    coord = hass.data[DOMAIN][entry.entry_id]
    zd = coord.data["zones"][Z]
    assert zd["pv_active"] and zd["pv_acc_target"] is not None
    calls = async_mock_service(hass, "number", "set_value")
    await hass.services.async_call(CLIMATE, "set_temperature",
                                   {"entity_id": "climate.smart_heating_z1", "temperature": zd["pv_acc_target"]}, blocking=True)
    assert calls == []
    await hass.services.async_call(CLIMATE, "set_temperature",
                                   {"entity_id": "climate.smart_heating_z1", "temperature": 21.5}, blocking=True)
    assert len(calls) == 1 and calls[0].data["value"] == 21.5


async def test_after_surplus_target_returns_to_day_temperature(hass):
    _states(hass, air=30.0, den="21", max_t="25")
    c = _coord(hass)
    for _ in range(5):
        _z(c); _age(c)
    assert _z(c)["target_temperature"] == 25
    _states(hass, air=24.5, den="21", max_t="25", pv="off")
    hass.states.async_set("select.smart_heating_z1_rezim", "Den")
    z = _z(c)
    assert not z["pv_active"] and z["target_temperature"] == 21
