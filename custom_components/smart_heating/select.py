"""Select platform - vyber rezimu (Auto/Den/Noc/Min/Mraz/Vypnute) per zona."""
from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN, MODE_AUTO, OPT_ZONES, ZONE_MODES
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        ZoneModeSelect(coordinator, zone_id, zone["name"])
        for zone_id, zone in entry.options.get(OPT_ZONES, {}).items()
    )


class ZoneModeSelect(SelectEntity, RestoreEntity):
    _attr_options = ZONE_MODES
    _attr_icon = "mdi:thermostat-auto"

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        self._coordinator = coordinator
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_rezim"
        self.entity_id = f"select.smart_heating_{zone_id}_rezim"
        self._attr_name = f"{zone_name} rezim"
        self._attr_current_option = MODE_AUTO

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state in ZONE_MODES:
            self._attr_current_option = last_state.state

    async def async_select_option(self, option: str) -> None:
        self._attr_current_option = option
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()
