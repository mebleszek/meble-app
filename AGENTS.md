# AGENTS.md — zasady pracy nad Meble-App

Obowiązuje także w nowych wątkach. AGENTS i procedury tworzą jeden kontrakt bez nowych zgód; sprzeczność: dowody i decyzja właściciela. Start: AGENTS i [CURRENT_STATE](CURRENT_STATE.md) 1–5; szczegóły przed właściwą czynnością:

- [TESTING](docs/agents/TESTING.md): testy, FAIL, raport/statusy (§3, §9–10).
- [RELEASE](docs/agents/RELEASE.md): wydanie, aktualizacja i przekazanie (§12, §16, §20).
- [COLLABORATION](docs/agents/COLLABORATION.md): role, ciągłość i dziennik (§13–15, §18–19).
- [PRICING](docs/agents/PRICING.md): zmiany kosztu/czasu/ilości/cennika (§4).

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

## 2. Minimalny, spójny zakres

ChatGPT raz analizuje rzeczywisty łańcuch UI → wywołania → domena/modele/ID → odczyt/zapis/recovery/backupy → wyceny/oferty/sync/skutki uboczne. Codex korzysta z ustaleń i czyta kod potrzebny implementacji; pogłębia analizę tylko dla konkretnej sprzeczności/ryzyka. Rozróżniaj aktualny model od historycznych wyjątków; rekomenduj na podstawie faktów.

Preferuj odwracalne zmiany, bez pobocznego refaktoru, przepisywania za rozmiar, zmiany stylu/nazw/formatowania/architektury niezwiązanych modułów lub utraty zgodności starych projektów/ofert/ustawień bez zgody. Wybieraj największy spójny, bezpieczny i testowalny pakiet według zależności/ryzyka/bramek, bez limitu liczby punktów i zbędnych mikroetapów.

Niezbędny powiązany błąd naprawiaj przyczynowo w zakresie zgody. Niezwiązany zgłoś, kontynuuj niezależne bezpieczne części. Ryzyko danych/bezpieczeństwa = STOP zagrożonej operacji. Nie rozszerzaj zgody na UI, migrację, produkcję czy ryzykowny refaktor.

## 3. Testy są bramką bezpieczeństwa

Pełny Preflight, regresje i Firebase Emulator Suite wykonuje GitHub Actions. Codex przygotowuje kod/testy i wykonuje tylko niezbędną diagnostykę, celowaną reprodukcję/kontrolę diffu; nie dubluje pełnych zestawów przed/po CI. ChatGPT kontroluje dowody.

Przy każdej zmianie aplikacji przejrzyj powiązane testy, dostosuj nieaktualne asercje wyłącznie do zatwierdzonego kontraktu/nazw/zależności/list serwerów/wersji i dodaj uzgodnione przypadki. Sprawdź rzeczywiste pokrycie CI dla bieżącego SHA, także regresji wysokiego ryzyka. Zachowaj zabezpieczenia, negatywy i brzegi; bez osłabiania asercji, pomijania scenariuszy, maskowania błędów lub zmiany biznesu dla PASS.

FAIL = STOP na pierwszym etapie, diagnoza kod/test/konfiguracja/założenie, naprawa w zakresie zgody; retry wydaniowego CI według §12. Brak kontroli = luka/przyczyna/wykonawca/metoda i `CI_PENDING`, nigdy pozorny PASS. Obowiązujące szczegóły: [TESTING.md](docs/agents/TESTING.md).

## 4. Logika biznesowa i cenniki

Nie zgaduj reguł stolarni: WYCENY, materiałów, robocizny, okuć, transportu, kosztów, ofert i snapshotów. Niejednoznaczna reguła w kodzie/testach/dokumentacji wymaga decyzji użytkownika. WYCENA, CZYNNOŚCI i HARMONOGRAM używają wspólnego kalkulatora i jawnych, edytowalnych reguł cennika; bez ukrytych stawek, czasów czy niezależnych kopii. Oferty są zamrożone, indywidualne reguły bez nadpisania w tle. Pełny kontrakt 08.11.2026 i kontrole: [PRICING.md](docs/agents/PRICING.md).

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

## 7. Źródła kontekstu

Czytaj potrzebne części CURRENT_STATE/ROADMAP/CLOUD_MIGRATION/TEST_BASELINE/DEPENDENCY_MAP, kodu i testów. Dla chmury: [zatwierdzona architektura](tools/reports/cloud-2a-firebase-google-architecture.md) (Spark/Google Sign-In, proponowane niewdrożone Rules, rewizje/CLOUD-2B) razem z CLOUD_DATA_REGISTER.

README/DEV mogą być historyczne. Sprzeczność: kod/testy → CURRENT_STATE/decyzje → pytanie przy niejasności, bez zgadywania. [mapa dokumentów](docs/agents/COLLABORATION.md#mapa-dokumentów).

## 8. Zmiany danych i kompatybilność

Przy zmianie schematu danych lub sposobu zapisu:

- ustal, jak zachowają się istniejące projekty użytkownika,
- zachowaj bezpieczne wartości domyślne,
- nie usuwaj nieznanych pól bez potrzeby,
- unikaj migracji destrukcyjnych,
- jeżeli potrzebna jest migracja, przygotuj ją jako osobne zadanie z planem cofnięcia.

**Rozróżnienie danych (decyzja właściciela 31.10.2026):** obecni inwestorzy i projekty są testowe; nie buduj rozległej kompatybilności historycznych schematów wyłącznie dla nich, ale nigdy nie kasuj ich, ofert, draftów ani powiązanych magazynów automatycznie bez zgody na dokładny zakres. Cenniki, stawki, katalogi materiałów/okuć/dostawców, zamienniki, słowniki, ustawienia, konfiguracje i magazyn to dane globalne chronione bezwzględnie — ich kompatybilność i nienaruszalność są obowiązkowe.

**Przed destrukcyjną migracją** wymagaj domyślnie niezależnie zweryfikowanej kopii i planu cofnięcia. Właściciel może osobno, świadomie dopuścić utratę dokładnie wskazanych danych testowych bez tworzenia kopii. Wyjątek nie dotyczy danych globalnych, cudzych rekordów ani innych nieobjętych zgodą danych. Sama etykieta „testowe” nie jest zgodą na reset. Przejście na prawdziwe dane klientów wymaga pełniejszej ochrony przed kolejnymi zmianami.

**Decyzja 02.11.2026:** oryginalne cenniki są niezmodyfikowane i mają pozostać nietknięte; chroń także RAW/IndexedDB, kolejkę offline i źródła przed utratą/nadpisaniem.

## 9. Raport po zadaniu

Raport: zmiany/pliki, obszary nietknięte, kontrole/wykonawca/SHA/linki, HEAD/BASE, braki, ryzyka, następny ruch; osobno implementacja/CI/wydanie/LIVE, bez obcego PASS (§10). [Szczegóły raportu](docs/agents/TESTING.md) i [szablon przekazania](docs/agents/RELEASE.md).

## 10. Definition of Done i statusy

`CODE_READY`: uzgodniony zakres bez zmian pobocznych; dane/kompatybilność lub uzgodniona migracja zachowane; regresje przygotowane, diff sprawdzony, weryfikacja przypisana, braki ujawnione. Nie potwierdza jakości/produkcji.

- `CI_PENDING`: wymagane testy niewykonane/niedokończone, wskazane zestawy; może współistnieć z CODE_READY.
- `CI_PASS`: wszystkie wymagane testy PASS dla SHA/zakresu z linkiem, HEAD/BASE i dowodami spoza CI. FAIL/BLOCKED/brak testu wyklucza PASS.
- `RELEASED`: zatwierdzony merge (§12) i exact Pages; telefon osobno.
- `LIVE_BLOCKED` / `LIVE_APPROVED`: domyślnie blokada, osobna wyraźna zgoda na konkretną operację/zakres/artefakt/warunki i spełnione bramki.

CI_PASS nie zezwala na wydanie, RELEASED nie zezwala na LIVE/Rules/granty/billing/migrację. Zgoda przygotowawcza nie jest wykonawczą; LIVE_APPROVED nie uruchamia operacji ani nie znosi blokad. Zmiana SHA nie dziedziczy PASS. [Pełne warunki i tabela](docs/agents/TESTING.md).

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

## 12. PR, CI i scalanie — 15 i 21.10.2026

„Do dzieła” nie zezwala na Ready/CI/auto-merge/publikację. Bez osobnej zgody wydaniowej pozostań na gałęzi; Draft tylko potrzebny i chciany, nie domyślnie. Po zgodzie na repo/gałąź/dokładne HEAD/BASE/zakres ChatGPT odczytowo weryfikuje SHA/diff/pokrycie/brak PR, tworzy jeden Ready (istniejący Draft przełącza) i wyłącznie obserwuje CI/auto-merge/Pages. Bez zmian plików/commitów/gałęzi/testów/workflow, ręcznego merge, retry i Firebase LIVE. Zastępstwo Codexa/właściciela wymaga uzgodnienia i tej samej osobnej zgody.

Jedno pełne CI na próbę: `opened` niedraftowego PR albo `ready_for_review`. Draft/`synchronize`/push/merge nie ponawiają pełnego Preflightu; izolowane workflow mają jawne gałęzie. `workflow_dispatch` nie obchodzi zgody. Auto-merge tylko po pełnym PASS i przy zgodnych zatwierdzonych HEAD/BASE; FAIL/zmiana gałęzi/Draft go blokują. Pages dla dokładnego merge SHA. Zmiana HEAD/BASE, retry po FAIL i nowa próba wymagają nowej zgody; bez ukrytego retry.

Przed propozycją/obsługą Ready/merge czytaj [RELEASE.md](docs/agents/RELEASE.md), aktualne AGENTS/CURRENT_STATE, decyzje i [rzeczywisty workflow](.github/workflows/preflight-js.yml). Dawny obowiązkowy Draft nie obowiązuje.

## 13. Spójne pakiety i nietykalność UI/UX — decyzje 17 i 31.10, 07.11.2026

Jeden wykonawca realizuje jeden spójny pakiet do wyniku lub obiektywnego blokera; bez równoległych zmian tego samego pliku i konkurencyjnych źródeł prawdy. Dobieraj największy bezpieczny, testowalny zakres (§2), bez mikroetapów i ponawiania zgód w jego granicach. Nie skracaj testów, ochrony danych ani bramek.

**UI/UX:** bez wcześniejszej konkretnej zgody nie dodawaj, nie usuwaj, nie ukrywaj, nie przenoś ani nie przemianowuj przycisków, pól, etykiet, modali, akordeonów, układu, wyglądu, nawigacji i zachowania interakcji. Zgoda na element nie obejmuje zakładki; zmiana logiki nie upoważnia do ulepszania UI. Jedyny wyjątek naprawczy B: niezbędne przywrócenie jednoznacznie wcześniej zaakceptowanego zachowania w zatwierdzonej naprawie, bez nowych funkcji, kroków, wyglądu czy własnych ulepszeń ergonomii. Niejednoznaczność = STOP i decyzja właściciela.

Przy zatwierdzonej zmianie UI kopiuj cały odpowiedni wzorzec z **trybik → Wzorce UI** ([dev_ui_patterns.html](dev_ui_patterns.html)): wygląd, strukturę, klasy, stany i zachowanie, bez lokalnych wariantów. Brak wzorca = najpierw decyzja właściciela; zatwierdzony nowy element dodaj też do galerii. Wzorzec nie rozszerza zgody.

Zachowuj `Zapisz/Anuluj`, jeden autorytet projektu, LOCAL-FIRST, globalne katalogi/cenniki/magazyn/oferty i docelowy brak ręcznych operacji synchronizacji. Test syntetyczny nie zastępuje zatwierdzenia prawdziwych danych; Chromium nie zastępuje telefonu. Szczegóły prowadzenia i komunikacji: [COLLABORATION.md](docs/agents/COLLABORATION.md).

## 14. Podział odpowiedzialności — CLOUD-4.5

- **ChatGPT GPT-6 High:** prowadzenie, analiza/architektura, jedna rekomendacja i doradztwo biznesowe Meble-App/MebLeszek, kompletne zlecenie, niezależna kontrola raportu/diffu/SHA/CI. Standardowo bez zmian repo/GitHuba/programowania; wyjątek Ready (§12), inne zmiany tylko po odrębnej wyraźnej zgodzie (§16).
- **Codex Sol High:** implementacja kodu/konfiguracji/dokumentacji/testów, potrzebna diagnostyka, gałąź/commit/push; trudna analiza tylko wyraźnie zlecona, PR jako uzgodnione zastępstwo. Bez dublowania CI.
- **ChatGPT Work:** szczególnie złożone analizy przekrojowe przy rzeczywistej korzyści, bez zmiany zgód.
- **GitHub Actions:** wymagane testy, zatwierdzony auto-merge i exact Pages.
- **Właściciel:** strategia/biznes, zakres, każde wydanie, osobne operacje produkcyjne, akceptacja telefonu; bez wyboru każdej technicznej nazwy.

ChatGPT nie powtarza zaliczonych testów; dodatkowa kontrola tylko dla konkretnej luki w granicach roli/zgody. Nowy czat musi odczytać instrukcje po uzyskaniu dostępu; właściciel nie wyjaśnia ich ponownie. [Pełne obowiązki](docs/agents/COLLABORATION.md).

## 15. Kanoniczny dziennik — od 30.10.2026

[CURRENT_STATE](CURRENT_STATE.md) to jedyny aktualny rejestr wykonania; bez STATUS/PROGRESS/duplikatów w ROADMAP. Po zatwierdzonym faktycznym kroku aktualizuj w tym pakiecie: datę, zakres, gałąź, BASE/HEAD gdy znany, wyniki/linki/SHA, blokery, następny ruch. Zastąpioną historię archiwizuj w pełni, z decyzjami/normami/ofertami/dowodami; bez doklejania długich stanów.

Dokumentacja wymaga zgody na zakres. Bez zmian GitHuba/commitów/pushy do main podczas odczytu/obserwacji CI. Późniejsze CI/merge/Pages zapisuj w kolejnym osobno zatwierdzonym/dozwolonym pakiecie. Rozbieżność zweryfikuj i skoryguj po zgodzie, bez zgadywania statusu. Trwałe decyzje: data, zgoda i stan wdrożenia w istniejącym MD, bez konkurencyjnych rejestrów/PR na każdą decyzję. [Procedura i mapa](docs/agents/COLLABORATION.md).

## 16. Aktualizacja klienta, rozrost i CI — 31.10.2026

Wydanie obejmuje spójne `?v=`, manifest/integralność i bezpieczną aktualizację starego SW z „Dostępna nowa wersja — odśwież”. Bez reloadu niezapisanej edycji/niepotwierdzonego offline, czyszczenia danych i ukrytych migracji. Sam cache-busting nie spełnia kontraktu. Wymagana regresja Chromium: ten sam profil, stary worker+dane → deploy → wykrycie → bezpieczna aktualizacja → nowa funkcja+dane.

Progi modułów: 250+ ostrożność, 400+ analiza, 600+ uzasadnienie/ryzyko. Kontrola blokuje przyrost nowego modułu ponad 600 lub starego mieszanego 600+; nie mieszaj UI/storage/domeny/recovery/orkiestracji. Wyjątek = uprzednia osobna decyzja i regresje; nie refaktoruj za rozmiar, raportuj też testy.

CI: cel 90 s/grupę, ostrzeżenia po 75/90 s, bez FAIL/przerwania za sam czas. Niezależne długie testy równolegle; pełne rozłączne pokrycie, 425 pinów i historyczna immutability, bez retry/pominięć. Obowiązujące szczegóły grup, kosztów i aktualizacji: [RELEASE.md](docs/agents/RELEASE.md).

## 17. FREE-FIRST / PRODUCT-FIRST — 01.11.2026

Twardy cel: **0 zł obowiązkowych opłat**. Bez domyślnego płatnego VPS/hostingu/abonamentu/monitoringu/Blaze. Preferuj Pages, IndexedDB, Google Sign-In i bezpłatne limity Firebase; gdy limit/funkcja wymusza koszt, pokaż darmowy wariant i uzyskaj osobną wyraźną zgodę. Nie obiecuj nieograniczonych darmowych zasobów.

Cel: potwierdzona zmiana telefonu dostępna na komputerze i powrót bez ręcznego eksportu. Używaj wydanych LOCAL-FIRST/IDB/Auth/Firestore/testów bez nieuzasadnionej przebudowy. CLOUD-4.6G, płatny VPS, rozproszony STOP i rozbudowy syntetycznego pilota są wstrzymane/do ponownej oceny. STOP dotyczył eksperymentu, nie zwykłej pracy. Rozważ minimalny darmowy, mniej uprzywilejowany pilot i konieczne bramki; nie usuwaj zabezpieczeń w ciemno ani nie uznawaj modelu admina za bezpieczny bez dowodu.

Minima: wyłącznie właściciel, zachowane cenniki/zamienniki, bez nadpisywania offline, bezstratna zmiana autorytetu, brak ujawnienia. Priorytet nie zezwala na produkcyjne READ/WRITE, Rules/IAM/billing/migrację/PR/CI/wydanie. Jeden spójny testowalny pakiet, krótki raport; bez wymagania wiedzy admina/ręcznych komend właściciela.

## 18. Oszczędna praca i ciągłość — 02 i 09.11.2026

1. Wznów faktyczny stan: AGENTS, aktywne CURRENT_STATE 1–5, main/HEAD/BASE i właściwe PR/CI/Pages. GitHub rozstrzyga starą migawkę MD. Bez ponownego czytania archiwum i rekonstruowania znanych ustaleń.
2. Czytaj tylko potrzebne fragmenty kodu/dokumentów, po wyszukaniu zakresu. Nie powtarzaj audytu ChatGPT ani zakończonej analizy bez konkretnej sprzeczności/ryzyka. Ponowny odczyt tylko po zmianie lub konkretnej potrzebie, np. świeże SHA przekazania.
3. Logi filtruj od pierwszego błędu, etapu/SHA i istotnych dowodów; pełne tylko dla niewyjaśnionej przyczyny. Bez drukowania całych dokumentów/raportów.
4. Jeden wykonawca jednego spójnego pakietu. Drugi uzgodniony Codex dostaje krótki zakres/decyzje, diff i konkretną lukę, bez pełnej historii i ponawiania zadania; bez rozszerzenia roli/zgody.
5. Nowy wątek: zadanie, decyzje/zgody, gałąź, pełne HEAD/BASE, statusy, rzeczywiste wyniki/linki, blokery i jeden następny ruch. Szczegóły przez odnośniki, szablon w §20.
6. Codex: kontrole celowane; pełne CI: Actions. Raport oceniaj niezależnie i zlecaj następną konkretną dozwoloną czynność, nie kolejny plan/audyt. Brak dostępu ≠ FAIL ani wykonany Preflight.
7. Nie ponawiaj zgody na ten sam zakres/odczyt. Rozróżniaj plan, odczyt, implementację, wydanie HEAD/BASE i LIVE WRITE. Brak dostępu = `BLOCKED` i jedno praktyczne odblokowanie, bez obchodzenia zabezpieczeń.

Najpierw sprawdź istniejące metody; Firebase Codexa nie jest automatycznie narzędziem ChatGPT ani wymogiem produktu. Bez próśb o sekrety/tokeny/klucze. Dalej: [COLLABORATION.md](docs/agents/COLLABORATION.md).

## 19. Decyzje właściciela i priorytet produktu — 03.11.2026

Nowe zadanie/zakres/zabezpieczenie: dowód, wpływ, rekomendacja ChatGPT i decyzja właściciela. Luka nie musi blokować; STOP nie zezwala na naprawę poza zakresem. Niezbędne powiązane przyczyny obsługuj w zgodzie (§2), bez ponawiania zgód. Priorytet: działająca aplikacja, sync telefon–komputer, WYCENA/RYSUNKI; bez zbędnych modułów/pakietów/zabezpieczeń i osłabiania testów (§3).

## 20. Końcowe przekazanie — 03.11.2026

Po implementacji/kontrolach celowanych/dzienniku i raporcie: commit/push gałęzi, potwierdzenie CLEAN i świeżych zdalnych 40-znakowych HEAD/BASE main. Dla dokumentacji wystarcza kontrola diffu, bez testów aplikacji bez nowej przyczyny.

Obowiązkowy [szablon](docs/agents/RELEASE.md): repo/gałąź, HEAD/BASE, statusy, zmiany, faktyczne testy, ograniczenia, CLEAN/push. `CODE_READY / CI_PENDING / RELEASE_BLOCKED` = gotowość do kontroli, bez wydania. Niedokończone zadanie/FAIL wymaganych kontroli = `BLOCKED`, bez pozornej gotowości/CLEAN/push. Zmiana SHA wymaga nowego przekazania i zgody wydaniowej.

Codex domyślnie bez PR/Actions/merge/publikacji/Firebase LIVE; ChatGPT po niezależnej kontroli i osobnej zgodzie na SHA obsługuje jeden Ready i odczytowo obserwuje CI/auto-merge/Pages (§12).
