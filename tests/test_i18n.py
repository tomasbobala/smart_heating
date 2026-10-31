"""Tests for the i18n module."""
from types import SimpleNamespace

from custom_components.smart_heating import i18n


def test_resolve_lang_explicit_override():
    assert i18n.resolve_lang(None, "en") == "en"
    assert i18n.resolve_lang(None, "sk") == "sk"


def test_resolve_lang_auto_follows_hass_language():
    hass_sk = SimpleNamespace(config=SimpleNamespace(language="sk"))
    hass_en = SimpleNamespace(config=SimpleNamespace(language="en"))
    hass_other = SimpleNamespace(config=SimpleNamespace(language="cs"))
    assert i18n.resolve_lang(hass_sk, "auto") == "sk"
    assert i18n.resolve_lang(hass_en, "auto") == "en"
    assert i18n.resolve_lang(hass_other, "auto") == "en"  # fallback for unsupported language
    assert i18n.resolve_lang(hass_sk, None) == "sk"


def test_t_formats_with_kwargs():
    text_en = i18n.t("en", "reason_floor_stop", floor_temp=27.5, floor_max=28)
    assert "27.5" in text_en and "28" in text_en
    text_sk = i18n.t("sk", "reason_floor_stop", floor_temp=27.5, floor_max=28)
    assert "podlahy" in text_sk


def test_t_unknown_key_returns_key():
    assert i18n.t("en", "totally_unknown_key") == "totally_unknown_key"


def test_t_falls_back_to_english_for_missing_lang():
    i18n.TEXTS["_test_temp_key"] = {"en": "hello"}
    try:
        assert i18n.t("sk", "_test_temp_key") == "hello"
    finally:
        del i18n.TEXTS["_test_temp_key"]


def test_all_text_entries_have_en_and_sk():
    missing = [key for key, entry in i18n.TEXTS.items() if "en" not in entry or "sk" not in entry]
    assert missing == [], f"Keys missing a translation: {missing}"
