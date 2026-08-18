"""Config flow pre Smart Heating v2."""
from __future__ import annotations

import uuid
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    AC_NUMBER_DEFS,
    CONF_AC_ENTITY,
    CONF_CLIMATE_ENTITY,
    CONF_FIREPLACE_TEMP_ENTITY,
    CONF_FLOOR_TEMP_ENTITY,
    CONF_KRB_THRESHOLD,
    CONF_MANUAL_PRESENCE_ENTITIES,
    CONF_NOTIFY_ENTITY,
    CONF_NUDZOVA_TEPLOTA,
    CONF_OUTDOOR_SENSOR,
    CONF_HOLIDAY_ACTIVE,
    CONF_PRESENCE_ENTITIES,
    CONF_PV_SURPLUS_ENTITY,
    CONF_TARIFF_ENTITY,
    CONF_USE_FIREPLACE_GUARD,
    CONF_ZONE_NAME,
    CONF_ZONE_TYPE,
    DEFAULT_EMERGENCY_TEMP,
    DEFAULT_FIREPLACE_THRESHOLD,
    DOMAIN,
    NUMBER_DEFS,
    OPT_ZONES,
    TIME_DEFS,
    ZONE_TYPE_FLOOR,
    ZONE_TYPE_FLOOR_AC,
)


def _add_optional(schema_dict: dict, key: str, value, ent_selector) -> None:
    """Prida volitelne pole - default sa nastavi LEN ak existuje realna hodnota,
    inak by EntitySelector dostal 'None' a zhavaroval by."""
    if value:
        schema_dict[vol.Optional(key, default=value)] = ent_selector
    else:
        schema_dict[vol.Optional(key)] = ent_selector


def _hub_schema_dict(current: dict) -> dict:
    schema_dict: dict = {}
    _add_optional(
        schema_dict, CONF_OUTDOOR_SENSOR, current.get(CONF_OUTDOOR_SENSOR),
        selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", device_class="temperature")),
    )
    _add_optional(
        schema_dict, CONF_TARIFF_ENTITY, current.get(CONF_TARIFF_ENTITY),
        selector.EntitySelector(selector.EntitySelectorConfig(domain=["input_boolean", "switch", "binary_sensor"])),
    )
    _add_optional(
        schema_dict, CONF_FIREPLACE_TEMP_ENTITY, current.get(CONF_FIREPLACE_TEMP_ENTITY),
        selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", device_class="temperature")),
    )
    schema_dict[
        vol.Optional(
            CONF_KRB_THRESHOLD, default=current.get(CONF_KRB_THRESHOLD, DEFAULT_FIREPLACE_THRESHOLD)
        )
    ] = selector.NumberSelector(
        selector.NumberSelectorConfig(min=15, max=60, step=0.5, mode="box", unit_of_measurement="°C")
    )
    schema_dict[
        vol.Optional(
            CONF_NUDZOVA_TEPLOTA, default=current.get(CONF_NUDZOVA_TEPLOTA, DEFAULT_EMERGENCY_TEMP)
        )
    ] = selector.NumberSelector(
        selector.NumberSelectorConfig(min=3, max=15, step=0.5, mode="box", unit_of_measurement="°C")
    )
    schema_dict[
        vol.Optional(CONF_HOLIDAY_ACTIVE, default=current.get(CONF_HOLIDAY_ACTIVE, False))
    ] = selector.BooleanSelector()
    _add_optional(
        schema_dict, CONF_NOTIFY_ENTITY, current.get(CONF_NOTIFY_ENTITY),
        selector.EntitySelector(selector.EntitySelectorConfig(domain="notify")),
    )
    _add_optional(
        schema_dict, CONF_PV_SURPLUS_ENTITY, current.get(CONF_PV_SURPLUS_ENTITY),
        selector.EntitySelector(selector.EntitySelectorConfig(domain=["binary_sensor", "input_boolean", "switch"])),
    )
    return schema_dict


class SmartHeatingConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Prvotne zalozenie hubu (jeden na instanciu HA)."""

    VERSION = 2

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            options = dict(user_input)
            options[OPT_ZONES] = {}
            return self.async_create_entry(title="Smart Heating", data={}, options=options)

        schema = vol.Schema(_hub_schema_dict({}))
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return SmartHeatingOptionsFlow()


class SmartHeatingOptionsFlow(config_entries.OptionsFlow):
    """Menu pre spravu globalnych nastaveni a zon."""

    def __init__(self) -> None:
        self._zones: dict[str, Any] | None = None
        self._editing_zone_id: str | None = None

    def _ensure_zones(self) -> None:
        if self._zones is None:
            self._zones = dict(self.config_entry.options.get(OPT_ZONES, {}))

    async def async_step_init(self, user_input=None):
        self._ensure_zones()
        return self.async_show_menu(
            step_id="init",
            menu_options=["global", "add_zone", "edit_zone", "remove_zone"],
        )

    async def async_step_global(self, user_input=None):
        self._ensure_zones()
        if user_input is not None:
            options = dict(self.config_entry.options)
            options.update(user_input)
            options[OPT_ZONES] = self._zones
            return self.async_create_entry(title="", data=options)

        schema = vol.Schema(_hub_schema_dict(self.config_entry.options))
        return self.async_show_form(step_id="global", data_schema=schema)

    async def async_step_add_zone(self, user_input=None):
        self._ensure_zones()
        if user_input is not None:
            zone_id = uuid.uuid4().hex[:8]
            self._zones[zone_id] = self._zone_from_input(user_input)
            return self._save()

        return self.async_show_form(step_id="add_zone", data_schema=self._zone_schema())

    async def async_step_edit_zone(self, user_input=None):
        self._ensure_zones()
        if not self._zones:
            return self.async_abort(reason="no_zones")

        if self._editing_zone_id is None:
            if user_input is not None:
                self._editing_zone_id = user_input["zone_id"]
                zone = self._zones[self._editing_zone_id]
                return self.async_show_form(step_id="edit_zone", data_schema=self._zone_schema(zone))
            options = {zid: z[CONF_ZONE_NAME] for zid, z in self._zones.items()}
            schema = vol.Schema({vol.Required("zone_id"): vol.In(options)})
            return self.async_show_form(step_id="edit_zone", data_schema=schema)

        old_zone = self._zones[self._editing_zone_id]
        updated = self._zone_from_input(user_input)
        updated = self._merge_tunables(old_zone, updated)
        self._zones[self._editing_zone_id] = updated
        self._editing_zone_id = None
        return self._save()

    async def async_step_remove_zone(self, user_input=None):
        self._ensure_zones()
        if not self._zones:
            return self.async_abort(reason="no_zones")

        if user_input is not None:
            self._zones.pop(user_input["zone_id"], None)
            return self._save()

        options = {zid: z[CONF_ZONE_NAME] for zid, z in self._zones.items()}
        schema = vol.Schema({vol.Required("zone_id"): vol.In(options)})
        return self.async_show_form(step_id="remove_zone", data_schema=schema)

    def _zone_schema(self, zone: dict | None = None) -> vol.Schema:
        zone = zone or {}
        schema_dict: dict = {
            vol.Required(CONF_ZONE_NAME, default=zone.get(CONF_ZONE_NAME, "")): str,
            vol.Required(
                CONF_ZONE_TYPE, default=zone.get(CONF_ZONE_TYPE, ZONE_TYPE_FLOOR)
            ): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=[
                        {"value": ZONE_TYPE_FLOOR, "label": "Len podlaha"},
                        {"value": ZONE_TYPE_FLOOR_AC, "label": "Klima prioritne + podlaha ako zaloha"},
                    ]
                )
            ),
            vol.Required(
                CONF_CLIMATE_ENTITY, default=zone.get(CONF_CLIMATE_ENTITY)
            ): selector.EntitySelector(selector.EntitySelectorConfig(domain="climate")),
        }
        _add_optional(
            schema_dict, CONF_AC_ENTITY, zone.get(CONF_AC_ENTITY),
            selector.EntitySelector(selector.EntitySelectorConfig(domain="climate")),
        )
        _add_optional(
            schema_dict, CONF_FLOOR_TEMP_ENTITY, zone.get(CONF_FLOOR_TEMP_ENTITY),
            selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", device_class="temperature")),
        )
        schema_dict[
            vol.Optional(CONF_PRESENCE_ENTITIES, default=zone.get(CONF_PRESENCE_ENTITIES, []))
        ] = selector.EntitySelector(selector.EntitySelectorConfig(domain="person", multiple=True))
        schema_dict[
            vol.Optional(CONF_MANUAL_PRESENCE_ENTITIES, default=zone.get(CONF_MANUAL_PRESENCE_ENTITIES, []))
        ] = selector.EntitySelector(
            selector.EntitySelectorConfig(domain=["input_boolean", "switch"], multiple=True)
        )
        schema_dict[
            vol.Optional(CONF_USE_FIREPLACE_GUARD, default=zone.get(CONF_USE_FIREPLACE_GUARD, False))
        ] = selector.BooleanSelector()
        return vol.Schema(schema_dict)

    def _zone_from_input(self, user_input: dict) -> dict:
        return {
            CONF_ZONE_NAME: user_input[CONF_ZONE_NAME],
            CONF_ZONE_TYPE: user_input.get(CONF_ZONE_TYPE, ZONE_TYPE_FLOOR),
            CONF_CLIMATE_ENTITY: user_input[CONF_CLIMATE_ENTITY],
            CONF_AC_ENTITY: user_input.get(CONF_AC_ENTITY),
            CONF_FLOOR_TEMP_ENTITY: user_input.get(CONF_FLOOR_TEMP_ENTITY),
            CONF_PRESENCE_ENTITIES: user_input.get(CONF_PRESENCE_ENTITIES, []),
            CONF_MANUAL_PRESENCE_ENTITIES: user_input.get(CONF_MANUAL_PRESENCE_ENTITIES, []),
            CONF_USE_FIREPLACE_GUARD: user_input.get(CONF_USE_FIREPLACE_GUARD, False),
        }

    @staticmethod
    def _merge_tunables(old_zone: dict, new_zone: dict) -> dict:
        """Zachova hodnoty ladiacich cisiel/casov pri uprave strukturalnych poli zony."""
        for key, (_, _, _, _, default) in {**NUMBER_DEFS, **AC_NUMBER_DEFS}.items():
            new_zone[key] = old_zone.get(key, default)
        for key, (_, default) in TIME_DEFS.items():
            new_zone[key] = old_zone.get(key, default)
        return new_zone

    def _save(self):
        options = dict(self.config_entry.options)
        options[OPT_ZONES] = self._zones
        return self.async_create_entry(title="", data=options)
