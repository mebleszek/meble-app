# Quote scope entry boundary v1 — 2026-05-01

## Cel

Rozdzielić `js/app/quote/quote-scope-entry.js`, który mieszał scope wejścia do Wyceny, nazewnictwo wersji, modal UI, otwieranie istniejącego snapshotu, tworzenie nowego snapshotu i orkiestrację przejścia do zakładki Wycena.

## Zakres

Bez zmiany UI, bez RYSUNKU, bez nowego storage i bez zmiany publicznego API `FC.quoteScopeEntry`.

## Nowy podział

- `quote-scope-entry-utils.js` — małe helpery, bieżące ID projektu/inwestora, normalizacja typów i roomIds.
- `quote-scope-entry-scope.js` — logika zakresu pomieszczeń, exact-scope snapshotów, nazwy wersji i opis dopasowania.
- `quote-scope-entry-modal.js` — własne modale wejścia scope/nazwy/oferty, lock/unlock i obsługa zamknięcia.
- `quote-scope-entry-flow.js` — orkiestracja: draft, snapshot, preview, status, przejście do Wyceny.
- `quote-scope-entry.js` — cienka fasada starego publicznego API.

## Zabezpieczenia

- Zaktualizowano load order w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- App smoke pilnuje obecności warstw `quoteScopeEntryUtils/scope/modal/flow` oraz publicznego `FC.quoteScopeEntry.ensureScopedQuoteEntry`.
- Kontrakt architektury Wyceny pilnuje funkcji nowych warstw oraz starej fasady publicznej.
- Audyt architektury Wyceny uwzględnia nowe pliki i przestał wskazywać `quote-scope-entry.js` jako duży plik 489 linii.

## Wyniki lokalne

- `node --check` zmienionych plików: OK.
- `node tools/check-index-load-groups.js`: OK.
- `node tools/app-dev-smoke.js`: 29/29 OK.
- `node tools/rozrys-dev-smoke.js`: 72/72 OK.
- `node tools/local-storage-source-audit.js`: OK.
- `node tools/dependency-source-audit.js`: OK.
- `node tools/wycena-architecture-audit.js`: OK.
- `FC.wycenaDevTests.runNodeSmoke()`: 15/15 OK.

## Uwaga o pełnym runnerze Wyceny w Node

Pełne `FC.wycenaDevTests.runAll()` w Node nadal daje 97/98 z błędem `Brak pomieszczeń blokuje tworzenie pustej wyceny`. Ten sam wynik występuje w bazie `site_dev_tests_progress_live_v2.zip` przed tym splitem, więc nie jest regresją tej paczki. Pełne testy przeglądarkowe pozostają do sprawdzenia w `dev_tests.html`.
