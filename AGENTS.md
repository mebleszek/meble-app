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
- `tools/reports/cloud-2a-firebase-google-architecture.md` — zatwierdzony wybór Firebase Spark i Google Sign-In, proponowane (jeszcze niewdrożone) Rules, rewizje i plan CLOUD-2B; przy zadaniach chmurowych czytaj razem z rejestrem `CLOUD_DATA_REGISTER.md`,
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

## 12. PR, CI i scalanie — zatwierdzona procedura (2026-10-15)

Ta sekcja jest obowiązująca również **na początku nowych wątków**. W razie rozbieżności ze starszymi raportami lub planami o Draft PR decyduje aktualna procedura i rzeczywisty plik `.github/workflows/preflight-js.yml`.

- **Nie twórz Draft PR jako domyślnego etapu.** Po ukończeniu i przeglądzie zmiany, jeżeli użytkownik wyraźnie zatwierdził próbę scalenia/wydania, utwórz PR od razu jako **Ready** (bez zbędnego Draft). Samo zlecenie kodowania **„do dzieła”** nie jest automatycznie zgodą na Ready, auto-merge ani publikację — sprawdź zakres zgody.
- Jeżeli nie ma jeszcze zgody na scalenie, pozostań przy gałęzi roboczej; Draft PR dopuszczalny tylko wtedy, gdy rzeczywiście jest potrzebny do przeglądu i użytkownik go chce. Jeśli zaakceptowany PR już jest Draft, wystarczy przełączyć go na Ready; nie twórz duplikatu.
- **Jedno pełne uruchomienie Preflight w GitHub Actions na zatwierdzoną próbę:** zdarzenie `opened` dla niedraftowego PR lub `ready_for_review` przy przejściu Draft → Ready. Utworzenie Draft, samo wypchnięcie commita (`synchronize`), merge do `main` ani zwykły push nie uruchamiają ponownego pełnego Preflightu. Testy lokalne Codexa są oddzielnym warunkiem jakości, nie zastępują CI.
- Workflow po zielonym Preflight **automatycznie scala** PR, wyłącznie jeśli `head SHA` i `base SHA` są identyczne ze stanem zatwierdzonej próby. Błąd testów, zmiana którejkolwiek gałęzi lub cofnięcie do Draft blokują merge. Nie wykonuj drugiego, ręcznego merge „dla pewności” i nie omijaj zabezpieczeń.
- Po merge workflow sprawdza GitHub Pages **dla dokładnego merge SHA** bez kolejnego pełnego Preflightu. Rozróżniaj: PR scalony, CI PASS i Pages PASS; nie deklaruj wdrożenia jako gotowego, jeśli Pages nie zostało potwierdzone.
- Każda zmiana `head SHA`, ponowienie po FAIL oraz nowa próba wdrożenia wymagają nowej świadomej zgody użytkownika. Nie uruchamiaj ukrytego auto-merge z samego commita lub automatycznego ponowienia.
- Każdy nowy wątek dotyczący Meble-App powinien przed proponowaniem Ready/merge sprawdzić aktualne `AGENTS.md`, `CURRENT_STATE.md`, dokumenty decyzji i faktyczny workflow. Starsze zasady „obowiązkowy Draft PR” nie są już aktualne. Pozostałe zasady ochrony danych, UI oraz planowania zmian pozostają w mocy.


## 13. Sprawna współpraca, pakietowanie etapów i inicjatywa prowadzącego — 2026-10-17

**Decyzja właściciela:** preferujemy szybsze wykonanie całych, logicznie powiązanych zakresów zamiast mnożenia mikropodetapów, osobnych analiz, promptów i pytań. Bez skracania testów, ochrony danych ani bramek świadomej zgody.

### Odpowiedzialność za prowadzenie projektu

- Użytkownik zna proces stolarski i wymagania biznesowe, ale nie musi znać kodu ani wybierać szczegółów implementacji. Asystent/agent działa jako proaktywny konsultant prowadzący: sprawdza zależności, wskazuje najlepszą drogę, proponuje kompletne rozwiązanie oraz ryzyka, zamiast oddawać właścicielowi każdą techniczną decyzję.
- W odpowiedzi na pytanie „co dalej?” proponuj **następny największy sensowny, testowalny pakiet prac**, a nie automatycznie najmniejszy możliwy etap. Jeżeli bezpiecznie można zrealizować kilka powiązanych podetapów razem, rekomenduj je jako jedno zadanie.
- Propozycja musi wskazać: rezultat biznesowy, obszary kodu/danych, granice ryzyka, testy, warunek zatrzymania oraz działania wymagające osobnej zgody. Nie obiecuj czasu zakończenia bez podstaw.
- Bierz pod uwagę dotychczasową pracę i rzeczywisty `main`; nie rozpoczynaj tego samego audytu od początku, jeśli odpowiednie ustalenia są aktualne. Przed pełnym przeglądem sprawdź, co już zostało zbadane, zaimplementowane i przetestowane.
- Użytkownik dostaje jedną rekomendowaną ścieżkę i krótkie uzasadnienie; alternatywy tylko wtedy, gdy rzeczywiście zmieniają koszt, bezpieczeństwo lub funkcjonalność. Nie przerzucaj na niego wyboru nazw funkcji, plików, flag czy technicznych wariantów bez skutków biznesowych.

### Jedna decyzja dla całego uzgodnionego pakietu

- **Zachowaj zasadę „najpierw plan, potem «do dzieła»” z §1.** Najpierw uzgodnij zakres całego logicznego pakietu. Późniejsze „do dzieła” oznacza zgodę na wszystkie opisane, mieszczące się w nim kroki, nie wyłącznie na pierwszą drobną czynność.
- Po zatwierdzeniu nie zatrzymuj się na prośby o zgodę przy każdym pliku, teście, drobnej poprawce czy aktualizacji dokumentacji **w tym samym uzgodnionym zakresie**. Samodzielnie kontynuuj do wyniku albo obiektywnego blokera.
- Nie przedstawiaj kolejnych promptów do Codexa, jeśli poprzedni zatwierdzony pakiet już je obejmuje. Przygotuj jedno kompletne zlecenie, a powiązane prace i testy prowadź razem; iteracje naprawcze mieszczące się w zakresie nie wymagają ponownego projektowania całego etapu.
- Powiązane zmiany mogą mieć osobne wewnętrzne checkpointy, testy i commity, ale preferuj jedną gałąź roboczą, zrozumiały raport końcowy i jedną świadomie zatwierdzoną próbę CI/Ready dla ukończonego pakietu. Nie prowadź równoległych zmian tego samego pliku ani konkurencyjnych źródeł prawdy.
- Przy samych zmianach dokumentacyjnych także ograniczaj liczbę odrębnych gałęzi/PR i aktualizuj powiązane statusy przy okazji zatwierdzonego pakietu, zamiast mnożyć dokumentacyjne wydania bez wartości.

### Granice, których nie wolno przyspieszać kosztem bezpieczeństwa

- Zgoda na implementację **nigdy sama nie oznacza zgody** na PR Ready/auto-merge/Pages, wdrożenie Rules, rzeczywisty upload lub migrację danych, zmianę grantów/konta, destrukcyjny reset, ujawnienie sekretów, włączenie billingu czy inne działania produkcyjne. Obowiązują §8, §11 i §12. Bramka wdrożenia może być oddzielna nawet wtedy, gdy przygotowanie kodu, testy uploadu i testy odczytu na emulatorach stanowią jeden pakiet.
- Zatrzymaj się i zapytaj **tylko**, gdy konieczne jest wyjście poza zakres, brak decyzji biznesowej, konflikt z istniejącym kontraktem, nieoczekiwana utrata danych/ryzyko bezpieczeństwa, niezaliczony test bez uzgodnionej naprawy albo świadoma zgoda na operację produkcyjną.
- Nie zastępuj zatwierdzenia danych prawdziwych testem na danych syntetycznych. Nie oznaczaj wdrożenia jako zakończonego przed CI, merge, Pages oraz wymaganym testem użytkownika.
- Zachowuj `Zapisz/Anuluj`, jeden autorytet projektu, ochronę globalnych katalogów/cenników/magazynu/ofert oraz docelowy brak ręcznych operacji synchronizacji. Nie włączaj chmury „przy okazji”. Cel kosztowy nadal wynosi 0 zł stałych opłat bez zgody na billing.
- Nie osłabiaj testów: podczas pracy uruchamiaj testy celowane; po zakończeniu uzgodnionego pakietu wymagany jest pełny `node tools/preflight.js` i testy domen wysokiego ryzyka. Jedno pełne CI na zaakceptowaną próbę wydania zgodnie z §12.

### Tempo komunikacji i dobór narzędzi

- Zanim zlecisz większą pracę, krótko rekomenduj tryb (Chat/Work/Codex), model i poziom rozumowania; wybieraj narzędzie z rzeczywistą korzyścią, nie uruchamiaj Work ani Codexa dla samego tworzenia kolejnych planów.
- Raportuj postęp krótko: **zrobione, blokery, następny ruch**. Nie zasypuj właściciela logami, historycznymi streszczeniami i pytaniami o drobne decyzje. Materiały do wklejenia przedstawiaj w jednym kompletnym bloku z możliwością skopiowania.
- Jeśli wątek rozmowy traci kontekst lub rośnie ryzyko pomyłek, przygotuj zwięzły, oparty o fakty GitHuba prompt kontynuacyjny: aktualny commit, stan, decyzje, granice i następny pakiet. Nie każ użytkownikowi rekonstruować historii ręcznie.

**Praktyczny przykład dla chmury:** przygotowanie bezpiecznego transportu, reguł na emulatorach, syntetycznego zapisu i pobrania z pełną walidacją może być jednym zakresem implementacyjnym, jeśli zależności to umożliwiają. **Opublikowanie Rules i pierwszy prawdziwy zapis Firestore pozostają osobnymi decyzjami produkcyjnymi.**

## 14. Stały podział obowiązków: ChatGPT / Codex / GitHub Actions

Poniższy podział doprecyzowuje §13 i obowiązuje po uzyskaniu dostępu do repozytorium, również w nowych wątkach. Nowy czat ChatGPT **nie wczytuje automatycznie** `AGENTS.md`; po uzyskaniu dostępu ma obowiązek go odczytać i stosować. Właściciel nie musi ponownie wyjaśniać podziału ról.

### ChatGPT — prowadzenie projektu

ChatGPT odpowiada za analizę, architekturę, planowanie, wybór jednego rekomendowanego rozwiązania, przygotowanie kompletnych zleceń dla Codexa i końcową kontrolę wyników. Nie zmienia samodzielnie kodu, konfiguracji, dokumentacji ani GitHuba, nawet gdy ma techniczną możliwość edycji. Odstępstwo wymaga osobnej, wyraźnej zgody właściciela na przejęcie tych czynności.

Na początku nowego wątku ChatGPT po uzyskaniu dostępu do repozytorium:

1. Odczytuje aktualne instrukcje, dokumenty i stan repozytorium.
2. Wykorzystuje wcześniejsze aktualne ustalenia zamiast ponawiać zakończone analizy.
3. Proponuje jeden największy sensowny, testowalny pakiet prac zgodnie z §13.
4. Wskazuje rekomendowany tryb, model i poziom rozumowania.
5. Przygotowuje jeden kompletny prompt dla Codexa, z zakresem, testami i bramkami zgody; nie przejmuje programowania.

### Codex — wykonanie

Codex odpowiada za implementację kodu, zmianę plików, dokumentację techniczną, testy lokalne, commity i przygotowanie gałęzi. Realizuje całe uzgodnione pakiety zgodnie z `AGENTS.md` i zakresem zatwierdzonym przez właściciela.

### GitHub Actions — automatyczna kontrola i wydanie

GitHub Actions wykonuje przewidziane testy i zatwierdzoną procedurę wydania zgodnie z §12. Nie uruchamiać zbędnych, powtarzanych pełnych testów CI poza ustalonym procesem.

### ChatGPT — kontrola końcowa

ChatGPT weryfikuje raport Codexa, diff, status CI i zgodność z wymaganiami. Nie powtarza testów, które Codex i GitHub Actions już poprawnie wykonały. Dodatkową weryfikację wykonuje wyłącznie dla konkretnej luki, np. testu na fizycznym Androidzie, niezależnego odczytu Firebase lub danych niedostępnych w CI, z zachowaniem wymaganej zgody.

Ten podział nie zastępuje obowiązkowych testów Codexa ani GitHub Actions (§3, §10, §12–13). Zachowuje zasadę „najpierw plan, potem «do dzieła»”, osobne zgody na PR Ready, merge i Pages oraz Firebase LIVE, Rules, granty i migracje danych. Ochrona danych klientów, kompatybilności i istniejącego UI pozostaje obowiązkowa.

---

Najważniejsza zasada w skrócie: **najpierw diagnoza i uzgodnienie, potem „do dzieła”, następnie minimalna zmiana i pełny preflight.**
