"""Button platform - Boost (docasne prepni na komfort na X hodin, viz number boost_hodiny)."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, OPT_ZONES
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    zones = entry.options.get(OPT_ZONES, {}).items()
    async_add_entities(
        [BoostButton(coordinator, zone_id, zone["name"]) for zone_id, zone in zones]
        + [ResumeButton(coordinator, zone_id, zone["name"]) for zone_id, zone in zones]
    )


class BoostButton(ButtonEntity):
    _attr_icon = "mdi:rocket-launch"

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        self._coordinator = coordinator
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_boost"
        self.entity_id = f"button.smart_heating_{zone_id}_boost"
        self._attr_name = f"{zone_name} Boost"

    async def async_press(self) -> None:
        await self._coordinator.async_activate_boost(self._zone_id)


class ResumeButton(ButtonEntity):
    """Ukonci rucne prevzatie zony - automatika hned znova riadi zariadenia."""

    _attr_icon = "mdi:restore"

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        self._coordinator = coordinator
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_obnovit_automatiku"
        self.entity_id = f"button.smart_heating_{zone_id}_obnovit_automatiku"
        self._attr_name = f"{zone_name} Obnovit automatiku"

    async def async_press(self) -> None:
        await self._coordinator.async_resume_zone(self._zone_id)
