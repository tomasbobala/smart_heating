"""Sensor platform - diagnosticky stav/dovod aktualneho rozhodnutia per zona."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, OPT_ZONES
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        ZoneReasonSensor(coordinator, zone_id, zone["name"])
        for zone_id, zone in entry.options.get(OPT_ZONES, {}).items()
    )


class ZoneReasonSensor(CoordinatorEntity[SmartHeatingCoordinator], SensorEntity):
    _attr_icon = "mdi:information-outline"
    _attr_entity_category = "diagnostic"

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        super().__init__(coordinator)
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_stav"
        self.entity_id = f"sensor.smart_heating_{zone_id}_stav"
        self._attr_name = f"{zone_name} stav kurenia"

    @property
    def native_value(self):
        return self.coordinator.data["zones"][self._zone_id]["reason"]

    @property
    def extra_state_attributes(self):
        zdata = self.coordinator.data["zones"][self._zone_id]
        return {
            "floor_temperature": zdata["floor_temperature"],
            "floor_override": zdata["floor_override"],
            "heating_allowed": zdata["heating_allowed"],
        }
