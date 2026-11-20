"""Smart Heating - univerzalna integracia pre riadenie viaczonoveho kurenia."""
from __future__ import annotations

import gzip
import hashlib
import logging
import re
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


_MIN_HASH_RE = re.compile(rb"src-sha256:([0-9a-f]{64})")


def _card_file_to_serve(www: Path) -> Path:
    """Minifikovana karta (smart-heating-card.min.js + .gz), ak zodpoveda zdrojaku.

    Prehliadac dostane ~48 kB gzip namiesto ~212 kB. Prvy riadok min suboru nesie
    sha256 zdrojaka (scripts/build-card.js); ked nesedi - karta bola upravena bez
    `npm run build` - alebo .gz nie je z toho isteho min suboru, servuje sa zdrojak.
    Tak sa do prehliadaca nikdy nedostane stara verzia karty. Vola sa v executore.
    """
    src = www / "smart-heating-card.js"
    mini = www / "smart-heating-card.min.js"
    try:
        min_bytes = mini.read_bytes()
        match = _MIN_HASH_RE.search(min_bytes[:300])
        if not match or match.group(1).decode() != hashlib.sha256(src.read_bytes()).hexdigest():
            _LOGGER.info("smart-heating-card.min.js nezodpoveda zdrojaku, pouzije sa smart-heating-card.js")
            return src
        gz = mini.with_name(mini.name + ".gz")
        if gz.exists() and gzip.decompress(gz.read_bytes()) != min_bytes:
            _LOGGER.info("smart-heating-card.min.js.gz nezodpoveda min suboru, pouzije sa smart-heating-card.js")
            return src
    except (OSError, EOFError, gzip.BadGzipFile):
        return src
    return mini


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

    serve_path = await hass.async_add_executor_job(_card_file_to_serve, card_path.parent)

    try:
        # register_static_path bolo v HA 2025.7 odstranene; async_register_static_paths
        # existuje od 2024.7 (minimum integracie je 2024.12). URL ostava rovnaka;
        # pri .min.js HA samo posle .min.js.gz, ked prehliadac podporuje gzip.
        from homeassistant.components.http import StaticPathConfig

        await http.async_register_static_paths(
            [StaticPathConfig(CARD_URL_PATH, str(serve_path), cache_headers=False)]
        )
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
    _async_register_services(hass)

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


def _async_register_services(hass: HomeAssistant) -> None:
    """Sluzby pauzy kurenia z FVE (pre automatizacie a kartu)."""
    import voluptuous as vol
    from homeassistant.helpers import config_validation as cv

    if hass.services.has_service(DOMAIN, "pause_solar"):
        return

    def _coordinators():
        return [c for c in hass.data.get(DOMAIN, {}).values() if isinstance(c, SmartHeatingCoordinator)]

    async def _pause(call) -> None:
        for c in _coordinators():
            await c.async_pv_pause(call.data.get("minutes"), bool(call.data.get("until_midnight", False)))

    async def _resume(call) -> None:
        for c in _coordinators():
            await c.async_pv_resume()

    hass.services.async_register(DOMAIN, "pause_solar", _pause, schema=vol.Schema({
        vol.Optional("minutes"): vol.All(vol.Coerce(float), vol.Range(min=1, max=1440)),
        vol.Optional("until_midnight"): cv.boolean,
    }))
    hass.services.async_register(DOMAIN, "resume_solar", _resume, schema=vol.Schema({}))

    def _zone_coordinator(zone_id):
        return next((c for c in _coordinators() if zone_id in c.zones), None)

    async def _zone_off(call) -> None:
        c = _zone_coordinator(call.data["zone_id"])
        if c:
            await c.async_zone_off(call.data["zone_id"], call.data.get("minutes"), bool(call.data.get("add", False)))

    async def _zone_on(call) -> None:
        c = _zone_coordinator(call.data["zone_id"])
        if c:
            await c.async_resume_zone(call.data["zone_id"])

    hass.services.async_register(DOMAIN, "zone_off", _zone_off, schema=vol.Schema({
        vol.Required("zone_id"): cv.string,
        vol.Optional("minutes"): vol.All(vol.Coerce(float), vol.Range(min=1, max=1440)),
        vol.Optional("add"): cv.boolean,
    }))
    hass.services.async_register(DOMAIN, "zone_resume", _zone_on, schema=vol.Schema({vol.Required("zone_id"): cv.string}))
