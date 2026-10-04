# AGENTS.md — zasady pracy nad Meble-App

## Cel dokumentu

Ten plik definiuje obowiązujące zasady pracy nad Meble-App dla Codexa i innych agentów programistycznych. Ma ograniczać niepotrzebne zmiany, chronić istniejącą logikę biznesową i przygotowywać projekt do dalszego rozwoju oraz migracji do chmury.

## 1. Zasada nadrzędna: najpierw plan, potem zmiana

- Nie modyfikuj żadnego pliku przed jednoznaczną komendą użytkownika: **„do dzieła”**.
- Przed tą komendą wolno wyłącznie analizować, diagnozować, proponować rozwiązania i opisywać ryzyko.
- Przed każdą zmianą opisz:
  - co ma zostać zmienione,
  - po co,
  - które pliki lub obszary będą dotknięte,
  - jakie są możliwe skutki uboczne,
  - jak zmiana zostanie sprawdzona.
- Po komendzie **„do dzieła”** wykonuj wyłącznie wcześniej uzgodniony zakres.
- Jeżeli podczas pracy pojawi się potrzeba wyjścia poza uzgodniony zakres, zatrzymaj się i poproś o decyzję użytkownika.

## 2. Minimalny zakres zmian

- Preferuj małe, odwracalne i łatwe do zweryfikowania zmiany.
- Nie wykonuj szerokich refaktorów „przy okazji”.
- Nie przepisuj dużego pliku tylko dlatego, że jest duży.
- Nie zmieniaj stylu, nazw, formatowania ani architektury modułów niezwiązanych bezpośrednio z zadaniem.
- Nie usuwaj zgodności wstecznej ze starymi projektami, ofertami lub ustawieniami bez osobnej zgody.

## 3. Testy są bramką bezpieczeństwa, nie celem samym w sobie

Po każdej zmianie uruchom z katalogu głównego projektu:

`node tools/preflight.js`

Zadanie nie jest zakończone, dopóki preflight nie przejdzie.

Jeżeli preflight nie przechodzi:

- zatrzymaj się,
- wskaż dokładnie pierwszy niezaliczony etap,
- ustal, czy problem jest w kodzie produkcyjnym, teście, konfiguracji czy w nieaktualnym założeniu,
- nie zmieniaj kodu produkcyjnego tylko po to, aby test stał się zielony,
- nie osłabiaj asercji testu bez merytorycznego uzasadnienia.

Przy zmianach wysokiego ryzyka uruchom również testy bezpośrednio związane z danym modułem, nawet jeśli są już częścią preflightu.

## 4. Logika biznesowa ma pierwszeństwo przed „ładniejszym kodem”

Meble-App odwzorowuje rzeczywistą pracę stolarni. Nie zgaduj reguł dotyczących m.in.:

- WYCENY,
- materiałów,
- robocizny,
- zawiasów,
- szuflad i prowadnic,
- okuć,
- transportu i wnoszenia,
- kosztów firmy,
- ofert i snapshotów.

Jeżeli reguła biznesowa nie wynika jednoznacznie z aktualnego kodu, testów lub dokumentacji, zatrzymaj się i zapytaj użytkownika zamiast przyjmować własne założenie.

## 5. Obszary podwyższonego ryzyka

Szczególnej ostrożności wymagają:

- WYCENA i wszystkie jej źródła danych,
- snapshoty i historia ofert,
- persistence / storage,
- migracje danych,
- zgodność ze starymi projektami,
- RYSUNEK,
- MATERIAŁ ↔ ROZRYS,
- kolejność ładowania skryptów.

Przed zmianą w tych obszarach sprawdź zależności i możliwy wpływ na pozostałe moduły. Nie wykonuj masowych zmian w tych obszarach bez osobnego planu i zgody.

## 6. Przygotowanie do chmury

Każdą zmianę dotyczącą zapisu, odczytu lub modelu danych oceniaj także pod kątem docelowej migracji opisanej w `CLOUD_MIGRATION.md`.

Zasady:

- UI i logika domenowa nie powinny znać szczegółów miejsca przechowywania danych.
- Korzystaj z istniejących warstw `repository` / `store`, gdy są dostępne.
- Nie dodawaj nowych bezpośrednich zapisów do `localStorage`, jeśli ten sam cel można osiągnąć przez istniejącą warstwę danych.
- Nie przenoś do chmury danych odtwarzalnych lub czysto interfejsowych bez wyraźnej potrzeby.
- Zachowuj stabilne identyfikatory danych tam, gdzie później będą potrzebne do synchronizacji.
- Nie wdrażaj Firebase/Firestore ani synchronizacji „przy okazji” innego zadania.

## 7. Źródła kontekstu projektu

Przed większym zadaniem korzystaj przede wszystkim z:

- `CURRENT_STATE.md` — aktualny stan projektu,
- `ROADMAP.md` — kolejność dalszego rozwoju,
- `CLOUD_MIGRATION.md` — kierunek architektury danych i chmury,
- `TEST_BASELINE.md` — punkt odniesienia dla testów,
- `DEPENDENCY_MAP.md` — informacje o zależnościach,
- odpowiednich testów i aktualnego kodu.

`README.md`, `DEV.md` i starsze dokumenty zawierają również historię projektu. Traktuj je jako kontekst historyczny, a nie automatycznie jako aktualny stan.

Przy sprzeczności informacji:

1. nie zgaduj,
2. sprawdź aktualny kod i testy,
3. porównaj z `CURRENT_STATE.md` i bieżącymi ustaleniami,
4. jeżeli nadal istnieje niejednoznaczność — zapytaj użytkownika.

## 8. Zmiany danych i kompatybilność

Przy zmianie schematu danych lub sposobu zapisu:

- ustal, jak zachowają się istniejące projekty użytkownika,
- zachowaj bezpieczne wartości domyślne,
- nie usuwaj nieznanych pól bez potrzeby,
- unikaj migracji destrukcyjnych,
- jeżeli potrzebna jest migracja, przygotuj ją jako osobne zadanie z planem cofnięcia.

## 9. Raport po wykonaniu zadania

Po zmianie podaj krótko:

- co zostało zmienione,
- które pliki zostały zmienione,
- czego świadomie nie ruszano,
- jakie testy uruchomiono,
- wynik `node tools/preflight.js`,
- ewentualne pozostałe ryzyka lub decyzje do podjęcia.

Nie deklaruj zadania jako zakończone, jeśli testy nie przeszły lub zakres odbiega od uzgodnionego.

## 10. Definition of Done

Zadanie można uznać za zakończone dopiero wtedy, gdy jednocześnie:

1. wykonano wyłącznie uzgodniony zakres,
2. nie wprowadzono nieuzgodnionych zmian pobocznych,
3. zachowano kompatybilność istniejących danych albo jasno opisano uzgodnioną migrację,
4. uruchomiono właściwe testy,
5. `node tools/preflight.js` kończy się wynikiem `PRE-FLIGHT PASS`,
6. przedstawiono użytkownikowi krótkie podsumowanie zmian i wyników testów.

## 11. Czego nie robić bez osobnej zgody

Bez osobnego planu i komendy „do dzieła” nie należy:

- przebudowywać całej architektury,
- migrować projektu na framework, TypeScript lub bundler,
- hurtowo usuwać albo zmieniać bloków `catch`,
- hurtowo przepisywać warstwy storage,
- zmieniać modelu WYCENY,
- przebudowywać `RYSUNEK`,
- wdrażać Firebase/Firestore,
- usuwać wsparcia dla starych danych,
- wykonywać masowego rename/refactor obejmującego wiele domen.

---

Najważniejsza zasada w skrócie: **najpierw diagnoza i uzgodnienie, potem „do dzieła”, następnie minimalna zmiana i pełny preflight.**
