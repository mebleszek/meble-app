# Hardware import resolver supplier gap v1 — 2026-05-12

## Baza

- Start: `site_hardware_import_create_item_resolver_v1.zip`.
- Nie użyto odrzuconej paczki `site_hardware_excel_row_date_autofill_v1.zip`.

## Problem z testu użytkownika

W pliku `hardware_catalog_prices_2026-05-12 (1) (3) (1).xlsx` w arkuszu `Ceny_dostawcow` pojawił się wiersz nowego okucia z nazwą, symbolem, producentem i ceną, ale bez dostawcy, kategorii i jednostki. Poprzednia wersja nie pokazywała resolvera, bo sprawdzała braki kategorii/jednostki dopiero po rozpoznaniu istniejącego dostawcy. W efekcie rekord był liczony jako pominięty.

Dodatkowo podgląd importu pokazywał fałszywe ostrzeżenia `pasuje do kilku okuć po producent+symbol`, ponieważ to samo okucie występowało raz w aktualnym katalogu i raz w arkuszu `Okucia` z eksportu.

## Zmiany

- `supplierPriceCreateRequiredGaps()` zgłasza teraz brak dostawcy jako `supplierName` dla nowych okuć z arkusza cen.
- Resolver UI potrafi wybrać dostawcę z istniejących dostawców, tak jak kategorię i jednostkę.
- Zapis resolvera wpisuje `dostawca` do wiersza importu bez wymagania ręcznego `dostawca_id`.
- Dopasowanie potencjalnych duplikatów po `producent + symbol` deduplikuje logicznie te same rekordy po `id`, żeby eksport własnego katalogu nie generował ostrzeżeń o konflikcie.

## Zabezpieczenia

- Wiersz z ceną bez dostawcy/kategorii/jednostki trafia do modala uzupełniania.
- Po uzupełnieniu dostawcy, kategorii i jednostki import tworzy nowe okucie i podpina cenę.
- Ten sam rekord obecny w katalogu i w arkuszu `Okucia` nie jest traktowany jako konflikt wielu okuć.
- Brak wiązania po numerze wiersza Excela.

## Testy

- `node --check` dla zmienionych plików JS.
- `node tools/app-dev-smoke.js` — dodane testy:
  - brak dostawcy/kategorii/jednostki trafia do resolvera,
  - po uzupełnieniu powstaje nowe okucie z ceną,
  - import nie zgłasza fałszywego duplikatu dla tego samego okucia z eksportu.
- Pełne audyty wydania opisane w odpowiedzi końcowej.
