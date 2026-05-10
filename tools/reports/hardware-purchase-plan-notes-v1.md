# hardware-purchase-plan-notes-v1 — 2026-05-10

Baza startowa: `site_hardware_catalog_ux_v1.zip`

Zakres: tylko dokumentacja planistyczna w plikach `.md`. Nie zmieniano runtime, UI, storage ani testów.

## Dopisane decyzje

- Katalog okuć docelowo ma rozdzielać produkt techniczny od wielu cen u dostawców.
- WYCENA ma zapisywać snapshot ceny użytej do oferty, zamiast odczytywać później aktualny katalog.
- Automat najtańszego zakupu nie powinien ustalać ceny dla klienta; po akceptacji oferty ma powstawać lista zakupów z sugestiami dostawców.
- Raport rentowności ma porównywać koszt okuć z oferty, sugerowany koszt zakupu, rzeczywisty koszt zakupu i różnicę zakupową.

## Zmienione pliki

- `DEV.md`
- `CLOUD_MIGRATION.md`
- `OPTIMIZATION_PLAN.md`
- `tools/reports/hardware-purchase-plan-notes-v1.md`
