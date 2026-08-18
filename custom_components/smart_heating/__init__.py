"""Smart Heating - univerzalna integracia pre riadenie viaczonoveho kurenia."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .coordinator import SmartHeatingCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["climate", "select", "number", "sensor", "time", "switch", "button"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Nastavi Smart Heating z config entry."""
    coordinator = SmartHeatingCoordinator(hass, entry)
    await coordinator.async_setup()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Zavola sa pri zmene options (pridanie/uprava/zmazanie zony) - reload entry."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Vylozi config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        coordinator: SmartHeatingCoordinator = hass.data[DOMAIN].pop(entry.entry_id)
        coordinator.async_unsub()
    return unload_ok
