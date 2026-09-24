# Publikovanie novej verzie

Toto je kontrolný zoznam pre vydávanie nových verzií tejto integrácie a,
prípadne, jej odoslanie do defaultného HACS obchodu. Založené na oficiálnej
dokumentácii na [hacs.xyz/docs/publish](https://hacs.xyz/docs/publish/) —
over si tam čokoľvek, čo tu nie je pokryté, keďže sa proces môže zmeniť.

## Pri každom vydaní

1. Zvýš `version` v `custom_components/smart_heating/manifest.json`.
   Ak sa zmenila aj karta, zvýš aj `version` v `package.json`.
2. Spusti si obe testovacie sady lokálne (`pytest`, `npm test`) — CI ich
   spustí znova, ale skoré odhalenie chyby ušetrí čas.
3. Pushni do `main`. Počkaj, kým workflow `Validate` prejde zelene (HACS
   akcia, hassfest, pytest, node testy).
4. Vytvor **GitHub Release** (nie len tag!) s tagom presne zodpovedajúcim
   verzii, napr. `v0.8.1`. HACS používa tag releasu ako verziu, ktorú vidia
   používatelia — samotný tag nestačí, a workflow `release.yml` zhodí beh,
   ak tag nesedí s `manifest.json`.
5. Používatelia na custom-repository trati dostanú update automaticky pri
   najbližšej kontrole HACS (alebo cez "Redownload").

## Požiadavky na repozitár (jednorazovo, udržiavať platné)

Toto kontroluje samotný HACS, a neskôr aj recenzia `hacs/default`:

- **Popis** nastavený na GitHub repe (používa sa v HACS UI)
- **Témy (Topics)** nastavené na GitHub repe (Settings → General → Topics) —
  nedá sa automatizovať cez commitnuté súbory, musí sa spraviť v GitHub UI
- **Issues povolené** na repe
- **Nie archivovaný**
- **README** s reálnymi inštrukciami na použitie (tento repo ho má)
- `hacs.json` aspoň s `name` (tento repo má aj `homeassistant` minimálnu
  verziu a `render_readme`)
- **Brand ikonka**: `custom_components/smart_heating/brand/icon.png` (+ `@2x`,
  `logo.png`, `logo@2x.png`). Od Home Assistant 2026.3 si integrácie nosia
  vlastné brand assety priamo — už netreba PR do `home-assistant/brands` pre
  custom integrácie. Vlastná kontrola HACS pre default store použije
  `home-assistant/brands` len ako záložný zdroj, ak integrácia nemá svoje.

## Odoslanie do defaultného HACS obchodu (voliteľné, jednorazovo)

Keď repo reálne spĺňa latku (skutoční používatelia, stabilita — aktívna
údržba nie je striktne vyžadovaná, ale silne naznačená tým, že recenzia trvá
mesiace), môžeš ho odoslať, aby si ho ľudia nemuseli pridávať ako custom
repozitár:

1. Uisti sa, že existuje GitHub Release a `Validate` akcia je zelená —
   **oboje je vyžadované predtým, než otvoríš PR.**
2. Fork [hacs/default](https://github.com/hacs/default). Vytvor novú vetvu
   z `master` (necommituj priamo do `master` vo svojom forku).
3. Pridaj `tomasbobala/smart_heating` do súboru **`integration`**
   (`hacs/default/integration`), **abecedne zoradené** — súbor je plochý JSON
   zoznam, jeden reťazec `"owner/repo"` na riadok; CI kontrola "lint sorted"
   na PR toto vynucuje.
4. Otvor PR **z vlastného účtu**, nie z organizácie (požiadavka je, že PR
   musí zostať editovateľný tebou).
5. Vyplň šablónu PR presne tak, ako je daná — nesprávne vyplnená šablóna
   znamená zatvorenie PR bez ďalšieho upozornenia, podľa vlastných pravidiel HACS.
6. Počkaj. Nové podania "trvajú mesiace na recenziu", podľa oficiálnej
   dokumentácie. Stav vo fronte si vieš overiť cez
   [zoznam otvorených, nie-draft PR](https://github.com/hacs/default/pulls?q=is%3Apr+is%3Aopen+draft%3Afalse+sort%3Acreated-asc)
   zoradený podľa veku.
7. Automatizované kontroly na PR zahŕňajú: prítomnosť brand ikonky, platnosť
   manifestu, vlastnú validáciu HACS, zmysluplnosť `hacs.json`, "nie
   archivovaný", "má release", "si vlastník/hlavný prispievateľ", popis/
   issues/témy repozitára, platný JSON a správne abecedné zoradenie. Všetko
   musí prejsť, pokiaľ sa s tímom HACS vopred nedohodneš inak.
8. Ak je tvoj repozitár relevantný len pre konkrétne krajiny, nastav
   `country` vo *vydanom* `hacs.json`.

Po zlúčení PR sa repozitár objaví v defaultnom HACS obchode pri najbližšom
naplánovanom skene — netreba nič ďalšie robiť.

## Bežné chyby (naučené na vlastnej koži, na tomto aj inom repe)

- Zabudnutie zvýšiť `version` v `manifest.json` pred tagovaním releasu —
  `release.yml` to teraz chytá.
- `codeowners` záznam, ktorý nie je platné GitHub meno (bodky nie sú povolené).
- Deklarovanie nižšej minimálnej HA verzie v `hacs.json`, než kód reálne
  vyžaduje (napr. táto integrácia potrebuje HA >= 2024.12 kvôli tomu, ako
  funguje `OptionsFlow.config_entry`).
- Odoslanie do `hacs/default` z organizačného účtu, alebo predtým, než
  existuje release/zelený beh CI.
