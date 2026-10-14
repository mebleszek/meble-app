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
- Zgodność wsteczną rozdzielaj według klasy danych: inwestorzy i projekty są obecnie prawie testowe; ich starych schematów nie trzeba zachowywać. Dane globalne muszą pozostać kompatybilne wstecz; historia ofert i inne domeny wymagają osobnej decyzji. Szczegóły w §14 i `PROJECT_DECISIONS.md`.

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

**Przed KAŻDĄ zmianą — także drobną i po otwarciu nowego wątku — najpierw przeczytaj aktualne `AGENTS.md` i `PROJECT_DECISIONS.md` z właściwej gałęzi**, potem właściwe dokumenty domenowe, aktualny kod i testy. Nie polegaj wyłącznie na pamięci rozmowy. Jeśli pliki są niedostępne, zgłoś to zamiast zgadywać.

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
- nie usuwaj bez uzgodnienia chronionych pól i rekordów globalnych (cenników, katalogów, słowników, ustawień),
- nie twórz zbędnej kompatybilności dla starych inwestorów i projektów — to dane niemal testowe; samowolny reset nie jest jednak dozwolony,
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
- usuwać wsparcia dla starych **danych globalnych** (zachowanie dawnych schematów inwestorów/projektów nie jest wymagane w zatwierdzonym zakresie),
- wykonywać masowego rename/refactor obejmującego wiele domen.

## 12. Współpraca ChatGPT / Work / Codex i oszczędzanie limitów — decyzja 2026-10-14

Ta sekcja jest obowiązującym kontraktem organizacji dalszych prac, a nie opisem ukończonej funkcjonalności.

- **ChatGPT (Chat)**: domyślnie wykonuje analizę repozytorium, dokumentacji, zależności i ryzyk; tworzy plan oraz krótki, precyzyjny prompt implementacyjny.
- **Work**: duże, wieloetapowe analizy tylko wtedy, gdy są efektywniejsze niż analiza w Chat.
- **Codex**: przede wszystkim programowanie, poprawki, testy i weryfikacja wymagająca wykonania kodu. Zlecać mu szeroką analizę wyłącznie, jeśli będzie wydajniejszy od Chat i Work.
- Przy istotnych zadaniach ChatGPT rekomenduje **tryb, model i poziom rozumowania**, uwzględniając **zużycie limitów**.
- Prompty dla Codexa mają obejmować jeden jasno określony etap: problem, zakres plików, oczekiwane zachowanie, zakazy zmian pobocznych i kryteria akceptacji. Nie kazać ponownie badać całego repozytorium, gdy analiza jest już wykonana. Korzystać z konkretnych ustaleń i dokumentów, zamiast bezwarunkowo czytać setki plików.
- W trakcie implementacji preferować regresje celowane, a na końcu pełny `node tools/preflight.js`. Po raporcie Codexa najpierw ocena wyniku w Chat, bez automatycznego nowego zadania.
- **Urządzenia**: teraz użytkownik ręcznie testuje **tylko na telefonie z Androidem**. Tablet i komputer mają być wspierane już w projektowaniu (responsywność, dotyk/mysz/klawiatura, modale, przewijanie, wydruk), lecz ręczne testy użytkownika na tych urządzeniach rozpoczną się dopiero przy znacznej funkcjonalności aplikacji. Test symulowanego DOM nie jest testem rzeczywistego telefonu.
- **Dokumentacja**: utrzymywać aktualne pliki główne; historyczne raporty zachowywać jako dowód przebiegu prac. Pliki potencjalnie zbędne lub sprzeczne wskazywać do wspólnej decyzji. Bez zgody niczego nie usuwać.
- **Partnerski styl współpracy**: ChatGPT pełni rolę doradczyni i partnerki w rozwijaniu Meble-App — wspiera decyzje użytkownika, proponuje usprawnienia, uprzedza o zagrożeniach, kosztach i zużyciu limitów, a w razie potrzeby konstruktywnie nie zgadza się z pomysłem. Nie potakuje bezkrytycznie, nie komplikuje zadania bez korzyści i nie przejmuje ostatecznych decyzji użytkownika. Komunikacja ma być serdeczna, swobodna i konkretna; użytkownik oczekuje przyjacielskiego podejścia.
- Nadal obowiązuje ochrona `main`, analiza przed zmianą oraz zgoda użytkownika „do dzieła” zgodnie z sekcją 1. Nie scalać PR, nie publikować i nie usuwać plików bez osobnej decyzji.


## 13. Nietykalność interfejsu i zachowania użytkowego — decyzja 2026-10-14

- **Interfejs Meble-App jest obszarem zakazanym do samodzielnych zmian.** Bez uprzedniej, konkretnej zgody użytkownika nie wolno niczego dodawać, usuwać, ukrywać, przenosić ani przemianowywać w UI: przycisków, akordeonów, pól, etykiet, opisów, modali, układu, wyglądu, nawigacji ani kolejności czynności.
- Zakaz obejmuje także zmianę zachowania interakcji i UX (np. automatyczne stosowanie preferencji, usunięcie potwierdzenia lub dodatkowy krok), nawet gdy ma uprościć obsługę. Zmiana logiki domenowej nie upoważnia do pobocznej zmiany interfejsu.
- ChatGPT / Work / Codex mogą **proponować** zmiany, wyjaśniając cel, zakres, konsekwencje dla użytkownika, danych i bezpieczeństwa oraz wariant bez zmiany UI. Najpierw wspólnie omawiają propozycje; **ostateczną decyzję o każdej zmianie interfejsu podejmuje użytkownik**.
- Zgoda na jeden konkretny element UI nie oznacza zgody na przebudowę całej zakładki ani na inne usprawnienia. Przy implementacji zachowuj dotychczasowy interfejs 1:1 poza elementami wyraźnie zaakceptowanymi.
- Użytkownik potwierdził, że wszystkie pozostałe zmiany interfejsu z przeglądu 40 PR były zatwierdzone; wyjątek: nieuzgodniony przycisk „Włącz projektowe PCV” i jego osobny dialog z PR #40. Usunięcie tego elementu i automatyczny projektowy tryb PCV są już zaakceptowanym zakresem kolejnej implementacji.
- Nadal obowiązują osobny plan, jednoznaczne polecenie „do dzieła”, ochrona globalnych danych i testy regresyjne. Przedstawienie pomysłu lub pozytywny wynik testów nie są zgodą na wdrożenie.


## 14. Ochrona danych i zapis decyzji — ustalenie 2026-10-14

- `PROJECT_DECISIONS.md` jest kanonicznym krótkim rejestrem decyzji i tematów nierozstrzygniętych. Po każdej zaakceptowanej decyzji zaktualizuj ten rejestr przy najbliższym zadaniu dokumentacyjnym, a przy implementacji weryfikuj zgodność z nim; decyzji nie wolno samodzielnie zmieniać. Oznaczaj osobno **zaakceptowane**, **do wdrożenia**, **do dyskusji** i **odrzucone**.
- Dane inwestorów i projektów na obecnym etapie są niemal testowe. **Nie wymagaj wstecznej kompatybilności ich starych schematów**; nie twórz warstw legacy wyłącznie dla nich. To nie oznacza zgody na niekontrolowane kasowanie: zakres ewentualnej destrukcyjnej migracji/resetu musi być wyraźnie zatwierdzony, a ochrona innych magazynów zachowana.
- **Bezwzględnie chronione dane globalne:** cenniki, stawki, katalogi okuć i materiałów, producenci i dostawcy, słowniki, ustawienia i konfiguracje wypracowane z użytkownikiem. Nie modyfikuj ich semantyki, nie migruj, nie usuwaj ani nie resetuj bez wcześniejszego uzgodnienia. **Wymagana zgodność wsteczna danych globalnych** oraz regresje potwierdzające ich nienaruszenie.
- Zgoda dotycząca testowych inwestorów i projektów nie obejmuje automatycznie historii ofert ani żadnych innych magazynów. Wątpliwości kieruj do użytkownika.
- Projektowe PCV jest zatwierdzone jako **automatyczny tryb każdego projektu bez dodatkowego przycisku ani potwierdzenia aktywacji**. Przejście istniejących projektów testowych musi być bezpieczne, przypisane do fizycznego projektu i nie może kopiować ani zmieniać globalnych nadpisań. Dopóki praca nie zostanie wdrożona, nie przedstawiaj tego jako zachowania działającego w `main`.

---

Najważniejsza zasada w skrócie: **najpierw diagnoza i uzgodnienie, potem „do dzieła”, następnie minimalna zmiana i pełny preflight.**
