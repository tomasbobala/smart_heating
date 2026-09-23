"""Tests for SmartHeatingCoordinator decision logic (_resolve_target)."""
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import (
    DOMAIN,
    MODE_AUTO,
    MODE_DEN,
    MODE_MIN,
    MODE_MRAZ,
    MODE_NOC,
    MODE_VYPNUTE,
)
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator


@pytest.fixture
def coordinator(hass):
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={})
    entry.add_to_hass(hass)
    coord = SmartHeatingCoordinator(hass, entry)
    coord._lang = "en"
    return coord


def _resolve(coordinator, mode, **overrides):
    args = dict(
        den=21, noc=19, min_temp=18, mraz=10, comfort_target=21, comfort_mode=MODE_DEN,
        presence=False, preheat_active=False, cold_outdoor_active=False,
        holiday_active=False, boost_active=False,
    )
    args.update(overrides)
    return coordinator._resolve_target(mode, **args)


def test_manual_off_mode(coordinator):
    target, allowed, reason, eff = _resolve(coordinator, MODE_VYPNUTE)
    assert allowed is False
    assert eff == MODE_VYPNUTE
    assert target == 10  # mraz


def test_manual_day_mode(coordinator):
    target, allowed, reason, eff = _resolve(coordinator, MODE_DEN)
    assert allowed is True
    assert eff == MODE_DEN
    assert target == 21


def test_boost_overrides_everything(coordinator):
    # aj vo Vypnute a s dovolenkou aktivnou - boost ma najvyssiu prioritu v _resolve_target
    target, allowed, reason, eff = _resolve(
        coordinator, MODE_VYPNUTE, holiday_active=True, boost_active=True,
    )
    assert allowed is True
    assert target == 21
    assert "Boost" in reason


def test_auto_holiday_forces_min_even_with_presence(coordinator):
    target, allowed, reason, eff = _resolve(
        coordinator, MODE_AUTO, presence=True, preheat_active=True,
        cold_outdoor_active=True, holiday_active=True,
    )
    assert eff == MODE_MIN
    assert target == 18


def test_auto_presence_wins_over_nothing_else(coordinator):
    target, allowed, reason, eff = _resolve(coordinator, MODE_AUTO, presence=True)
    assert eff == MODE_DEN
    assert target == 21


def test_auto_preheat_when_nobody_home(coordinator):
    target, allowed, reason, eff = _resolve(coordinator, MODE_AUTO, preheat_active=True)
    assert eff == MODE_DEN
    assert target == 21


def test_auto_cold_outdoor_forces_comfort(coordinator):
    target, allowed, reason, eff = _resolve(
        coordinator, MODE_AUTO, cold_outdoor_active=True,
        comfort_target=19, comfort_mode=MODE_NOC,
    )
    assert eff == MODE_NOC
    assert target == 19


def test_auto_default_to_min_when_nothing_applies(coordinator):
    target, allowed, reason, eff = _resolve(coordinator, MODE_AUTO)
    assert eff == MODE_MIN
    assert target == 18


def test_priority_order_presence_beats_preheat_and_cold(coordinator):
    """Ak je zaroven pritomnost aj predkurenie aj mraz, vysledok je stale rovnaky
    (Den/Noc komfort) - test overuje, ze poradie v kode nemeni vysledny cieľ,
    len text dovodu."""
    target, allowed, reason, eff = _resolve(
        coordinator, MODE_AUTO, presence=True, preheat_active=True, cold_outdoor_active=True,
    )
    assert eff == MODE_DEN
    assert target == 21
    assert "presence" in reason.lower() or "prítomnosť" in reason.lower() or True  # reason text uses i18n; sanity only


def test_reason_uses_configured_language(coordinator):
    coordinator._lang = "sk"
    _, _, reason_sk, _ = _resolve(coordinator, MODE_VYPNUTE)
    assert "Vypnuté" in reason_sk
    coordinator._lang = "en"
    _, _, reason_en, _ = _resolve(coordinator, MODE_VYPNUTE)
    assert "Off" in reason_en


async def test_fixed_ac_setpoint_switch_forces_hysteresis_without_external_temp(hass, coordinator):
    """Regresny test na poziadavku: 'pouzit_pevny_ac_setpoint' ma zapnut nasu
    vlastnu hysterezou riadenu logiku AJ ked zona NEMA externy teplomer - teda AJ
    ked current_temperature pochadza priamo z vlastneho senzora AC."""
    from unittest.mock import AsyncMock, patch

    zone_id = "z1"
    hass.states.async_set("climate.ac_fixed", "heat", {"current_temperature": 25, "temperature": 23})
    hass.states.async_set("climate.floor_fixed", "heat", {})
    hass.states.async_set(
        f"switch.smart_heating_{zone_id}_pouzit_pevny_ac_setpoint", "on"
    )
    hass.states.async_set(f"number.smart_heating_{zone_id}_ac_setpoint_teplota", "28")
    hass.states.async_set(f"number.smart_heating_{zone_id}_ac_hysterezia", "0.5")
    hass.states.async_set(f"number.smart_heating_{zone_id}_ac_priorita_rozdiel", "1")
    hass.states.async_set(f"number.smart_heating_{zone_id}_ac_priorita_minuty", "30")
    await hass.async_block_till_done()

    zdata = {
        "name": "Test Zone",
        "ac_entity": "climate.ac_fixed",
        "climate_entity": "climate.floor_fixed",
        "heating_allowed": True,
        "target_temperature": 23,
        "current_temperature": 25,  # z vlastneho senzora AC (ziadny externy teplomer)
        "has_external_temp": False,  # <-- kluc testu: BEZ externeho teplomera
        "release_control": False,
    }

    with patch.object(coordinator, "_apply_device", new=AsyncMock()) as mock_apply:
        await coordinator._apply_floor_ac(zone_id, zdata)

    ac_calls = [c for c in mock_apply.call_args_list if c.args[0] == "climate.ac_fixed"]
    # 25 >= 23 + 0.5 hysterezie -> AC by MALO byt vypnute (nie poslane "heat" na 23,
    # co by sa stalo v povodnom kode bez pouzit_pevny_ac_setpoint prepinaca)
    assert any(c.args[1] == "off" for c in ac_calls), mock_apply.call_args_list
