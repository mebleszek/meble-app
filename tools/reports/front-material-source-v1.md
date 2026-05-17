# Front material source v1 — 2026-05-16

## Baza

`site_000_room_zone_preferences_v1.zip`

## Cel

Dodać fundament pod fronty specjalne, które nie muszą mieć materiału wpisanego na sztywno. Front lodówki albo zestawu może brać materiał z jednej ze stref pokoju albo mieć własny materiał.

## Zakres

- `lower` — jak strefa dolna / stojące.
- `middle` — jak strefa środkowa / moduły.
- `upper` — jak strefa górna / wiszące.
- `custom` — własny materiał i kolor.

Zakres wdrożenia: lodówki w zabudowie i zestawy szafek.

## Pliki domenowe

- `js/app/cabinet/front-material-source.js` — normalizacja i rozwiązywanie źródła materiału.
- `js/app/cabinet/cabinet-fronts.js` — generowanie frontów lodówki z materiałem ze źródła.
- `js/app/cabinet/cabinet-modal-standing-specials.js` — UI źródła materiału dla lodówki.
- `js/app/cabinet/cabinet-modal-set-wizard.js` — UI i zapis źródła materiału zestawu.

## Dane

- Lodówki: `details.fridgeFrontSourceSingle`, `details.fridgeFrontSourceLower`, `details.fridgeFrontSourceUpper` oraz opcjonalne pola własne.
- Zestawy: `set.frontSource`.
- Fronty pochodne: `front.frontMaterialSource` jako metadana ułatwiająca późniejsze bulk-apply.

## Ograniczenia

- Nie dodano tabeli frontów wieloczęściowych.
- Nie dodano hurtowej zmiany istniejących szafek.
- Nie zmieniono WYCENY, ROZRYS, PRO100 ani backup policy.

## Testy

- Dodano testy dev dla lodówki i zestawu.
- Dodano smoke test Node dla dostępności `FC.frontMaterialSource`.
