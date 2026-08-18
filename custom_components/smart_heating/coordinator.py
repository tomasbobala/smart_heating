"""Coordinator - centralna rozhodovacia logika Smart Heating v2."""
from __future__ import annotations

import logging
from datetime import datetime, time as dt_time, timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import (
    AC_NUMBER_DEFS,
    CONF_AC_ENTITY,
    CONF_CLIMATE_ENTITY,
    CONF_FIREPLACE_BURNING_ENTITY,
    CONF_FIREPLACE_TEMP_ENTITY,
    CONF_FLOOR_TEMP_ENTITY,
    CONF_MANUAL_PRESENCE_ENTITIES,
    CONF_NOTIFY_ENTITY,
    CONF_OUTDOOR_SENSOR,
    CONF_PRESENCE_ENTITIES,
    CONF_PV_SURPLUS_ENTITY,
    CONF_TARIFF_ENTITY,
    CONF_USE_FIREPLACE_GUARD,
    CONF_ZONE_NAME,
    CONF_ZONE_TYPE,
    DOMAIN,
    HUB_NUMBER_DEFS,
    MODE_AUTO,
    MODE_DEN,
    MODE_MIN,
    MODE_MRAZ,
    MODE_NOC,
    MODE_VYPNUTE,
    NUMBER_DEFS,
    OPT_ZONES,
    SWITCH_DEFS,
    TIME_DEFS,
    ZONE_TYPE_FLOOR_AC,
)

_LOGGER = logging.getLogger(__name__)

RECOMPUTE_INTERVAL = timedelta(minutes=5)


def mode_entity_id(zone_id: str) -> str:
    return f"select.smart_heating_{zone_id}_rezim"


def number_entity_id(zone_id: str, key: str) -> str:
    return f"number.smart_heating_{zone_id}_{key}"


def time_entity_id(zone_id: str, key: str) -> str:
    return f"time.smart_heating_{zone_id}_{key}"


def switch_entity_id(zone_id: str, key: str) -> str:
    return f"switch.smart_heating_{zone_id}_{key}"


def hub_number_entity_id(key: str) -> str:
    return f"number.smart_heating_{key}"


HUB_SWITCH_NEPRITOMNOST = "switch.smart_heating_nepritomnost"


def _time_in_range(now_t: dt_time, start_t: dt_time, end_t: dt_time) -> bool:
    """True ak now_t lezi v intervale <start_t, end_t), s podporou prechodu cez polnoc."""
    if start_t <= end_t:
        return start_t <= now_t < end_t
    return now_t >= start_t or now_t < end_t


class SmartHeatingCoordinator(DataUpdateCoordinator):
    """Sleduje relevantne entity a prepocitava/aplikuje stav kurenia (push + 5min tick)."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=None)
        self.entry = entry
        self._unsub_tracking = None
        self._unsub_interval = None
        self._unsub_debounce = None
        # runtime stav, ktory neprezije restart HA (zamerne - boost/deficit su kratkodobe)
        self._runtime: dict[str, dict] = {}

    @property
    def zones(self) -> dict:
        return self.entry.options.get(OPT_ZONES, {})

    def _rt(self, zone_id: str) -> dict:
        return self._runtime.setdefault(
            zone_id, {"boost_until": None, "ac_deficit_since": None, "flags": set()}
        )

    async def async_setup(self) -> None:
        self.data = self._compute()
        self._track_entities()
        self._unsub_interval = async_track_time_interval(
            self.hass, self._periodic_tick, RECOMPUTE_INTERVAL
        )

    def _tracked_entity_ids(self) -> list[str]:
        ids: list[str] = []
        opt = self.entry.options
        for key in (CONF_OUTDOOR_SENSOR, CONF_TARIFF_ENTITY, CONF_FIREPLACE_BURNING_ENTITY, CONF_FIREPLACE_TEMP_ENTITY, CONF_PV_SURPLUS_ENTITY):
            if opt.get(key):
                ids.append(opt[key])
        ids.append(HUB_SWITCH_NEPRITOMNOST)
        for key in HUB_NUMBER_DEFS:
            ids.append(hub_number_entity_id(key))

        for zone_id, zone in self.zones.items():
            ids.append(zone[CONF_CLIMATE_ENTITY])
            if zone.get(CONF_AC_ENTITY):
                ids.append(zone[CONF_AC_ENTITY])
            if zone.get(CONF_FLOOR_TEMP_ENTITY):
                ids.append(zone[CONF_FLOOR_TEMP_ENTITY])
            ids.extend(zone.get(CONF_PRESENCE_ENTITIES, []))
            ids.extend(zone.get(CONF_MANUAL_PRESENCE_ENTITIES, []))
            ids.append(mode_entity_id(zone_id))
            for key in NUMBER_DEFS:
                ids.append(number_entity_id(zone_id, key))
            if zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_FLOOR_AC:
                for key in AC_NUMBER_DEFS:
                    ids.append(number_entity_id(zone_id, key))
            for key in TIME_DEFS:
                ids.append(time_entity_id(zone_id, key))
            for key in SWITCH_DEFS:
                ids.append(switch_entity_id(zone_id, key))
        return ids

    def _track_entities(self) -> None:
        if self._unsub_tracking:
            self._unsub_tracking()
        self._unsub_tracking = async_track_state_change_event(
            self.hass, self._tracked_entity_ids(), self._handle_state_change
        )

    @callback
    def _handle_state_change(self, event: Event) -> None:
        # Debounce: rychlo po sebe iduce zmeny (napr. termostat hlasi teplotu kazdych
        # par sekund) zluc do JEDNEHO prepoctu namiesto prepoctu vsetkych zon pri
        # kazdej jednotlivej zmene - zbytocne casty prepocet zatazoval cely system.
        if self._unsub_debounce:
            self._unsub_debounce()
        self._unsub_debounce = async_call_later(self.hass, 2.0, self._debounced_recompute)

    @callback
    def _debounced_recompute(self, _now) -> None:
        self._unsub_debounce = None
        self.async_set_updated_data(self._compute())
        self.hass.async_create_task(self._async_apply())

    @callback
    def _periodic_tick(self, now) -> None:
        """Casovo zavisle veci (den/noc hranica, predkurenie okno, boost timeout) sa
        nemusia prejavit ako zmena stavu ziadnej sledovanej entity - preto tento tick."""
        self.async_set_updated_data(self._compute())
        self.hass.async_create_task(self._async_apply())

    async def async_recompute_and_apply(self) -> None:
        self.async_set_updated_data(self._compute())
        await self._async_apply()

    async def async_activate_boost(self, zone_id: str) -> None:
        hours = self._state_float(number_entity_id(zone_id, "boost_hodiny"), 2.0)
        rt = self._rt(zone_id)
        rt["boost_until"] = dt_util.now() + timedelta(hours=hours)
        zone_name = self.zones.get(zone_id, {}).get(CONF_ZONE_NAME, zone_id)
        await self._notify(f"Boost aktivovany v zone {zone_name} na {hours} h.")
        await self.async_recompute_and_apply()

    # ---------------------------------------------------------------- stav helpers

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

    def _state_time(self, entity_id: str, default: str) -> dt_time:
        state = self.hass.states.get(entity_id)
        raw = state.state if state and state.state not in ("unknown", "unavailable") else default
        try:
            return dt_time.fromisoformat(raw)
        except ValueError:
            return dt_time.fromisoformat(default)

    def _state_bool(self, entity_id: str | None, default: bool = False) -> bool:
        if not entity_id:
            return default
        state = self.hass.states.get(entity_id)
        if state is None or state.state in ("unknown", "unavailable"):
            return default
        return state.state == "on"

    # ---------------------------------------------------------------- vypocet

    def _compute(self) -> dict:
        opt = self.entry.options
        outdoor = self._state_float(opt.get(CONF_OUTDOOR_SENSOR))

        tariff_entity = opt.get(CONF_TARIFF_ENTITY)
        tariff_ok = True
        if tariff_entity:
            state = self.hass.states.get(tariff_entity)
            tariff_ok = state is not None and state.state == "on"

        holiday_active = self._state_bool(HUB_SWITCH_NEPRITOMNOST, False)
        emergency_temp = self._state_float(hub_number_entity_id("nudzova_teplota"), HUB_NUMBER_DEFS["nudzova_teplota"][4])
        krb_threshold = self._state_float(hub_number_entity_id("krb_threshold"), HUB_NUMBER_DEFS["krb_threshold"][4])
        fireplace_burning = self._state_bool(opt.get(CONF_FIREPLACE_BURNING_ENTITY), False)
        fireplace_temp = self._state_float(opt.get(CONF_FIREPLACE_TEMP_ENTITY))
        pv_surplus = self._state_bool(opt.get(CONF_PV_SURPLUS_ENTITY), False)

        now_t = dt_util.now().time()
        weekday = dt_util.now().weekday()  # 0=Po ... 6=Ne

        zones_data = {
            zone_id: self._compute_zone(
                zone_id, zone, tariff_ok, holiday_active, emergency_temp,
                krb_threshold, fireplace_burning, fireplace_temp, pv_surplus, now_t, weekday,
            )
            for zone_id, zone in self.zones.items()
        }

        return {
            "outdoor_temp": outdoor,
            "tariff_ok": tariff_ok,
            "holiday_active": holiday_active,
            "zones": zones_data,
        }

    def _compute_zone(
        self, zone_id, zone, tariff_ok, holiday_active, emergency_temp,
        krb_threshold, fireplace_burning, fireplace_temp, pv_surplus, now_t, weekday,
    ) -> dict:
        climate_entity = zone[CONF_CLIMATE_ENTITY]
        climate_state = self.hass.states.get(climate_entity)
        current_temp = climate_state.attributes.get("current_temperature") if climate_state else None

        floor_temp = self._state_float(zone.get(CONF_FLOOR_TEMP_ENTITY))
        floor_min = self._state_float(number_entity_id(zone_id, "floor_min"), NUMBER_DEFS["floor_min"][4])
        floor_max = self._state_float(number_entity_id(zone_id, "floor_max"), NUMBER_DEFS["floor_max"][4])

        mode_state = self.hass.states.get(mode_entity_id(zone_id))
        mode = mode_state.state if mode_state and mode_state.state not in ("unknown", "unavailable") else MODE_AUTO

        den = self._state_float(number_entity_id(zone_id, "teplota_den"), NUMBER_DEFS["teplota_den"][4])
        noc = self._state_float(number_entity_id(zone_id, "teplota_noc"), NUMBER_DEFS["teplota_noc"][4])
        min_temp = self._state_float(number_entity_id(zone_id, "teplota_min"), NUMBER_DEFS["teplota_min"][4])
        mraz = self._state_float(number_entity_id(zone_id, "teplota_mraz"), NUMBER_DEFS["teplota_mraz"][4])

        is_weekend = weekday >= 5  # 5=So, 6=Ne
        den_od_key = "den_od_vikend" if is_weekend else "den_od_tyzden"
        noc_od_key = "noc_od_vikend" if is_weekend else "noc_od_tyzden"
        den_od = self._state_time(time_entity_id(zone_id, den_od_key), TIME_DEFS[den_od_key][1])
        noc_od = self._state_time(time_entity_id(zone_id, noc_od_key), TIME_DEFS[noc_od_key][1])
        is_day = _time_in_range(now_t, den_od, noc_od)
        comfort_target = den if is_day else noc
        comfort_mode = MODE_DEN if is_day else MODE_NOC

        presence = any(
            self.hass.states.is_state(p, "home") for p in zone.get(CONF_PRESENCE_ENTITIES, [])
        ) or any(
            self.hass.states.is_state(p, "on") for p in zone.get(CONF_MANUAL_PRESENCE_ENTITIES, [])
        )

        predkurenie_povolene = self._state_bool(switch_entity_id(zone_id, "predkurenie_povolene"), True)
        predkurenie_od = self._state_time(time_entity_id(zone_id, "predkurenie_od"), TIME_DEFS["predkurenie_od"][1])
        predkurenie_do = self._state_time(time_entity_id(zone_id, "predkurenie_do"), TIME_DEFS["predkurenie_do"][1])
        preheat_active = (
            predkurenie_povolene and weekday < 5 and _time_in_range(now_t, predkurenie_od, predkurenie_do)
        )

        rt = self._rt(zone_id)
        boost_until = rt.get("boost_until")
        boost_active = boost_until is not None and dt_util.now() < boost_until
        if boost_until is not None and not boost_active:
            rt["boost_until"] = None  # boost prave vypr¸¸sal

        # --- 4/5: manualny rezim / auto (bez bezpecnostnych vrstiev) ---
        target, heating_allowed, reason, effective_mode = self._resolve_target(
            mode, den, noc, min_temp, mraz, comfort_target, comfort_mode,
            presence, preheat_active, holiday_active, boost_active,
        )

        # --- 1: TARIFA ---
        tariff_blocked = False
        if not tariff_ok:
            heating_allowed = False
            tariff_blocked = True
            reason = "Zablokovane tarifou (vysoka tarifa)"

        # --- 2: BEZPECNOST PODLAHY ---
        floor_override = False
        if floor_temp is not None and floor_max is not None and floor_temp >= floor_max:
            heating_allowed = False
            floor_override = True
            reason = f"STOP: teplota podlahy {floor_temp}\u00b0C >= max {floor_max}\u00b0C"

        # --- 3: KRB ---
        krb_override = False
        use_krb = self._state_bool(switch_entity_id(zone_id, "reaguj_na_krb"), zone.get(CONF_USE_FIREPLACE_GUARD, False))
        if (
            use_krb and fireplace_burning and fireplace_temp is not None
            and krb_threshold is not None and fireplace_temp >= krb_threshold
        ):
            heating_allowed = False
            krb_override = True
            reason = f"STOP: krb hori, teplota pri krbe {fireplace_temp}\u00b0C >= {krb_threshold}\u00b0C"

        # --- 0.5: FVE PREBYTOK (preraza TARIFU, nie floor/krb) ---
        pv_active = False
        use_fve = self._state_bool(switch_entity_id(zone_id, "vyuzi_fve_prebytok"), True)
        if pv_surplus and use_fve and not floor_override and not krb_override:
            heating_allowed = True
            target = comfort_target
            effective_mode = comfort_mode
            reason = "FVE prebytok - kurenie pre maximalne vyuzitie solarnej energie"
            pv_active = True

        # --- 0: NUDZOVA OCHRANA (prerazi TARIFU, nie floor/krb) ---
        emergency_active = False
        if (
            current_temp is not None and emergency_temp is not None and current_temp < emergency_temp
            and not floor_override and not krb_override
        ):
            heating_allowed = True
            target = max(target or 0, emergency_temp + 1)
            reason = f"NUDZOVA OCHRANA: {current_temp}\u00b0C < {emergency_temp}\u00b0C (preraza tarifu)"
            emergency_active = True

        self._maybe_notify(zone_id, zone[CONF_ZONE_NAME], mode, {
            "tariff": tariff_blocked,
            "floor": floor_override,
            "krb": krb_override,
            "emergency": emergency_active,
            "boost": boost_active,
        })

        return {
            "name": zone[CONF_ZONE_NAME],
            "zone_type": zone.get(CONF_ZONE_TYPE, "floor"),
            "mode": mode,
            "effective_mode": effective_mode,
            "current_temperature": current_temp,
            "target_temperature": target,
            "floor_temperature": floor_temp,
            "floor_min": floor_min,
            "floor_max": floor_max,
            "heating_allowed": heating_allowed,
            "floor_override": floor_override,
            "krb_override": krb_override,
            "emergency_active": emergency_active,
            "pv_active": pv_active,
            "tariff_blocked": tariff_blocked,
            "boost_active": boost_active,
            "reason": reason,
            "climate_entity": climate_entity,
            "ac_entity": zone.get(CONF_AC_ENTITY),
            "is_day": is_day,
        }

    @staticmethod
    def _resolve_target(
        mode, den, noc, min_temp, mraz, comfort_target, comfort_mode,
        presence, preheat_active, holiday_active, boost_active,
    ):
        """Vrati (target, heating_allowed, reason, effective_mode) - BEZ tarify/floor/krb/emergency,
        tie sa aplikuju az v _compute_zone ako vrstvy nad vysledkom tejto funkcie."""
        if boost_active:
            return comfort_target, True, "Boost aktivny", comfort_mode

        if mode == MODE_VYPNUTE:
            return mraz, False, "Rezim Vypnute", MODE_VYPNUTE
        if mode == MODE_DEN:
            return den, True, "Manualny rezim Den", MODE_DEN
        if mode == MODE_NOC:
            return noc, True, "Manualny rezim Noc", MODE_NOC
        if mode == MODE_MIN:
            return min_temp, True, "Manualny rezim Min", MODE_MIN
        if mode == MODE_MRAZ:
            return mraz, True, "Manualny rezim Mraz (protimrazova ochrana)", MODE_MRAZ

        # MODE_AUTO
        if holiday_active:
            return min_temp, True, "Auto: dovolenka/neprítomnost -> Min", MODE_MIN
        if presence:
            return comfort_target, True, f"Auto: pritomnost doma -> {comfort_mode}", comfort_mode
        if preheat_active:
            return comfort_target, True, f"Auto: predkurenie pred prichodom -> {comfort_mode}", comfort_mode
        return min_temp, True, "Auto: nikto doma, mimo predkurenia -> Min", MODE_MIN

    # ---------------------------------------------------------------- notifikacie

    def _maybe_notify(self, zone_id: str, zone_name: str, mode: str, flags: dict) -> None:
        rt = self._rt(zone_id)
        prev_flags: set = rt["flags"]
        cur_flags = {k for k, v in flags.items() if v}
        if mode == MODE_VYPNUTE:
            # Zona je vedome vypnuta - notifikacie o tarife/podlahe/krbe su tu
            # ocakavane a zbytocne (kurenie je aj tak vypnute z vlastnej vole).
            # Nudzova ochrana notifikuje vzdy, bez ohladu na rezim.
            cur_flags = {k for k in cur_flags if k == "emergency"}
        newly_active = cur_flags - prev_flags
        messages = {
            "tariff": f"{zone_name}: kurenie zablokovane vysokou tarifou.",
            "floor": f"{zone_name}: kurenie vypnute - podlaha dosiahla max. teplotu.",
            "krb": f"{zone_name}: kurenie vypnute - krb hori a je dost teplo.",
            "emergency": f"{zone_name}: NUDZOVA protimrazova ochrana aktivovana!",
        }
        for flag in newly_active:
            if flag in messages:
                self.hass.async_create_task(self._notify(messages[flag]))
        rt["flags"] = cur_flags

    async def _notify(self, message: str) -> None:
        entity_id = self.entry.options.get(CONF_NOTIFY_ENTITY)
        if not entity_id:
            return
        try:
            await self.hass.services.async_call(
                "notify", "send_message", {"entity_id": entity_id, "message": message}, blocking=False
            )
        except Exception:  # noqa: BLE001
            _LOGGER.warning("Notifikaciu sa nepodarilo odoslat (%s): %s", entity_id, message)

    # ---------------------------------------------------------------- aplikacia na zariadenia

    async def _async_apply(self) -> None:
        for zone_id, zdata in self.data["zones"].items():
            if zdata["zone_type"] == ZONE_TYPE_FLOOR_AC and zdata.get("ac_entity"):
                await self._apply_floor_ac(zone_id, zdata)
            else:
                await self._apply_single(zdata["climate_entity"], zdata["heating_allowed"], zdata["target_temperature"])

    async def _apply_single(self, climate_entity: str, heating_allowed: bool, target) -> None:
        state = self.hass.states.get(climate_entity)
        if state is None:
            return
        desired_hvac = "heat" if heating_allowed else "off"
        if state.state != desired_hvac:
            await self.hass.services.async_call(
                "climate", "set_hvac_mode", {"entity_id": climate_entity, "hvac_mode": desired_hvac}, blocking=False,
            )
        if heating_allowed and target is not None:
            current_target = state.attributes.get("temperature")
            if current_target != target:
                await self.hass.services.async_call(
                    "climate", "set_temperature", {"entity_id": climate_entity, "temperature": target}, blocking=False,
                )

    async def _apply_floor_ac(self, zone_id: str, zdata: dict) -> None:
        """AC je vzdy prioritny zdroj. Podlaha nastupi ako dokurovanie, ak AC nestiha
        dlhsie ako 'ac_priorita_minuty' o viac ako 'ac_priorita_rozdiel' stupnov."""
        ac_entity = zdata["ac_entity"]
        floor_entity = zdata["climate_entity"]
        heating_allowed = zdata["heating_allowed"]
        target = zdata["target_temperature"]
        current_temp = zdata["current_temperature"]

        if not heating_allowed:
            await self._apply_single(ac_entity, False, None)
            await self._apply_single(floor_entity, False, None)
            zdata["heat_source"] = "Ziadny"
            return

        await self._apply_single(ac_entity, True, target)

        rt = self._rt(zone_id)
        diff_limit = self._state_float(number_entity_id(zone_id, "ac_priorita_rozdiel"), AC_NUMBER_DEFS["ac_priorita_rozdiel"][4])
        minutes_limit = self._state_float(number_entity_id(zone_id, "ac_priorita_minuty"), AC_NUMBER_DEFS["ac_priorita_minuty"][4])

        deficit = current_temp is not None and target is not None and (target - current_temp) >= diff_limit
        floor_engaged = False

        if deficit:
            if rt["ac_deficit_since"] is None:
                rt["ac_deficit_since"] = dt_util.now()
            elapsed = (dt_util.now() - rt["ac_deficit_since"]).total_seconds() / 60
            floor_engaged = elapsed >= minutes_limit
        else:
            rt["ac_deficit_since"] = None
            floor_engaged = False

        await self._apply_single(floor_entity, floor_engaged, target if floor_engaged else None)
        zdata["heat_source"] = "AC + Podlaha" if floor_engaged else "AC"

    def async_unsub(self) -> None:
        if self._unsub_tracking:
            self._unsub_tracking()
            self._unsub_tracking = None
        if self._unsub_interval:
            self._unsub_interval()
            self._unsub_interval = None
        if self._unsub_debounce:
            self._unsub_debounce()
            self._unsub_debounce = None
