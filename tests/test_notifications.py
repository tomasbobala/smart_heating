"""Tests for SmartHeatingCoordinator._notify_bool_transition (startup grace period,
transition-based notifications)."""
from datetime import timedelta

import pytest
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator


@pytest.fixture
def coordinator(hass):
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={})
    entry.add_to_hass(hass)
    coord = SmartHeatingCoordinator(hass, entry)
    coord._lang = "en"
    return coord


@pytest.fixture
def sent_messages(coordinator):
    sent = []

    async def fake_notify(message):
        sent.append(message)

    coordinator._notify = fake_notify
    return sent


async def test_grace_period_suppresses_notification(hass, coordinator, sent_messages):
    # coordinator._startup_time je cerstvy (prave vytvoreny) -> stale v ochrannom okne
    state = {}
    coordinator._notify_bool_transition(state, "test", True, True, "START", "STOP")
    await hass.async_block_till_done()
    assert sent_messages == []
    assert state["test"] is True  # zakladny stav sa aj tak zaznamena


async def test_transition_fires_after_grace_period(hass, coordinator, sent_messages):
    coordinator._startup_time = dt_util.now() - timedelta(minutes=10)
    state = {}

    coordinator._notify_bool_transition(state, "test", True, True, "START", "STOP")
    await hass.async_block_till_done()
    assert sent_messages == ["START"]

    coordinator._notify_bool_transition(state, "test", False, True, "START", "STOP")
    await hass.async_block_till_done()
    assert sent_messages == ["START", "STOP"]


async def test_no_message_when_state_unchanged(hass, coordinator, sent_messages):
    coordinator._startup_time = dt_util.now() - timedelta(minutes=10)
    state = {"test": True}

    coordinator._notify_bool_transition(state, "test", True, True, "START", "STOP")
    await hass.async_block_till_done()
    assert sent_messages == []


async def test_disabled_toggle_suppresses_message(hass, coordinator, sent_messages):
    coordinator._startup_time = dt_util.now() - timedelta(minutes=10)
    state = {}

    coordinator._notify_bool_transition(state, "test", True, False, "START", "STOP")
    await hass.async_block_till_done()
    assert sent_messages == []
    assert state["test"] is True  # stav sa sleduje aj ked su notifikacie vypnute


async def test_no_stop_message_when_stop_msg_is_none(hass, coordinator, sent_messages):
    coordinator._startup_time = dt_util.now() - timedelta(minutes=10)
    state = {"test": True}

    coordinator._notify_bool_transition(state, "test", False, True, "START", None)
    await hass.async_block_till_done()
    assert sent_messages == []


async def test_async_apply_notifies_listeners_again(hass, coordinator):
    """Regresny test: _async_apply mutuje zdata (napr. heat_source) PO tom, co uz
    boli entity raz upovedomene cez async_set_updated_data(). Bez druheho volania
    async_update_listeners() na konci _async_apply by sa tato zmena nikdy nedostala
    do stavu entit (napr. 'Zdroj: ...' na karte by ostalo prazdne navzdy)."""
    hass.states.async_set(
        "climate.floor_only", "heat", {"current_temperature": 20, "temperature": 21}
    )
    coordinator.zones_test = {
        "z1": {
            "name": "Test Zone",
            "zone_type": "floor",
            "climate_entity": "climate.floor_only",
            "ac_entity": None,
            "release_control": False,
            "heating_allowed": True,
            "device_mode": "heat",
            "target_temperature": 21,
        }
    }
    coordinator.data = {"zones": dict(coordinator.zones_test)}
    coordinator._lang = "sk"

    calls = []
    coordinator.async_add_listener(lambda: calls.append(1))

    await coordinator._async_apply()

    assert coordinator.data["zones"]["z1"]["heat_source"] == "Podlaha"
    assert len(calls) >= 1  # async_update_listeners() na konci _async_apply skutocne vystrelil
