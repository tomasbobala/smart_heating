"""Coordinator - vypocitava ciele pre vsetky zony a aplikuje ich na zariadenia."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import (
    CONF_CLIMATE_ENTITY,
    CONF_FLOOR_TEMP_ENTITY,
    CONF_OUTDOOR_SENSOR,
    CONF_PRESENCE_ENTITIES,
    CONF_SCHEDULE_ENTITY,
    CONF_TARIFF_ENTITY,
    CONF_ZONE_NAME,
    DOMAIN,
    MODE_AUTO,
    MODE_KOMFORT,
    MODE_MRAZ,
    MODE_USPORA,
    MODE_VYPNUTE,
    NUMBER_DEFS,
    OPT_ZONES,
)

_LOGGER = logging.getLogger(__name__)


def mode_entity_id(zone_id: str) -> str:
    """Deterministicke entity_id select entity pre rezim zony."""
    return f"select.smart_heating_{zone_id}_rezim"


def number_entity_id(zone_id: str, key: str) -> str:
    """Deterministicke entity_id number entity pre danu hodnotu zony."""
    return f"number.smart_heating_{zone_id}_{key}"


class SmartHeatingCoordinator(DataUpdateCoordinator):
    """Sleduje relevantne entity a prepocitava/aplikuje stav kurenia (push, nie poll)."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=None)
        self.entry = entry
        self._unsub_tracking = None

    @property
    def zones(self) -> dict:
        return self.entry.options.get(OPT_ZONES, {})

    async def async_setup(self) -> None:
        """Prvotny vypocet + zaregistrovanie listenerov na zmeny stavu."""
        self.data = self._compute()
        self._track_entities()

    def _tracked_entity_ids(self) -> list[str]:
        ids: list[str] = []
        if self.entry.options.get(CONF_OUTDOOR_SENSOR):
            ids.append(self.entry.options[CONF_OUTDOOR_SENSOR])
        if self.entry.options.get(CONF_TARIFF_ENTITY):
            ids.append(self.entry.options[CONF_TARIFF_ENTITY])

        for zone_id, zone in self.zones.items():
            ids.append(zone[CONF_CLIMATE_ENTITY])
            if zone.get(CONF_FLOOR_TEMP_ENTITY):
                ids.append(zone[CONF_FLOOR_TEMP_ENTITY])
            ids.extend(zone.get(CONF_PRESENCE_ENTITIES, []))
            if zone.get(CONF_SCHEDULE_ENTITY):
                ids.append(zone[CONF_SCHEDULE_ENTITY])
            ids.append(mode_entity_id(zone_id))
            for key in NUMBER_DEFS:
                ids.append(number_entity_id(zone_id, key))
        return ids

    def _track_entities(self) -> None:
        if self._unsub_tracking:
            self._unsub_tracking()
        self._unsub_tracking = async_track_state_change_event(
            self.hass, self._tracked_entity_ids(), self._handle_state_change
        )

    @callback
    def _handle_state_change(self, event: Event) -> None:
        self.async_set_updated_data(self._compute())
        self.hass.async_create_task(self._async_apply())

    async def async_recompute_and_apply(self) -> None:
        """Verejna metoda - zavola sa z select/number entit po zmene hodnoty."""
        self.async_set_updated_data(self._compute())
        await self._async_apply()

    def _state_float(self, entity_id: str | None, default: float | None = None):
        if not entity_id:
            return default
        state = self.hass.states.get(entity_id)
        if state is None or state.state in ("unknown", "unavailable"):
            return default
        try:
            return float(state.state)
        except ValueError:
            return default

    def _compute(self) -> dict:
        outdoor = self._state_float(self.entry.options.get(CONF_OUTDOOR_SENSOR))

        tariff_entity = self.entry.options.get(CONF_TARIFF_ENTITY)
        tariff_ok = True
        if tariff_entity:
            state = self.hass.states.get(tariff_entity)
            tariff_ok = state is not None and state.state == "on"

        zones_data = {
            zone_id: self._compute_zone(zone_id, zone, tariff_ok)
            for zone_id, zone in self.zones.items()
        }

        return {"outdoor_temp": outdoor, "tariff_ok": tariff_ok, "zones": zones_data}

    def _compute_zone(self, zone_id: str, zone: dict, tariff_ok: bool) -> dict:
        climate_entity = zone[CONF_CLIMATE_ENTITY]
        climate_state = self.hass.states.get(climate_entity)
        current_temp = climate_state.attributes.get("current_temperature") if climate_state else None

        floor_temp = self._state_float(zone.get(CONF_FLOOR_TEMP_ENTITY))

        mode_state = self.hass.states.get(mode_entity_id(zone_id))
        mode = mode_state.state if mode_state and mode_state.state not in ("unknown", "unavailable") else MODE_AUTO

        komfort = self._state_float(number_entity_id(zone_id, "komfort_temp"), NUMBER_DEFS["komfort_temp"][4])
        uspora = self._state_float(number_entity_id(zone_id, "uspora_temp"), NUMBER_DEFS["uspora_temp"][4])
        mraz = self._state_float(number_entity_id(zone_id, "mraz_temp"), NUMBER_DEFS["mraz_temp"][4])
        floor_max = self._state_float(number_entity_id(zone_id, "floor_max"), NUMBER_DEFS["floor_max"][4])
        floor_min = self._state_float(number_entity_id(zone_id, "floor_min"), NUMBER_DEFS["floor_min"][4])

        presence = any(
            self.hass.states.is_state(p, "home") for p in zone.get(CONF_PRESENCE_ENTITIES, [])
        )

        schedule_entity = zone.get(CONF_SCHEDULE_ENTITY)
        schedule_active = None
        if schedule_entity:
            sched_state = self.hass.states.get(schedule_entity)
            schedule_active = sched_state is not None and sched_state.state == "on"

        target, heating_allowed, reason, effective_mode = self._resolve_mode(
            mode, komfort, uspora, mraz, presence, schedule_active
        )

        if not tariff_ok:
            heating_allowed = False
            reason += " | zablokovane tarifou"

        floor_override = False
        if floor_temp is not None and floor_max is not None and floor_temp >= floor_max:
            heating_allowed = False
            floor_override = True
            reason = f"STOP: teplota podlahy {floor_temp}\u00b0C >= max {floor_max}\u00b0C"

        return {
            "name": zone[CONF_ZONE_NAME],
            "mode": mode,
            "effective_mode": effective_mode,
            "current_temperature": current_temp,
            "target_temperature": target,
            "floor_temperature": floor_temp,
            "floor_min": floor_min,
            "floor_max": floor_max,
            "heating_allowed": heating_allowed,
            "floor_override": floor_override,
            "reason": reason,
            "climate_entity": climate_entity,
        }

    @staticmethod
    def _resolve_mode(mode, komfort, uspora, mraz, presence, schedule_active):
        """Vrati (target_temperature, heating_allowed, reason, effective_mode).

        effective_mode je skutocne aktivny pod-rezim (Komfort/Uspora/Mraz/Vypnute) -
        v Auto sa moze lisit od 'mode' (co je len raw hodnota select entity)."""
        if mode == MODE_VYPNUTE:
            return mraz, False, "Rezim Vypnute", MODE_VYPNUTE
        if mode == MODE_KOMFORT:
            return komfort, True, "Manualny rezim Komfort", MODE_KOMFORT
        if mode == MODE_USPORA:
            return uspora, True, "Manualny rezim Uspora", MODE_USPORA
        if mode == MODE_MRAZ:
            return mraz, True, "Manualny rezim Mraz (protimrazova ochrana)", MODE_MRAZ

        # MODE_AUTO
        if schedule_active is False:
            return uspora, True, "Auto: mimo harmonogramu -> Uspora", MODE_USPORA
        if presence:
            return komfort, True, "Auto: pritomnost doma -> Komfort", MODE_KOMFORT
        return uspora, True, "Auto: nikto doma -> Uspora", MODE_USPORA

    async def _async_apply(self) -> None:
        """Posle prikazy na skutocne climate zariadenia podla vypocitanych cielov."""
        for zdata in self.data["zones"].values():
            climate_entity = zdata["climate_entity"]
            state = self.hass.states.get(climate_entity)
            if state is None:
                continue

            desired_hvac = "heat" if zdata["heating_allowed"] else "off"
            if state.state != desired_hvac:
                await self.hass.services.async_call(
                    "climate",
                    "set_hvac_mode",
                    {"entity_id": climate_entity, "hvac_mode": desired_hvac},
                    blocking=False,
                )

            if zdata["heating_allowed"] and zdata["target_temperature"] is not None:
                current_target = state.attributes.get("temperature")
                if current_target != zdata["target_temperature"]:
                    await self.hass.services.async_call(
                        "climate",
                        "set_temperature",
                        {"entity_id": climate_entity, "temperature": zdata["target_temperature"]},
                        blocking=False,
                    )

    def async_unsub(self) -> None:
        """Odregistruje listenery pri unload."""
        if self._unsub_tracking:
            self._unsub_tracking()
            self._unsub_tracking = None
