"""Minifikovana + gzip karta: servuje sa len ked zodpoveda zdrojaku (bez zmeny spravania)."""
import gzip
import hashlib
import shutil
from pathlib import Path

import pytest
from awesomeversion import AwesomeVersion
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.setup import async_setup_component

from custom_components.smart_heating import CARD_URL_PATH, _card_file_to_serve, async_setup

WWW = Path(__file__).parent.parent / "custom_components" / "smart_heating" / "www"


def test_repo_build_is_fresh():
    """Pri zmene karty treba spustit `npm run build` - inak by sa servoval zdrojak (CI to zachyti)."""
    src = (WWW / "smart-heating-card.js").read_bytes()
    mini = (WWW / "smart-heating-card.min.js").read_bytes()
    assert f"src-sha256:{hashlib.sha256(src).hexdigest()}".encode() in mini[:300], "spusti: npm run build"
    assert gzip.decompress((WWW / "smart-heating-card.min.js.gz").read_bytes()) == mini
    assert _card_file_to_serve(WWW).name == "smart-heating-card.min.js"
    assert len(mini) < len(src)


def test_stale_min_falls_back_to_source(tmp_path):
    for f in ("smart-heating-card.js", "smart-heating-card.min.js", "smart-heating-card.min.js.gz"):
        shutil.copy(WWW / f, tmp_path / f)
    with open(tmp_path / "smart-heating-card.js", "a", encoding="utf-8") as fh:
        fh.write("\n// zmena bez npm run build\n")
    assert _card_file_to_serve(tmp_path).name == "smart-heating-card.js"


def test_mismatched_gzip_falls_back_to_source(tmp_path):
    for f in ("smart-heating-card.js", "smart-heating-card.min.js"):
        shutil.copy(WWW / f, tmp_path / f)
    (tmp_path / "smart-heating-card.min.js.gz").write_bytes(gzip.compress(b"stara karta"))
    assert _card_file_to_serve(tmp_path).name == "smart-heating-card.js"


def test_missing_min_serves_source(tmp_path):
    shutil.copy(WWW / "smart-heating-card.js", tmp_path / "smart-heating-card.js")
    assert _card_file_to_serve(tmp_path).name == "smart-heating-card.js"


@pytest.mark.skipif(
    AwesomeVersion(HA_VERSION) < AwesomeVersion("2025.2.0"),
    reason="starsi test plugin hlasi po HTTP klientovi visiace vlakno executora (test sam prechadza)",
)
async def test_http_serves_gzip_to_browser(hass, hass_client):
    await async_setup_component(hass, "http", {})
    await async_setup_component(hass, "frontend", {})
    await async_setup(hass, {})
    await hass.async_block_till_done()
    client = await hass_client()

    resp = await client.get(CARD_URL_PATH, headers={"Accept-Encoding": "gzip, deflate, br"})
    assert resp.status == 200
    assert resp.headers.get("Content-Encoding") == "gzip"
    assert "javascript" in resp.headers.get("Content-Type", "")
    body = await resp.read()                       # klient sam rozbali
    assert body == (WWW / "smart-heating-card.min.js").read_bytes()

    plain = await client.get(CARD_URL_PATH, headers={"Accept-Encoding": "identity"})
    assert plain.status == 200 and "Content-Encoding" not in plain.headers
    assert await plain.read() == (WWW / "smart-heating-card.min.js").read_bytes()
