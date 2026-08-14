"""Konstanty pre Smart Heating integraciu (v2)."""

DOMAIN = "smart_heating"

# ---- Hub config/options ----
CONF_OUTDOOR_SENSOR = "outdoor_sensor"
CONF_TARIFF_ENTITY = "tariff_entity"
CONF_FIREPLACE_BURNING_ENTITY = "fireplace_burning_entity"
CONF_FIREPLACE_TEMP_ENTITY = "fireplace_temp_entity"
CONF_NOTIFY_ENTITY = "notify_entity"
CONF_PV_SURPLUS_ENTITY = "pv_surplus_entity"

OPT_ZONES = "zones"

# ---- Zone config (strukturalne, cez config/options flow) ----
CONF_ZONE_NAME = "name"
CONF_ZONE_TYPE = "zone_type"
CONF_CLIMATE_ENTITY = "climate_entity"
CONF_AC_ENTITY = "ac_entity"
CONF_FLOOR_TEMP_ENTITY = "floor_temp_entity"
CONF_PRESENCE_ENTITIES = "presence_entities"
CONF_MANUAL_PRESENCE_ENTITIES = "manual_presence_entities"
CONF_SCHEDULE_ENTITY = "schedule_entity"  # docasne (faza 2 prinesie vlastny grid v karte)
CONF_USE_FIREPLACE_GUARD = "use_fireplace_guard"

ZONE_TYPE_FLOOR = "floor"
ZONE_TYPE_FLOOR_AC = "floor_ac"
ZONE_TYPES = [ZONE_TYPE_FLOOR, ZONE_TYPE_FLOOR_AC]

# ---- Manualne rezimy zony ----
MODE_AUTO = "Auto"
MODE_DEN = "Den"
MODE_NOC = "Noc"
MODE_MIN = "Min"
MODE_MRAZ = "Mraz"
MODE_VYPNUTE = "Vypnute"
ZONE_MODES = [MODE_AUTO, MODE_DEN, MODE_NOC, MODE_MIN, MODE_MRAZ, MODE_VYPNUTE]

# ---- Defaultne hodnoty ----
DEFAULT_DEN_TEMP = 21.0
DEFAULT_NOC_TEMP = 19.0
DEFAULT_MIN_TEMP = 16.0
DEFAULT_MRAZ_TEMP = 10.0
DEFAULT_FLOOR_MIN = 5.0
DEFAULT_FLOOR_MAX = 28.0
DEFAULT_BOOST_HOURS = 2.0
DEFAULT_AC_PRIORITY_DIFF = 1.0
DEFAULT_AC_PRIORITY_MINUTES = 30.0

DEFAULT_DEN_OD = "06:00:00"
DEFAULT_NOC_OD = "20:00:00"
DEFAULT_PREDKURENIE_OD = "15:00:00"
DEFAULT_PREDKURENIE_DO = "18:00:00"

DEFAULT_EMERGENCY_TEMP = 8.0
DEFAULT_FIREPLACE_THRESHOLD = 30.0

# key -> (label, min, max, icon, default)  -- number entity per zona
NUMBER_DEFS = {
    "teplota_den": ("Teplota - den", 15, 26, "mdi:white-balance-sunny", DEFAULT_DEN_TEMP),
    "teplota_noc": ("Teplota - noc", 12, 24, "mdi:weather-night", DEFAULT_NOC_TEMP),
    "teplota_min": ("Teplota - minimalna (baseline)", 10, 20, "mdi:thermometer-low", DEFAULT_MIN_TEMP),
    "teplota_mraz": ("Teplota - protimrazova", 5, 15, "mdi:snowflake", DEFAULT_MRAZ_TEMP),
    "floor_min": ("Min. teplota podlahy", 5, 20, "mdi:thermometer-low", DEFAULT_FLOOR_MIN),
    "floor_max": ("Max. teplota podlahy", 20, 32, "mdi:thermometer-high", DEFAULT_FLOOR_MAX),
    "boost_hodiny": ("Boost - trvanie (h)", 0.5, 6, "mdi:rocket-launch", DEFAULT_BOOST_HOURS),
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
}

# key -> (label, default "HH:MM:SS")  -- time entity per zona
TIME_DEFS = {
    "den_od": ("Zaciatok dna", DEFAULT_DEN_OD),
    "noc_od": ("Zaciatok noci", DEFAULT_NOC_OD),
    "predkurenie_od": ("Predkurenie - zaciatok", DEFAULT_PREDKURENIE_OD),
    "predkurenie_do": ("Predkurenie - koniec (timeout)", DEFAULT_PREDKURENIE_DO),
}

# key -> (label, icon, default)  -- switch entity per zona
SWITCH_DEFS = {
    "predkurenie_povolene": ("Predkurenie povolene (len pracovne dni)", "mdi:home-clock", True),
    "reaguj_na_krb": ("Reaguj na krb", "mdi:fireplace", False),
    "vyuzi_fve_prebytok": ("Vyuzi FVE prebytok (kuri aj ked nikto nie je doma)", "mdi:solar-power", True),
}

# key -> (label, min, max, icon, default) -- hub-level number entity
HUB_NUMBER_DEFS = {
    "nudzova_teplota": (
        "Nudzova protimrazova ochrana (°C) - prerazi aj tarifu",
        3, 15, "mdi:snowflake-alert", DEFAULT_EMERGENCY_TEMP,
    ),
    "krb_threshold": (
        "Krb - prahova teplota (°C), nad ktorou sa vypne kurenie",
        15, 60, "mdi:fireplace", DEFAULT_FIREPLACE_THRESHOLD,
    ),
}

# ---- Tyzdenny rozvrh (vlastny grid v karte) ----
WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
BLOCKS_PER_DAY = 48  # 30-minutove bloky
SCHEDULE_STORE_KEY = f"{DOMAIN}_schedules"
SCHEDULE_STORE_VERSION = 1
SIGNAL_SCHEDULE_UPDATED = f"{DOMAIN}_schedule_updated"
