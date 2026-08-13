# Smart Heating

Univerzálna Home Assistant integrácia na riadenie viaczónového kúrenia
(elektrické podlahové kúrenie + neskôr klimatizácia ako primárny zdroj)
s globálnymi nastaveniami (vonkajšia teplota, tarifa) a per-zónovými
režimami, harmonogramami a bezpečnostnými limitmi teploty podlahy.

**Toto je MVP (fáza 1):** hub + zóny typu `floor` (podlahové kúrenie).
Kombinovaná zóna klima+podlaha (obývačka/chodba) a vlastná Lovelace karta
prídu vo fáze 2.

## Architektúra

- **Hub** – jeden config entry na inštanciu HA. Obsahuje referencie na
  existujúce entity: senzor vonkajšej teploty, entita tarify.
- **Zóny** – spravujú sa cez Options Flow hubu (Nastavenia → Zariadenia
  a služby → Smart Heating → Nastaviť → Pridať/Upraviť/Zmazať zónu).
  Každá zóna referencuje existujúci `climate` entity (tvoj podlahový
  termostat), voliteľne senzor teploty podlahy, osoby na sledovanie
  prítomnosti a `schedule` helper.
- **Coordinator** (`coordinator.py`) – jediné miesto s rozhodovacou
  logikou. Počúva zmeny stavu všetkých relevantných entít (push, nie
  polling) a pre každú zónu vypočíta cieľovú teplotu a či sa smie kúriť,
  potom to aplikuje na skutočný `climate` entity cez
  `climate.set_hvac_mode` / `climate.set_temperature`.
- **Entity vytvorené integráciou per zóna:**
  - `climate.smart_heating_<id>` – hlavný virtuálny termostat, cez ktorý
    bežne ovládaš zónu (heat/off, nastavenie teploty)
  - `select.smart_heating_<id>_rezim` – Auto / Komfort / Uspora / Mraz / Vypnute
  - `number.smart_heating_<id>_komfort_temp` / `_uspora_temp` / `_mraz_temp`
  - `number.smart_heating_<id>_floor_min` / `_floor_max` – bezpečnostné limity
  - `sensor.smart_heating_<id>_stav` – diagnostický dôvod aktuálneho rozhodnutia

### Rozhodovacia logika (režim Auto)

1. Ak má zóna priradený `schedule` helper a je mimo neho → **Uspora**
2. Inak ak je doma niektorá zo sledovaných osôb → **Komfort**
3. Inak → **Uspora**
4. Globálne: ak entita tarify nie je `on` → kúrenie sa **zablokuje** úplne
5. Bezpečnosť: ak teplota podlahy dosiahne `floor_max` → **tvrdé vypnutie**,
   prebije všetko ostatné

Manuálne režimy (Komfort/Uspora/Mraz/Vypnute nastavené priamo cez `select`
alebo `climate.set_hvac_mode(off)`) obídu harmonogram aj prítomnosť.

## Inštalácia (manuálne, pred pridaním do HACS)

1. Skopíruj priečinok `custom_components/smart_heating` do
   `<config>/custom_components/smart_heating` na tvojej HA inštancii
2. Reštartuj Home Assistant
3. Nastavenia → Zariadenia a služby → Pridať integráciu → **Smart Heating**
4. Vyber senzor vonkajšej teploty a entitu tarify (obe voliteľné, dajú sa
   doplniť neskôr)
5. Klikni na integráciu → **Nastaviť (Configure)** → **Pridať zónu** a
   priraď existujúci `climate` entity podlahovky (napr. `climate.t_alex`)

## Inštalácia cez HACS (po nahratí na GitHub)

1. HACS → tri bodky vpravo hore → Vlastné repozitáre
2. Pridaj URL tvojho repára, kategória **Integration**
3. Vyhľadaj "Smart Heating" a nainštaluj, reštartuj HA

## Známe zjednodušenia MVP / TODO na ďalšiu fázu

- [ ] Zóna typu `floor_ac` (obývačka+chodba) s prioritou klíma → podlaha ako záloha
- [ ] Vlastná Lovelace karta (frontend, lit-element)
- [ ] Hook pre krb ako informačný vstup (zatiaľ nie je zapojený do logiky)
- [ ] `floor_min` sa zatiaľ len zobrazuje/ukladá, nie je ešte využitý v
      rozhodovacej logike (napr. pre dokurovanie pri príliš studenej podlahe
      aj mimo Komfort režimu)
- [ ] Testované len staticky (bez reálnej HA inštancie) — pred nasadením
      odporúčam vyskúšať najprv na jednej zóne a sledovať logy
      (Nastavenia → Systém → Logy, hľadaj `smart_heating`)
- [ ] CI (`hassfest` + HACS validácia cez GitHub Actions) zatiaľ nie je
      súčasťou repozitára

## Ďalšie kroky

Po odladení tejto MVP verzie na tvojej reálnej inštancii (aspoň jedna
podlahová zóna) prejdeme na fázu 2: zóna `floor_ac` pre obývačku/chodbu
a custom kartu.
