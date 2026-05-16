# Room preferences stage1 v1 — 2026-05-15

## Baza

- Start: `site_pro100_file_import_v1.zip`.
- Cel: Etap 1 preferencji pomieszczenia w WYWIADZIE bez hurtowej zmiany istniejących szafek.

## Zakres

- Dodano `room.preferences` do modelu pokoju i migrację schematu V9→V10.
- WYWIAD ma dwa akordeony nad szafkami: parametry techniczne pokoju oraz preferencje standardu.
- Modal preferencji zapisuje standard wykończenia, standard blend, korpus, front, plecy, otwieranie rozbite na typy zabudowy i preferowanego producenta okuć.
- Usunięto z planu `standard okuć`; nie powstało takie pole.
- Nowa szafka bez poprzednika używa preferencji pokoju, a kolejna szafka w tym samym pokoju klonuje ostatnią bez limitu czasowego.

## Granice bezpieczeństwa

- Nie dodano nowego storage ani nowych kluczy `localStorage`.
- Preferencje nie zmieniają istniejących szafek po cichu.
- Nie ruszano PRO100, usług stolarskich, ROZRYS-u, WYCENY, backupów ani import/export okuć.
- Hurtowe zastosowanie preferencji do istniejących szafek pozostaje następnym etapem.
