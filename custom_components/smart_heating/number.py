"""Number platform - editovatelne teploty a numericke parametre."""
from __future__ import annotations

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import (
    AC_NUMBER_DEFS,
    CONF_ZONE_TYPE,
    DOMAIN,
    HUB_NUMBER_DEFS,
    NUMBER_DEFS,
    OPT_ZONES,
    ZONE_TYPE_FLOOR_AC,
)
from .coordinator import SmartHeatingCoordinator, hub_number_entity_id


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list = []

    for key, (label, lo, hi, icon, default) in HUB_NUMBER_DEFS.items():
        entities.append(HubNumber(coordinator, key, label, lo, hi, icon, default))

    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        defs = dict(NUMBER_DEFS)
        if zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_FLOOR_AC:
            defs.update(AC_NUMBER_DEFS)
        for key, (label, lo, hi, icon, default) in defs.items():
            entities.append(
                ZoneNumber(coordinator, zone_id, zone["name"], key, label, lo, hi, icon, zone.get(key, default))
            )
    async_add_entities(entities)


class _BaseNumber(NumberEntity, RestoreEntity):
    _attr_mode = NumberMode.BOX
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_native_step = 0.5

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state not in (None, "unknown", "unavailable"):
            try:
                self._attr_native_value = float(last_state.state)
            except ValueError:
                pass


class ZoneNumber(_BaseNumber):
    def __init__(self, coordinator, zone_id, zone_name, key, label, lo, hi, icon, default) -> None:
        self._coordinator = coordinator
        self._key = key
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_{key}"
        self.entity_id = f"number.smart_heating_{zone_id}_{key}"
        self._attr_name = f"{zone_name} {label}"
        self._attr_icon = icon
        self._attr_native_min_value = lo
        self._attr_native_max_value = hi
        self._attr_native_value = default

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = value
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()


class HubNumber(_BaseNumber):
    def __init__(self, coordinator, key, label, lo, hi, icon, default) -> None:
        self._coordinator = coordinator
        self._attr_unique_id = f"{DOMAIN}_hub_{key}"
        self.entity_id = hub_number_entity_id(key)
        self._attr_name = f"Smart Heating {label}"
        self._attr_icon = icon
        self._attr_native_min_value = lo
        self._attr_native_max_value = hi
        self._attr_native_value = default

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = value
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()
