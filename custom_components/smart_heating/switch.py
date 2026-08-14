"""Switch platform - predkurenie povolene / reaguj na krb (per zona) + dovolenka (hub)."""
from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN, OPT_ZONES, SWITCH_DEFS
from .coordinator import HUB_SWITCH_NEPRITOMNOST, SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list = [HubSwitch(coordinator)]
    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        for key, (label, icon, default) in SWITCH_DEFS.items():
            entities.append(ZoneSwitch(coordinator, zone_id, zone["name"], key, label, icon, default))
    async_add_entities(entities)


class ZoneSwitch(SwitchEntity, RestoreEntity):
    def __init__(self, coordinator, zone_id, zone_name, key, label, icon, default) -> None:
        self._coordinator = coordinator
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_{key}"
        self.entity_id = f"switch.smart_heating_{zone_id}_{key}"
        self._attr_name = f"{zone_name} {label}"
        self._attr_icon = icon
        self._attr_is_on = default

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state in ("on", "off"):
            self._attr_is_on = last_state.state == "on"

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()


class HubSwitch(SwitchEntity, RestoreEntity):
    """Globalny prepinac Nepritomnost/Dovolenka - vynuti Min vo vsetkych zonach v Auto."""

    _attr_icon = "mdi:airplane"
    _attr_name = "Smart Heating Nepritomnost / Dovolenka"

    def __init__(self, coordinator) -> None:
        self._coordinator = coordinator
        self._attr_unique_id = f"{DOMAIN}_hub_nepritomnost"
        self.entity_id = HUB_SWITCH_NEPRITOMNOST
        self._attr_is_on = False

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state in ("on", "off"):
            self._attr_is_on = last_state.state == "on"

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()
