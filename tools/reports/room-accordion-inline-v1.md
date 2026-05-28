# Room accordion inline v1 — 2026-05-16

## Baza

- Start: `site_000_room_preferences_stage1_deployfix_v2.zip`.
- Cel: poprawić UX Etapu 1 preferencji pokoju bez ruszania PRO100, usług, ROZRYS-u, WYCENY ani hurtowego nadpisywania szafek.

## Zakres

- Akordeony `Parametry pomieszczenia` i `Preferencje standardu` w WYWIADZIE są domyślnie zwinięte.
- Usunięto przyciski `Edytuj parametry` i `Edytuj preferencje` z wnętrza akordeonów.
- Parametry pomieszczenia są edytowane bezpośrednio po rozwinięciu akordeonu, bez dodatkowego modala.
- Preferencje standardu są edytowane bezpośrednio po rozwinięciu akordeonu; zapis preferencji zostaje świadomy przez zielony przycisk `Zapisz preferencje`.
- Styl akordeonów dopasowano do wzorca ROZRYS: mocniejsza ramka, cień, biały header i zielona strzałka rozwijania.

## Granice

- Nie zmieniano modelu `room.preferences` ani schematu projektu.
- Nie dodano nowego storage ani nowego klucza `localStorage`.
- Nie zmieniano działania istniejących szafek; nadal nie ma hurtowego nadpisywania.
- Zachowano publiczne funkcje `FC.wywiadRoomSettings.open()` i `FC.wywiadRoomPreferences.open()` jako kompatybilność, ale główny UI działa inline.

## Testy

- Dodano Node smoke zabezpieczający, że `index.html` ma zwinięte akordeony inline i nie zawiera już launcherów modalnych `openRoomSettingsBtn` / `openRoomPreferencesBtn`.
- Cache-busting zmienionych plików: `20260516_room_accordion_inline_v1`.
