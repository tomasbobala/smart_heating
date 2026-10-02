"""Smart Heating - univerzalna integracia pre riadenie viaczonoveho kurenia."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import DOMAIN
from .coordinator import SmartHeatingCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["climate", "select", "number", "sensor", "time", "switch", "button"]

CARD_URL_PATH = "/smart_heating_static/smart-heating-card.js"
CARD_REGISTERED = "card_registered"


async def _async_register_card(hass: HomeAssistant) -> None:
    """Zaregistruje kartu ako staticky subor a vlozi ju do kazdeho dashboardu.

    Vola sa z async_setup aj z async_setup_entry - podla toho, co prebehne skor.
    Druhe volanie sa ticho preskoci. Subor zije v
    custom_components/smart_heating/www/, takze ho HACS nasadi automaticky
    spolu so zvyskom kodu a netreba nic kopirovat do config/www/ ani rucne
    pridavat Lovelace resource.
    """
    data = hass.data.setdefault(DOMAIN, {})
    if data.get(CARD_REGISTERED):
        return

    card_path = Path(__file__).parent / "www" / "smart-heating-card.js"
    if not card_path.exists():
        _LOGGER.error("smart-heating-card.js sa nenasiel na ceste %s", card_path)
        return

    http = getattr(hass, "http", None)
    if http is None:
        _LOGGER.warning("hass.http este nie je pripravene, registracia karty sa odklada")
        return

    try:
        if hasattr(http, "async_register_static_paths"):
            from homeassistant.components.http import StaticPathConfig

            await http.async_register_static_paths(
                [StaticPathConfig(CARD_URL_PATH, str(card_path), cache_headers=False)]
            )
        else:  # pragma: no cover - starsie verzie HA
            http.register_static_path(CARD_URL_PATH, str(card_path), cache_headers=False)
    except RuntimeError as err:
        # opakovana registracia tej istej cesty po reloade integracie
        _LOGGER.debug("Staticka cesta uz je zaregistrovana: %s", err)
    except Exception:  # noqa: BLE001
        _LOGGER.exception("Nepodarilo sa zaregistrovat smart-heating-card.js ako staticky subor")
        return

    try:
        integration = await async_get_integration(hass, DOMAIN)
        version = str(integration.version)
    except Exception:  # noqa: BLE001
        version = "0"

    add_extra_js_url(hass, f"{CARD_URL_PATH}?v={version}")
    data[CARD_REGISTERED] = True
    _LOGGER.info("smart-heating-card.js zaregistrovana na %s?v=%s", CARD_URL_PATH, version)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Domenovy setup (vola sa raz pri starte HA, nezavisle od config entries)."""
    await _async_register_card(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Nastavi Smart Heating z config entry."""
    await _async_register_card(hass)

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
