# Globalna blokada kształtu helperów `?` v1

## Cel

Naprawić prostokątne/rozciągnięte helpery `?` globalnie w całej aplikacji, a nie tylko lokalnie w WYCENIE.

## Zmiana

- Dodano globalną blokadę kształtu w `css/shared-overlays-choice.css` dla `.info-trigger` i używanych wariantów helperów.
- Helper wymusza kwadratowy rozmiar przez `width/height`, `inline-size/block-size`, `min/max`, `aspect-ratio: 1 / 1`, `flex: 0 0`, `align-self:center`, `justify-self:end` i okrągły `border-radius`.
- Stary znak `?` z SVG przez `::before` pozostaje centralnym sposobem renderowania ikony.
- Lokalne rozmiary zachowano przez zmienną `--fc-info-trigger-size`: formularz okucia 26 px, tabela 24 px, domyślnie 28 px.

## Poza zakresem

Nie zmieniano logiki helperów, treści opisów, WYCENY, duplikatów okuć, override zawiasów, PRO100, ROZRYS, PCV/obrzeży, backupów ani import/export Excel.
