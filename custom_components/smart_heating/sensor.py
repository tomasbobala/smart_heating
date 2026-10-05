"""Sensor platform - diagnosticky stav aktualneho rozhodnutia per zona."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    CONF_MANUAL_PRESENCE_ENTITIES,
    CONF_OUTDOOR_SENSOR,
    CONF_PRESENCE_ENTITIES,
    DOMAIN,
    OPT_ZONES,
)
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities = []
    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        entities.append(ZoneReasonSensor(coordinator, zone_id, zone["name"]))
        entities.append(ZoneTemperatureSensor(coordinator, zone_id, zone["name"]))
    async_add_entities(entities)


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
        zone_conf = self.coordinator.zones.get(self._zone_id, {})
        return {
            "zone_id": self._zone_id,
            "season": z["season"],
            "release_control": z["release_control"],
            "floor_temperature": z["floor_temperature"],
            "outdoor_temperature": z["outdoor_temperature"],
            "cold_outdoor_active": z["cold_outdoor_active"],
            "floor_override": z["floor_override"],
            "krb_override": z["krb_override"],
            "tariff_blocked": z["tariff_blocked"],
            "emergency_active": z["emergency_active"],
            "pv_active": z["pv_active"],
            "boost_active": z["boost_active"],
            "heating_allowed": z["heating_allowed"],
            "zdroj_kurenia": z.get("heat_source"),
            # pre prehladovu kartu - aby nepotrebovala vlastnu konfiguraciu
            "outdoor_entity": self.coordinator.entry.options.get(CONF_OUTDOOR_SENSOR),
            "presence_entities": list(zone_conf.get(CONF_PRESENCE_ENTITIES, [])),
            "manual_presence_entities": list(zone_conf.get(CONF_MANUAL_PRESENCE_ENTITIES, [])),
        }


class ZoneTemperatureSensor(CoordinatorEntity[SmartHeatingCoordinator], SensorEntity):
    """Teplota v zone (ta ista, z ktorej integracia rozhoduje - externy teplomer
    alebo vstavany senzor termostatu).

    Vdaka state_class=measurement z nej Home Assistant sam pocita kratkodobe
    statistiky (priemer/min/max kazdych 5 minut). Karta z nich cita priemer za
    24 h a min/max za 48 h - lacny dotaz namiesto stahovania celej historie."""

    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_suggested_display_precision = 1

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        super().__init__(coordinator)
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_teplota"
        self.entity_id = f"sensor.smart_heating_{zone_id}_teplota"
        self._attr_name = f"{zone_name} teplota"

    @property
    def native_value(self):
        value = self.coordinator.data["zones"][self._zone_id].get("current_temperature")
        try:
            return round(float(value), 2) if value is not None else None
        except (TypeError, ValueError):
            return None
