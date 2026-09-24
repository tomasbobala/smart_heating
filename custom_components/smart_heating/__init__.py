"""Smart Heating - univerzalna integracia pre riadenie viaczonoveho kurenia."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import DOMAIN
from .coordinator import SmartHeatingCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["climate", "select", "number", "sensor", "time", "switch", "button"]

CARD_URL_PATH = "/smart_heating_static/smart-heating-card.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Domenovy setup (vola sa raz pri starte HA, nezavisle od config entries).

    Zaregistruje kartu (smart-heating-card.js) ako staticky subor a auto-vlozi
    ju do kazdeho dashboardu - subor zije priamo v
    custom_components/smart_heating/www/, teda ho HACS nasadi automaticky
    spolu so zvyskom Python kodu. Netreba nic rucne kopirovat do
    config/www/ ani rucne pridavat Lovelace resource."""
    card_path = Path(__file__).parent / "www" / "smart-heating-card.js"
    if card_path.exists():
        try:
            await hass.http.async_register_static_paths(
                [StaticPathConfig(CARD_URL_PATH, str(card_path), cache_headers=False)]
            )
            try:
                integration = await async_get_integration(hass, DOMAIN)
                version = str(integration.version)
            except Exception:  # noqa: BLE001
                version = "0"
            add_extra_js_url(hass, f"{CARD_URL_PATH}?v={version}")
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Nepodarilo sa zaregistrovat smart-heating-card.js ako staticky subor")
    return True


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
