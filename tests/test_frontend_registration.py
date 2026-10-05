"""Tests for the integration self-hosting the Lovelace card.

Since 0.13.x the card is registered as a regular Lovelace resource after HA
start (reliably loaded by dashboards); add_extra_js_url is only a fallback when
Lovelace runs in YAML mode and its resources can't be edited."""
from pathlib import Path

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.setup import async_setup_component

from custom_components.smart_heating import CARD_URL_PATH, async_setup


def _resources(hass):
    lovelace = hass.data["lovelace"]
    res = getattr(lovelace, "resources", None)
    if res is None and isinstance(lovelace, dict):
        res = lovelace.get("resources")
    return res


def _card_items(hass):
    return [
        i for i in _resources(hass).async_items()
        if str(i.get("url", "")).split("?", 1)[0] == CARD_URL_PATH
    ]


async def _setup_frontend(hass):
    await async_setup_component(hass, "http", {})
    await async_setup_component(hass, "frontend", {})


async def test_static_path_registered_with_real_card_file(hass):
    await _setup_frontend(hass)
    await async_setup(hass, {})
    await hass.async_block_till_done()

    assert any(
        CARD_URL_PATH in str(route.resource.canonical)
        for route in hass.http.app.router.routes()
        if getattr(route, "resource", None) is not None
    ), "CARD_URL_PATH nebola zaregistrovana"

    card = Path(__file__).parent.parent / "custom_components" / "smart_heating" / "www" / "smart-heating-card.js"
    content = card.read_text(encoding="utf-8")
    assert "SmartHeatingCard" in content and "customElements.define" in content


async def test_card_added_as_lovelace_resource(hass):
    await _setup_frontend(hass)
    await async_setup(hass, {})
    await hass.async_block_till_done()

    items = _card_items(hass)
    assert len(items) == 1
    assert items[0]["url"].startswith(f"{CARD_URL_PATH}?v=")


async def test_setup_twice_does_not_duplicate_resource(hass):
    await _setup_frontend(hass)
    await async_setup(hass, {})
    await async_setup(hass, {})
    await hass.async_block_till_done()

    assert len(_card_items(hass)) == 1


async def test_old_version_resource_is_updated_not_duplicated(hass):
    await _setup_frontend(hass)
    res = _resources(hass)
    if not getattr(res, "loaded", True):
        await res.async_load()
        res.loaded = True
    await res.async_create_item({"res_type": "module", "url": f"{CARD_URL_PATH}?v=0.0.1"})

    await async_setup(hass, {})
    await hass.async_block_till_done()

    items = _card_items(hass)
    assert len(items) == 1
    assert not items[0]["url"].endswith("?v=0.0.1")


async def test_yaml_mode_falls_back_to_extra_js_url(hass):
    """Ked sa Lovelace zdroje nedaju menit (YAML rezim), karta sa musi vlozit
    cez add_extra_js_url, inak by sa vobec nenacitala."""
    await _setup_frontend(hass)
    lovelace = hass.data["lovelace"]
    if isinstance(lovelace, dict):
        lovelace["resources"] = object()  # bez async_create_item = ako YAML kolekcia
    else:
        lovelace.resources = object()

    await async_setup(hass, {})
    await hass.async_block_till_done()

    assert any(CARD_URL_PATH in u for u in hass.data[DATA_EXTRA_MODULE_URL].urls)


async def test_async_setup_without_http_does_not_crash(hass):
    assert await async_setup(hass, {}) is True
