# Hardware import create item resolver v1 — 2026-05-12

## Baza

- Start: `site_hardware_supplier_price_create_item_v1.zip`.
- Nie użyto odrzuconej paczki `site_hardware_excel_row_date_autofill_v1.zip`.

## Zakres

1. Usunięto automatyczne tworzenie nowych okuć z `Ceny_dostawcow` z domyślną kategorią `Inne` i jednostką `szt.`.
2. Nowe okucie z arkusza cen wymaga teraz kategorii i jednostki.
3. Brak kategorii/jednostki uruchamia resolver braków przed właściwym podglądem importu.
4. Resolver pokazuje dane wiersza ceny i pozwala wybrać kategorię oraz jednostkę z aplikacyjnych pickerów.
5. Przy kategorii dodano przycisk `Dodaj kategorię`, który otwiera mały modal aplikacyjny, zapisuje kategorię do słownika i udostępnia ją od razu w kolejnych wyborach.
6. Arkusz `Ceny_dostawcow` ma kolumny `kategoria` i `jednostka`, więc zaawansowany import może je podać bez modala.
7. Nie wróciło dopasowanie po numerze wiersza Excela; powiązanie zostaje po `producent + symbol + dostawca`.

## Storage / cloud-readiness

- Bez nowych kluczy storage.
- Kategorie: istniejący `fc_hardware_categories_v1`.
- Okucia i ceny dostawców: istniejący `fc_accessories_v1` oraz `supplierPrices` przy okuciu.
- Brak automatycznych wartości `Inne`/`szt.` zmniejsza ryzyko brudnych danych przed migracją do chmury.

## Testy

- Rozszerzono `tools/app-dev-smoke.js` o ochronę przed automatycznym tworzeniem nowego okucia bez kategorii/jednostki.
- Smoke pilnuje też nowych kolumn `kategoria` i `jednostka` w `Ceny_dostawcow`.
