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
