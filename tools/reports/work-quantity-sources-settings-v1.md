# work quantity sources settings v1

Paczka: `site_work_quantity_sources_settings_v1.zip`

## Zakres

Dodano pierwszy, bezpieczny etap centralnego słownika źródeł danych do czynności i wyceny w trybiku ustawień na stronie głównej.

Nowa opcja w ustawieniach:

- `Dane do czynności i wyceny`

Widok pokazuje dla każdego źródła:

- nazwę przyjazną,
- nazwę techniczną,
- jednostkę,
- opis „jak liczone”.

To jest etap słownikowo-podglądowy. Nie dodaje jeszcze podglądu na dole szafki i nie podpina źródeł do cennika czynności ani do WYCENY.

## Architektura

Dodano moduł:

- `js/app/pricing/work-quantity-sources.js`

Moduł wystawia statyczny, systemowy rejestr `FC.workQuantitySources`. Rejestr nie zapisuje danych do `localStorage` i nie tworzy drugiej prawdy obok WYWIADU. To tylko centralny język nazw, który później będzie używany do odczytywania danych szafek.

Dodano widok ustawień:

- `js/app/ui/data-settings-work-sources-view.js`

Widok jest dostępny z menu trybiku ustawień.

## Ważne ograniczenie

Źródła oznaczone jako `planned` są opisane jako przyszłe. Są w słowniku po to, żeby uzgodnić nazwy techniczne i ludzkie, ale nie są jeszcze liczone z obecnych szafek.

## Testy

Dodano regresję:

- `tools/work-quantity-sources-settings-smoke.js`

Sprawdza m.in.:

- obecność podstawowych źródeł, np. `front.count`, `hinge.count`, `cabinet.height_mm`, `shelf.count`, `appliance.type`,
- format nazw technicznych,
- nazwę przyjazną, jednostkę i opis liczenia,
- widoczność nowej opcji w trybiku,
- brak drugiego zapisu danych w szafkach,
- cache-busting etapu w `index.html` i `dev_tests.html`.

## Cache-busting

Token etapu:

- `20260608_work_quantity_sources_settings_v1`
