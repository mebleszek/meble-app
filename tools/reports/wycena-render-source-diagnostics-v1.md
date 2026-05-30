# WYCENA render source diagnostics v1 — 2026-05-30

## Cel

Paczka dodaje diagnostykę źródeł renderu WYCENY po sytuacji, w której silnik wyceny liczył wynik, ale ekran/historia/nazwy wariantów pokazywały dane z niejasnego źródła.

## Zakres zmian

- Rozszerzono `js/app/wycena/wycena-diagnostics.js` do builda `20260530_wycena_render_source_diagnostics_v1`.
- Raport diagnostyczny zawiera nowe sekcje:
  - `ŹRÓDŁA EKRANU WYCENA`,
  - `NAZWA / WARIANT OFERTY`,
  - `SNAPSHOT STORAGE DEEP DIVE`.
- Diagnostyka zbiera teraz runtime źródła renderu: historię przekazaną do rendererów, stan aktywnego podglądu, draft oferty, rozstrzygnięty `currentQuote` oraz rzeczywiste elementy DOM historii/podglądu.
- `quote-snapshot-store.js` loguje ślady `save:before`, `save:after`, `remove:before`, `remove:after`, w tym liczbę rekordów, rozmiar storage, rawChanged i widoczność zapisanego/usuniętego ID.
- `wycena-tab-selection-version.js` loguje decyzje nazwy wariantu: nazwę z draftu, nazwę bazową, liczbę exact-scope snapshotów, czy modal nazwy powinien się pokazać i co wpisano.
- `wycena-tab-history.js` loguje wejście do renderu historii oraz klik/usuwanie snapshotu.
- `wycena-tab-preview.js` loguje wejście/wyjście renderu podglądu.
- `tabs/wycena.js` wystawia dodatkowe metody debug wyłącznie do diagnostyki: historia, draft, stany preview/shell i aktualnie rozstrzygany podgląd.

## Poza zakresem

Nie zmieniano logiki biznesowej WYCENY, resolvera okuć, katalogu okuć, import/export Excel, backupu, PRO100, usług stolarskich, ROZRYS ani RYSUNKU.

## Testy

- `tools/wycena-diagnostics-report-smoke.js` sprawdza nowe sekcje raportu i cache-busting.
- Istniejące smoke testy WYCENY, snapshotów, akcji `wycena-generate` i czyszczenia osieroconej sesji pozostają aktywne.
