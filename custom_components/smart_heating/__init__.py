"""Smart Heating - univerzalna integracia pre riadenie viaczonoveho kurenia."""
from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import BLOCKS_PER_DAY, DOMAIN, WEEKDAY_KEYS
from .coordinator import SmartHeatingCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["climate", "select", "number", "sensor", "time", "switch", "button"]

SERVICE_SET_SCHEDULE = "set_schedule"
SET_SCHEDULE_SCHEMA = vol.Schema(
    {
        vol.Required("zone_id"): cv.string,
        vol.Required("schedule"): {vol.In(WEEKDAY_KEYS): [vol.Boolean()]},
    }
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Nastavi Smart Heating z config entry."""
    coordinator = SmartHeatingCoordinator(hass, entry)
    await coordinator.async_setup()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    if not hass.services.has_service(DOMAIN, SERVICE_SET_SCHEDULE):
        await _async_register_services(hass)

    return True


async def _async_register_services(hass: HomeAssistant) -> None:
    async def _handle_set_schedule(call: ServiceCall) -> None:
        zone_id = call.data["zone_id"]
        schedule = call.data["schedule"]

        for day in WEEKDAY_KEYS:
            blocks = schedule.get(day)
            if not isinstance(blocks, list) or len(blocks) != BLOCKS_PER_DAY:
                raise HomeAssistantError(
                    f"Rozvrh musi obsahovat presne {BLOCKS_PER_DAY} hodnot pre den '{day}'"
                )

        coordinators = list(hass.data.get(DOMAIN, {}).values())
        if not coordinators:
            raise HomeAssistantError("Smart Heating nie je nastaveny")
        coordinator: SmartHeatingCoordinator = coordinators[0]

        if zone_id not in coordinator.zones:
            raise HomeAssistantError(f"Neznama zona: {zone_id}")

        await coordinator.async_set_zone_schedule(zone_id, schedule)

    hass.services.async_register(
        DOMAIN, SERVICE_SET_SCHEDULE, _handle_set_schedule, schema=SET_SCHEDULE_SCHEMA
    )


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Zavola sa pri zmene options (pridanie/uprava/zmazanie zony) - reload entry."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Vylozi config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        coordinator: SmartHeatingCoordinator = hass.data[DOMAIN].pop(entry.entry_id)
        coordinator.async_unsub()
        if not hass.data[DOMAIN]:
            hass.services.async_remove(DOMAIN, SERVICE_SET_SCHEDULE)
    return unload_ok
