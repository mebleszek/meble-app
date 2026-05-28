# quote-snapshot-phantom-investor-fix-v1 — 2026-05-28

## Problem

W trybie incognito aplikacja działała, ale w normalnym profilu przeglądarki lokalne dane zawierały stare snapshoty WYCENY. Mechanizm recovery traktował pusty snapshot oferty jako źródło nowego inwestora. Efekt: na liście pojawiał się `Projekt meblowy` ze źródłem `quote-snapshot`, a pomieszczenia wyglądały jak techniczne etykiety `a`, `S`, `P`, `X`. Po wejściu w taki kontekst WYCENA mogła reagować na klik, ale nie generować realnego wyniku.

## Zmiany

- `js/app/investor/investors-recovery.js` filtruje snapshoty bez realnej tożsamości klienta.
- `js/app/investor/investors-store.js` czyści bieżący wskaźnik inwestora/projektu, jeśli wskazuje na odrzucony rekord snapshot-only.
- `js/testing/investor/suites/recovery-isolation.js` ma regresję dla pustego snapshotu `Projekt meblowy` z pomieszczeniami `a/S/P/X`.
- Zaktualizowano cache-busting w `index.html` i `dev_tests.html`.

## Ważne

Snapshoty WYCENY, warianty ofert, statusy i historia wyborów nie zostały usunięte. Zmieniono tylko granicę recovery inwestora: snapshot bez danych klienta pozostaje historią oferty, a nie nowym inwestorem/projektem.
