# hardware-dictionary-category-no-clip-v1

## Baza

`site_hardware_dictionary_category_body_guard_v1.zip`

## Problem

Na telefonie wspólny akordeon `Słowniki okuć → Kategorie / rodzaje okuć` nadal wyglądał jak pusty: po otwarciu widoczna była tylko górna część pierwszej karty kategorii, bez inputów i przycisków.

## Analiza

Samo czyszczenie `max-height` i `overflow` nie wystarczyło, bo body wspólnego akordeonu nadal używało klasy `rozrys-material-accordion__body`. Ta klasa jest poprawna dla wzorca ROZRYS, ale tutaj została użyta na edytowalnej, dynamicznej liście kategorii. W połączeniu z wcześniejszymi animacjami wysokości mogła zostawić panel w stanie przyciętym.

## Zmiana

- Body wspólnego akordeonu kategorii dostało dedykowaną klasę `hardware-dictionary-category-section-body`.
- Usunięto z tego body klasę `rozrys-material-accordion__body`.
- Zewnętrzny akordeon kategorii ma `overflow: visible`.
- Dedykowane body i jego wiersze mają ochronę przed `max-height`, `height` i `overflow:hidden`.
- Nagłówek/chevron nadal korzystają z wyglądu ROZRYS.

## Testy

`tools/app-dev-smoke.js` sprawdza teraz dedykowane body kategorii i to, że nie wróciła klasa `rozrys-material-accordion__body` na kontener zawartości kategorii.

## Nie ruszano

- backupów,
- storage,
- import/export Excel,
- zamienników,
- PRO100,
- ROZRYS jako funkcji,
- RYSUNKU,
- WYCENY.
