"""Time platform - casove hranice (den/noc, predkurenie) per zona.

Poznamka: subor sa musi volat presne 'time.py' - Home Assistant vyzaduje
"""
from __future__ import annotations

from datetime import time as dt_time

from homeassistant.components.time import TimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN, OPT_ZONES, TIME_DEFS
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities = []
    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        for key, (label, default) in TIME_DEFS.items():
            entities.append(ZoneTime(coordinator, zone_id, zone["name"], key, label, default))
    async_add_entities(entities)


class ZoneTime(TimeEntity, RestoreEntity):
    _attr_icon = "mdi:clock-outline"

    def __init__(self, coordinator, zone_id, zone_name, key, label, default) -> None:
        self._coordinator = coordinator
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_{key}"
        self.entity_id = f"time.smart_heating_{zone_id}_{key}"
        self._attr_name = f"{zone_name} {label}"
        self._attr_native_value = dt_time.fromisoformat(default)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state not in (None, "unknown", "unavailable"):
            try:
                self._attr_native_value = dt_time.fromisoformat(last_state.state)
            except ValueError:
                pass

    async def async_set_value(self, value: dt_time) -> None:
        self._attr_native_value = value
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()
