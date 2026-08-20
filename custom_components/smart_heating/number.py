"""Number platform - editovatelne teploty a numericke parametre (per zona).

Hub-level cisla (nudzova teplota, krb threshold) su teraz sucastou config/options
flow (Globalne nastavenia), nie samostatne number entity - preto tu uz nie je
ziadny HubNumber."""
from __future__ import annotations

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import AC_NUMBER_DEFS, COOLING_NUMBER_DEFS, CONF_ZONE_TYPE, DOMAIN, NUMBER_DEFS, OPT_ZONES, ZONE_TYPE_FLOOR_AC
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list = []

    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        defs = dict(NUMBER_DEFS)
        if zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_FLOOR_AC:
            defs.update(AC_NUMBER_DEFS)
            defs.update(COOLING_NUMBER_DEFS)
        for key, (label, lo, hi, icon, default) in defs.items():
            entities.append(
                ZoneNumber(coordinator, zone_id, zone["name"], key, label, lo, hi, icon, zone.get(key, default))
            )
    async_add_entities(entities)


class ZoneNumber(NumberEntity, RestoreEntity):
    _attr_mode = NumberMode.BOX
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_native_step = 0.5

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

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state not in (None, "unknown", "unavailable"):
            try:
                self._attr_native_value = float(last_state.state)
            except ValueError:
                pass

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = value
        self.async_write_ha_state()
        await self._coordinator.async_recompute_and_apply()
