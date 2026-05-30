# WYCENA action registry v1 — 2026-05-30

## Cel

Naprawa ścieżki kliknięcia `Wyceń` po raportach normalnie/incognito: silnik `collectQuoteData` potrafił policzyć wycenę, ale realny klik mógł nie wejść stabilnie w jeden kontrolowany handler generowania snapshotu.

## Zmiany

- Przycisk `Wyceń` dostał `data-action="wycena-generate"`.
- Akcja `wycena-generate` została zarejestrowana w `js/app/ui/actions-register.js`.
- Runtime WYCENY wystawia jeden handler `FC.wycenaGenerateAction.run(...)`, ustawiany przy renderze zakładki WYCENA.
- Usunięto bezpośrednie listenery `pointerup`/`click` z przycisku `Wyceń`, żeby nie było dwóch źródeł prawdy i konfliktu z globalną mobile-safe delegacją kliknięć.
- Diagnostyka ma nowy build `20260530_wycena_action_registry_v1`, żeby raporty po wdrożeniu jednoznacznie pokazywały nowy kod.
- Podbito cache-busting dla `actions-register.js`, `wycena-diagnostics.js` i `wycena-tab-shell.js` w `index.html` oraz `dev_tests.html`.

## Czego nie ruszano

- Nie zmieniano resolvera okuć.
- Nie zmieniano katalogu okuć.
- Nie zmieniano import/export Excel.
- Nie zmieniano backupów ani retencji.
- Nie zmieniano PRO100, usług stolarskich, ROZRYS ani RYSUNKU.
- Nie kasowano danych użytkownika.

## Testy

Dodano `tools/wycena-generate-action-registry-smoke.js`, który sprawdza, czy `Wyceń` idzie przez `data-action` i Actions registry oraz czy nie zostały bezpośrednie listenery `pointerup/click` na tym przycisku.
