# CURRENT_STATE — aktualny stan Meble-App

## CLOUD-4.3b — Bramka 1 Rules PASS, baseline zatwierdzony tylko do PRZYGOTOWANIA (2026-10-20)

Właściciel wykonał dwa GET Firebase Rules (oba HTTP 200) i potwierdził 635 B UTF-8 / SHA-256 9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91 wraz z metadanymi. Osobnym, wyraźnym TAK zatwierdził ten baseline WYŁĄCZNIE do przygotowania Bramki 2. Historyczny przypięty rekord 4.3a jest niezmieniony; nowy rekord zgody i publiczny smoke wyraźnie oddzielają przygotowanie od wykonania. Historyczne baselineApprovedForGate2:false w nieaktywnym loaderze nadal blokuje LIVE; nie znosi to późniejszej zgody na samo przygotowanie.

Baza prac: CLOUD-4.3a 965544c861d203b372d179c3a3fcf2ac3106e950. Zweryfikowany main a1f334df824c10bb54384f7c00eb77b661f9d1b0 zawiera PR #70 (dokument odczytów), ale CLOUD-4.3/4.3a nie są w main. Żadnego wdrożenia Rules, grantu, produkcyjnego IO, migracji ani PR Ready. [Raport CLOUD-4.3b](tools/reports/cloud-4-3b-gate1-closure.md). Wpisy poniżej są historyczne.


## CLOUD-4.3a — historyczny baseline Rules, Bramka 1 nadal STOP

Baza gałęzi `cloud-4-3-live-readiness-refresh`: `2f2704a3239fc58fabf375dcab43edbd78680cfe`.
Właściciel dostarczył oryginalne źródło i metadane dwóch odczytów REST z 20.10.2026:
produkcja Auth-only to 635 B / SHA `9260ebcd…ffa91`, odrębne od template 755 B
`fd92cffa…10cd3` i minimalnych Rules `eaeb3e67…a2e92`. Nie pobierano produkcji ponownie.
Nowe kontrole sprawdzają pełną tożsamość release/rulesetu i bajty; zgodność nie
zalicza Bramki 1 ani nie zatwierdza baseline dla Bramki 2. Pełne źródło jest prywatne.
[Raport, migracja konsumentów i plan dokładnego rollbacku](tools/reports/cloud-4-3a-production-rules-baseline.md).

## CLOUD-4.3 — aktualizacja gotowości, bez aktywacji LIVE (2026-10-20)

Baza `44b5be9b1e05eded8243b9a617f976e44ad49c6f`; CLOUD-4.1/4.2 i późniejsze
naprawy są już w main. Starsze nagłówki poniżej zachowują historię, nie oznaczają
ponownego otwarcia tych etapów. Pakiet operatora pozostaje nieaktywny.
Przegląd 423 pierwotnych pinów: 35 zmian, 388 bez zmian, 2 nowe moduły; wszystkie
425 hashy były już zgodne z main. Nowy rejestr wiąże pochodzenie i ocenę kontraktów
z tą bazą, bez zmiany kodu aplikacji i Rules.
[Dowody, testy, pięć osobnych bramek i ograniczenia](tools/reports/cloud-4-3-live-readiness-refresh.md).
Gotowość kodu nie jest zgodą na produkcyjne odczyty, deploy, grant ani roundtrip.

## Rozmiar sesji i niepotwierdzony wskaźnik — pakiet po main `0cb7044`

Zweryfikowany main: `0cb7044e5feec71d462354efc501dc9e4278cdb6`; poprzednia
diagnostyka sesji jest już w tej bazie, jej nagłówki robocze poniżej są historią.
`fix/session-begin-storage-proof` odtwarza natywny QuotaExceededError dla
snapshotu całego magazynu i niezależny fałszywy latch po odmowie zbędnego
zapisu tego samego currentProjectId. Nowa sesja v4 zachowuje pełnego właściciela,
nie cudze projekty; potwierdzony wskaźnik nie wymaga ponownego zapisu.
Stare payloady/guardy i niepewne zapisy pozostają chronione; bez migracji,
czyszczenia, rollbacku ani gwarancji rozpoznania konkretnej przyczyny na Pixelu.
[Pomiary, reprodukcje i ograniczenia](tools/reports/session-storage-pressure-fix.md).
Regresje 13/17 → 17/17, natywna quota/Chromium 6/6, mobilne scenariusze
biznesowe 13/13 i diagnostyka 6/6 PASS. Auth 37/37 i main-login 36/36 PASS.
Końcowy PRE-FLIGHT PASS: 136/136 smoke, APP 110/110, składnia 579/579.
Bez PR, merge, Pages i Firebase LIVE.

## Diagnostyka zablokowanej sesji w aplikacji — bez wydania

Kontynuacja `fix/durable-session-recovery` po `47d20b0`, baza main nadal
`3332ac8e059a73430d3d40518caebb359a8728e8`. Właściciel zgłosił brak skutecznego
wyniku bookmarkletów na Pixelu; nie są już zalecaną ścieżką diagnostyki.
Przy błędach sesji dodano jawny przycisk **Diagnostyka sesji**, dostępny w tym
samym modalu. Raport anonimowy pojawia się na ekranie, na nieprzezroczystym
tle; kopiowanie jest opcjonalne. Istniejący gate Auth pozostaje obowiązkowy.
Kolektor jest wspólny dla aplikacji i wcześniejszych testów, bez drugiej kopii
reguł dowodu. Diagnostyka nie zapisuje danych, nie usuwa payloadu i nie
odblokowuje sesji. [Zakres, testy i instrukcja](tools/reports/initial-session-retry-recovery.md#diagnostyka-sesji-w-aplikacji--kontynuacja-po-47d20b0).
Na Pixelu funkcja będzie dostępna dopiero po osobno zatwierdzonym wydaniu.
Weryfikacja: kolektor 15/15, nowe regresje 6/6, mobilna diagnostyka 6/6,
dotychczasowe scenariusze mobilne 13/13 i granica logowania 36/36 PASS.
Końcowy PRE-FLIGHT PASS: 135/135 smoke, APP 110/110, składnia 577/577.
Bez PR, merge, Pages i Firebase LIVE.

## Ponawianie pierwszego zapisu sesji — gałąź robocza po PR #67

Zweryfikowany GitHub main: `3332ac8e059a73430d3d40518caebb359a8728e8`.
`fix/durable-session-recovery` naprawia odtworzoną pętlę po przejściowej awarii
pierwszego zabezpieczenia sesji: jawne działania ponawiają istniejący `begin()`
wyłącznie przy zachowanym pierwotnym dowodzie RAM i niezmienionym projekcie.
Nie potwierdzono tożsamości tego mechanizmu z incydentem Pixela; prawdziwe
konflikty i uszkodzone snapshoty pozostają zablokowane.
[Dowody, zakres, testy, ograniczenia Auth i plan bezstratnego odzyskiwania](tools/reports/initial-session-retry-recovery.md).
Bez wydania, usuwania sesji na ślepo, migracji danych i Firebase LIVE.

Uzupełnienie po `81d85fb`: pełny restart z istniejącym payloadem potwierdził,
że brak flagi RAM nie blokuje poprawnego trwałego dowodu. Utrata utrwalenia
nowej rewizji oraz rzeczywisty konflikt pozostają bezpiecznie zablokowane.
Dodano regresje i kontrakt diagnostyki Androida bez USB w powyższym raporcie;
bez nowej zmiany kodu produkcyjnego i bez gwarancji odblokowania Pixela.

Jednorazowa diagnostyka bez USB jest teraz przygotowana w
[tools/diagnostics](tools/diagnostics/README.md): bookmarklet z kontrolą istniejącego
Auth, wyłącznie odczytem danych aplikacji i anonimowym wynikiem w schowku.
Regresje 15/15, wykonanie adresu `javascript:` w mobilnym Chromium 7/7;
fizyczny Pixel nie został przetestowany. To obserwacja, nie mechanizm odblokowania.

## Wydajność WYCENY i odnowienie dostępu — pakiet roboczy po PR #66

Aktualna baza GitHub main `764d0852b7232b28e6920a36ca26d50ec5e1a3e3` zawiera PR #65 i #66;
starsze nagłówki przygotowania tych napraw poniżej pozostają historią.
Gałąź `fix/quote-performance-auth-renewal`: jedno obliczenie przy zmianie samej nazwy,
współdzielenie synchronicznych odczytów PCV z kontrolą niezmienności, obsługa nowego gestu
mobilnego oraz zachowanie odmowy gate przy wtórnym błędzie lazy loadera po wygaśnięciu.
9 szafek: mediana rzeczywistego przebiegu Chromium 36,045 → 3,192 s; 24/24 kalkulacje identyczne.
[Raport, ograniczenia pomiarów i blokada dwóch testów popup Auth](tools/reports/quote-performance-auth-renewal.md).
Bez PR/merge/Pages i LIVE; pełna gotowość wymaga usunięcia blokady środowiskowej Auth.


## Odzyskiwanie statusu i pełny cykl ofert — gałąź robocza po PR #65

GitHub potwierdził scalenie PR #65 do main `0ae7d1a24091d4a57460bacc9d30b9ea386f5b35`;
wcześniejszy opis przygotowania tej poprawki poniżej jest historyczny. Naprawy kontekstu pozostają.
Gałąź `fix/offer-status-recovery-lifecycle` usuwa potwierdzoną blokadę starej intencji `offerStatus`
przez zgodność dwóch opcjonalnych wartości domyślnych luster, bez usuwania zabezpieczeń.
Nie tworzy pustych intencji; przed zakończeniem ponownie potwierdza wszystkie cele i fizyczny pokój.
[Reprodukcje, pełny cykl ofert, wyniki i ograniczenia](tools/reports/offer-status-recovery-lifecycle.md).
To lokalnie testowany pakiet bez PR/merge/Pages, importu eksportu właściciela i Firebase LIVE.


## Spójność kontekstu po PR #64 — gałąź robocza

Baza main `431545d364b47ee4d0cf8efed7d9e478d43ebe8d`, gałąź `fix/project-context-coherence`.
Aktywny rekord i RAM zastępują heurystykę bogatszej kopii/override. Render i diagnostyka WYCENY
nie naprawiają trwałych danych; historyczne snapshoty nie są automatycznie przepinane.
Przebieg obliczenia jest związany z inwestorem, projektem, rewizją, zakresem i stanem sesji;
zmiana po await odrzuca wynik. Świeży błąd pozostaje widoczny w swoim kontekście.
[Zakres, dowody, wyniki i granice potwierdzenia incydentu](tools/reports/project-context-coherence-fix.md).
To przygotowanie gałęzi do osobnej decyzji o wydaniu, bez PR/merge/Pages i Firebase LIVE.
Starszy opis gałęzi PR #64 poniżej zachowano jako historię.

## Naprawa RAM/PCV i generowania WYCENY — gałąź po PR #63

Baza `4d8dd96df9f293276dee07dc0c4cedf26edac08c`, gałąź `fix/pcv-ram-quote-generate-android`.
Istniejące `window.projectData` jest aliasem globalnego wiązania `projectData`, więc zapis nie pozostawia starszego RAM dla PCV.
Opóźniony autosave nie zapisuje projektu w widokach obliczeń ROZRYS/WYCENA; odmowa nowej WYCENY pozostaje widoczna przy istniejącej historii.
Kontrole PCV, sesje, kanoniczny rekord i zamrożone oferty pozostają obowiązujące. CLOUD-4.2 nadal jest nieaktywnym przygotowaniem.
[Reprodukcje, zakres, testy i krótka akceptacja Androida](tools/reports/pcv-ram-quote-generate-android-fix.md).
To stan gałęzi roboczej, bez PR, wydaniowego CI, merge i Pages.

## Aktualizacja po PR #62 — CLOUD-4.1 scalone, CLOUD-4.2 w przygotowaniu

GitHub potwierdził merge PR #62 do main `d517d598917e5ccd6f1460950697c9ab27f1db1c`,
wydaniowe CI i Pages SUCCESS. CLOUD-4.1: 13/13 live-readiness, 10/10 prywatny pilot,
71/71 SDK, 3/3 startup, 38/38 Chromium, Preflight PASS, bez pominięć.
Starsze nagłówki o blokadzie poniżej są zapisem historycznym sprzed weryfikacji.
CLOUD-4.2 przygotowuje pakiet offline i próby emulatorowe przyszłego LIVE na osobnej
branży, bez produkcyjnych Rules, grantów, zapisów, odczytów ani zmiany UI/autorytetu.
[Artefakty, bramki zgody, procedura i statusy](tools/reports/cloud-4-2-live-pilot-preparation.md).
Aktualny wynik CLOUD-4.2 wymaga zakończonego CI tej gałęzi; nie jest odziedziczonym PASS.

## CLOUD-4.1 — gałąź robocza, weryfikacja emulatorowa zablokowana

Baza `62f80433c28cfd1ed0370618b58db8f4e88fad68` (CLOUD-4 w main). Gałąź `cloud-4-1-private-pilot-execution` przygotowuje prywatny, jednokrotny wykonawca i niezależny odczyt syntetycznego projektu. Operatorska kopia właściciela sesji powstaje tylko w RAM, z kontrolą SHA; produkcyjne `main-login.js`, index, UI, Auth/IndexedDB, modele i Rules pozostają bez zmian. Wykonawca odmawia LIVE przed inicjalizacją Auth i nie jest częścią startupu.

**Nie jest to zakończona weryfikacja ani zgoda na wydanie.** Preflight 125/125 smoke, 555/555 składni, APP 110/110 PASS; emulatorowy roundtrip i pełne Chromium wymagające emulatora nie wykonały się — pobranie oficjalnego JAR jest blokowane przez sieć środowiska (403). Nie przepisujemy historycznych wyników CLOUD-4 jako aktualnych. [Raport, dowody, blokada i procedura późniejszej aktywacji](tools/reports/cloud-4-1-private-pilot-execution.md). Nie wykonywano produkcyjnych operacji Firebase ani Ready/merge/Pages.

## CLOUD-4 — przygotowanie pilota, bez aktywacji LIVE

Baza **`0cafb432f18bcd052672aac020d36128155388a7` po PR #60**. Właściciel potwierdził: **PR #60 scalony, CI/Pages PASS, Android zaakceptowany**, cenniki/materiały/okucia zachowane. Pojedynczy pierwszy `AUTH_STARTUP_FAILED` nie ma potwierdzonej przyczyny; nie dodano retry ani przebudowy logowania.

Gałąź `cloud-4-live-pilot-readiness` przygotowuje niezarejestrowany, prywatny kontrakt przekazania istniejącej sesji/lease, izolowane natywne źródło syntetyczne CLOUD-1B, minimalne first-publication-only Rules z Auth-only i singletonem jednego UID oraz procedurę ograniczonego grantu. Testy dotyczą wyłącznie emulatorów i Chromium. Nie ma prywatnego call-site uruchamiającego LIVE w main-login, nowego UI, deployu Rules, grantu, uploadu, synchronizacji ani zmiany lokalnego autorytetu. Globalne dane CLOUD-3 pozostają poza pilotem.

Weryfikacja CLOUD-4: **Preflight 124/124 smoke, 552/552 syntax, APP 110/110 PASS; Emulator Suite 71/71 PASS; Chromium 28/28 PASS**, bez pominięć. Zachowano PCV/jeden zapas 10% i rozkrój 4/3/6. To testy lokalne gałęzi, nie nowe CI/Pages ani produkcyjny roundtrip.

[Raport CLOUD-4: dokładny Rules SHA, źródło, testy, budżet Spark, plan zapisu/odczytu i zatrzymania](tools/reports/cloud-4-live-pilot-readiness.md). Przed rzeczywistym uruchomieniem potrzebne są **cztery osobne zgody**: (1) Ready/auto-merge/Pages kodu, (2) deploy dokładnych Rules, (3) administracyjny grant syntetycznego scope, (4) pierwszy zapis i niezależny odczyt przez przejrzany prywatny launcher. Żadna zgoda nie obejmuje automatycznie kolejnej.

## CLOUD-3 — scalone PR #60, bez przełączenia autorytetu

Weryfikacja lokalna gałęzi: Preflight **123/123 smoke, 547/547 syntax, APP 110/110 PASS**; Emulator Suite **58/58 PASS**; Chromium **28/28 PASS**, kontrakty globalne **13/13 PASS**, bez pominięć. Zachowano PCV/jeden zapas 10% i 4/3/6 arkuszy. To wyniki lokalne, nie nowy CI/merge/Pages.

Baza `65085d18` po PR #59. **PR #59 scalony: CI PASS, auto-merge PASS, Pages PASS, Android zaakceptowany przez właściciela.** Główne Google Auth i produkcyjny profil Auth-only działają; nie wdrożono biznesowych Rules ani synchronizacji.

CLOUD-3 przygotował nieaktywne, niezarejestrowane kontrakty 14 domen globalnych, RAW capture bez normalizacji, rekordy immutable i grupowy manifest CAS, niezależny odczyt oraz prywatną granicę pożyczenia istniejącej sesji Firebase. Tylko emulatory i dane syntetyczne; brak zmian startupu, UI, lokalnych setterów, IndexedDB właściciela, katalogów użytkownika, ofert lub kalkulatorów. Globalne słoje/legacy overrides/drafty pozostają poza transferem. **Nie jest to uruchomiona synchronizacja między urządzeniami.** [Dokładny kontrakt, testy, koszty i brakujące zależności](tools/reports/cloud-3-global-data-foundation.md).


## CLOUD-2B.4a + techniczne CLOUD-2C — scalone PR #59, LIVE nadal nieaktywny

**Rozszerzenie pakietu zatwierdzone przez właściciela:** naprawiono wyścig dopuszczenia profilu przez transakcyjny rekord właściciela IndexedDB (`meble-access-profile-v1`, store `ownership`, klucz `owner`). Stan pending nie daje dostępu; poprawny v2 przechodzi bez przepisywania danych, nowe powiązanie v3 nie jest samodzielnym uprawnieniem. Usunięto produkcyjny przycisk/wyświetlanie UID, zachowując wewnętrzną autoryzację. Końcowa weryfikacja: Emulator Suite **41/41**, Chromium **28/28** (w tym 100 prób bez podwójnego dopuszczenia), profil **36/36**, pełny Preflight **PASS** (543/543 składnia, 122/122 smoke, APP 110/110), syntax/diff check PASS. Bez zgody na Ready/merge/Pages lub Firebase LIVE.

Baza: `6c5ca364` po PR #58 (obowiązujące AGENTS §13). **CLOUD-2B.3 jest scalone w PR #57 (`90bd5349`), CI i Pages PASS, Android zaakceptowany; produkcyjny profil Auth-only działa** — status potwierdzony przez właściciela. Starsze opisy „bez publikacji” / „deny-all całej bazy” dotyczą poprzednich etapów. Biznesowe Rules, grant uploadu, synchronizacja i chmurowy autorytet projektu nadal nie są wdrożone.

Ten pakiet przygotowuje niezarejestrowany adapter pożyczający istniejące App/Auth/Firestore oraz niezależny odczyt manifestu, rewizji i fragmentów do RAM z pełną walidacją CLOUD-1B. Zapis/odczyt sprawdzamy wyłącznie na syntetycznych danych i emulatorach. Adapter LIVE nie należy do manifestów; dotychczasowe `create({target:'live'})` nadal odmawia. Rozszerzenie zmienia wyłącznie kontrolę lokalnego profilu w istniejącym logowaniu i usuwa kontrolkę UID; nie zmienia Google Auth, danych biznesowych, Rules ani grantów. **To techniczne przygotowanie CLOUD-2C, nie produkcyjne zakończenie odczytu ani zgoda na upload.** [Kontrakt, testy i ograniczenia](tools/reports/cloud-2b4a-technical-2c.md).

## Historia przygotowania CLOUD-2B.3 — opis sprzed scalenia PR #57

Baza: main po PR #56. Użytkownik potwierdził istnienie dwóch administracyjnych dokumentów dostępu; nie tworzymy ich ponownie, produkcyjne Rules nadal deny-all. Gałąź `cloud-2b3-main-login` przygotowuje jeden ekran pod `index.html`, serwerową autoryzację oraz loader biznesu dopiero po zgodzie. Nie wdrożono Rules, synchronizacji ani zmian danych. **Właściciel zatwierdził dostęp do swojego istniejącego profilu.** Przygotowano jednorazowe dopuszczenie po świeżej autoryzacji serwerowej, potwierdzeniu zachowania kopii i świadomej zgodzie właściciela. Zapisuje dowód `meble_access_profile_v1` w wersji 2 oraz techniczną blokadę `meble_access_profile_pending_v1` do czasu potwierdzenia operacji, bez przepisywania `fc_*` lub aliasów. Niedokończona próba pozostaje zablokowana również po restarcie; stary dowód v1 wymaga ponownej zgody. Nowy pusty profil nadal wymaga potwierdzonego proofu. Publikacja i Rules pozostają osobno zatwierdzane; kopię trzeba wykonać przed publikacją, a akceptację Android — po uzgodnionym wdrożeniu. [Raport, ograniczenia, procedura Rules i rollback](tools/reports/cloud-2b3-main-login.md).

Data przeglądu danych i integracji: **2026-10-15**
Baza dokumentacji: **`98fffb87` — main po PR #49**; baza kodu przed CLOUD-1B: **`f3b6905e` — po PR #46**. Nie wykonywano ponownego audytu całej logiki biznesowej; niezwiązane rozdziały zachowują wcześniejszy kontekst.

## Po co jest ten plik

Ten dokument ma być krótką, aktualną odpowiedzią na pytanie: **„jak program działa dzisiaj i co jest już zrobione?”**. Nie zastępuje historii w `DEV.md` ani szczegółowych kontraktów w `CLOUD_MIGRATION.md`, `QUOTE_CALCULATION_REGISTER.md`, `BACKUP.md` i `DEPENDENCY_MAP.md`.

Przy kolejnych pracach najpierw czytać ten plik i `ROADMAP.md`. Historyczne wpisy w `README.md`/`DEV.md` traktować jako tło, a nie automatycznie jako listę rzeczy nadal do zrobienia.

---

## 1. Skala i architektura

Aplikacja przeglądarkowa bez frameworka/bundlera, moduły classic-script w `window.FC`, publikacja statyczna. Na bazie main po PR #46: **824 śledzone pliki**, **524 JS**, **261 Markdown**, **394 domenowe JS** w audycie zależności, **318** skryptów index.html i **346** dev_tests.html. CLOUD-1A dodaje jeden dokument rejestru; liczby odnoszą się do bazy.

Projekt jest jednym fizycznym rekordem `fc_projects_v1`, z investorId i wieloma pokojami w projectData. Lista pomieszczeń inwestora jest powiązaną projekcją. RAM to stan roboczy, nie drugie trwałe źródło prawdy. `derivedFacts` jest odtwarzalnym cachem usuwanym z kopii do zapisu.

## 2. Kontrola składni i zależności

Aktualny preflight obejmuje składnię wszystkich JS, load order, wszystkie `tools/*-smoke.js`, audyt zależności i storage. Ponowne uruchomienie dla CLOUD-1A: **PRE-FLIGHT PASS**, składnia **524/524**, load order **318**, smoke **118/118**, APP **110/110**, dependency/storage PASS. Szczegóły w [rejestrze](CLOUD_DATA_REGISTER.md#9-dowód-pokrycia-audytu-i-weryfikacja).

Wysokie ryzyko nadal dotyczy persistence/sesji, WYCENY/historii, katalogów i ROZRYSU; RYSUNEK pozostaje osobnym długiem, bez refaktoru w CLOUD-1A. `TEST_BASELINE.md` opisuje także dawną paczkę i nie zastępuje aktualnego wyniku preflightu.

## 3. Testy i ukończone fundamenty

Nie obowiązuje już stary baseline 66/76 z 10 FAIL. W main są pełny preflight i CI, zabezpieczenia C3.1 globalnych zapisów, pokojowa sesja/nawigacja C2.0b, bezdestrukcyjny odczyt wyjątków C2.1a, stabilne role/grupy formatek i geometria frontów, projektowe PCV oraz adaptery obliczeń i ochrona nowego kandydata oferty.

PR #40 uruchomił UI PCV; #43 automatyzował tryb projektu; #45 przywrócił wspólne Opcje; #46 naprawił fałszywy konflikt updatedAt po autosave. Są **scalone**, nie otwarte propozycje. Diagnostyka i symulowany DOM nie dowodzą ręcznej akceptacji na telefonie. Użytkownik obecnie ręcznie testuje Androida; tablet/komputer pozostają platformami docelowymi.

Regresje referencyjne: **16,440 → 17,122 → 18,834 mb**, fronty **5,010 → 5,511 mb**, jeden zapas PCV 10%, wielopomieszczeniowy rozkrój **4 / 3 / 6 arkuszy**. Historyczne oferty A/B/A+B zachowują własny zakres i zamrożone wyniki.

## 4. Dane i przygotowanie do chmury

Kanoniczna mapa: [CLOUD_DATA_REGISTER.md](CLOUD_DATA_REGISTER.md), zasady etapów: [CLOUD_MIGRATION.md](CLOUD_MIGRATION.md). Aktualny audyt to **339** referencji w **41** plikach: **204** test/tooling, **135** poza testami (32 pliki). Mapa obejmuje **46 stałych nazw + 3 dynamiczne rodziny**; to nie liczba wpisów w urządzeniu użytkownika.

- Zapis projektu: durable begin + saveConfirmed + read-back; active owner **projectId + roomId**. Zapis/rollback nie może cofać innego pokoju/projektu. Niepotwierdzona rewizja blokuje kolejne operacje, bez nadpisywania centralnego rekordu starym RAM.
- Nowy projekt od początku używa `projectData.meta.productionPcvMode='project'`; istniejący testowy przechodzi przy bezpiecznym otwarciu. Brak aktywacyjnego przycisku/dialogu i importu globalnych krawędzi. Decyzje PCV są w `projectData[roomId].production`, z niezależnymi rolami elementów/grup i setId.
- Słoje nadal globalne (`fc_material_part_options_v1`), a ROZRYS ma globalne enabled/exceptions. To decyzje produkcyjne z nierozstrzygniętą własnością, nie dowolnie usuwalny cache. Issue #47 dotyczy ich przyszłej przebudowy. `fc_rozrys_overrides_v1` ma dormant API, bez znalezionego aktualnego konsumenta.
- Globalne cenniki, katalogi, słowniki, stawki, magazyn i ustawienia są chronione, zgodne wstecz i **poza pilotem**. C3.1 nie daje automatycznie gwarancji confirmed write wszystkim pozostałym store.
- CLOUD-1A scalono w PR #48, CLOUD-1B scalono w PR #50 (pełne CI i Pages PASS). **Główne logowanie scalono i zaakceptowano w PR #57; synchronizacji NIE wdrożono. Adapter pilota z PR #52 nadal nie uruchamia transportu danych LIVE.** CLOUD-2A: użytkownik wybrał Firebase Spark oraz Google Sign-In, konfigurację konsoli potwierdzono 2026-10-16 (szczegóły poniżej). Pierwszy planowany CLOUD-2B pilot obejmuje tylko fikcyjnego inwestora i fizyczny projekt z pokojami/szafkami/PCV, bez danych globalnych i sekretów. [Projekt techniczny CLOUD-2A](tools/reports/cloud-2a-firebase-google-architecture.md).
- CLOUD-1B działa już w `main` jako **wewnętrzny builder RAM**, bez downloadu/uploadu, UI i chmury. Stosuje RAW, zakończoną sesję, SHA-256, limit tylko pilota 800 KiB i kontrolowane syntetyczne dane. Natywne podpisy frontów są walidowane, nie poświadczane kryptograficznie. [Kontrakt](tools/reports/cloud-1b-selective-project-export.md).
- Obecny pełny backup fc_* nie jest pilot payloadem: może zawierać ORS apiKey profilu firmy i pomija nieprefiksowane aliasy katalogów. Bez zmian mechanizmu/retencji; rozdzielenie i filtrowanie eksportu wymaga kolejnego zakresu.

**ZATWIERDZONE 2026-10-15, JESZCZE NIEWDROŻONE:** docelowo chmura jest autorytetem trwałych danych; urządzenia automatycznie otrzymują aktualny stan, zatwierdzone zmiany synchronizują się bez ręcznych operacji i bez zmiany UI. `Zapisz/Anuluj` i izolacja sesji pozostają. Wybrano Firebase Spark / Cloud Firestore oraz uwierzytelnianie Google; identyfikacja po Firebase UID. **Region i działający produkcyjny Auth-only potwierdzono; login/Pages i Android zaakceptowano po PR #57. Biznesowe Rules i model rewizji nadal sprawdzane są wyłącznie na emulatorach.** Przełączenie domen wymaga osobnej zgody, ochrony konfliktów i globalnych danych. Cel: 0 zł stałych opłat, bez podpinania billingu. [CLOUD-2A](tools/reports/cloud-2a-firebase-google-architecture.md).

Cztery zatwierdzone ograniczenia **tylko pierwszego testu CLOUD-1B**: odmowa nieobsługiwanych istotnych struktur bez cichej utraty, syntetyczny I/P bez niekontrolowanych notatek, jawny aktywny I/P po zakończonej sesji i potwierdzonym zapisie, 800 KiB bez obcinania. Nie są limitami docelowego produktu. Pełny aktualny kontrakt, wymagania bezpieczeństwa oraz propozycja wpisu do `PROJECT_DECISIONS.md` są w [CLOUD_MIGRATION.md](CLOUD_MIGRATION.md). Sam pilotaż nie kończy migracji; obowiązkowe dalsze cele po CLOUD-2C opisuje [ROADMAP.md](ROADMAP.md). `PROJECT_DECISIONS.md` nadal jest na osobnej gałęzi PR #41; nie zmieniono jej i nie utworzono konkurencyjnego rejestru.

---

## Historia CLOUD-2B — PR #52, bez biznesowego połączenia produkcyjnego

2026-10-16, baza `5a63cda6`: użytkownik potwierdził Firebase `mebleszek-meble-app`, Spark bez billingu, Google Auth, authorized domain `mebleszek.github.io`, Firestore Standard `(default)` w `europe-central2`, pusta baza i opublikowane deny-all Rules. Nie łączono się z rzeczywistą bazą ani nie zmieniano jej reguł.

PR #52 dodał nieaktywny, jawnie emulatorowy adapter Firebase Web SDK, UID/Google Auth, niezmienne fragmenty i transakcyjny manifest oparte wyłącznie na CLOUD-1B. Rejestracja skryptów nie pobiera SDK, nie loguje i nie wysyła danych. Transport live jest odrzucany. Lokalny projekt pozostaje autorytetem; UI, sesje i kalkulatory bez zmian. Zestaw realnego SDK/Auth/Firestore Emulator Suite jest oddzielny od zwykłego preflightu: **17/17 PASS**; preflight tej gałęzi: **120/120 smoke, 531/531 syntax, APP 110/110, load order 323, dependency/storage PASS**. Zachowano referencje PCV i 4/3/6 arkuszy. Scalenie kodu nie oznacza wdrożenia Rules ani połączenia aplikacji z rzeczywistą bazą. [Raport, ograniczenia Rules, zależności i warunki pierwszego zapisu](tools/reports/cloud-2b-firebase-pilot.md).

## Historia CLOUD-2B.1 — dawny kontrolowany test logowania

CLOUD-2B jest już scalony w PR #52 (main `96f43f04`); emulatorowy adapter nie jest połączeniem z produkcyjną bazą. Ta gałąź dodaje odseparowany **`auth-test.html`** i Auth-only SDK, domyślnie bez konfiguracji. Normalny `index.html` i start biznesowy pozostają bez Auth. SDK odtwarza sesję, ale brak weryfikatora serwerowego oznacza stan zalogowany/niezatwierdzony i brak ładowania biznesu. Przygotowano revocable gate; nie aktywowano obowiązkowego logowania. Produkcyjne Rules nadal deny-all; bez uploadu/synchronizacji. [Raport, instrukcja konfiguracji, testy i blokery](tools/reports/cloud-2b1-google-login.md). Pełny popup blokuje obecnie sieć Codexa (`apis.google.com`, 403); nie jest to test PASS ani akceptacja Androida.

**Uzupełnienie CLOUD-2B.1a, gałąź `cloud-2b1a-live-auth-config`, baza main `bf81b14c` po PR #53:** powyższy opis pustej konfiguracji i blokady sieci dotyczy poprzedniego etapu. Na tej gałęzi wyłącznie `auth-test.html` otrzymuje publiczny config użytkownika z `target:'live-auth'`. Strona inicjuje prawdziwe Firebase Auth; nie inicjuje Firestore i nie przyznaje dostępu biznesowego. `index.html` pozostaje bez zmian. Nie wykonano scalenia ani publikacji tej konfiguracji. [Instrukcja Androida, aktualne wyniki i wyłączenie testu](tools/reports/cloud-2b1a-live-auth-config.md).

## Historia CLOUD-2B.2 — przed wdrożeniem głównej bramki

Gałąź `cloud-2b2-single-user-access`, baza main `9d87b393` po PR #55: wcześniejsze config live i oryginalne logo są już scalone. Ta gałąź podłącza do strony testowej tylko własny dokument kontrolny Firestore, chroniony administracyjnym `appEnabled` w `/authorizedUsers/{uid}` i Google UID. Lista/granty pozostają nieczytelne i niezmienialne dla klienta. Proof wymaga świeżego odczytu transakcyjnego bez zapisów, wygasa po 45 s i jest sprawdzany co 30 s. Powstał osobny, emulatorowo testowany profil Auth-only Rules; **nie wdrożono go ani nie utworzono rzeczywistych grantów**. Produkcyjne Rules nadal deny-all. `index.html`, lokalne dane i Zapisz/Anuluj bez zmian; zatwierdzenie na stronie testowej nie ładuje biznesu. [Model, testy, UID/bootstrap i blokery właściwego loadera](tools/reports/cloud-2b2-single-user-access.md).

## 5. WYCENA — obecny kierunek

Centralnym kontraktem jest `QUOTE_CALCULATION_REGISTER.md`.

WYCENA ma już mocno rozwinięte fundamenty „jednej prawdy”:

- centralny rejestr wyliczeń,
- osobne linie materiałów, okuć, robocizny, transportu, wnoszenia i usług,
- snapshoty historii ofert,
- zamrożony model `clientOffer` do podglądu klienta i przyszłego PDF,
- audyt szczegółów oferty,
- `quantitySource` i `conditions` dla robocizny,
- stawki godzinowe i sposoby naliczania ceny,
- montaż AGD,
- transport i ORS,
- wnoszenie/logistyka,
- wymagania techniczne okuć.

Nie należy teraz robić dużego refaktoru WYCENY. Zielony baseline już istnieje; brakujące elementy matematyki wymagają osobnej decyzji, bez zmian przy dokumentacji chmury.

---

## 6. MATERIAŁ / ROZRYS

Projektowe PCV jest wspólnym źródłem krawędzi i metrów dla normalnego MATERIAŁU, ROZRYSU i WYCENY. Resolver rozlicza osobno lewy/prawy bok oraz grupy półek i frontów przed agregacją; planKey i placements zachowują różne krawędzie identycznych części. Projektowy tryb omija trwały legacy cache planu.

Jedno **Opcje → Opcje formatki → Zapisz** zachowuje oryginalną proporcjonalną mapę, PCV i globalne słoje. Koordynator chroni oba zapisy/draft i nie potwierdza częściowego sukcesu. PR #46 pomija jedynie updatedAt rekordu w lokalnym świadku, zachowując prawdziwe konflikty i kody błędów. Przelicz projekt pozostaje.

Otwarta pozostaje własność globalnych słojów/rotacji, część źródeł z sourceIssues i dalsze funkcje odłożone. D1–D6 nie są zbiorczo zamknięte przez projektowe PCV. Historyczne plany OPTIMIZATION_PLAN nie oznaczają ponownej implementacji już scalonych elementów.

---

## 7. Okucia, ceny dostawców i zakupy

Już działa rozbudowany katalog okuć:

- producenci,
- kategorie i parametry techniczne,
- wiele cen / dane dostawców,
- import/export XLSX,
- wymagania techniczne i dobór wariantów,
- rozdzielenie ceny zakupu od ceny do wyceny.

Plan przyszły, jeszcze nieukończony:

1. jasna reguła ceny użytej do konkretnej oferty,
2. snapshot kosztu/ceny w ofercie,
3. lista zakupów po zaakceptowaniu oferty,
4. zatwierdzenie faktycznego dostawcy i faktycznego kosztu,
5. raport **plan vs rzeczywistość / rentowność**.

Zaakceptowana oferta klienta nie może się zmieniać po późniejszej aktualizacji cennika.

---

## 8. Robocizna i „zjadacze czasu”

Model robocizny jest rozwinięty, ale `OPTIMIZATION_PLAN.md` wskazuje jeszcze niepełne obszary czasu pracy.

Priorytet dalszego uzupełniania:

1. montaż frontów, zawiasów, prowadnic/podnośników i regulacja,
2. wycięcia, blendy, trudne wnęki,
3. zamawianie materiałów/okuć i kontrola dostaw,
4. pakowanie, załadunek, sprzątanie,
5. dopiero później rozsądny bufor ryzyka.

Nie dodawać tych kosztów „na oko” bez jawnych źródeł ilości i testów.

---

## 9. Harmonogram / statusy procesowe

Pod przyszły harmonogram istnieje już read-only boundary `FC.projectScheduleStatus`.

Program rozróżnia procesowe kolejki m.in.:

- `Pomiar`,
- `Wycena` / wycena końcowa po pomiarze.

**Właściwy kalendarz/harmonogram nie jest jeszcze gotowy.** Gdy ten etap ruszy, UI powinno czytać istniejące boundary statusów, a nie interpretować historię ofert od nowa.

---

## 10. Kreator nietypowych korpusów

`CABINET_CREATOR_PLAN.md` jest nadal planem, nie ukończoną funkcją.

Kierunek jest ustalony:

- kreator ma być w WYWIADZIE,
- ma tworzyć zwykłą szafkę korzystającą z tych samych materiałów, faktów i WYCENY,
- nie może dostać osobnego systemu wyceny,
- później możliwy zapis nietypowej szafki jako szablonu,
- docelowo potrzebny prosty schemat/rysunek korpusu.

Warunkiem rozpoczęcia jest stabilny model źródeł ilości i WYCENY.

---

## 11. Mieszane fronty / „Szuflady + drzwiczki”

To nadal plan późniejszy.

Docelowy model powinien rozróżniać rolę każdego frontu, np.:

- `drawer` — front szuflady,
- `door` — drzwiczki zawiasowe.

Nie należy budować tego na samych licznikach `frontCount/drawerCount/doorCount`. Najpierw musi być stabilna jedna prawda frontów pomiędzy WYWIAD → MATERIAŁ → wymagania okuć → WYCENA.

---

## 12. RYSUNEK

`js/tabs/rysunek.js` ma ok. **1459 linii** i jest oznaczony jako obszar **„nie ruszać bez osobnego planu”**.

Nie jest obecnie blokadą dla chmury ani WYCENY. Duży refaktor RYSUNKU powinien być późnym, osobnym etapem. Nie należy teraz inwestować w szerokie łatanie starego monolitu tylko po to, żeby zachować jego obecną strukturę.

### Znany dług bezpieczeństwa zapisu — odłożyć do przebudowy RYSUNKU

Audyt zamykający 2B.4 po wdrożeniu MATERIAŁU 6f potwierdził, że obecny RYSUNEK ma ścieżki **mutation-before-durable-begin**:

- helpery takie jak `addFinish()`, `removeFinish()`, `insertGapAfter()` oraz część interakcji RYSUNKU najpierw mutują współdzielone `projectData`, a dopiero potem wywołują `saveProject()`,
- `saveProject()` dopiero później dochodzi do `FC.project.save(projectData)`, więc zabezpieczenie sesji może nastąpić już po zmianie RAM,
- przy awarii durable `session.begin()` zapis centralny może zostać zablokowany, ale RAM może być już zmieniony,
- `ensureLayout()` potrafi normalizować / tworzyć `layout`, wiersze i `finishes` podczas wejścia/renderu, czyli istnieją mutacje niebędące jednoznacznie zatwierdzoną akcją użytkownika,
- `fc_ui_v1` należy do rollback scope; przed przebudową trzeba testem rozdzielić prawdziwe dirty projektu od czysto wizualnego/UI dirty w RYSUNKU,
- moduł nadal miesza render SVG, interakcje, drag/drop, inspektor, listy wykończeń oraz stare `alert/confirm/prompt`.

### Decyzja

Nie tworzyć teraz osobnego patcha typu „6h” naprawiającego wszystkie powyższe ścieżki w obecnym monolicie.

Gdy temat RYSUNKU zostanie świadomie wznowiony:

1. najpierw ustalić docelowy UX i zakres funkcji,
2. zinwentaryzować mutacje danych vs stan czysto wizualny,
3. usunąć / zastąpić systemowe dialogi i wzmocnić testy kontraktowe,
4. dopiero potem rozdzielać render, interakcje i domenę,
5. nowe mutacje budować od początku według kontraktu: **lokalny draft / plan → durable session.begin → trwały zapis → aktualizacja współdzielonego RAM**,
6. nie przenosić automatycznie starych mutacji 1:1 do nowych modułów.

Wcześniejsze paczki przebudowy RYSUNKU nie zostały świadomie przeniesione do stabilnej bazy, dlatego przy przyszłej pracy nie traktować ich jako obowiązującej architektury bez ponownej decyzji.

---

## 13. Oferta klienta / PDF

Podgląd klienta i zamrożony `clientOffer` są już rozwijane.

Finalny PDF jest **świadomie odłożony na koniec**. Powinien renderować ten sam zamrożony model `clientOffer`, bez własnego ponownego liczenia i bez odczytywania bieżącego projektu.

---

## 14. PRO100 / usługi

Import plików PRO100 istnieje i korzysta ze wspólnego parsera dla pliku/wklejki.

Plan późniejszy obejmuje rozpoznawanie dodatkowych operacji (`NUT`, `FREZ`, `ROZCIĄĆ`, `FRONT ZAWIASY`) jako osobny moduł, a nie rozbudowę parsera bazowego bez końca.

---

## 15. GitHub / publikacja

Po PR #44 `preflight-js.yml` uruchamia pełny preflight przy jawnym **Draft → Ready** (oraz na ręczne workflow_dispatch). Automatyczny merge jest ograniczony do zaakceptowanego, niezmienionego head/base po PASS; po merge jest kontrola Pages konkretnego commita. Draft sam nie uruchamia tej ścieżki scalenia. CLOUD-1A nie wykonuje Ready, merge ani publikacji. To opis konfiguracji, nie deklaracja wykonania nowego CI w tym zadaniu.

---

## 16. Zasada pracy od teraz

Przed zmianą programu:

1. opisać problem i proponowany zakres,
2. wskazać ryzyko i testy,
3. nie zmieniać niczego przed komendą użytkownika **„do dzieła”**,
4. po zatwierdzeniu robić możliwie mały diff,
5. po zmianie uruchomić testy obszaru i baseline,
6. przygotować Draft PR/raport, a decyzję o Ready/merge/publikacji pozostawić użytkownikowi.

Aktualny etap to CLOUD-2B.4a + techniczne CLOUD-2C na emulatorach. Rzeczywisty transport danych Firebase i produkcyjne CLOUD-2C wymagają oddzielnej zgody; dalszy cel to ochrona domen i automatyczna synchronizacja.
