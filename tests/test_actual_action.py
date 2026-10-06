"""Skutocny stav zony (kuri / nekuri / chladi) - zaklad pre status na karte
a pre standardny atribut hvac_action."""
from unittest.mock import AsyncMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_heating.const import DOMAIN
from custom_components.smart_heating.coordinator import SmartHeatingCoordinator


@pytest.fixture
def coordinator(hass):
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={})
    entry.add_to_hass(hass)
    coord = SmartHeatingCoordinator(hass, entry)
    coord._lang = "sk"
    return coord


def _floor_zone(**over):
    z = {
        "name": "Test", "zone_type": "floor", "climate_entity": "climate.floor",
        "ac_entity": None, "release_control": False, "heating_allowed": True,
        "device_mode": "heat", "target_temperature": 21, "season": "Kurenie",
    }
    z.update(over)
    return z


async def _apply(coordinator, zdata):
    coordinator.data = {"zones": {"z1": zdata}}
    with patch.object(coordinator, "_apply_device", new=AsyncMock()):
        await coordinator._async_apply()
    return coordinator.data["zones"]["z1"]["actual_action"]


async def test_floor_heating_without_device_report(hass, coordinator):
    hass.states.async_set("climate.floor", "heat", {})
    assert await _apply(coordinator, _floor_zone()) == "heating"


async def test_floor_device_reports_idle_wins(hass, coordinator):
    """Termostat uz dosiahol teplotu (rele vypnute) - karta nesmie tvrdit 'kuri'."""
    hass.states.async_set("climate.floor", "heat", {"hvac_action": "idle"})
    assert await _apply(coordinator, _floor_zone()) == "idle"


async def test_floor_device_reports_heating(hass, coordinator):
    hass.states.async_set("climate.floor", "heat", {"hvac_action": "heating"})
    assert await _apply(coordinator, _floor_zone()) == "heating"


async def test_heating_not_allowed_is_idle(hass, coordinator):
    hass.states.async_set("climate.floor", "off", {})
    assert await _apply(coordinator, _floor_zone(heating_allowed=False, device_mode="off")) == "idle"


async def test_release_control_is_off(hass, coordinator):
    assert await _apply(coordinator, _floor_zone(release_control=True)) == "off"


async def test_floor_ac_waiting_is_idle(hass, coordinator):
    """Presne scenar zo screenshotu: 'Zdroj: Ziadny (AC caka)' - pevny setpoint,
    v izbe je nad cielom + hysterezia, AC aj podlaha stoja -> 'idle', nie 'heating'."""
    z = "z1"
    hass.states.async_set("climate.ac", "heat", {})
    hass.states.async_set("climate.floor", "off", {})
    hass.states.async_set(f"switch.smart_heating_{z}_pouzit_pevny_ac_setpoint", "on")
    hass.states.async_set(f"number.smart_heating_{z}_ac_setpoint_teplota", "28")
    hass.states.async_set(f"number.smart_heating_{z}_ac_hysterezia", "0.5")
    hass.states.async_set(f"number.smart_heating_{z}_ac_priorita_rozdiel", "1")
    hass.states.async_set(f"number.smart_heating_{z}_ac_priorita_minuty", "30")
    zdata = _floor_zone(
        zone_type="floor_ac", ac_entity="climate.ac", target_temperature=18,
        current_temperature=24.5, has_external_temp=False,
    )
    assert await _apply(coordinator, zdata) == "idle"
    assert coordinator.data["zones"]["z1"]["heat_source"] == "Žiadny (AC čaká)"


async def test_cooling(hass, coordinator):
    hass.states.async_set("climate.ac", "cool", {})
    zdata = _floor_zone(zone_type="floor_ac", ac_entity="climate.ac", season="Chladenie", device_mode="cool")
    assert await _apply(coordinator, zdata) == "cooling"


async def test_floor_without_hvac_action_at_target_is_idle(hass, coordinator):
    """Termostat nehlasi hvac_action, ale uz ma svoju teplotu (25.0 pri setpointe 25)
    -> nekuri. Predtym sa hlasilo 'kuri' vzdy, ked bolo kurenie povolene
    (Kupelna na screenshote: 'Kuri' pri 25,0 / ciel 25)."""
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 25.0, "temperature": 25})
    assert await _apply(coordinator, _floor_zone(target_temperature=25)) == "idle"


async def test_floor_without_hvac_action_below_target_is_heating(hass, coordinator):
    hass.states.async_set("climate.floor", "heat", {"current_temperature": 23.5, "temperature": 25})
    assert await _apply(coordinator, _floor_zone(target_temperature=25)) == "heating"


async def test_reported_hvac_action_still_wins_over_temperature(hass, coordinator):
    """Ak zariadenie hlasi vlastny stav, ma prednost aj pred odhadom z teploty."""
    hass.states.async_set(
        "climate.floor", "heat", {"current_temperature": 25.0, "temperature": 25, "hvac_action": "heating"}
    )
    assert await _apply(coordinator, _floor_zone(target_temperature=25)) == "heating"
