"""Climate platform - hlavny 'riadiaci' termostat per zona."""
from __future__ import annotations

from homeassistant.components.climate import ClimateEntity, ClimateEntityFeature, HVACMode
from homeassistant.components.climate.const import HVACAction
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MODE_AUTO, MODE_VYPNUTE, OPT_ZONES
from .coordinator import SmartHeatingCoordinator, mode_entity_id, number_entity_id

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
        SmartHeatingZoneClimate(coordinator, zone_id)
        for zone_id in entry.options.get(OPT_ZONES, {})
    )


class SmartHeatingZoneClimate(CoordinatorEntity[SmartHeatingCoordinator], ClimateEntity):
    """Virtualny termostat - hlavne miesto ovladania zony."""

    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_hvac_modes = [HVACMode.HEAT, HVACMode.OFF]
    _attr_supported_features = ClimateEntityFeature.TARGET_TEMPERATURE

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str) -> None:
        super().__init__(coordinator)
        self._zone_id = zone_id
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
        return HVACMode.OFF if self._zdata["mode"] == MODE_VYPNUTE else HVACMode.HEAT

    @property
    def hvac_action(self):
        return HVACAction.HEATING if self._zdata["heating_allowed"] else HVACAction.OFF

    @property
    def extra_state_attributes(self):
        z = self._zdata
        return {
            "rezim": z["mode"],
            "aktivny_podrezim": z["effective_mode"],
            "teplota_podlahy": z["floor_temperature"],
            "zdroj_kurenia": z.get("heat_source"),
            "boost_aktivny": z["boost_active"],
            "nudzova_ochrana": z["emergency_active"],
            "fve_prebytok_aktivny": z["pv_active"],
            "dovod": z["reason"],
        }

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        target_mode = MODE_VYPNUTE if hvac_mode == HVACMode.OFF else MODE_AUTO
        await self.hass.services.async_call(
            "select",
            "select_option",
            {"entity_id": mode_entity_id(self._zone_id), "option": target_mode},
            blocking=True,
        )

    async def async_set_temperature(self, **kwargs) -> None:
        temperature = kwargs.get("temperature")
        if temperature is None:
            return
        key = MODE_TO_NUMBER_KEY.get(self._zdata["effective_mode"], "teplota_den")
        await self.hass.services.async_call(
            "number",
            "set_value",
            {"entity_id": number_entity_id(self._zone_id, key), "value": temperature},
            blocking=True,
        )
