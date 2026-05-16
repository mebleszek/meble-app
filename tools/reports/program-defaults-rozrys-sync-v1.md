# Program defaults ROZRYS sync v1

- Baza: `site_000_program_defaults_ui_fix_v1.zip`.
- Zakres: poprawka wizualna sekcji `Domyślne materiały i okucia` w trybiku po porównaniu z ROZRYS.
- Przyciski wyboru w tej sekcji nie pokazują już osobnej strzałki; zachowują się jak aplikacyjne launchery, bez natywnych pickerów telefonu.
- Akordeony `Materiały` i `Okucia` dostały geometrię ROZRYS: mocniejsza ramka, cień, biały nagłówek, zielony chevron zbudowany z obramowania, obracany przy rozwinięciu.
- Nie zmieniono modelu `fc_program_defaults_v1`, backupów ani logiki preferencji pokoju.
- Dodano/zmieniono smoke check w `tools/app-dev-smoke.js`, żeby pilnował braku natywnych selectów, braku liczników i braku strzałek w launcherach tej sekcji.
