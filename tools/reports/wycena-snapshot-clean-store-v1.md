# WYCENA snapshot clean store v1 — 2026-05-30

## Cel

Naprawa mechanizmu historii ofert po raportach, w których silnik WYCENY liczył poprawnie, ale nowy snapshot nie był widoczny w `quoteSnapshotStore`, a ekran wracał do starego `wariant 2`.

## Zakres

- Stare, ciężkie snapshoty WYCENY sprzed nowego formatu nie są migrowane ani ratowane. Są odcinane od historii i fizycznie czyszczone z `fc_quote_snapshots_v1` przy starcie modułu store.
- Nowe snapshoty mają format `version: 7` oraz `meta.storageSchema: quote-snapshot-slim-v1`.
- Snapshot nie zapisuje już pełnych katalogów materiałów/okuć/dostawców w polu `catalogs`.
- Snapshot nadal zachowuje korelację ofert z projektem i statusem: `id`, `generatedAt`, `investor`, `project`, `scope`, `lines`, `commercial`, `totals`, `meta`.
- Linie `lines` pozostają podstawą przyszłych danych wykonawczych: materiały/lista zakupowa, okucia, AGD/usługi, stawki i robocizna/czynności.
- Zapis historii WYCENY jest teraz twardo weryfikowany. Jeżeli `localStorage` nie zapisze snapshotu albo po zapisie ID nie jest widoczne w store, generowanie pokazuje błąd zamiast udawać sukces.
- Stary draft z nazwą automatyczną typu `Oferta — A — wariant 2` resetuje się do nazwy bazowej, jeśli nie ma już realnych snapshotów dla aktualnego zakresu.

## Pliki

- `js/app/quote/quote-snapshot.js`
- `js/app/quote/quote-snapshot-store.js`
- `js/app/wycena/wycena-core.js`
- `js/app/wycena/wycena-tab-shell.js`
- `js/app/wycena/wycena-tab-selection-version.js`
- `js/app/wycena/wycena-diagnostics.js`
- `tools/wycena-snapshot-clean-store-smoke.js`
- `index.html`, `dev_tests.html` — cache-busting

## Granice

Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.
