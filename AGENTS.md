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

**Jedna pełna analiza rzeczywistego łańcucha zależności:** ChatGPT analizuje zależności od UI przez wywołania, logikę biznesową, modele, identyfikatory, odczyt, zapis, recovery, backupy, wyceny, oferty, synchronizację i skutki uboczne oraz przygotowuje zakres zadania. Codex wykorzystuje te ustalenia i weryfikuje kod niezbędny do implementacji, bez powtarzania całego audytu. Dodatkowa pogłębiona analiza jest potrzebna wyłącznie po wykryciu konkretnej sprzeczności lub ryzyka. Ustalaj, co aplikacja rzeczywiście robi, i rozróżniaj obowiązujący model biznesowy od historycznych wyjątków. Najpierw analiza i dowody, potem rekomendacja — bez propozycji opartych na przypuszczeniach.

- Preferuj małe, odwracalne i łatwe do zweryfikowania zmiany.
- Nie wykonuj szerokich refaktorów „przy okazji”.
- Nie przepisuj dużego pliku tylko dlatego, że jest duży.
- Nie zmieniaj stylu, nazw, formatowania ani architektury modułów niezwiązanych bezpośrednio z zadaniem.
- Nie usuwaj zgodności wstecznej ze starymi projektami, ofertami lub ustawieniami bez osobnej zgody.

**Pakiety bez limitu liczbowego:** wybieraj największy spójny, bezpieczny i testowalny zakres; siedem drobnych poprawek może stanowić jeden pakiet, a trzy duże wymagać rozdzielenia. Liczą się zależności, ryzyko i odrębne bramki zgody, nie sztywna liczba punktów. Ogranicz liczbę zbędnych pytań i mikroetapów.

**Błędy odkryte podczas implementacji:** powiązany błąd niezbędny do wykonania zatwierdzonego zadania naprawiaj w tym samym zakresie, usuwając przyczynę, a nie maskując objaw. Niezwiązany błąd zgłoś i nie zmieniaj go przy okazji; realizuj niezależne, bezpieczne części zadania. Przy ryzyku utraty danych lub bezpieczeństwa wstrzymaj zagrożone operacje i zgłoś STOP. Nie rozszerzaj w ten sposób zgody na UI, migracje, produkcję ani ryzykowny refaktor.

## 3. Testy są bramką bezpieczeństwa, nie celem samym w sobie

**GitHub Actions odpowiada za automatyczne testy objęte CI**, w tym `node tools/preflight.js`, regresje oraz właściwe zestawy Firebase Emulator Suite. Codex przygotowuje kod i testy, ale nie dubluje ich pełnym lokalnym uruchomieniem przed CI ani po jego zaliczeniu. ChatGPT kontroluje dowody zamiast powtarzać te same testy.

**Aktualność testów w ramach zmiany:** ChatGPT przed zleceniem identyfikuje regresje i oczekiwania zależne od zmienianego zachowania; Codex w zatwierdzonym pakiecie weryfikuje odpowiednie testy, aktualizuje wyłącznie nieaktualne asercje wynikające z jawnie zaakceptowanego kontraktu, dodaje przypadki nowego zachowania i sprawdza ich rzeczywiste włączenie do CI. Zachowuje wszystkie nadal obowiązujące zabezpieczenia, asercje negatywne i przypadki brzegowe. Nie wolno osłabiać testu dla uzyskania PASS ani zmieniać kontraktu biznesowego pod test. Aktualizacja powiązanego testu mieści się w zgodzie na implementację; pełne CI wciąż należy do GitHub Actions.

Przed implementacją ustal wymagane testy, ich właściciela i rzeczywiste pokrycie aktualnych workflow. Samo istnienie skryptu testowego lub workflow dla innej gałęzi nie oznacza wykonania testu dla bieżącego SHA. Dla zmian wysokiego ryzyka wymagane są także właściwe regresje domenowe; sprawdź, czy są częścią Preflightu lub osobnego zadania CI, zamiast uruchamiać je ponownie lokalnie.

Codex może wykonywać minimalną diagnostykę i celowaną reprodukcję niezbędną do napisania lub naprawienia kodu oraz kontrolę diffu. Nie ponawia automatycznie pełnych zestawów CI. Dodatkowy test wymaga konkretnej luki lub nowego błędu, a nie samej chęci ponownego potwierdzenia PASS.

Jeżeli wymagany test nie może działać w CI, opisz lukę, przyczynę, właściwego wykonawcę i sposób weryfikacji (np. fizyczny Android przez właściciela albo prywatny artefakt sprawdzony lokalnie bez publikacji). Nie oznaczaj go jako PASS ani nie uznawaj niepełnego CI za pełne potwierdzenie jakości. Przy braku zgody na uruchomienie wymaganej ścieżki CI raportuj `CI_PENDING`; samo zakończenie implementacji to `CODE_READY` (§10).

Jeżeli test nie przechodzi:

- zatrzymaj się,
- wskaż dokładnie pierwszy niezaliczony etap,
- ustal, czy problem jest w kodzie produkcyjnym, teście, konfiguracji czy w nieaktualnym założeniu,
- nie zmieniaj kodu produkcyjnego tylko po to, aby test stał się zielony,
- nie pomijaj testów, nie usuwaj ani nie osłabiaj asercji dla uzyskania PASS,
- iteracje naprawcze muszą mieścić się w zatwierdzonym zakresie; ponowienie wydaniowego CI podlega §12.

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

**Stała decyzja właściciela — 24.10.2026:** diagnostyka dla właściciela ma działać bezpośrednio w Meble-App na telefonie: „Diagnostyka sesji → Kopiuj raport → wklejenie do ChatGPT”. Nie wymagać USB, Chrome DevTools, komputera do debugowania, konsoli, bookmarkletów, dodatkowych aplikacji ani ręcznego wykonywania kodu. Wyjątkowa czynność techniczna wymaga wyraźnej, osobnej zgody właściciela. Diagnostyka musi być anonimowa i tylko do odczytu; dostarczenie nowej wersji nie uzasadnia odświeżenia karty z niezabezpieczonym RAM. Ta zasada nie zmienia procedury wydania ani bramek dostępu.

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

**Rozróżnienie danych (decyzja właściciela 31.10.2026):** obecni inwestorzy i projekty są testowe; nie buduj rozległej kompatybilności historycznych schematów wyłącznie dla nich, ale nigdy nie kasuj ich, ofert, draftów ani powiązanych magazynów automatycznie bez zgody na dokładny zakres. Cenniki, stawki, katalogi materiałów/okuć/dostawców, zamienniki, słowniki, ustawienia, konfiguracje i magazyn to dane globalne chronione bezwzględnie — ich kompatybilność i nienaruszalność są obowiązkowe.

**Przed destrukcyjną migracją** wymagaj domyślnie niezależnie zweryfikowanej kopii i planu cofnięcia. Właściciel może osobno, świadomie dopuścić utratę dokładnie wskazanych danych testowych bez tworzenia kopii. Wyjątek nie dotyczy danych globalnych, cudzych rekordów ani innych nieobjętych zgodą danych. Sama etykieta „testowe” nie jest zgodą na reset. Przejście na prawdziwe dane klientów wymaga pełniejszej ochrony przed kolejnymi zmianami.

## 9. Raport po wykonaniu zadania

Po zmianie podaj krótko:

- co zostało zmienione,
- które pliki zostały zmienione,
- czego świadomie nie ruszano,
- jakie kontrole i testy rzeczywiście wykonano, przez kogo i dla jakiego SHA; dla CI podaj link oraz zatwierdzone HEAD/BASE,
- wynik Preflightu i wymaganych regresji z CI albo jawne `CI_PENDING` / FAIL / BLOCKED, bez zaliczania testów niewykonanych i bez odziedziczenia PASS z innego SHA,
- osobno status implementacji, weryfikacji, wydania i zgód LIVE zgodnie z §10,
- ewentualne pozostałe ryzyka lub decyzje do podjęcia.

Pakiet implementacyjny można przekazać jako `CODE_READY` z `CI_PENDING`, jeżeli nie zatwierdzono jeszcze CI/wydania. Nie przedstawiaj tego jako potwierdzenia jakości, gotowości produkcyjnej ani zakończonego wydania. Rozbieżności zakresu, FAIL i brakujące dowody zgłaszaj jawnie.

## 10. Definition of Done

Warunki zakończenia implementacji (`CODE_READY`):

1. wykonano wyłącznie uzgodniony zakres,
2. nie wprowadzono nieuzgodnionych zmian pobocznych,
3. zachowano kompatybilność istniejących danych albo jasno opisano uzgodnioną migrację,
4. przygotowano wymagane regresje, sprawdzono diff i przypisano weryfikację zgodnie z §3,
5. wskazano wyniki faktycznie wykonanych kontroli i wszystkie brakujące dowody,
6. przedstawiono krótkie podsumowanie oraz osobno poniższe statusy.

| Status | Wymagany dowód i znaczenie |
|---|---|
| `CODE_READY` | Implementacja uzgodnionego pakietu jest gotowa; nie potwierdza zaliczenia CI ani gotowości produkcyjnej. |
| `CI_PENDING` | Wymagane testy jeszcze niewykonane lub niezakończone; raport wskazuje brakujące zestawy. Może współistnieć z `CODE_READY`. |
| `CI_PASS` | Wszystkie wymagane testy rzeczywiście zaliczone dla wskazanego SHA i zakresu; link do CI, HEAD/BASE oraz ewentualne dowody spoza CI. FAIL, BLOCKED lub niewykonany wymagany test wykluczają ten status. |
| `RELEASED` | Zatwierdzony pakiet scalony przez procedurę §12, a Pages potwierdzone dla dokładnego merge SHA. Akceptację ergonomii na fizycznym telefonie raportuj oddzielnie. |
| `LIVE_BLOCKED` / `LIVE_APPROVED` | Niezależny status konkretnej operacji produkcyjnej: domyślnie zablokowana; zatwierdzona tylko po osobnej, wyraźnej zgodzie właściciela i spełnieniu wymaganych dowodów/bramek. Podaj zakres, artefakt i warunki zgody; nie jest to ogólne uprawnienie LIVE. |

`CI_PASS` nie udziela zgody na wydanie. `RELEASED` nie udziela zgody na Firebase LIVE, Rules, granty, billing ani migrację. `LIVE_APPROVED` nie uruchamia operacji automatycznie i nie znosi blokad technicznych; zgoda przygotowawcza nigdy nie jest wykonawczą. Zmiana SHA unieważnia przypisanie wcześniejszego PASS do nowej wersji.

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
- **Stały wyjątek operacyjny — PR Ready obsługuje ChatGPT (2026-10-21).** Po **każdorazowej, osobnej zgodzie właściciela** na konkretną próbę wydania (repozytorium, gałąź, dokładne HEAD i BASE SHA oraz zakres), ChatGPT może samodzielnie utworzyć **jeden PR bezpośrednio jako Ready** przez połączony GitHub, aby ograniczyć zużycie limitu Codexa. Przed operacją odczytowo weryfikuje wskazane SHA, diff, wymagane pokrycie CI i brak istniejącego PR; zmiana któregokolwiek warunku oznacza STOP i potrzebę nowej zgody. Po utworzeniu PR ChatGPT wyłącznie odczytowo obserwuje wyniki CI, automatyczny merge i Pages. **Nie** zmienia w tym trybie plików, commitów, gałęzi, workflow ani testów, **nie** scala ręcznie, nie ponawia prób i nie wykonuje żadnych operacji Firebase LIVE. Samo to upoważnienie **nie jest** zgodą na żadne konkretne wydanie. Jeżeli bezpośrednia obsługa PR przez ChatGPT jest niedostępna, Codex albo właściciel może wykonać tę samą operację wyłącznie po uzgodnieniu wykonawcy, nadal z osobną zgodą na wydanie.
- **Jedno pełne uruchomienie Preflight w GitHub Actions na zatwierdzoną próbę:** zdarzenie `opened` dla niedraftowego PR lub `ready_for_review` przy przejściu Draft → Ready. Utworzenie Draft, samo wypchnięcie commita (`synchronize`), merge do `main` ani zwykły push nie uruchamiają ponownego pełnego Preflightu wydaniowego. Odrębne, izolowane workflow mogą reagować na push wyłącznie na wskazane w nich gałęzie. Codex nie dubluje lokalnie testów CI (§3); bez zatwierdzonej próby pakiet pozostaje `CODE_READY` / `CI_PENDING`.
- Przed Ready sprawdź faktyczne pokrycie wymaganych testów dla zatwierdzonego HEAD/BASE. Jeżeli brakuje zadania wysokiego ryzyka, przygotuj właściwą kontrolę CI w uzgodnionym zakresie przed próbą wydania; nie zastępuj jej deklaracją ani PASS innej gałęzi. Ręczny `workflow_dispatch` nie stanowi obejścia zgody ani powodu do ponownego pełnego CI.
- Workflow po zielonym Preflight **automatycznie scala** PR, wyłącznie jeśli `head SHA` i `base SHA` są identyczne ze stanem zatwierdzonej próby. Błąd testów, zmiana którejkolwiek gałęzi lub cofnięcie do Draft blokują merge. Nie wykonuj drugiego, ręcznego merge „dla pewności” i nie omijaj zabezpieczeń.
- Po merge workflow sprawdza GitHub Pages **dla dokładnego merge SHA** bez kolejnego pełnego Preflightu. Rozróżniaj: PR scalony, CI PASS i Pages PASS; nie deklaruj wdrożenia jako gotowego, jeśli Pages nie zostało potwierdzone.
- Każda zmiana `head SHA`, ponowienie po FAIL oraz nowa próba wdrożenia wymagają nowej świadomej zgody użytkownika. Nie uruchamiaj ukrytego auto-merge z samego commita lub automatycznego ponowienia.
- Każdy nowy wątek dotyczący Meble-App powinien przed proponowaniem Ready/merge sprawdzić aktualne `AGENTS.md`, `CURRENT_STATE.md`, dokumenty decyzji i faktyczny workflow. Starsze zasady „obowiązkowy Draft PR” nie są już aktualne. Pozostałe zasady ochrony danych, UI oraz planowania zmian pozostają w mocy.


## 13. Sprawna współpraca, pakietowanie etapów i inicjatywa prowadzącego — 2026-10-17

**Decyzja właściciela:** preferujemy szybsze wykonanie całych, logicznie powiązanych zakresów zamiast mnożenia mikropodetapów, osobnych analiz, promptów i pytań. Bez skracania testów, ochrony danych ani bramek świadomej zgody.

### Nietykalność UI/UX — świadomy wyjątek naprawczy B (31.10.2026)

Bez wcześniejszej konkretnej zgody właściciela nie dodawaj, nie usuwaj, nie ukrywaj, nie przenoś ani nie przemianowuj przycisków, pól, etykiet, modali, akordeonów, układu, wyglądu, nawigacji ani zachowania interakcji. Zgoda na jeden element nie obejmuje całej zakładki; zmiana logiki nie upoważnia do ulepszania interfejsu.

**Jedyny wyjątek w zatwierdzonej naprawie:** wolno przywrócić jednoznacznie wcześniej zaakceptowane zachowanie UI/UX, jeśli jest to niezbędne do uzgodnionego celu. Nie wolno tworzyć nowych funkcji, dodatkowych kroków, zmieniać wyglądu ani poprawiać ergonomii według własnego uznania. Przy niejasności obowiązującego zachowania — STOP i decyzja właściciela. Pozostałe UI/UX zachowaj bez zmian.

### Odpowiedzialność za prowadzenie projektu

- Użytkownik zna proces stolarski i wymagania biznesowe, ale nie musi znać kodu ani wybierać szczegółów implementacji. ChatGPT prowadzi projekt i rekomenduje rozwiązanie, Codex wykonuje zatwierdzony pakiet, a GitHub Actions odpowiada za testy CI (§14). Nie oddawaj właścicielowi każdej technicznej decyzji.
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
- Nie zastępuj zatwierdzenia danych prawdziwych testem na danych syntetycznych. `RELEASED` wymaga CI, merge i Pages; wymagany test właściciela na fizycznym telefonie jest oddzielnym dowodem akceptacji, którego nie zastępuje Chromium.
- Zachowuj `Zapisz/Anuluj`, jeden autorytet projektu, ochronę globalnych katalogów/cenników/magazynu/ofert oraz docelowy brak ręcznych operacji synchronizacji. Nie włączaj chmury „przy okazji”. Cel kosztowy nadal wynosi 0 zł stałych opłat bez zgody na billing.
- Nie osłabiaj testów: pełny Preflight i wymagane regresje domen wysokiego ryzyka wykonuje GitHub Actions zgodnie z §3 i §12. Codex ogranicza lokalne wykonanie do diagnostyki potrzebnej do implementacji i jawnie opisanych luk; nie powtarza automatycznie zestawów CI.

### Tempo komunikacji i dobór narzędzi

- Zanim zlecisz większą pracę, krótko rekomenduj tryb (Chat/Work/Codex), model i poziom rozumowania; wybieraj narzędzie z rzeczywistą korzyścią, nie uruchamiaj Work ani Codexa dla samego tworzenia kolejnych planów.
- Raportuj postęp krótko: **zrobione, blokery, następny ruch**. Nie zasypuj właściciela logami, historycznymi streszczeniami i pytaniami o drobne decyzje. Materiały do wklejenia przedstawiaj w jednym kompletnym bloku z możliwością skopiowania.
- Jeśli wątek rozmowy traci kontekst lub rośnie ryzyko pomyłek, przygotuj zwięzły, oparty o fakty GitHuba prompt kontynuacyjny: aktualny commit, stan, decyzje, granice i następny pakiet. Nie każ użytkownikowi rekonstruować historii ręcznie.

**Praktyczny przykład dla chmury:** przygotowanie bezpiecznego transportu, reguł na emulatorach, syntetycznego zapisu i pobrania z pełną walidacją może być jednym zakresem implementacyjnym, jeśli zależności to umożliwiają. **Opublikowanie Rules i pierwszy prawdziwy zapis Firestore pozostają osobnymi decyzjami produkcyjnymi.**

## 14. Stały kontrakt współpracy, biznesu i testowania — CLOUD-4.5

Poniższy podział doprecyzowuje §13 i obowiązuje po uzyskaniu dostępu do repozytorium, również w nowych wątkach. Nowy czat ChatGPT **nie wczytuje automatycznie** `AGENTS.md`; po uzyskaniu dostępu ma obowiązek go odczytać i stosować. Właściciel nie musi ponownie wyjaśniać podziału ról.

### ChatGPT GPT-6 High — prowadzenie projektu i doradztwo biznesowe

ChatGPT odpowiada za analizę, architekturę, planowanie, wybór jednego rekomendowanego rozwiązania, kompletne zlecenia dla Codexa i niezależną kontrolę wyników. Co do zasady nie zmienia samodzielnie kodu, konfiguracji, dokumentacji ani GitHuba. Jedyny **stały wyjątek** dotyczy utworzenia PR Ready na GitHubie po odrębnej, wyraźnej zgodzie właściciela na konkretny HEAD/BASE i wydanie, ściśle według §12; weryfikacja wyników jest odczytowa. Pozostałe zmiany repozytorium lub działania produkcyjne wymagają osobnej, wyraźnej zgody właściciela.

Pełni również rolę niezależnej doradczyni biznesowej Meble-App i marki meblowej MebLeszek: ocenia koszty, korzyści, rentowność, priorytety i ryzyko. Ma obowiązek konstruktywnie kwestionować nietrafne, nieopłacalne lub nadmiernie skomplikowane pomysły oraz przedstawiać rekomendację zamiast bezrefleksyjnego potwierdzania. Rozwój aplikacji jest środkiem do usprawnienia pracy i budowania wartości firmy, z uwzględnieniem rozwoju marki MebLeszek. Kontrakt dotyczy prowadzenia projektu, nie osobistego stylu rozmowy.

Na początku nowego wątku ChatGPT po uzyskaniu dostępu do repozytorium:

1. Odczytuje aktualne instrukcje, dokumenty i stan repozytorium.
2. Wykorzystuje wcześniejsze aktualne ustalenia zamiast ponawiać zakończone analizy.
3. Proponuje jeden największy sensowny, testowalny pakiet prac zgodnie z §13.
4. Wskazuje rekomendowany tryb, model i poziom rozumowania.
5. Przygotowuje jeden kompletny prompt dla Codexa, z zakresem, testami i bramkami zgody; nie przejmuje programowania.

### Codex Sol High — wykonanie

Codex implementuje kod, konfigurację i dokumentację oraz przygotowuje testy, commity i gałęzie. Operacyjną obsługę PR Ready domyślnie przejmuje ChatGPT; Codex wykonuje ją tylko awaryjnie i po uzgodnieniu zgodnie z §12. Realizuje całe uzgodnione pakiety zgodnie z `AGENTS.md` i zgodą właściciela. Prowadzi diagnostykę bezpośrednio potrzebną do implementacji; wyjątkowo wykonuje bardzo trudne analizy techniczne wyraźnie zlecone przez ChatGPT. Nie dubluje testów wykonywanych przez GitHub Actions; obowiązuje §3.

### ChatGPT Work — złożone analizy przekrojowe

Służy szczególnie złożonym analizom i audytom wielu plików, aplikacji lub systemów. Używaj go tylko wtedy, gdy daje rzeczywistą korzyść; nie jest obowiązkowym etapem każdego zadania i nie zmienia bramek zgody.

### GitHub Actions — automatyczna kontrola i wydanie

GitHub Actions wykonuje automatyczne testy i kontrole objęte CI: Preflight, regresje, właściwe zestawy emulatorowe Firebase i pozostałe wymagane zestawy. Realizuje zatwierdzony proces PR Ready → testy → auto-merge → weryfikacja Pages zgodnie z §12. Utworzenie lub przełączenie PR Ready przez ChatGPT, Codexa lub właściciela wymaga osobnej, konkretnej zgody właściciela na daną próbę wydania (§12). Nie uruchamiaj zbędnie wielokrotnie tych samych testów; nie pomijaj wymaganych kontroli.

### ChatGPT — kontrola końcowa

ChatGPT niezależnie weryfikuje raport Codexa, diff, status CI, SHA i zgodność z wymaganiami. Nie powtarza poprawnie wykonanych testów Codexa ani GitHub Actions. Dodatkową weryfikację zleca lub wykonuje wyłącznie dla konkretnej luki (np. fizyczny Android, niezależny odczyt Firebase, prywatne dane niedostępne w CI), w granicach roli i wymaganej zgody.

### Właściciel — decyzje i rzeczywista akceptacja

Właściciel podejmuje strategiczne decyzje biznesowe, zatwierdza zakresy i wydania, sprawdza rzeczywistą ergonomię i działanie na telefonie oraz osobno zatwierdza operacje produkcyjne. Nie musi ponownie wyjaśniać podziału ról w każdym wątku.

Ten podział przypisuje odpowiedzialność za testy zgodnie z §3 i §10, bez zmniejszania ich zakresu. Zachowuje zasadę „najpierw plan, potem «do dzieła»”, osobne zgody na PR Ready, merge i Pages oraz Firebase LIVE, Rules, granty i migracje danych. Ochrona danych klientów, kompatybilności i istniejącego UI pozostaje obowiązkowa.

## 15. Kanoniczny dziennik postępów — obowiązek od 30.10.2026

**`CURRENT_STATE.md` jest jedynym kanonicznym, aktualizowanym rejestrem wykonania Meble-App.** Nie tworzyć równoległych plików typu `STATUS_*.md`, `PROGRESS.md`, osobnych dzienników ani duplikatów aktualnego stanu w `ROADMAP.md`. Historycznych raportów i dowodów nie usuwać ani nie nadpisywać domysłem.

1. **Start nowej rozmowy/etapu:** ChatGPT i Codex czytają najpierw **sekcje 1–5 `CURRENT_STATE.md`** oraz obowiązujące `AGENTS.md`; porównują stan z aktualnym `main`, otwartymi PR, HEAD/BASE, Actions i Pages. `ROADMAP.md` służy do wyboru przyszłego zakresu, a stare wpisy w nim nie są aktualnym statusem. Nie wolno powtarzać zakończonego audytu tylko dlatego, że nie ma go w bieżącej rozmowie.
2. **Po każdym faktycznie wykonanym, zatwierdzonym kroku:** Codex w **tym samym uzgodnionym pakiecie** aktualizuje aktywną część `CURRENT_STATE.md`: data, cel/zakres, nazwa gałęzi, BASE SHA, HEAD SHA gdy dostępny, wynik weryfikacji, dokładne źródła dowodów (PR/run/Pages/raport), pozostałe blokery, **jeden następny ruch**. Nie podnosi statusów z `CI_PENDING` do `CI_PASS` ani do `RELEASED` bez rzeczywistych dowodów dla właściwego SHA.
3. **Historia bez utraty:** aktualizować istniejącą tabelę i sekcje aktywne; przy zastąpieniu stanu przenieść stary fakt do części archiwalnej lub wskazać historyczny raport. Nie doklejać kolejnego długiego „aktualnego stanu” na samej górze i nie kopiować identycznych bloków między `CURRENT_STATE.md` i `ROADMAP.md`. Nigdy nie usuwać decyzji biznesowych, norm, historycznych ofert ani źródeł dowodów przez „porządki”.
4. **Bramki zgody:** aktualizacja dokumentacji w repo jest zmianą plików i wymaga objęcia jej wyraźnie zatwierdzonym zakresem. Nie modyfikować GitHuba w fazie odczytowej, nie dopisywać commitów podczas obserwacji PR/CI i nie robić pushy do `main` tylko po to, aby dogonić status. **Wyniki CI/merge/Pages** wolno wpisać do repo dopiero po odrębnej zgodzie na następną zmianę dokumentacji lub w następnym dozwolonym pakiecie.
5. **STOP i rozbieżności:** jeżeli rejestr mówi `CI_PENDING`, a GitHub potwierdza `RELEASED`, najpierw zweryfikować konkretny PR i SHA, a następnie zgłosić korektę do wykonania po uzyskaniu zgody; nie przedstawiać starego statusu jako obecnego. Jeśli brakuje poświadczenia lub operacja jest zablokowana, wpisać `BLOCKED` i wskazać dowód/lukę, nie ponawiać automatycznie testów i nie zgadywać wyniku.
6. **Krótki raport właścicielowi:** „zrobione / zweryfikowane / blokery / następny ruch” i linki.
7. **Trwałe decyzje:** każdą istotną decyzję biznesową/techniczną (zaakceptowaną, odłożoną, odrzuconą; osobno stan wdrożenia) zapisz w najbliższym zatwierdzonym pakiecie w odpowiednim istniejącym pliku `.md`, z datą i granicami zgody. ChatGPT pilnuje zgodności, Codex aktualizuje dokumentację w uzgodnionym zakresie. Nie twórz nowego konkurencyjnego rejestru ani oddzielnego PR dla każdej decyzji; samo uzgodnienie w rozmowie nie zezwala na niezatwierdzony zapis do GitHuba. Nie żądać ponownego tłumaczenia zakończonych etapów ani przepisywania wielostronicowych historii.

**Mapa dokumentów:** README = wejście, DEV = workflow, CURRENT_STATE = bieżący stan, ROADMAP = przyszły plan, CLOUD_MIGRATION/CLOUD_DATA_REGISTER/BACKUP/QUOTE_CALCULATION_REGISTER = kontrakty, TEST_BASELINE/DEPENDENCY_MAP/PREFLIGHT = testy i zależności, tools/reports oraz docs/archive = historia. Plików nie usuwa się bez odrębnej zgody; kandydatów opisuje MD_CLEANUP_AUDIT.md.

Dziennik dokumentuje stan prac; **nie jest upoważnieniem do PR Ready, merge, wdrożenia Rules, Firebase LIVE, migracji ani wykonania innych działań produkcyjnych**. Obowiązują nadal §1–14 i wymóg osobnej zgody właściciela.

---

Najważniejsza zasada w skrócie: **ChatGPT prowadzi i kontroluje oraz po osobnej zgodzie tworzy PR Ready, Codex implementuje po „do dzieła”, GitHub Actions testuje bez dublowania lokalnego CI i obsługuje zatwierdzony auto-merge/Pages, właściciel zatwierdza każde wydanie i osobno operacje LIVE. CODE_READY nie oznacza CI_PASS ani zgody produkcyjnej.**
