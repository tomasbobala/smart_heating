"""Climate platform - hlavny 'riadiaci' termostat per zona (kurenie aj chladenie)."""
from __future__ import annotations

from homeassistant.components.climate import (
    ClimateEntity,
    ClimateEntityFeature,
    HVACAction,
    HVACMode,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    CONF_ZONE_TYPE,
    DOMAIN,
    MODE_AUTO,
    MODE_VYPNUTE,
    OPT_ZONES,
    SEASON_CHLADENIE,
    SEASON_KURENIE,
    ZONE_TYPE_FLOOR_AC,
)
from .coordinator import SmartHeatingCoordinator, mode_entity_id, number_entity_id, season_entity_id

MODE_TO_NUMBER_KEY = {
    "Den": "teplota_den",
    "Noc": "teplota_noc",
    "Min": "teplota_min",
    "Mraz": "teplota_mraz",
    "Vypnute": "teplota_mraz",
}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        SmartHeatingZoneClimate(coordinator, zone_id, entry.options[OPT_ZONES][zone_id])
        for zone_id in entry.options.get(OPT_ZONES, {})
    )


class SmartHeatingZoneClimate(CoordinatorEntity[SmartHeatingCoordinator], ClimateEntity):
    """Virtualny termostat - hlavne miesto ovladania zony."""

    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_supported_features = ClimateEntityFeature.TARGET_TEMPERATURE

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_conf: dict) -> None:
        super().__init__(coordinator)
        self._zone_id = zone_id
        self._is_floor_ac = zone_conf.get(CONF_ZONE_TYPE) == ZONE_TYPE_FLOOR_AC
        self._attr_hvac_modes = (
            [HVACMode.HEAT, HVACMode.COOL, HVACMode.OFF] if self._is_floor_ac else [HVACMode.HEAT, HVACMode.OFF]
        )
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_climate"
        self.entity_id = f"climate.smart_heating_{zone_id}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, zone_id)},
            "name": coordinator.zones[zone_id]["name"],
            "manufacturer": "Smart Heating",
        }

    @property
    def _zdata(self) -> dict:
        return self.coordinator.data["zones"][self._zone_id]

    @property
    def name(self) -> str:
        return self._zdata["name"]

    @property
    def current_temperature(self):
        return self._zdata["current_temperature"]

    @property
    def target_temperature(self):
        return self._zdata["target_temperature"]

    @property
    def hvac_mode(self) -> HVACMode:
        device_mode = self._zdata.get("device_mode", "off")
        if self._zdata["mode"] == MODE_VYPNUTE:
            return HVACMode.OFF
        if device_mode == "cool":
            return HVACMode.COOL
        return HVACMode.HEAT

    @property
    def hvac_action(self):
        device_mode = self._zdata.get("device_mode", "off")
        if device_mode == "cool":
            return HVACAction.COOLING
        if device_mode == "heat":
            return HVACAction.HEATING
        return HVACAction.OFF

    @property
    def extra_state_attributes(self):
        z = self._zdata
        return {
            "rezim": z["mode"],
            "sezona": z["season"],
            "aktivny_podrezim": z["effective_mode"],
            "zone_type": z["zone_type"],
            "teplota_podlahy": z["floor_temperature"],
            "vonkajsia_teplota": z["outdoor_temperature"],
            "zdroj_kurenia": z.get("heat_source"),
            "boost_aktivny": z["boost_active"],
            "nudzova_ochrana": z["emergency_active"],
            "fve_prebytok_aktivny": z["pv_active"],
            "dovod": z["reason"],
        }

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        if hvac_mode == HVACMode.OFF:
            await self.hass.services.async_call(
                "select", "select_option",
                {"entity_id": mode_entity_id(self._zone_id), "option": MODE_VYPNUTE},
                blocking=True,
            )
            return

        # Prepnutie na Heat/Cool priamo z karty zaroven prepne aj rezim (z Vypnute na Auto)
        if self._zdata["mode"] == MODE_VYPNUTE:
            await self.hass.services.async_call(
                "select", "select_option",
                {"entity_id": mode_entity_id(self._zone_id), "option": MODE_AUTO},
                blocking=True,
            )

        if self._is_floor_ac:
            season = SEASON_CHLADENIE if hvac_mode == HVACMode.COOL else SEASON_KURENIE
            await self.hass.services.async_call(
                "select", "select_option",
                {"entity_id": season_entity_id(self._zone_id), "option": season},
                blocking=True,
            )

    async def async_set_temperature(self, **kwargs) -> None:
        temperature = kwargs.get("temperature")
        if temperature is None:
            return
        if self._zdata["season"] == SEASON_CHLADENIE:
            key = "teplota_chladenie"
        else:
            key = MODE_TO_NUMBER_KEY.get(self._zdata["effective_mode"], "teplota_den")
        await self.hass.services.async_call(
            "number",
            "set_value",
            {"entity_id": number_entity_id(self._zone_id, key), "value": temperature},
            blocking=True,
        )
