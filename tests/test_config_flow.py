"""Tests for the config/options flow.

Includes a regression test for the original '500 Internal Server Error' bug
where OptionsFlow.__init__ manually set self.config_entry - not allowed since
HA 2024.12, where it became a read-only property."""
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResultType

from custom_components.smart_heating.const import DOMAIN


async def test_user_flow_creates_entry(hass):
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == FlowResultType.FORM
    assert result["step_id"] == "user"

    result2 = await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})
    assert result2["type"] == FlowResultType.CREATE_ENTRY
    assert result2["title"] == "Smart Heating"
    assert result2["result"].options["zones"] == {}


async def test_single_instance_allowed(hass):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})

    result2 = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result2["type"] == FlowResultType.ABORT
    assert result2["reason"] == "single_instance_allowed"


async def _create_entry(hass):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    entry_result = await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})
    return entry_result["result"]


async def test_options_flow_shows_menu(hass):
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    assert options_result["type"] == FlowResultType.MENU
    assert options_result["step_id"] == "init"


async def test_options_flow_global_settings_roundtrip(hass):
    """Regresny test presne na povodny bug - otvorenie 'Globalne nastavenia'
    hadzalo 500 error kvoli manualnemu nastaveniu config_entry v __init__."""
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    global_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "global"}
    )
    assert global_form["step_id"] == "global"

    saved = await hass.config_entries.options.async_configure(
        global_form["flow_id"], user_input={"holiday_active": True}
    )
    assert saved["type"] == FlowResultType.CREATE_ENTRY
    assert entry.options["holiday_active"] is True


async def test_options_flow_add_zone(hass):
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    add_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "add_zone"}
    )
    assert add_form["step_id"] == "add_zone"

    created = await hass.config_entries.options.async_configure(
        add_form["flow_id"],
        user_input={
            "name": "Test Zone",
            "zone_type": "floor",
            "climate_entity": "climate.test_floor",
        },
    )
    assert created["type"] == FlowResultType.CREATE_ENTRY
    zones = entry.options["zones"]
    assert len(zones) == 1
    assert list(zones.values())[0]["name"] == "Test Zone"


async def test_options_flow_add_zone_without_schedule_entity_does_not_crash(hass):
    """Regresny test na bug 'Entity None is neither a valid entity ID' - volitelne
    EntitySelector polia nesmu dostat default=None."""
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    add_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "add_zone"}
    )
    # ziadna vynimka pri zobrazeni formulara so vsetkymi volitelnymi polami prazdnymi
    assert add_form["type"] == FlowResultType.FORM


async def test_remove_zone(hass):
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    add_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "add_zone"}
    )
    await hass.config_entries.options.async_configure(
        add_form["flow_id"],
        user_input={"name": "Zone A", "zone_type": "floor", "climate_entity": "climate.a"},
    )
    zone_id = list(entry.options["zones"].keys())[0]

    options_result2 = await hass.config_entries.options.async_init(entry.entry_id)
    remove_form = await hass.config_entries.options.async_configure(
        options_result2["flow_id"], user_input={"next_step_id": "remove_zone"}
    )
    assert remove_form["step_id"] == "remove_zone"

    result = await hass.config_entries.options.async_configure(
        remove_form["flow_id"], user_input={"zone_id": zone_id}
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    assert entry.options["zones"] == {}


async def test_edit_zone_clear_external_temp_entity(hass):
    """Regresny test presne na nahlaseny bug: ak formular pri editacii NEODOSLE
    kluc pre uz nastavenu volitelnu EntitySelector hodnotu (co niektore verzie
    HA frontendu robia, ked pouzivatel entitu v UI vycisti), voluptuous defaults
    v schema vedeli tichuckym sposobom povodnu hodnotu vratit spat. Pole
    "clear_external_temp_entity" tento problem obchadza uplne."""
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    add_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "add_zone"}
    )
    await hass.config_entries.options.async_configure(
        add_form["flow_id"],
        user_input={
            "name": "Obyvacka",
            "zone_type": "floor",
            "climate_entity": "climate.obyvacka",
            "external_temp_entity": "sensor.sonoff_obyvacka_temperature",
        },
    )
    zone_id = list(entry.options["zones"].keys())[0]
    assert entry.options["zones"][zone_id]["external_temp_entity"] == "sensor.sonoff_obyvacka_temperature"

    # otvor editaciu - formular by mal teraz ponuknut aj "clear_external_temp_entity"
    options_result2 = await hass.config_entries.options.async_init(entry.entry_id)
    edit_menu = await hass.config_entries.options.async_configure(
        options_result2["flow_id"], user_input={"next_step_id": "edit_zone"}
    )
    edit_form = await hass.config_entries.options.async_configure(
        edit_menu["flow_id"], user_input={"zone_id": zone_id}
    )
    field_names = {str(k) for k in edit_form["data_schema"].schema}
    assert "clear_external_temp_entity" in field_names

    # simuluj presne nahlaseny bug: kluc external_temp_entity sa VOBEC neodosle
    # (formular ho pri vycisteni entity jednoducho vynecha), ale clear-prepinac
    # je zapnuty
    result = await hass.config_entries.options.async_configure(
        edit_form["flow_id"],
        user_input={
            "name": "Obyvacka",
            "zone_type": "floor",
            "climate_entity": "climate.obyvacka",
            "clear_external_temp_entity": True,
        },
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    assert entry.options["zones"][zone_id]["external_temp_entity"] is None


async def test_edit_zone_without_clear_checkbox_keeps_value(hass):
    """Bez zaskrtnutia 'clear' checkboxu ostava hodnota, ktoru EntitySelector
    realne odoslal (normalna uprava, ziadne vymazavanie)."""
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    add_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "add_zone"}
    )
    await hass.config_entries.options.async_configure(
        add_form["flow_id"],
        user_input={
            "name": "Obyvacka",
            "zone_type": "floor",
            "climate_entity": "climate.obyvacka",
            "external_temp_entity": "sensor.a",
        },
    )
    zone_id = list(entry.options["zones"].keys())[0]

    options_result2 = await hass.config_entries.options.async_init(entry.entry_id)
    edit_menu = await hass.config_entries.options.async_configure(
        options_result2["flow_id"], user_input={"next_step_id": "edit_zone"}
    )
    edit_form = await hass.config_entries.options.async_configure(
        edit_menu["flow_id"], user_input={"zone_id": zone_id}
    )
    await hass.config_entries.options.async_configure(
        edit_form["flow_id"],
        user_input={
            "name": "Obyvacka",
            "zone_type": "floor",
            "climate_entity": "climate.obyvacka",
            "external_temp_entity": "sensor.b",
        },
    )
    assert entry.options["zones"][zone_id]["external_temp_entity"] == "sensor.b"


async def test_add_zone_no_clear_checkbox_shown(hass):
    """Pri pridavani novej zony (nic nie je este nastavene) sa 'clear' checkbox
    vobec neponuka - nema co mazat."""
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    add_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "add_zone"}
    )
    field_names = {str(k) for k in add_form["data_schema"].schema}
    assert "clear_external_temp_entity" not in field_names
    assert "clear_floor_temp_entity" not in field_names


async def test_use_fixed_ac_setpoint_field_roundtrip(hass):
    """Nove strukturalne pole use_fixed_ac_setpoint (Upravit zonu formular) sa
    ulozi a spatne predvyplni - rovnaky vzor ako use_fireplace_guard."""
    entry = await _create_entry(hass)
    options_result = await hass.config_entries.options.async_init(entry.entry_id)
    add_form = await hass.config_entries.options.async_configure(
        options_result["flow_id"], user_input={"next_step_id": "add_zone"}
    )
    field_names = {str(k) for k in add_form["data_schema"].schema}
    assert "use_fixed_ac_setpoint" in field_names

    await hass.config_entries.options.async_configure(
        add_form["flow_id"],
        user_input={
            "name": "Obyvacka",
            "zone_type": "floor_ac",
            "climate_entity": "climate.obyvacka",
            "use_fixed_ac_setpoint": True,
        },
    )
    zone_id = list(entry.options["zones"].keys())[0]
    assert entry.options["zones"][zone_id]["use_fixed_ac_setpoint"] is True
