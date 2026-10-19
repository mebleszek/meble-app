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
