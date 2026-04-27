# ROZRYS optimizer contracts v1 — 2026-04-27

## Zakres

Paczka zabezpiecza kolejny etap pracy nad optymalizatorem rozkroju przed fizycznym splitem `speed-max.js`.
Nie zmienia UI, algorytmu produkcyjnego ani danych użytkownika.

Dodano `js/testing/rozrys/suites/optimizer-contracts.js` oraz podpięto suite do `js/testing/rozrys/tests.js`, `dev_tests.html` i `tools/rozrys-dev-smoke.js`.

## Nowe kontrakty

1. Źródła startów i MAX są dostępne dla testów ROZRYS.
2. `start-along` zachowuje obecne mapowanie: etykieta „Pierwsze pasy wzdłuż” → oś `across` jako fizyczny lengthwise obecnego silnika.
3. `start-across` zachowuje obecne mapowanie: etykieta „Pierwsze pasy w poprzek” → oś `along`.
4. `start-optimax` nadal porównuje preview obu osi i wybiera po `usedArea`, `placementCount`, a potem `waste`.
5. `speed-max.js` zachowuje kolejność: start-axis → start-pass-1 → start-pass-2 → mandatory-axis-switch.
6. `cutOptimizer.packShelf` nadal uwzględnia rzaz piły między formatkami.
7. Słój blokuje obrót, a wyjątek `free` dopuszcza obrót wskazanej formatki.
8. Bazowy shelf packing nie gubi prostych formatek i umie domknąć mały pasek na tym samym arkuszu.
9. `speed-max.js` zachowuje progi `IDEAL_OCCUPANCY = 0.95`, `MIN_OK_OCCUPANCY = 0.9`, `MAX_TOP_SEEDS = 5` i `LENGTHWISE_AXIS = 'across'`.

## Dlaczego część kontraktów jest źródłowa

Bezpośredni smoke ROZRYS nie uruchamia pełnego `speed-max.pack()` na ciężkich przypadkach, bo celem tej paczki jest zabezpieczenie kontraktu przed refaktorem, a nie kosztowne liczenie. Testy źródłowe pilnują stałych, osi i kolejności etapów bez obciążania smoke runnera. Lekkie zachowania wykonawcze są sprawdzane przez `cutOptimizer.packShelf` i `rozrysEngine.computePlan`.

## Audyt plików zmienionych / dodanych

| Plik | Linie | Odpowiedzialność | Wniosek |
| --- | ---: | --- | --- |
| `js/testing/rozrys/suites/optimizer-contracts.js` | 131 | kontrakty optymalizatora ROZRYS | OK, jedna odpowiedzialność |
| `js/testing/rozrys/tests.js` | 458 | runner suite ROZRYS | istniejący runner, zmiana tylko dopina nową suite |
| `tools/rozrys-dev-smoke.js` | 188 | bezpośredni Node smoke ROZRYS | OK, dopięto suite i assets źródłowe |
| `dev_tests.html` | 375 | ręczne wejście testów | OK, dopięto nową suite i cache-busting |

## Wyniki testów

- `node --check js/testing/rozrys/suites/optimizer-contracts.js` — OK.
- `node --check js/testing/rozrys/tests.js` — OK.
- `node --check tools/rozrys-dev-smoke.js` — OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/check-index-load-groups.js` — OK.

`node tools/app-dev-smoke.js` nie ukończył się w środowisku narzędziowym podczas tej paczki i nie wygenerował raportu. Bezpośredni smoke ROZRYS oraz load-order przeszły; przy kolejnym etapie warto osobno sprawdzić/ustabilizować czas wykonywania APP smoke, bo problem nie wynika z tej suite ROZRYS.

## Rekomendowany następny etap

Dopiero po tej paczce ciąć `js/app/optimizer/speed-max.js` technicznie, bez zmiany algorytmu. Proponowany split:

1. `speed-max-constants.js` — progi i mapowanie osi.
2. `speed-max-axis.js` — helpery osi, grubości, długości i przeciwnej osi.
3. `speed-max-seeds.js` — seed options i limit top 5.
4. `speed-max-band-builder.js` — budowanie pasów i fallbacków.
5. `speed-max-sheet-plan.js` — kolejność 1–2 pasy startowe, obrót osi i domknięcie.
6. `speed-max-result.js` — budowanie arkusza, półpłyta i summary.

Każdy split ma utrzymać publiczny kontrakt `FC.rozkrojSpeeds.max`.
