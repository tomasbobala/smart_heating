"""Runtime (backend-generated) translations - reason texts, heat source labels,
notification messages. Independent from the card's own client-side i18n."""
from __future__ import annotations

LANG_AUTO = "auto"

TEXTS: dict[str, dict[str, str]] = {
    # --- manual/auto reasons ---
    "reason_boost": {"en": "Boost active", "sk": "Boost aktívny"},
    "reason_off_mode": {"en": "Off mode", "sk": "Režim Vypnuté"},
    "reason_manual_day": {"en": "Manual mode: Day", "sk": "Manuálny režim Deň"},
    "reason_manual_night": {"en": "Manual mode: Night", "sk": "Manuálny režim Noc"},
    "reason_manual_min": {"en": "Manual mode: Min", "sk": "Manuálny režim Min"},
    "reason_manual_frost": {
        "en": "Manual mode: Frost (frost protection)",
        "sk": "Manuálny režim Mráz (protimrazová ochrana)",
    },
    "reason_auto_holiday": {"en": "Auto: holiday/away -> Min", "sk": "Auto: dovolenka/neprítomnosť -> Min"},
    "reason_auto_presence": {"en": "Auto: someone is home -> {mode}", "sk": "Auto: prítomnosť doma -> {mode}"},
    "reason_auto_preheat": {
        "en": "Auto: pre-heating before arrival -> {mode}",
        "sk": "Auto: predkúrenie pred príchodom -> {mode}",
    },
    "reason_auto_cold_outdoor": {
        "en": "Auto: low outdoor temperature -> {mode}",
        "sk": "Auto: nízka vonkajšia teplota -> {mode}",
    },
    "reason_auto_away": {
        "en": "Auto: nobody home, outside pre-heating window -> Min",
        "sk": "Auto: nikto doma, mimo predkúrenia -> Min",
    },

    "mode_day": {"en": "Day", "sk": "Deň"},
    "mode_night": {"en": "Night", "sk": "Noc"},

    # --- safety/override layers ---
    "reason_tariff_blocked": {
        "en": "Blocked by tariff (high tariff)",
        "sk": "Zablokované tarifou (vysoká tarifa)",
    },
    "reason_floor_stop": {
        "en": "STOP: floor temperature {floor_temp}°C >= max {floor_max}°C",
        "sk": "STOP: teplota podlahy {floor_temp}°C >= max {floor_max}°C",
    },
    "reason_krb_stop": {
        "en": "STOP: fireplace temperature {fireplace_temp}°C >= {krb_threshold}°C",
        "sk": "STOP: teplota pri krbe {fireplace_temp}°C >= {krb_threshold}°C",
    },
    "reason_pv_active": {
        "en": "Solar surplus - heating to make the most of solar energy",
        "sk": "FVE prebytok - kúrenie pre maximálne využitie solárnej energie",
    },
    "reason_emergency": {
        "en": "EMERGENCY PROTECTION: {current_temp}°C < {emergency_temp}°C (overrides tariff)",
        "sk": "NÚDZOVÁ OCHRANA: {current_temp}°C < {emergency_temp}°C (preráža tarifu)",
    },

    # --- cooling ---
    "reason_cool_no_battery": {
        "en": "Cooling: solar battery not configured/available -> off",
        "sk": "Chladenie: batérka FVE nie je nastavená/dostupná -> vypnuté",
    },
    "reason_cool_battery_low": {
        "en": "Cooling: battery {battery}% < threshold {threshold}% -> off",
        "sk": "Chladenie: batérka {battery}% < hranica {threshold}% -> vypnuté",
    },
    "reason_cool_battery_ok": {
        "en": "Cooling: battery {battery}% >= threshold {threshold}%",
        "sk": "Chladenie: batérka {battery}% >= hranica {threshold}%",
    },
    "reason_cool_temp_active": {
        "en": "Cooling: thermometer {current_temp}°C >= target {target}°C (battery {battery}% OK)",
        "sk": "Chladenie: teplomer {current_temp}°C >= cieľ {target}°C (batérka {battery}% OK)",
    },
    "reason_cool_temp_satisfied": {
        "en": "Cooling: thermometer {current_temp}°C already below target {target}°C -> off",
        "sk": "Chladenie: teplomer {current_temp}°C už pod cieľom {target}°C -> vypnuté",
    },

    # --- heat source labels ---
    "source_none": {"en": "None", "sk": "Žiadny"},
    "source_floor": {"en": "Floor", "sk": "Podlaha"},
    "source_ac_floor": {"en": "AC + Floor", "sk": "AC + Podlaha"},
    "source_ac": {"en": "AC", "sk": "AC"},
    "source_none_waiting": {"en": "None (AC waiting)", "sk": "Žiadny (AC čaká)"},

    # --- notifications: global (one for the whole house) ---
    "notif_tariff_start": {
        "en": "Global: heating blocked by high tariff.",
        "sk": "Globálny stav: kúrenie zablokované vysokou tarifou.",
    },
    "notif_tariff_stop": {
        "en": "Global: tariff dropped, heating restored.",
        "sk": "Globálny stav: tarifa klesla, kúrenie obnovené.",
    },
    "notif_holiday_start": {
        "en": "Holiday mode activated - all zones to Min.",
        "sk": "Dovolenka aktivovaná - všetky zóny na Min.",
    },
    "notif_holiday_stop": {"en": "Holiday mode ended.", "sk": "Dovolenka ukončená."},
    "notif_krb_start": {
        "en": "Fireplace: heating turned off in zones: {zones}.",
        "sk": "Krb: kúrenie vypnuté v zónach: {zones}.",
    },
    "notif_krb_stop": {
        "en": "Fireplace: heating restored in all zones.",
        "sk": "Krb: kúrenie obnovené vo všetkých zónach.",
    },
    "notif_emergency_start": {
        "en": "Emergency protection activated in zones: {zones}!",
        "sk": "Núdzová ochrana aktivovaná v zónach: {zones}!",
    },
    "notif_emergency_stop": {
        "en": "Emergency protection ended in all zones.",
        "sk": "Núdzová ochrana ukončená vo všetkých zónach.",
    },

    # --- notifications: per zone ---
    "notif_floor_start": {
        "en": "{zone}: heating off - floor reached max temperature {temp}.",
        "sk": "{zone}: kúrenie vypnuté - podlaha dosiahla max. teplotu {temp}.",
    },
    "notif_floor_stop": {
        "en": "{zone}: floor cooled down, heating restored.",
        "sk": "{zone}: podlaha vychladla, kúrenie obnovené.",
    },
    "notif_preheat_start": {
        "en": "{zone}: pre-heating started before arrival.",
        "sk": "{zone}: predkúrenie spustené pred príchodom.",
    },
    "notif_preheat_stop": {
        "en": "{zone}: pre-heating ended, nobody home.",
        "sk": "{zone}: predkúrenie ukončené, nikto nie je doma.",
    },
    "notif_cold_outdoor_start": {
        "en": "{zone}: low outdoor temperature forced heating.",
        "sk": "{zone}: nízka vonkajšia teplota vynútila kúrenie.",
    },
    "notif_cold_outdoor_stop": {
        "en": "{zone}: outdoor temperature rose, forced heating ended.",
        "sk": "{zone}: vonkajšia teplota stúpla, vynútené kúrenie ukončené.",
    },
    "notif_cooling_start": {
        "en": "{zone}: cooling started (battery {battery}, target {target}).",
        "sk": "{zone}: chladenie spustené (batéria {battery}, cieľ {target}).",
    },
    "notif_cooling_stop": {"en": "{zone}: cooling stopped.", "sk": "{zone}: chladenie zastavené."},
    "notif_ac_backup_start": {
        "en": "{zone}: AC can't keep up, floor engaged as backup.",
        "sk": "{zone}: AC nestíha, podlaha zapojená ako dokurovanie.",
    },
    "notif_ac_backup_stop": {
        "en": "{zone}: floor off, AC keeping up on its own again.",
        "sk": "{zone}: podlaha vypnutá, AC opäť stíha samo.",
    },
    "notif_boost": {
        "en": "Boost activated in zone {zone} for {hours} h.",
        "sk": "Boost aktivovaný v zóne {zone} na {hours} h.",
    },
}


def resolve_lang(hass, configured: str | None) -> str:
    """'auto' (alebo nenastavene) sleduje jazyk HA instancie, inak explicitne en/sk."""
    if configured in ("en", "sk"):
        return configured
    lang = getattr(getattr(hass, "config", None), "language", None) or "en"
    return "sk" if lang.lower().startswith("sk") else "en"


def t(lang: str, key: str, **kwargs) -> str:
    entry = TEXTS.get(key)
    if not entry:
        return key
    text = entry.get(lang) or entry.get("en") or key
    if kwargs:
        text = text.format(**kwargs)
    return text
