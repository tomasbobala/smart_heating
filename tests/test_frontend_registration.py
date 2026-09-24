"""Tests for the integration self-hosting the Lovelace card (no manual www/ copy
needed anymore) - static path registration + automatic dashboard injection."""
from pathlib import Path

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.setup import async_setup_component

from custom_components.smart_heating import CARD_URL_PATH, async_setup


async def test_async_setup_registers_static_path_with_real_card_file(hass):
    """Static cesta CARD_URL_PATH musi byt zaregistrovana a musi ukazovat na
    skutocny, funkcny obsah smart-heating-card.js (nie prazdny/chybny subor)."""
    await async_setup_component(hass, "http", {})
    await async_setup_component(hass, "frontend", {})

    await async_setup(hass, {})
    await hass.async_block_till_done()

    matched = False
    for route in hass.http.app.router.routes():
        if getattr(route, "_resource", None) and CARD_URL_PATH in str(route.resource.canonical):
            matched = True
            break
    assert matched, "CARD_URL_PATH nebola zaregistrovana v hass.http.app.router"

    card_path = Path(__file__).parent.parent / "custom_components" / "smart_heating" / "www" / "smart-heating-card.js"
    assert card_path.exists()
    content = card_path.read_text(encoding="utf-8")
    assert "SmartHeatingCard" in content
    assert "customElements.define" in content


async def test_async_setup_auto_injects_card_into_dashboards(hass):
    """add_extra_js_url musi byt zavolane s CARD_URL_PATH - to je presne
    mechanizmus, ktory robi manualne pridavanie Lovelace resource zbytocnym."""
    await async_setup_component(hass, "http", {})
    await async_setup_component(hass, "frontend", {})

    await async_setup(hass, {})
    await hass.async_block_till_done()

    urls = hass.data[DATA_EXTRA_MODULE_URL].urls
    assert any(CARD_URL_PATH in u for u in urls)


async def test_async_setup_does_not_crash_without_http_component(hass):
    """Ak by z akehokolvek dovodu hass.http neexistoval, async_setup nesmie
    zhavarovat cely startup integracie - len sa ticho vzda registracie karty."""
    result = await async_setup(hass, {})
    assert result is True
