"""Smart Heating - univerzalna integracia pre riadenie viaczonoveho kurenia."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.start import async_at_started
from homeassistant.loader import async_get_integration

from .const import DOMAIN
from .coordinator import SmartHeatingCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["climate", "select", "number", "sensor", "binary_sensor", "time", "switch", "button"]

# Integracia sa nastavuje len cez UI (config entry), YAML konfiguraciu nema.
# Hassfest to vyzaduje pri kazdej integracii, ktora ma async_setup.
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

CARD_URL_PATH = "/smart_heating_static/smart-heating-card.js"
CARD_REGISTERED = "card_registered"


def _lovelace_resources(hass: HomeAssistant):
    """Vrati kolekciu Lovelace zdrojov (nove aj stare verzie HA), alebo None."""
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        return None
    resources = getattr(lovelace, "resources", None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    return resources


async def _async_ensure_lovelace_resource(hass: HomeAssistant, url: str) -> bool:
    """Prida kartu medzi Lovelace zdroje, alebo aktualizuje verziu v existujucom.

    Vrati False, ked to nejde (Lovelace v YAML rezime) - vtedy sa pouzije
    add_extra_js_url ako zaloha.
    """
    resources = _lovelace_resources(hass)
    if resources is None or not hasattr(resources, "async_create_item"):
        return False

    if not getattr(resources, "loaded", True):
        await resources.async_load()
        resources.loaded = True

    base = url.split("?", 1)[0]
    for item in resources.async_items():
        if str(item.get("url", "")).split("?", 1)[0] != base:
            continue
        if item.get("url") != url:
            await resources.async_update_item(item["id"], {"res_type": "module", "url": url})
            _LOGGER.info("Lovelace zdroj karty aktualizovany na %s", url)
        return True

    await resources.async_create_item({"res_type": "module", "url": url})
    _LOGGER.info("Lovelace zdroj karty pridany: %s", url)
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Spristupni kartu a zabezpeci, aby ju prehliadac nacital.

    1. Subor custom_components/smart_heating/www/smart-heating-card.js sa
       zaregistruje ako staticka cesta /smart_heating_static/...
    2. Po starte HA sa karta prida medzi Lovelace zdroje (Nastavenia ->
       Dashboardy -> Zdroje), presne tak, ako keby ju pouzivatel pridal rucne.
       Tieto zdroje prehliadac nacitava spolahlivo. Pri novej verzii sa len
       prepise ?v= v existujucom zazname, nic sa neduplikuje.
    3. Ak Lovelace bezi v YAML rezime a zdroje sa menit nedaju, pouzije sa
       add_extra_js_url ako zaloha.

    Vola sa z async_setup aj z async_setup_entry; druhe volanie sa preskoci.
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
        # opakovana registracia tej istej cesty
        _LOGGER.debug("Staticka cesta uz je zaregistrovana: %s", err)
    except Exception:  # noqa: BLE001
        _LOGGER.exception("Nepodarilo sa zaregistrovat smart-heating-card.js ako staticky subor")
        return

    try:
        integration = await async_get_integration(hass, DOMAIN)
        version = str(integration.version)
    except Exception:  # noqa: BLE001
        version = "0"

    url = f"{CARD_URL_PATH}?v={version}"
    data[CARD_REGISTERED] = True

    async def _async_load_card(_hass: HomeAssistant) -> None:
        try:
            if await _async_ensure_lovelace_resource(hass, url):
                return
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Nepodarilo sa pridat Lovelace zdroj karty, pouzije sa add_extra_js_url")
        add_extra_js_url(hass, url)
        _LOGGER.info("smart-heating-card.js vlozena cez add_extra_js_url: %s", url)

    # Lovelace zdroje sa nacitavaju az pocas startu - preto az po nom
    async_at_started(hass, _async_load_card)


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
