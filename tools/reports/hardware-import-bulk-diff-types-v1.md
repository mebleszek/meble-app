# Hardware import bulk/diff/types fix v1 — 2026-05-11

Baza: `site_hardware_supplier_import_dictionary_ux_fix_v1.zip`.

## Zakres

- Puste `typ_cecha` nie dostaje automatycznie pierwszego typu ze słownika w formularzu.
- `Ceny_dostawcow` ma kolumnę `producent` i import dopasowuje ceny po `producent + symbol`, gdy nie ma technicznego `okucie_id`.
- Import cen dostawców liczy netto/brutto w modelu aplikacji, bez dwukierunkowych formuł w Excelu.
- Podgląd importu pokazuje realny diff: okucia nowe/zmienione/bez zmian oraz ceny nowe/zmienione/bez zmian/pominięte.

## Zabezpieczenia

- Dla importu cen: ID ma pierwszeństwo, potem `producent + symbol`, potem ostrożne fallbacki z ostrzeżeniami.
- Nie dodano nowych kluczy storage.
- Dodano smoke test dla hurtowego importu ceny bez ID.

## Dług techniczny

`hardware-catalog-import-export.js` pozostaje większym boundary i przy następnej dużej zmianie import/export powinien zostać rozdzielony.
