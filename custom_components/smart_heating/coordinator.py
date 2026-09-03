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
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

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
    CONF_MANUAL_PRESENCE_ENTITIES,
    CONF_NOTIFY_AC_BACKUP,
    CONF_NOTIFY_BOOST,
    CONF_NOTIFY_COLD_OUTDOOR,
    CONF_NOTIFY_COOLING,
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
    CONF_TARIFF_ENTITY,
    CONF_USE_FIREPLACE_GUARD,
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
    OPT_ZONES,
    SEASON_AUTO,
    SEASON_CHLADENIE,
    SEASON_KURENIE,
    SWITCH_DEFS,
    TIME_DEFS,
    ZONE_TYPE_FLOOR_AC,
)

_LOGGER = logging.getLogger(__name__)

RECOMPUTE_INTERVAL = timedelta(minutes=5)
NOTIFY_STARTUP_GRACE = timedelta(minutes=3)


def mode_entity_id(zone_id: str) -> str:
    return f"select.smart_heating_{zone_id}_rezim"


def season_entity_id(zone_id: str) -> str:
    return f"select.smart_heating_{zone_id}_sezona"


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
        # runtime stav, ktory neprezije restart HA (zamerne - boost/deficit su kratkodobe)
        self._runtime: dict[str, dict] = {}
        self._global_rt: dict = {"tariff_blocked": False, "holiday_active": False, "krb_zones": set(), "emergency_zones": set()}
        self._startup_time = dt_util.now()

    @property
    def zones(self) -> dict:
        return self.entry.options.get(OPT_ZONES, {})

    def _rt(self, zone_id: str) -> dict:
        return self._runtime.setdefault(
            zone_id,
            {"boost_until": None, "ac_deficit_since": None, "prev_raw_mode": None},
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
        for key in (CONF_OUTDOOR_SENSOR, CONF_TARIFF_ENTITY, CONF_FIREPLACE_TEMP_ENTITY, CONF_PV_SURPLUS_ENTITY, CONF_BATTERY_SOC_ENTITY):
            if opt.get(key):
                ids.append(opt[key])

        for zone_id, zone in self.zones.items():
            ids.append(zone[CONF_CLIMATE_ENTITY])
            if zone.get(CONF_AC_ENTITY):
                ids.append(zone[CONF_AC_ENTITY])
            if zone.get(CONF_FLOOR_TEMP_ENTITY):
                ids.append(zone[CONF_FLOOR_TEMP_ENTITY])
            ids.extend(zone.get(CONF_PRESENCE_ENTITIES, []))
            ids.extend(zone.get(CONF_MANUAL_PRESENCE_ENTITIES, []))
            ids.append(mode_entity_id(zone_id))
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
            await self._notify(f"Boost aktivovaný v zóne {zone_name} na {hours} h.")
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

        holiday_active = bool(opt.get(CONF_HOLIDAY_ACTIVE, False))
        emergency_temp = opt.get(CONF_NUDZOVA_TEPLOTA, DEFAULT_EMERGENCY_TEMP)
        krb_threshold = opt.get(CONF_KRB_THRESHOLD, DEFAULT_FIREPLACE_THRESHOLD)
        fireplace_temp = self._state_float(opt.get(CONF_FIREPLACE_TEMP_ENTITY))
        pv_surplus = self._state_bool(opt.get(CONF_PV_SURPLUS_ENTITY), False)
        battery_soc = self._state_float(opt.get(CONF_BATTERY_SOC_ENTITY))

        now_t = dt_util.now().time()
        weekday = dt_util.now().weekday()  # 0=Po ... 6=Ne

        zones_data = {
            zone_id: self._compute_zone(
                zone_id, zone, tariff_ok, holiday_active, emergency_temp,
                krb_threshold, fireplace_temp, pv_surplus, battery_soc, outdoor, now_t, weekday,
            )
            for zone_id, zone in self.zones.items()
        }

        self._process_global_notifications(tariff_ok, holiday_active, zones_data)

        return {
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
            use_krb and fireplace_temp is not None
            and krb_threshold is not None and fireplace_temp >= krb_threshold
        ):
            heating_allowed = False
            krb_override = True
            reason = f"STOP: teplota pri krbe {fireplace_temp}\u00b0C >= {krb_threshold}\u00b0C"

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

        self._maybe_notify(zone_id, zone[CONF_ZONE_NAME], mode, floor_override, floor_temp, preheat_active, cold_outdoor_active, presence)

        device_mode = "heat" if heating_allowed else "off"

        return {
            "name": zone[CONF_ZONE_NAME],
            "zone_type": zone.get(CONF_ZONE_TYPE, "floor"),
            "season": SEASON_KURENIE,
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
            reason = "Rezim Vypnute"
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
                    reason = "Chladenie: baterka FVE nie je nastavena/dostupna -> vypnute"
                else:
                    reason = f"Chladenie: baterka {battery_soc}% < hranica {threshold}% -> vypnute"
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
                    reason = f"Chladenie: teplomer {current_temp}\u00b0C >= ciel {cool_target}\u00b0C (baterka {battery_soc}% OK)"
                else:
                    reason = f"Chladenie: teplomer {current_temp}\u00b0C uz pod cielom {cool_target}\u00b0C -> vypnute"
            else:
                cooling_allowed = True
                rt["cool_running"] = True
                reason = f"Chladenie: baterka {battery_soc}% >= hranica {threshold}%"

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

    @staticmethod
    def _resolve_target(
        mode, den, noc, min_temp, mraz, comfort_target, comfort_mode,
        presence, preheat_active, cold_outdoor_active, holiday_active, boost_active,
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
        if cold_outdoor_active:
            return comfort_target, True, f"Auto: nizka vonkajsia teplota -> {comfort_mode}", comfort_mode
        return min_temp, True, "Auto: nikto doma, mimo predkurenia -> Min", MODE_MIN

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
            f"{zone_name}: kúrenie vypnuté - podlaha dosiahla max. teplotu {floor_temp_str}.",
            f"{zone_name}: podlaha vychladla, kúrenie obnovené.",
        )
        # "Predkurenie ukoncene" ma zmysel len ak sa tym realne nieco meni (nikto nie
        # je doma -> kurenie sa stiahne na Min). Ak je niekto doma, dovod kurenia sa
        # len ticho zmenil na "pritomnost" - nema zmysel o tom notifikovat.
        preheat_stop_msg = None if presence else f"{zone_name}: predkúrenie ukončené, nikto nie je doma."
        self._notify_bool_transition(
            rt, "notif_preheat", preheat_active and not is_vypnute, opt.get(CONF_NOTIFY_PREHEAT, True),
            f"{zone_name}: predkúrenie spustené pred príchodom.",
            preheat_stop_msg,
        )
        self._notify_bool_transition(
            rt, "notif_cold_outdoor", cold_outdoor_active and not is_vypnute, opt.get(CONF_NOTIFY_COLD_OUTDOOR, True),
            f"{zone_name}: nízka vonkajšia teplota vynútila kúrenie.",
            f"{zone_name}: vonkajšia teplota stúpla, vynútené kúrenie ukončené.",
        )

    def _maybe_notify_cooling(self, zone_id: str, zone_name: str, cooling_active: bool, battery_soc, target) -> None:
        rt = self._rt(zone_id)
        battery_str = f"{battery_soc}%" if battery_soc is not None else "?"
        target_str = f"{target}\u00b0C" if target is not None else "?"
        self._notify_bool_transition(
            rt, "notif_cooling", cooling_active, self.entry.options.get(CONF_NOTIFY_COOLING, True),
            f"{zone_name}: chladenie spustené (batéria {battery_str}, cieľ {target_str}).",
            f"{zone_name}: chladenie zastavené.",
        )

    def _maybe_notify_ac_backup(self, zone_id: str, zone_name: str, floor_engaged: bool) -> None:
        rt = self._rt(zone_id)
        self._notify_bool_transition(
            rt, "notif_ac_backup", floor_engaged, self.entry.options.get(CONF_NOTIFY_AC_BACKUP, True),
            f"{zone_name}: AC nestíha, podlaha zapojená ako dokurovanie.",
            f"{zone_name}: podlaha vypnutá, AC opäť stíha samo.",
        )

    def _process_global_notifications(self, tariff_ok: bool, holiday_active: bool, zones_data: dict) -> None:
        opt = self.entry.options
        grace = dt_util.now() - self._startup_time < NOTIFY_STARTUP_GRACE

        tariff_blocked = not tariff_ok
        if grace:
            self._global_rt["tariff_blocked"] = tariff_blocked
        elif tariff_blocked != self._global_rt["tariff_blocked"]:
            if opt.get(CONF_NOTIFY_TARIFF, True):
                msg = (
                    "Globálny stav: kúrenie zablokované vysokou tarifou."
                    if tariff_blocked else "Globálny stav: tarifa klesla, kúrenie obnovené."
                )
                self.hass.async_create_task(self._notify(msg))
            self._global_rt["tariff_blocked"] = tariff_blocked

        if grace:
            self._global_rt["holiday_active"] = holiday_active
        elif holiday_active != self._global_rt["holiday_active"]:
            if opt.get(CONF_NOTIFY_HOLIDAY, True):
                msg = "Dovolenka aktivovaná - všetky zóny na Min." if holiday_active else "Dovolenka ukončená."
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
                    f"Krb: kúrenie vypnuté v zónach: {', '.join(sorted(krb_zones))}."
                    if krb_zones else "Krb: kúrenie obnovené vo všetkých zónach."
                )
                self.hass.async_create_task(self._notify(msg))
            self._global_rt["krb_zones"] = krb_zones

        emergency_zones = {z["name"] for z in zones_data.values() if z.get("emergency_active")}
        if grace:
            self._global_rt["emergency_zones"] = emergency_zones
        elif emergency_zones != self._global_rt["emergency_zones"]:
            if opt.get(CONF_NOTIFY_EMERGENCY, True):
                msg = (
                    f"Núdzová ochrana aktivovaná v zónach: {', '.join(sorted(emergency_zones))}!"
                    if emergency_zones else "Núdzová ochrana ukončená vo všetkých zónach."
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

    async def _async_apply(self) -> None:
        for zone_id, zdata in self.data["zones"].items():
            if zdata["release_control"]:
                continue  # Vypnute uz dlhsie - nechavame zariadenie uplne na pokoji

            if zdata["zone_type"] == ZONE_TYPE_FLOOR_AC and zdata.get("ac_entity"):
                if zdata["season"] == SEASON_CHLADENIE:
                    await self._apply_device(zdata["ac_entity"], zdata["device_mode"], zdata["target_temperature"])
                    await self._apply_device(zdata["climate_entity"], "off", None)  # podlaha nikdy nechladi
                else:
                    await self._apply_floor_ac(zone_id, zdata)
            else:
                await self._apply_device(zdata["climate_entity"], zdata["device_mode"], zdata["target_temperature"])

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

        Ak ma zona nastaveny externy teplomer (vlastny senzor AC je nepresny), AC sa
        neriadi svojim vlastnym regulacnym okruhom - namiesto toho posielame pevny
        'ac_setpoint_teplota' (napr. 26°C, zarucene vysoko nad realny ciel) a MY sami
        rozhodujeme kedy ma bezat, na zaklade extern. teplomera s hysterezou."""
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
            zdata["heat_source"] = "Ziadny"
            return

        if zdata["has_external_temp"]:
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

        await self._apply_device(floor_entity, "heat" if floor_engaged else "off", target if floor_engaged else None)
        self._maybe_notify_ac_backup(zone_id, zdata["name"], floor_engaged)
        zdata["heat_source"] = "AC + Podlaha" if floor_engaged else ("AC" if rt.get("ac_running", True) else "Ziadny (AC caka)")

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
