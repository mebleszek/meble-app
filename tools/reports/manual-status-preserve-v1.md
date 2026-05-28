# Manual status preserve v1 — raport

## Powód

Użytkownik wykrył regresję w `Inwestorze`: przy ręcznym ustawianiu statusu `Wycena` dla kolejnych pomieszczeń bez wyceny wstępnej program potrafił cofać wcześniej ustawione pomieszczenie do `Nowy`.

## Przyczyna

Rekomendacja statusu z historii ofert zwracała fallback `nowy` także wtedy, gdy dla danego nietkniętego pokoju nie było żadnej oferty. W manualnym przepływie statusu ten fallback był traktowany jak prawdziwa rekomendacja i nadpisywał istniejący ręczny status pokoju.

## Zmiana

- `quote-snapshot-selection.js` dostał opcję `preserveCurrentWhenNoQuoteRows`.
- `project-status-scope.js` przekazuje tę opcję do rekomendacji statusów.
- `project-status-sync.js` używa tej opcji tylko przy manualnym ustawianiu statusu pokoju przez `setInvestorRoomStatus()`.
- `investor-persistence.js` przekazuje tę ochronę także przy ręcznych zmianach statusu dla zakresu kilku pokoi.
- Dodano kontrakt regresyjny: zaakceptowana wstępna oferta `A` ustawia `A = Pomiar`, a ręczne ustawianie `S` i `P` na `Wycena` nie może cofać pozostałych pokoi.

## Zakres celowo nietknięty

- Brak zmiany UI.
- Brak zmiany modelu danych.
- Brak zmian backupów.
- Brak zmian RYSUNKU.
- Rekonsyliacja po usunięciu/zmianie zaakceptowanej oferty nadal może cofać pokoje zdjęte z zakresu, bo to jest inny przepływ niż ręczny status w Inwestorze.
