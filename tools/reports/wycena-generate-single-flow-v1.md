# WYCENA generate single flow v1 — raport

## Cel

Usunięcie regresji, w której jedno kliknięcie `Wyceń` mogło uruchomić dwa procesy generowania: pierwszy zapisywał ofertę bazową, a drugi od razu proponował `wariant 2`.

## Zmiany

- Dodano modułowy runtime lock generowania w `js/app/wycena/wycena-tab-shell.js`.
- Lock nie jest związany z renderowanym przyciskiem, więc nie resetuje się po re-renderze topbara.
- Deduplikacja blokuje replay `pointerup -> click` z tego samego tapnięcia przez 1500 ms.
- Równoległe generowanie jest blokowane jako `generate-skipped-in-flight`.
- Replay po świeżo zakończonym pierwszym generowaniu jest blokowany jako `generate-skipped-duplicate-event`.

## Zachowane kontrakty

- Drugie świadome kliknięcie po oknie deduplikacji nadal tworzy kolejny wariant.
- Clean snapshot v7 zostaje lekki i zachowuje linie wykonawcze: materiały, okucia, usługi/AGD, robociznę i elementy.
- Nie zmieniono katalogu okuć, import/export, backupów, ROZRYS ani PRO100.

## Test

Dodano `tools/wycena-generate-single-flow-smoke.js`.

Scenariusze:

1. Pierwsze generowanie + natychmiastowy replay eventu: dokładnie 1 snapshot.
2. Drugie świadome generowanie po oknie deduplikacji: dokładnie 2 snapshoty/warianty.
