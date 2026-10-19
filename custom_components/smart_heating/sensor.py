"""Sensor platform - diagnosticky stav aktualneho rozhodnutia per zona."""
from __future__ import annotations

from homeassistant.components.sensor import RestoreSensor, SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    CONF_HUMIDITY_ENTITY,
    CONF_MANUAL_PRESENCE_ENTITIES,
    CONF_OUTDOOR_HUMIDITY,
    CONF_OUTDOOR_PRESSURE,
    CONF_OUTDOOR_SENSOR,
    CONF_PRESENCE_ENTITIES,
    CONF_PV_SURPLUS_ENTITY,
    CONF_TARIFF_ENTITY,
    DOMAIN,
    OPT_ZONES,
)
from .coordinator import SmartHeatingCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: SmartHeatingCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities = []
    for zone_id, zone in entry.options.get(OPT_ZONES, {}).items():
        entities.append(ZoneReasonSensor(coordinator, zone_id, zone["name"]))
        entities.append(ZoneTemperatureSensor(coordinator, zone_id, zone["name"]))
    entities.append(PvCascadeSensor(coordinator))
    entities.append(PvEnergySensor(coordinator))
    for key in HOUSE_SOURCES:
        entities.append(HouseEnergySensor(coordinator, key))
    async_add_entities(entities)


class ZoneReasonSensor(CoordinatorEntity[SmartHeatingCoordinator], SensorEntity):
    _attr_icon = "mdi:information-outline"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    # Konfiguracia (zoznamy entit) sa nemeni - netreba ju ukladat do historie pri
    # kazdej zmene dovodu. Karty ju citaju zo stavu, nie z historie.
    _unrecorded_attributes = frozenset({
        "zone_id", "config_entry_id", "zone_type", "radiator_entity", "floor_max",
        "power_entities", "energy_entities", "sources", "outdoor_entity", "tariff_entity",
        "pv_surplus_entity", "presence_entities", "manual_presence_entities",
        "outdoor_humidity_entity", "outdoor_pressure_entity", "humidity_entity",
    })

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        super().__init__(coordinator)
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_stav"
        self.entity_id = f"sensor.smart_heating_{zone_id}_stav"
        self._attr_name = f"{zone_name} stav kurenia"

    def _all_meters(self, kind: str) -> list[str]:
        out: list[str] = []
        for src in self.coordinator._zone_sources(self.coordinator.zones.get(self._zone_id, {})):
            for entity_id in src[kind]:
                if entity_id not in out:
                    out.append(entity_id)
        return out

    @property
    def native_value(self):
        return self.coordinator.data["zones"][self._zone_id]["reason"]

    @property
    def extra_state_attributes(self):
        z = self.coordinator.data["zones"][self._zone_id]
        zone_conf = self.coordinator.zones.get(self._zone_id, {})
        return {
            "zone_id": self._zone_id,
            "season": z["season"],
            "release_control": z["release_control"],
            "floor_temperature": z["floor_temperature"],
            "outdoor_temperature": z["outdoor_temperature"],
            "cold_outdoor_active": z["cold_outdoor_active"],
            "floor_override": z["floor_override"],
            "floor_sensor_lost": z.get("floor_sensor_lost", False),
            "krb_override": z["krb_override"],
            "tariff_blocked": z["tariff_blocked"],
            "emergency_active": z["emergency_active"],
            "pv_active": z["pv_active"],
            "boost_active": z["boost_active"],
            "heating_allowed": z["heating_allowed"],
            "zdroj_kurenia": z.get("heat_source"),
            "zone_type": z.get("zone_type"),
            "floor_guard": z.get("floor_guard", False),
            # kaskada FVE: priorita zony a ci prave caka na nahriatie vyssich priorit
            "fve_priorita": z.get("pv_priority", 1),
            "fve_caka": z.get("pv_waiting", False),
            "floor_max": z.get("floor_max"),
            "radiator_entity": z.get("radiator_entity"),
            # diagnostika: zoznam aktualnych poruch (prazdny = v poriadku)
            "problemy": z.get("problems", []),
            # logovanie nabehov - median minut na 1 °C a pocet zaznamenanych nabehov
            "nabeh_min_na_stupen": z.get("warmup_rate"),
            "nabehy_pocet": z.get("warmup_count", 0),
            # pre prehladovu kartu (nastavenia integracie cez options flow)
            "config_entry_id": self.coordinator.entry.entry_id,
            # spotreba zony: karty z nich citaju prikon a statistiky energie
            # vsetky merace zony (zdroje + ostatne, bez duplicit) a rozpad po zdrojoch
            "power_entities": self._all_meters("power"),
            "energy_entities": self._all_meters("energy"),
            "sources": [
                {"key": src["key"], "power": src["power"], "energy": src["energy"]}
                for src in self.coordinator._zone_sources(self.coordinator.zones.get(self._zone_id, {}))
            ],
            "meter_problems": z.get("meter_problems", []),
            # pre prehladovu kartu - aby nepotrebovala vlastnu konfiguraciu
            "outdoor_entity": self.coordinator.entry.options.get(CONF_OUTDOOR_SENSOR),
            "outdoor_humidity_entity": self.coordinator.entry.options.get(CONF_OUTDOOR_HUMIDITY),
            "outdoor_pressure_entity": self.coordinator.entry.options.get(CONF_OUTDOOR_PRESSURE),
            # vlhkost - len sledovanie
            "humidity_entity": zone_conf.get(CONF_HUMIDITY_ENTITY),
            "humidity": z.get("humidity"),
            "felt_temperature": z.get("felt_temperature"),
            "dew_point": z.get("dew_point"),
            "ventilation": z.get("ventilation"),
            "humidity_alert": z.get("humidity_alert"),
            "tariff_entity": self.coordinator.entry.options.get(CONF_TARIFF_ENTITY),
            "pv_surplus_entity": self.coordinator.entry.options.get(CONF_PV_SURPLUS_ENTITY),
            "presence_entities": list(zone_conf.get(CONF_PRESENCE_ENTITIES, [])),
            "manual_presence_entities": list(zone_conf.get(CONF_MANUAL_PRESENCE_ENTITIES, [])),
        }


class ZoneTemperatureSensor(CoordinatorEntity[SmartHeatingCoordinator], SensorEntity):
    """Teplota v zone (ta ista, z ktorej integracia rozhoduje - externy teplomer
    alebo vstavany senzor termostatu).

    Vdaka state_class=measurement z nej Home Assistant sam pocita kratkodobe
    statistiky (priemer/min/max kazdych 5 minut). Karta z nich cita priemer za
    24 h a min/max za 48 h - lacny dotaz namiesto stahovania celej historie."""

    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_suggested_display_precision = 1

    def __init__(self, coordinator: SmartHeatingCoordinator, zone_id: str, zone_name: str) -> None:
        super().__init__(coordinator)
        self._zone_id = zone_id
        self._attr_unique_id = f"{DOMAIN}_{zone_id}_teplota"
        self.entity_id = f"sensor.smart_heating_{zone_id}_teplota"
        self._attr_name = f"{zone_name} teplota"

    @property
    def native_value(self):
        value = self.coordinator.data["zones"][self._zone_id].get("current_temperature")
        try:
            return round(float(value), 2) if value is not None else None
        except (TypeError, ValueError):
            return None


class PvCascadeSensor(CoordinatorEntity[SmartHeatingCoordinator], SensorEntity):
    """Kaskada FVE prebytku pre celu integraciu: stav = najnizsia priorita, ktora
    smie kurit z prebytku (0 = ziadna). Atributy ukazuju vykony a co sa chysta."""

    _attr_icon = "mdi:solar-power-variant"
    # Vykony a odpocty sa menia kazdych 30 s - v historii by len nafukovali databazu
    # (vykony FVE sa ukladaju aj tak v senzoroch stridaca).
    _unrecorded_attributes = frozenset({
        "pridanie_za_min", "odobratie_za_min", "vyroba_w", "export_w", "odber_w",
        "bateria_w", "soc", "prebytok_w",
    })

    def __init__(self, coordinator: SmartHeatingCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{DOMAIN}_{coordinator.entry.entry_id}_fve_kaskada"
        self.entity_id = "sensor.smart_heating_fve_kaskada"
        self._attr_name = "Smart Heating FVE kaskada"

    @property
    def _snap(self) -> dict:
        data = self.coordinator.data if isinstance(self.coordinator.data, dict) else {}
        return data.get("pv_engine") or {}

    @property
    def native_value(self):
        return self._snap.get("tier", 0)

    @property
    def extra_state_attributes(self):
        snap = self._snap
        return {
            "rezim": "vykon" if snap.get("mode") == "power" else "prepinac",
            "dovod": snap.get("reason"),
            "pridanie_za_min": snap.get("add_in_min"),
            "odobratie_za_min": snap.get("shed_in_min"),
            "vyroba_w": snap.get("pv"),
            "export_w": snap.get("export"),
            "odber_w": snap.get("import"),
            "bateria_w": snap.get("battery"),
            "soc": snap.get("soc"),
            "prebytok_w": snap.get("available"),
        }


class PvEnergySensor(CoordinatorEntity[SmartHeatingCoordinator], RestoreSensor):
    """Energia kurenia odobrata v case, ked zony kurili z FVE prebytku (z meracov
    prikonu, kazdych 30 s). Kumulativna - HA z nej pocita denne statistiky pre
    'podiel z FVE' v prehladovej karte."""

    _attr_device_class = SensorDeviceClass.ENERGY
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "kWh"
    _attr_suggested_display_precision = 2
    _attr_icon = "mdi:solar-power-variant"

    def __init__(self, coordinator: SmartHeatingCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{DOMAIN}_{coordinator.entry.entry_id}_energia_z_fve"
        self.entity_id = "sensor.smart_heating_energia_z_fve"
        self._attr_name = "Smart Heating energia z FVE"

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_sensor_data()
        if last is not None and last.native_value is not None:
            try:
                self.coordinator._pv_energy_kwh = max(self.coordinator._pv_energy_kwh, float(last.native_value))
            except (TypeError, ValueError):
                pass

    @property
    def native_value(self):
        return round(self.coordinator._pv_energy_kwh, 3)


HOUSE_SOURCES = {
    # kluc: (entity_id suffix, nazov, ikona)
    "siet": ("energia_domu_zo_siete", "Smart Heating energia domu zo siete", "mdi:transmission-tower-import"),
    "fve": ("energia_domu_z_fve", "Smart Heating energia domu z FVE", "mdi:solar-power"),
    "bateria": ("energia_domu_z_baterie", "Smart Heating energia domu z batérie", "mdi:home-battery"),
}


class HouseEnergySensor(CoordinatorEntity[SmartHeatingCoordinator], RestoreSensor):
    """Spotreba domu podla zdroja (siet / FVE priamo / bateria), integrovana z
    okamzitych tokov kazdych 30 s. Prehladova karta z ich hodinovych statistik
    rozdeli spotrebu kurenia - funguje aj pre zdroje, ktore maju len merac energie
    (napr. klima bez meraca prikonu)."""

    _attr_device_class = SensorDeviceClass.ENERGY
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "kWh"
    _attr_suggested_display_precision = 2

    def __init__(self, coordinator: SmartHeatingCoordinator, key: str) -> None:
        super().__init__(coordinator)
        suffix, name, icon = HOUSE_SOURCES[key]
        self._key = key
        self._attr_unique_id = f"{DOMAIN}_{coordinator.entry.entry_id}_{suffix}"
        self.entity_id = f"sensor.smart_heating_{suffix}"
        self._attr_name = name
        self._attr_icon = icon

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_sensor_data()
        if last is not None and last.native_value is not None:
            try:
                store = self.coordinator._house_energy_kwh
                store[self._key] = max(store[self._key], float(last.native_value))
            except (TypeError, ValueError):
                pass

    @property
    def native_value(self):
        return round(self.coordinator._house_energy_kwh[self._key], 3)
