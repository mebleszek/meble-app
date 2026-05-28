# Hardware catalog model v1 — 2026-05-04

Zakres:
- katalog `Akcesoria` przygotowany jako katalog okuć,
- model okuć i producentów,
- pola handlowe pozycji: kategoria, jednostka, seria, cena zakupu, narzut, źródło ceny, data ceny, status, notatka,
- panel producentów okuć,
- migracja/normalizacja istniejących akcesoriów,
- testy smoke dla modelu i formularza.

Poza zakresem:
- automatyka okuć przy szafce,
- standardy okuć w WYWIADZIE,
- rozbicie okuć w MATERIAŁ,
- snapshot okuć w WYCENIE,
- kompaktowe okleiny/słoje.

Cloud-readiness:
- nowy słownik producentów idzie przez `catalogStore`, nie przez bezpośredni zapis UI,
- pozycje okuć są katalogiem użytkownika, nie danymi projektu,
- przyszłe oferty muszą dostać snapshot cen okuć.
