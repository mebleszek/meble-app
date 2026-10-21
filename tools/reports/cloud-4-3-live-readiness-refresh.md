# CLOUD-4.3 — aktualizacja gotowości syntetycznego pilota

## Baza, zakres i pochodzenie

Baza main: `44b5be9b1e05eded8243b9a617f976e44ad49c6f`, drzewo
`404986ad84b7870ddfaa30669b263469982c0717`. Gałąź:
`cloud-4-3-live-readiness-refresh`. Repo początkowo czyste; nie użyto starej
odtworzonej kopii CLOUD-4.1. CLOUD-4.1/4.2 są scalone, starsze nagłówki dokumentów
pozostają historią. Nie powtarzano audytów CLOUD-1/2/3 ani benchmarków WYCENY.
Decyzje z PR #41 sprawdzono w jego `PROJECT_DECISIONS.md` (plik nieobecny w main);
obowiązuje obecna procedura AGENTS §12–13, bez PR i wydania.

Porównano WSZYSTKIE piny wydania PR #63
`4d8dd96df9f293276dee07dc0c4cedf26edac08c` z bieżącym main:

| Wynik | Liczba |
| --- | ---: |
| Pierwotne źródła | 423 |
| Bez zmian | 388 |
| Zmienione | 35 |
| Nowe moduły diagnostyki sesji | 2 |
| Aktualne źródła | 425 |
| Nieaktualne hashe na wejściu | 0 |

35 hashy i 2 dodatkowe piny **były już zaktualizowane w main** przez wcześniejsze
naprawy. CLOUD-4.3 nie udaje ponownego odkrycia ani zmiany ich bajtów. Zmienia
bazę pakietu z PR #62 na aktualny main i dodaje przypięty SHA rejestr
`cloud43-source-review.json`: stary/obecny hash, kategoria, ocena zgodności,
commity źródłowe każdej zmiany. Indeks pinów ma nadal nazwę `cloud42-*` dla
zgodności konsumentów. `inventory()` sprawdza też pełną listę skryptów `js/`,
liczbę źródeł i dowód przeglądu; nieprzypięty nowy skrypt = odmowa.

## Zgodność aktualnych kontraktów

- **Sesja / właściciel:** v4 obejmuje pełny rekord właściwego właściciela zamiast
  całego magazynu. Stare payloady pozostają chronione. `inspectExportState()`
  nadal odmawia aktywnej lub niepotwierdzonej sesji; pilot nie wywołuje
  begin/commit/cancel/recover na profilu operatora. Wewnętrzna budowa fixture
  przez rzeczywiste moduły odbywa się wyłącznie w MemoryStorage workera.
- **RAM / PCV / źródło:** bieżące poprawki potwierdzają kanoniczny kontekst,
  eliminują heurystykę bogatszego obcego projektu i zachowują indywidualne PCV.
  Deterministyczny payload nadal ma identyczne bajty i model. Projekt/source
  inny od zatwierdzonego jest odmową, nie wyborem fallbacku.
- **Auth:** zmiana main-login obsługuje wygaśnięcie już uruchomionej aplikacji;
  leksykalne Auth/UID/epoch/lease i walidacje po await pozostały chronione.
  Kompilator już przypina bieżący main-login. Brak drugiego Auth aplikacji,
  publicznego transportu, URL przełączającego LIVE i przedłużania starego dowodu.
- **WYCENA / statusy:** poprawki kontekstu, odzyskiwania intencji, renderowania
  i wielokrotnego liczenia nie włączają pilota. Nie uruchamiamy wyceny danych
  odebranych z chmury, nie przepinamy historii i nie zmieniamy autorytetu danych.
- **Nowe diagnostyki UI:** przypięte, ale nie używane przez syntetyczny worker.
  Nie dodano UI ani kodu produkcyjnego w CLOUD-4.3.

Znaleziono jedną nieaktualną asercję infrastruktury: test Auth porównywał tylko
pierwsze 323 skrypty, choć po dodaniu diagnostyki template ma 325. Porównanie
obejmuje teraz pełną długość rzeczywistego template, z zachowaniem dokładnej
kolejności. To naprawa testu, bez pominięcia skryptów lub zmiany load order.

## Writer / reader i zamknięty zakres

Wykorzystywany jest dotychczasowy fikcyjny inwestor i projekt CLOUD-4. Worker
korzysta z rzeczywistych modułów projektu/sesji/PCV/eksportu, tworzy pokoje,
szafki i nadpisania grupy/elementów, zatwierdza stan, a następnie blokuje zapis
swojego storage. Żadna wartość profilu właściciela nie jest źródłem eksportu.
Eksport obejmuje geometrię i dane produkcyjne; nieznane istotne pola powodują
`EXPORT_UNSUPPORTED_FIELD`, nigdy ciche obcięcie lub pozornie pełny transfer.

Jedna niezmienna rewizja + fragment + manifest CAS generation=1/base=0.
Reader działa w osobnym kontekście przeglądarki tego samego syntetycznego UID,
sprawdza serwer, bajty UTF-8/canonical JSON, hashe i pełny model. Wynik pozostaje
w jego izolowanym RAM, bez importu do lokalnego projektu. Testy porównują RAW
local/sessionStorage i RAM operatora przed/po, w tym odmowy i utracony ACK.

Rzeczywisty Web SDK commit manifestu jest najpierw potwierdzony odczytem
administracyjnym emulatora, dopiero potem odpowiedź jest odrzucana. Writer
zwraca wynik niepotwierdzony i zużyty limit; niezależny reader ustala stan.
Nie udajemy sukcesu requestu i nie wykonujemy ślepego ponownego zapisu.
Brak revisionId po utracie ACK oznacza potwierdzony stan, ale bez dowodu
przypisania go konkretnej próbie (`attribution:unattributed`).

## Pięć NIEAKTYWNYCH bramek produkcyjnych

Żadnej z poniższych operacji nie wykonano w CLOUD-4.3. Każda wymaga osobnej
świadomej zgody na dokładne artefakty i zakres. Narzędzia package/admin-plan są
funkcjami offline; nie zawierają administracyjnego wykonawcy produkcyjnego.

1. **Kontrola stanu (pierwsza przyszła operacja):** tylko odczyt metadanych
   projektu `mebleszek-meble-app`, bazy `(default)`, aktywnego Firestore Rules
   release i wskazanego rulesetu. Dla domyślnej bazy identyfikator release to
   `projects/mebleszek-meble-app/releases/cloud.firestore`; nie zgadywać rulesetu
   na podstawie lokalnego pliku. Zachować prywatnie release/ruleset name,
   updateTime, oryginalne pliki i ich SHA-256, projectId/database, datę odczytu,
   potwierdzenie Spark/braku billingu oraz rezerwy kwot. Źródła rulesetu muszą
   wskazywać dokładny Auth-only, sprawdzony przez
   `verifyDeployedRules('auth-only', bytes)`. Inne bajty, dodatkowe pliki,
   nieznana baza/release/billing/rezerwa = STOP, bez automatycznego nadpisania.
   Punkt odniesienia jest niezmienny, przechowywany prywatnie; bez UID/sekretów
   w repo/raporcie. Ta zgoda NIE obejmuje deployu ani dokumentów Firestore.
2. **Minimalne Rules:** osobno zatwierdzić dokładny commit i SHA minimalnego
   pliku. Gotowe konfiguracje `cloud42-rules-deploy.json` oraz rollback
   `cloud42-rules-rollback.json` wskazują wyłącznie Rules. Późniejsza komenda
   z raportu CLOUD-4.2 używa jawnego projektu i `--only firestore:rules`.
   Po deployu osobny read-back aktywnego release/rulesetu i porównanie bajtów.
   Auth-only ma działać niezależnie od singletonu pilota. Globals, inne projekty
   i inni UID pozostają default-deny; nie używać pełnych Rules CLOUD-3.
3. **Grant stage → activate → stop:** po osobnej zgodzie odczytać tylko trzy
   dokumenty `authorizedUsers/{UID}`, `appAccess/{UID}`, `pilotControl/cloud4`.
   UID dopiero wtedy prywatnie potwierdza właściciel. `prepare()` tworzy plan
   konkretnego UID i stałych syntetycznych ID. W każdej transakcji odczyt
   wszystkich trzech, `assertExpected()`, potem tylko update pól / create
   brakującego singletonu. Nigdy zastąpienie całego dokumentu starym snapshotem.
   Zmiana równoległa = STOP. `stopAction()` wymaga świeżego odczytu i zachowuje
   zmienione globalne pola oraz `appEnabled:false`; nie przywraca uprawnień.
   **Termin <=15 min dotyczy zgody klienta, nie serwerowego TTL grantu.**
   `operationWindow` jawnie zwraca `serverEnforcedExpiry:false` i wymagany
   administracyjny STOP przed `stopBy`. Przed activate musi być zatwierdzony
   i dostępny operator STOP oraz czas na jego transakcję/read-back. Bez tego
   nie aktywować. Jeśli wymagane będzie samoczynne wygaśnięcie serwerowe,
   potrzebna jest osobno przetestowana zmiana kontraktu Rules/grantu, nie
   deklaracja, że obecny termin klienta zapewnia takie wygaśnięcie.
4. **Jeden zapis i niezależny odczyt:** osobna zgoda na dokładne source/piny,
   package/loader/candidate SHA, rolę, UID, expiresAt i zakres. Prywatny inertny
   loader `.mjs.txt` wymaga osobnego zapisu decyzji i świeżych odizolowanych
   kontekstów. Dwa pakiety: writer i reader, jedna próba każdego, ten sam
   zatwierdzony UID, istniejąca sesja Google i świeży lease. Przed i po await
   kontrola sesji/kontekstu/źródła. Manifest już obecny = konflikt, bez nowego
   ID w celu obejścia. Reader porównuje pełny model i hashe; brak importu.
5. **STOP / zakończenie:** zamknąć uchwyty i konteksty; wykonać uprzednio
   zatwierdzony stop grant/control z CAS i read-back. Nie zmieniać
   appEnabled/appAccess. Zachować syntetyczne dokumenty do przeglądu; bez delete.
   Cofnięcie Rules tylko na osobną zgodę i do punktu odniesienia bramki 1;
   lokalny rollback można użyć wyłącznie przy dowiedzionej identyczności.
   Cofnięcie praw nie cofa wcześniej zatwierdzonego zapisu.

| Wynik próby | Wymagany STOP |
| --- | --- |
| Sukces i zgodny reader | Zamknięcie klientów, CAS stop i read-back, zachować dowody |
| Odmowa przed publikacją | Bez retry; stop grantu; odnotować brak publikacji |
| Częściowy staging | Nie kasować fragmentów ani tworzyć nowego ID; stop i przegląd |
| Wynik niepotwierdzony | Zero kolejnych zapisów; tylko osobno zatwierdzony niezależny reader |
| Utrata Auth/lease lub cofnięcie praw | Brak dalszego IO klienta; stop administracyjny nie wymaga odnowienia klienta |
| Limit, inne Rules, nieudany reader | Nie zwiększać limitu/billingu ani osłabiać weryfikacji; stop i przegląd |
| Konflikt podczas stop | Wstrzymać klientów; świeży odczyt trzech rekordów i nowy ograniczony stopAction; bez rollbacku starym snapshotem |

## Limity, gotowość i dalsze zależności

Payload 6797 B oznacza jeden fragment i **3 zapisy biznesowe**: revision,
chunk, manifest. Stage/activate/stop to po 2 dokumenty, łącznie **6 zapisów
administracyjnych**, poza ewentualnym deployem Rules. Reader odczytuje manifest,
rewizję i fragment (3); dochodzą preflight/read-back/CAS oraz zależne odczyty
Rules, Auth i odnowień. Organizacyjna rezerwa **500 odczytów / 30 zapisów**
z CLOUD-4 jest konserwatywnym warunkiem, nie pomiarem rachunku, gwarancją kosztu
ani serwerowym licznikiem. Pakiet ogranicza payload do 819200 B / 7 fragmentów;
testowy fixture jest znacznie mniejszy. Żaden stan konta/zużycie produkcyjne
nie zostały odczytane. Cel Spark/0 zł bez aktywacji billingu pozostaje warunkiem.

- Kod writer/reader: nieaktywny kandydat; rzeczywisty roundtrip na emulatorach.
- Minimalne Rules: niezmienione, testowane na emulatorze; wdrożenie niepotwierdzone.
- Grant: gotowe plany CAS; brak rzeczywistego UID, brak wykonania na produkcji;
  obowiązkowe ograniczenie operacyjne czasu jak wyżej, bez pozornego TTL.
- Operator: inertny loader, zgoda na konkretny SHA i pojedynczą rolę; brak
  aktywnego produkcyjnego launchera i brak produkcyjnego testu OAuth/kwoty.

Pilot nie kończy migracji. Następne istniejące zależności rejestru danych:
Issue #47 (`fc_material_part_options_v1`, `fc_rozrys_grain_state_v1`: globalne
słoje/rotacja, nie udawana własność projektu); `fc_edge_v1` i
`fc_rozrys_overrides_v1`; pięć aliasów legacy i materials/services; frozen
historia A/B/A+B, drafty i ich właściciel; globalne 14 domen katalogów/stawek/
magazynu/ustawień; ochrona danych klientów i wykluczenie sekretów profilu/backupów.
Przed synchronizacją wielourządzeniową potrzebne są zatwierdzone konflikty CAS,
kolejka offline/idempotencja oraz osobne przełączenie jednego autorytetu.
Nie dodano nowej roadmapy, migracji, przycisków synchronizacji ani drugiego store.

## Testy i hashe

Weryfikacja lokalna (Node22 dla Firebase, oficjalny JAR v1.22.0, lokalny Chromium):

| Zestaw | PASS / FAIL / SKIP | Wynik |
| --- | --- | --- |
| CLOUD-4 live-readiness | 13 / 0 / 0 | PASS |
| CLOUD-4.1 private pilot | 10 / 0 / 0 | PASS |
| CLOUD-4.2 rehearsal z aktualnym pakietem | 10 / 0 / 0 | PASS |
| CLOUD-4.2 administracyjne transakcje CAS | 4 / 0 / 0 | PASS |
| Pełny Firebase SDK / Security Rules | 71 / 0 / 0 | PASS |
| Prywatny startup Chromium | 3 / 0 / 0 | PASS |
| Poprawiony startup/Auth/sesja/restart | 1 / 0 / 0 | PASS |
| Pełny Chromium — pierwsze uruchomienie | 35 / 3 / 0 | Patrz niżej |
| CLOUD-4/4.1/4.2 offline, piny, źródło, tampering | Wszystkie trzy istniejące runnery PASS | PASS |
| Pełny lokalny Preflight | 136/136 smoke, APP 110/110; składnia 579/579 | PRE-FLIGHT PASS |
| Zależności / storage / load order / diff --check | PASS | PASS |

Preflight trwał 186728 ms. Zawiera istniejące regresje sesji, właściciela,
storage pressure, status recovery, PCV (5.01 mb + dokładnie jeden zapas 10%),
WYCENY i rozkroju 4/3/6. Bez osobnych benchmarków wydajności.

W pierwszym pełnym Chromium dwa rzeczywiste testy popup otrzymały HTTP403 z
`https://apis.google.com/js/api.js`; lokalnie są **BLOCKED**, nie PASS ani SKIP.
Trzeci FAIL dotyczył starej stałej 323; po poprawce osobny realny przebieg
startup/Auth/sesja/restart przeszedł 1/1. Pierwszą próbę prywatnego startupu
uruchomiono bez dwóch wymaganych zmiennych loopback; guard prawidłowo odmówił.
Ponowienie z właściwymi zmiennymi przeszło 3/3, bez zmiany testów lub guardu.
Do cache browser SDK użyto oficjalnych plików z zainstalowanego firebase12.19.0,
po potwierdzeniu identyczności z trzema istniejącymi SHA pinami CDN; nie zmieniono
bajtów SDK, emulatora, TLS ani polityki sieci. Popup nie został zastąpiony mockiem.

Pełne Chromium/Auth poza tą blokadą sprawdzi izolowane CI po pushu. Przed jego
zakończeniem nie deklarować pełnego PASS ani kompletnej gotowości testowej.
[Workflow i przebiegi tej gałęzi](https://github.com/mebleszek/meble-app/actions/workflows/cloud43-emulator-tests.yml?query=branch%3Acloud-4-3-live-readiness-refresh).

Izolowany workflow `cloud43-emulator-tests.yml` uruchamia się tylko po pushu
na tę gałąź, z contents:read, Node22/Java21 i oficjalnym emulatorem v1.22.0.
Ma ścisły diff do bazy main, demo-meble-app i sekwencyjne zestawy; brak
sekretów/deploymentu/OIDC/PR/merge/Pages i automatycznych retry. Istniejący
workflow wydaniowy pozostaje bez zmian.

Dokładne SHA-256 (nie podpisy ani uprawnienia):

| Artefakt | SHA-256 |
| --- | --- |
| packageSha256 | `55cd7b87012c83572c4f2afdde33ea7a89a9ee2a1181a1e14caf770a0f1438f5` |
| sourcePinsSha256 | `c8439b32a36cb6a76927ba4f968b08b909745286d9d80888923b2fc700d2f1c0` |
| sourceReviewSha256 | `d8ed6e6336066cf0e33621838a3d98694202bf510461e21be91ce7dbeceeb2b8` |
| rulesSha256 | `eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92` |
| rollbackRulesSha256 | `fd92cffababe500cba62ed6e592b482760ce9e66df35f01419c44edff2f10cd3` |
| loaderSha256 | `7fd0ae3bf267bd39a909ad53ba3f76904f43498462a8e5b5456480277bcd3197` |
| payloadSha256 | `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3` |
| documentSha256 | `5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1` |
| cloud42-source-pins.json — fizyczne bajty pliku | `eb19fbccb00461cffec6559ab443d7b36c784b8e12541a35f9f2afb3d68bf175` |

`sourcePinsSha256` to hash kanonicznego JSON manifestu; odróżnić od SHA bajtów
pliku z formatowaniem. Wszystkie 425 indywidualnych hashy są w manifeście.
Candidate SHA powstaje dopiero dla konkretnego, prywatnie zatwierdzonego UID,
roli i terminu; nie ma jednego uczciwego SHA dla nieistniejącej instancji LIVE.

Warunek kolejnego kroku: zakończone testy izolowane, przegląd dokładnego commita
i osobna zgoda wyłącznie na bramkę 1. Produkcja, konto Spark, release Rules
i rzeczywisty grant pozostają NIEZWERYFIKOWANE. Gotowość bramki nie jest zgodą.
