# CLOUD-4 — gotowość kontrolowanego pilota Firestore

Baza: `0cafb432f18bcd052672aac020d36128155388a7`, origin/main po PR #60. Gałąź `cloud-4-live-pilot-readiness`. Właściciel potwierdził CI/Pages PASS, akceptację Androida i zachowanie cenników, materiałów oraz okuć. To potwierdzenie właściciela, nie wynik nowego produkcyjnego odczytu wykonanego przez Codexa.

**Wyłącznie przygotowanie i izolowane emulatory.** Nie wykonano deployu Rules, edycji grantów, odczytu/zapisu biznesowego w prawdziwym Firebase, migracji, Ready/merge/Pages ani zmiany billingu. Lokalne repozytoria pozostają jedynym aktywnym autorytetem. CLOUD-3 pozostaje scalonym fundamentem 14 domen, bez uruchomionej synchronizacji.

## A. Implementacja i prywatna sesja

`js/app/cloud/controlled-project-pilot.js` definiuje `FC.controlledProjectPilot.borrow(...)`, ale **nie należy do żadnego manifestu ani startupu**. Ewaluacja pliku jedynie rejestruje fabrykę; nie ładuje SDK, nie odczytuje magazynów, nie loguje ani nie wysyła danych. Nie zmieniono `main-login.js`, `index.html`, `boot.js`, UI, Auth, profilu IndexedDB ani biznesowych setterów.

Przygotowany kontrakt prywatnego wywołania wymaga równocześnie:

- rzeczywistego `authSession` istniejącego main-login, aktualnego `lease` z `authAccessGate` oraz synchronicznego `assertLocalAccess` tej samej bramki;
- jawnej, nietrwałej zgody operacyjnej `{version:1,ownerUid,investorId,projectId,payloadSha256,rulesSha256,expiresAt}` — dokładne klucze, zgodny UID, stały scope i hashe, skończony termin przyszły najwyżej 15 minut;
- izolowanego buildera syntetycznego CLOUD-1B; nigdy eksportera aktywnego projektu właściciela.

Fabryka pożycza istniejący `firebasePilotLiveTransport`, a przez niego te same App/Auth/Firestore. Nie inicjalizuje drugiej aplikacji, Auth, persistence ani Firestore; nie pobiera/eksponuje tokenów. Uchwyty Auth/lease/transport/attempt pozostają w domknięciu. Wynik to wyłącznie `prepare()`, `write()`, `confirm()`, `readVerify()`, `close()`, bez dowolnego scope lub bezpośredniego SDK. Zamknięcie nie wykonuje signOut/deleteApp/terminate. UID, epoka, lease, lokalny dostęp i termin zgody są sprawdzane przed/po await; istniejący adapter powtarza kontrole wewnątrz transakcji.

Zgoda operacyjna jest ograniczeniem kontrolowanego wykonania, **nie dowodem uprawnień ani podpisem właściciela**. Serwerowe Rules nadal są niezbędne. Klient publicznej aplikacji nie jest zaufanym administratorem.

Jedyna zmiana dotychczasowego koordynatora: `projectCloudPilot.create(transport,{builder})` pozwala przekazać rzeczywisty eksporter działający w izolowanym realmie. Domyślnie używa dotychczasowego `FC.projectSelectiveExport`; format, algorytm, CAS i obsługa dotychczasowych klientów są zachowane.

## B. Co pozostaje nieaktywne

Nie ma wywołania prywatnej fabryki w main-login, globalnego uchwytu do jego sesji, parametru URL, flagi LIVE, przycisku, nowej strony ani uploadu przy logowaniu. Dotychczasowe `firebasePilotTransport.create({target:'live'})` nadal odmawia. CLOUD-3 globals nie są w ogóle pożyczane przez ograniczony kontroler CLOUD-4.

**Prywatny call-site pozostaje celowo niewłączony.** W przyszłości, po zgodzie na wykonanie pilota, należy poddać przeglądowi jedno ograniczone wywołanie z wnętrza właściciela sesji, przekazujące istniejące `auth`, `lease` i `assert`, oraz izolowany builder. Nie wolno otwierać sesji przez `window`, DevTools getter, nowy login lub publiczne narzędzie dowolnych zapisów. Chromium używa przechwycenia fabryk wyłącznie w routingu testowym — tego kodu nie ma w produkcyjnym main-login. Jest to przygotowany kontrakt integracji dopuszczony w zadaniu, a nie obecnie wykonywalny launcher LIVE.

Pierwszy zapis jest jednokrotny: jeden `prepare`, najwyżej jedna próba `write`, jedna `confirm`, dwa `readVerify` na uchwyt. Błąd zużywa limit; ponowna fabryka nie stanowi zgody na ponowienie operacji. Przyszły operator musi przerwać po wyniku niepewnym i niezależnie sprawdzić serwer.

## C–D. Dokładny minimalny wariant Rules i Auth-only

Plik: `tools/firebase-pilot/firestore-live-pilot.rules`.

SHA-256 (UTF-8, dokładne bajty):

`eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92`

`tools/firebase-pilot/firebase-live-pilot.json` wskazuje dokładnie ten plik; test ładuje go bez modyfikacji i sprawdza hash względem kontrolera. **Nie zastępuj go pełnym `firestore.rules` CLOUD-3.** Istniejące `firestore-auth-only.rules` i pełne emulatorowe `firestore.rules` pozostają niezmienione.

Przed późniejszym wdrożeniem wymagane: ponowny `sha256sum`, emulatorowy `npm --prefix tools/firebase-pilot run test:live-readiness`, przegląd diff oraz zapisanie weryfikacji, że bajty wdrożone są identyczne. Po ręcznym kopiowaniu w Console również porównać pobrany artefakt; sama nazwa pliku nie potwierdza zgodności. Tego etapu produkcyjnego teraz nie wykonano.

| Zakres | Warunek i uprawnienie |
|---|---|
| `/appAccess/{uid}` | Tylko własny get Google UID z `authorizedUsers/{uid}.appEnabled=true`; bez zależności od grantu pilota lub pilotControl. List/write/delete zabronione. |
| `/authorizedUsers/{uid}` | Brak odczytu/listowania/zapisu klienta. |
| `/pilotControl/cloud4` | Administracyjny singleton, bez żadnego dostępu klienta. Dokładnie `schemaVersion:1,ownerUid,enabled,projectId,investorId`. Jeden UID, stałe ID, enabled=true. |
| `/users/{uid}/pilotProjects/cloud4-project-v1` | Google UID zgodny ze ścieżką, appEnabled=true, enabled=true, dokładny pilotProjectId/pilotInvestorId i zgodny aktywny singleton. Get; tylko pierwszy create kompletnego manifestu generation=1/base=0. Update/delete/list zabronione. |
| `.../revisions/{32 hex}/chunks/{index}` | Get w tym samym grancie; immutable create rewizji/fragmentów tylko przed pierwszą publikacją. Ścisłe klucze, format, rozmiary i indeksy. |
| Globalne domeny, obce UID/projekty i nieznane ścieżki | Default-deny, również przy `globalDataEnabled=true`. |

Singleton uniemożliwia równoczesne korzystanie z tego profilu przez drugi UID z omyłkowo podobnym grantem. Samo appEnabled nie przyznaje praw do projektu. Grant pilota nie przyznaje praw do globalnych danych. Wyłączenie pilota nie blokuje logowania Auth-only.

Publikacja jest transakcyjnym CAS na brak manifestu, nie last-write-wins. Po pierwszej publikacji Rules blokują również dalszy staging i zastąpienie nowszą generacją. Dwie początkowe próby mają jednego zwycięzcę; druga odmawia, zachowując stan pierwszej.

Granice Rules: najwyżej 7 fragmentów po 128 KiB, plik maks. 819200 B; każdy dokument jest daleko poniżej 1 MiB, staging poniżej żądania 10 MiB. Manifest przy 7 fragmentach wymaga maks. **10 unikalnych zależnych dokumentów**: grant + singleton + rewizja + 7 fragmentów. Powtarzane odczyty tej samej ścieżki są cache'owane przez Rules. Test rzeczywistego SDK przy dokładnie 800 KiB potwierdza brak przekroczenia budżetu 10 na operację/20 na transakcję i limitu ewaluacji. Nie dodawać kolejnego get do tej ścieżki bez ponownego testu granicznego.

Rules nie obliczają SHA-256 ani nie parsują zaszytego JSON. Weryfikują zakres/strukturę/staging/niezmienność; pełna integralność i semantyka są sprawdzane przez CLOUD-1B/2C po stronie kontrolowanego klienta. SHA nie jest podpisem ani autoryzacją. Zaufany grant ogranicza jednego właściciela; nie obiecujemy ochrony przed celowo złośliwym zatwierdzonym właścicielem.

## E. Administracyjny grant — procedura, nie operacja wykonana

`tools/firebase-pilot/cloud4-admin-plan.js` jest czystą funkcją `plan({uid,grant,appAccess,control})`. Nie importuje SDK i nie wykonuje IO. UID przekazuje późniejszy administrator prywatnie; nie utrwalać go w repo, raporcie, URL lub logu. Funkcja odmawia przy nieznanych polach, niewłaściwym schemacie, obcym istniejącym zakresie, konflikcie właściciela singletonu lub braku istniejącego appEnabled/appAccess.

Po **oddzielnej zgodzie nr 3**:

1. Potwierdzić prywatnie rzeczywisty Firebase UID właściciela oraz właściwy projekt `mebleszek-meble-app`, `(default)`, Spark. Nie zakładać, że grant istnieje tylko dlatego, że działało logowanie.
2. Administracyjnie odczytać istniejące `/authorizedUsers/{uid}`, `/appAccess/{uid}` i `/pilotControl/cloud4` (brak jest dopuszczalny tylko dla singletonu). Zachować bezpieczny opis stanu do ewentualnego wycofania, nie dane konta w GitHubie. Nie odczytywać katalogów/projektów właściciela.
3. Obliczyć plan. Oczekiwane istniejące pola grantu: `appEnabled`, `enabled`, opcjonalne dokładne `pilotProjectId/pilotInvestorId`, `globalDataEnabled/globalSchemaVersion`. appAccess dokładnie `{schemaVersion:1}`. Nieoczekiwany stan wymaga odmowy i przeglądu, nie normalizacji lub nadpisania dokumentu.
4. Zaufana administracyjna transakcja musi ponownie porównać **pełne** grant/control z `expectedGrant/expectedControl` oraz appAccess z `{schemaVersion:1}`. Zastosować wyłącznie `grantPatch` (enabled=true + dwa stałe ID) i dokładny singleton. Nie zastępować całego grantu; nie zmieniać appEnabled/globalnych praw ani appAccess. W repo nie ma wykonawcy Admin SDK ani service account.
5. Jeśli używana będzie ręczna Console zamiast transakcji: wstrzymać klientów, najpierw utrzymać singleton `enabled=false`, porównać wszystkie wartości, uzupełnić tylko trzy pola grantu, ponownie odczytać, dopiero na końcu włączyć singleton. Wątpliwość lub częściowe potwierdzenie oznacza pozostawienie singletonu wyłączonego, nie próbę zapisu pilota. Nie jest to atomowa transakcja Console.
6. Potwierdzić read-back i brak zmiany appEnabled/appAccess/pozostałych praw. Zmiana tego kroku nie upoważnia jeszcze do rzeczywistego uploadu.

Minimalne rozszerzenie istniejącego grantu:

```json
{"enabled":true,"pilotProjectId":"cloud4-project-v1","pilotInvestorId":"cloud4-investor-v1"}
```

Administracyjny singleton (UID podstawiany prywatnie):

```json
{"schemaVersion":1,"ownerUid":"<zatwierdzony UID — nie zapisywać w repo>","enabled":true,"projectId":"cloud4-project-v1","investorId":"cloud4-investor-v1"}
```

## F. Syntetyczne źródło i ścisłe ścieżki

`tools/firebase-pilot/cloud4-synthetic-source.js` tworzy wyłącznie syntetyczne MemoryStorage, natywnego inwestora/projekt, pomieszczenia, szafki, zestaw A i zapis PCV przez rzeczywiste moduły, kończy ich syntetyczną sesję, a potem zamyka magazyny na zapis. Wywołanie build to nadal rzeczywisty CLOUD-1B z RAW, walidacją sesji/RAM i końcowym read-check. Nie podmienia globalnego FC ani Storage strony właściciela.

Dla przeglądarki `cloud4-source-worker.js` importuje te same produkcyjne moduły do oddzielnego workera z MemoryStorage. Nie ma Firebase, dostępu do localStorage strony ani interfejsu. Worker nie jest uruchamiany przez aplikację. Deterministyczny zegar dotyczy wyłącznie syntetycznej kopii: dane biznesowe i eksport są powtarzalne, a timestampy serwera publikacji pozostają prawdziwe.

- Inwestor: `cloud4-investor-v1`, nazwa jawnie fikcyjna; fizyczny projekt: `cloud4-project-v1`.
- Cztery natywne pokoje; szafki kuchnia/one, kuchnia/two i pokoj/one. Ta sama lokalna nazwa szafki w innym pokoju nie miesza właścicieli.
- Szuflady `3_1_2_2`, niezależne boki, grupy front.small/large, skrzynki, półki ×5, zestaw `set-A` i jego własna grupa frontu. Odrębne wartości PCV pochodzą z kanonicznego projektu.
- Referencje materiałowe zawierają wyłącznie TEST; brak danych globalnych, swobodnych notatek, firmy/ORS, historii ofert, backupów, sesji i derivedFacts w payloadzie.
- Kanoniczny plik: **6797 B**, jeden fragment.
- payloadSha256: `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`.
- documentSha256: `5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1`.
- Scope: `/users/{zatwierdzony-uid}/pilotProjects/cloud4-project-v1`, rewizje pod `/revisions/{32-hex}/chunks/0`. UID nie jest stałą w kodzie. ID próby losowe; scope i payload przypięte.

Zmiana źródła lub jego hashy wymaga ponownego przeglądu i testów, nie automatycznej akceptacji innego projektu. Bezpośredni test granicy 800 KiB używa osobnej syntetycznej kopii tego samego formatu do sprawdzenia Rules; kontroler pierwszego LIVE nadal akceptuje wyłącznie przypięte 6797 B.

## G. Spark, operacje i limity

Sprawdzono publiczną dokumentację Firebase 2026-10-17: [limity](https://firebase.google.com/docs/firestore/quotas), [odczyty zależne Rules i ceny](https://firebase.google.com/docs/firestore/pricing), [transakcje](https://firebase.google.com/docs/firestore/manage-data/transactions). Aktualnie podaje: jedna darmowa baza/projekt, 1 GiB, 50000 odczytów/dobę, 20000 zapisów/dobę, 20000 usunięć/dobę, 10 GiB transferu wychodzącego/miesiąc. Dzień kwot resetuje się według czasu pacyficznego. TTL, PITR, managed backups/restore/clone wymagają billingu i nie są używane.

Przed aktywacją właściciel ma **ponownie** potwierdzić Spark/brak billing account, aktualne limity i pozostały budżet w Console. Nie odczytywano jego rzeczywistego zużycia. Znane limity nie są obietnicą dostępności kwoty na koncie.

Dla pierwszego pliku K=1, bez konfliktów/ponowień transakcyjnych:

| Operacja | Jawne odczyty SDK | Zapisy biznesowe |
|---|---:|---:|
| prepare + staging + publikacja + potwierdzenie | 13 | 3 (rewizja, fragment, manifest) |
| niezależny pełny readVerify świeżym klientem | 6 | 0 |
| dodatkowe confirm | 2 | 0 |
| drugi pełny odczyt | 6 | 0 |

Liczniki testowe mierzą rzeczywiste tx.get/getDocFromServer/tx.set adaptera; **nie są pomiarem rachunku produkcyjnego**. Ogólnie dla K fragmentów pierwszy wiersz to 2K+11 odczytów i K+2 zapisów, pełny odczyt K+5. Weryfikator Auth i jego 30-sekundowe kontrole generują dodatkowe odczyty; Rules naliczają zależne odczyty grant/control/revizji/fragmentów, także przy odmowie. SDK może powtórzyć transakcję najwyżej 3 razy zgodnie z istniejącym adapterem; konflikty podnoszą zużycie, nie liczbę zatwierdzonych publikacji.

**Limit operacyjny pierwszego uruchomienia:** jedna para writer/reader, jedna próba prepare/write, jedna confirm i maks. dwa pełne odczyty; maks. 15 minut na zgodę, po teście zamknąć kontrolery i wyłączyć grant. Rezerwa do sprawdzenia przed testem: co najmniej **500 odczytów i 30 zapisów**, osobno od ruchu istniejącego Auth. To konserwatywny budżet organizacyjny, nie limiter billingowy serwera. W obrębie tak ograniczonej próby rzeczywisty plik i kilka dokumentów mieszczą się w Spark; nie uruchamiać pętli, wielokrotnych nowych uchwytów ani automatycznych retry.

Rules nie ograniczają liczby niedokończonych rewizji przed manifestem; dlatego dostęp jednego zaufanego UID i krótka, kontrolowana próba są konieczne. Orphan staging pozostaje do przeglądu, nie jest automatycznie kasowany. Zatrzymanie grantu zatrzymuje kolejne operacje, nie usuwa opublikowanego syntetycznego wyniku. Brak TTL, billingu, Functions, Blaze, automatycznego cleanupu lub kolejki offline.

## H–I. Pierwszy rzeczywisty zapis i niezależny odczyt — później

1. Uzyskać osobno cztery zgody z końca raportu. Porównać dokładny commit, Rules SHA, plan grantu i budżet. Przy zmienionym artefakcie ponowić przegląd/test.
2. Zachować backup wartościowych danych i historycznych aliasów zgodnie z BACKUP.md. Pilot nie potrzebuje ich zawartości, nie wolno używać prywatnego backupu jako źródła.
3. Po zatwierdzonym wdrożeniu minimalnych Rules potwierdzić zwykłe logowanie właściciela oraz odmowę obcemu UID. Nie otwierać praw globalnych. W tym zadaniu takie produkcyjne próby nie zostały wykonane.
4. Administracyjnie włączyć wyłącznie opisany scope i singleton, bez rozszerzenia globalDataEnabled. Po read-back oddzielnie zatwierdzić wykonanie testu.
5. W prywatnym, przejrzanym call-site po serwerowej autoryzacji i potwierdzeniu lokalnego profilu uruchomić worker syntetyczny, sprawdzić byteLength/hash i przekazać builder do kontrolera. Nie zmieniać wybranego inwestora/projektu właściciela, sesji Zapisz/Anuluj ani Storage strony.
6. Wywołać prepare (oczekiwany pusty manifest). Jakikolwiek istniejący manifest oznacza odmowę; nie tworzyć nowego ID projektu, by obejść wynik. Zatwierdzony scope ma pozostać jeden.
7. Jedno write: immutable staging, CAS create manifestu, potwierdzenie odczytem serwera. Sukces wymaga `ok:true,published:true`. Nie utożsamiać błędu transportu z dowodem braku zapisu.
8. Drugi, niezależny klient z własną sesją SDK tego samego zatwierdzonego Google UID i własnym lease wykonuje readVerify. Nie tworzyć drugiego Auth w działającej karcie; użyć odrębnego, izolowanego kontekstu klienta. Testy używają dwóch oddzielnych instancji SDK w niezależnych kontekstach, nie pożyczają pamięci writer-a.
9. Czytelnik pobiera manifest z serwera, wskazaną rewizję i komplet uporządkowanych fragmentów, rozmiary, wszystkie SHA, dokładne UTF-8 i kanoniczny JSON; CLOUD-1B ponownie waliduje model i właścicieli. `sourceMatches:true` wymaga równości pełnego dokumentu i oryginalnych bajtów, nie tylko deklarowanego payload hash.
10. Wynik tylko w RAM. Zachować bezpieczne podsumowanie hash/rozmiar/rewizja/rezultat bez UID/tokenów i danych prywatnych. Zamknąć kontrolery/worker oraz wyłączyć pilot. Brak importera do aplikacji.

Odtworzenie modelu nie dowodzi identycznej WYCENY: brak katalogów, cen, globalnych defaultów, słojów/rotacji Issue #47, legacy overrides i draftów. CLOUD-3 dostarcza kontrakty, nie transfer tych domen. Nie przeliczać zapisanych ofert.

## J–K. Wynik niepewny, zatrzymanie i cofnięcie

- Odmowa przed publikacją nie daje pełnego sukcesu; przerwany staging może zostawić immutable dokumenty, lecz nie opublikowany projekt. Nie kasować ich automatycznie.
- `published:'unconfirmed'` / `requiresIndependentRead:true`: **STOP zapisów**, żadnego ślepego retry ani „rollback wykonany”. Potwierdzenie mogło zaginąć po zatwierdzonej transakcji.
- Niezależny świeży klient ma odczytać manifest i dokładną rewizję. Własny revisionId + poprawne hashe/model/bytes potwierdzają rezultat. Inna rewizja to konflikt, nie własny sukces. Brak widocznego manifestu nie upoważnia automatycznie do ponownej publikacji; potrzebny przegląd właściciela i nowa jawna decyzja.
- Cofnięcie `appEnabled` odbiera również wejście do aplikacji. **Do zatrzymania pilota używać singletonu enabled=false i projektowego enabled=false**, zachowując appEnabled/appAccess. Nie wyłączać globalnych praw przez przypadek.
- Zatrzymać klientów, administracyjnie wyłączyć singleton, potwierdzić read-back i wyłączyć projektowe enabled. Nie nadpisywać innych pól aktualnego grantu starym snapshotem.
- Pozostawić opublikowany syntetyczny wynik i staging do kontroli. Nie usuwać produkcyjnych dokumentów w ramach automatycznej procedury.
- Po osobnej decyzji można przywrócić dokładny `firestore-auth-only.rules` i potwierdzić logowanie. Nie zastępować go całkowitym deny-all, które odetnie właściciela. Cofnięcie kodu do poprzedniego merge nie wymaga kasowania danych; obecny startup nie korzysta z CLOUD-4.
- Rules gwarantują odmowę nowych nieuprawnionych żądań. Nie dają natychmiastowego unieważnienia już zakończonego odczytu/wdrożonej transakcji; UI lease ma dotychczasowe 30 s kontroli / maks. 45 s ważności. Synchronous logout/zmiana UID od razu unieważnia istniejące uchwyty.

## L. Weryfikacja i ryzyka resztkowe

Wyniki końcowego pakietu (2026-10-17):

| Kontrola | Wynik |
|---|---|
| `node tools/preflight.js` | **PRE-FLIGHT PASS**, 124/124 smoke, 552/552 JS syntax, APP 110/110 |
| Load-order / dependencies / storage | **PASS**, 331 pozycji index, 412 domenowych JS, 351 dev_tests, 342 referencje storage/42 pliki |
| `npm --prefix tools/firebase-pilot test` | **71/71 PASS, 0 skipped**; wszystkie dotychczasowe Auth/pilot/global oraz 13 nowych testów dokładnego minimalnego profilu |
| Celowany emulator `firebase-live-pilot.json` | **13/13 PASS**, przed końcowym pełnym zestawem |
| `AUTH_POPUP_TEST=1 npm --prefix tools/firebase-pilot run test:browser` | **28/28 PASS, 0 skipped**, rzeczywisty Chromium/SDK, w tym rozszerzony test workera/prywatnego lease i 100 wyścigów profilu |
| `node tools/cloud4-pilot-readiness-smoke.js` | **PASS**: dwa niezależne źródła, hashe, role PCV, odmowy, plan admin, brak rejestracji w startupie |
| `node --check` zmienionych JS i obu MJS / `git diff --check` | **PASS** |

Pełny preflight objął dotychczasowe referencje: PCV **16,440 → 17,122 → 18,834 mb**, fronty **5,010 → 5,511 mb**, jeden zapas 10% oraz **4/3/6 arkuszy**; sesje, rollback i frozen oferty nadal przechodzą. Nie zmieniano oczekiwań tych testów. Nie są to testy rzeczywistego Firestore ani urządzenia Android.

Końcowy fetch potwierdził tę samą bazę origin/main. Zwykły push gałęzi nie odpowiada zdarzeniom Ready/auto-merge; nie zmieniono workflow, nie utworzono PR i nie wywołano workflow_dispatch.

Pokrycie CLOUD-4: dokładny Rules/hash; własny Auth-only bez pilota; obcy UID, anonymous, signed-out, drugi podobny grant, listy i globalne ścieżki; first-only manifest; pełny roundtrip z rzeczywistym CLOUD-1B i niezależnym SDK; siedem fragmentów/800 KiB; zamknięcie bez logout; UID/epoka/lease; cofnięcie appEnabled, grantu i singletonu; offline/reconnect bez kolejki; przerwa stagingu; dwaj writerzy; utrata odpowiedzi po realnym commit; brak/zmiana fragmentu, błędny manifest, utrata dostępu podczas odczytu; błędny zakres/zgoda/hash; nieobsługiwane dane i geometria; niezmienność RAM/RAW w sukcesach i odmowach. Istniejące CLOUD-1B/2C/3 oraz preflight utrzymują ceny/katalogi/oferty, PCV/jeden zapas 10%, 4/3/6, sesje i rollback. Chromium sprawdza prawdziwy worker i prywatne przekazanie istniejącego loginu przez testowy routing, brak ładowania LIVE w zwykłym starcie, ponowne wejście i odmowę, v2/v3 oraz wyścigi IndexedDB.

Pojedynczy `AUTH_STARTUP_FAILED` zgłoszony po CLOUD-3 pozostaje **nierozpoznanym incydentem Androida**. Nie odtworzono jeszcze przyczyny; nie dodano retry, nie zmieniono loginu. Lokalne testy startu/odmowy/odświeżenia/bfcache nie są dowodem wyjaśnienia tego incydentu. Jeśli wróci, potrzebne bezpieczne dane diagnostyczne (kod, moment, wersja przeglądarki/sieci), bez tokenów i danych firmy.

Pozostałe warunki rzeczywistego uruchomienia: zatwierdzenie czterech decyzji, przejrzany prywatny call-site niewystawiający Auth, potwierdzenie aktualnego grantu/Rules/kwot i działającego Auth-only po deployu, niezależny klient odczytu oraz plan zatrzymania. Prawdziwy Firestore i Android nie były użyte w tym zadaniu. Serwer nie parsuje JSON/SHA, client approval nie jest autoryzacją, limity prób nie są globalnym rate-limiterem. localStorage nie jest transakcją chmurową, a dopuszczenie profilu nie chroni przed osobą kontrolującą ten sam systemowy profil/DevTools; nie przypisujemy zawartości do Google UID i jej nie wysyłamy.

## Cztery oddzielne decyzje właściciela

1. **PR Ready / auto-merge / Pages** dla dokładnego commita przygotowawczego. Sam push ani implementacja nie są zgodą.
2. **Produkcyjny deploy dokładnie sprawdzonych Rules**, powyższy SHA, z zachowaniem Auth-only. Oddzielnie od publikacji kodu.
3. **Administracyjny grant** tylko tego UID i syntetycznego scope, po porównaniu istniejących dokumentów. Oddzielnie od Rules.
4. **Pierwszy rzeczywisty zapis i niezależny odczyt** wyłącznie przypiętego syntetycznego payloadu i limitów, przez zatwierdzony prywatny launcher. Oddzielnie od grantu.

Żadna z tych zgód nie wynika domyślnie z innej. Automatyczna synchronizacja, transfer globalnych danych i przełączenie autorytetu wymagają następnego uzgodnionego zakresu.


## Zmienione pliki

| Plik | Zakres |
|---|---|
| `js/app/cloud/controlled-project-pilot.js` | Niezarejestrowana prywatna granica sesji i stałego pilota |
| `js/app/cloud/project-cloud-pilot.js` | Opcjonalny izolowany builder, dotychczasowy domyślny zachowany |
| `tools/firebase-pilot/cloud4-synthetic-source.js` | Deterministyczny natywny syntetyczny projekt w MemoryStorage |
| `tools/firebase-pilot/cloud4-source-worker.js` | Izolacja tego źródła w rzeczywistym workerze przeglądarki |
| `tools/firebase-pilot/cloud4-admin-plan.js` | Czysty plan/preconditions minimalnego grantu i zatrzymania |
| `tools/firebase-pilot/firestore-live-pilot.rules` | Oddzielny minimalny profil Auth-only + jeden pilot |
| `tools/firebase-pilot/firebase-live-pilot.json` | Wskazanie dokładnego Rules i emulatorów loopback |
| `tools/firebase-pilot/live-readiness.test.mjs` | 13 nowych rzeczywistych testów SDK/minimalnych Rules |
| `tools/firebase-pilot/auth-browser.test.mjs` | Rzeczywisty worker, prywatny lease i brak startupu LIVE |
| `tools/firebase-pilot/package.json` | Dodanie testu do pełnego zestawu oraz celowanej komendy |
| `tools/cloud4-pilot-readiness-smoke.js` | Regresja źródła, admina, integralności i izolacji startupu w Preflight |
| `CURRENT_STATE.md`, `ROADMAP.md`, `CLOUD_MIGRATION.md` | Stan po PR #60 i oddzielne przyszłe zgody |
| `tools/reports/cloud-4-live-pilot-readiness.md` | Ten raport/procedury/testy/ograniczenia |
