# Hardware compare modes / storage cleanup v1 — 2026-05-21

## Baza

- Start: `site_000_hardware_edit_modal_perf_fix_v1.zip`.

## Zakres

- Nie zmieniano UI ani miejsca ustawiania zasad zamienników.
- Zmieniono semantykę trybu `withinRange` w `FC.hardwareTechnicalParams.compareParam()`.
- `withinRange` oznacza teraz pełne objęcie wymaganej wartości albo wymaganego zakresu przez zakres zamiennika.
- `rangeOverlap` pozostaje osobnym, luźniejszym trybem dla częściowego przecięcia zakresów.
- Doprecyzowano teksty pomocy dla `withinRange` i `rangeOverlap`.
- Uzupełniono klasyfikację storage dla katalogowych kluczy okuć.

## Ochrona przed regresją

Dodano testy, które pilnują między innymi:

- wartość dokładna 110 mieści się w zakresie 90–110,
- wymagany zakres 90–110 mieści się w szerszym zakresie zamiennika 90–120,
- częściowe przecięcie 90–110 z 100–120 nie przechodzi jako `withinRange`,
- to samo przecięcie przechodzi jako `rangeOverlap`,
- rozłączne zakresy 90–110 i 111–120 nie przechodzą jako `rangeOverlap`,
- `minGte` nadal akceptuje lepszą/nośniejszą wartość i odrzuca słabszą.

## Storage / backup

- Nie dodano nowych kluczy storage.
- Nie zmieniono mechanizmu backupu, restore ani retencji.
- Uzupełniono opisy diagnostyczne dla:
  - `fc_hardware_manufacturers_v1`,
  - `fc_hardware_suppliers_v1`,
  - `fc_hardware_settings_v1`,
  - `fc_hardware_categories_v1`,
  - `fc_hardware_types_v1`,
  - `fc_hardware_technical_params_v1`.

## Czego nie ruszano

- PRO100.
- Usług stolarskich.
- ROZRYS/RYSUNEK/WYCENA.
- Import/export Excel poza testami kontraktu dynamicznych parametrów.
- Polityki backupów.
