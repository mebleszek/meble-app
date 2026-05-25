# Cabinet hardware requirements v1 — 2026-05-25

## Baza

- Baza startowa: `site_hardware_producer_accessories_save_fix_v1.zip`.
- Paczka po tym etapie: `site_cabinet_hardware_requirements_v1.zip`.

## Cel etapu

Ten etap nie dobiera jeszcze konkretnego produktu katalogowego do WYCENY. Dodaje brakującą warstwę pośrednią:

```text
szafka / wariant frontu → wymaganie techniczne okucia → późniejszy resolver katalogu
```

Dzięki temu przyszły resolver nie będzie zgadywał zawiasu wyłącznie po producencie, tylko dostanie jawne wymaganie, np. `Zawias 110° nakładany`, `Zawias 170° narożny`, `Zawias lodówkowy` albo `Zawias do rogowej ślepej`.

## Dodane pliki i moduły

- Dodano `js/app/cabinet/cabinet-hardware-requirements.js`.
- Publiczne API: `window.FC.cabinetHardwareRequirements`.
- Główne funkcje:
  - `getBaseHingeRequirement(room, cab)` — zwraca wymaganie zawiasu bez ilości.
  - `getHingeRequirementWithQty(room, cab)` — dodaje ilość zawiasów, jeśli można ją policzyć.
  - `getCabinetHardwareRequirements(room, cab)` — zbiorcze wejście pod przyszłe okucia.
  - `needsFridgeFurnitureHinges(cab)` — sprawdza ptaszek lodówki.
  - `isBlumHkXsFlap(cab)` i `isHafeleScissorFlap(cab)` — wyjątki klap wymagające zawiasów 110°.

## Reguły zawiasów v1

| Nr | Szafka / przypadek | Reguła v1 |
|---:|---|---|
| 1 | Stojąca standardowa | Zawias 110° nakładany |
| 2 | Stojąca rogowa ślepa | Zawias do rogowej ślepej / ślepego narożnika; wymaga uzupełnienia konkretnej pozycji katalogowej |
| 3 | Stojąca narożna L | Zawias 170° narożny |
| 4 | Piekarnikowa — klapka/drzwiczki | Zawias 110° nakładany |
| 5 | Piekarnikowa — szuflada | Bez zawiasów |
| 6 | Zlewowa — drzwi | Zawias 110° nakładany |
| 7 | Zlewowa — szuflada | Bez zawiasów |
| 8 | Zmywarkowa | Bez zawiasów meblowych; osobno montaż AGD |
| 9 | Lodówkowa | Domyślnie bez zawiasów; po zaznaczeniu `Wymaga zawiasów meblowych` używa wymagania `Zawias lodówkowy / do frontu lodówki` |
| 10 | Szufladowa | Bez zawiasów |
| 11 | Wisząca standardowa | Zawias 110° nakładany |
| 12 | Wisząca rogowa ślepa | Jak stojąca rogowa ślepa |
| 13 | Wisząca narożna L | Zawias 170° narożny |
| 14 | Dolna podblatowa — drzwi | Zawias 110° nakładany; logicznie traktowana jako `stojąca_bez_nóg` |
| 15 | Dolna podblatowa — szuflady/brak frontu | Bez zawiasów |
| 16 | Okapowa — drzwiczki | Zawias 110° nakładany; montaż AGD okapu osobno |
| 17 | Okapowa — klapa | Oznaczone jako przyszła reguła do podpięcia pod klapy/podnośniki |
| 18 | Klapa Blum HK-XS | Podnośnik + pomocnicze zawiasy 110° nakładane |
| 19 | Klapa z podnośnikiem nożycowym Häfele DUO | Podnośnik + pomocnicze zawiasy 110° nakładane |
| 20 | Zestawy | Na razie zawias 110° nakładany liczony od frontu zestawu |

## Zmiany w naliczaniu zawiasów

- `js/app/cabinet/front-hardware-hinges.js` nie nalicza już zawiasów dla wariantów, które nie powinny ich mieć:
  - zmywarka,
  - szuflady,
  - zlewowa z dużą szufladą,
  - piekarnikowa z wariantem szuflady,
  - dolna podblatowa z szufladami albo bez frontu,
  - okapowa z klapą,
  - lodówka bez ptaszka `Wymaga zawiasów meblowych`.
- Lodówka z zaznaczonym ptaszkiem liczy ilość zawiasów z realnych frontów lodówkowych.
- `js/app/cabinet/cabinet-cutlist.js` do partów okuć dopina `hardwareRequirement`, żeby przyszła WYCENA/resolver miały techniczny kontekst.

## UI lodówki

- W `js/app/cabinet/cabinet-modal-standing-specials.js` dodano aplikacyjny checkbox/chip:
  - `Wymaga zawiasów meblowych`.
- Pole zapisuje `draft.details.requiresFurnitureHinges`.
- Bez zaznaczenia lodówka nie dostaje zawiasów meblowych.

## Katalog okuć

Dodano typy techniczne do słowników/katalogu:

- `hinge_blind_corner` — `Do rogowej ślepej / ślepego narożnika`.
- `hinge_fridge` — `Lodówkowy / do frontu lodówki`.

Do dozwolonych wartości parametru `nalozenie` dla zawiasów dodano:

- `równoległy / do ślepego narożnika`,
- `lodówkowy`.

Nie dodano konkretnego produktu i ceny Bivert dla zawiasu rogowej ślepej, ponieważ bez pewnego symbolu i ceny nie wolno tworzyć fikcyjnej pozycji katalogowej.

## Co zostaje na przyszłość

1. Dodać konkretną pozycję katalogową i cenę dla zawiasu do rogowej ślepej / ślepego narożnika, prawdopodobnie z Bivert, po ustaleniu prawdziwego symbolu i ceny.
2. Dodać pełną logikę okapowej: wybór drzwiczki/klapa oraz montaż AGD okapu.
3. Dodać wariant szuflad wewnętrznych:
   - 155° zerowy uskok,
   - albo szuflady wewnętrzne `na dystansie`, np. 1,8 cm, wtedy możliwy zwykły zawias 110° nakładany.
4. Rozwinąć warstwę `front nakładany / wpuszczany / bliźniaczy` jako osobne wymaganie techniczne, bez mieszania z obecnym v1.
5. Podłączyć przyszły resolver:
   - wymaganie techniczne,
   - preferowany producent z WYWIADU,
   - konkretna pozycja katalogowa,
   - cena oznaczona `Do wyceny`.
6. Dla zestawów dodać kiedyś edycję poszczególnych korpusów; teraz okucia są liczone od frontu zestawu.

## Testy regresji

- Rozszerzono `tools/app-dev-smoke.js` o kontrakty:
  - API `FC.cabinetHardwareRequirements`,
  - reguły: 110°, 170°, rogowa ślepa, piekarnikowa szuflada/klapka, zlewowa szuflada, dolna podblatowa, lodówka z ptaszkiem,
  - UI ptaszka lodówki,
  - nowe typy i wartości katalogu okuć.
