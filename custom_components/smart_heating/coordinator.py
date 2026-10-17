"""Coordinator - centralna rozhodovacia logika Smart Heating v2 (+ sezona/chladenie)."""
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
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from . import i18n
from .const import (
    AC_NUMBER_DEFS,
    COOLING_NUMBER_DEFS,
    CONF_AC_ENTITY,
    CONF_BATTERY_SOC_ENTITY,
    CONF_CLIMATE_ENTITY,
    CONF_EXTERNAL_TEMP_ENTITY,
    CONF_FIREPLACE_TEMP_ENTITY,
    CONF_FLOOR_TEMP_ENTITY,
    CONF_KRB_THRESHOLD,
    CONF_LANGUAGE,
    CONF_MANUAL_PRESENCE_ENTITIES,
    CONF_NOTIFY_AC_BACKUP,
    CONF_NOTIFY_BOOST,
    CONF_NOTIFY_COLD_OUTDOOR,
    CONF_NOTIFY_COOLING,
    CONF_NOTIFY_DIAGNOSTICS,
    CONF_NOTIFY_EMERGENCY,
    CONF_NOTIFY_ENTITY,
    CONF_NOTIFY_FLOOR,
    CONF_NOTIFY_HOLIDAY,
    CONF_NOTIFY_KRB,
    CONF_NOTIFY_PREHEAT,
    CONF_NOTIFY_TARIFF,
    CONF_NUDZOVA_TEPLOTA,
    CONF_OUTDOOR_SENSOR,
    CONF_HOLIDAY_ACTIVE,
    CONF_PRESENCE_ENTITIES,
    CONF_PV_SURPLUS_ENTITY,
    CONF_PV_AUTO,
    CONF_PV_POWER_ENTITY,
    CONF_GRID_POWER_ENTITY,
    CONF_BATTERY_POWER_ENTITY,
    CONF_GRID_EXPORT_NEGATIVE,
    CONF_BATTERY_CHARGE_POSITIVE,
    PV_ENGINE_NUMBERS,
    SOURCE_METERS,
    METER_ON_W,
    METER_STUCK_W,
    CONF_POWER_ENTITIES,
    CONF_RADIATOR_ENTITY,
    CONF_TARIFF_ENTITY,
    CONF_USE_FIREPLACE_GUARD,
    CONF_USE_FIXED_AC_SETPOINT,
    CONF_USE_FLOOR_MIN,
    CONF_ZONE_NAME,
    CONF_ZONE_TYPE,
    DEFAULT_EMERGENCY_TEMP,
    DEFAULT_FIREPLACE_THRESHOLD,
    DOMAIN,
    MODE_AUTO,
    MODE_DEN,
    MODE_MIN,
    MODE_MRAZ,
    MODE_NOC,
    MODE_VYPNUTE,
    NUMBER_DEFS,
    RADIATOR_NUMBER_DEFS,
    OPT_ZONES,
    SEASON_AUTO,
    SEASON_CHLADENIE,
    SEASON_KURENIE,
    AC_SWITCH_DEFS,
    SWITCH_DEFS,
    TIME_DEFS,
    ZONE_TYPE_FLOOR_AC,
    ZONE_TYPE_RADIATOR_FLOOR,
)

_LOGGER = logging.getLogger(__name__)

RECOMPUTE_INTERVAL = timedelta(minutes=5)
NOTIFY_STARTUP_GRACE = timedelta(minutes=3)

# Diagnostika
DIAG_UNAVAILABLE_AFTER = timedelta(minutes=15)   # entita nedostupna dlhsie -> porucha
DIAG_SLOW_AFTER = timedelta(hours=3)             # kuri a stale je hlboko pod cielom
DIAG_SLOW_GAP = 1.0                              # °C pod cielom, od ktorych sa to sleduje
DIAG_AIR_RANGE = (-20.0, 50.0)                   # mimo = nezmyselna hodnota
DIAG_FLOOR_RANGE = (-10.0, 45.0)

# Logovanie nabehov (zaklad pre buduce adaptivne predkurenie)
WARMUP_MIN_GAP = 0.5        # nabeh sa zacne logovat, ked chyba aspon tolko °C
WARMUP_MIN_MINUTES = 5      # kratsie nabehy su sum
WARMUP_KEEP = 30            # poslednych N nabehov na zonu
WARMUP_STORE_VERSION = 1

# Kaskada FVE prebytku
PV_CASCADE_DELAY = timedelta(minutes=10)   # vyssie priority nahriate tak dlho -> pridaj dalsiu
PV_SATISFIED_MARGIN = 0.2                  # °C pod FVE cielom = este "nahriata"
PV_RELEASE_GAP = 0.5                       # °C pod cielom vo vyssej priorite -> nizsie hned odpoj
PV_ENGINE_INTERVAL = timedelta(seconds=30)
METER_CHECK_AFTER = timedelta(minutes=10)   # merac v rozpore s ocakavanim tak dlho -> porucha  # vyhodnotenie vykonov (nie pri kazdej zmene senzora)


def mode_entity_id(zone_id: str) -> str:
    return f"select.smart_heating_{zone_id}_rezim"


def season_entity_id(zone_id: str) -> str:
    return f"select.smart_heating_{zone_id}_sezona"


def pv_priority_entity_id(zone_id: str) -> str:
    return f"select.smart_heating_{zone_id}_fve_priorita"


def number_entity_id(zone_id: str, key: str) -> str:
    return f"number.smart_heating_{zone_id}_{key}"


def time_entity_id(zone_id: str, key: str) -> str:
    return f"time.smart_heating_{zone_id}_{key}"


def switch_entity_id(zone_id: str, key: str) -> str:
    return f"switch.smart_heating_{zone_id}_{key}"


def _time_in_range(now_t: dt_time, start_t: dt_time, end_t: dt_time) -> bool:
    """True ak now_t lezi v intervale <start_t, end_t), s podporou prechodu cez polnoc."""
    if start_t <= end_t:
        return start_t <= now_t < end_t
    return now_t >= start_t or now_t < end_t


class SmartHeatingCoordinator(DataUpdateCoordinator):
    """Sleduje relevantne entity a prepocitava/aplikuje stav kurenia/chladenia."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=None)
        self.entry = entry
        self._unsub_tracking = None
        self._unsub_interval = None
        self._unsub_debounce = None
        self._unsub_pv_engine = None
        self._meter_cache: dict[str, bool] = {}
        self._pv_energy_kwh = 0.0          # energia kurenia v case FVE kaskady (sensor energia_z_fve)
        self._pv_energy_at = None
        # runtime stav, ktory neprezije restart HA (zamerne - boost/deficit su kratkodobe)
        self._runtime: dict[str, dict] = {}
        self._global_rt: dict = {"tariff_blocked": False, "holiday_active": False, "krb_zones": set(), "emergency_zones": set()}
        self._startup_time = dt_util.now()
        self._lang = "en"
        self._warmup_store = Store(hass, WARMUP_STORE_VERSION, f"{DOMAIN}.warmup.{entry.entry_id}")
        self._warmup_data: dict[str, list] = {}

    @property
    def zones(self) -> dict:
        return self.entry.options.get(OPT_ZONES, {})

    def _t(self, key: str, **kwargs) -> str:
        return i18n.t(self._lang, key, **kwargs)

    def _rt(self, zone_id: str) -> dict:
        return self._runtime.setdefault(
            zone_id,
            {"boost_until": None, "ac_deficit_since": None, "prev_raw_mode": None},
        )

    async def async_setup(self) -> None:
        try:
            self._warmup_data = await self._warmup_store.async_load() or {}
        except Exception:  # noqa: BLE001 - poskodeny subor nesmie zastavit kurenie
            _LOGGER.warning("Nepodarilo sa nacitat historiu nabehov, zacina sa odznova")
            self._warmup_data = {}
        self.data = self._compute()
        self._track_entities()
        self._unsub_interval = async_track_time_interval(
            self.hass, self._periodic_tick, RECOMPUTE_INTERVAL
        )
        self._unsub_pv_engine = async_track_time_interval(
            self.hass, self._fast_tick, PV_ENGINE_INTERVAL
        )

    def _tracked_entity_ids(self) -> list[str]:
        ids: list[str] = []
        opt = self.entry.options
        for key in (CONF_OUTDOOR_SENSOR, CONF_TARIFF_ENTITY, CONF_FIREPLACE_TEMP_ENTITY, CONF_PV_SURPLUS_ENTITY, CONF_BATTERY_SOC_ENTITY):
            if opt.get(key):
                ids.append(opt[key])

        for zone_id, zone in self.zones.items():
            ids.append(zone[CONF_CLIMATE_ENTITY])
            if zone.get(CONF_AC_ENTITY):
                ids.append(zone[CONF_AC_ENTITY])
            if zone.get(CONF_FLOOR_TEMP_ENTITY):
                ids.append(zone[CONF_FLOOR_TEMP_ENTITY])
            # externy teplomer a rele radiatora - bez sledovania by sa zmena prejavila
            # az pri 5-minutovom ticku (zle pre hysterezu)
            if zone.get(CONF_EXTERNAL_TEMP_ENTITY):
                ids.append(zone[CONF_EXTERNAL_TEMP_ENTITY])
            if zone.get(CONF_RADIATOR_ENTITY):
                ids.append(zone[CONF_RADIATOR_ENTITY])
            ids.extend(zone.get(CONF_PRESENCE_ENTITIES, []))
            ids.extend(zone.get(CONF_MANUAL_PRESENCE_ENTITIES, []))
            ids.append(mode_entity_id(zone_id))
            ids.append(pv_priority_entity_id(zone_id))
            is_floor_ac = zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_FLOOR_AC
            if is_floor_ac:
                ids.append(season_entity_id(zone_id))
            for key in NUMBER_DEFS:
                ids.append(number_entity_id(zone_id, key))
            if is_floor_ac:
                for key in AC_NUMBER_DEFS:
                    ids.append(number_entity_id(zone_id, key))
                for key in COOLING_NUMBER_DEFS:
                    ids.append(number_entity_id(zone_id, key))
                for key in AC_SWITCH_DEFS:
                    ids.append(switch_entity_id(zone_id, key))
            if zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_RADIATOR_FLOOR:
                for key in RADIATOR_NUMBER_DEFS:
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
        if self.entry.options.get(CONF_NOTIFY_BOOST, True):
            await self._notify(self._t("notif_boost", zone=zone_name, hours=hours))
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
        self._lang = i18n.resolve_lang(self.hass, opt.get(CONF_LANGUAGE))
        outdoor = self._state_float(opt.get(CONF_OUTDOOR_SENSOR))

        tariff_entity = opt.get(CONF_TARIFF_ENTITY)
        tariff_ok = True
        if tariff_entity:
            state = self.hass.states.get(tariff_entity)
            tariff_ok = state is not None and state.state == "on"

        holiday_active = bool(opt.get(CONF_HOLIDAY_ACTIVE, False))
        emergency_temp = opt.get(CONF_NUDZOVA_TEPLOTA, DEFAULT_EMERGENCY_TEMP)
        krb_threshold = opt.get(CONF_KRB_THRESHOLD, DEFAULT_FIREPLACE_THRESHOLD)
        fireplace_temp = self._state_float(opt.get(CONF_FIREPLACE_TEMP_ENTITY))
        pv_surplus = self._state_bool(opt.get(CONF_PV_SURPLUS_ENTITY), False)
        battery_soc = self._state_float(opt.get(CONF_BATTERY_SOC_ENTITY))

        now_t = dt_util.now().time()
        weekday = dt_util.now().weekday()  # 0=Po ... 6=Ne

        # Kaskada FVE: ktore zony smu prave teraz kurit z prebytku (podla priority)
        if self._pv_auto_enabled():
            tier = self._pv_engine_state()["tier"]
            participants = self._pv_participants()
            pv_surplus = tier >= 1 and bool(participants)
            pv_allowed = {z: t <= tier for z, t in participants.items()} if pv_surplus else {}
        else:
            pv_allowed = self._pv_cascade(pv_surplus)

        zones_data = {
            zone_id: self._compute_zone(
                zone_id, zone, tariff_ok, holiday_active, emergency_temp,
                krb_threshold, fireplace_temp, pv_surplus and pv_allowed.get(zone_id, True),
                battery_soc, outdoor, now_t, weekday,
            )
            for zone_id, zone in self.zones.items()
        }
        for zone_id, zdata in zones_data.items():
            zdata["pv_priority"] = self._pv_priority(zone_id)
            # zona by chcela FVE, ale caka, kym sa nahreju vyssie priority
            zdata["pv_waiting"] = bool(pv_surplus) and pv_allowed.get(zone_id, True) is False

        for zone_id, zdata in zones_data.items():
            zdata["diag_static"] = self._diag_static(zone_id, self.zones[zone_id], zdata)
            zdata.setdefault("problems", [m for _, m in zdata["diag_static"]])
            zdata["warmup_rate"], zdata["warmup_count"] = self._warmup_summary(zone_id)

        self._process_global_notifications(tariff_ok, holiday_active, zones_data)

        return {
            "pv_engine": self._pv_snapshot(pv_surplus),
            "outdoor_temp": outdoor,
            "tariff_ok": tariff_ok,
            "holiday_active": holiday_active,
            "zones": zones_data,
        }

    def _resolve_season(self, zone_id: str, outdoor, vonkajsia_hranica_chladenie) -> str:
        state = self.hass.states.get(season_entity_id(zone_id))
        raw = state.state if state and state.state not in ("unknown", "unavailable") else SEASON_AUTO
        if raw != SEASON_AUTO:
            return raw
        if outdoor is not None and vonkajsia_hranica_chladenie is not None and outdoor >= vonkajsia_hranica_chladenie:
            return SEASON_CHLADENIE
        return SEASON_KURENIE

    def _compute_zone(
        self, zone_id, zone, tariff_ok, holiday_active, emergency_temp,
        krb_threshold, fireplace_temp, pv_surplus, battery_soc, outdoor, now_t, weekday,
    ) -> dict:
        climate_entity = zone[CONF_CLIMATE_ENTITY]
        climate_state = self.hass.states.get(climate_entity)
        external_temp_entity = zone.get(CONF_EXTERNAL_TEMP_ENTITY)
        if external_temp_entity:
            current_temp = self._state_float(external_temp_entity)
        else:
            current_temp = climate_state.attributes.get("current_temperature") if climate_state else None
        has_external_temp = bool(external_temp_entity)

        floor_temp = self._state_float(zone.get(CONF_FLOOR_TEMP_ENTITY))
        floor_min = self._state_float(number_entity_id(zone_id, "floor_min"), NUMBER_DEFS["floor_min"][4])
        floor_max = self._state_float(number_entity_id(zone_id, "floor_max"), NUMBER_DEFS["floor_max"][4])
        floor_hyst = self._state_float(
            number_entity_id(zone_id, "floor_hysterezia"), NUMBER_DEFS["floor_hysterezia"][4]
        ) or 0.0
        is_radiator = zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_RADIATOR_FLOOR

        mode_state = self.hass.states.get(mode_entity_id(zone_id))
        mode = mode_state.state if mode_state and mode_state.state not in ("unknown", "unavailable") else MODE_AUTO

        # --- rozpoznanie prechodu do/z Vypnute (pre "posli off len raz, potom hands-off") ---
        rt = self._rt(zone_id)
        prev_raw_mode = rt.get("prev_raw_mode")
        release_control = mode == MODE_VYPNUTE and prev_raw_mode == MODE_VYPNUTE
        rt["prev_raw_mode"] = mode

        is_floor_ac = zone.get(CONF_ZONE_TYPE) == ZONE_TYPE_FLOOR_AC and zone.get(CONF_AC_ENTITY)

        # ================================================================= CHLADENIE
        if is_floor_ac:
            vonk_hranica_chl = self._state_float(
                number_entity_id(zone_id, "vonkajsia_hranica_chladenie"),
                COOLING_NUMBER_DEFS["vonkajsia_hranica_chladenie"][4],
            )
            season = self._resolve_season(zone_id, outdoor, vonk_hranica_chl)
        else:
            season = SEASON_KURENIE

        if season == SEASON_CHLADENIE:
            return self._compute_zone_cooling(
                zone_id, zone, mode, release_control, current_temp, has_external_temp,
                floor_temp, floor_min, floor_max, battery_soc, climate_entity,
            )

        # ================================================================= KURENIE (nezmenene)
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

        vonkajsia_hranica = self._state_float(
            number_entity_id(zone_id, "vonkajsia_hranica"), NUMBER_DEFS["vonkajsia_hranica"][4]
        )
        cold_outdoor_active = (
            outdoor is not None and vonkajsia_hranica is not None and outdoor <= vonkajsia_hranica
        )

        boost_until = rt.get("boost_until")
        boost_active = boost_until is not None and dt_util.now() < boost_until
        if boost_until is not None and not boost_active:
            rt["boost_until"] = None  # boost prave vyprsal

        # --- 4/5: manualny rezim / auto (bez bezpecnostnych vrstiev) ---
        target, heating_allowed, reason, effective_mode = self._resolve_target(
            mode, den, noc, min_temp, mraz, comfort_target, comfort_mode,
            presence, preheat_active, cold_outdoor_active, holiday_active, boost_active,
        )

        # --- 1: TARIFA ---
        tariff_blocked = False
        if not tariff_ok:
            heating_allowed = False
            tariff_blocked = True
            reason = self._t("reason_tariff_blocked")

        # --- 2: BEZPECNOST PODLAHY (s hysterezou) ---
        # Vypne na floor_max a znova povoli az pod floor_max - hystereza, aby rele
        # necvakalo dokola okolo jednej hodnoty.
        if floor_temp is not None and floor_max is not None:
            if floor_temp >= floor_max:
                rt["floor_blocked"] = True
            elif floor_temp <= floor_max - floor_hyst:
                rt["floor_blocked"] = False
        else:
            rt["floor_blocked"] = False
        floor_override = bool(rt.get("floor_blocked"))
        # Pri radiator_floor blokuje prehriata podlaha len podlahu, radiator kuri dalej.
        floor_blocks_zone = floor_override and not is_radiator
        if floor_blocks_zone:
            heating_allowed = False
            if floor_temp >= floor_max:
                reason = self._t("reason_floor_stop", floor_temp=floor_temp, floor_max=floor_max)
            else:
                reason = self._t(
                    "reason_floor_wait", floor_temp=floor_temp, resume=round(floor_max - floor_hyst, 1)
                )

        # --- 3: KRB ---
        krb_override = False
        use_krb = self._state_bool(switch_entity_id(zone_id, "reaguj_na_krb"), zone.get(CONF_USE_FIREPLACE_GUARD, False))
        if (
            use_krb and fireplace_temp is not None
            and krb_threshold is not None and fireplace_temp >= krb_threshold
        ):
            heating_allowed = False
            krb_override = True
            reason = self._t("reason_krb_stop", fireplace_temp=fireplace_temp, krb_threshold=krb_threshold)

        # --- 0.5: FVE PREBYTOK (preraza TARIFU, nie floor/krb) ---
        pv_active = False
        use_fve = self._state_bool(switch_entity_id(zone_id, "vyuzi_fve_prebytok"), True)
        if pv_surplus and use_fve and not floor_blocks_zone and not krb_override:
            heating_allowed = True
            target = comfort_target
            effective_mode = comfort_mode
            reason = self._t("reason_pv_active")
            pv_active = True

        # --- 0: NUDZOVA OCHRANA (prerazi TARIFU, nie floor/krb) ---
        emergency_active = False
        if (
            current_temp is not None and emergency_temp is not None and current_temp < emergency_temp
            and not floor_blocks_zone and not krb_override
        ):
            heating_allowed = True
            target = max(target or 0, emergency_temp + 1)
            reason = self._t("reason_emergency", current_temp=current_temp, emergency_temp=emergency_temp)
            emergency_active = True

        self._maybe_notify(zone_id, zone[CONF_ZONE_NAME], mode, floor_override, floor_temp, preheat_active, cold_outdoor_active, presence)

        # --- MIN. TEPLOTA PODLAHY: podlaha nabehne pod floor_min aj ked je vzduch teply ---
        use_floor_min = self._state_bool(
            switch_entity_id(zone_id, "udrzat_min_podlahy"), zone.get(CONF_USE_FLOOR_MIN, is_radiator)
        )
        if (
            use_floor_min and heating_allowed and not floor_override and floor_temp is not None
            and floor_min is not None and effective_mode != MODE_MRAZ and not holiday_active
        ):
            if floor_temp < floor_min:
                rt["floor_guard"] = True
            elif floor_temp >= floor_min + floor_hyst:
                rt["floor_guard"] = False
        else:
            rt["floor_guard"] = False
        floor_guard = bool(rt.get("floor_guard"))

        device_mode = "heat" if heating_allowed else "off"

        return {
            "name": zone[CONF_ZONE_NAME],
            "zone_type": zone.get(CONF_ZONE_TYPE, "floor"),
            "season": SEASON_KURENIE,
            "floor_guard": floor_guard,
            "floor_hysterezia": floor_hyst,
            "pv_target": comfort_target,
            "radiator_entity": zone.get(CONF_RADIATOR_ENTITY),
            "mode": mode,
            "effective_mode": effective_mode,
            "current_temperature": current_temp,
            "has_external_temp": has_external_temp,
            "target_temperature": target,
            "device_mode": device_mode,
            "floor_temperature": floor_temp,
            "floor_min": floor_min,
            "floor_max": floor_max,
            "outdoor_temperature": outdoor,
            "cold_outdoor_active": cold_outdoor_active,
            "heating_allowed": heating_allowed,
            "floor_override": floor_override,
            "krb_override": krb_override,
            "emergency_active": emergency_active,
            "pv_active": pv_active,
            "tariff_blocked": tariff_blocked,
            "boost_active": boost_active,
            "release_control": release_control,
            "reason": reason,
            "climate_entity": climate_entity,
            "ac_entity": zone.get(CONF_AC_ENTITY),
            "is_day": is_day,
        }

    def _compute_zone_cooling(
        self, zone_id, zone, mode, release_control, current_temp, has_external_temp,
        floor_temp, floor_min, floor_max, battery_soc, climate_entity,
    ) -> dict:
        """Chladenie: baterka FVE musi byt nad hranicou (podmienka na to, ci sa smie
        vobec chladit) A ak ma zona externy teplomer, ten s hysterezou rozhoduje kedy
        AC realne bezi (rovnaky princip ako pri kureni - 'teplota_chladenie' sluzi
        zaroven ako ciel pre hysterezu aj ako fyzicky setpoint poslany do AC).
        Podlaha nikdy nebezi (nevie chladit)."""
        rt = self._rt(zone_id)

        if mode == MODE_VYPNUTE:
            cooling_allowed = False
            target = None
            reason = self._t("reason_off_mode")
            rt["cool_running"] = False
        else:
            threshold = self._state_float(
                number_entity_id(zone_id, "bateria_hranica_chladenie"),
                COOLING_NUMBER_DEFS["bateria_hranica_chladenie"][4],
            )
            cool_target = self._state_float(
                number_entity_id(zone_id, "teplota_chladenie"),
                COOLING_NUMBER_DEFS["teplota_chladenie"][4],
            )
            battery_ok = battery_soc is not None and threshold is not None and battery_soc >= threshold
            target = cool_target

            if not battery_ok:
                cooling_allowed = False
                target = None
                rt["cool_running"] = False
                if battery_soc is None:
                    reason = self._t("reason_cool_no_battery")
                else:
                    reason = self._t("reason_cool_battery_low", battery=battery_soc, threshold=threshold)
            elif has_external_temp and current_temp is not None and cool_target is not None:
                hysterezia = self._state_float(
                    number_entity_id(zone_id, "ac_hysterezia"), AC_NUMBER_DEFS["ac_hysterezia"][4]
                )
                if current_temp <= cool_target - hysterezia:
                    rt["cool_running"] = False
                elif current_temp >= cool_target + hysterezia:
                    rt["cool_running"] = True
                # inak (v pasme hysterezie) - necha predchadzajuci stav bezo zmeny
                cooling_allowed = rt.get("cool_running", True)
                if cooling_allowed:
                    reason = self._t(
                        "reason_cool_temp_active", current_temp=current_temp, target=cool_target, battery=battery_soc
                    )
                else:
                    reason = self._t("reason_cool_temp_satisfied", current_temp=current_temp, target=cool_target)
            else:
                cooling_allowed = True
                rt["cool_running"] = True
                reason = self._t("reason_cool_battery_ok", battery=battery_soc, threshold=threshold)

        device_mode = "cool" if cooling_allowed else "off"
        self._maybe_notify_cooling(zone_id, zone[CONF_ZONE_NAME], cooling_allowed, battery_soc, target)

        return {
            "name": zone[CONF_ZONE_NAME],
            "zone_type": zone.get(CONF_ZONE_TYPE, "floor"),
            "season": SEASON_CHLADENIE,
            "mode": mode,
            "effective_mode": None,
            "current_temperature": current_temp,
            "has_external_temp": has_external_temp,
            "target_temperature": target,
            "device_mode": device_mode,
            "floor_temperature": floor_temp,
            "floor_min": floor_min,
            "floor_max": floor_max,
            "outdoor_temperature": None,
            "cold_outdoor_active": False,
            "heating_allowed": False,
            "floor_override": False,
            "krb_override": False,
            "emergency_active": False,
            "pv_active": False,
            "tariff_blocked": False,
            "boost_active": False,
            "release_control": release_control,
            "reason": reason,
            "climate_entity": climate_entity,
            "ac_entity": zone.get(CONF_AC_ENTITY),
            "is_day": None,
        }

    def _resolve_target(
        self, mode, den, noc, min_temp, mraz, comfort_target, comfort_mode,
        presence, preheat_active, cold_outdoor_active, holiday_active, boost_active,
    ):
        """Vrati (target, heating_allowed, reason, effective_mode) - BEZ tarify/floor/krb/emergency,
        tie sa aplikuju az v _compute_zone ako vrstvy nad vysledkom tejto funkcie."""
        if boost_active:
            return comfort_target, True, self._t("reason_boost"), comfort_mode

        if mode == MODE_VYPNUTE:
            return mraz, False, self._t("reason_off_mode"), MODE_VYPNUTE
        if mode == MODE_DEN:
            return den, True, self._t("reason_manual_day"), MODE_DEN
        if mode == MODE_NOC:
            return noc, True, self._t("reason_manual_night"), MODE_NOC
        if mode == MODE_MIN:
            return min_temp, True, self._t("reason_manual_min"), MODE_MIN
        if mode == MODE_MRAZ:
            return mraz, True, self._t("reason_manual_frost"), MODE_MRAZ

        # MODE_AUTO
        comfort_mode_label = self._t("mode_day") if comfort_mode == MODE_DEN else self._t("mode_night")
        if holiday_active:
            return min_temp, True, self._t("reason_auto_holiday"), MODE_MIN
        if presence:
            return comfort_target, True, self._t("reason_auto_presence", mode=comfort_mode_label), comfort_mode
        if preheat_active:
            return comfort_target, True, self._t("reason_auto_preheat", mode=comfort_mode_label), comfort_mode
        if cold_outdoor_active:
            return comfort_target, True, self._t("reason_auto_cold_outdoor", mode=comfort_mode_label), comfort_mode
        return min_temp, True, self._t("reason_auto_away"), MODE_MIN

    # ---------------------------------------------------------------- notifikacie

    def _notify_bool_transition(self, state_dict: dict, key: str, active: bool, enabled: bool, start_msg: str, stop_msg: str | None) -> None:
        """Generciky helper: posle start_msg pri prechode False->True a stop_msg
        (ak je zadana) pri prechode True->False. Pocas ochranneho okna po starte HA
        len ticho zaznamena zakladny stav, bez posielania."""
        if dt_util.now() - self._startup_time < NOTIFY_STARTUP_GRACE:
            state_dict[key] = active
            return
        prev = state_dict.get(key, False)
        if active != prev and enabled:
            msg = start_msg if active else stop_msg
            if msg:
                self.hass.async_create_task(self._notify(msg))
        state_dict[key] = active

    def _maybe_notify(
        self, zone_id: str, zone_name: str, mode: str,
        floor_override: bool, floor_temp, preheat_active: bool, cold_outdoor_active: bool, presence: bool,
    ) -> None:
        rt = self._rt(zone_id)
        opt = self.entry.options

        # Manualne Vypnute - podlaha/predkurenie/vonkajsia hranica su tu ocakavane
        # a nerelevantne (kurenie je aj tak vypnute z vlastnej vole).
        is_vypnute = mode == MODE_VYPNUTE

        floor_temp_str = f"{floor_temp}\u00b0C" if floor_temp is not None else "?"
        self._notify_bool_transition(
            rt, "notif_floor", floor_override and not is_vypnute, opt.get(CONF_NOTIFY_FLOOR, True),
            self._t("notif_floor_start", zone=zone_name, temp=floor_temp_str),
            self._t("notif_floor_stop", zone=zone_name),
        )
        # "Predkurenie ukoncene" ma zmysel len ak sa tym realne nieco meni (nikto nie
        # je doma -> kurenie sa stiahne na Min). Ak je niekto doma, dovod kurenia sa
        # len ticho zmenil na "pritomnost" - nema zmysel o tom notifikovat.
        preheat_stop_msg = None if presence else self._t("notif_preheat_stop", zone=zone_name)
        self._notify_bool_transition(
            rt, "notif_preheat", preheat_active and not is_vypnute, opt.get(CONF_NOTIFY_PREHEAT, True),
            self._t("notif_preheat_start", zone=zone_name),
            preheat_stop_msg,
        )
        self._notify_bool_transition(
            rt, "notif_cold_outdoor", cold_outdoor_active and not is_vypnute, opt.get(CONF_NOTIFY_COLD_OUTDOOR, True),
            self._t("notif_cold_outdoor_start", zone=zone_name),
            self._t("notif_cold_outdoor_stop", zone=zone_name),
        )

    def _maybe_notify_cooling(self, zone_id: str, zone_name: str, cooling_active: bool, battery_soc, target) -> None:
        rt = self._rt(zone_id)
        battery_str = f"{battery_soc}%" if battery_soc is not None else "?"
        target_str = f"{target}\u00b0C" if target is not None else "?"
        self._notify_bool_transition(
            rt, "notif_cooling", cooling_active, self.entry.options.get(CONF_NOTIFY_COOLING, True),
            self._t("notif_cooling_start", zone=zone_name, battery=battery_str, target=target_str),
            self._t("notif_cooling_stop", zone=zone_name),
        )

    def _maybe_notify_ac_backup(self, zone_id: str, zone_name: str, floor_engaged: bool) -> None:
        rt = self._rt(zone_id)
        self._notify_bool_transition(
            rt, "notif_ac_backup", floor_engaged, self.entry.options.get(CONF_NOTIFY_AC_BACKUP, True),
            self._t("notif_ac_backup_start", zone=zone_name),
            self._t("notif_ac_backup_stop", zone=zone_name),
        )

    def _process_global_notifications(self, tariff_ok: bool, holiday_active: bool, zones_data: dict) -> None:
        opt = self.entry.options
        grace = dt_util.now() - self._startup_time < NOTIFY_STARTUP_GRACE

        tariff_blocked = not tariff_ok
        if grace:
            self._global_rt["tariff_blocked"] = tariff_blocked
        elif tariff_blocked != self._global_rt["tariff_blocked"]:
            if opt.get(CONF_NOTIFY_TARIFF, True):
                msg = self._t("notif_tariff_start") if tariff_blocked else self._t("notif_tariff_stop")
                self.hass.async_create_task(self._notify(msg))
            self._global_rt["tariff_blocked"] = tariff_blocked

        if grace:
            self._global_rt["holiday_active"] = holiday_active
        elif holiday_active != self._global_rt["holiday_active"]:
            if opt.get(CONF_NOTIFY_HOLIDAY, True):
                msg = self._t("notif_holiday_start") if holiday_active else self._t("notif_holiday_stop")
                self.hass.async_create_task(self._notify(msg))
            self._global_rt["holiday_active"] = holiday_active

        krb_zones = {
            z["name"] for z in zones_data.values() if z.get("krb_override") and z.get("mode") != MODE_VYPNUTE
        }
        if grace:
            self._global_rt["krb_zones"] = krb_zones
        elif krb_zones != self._global_rt["krb_zones"]:
            if opt.get(CONF_NOTIFY_KRB, True):
                msg = (
                    self._t("notif_krb_start", zones=", ".join(sorted(krb_zones)))
                    if krb_zones else self._t("notif_krb_stop")
                )
                self.hass.async_create_task(self._notify(msg))
            self._global_rt["krb_zones"] = krb_zones

        emergency_zones = {z["name"] for z in zones_data.values() if z.get("emergency_active")}
        if grace:
            self._global_rt["emergency_zones"] = emergency_zones
        elif emergency_zones != self._global_rt["emergency_zones"]:
            if opt.get(CONF_NOTIFY_EMERGENCY, True):
                msg = (
                    self._t("notif_emergency_start", zones=", ".join(sorted(emergency_zones)))
                    if emergency_zones else self._t("notif_emergency_stop")
                )
                self.hass.async_create_task(self._notify(msg))
            self._global_rt["emergency_zones"] = emergency_zones

    async def _notify(self, message: str) -> None:
        entity_ids = self.entry.options.get(CONF_NOTIFY_ENTITY)
        if not entity_ids:
            return
        if isinstance(entity_ids, str):
            entity_ids = [entity_ids]
        for entity_id in entity_ids:
            try:
                await self.hass.services.async_call(
                    "notify", "send_message", {"entity_id": entity_id, "message": message}, blocking=False
                )
            except Exception:  # noqa: BLE001
                _LOGGER.warning("Notifikaciu sa nepodarilo odoslat (%s): %s", entity_id, message)

    # ---------------------------------------------------------------- aplikacia na zariadenia

    def _device_action(self, entity_id) -> str | None:
        """hvac_action, ktory hlasi samotne zariadenie (Daikin, termostat podlahy).
        None, ak ho zariadenie nehlasi - vtedy sa stav odvodi z nasho prikazu."""
        if not entity_id:
            return None
        state = self.hass.states.get(entity_id)
        if state is None:
            return None
        action = state.attributes.get("hvac_action")
        return str(action) if action else None

    def _resolve_action(self, entities: list, we_run_it: bool, running_value: str) -> str:
        """Skutocny stav zony: running_value ('heating'/'cooling') alebo 'idle'.

        Ak niektore zo zariadeni hlasi vlastny hvac_action, ma prednost (to je
        realita - napr. termostat uz dosiahol teplotu a rele je vypnute).
        Inak sa vychadza z toho, co integracia prave zariadeniu prikazala."""
        # 1) merac prikonu zdroja = najspolahlivejsi udaj (rele naozaj zopnute)
        measured = [m for m in (self._meter_on(self._device_meter(e)) for e in entities) if m is not None]
        if measured:
            return running_value if any(measured) else "idle"
        reported = [a for a in (self._device_action(e) for e in entities) if a]
        if reported:
            return running_value if running_value in reported else "idle"
        if not we_run_it:
            return "idle"
        # Zariadenie stav nehlasi - odhad z jeho vlastnej teploty a setpointu.
        # Termostat, ktory uz ma svoju teplotu, nekuri, aj ked je kurenie povolene.
        demands = [d for d in (self._device_demand(e, running_value) for e in entities) if d is not None]
        if demands:
            return running_value if any(demands) else "idle"
        return running_value

    def _device_demand(self, entity_id, running_value: str) -> bool | None:
        """True = zariadenie podla vlastnej teploty este pracuje, False = uz ma
        svoju teplotu, None = nevieme (chyba teplota alebo setpoint)."""
        state = self.hass.states.get(entity_id) if entity_id else None
        if state is None:
            return None
        try:
            cur = float(state.attributes.get("current_temperature"))
            tgt = float(state.attributes.get("temperature"))
        except (TypeError, ValueError):
            return None
        return cur > tgt if running_value == "cooling" else cur < tgt

    async def _async_apply(self) -> None:
        for zone_id, zdata in self.data["zones"].items():
            if zdata["release_control"]:
                zdata["actual_action"] = "off"
                zdata["src_cmd"] = {}      # zariadenie riadi pouzivatel - merace nekontrolujeme
                continue  # Vypnute uz dlhsie - nechavame zariadenie uplne na pokoji

            if zdata["zone_type"] == ZONE_TYPE_FLOOR_AC and zdata.get("ac_entity"):
                if zdata["season"] == SEASON_CHLADENIE:
                    await self._apply_device(zdata["ac_entity"], zdata["device_mode"], zdata["target_temperature"])
                    await self._apply_device(zdata["climate_entity"], "off", None)  # podlaha nikdy nechladi
                    zdata["heat_source"] = (
                        self._t("source_ac") if zdata["device_mode"] == "cool" else self._t("source_none")
                    )
                    zdata["actual_action"] = self._resolve_action(
                        [zdata["ac_entity"]], zdata["device_mode"] == "cool", "cooling"
                    )
                    zdata["src_cmd"] = {"ac": zdata["device_mode"] == "cool", "floor": False}
                else:
                    await self._apply_floor_ac(zone_id, zdata)
            elif zdata["zone_type"] == ZONE_TYPE_RADIATOR_FLOOR:
                await self._apply_radiator_floor(zone_id, zdata)
            else:
                guard = bool(zdata.get("floor_guard")) and zdata["heating_allowed"]
                # Min. teplota podlahy: termostat dostane max. podlahy ako setpoint, aby
                # kuril aj ked je vzduch teply; hranice drzi nasa hystereza.
                setpoint = zdata.get("floor_max") if guard else zdata["target_temperature"]
                await self._apply_device(zdata["climate_entity"], zdata["device_mode"], setpoint)
                zdata["heat_source"] = (
                    self._t("source_floor_min") if guard
                    else self._t("source_floor") if zdata["heating_allowed"] else self._t("source_none")
                )
                zdata["actual_action"] = self._resolve_action(
                    [zdata["climate_entity"]], zdata["heating_allowed"], "heating"
                )
                zdata["src_cmd"] = {"floor": bool(zdata["heating_allowed"])}

        for zone_id, zdata in self.data["zones"].items():
            self._diag_dynamic_and_notify(zone_id, zdata)
            self._warmup_track(zone_id, zdata)

        # _apply_* vyssie MENI data (napr. heat_source), ktore uz boli raz oznamene
        # entitam pri poslednom self.async_set_updated_data(). Bez tohto volania by
        # sa tato zmena nikdy nedostala do stavu entit (napr. "Zdroj: ..." na karte)
        # az do dalsieho, uplne nesuvisieho prepoctu.
        self.async_update_listeners()

    async def _apply_device(self, entity_id: str, hvac_mode: str, target) -> None:
        state = self.hass.states.get(entity_id)
        if state is None:
            return
        if state.state != hvac_mode:
            await self.hass.services.async_call(
                "climate", "set_hvac_mode", {"entity_id": entity_id, "hvac_mode": hvac_mode}, blocking=False,
            )
        if hvac_mode != "off" and target is not None:
            current_target = state.attributes.get("temperature")
            if current_target != target:
                await self.hass.services.async_call(
                    "climate", "set_temperature", {"entity_id": entity_id, "temperature": target}, blocking=False,
                )

    async def _apply_floor_ac(self, zone_id: str, zdata: dict) -> None:
        """KURENIE v zone typu floor_ac: AC je vzdy prioritny zdroj. Podlaha nastupi
        ako dokurovanie, ak AC nestiha dlhsie ako 'ac_priorita_minuty' o viac ako
        'ac_priorita_rozdiel' stupnov.

        Pevny AC setpoint + nasa vlastna hysterezia (namiesto spoliehania sa na
        regulaciu samotnej AC jednotky) sa pouzije, ak ma zona bud externy teplomer
        (vlastny senzor AC je nepresny), ALEBO ak je zapnuty prepinac
        'pouzit_pevny_ac_setpoint' (uzivatel chce pevny setpoint aj s vlastnym
        senzorom AC, napr. ked AC ignoruje svoj vlastny cielovy setpoint)."""
        ac_entity = zdata["ac_entity"]
        floor_entity = zdata["climate_entity"]
        heating_allowed = zdata["heating_allowed"]
        target = zdata["target_temperature"]
        current_temp = zdata["current_temperature"]
        rt = self._rt(zone_id)

        if not heating_allowed:
            await self._apply_device(ac_entity, "off", None)
            await self._apply_device(floor_entity, "off", None)
            rt["ac_running"] = False
            zdata["heat_source"] = self._t("source_none")
            zdata["actual_action"] = "idle"
            zdata["src_cmd"] = {"ac": False, "floor": False}
            return

        zone_conf = self.zones.get(zone_id, {})
        force_fixed_setpoint = self._state_bool(
            switch_entity_id(zone_id, "pouzit_pevny_ac_setpoint"),
            zone_conf.get(CONF_USE_FIXED_AC_SETPOINT, False),
        )
        use_fixed_setpoint = zdata["has_external_temp"] or force_fixed_setpoint

        if use_fixed_setpoint:
            ac_setpoint = self._state_float(
                number_entity_id(zone_id, "ac_setpoint_teplota"), AC_NUMBER_DEFS["ac_setpoint_teplota"][4]
            )
            hysterezia = self._state_float(
                number_entity_id(zone_id, "ac_hysterezia"), AC_NUMBER_DEFS["ac_hysterezia"][4]
            )
            if current_temp is not None and target is not None:
                if current_temp >= target + hysterezia:
                    rt["ac_running"] = False
                elif current_temp <= target - hysterezia:
                    rt["ac_running"] = True
                # inak (v pasme hysterezie) - necha predchadzajuci stav bezo zmeny
            ac_running = rt.get("ac_running", True)  # bez udajov radsej bezpecnejsie zapnut
            await self._apply_device(ac_entity, "heat" if ac_running else "off", ac_setpoint if ac_running else None)
        else:
            rt["ac_running"] = True
            await self._apply_device(ac_entity, "heat", target)

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

        guard = bool(zdata.get("floor_guard"))
        floor_on = floor_engaged or guard
        floor_setpoint = zdata.get("floor_max") if guard else target
        await self._apply_device(floor_entity, "heat" if floor_on else "off", floor_setpoint if floor_on else None)
        self._maybe_notify_ac_backup(zone_id, zdata["name"], floor_engaged)
        zdata["heat_source"] = (
            self._t("source_ac_floor") if floor_on and rt.get("ac_running", True)
            else self._t("source_floor_min") if guard
            else (self._t("source_ac") if rt.get("ac_running", True) else self._t("source_none_waiting"))
        )
        running = [e for e, on in ((ac_entity, rt.get("ac_running", True)), (floor_entity, floor_on)) if on]
        zdata["src_cmd"] = {"ac": bool(rt.get("ac_running", True)), "floor": bool(floor_on)}
        zdata["actual_action"] = self._resolve_action(running, bool(running), "heating") if running else "idle"

    # ------------------------------------------------------------- kaskada FVE

    def _pv_priority(self, zone_id: str) -> int:
        state = self.hass.states.get(pv_priority_entity_id(zone_id))
        try:
            return int(state.state) if state and state.state not in ("unknown", "unavailable") else 1
        except (TypeError, ValueError):
            return 1

    def _zone_current_temp(self, zone: dict):
        if zone.get(CONF_EXTERNAL_TEMP_ENTITY):
            return self._state_float(zone[CONF_EXTERNAL_TEMP_ENTITY])
        state = self.hass.states.get(zone[CONF_CLIMATE_ENTITY])
        try:
            value = state.attributes.get("current_temperature") if state else None
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def _pv_participants(self) -> dict[str, int]:
        """{zone_id: priorita} pre zony, ktore FVE prebytok vyuzivaju (nie Vypnute)."""
        tiers: dict[str, int] = {}
        for zone_id in self.zones:
            if not self._state_bool(switch_entity_id(zone_id, "vyuzi_fve_prebytok"), True):
                continue
            mode_state = self.hass.states.get(mode_entity_id(zone_id))
            if mode_state is not None and mode_state.state == MODE_VYPNUTE:
                continue
            tiers[zone_id] = self._pv_priority(zone_id)
        return tiers

    # --------------------------------------------- FVE prebytok podla vykonu

    def _pv_auto_enabled(self) -> bool:
        opt = self.entry.options
        return bool(opt.get(CONF_PV_AUTO)) and bool(
            opt.get(CONF_GRID_POWER_ENTITY) or opt.get(CONF_BATTERY_POWER_ENTITY)
        )

    def _pv_engine_state(self) -> dict:
        return self._global_rt.setdefault(
            "pv_engine", {"tier": 0, "add_since": None, "bad_since": None, "reason": None, "values": {}}
        )

    def _pv_param(self, key: str) -> float:
        try:
            return float(self.entry.options.get(key, PV_ENGINE_NUMBERS[key][4]))
        except (TypeError, ValueError):
            return float(PV_ENGINE_NUMBERS[key][4])

    def _pv_engine_step(self) -> int:
        """Jeden krok kaskady podla vykonu. Vrati novu aktivnu prioritu (0 = nic).

        Pridanie: dostupny prebytok (export + nabijanie baterie nad pv_start_soc)
        >= pv_add_power nepretrzite pv_add_minutes -> dalsia priorita.
        Odobratie: vybijanie baterie alebo odber zo siete nad pv_shed_power, alebo
        vyroba pod pv_min_power, nepretrzite pv_shed_minutes -> najnizsia aktivna
        priorita sa odpoji; ak to trva dalej, po rovnakom case dalsia.
        Pod pv_stop_soc sa vypne vsetko hned."""
        opt = self.entry.options
        eng = self._pv_engine_state()
        now = dt_util.now()

        pv = self._state_float(opt.get(CONF_PV_POWER_ENTITY))
        grid = self._state_float(opt.get(CONF_GRID_POWER_ENTITY))
        bat = self._state_float(opt.get(CONF_BATTERY_POWER_ENTITY))
        soc = self._state_float(opt.get(CONF_BATTERY_SOC_ENTITY))
        # normalizacia: grid + = odber, - = export; bateria + = nabijanie, - = vybijanie
        if grid is not None and not opt.get(CONF_GRID_EXPORT_NEGATIVE, True):
            grid = -grid
        if bat is not None and not opt.get(CONF_BATTERY_CHARGE_POSITIVE, True):
            bat = -bat
        export = max(0.0, -grid) if grid is not None else 0.0
        grid_import = max(0.0, grid) if grid is not None else 0.0
        charge = max(0.0, bat) if bat is not None else 0.0
        discharge = max(0.0, -bat) if bat is not None else 0.0
        charge_counts = soc is None or soc >= self._pv_param("pv_start_soc")
        available = export + (charge if charge_counts else 0.0)
        eng["values"] = {
            "pv": pv, "export": export, "import": grid_import, "battery": bat, "soc": soc, "available": available,
        }

        levels = sorted(set(self._pv_participants().values()))
        tier = eng["tier"]
        if tier and tier not in levels:
            lower = [lvl for lvl in levels if lvl < tier]
            tier = lower[-1] if lower else 0

        def reset():
            eng["add_since"] = None
            eng["bad_since"] = None

        if not levels:
            tier, eng["reason"] = 0, "no_zones"
            reset()
        elif soc is not None and soc < self._pv_param("pv_stop_soc"):
            tier, eng["reason"] = 0, "low_soc"
            reset()
        elif grid is None and bat is None:
            eng["reason"] = "no_data"          # bez dat nic nemenime
            reset()
        else:
            shed = self._pv_param("pv_shed_power")
            bad = []
            if discharge > shed:
                bad.append("battery")
            if grid_import > shed:
                bad.append("import")
            if pv is not None and pv < self._pv_param("pv_min_power"):
                bad.append("low_pv")
            nxt = next((lvl for lvl in levels if lvl > tier), None)
            if bad and tier > 0:
                eng["add_since"] = None
                eng["bad_since"] = eng["bad_since"] or now
                eng["reason"] = "shed:" + ",".join(bad)
                if now - eng["bad_since"] >= timedelta(minutes=self._pv_param("pv_shed_minutes")):
                    lower = [lvl for lvl in levels if lvl < tier]
                    tier = lower[-1] if lower else 0
                    eng["bad_since"] = now if tier else None   # dalsia priorita az po dalsom intervale
            elif not bad and nxt is not None and available >= self._pv_param("pv_add_power"):
                eng["bad_since"] = None
                eng["add_since"] = eng["add_since"] or now
                eng["reason"] = "add"
                if now - eng["add_since"] >= timedelta(minutes=self._pv_param("pv_add_minutes")):
                    tier = nxt
                    eng["add_since"] = now if next((lvl for lvl in levels if lvl > tier), None) else None
            else:
                eng["reason"] = "hold"
                reset()
        eng["tier"] = tier
        return tier

    async def _pv_engine_tick(self, _now=None) -> None:
        if not self._pv_auto_enabled():
            return
        before = self._pv_engine_state()["tier"]
        after = self._pv_engine_step()
        if after != before:
            await self.async_recompute_and_apply()
        elif isinstance(self.data, dict):
            self.data["pv_engine"] = self._pv_snapshot(after >= 1)
            self.async_update_listeners()

    def _pv_snapshot(self, pv_surplus) -> dict:
        """Stav pre senzor sensor.smart_heating_fve_kaskada a prehladovu kartu."""
        if not self._pv_auto_enabled():
            tier = self._global_rt.get("pv_tier") if pv_surplus else 0
            return {"mode": "switch", "tier": tier or 0}
        eng = self._pv_engine_state()
        now = dt_util.now()

        def remaining(since, key):
            if since is None:
                return None
            left = self._pv_param(key) - (now - since).total_seconds() / 60
            return max(0, round(left, 1))

        return {
            "mode": "power",
            "tier": eng["tier"],
            "reason": eng.get("reason"),
            "add_in_min": remaining(eng.get("add_since"), "pv_add_minutes"),
            "shed_in_min": remaining(eng.get("bad_since"), "pv_shed_minutes"),
            **{k: (round(v) if isinstance(v, float) else v) for k, v in eng.get("values", {}).items()},
        }

    def _pv_cascade(self, pv_surplus) -> dict[str, bool]:
        """Vrati {zone_id: smie_kurit_z_FVE} pre zony, ktore FVE vyuzivaju.

        Zony s prioritou 1 kuria z prebytku hned. Dalsia priorita sa prida, az ked
        su vsetky zony vyssich priorit nahriate (FVE ciel - PV_SATISFIED_MARGIN)
        aspon PV_CASCADE_DELAY. Ked niektora vyssia vychladne o viac ako
        PV_RELEASE_GAP, nizsie priority sa odpoja hned. Zona, ktora prebytok
        aktualne vyuzit nemoze (prehriata podlaha, krb, chladenie), sa berie ako
        nahriata, aby neblokovala ostatne."""
        grt = self._global_rt
        if not pv_surplus:
            grt["pv_tier"] = None
            grt["pv_sat_since"] = None
            return {}

        tiers = self._pv_participants()
        if not tiers:
            return {}

        levels = sorted(set(tiers.values()))
        active = grt.get("pv_tier")
        if active not in levels:
            active = levels[0]
        prev = self.data.get("zones", {}) if isinstance(self.data, dict) else {}

        def gap(zone_id):
            """FVE ciel - aktualna teplota (kladne = pod cielom); None = nevieme/nemoze."""
            z = prev.get(zone_id)
            if not z or z.get("season") != SEASON_KURENIE or z.get("floor_override") or z.get("krb_override"):
                return None
            target = z.get("pv_target")
            current = self._zone_current_temp(self.zones[zone_id])
            if target is None or current is None:
                return None
            return target - current

        # odpojenie: vyssia priorita vychladla -> zostan na nej
        for level in levels:
            if level >= active:
                break
            if any((g := gap(z)) is not None and g > PV_RELEASE_GAP for z, t in tiers.items() if t == level):
                active = level
                grt["pv_sat_since"] = None
                break

        # pridanie dalsej priority: vsetky doterajsie su nahriate dost dlho
        nxt = next((lvl for lvl in levels if lvl > active), None)
        satisfied = all(
            (g := gap(z)) is None or g <= PV_SATISFIED_MARGIN for z, t in tiers.items() if t <= active
        )
        now = dt_util.now()
        if nxt is not None and satisfied:
            since = grt.get("pv_sat_since") or now
            grt["pv_sat_since"] = since
            if now - since >= PV_CASCADE_DELAY:
                active = nxt
                grt["pv_sat_since"] = None
        else:
            grt["pv_sat_since"] = None

        grt["pv_tier"] = active
        return {z: t <= active for z, t in tiers.items()}

    # ------------------------------------------------------------- merace spotreby

    def _zone_sources(self, zone: dict) -> list[dict]:
        """Zdroje zony s meracmi: [{key, device, power[], energy[]}] + 'other' zo vseobecnych zoznamov."""
        devices = {"floor": zone.get(CONF_CLIMATE_ENTITY), "ac": zone.get(CONF_AC_ENTITY), "radiator": zone.get(CONF_RADIATOR_ENTITY)}
        out = []
        for key, (pk, ek) in SOURCE_METERS.items():
            power, energy = list(zone.get(pk) or []), list(zone.get(ek) or [])
            if power or energy:
                out.append({"key": key, "device": devices[key], "power": power, "energy": energy})
        if zone.get(CONF_POWER_ENTITIES) or zone.get("energy_entities"):
            out.append({"key": "other", "device": None,
                        "power": list(zone.get(CONF_POWER_ENTITIES) or []), "energy": list(zone.get("energy_entities") or [])})
        return out

    def _power_w(self, entity_id):
        state = self.hass.states.get(entity_id) if entity_id else None
        if state is None or state.state in ("unknown", "unavailable"):
            return None
        try:
            value = float(state.state)
        except (TypeError, ValueError):
            return None
        unit = str(state.attributes.get("unit_of_measurement") or "W").lower()
        return value * 1000 if unit == "kw" else value

    def _device_meter(self, device_entity):
        """Meracie entity prikonu pre zariadenie (termostat, klima, rele radiatora)."""
        if not device_entity:
            return None
        for zone in self.zones.values():
            for src in self._zone_sources(zone):
                if src["device"] == device_entity and src["power"]:
                    return src["power"]
        return None

    def _meter_on(self, power_entities):
        """True/False podla prikonu (> METER_ON_W), None ked merac nie je alebo nic nehlasi."""
        if not power_entities:
            return None
        values = [w for w in (self._power_w(e) for e in power_entities) if w is not None]
        return any(w > METER_ON_W for w in values) if values else None

    def _meter_check(self, zone_id: str, zdata: dict) -> list[tuple[str, str]]:
        """Rozpor medzi zariadenim a meracom dlhsie ako 10 min: hlasi kurenie, ale taha 0 W
        (vypadnuty ohrev) / ma byt vypnute, ale taha (zaseknute rele)."""
        rt = self._rt(zone_id)
        since = rt.setdefault("meter_since", {})
        now = dt_util.now()
        cmd = zdata.get("src_cmd") or {}
        found: list[tuple[str, str]] = []
        active = set()
        for src in self._zone_sources(self.zones.get(zone_id, {})):
            key = src["key"]
            if key == "other" or not src["power"] or key not in cmd:
                continue
            values = [w for w in (self._power_w(e) for e in src["power"]) if w is not None]
            if not values:
                continue
            power = sum(values)
            reported = self._device_action(src["device"])
            expect_on = cmd[key] if key == "radiator" else (reported in ("heating", "cooling") if reported else None)
            issue = None
            if expect_on and power <= METER_ON_W:
                issue = ("nopower", self._t("diag_meter_no_power", source=self._t(f"src_{key}")))
            elif cmd[key] is False and power > METER_STUCK_W:
                issue = ("stuck", self._t("diag_meter_stuck", source=self._t(f"src_{key}"), power=round(power)))
            if issue:
                pkey = f"meter:{key}:{issue[0]}"
                active.add(pkey)
                since.setdefault(pkey, now)
                if now - since[pkey] >= METER_CHECK_AFTER:
                    found.append((pkey, issue[1]))
        for pkey in list(since):
            if pkey not in active:
                since.pop(pkey)
        return found

    async def _fast_tick(self, _now=None) -> None:
        """Kazdych 30 s: kaskada FVE, energia z FVE a prepocet len pri zmene stavu meracov."""
        await self._pv_engine_tick()
        self._accumulate_pv_energy()
        meters = {}
        for zone in self.zones.values():
            for src in self._zone_sources(zone):
                for entity_id in src["power"]:
                    on = self._meter_on([entity_id])
                    if on is not None:
                        meters[entity_id] = on
        if meters != self._meter_cache:
            self._meter_cache = meters
            await self.async_recompute_and_apply()
        elif isinstance(self.data, dict):
            self.async_update_listeners()

    def _accumulate_pv_energy(self) -> None:
        """Energia kurenia v case, ked zony kurili z FVE prebytku (pv_active), z prikonu.
        Zaklad pre 'podiel z FVE' v statistikach."""
        now = dt_util.now()
        last, self._pv_energy_at = self._pv_energy_at, now
        if last is None or not isinstance(self.data, dict):
            return
        hours = (now - last).total_seconds() / 3600
        if hours <= 0 or hours > 0.25:     # po vypadku neodhadujeme dlhe useky
            return
        watts = 0.0
        for zone_id, zdata in self.data.get("zones", {}).items():
            if not zdata.get("pv_active"):
                continue
            for src in self._zone_sources(self.zones.get(zone_id, {})):
                watts += sum(w for w in (self._power_w(e) for e in src["power"]) if w is not None)
        self._pv_energy_kwh += watts * hours / 1000

    # ------------------------------------------------------------- radiator + podlaha

    async def _apply_switch(self, entity_id, on: bool) -> None:
        """Rele radiatora (switch / input_boolean / light) - prikaz len pri zmene."""
        if not entity_id:
            return
        state = self.hass.states.get(entity_id)
        if state is None or state.state == ("on" if on else "off"):
            return
        await self.hass.services.async_call(
            "homeassistant", "turn_on" if on else "turn_off", {"entity_id": entity_id}, blocking=False,
        )

    async def _apply_radiator_floor(self, zone_id: str, zdata: dict) -> None:
        """Dve nezavisle regulacie v jednej zone (kupelna):
        - radiator (rele) drzi teplotu VZDUCHU: zapne pod cielom - hystereza, vypne na cieli,
        - podlaha drzi teplotu PODLAHY: nabehne pod floor_min (zdata['floor_guard']),
          aj ked je vzduch dost teply. Prehriata podlaha blokuje len podlahu."""
        rt = self._rt(zone_id)
        radiator = zdata.get("radiator_entity")
        floor_entity = zdata["climate_entity"]

        if not zdata["heating_allowed"]:
            rt["rad_on"] = False
            await self._apply_switch(radiator, False)
            await self._apply_device(floor_entity, "off", None)
            zdata["heat_source"] = self._t("source_none")
            zdata["actual_action"] = "idle"
            zdata["src_cmd"] = {"radiator": False, "floor": False}
            return

        hyst = self._state_float(
            number_entity_id(zone_id, "radiator_hysterezia"), RADIATOR_NUMBER_DEFS["radiator_hysterezia"][4]
        ) or 0.0
        cur, tgt = zdata["current_temperature"], zdata["target_temperature"]
        if cur is None or tgt is None:
            rt["rad_on"] = False  # bez teploty vzduchu rele naslepo nezapiname
        elif cur >= tgt:
            rt["rad_on"] = False
        elif cur <= tgt - hyst:
            rt["rad_on"] = True
        rad_on = bool(rt.get("rad_on"))
        floor_on = bool(zdata.get("floor_guard")) and not zdata.get("floor_override")

        await self._apply_switch(radiator, rad_on)
        await self._apply_device(
            floor_entity, "heat" if floor_on else "off", zdata.get("floor_max") if floor_on else None
        )

        if rad_on and floor_on:
            zdata["heat_source"] = self._t("source_radiator_floor")
        elif rad_on:
            zdata["heat_source"] = self._t("source_radiator")
        elif floor_on:
            zdata["heat_source"] = self._t("source_floor_min")
        else:
            zdata["heat_source"] = self._t("source_none")
        zdata["src_cmd"] = {"radiator": rad_on, "floor": floor_on}
        floor_action = self._resolve_action([floor_entity], floor_on, "heating") if floor_on else "idle"
        rad_meter = self._meter_on(self._device_meter(radiator))
        rad_running = rad_on if rad_meter is None else rad_meter
        zdata["actual_action"] = "heating" if rad_running or floor_action == "heating" else "idle"

    # ------------------------------------------------------------------ diagnostika

    def _friendly(self, entity_id: str) -> str:
        st = self.hass.states.get(entity_id)
        return (st.attributes.get("friendly_name") if st else None) or entity_id

    def _diag_static(self, zone_id: str, zone: dict, zdata: dict) -> list[tuple[str, str]]:
        """Nedostupne zariadenia/senzory a nezmyselne hodnoty. Vracia [(kluc, text)]."""
        rt = self._rt(zone_id)
        now = dt_util.now()
        since = rt.setdefault("unavail_since", {})
        problems: list[tuple[str, str]] = []
        keys = (CONF_CLIMATE_ENTITY, CONF_AC_ENTITY, CONF_RADIATOR_ENTITY, CONF_EXTERNAL_TEMP_ENTITY, CONF_FLOOR_TEMP_ENTITY)
        for entity_id in [zone.get(k) for k in keys if zone.get(k)]:
            state = self.hass.states.get(entity_id)
            bad = state is None or state.state in ("unknown", "unavailable")
            if bad:
                since.setdefault(entity_id, now)
                if now - since[entity_id] >= DIAG_UNAVAILABLE_AFTER:
                    problems.append((f"unavailable:{entity_id}", self._t("diag_unavailable", entity=self._friendly(entity_id))))
            else:
                since.pop(entity_id, None)

        def out_of(value, rng):
            try:
                v = float(value)
            except (TypeError, ValueError):
                return False
            return not (rng[0] <= v <= rng[1])

        if out_of(zdata.get("current_temperature"), DIAG_AIR_RANGE):
            problems.append(("implausible_air", self._t("diag_implausible_air", value=zdata["current_temperature"])))
        if out_of(zdata.get("floor_temperature"), DIAG_FLOOR_RANGE):
            problems.append(("implausible_floor", self._t("diag_implausible_floor", value=zdata["floor_temperature"])))
        return problems

    def _diag_dynamic_and_notify(self, zone_id: str, zdata: dict) -> None:
        """Doplni 'zona sa dlho nevie dohriat' a posle notifikacie pri vzniku/zaniku poruchy."""
        rt = self._rt(zone_id)
        now = dt_util.now()
        problems = list(zdata.get("diag_static", []))

        cur, tgt = zdata.get("current_temperature"), zdata.get("target_temperature")
        try:
            slow = (
                zdata.get("heating_allowed") and zdata.get("season") == SEASON_KURENIE
                and cur is not None and tgt is not None and float(cur) < float(tgt) - DIAG_SLOW_GAP
            )
        except (TypeError, ValueError):
            slow = False
        if slow:
            rt.setdefault("slow_since", now)
            if rt["slow_since"] is None:
                rt["slow_since"] = now
            if now - rt["slow_since"] >= DIAG_SLOW_AFTER:
                hours = int((now - rt["slow_since"]).total_seconds() // 3600)
                problems.append(("slow", self._t("diag_slow", hours=hours, current=cur, target=tgt)))
        else:
            rt["slow_since"] = None

        meter_problems = self._meter_check(zone_id, zdata)
        problems.extend(meter_problems)
        zdata["meter_problems"] = [msg for _, msg in meter_problems]
        zdata["problems"] = [msg for _, msg in problems]

        current = dict(problems)
        notified: dict = rt.setdefault("diag_notified", {})
        if dt_util.now() - self._startup_time < NOTIFY_STARTUP_GRACE:
            rt["diag_notified"] = current  # po starte len ticho zaznamenat zaklad
            return
        enabled = self.entry.options.get(CONF_NOTIFY_DIAGNOSTICS, True)
        name = zdata.get("name", zone_id)
        for key, msg in current.items():
            if key not in notified and enabled:
                self.hass.async_create_task(self._notify(self._t("notify_diag_problem", zone=name, problem=msg)))
        for key, msg in notified.items():
            if key not in current and enabled:
                self.hass.async_create_task(self._notify(self._t("notify_diag_ok", zone=name, problem=msg)))
        rt["diag_notified"] = current

    # ------------------------------------------------------- logovanie nabehov

    def _warmup_track(self, zone_id: str, zdata: dict) -> None:
        """Zaznamena nabeh: od zaciatku kurenia s aspon WARMUP_MIN_GAP °C deficitom
        po dosiahnutie ciela. Zaklad pre buduce adaptivne predkurenie."""
        rt = self._rt(zone_id)
        now = dt_util.now()
        cur, tgt = zdata.get("current_temperature"), zdata.get("target_temperature")
        try:
            cur = float(cur) if cur is not None else None
            tgt = float(tgt) if tgt is not None else None
        except (TypeError, ValueError):
            return
        run = rt.get("warmup")
        if run is None:
            if (
                zdata.get("actual_action") == "heating" and cur is not None and tgt is not None
                and tgt - cur >= WARMUP_MIN_GAP
            ):
                rt["warmup"] = {
                    "start": now, "from": cur, "target": tgt,
                    "outdoor": zdata.get("outdoor_temperature"), "source": zdata.get("heat_source"),
                }
            return
        if tgt is None or abs(tgt - run["target"]) > 0.01 or not zdata.get("heating_allowed"):
            rt["warmup"] = None  # zmena ciela alebo stop - nabeh sa nepocita
            return
        if cur is not None and cur >= run["target"]:
            minutes = (now - run["start"]).total_seconds() / 60
            if minutes >= WARMUP_MIN_MINUTES:
                record = {
                    "start": run["start"].isoformat(), "minutes": round(minutes, 1),
                    "from": run["from"], "to": run["target"],
                    "outdoor": run["outdoor"], "source": run["source"],
                }
                runs = self._warmup_data.setdefault(zone_id, [])
                runs.append(record)
                del runs[:-WARMUP_KEEP]
                self._warmup_store.async_delay_save(lambda: self._warmup_data, 60)
            rt["warmup"] = None

    def _warmup_summary(self, zone_id: str):
        """(median minut na 1 °C, pocet nabehov) z ulozenych nabehov zony."""
        rates = []
        for r in self._warmup_data.get(zone_id, []):
            delta = (r.get("to") or 0) - (r.get("from") or 0)
            if delta >= WARMUP_MIN_GAP and r.get("minutes"):
                rates.append(r["minutes"] / delta)
        if not rates:
            return None, len(self._warmup_data.get(zone_id, []))
        rates.sort()
        mid = len(rates) // 2
        median = rates[mid] if len(rates) % 2 else (rates[mid - 1] + rates[mid]) / 2
        return round(median), len(self._warmup_data.get(zone_id, []))

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
        if self._unsub_pv_engine:
            self._unsub_pv_engine()
            self._unsub_pv_engine = None
