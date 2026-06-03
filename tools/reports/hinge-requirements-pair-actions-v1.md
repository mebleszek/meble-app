# Wspólne akcje zawiasów dla szafki dwudrzwiowej v1 — 2026-06-03

## Zakres

Dodano wspólne akcje pod dwoma kolumnami wymagań zawiasowych w modalu szafki dwudrzwiowej.

## Zmiany

- `Zmień oba` ustawia ten sam wariant wymagania kompletu zawiasowego dla lewych i prawych drzwiczek.
- `Przywróć domyślne dla obu` usuwa ręczne nadpisania z obu stron.
- Osobne przyciski `Zmień` / `Przywróć domyślne` dla lewej i prawej strony zostały zachowane.
- Układ lewe/prawe pozostaje w jednym rzędzie z pionową kreską.
- Wybór pozostaje kaskadowy i dotyczy wymagań technicznych, nie producenta ani konkretnego modelu katalogowego.

## Zasada architektoniczna

Wspólna akcja jest tylko skrótem UI. Źródłem prawdy dalej są nadpisania wymagań w danych szafki per drzwiczki oraz centralny helper `cabinet-hardware-requirements`.

## Pliki

- `js/app/cabinet/cabinet-hardware-requirements-panel.js`
- `css/cabinet-common.css`
- `tools/cabinet-hardware-requirements-live-edit-smoke.js`
- `tools/cabinet-hardware-requirements-panel-smoke.js`
- `README.md`
- `DEV.md`
- `QUOTE_CALCULATION_REGISTER.md`

## Testy

- `node --check` dla zmienionych plików JS.
- Smoke testy panelu wymagań technicznych.
- Główne smoke testy aplikacji po zmianie cache-bustingu.
