# hardware-dictionary-category-safe-reveal-v1

## Baza

- `site_hardware_dictionary_category_interpolate_animation_v1.zip`

## Problem

Panel `Słowniki okuć → Kategorie / rodzaje okuć` nadal pokazywał na telefonie tylko górny fragment pierwszej karty kategorii. Poprzednie metody dawały elementy w DOM, ale warstwa animacji wysokości wizualnie ucinała realną listę.

Przeanalizowane i odrzucone dla tego panelu metody:

- `details/open`,
- animacja `max-height`,
- pomiar JS `scrollHeight`,
- CSS Grid `0fr → 1fr`,
- `interpolate-size`.

## Rozwiązanie

Zmieniono metodę: panel kategorii nie animuje już wysokości. Zawartość działa w zwykłym przepływie dokumentu, a animacja dotyczy tylko wejścia treści przez `opacity/translate`.

Struktura:

- `hardware-dictionary-categories-card` — ramka, cień, rogi i chevron,
- `hardware-dictionary-categories-reveal` — pełnowymiarowe body bez clipowania wysokości,
- `hardware-dictionary-categories-content` — realne wiersze kategorii, inputy, `Usuń`, `Dodaj kategorię`.

Zamykanie pozostaje natychmiastowe. Otwieranie jest wizualnie płynne, ale nie ryzykuje ucięcia treści.

## Testy

`tools/app-dev-smoke.js` pilnuje, żeby nie wróciły poprzednie wrappery/techniki i żeby po zamknięciu oraz ponownym otwarciu dalej istniały realne wiersze kategorii, input `Zawiasy`, przycisk `Usuń` i `Dodaj kategorię`.

## Zakres nietknięty

Bez zmian w backupie, storage, imporcie/eksporcie, zamiennikach, PRO100, usługach, ROZRYS jako funkcji, RYSUNKU, WYCENIE i modelu danych.
