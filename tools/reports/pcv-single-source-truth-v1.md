# Raport: PCV jedna prawda MATERIAŁ → WYCENA v1

## Baza

- Baza wejściowa: `site_quote_audit_material_quantities_fix_v1.zip`.
- Paczka wyjściowa: `site_pcv_single_source_truth_v1.zip`.

## Problem

WYCENA liczyła obrzeża z agregatu ROZRYSU, a MATERIAŁ liczył okleiny ze źródłowych formatek szafek. To dawało rozjazd, np. MATERIAŁ pokazywał około `7.98 mb`, a audyt WYCENY pokazywał `18.776 mb` przed zapasem. Dodatkowo checkboxy PCV w MATERIAŁ były dostępne dla każdej formatki z wymiarami, bez sprawdzania, czy realny materiał jest laminatem.

## Zasada po poprawce

PCV jest decyzją materiałową dla konkretnej formatki. Jedno źródło prawdy:

1. formatka ma realny materiał,
2. centralny helper rozpoznaje typ materiału,
3. tylko `laminat` może mieć checkboxy PCV i metry oklein,
4. MATERIAŁ pokazuje te metry,
5. WYCENA bierze te same metry i dolicza +10% zapasu.

WYCENA nie może samodzielnie przeliczać PCV z agregatu ROZRYSU.

## Zmienione pliki

- `js/app/material/material-edge-store.js`
  - dodano rozpoznawanie typu materiału formatki,
  - dodano `isPcvEligiblePart`, `isPcvEligibleMaterial`, `resolveMaterialType`,
  - `getEdges` i `calcEdgeMetersForParts` ignorują nie-laminaty,
  - stare zapisane krawędzie dla lakieru/akrylu/HDF nie wpływają na wynik.

- `js/app/material/material-tab-data.js`
  - dodano `collectEdgeMetersForRooms`,
  - helper agreguje PCV po pokojach i zakresie materiałowym tą samą logiką co MATERIAŁ,
  - obsługuje zakres: wszystkie / fronty / korpusy / konkretny materiał.

- `js/tabs/material.js`
  - checkboxy PCV są renderowane tylko dla formatek kwalifikujących się przez centralny helper,
  - dla nie-laminatów pokazuje komunikat `Bez PCV — materiał nie jest laminatem`.

- `js/app/wycena/wycena-core-material-plan.js`
  - usunięto niezależne sumowanie PCV z `selectedParts` agregatu ROZRYSU,
  - dodano pobieranie ilości z helpera MATERIAŁU,
  - linia audytu PCV ma pola i opis: metry z elementów, zapas +10%, metry do wyceny.

- `tools/quote-audit-material-quantities-fix-smoke.js`
  - dodano test zgodności MATERIAŁ ↔ WYCENA,
  - dodano testy: laminat liczy PCV, lakier/akryl/HDF nie liczą PCV,
  - dodano test ignorowania starych zapisanych krawędzi dla lakieru,
  - utrzymano test braku ABS.

- `index.html`
  - podbito cache-busting zmienionych modułów do `20260601_pcv_single_source_truth_v1`.

- `README.md`, `DEV.md`, `QUOTE_CALCULATION_REGISTER.md`
  - zapisano zasadę jednej prawdy dla PCV i regułę: PCV tylko dla laminatu.

## Testy

- `node --check js/app/material/material-edge-store.js`
- `node --check js/app/material/material-tab-data.js`
- `node --check js/tabs/material.js`
- `node --check js/app/wycena/wycena-core-material-plan.js`
- `node --check tools/quote-audit-material-quantities-fix-smoke.js`
- `node tools/quote-audit-material-quantities-fix-smoke.js`

## Nie ruszano

- PRO100,
- ROZRYS jako mechanizmu rozkroju arkuszy,
- import/export Excel okuć,
- backupów i retencji,
- panelu kategorii okuć,
- pełnego modelu wymagań technicznych okuć.
