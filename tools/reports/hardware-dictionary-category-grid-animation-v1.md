# Hardware dictionary category grid animation v1 — 2026-05-24

## Baza

- Baza startowa: `site_hardware_dictionary_category_animation_split_v1.zip`.
- Cel: naprawić panel `Kategorie / rodzaje okuć`, w którym poprzednie próby animacji powodowały widoczne ucięcie/pustą zawartość mimo obecności elementów w DOM.

## Analiza

Poprzednie warianty mieszały w jednym miejscu kilka ról: ramkę, animowaną wysokość i prawdziwą treść formularza. Wariant z mierzeniem `scrollHeight` i ustawianiem inline `height` był zbyt podatny na dynamiczną zawartość, pola formularzy i układ mobilny.

Po sprawdzeniu podejść do animacji dynamicznej wysokości zmieniono metodę na wzorzec CSS Grid `grid-template-rows: 0fr → 1fr`. Dzięki temu nie trzeba zgadywać `max-height` ani mierzyć wysokości zawartości JavaScriptem.

## Zmiany

- Panel `Kategorie / rodzaje okuć` zachowuje strukturę rozdzielonych ról:
  - `hardware-dictionary-categories-card` — ramka/cień/chevron,
  - `hardware-dictionary-categories-clip` — wyłącznie gridowa warstwa animacji,
  - `hardware-dictionary-categories-inner` — bezpieczny grid item z `min-height:0`,
  - `hardware-dictionary-categories-content` — realna lista kategorii.
- Usunięto zależność od inline `height`, `max-height`, `scrollHeight` i `hidden/display:none` dla samej animacji kategorii.
- Zamknięcie pozostaje natychmiastowe wizualnie, a otwarcie jest płynne.
- Zostawiono pełną zawartość i normalną ramkę bez powrotu do `details/open` ani `rozrys-material-accordion__body`.

## Testy

- `tools/app-dev-smoke.js` pilnuje nowej struktury i metody gridowej.
- Test regresji sprawdza, że po zamknięciu i ponownym otwarciu lista kategorii nadal zawiera realne wiersze, input `Zawiasy`, przycisk `Usuń` i przycisk `Dodaj kategorię`.

## Zakres nietknięty

- Bez zmian backupu, storage, import/export Excel, zamienników, PRO100, usług, ROZRYS jako funkcji, RYSUNKU, WYCENY i modelu danych.
