"""Switch platform - predkurenie povolene / reaguj na krb / vyuzi FVE (per zona).

Hub-level 'Dovolenka/Nepritomnost' je teraz sucastou config/options flow
(Globalne nastavenia), nie samostatny switch - preto tu uz nie je HubSwitch."""
from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .const import (
    AC_SWITCH_DEFS, CONF_USE_FLOOR_MIN, CONF_ZONE_TYPE, DOMAIN, OPT_ZONES, SWITCH_DEFS,
    ZONE_TYPE_FLOOR_AC, ZONE_TYPE_RADIATOR_FLOOR,
)
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list = []
    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        defs = dict(SWITCH_DEFS)
        if zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_FLOOR_AC:
            defs.update(AC_SWITCH_DEFS)
        for key, (label, icon, default) in defs.items():
            if key == "udrzat_min_podlahy":
                # v kupelni (radiator + podlaha) je to hlavna uloha podlahy -> predvolene zapnute
                default = zone.get(CONF_USE_FLOOR_MIN, zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_RADIATOR_FLOOR)
            entities.append(ZoneSwitch(coordinator, zone_id, zone["name"], key, label, icon, default))
    entities.append(PvPauseSwitch(coordinator))
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


class PvPauseSwitch(CoordinatorEntity[SmartHeatingCoordinator], SwitchEntity, RestoreEntity):
    """Pauza kurenia z FVE. Zapnutie = pauza na predvolenu dlzku (nastavenia),
    vypnutie = koniec pauzy. Atribut 'do' = kedy pauza skonci. Prezije restart."""

    _attr_icon = "mdi:solar-power-variant-outline"

    def __init__(self, coordinator: SmartHeatingCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{DOMAIN}_{coordinator.entry.entry_id}_fve_pauza"
        self.entity_id = "switch.smart_heating_fve_pauza"
        self._attr_name = "Smart Heating FVE pauza"

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last is not None and last.state == "on" and last.attributes.get("do"):
            until = dt_util.parse_datetime(str(last.attributes["do"]))
            if until is not None and until > dt_util.now() and self.coordinator._pv_pause_until is None:
                self.coordinator._pv_pause_until = until
                await self.coordinator.async_recompute_and_apply()

    @property
    def is_on(self) -> bool:
        return self.coordinator._pv_paused()

    @property
    def extra_state_attributes(self):
        until = self.coordinator._pv_pause_until if self.coordinator._pv_paused() else None
        return {"do": until.isoformat() if until else None}

    async def async_turn_on(self, **kwargs) -> None:
        await self.coordinator.async_pv_pause()

    async def async_turn_off(self, **kwargs) -> None:
        await self.coordinator.async_pv_resume()
