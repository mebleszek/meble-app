# RYSUNEK rebuild fresh v1 — 2026-04-27

## Zakres

Poprawka regresji przycisku `Odbuduj z listy szafek` po przejściu RYSUNKU z systemowego `confirm()` na własne modale aplikacji.

## Problem

Poprzednia poprawka zabezpieczała sam wynik `confirmBox.ask()`, ale handler odbudowy nadal pracował na `pd` i `seg` złapanych podczas renderu zakładki. W realnym runtime `projectData` może zostać podmienione przez zapis/normalizację lub inne mechanizmy store, więc klik mógł wyglądać jak obsłużony, ale mutacja trafiała w nieaktualny obiekt segmentu albo render nie pokazywał świeżych danych.

## Zmiana

- `js/tabs/rysunek.js` odbudowuje teraz układ z aktualnego `projectData[room]` pobranego dopiero po potwierdzeniu.
- Reset zaznaczeń RYSUNKU został wydzielony w lokalny helper.
- Render po odbudowie jest wywoływany także wtedy, gdy zapis zgłosi błąd — sama mutacja aktualnego układu nie ginie wizualnie przez wyjątek zapisu.
- Nie zmieniono UI, wyglądu ani logiki innych funkcji.

## Testy

- `js/testing/rysunek/tests.js` ma dodatkowy kontrakt, który symuluje podmianę `projectData` po renderze, a przed kliknięciem `Odbuduj z listy szafek`.
- Test pilnuje, że odbudowa używa świeżego projektu, usuwa przerwy i odtwarza wiersze `base/module/wall` z aktualnej listy szafek.

## Wykonane komendy

- `node --check js/tabs/rysunek.js`
- `node --check js/testing/rysunek/tests.js`
- Izolowany runner RYSUNKU przez `tools/app-dev-smoke.js` API: `6/6 OK`
- `node tools/check-index-load-groups.js`
