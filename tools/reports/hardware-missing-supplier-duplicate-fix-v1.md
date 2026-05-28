# Hardware missing supplier duplicate fix v1 — 2026-05-13

## Baza

- Start: `site_hardware_supplier_missing_resolver_v1.zip`.
- Odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nie była używana jako baza.

## Zakres

- Naprawiono dopasowanie okucia w imporcie `Ceny_dostawcow`, gdy to samo okucie występuje równocześnie w aktualnym katalogu i w arkuszu `Okucia` z eksportu.
- Wiersz ceny z istniejącym `producent + okucie_symbol`, ceną oraz pustym/śmieciowym/nieznanym dostawcą trafia teraz do resolvera wyboru dostawcy, zamiast wpadać jako `Ceny pominięte`.
- Nie zmieniono zasad: dostawca nadal może być tylko wybrany z istniejącej listy programu albo z arkusza `Dostawcy`; resolver nie tworzy nowych dostawców.
- Nie przywrócono wiązania po numerze wiersza Excela.

## Test ochronny

- Dodano smoke test dla realnego przypadku: okucie jest obecne jednocześnie w katalogu i w arkuszu `Okucia`, a `Ceny_dostawcow` zawiera cenę z nierozpoznanym dostawcą typu `14`.
