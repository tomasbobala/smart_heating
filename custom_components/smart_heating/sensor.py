"""Sensor platform - diagnosticky stav/dovod aktualneho rozhodnutia per zona."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
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
    _attr_entity_category = EntityCategory.DIAGNOSTIC

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
        z = self.coordinator.data["zones"][self._zone_id]
        return {
            "floor_temperature": z["floor_temperature"],
            "floor_override": z["floor_override"],
            "krb_override": z["krb_override"],
            "tariff_blocked": z["tariff_blocked"],
            "emergency_active": z["emergency_active"],
            "pv_active": z["pv_active"],
            "boost_active": z["boost_active"],
            "heating_allowed": z["heating_allowed"],
            "zdroj_kurenia": z.get("heat_source"),
        }
