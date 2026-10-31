"""Tests for configurable number ranges (resolve_number_range + options flow step)."""
from homeassistant.data_entry_flow import FlowResultType

from custom_components.smart_heating.const import (
    ALL_NUMBER_DEFS,
    DOMAIN,
    OPT_NUMBER_RANGES,
    resolve_number_range,
)


def test_resolve_number_range_returns_default_when_no_override():
    assert resolve_number_range({}, "ac_priorita_rozdiel", 0.2, 3) == (0.2, 3)


def test_resolve_number_range_returns_stored_override():
    options = {OPT_NUMBER_RANGES: {"ac_priorita_rozdiel": [0.1, 10]}}
    assert resolve_number_range(options, "ac_priorita_rozdiel", 0.2, 3) == (0.1, 10)


def test_resolve_number_range_ignores_invalid_override():
    # min >= max je nezmyselny rozsah - padni spat na default
    options = {OPT_NUMBER_RANGES: {"ac_priorita_rozdiel": [5, 2]}}
    assert resolve_number_range(options, "ac_priorita_rozdiel", 0.2, 3) == (0.2, 3)


def test_resolve_number_range_ignores_malformed_value():
    options = {OPT_NUMBER_RANGES: {"ac_priorita_rozdiel": ["not", "numbers"]}}
    assert resolve_number_range(options, "ac_priorita_rozdiel", 0.2, 3) == (0.2, 3)


async def _create_entry(hass):
    from homeassistant import config_entries

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    entry_result = await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})
    return entry_result["result"]


async def test_number_ranges_step_reachable_from_menu(hass):
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "number_ranges"}
    )
    assert form["step_id"] == "number_ranges"
    # kazdy kluc z ALL_NUMBER_DEFS musi mat vo formulari min aj max pole
    field_names = {str(k) for k in form["data_schema"].schema}
    for key in ALL_NUMBER_DEFS:
        assert f"{key}__min" in field_names
        assert f"{key}__max" in field_names


async def test_number_ranges_roundtrip_saves_custom_range(hass):
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "number_ranges"}
    )

    # postav user_input: vsetky polia na ich default (z formulara), okrem
    # ac_priorita_rozdiel, kde nastavime vlastny rozsah 0.1 - 10
    user_input = {}
    for field, value_schema in form["data_schema"].schema.items():
        key = str(field)
        user_input[key] = field.default() if callable(field.default) else field.default
    user_input["ac_priorita_rozdiel__min"] = 0.1
    user_input["ac_priorita_rozdiel__max"] = 10.0

    result = await hass.config_entries.options.async_configure(form["flow_id"], user_input=user_input)
    assert result["type"] == FlowResultType.CREATE_ENTRY
    assert entry.options[OPT_NUMBER_RANGES]["ac_priorita_rozdiel"] == [0.1, 10.0]


async def test_number_ranges_rejects_min_greater_than_max(hass):
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "number_ranges"}
    )

    user_input = {}
    for field in form["data_schema"].schema:
        key = str(field)
        user_input[key] = field.default() if callable(field.default) else field.default
    user_input["teplota_den__min"] = 30
    user_input["teplota_den__max"] = 10  # min > max - neplatne

    result = await hass.config_entries.options.async_configure(form["flow_id"], user_input=user_input)
    assert result["type"] == FlowResultType.FORM
    assert result["errors"]["base"] == "invalid_range"
    # nic sa neulozilo
    assert OPT_NUMBER_RANGES not in entry.options
