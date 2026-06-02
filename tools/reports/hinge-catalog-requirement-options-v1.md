# Wymagania zawiasów z katalogu okuć v1 — 2026-06-03

## Zakres

Baza: `site_hardware_requirement_coverage_policy_md_v1.zip`.

Ten etap usuwa błąd architektoniczny z poprzedniego panelu: wybór typu zawiasu w modalu szafki nie może pochodzić z ręcznie wpisanej listy presetów. Lista ma wynikać z tego, co jest dostępne w systemie — z katalogu okuć/akcesoriów, słowników technicznych i `technicalParams`.

## Zmienione zasady runtime

1. `cabinet-hardware-requirements` buduje opcje zawiasów z aktywnych pozycji katalogu kategorii `Zawiasy`.
2. Opcje są deduplikowane po cechach technicznych: typ/nakładanie, kąt, hamulec i prowadnik.
3. Producent, model i symbol nie są pokazywane w modalu szafki. Jeśli Blum i GTV mają te same cechy, użytkownik widzi jedną opcję techniczną, np. `110° nakładany`.
4. Wymaganie zawiasowe jest oznaczone jako `hingeSet` / `Komplet zawiasowy`, z komponentami pokrycia: `Zawias` i `Prowadnik`.
5. To nie oznacza wyboru konkretnego kompletu katalogowego. Konkret dobiera dopiero WYCENA po preferowanym producencie i cenie.
6. `cabinet-cutlist` nie wystawia już materiału `Okucia: zawiasy BLUM`; używa neutralnego `Okucia: komplet zawiasowy`.
7. Jeżeli katalog okuć nie zwróci opcji, lista ręcznej zmiany nie wraca do hardcodowanych presetów. Domyślne reguły szafek mogą nadal wyliczać wymaganie startowe, ale wybór użytkownika ma pochodzić z katalogu systemu.

## Zasada pokrycia katalogowego

Modal szafki zapisuje potrzebę techniczną:

- komplet zawiasowy,
- typ/nakładanie,
- kąt otwarcia,
- prowadnik,
- hamulec,
- ilość kompletów.

Katalog może spełnić tę potrzebę jedną pozycją `kpl.` albo kilkoma składnikami, np. osobny zawias i osobny prowadnik. Rozstrzyga to resolver WYCENY, nie modal szafki.

## Testy

Dodano/rozszerzono test `tools/cabinet-hardware-requirements-live-edit-smoke.js`, który sprawdza m.in.:

- opcje zawiasów są katalogowe w normalnym runtime,
- bez katalogu lista wyboru nie pokazuje hardcodowanych presetów,
- pozycje o tych samych cechach są scalane po cechach,
- panel nie pokazuje producentów/modeli,
- wymaganie ma typ `hingeSet`,
- wymaganie niesie komponent `mountingPlate` jako prowadnik.

## Nie ruszano

- PRO100,
- ROZRYS,
- import/export Excel okuć,
- backupy,
- panel kategorii,
- PCV / obrzeża,
- prowadnice/szuflady,
- geometrię frontów dla zawiasów wpuszczanych.
