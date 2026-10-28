"""Binary sensor platform - ci zona prave realne kuri alebo chladi.

Rovnaky stav ako climate.hvac_action, ale ako samostatna on/off entita: jej
historia je drobna (bez atributov), takze z nej prehladova karta lacno spocita,
kolko dnes kurilo, a v HA sa da pouzit aj v history_stats ci automatizaciach."""
from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, OPT_ZONES
from .coordinator import SmartHeatingCoordinator


def zone_action(zdata: dict) -> str:
    """'heating' / 'cooling' / 'idle' / 'off' - ta ista logika ako climate.hvac_action."""
    actual = zdata.get("actual_action")
    if actual is not None:
        return actual if actual in ("heating", "cooling", "idle") else "off"
    device_mode = zdata.get("device_mode", "off")
    if device_mode == "cool":
        return "cooling"
    if device_mode == "heat":
        return "heating"
    return "off"


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        ZoneRunningBinarySensor(coordinator, zone_id, zone["name"])
        for zone_id, zone in entry.options.get(OPT_ZONES, {}).items()
    )


class ZoneRunningBinarySensor(CoordinatorEntity[SmartHeatingCoordinator], BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.RUNNING
    _attr_icon = "mdi:radiator"

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        super().__init__(coordinator)
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_v_chode"
        self.entity_id = f"binary_sensor.smart_heating_{zone_id}_v_chode"
        self._attr_name = f"{zone_name} v chode"

    @property
    def is_on(self) -> bool:
        return zone_action(self.coordinator.data["zones"][self._zone_id]) in ("heating", "cooling")

    @property
    def extra_state_attributes(self):
        return {"action": zone_action(self.coordinator.data["zones"][self._zone_id])}
