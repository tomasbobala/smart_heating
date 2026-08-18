# Smart Heating

Univerzálna Home Assistant integrácia na riadenie viaczónového kúrenia — elektrické
podlahové kúrenie, klimatizácia ako primárny zdroj tepla, krb, fotovoltaika a tarifa
elektriny, všetko v jednom systéme s vlastnou logikou a Lovelace kartou.

Vytvorené pre reálny dom s viacerými nezávislými zónami (izbami), kde každá zóna
má vlastné pravidlá, ale zdieľa spoločné globálne nastavenia (vonkajšia teplota,
tarifa, krb, FVE).

---

## Obsah

- [Čo integrácia rieši](#čo-integrácia-rieši)
- [Architektúra](#architektúra)
- [Rozhodovacia logika](#rozhodovacia-logika)
- [Instalácia](#instalácia)
- [Nastavenie](#nastavenie)
- [Entity vytvorené integráciou](#entity-vytvorené-integráciou)
- [Lovelace karta](#lovelace-karta)
- [Príklady použitia](#príklady-použitia)
- [Riešenie problémov](#riešenie-problémov)
- [Známe obmedzenia](#známe-obmedzenia)

---

## Čo integrácia rieši

Bežné termostaty v Home Assistante riešia jednu zónu a jeden zdroj tepla. Táto
integrácia rieši celý dom naraz:

- **Viacero nezávislých zón** — každá miestnosť má vlastný režim, teploty, časy
- **Elektrické podlahové kúrenie** s bezpečnostným limitom teploty podlahy
- **Klimatizácia ako primárny zdroj tepla** (tepelné čerpadlo je lacnejšie než
  odporové vykurovanie) s podlahou ako záložným dokurovaním
- **Krb** — vypnutie kúrenia v miestnosti, keď krb dostatočne kúri
- **Tarifa elektriny** — globálne zablokovanie kúrenia pri vysokej tarife
- **Fotovoltaika** — využitie prebytku zo slnka na kúrenie aj keď nikto nie je doma
  (aby prebytky nešli zbytočne do siete)
- **Núdzová protimrazová ochrana** — zabráni skutočnému zamrznutiu aj počas
  vysokej tarify
- **Predkúrenie pred príchodom** — na pevný čas, nezávisle od reálnej prítomnosti
- **Boost** — okamžité dočasné vykúrenie na požiadanie
- **Vlastná Lovelace karta** — jedna karta na zónu, plné ovládanie bez YAML

---

## Architektúra

Integrácia má dve úrovne:

### Hub (jeden na inštanciu Home Assistant)

Globálne nastavenia a referencie na existujúce entity vo vašej inštalácii:

| Nastavenie | Popis |
|---|---|
| Senzor vonkajšej teploty | referenčná hodnota (informatívna) |
| Entita tarify / povolenie kúrenia | `on` = kúrenie povolené (najvyššia priorita blok) |
| Krb - entita "horí" | binárny senzor/vstup, či krb aktívne kúri |
| Krb - senzor teploty | teplota pri krbe |
| FVE prebytok entita | `on` = fotovoltaika vyrába prebytok a batéria je nabitá |
| Notifikačná entita | kam sa posielajú upozornenia |

Hub tiež vytvára:
- `switch.smart_heating_nepritomnost` — Dovolenka/Neprítomnosť (force Min všade)
- `number.smart_heating_nudzova_teplota` — núdzová protimrazová hranica (°C)
- `number.smart_heating_krb_threshold` — prahová teplota pri krbe (°C)

### Zóna (koľko izieb, toľko zón)

Každá zóna sa pridáva cez **Options Flow** integrácie (Nastavenia → Zariadenia
a služby → Smart Heating → Nastaviť → Pridať zónu):

- **Typ zóny:**
  - `floor` — len podlahové kúrenie
  - `floor_ac` — klimatizácia ako primárny zdroj, podlaha ako záložné dokurovanie
- Podlahový `climate` termostat (povinné)
- Klimatizačný `climate` entity (len pre `floor_ac`)
- Senzor teploty podlahy (voliteľné, pre bezpečnostný limit)
- Osoby sledované cez GPS (`person.x`)
- Manuálny presence override (napr. `input_boolean.navsteva` pre návštevu)
- Reaguj na krb (áno/nie)

---

## Rozhodovacia logika

Pre každú zónu sa v tomto poradí vyhodnocuje, či a na koľko sa má kúriť
(vyššie položky prebíjajú nižšie):

```
0. NÚDZOVÁ OCHRANA
   Vnútorná teplota < núdzová hranica (default 8°C)
   → krátko zapne kúrenie, PRERAZÍ TARIFU (nie floor/krb bezpečnosť)

0.5 FVE PREBYTOK
   FVE entita = on A zóna má "Využi FVE prebytok" zapnuté
   → cieľ = Deň/Noc komfort, PRERAZÍ TARIFU (nie floor/krb)

1. TARIFA
   Entita "kúrenie povolené" != on
   → VYPNI VŠETKO (podlahu aj AC)

2. BEZPEČNOSŤ PODLAHY
   Teplota podlahy >= max (per zóna)
   → VYPNI, bez výnimky

3. KRB
   Zóna má "Reaguj na krb" zapnuté A krb horí A teplota pri krbe >= threshold
   → VYPNI kúrenie v tejto zóne

4. MANUÁLNY REŽIM (ak zóna nie je v Auto)
   Den / Noc / Min / Mraz / Vypnute — priama teplota, žiadne ďalšie vyhodnocovanie

5. AUTO (ak je zóna v režime Auto)
   a. Urč Deň/Noc komfortnú teplotu podľa aktuálneho času a toho, či je
      dnes pracovný deň alebo víkend (samostatné časové hranice pre obe)
   b. Skutočne je niekto doma (GPS alebo manuálny override)?
      → Komfort (Deň alebo Noc podľa času)
   c. Beží okno predkúrenia? (len Po–Pia, pevný čas)
      → Komfort
   d. Inak
      → Min (len udržiavanie, baseline)
```

**Boost** (tlačidlo, dočasné forcovanie na X hodín) sa vyhodnocuje ešte pred
krokom 4 — prebíja manuálny režim aj Auto, ale **rešpektuje** tarifu, podlahu
aj krb (nie núdzovú ochranu/FVE — tie majú vlastnú prioritu). Nezávisí od
reálnej prítomnosti — dá sa spustiť aj keď systém nikoho neeviduje ako doma.

### Zóna `floor_ac` — priorita AC → podlaha

Cieľová teplota sa počíta rovnako ako vyššie, ale realizácia je iná:

1. Klimatizácia sa nastaví na vypočítaný cieľ ako prvá (primárny zdroj)
2. Ak aktuálna teplota zaostáva za cieľom o viac než nastavený rozdiel (°C)
   dlhšie než nastavený čas (minúty), zapne sa aj podlaha ako dokurovanie
3. Keď AC dobehne cieľ, podlaha sa vypne

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

Všetky polia sú voliteľné — dajú sa doplniť aj neskôr cez "Nastaviť".

### 2. Pridanie zóny

Na dlaždici integrácie klikni **Nastaviť (Configure)** → **Pridať zónu**:

- Zadaj názov, vyber typ zóny a podlahový/klimatizačný `climate` entity
- Priraď osoby na sledovanie prítomnosti
- Ulož

Po pridaní zóny sa vytvorí ~18 entít (pozri nižšie) — všetky s predvolenými
hodnotami, ktoré si doladíš cez entity alebo priamo cez Lovelace kartu.

### 3. Pridanie karty na dashboard

Pridaj JS resource (**Nastavenia → Ovládacie panely → Zdroje**):

```
URL: /local/smart-heating-card.js   (skopíruj tam www/smart-heating-card.js)
Typ: JavaScript modul
```

Potom na dashboard:

```yaml
type: custom:smart-heating-card
zone_id: "xxxxxxxx"   # najdes v entity_id, napr. climate.smart_heating_xxxxxxxx
name: "Obývačka"       # volitelne, inak sa pouzije meno z climate entity
```

---

## Entity vytvorené integráciou

### Hub (globálne)

| Entity | Popis |
|---|---|
| `switch.smart_heating_nepritomnost` | Dovolenka/Neprítomnosť |
| `number.smart_heating_nudzova_teplota` | núdzová protimrazová hranica |
| `number.smart_heating_krb_threshold` | prahová teplota pri krbe |

### Per zóna (`<id>` = interné ID zóny)

| Entity | Popis |
|---|---|
| `climate.smart_heating_<id>` | hlavný virtuálny termostat — primárne ovládacie miesto |
| `select.smart_heating_<id>_rezim` | Auto / Den / Noc / Min / Mraz / Vypnute |
| `number..._teplota_den` / `_teplota_noc` / `_teplota_min` / `_teplota_mraz` | teploty |
| `number..._floor_min` / `_floor_max` | bezpečnostné limity teploty podlahy |
| `number..._boost_hodiny` | trvanie Boostu |
| `number..._ac_priorita_rozdiel` / `_ac_priorita_minuty` | len pre `floor_ac` zóny |
| `time..._den_od_tyzden` / `_vikend`, `_noc_od_tyzden` / `_vikend` | časové hranice Deň/Noc, zvlášť pracovný deň a víkend |
| `time..._predkurenie_od` / `_do` | okno predkúrenia (len Po–Pia) |
| `switch..._predkurenie_povolene` | zapnutie/vypnutie predkúrenia |
| `switch..._reaguj_na_krb` | zapnutie/vypnutie reakcie na krb |
| `switch..._vyuzi_fve_prebytok` | zapnutie/vypnutie využitia FVE prebytku |
| `button..._boost` | okamžité spustenie Boostu |
| `sensor..._stav` | diagnostický dôvod aktuálneho rozhodnutia (aj atribúty: `heating_allowed`, `zdroj_kurenia`, `tariff_blocked`, `floor_override`, `krb_override`, `emergency_active`, `pv_active`, `boost_active`) |

---

## Lovelace karta

`www/smart-heating-card.js` — čistý JavaScript web component, žiadny build
krok. Jedna karta = jedna zóna. Obsahuje:

- Aktuálnu/cieľovú teplotu, dôvod rozhodnutia, farebné odznaky (núdzová
  ochrana, tarifa, podlaha, krb, FVE, boost)
- Prepínanie režimu (chipy)
- Steppery na všetky teploty
- Časové polia (pracovný deň / víkend / predkúrenie)
- Prepínače (predkúrenie, krb, FVE)
- Boost (trvanie + tlačidlo)

Karta prekresľuje obsah **len** keď sa zmení niečo z jej vlastnej zóny (nie
pri každej zmene v celom Home Assistant) — dôležité pre výkon pri väčšom
počte kariet na dashboarde.

---

## Príklady použitia

### "Chcem, aby sa doma kúrilo skôr, než prídeme"

Nastav `predkurenie_od` (napr. 15:00) a `predkurenie_do` (napr. 18:00, ako
poistka keby nikto neprišiel) — funguje len v pracovné dni.

### "Cez víkend chodíme spať neskôr a vstávame neskôr"

Nastav `den_od_vikend` a `noc_od_vikend` odlišne od `den_od_tyzden`/`noc_od_tyzden`.

### "Nechcem posielať prebytky FVE do siete v zime"

Priraď v hube entitu, ktorá kombinuje "FVE vyrába" a "batéria nabitá nad X %"
(vlastný template `binary_sensor`) do poľa **FVE prebytok**. Zóny s
`vyuzi_fve_prebytok` zapnutým sa začnú vykurovať na komfort aj bez prítomnosti.

### "Idem domov, chcem aby bolo teplo, aj keď je vysoká tarifa"

Stlač **Boost** — force-uje komfort na nastavený počet hodín. Poznámka: Boost
rešpektuje tarifu (počká, kým tarifa klesne) aj bezpečnosť podlahy/krbu.

---

## Riešenie problémov

**Zmena Python súboru sa neprejavila** → treba **celý reštart** Home Assistant,
nie len reload integrácie (platí obzvlášť pri pridaní/zmene platformy).

**Zmena JS karty sa neprejavila** → problém je takmer vždy v **cache
prehliadača**. V Safari: Shift+klik na tlačidlo obnovenia, alebo zmeň URL
resource na `?v=N` (zvýš číslo pri každej zmene) v Nastavenia → Ovládacie
panely → Zdroje.

**Options Flow hádže 500 Internal Server Error** → over verziu Home
Assistant; `config_entry` v `OptionsFlow` sa od HA 2024.12 nesmie nastavovať
manuálne v `__init__` (v tejto integrácii už opravené, ale relevantné ak
forkuješ kód).

**Custom entity vôbec nevznikli po pridaní zóny** → skontroluj **Nastavenia
→ Systém → Logy**, filter `smart_heating` — časté príčiny: nesprávny
`EntityCategory` (musí byť enum, nie string), nesprávny import konštanty z
`homeassistant.components.climate` v starších/novších verziách HA.

---

## Známe obmedzenia

- Boost, deficit AC↔podlaha a notifikačné flagy sú len v pamäti (RAM) — po
  reštarte Home Assistant sa vynulujú (zámerne, ide o krátkodobý stav)
- Bezpečnostné limity teploty podlahy vyžadujú samostatný senzor teploty
  podlahy priradený k zóne — bez neho sa táto ochrana nevyhodnocuje
- Karta nemá vizuálny editor konfigurácie — `zone_id` sa zadáva v YAML móde
  karty

---

## Licencia

Tento projekt je licencovaný pod [MIT licenciou](LICENSE) — môžeš ho slobodne
používať, upravovať aj šíriť, aj na komerčné účely, pokiaľ zachováš pôvodné
copyright oznámenie.
