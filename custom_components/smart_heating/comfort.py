"""Vlhkost a pocitova teplota - ciste vypocty bez Home Assistanta (lahko testovatelne).

Len sledovanie: integracia podla toho zatial neriadi.
"""
from __future__ import annotations

import math

# rozdiel absolutnej vlhkosti (g/m³), od ktoreho ma zmysel tvrdit, ze vetranie pomoze
VENT_MARGIN_G_M3 = 1.0


def vapor_pressure(temp_c: float, rh: float) -> float:
    """Ciastkovy tlak vodnej pary (hPa) - Magnusov vzorec (BoM / Steadman)."""
    return rh / 100.0 * 6.105 * math.exp(17.27 * temp_c / (237.7 + temp_c))


def apparent_temperature(temp_c: float, rh: float) -> float:
    """Pocitova teplota podla Steadmana (australsky BoM) bez vetra a slnka:
    AT = T + 0,33·e − 4,0. Pri 22 °C: 40 % → ~21,5 °C, 60 % → ~23,2 °C."""
    return temp_c + 0.33 * vapor_pressure(temp_c, rh) - 4.0


def dew_point(temp_c: float, rh: float) -> float:
    """Rosny bod (°C), Magnus-Tetens."""
    a, b = 17.27, 237.7
    rh = max(1e-3, min(100.0, rh))
    g = a * temp_c / (b + temp_c) + math.log(rh / 100.0)
    return b * g / (a - g)


def absolute_humidity(temp_c: float, rh: float) -> float:
    """Absolutna vlhkost (g vody na m³ vzduchu)."""
    e_pa = vapor_pressure(temp_c, rh) * 100.0
    return 2.1667 * e_pa / (273.15 + temp_c)


def ventilation_effect(in_temp, in_rh, out_temp, out_rh) -> str | None:
    """'helps' = vonku je v m³ menej vody, vetranie vlhkost v izbe znizi,
    'worse' = vonku je vody viac, vetranie ju zvysi, 'neutral' = zhruba rovnako,
    None = chybaju udaje. Percenta zvonku su zavadzajuce (studeny vzduch udrzi
    malo vody), preto sa porovnava absolutna vlhkost."""
    if None in (in_temp, in_rh, out_temp, out_rh):
        return None
    inside = absolute_humidity(in_temp, in_rh)
    outside = absolute_humidity(out_temp, out_rh)
    if outside <= inside - VENT_MARGIN_G_M3:
        return "helps"
    if outside >= inside:
        return "worse"
    return "neutral"
