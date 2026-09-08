# Zapis wyboru systemu szuflad — poprawka v1

Data: 2026-09-08

## Objaw

W `WYWIAD -> Preferencje producentów okuć` można było zaznaczyć np. `Blum TANDEMBOX Antaro`, ale po zamknięciu listy lub kliknięciu `Zapisz zmiany` pole `System / model szuflad` wracało do `— nie ustawiaj —`.

## Przyczyna

`ensureHardwareDraft()` i `ensureDrawerSystemDraft()` przy każdym odczycie tworzyły nowe obiekty `hardwareProducers` i `hardwareDrawerSystems`. Obsługa kliknięcia launchera zachowywała referencje utworzone podczas renderowania pola. Kolejne pola formularza podmieniały obiekty w głównym drafcie, więc kliknięcie modyfikowało odłączoną kopię.

## Poprawka

- normalizacja aktualizuje istniejące zagnieżdżone obiekty przez `Object.assign`, zachowując ich referencje,
- `ensureDrawerSystemDraft()` nie tworzy już kolejnej kopii,
- cache-busting zmienionego modułu: `20260908_drawer_system_save_fix_v1`.

## Test regresji

`node tools/drawer-system-selection-save-smoke.js` odtwarza pełny scenariusz:

1. buduje rzeczywisty formularz w testowym DOM,
2. wybiera `Blum TANDEMBOX Antaro`,
3. sprawdza stan launchera przed zapisem,
4. klika `Zapisz zmiany`,
5. sprawdza `hardwareDrawerSystems.drawers`, producenta oraz ponowne otwarcie formularza.
