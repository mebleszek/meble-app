# Hardware dictionary param scroll target v1

## Baza

`site_hardware_dictionary_param_scroll_smooth_v1.zip`

## Zakres

Poprawka regresji UI w `Słowniki okuć → Parametry techniczne kategorii`. Po poprzednim wygładzeniu auto-scrolla kliknięcie parametru widocznego na dole ekranu mogło nie przewijać wcale, bo warunek uznawał samą widoczność nagłówka za wystarczającą.

## Zmiana

- `scrollParamAccordionIntoView()` nie pomija już ruchu, gdy nagłówek parametru jest widoczny nisko w oknie.
- Docelowa pozycja jest liczona jako pozycja nagłówka względem głównego scrolla słowników minus mały margines od góry.
- Minimalny próg pominięcia ruchu dotyczy tylko prawie idealnego trafienia w pozycję docelową.
- Zachowano opóźnienie po zmianie wysokości akordeonu i kompensację pozycji aktywnego nagłówka przy zwijaniu poprzedniego parametru.

## Poza zakresem

Bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.
