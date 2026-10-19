# Ponawianie pierwszego zabezpieczenia sesji po PR #67

Baza: GitHub main `3332ac8e059a73430d3d40518caebb359a8728e8`,
gałąź `fix/durable-session-recovery`. Bez wydania i bez danych właściciela.

## Potwierdzony mechanizm i granice diagnozy

Odtworzono pętlę `SESSION_UNCONFIRMED` po nieudanym **pierwszym** zapisie
`fc_edit_session_v1`. `begin()` zachowuje RAM, oryginalny snapshot i właściciela,
ale sesja pozostaje `active:true, durable:false`. Po ustąpieniu awarii storage:
Zapisz sprawdzał `canSaveProject()` przed istniejącym ponowieniem w bridge,
Anuluj wymagało już trwałego dowodu, a nawigacja ponawiała `begin()` tylko dla
nieaktywnej sesji. Powtórne otwarcie tego samego pokoju umiało ponowić zapis.
Publiczne działania nie korzystały z tej bezpiecznej ścieżki.

Mobilny Chromium odtworzył to po rzeczywistym obliczeniu i zapisie oferty,
otwarciu edytora, zakończeniu poprzedniej sesji i restarcie z syntetyczną
awarią zapisu nowej sesji (`QuotaExceededError`). Żaden test nie używa eksportu
Pixela. **Nie ustalono, czy dokładnie ten stan występuje na telefonie właściciela.**
Poprawny trwały snapshot v4 przywraca się i kończy bez poprawki; sam restart
nie jest dowodem błędu. Nie udowodniono przepełnienia pamięci Pixela ani udziału
Google Auth w jego incydencie.

Odrębne odtworzone odmowy:

- nowszy zakres pokoju lub utrata trwałego potwierdzenia już zapisanego projektu:
  po restarcie `PROJECT_WRITE_CONFLICT`; brak bezpiecznej automatycznej adopcji;
- obcy aktualny projekt: `SESSION_OWNER_MISMATCH`; brak przełączenia właściciela;
- uszkodzony/niespójny payload: `SESSION_UNCONFIRMED`; brak kasowania;
- trwała awaria storage: ponowienie nadal odmawia, zachowując RAM i snapshot.

## Minimalna zmiana

- `session.js`: prywatny, nietrwały znacznik `initialBeginPending` powstaje tylko
  po niepotwierdzonym pierwszym zapisie wykonanym w danym dokumencie.
  `retryInitialBegin()` odwołuje się do istniejącego `begin()`: ten sam inwestor,
  projekt i pokój, identyczny kanoniczny baseline, brak obcego/uszkodzonego
  payloadu. Nie ustawia nowej rewizji na podstawie bieżącego rekordu.
- `actions-register.js`: jawny Zapisz oraz Anuluj mogą ponowić tę próbę.
  Przy brudnym Anuluj najpierw pozostaje dotychczasowe potwierdzenie użytkownika
  i kontrola kontekstu po `await`. Samo ponowienie nie wykonuje rollbacku.
- `session-navigation.js`: przed dotychczasową kontrolą dowodu dopuszcza to samo
  ograniczone ponowienie. Czysta sesja może się zakończyć bez zapisu projektu;
  brudna nadal wymaga wyboru Zapisz / Anuluj / Wróć.
- `index.html`, `dev_tests.html`: wspólne nowe wersje trzech zmienionych skryptów;
  dwa istniejące testy aktualizują wyłącznie oczekiwany cache-busting.
- `project-session-initial-retry-smoke.js`: regresje na rzeczywistych modułach;
  `pcv-ram-quote-mobile-browser.js`: opcjonalny scenariusz restartu i dotyku.
  `CURRENT_STATE.md` wskazuje ten raport.
- `cloud42-source-pins.json`: odświeżono wyłącznie SHA-256 trzech zmienionych
  modułów i index.html (cache-busting) po odmowie `CLOUD42_SOURCE_CHANGED` w pierwszym Preflight. Lista
  chronionych źródeł, Rules, UID, zgody i odmowa LIVE pozostają bez zmian.

Bez nowego store, formatu payloadu, migracji i interfejsu. Przywrócony snapshot
nie otrzymuje automatycznie prawa do ponowienia jako nieudany pierwszy zapis.
`writeUnconfirmed`, walidacja właściciela i rewizji pozostają obowiązujące.
Nie zmieniono Auth, TTL, Rules, Firebase LIVE, obliczeń ani statusów ofert.

## Weryfikacja

Polecenia uruchamiane z katalogu głównego:

```sh
node tools/project-session-initial-retry-smoke.js
node tools/pcv-ram-quote-mobile-browser.js --initial-session-retry
node tools/preflight.js
```

Nowa regresja modułów: **przed 6/12 PASS, 6 FAIL; po 12/12 PASS**.
Porównanie przed używa identycznego testu i oryginalnych trzech modułów z main
w pamięci procesu; nie podmienia plików checkoutu. Obejmuje pierwotną awarię,
brak potwierdzającego read-back, restart, ponawianie, odmowę przy konflikcie,
uszkodzony payload, obcego właściciela, zgody Anuluj, inne pokoje/projekty oraz
niezmienione RAW historii, inwestorów i cennika. Nowsze dane nie są nadpisywane.

Mobilny Chromium: **13/13 PASS, 0 FAIL, 0 SKIP**. Pierwsze dziesięć przypadków
to dotychczasowa rzeczywista edycja/dodawanie, PCV, optymalizator i ROZRYS,
Wyceń przez rejestr akcji, dwie zapisane oferty, restart, duplikat i odmowa.
Trzy nowe przypadki obejmują restart, nieudany pierwszy zapis sesji, ustąpienie
awarii i zdarzenia touch Chromium kierowane do istniejących Zapisz, Anuluj oraz WYCENA. Dla Zapisz
test wprowadza syntetyczną niezapisaną zmianę RAM i używa istniejącej polityki
widoczności przycisków; nie wymusza ich stylu ani sukcesu kalkulatora.
Historia i globalne RAW pozostają identyczne. Brak zewnętrznych żądań.

Auth/Access Web SDK na lokalnych emulatorach `demo-meble-app`: **13/13 PASS**,
łącznie z cofnięciem, wygaśnięciem, zmianą konta i brakiem dostępu offline.
Osobna próba trzech testów mobilnego shellu logowania jest **BLOCKED**:
wspólny hook setup nie pobrał oficjalnego `firebase-app.js` 12.19.0 z
`www.gstatic.com` (HTTP 403). Emulatory wystartowały, ale te trzy scenariusze
nie wykonały asercji. Nie zastępowano SDK ani autoryzacji stałym sukcesem.
Zalogowanie i przywrócenie sesji w rzeczywistym shellu nie mają tu nowego PASS.

Mobilny przebieg z `--session-baseline` zachowuje dotychczasowe 10/10 PASS,
następnie odmawia zakończenia sesji po dotknięciu Zapisz
(`SESSION_UNCONFIRMED`, timeout oczekiwania na potwierdzenie zakończenia).
Ten sam przebieg po poprawce kończy wszystkie 13 przypadków.
Osobne istniejące regresje: niepotwierdzony zapis **30/30**, błędy Anuluj
**10/10**, czysta nawigacja **14/14 PASS**. Dotychczasowa odmowa dla sztucznie
oznaczonej jako nietrwała, przywróconej sesji pozostaje bez zmian.

Pełny końcowy **PRE-FLIGHT PASS**: **132/132 smoke, APP 110/110**,
567/567 plików składniowo poprawnych, kolejność 331 skryptów, zależności
i storage PASS; 138353 ms. Przebieg wykonany po zakończeniu aktualizacji
czterech pinów, bez zmian źródeł w trakcie. Node.js 24, Chromium 151
z emulacją mobilnego viewportu i dotyku; nie jest to test na fizycznym Pixelu.

## Istniejąca sesja Pixela i plan bezstratnego postępowania

Poprawka obejmuje stan powstający na starcie, kiedy pierwszy zapis sesji nie
powiódł się, pamięć ponownie działa, kontekst jest właściwy i kanoniczny baseline
nie został zmieniony. Nie naprawia braku miejsca w storage ani dowolnej starej
sesji, nie usuwa jej i nie ignoruje faktycznego konfliktu.

Nie można obiecać odblokowania obecnego Pixela bez rozróżnienia jego stanu.
Jeśli po przyszłym wydaniu blokada pozostanie, należy zebrać **wyłącznie
odczytowe, pozbawione danych osobowych informacje techniczne**: kod odmowy,
schemaVersion, dostępność odczytu/zapisu, booleany zgodności właściciela oraz
bieżący zakres = baseline / expected. Żadnych identyfikatorów, projektu,
sekretów ani eksportu właściciela. Dodanie dostępnej bez USB kontrolki takiej
diagnostyki wymaga osobno uzgodnionego zakresu UI; nie dodano jej w tym pakiecie.
Jeżeli brak dowodu dla nowszej rewizji lub snapshot jest uszkodzony, zachować
blokadę i przygotować osobną, zatwierdzoną procedurę odzyskiwania z kompletną
prywatną kopią ratunkową, bez ręcznego usunięcia klucza i bez automatycznego
rollbacku. Obecny zwykły eksport nie gwarantuje zabezpieczenia sesji (BACKUP.md).

Po osobno zatwierdzonym wydaniu: na Pixelu ponownie wejść do oryginalnego
inwestora/projektu/pokoju, po potwierdzeniu dostępu wybrać świadomie Zapisz albo
Anuluj; następnie przejść do MATERIAŁU, ROZRYSU i WYCENY, sprawdzić istniejącą
historię oraz ponowny start. Przy ponownej odmowie zatrzymać próbę; nie czyścić
danych, nie resetować profilu i nie powtarzać logowania jako naprawy sesji.

Gałąź zawiera ograniczoną, odtworzoną naprawę do przeglądu. Brak pełnego dowodu
naprawy incydentu Pixela oraz blokada trzech testów shellu Auth uniemożliwiają
deklarację pełnej gotowości wydaniowej. Bez PR, merge, Pages i Firebase LIVE.

## Uzupełnienie: istniejący snapshot i pełny restart dokumentu

Baza uzupełnienia: `81d85fb895c50bf0388fb3e7968dfac07d555e4d` na tej samej
gałęzi. `main` nadal `3332ac8e059a73430d3d40518caebb359a8728e8`.
**Brak nowej poprawki odblokowującej produkcyjne sesje.** Poprzednia poprawka
i wszystkie jej testy pozostają. Dodano wyłącznie dwa runnery regresyjne oraz
to uzupełnienie dokumentacji i odnośnik w CURRENT_STATE.

`initialBeginPending` rzeczywiście znika po restarcie. Jednak `restoreSession()`
odtwarza wtedy `durable:true` dla aktywnego payloadu ze snapshotem; ta flaga
sama nie dopuszcza zapisu. `canSaveProject()` nadal sprawdza właściciela oraz
`inspectDurableSession()`. `retryInitialBegin()` nie interpretuje starego
snapshotu jako nowej, nieudanej próby. Samo utrwalenie znacznika ponowienia
nie dostarczyłoby brakującego potwierdzenia rewizji.

Niech B oznacza oryginalny zakres pokoju wraz z definicją w snapshotcie,
E ostatni trwale potwierdzony zakres w `expectedOwnerRaw`, a C zakres bieżący.
Są to zakresy z `scopeRaw()` (`session.js`), nie timestamp całego rekordu.

| Stan po restarcie | Rzeczywisty wynik |
| --- | --- |
| C=B, kompletny payload v4 i zgodny właściciel/kontekst | Czysta nawigacja już potrafi zakończyć sesję bez zapisu projektu; znacznik RAM nie jest potrzebny. |
| C=E, E≠B, kompletny dowód | Kanoniczny RAM odtwarza aktualne dane; istniejący jawny Zapisz może zakończyć sesję. Dirty navigation nadal wymaga decyzji. |
| Zapis projektu wykonany, zapis nowego E niepotwierdzony; C≠B i C≠E | W tym samym dokumencie `SESSION_UNCONFIRMED`; po restarcie `PROJECT_WRITE_CONFLICT`. Wszystkie trzy działania pozostają zablokowane, również po kolejnym restarcie. |
| Zewnętrzny zapis zmienił właścicielski pokój poza E/B | `PROJECT_WRITE_CONFLICT`, bez zmiany któregokolwiek trwałego bajtu przez odmówione działania. |
| Bridge zgłosił `SAVE_UNCONFIRMED`, ale E zostało utrwalone i nadal pasuje do C | Inny przypadek: po restarcie kanoniczny RAM i pełny trwały dowód pozwalają jawnie zakończyć sesję. Test obejmuje zmianę innego pokoju między zapisem i read-back. |
| Anuluj wcześniej przywróciło B, lecz usunięcie payloadu nie powiodło się | Przy pełnym dowodzie istniejący commit po restarcie kończy sesję bez ponownego rollbacku. W testach wyłącznie dane syntetyczne. |
| Snapshot istnieje, lecz brakuje wymaganej części dowodu | Zapisz/Anuluj: `SESSION_UNCONFIRMED`; nawigacja: ogólna odmowa potwierdzenia stanu sesji, bez nowego kodu w `lastError`. Sam snapshot nie wystarcza. |

### Dlaczego nie wolno przyjąć niepotwierdzonego C jako własnej rewizji

Regresja odtwarza rzeczywisty częściowy zapis przez `saveConfirmed()`, po którym
kanoniczny projekt zawiera zmianę, ale payload sesji zachowuje stare E.
Konstruuje też alternatywną historię zewnętrznego zapisu z **identycznymi
trwałymi bajtami**. Uwzględnia pomocnicze `fc_project_backup_v1` i
`fc_project_backup_meta_v1`: pierwszy zawiera stary projekt B, drugi tylko
`savedAt`. Żaden nie wiąże nowego C z identyfikatorem transakcji tej sesji.
To kontrprzykład dla wnioskowania o autorstwie z samych tych danych; nie dowód,
że zewnętrzny zapis wystąpił na Pixelu ani że dopuszcza go obecne UI.

Algorytm otrzymujący identyczne trwałe dowody nie może ustalić, która historia
wystąpiła. Zgodność geometrii, nowsza data, prawidłowy model projektu ani
istnienie oferty również nie potwierdzają transakcji edycji. Brakuje trwałego
potwierdzenia wiążącego **tę sesję, jej B i faktycznie zapisane C**. Nie można
dopisać takiego potwierdzenia wstecz na podstawie założenia o jego autorstwie.
Skasowanie payloadu usuwałoby zachowany oryginał; Anuluj mogłoby nadpisać
nowsze dane; ponowny Zapisz mógłby utrwalić niepotwierdzony RAM. Żadna z tych
czynności nie jest automatyczną ścieżką odzyskiwania w tym pakiecie.

### Nowe dowody i testy

```sh
node tools/project-session-restored-proof-smoke.js
npm --prefix tools/firebase-pilot ci
node tools/project-session-restored-proof-browser.js
node tools/preflight.js
```

- Nowe regresje rzeczywistych modułów: **8/8 PASS**. Osobne dokumenty VM,
  wyłącznie localStorage przenoszone między nimi; dwa restarty i wszystkie
  odmówione działania zachowują wszystkie RAW. Dodatnie przypadki dowodzą
  istniejącej możliwości zakończenia przy prawidłowym potwierdzeniu.
- Mobilny Chromium: **4/4 PASS, 0 FAIL, 0 SKIP**. Jedna rzeczywiście obliczona,
  zapisana i wyrenderowana oferta syntetyczna, następnie trzy warianty dowodu.
  Każdy przechodzi zamknięcie/nową kartę oraz pełny reload tej samej karty
  (inny nonce dokumentu, zachowane natywne sessionStorage). Zewnętrzny zapis
  wykonuje niezależny dokument bez aplikacyjnego trackera. Dla odmów RAW
  projektu, sesji, inwestorów, historii i globalnych danych są identyczne przed
  i po starcie oraz każdej próbie. Przy poprawnym dowodzie istniejący bootstrap
  może zmienić wyłącznie `updatedAt` aktywnego rekordu; test sprawdza wszystkie
  pozostałe pola oraz dokładne bajty payloadu, historii i globalnych danych.
- Dotychczasowa poprawka: **12/12 PASS**, niepotwierdzone zapisy **30/30 PASS**.
- Nie wykonywano ponownie benchmarków WYCENY. Nowy browser runner jest testem
  biznesowego bootstrapu, nie testem ponownego logowania Google. Zero żądań
  zewnętrznych i Firebase LIVE. Poprzednia blokada shellu Auth nie jest tutaj
  oznaczona jako nowy PASS.
- Końcowy **PRE-FLIGHT PASS**: **133/133 smoke, APP 110/110**, składnia
  **569/569**, kolejność ładowania, zależności i storage PASS; 142066 ms.

### Diagnostyka Pixela bez USB — rekomendowany następny krok

Nadal trzeba rozpoznać rzeczywisty stan telefonu. Rekomendacja: osobno
zatwierdzona jednorazowa **zakładka diagnostyczna Chrome (bookmarklet)**,
uruchamiana przez właściciela w tej samej karcie po poprawnym zalogowaniu.
Nie wymaga nowego wydania aplikacji ani zmiany jej UI. Nie przygotowano ani
nie uruchomiono jej w tej gałęzi; poniżej kontrakt do osobnej realizacji:

1. Sprawdzić istniejący gate `__FC_MAIN_ACCESS__`; brak świeżego dostępu oznacza
   odmowę, nie obejście. Wyłącznie `getItem`, obliczenia w RAM i opcjonalnie
   odczyt `navigator.storage.estimate()`. Bez próby zapisu testowego, nowych
   żądań sieci, SDK, normalizatorów i modyfikowania DOM.
2. Zachować pierwotny `lastError.code`; odczytać payload i potrzebne rekordy
   wyłącznie lokalnie. Wynik zawiera tylko kod, wersję schematu, publiczne
   wersje faktycznie załadowanych trzech modułów sesji (bez pełnych URL), flagi
   active/durable, obecność wymaganych pól, booleany zgodności właściciela
   i kontekstu, C=B, C=E, expectedKnown, pendingDomainOperation oraz zgodność
   nieskopowanych kluczy. Bez UID, identyfikatorów, nazw, treści, hashy projektu,
   tokenów, kluczy API, eksportu lub historii ofert. Estymata quota nie jest
   dowodem udanego/nieudanego zapisu.
3. Przed wydaniem wyniku ponownie odczytać chronione RAW; zmiana oznacza
   `DIAGNOSTIC_STATE_CHANGED` i odmowę raportu. Nie wołać `canSaveProject()`,
   `begin()`, `recoverProject()`, `commit()` ani `cancel()` — mogą zmienić stan
   lub komunikat. Nie testować `setItem/removeItem` i nie usuwać kluczy.
4. Dopiero po weryfikacji skopiować mały, zanonimizowany JSON do schowka.
   Odmowa schowka kończy operację, bez fallbacku zmieniającego UI czy storage.
   Najpierw testy bookmarkletu na tych samych syntetycznych stanach i kontrola
   niezmienności wszystkich danych, następnie osobna decyzja właściciela
   o uruchomieniu. Nie potrzeba prywatnego eksportu ani komputera/USB.

Jeśli diagnostyka pokaże C≠B/E lub niekompletny dowód, blokada pozostaje.
Dalsze odzyskanie wymaga osobno zatwierdzonej pełnej kopii ratunkowej oraz
świadomej decyzji o zachowaniu konkretnej wersji; obecny zwykły eksport nie
zabezpiecza sesji. Nowa architektura przyszłych potwierdzeń transakcji nie
odzyska brakującego dowodu dla starego payloadu. Nie proponuje się ręcznego
usuwania sesji ani automatycznego rollbacku.

**Wniosek:** `81d85fb` nie gwarantuje odblokowania istniejącej sesji Pixela po
restarcie. To uzupełnienie potwierdza ograniczenie, nie dodaje pozornej naprawy.
Bez diagnozy rzeczywistego stanu nie wolno deklarować rozwiązania incydentu.

### Realizacja diagnostyki bez USB — kontynuacja po `1c85b2d`

Powyższy opis nieprzygotowanej zakładki pozostaje historią. Na osobne zlecenie
właściciela przygotowano [gotowy bookmarklet i instrukcję Pixela](../diagnostics/README.md),
źródło kolektora, deterministyczny builder i dwa runnery. Nie zmieniono kodu
produkcyjnego ani poprzednich zabezpieczeń i testów odzyskiwania sesji.

Skrypt odczytuje siedem istniejących kluczy oraz publiczne pola RAM sesji/UI.
Nie wywołuje operacji domenowych, normalizatorów ani guardów zapisu; używa
wyłącznie istniejącego `__FC_MAIN_ACCESS__.isValid()` do odmowy bez ważnego
dostępu. Weryfikuje kompletność strukturalną dowodu, właściciela, kontekst,
zgodność RAM/payloadu, C=B, C=E, `expectedOwnerKnown`, pending operation,
zastany kod odmowy i czytelność storage. Ponowny odczyt chroni przed wydaniem
raportu z danych zmienionych w trakcie obserwacji. Prywatnego znacznika
`writeUnconfirmed` nie da się odczytać bez zmiany kontraktu produkcyjnego;
nie jest wywoływana metoda, która mogłaby go pośrednio zdiagnozować i zmienić stan.

Wynik to mały JSON z booleanami i zamkniętymi wartościami, bez nazw,
identyfikatorów, treści lub hashy danych, tokenów i kluczy. Jedyny zapis to
wynikowy JSON w schowku, zgodnie z powyższym kontraktem. Nie ma zmian DOM,
nawigacji, żądań sieciowych, zapisu aplikacyjnego ani próby quota. Odmowa
schowka nie uruchamia fallbacku. Zrezygnowano z modalnego okna wyniku, które
wstrzymywałoby JavaScript i mogło opóźnić odnowienie 45-sekundowego dostępu.
Nie zbiera się wersji skryptów z DOM ani estymaty quota: nie są potrzebne do
rozróżnienia dowodów, a polecenie ogranicza źródła do storage, sesji i Auth.

Wyniki celowane: **15/15 PASS** odczytu i anonimizacji; **7/7 PASS, 0 FAIL,
0 SKIP** dla rzeczywistego adresu `javascript:` z gestem użytkownika, natywnego
schowka i jego odmowy w Chromium (mobilny viewport/dotyk). Testy obejmują
pełny restart z utratą potwierdzenia, prawidłowe C=E, brak dowodu, pending,
obcy kontekst, nieczytelny storage, zmianę danych oraz odmowę/wygaśnięcie/
cofnięcie dostępu. Potwierdzono niezmienność wszystkich RAW, RAM, snapshotów,
DOM i URL oraz brak wywołań zapisujących i dodatkowej sieci. Fixture testowe
uzyskało opcjonalny kontrolowany zegar, bez zmiany domyślnego zachowania.

Browser używa rzeczywistych modułów main-login, lokalnego profilu i gate,
z syntetycznym Auth/verifierem. Nie zastępuje produkcyjnego `isValid` stałym
`true`, nie testuje nowego logowania Google i nie łączy się z produkcją.
Nie wykonano testu na fizycznym Pixelu. Jeśli Chrome odmawia uruchomienia
zakładki lub zapisu wyniku, należy zatrzymać próbę; alternatywny odczytowy
ekran diagnostyczny wymaga osobnej zgody i nie został dodany ani opublikowany.

Bookmarklet **nie odblokowuje** sesji. C≠B/E, brak lub konflikt dowodu nadal
wymagają dalszej świadomej decyzji; nie uprawniają do usunięcia payloadu,
rollbacku ani nadpisania projektu. Bez PR, merge, Pages i Firebase LIVE.

Końcowy **PRE-FLIGHT PASS**: smoke **134/134**, APP **110/110**, składnia
**573/573**, kolejność skryptów, zależności i storage PASS; 144080 ms.
Nie uruchamiano ponownie benchmarków WYCENY ani operacji Firebase.
