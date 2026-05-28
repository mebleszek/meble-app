# Hardware catalog seed v1 — 2026-05-07

## Baza

Start: `site_hardware_bundle_inputs_v1.zip`.

## Zakres

- Dodano `js/app/catalog/hardware-catalog-seed-data.js` jako osobny moduł danych seedów oraz `js/app/catalog/hardware-catalog-seeds.js` jako osobny moduł merge.
- Podłączono seed do `catalog-store.js` przez `FC.hardwareCatalogSeeds.mergeAccessorySeeds()`.
- Seed dodaje pozycje Blum/GTV/Peka/Nomet/Rejs bez nadpisywania ręcznie edytowanych rekordów.
- Usuwany jest wyłącznie dokładny placeholder `a1 / Blum / B1 / Zawias Blum`, jeżeli nie ma źródła i notatki.

## Pozycje seed

- Blum: CLIP top BLUMOTION 110°, wpuszczany 110°, zerowy uskok 155°, 170° narożny, TANDEMBOX.
- GTV: zawias 110° cichy domyk oraz Modern Box.
- Peka: cargo SNELLO / SNELLO FIORO.
- Nomet: cargo 150 Standard Pro oraz Cargo MAXI.
- Rejs: Comfort Box / Comfort Box Plus.

## Audyt danych/chmury

- Brak nowych bezpośrednich zapisów do `localStorage`.
- Seed zostaje katalogiem użytkownika, a nie snapshotem projektu/oferty.
- Stabilne ID seedów przygotowują późniejsze mapowanie do dokumentów katalogowych w chmurze.

## Testy

- `node --check js/app/catalog/hardware-catalog-seed-data.js`
- `node --check js/app/catalog/hardware-catalog-seeds.js`
- `node --check js/app/catalog/catalog-store.js`
- `node --check js/app/catalog/catalog-migration.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
