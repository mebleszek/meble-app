# Program defaults settings v1 — 2026-05-16

## Start

- Baza: `site_000_room_accordion_inline_v1.zip`.
- Cel: dodać globalne domyślne materiały i okucia w trybiku strony głównej, bez wracania do sekcji `Domyślne` w WYWIADZIE.

## Zmiany

- Dodano store `js/app/settings/program-defaults-store.js`.
- Dodano widok `js/app/ui/data-settings-defaults-view.js`.
- Dodano wejście `Domyślne materiały i okucia` w `data-settings-menu-view.js`.
- Rozszerzono routing `data-settings-modal.js` o widok `defaults`.
- Dodano klucz `fc_program_defaults_v1` do `FC.constants.STORAGE_KEYS` i klasyfikatora danych.
- Pierwszy draft szafki w pustym pomieszczeniu dostaje globalne domyślne materiałów przed preferencjami pokoju.

## Zakres danych

- `fc_program_defaults_v1` zawiera globalne fallbacki użytkownika:
  - materiały: korpus, materiał frontu, kolor frontu, plecy;
  - okucia: zawiasy, szuflady/prowadnice, podnośniki, systemy przesuwne, cargo/organizery.
- Klucz jest objęty backupem przez prefiks `fc_`.
- Nie dodano nowego backup-policy ani nowego losowego localStorage.

## Poza zakresem

- Nie zmieniano PRO100.
- Nie ruszano hurtowej zmiany istniejących szafek.
- Nie ruszano realnej zamiany producentów okuć w katalogu/WYCENIE.
- Nie dodawano sekcji `Domyślne` do WYWIADU pokoju.
