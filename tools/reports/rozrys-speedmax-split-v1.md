# ROZRYS speed-max split v1 — 2026-04-27

## Zakres

Techniczny split `js/app/optimizer/speed-max.js` bez zmiany UI, bez zmiany danych i bez celowej zmiany algorytmu optymalizacji.
Publiczny kontrakt zostaje ten sam: `FC.rozkrojSpeeds.max.pack(...)` oraz `FC.rozkrojSpeeds.max.previewAxis(...)`.

## Nowy podział plików

| Plik | Odpowiedzialność |
| --- | --- |
| `js/app/optimizer/speed-max-core.js` | stałe, mapowanie osi, helpery osi, `emitStage`, porównanie pasów |
| `js/app/optimizer/speed-max-bands.js` | seed options, kandydaci, DP pasów, repair, fallback pasów |
| `js/app/optimizer/speed-max-sheet-plan.js` | stan arkusza, 1–2 pasy startowe, obowiązkowy obrót osi, domknięcie resztek, plan arkusza |
| `js/app/optimizer/speed-max-half-sheet.js` | półarkusz/wirtualna półpłyta, wybór osi dla półarkusza |
| `js/app/optimizer/speed-max.js` | cienka fasada rejestrująca tryb `MAX` w `FC.rozkrojSpeeds` |

## Load order

Nowe moduły są ładowane przed fasadą `speed-max.js` w:

1. `index.html`,
2. `dev_tests.html`,
3. `tools/index-load-groups.js`,
4. `tools/rozrys-dev-smoke.js`,
5. `js/app/optimizer/panel-pro-worker.js`.

## Kontrakty zachowane po splicie

1. `IDEAL_OCCUPANCY = 0.95`.
2. `MIN_OK_OCCUPANCY = 0.9`.
3. `MAX_TOP_SEEDS = 5`.
4. `LENGTHWISE_AXIS = 'across'`.
5. `start-along` nadal mapuje fizyczne „wzdłuż” na `across`.
6. `start-across` nadal mapuje fizyczne „w poprzek” na `along`.
7. Kolejność planu MAX zostaje: start-axis → start-pass-1 → start-pass-2 → mandatory-axis-switch → residual/fallback.
8. Worker `panel-pro-worker.js` ładuje dokładnie ten sam zestaw modułów co runtime.

## Porównanie old/new

Wykonano jednorazowe porównanie starego monolitu `speed-max.js` z nowym splitem na czterech fixture'ach:

1. proste pasy,
2. wymuszony start w poprzek,
3. mieszany `Opti-max`,
4. przypadek z wirtualną półpłytą.

Wynik: `4/4` fixture'y dały identyczny znormalizowany wynik rozmieszczeń.

## Audyt plików nowych / mocno zmienionych

| Plik | Linie | Wniosek |
| --- | ---: | --- |
| `speed-max-core.js` | 50 | OK, jedna odpowiedzialność |
| `speed-max-bands.js` | 380 | poniżej 400, jedna główna odpowiedzialność: budowanie pasów; pilnować, żeby nie dodawać tu planu arkusza |
| `speed-max-sheet-plan.js` | 230 | OK, jedna odpowiedzialność: plan arkusza |
| `speed-max-half-sheet.js` | 114 | OK, jedna odpowiedzialność: półarkusz |
| `speed-max.js` | 105 | OK, cienka fasada rejestracji trybu MAX |
| `optimizer-contracts.js` | 136 | OK, zaktualizowane kontrakty źródłowe po splicie |

## Wyniki testów

- `node --check js/app/optimizer/speed-max-core.js` — OK.
- `node --check js/app/optimizer/speed-max-bands.js` — OK.
- `node --check js/app/optimizer/speed-max-sheet-plan.js` — OK.
- `node --check js/app/optimizer/speed-max-half-sheet.js` — OK.
- `node --check js/app/optimizer/speed-max.js` — OK.
- `node --check js/app/optimizer/panel-pro-worker.js` — OK.
- `node --check js/testing/rozrys/suites/optimizer-contracts.js` — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/app-dev-smoke.js` — 195/195 OK.
- `node tools/dependency-source-audit.js` — OK, raport odświeżony.

## Następny bezpieczny etap

Po tym splicie można zacząć realne poprawianie algorytmu, ale już małymi krokami i z testem dla każdego zachowania. Najbezpieczniejsza kolejność:

1. test porównawczy dla konkretnej regresji/przykładu z realnymi formatkami,
2. poprawka tylko w jednym module,
3. porównanie wyniku przed/po,
4. aktualizacja kontraktu, jeśli oczekiwane zachowanie świadomie się zmienia.

Nie dokładać ciężkiej logiki do `speed-max.js`; ten plik ma zostać fasadą.
