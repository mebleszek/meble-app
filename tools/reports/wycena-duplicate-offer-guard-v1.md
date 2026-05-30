# WYCENA duplicate offer guard v1 — 2026-05-30

## Cel

Po ustabilizowaniu czystego store snapshotów i pojedynczego flow generowania użytkownik potwierdził, że dwie identyczne oferty mogą powstać po dwóch świadomych kliknięciach `Wyceń`. To nie była awaria techniczna kliknięcia, tylko brak zabezpieczenia biznesowego przed duplikatem.

## Zmiany

- Dodano fingerprint identycznej oferty w `quote-snapshot-store.js`.
- Fingerprint ignoruje nazwę wersji i techniczne identyfikatory, ale uwzględnia projekt, inwestora, zakres pomieszczeń, zakres materiałowy, typ wyceny, ustawienia handlowe bez `versionName`, linie wyceny i sumy.
- `quoteSnapshotStore.findDuplicateSnapshot()` znajduje aktywną, nieodrzuconą identyczną ofertę.
- `quoteSnapshotStore.replaceSnapshot()` zastępuje istniejącą ofertę świeżym przeliczeniem, zachowując jej slot/ID, nazwę i metadane statusu: wybór, akceptację, etap i odrzucenie.
- `wycena-tab-shell.js` przed modalem nazwy robi preflight wyceny bez zapisu. Jeżeli istnieje identyczna oferta, podświetla istniejącą w historii i pokazuje modal aplikacyjny:
  - zielony `Zamień istniejącą`,
  - czerwony `Anuluj`.
- `Anuluj` nie tworzy żadnego nowego snapshotu.
- Zmieniona oferta, np. inny zakres materiałowy, nadal może utworzyć kolejny wariant.

## Ograniczenia

Nie ruszano resolvera okuć, katalogu okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.

## Testy

Dodano `tools/wycena-duplicate-offer-guard-smoke.js`.
