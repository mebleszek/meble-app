# Plan: kreator nietypowych korpusów i dane szafki

Status: plan architektoniczny, bez implementacji kreatora w tej paczce.

## Decyzje

1. Kreator nietypowego korpusu ma być dostępny w WYWIADZIE przy dodawaniu szafki, obok obecnych wyborów typu dolna, górna, moduł i zestaw.
2. Trybik ustawień nie ma być głównym miejscem tworzenia jednorazowych nietypowych szafek. Trybik służy do słowników, ustawień, domyślnych danych i przyszłych szablonów.
3. W kreatorze użytkownik tworzy konkretną szafkę dla aktualnego projektu od ręki. Po zapisaniu może opcjonalnie zapisać ją jako szablon do przyszłych projektów.
4. Kreator docelowo musi mieć prosty rysunek/schemat korpusu, bo przegrody, podziały, półki, szuflady i nietypowe układy nie są czytelne jako sam formularz.
5. Kreator nie może tworzyć osobnego systemu wyceny. Ma wystawiać te same źródła danych/fakty robocze co zwykłe szafki, np. `front.count`, `hinge.count`, `shelf.count`, `drawer.count`, `cutout.count`, `routing.count`.

## Przycisk „Dane szafki”

Przy każdej szafce w WYWIADZIE ma docelowo pojawić się osobny przycisk `Dane szafki`.

Po kliknięciu otwiera się osobne aplikacyjne okno/pływający modal tylko do odczytu, poza modalem edycji szafki. Okno pokazuje, jakie wartości dana konkretna szafka zwraca do czynności i wyceny, np.:

- `cabinet.count` — liczba korpusów,
- `cabinet.width_mm` — szerokość,
- `cabinet.height_mm` — wysokość,
- `cabinet.depth_mm` — głębokość,
- `front.count` — liczba frontów,
- `front.dimensions` — wymiary frontów,
- `hinge.count` — liczba zawiasów,
- `shelf.count` — liczba półek,
- `drawer.count` — liczba szuflad,
- `appliance.count` — liczba AGD.

Ten podgląd nie zapisuje drugiej prawdy. Jeśli coś się nie zgadza, poprawia się dane szafki w normalnej edycji, a nie w podglądzie.

## Trybik ustawień

Trybik może mieć później dział z domyślnymi danymi i szablonami korpusów, np.:

- zlewowa: domyślna głębokość 56 cm,
- szufladówka: domyślna głębokość 51 cm,
- typy systemowe dostępne w WYWIADZIE,
- typy użytkownika zapisane z kreatora.

Na start nie robić pełnego kreatora w trybiku. Trybik ma być biblioteką/szablonami i konfiguracją, nie obowiązkowym krokiem przed dodaniem szafki w projekcie.

## Kolejność bezpieczna

1. Najpierw źródła danych i ich odczyt z obecnych szafek.
2. Potem podpięcie źródeł do cennika czynności i WYCENY.
3. Potem osobny przycisk `Dane szafki` poza modalem edycji.
4. Dopiero później projekt kreatora nietypowego korpusu w WYWIADZIE.
5. Na końcu możliwość zapisu nietypowej szafki jako szablonu.

## Zakazy architektoniczne

- Nie dublować danych szafki w osobnym magazynie.
- Nie podpinać podglądu faktów do modala edycji szafki bez osobnego etapu i testów regresji.
- Nie robić kreatora jako drugiego, niezależnego systemu materiałów/czynności/wyceny.
- Nie wymagać przechodzenia do ustawień, żeby stworzyć jednorazową nietypową szafkę w projekcie.

## 2026-06-09 — Kreator nietypowego korpusu a model robocizny

Przyszły kreator nietypowego korpusu ma działać w WYWIADZIE jako opcja dodania nietypowego korpusu do projektu. Użytkownik powinien móc utworzyć jednorazową szafkę nietypową, a dopiero opcjonalnie zapisać ją jako szablon do ponownego użycia.

Kreator nie ma tworzyć drugiego systemu wyceny. Dane nietypowego korpusu muszą zwracać te same fakty robocze (`FC.workQuantityFacts`) i korzystać z tego samego modelu cennika: `quantitySource` określa, ile liczyć, a `conditions` określają, kiedy reguła ma działać.
