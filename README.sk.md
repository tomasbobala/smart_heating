<p align="center">
  <a href="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/custom_components/smart_heating/brand/icon.png">
    <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/custom_components/smart_heating/brand/icon.png" width="120" alt="Smart Heating logo">
  </a>
</p>

# Smart Heating

**Viaczónové kúrenie a chladenie pre Home Assistant**

Podlahové kúrenie · kúrenie a chladenie klimatizáciou · krb · FVE prebytok a batéria · tarifa

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/tomasbobala/smart_heating?style=for-the-badge&color=C2410C)](https://github.com/tomasbobala/smart_heating/releases)
[![License: MIT](https://img.shields.io/github/license/tomasbobala/smart_heating?style=for-the-badge&color=4caf7d)](LICENSE)
[![Validate](https://img.shields.io/github/actions/workflow/status/tomasbobala/smart_heating/validate.yml?style=for-the-badge&label=validate)](https://github.com/tomasbobala/smart_heating/actions/workflows/validate.yml)

**Slovensky** · [English](README.md)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=tomasbobala&repository=smart_heating&category=integration)

Univerzálna Home Assistant integrácia na riadenie viaczónového kúrenia **aj chladenia**
— elektrické podlahové kúrenie, klimatizácia ako primárny zdroj tepla alebo chladu,
krb, fotovoltaika (prebytok aj batéria) a tarifa elektriny, všetko v jednom systéme
s vlastnou logikou a Lovelace kartou.

Vytvorené pre reálny dom s viacerými nezávislými zónami (izbami), kde každá zóna
má vlastné pravidlá, ale zdieľa spoločné globálne nastavenia.

<p align="center">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/card-collapsed.png" width="45%" alt="Karta Smart Heating - zbalený pohľad">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/card-expanded.png" width="45%" alt="Karta Smart Heating - rozbalená sekcia Teploty">
  <br>
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/global-settings.png" width="45%" alt="Formulár Globálne nastavenia">
  <img src="https://raw.githubusercontent.com/tomasbobala/smart_heating/main/docs/screenshots/edit-zone.png" width="45%" alt="Formulár Upraviť zónu">
</p>

---

## Obsah

- [Funkcie](#funkcie)
- [Architektúra](#architektúra)
- [Rozhodovacia logika — Kúrenie](#rozhodovacia-logika--kúrenie)
- [Rozhodovacia logika — Chladenie](#rozhodovacia-logika--chladenie)
- [Externý teplomer a presné riadenie AC](#externý-teplomer-a-presné-riadenie-ac)
- [Notifikácie](#notifikácie)
- [Jazyk (i18n)](#jazyk-i18n)
- [Testy a CI](#testy-a-ci)
- [Režim Vypnuté — ako funguje](#režim-vypnuté--ako-funguje)
- [Instalácia](#instalácia)
- [Nastavenie](#nastavenie)
- [Entity vytvorené integráciou](#entity-vytvorené-integráciou)
- [Lovelace karta](#lovelace-karta)
- [Príklady použitia](#príklady-použitia)
- [Riešenie problémov](#riešenie-problémov)
- [Známe obmedzenia](#známe-obmedzenia)

---

## Funkcie

|   |   |
|---|---|
| 🏠 **Viacero zón** | Každá miestnosť má vlastný režim, teploty a časy, so spoločnými globálnymi nastaveniami. |
| 🔥 **Podlahové kúrenie** | Elektrické podlahové kúrenie s bezpečnostným limitom teploty podlahy. |
| ❄️ **Kúrenie aj chladenie klímou** | Klimatizácia ako primárny zdroj tepla, plus zámerne jednoduchšia logika chladenia riadená batériou FVE. |
| 🪵 **Reaguje na krb** | Vypne kúrenie v miestnosti, keď je pri krbe dostatočne teplo. |
| 💶 **Sleduje tarifu** | Globálne zablokovanie kúrenia pri vysokej tarife. |
| ☀️ **FVE prebytok** | Využíva prebytok FVE (kúrenie) aj nabitie batérie (chladenie). |
| 🥶 **Protimrazová ochrana** | Núdzová ochrana zabráni zamrznutiu, aj počas zablokovania tarifou. |
| 🧊 **Vynútené kúrenie pri mraze** | Per zóna nastaviteľná vonkajšia hranica spustí komfortné kúrenie v Auto režime. |
| ⏰ **Predkúrenie** | Pevné časové okno pred príchodom, nezávisle od reálnej prítomnosti. |
| 🌡️ **Externý teplomer** | Presnejšie riadenie, keď vstavaný senzor AC/podlahovky nestačí. |
| 🚀 **Boost** | Okamžité, dočasné komfortné kúrenie na požiadanie. |
| 🎛️ **Vlastná Lovelace karta** | Jedna karta na zónu, plné ovládanie bez YAML. |
| 🌍 **Slovenčina a angličtina** | Karta aj texty generované backendom (dôvody, notifikácie) podporujú oba jazyky. |

---

## Architektúra

### Hub (jeden na inštanciu Home Assistant)

Všetky globálne nastavenia sa spravujú cez **Nastaviť → Globálne nastavenia**
(nie ako samostatné entity — všetko na jednom mieste):

| Nastavenie | Popis |
|---|---|
| Senzor vonkajšej teploty | používa sa aj na vynútené kúrenie pri mraze a Auto-sezónu |
| Entita tarify / povolenie kúrenia | `on` = kúrenie povolené (najvyššia priorita blok) |
| Krb - senzor teploty | teplota pri krbe |
| Krb - prahová teplota (°C) | nad ktorou sa vypne kúrenie v zónach reagujúcich na krb |
| FVE prebytok entita | `on` = fotovoltaika vyrába prebytok a batéria je nabitá (pre kúrenie) |
| Batéria FVE - stav nabitia (%) | číselný senzor SOC, používa sa pre jednoduché chladenie |
| Núdzová protimrazová ochrana (°C) | preráža aj tarifu |
| Dovolenka / Neprítomnosť | force Min vo všetkých zónach (Auto režim) |
| Notifikačné entity | kam sa posielajú upozornenia (dá sa vybrať viacero naraz) |
| Jazyk | `auto \| en \| sk` — jazyk dôvodov/notifikácií generovaných backendom |

### Zóna (koľko izieb, toľko zón)

Pridáva sa cez **Options Flow** (Nastavenia → Zariadenia a služby → Smart Heating
→ Nastaviť → Pridať zónu):

- **Typ zóny:**
  - `floor` — len podlahové kúrenie
  - `floor_ac` — klimatizácia (kúrenie aj chladenie) ako primárny zdroj, podlaha
    ako záložné dokurovanie (len pri kúrení — chladiť nevie)
- Podlahový `climate` termostat (povinné)
- Klimatizačný `climate` entity (len pre `floor_ac`)
- Senzor teploty podlahy (voliteľné, pre bezpečnostný limit)
- **Externý teplomer zóny** (voliteľné) — nahradí vstavaný senzor vo výpočtoch
- Osoby sledované cez GPS (`person.x`)
- Manuálny presence override (napr. `input_boolean.navsteva` pre návštevu)
- Reaguj na krb (áno/nie)

---

## Rozhodovacia logika — Kúrenie

Pre zónu v sezóne **Kúrenie** (pozri nižšie, ako sa sezóna určuje) sa v tomto
poradí vyhodnocuje cieľ (vyššie položky prebíjajú nižšie):

```
0. NÚDZOVÁ OCHRANA
   current_temp < núdzová hranica (default 8°C)
   → krátko zapne kúrenie, PRERAZÍ TARIFU (nie floor/krb bezpečnosť)

0.5 FVE PREBYTOK
   FVE entita = on A zóna má "Využi FVE prebytok" zapnuté
   → cieľ = Deň/Noc komfort, PRERAZÍ TARIFU (nie floor/krb)

1. TARIFA
   Entita "kúrenie povolené" != on → VYPNI VŠETKO (podlahu aj AC)

2. BEZPEČNOSŤ PODLAHY
   Teplota podlahy >= max (per zóna) → VYPNI, bez výnimky

3. KRB
   Zóna má "Reaguj na krb" zapnuté A teplota pri krbe >= threshold → VYPNI

4. MANUÁLNY REŽIM (ak zóna nie je v Auto)
   Den / Noc / Min / Mraz / Vypnute — priama teplota, žiadne ďalšie vyhodnocovanie

5. AUTO
   a. Urč Deň/Noc komfortnú teplotu podľa aktuálneho času (samostatné hranice
      pre pracovný deň a víkend)
   b. Skutočne je niekto doma (GPS alebo manuálny override)? → Komfort
   c. Beží okno predkúrenia? (len Po–Pia, pevný čas) → Komfort
   d. Vonkajšia teplota <= per-zóna hranica? → Komfort (vynútené kúrenie pri mraze)
   e. Inak → Min (len udržiavanie, baseline)
```

**Boost** (tlačidlo, dočasné na X hodín) sa vyhodnocuje pred krokom 4 — prebíja
manuálny režim aj Auto, ale **rešpektuje** tarifu, podlahu aj krb. Nezávisí od
reálnej prítomnosti.

### Zóna `floor_ac` v Kúrení — priorita AC → podlaha

1. AC sa nastaví na vypočítaný cieľ ako prvá (primárny zdroj) — pozri aj
   [Externý teplomer](#externý-teplomer-a-presné-riadenie-ac) nižšie, ak má AC
   nepresný vlastný senzor
2. Ak aktuálna teplota zaostáva za cieľom o viac než nastavený rozdiel (°C)
   dlhšie než nastavený čas (minúty), zapne sa aj podlaha ako dokurovanie
3. Keď AC dobehne cieľ, podlaha sa vypne

---

## Rozhodovacia logika — Chladenie

Platí **len pre zóny typu `floor_ac`**. Podlaha sa pri chladení nikdy nezapája.

### Ako sa určí sezóna (Kúrenie vs Chladenie)

Každá `floor_ac` zóna má vlastný prepínač **Sezóna**: `Kurenie` / `Chladenie` / `Auto`.

- **Kurenie** / **Chladenie** — manuálne vynútené, ignoruje vonkajšiu teplotu
- **Auto** — vonkajšia teplota >= per-zóna hranica → **Chladenie**, inak **Kúrenie**

### Logika v sezóne Chladenie (zámerne jednoduchšia než kúrenie)

Žiadna prítomnosť, žiadny Deň/Noc, žiadne predkúrenie — len:

```
1. Manuálny rezim = Vypnute? → AC off, koniec

2. Batéria FVE (%) >= nastavená hranica?
   → NIE → AC off
   → ÁNO → pokračuj

3. Ma zóna externý teplomer?
   → NIE → chladí (spolieha sa na vlastný senzor AC, ako doteraz)
   → ÁNO → hysteréza podľa externého teplomera:
       teplomer <= cieľ - hysterézia → vypni chladenie
       teplomer >= cieľ + hysterézia → zapni chladenie
       (v pásme medzi) → nechaj predchádzajúci stav (anti-cyklovanie)
```

`Cieľová teplota chladenia` slúži zároveň ako hranica pre hysterézu **aj** ako
fyzická hodnota, ktorá sa reálne pošle klimatizácii.

---

## Externý teplomer a presné riadenie AC

Bežný problém: vstavaný senzor klimatizácie môže byť nepresný alebo neodráža
reálnu teplotu v miestnosti (napr. je pri okne, alebo miestnosť má iný tepelný
zdroj ako krb). Riešenie:

1. V nastavení zóny priraď **Externý teplomer zóny** (napr. teplomer pri krbe)
2. Táto hodnota **nahradí** vstavaný senzor vo **všetkých** výpočtoch danej zóny
   (zobrazená aktuálna teplota, núdzová ochrana, AC↔podlaha priorita, hysteréza
   pri kúrení aj chladení)
3. Pri kúrení navyše: AC dostane príkaz kúriť na **pevný fyzický setpoint**
   (`AC fyzický setpoint`, napr. 26°C) namiesto vypočítaného komfortného cieľa
   — pretože jej vlastný senzor a regulačný okruh sú nepresné. O tom, **či**
   AC vôbec beží, rozhoduje `AC hysteréza` vs externý teplomer, nie AC sama.

Ak zóna **nemá** externý teplomer nastavený, všetko funguje presne ako predtým
(AC sa riadi vlastným senzorom a regulačným okruhom).

---

---

## Notifikácie

10 samostatných kategórií, každá s vlastným prepínačom v **Globálnych nastaveniach**
(defaultne všetky zapnuté):

| Kategória | Rozsah | Príklad |
|---|---|---|
| Tarifa | 1× pre celý dom | `Globálny stav: kúrenie zablokované vysokou tarifou.` |
| Podlaha | per zóna | `{zóna}: kúrenie vypnuté - podlaha dosiahla max. teplotu {teplota}.` |
| Krb | 1× so zoznamom zón | `Krb: kúrenie vypnuté v zónach: {zoznam}.` |
| Núdzová ochrana | 1× so zoznamom zón | `Núdzová ochrana aktivovaná v zónach: {zoznam}!` |
| Boost | per zóna | `Boost aktivovaný v zóne {zóna} na {hodiny} h.` |
| Chladenie | per zóna | `{zóna}: chladenie spustené (batéria {%}, cieľ {°C}).` |
| Dovolenka | 1× pre celý dom | `Dovolenka aktivovaná - všetky zóny na Min.` |
| Predkúrenie | per zóna | `{zóna}: predkúrenie spustené pred príchodom.` |
| AC/podlaha záloha | per zóna, len `floor_ac` | `{zóna}: AC nestíha, podlaha zapojená ako dokurovanie.` |
| Vonkajšia hranica (mráz) | per zóna | `{zóna}: nízka vonkajšia teplota vynútila kúrenie.` |

Väčšina kategórií posiela **aj** správu o návrate do normálu (napr. "kúrenie obnovené").
Po reštarte HA je 3-minútové ochranné okno, počas ktorého sa notifikácie neposielajú
(len sa ticho zaznamená základný stav) — zabraňuje falošným upozorneniam za stav,
ktorý existoval už pred reštartom. **Notifikačná entita** podporuje výber **viacerých**
cieľov naraz (napr. telefóny oboch partnerov).

---

## Jazyk (i18n)

Integrácia aj karta podporujú slovenčinu aj angličtinu:

- **Karta**: `language: auto | en | sk` v konfigurácii karty (`auto` sleduje jazyk HA)
- **Backend** (dôvody rozhodnutí, zdroj kúrenia, notifikácie): pole **Jazyk** v
  Globálnych nastaveniach integrácie (`auto | en | sk`)

Obe sú nezávislé — môžeš mať kartu po anglicky a notifikácie po slovensky, ak chceš.

---

## Testy a CI

Projekt má skutočnú testovaciu sadu (nie len manuálne overenie):

- **Python** (`pytest` + `pytest-homeassistant-custom-component`) — rozhodovacia
  logika, i18n, notifikácie, config/options flow (vrátane regresných testov na
  konkrétne bugy nájdené počas vývoja)
- **JavaScript** (`node:test` + `jsdom`) — karta, i18n, optimalizácia prekresľovania

```bash
# Python
pip install -r requirements-test.txt
pytest

# JS
npm install
npm test
```

GitHub Actions (`.github/workflows/validate.yml`) spúšťa oboje pri každom
push/PR, spolu s oficiálnou HACS a `hassfest` validáciou.

---

## Režim Vypnuté — ako funguje

Pri **prechode** do režimu Vypnuté (zmena z iného režimu) sa pošle `off`
**jedenkrát**. Pokým zóna **zostáva** vo Vypnuté, coordinator už do zariadenia
vôbec nezasahuje — necháš si ho ovládať úplne sám (napr. prepnúť klimatizáciu
na chladenie mimo Smart Heating), kým znova neprepneš na iný režim. Toto platí
rovnako pre kúrenie aj chladenie.

---

## Instalácia

### Cez HACS (odporúčané)

1. HACS → tri bodky vpravo hore → **Vlastné repozitáre**
2. URL: `https://github.com/tomasbobala/smart_heating`
3. Kategória: **Integrácia**
4. Vyhľadaj "Smart Heating" v HACS a nainštaluj
5. Reštartuj Home Assistant

### Manuálne

1. Skopíruj `custom_components/smart_heating` do `config/custom_components/smart_heating`
2. Reštartuj Home Assistant

---

## Nastavenie

### 1. Pridanie integrácie (hub)

**Nastavenia → Zariadenia a služby → Pridať integráciu → Smart Heating**

Všetky polia sú voliteľné — dajú sa doplniť aj neskôr cez "Nastaviť → Globálne
nastavenia".

### 2. Pridanie zóny

Na dlaždici integrácie klikni **Nastaviť (Configure)** → **Pridať zónu**:

- Zadaj názov, vyber typ zóny a podlahový/klimatizačný `climate` entity
- Voliteľne priraď externý teplomer, senzor teploty podlahy
- Priraď osoby na sledovanie prítomnosti
- Ulož

Po pridaní zóny sa vytvorí ~19–26 entít (podľa typu zóny) s predvolenými
hodnotami, ktoré si doladíš cez entity alebo priamo cez Lovelace kartu.

### 3. Karta sa pridá automaticky — žiadne ručné kroky

Od verzie 0.12.0 je Lovelace karta zabudovaná **priamo vo vnútri**
`custom_components/smart_heating/` a pri štarte Home Assistant sa **sama
zaregistruje** — ako statický súbor **aj** ako automaticky vložený dashboard
resource. To znamená:

- HACS ju nasadí automaticky spolu so zvyškom kódu (leží pod
  `custom_components/`, nie v samostatnom priečinku `www/`)
- **Žiadne** ručné kopírovanie do `config/www/`
- **Žiadne** ručné pridávanie resource cez Nastavenia → Ovládacie panely → Zdroje
- Cache sa rieši sama — do vloženej URL sa automaticky zapíše nainštalovaná
  verzia, takže po aktualizácii stačí len reštart HA

Stačí pridať kartu na dashboard cez UI (Upraviť dashboard → Pridať kartu →
Smart Heating) — otvorí sa vizuálny výber zóny, netreba písať `zone_id`
ručne. Alebo priamo v YAML:

```yaml
type: custom:smart-heating-card
zone_id: "xxxxxxxx"
name: "Obývačka"       # volitelne, inak sa pouzije meno z climate entity
```

Ak sa karta neobjaví hneď po inštalácii/aktualizácii, treba **úplný reštart
Home Assistant** (nie len HACS "reload") — registrácia prebieha len raz, pri
štarte.

---

## Entity vytvorené integráciou

Hub **nemá** žiadne vlastné entity — všetko globálne je súčasťou Globálnych
nastavení (Options Flow).

### Per zóna (`<id>` = interné ID zóny)

| Entity | Popis |
|---|---|
| `climate.smart_heating_<id>` | hlavný virtuálny termostat — primárne ovládacie miesto (podporuje aj Cool pri `floor_ac`) |
| `select.smart_heating_<id>_rezim` | Auto / Den / Noc / Min / Mraz / Vypnute |
| `select.smart_heating_<id>_sezona` | **len `floor_ac`**: Kurenie / Chladenie / Auto |
| `number..._teplota_den` / `_teplota_noc` / `_teplota_min` / `_teplota_mraz` | teploty kúrenia |
| `number..._floor_min` / `_floor_max` | bezpečnostné limity teploty podlahy |
| `number..._vonkajsia_hranica` | hranica pre vynútené kúrenie pri mraze |
| `number..._boost_hodiny` | trvanie Boostu |
| `number..._ac_priorita_rozdiel` / `_ac_priorita_minuty` | **len `floor_ac`**: kedy nastúpi podlaha ako záloha |
| `number..._ac_setpoint_teplota` | **len `floor_ac`**: fyzický setpoint AC pri kúrení (s ext. teplomerom) |
| `number..._ac_hysterezia` | **len `floor_ac`**: hysteréza pre zapnutie/vypnutie AC (kúrenie aj chladenie) |
| `number..._teplota_chladenie` | **len `floor_ac`**: cieľ/setpoint chladenia |
| `number..._bateria_hranica_chladenie` | **len `floor_ac`**: min. % SOC batérie pre chladenie |
| `number..._vonkajsia_hranica_chladenie` | **len `floor_ac`**: hranica pre Auto-sezónu |
| `time..._den_od_tyzden` / `_vikend`, `_noc_od_tyzden` / `_vikend` | časové hranice Deň/Noc |
| `time..._predkurenie_od` / `_do` | okno predkúrenia (len Po–Pia) |
| `switch..._predkurenie_povolene` | zapnutie/vypnutie predkúrenia |
| `switch..._reaguj_na_krb` | zapnutie/vypnutie reakcie na krb |
| `switch..._vyuzi_fve_prebytok` | zapnutie/vypnutie využitia FVE prebytku (kúrenie) |
| `button..._boost` | okamžité spustenie Boostu |
| `sensor..._stav` | diagnostický dôvod aktuálneho rozhodnutia + atribúty (`heating_allowed`, `season`, `release_control`, `zdroj_kurenia`, `tariff_blocked`, `floor_override`, `krb_override`, `emergency_active`, `pv_active`, `boost_active`, `outdoor_temperature`, `cold_outdoor_active`) |

---

## Lovelace karta

`custom_components/smart_heating/www/smart-heating-card.js` — čistý JavaScript web component, žiadny build
krok. Jedna karta = jedna zóna. Obsahuje:

- Aktuálnu/cieľovú teplotu, teplotu podlahy a vonkajšiu teplotu, dôvod
  rozhodnutia, farebné odznaky
- Prepínanie režimu (chipy) a **sezóny** (len pre zóny s AC)
- Steppery na všetky teploty vrátane chladiacich a AC-špecifických
- Časové polia (pracovný deň / víkend / predkúrenie)
- Prepínače (predkúrenie, krb, FVE)
- Boost (trvanie + tlačidlo)
- **Vizuálny editor** pri pridávaní karty (dropdown zón namiesto ručného `zone_id`)

Karta prekresľuje obsah **len** keď sa zmení niečo z jej vlastnej zóny (nie
pri každej zmene v celom Home Assistant) — dôležité pre výkon pri väčšom
počte kariet na dashboarde. Sekcie Sezóna/Chladenie/AC nastavenia sa
zobrazujú **len** pre zóny typu `floor_ac`.

---

## Príklady použitia

### "Chcem, aby sa doma kúrilo skôr, než prídeme"

Nastav `predkurenie_od` (napr. 15:00) a `predkurenie_do` (napr. 18:00, ako
poistka keby nikto neprišiel) — funguje len v pracovné dni.

### "Cez víkend chodíme spať neskôr a vstávame neskôr"

Nastav `den_od_vikend` a `noc_od_vikend` odlišne od `den_od_tyzden`/`noc_od_tyzden`.

### "Nechcem posielať prebytky FVE do siete v zime"

Priraď v hube entitu "FVE prebytok" (vlastný template `binary_sensor`
kombinujúci "FVE vyrába" + "batéria nabitá nad X %"). Zóny s
`vyuzi_fve_prebytok` zapnutým sa vykurujú na komfort aj bez prítomnosti.

### "V lete chcem chladiť, len keď je batéria FVE nabitá"

Nastav `bateria_hranica_chladenie` (napr. 50 %), priraď v Globálnych
nastaveniach senzor SOC batérie a nastav zóne Sezónu na `Auto` alebo `Chladenie`.

### "Vstavaný senzor klimatizácie je nepresný, kúri/chladí nesprávne"

Priraď zóne **Externý teplomer** (skutočný teplomer v miestnosti). Systém ho
odvtedy použije namiesto senzora AC, vrátane hysteréznej logiky zapnutia/vypnutia.

### "Idem domov, chcem aby bolo teplo, aj keď je vysoká tarifa"

Stlač **Boost** — force-uje komfort na nastavený počet hodín. Rešpektuje
tarifu (počká, kým tarifa klesne) aj bezpečnosť podlahy/krbu.

### "Chcem klimatizáciu na chvíľu ovládať priamo, mimo Smart Heating"

Prepni zónu na **Vypnuté** — po jednorazovom `off` sa integrácia do zariadenia
prestane miešať, kým znova neprepneš na iný režim.

---

## Riešenie problémov

**Zmena Python súboru sa neprejavila** → treba **celý reštart** Home Assistant,
nie len reload integrácie (platí obzvlášť pri pridaní/zmene platformy).

**Zmena JS karty sa neprejavila** → urob **celý reštart** Home Assistant (nie
len HACS "reload"). Karta sa registruje len raz, pri štarte integrácie, s
nainštalovanou verziou zapísanou priamo v URL — reštart na novej verzii je
vždy dosť, žiadny ručný cache bump netreba. Ak by to aj tak vyzeralo staro,
tvrdý refresh v prehliadači (Safari: Shift+klik na obnovenie) dorieši
posledný kúsok cache na strane prehliadača.

**Options Flow hádže 500 Internal Server Error** → `config_entry` v
`OptionsFlow` sa od HA 2024.12 nesmie nastavovať manuálne v `__init__` (v tejto
integrácii už opravené, relevantné len ak forkuješ kód).

**Custom entity vôbec nevznikli po pridaní zóny** → skontroluj **Nastavenia
→ Systém → Logy**, filter `smart_heating` — časté príčiny: nesprávny
`EntityCategory` (musí byť enum, nie string), nesprávny import konštanty z
`homeassistant.components.climate`.

**AC pri chladení/kúrení necháva bežať dlho aj po dosiahnutí cieľa** → priraď
zóne Externý teplomer a skontroluj hodnotu `AC hysterezia` — príliš vysoká
hodnota spôsobí veľké pásmo necitlivosti.

**Klimatizácia sa mi "vypína sama", keď ju ovládam priamo** → over si režim
zóny. Vo `Vypnuté` má systém po prvom `off` zariadenie nechať na pokoji — ak
sa to nedeje, over si verziu (potrebuješ min. 0.6.0).

---

## Známe obmedzenia

- Boost, deficit AC↔podlaha, hysteréza a notifikačné flagy sú len v pamäti
  (RAM) — po reštarte Home Assistant sa vynulujú (zámerne, ide o krátkodobý stav)
- Bezpečnostné limity teploty podlahy vyžadujú samostatný senzor teploty
  podlahy priradený k zóne — bez neho sa táto ochrana nevyhodnocuje
- Chladenie je zámerne zjednodušené (len batéria ± externý teplomer) — žiadna
  prítomnosť, Deň/Noc ani predkúrenie ako pri kúrení
- Karta nemá vizuálny editor pre štrukturálne polia zóny (typ zóny, entity) —
  tie sa nastavujú cez Options Flow integrácie, nie cez kartu

---

## Licencia

Tento projekt je licencovaný pod [MIT licenciou](LICENSE) — môžeš ho slobodne
používať, upravovať aj šíriť, aj na komerčné účely, pokiaľ zachováš pôvodné
copyright oznámenie.

[MIT](https://github.com/tomasbobala/smart_heating/blob/main/LICENSE) © 2026 Tomáš Bobala
