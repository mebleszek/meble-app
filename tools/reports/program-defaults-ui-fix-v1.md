# Program defaults UI fix v1

## Baza

- Baza startowa: `site_000_program_defaults_settings_v1.zip`.
- Zakres: poprawka UI sekcji `Domyślne materiały i okucia` w trybiku strony głównej.

## Zmiany

- Zastąpiono natywne selecty aplikacyjnymi launcherami wyboru w stylu ROZRYS.
- Usunięto zdublowany widok: widoczne jest tylko pole-launcher, bez dodatkowego natywnego dropdownu telefonu.
- Usunięto liczniki `4` i `5` z akordeonów `Materiały` i `Okucia`.
- Akordeony tej sekcji dostały ramkę, cień, biały nagłówek i zielony chevron.
- Podbito cache-busting do `20260516_program_defaults_ui_fix_v1`.

## Dane

- Brak zmian modelu danych.
- Klucz `fc_program_defaults_v1` pozostaje bez zmian.
- Brak nowych kluczy localStorage.

## Testy

- Dodano smoke test pilnujący braku natywnych selectów w `data-settings-defaults-view.js`.
