# Raport — PCV korpusu pod kolor płyty / pod kolor frontów v1

Paczka: `site_pcv_front_color_mode_v1.zip`  
Cache-busting: `20260613_pcv_front_color_mode_v1`  
Data: 2026-06-13

## Zakres

- Dodano wybór **PCV korpusu** w preferencjach WYWIADU dla stref: dolna/stojąca, środkowa, górna/wisząca.
- Dodano wybór **PCV korpusu** w modalu pojedynczej szafki: **Pod kolor płyty** / **Pod kolor frontów**.
- Dodano obsługę PCV korpusu w hurtowym zastosowaniu preferencji strefowych.
- Rozdzielono ilości PCV w MATERIAŁACH na:
  - PCV pod kolor płyty,
  - PCV pod kolor frontów.
- Dodano startową pozycję katalogu materiałów: `PCV-FRONT` / **PCV pod kolor frontów**.
- WYCENA generuje osobne linie materiałowe dla obu typów PCV i pobiera osobne ceny za mb.

## Poza zakresem

- Nie dodano ręcznego wyboru koloru PCV na każdej formatce.
- Nie zmieniono ręcznego zaznaczania oklejanych krawędzi w MATERIAŁACH.
- Nie ruszano transportu, stawek godzinowych, kosztów firmy, automatów AGD, `drawer.count`, materiałów płytowych ani okuć.
- Stare snapshoty/oferty nie są przeliczane wstecz.

## Testy

- `node --check` zmienionych plików JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/pcv-front-color-mode-smoke.js` — OK.
- `node tools/pricing-modes-calculation-coverage-smoke.js` — OK.
- `node tools/app-dev-smoke.js` — OK, 109/109.
- `node tools/labor-time-minutes-smoke.js` — OK.
- `node tools/transport-catalog-quote-fix-smoke.js` — OK.
- `node tools/hourly-rates-settings-smoke.js` — OK.
- `node tools/company-transport-business-costs-smoke.js` — OK.
- `node tools/boot-domcontentloaded-init-fix-smoke.js` — OK.
- `node tools/labor-rate-profiles-restore-clean-smoke.js` — OK.
- `node tools/labor-appliance-category-clean-rebase-smoke.js` — OK.
