# WYCENA orphan edit session cleanup v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_orphan_edit_session_cleanup_v1.zip`.
- Baza startowa: `site_wycena_action_registry_v1.zip`.
- Po raportach diagnostycznych ustalono, że silnik WYCENY liczy poprawnie, a klik `Wyceń` przechodzi przez Actions registry. Pozostały problem dotyczył starej aktywnej sesji edycji `fc_edit_session_v1`, która mogła zawierać własną kopię `fc_quote_snapshots_v1` i odtwarzać usunięte snapshoty po Anuluj/restore.
- `js/app/investor/session.js` zapisuje teraz metadane sesji: `schemaVersion`, `startedAt`, `updatedAt` i `context` (`investorId`, `projectId`, aktywna zakładka, pokój).
- Stare aktywne sesje edycji bez metadanych są traktowane jako osierocone legacy i usuwane przy starcie, żeby nie przywracały starych snapshotów ofert ani technicznego stanu sprzed migracji.
- Usunięcie snapshotu przez `quoteSnapshotStore.remove(id)` czyści ten sam snapshot także z kopii przechowywanej w `fc_edit_session_v1.snapshot.fc_quote_snapshots_v1`, więc skasowana oferta nie wraca z sesji edycji.
- `wycena-tab-shell.js` po zbudowaniu wyceny sprawdza, czy snapshot faktycznie jest widoczny w `quoteSnapshotStore`; jeśli nie, ponawia zapis i dopisuje ślad diagnostyczny `snapshotSaveRetry` / `snapshotVisibleInStore`.
- Diagnostyka WYCENY ma build `20260530_wycena_orphan_edit_session_cleanup_v1` i pokazuje metadane oraz flagę `legacyOrphan` sesji edycji.
- Dodano `tools/wycena-orphan-edit-session-cleanup-smoke.js`, który sprawdza czyszczenie legacy sesji, metadane nowych sesji i usuwanie snapshotu z kopii sesji edycji.
- Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.
- Raport: `tools/reports/wycena-orphan-edit-session-cleanup-v1.md`.

