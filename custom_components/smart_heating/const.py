"""Konstanty pre Smart Heating integraciu (v2)."""

DOMAIN = "smart_heating"

# ---- Hub config/options ----
CONF_OUTDOOR_SENSOR = "outdoor_sensor"
CONF_TARIFF_ENTITY = "tariff_entity"
CONF_FIREPLACE_TEMP_ENTITY = "fireplace_temp_entity"
CONF_NOTIFY_ENTITY = "notify_entity"
CONF_NOTIFY_TARIFF = "notify_tariff"
CONF_NOTIFY_FLOOR = "notify_floor"
CONF_NOTIFY_KRB = "notify_krb"
CONF_NOTIFY_EMERGENCY = "notify_emergency"
CONF_NOTIFY_BOOST = "notify_boost"
CONF_NOTIFY_COOLING = "notify_cooling"
CONF_NOTIFY_HOLIDAY = "notify_holiday"
CONF_NOTIFY_PREHEAT = "notify_preheat"
CONF_NOTIFY_AC_BACKUP = "notify_ac_backup"
CONF_NOTIFY_COLD_OUTDOOR = "notify_cold_outdoor"
CONF_NOTIFY_DIAGNOSTICS = "notify_diagnostics"
CONF_LANGUAGE = "language"
LANGUAGE_OPTIONS = ["auto", "en", "sk"]
OPT_NUMBER_RANGES = "number_ranges"
CONF_PV_SURPLUS_ENTITY = "pv_surplus_entity"
CONF_BATTERY_SOC_ENTITY = "battery_soc_entity"
CONF_KRB_THRESHOLD = "krb_threshold"
CONF_NUDZOVA_TEPLOTA = "nudzova_teplota"
CONF_HOLIDAY_ACTIVE = "holiday_active"
CONF_OUTDOOR_HUMIDITY = "outdoor_humidity_sensor"   # vonkajsia vlhkost (%) - len sledovanie
CONF_OUTDOOR_PRESSURE = "outdoor_pressure_sensor"   # vonkajsi tlak (hPa) - len sledovanie
CONF_NOTIFY_HUMIDITY = "notify_humidity"            # upozornenie na vysoku / nizku vlhkost v izbe

OPT_ZONES = "zones"

# ---- Zone config (strukturalne, cez config/options flow) ----
CONF_ZONE_NAME = "name"
CONF_ZONE_TYPE = "zone_type"
CONF_CLIMATE_ENTITY = "climate_entity"
CONF_AC_ENTITY = "ac_entity"
CONF_FLOOR_TEMP_ENTITY = "floor_temp_entity"
CONF_EXTERNAL_TEMP_ENTITY = "external_temp_entity"
CONF_PRESENCE_ENTITIES = "presence_entities"
CONF_MANUAL_PRESENCE_ENTITIES = "manual_presence_entities"
CONF_USE_FIREPLACE_GUARD = "use_fireplace_guard"
CONF_USE_FIXED_AC_SETPOINT = "use_fixed_ac_setpoint"
CONF_RADIATOR_ENTITY = "radiator_entity"
CONF_USE_FLOOR_MIN = "use_floor_min"
CONF_HUMIDITY_ENTITY = "humidity_entity"          # vlhkost v zone (%) - len sledovanie
# Spotreba zony: zoznamy entit (scitavaju sa, napr. podlaha + klima v jednej zone)
CONF_POWER_ENTITIES = "power_entities"     # prikon (W/kW)
CONF_ENERGY_ENTITIES = "energy_entities"   # energia (kWh/Wh) so statistikami
# Merace po zdrojoch (zoznamy - jeden zdroj moze mat aj viac okruhov)
SOURCE_METERS = {
    "floor": ("floor_power_entities", "floor_energy_entities"),
    "ac": ("ac_power_entities", "ac_energy_entities"),
    "radiator": ("radiator_power_entities", "radiator_energy_entities"),
}
METER_ON_W = 20          # zdroj kuri, ked taha viac
METER_STUCK_W = 50       # vypnuty zdroj, ktory taha viac = zaseknute rele
HDD_BASE_TEMP = 18.0     # zaklad stupnodni (°C)
# Vlhkost (len sledovanie, regulacia zatial nie)
HUMIDITY_HIGH = 65.0     # % - dlhsie nad = riziko plesne / rosenia
HUMIDITY_LOW = 30.0      # % - dlhsie pod = suchy vzduch
HUMIDITY_ALERT_MINUTES = 60

ZONE_TYPE_FLOOR = "floor"
ZONE_TYPE_FLOOR_AC = "floor_ac"
# Radiator (rele) drzi teplotu VZDUCHU, podlaha nezavisle drzi teplotu PODLAHY.
# Nie kaskada ako floor_ac - dve samostatne regulacie v jednej zone (kupelna).
ZONE_TYPE_RADIATOR_FLOOR = "radiator_floor"
ZONE_TYPES = [ZONE_TYPE_FLOOR, ZONE_TYPE_FLOOR_AC, ZONE_TYPE_RADIATOR_FLOOR]

# ---- Manualne rezimy zony ----
MODE_AUTO = "Auto"
MODE_DEN = "Den"
MODE_NOC = "Noc"
MODE_MIN = "Min"
MODE_MRAZ = "Mraz"
MODE_VYPNUTE = "Vypnute"
ZONE_MODES = [MODE_AUTO, MODE_DEN, MODE_NOC, MODE_MIN, MODE_MRAZ, MODE_VYPNUTE]

# ---- Sezona (len zony s klimatizaciou - typ floor_ac) ----
SEASON_KURENIE = "Kurenie"
SEASON_CHLADENIE = "Chladenie"
SEASON_AUTO = "Auto"
SEASONS = [SEASON_KURENIE, SEASON_CHLADENIE, SEASON_AUTO]

# ---- Kaskada FVE prebytku: 1 = najvyssia priorita ----
PV_PRIORITIES = ["1", "2", "3", "4", "5"]

# ---- FVE prebytok riadeny podla vykonu (nahradza prepinac FVE prebytku) ----
CONF_PV_AUTO = "pv_auto"
CONF_PV_POWER_ENTITY = "pv_power_entity"
CONF_GRID_POWER_ENTITY = "grid_power_entity"
CONF_BATTERY_POWER_ENTITY = "battery_power_entity"
CONF_GRID_EXPORT_NEGATIVE = "grid_export_negative"        # True: export do siete je zaporne cislo
CONF_BATTERY_CHARGE_POSITIVE = "battery_charge_positive"  # True: nabijanie baterie je kladne cislo
# key -> (min, max, step, unit, default)
PV_ENGINE_NUMBERS = {
    "pv_add_power": (100, 10000, 100, "W", 1000),     # dostupny prebytok na pridanie priority
    "pv_add_minutes": (1, 60, 1, "min", 5),           # ako dlho musi prebytok trvat
    "pv_shed_power": (0, 5000, 50, "W", 200),         # vybijanie baterie / odber zo siete = zle
    "pv_shed_minutes": (1, 60, 1, "min", 10),         # ako dlho, kym sa odoberie priorita
    "pv_min_power": (0, 10000, 100, "W", 500),        # vyroba pod tymto = nedostatocna
    "pv_start_soc": (0, 100, 5, "%", 90),             # nabijanie baterie sa ráta ako prebytok az od tohto SOC
    "pv_stop_soc": (0, 100, 5, "%", 40),              # pod tymto SOC sa vypne vsetko hned
    # akumulacia: pri trvajucom prebytku zvys ciel zony o krok, ked ho dosiahla (najskor po intervale)
    "pv_acc_step": (0.5, 3, 0.5, "°C", 1.0),
    "pv_acc_minutes": (5, 120, 5, "min", 15),
    # max. prikon kurenia z FVE (W): rezerva pre dom, aby sa zbytocne nebralo zo siete; 0 = bez limitu
    "pv_max_heat_power": (0, 30000, 500, "W", 7000),
}

# ---- Defaultne hodnoty ----
DEFAULT_DEN_TEMP = 21.0
DEFAULT_NOC_TEMP = 19.0
DEFAULT_MIN_TEMP = 16.0
DEFAULT_MRAZ_TEMP = 10.0
DEFAULT_FLOOR_MIN = 5.0
DEFAULT_FLOOR_MAX = 28.0
DEFAULT_FLOOR_HYSTERESIS = 1.5
DEFAULT_RADIATOR_HYSTERESIS = 0.5
DEFAULT_BOOST_HOURS = 2.0
DEFAULT_PV_ACC_MAX = 24.0
DEFAULT_AC_PRIORITY_DIFF = 1.0
DEFAULT_AC_PRIORITY_MINUTES = 30.0
DEFAULT_AC_SETPOINT = 26.0
DEFAULT_AC_HYSTEREZIA = 0.3

DEFAULT_DEN_OD = "06:00:00"
DEFAULT_NOC_OD = "20:00:00"
DEFAULT_PREDKURENIE_OD = "15:00:00"
DEFAULT_PREDKURENIE_DO = "18:00:00"

DEFAULT_EMERGENCY_TEMP = 8.0
DEFAULT_FIREPLACE_THRESHOLD = 30.0
DEFAULT_OUTDOOR_THRESHOLD = -5.0
DEFAULT_COOL_OUTDOOR_THRESHOLD = 24.0
DEFAULT_COOL_TARGET = 25.0
DEFAULT_COOL_BATTERY_THRESHOLD = 50.0

# key -> (label, min, max, icon, default)  -- number entity per zona
NUMBER_DEFS = {
    "teplota_den": ("Teplota - den", 15, 26, "mdi:white-balance-sunny", DEFAULT_DEN_TEMP),
    "teplota_noc": ("Teplota - noc", 12, 24, "mdi:weather-night", DEFAULT_NOC_TEMP),
    "teplota_min": ("Teplota - minimalna (baseline)", 10, 20, "mdi:thermometer-low", DEFAULT_MIN_TEMP),
    "teplota_mraz": ("Teplota - protimrazova", 5, 15, "mdi:snowflake", DEFAULT_MRAZ_TEMP),
    "floor_min": ("Min. teplota podlahy", 5, 30, "mdi:thermometer-low", DEFAULT_FLOOR_MIN),
    "floor_max": ("Max. teplota podlahy", 20, 35, "mdi:thermometer-high", DEFAULT_FLOOR_MAX),
    "floor_hysterezia": ("Hystereza podlahy", 0.5, 5, "mdi:arrow-expand-vertical", DEFAULT_FLOOR_HYSTERESIS),
    "boost_hodiny": ("Boost - trvanie (h)", 0.5, 6, "mdi:rocket-launch", DEFAULT_BOOST_HOURS),
    "vonkajsia_hranica": (
        "Vonkajsia teplota - hranica pre vynutene kurenie (°C)",
        -30, 15, "mdi:snowflake-thermometer", DEFAULT_OUTDOOR_THRESHOLD,
    ),
    # Akumulacia prebytku FVE: ciel sa postupne zvysuje az do tejto teploty (nikdy vyssie)
    "fve_max_teplota": (
        "FVE akumulacia - max. teplota (°C)", 18, 28, "mdi:thermometer-chevron-up", DEFAULT_PV_ACC_MAX,
    ),
}

# number entity navyse len pre zony typu floor_ac
AC_NUMBER_DEFS = {
    "ac_priorita_rozdiel": (
        "AC priorita - rozdiel teploty (°C) po ktorom nastupi podlaha",
        0.2, 3, "mdi:delta", DEFAULT_AC_PRIORITY_DIFF,
    ),
    "ac_priorita_minuty": (
        "AC priorita - cas nez dokuri podlaha (min)",
        5, 90, "mdi:timer-outline", DEFAULT_AC_PRIORITY_MINUTES,
    ),
    "ac_setpoint_teplota": (
        "AC - fyzicky setpoint pri kureni (°C, nezavisle od cielovej teploty)",
        18, 32, "mdi:air-conditioner", DEFAULT_AC_SETPOINT,
    ),
    "ac_hysterezia": (
        "AC - hysterezia pre zapnutie/vypnutie (°C, podla externeho teplomera)",
        0.1, 2, "mdi:swap-vertical-bold", DEFAULT_AC_HYSTEREZIA,
    ),
}

# number entity navyse len pre zony s klimatizaciou (floor_ac) - jednoducha logika chladenia
COOLING_NUMBER_DEFS = {
    "vonkajsia_hranica_chladenie": (
        "Chladenie - vonkajsia hranica pre Auto-sezonu (°C)",
        15, 35, "mdi:sun-thermometer", DEFAULT_COOL_OUTDOOR_THRESHOLD,
    ),
    "teplota_chladenie": (
        "Chladenie - cielova teplota (°C)",
        18, 30, "mdi:snowflake", DEFAULT_COOL_TARGET,
    ),
    "bateria_hranica_chladenie": (
        "Chladenie - min. nabitie baterie FVE (%)",
        0, 100, "mdi:battery-charging-70", DEFAULT_COOL_BATTERY_THRESHOLD,
    ),
}

# Vsetky number definicie spolu (pre editaciu rozsahov v Globalnych nastaveniach).
# number entity navyse len pre zony typu radiator_floor
RADIATOR_NUMBER_DEFS = {
    "radiator_hysterezia": ("Hystereza radiatora", 0.1, 3, "mdi:radiator", DEFAULT_RADIATOR_HYSTERESIS),
}

ALL_NUMBER_DEFS = {**NUMBER_DEFS, **AC_NUMBER_DEFS, **COOLING_NUMBER_DEFS, **RADIATOR_NUMBER_DEFS}


def resolve_number_range(options: dict, key: str, default_lo: float, default_hi: float) -> tuple[float, float]:
    """Vrati (lo, hi) pre dane cislo - z pouzivatelom upravenych rozsahov v
    Globalnych nastaveniach (OPT_NUMBER_RANGES), inak povodne hardcoded
    hodnoty z NUMBER_DEFS/AC_NUMBER_DEFS/COOLING_NUMBER_DEFS."""
    overrides = options.get(OPT_NUMBER_RANGES, {})
    pair = overrides.get(key)
    if pair and len(pair) == 2:
        try:
            lo, hi = float(pair[0]), float(pair[1])
            if lo < hi:
                return lo, hi
        except (TypeError, ValueError):
            pass
    return default_lo, default_hi

# key -> (label, default "HH:MM:SS")  -- time entity per zona
TIME_DEFS = {
    "den_od_tyzden": ("Zaciatok dna - pracovny den", DEFAULT_DEN_OD),
    "den_od_vikend": ("Zaciatok dna - vikend", DEFAULT_DEN_OD),
    "noc_od_tyzden": ("Zaciatok noci - pracovny den", DEFAULT_NOC_OD),
    "noc_od_vikend": ("Zaciatok noci - vikend", DEFAULT_NOC_OD),
    "predkurenie_od": ("Predkurenie - zaciatok", DEFAULT_PREDKURENIE_OD),
    "predkurenie_do": ("Predkurenie - koniec (timeout)", DEFAULT_PREDKURENIE_DO),
}

# key -> (label, icon, default)  -- switch entity per zona
SWITCH_DEFS = {
    "predkurenie_povolene": ("Predkurenie povolene (len pracovne dni)", "mdi:home-clock", True),
    "reaguj_na_krb": ("Reaguj na krb", "mdi:fireplace", False),
    "vyuzi_fve_prebytok": ("Vyuzi FVE prebytok (kuri aj ked nikto nie je doma)", "mdi:solar-power", True),
    "fve_akumulacia": ("FVE akumulacia - postupne zvysovat teplotu", "mdi:thermometer-chevron-up", True),
    # Podlaha nabehne pod floor_min aj ked je vzduch dost teply. Predvolene vypnute,
    # pri zone radiator_floor zapnute (CONF_USE_FLOOR_MIN).
    "udrzat_min_podlahy": ("Udrzat min. teplotu podlahy", "mdi:heat-wave", False),
}
AC_SWITCH_DEFS = {
    "pouzit_pevny_ac_setpoint": (
        "Pouzit pevny AC setpoint aj bez externeho teplomera", "mdi:thermostat-box", False,
    ),
}


