"""Config flow pre Smart Heating."""
from __future__ import annotations

import uuid
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_CLIMATE_ENTITY,
    CONF_FLOOR_TEMP_ENTITY,
    CONF_OUTDOOR_SENSOR,
    CONF_PRESENCE_ENTITIES,
    CONF_SCHEDULE_ENTITY,
    CONF_TARIFF_ENTITY,
    CONF_ZONE_NAME,
    CONF_ZONE_TYPE,
    DOMAIN,
    NUMBER_DEFS,
    OPT_ZONES,
    ZONE_TYPE_FLOOR,
)


class SmartHeatingConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Prvotne zalozenie hubu (jeden na instanciu HA)."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="Smart Heating",
                data={},
                options={
                    CONF_OUTDOOR_SENSOR: user_input.get(CONF_OUTDOOR_SENSOR),
                    CONF_TARIFF_ENTITY: user_input.get(CONF_TARIFF_ENTITY),
                    OPT_ZONES: {},
                },
            )

        schema = vol.Schema(
            {
                vol.Optional(CONF_OUTDOOR_SENSOR): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="sensor", device_class="temperature")
                ),
                vol.Optional(CONF_TARIFF_ENTITY): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["input_boolean", "switch", "binary_sensor"]
                    )
                ),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return SmartHeatingOptionsFlow(config_entry)


class SmartHeatingOptionsFlow(config_entries.OptionsFlow):
    """Menu pre spravu globalnych nastaveni a zon (pridat/upravit/zmazat)."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry
        self._zones: dict[str, Any] = dict(config_entry.options.get(OPT_ZONES, {}))
        self._editing_zone_id: str | None = None

    async def async_step_init(self, user_input=None):
        return self.async_show_menu(
            step_id="init",
            menu_options=["global", "add_zone", "edit_zone", "remove_zone"],
        )

    async def async_step_global(self, user_input=None):
        if user_input is not None:
            options = dict(self.config_entry.options)
            options[CONF_OUTDOOR_SENSOR] = user_input.get(CONF_OUTDOOR_SENSOR)
            options[CONF_TARIFF_ENTITY] = user_input.get(CONF_TARIFF_ENTITY)
            options[OPT_ZONES] = self._zones
            return self.async_create_entry(title="", data=options)

        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_OUTDOOR_SENSOR,
                    default=self.config_entry.options.get(CONF_OUTDOOR_SENSOR),
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="sensor", device_class="temperature")
                ),
                vol.Optional(
                    CONF_TARIFF_ENTITY,
                    default=self.config_entry.options.get(CONF_TARIFF_ENTITY),
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["input_boolean", "switch", "binary_sensor"]
                    )
                ),
            }
        )
        return self.async_show_form(step_id="global", data_schema=schema)

    async def async_step_add_zone(self, user_input=None):
        if user_input is not None:
            zone_id = uuid.uuid4().hex[:8]
            self._zones[zone_id] = self._zone_from_input(user_input)
            return self._save()

        return self.async_show_form(step_id="add_zone", data_schema=self._zone_schema())

    async def async_step_edit_zone(self, user_input=None):
        if not self._zones:
            return self.async_abort(reason="no_zones")

        if self._editing_zone_id is None:
            if user_input is not None:
                self._editing_zone_id = user_input["zone_id"]
                zone = self._zones[self._editing_zone_id]
                return self.async_show_form(
                    step_id="edit_zone", data_schema=self._zone_schema(zone)
                )
            options = {zid: z[CONF_ZONE_NAME] for zid, z in self._zones.items()}
            schema = vol.Schema({vol.Required("zone_id"): vol.In(options)})
            return self.async_show_form(step_id="edit_zone", data_schema=schema)

        # druhy prechod - ulozenie upravenej zony
        zone = self._zones[self._editing_zone_id]
        updated = self._zone_from_input(user_input)
        updated["komfort_temp"] = zone.get("komfort_temp", NUMBER_DEFS["komfort_temp"][4])
        updated["uspora_temp"] = zone.get("uspora_temp", NUMBER_DEFS["uspora_temp"][4])
        updated["mraz_temp"] = zone.get("mraz_temp", NUMBER_DEFS["mraz_temp"][4])
        updated["floor_min"] = zone.get("floor_min", NUMBER_DEFS["floor_min"][4])
        updated["floor_max"] = zone.get("floor_max", NUMBER_DEFS["floor_max"][4])
        self._zones[self._editing_zone_id] = updated
        self._editing_zone_id = None
        return self._save()

    async def async_step_remove_zone(self, user_input=None):
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
        return vol.Schema(
            {
                vol.Required(CONF_ZONE_NAME, default=zone.get(CONF_ZONE_NAME, "")): str,
                vol.Required(
                    CONF_CLIMATE_ENTITY, default=zone.get(CONF_CLIMATE_ENTITY)
                ): selector.EntitySelector(selector.EntitySelectorConfig(domain="climate")),
                vol.Optional(
                    CONF_FLOOR_TEMP_ENTITY, default=zone.get(CONF_FLOOR_TEMP_ENTITY)
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="sensor", device_class="temperature")
                ),
                vol.Optional(
                    CONF_PRESENCE_ENTITIES, default=zone.get(CONF_PRESENCE_ENTITIES, [])
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="person", multiple=True)
                ),
                vol.Optional(
                    CONF_SCHEDULE_ENTITY, default=zone.get(CONF_SCHEDULE_ENTITY)
                ): selector.EntitySelector(selector.EntitySelectorConfig(domain="schedule")),
            }
        )

    def _zone_from_input(self, user_input: dict) -> dict:
        return {
            CONF_ZONE_NAME: user_input[CONF_ZONE_NAME],
            CONF_ZONE_TYPE: ZONE_TYPE_FLOOR,
            CONF_CLIMATE_ENTITY: user_input[CONF_CLIMATE_ENTITY],
            CONF_FLOOR_TEMP_ENTITY: user_input.get(CONF_FLOOR_TEMP_ENTITY),
            CONF_PRESENCE_ENTITIES: user_input.get(CONF_PRESENCE_ENTITIES, []),
            CONF_SCHEDULE_ENTITY: user_input.get(CONF_SCHEDULE_ENTITY),
            "komfort_temp": NUMBER_DEFS["komfort_temp"][4],
            "uspora_temp": NUMBER_DEFS["uspora_temp"][4],
            "mraz_temp": NUMBER_DEFS["mraz_temp"][4],
            "floor_min": NUMBER_DEFS["floor_min"][4],
            "floor_max": NUMBER_DEFS["floor_max"][4],
        }

    def _save(self):
        options = dict(self.config_entry.options)
        options[OPT_ZONES] = self._zones
        return self.async_create_entry(title="", data=options)
