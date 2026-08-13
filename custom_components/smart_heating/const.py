"""Konstanty pre Smart Heating integraciu."""

DOMAIN = "smart_heating"

# Hub - config entry (data/options)
CONF_OUTDOOR_SENSOR = "outdoor_sensor"
CONF_TARIFF_ENTITY = "tariff_entity"

# Options - zoznam zon
OPT_ZONES = "zones"

# Kluce v konfiguracii jednej zony
CONF_ZONE_NAME = "name"
CONF_ZONE_TYPE = "zone_type"
CONF_CLIMATE_ENTITY = "climate_entity"
CONF_FLOOR_TEMP_ENTITY = "floor_temp_entity"
CONF_PRESENCE_ENTITIES = "presence_entities"
CONF_SCHEDULE_ENTITY = "schedule_entity"

# Typy zon (v MVP len floor, floor_ac pride v dalsej faze)
ZONE_TYPE_FLOOR = "floor"
ZONE_TYPE_FLOOR_AC = "floor_ac"
ZONE_TYPES = [ZONE_TYPE_FLOOR]

# Rezimy zony
MODE_AUTO = "Auto"
MODE_KOMFORT = "Komfort"
MODE_USPORA = "Uspora"
MODE_MRAZ = "Mraz"
MODE_VYPNUTE = "Vypnute"
ZONE_MODES = [MODE_AUTO, MODE_KOMFORT, MODE_USPORA, MODE_MRAZ, MODE_VYPNUTE]

# Defaultne hodnoty pre novu zonu
DEFAULT_KOMFORT_TEMP = 22.0
DEFAULT_USPORA_TEMP = 18.0
DEFAULT_MRAZ_TEMP = 10.0
DEFAULT_FLOOR_MIN = 5.0
DEFAULT_FLOOR_MAX = 28.0

# Definicie 'number' entit ktore sa vytvaraju per zona
# key -> (label, min, max, icon, default)
NUMBER_DEFS = {
    "komfort_temp": ("Komfortna teplota", 15, 26, "mdi:sofa", DEFAULT_KOMFORT_TEMP),
    "uspora_temp": ("Usporna teplota", 10, 22, "mdi:leaf", DEFAULT_USPORA_TEMP),
    "mraz_temp": ("Protimrazova teplota", 5, 15, "mdi:snowflake", DEFAULT_MRAZ_TEMP),
    "floor_min": ("Min. teplota podlahy", 5, 20, "mdi:thermometer-low", DEFAULT_FLOOR_MIN),
    "floor_max": ("Max. teplota podlahy", 20, 32, "mdi:thermometer-high", DEFAULT_FLOOR_MAX),
}
