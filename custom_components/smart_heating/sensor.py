"""Sensor platform - diagnosticky stav a tyzdenny rozvrh per zona."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, OPT_ZONES, SIGNAL_SCHEDULE_UPDATED, WEEKDAY_KEYS
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list = []
    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        entities.append(ZoneReasonSensor(coordinator, zone_id, zone["name"]))
        entities.append(ZoneScheduleSensor(coordinator, zone_id, zone["name"]))
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
        return {
            "zone_id": self._zone_id,
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


class ZoneScheduleSensor(SensorEntity):
    """Vystavuje aktualny tyzdenny rozvrh zony (pre custom kartu) - AKTUALIZUJE SA
    LEN pri realnej zmene rozvrhu (dispatcher signal), NIE pri kazdom 5min tiku
    coordinatora, aby sa zbytocne nezapisovala vela historie do recorder DB."""

    _attr_icon = "mdi:calendar-clock"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_should_poll = False

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        self._coordinator = coordinator
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_rozvrh"
        self.entity_id = f"sensor.smart_heating_{zone_id}_rozvrh"
        self._attr_name = f"{zone_name} rozvrh"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                f"{SIGNAL_SCHEDULE_UPDATED}_{self._zone_id}",
                self._handle_schedule_updated,
            )
        )

    @callback
    def _handle_schedule_updated(self) -> None:
        self.async_write_ha_state()

    @property
    def native_value(self):
        return dt_util.now().isoformat()

    @property
    def extra_state_attributes(self):
        grid = self._coordinator.get_zone_schedule(self._zone_id)
        return {
            "zone_id": self._zone_id,
            "rozvrh": grid,
            "nastaveny": grid is not None,
            "dni": WEEKDAY_KEYS,
        }
