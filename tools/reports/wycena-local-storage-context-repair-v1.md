# Wycena local storage context repair v1 — 2026-05-28

## Cel

Naprawa regresji, w której WYCENA działała w incognito, ale w normalnej przeglądarce z istniejącymi danymi kliknięcie `Wyceń` reagowało bez widocznego wyniku.

## Przyczyna

Problem nie był w samym przycisku ani w katalogu okuć. Incognito działało, bo miało czysty `localStorage`. Normalny tryb mógł mieć rozjechany kontekst danych po wcześniejszych etapach:

- `fc_current_investor_v1` wskazywał jednego inwestora,
- `fc_current_project_id_v1` wskazywał inny/stary projekt,
- `fc_project_v1` trzymał jeszcze fantomowy albo legacy projekt,
- draft oferty miał pokoje ze starego snapshotu,
- snapshoty WYCENY mogły zawierać techniczne pokoje typu `a`, `S`, `P`, `X`.

Dodatkowo `projectModel.normalizeProjectData()` nie zachowywał dynamicznych pokojów dopisanych poza domyślnymi kluczami `kuchnia/szafa/pokoj/lazienka`. To tłumaczyło, dlaczego nawet dodanie nowego inwestora i nowego pomieszczenia mogło nie naprawić WYCENY w normalnym trybie.

## Zmiany

- Dodano `js/app/wycena/wycena-context-repair.js` — moduł naprawiający aktywny kontekst WYCENY: inwestor → projekt → `projectData` → zakres pokojów → draft oferty.
- `wycena-tab-shell.js` uruchamia naprawę kontekstu przed generowaniem i renderem WYCENY. Jeżeli kontekst jest niepoprawny, WYCENA pokazuje błąd zamiast milczeć.
- `project-bridge.js` preferuje projekt z centralnego `projectStore` przypisany do aktywnego inwestora zamiast ślepo ładować stare `fc_project_v1`.
- `actions-register.js` przy `open-investor` jawnie aktywuje projekt danego inwestora.
- `project-model.js` zachowuje dynamiczne pokoje z `projectData` oraz pokoje zapisane w `meta.roomDefs`, zamiast gubić je podczas normalizacji.
- Draft oferty jest oczyszczany z pokojów, których nie ma w aktualnym projekcie; osierocone snapshoty innego projektu nie mieszają się z bieżącą historią.

## Zakres nietknięty

Nie zmieniano resolvera okuć, katalogu okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.

## Testy

Dodano `tools/wycena-local-storage-context-repair-smoke.js`, który symuluje zatruty `localStorage` z fałszywym projektem snapshotu i sprawdza, że aktywny kontekst wraca do realnego inwestora/projektu/pokoju.

Pełny zestaw smoke/audit przeszedł przed paczką.
