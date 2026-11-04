# ANDROID STORAGE RECOVERY + IndexedDB v1 — 25.10.2026

## Nowy inwestor — LF_APPLICATION_SCOPE_REFUSED — 04.11.2026

Gałąź `fix/investor-save-scope-20261104`, BASE/main `afee03d2b408dd78b85ec3efcb575fffb568457b`. Zakres właściciela: zapis nowego inwestora, obsługa błędu i zachowanie wcześniejszych projektów. Bez CI, PR, wydania, Firebase, Rules i synchronizacji. Wynikowy HEAD w przekazaniu po commit/push. **CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING**.

### Przyczyna i zmiana

Zgłoszony stos prowadzi do zachowanej kontroli obcych rekordów w application-replication.mjs:86. Odtworzono dokładną odmowę na rzeczywistych modułach formularza/authority/committera z syntetycznym wcześniejszym rekordem zawierającym dodatkowe pole: normalizacja całej kolekcji przy scoped create usuwała pole z innego projektu. Nie odczytywano danych telefonu, więc nie ustalono konkretnego pola jego RAW. Guard słusznie odmawiał takiej mutacji i nadal ją blokuje.

W localOnly zapis pojedynczego inwestora/projektu zachowuje oryginalny rekord innego ID tylko wtedy, gdy oba znormalizowane widoki są równe. Rzeczywiście różne dane nie są zamaskowane i nadal trafiają do kontroli zakresu. Zmiana w project-store, investors-store i investors-local-repository. Nie modyfikowano committera, guardów ani ścieżki synchronizacji. investor-actions przechwytuje odrzuconą obietnicę i odkłada finalizację formularza do afterCommit; abort zachowuje draft i nie daje fałszywego potwierdzenia.

### Weryfikacja rzeczywiście wykonana

- android-investor-isolation-smoke.js: PASS na Windows/Node 22.23.4 — rzeczywisty callback przycisku i moduły authority/committera, modele globalne i walidator biznesowy; drugi inwestor zachowuje wcześniejsze projekty, nieznane pola, zamrożoną ofertę i wszystkie katalogi; celowa zmiana obcego projektu odrzucona; przerwany commit zachowuje formularz; jawne ponowienie tworzy jeden projekt. Kontrolowany DOM i magazyn pamięciowy są opisane, nie przedstawiane jako test telefonu.
- Ten sam smoke w Linux/Chromium 157.0.8103.38 z natywnym IndexedDB: PASS — abort prawdziwej transakcji oraz dwa renderer-loss/reopen bez backendu. W CI Linux native IDB jest obowiązkową częścią istniejącego smoke, bez nowego workflow.
- android-local-first-browser-smoke.js: końcowe **9 grup PASS**, pełny istniejący scenariusz resetu syntetycznego/14 domen, rzeczywisty formularz trzech szafek, abort, WYCENA i dwa wznowienia offline; zero cloud requests. Pierwsze lokalne próby miały timeout CDP na dysku Windows albo LF_APPLICATION_BUSY w przygotowaniu/nawigacji (także kod BASE). Przeniesiono izolowany profil/źródła na natywny katalog tymczasowy WSL i dodano wyłącznie testowe oczekiwanie na faktyczne zakończenie transakcji. Nie zwiększano timeoutów ani nie osłabiano asercji.
- investor-navigation-exit-smoke.js **13/13 PASS**; pcv-ram-quote-save-regression-smoke.js **12/12 PASS**.
- Składnia czterech modułów, kanoniczne wersje zasobów, aktualny manifest i git diff --check PASS. Oba istniejące smoke są odkrywane dokładnie raz: investor-isolation w shardzie 4/7, android-local-first-browser w 5/7. Workflow niezmieniony. Pełnego Preflightu ani Actions nie uruchamiano.

### Granice przekazania

Dostarczona poprawka nie potwierdza naprawy na fizycznym Pixelu ani zabezpieczenia jego aktualnego niezapisanego formularza. Nie resetowano profilu/danych, nie zmieniano Firebase, Rules, Auth, aktywacji, synchronizacji ani cenników. PR #112 jest już wydany; jego dawne CI_PENDING w tym raporcie jest historyczne. Nowy pakiet wymaga osobnej zgody na dokładny HEAD/BASE przed CI/wydaniem.

## Kolejne szafki — sesja LOCAL-FIRST — 04.11.2026

Gałąź `fix/android-cabinet-session-20261104`, BASE/main **`8952d97f4b8bff28a1207c31abbcfd47dba934fa`**, sprawdzony git/remote. Jeden commit/push zawierający wpis, wynikowy HEAD w przekazaniu. **Poprawka lokalna CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING; pełny cel synchronizacji LIVE nadal SYNC_BLOCKED.** Nie przedstawiamy całego nowego zlecenia jako zakończonego.

### Błąd i dowód naprawy lokalnej

Właściciel po wydaniu PR #111 potwierdził działający start, fabryczne cenniki i brak usuniętych testowych inwestorów. Następnie: inwestor/pomieszczenie/pierwsza szafka, odmowa następnej; restart pozwala na kolejną, potem problem wraca. Anonimowy raport: `SESSION_STORAGE_WRITE_FAILED`, brak payloadu sesji i durable=false, RAM istnieje, runtime ready. Brak fizycznych RAW katalogów po świadomym resecie jest oczekiwany, aktywne katalogi są w obrazie IndexedDB; pojedyncze aliasy są dopuszczone. Nie zdiagnozowano quota ani konieczności nowego resetu. Pełnego raportu właściciela, jego RAW i danych nie zapisano w repo ani testach.

Rzeczywisty `cabinet-modal-finalize.bindTopSaveButton()` przypisywał zwykły synchroniczny onclick. `session.begin()` i `project.save()` trafiały poza `application-authority.transaction()`, gdzie guard wymaga mutacji wewnątrz transakcji. Sesja mapuje ten wyjątek na zamknięty kod `SESSION_STORAGE_WRITE_FAILED`; legacy project.save może otworzyć okno niepotwierdzonego zapisu. Potwierdzono mechanizm na rzeczywistych session/authority z syntetycznym checkpointem w pamięci; to nie test IDB. Osobno rozszerzony rzeczywisty Chromium na BASE odtworzył okno „Nie udało się zapisać projektu” i zablokowanie następnego dodawania.

Jedyny zmieniony moduł produkcyjny: `js/app/cabinet/cabinet-modal-finalize.js`. W localOnly istniejący przycisk jest podłączony do istniejącego `applicationWrite.projectHandler`, z tymi samymi owner/editor/fence/CAS i walidatorami. Odświeżenie listy i zamknięcie formularza są odroczone przez istniejące afterCommit. Nie ma nowego silnika, API przechowywania, osłabienia guardu ani zmiany logiki cen, geometrii/frontów lub widoku. Ścieżka bez localOnly zachowuje poprzedni kontrakt.

### Faktyczne testy

Node **24.19.0**, Chromium **151.0.7922.173**, wyłącznie syntetyczne profile/dane:

- `android-local-first-browser-smoke.js`: **9 grup PASS, exit 0**. Zachowane wcześniejsze scenariusze resetu, drugiej karty, przerwania, obcej bazy i starego PENDING. Syntetyczne wstawianie szafki do RAM zastąpiono **trzema szafkami przez rzeczywiste kontrolki formularza bez zamykania aplikacji**; odrębne ID pozostają po dwóch restartach offline. Realna edycja 61/62 zachowuje zgodną geometrię frontów. Wymuszony abort czwartej operacji zachowuje formularz/wartość/RAM/native RAW/wszystkie cztery store; nie ma przedwczesnego zamknięcia lub potwierdzenia. Potem rzeczywisty Zapisz, brak rozbieżności RAM/obrazu, WYCENA, zimne wznowienie, draft i Anuluj. Katalogi z kodu/14 domen, obca baza i brak starych aliasów zachowane. Zero żądań chmury, brak fikcyjnych ACK/replik/outboxu.
- `pcv-ram-quote-save-regression-smoke.js`: **12/12 PASS**, powtarzane dodawanie/edycja, ceny i frozen historia, RAM, odmowy zapisu/readback, obcy projekt i wycena niepotwierdzonego modelu.
- `drawer-front-geometry-smoke.js`: **18/18 PASS**, WYCENA/MATERIAŁ/ROZRYS, jednostki i ceny, prawdziwa geometria frontów, odmowy przed mutacją, trwały Save i scoped Cancel.
- Składnia, kanoniczne wersje, manifest **489 zasobów** i routing **201 smoke / 7 rozłącznych obowiązkowych grup** PASS. Native browser **5/7**, PCV/RAM **6/7**, geometria **4/7**, każdy dokładnie raz. Workflow bez zmian; pełnego CI, emulatorów ani Actions nie uruchomiono.

Pierwszy przebieg BASE miał oczekiwany FAIL na formularzu. Po poprawce test ujawnił dwie własne luki: zbyt szybki kolejny gest przed końcem istniejącej blokady anty-powtórzeniowej 800 ms oraz bezpośrednią zmianę szerokości w RAM bez regeneracji frontów. Teraz test oczekuje rzeczywistego odblokowania akcji, używa formularza również do edycji oraz czeka na pełne potwierdzenie zapisu. Nie zwiększono timeoutów ani nie osłabiono walidatora/ujemnych asercji. Tylko końcowe pełne wykonanie ma PASS powyżej.

### Konkretny STOP dla pełnego celu synchronizacji LIVE

To nie ogólny audyt ani powrót do operatora CLOUD-4.6. Istnieją trzy bezpośrednie blokery aktualnej ścieżki:

1. `application-bootstrap.js` konfiguruje produkcję jako localOnly, pomija connect oraz refresh. `application-runtime.mjs` odmawia writer/reader w takim trybie (`LF_LOCAL_MODE_REQUIRED`) i dołączenia synchronizacji przez lokalne resume (`LF_LOCAL_SYNC_NOT_AUTHORIZED`). Potrzebne jest kontrolowane przejście **tego samego** obrazu/store do istniejącej replikacji po autoryzacji; samo przestawienie flagi nie zachowuje lokalnego startu niezależnego od chmury.
2. `application-replication.mjs` potwierdza lokalny commit bez replik/outboxu i z cloudConfirmed=false. Nowe dane Pixela nie mają przez to bazowej zdalnej rewizji, pinów globals ani edytora serwerowego. Start cloud może przyjąć remote globals dla świeżej instalacji, zasiać puste remote lub odmówić `LF_INITIAL_GLOBAL_CONFLICT` / `LF_INITIAL_PROJECT_CONFLICT`. Podłączenie musi najpierw porównać lokalny snapshot/CAS z niezależnie potwierdzonymi headami, zachować różnice i nie powtarzać niepewnych ACK. Nie wolno automatycznie wybrać fabrycznego albo zdalnego cennika.
3. `application-sync-grant.mjs` wymaga tej samej tożsamości i serwerowego `syncAccess/{owner}` zgodnego z podpisanym activationId. Nie sprawdzano obecnego grantu, Rules ani danych Firebase LIVE. Brak świeżego dowodu nie jest stwierdzeniem odmowy serwera; nieznanego stanu nie zastępujemy fikcyjnym ACK. Do odczytu/publikacji danych produkcyjnych potrzebna jest osobna, konkretna zgoda właściciela.

**Następny wymagany dowód:** w aktualnym kontekście właściciela potwierdzić read-only admission i nagłówki/rejestr rewizji zdalnych globals/projektów, bez udostępniania RAW lub cen. Następnie wykonać kontrolowane podłączenie istniejącego obrazu i test dwóch urządzeń na syntetycznym backendzie, z lokalnym startem niezależnym od sieci, porównaniem konfliktów, trwałym outboxem i niezależnym ACK. Istniejący gotowy transport i testy należy wykorzystać; nie wdrażać nowego silnika. Zlecenie naprawy kodu nie jest w tym pakiecie zgodą na produkcyjne READ/WRITE, Rules, kasowanie starej chmury ani wysłanie nowych danych Pixela. Nie implementowano pozornej automatycznej aktywacji LIVE.

### Przekazanie i granice

Zmienione pliki: jeden moduł formularza, jego wersja `20261104_cabinet_transaction_v1` w `index.html`, `dev_tests.html`, `tools/script-versions.js`, `offline-assets.js`, rozszerzony istniejący browser smoke oraz `CURRENT_STATE.md` i ten raport. Gałęzi wydawanego PR #111 nie ruszano. Bez zmian Auth, writer-fence, Service Workera, synchronizatora, Rules, cenników i norm. Bez PR/Actions/merge/Pages, Firebase LIVE i operacji na telefonie. Poprawka nie daje dowodu zabezpieczenia RAM w już otwartym starym dokumencie; aktualizacja dopiero po świadomym rozstrzygnięciu niepotwierdzonej pracy. Fizyczny test nowego formularza i pełna synchronizacja pozostają niewykonane.

## Reset Androida — RESCUE_UNKNOWN_DATABASE — 03.11.2026

Gałąź `fix/android-reset-unknown-idb-20261104`, BASE/main **`b033f76facc409fce7ef03bf15f70a74f34b3321`**, zweryfikowany przez git/remote. Jeden commit/push zawierający ten wpis; wynikowy HEAD w przekazaniu. **CODE_READY / CI_PENDING / PHONE_PENDING / SYNC_BLOCKED**. Ten rozdział aktualizuje wcześniejsze stwierdzenie, że nieznana baza blokuje także świadomy reset; kontrakt pełnych kopii pozostaje bez zmian.

**Uzupełnienie dokumentacyjne na polecenie właściciela:** po commicie implementacji `b9e2285bec7e1c8b3825b38e61b0c5343efc668b` zapisano stały protokół w `AGENTS.md` §20 i dzienniku. Kod, testy i manifest bez zmian; wcześniejsze wyniki poniżej dotyczą tego SHA implementacji, bez ponawiania testów. Osobny commit dokumentacyjny zmienia HEAD przekazania i wymaga osobnej zgody wydaniowej na aktualne HEAD/BASE. Codex przekazuje pakiet; ChatGPT obsługuje kontrolę i zatwierdzoną próbę wydania. Kontrola diffu i zgodności szablonu; bez operacji wydaniowych lub LIVE.

### Przyczyna i minimalna zmiana

Pixel potwierdził `STOP / RESCUE_UNKNOWN_DATABASE` po świadomym potwierdzeniu resetu, przed usunięciem danych. Na dokładnym BASE odtworzono odmowę `readRescueSnapshot()` przy dodatkowej bazie v7; nie wykonano nawet `indexedDB.open()`. Reset korzystał z zamkniętej inwentaryzacji przeznaczonej dla pełnej kopii, choć nie obejmuje wszystkich baz originu.

`sync/local-first-rescue-snapshot.mjs` ma dwa jawne wejścia do tej samej walidacji: dotychczasowy `readRescueSnapshot()` zawsze wymaga zamkniętego inventory; nowe `readLocalResetSnapshot()` porównuje inventory wyłącznie wskazanego obrazu LOCAL-FIRST i znanego archiwum. `sync/application-local-reset.mjs` używa drugiego wejścia po dotychczasowej kontroli natywnego potwierdzenia, owner/gate/release i wyłączności. Dodatkowe bazy nie są otwierane, odczytywane, kopiowane, normalizowane ani usuwane. Nie wnioskowano własności po prefiksie nazwy i nie rozszerzono listy celów kasowania.

Właściciel/receipt/binding, integralność source/application/outbox/ACK, schemat/wersja obu celów, podwójny odczyt danych i docelowego inventory, brak drugiej karty, aktualność dostępu oraz journal przerwania pozostają obowiązkowe. Kod wykonujący czyszczenie/transakcje/readback nie zmienił się. Pełny eksport `local-first-rescue-file.mjs` wciąż wywołuje rygorystyczne wejście; obce pole `resetOnly` w kontekście nie może go przełączyć. Stary `storage-recovery-export.js` pozostał bez zmian.

### Pochodzenie baz — dowody i granice

Bazy tworzone przez kod programu: obraz `meble-local-first-v1` (`sync/local-first-idb.mjs`, receipt/release/binding), archiwum `meble-business-backups-v1` (`backup-archive-format.js` + `backup-archive-idb.js`), profil `meble-access-profile-v1`, zaufanie `meble-device-trust-v1` i koordynacja `meble-application-writer-fence-v1` (odpowiednie moduły `js/app/cloud`). Profil, zaufanie i fence pozostają zachowane.

Dodatkowy historyczny twórca jest potwierdzony **kodem i historią**, nie samą nazwą: `js/app/investor/investor-deletion.js:5,95` tworzy `meble-investor-delete-v1` / `operations` jako trwały ledger usuwania inwestorów; kod występuje już w commicie `a28240c8` z 31.10. Pełny rescue nie ma tej bazy na liście. Znane nazwy Firebase w istniejącej liście auth nie są dowodem zawartości lub właściciela konkretnej bazy; nie dodano do nich nowych wyjątków.

Nie odczytywano telefonu, dlatego **nie ustalono nazwy ani pochodzenia dodatkowej bazy Pixela**. Historyczny ledger również pozostaje poza resetem; nie ruszano jego odrębnych mechanizmów wznowienia ani nie zapewniamy, że każdy możliwy uszkodzony/historyczny stan uruchomi się. Obecność bazy nie jest już sama w sobie blokerem tego resetu; inne rzeczywiste odmowy pozostają jawne.

### Faktyczna weryfikacja i CI

Wyłącznie syntetyczne dane. Node **24.19.0**, rzeczywisty Chromium **151.0.7922.173**:

- `android-local-first-browser-smoke.js`: **7 grup PASS / exit 0**. Pełny dotychczasowy scenariusz rozszerzony o dodatkową obcą bazę v7, dwa store, indeks, klucze i nieznane pola. Konflikt Androida → natywna odmowa bez mutacji; druga karta bez zapisu journal; przerwany reset/abort zachowuje cztery store i niepewną kolejkę, restart wymaga ponownej zgody; świadome wznowienie → RESET_COMPLETE → fabryczne 14 domen → pełny start offline → inwestor/projekt/pokój/podstawowa WYCENA → zapis → dwa zamknięcia procesu/wznowienia offline, draft i Anuluj. Asercje obcej bazy sprawdzają dokładnie wersję, schema, indeksy, klucze i rekordy po odmowie, drugiej karcie, abort, reset, restartach oraz końcowym rollbacku. Instrumentacja odróżnia odczyt dowodowy testu od prób otwarcia przez aplikację; aplikacja nie otworzyła obcej bazy. Zero żądań chmury, brak fikcyjnych ACK/outboxu. Dotychczasowe asercje zachowane.
- `local-first-rescue-smoke.js`: **9/9 PASS**. Nowy przypadek obejmuje obcą bazę v7 i nazwę historycznego ledgeru: reset odczytuje wyłącznie zweryfikowany cel readonly, pełna kopia i API prepare nadal odmawiają przed pierwszym IDB open. Osobno zachowane odmowy owner/binding/hash/schema/drugiego klienta/Auth/zmiany źródeł/braku obrazu i złej wersji celu. Wszystkie wcześniejsze osiem grup kopii, archiwum, szyfrowania, niezależnego pliku i utraty dostępu nadal PASS.
- Routing: **201 current smoke / 7 rozłącznych obowiązkowych grup**, browser dokładnie raz w **5/7**, rescue w **4/7**. Oba testy są wykrywane przez istniejący Preflight; bez zmian workflow. Pełnego lokalnego CI, emulatorów i GitHub Actions nie uruchomiono.
- Odświeżono wyłącznie hashe dwóch zmienionych modułów w `offline-assets.js` (**489 zasobów**). Nie zmieniono klasycznych skryptów/HTML, wersji Auth ani Service Workera. Kontrola składni, wersji, świeżości manifestu i diffu w końcowym przekazaniu.

Zmienione pliki: dwa moduły powyżej, `offline-assets.js`, dwa istniejące smoke, `CURRENT_STATE.md` i ten raport. Bez zmian Firebase/Auth/synchronizacji/cenników/norm/UI/Service Workera. Fizyczny Pixel pozostaje **PHONE_PENDING**; po osobno zatwierdzonym wydaniu właściciel powtarza istniejącą czynność resetu w jednej karcie i tym samym zatwierdzonym profilu. Nie czyści Chrome ani nie usuwa dodatkowych baz. Narzędziami nie resetowano telefonu i nie wykonywano Firebase LIVE.

## LOCAL-FIRST — czysty start i praca offline — 03.11.2026

Gałąź `fix/android-local-clean-start-20261103`, wejściowy HEAD **`66d59cd6452c5790178fd6fe8b61dd84b785fd4f`**, BASE main **`93ae98dcd7412a837090a677455abbc173719efb`**. Jeden nowy commit/push zawierający ten wpis; wynikowy SHA w przekazaniu. **CODE_READY / CI_PENDING / PHONE_PENDING / SYNC_BLOCKED**. Poprzedni STOP poniżej opisuje stan wejściowy, zakończony nową decyzją właściciela.

### Zatwierdzony model i zakres

Właściciel zatwierdził start/pracę lokalną oraz utratę wszystkich lokalnych danych testowych Pixela, również katalogów, aliasów, backupów i kolejki. Osobno potwierdził: **zachować istniejące zatwierdzenie właściciela**; nowy, nigdy niezatwierdzony profil nadal wymaga pierwszego dopuszczenia online. Nie tworzymy anonimowego dostępu, nowego konta ani uprawnienia Firebase. Backup nie jest warunkiem tego konkretnego, świadomie destrukcyjnego resetu. Danych telefonu nie odczytywano ani nie resetowano narzędziami.

- Produkcyjny bootstrap zweryfikowanego wydania uruchamia istniejący runtime w trybie `local-only`. Nie tworzy połączeń, kanałów, discovery ani synchronizatora Firebase; reconnect także nie wznawia starej kolejki. Próba dołączenia cloud writera do tego runtime odmawia. Dotychczasowe transporty, serwerowy edytor, ACK i ich asercje pozostają w osobnej ścieżce. Nie udajemy synchronizacji: status ma `cloudConfirmed:false`, transfer nie jest zgłaszany jako potwierdzony.
- Pusty obraz jest zasilany istniejącym `codeCandidate` i `codeGlobalRows()`, pełne **14 domen / validateBundle()**. Nie używa cache po migracji do odtworzenia cenników. Cena/ID/norma/zamiennik pochodzą z dotychczasowego generatora; firma i brakujące ustawienia są neutralne. Odczyt brakującego aliasu podczas starego bootstrapu korzysta z głównego zatwierdzonego źródła, bez zapisania historycznego klucza. Obecny alias nigdy nie jest w ten sposób pomijany ani scalany.
- Lokalny commit używa dotychczasowego `application`/wersji/CAS i tej samej transakcji IndexedDB. Nie tworzy fikcyjnego head, repliki, edytora serwerowego ani outboxu. Zachowuje walidację struktury/właściciela projektu i 14 domen. Natywne referencje, np. `HDF`, rozstrzyga istniejąca WYCENA; ścisłe przypisanie referencji transportu pozostaje warunkiem przyszłej synchronizacji. Nie zmieniono walidatora zależności kanału chmurowego ani zasad cenowych.
- Istniejący autosave i zapis parametrów pokoju w lokalnym trybie przechodzą przez istniejącą granicę transakcji. Nie ma drugiego silnika danych. Potwierdzony draft zawiera dowód pierwotnej sesji; zimny start odtwarza go z obrazu. Widok bez aktywnego draftu nie rozpoczyna nowej sesji tylko dlatego, że poprzednio był otwarty pokój. Anuluj odtwarza wyłącznie pokój zapisany w dowodzie sesji, z zachowaniem pozostałej zawartości rekordu i innych projektów. Ceny globalne nie są cofane przy tej operacji.

### Reset i przerwania

Jedyna zmiana wyglądu to konieczny element istniejącego panelu ratunkowego i natywne potwierdzenie utraty danych. Backend wymaga zaufanego zdarzenia/potwierdzenia, aktualnego owner/access, potwierdzonego zatrzymania, receipt/binding/release, wyłączności, istniejących baz i integralności. Wykorzystuje dotychczasowy bezpieczny snapshot do weryfikacji, bez wymogu pobrania kopii. Nie osłabiono inwentarza starego eksportu.

Przed pierwszą mutacją powstaje znacznik `PENDING`. Cztery store `control/replicas/protected/outbox` są czyszczone w jednej transakcji z nowym bindingiem. Obracane są oba identyfikatory instalacji. Następnie czyszczone są rozpoznane backupy w trzech store archiwum (jeśli istnieją), znane RAW `fc_*`, pięć historycznych kluczy bez prefiksu, application receipt/route i dane sessionStorage. Każde usunięcie RAW ma readback. Odtwarzany jest receipt dla pustego źródła; zatwierdzenie właściciela i zaufanie urządzenia pozostają. Nie ma `Storage.clear()`, kasowania profilu Chrome ani zmian danych Firebase. Koordynacyjna baza istniejącego writer-fence jest jawnie rozpoznana i **zachowana**; nie jest danymi biznesowymi ani celem resetu. Inne nieznane bazy nadal odmawiają.

Przerwanie przed zakończeniem utrzymuje odmowę startu do kolejnego świadomego potwierdzenia. Nowe bindingi uniemożliwiają użycie odrzuconej kolejki przez stare obiekty store. Jeżeli stary `PENDING` pojawi się przy istniejącym już nowym obrazie, bootstrap wymaga niezależnego dowodu receipt/binding/activation/source/hash/image i kończy wyłącznie znacznik, **bez ponownego czyszczenia danych**. Kontrolowana regresja odtwarza taki stary znacznik przy zapisanym nowym projekcie. Dokładna przyczyna pojedynczego przestarzałego odczytu podczas pośredniej próby zimnego startu nie została potwierdzona; obecna ścieżka nie opiera decyzji o ponownym resecie na samym znaczniku.

Zimny start używa istniejącej rejestracji offline i nadal wymaga właściwego scriptURL/scope oraz kompletnego ACK manifestu. Nie próbuje `register()` bez sieci. Nie zmieniono offline-worker, jego aktywacji, writer-fence ani cache polityki. Wczytanie własnego obrazu jest dozwolone wyłącznie przed udostępnieniem pierwszego lokalnego UI; działający dokument nadal chroni RAM. Aktywny draft wymaga istniejącego obrazu i dokładnego dowodu zapisanej sesji, nie tymczasowej sesji utworzonej przez stary bootstrap.

### Faktyczne testy i CI

Node **24.19.0**, Chromium **151.0.7922.173**; wyłącznie syntetyczne dane, własne jednorazowe profile, brak Firebase SDK/backend i produkcyjnych READ/WRITE.

| Celowana kontrola | Faktyczny wynik |
| --- | --- |
| `android-local-first-browser-smoke.js` | **6 grup PASS**, exit 0: rzeczywisty pełny manifest aplikacji/FC.init/boot/runtime/authority/IndexedDB, rzeczywisty offline-worker i wszystkie zasoby, kryptograficznie podpisana decyzja DEMO; dokładne błędy Androida → fatal/rescue; odmowa resetu i druga karta bez mutacji; abort transakcji i restart do ponownej zgody; reset i fabryczne 14 domen; inwestor/projekt/pokój i podstawowa rzeczywista WYCENA; zapis; dwa zamknięcia całego procesu i wznowienia offline; potwierdzony draft 62 → Anuluj 61; stary PENDING nie usuwa zapisanego projektu; brak inicjalizacji dawnych aliasów/outboxu/ACK i zero żądań chmury. |
| `android-clean-start-preconditions-smoke.js` | **3 grupy PASS**, Chromium: stare warunki ścieżki cloud zachowane; backend odmawia bez potwierdzenia; jawny lokalny CAS potwierdza tylko zapis lokalny, odmawia starej wersji i nie odtwarza istniejącego outboxu. |
| `offline-shell-smoke.js` | **3 grupy PASS**: dotychczasowe SHA/cache/prywatne odpowiedzi/brak takeover; dokładna tożsamość workera i kompletny ACK; istniejąca rejestracja offline bez sieci, brak/błędna rejestracja i niepełny ACK nadal odmawiają. |
| `code-global-catalogs-smoke.js` / asset freshness | **7/7 PASS / PASS**: generator, wszystkie 14 domen, runtime, oryginalne stawki/ID/ceny/jednostki/normy/zamienniki i neutralna firma. |
| `wycena-labor-norms-smoke.js` / `wywiad-room-durable-save-smoke.js` | **9/9 + 18/18 PASS**, normy i dotychczasowe odmowy/durable baseline bez osłabienia. |
| `main-login-smoke.js` / `trusted-main-login-smoke.js` / `android-startup-auth-smoke.js` | **36/36 + 4 grupy + 6 grup PASS**, właściciel, odmowy, receipt, Auth/lease, zachowanie RAM i zaufania offline. |
| `android-globals-recovery-smoke.js` / `local-first-rescue-smoke.js` / `local-first-contract-smoke.js` | **7 + 8 + 7 grup PASS**, readonly scope, błędy/obcy właściciel/binding/brak ACK, nieznane bazy, zabezpieczenia eksportu i chmury, RYSUNEK/WYCENA. |
| `first-sync-error-diagnostics-smoke.js` / `global-consistency-startup-smoke.js` | **9/9 + 6/6 PASS**, pierwszy błąd, anonimowość, granice dostępu i wersjonowanie. |
| `application-authority-store-smoke.js` / `business-project-contract-smoke.js` / `application-replication-readiness-smoke.js` | **PASS**, istniejące natywne CAS/quota/SIGKILL oraz kontrakty/routing pozostają. |

W pełnym teście inwestor, projekt, pokój i zapis obsługują rzeczywiste formularze/akcje; szafka jest syntetycznym fixture w rzeczywistym RAM, a WYCENA używa rzeczywistych kalkulatorów. Sieć blokuje natywny CDP przed pierwszym skryptem; serwer dodatkowo zrywa połączenia, więc worker musi użyć kompletnego cache. Nie podmieniono navigatora ani silnika aplikacji. Odtworzone przez Chromium dodatkowe karty wyłącznie tego własnego syntetycznego profilu są zamykane przed przypadkiem jednej karty; osobny przypadek dowodzi odmowy przy drugim kliencie.

Routing automatycznego wykrywania: **201 current smoke / 7 rozłącznych obowiązkowych grup**. Oba Android local smoke oraz normy/room durable należą dokładnie raz do shard **5/7**, offline shell do **7/7**. Nie zmieniono workflow, nie uruchomiono Actions ani pełnego lokalnego Preflightu/emulatorów. Pełne CI pozostaje **CI_PENDING**. Wersje sześciu zmienionych klasycznych skryptów są spójne z HTML; manifest ma **489** publicznych zasobów. Kontrola wersji, składni, manifestu i diffu należy do końcowego przekazania.

W iteracjach były niezaliczone próby fixture (brak oczekiwania na koniec poprzedniej akcji/potwierdzenie dialogu, dodatkowe dokumenty po restarcie), pojedynczy timeout generatora VM 2 s oraz pojedynczy niepotwierdzony cleanup Chromium. Nie uznano ich za PASS, nie zwiększono limitu VM ani nie osłabiono supervisora. Końcowa pełna próba ma exit 0 i potwierdzony cleanup. Wykryte rzeczywiste usterki zimnego startu, granic lokalnego zapisu i journal/sesji naprawiono w opisanej ścieżce.

### Ograniczenia i Pixel po osobno zatwierdzonym wydaniu

- Fizycznego Pixela nie testowano i nie resetowano. Google/owner enrollment w teście jest syntetyczne; zachowujemy istniejącą politykę wcześniejszego zatwierdzenia właściciela. Nowy profil wymaga pierwszego zatwierdzenia online i przygotowanej kompletnej powłoki offline.
- Wznowienie obejmuje draft **potwierdzony w IndexedDB**. Nie obiecujemy zachowania całego heapu, RAM innych kart ani ostatnich jeszcze niepotwierdzonych zdarzeń przed awarią procesu. Zmiana sieci nie wymusza reload i zachowuje bieżący RAM; istniejący autosave nie kończy sesji użytkownika.
- Fabryczne ceny startowe/ostrzeżenia pozostają dokładnie takie jak w kodzie. Test podstawowej WYCENY nie potwierdza kompletności cen wszystkich możliwych produktów ani gotowości realnej oferty.
- Lokalny obraz z nowymi projektami nie ma zdalnego ACK. Zdalne globals, istniejące serwerowe projekty i stare operacje wymagają odrębnego planu/autoryzacji przed synchronizacją; nie wolno automatycznie połączyć lub wysłać tych obrazów. Niczego z Firebase nie odczytano, nie nadpisano ani nie usunięto.

Po wydaniu właściciel wykonuje wyłącznie w istniejącym profilu Pixela:

1. Pobrać nowe wydanie zwykłą bezpieczną ścieżką aktualizacji. Pozostawić jedną kartę Meble-App, zamknąć też kartę aktualizatora. Nie czyścić danych Chrome/witryny i nie korzystać z incognito.
2. Na ekranie błędu globals otworzyć **„Tryb ratunkowy — kopia LOCAL-FIRST”**, następnie **„Usuń lokalne dane testowe i zacznij od katalogów z kodu”**. Przeczytać i zaakceptować natywne potwierdzenie utraty wszystkich lokalnych testów. Anulowanie niczego nie usuwa.
3. Zaczekać na **RESET_COMPLETE** i nacisnąć **„Uruchom ponownie”**. Zachowany dowód zaufania pozwala uruchomić kodowe katalogi offline bez nowego logowania/Firebase.
4. Włączyć tryb samolotowy, utworzyć testowego inwestora/projekt/wycenę, potwierdzić zapis, zamknąć aplikację i otworzyć ponownie w tym samym profilu. Sprawdzić projekt i cenniki. Stan lokalny nie oznacza synchronizacji z komputerem.
5. Jeśli świadomy reset został rzeczywiście przerwany przed RESET_COMPLETE, panel po kolejnym starcie wymaga ponownego potwierdzenia wznowienia. Inny STOP/Auth/niepełna powłoka wymaga przekazania anonimowego kodu; nie czyścić przeglądarki i nie obchodzić gate.

### Zmienione obszary

Start/store: `js/main-login.js`, `js/app/cloud/application-bootstrap.js`, `sync/application-boot.mjs`, `sync/application-runtime.mjs`, `sync/application-authority.mjs`, `sync/application-replication.mjs`, `sync/application-write-boundary.mjs`. Reset: nowy `sync/application-local-reset.mjs`, istniejące `sync/local-first-recovery-ui.mjs` i `sync/local-first-rescue-snapshot.mjs`. Callbacki: `js/app/investor/investor-room-actions.js`, `js/app/investor/project-autosave.js`, `js/app/ui/wywiad-room-settings.js`; zimny shell: `js/app/cloud/offline-shell.js`. Wersje/manifest: `index.html`, `dev_tests.html`, `tools/script-versions.js`, `offline-assets.js`. Regresje: nowy `tools/android-local-first-browser-smoke.js`, istniejące `tools/android-clean-start-preconditions-smoke.js`, `tools/offline-shell-smoke.js`, `tools/helpers/android-globals-browser-fixture.js`. Dokumentacja: `CURRENT_STATE.md` i ten raport. Bez zmian definicji cen/norm, Service Workera/writer-fence, Rules, IAM, billingu, Firebase LIVE, PR, merge lub Pages.

## Czysty start Androida — STOP przed resetem — 03.11.2026

Gałąź `fix/android-local-clean-start-20261103`, HEAD wejściowy = zweryfikowany lokalnie i przez `git ls-remote` main/BASE **`93ae98dcd7412a837090a677455abbc173719efb`**. Wynikowy HEAD: jedyny commit zawierający ten wpis, SHA w przekazaniu. **IMPLEMENTATION_STOPPED / RESET_BLOCKED / CI_PENDING / LIVE_BLOCKED**; nie deklarujemy CODE_READY resetu.

Nowa wyraźna zgoda właściciela obejmuje utratę **wszystkich lokalnych danych testowych Meble-App na Pixelu**, w tym katalogów/aliasów, projektów, inwestorów, backupów i kolejki offline. Dla tego konkretnego resetu brak BACKUP_PASS nie jest blokerem. Zgoda nie obejmuje danych Firebase, innych witryn ani całego profilu Chrome. Nie zmienia historycznej polityki bezstratnej naprawy dla pozostałych danych/urządzeń.

### Konkretny bloker obecnego startu

1. `sync/application-runtime.mjs:17`: bez writera i bez odtworzonego istniejącego obrazu startup odmawia `LF_ONLINE_INSTALLATION_REQUIRED`. Po usunięciu obrazu/receipt nie wystarczy przejście offline.
2. `sync/application-runtime.mjs:72` i nast.: przy braku lokalnej repliki globals runtime odczytuje zdalny kanał. Przy świeżej produkcyjnej instalacji przyjmuje zdalny zestaw; w pozostałych przypadkach porównuje go z lokalnym i może odmówić `LF_INITIAL_GLOBAL_CONFLICT`. `projectApplicationRows()` waliduje, lecz nie wymaga tożsamości przyjmowanego zestawu z definicjami fabrycznymi. Poprawna strukturalnie inna cena może więc zastąpić cenę z kodu. Niepoprawny schemat nadal odmawia startu.
3. Gdy serwer odpowie `GLOBAL_NOT_FOUND`, ten sam runtime wykonuje `store.commit()` i potem `sync.flush()`. To tworzy queued globals do publikacji; zgoda na lokalne kasowanie nie upoważnia do tej zmiany Firebase. Nie twierdzimy, że rzeczywisty serwer jest pusty lub uszkodzony — jego stan pozostaje **NIEZNANY**, bez LIVE READ/WRITE.
4. Samo zatrzymanie połączenia nie daje działającej pustej aplikacji z pierwszym projektem: `ensureEditor()` wymaga kanału/edytora, a `createApplicationCommitter()` wymaga kanału projektu i potwierdzonych globalnych zależności. Nie wolno wymyślić serwerowego head/ACK ani oznaczyć danych jako zsynchronizowane. Zmiana tych zasad w nowy tryb lokalny wykracza poza zlecony minimalny reset bez przebudowy synchronizacji.

**STOP następuje przed skasowaniem danych.** Nie dodano częściowego/destrukcyjnego resetu ani przycisku, nie zmieniono produktu, Auth, SW, writer-fence, runtime ani synchronizacji. Nie wykonano żadnej operacji na Pixelu/Firebase. Obecna odczytowa capability recovery nadal nie daje prawa WRITE. Nie przedstawiamy istniejącej odmowy offline jako nowego zabezpieczenia działającego online — połączenie online zachowuje dotychczasową politykę. Zablokowana jest realizacja nowego resetu, nie istniejąca aplikacja.

### Celowane dowody i granice

Node **24.19.0**, rzeczywisty Chromium **151.0.7922.173**, wyłącznie syntetyczne dane w jednorazowym profilu:

- `node tools/android-clean-start-preconditions-smoke.js` — **3 grupy PASS**. Istniejący fixture Androida zawiera dokładnie materials INVALID_SCHEMA, labor DIFFERENT, pięć ONE_MISSING, cztery SOURCE_MISSING oraz niepewny outbox. Fatal i wejście rescue pochodzą z wydanego main/profile/boot i istniejącej syntetycznej granicy błędu loader/runtime. Następnie **rzeczywisty** `startApplicationRuntime()` odmawia pustego startu bez writera. Native RAW i wszystkie cztery store pierwotnej bazy pozostają identyczne. Rzeczywisty `projectApplicationRows()` przyjmuje poprawną inną cenę labor (różnica 12.125 bez zaokrąglania), odmawia materials bez priceUnit. Rzeczywisty committer i transakcje IDB w **oddzielnej syntetycznej bazie** tworzą queued globals bez potwierdzonego head i odmawiają pierwszego kanału projektu. Nie wykonywano flush/SDK/serwera; dowód skutków publikacji wynika z jawnego wywołania flush w istniejącym runtime, nie z próby LIVE.
- `node tools/code-global-catalogs-smoke.js` — **7/7 PASS**: deterministyczny generator, pełne 14 domen, validateBundle, kontrakty runtime, neutralna firma/defaults, dokładne ceny/ID/normy/zamienniki, kalkulatory oraz podstawowa WYCENA istniejących szafek. Nie oznacza wykonania resetu ani pełnego startu czystej instalacji.
- Oba testy są automatycznie wykrywane dokładnie raz w obowiązkowym Preflight shard **5/7**; plan **200 smoke / 7 rozłącznych grup**, bez zmian workflow. Sprawdzono routing, składnię nowego testu i diff. Manifest/wersje nie wymagają zmiany — nie zmieniono zasobów aplikacji.

Nie wykonano i **nie zaliczono**: reset → pełny startup → WYCENA w nowej sesji, świadoma odmowa resetu, przerwanie/restart resetu, test fizycznego telefonu, pełne CI/Actions. Nie istnieje wykonawca resetu, więc testy te nie miały bezpiecznej ścieżki produktu. Nie powtarzano audytu ani wcześniejszych zestawów CI.

### Jeden następny ruch i instrukcja Pixela

Wymagana decyzja właściciela o polityce startu wobec zdalnego stanu: albo osobno zatwierdzony lokalny start z zasadami pierwszego projektu bez synchronizacji, albo użycie istniejących zdalnych globals po zatwierdzonej weryfikacji zgodności. Żaden wariant nie oznacza zgody na usuwanie/nadpisanie Firebase. Nie implementowano żadnego z nich w zastępstwie resetu.

**Czynność na Pixelu po tym pakiecie: żadna operacja resetu nie jest dostępna. Nie czyścić danych witryny ani Chrome ręcznie.** Wydanie samego dowodu STOP nie przywróci startu; najpierw należy rozstrzygnąć powyższy konkretny warunek. Właściciel nie musi ponownie udzielać zgody na utratę wskazanych lokalnych danych testowych.


## Korekta przed wydaniem — 25.10.2026

Wejściowy HEAD `80ade3639c62b9c5c7f6c187432b58d0ece0bc8b`, BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`, ta sama gałąź/worktree. Poniższa korekta aktualizuje historyczne CODE_READY i opis braku przycisku; nie nadaje zgody na wydanie lub dane telefonu.

1. **E — ścieżka przygotowania w panelu, wykonanie BLOCKED.** Dodano wyświetlenie dokładnego SHA-256/klucza, osobną zgodę i potwierdzenie USUŃ STARE ARCHIWUM; przed próbą sprawdzane są faza, źródło, autentyczny dowód pliku, niezmienność sesji/danych i świeży Auth. `writerReadiness()` nie uznaje checkboxa ani pustego wykazu Web Locks za dowód. Obecny LockManager nie enumeruje kart, stary dokument może nie trzymać locka; storage event nie dowodzi braku zapisu/ABA i nie wyklucza przyszłego writera. Brak istniejącego mechanizmu wyliczania i zatrzymania niekooperujących kontekstów oznacza `RECOVERY_WRITER_EXCLUSIVITY_UNPROVEN` **przed jakąkolwiek mutacją etapu E**. W UI nie ma wywołania `activate` na podstawie samego oświadczenia. Nie implementowano nieuzgodnionej zmiany Auth ani nowej infrastruktury przeglądarki dla pozornego PASS. To nie jest ukończenie wykonawczej ścieżki E. Przycisk istniejącego retryInitialBegin pozostaje dostępny tylko po ACTIVE i potwierdzonym zwolnieniu źródła; nie zastępuje wymaganego dowodu sesji.
2. **ACTIVE — naprawione.** Przy braku legacy `sourceHash` może pochodzić z zachowanego źródła migracji także w ACTIVE. To identyfikator pochodzenia, a nie skrót wszystkich aktualnych kopii. Manifest obejmuje pełny bieżący `archive.records`, revision/control/source i ich hash; każdy rekord jest sprawdzany przez decode/SHA/metadane przed eksportem. Weryfikacja pliku ponownie sprawdza aktualny IDB; nowa rewizja albo uszkodzony rekord odmawia. Jedyny dopuszczony między eksportem a weryfikacją przyrost to dokładna COPIED kopia RAW już zabezpieczonego w pliku; nie nowszy ACTIVE. Nigdy nie odtwarza się legacy klucza.
3. **Diagnostyka — naprawione.** Osobny opt-in sessionRecovery zachowuje Kopiuj raport oraz dodaje Tryb ratunkowy wyłącznie dla autoryzowanego READ_ONLY. Otwieranie panelu nadal ponownie sprawdza niemodyfikowalny owner gate. Odmowa nie daje przycisków odczytu danych.
4. **Pełna quota — potwierdzone STOP.** Natywny QuotaExceededError znacznika daje ARCHIVE_ROUTE_QUOTA; no-op/nieudany read-back daje ARCHIVE_ROUTE_UNCONFIRMED. Źródło, projekty, historia i sesja pozostają, removeItem nie jest wywołane. Journal SWITCH_PENDING zachowuje barierę. Nie dodano czyszczenia cache: nie wykazano, że jest konieczne na Pixelu, i brak zatwierdzonego dowodu odtwarzalności. Odmowa nie wyzwala cleanupu.

### Pliki korekty

- `BACKUP.md`
- `CURRENT_STATE.md`
- `dev_tests.html`
- `index.html`
- `js/app/shared/backup-archive-idb.js`
- `js/app/shared/storage-recovery-export.js`
- `js/app/ui/info-box.js`
- `js/app/ui/session-diagnostics.js`
- `js/app/ui/storage-recovery-panel.js`
- `tools/reports/android-storage-recovery-indexeddb-v1.md`
- `tools/script-versions.js`
- `tools/session-diagnostics-screen-smoke.js`
- `tools/storage-recovery-browser-smoke.js`
- `tools/storage-recovery-repair-browser-suite.js`
- `tools/storage-recovery-repair-smoke.js`

### Celowane regresje korekty i CI

Nowy `tools/storage-recovery-repair-smoke.js` uruchamia **wyłącznie sześć nowych grup** przez tryb --repair-only istniejącego runnera Chromium. Stare 18 grup i wcześniejsze smoke pozostają w CI; nie uruchamiano ich ponownie lokalnie. Nowe przypadki: diagnostyka→Copy/Recovery i odmowa Auth; pełne zgody E przy braku technicznej wyłączności i niezmienność RAW/RAM/IDB; quota/no-op/błąd odczytu znacznika; ACTIVE z nowymi kopiami i kontrolą faktycznego payloadu po odszyfrowaniu; korupcja SHA i stara rewizja pliku; eksport ACTIVE po restarcie. Niskopoziomowe testy `activate` zakładają kontrolowany jednorazowy profil, nie certyfikują wyłączności starej karty Pixela.

Nowy smoke jest automatycznie wymagany w bieżącym Preflight przez istniejące wykrywanie *-smoke.js. Dwa życia dokumentu, realny Chromium/IndexedDB, viewport393×852; całość HTTP aplikacji spełniana lokalnie, bez LIVE. Testy nie tworzą warunku pomijania przeglądarki. Zachowano oryginalny tryb/stare zestawy runnera i workflow. Wersje pięciu zmienionych skryptów są ścisłe i zgodne w obu HTML; centralny script-versions obejmuje również nowe zależności. Usunięto dawny twardy token info-box w kontroli ekranu na rzecz tej samej ścisłej mapy — nie luźnej obecności tekstu. Skorygowano rzeczywistą zależność CI ujawnioną przy zmianie wersji. Pełnego Preflightu ani emulatorów nie wykonywano.

**Faktycznie wykonane dla korekty:** nowy repair-only Chromium/IndexedDB **6/6 grup PASS** (dwa życia dokumentu, viewport393×852); składnia wszystkich **10** zmienionych/nowych JS PASS; ścisłe wersje obu HTML i kontrola kolejności PASS; diff --check PASS. Bieżący test graniczny CLOUD PASS z oczekiwanymi odmowami C42_SOURCE_CHANGED/C46C_DEPENDENCY_CHANGED oraz bez IO; cloud-ci-impact zgłosił wpływ bez aktualizacji manifestów. Pusty diff potwierdza brak zmian Auth, sesji, projektu, CLOUD/Firebase, historycznych manifestów i workflow. Poprzednich 18 grup, APP110, pełnego Preflightu ani emulatorów nie ponawiano lokalnie. Brak operacji na Pixelu.

**Wynik korekty:** `CODE_BLOCKED_WRITER_EXCLUSIVITY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED`. Nie wolno traktować tej gałęzi jako gotowego kompletnego pakietu odblokowania telefonu. Pozostałe trzy luki naprawione; domknięcie E wymaga uzgodnienia bezpiecznego mechanizmu koordynacji wszystkich kontekstów albo zmiany zakresu. Nie rekomendujemy USB/konsoli, odświeżenia niezabezpieczonej karty, resetu ani wywoływania API ręcznie. Nie uzyskano zgody na operacje danych lub LIVE.


## Zakres i stan

BASE/main potwierdzony przez GitHub: `9c6ad2263850868e37c0cdb9098dfe6047a39260`; drzewo identyczne z zakończonym PR #82 (`85a11e00e37e32a5111a0f1f2470f3732c8559ae`). Nowa gałąź `fix/android-storage-recovery-indexeddb-v1`, worktree `/workspace/android-storage-recovery`. Nie było rozpoczętej gałęzi poprzedniego ANDROID EMERGENCY RECOVERY v1; nie duplikowano jej implementacji. Pozostałe istniejące worktree zachowano bez zmian.

Właściciel wskazał największy klucz: `fc_data_backups_v1`, 3 317 250 z 5 217 379 jednostek UTF-16 (~63,6%). To archiwum, nie bieżący projekt. Rozmiar tekstu nie ustala quota przeglądarki. Pierwszy zakres dotyczy wyłącznie tego archiwum; nie migruje historii ofert, projektów, katalogów ani cenników.

**STORAGE RECOVERY / INDEXEDDB — PRIORYTET 1. CLOUD / CLOUD-4.6F / FIREBASE LIVE / rozwój SYNCHRONIZACJI — WSTRZYMANE do nowej decyzji.** Zachowano kod, manifesty, Rules, podpisy, CAS, wcześniejsze wyniki i przyszłe plany. Nie zmieniono bramek wydania ani Auth. Priorytet zapisano w CURRENT_STATE, ROADMAP, CLOUD_MIGRATION, CLOUD_DATA_REGISTER i BACKUP.

Status przygotowania: **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Nie wykonano operacji na telefonie, migracji danych właściciela, usunięcia starego klucza, PR, wydania ani LIVE. HEAD przekazania znajduje się w raporcie końcowym/GitHubie, aby uniknąć samoodnoszącego SHA w commicie.

## Model i jeden aktywny magazyn

Nowa biznesowa baza **`meble-business-backups-v1`, version 1**. Nie otwiera i nie modyfikuje bazy profilu `meble-access-profile-v1` ani Firebase Auth.

| Store | Klucz | Zawartość |
|---|---|---|
| `records` | `id` | Dotychczasowe ID backupu; oryginalny fragment JSON elementu (`raw`), SHA-256 UTF-16LE, grupa app/test, pinned/safe-state i createdAtMs. Metadane są porównywane z RAW. Nie powstaje nowy identyfikator kopii. |
| `sources` | `sha256` | Jednorazowy, dokładny RAW całego historycznego archiwum. Zachowuje białe znaki, historyczne notacje liczb, nieznane pola i jednostki UTF-16; nie jest rosnącym bieżącym autorytetem. |
| `control` | `archive` | `schema:1`, phase COPIED/SWITCH_PENDING/ACTIVE, sourceHash, count, revision; po rozpoczęciu E także hash sprawdzonego pliku. |

Odczyt sprawdza dokładny schemat store, liczbę rekordów kontrolnych/źródeł, stan i integralność. Nieznana wersja/korupcja nie staje się pustą listą. Przy braku bazy sam odczyt nie tworzy jej przez `open()`. Potrzebna jest obsługa `indexedDB.databases()` i Web Locks; ich brak to jawny blocker.

Wszystkie nowe writery archiwum używają tego samego Web Lock (exclusive/ifAvailable) oraz sprawdzają źródło i rewizję. IDB potwierdza **transaction complete**, nie pojedynczy request success; następnie następuje niezależny read-back po zamknięciu/otwarciu połączenia. Nieudany insert/abort nie usuwa wcześniejszych rekordów. Nowy backup zapisuje tylko nowy/zmieniony rekord i mały stan kontrolny; nie przepisuje źródłowego archiwum ani wszystkich niezmienionych kopii.

Po E mały localStorage marker **`meble_backup_archive_backend_v1`** (`{"v":1,"backend":"indexeddb"}`) uniemożliwia cichy fallback po utracie IDB. Musi się zmieścić i przejść read-back **przed usunięciem źródła**. Jeśli nie, STOP: pozostają źródło i SWITCH_PENDING. Marker nie jest biznesowym snapshotem, nie nadaje uprawnień i nie jest przywracany przez standardowy import. Utrata obu magazynów nadal wymaga niezależnego pliku; IDB nie jest gwarancją przed ewikcją.

## Tryb ratunkowy i migracja A–D

Przycisk dodano wyłącznie do istniejących komunikatów sesji z opt-in `sessionDiagnostic`. Obok Diagnostyki sesji i OK pojawia się **Tryb ratunkowy**. Panel jest własnym nakładanym widokiem w tej samej karcie, bez nawigacji projektowej. Oferuje diagnostykę, bezpieczne podsumowanie archiwum, szyfrowany eksport, ponowny wybór pliku bez importu, kopiowanie do IDB, ocenę przygotowania i zamknięcie.

Diagnostyka/podgląd nie wykonują begin/commit/cancel, recovery, uiState writerów, backupu, lokalnych zapisów ani prób quota. Kopiowanie C zapisuje wyłącznie nową biznesową IDB. Panel i wszystkie operacje wymagają istniejącego niemodyfikowalnego `__FC_MAIN_ACCESS__.isValid()`, także po asynchronicznych etapach. Cofnięcie/wygaśnięcie dostępu daje STOP. Błędy panelu mają wyłącznie zamknięty techniczny kod, bez treści RAW/wyjątku.

A. Ścisły odczyt tablicy archiwum; brak filtrowania uszkodzonych elementów do pozornego sukcesu. Unikalne ID, snapshot v1 lub rozpoznany stary format bez kind/version, keys o wartościach string/null, znane typy metadanych. Nieznany format/wersja/duplikat blokuje kopiowanie, ale pozostaje dostępny w prywatnym RAW eksporcie.

B. Eksport ratunkowy: wszystkie biznesowe `fc_*` i pięć aliasów hardware z localStorage i sessionStorage, rozpoznana biznesowa IDB, znane dane RAM projektu/UI/dowodów sesji oraz kontrolki biznesowe. Bez tworzenia nowej kopii w localStorage. Manifest wskazuje obecność i wykluczenia, zakres CURRENT_DOCUMENT_BUSINESS_RAW, długości i SHA-256 każdego RAW, hash RAM/IDB i samego manifestu. Nierozpoznana domena, błąd, zmiana pomiaru albo brak inwentaryzacji blokują kompletność. Nie oznaczamy niedostępnego RAM innych kart ani całej sterty JS jako zabezpieczonych.

Plik jest szyfrowany Web Crypto **AES-256-GCM** (IV12/tag128, losowy salt16, PBKDF2-SHA256 310000 iteracji, minimum12 znaków hasła). Biznesowy RAW, plaintext i ich hashe używają jawnego UTF-16LE code units, bez strat samotnych surrogatów przez TextEncoder; SHA-256 całego pobranego kontenera liczymy z rzeczywistych bajtów UTF-8/ASCII. Hasło do KDF kodowane UTF-8. Tag GCM chroni zawartość, osobny SHA-256 identyfikuje dokładne bajty pobranego kontenera; odczyt przez ArrayBuffer odrzuca BOM i nieprawidłowe kodowanie zamiast cicho je normalizować. Losowe parametry i hasło nie są zapisywane w aplikacji. Sekrety biznesowe, np. ORS, mogą być w środku; plik/hasło pozostają prywatne, nie trafiają do GitHuba/czatu/chmury. Nie ma eksportu ani odtwarzania poświadczeń/grantów.

Przycisk weryfikacji odczytuje faktycznie ponownie wybrany plik, porównuje hash, odszyfrowuje, weryfikuje tag, manifest, zakres/RAW i aktualne źródło. Nie importuje żadnej wartości. Dowód jest prywatną WeakMap capability tej karty — fałszywy obiekt z identycznymi polami nie jest akceptowany. Po restarcie wymagana jest świeża kompletna kopia/ponowna weryfikacja, nie flaga localStorage.

C. W jednej transakcji zapis wszystkich rekordów, dokładnych fragmentów i całego źródła oraz journalu COPIED. Bez sanitizera, normalizacji, retencji lub kasowania. Weryfikacja po nowym otwarciu sprawdza liczbę, ID, RAW, SHA i metadane. Źródło nadal istnieje. Po COPIED zwykłe writery archiwum są zamrożone, aby przygotowanie nie unieważniało się samo.

D. Raportuje zgodność IDB, źródło, dowód pliku, liczbę kopii/grupy/ochronę i potencjalnie zwalniany rozmiar tekstu. Nie ogłasza odzyskania quota ani odblokowania edycji.

## Etap E — zaimplementowany handler, brak zgody na telefon

**Bieżący panel nie zawiera przycisku aktywowania/usuwania archiwum.** `backupArchive.activate(decision, receipt)` jest przygotowaniem przyszłego świadomego etapu, wywoływanym wyłącznie w testach syntetycznych. Nie jest instrukcją wykonywania kodu przez właściciela. Późniejsza czynność interfejsowa wymaga osobnej, konkretnej zgody.

Handler wymaga jednocześnie: świadomej decyzji dla dokładnego `fc_data_backups_v1` i sourceHash, potwierdzenia zamknięcia innych writerów, Web Lock, świeżego Auth, pełnej zgodności lokalnej kopii, autentycznego dowodu ponownie odczytanego niezależnego pliku i niezmienności biznesowego świadectwa przed operacją. Kolejność: trwały SWITCH_PENDING → ponowny odczyt i kontrola → mały marker z read-back → usunięcie dokładnego źródła → odczyt braku → trwały ACTIVE i read-back. Brak któregokolwiek dowodu blokuje działanie.

Nowy kod koordynuje swoje karty Web Lockiem. **Stare dokumenty sprzed tego protokołu nie respektują nowej blokady**; aplikacja nie dowodzi ich nieobecności samą nazwą locka. Potrzebne jest świadome rozstrzygnięcie innych kart i zabezpieczenie ich RAM. Jeśli pozostaje nierozpoznany writer, E pozostaje BLOCKED. Nie używa się automatycznych odświeżeń, wymuszonych logowań, konsoli, USB lub bookmarkletów.

| Przerwanie | Stan bezpieczny / następne działanie |
|---|---|
| Przed lub w transakcji kopiowania | Źródło bez zmian, przerwane żądania nie tworzą częściowo zatwierdzonego zbioru. Ponowna jawna próba C po kontroli. |
| Po COPIED / restart | Weryfikowalna kopia i źródło, żadnego automatycznego E/cleanup. |
| E przed usunięciem | SWITCH_PENDING + zachowane źródło; writery odmawiają. Nowa kontrola i dowód pliku przed jawnym wznowieniem. |
| E po usunięciu, przed ACTIVE | SWITCH_PENDING + marker + cały oryginalny RAW w IDB; bez automatycznego fallbacku lub przyjęcia pustego archiwum. Świeży plik obejmuje także źródło IDB, potem osobno zatwierdzone wznowienie. |
| ACTIVE, później stary writer | Obecność legacy klucza blokuje nowe zapisy; obcy RAW nie jest usuwany ani scalany. |
| Utrata/korupcja IDB po przełączeniu | Marker i walidacja blokują fallback. Potrzebna prywatna kopia i osobna procedura recovery. |

Dwa przebiegi odczytu nie tworzą transakcji między localStorage, sessionStorage, RAM i IDB i nie dowodzą braku ABA. Nie obiecujemy spójności wobec niekontrolowanego starego writera. Utrata hasła, niekompletny plik, nieznana domena lub nieudowodniona wyłączność pozostawiają blokadę.

## Zgodność API, retencja, sesja

Asynchroniczne metody istniejącego `FC.dataBackupStore`: create/ensure, list/groups/find/update/delete, restore/import, eksport pojedynczej kopii/payloadu, stats/prune. Użytkownicy: Ustawienia (`data-settings-backup-actions`, list, view i modal), osłona `test-data-safety` oraz istniejące regresje project/data-safety. Oczekują na Promise przed sukcesem/reloadem; widok listy odrzuca opóźniony wynik, jeśli użytkownik wrócił do innej sekcji. H.runSuite już oczekuje na Promise testu. Zwykły eksport bieżącego snapshotu pozostaje synchronicznym pobraniem bez zapisu kopii.

`dataBackupStorage.writeStore` odmawia starego zapisu. Synchroniczny kompaktor WYCENY nie może zmieniać archiwum zarządzanego asynchronicznie; inne reguły transportu, obliczeń, historii i cache nie są przebudowywane. Dotychczasowy sanitizer nie usuwa historycznych RAW przy okazji nowego zapisu — to konieczna ochrona kopii. Oryginalny format standardowego eksportu/importu zachowany.

Polityka: 7 dni, minimum10 programu, testowe10, najnowsze3 w każdej grupie oraz pinned/safe-state. Poprawiono ochronę przypiętych/bezpiecznych kopii testowych, które poprzednie slice mogło zgubić ponad limitem. Nie uruchamia się retencji podczas migracji. Po zwykłych zapisach przechowywane niezmienione rekordy nie są ponownie serializowane.

Osobny przycisk kontroli sesji po zatwierdzonym E najpierw wymaga ACTIVE i braku starego źródła, odczytuje diagnostykę, a następnie wywołuje jedynie istniejący `retryInitialBegin`. Musi otrzymać true i `session.durable:true`. Nie wykonuje commit/cancel ani nie rekonstruuje zamkniętego dowodu baseline. Po pełnym restarcie brak prywatnego świadectwa pierwszego begin nadal może uniemożliwić ponowienie; nie omijamy tej odmowy.

## Weryfikacja i odpowiedzialność CI

Celowane kontrole przygotowania:

- `node tools/storage-recovery-smoke.js`: 5 grup — jednostki UTF-16/hash i formaty, rzeczywiste Web Crypto/file re-read, Pixel-like pełny magazyn i odmowy, pinned/safe retencja, rzeczywisty protokół sesji przy quota i nowszej rewizji. Spies blokują wszelkie próby zmiany źródła.
- `node tools/storage-recovery-browser-smoke.js`: obowiązkowy rzeczywisty Chromium + IndexedDB, profil jednorazowy, mobilne 393×852, dwa rzeczywiste taby i pięć żyć dokumentu. Używa wyłącznie syntetycznego immutable access fixture; nie jest testem serwerowego Google Auth. Każdy request aplikacji spełniany lokalnie; nieznany ruch odmawia. Obejmuje abort quota/utratę Auth, migrację ~3,1M jednostek, zachowanie wszystkich RAW i ochrony kopii, pobranie pliku na dysk i ponowną weryfikację, jawne odmowy E, przerwania przed i po usunięciu, restarty, pojedynczy nowy rekord po aktywacji, legacy writer oraz utratę IDB. Mutacje w testach dotyczą wyłącznie profilu jednorazowego.
- `app-dev-smoke.js`: 110/110 — celowane sprawdzenie rejestracji po zmianie listy ładowania, nie cały Preflight.
- `wycena-quote-history-storage-maintenance-smoke.js`: celowana regresja dostępu synchronicznego kompaktora do archiwum. Oczekiwanie automatycznego skracania backupów zastąpiono dokładną odmową quota, niezmiennością całego RAW i poprawnym zapisem po syntetycznym ustąpieniu presji; ceny i pozostałe granice historii bez zmian. Test zachowuje kontrolę cache-bustingu.
- Składnia wszystkich zmienionych JS, kolejność ładowania, ścisłe wersje nowych/zmienionych skryptów produkcyjnych w obu HTML (testy dev-only w dev manifest), diff check.
- `cloud-ci-impact.js --base 9c6ad2263850868e37c0cdb9098dfe6047a39260 --json`: wpływ na historyczne zależności zgłoszony, manifesty niezmienione. Bieżący test graniczny nadal odmawia C42_SOURCE_CHANGED oraz C46C_DEPENDENCY_CHANGED propagowanego do D/E, bez IO/LIVE. Pełne historyczne PASS nie jest dowodem dla nowego HEAD.

**Rzeczywiście wykonane:** storage-recovery-smoke 5/5 grup PASS; Chromium/IndexedDB 18/18 grup PASS (w tym pobrany plik, dwie karty, pięć żyć dokumentu, viewport393×852); APP110/110 PASS; kolejność ładowania i ścisłe wersje obu manifestów PASS; bieżąca granica CLOUD PASS z właściwymi odmowami i bez IO. Pierwsze uruchomienie Chromium w domyślnym sandboxie zatrzymało się na setsockopt; właściwe celowane wykonanie uzyskało dostęp do lokalnego kanału testowego i zakończyło się PASS, bez zdalnego ruchu aplikacji. W trakcie reprodukcji poprawiono mapowanie pustego błędu GCM na RECOVERY_DECRYPT_FAILED oraz obsługę lokalnego favicon fixture; nie pomijano asercji. Błędy prób sprawdzania wersji wynikające z błędnego wymagania testów dev-only w index poprawiono w poleceniu kontrolnym, bez zmiany ładowania aplikacji. Pełnego Preflightu, całych emulatorów, Google Auth ani procesu wydania nie uruchamiano lokalnie. Dwa nowe `*-smoke.js` są automatycznie wykrywane w bieżącym kontekście Preflight; real-browser smoke wymaga Chromium i nie daje SKIP/PASS przy braku binarki. Aktualny workflow na ubuntu-latest i Node22 zachowano; istniejące kontrole historyczne/SDK/Rules i bramki auto-merge nadal obowiązują po osobnej zgodzie wydaniowej. Nowa gałąź nie pasuje do izolowanych push-triggerów innych prac. Pełny GitHub Actions i fizyczny Pixel: **CI_PENDING / PHONE_PENDING**.

## Bramka telefonu i następny ruch

Nowa wersja wymaga załadowania nowego dokumentu. **Nie ma dowodu zachowania RAM istniejącej karty Pixela przy odświeżeniu**; nie rekomendujemy jej przeładowania. Eksport z 17.10 nie zabezpiecza obecnego RAM i pomijanych RAW. Sam pakiet ani przyszły PASS CI nie upoważnia do migracji na urządzeniu. Należy osobno zatwierdzić wydanie wskazanego HEAD/BASE, rozstrzygnąć zabezpieczenie obecnego RAM i dopuszczenie załadowania wersji, a dopiero potem działania A–D na telefonie. E wymaga kolejnej decyzji dla dokładnego archiwum, świeżego niezależnego pliku i wyłączności writerów. Nie deklarujemy odzyskania telefonu.

Wieloletnia odporność innych domen i pełny LOCAL-FIRST pozostają dalszymi zakresami. IDB ma limity, może zostać usunięta, a lokalna kopia nie jest chmurą ani gotowym offline. Eksport ma jawne budżety pracy (16Mi jednostek na skanowany magazyn/konserwatywny RAM, 64MiB plaintext, 90MiB plik); ich przekroczenie daje BLOCKED, nie częściowy sukces.

## Końcowa kontrola zakresu

- Składnia **22 zmienionych/nowych JS PASS**, kolejność i ścisłe cache-busting PASS, diff --check PASS.
- Celowana regresja `wycena-quote-history-storage-maintenance-smoke.js` **PASS**; niezmienność pełnego RAW archiwum przy quota oraz zapis historii po ustąpieniu presji potwierdzone, pozostałe cztery kontrole zachowane.
- Odczyt GitHuba ponownie potwierdził niezmieniony BASE/main. Brak zmian AGENTS, kodu CLOUD/Auth, mechanizmu sesji, projektu, historycznych manifestów/Rules i workflow potwierdzono pustym diffem.
- Nowy browser smoke nie jest rzeczywistym testem właściciela/Google Auth ani testem całego startupu: to rzeczywiste komponenty i IDB na syntetycznym profilu. Fizyczny Pixel, pełny Preflight i dotychczasowe obowiązkowe zestawy GitHub Actions pozostają CI_PENDING/PHONE_PENDING.

### Dokładna lista zmienionych plików

- `BACKUP.md`
- `CLOUD_DATA_REGISTER.md`
- `CLOUD_MIGRATION.md`
- `CURRENT_STATE.md`
- `ROADMAP.md`
- `dev_tests.html`
- `index.html`
- `js/app/quote/quote-snapshot-storage-maintenance.js`
- `js/app/shared/backup-archive-format.js`
- `js/app/shared/backup-archive-idb.js`
- `js/app/shared/data-backup-policy.js`
- `js/app/shared/data-backup-storage.js`
- `js/app/shared/data-backup-store.js`
- `js/app/shared/storage-recovery-export.js`
- `js/app/ui/data-settings-backup-actions.js`
- `js/app/ui/data-settings-backup-list.js`
- `js/app/ui/data-settings-backup-view.js`
- `js/app/ui/data-settings-modal.js`
- `js/app/ui/info-box.js`
- `js/app/ui/storage-recovery-panel.js`
- `js/testing/data-safety/tests.js`
- `js/testing/project/tests.js`
- `js/testing/test-data-safety.js`
- `tools/app-dev-smoke-lib/file-list.js`
- `tools/index-load-groups.js`
- `tools/reports/android-storage-recovery-indexeddb-v1.md`
- `tools/storage-recovery-browser-smoke.js`
- `tools/storage-recovery-browser-suite.js`
- `tools/storage-recovery-smoke.js`
- `tools/wycena-quote-history-storage-maintenance-smoke.js`


## Pilna korekta pustej instalacji — 25.10.2026

Zakres: istniejąca gałąź `fix/android-storage-recovery-indexeddb-v1`; wejściowy HEAD `75930632cec1cc30039e8bc43bf425e6624dda64`, BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`. Najnowszy pomiar właściciela dotyczy pustego Pixela (0 inwestorów/projektów, 15 kluczy, 183,9 KiB, ramActive:false/durable:false), a nie wcześniejszego zapełnionego magazynu. Nie wykonywano resetu ani operacji na telefonie.

### Reprodukcja i naprawa

Rzeczywisty Chromium z pełnym index i syntetycznym uwierzytelnionym weryfikatorem: zero rekordów, nieaktywna sesja, lecz hasProjectDivergence i needsClosure zwracały true. Jedyna różnica względem normalize(null) to lazienka.settings.counterThickness: 1,8 zamiast 2. Bridge przy braku centralnego projektu ładuje aktualny DEFAULT, a migracje null mają historyczny default. Kliknięcie Projekty meblowe wywoływało begin bez rzeczywistego właściciela i poprawnie kończyło się SESSION_OWNER_MISSING. Starszy mini-fixture bez produkcyjnych migracji nie ujawniał tej rozbieżności; nowa regresja ładuje rzeczywiste migrate.js.

`hasProjectDivergence()` porównuje aktualny DEFAULT z RAM tylko po ścisłym potwierdzeniu pustego, nieprzypisanego kontekstu. Brak odczytu, malformed store, rekord inwestora/projektu, wskaźnik właściciela, legacy projekt lub trwały/RAM dowód sesji nie są traktowane jako pusta instalacja. Rzeczywista zmiana domyślnego RAM nadal wymaga właściciela i zatrzymuje nawigację; nie ma begin ani zapisu do pustej sesji podczas wejścia do menu/katalogu.

Pełny przebieg ujawnił też odmowę aktywacji pierwszego rzeczywiście utworzonego projektu: dotychczasowy guard odrzucał nieprzypisany RAM różniący się od nowego projektu metadanymi właściciela. Wrapper jawnego create pozyskuje teraz jednorazowy token tylko przed przejściem z pustego magazynu. Aktywacja wymaga niezmienionego domyślnego RAM, braku dowodów sesji, dokładnie jednego zapisanego inwestora i jego projektu oraz zgodności nowego projektu z przygotowanym źródłem. W formularzu dopuszcza wyłącznie ID dokładnego transient draft znanego UI, nigdy dowolny zapisany/stary ID. Istniejąca ogólna kontrola przełączania i aktywnej sesji pozostaje. Nie fabrykuje się właściciela: otrzymuje go wyłącznie rekord utworzony po świadomym Zapisz inwestora.

### Nowe dowody celowane

- `node tools/empty-installation-smoke.js`: **5/5 grup PASS**. Puste null i [] (bez begin/writes), realna niezapisana zmiana RAM i odmowa owner-missing, evidence sesji/stare wskazania/legacy/niepoprawny lub nieodczytywalny magazyn, prawdziwa aktywna sesja i konflikt właściciela bez utraty RAM/RAW, pierwsza aktywacja i odmowa użycia checkpointu po zmianie RAM/sesji/pojawieniu się drugiego właściciela.
- `node tools/empty-installation-browser-smoke.js`: **PASS**, rzeczywisty Chromium, jednorazowy pusty profil, realny pełny shell aplikacji i gate, lokalne syntetyczne odpowiedzi Auth/verifier, viewport 393×852. Dotykowe przejście do menu i katalogu bez tworzenia rekordów/sesji; pełny restart dokumentu; rzeczywisty formularz pierwszego inwestora z potwierdzeniem; rzeczywisty projekt i pomieszczenie; trwała sesja z prawidłowym właścicielem; zmiana wysokości pomieszczenia do 275 cm i Zapisz; potwierdzona wartość centralna i usunięty dowód zamkniętej sesji. Przechwycone wszystkie requesty aplikacji, brak zdalnego IO lub nieobsłużonych błędów. Nie jest to test produkcyjnego Google/telefonu.
- Nowe pliki kończą się `-smoke.js`, więc istniejąca enumeracja tools w Preflight uruchamia je w bieżącym kontekście. Rzeczywisty Chromium jest wymagany — brak binarki powoduje FAIL, nie SKIP. Workflow bez zmian.
- Wersje obu zmienionych modułów produkcyjnych ustawiono zgodnie na `20261025_empty_installation_v1` w index/dev_tests i dodano ścisłą kontrolę w istniejącym tools/script-versions.js. Nie zmieniono kolejności ani listy produkcyjnych modułów.

Pełny Preflight, emulatory i GitHub Actions nieuruchomione; pozostają **CI_PENDING**. Fizyczny Pixel **PHONE_PENDING**. Ta pilna korekta: **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Nie rozwiązuje wcześniejszego **CODE_BLOCKED_WRITER_EXCLUSIVITY** etapu E archiwum. Brak PR, merge, Pages, operacji na telefonie, nowych migracji lub Firebase LIVE. CLOUD i synchronizacja pozostają wstrzymane; historycznych pinów nie aktualizowano.

Końcowa kontrola tej korekty: składnia pięciu zmienionych/dodanych JS PASS, git diff --check PASS, ścisłe wersje skryptów PASS, check-index-load-groups PASS. cloud-ci-impact --base 9c6ad2263850868e37c0cdb9098dfe6047a39260 wskazał nowe chronione zmiany index/runtime/patches; aktualny boundary smoke z odizolowanym, zweryfikowanym drzewem historycznym 306f90a4cfd8bcb4277aa8b4d140e911493ddd60 PASS przez dokładne odmowy CLOUD42_SOURCE_CHANGED i CLOUD46C_DEPENDENCY_CHANGED (C/D/E), bez IO. Nie modyfikowano manifestów, podpisów, Rules, workflow ani kodu chmury. GitHub ponownie potwierdził powyższy BASE i wejściowy HEAD gałęzi przed publikacją commita. Wyniki dotyczą tej celowanej korekty roboczej; nie są pełnym CI ani potwierdzeniem dla telefonu.

Pliki tej korekty (9): CURRENT_STATE.md; index.html; dev_tests.html; js/app/investor/investor-project-runtime.js; js/app/investor/investor-project-patches.js; tools/empty-installation-smoke.js; tools/empty-installation-browser-smoke.js; tools/script-versions.js; niniejszy raport. Poprzednia lista 30 plików opisuje wcześniejszy zakres pakietu.


## Domknięcie nowych backupów i anulowania COPIED — 25.10.2026

Wejściowy HEAD `263a75b30c160952eb3bb72221bc014d6139d190`; niezmieniona gałąź `fix/android-storage-recovery-indexeddb-v1`, BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`, potwierdzone przez GitHub. Zakres obejmuje wyłącznie dwa nowe wymagania właściciela, ich wersjonowanie/regresje i dokumentację. Nie ponawiano diagnozy SESSION_OWNER_MISSING ani zaliczonych regresji.

### Nowe archiwum — bez legacy fallbacku

Pierwszy zapis przy nieobecnym fc_data_backups_v1, journalu i markerze tworzy INITIALIZING (`origin:fresh`, source `[]`, count0, revision0) w atomowej strict transakcji sources/control. Odczyt po zamknięciu bazy, zapis i read-back małego routingu, CAS do ACTIVE, ponowny odczyt, dopiero potem transakcja pierwszego backupu. Bez automatycznych operacji przy samym odczycie lub starcie. Awaria pozostawia albo pustą bazę, albo pusty INITIALIZING do wznowienia przy jawnym zapisie, albo ACTIVE bez niepotwierdzonego rekordu. Potwierdzony marker nie jest ponownie zapisywany przy wznowieniu. Późniejsze rekordy zapisuje dotychczasowa metoda atomowa mutate; stare RAW nie są ponownie serializowane. Brak IDB przy markerze lub obcy legacy writer odmawiają bez odtwarzania starego klucza. Quota/odmowa Auth nigdy nie zaliczają backupu. INIT nie jest wznowieniem SWITCH_PENDING i nie usuwa danych historycznych.

### COPIED — wybrana ścieżka bezstratnego anulowania

API cancelCopy(decision) oraz przycisk „Anuluj przygotowanie migracji — zachowaj obie kopie”. Decyzja zawiera dokładny hash i revision journalu, jest chroniona istniejącym Auth oraz wspólnym Web Lock. Sprawdzenie kopii odwołuje się do zachowanego oryginalnego RAW IDB, a źródło aktualne musi być poprawne i niezmienne w trakcie operacji. COPIED → CANCELLED zapisuje atomowo wyłącznie metadane sterujące. Nie usuwa ani nie przepisuje sources/records/localStorage/RAM. Obsługuje też poprawne źródło zmienione wcześniej przez stary writer: aktualne dane pozostają autorytetem, a oryginalny dowód zostaje w IDB. Rutynowe backupy znów używają starego aktywnego archiwum i mogą uczciwie odmówić przy realnej quota. Po restarcie CANCELLED nie wraca do zamrożenia. Snapshot historyczny jest dostępny w pełnym prywatnym eksporcie wraz z bieżącym źródłem. Nie nadpisujemy go ponownym copy zmienionego źródła — SOURCE_CHANGED pozostaje. To realizuje wymaganie anulowania; nie dodano wymiany historycznych dowodów. SWITCH_PENDING/ACTIVE nie mogą skorzystać z anulowania.

Etap E w panelu zachowano z niezmienionym jawnym STOP RECOVERY_WRITER_EXCLUSIVITY_UNPROVEN. Lock serialize'uje kooperujące nowe karty, ale nie dowodzi nieobecności starych writerów; nie udajemy tego dowodu. Nie uruchomiono E, migracji ani usuwania danych właściciela.

### Celowana weryfikacja nowych luk

`node tools/storage-recovery-lifecycle-smoke.js`: **11 grup PASS** w rzeczywistym Chromium/IndexedDB, pięć żyć dokumentu, dwie rzeczywiste karty, mobilne 393×852, syntetyczne dane i access fixture. Nowy tryb --lifecycle-only istniejącego runnera nie uruchamia wcześniejszych zestawów. Pokrywa:

- atomowy abort inicjalizacji na IDB quota, odmowę Auth, pełny localStorage/no-op/read-back markera, prywatny eksport częściowej inicjalizacji;
- restart INITIALIZING, quota pierwszego rekordu bez fałszywego sukcesu, pierwszy i kolejny backup bez choćby próby zapisu legacy lub usunięcia klucza, zachowanie wcześniejszego RAW i zapis wyłącznie nowego rekordu;
- quota/cofnięcie Auth przy mutacji bez zmiany wcześniejszej rewizji, restart ACTIVE, obcy legacy writer i utraconą IDB bez fallbacku;
- zamrożony COPIED, nieaktualną decyzję, brak/nieznane źródło, abort quota/cofnięcie Auth podczas anulowania, zmianę legacy między odczytem i CAS bez nadpisania nowszej wartości;
- jawny przycisk anulowania po restarcie COPIED ze zmienionym wcześniej źródłem, brak usunięcia i brak zmian sesji/RAM/pozostałych RAW, oryginalne metadane i RAW, pełny prywatny eksport obu stanów;
- restart CANCELLED i nadal działające zwykłe backupy, brak niejawnej aktywacji/destrukcyjnego E, busy w innej rzeczywistej karcie dla inicjalizacji i anulowania.

Jedyną adaptacją wcześniejszego zestawu jest jawny seed `fc_data_backups_v1:[]` w teście historycznego API LEGACY: test ma rzeczywiście badać legacy, skoro brak klucza ma teraz nowy kontrakt IDB. Nie usunięto asercji. Poprawiono także barierę przeładowania runnera, żeby potwierdzał nowe życie dokumentu zamiast dawnego już gotowego callbacku.

Nowy *-smoke.js jest automatycznie wykonywany w bieżącym kontekście tools/preflight.js, z wymaganym rzeczywistym Chromium (brak binarki FAIL, nie SKIP). Dotychczasowe zestawy pozostają podłączone; workflow bez zmian. Pełnego Preflightu, poprzednich regresji i emulatorów nie uruchamiano. GitHub Actions i fizyczny telefon pozostają CI_PENDING / PHONE_PENDING.

**Gotowy zakres tych dwóch luk: CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Destrukcyjna migracja historyczna E: BLOCKED_WRITER_EXCLUSIVITY.** Brak PR, merge, Pages, Firebase LIVE oraz operacji na danych właściciela. Nie deklarujemy pełnego odblokowania historycznej instalacji ani testu Pixela.

Końcowa korekta tej samej ścieżki: odczyt INITIALIZING zwraca uczciwą pustą listę wyłącznie dla ściśle zwalidowanego journalu count0/records0/source[]; nie uruchamia żadnej mutacji. Dzięki temu także istniejące ensureCurrentStateBackup, które najpierw sprawdza listę, dochodzi do jawnego retry zapisu po restarcie. Test pierwszego rekordu/quota wykonuje rzeczywiste ensureCurrentStateBackup; nowa regresja sprawdza brak automatycznego wznowienia podczas listowania.

Kontrole końcowe tej korekty: składnia 8 zmienionych/dodanych JS PASS, ścisły wspólny cache-busting trzech modułów w index/dev_tests PASS, git diff --check PASS. tools/cloud-ci-impact.js --base 9c6ad2263850868e37c0cdb9098dfe6047a39260 potwierdził wpływ index/backup-archive-idb/storage-recovery-export/storage-recovery-panel na historyczne CLOUD42_SOURCE_CHANGED; historycznych pinów, manifestów, Rules, Auth, sesji ani workflow nie zmieniono. Nie ponawiano uprzednio zaliczonych testów granicznych CLOUD — wymagany przebieg dla nowego HEAD pozostaje CI_PENDING. Przegląd bieżącego Preflight potwierdził automatyczne podłączenie nowego smoke, nie jest to wykonanie GitHub Actions.

Pliki korekty (13): BACKUP.md; CURRENT_STATE.md; index.html; dev_tests.html; js/app/shared/backup-archive-idb.js; js/app/shared/storage-recovery-export.js; js/app/ui/storage-recovery-panel.js; tools/script-versions.js; tools/storage-recovery-browser-smoke.js; tools/storage-recovery-browser-suite.js; tools/storage-recovery-lifecycle-browser-suite.js; tools/storage-recovery-lifecycle-smoke.js; niniejszy raport. Inne obszary istniejącego pakietu zachowano.

## Backup LOCAL-FIRST i prywatny plan globals — 02.11.2026

**Zapis historyczny pakietu backendowego.** Integrację zatwierdzoną później opisuje sekcja [ANDROID GLOBALS RECOVERY — 03.11.2026](#android-globals-recovery--03112026). Poniższe dawne OWNER_ACCESS_BLOCKED/brak UI nie opisują aktualnego kodu gałęzi; nadal brak kopii właściciela i zgody na rzeczywisty WRITE.

Zakres nowego pakietu: `feat/global-rescue-plan-20261102`, BASE/main **`1f1cb017a818c3bcebc059c8d8d36083da10278d`**, potwierdzony świeżym `git fetch origin main`. HEAD jest jednym końcowym commitem zawierającym ten wpis; pełny SHA w przekazaniu. Obowiązują **CODE_READY / CI_PENDING / BACKUP_PENDING / REPAIR_BLOCKED**. To backend odczytu/kopii i plan, bez implementacji naprawy, uruchomienia UI ani zgody na WRITE. Poniższy opis nie zastępuje historii wcześniejszego eksportu ani kanonicznego CURRENT_STATE.

### Potwierdzone dane wejściowe i granica wiedzy

Właściciel przekazał fizyczny raport Androida: materials/fc_sheet_materials_v1 ↔ fc_materials_v1 **INVALID_SCHEMA / GLOBAL_REQUIRED_FIELD**; labor/fc_quote_rates_v1 ↔ fc_services_v1 **DIFFERENT / GLOBAL_ALIAS_CONFLICT**. Pozostałe pięć par **ONE_MISSING**, co jest dopuszczalnym pojedynczym źródłem. Stock, programDefaults, company i businessCosts **SOURCE_MISSING**. Wszystkie biznesowe RAW oryginałów localStorage są równe istniejącemu obrazowi LOCAL-FIRST. Ta równość warstw nie oznacza równości wewnętrznych aliasów. Initial-global-revision blokuje logowanie.

Nie posiadamy prywatnej kopii właściciela. Nie znamy konkretnych brakujących pól/rekordów, stawek ani definicji labor; nie wpisujemy ich do technicznego raportu. Wymagane pola schematu materiału to id/name/materialType/price/priceUnit, ale nie wolno z tego wnioskować, którego z nich rzeczywiście brakuje na telefonie. Wyłącznie lokalny, prywatny analizator ustali brakujące pola każdego źródła/rekordu. Nie dokonano wyboru katalogu, uzupełnień fabrykami ani WRITE.

### Odrębny odczyt i protokół pliku

Nowe `sync/local-first-rescue-{snapshot,state,ram,file,analysis}.mjs` nie rejestrują się w startupie, runtime, diagnostyce ani UI. `createLocalFirstRescue(context)` wymaga prywatnego kontekstu od uprawnionej integracji: window, zaufany ownerUid/name, oryginalny boot.readNative, bieżący authorize/assertQuiescent, produkcyjny zweryfikowany release oraz odczyt znanego RAM. Domyślny readCurrentBusinessRam odczytuje globalne projectData/uiState, znane dowody FC.session i wartości kontrolek biznesowych; nie inicjalizuje danych. Nieznany/niedostępny RAM lub niewspierane wartości blokują przygotowanie pełnej kopii. RAM innych kart i cała sterta JS nigdy nie są deklarowane jako zabezpieczone.

Odczyt wymaga niemodyfikowalnego, aktualnego `__FC_MAIN_ACCESS__`, potwierdzonego właściciela, poprawnego receipt, zgodnego binding i źródłowego SHA oraz integralności obrazu/rekordów/ACK. Produkcja wymaga autentycznej capability release powiązanej z właścicielem, nazwą, oknem i activationId. Jedyny wyjątek służy istniejącym testom localhost/127.0.0.1 z nazwą meble-lf-test-*. Nie ma ogólnego przełącznika obchodzącego bramki. `authorize` musi w przyszłej integracji potwierdzać rzeczywistą tożsamość, a `assertQuiescent` rzeczywiste zatrzymanie aktywnych operacji; oświadczenie właściciela ani funkcja bez kontroli nie jest dowodem.

Przed i po odczycie używany jest istniejący readonly protokół VERIFY_APPLICATION_AUTHORITY, bez modyfikacji SW/fence. Dodatkowy klient powoduje RESCUE_OTHER_CLIENT. Inventory musi jednoznacznie wskazać istniejącą bazę v1; nieznana baza oznacza STOP, znane bazy Auth są pomijane bez ich otwierania. Nie tworzymy bazy w celu sprawdzenia: upgradeneeded jest abortowane, binding odczytywany przed pobraniem rekordów; wyłącznie transakcje readonly. Pełne dwa pomiary baz, źródeł, sessionStorage i RAM muszą być zgodne; gate jest sprawdzany również po await. Limit pojedynczego snapshotu 15 s zamyka połączenia/abortuje odczyty, a przekroczenie rozmiaru odmawia zamiast obcinać dane. Limity: 8 Mi jednostek RAW na każdy Web Storage, 250 tys. węzłów i konserwatywny budżet 32 Mi jednostek serializacji, plaintext do 64 MiB, plik do 90 MiB. To granice backendu, nie dowód pomieszczenia realnego telefonu w RAM; wyczerpanie zasobów wymaga STOP.

Kopia obejmuje:

- Wszystkie obecne biznesowe fc_* i pięć historycznych hardwareSuppliers/hardwareSettings/hardwareCategories/hardwareTypes/hardwareTechnicalParams z **fizycznych** oryginałów, receipt i marker archiwum. Nie czyta podstawionego obrazu przez wirtualne localStorage.getItem. Chroni projekty, inwestorów, katalogi/cenniki, zamienniki, drafty, historię i kopie znajdujące się w tych magazynach. Nieznany inny klucz powoduje odmowę, nie ciche pominięcie. RAW zachowuje code units, w tym samotne surrogaty i historyczne niepoprawne JSON.
- Wszystkie rekordy control, protected, replicas i outbox z pełnymi polami, wersjami, JSON/hash, expected/receipt i fazami queued/inflight/uncertain/verified/blocked/conflict. Nie retry'uje operacji i nie zmienia faz; sprawdza integralność oraz obecność protected dla outboxu.
- Istniejące archiwum meble-business-backups-v1: całe control/records/sources, źródłowy RAW, bieżącą rewizję i rekordy. Kontroluje kontrakty faz/markera/count/SHA/decode; dla kopii przed ACTIVE również dokładne fragmenty historycznego źródła. Nie inicjalizuje archiwum, nie przełącza trasy, nie migruje.
- Dostępne biznesowe sessionStorage i znane niezapisane dane bieżącego dokumentu. Poświadczenia Auth i znane lokalne tokeny/granty nie są biznesowym backupem; pozostają wykluczone. Inne karty/RAM/cloud/odtwarzanie autoryzacji są jawnie poza gwarancją.

Rozszerzenie `storage-recovery-export.js` dodaje tylko oddzielny privateCodec oparty na istniejących funkcjach AES-256-GCM/PBKDF2-SHA256 310000, salt16/IV12/tag128 oraz UTF-16LE. Osobne kind i AAD `meble-app-local-first-rescue-v1` zapobiegają pomyleniu protokołów. Dotychczasowe prepare/verify/download/readFile oraz stare inventory pozostają niezmienione — **stary eksport nadal odmawia dla LOCAL-FIRST**, co ma nową asercję regresyjną. Hasło, plaintext i szczegóły nie są logowane ani przesyłane. Plik może zawierać prywatne sekrety biznesowe wewnątrz szyfrogramu; nie wolno publikować pliku lub hasła. Brak backendu sieciowego, uploadu, importu, restore, migracji czy synchronizacji.

### BACKUP_PASS wymaga rzeczywistego pliku

1. prepare(password) robi snapshot, manifest integralności każdego RAW i rekordu, RAM i całego zestawu, szyfruje, ponownie sprawdza źródła i zwraca niepodrabialny token **BACKUP_PENDING**. Token ujawnia wyłącznie SHA zaszyfrowanego pliku, nie plaintext.
2. download(token) ponownie sprawdza aktualność i uruchamia pobranie `meble-app-local-first-rescue.encrypted.json`. Nadal **BACKUP_PENDING**. Brak miejsca/anulowanie/brak ukończenia nie jest sukcesem, nawet jeśli a.click nie zgłosi wyjątku.
3. verifySelection(input,event,password,token) akceptuje tylko podłączony natywny input[type=file], rzeczywisty zaufany event change i natywny FileList. Odczytuje wybrany File przez istniejący readFile/ArrayBuffer, weryfikuje bajtowy SHA kontenera, GCM/hasło, manifest i wszystkie zabezpieczone wartości oraz wykonuje świeży bezpieczny pomiar. Fałszywy obiekt, Blob z przygotowania, dispatchEvent lub samo rozpoczęcie pobierania nie daje dowodu. Zmiana bieżących trwałych danych oznacza STOP/RESCUE_SOURCE_CHANGED.
4. Dopiero plik identyczny z przygotowanym zestawem i nadal zgodny ze wszystkimi źródłami bieżącego dokumentu daje prywatną capability **BACKUP_PASS** w WeakMap. Odczyt/odszyfrowanie pliku nie zapisuje niczego do aplikacji.
5. Ponowny natywny wybór pliku po restarcie może działać bez tokenu przygotowania. Jeśli trwałe źródła pasują, lecz zaginął/zmienił się RAM lub sessionStorage, wynik **FILE_VERIFIED_STALE / completeWithinScope:false** daje wgląd do zabezpieczonego dawnego zestawu; nie jest pełną aktualną kopią ani zgodą na naprawę. Brak RAM blokuje przygotowanie nowego pełnego pliku.

W technicznym summary występują jedynie zamknięte statusy i flagi zakresu; prywatne analyzePrivate/simulate wymagają autentycznego dowodu pliku oraz aktualnego gate. Nie są wywoływane przez istniejące Kopiuj raport. Dane prywatne nigdy nie powinny trafiać do anonimowego raportu, logów, CI ani ChatGPT.

### Prywatne różnice i deterministyczny plan bez wykonania

Analizator pracuje na danych zweryfikowanego pliku, oddzielnie dla oryginałów i aktywnego obrazu; dodatkowo porównuje obie warstwy. Zachowuje cały RAW/rekordy i wszystkie nieznane pola. Dla materiałów wskazuje per źródło/per indeks brakujące wymagane pola, ID, kod schematu, jednostki w istniejących polach, ceny i historyczne akcesoria. Nie traktuje mieszanego katalogu jako czystego płytowego. Zgodność semantyczna, RAW, obecność źródła i aktualny schemat są odrębnymi ocenami. Rekordy bez ID lub z duplikatem wymagają decyzji; nie są wyrzucane ani dopasowywane arbitralnie po nazwie.

Dwukierunkowe porównanie materiałów i labor wykazuje rekordy wyłączne po lewej/prawej, duplikaty/nieidentyfikowalne rekordy, kolejność oraz różnice wszystkich własności i struktur zagnieżdżonych, w tym cen, norm, quantity modes, progów i definicji czynności. Labor osobno sprawdza schematy rekordów, kody stawek godzinowych i nierozwiązane referencje. Żadnego zaokrąglania, defaultów lub wyboru najnowszego/najdroższego katalogu. Oryginalne zapisy liczb pozostają w RAW; przyszłe decyzje nie mogą polegać wyłącznie na projekcji JSON Number przy historycznych formatach/utracie precyzji.

Dla wszystkich 14 domen wykorzystywana jest istniejąca diagnostyka i walidatory/dependency closure — również sprzęt, dostawcy, ustawienia i źródła wyceny. Pięć prawidłowych fallbacków jest oznaczane jako OPTIONAL_ALIAS_ABSENT, cztery całkowite braki jako CONTROLLED_INITIALIZATION_REQUIRED, a schematy/formaty/referencje osobno. Plan zawiera decyzje schematów, właściciela, inicjalizacji oraz walidacji dla **obu** warstw. Nie ukrywa błędu danych pod brakiem źródła.

simulate(receipt,explicitCandidate) przyjmuje wyłącznie jawnie przygotowany, kompletny zestaw 14 domen i wywołuje pełne istniejące validateBundle(). Nie buduje kandydata z konfliktujących aliasów ani fabryk. Nie usuwa nieznanych pól; aktualny kontrakt może je odrzucić — konieczna jest wówczas kontrolowana kompatybilność, nie utrata informacji. Wynik VALIDATION_ONLY zawsze ma writeApproved:false; zależności materiałów magazynu/defaults wymagające runtime nadal blokują dowód równoważnej WYCENY. Nie ma apply/execute/restore ani wywołania completeMissingApplicationGlobals().

Wymagana kolejność przyszłej naprawy (obecnie **REPAIR_BLOCKED**):

1. Wykonać i prywatnie niezależnie zweryfikować kompletny plik właściciela przy niezmienionych źródłach i znanym RAM. Utrwalić bazowy receipt/binding/release, image version/hash i dokładny stan całego outboxu. Dowód syntetyczny nie zastępuje tego kroku.
2. Zestawić jawny, lokalny rejestr decyzji dla każdego brakującego/niepoprawnego pola materiału i każdego historycznego formatu/akcesorium. Nie odgadywać priceUnit/materialType/ID na podstawie nazwy. Rozszerzenie zgodności schematu musi zachować stare RAW i pola; jeśli brakuje jednoznacznej informacji — decyzja właściciela.
3. Dla labor i każdej innej sprzecznej pary właściciel rozstrzyga każdy konflikt rekordu/pola/ceny/ID/ref. Rekordy unikalne, historyczne pola, zamienniki i indywidualne stawki muszą mieć jawne miejsce w docelowym modelu lub bezstratnym chronionym obrazie. Nie wykonujemy automatycznego merge, nadpisania aliasu ani normalizacji. Zbieżność aliasów po naprawie musi być dowiedziona, nie zadeklarowana.
4. Wyłącznie dla potwierdzonych czterech całkowitych braków zatwierdzić konkretne wartości/fabryki i ich zależności. Missing nie oznacza zgody na puste []/{} lub domyślne koszty. Nie inicjalizować domeny, która ma poprawny pojedynczy fallback. Zatwierdzić kompletny jawny kandydat i pełne validateBundle + runtime resolution + porównanie WYCENY/reference/ID/stawek/zamienników. Sama walidacja schematu nie dowodzi bezstratności.
5. Osobny pakiet WRITE musi wykazać bieżący owner/gate/release, jednego edytora, brak innych writerów i zatrzymany scheduler/edycję bez utraty RAM. Zachować istniejący writer-fence. Dla inflight/uncertain niezależnie ustalić stan ACK bez retry i bez czyszczenia kolejki; nierozstrzygnięte ACK blokuje naprawę. Nie wymuszać Auth/fatal ani przejęcia sesji.
6. Zaprojektować atomowe zatwierdzenie **całego** obrazu/aplikacji i powiązanego outbox/protected z CAS na dokładną wersję/hash/receipt, z niezmienionymi fizycznymi oryginałami. localStorage i IDB nie tworzą wspólnej transakcji: nie udawać atomowości dwóch magazynów. Ewentualna przyszła zmiana również oryginałów wymaga osobno zatwierdzonego, odpornego na przerwanie journalu i kolejności recovery, bez pół-potwierdzonych aliasów. Brak takiego dowodu = STOP.
7. Na syntetycznych odpowiednikach wykazać abort quota/CAS/cofnięcia Auth i awarię w każdym punkcie granicznym; restart, offline, zachowanie ID/RAW/nieznanych pól/wszystkich cen oraz brak wysłania starej kolejki. Plan rollbacku musi zachowywać oryginały i chroniony preimage. Nie cofać automatycznie potwierdzonego ACK i nie odtwarzać starego outboxu powodującego powtórny WRITE. Po restarcie read-back/pełna walidacja/zgodność aplikacji muszą zostać potwierdzone przed wznowieniem.
8. Właściciel zatwierdza osobno dokładny artefakt i zakres rzeczywistego WRITE oraz rollback. Obecny pakiet nie udziela tej zgody i nie implementuje wykonania.

### Android i minimalna propozycja dostępu — niezaimplementowana

**Gotowość kodu: tak; gotowość użycia obecnego UI w fatal: BLOCKED.** Initial-global-revision kończy się fatal/cofnięciem main gate. Istniejący Tryb ratunkowy wymaga nadal ważnego gate i ma stary, celowo odmawiający eksport. Nie ma bezpiecznej istniejącej ścieżki pozwalającej właścicielowi wykonać nowy eksport w tej sytuacji. Nowe ESM nie są importowane przez produkt; samo wydanie tego kodu nie doda dostępu. Nie zmieniono main-login, Auth, fatal ani panelu, nie dodano przycisku.

Minimalna propozycja do **odrębnego zatwierdzenia UI i dostępu**: wykorzystać obecny panel ratunkowy w tej samej karcie, z jasno wydzieloną akcją pełnego eksportu LOCAL-FIRST i istniejącym wzorcem hasło → pobierz → wybierz ten sam plik → weryfikacja. Wejście z błędu startu wymaga osobno sprawdzonej capability wyłącznie do odczytu, po poprawnym uwierzytelnieniu tego samego właściciela, poprawnym receipt/binding/release i potwierdzeniu braku innych writerów. Nie wolno reaktywować cofniętego main gate, odblokować fatal/edycji, inicjalizować baz, startować migracji/replication ani podstawić fikcyjnego authorize/assertQuiescent. Integracja musi bezpiecznie dostarczyć readNative i znany RAM bieżącej karty; jeśli przy fatal nie da się tego dowieść, pozostaje STOP. Dostosowanie wejścia/gate do takiej rzeczywistej capability jest osobnym, niewykonanym zakresem. Nie zakładamy, że samo wyświetlenie panelu rozwiąże tę bramkę.

Po osobnej zgodzie i wdrożeniu tej integracji test właściciela na Androidzie powinien: zachować aktualną kartę/RAM, nie czyścić Chrome; potwierdzić właściwe konto i jedną kartę; pobrać zaszyfrowany plik do prywatnego miejsca, zachować hasło osobno; natywnie ponownie wybrać **ukończony pobrany plik**, odszyfrować i sprawdzić pełny zakres. Nie wysyłać pliku/hasła/szczegółów do czatu. Skopiować wyłącznie anonimowy status. Sprawdzić lokalnie różnice materiałów/labor i nie wykonać naprawy. Każdy BLOCKED/brak RAM/zmiana źródeł oznacza zatrzymanie odpowiedniego etapu; nie refresh, konsola, USB ani bookmarklet. Obecnie tej procedury na urządzeniu nie wykonano, nie deklarujemy BACKUP_PASS.

### Celowane dowody i obowiązkowy routing CI

Wyłącznie dane syntetyczne, Node **24.19.0**, Chromium **151.0.7922.173**. Lokalnie uruchomiono tylko poniższe celowane zestawy i statyczne kontrole; nie pełny Preflight/Firebase/Actions. Wyniki odnoszą się do roboczego drzewa finalnego jednego commita, nie są CI_PASS.

| Zestaw | Rzeczywisty wynik | Obowiązkowy CI |
| --- | --- | --- |
| local-first-rescue-smoke.js | **8/8 PASS**: pełne 4 store/RAW/5 aliasów/session/RAM, integralność ACK/archiwum, gate/identity/receipt/binding, unknown DB/upgrade, uszkodzone hashe/schema, zmiany/autoryzacja/2. klient/busy, brak RAM/rozmiar, download failure/niepełny plik/złe hasło/manifest/SHA/odczyt, natywny getter FileList, dowód tylko po weryfikacji, restart/stale, brak WRITE; stary eksport nadal odmawia LF | preflight-shards **4/7** |
| local-first-rescue-analysis-smoke.js | **4/4 grupy PASS**: 14 domen/7 par obu warstw, wymagane pola, historyczne akcesoria/unknown, dwukierunkowe rekordy/ID/ceny/normy/quantity modes, 5 fallbacków/4 braki, JSON/duplikaty/niekanoniczne Unicode, deterministyczny plan i pełna jawna symulacja bez mutacji | preflight-shards **6/7** |
| local-first-rescue-browser-smoke.js | **2 grupy PASS**: ukończony download na dysk i SHA rzeczywistych bajtów, native FileList/trusted change, odczyt/odszyfrowanie/manifest/BACKUP_PASS, złe hasło/ucięty plik, realna druga karta/Auth, SIGKILL/restart, FILE_VERIFIED_STALE przy utracie RAM, identyczność całego localStorage/IDB/outbox i readonly | preflight-shards **7/7**, brak skip przy niedostępnym Chromium |
| storage-recovery-smoke.js (dotychczasowy) | **5/5 PASS**, kontrakty starego pliku/RAW/hash/retencja/quota | preflight-shards **4/7**, bez osłabienia testu |
| storage-recovery-browser-smoke.js (dotychczasowy) | **18 grup PASS**, realny Chromium/IDB/download/quota/Auth/archiwum/restart | preflight-shards **5/7**, bez zmiany testu |
| local-first-contract-smoke.js (dotychczasowy) | **7 grup PASS**, odmowy produkcyjnej aktywacji, podpis/owner/Rules/revocation, nienaruszone kontrakty globals/RYSUNEK/robocizny | obowiązkowy preflight-shards, istniejący routing bez zmian |
| ci-sharding-smoke.js / składnia / wersje / load groups / offline manifest / diff | **PASS**, 192 aktualne smoke, siedem rozłącznych grup, każdy nowy test dokładnie raz; manifest obejmuje 484 publiczne pliki | obowiązkowy Preflight, workflow i historyczne piny bez zmian |

Advisory cloud-ci-impact wskazał wyłącznie dwa zmienione pliki z historycznymi pinami: index.html oraz storage-recovery-export.js. Oczekiwane odmowy CLOUD42_SOURCE_CHANGED i zależne historyczne bramki pozostają obowiązujące; nie aktualizowano pinów ani artefaktów. Wymagany current boundary oraz historyczne/Firebase zestawy dla końcowego SHA należą do niewykonanego CI (**CI_PENDING**). Porównanie bajtów potwierdziło brak zmian SW, writer-fence, boot/authority/initial-state/runtime/replication, kontraktu globalnego i implementacji starego eksportu.

Awaria download/brak miejsca jest celowanym wstrzyknięciem błędu, nie zapełnieniem dysku urządzenia. Test natywny wymaga osobno zdarzenia Chromium download completed i obecnego pełnego pliku, następnie naprawdę wybiera ten plik z dysku przez DOM.setFileInputFiles; nie weryfikuje samego Blob. Zaufanie event/FileList jest dodatkowo sprawdzane w rzeczywistym rendererze. Bez ukończonego pliku nie powstaje dowód, niezależnie od sposobu zgłoszenia braku miejsca przez Androida.

Początkowe wykonania nowego testu restartu wykryły nieutrwalone przygotowanie syntetycznego localStorage oraz dodatkowe karty odtwarzane przez Chromium. Fixture przed SIGKILL przechodzi rzeczywiste Browser.close z oczekiwaniem na zakończenie procesu, ponowne otwarcie i potwierdzenie obecności danych; zamyka wyłącznie dodatkowe strony we własnym jednorazowym profilu testowym. Finalna awaria i restart nadal wymagają identyczności wszystkich trwałych danych. Jednostkowy test archiwum poprawiono z porównania serializacji/prototypów dwóch realmów na porównanie pełnych wartości; nie zmieniono zabezpieczeń produkcji ani wcześniejszych asercji. Finalne wyniki powyżej, pierwotne błędy nie są przypisywane aplikacji.

**Syntetyczna kopia została faktycznie pobrana i niezależnie zweryfikowana: TAK. Kopia danych właściciela na fizycznym Androidzie: NIE / BACKUP_PENDING.** Bezpieczne wejście w fatal i prywatne rzeczywiste różnice nadal nierozstrzygnięte. Żaden wynik nie upoważnia do automatycznej naprawy, inicjalizacji, merge/importu/restore, czyszczenia danych, zmian SW/writer-fence/Auth, Firebase LIVE/Rules/IAM/billingu. Brak PR, GitHub Actions, merge i wdrożenia.

## ANDROID GLOBALS RECOVERY — 03.11.2026

Kontynuacja **feat/code-global-catalogs-20261102**, wejściowy HEAD **97eb1c58ad87d388bb19c7c2c22a420dc5b4fc24**, main/BASE **317cfce2d43ac5ae4c9ed92c306d5c04d73b3f74**, odczytane przez git. Jeden nowy commit i push; wynikowy SHA w przekazaniu (nie da się wpisać własnego SHA do treści commita). Status **CODE_READY / CI_PENDING / BACKUP_PENDING / REPAIR_BLOCKED**. Wykorzystano istniejący backup, analizator i generator, bez kolejnego ogólnego audytu. To implementacja zatwierdzonego wejścia ratunkowego i syntetycznego wykonawcy, bez naprawy telefonu, wydania lub uruchomienia pełnego CI.

Pliki tego pakietu (24):

- Dostęp/istniejący interfejs: index.html, dev_tests.html, js/main-login.js, js/app/cloud/local-access-profile.js, js/app/cloud/application-bootstrap.js, js/app/ui/storage-recovery-panel.js, sync/local-first-recovery-ui.mjs, sync/local-first-rescue-access.mjs.
- Odczyt/plan/runtime: js/app/shared/storage-recovery-export.js, sync/local-first-rescue-snapshot.mjs, sync/local-first-rescue-file.mjs, sync/application-runtime.mjs.
- Definicje i wersjonowanie: sync/code-global-catalogs.generated.mjs, tools/code-global-catalogs-asset.js, tools/script-versions.js, offline-assets.js.
- Regresje i izolowane narzędzia: tools/android-globals-recovery-smoke.js, tools/android-globals-recovery-browser-smoke.js, tools/synthetic-global-rebuild-browser-smoke.js, tools/helpers/android-globals-browser-fixture.js, tools/helpers/synthetic-global-rebuild.mjs.
- Dokumentacja: CURRENT_STATE.md, niniejszy raport, tools/reports/cloud-3-global-data-foundation.md.

### Autoryzowany odczyt mimo fatal globals

W istniejącym ekranie błędu jest jedno wejście „Tryb ratunkowy — kopia LOCAL-FIRST”. Dopuszczane wyłącznie po potwierdzonym początkowym błędzie GLOBAL_* w initial-global-revision i zakończeniu cleanup runtime. Runtime czeka na sync.close, zamyka wszystkie zasoby i zwalnia istniejącą instalację; nieudany cleanup zachowuje pierwotny błąd i nie wydaje gotowości recovery. Nie ponawia startupu, nie uruchamia migracji, nie przywraca głównego gate.

main-login zachowuje prywatne powiązanie wcześniej rzeczywiście dopuszczonego właściciela z attemptId, epoką sesji i dokładnym receipt profilu. Odrębny niemodyfikowalny scope **LOCAL_FIRST_RESCUE_READ_ONLY_V1** sprawdza fatal/blocked, tego samego właściciela, brak pending veto i aktualną autoryzację. Istniejąca baza właściciela jest sprawdzana readonly, przed i po snapshotcie; nie jest tworzona, adoptowana ani zatwierdzana ponownie. Dla istniejącego trusted telefonu obowiązuje ta sama podpisana polityka trust/fence, również offline; nie przyznano nowego zaufania. Desktop wymaga świeżego serwerowego gate na tym samym obiekcie Auth; 10 s limitu autoryzacji odrzuca spóźniony grant, istniejąca 45 s dzierżawa jest odnawiana/cofana normalną polityką. Brak możliwości bezpiecznego potwierdzenia = STOP, bez wyjątku „właściciel oświadczył”.

Główny gate pozostaje nieważny, Storage guards blokują zapis i zwykły odczyt biznesowy; tylko ograniczony scope może czytać fizyczne fc_*, pięć historycznych kluczy oraz receipt/marker archiwum. Nie udostępnia Auth/tokenów/profilu jako backupu. logout, utrata trust/fence, cofnięcie lub wygaśnięcie autoryzacji usuwają capability i panel oraz czyszczą jego hasło/dowody/prywatny plan. Ponowne AUTH_RELOAD_REQUIRED nie usuwa pierwotnego błędu ani wejścia tego samego dopuszczonego właściciela.

Bootstrap bierze owner/name/release/boot ze swojego rzeczywistego kontekstu, nie z pól UI. Przed operacją sprawdza istniejący produkcyjny writer-fence, receipt i lock obrazu; fatal dodatkowo globalny lock authority. Dodatkowa karta jest odmawiana przez dotychczasowy protokół SW, bez jego zmian. W działającym runtime odczyt zajmuje istniejącą granicę transakcji i lock store; beforeTransaction odmawia podczas odczytu. Po sukcesie/błędzie blokada jest zwalniana. Algorytm synchronizacji, polityka SW i writer-fence nie są zmienione.

### Plik i prywatny plan 14 domen

Panel ma wyłącznie hasło, pobranie, natywny wybór pliku i zamknięcie. Używa istniejącego AES-256-GCM/PBKDF2, integralności i pełnego odczytu wszystkich czterech store oraz fizycznych oryginałów/archiwum/session/znanego RAM. Dotychczasowy eksport i jego odmowa dla bazy LOCAL-FIRST pozostają nienaruszone; rozszerzono wyłącznie oddzielny privateCodec i dopuszczenie ograniczonej capability odczytu. Inventory nadal odmawia nieznanej bazy, błędnego binding/receipt/integralności, zmian źródła i przekroczenia limitów. Nie ma importu/restore/merge, uploadu ani zapisu biznesowego.

Samo Blob/a.click nie daje sukcesu. Dopiero pełny plik ponownie wybrany natywnym FileList i trusted change, przeczytany/odszyfrowany z weryfikacją SHA, manifestu i świeżych źródeł daje **BACKUP_PASS**. Niedokończone pobranie/brak miejsca/zmiana źródeł = brak dowodu. FILE_VERIFIED_STALE po utracie RAM/session nie daje planu wykonania. Granice backendu z sekcji historycznej pozostają: 15 s/snapshot, 64 MiB plaintext, 90 MiB plik, ograniczone RAW/węzły/serializacja. Nie potwierdzono pojemności i czasu rzeczywistego telefonu.

Po BACKUP_PASS API porównuje oba źródła ze zweryfikowanym plikiem i istniejącym kodowym kandydatem. Nowy generowany moduł przeglądarkowy zawiera wyłącznie fabryczne definicje/proweniencję; narzędzie asset sprawdza dokładną zgodność z istniejącym generatorem. Model SHA **405c598ace08ffd324ec315f962b49b36288b9d28ecf4428719fd61c70092a71**, 14/14 domen bez zmiany norm/WYCENY. Prywatny plan zachowuje pełne preimage oraz dwukierunkowe różnice cen/rekordów/ID/norm/pól/zamienników, nie wybiera wartości i zawsze ma writeApproved:false. Zmieniony plan lub snapshot unieważnia dowód CAS. W UI są tylko anonimowe zamknięte statusy, bez RAW/nazw/UID/cen/treści wyjątków. Plan jest prywatny i nietrwały; nie ma nowego UI przeglądania lub rozstrzygania szczegółów. Przed przyszłym WRITE nadal potrzebny osobny bezpieczny sposób lokalnego przeglądu/akceptacji konkretnego artefaktu przez właściciela.

### Izolowany wykonawca syntetyczny — brak produkcyjnego WRITE

tools/helpers/synthetic-global-rebuild.mjs nie jest importowany przez produkt ani objęty manifestem offline. Wymaga rzeczywistego window na localhost/127.0.0.1, nazwy meble-lf-test-rebuild-* i właściciela synthetic-* przed otwarciem IDB. Baza produkcyjna odmawia. Nie ma przełącznika produkcyjnego ani dostępu wykonawczego z UI. Wymagane są autentyczny BACKUP_PASS z modułowej WeakMap, aktualny pełny snapshot i jawny syntetyczny przegląd dokładnych hashy planu/kandydata/preimage. Podrobiony obiekt lub brak zatwierdzenia odmawia.

Wykonawca testowy sprawdza bieżące owner/receipt/binding/source, protokół wyłącznego klienta oraz oba locki. queued/blocked/conflict albo nierozstrzygnięte ACK oznacza STOP. inflight/uncertain wymaga niezależnego syntetycznego odczytu identycznych operationId, expected head, JSON i SHA; nie publikuje ani nie ponawia operacji. Jedna strict transakcja readwrite obejmuje **control/application + replicas + protected + outbox** z pełnym CAS wszystkich czterech store przed mutacją. Zachowuje source, binding, fizyczne oryginały, stare rekordy i chroniony pełny preimage. Nowa operacja pozostaje blocked/LF_SEPARATE_ACTIVATION_REQUIRED, więc nie jest gotowa do wysłania. Journal zawiera dowód pliku i rozstrzygnięte ACK.

Restart nie wznawia wykonania automatycznie. Rollback korzysta z trwałego journalu i pełnego CAS obrazu po commit, zwiększa wersje, zachowuje potwierdzone ACK i blocked audit, nie odtwarza niepewnej kolejki do ponownej publikacji. Zmiana stanu/nowe ACK odmawia rollbacku. To dowód mechaniki wyłącznie syntetycznej, nie gotowy wykonawca produkcyjny ani zgoda na naprawę.

### Celowane dowody bieżącego pakietu i routing

Node **24.19.0**, rzeczywisty Chromium **151.0.7922.173**, wyłącznie syntetyczne dane. Wyniki dotyczą roboczego drzewa zawartego w nowym commicie, nie wcześniejszego SHA ani CI. Obowiązkowy Preflight automatycznie odkrywa nazwy *-smoke.js i dzieli deterministycznie; nie potrzeba zmiany workflow. Nowa regresja sprawdza, że nowe i dotychczasowe granice są przypisane dokładnie raz. Obecny routing **197 smoke / 7 rozłącznych grup**; dawne numery shardów wyżej są historyczne.

| Test | Wykonany wynik | Obowiązkowy Preflight |
| --- | --- | --- |
| android-globals-recovery-smoke.js | **7/7 grup PASS**: fresh desktop gate/expiry/timeout/late grant/owner/profile readonly, odmowa WRITE, AUTH_RELOAD_REQUIRED, realna funkcja cleanup runtime i ochrona normalnego runtime przed transakcją podczas backupu, świeżość assetu/izolacja/routing | shard **4/7** |
| android-globals-recovery-browser-smoke.js | **3 grupy PASS**: fatal na realnym main i trusted profilu, ukończony encrypted download na dysk, natywny FileList/GCM/SHA i prywatny plan, druga karta, CDP offline, revocation, restart/brak RAM/stale; identyczne biznesowe RAW/cztery store/uncertain outbox | shard **5/7** |
| synthetic-global-rebuild-browser-smoke.js | **5 grup PASS**: autentyczny plik, brak planu/zgody/locka/ACK, abort/quota/Auth, CAS race, SIGKILL otwartej transakcji, atomowy offline commit/readback/restart, journal/rollback/odmowa po ACK, zero network WRITE i bez replay | shard **6/7** |
| main-login-smoke.js / trusted-main-login-smoke.js | **36/36 + 4 grupy PASS**, stare odmowy bez osłabienia | shard **7/7** |
| global-consistency-startup-smoke.js / local-first-contract-smoke.js | **6/6 + 7 grup PASS**, pierwszy błąd i dotychczasowe granice | obowiązkowy routing bez zmian |
| local-first-rescue-smoke.js / storage-recovery-smoke.js | **8/8 + 5/5 PASS**, pełny zakres, integralność i negatywne scenariusze istniejącego backendu | shard **4/7** |
| code-global-catalogs-smoke.js / code-global-rebuild-plan-smoke.js | **7/7 + 6/6 grup PASS**, Android/14 domen, zachowanie prywatnych odstępstw/oryginałów | shard **6/7 + 7/7** |
| wycena-labor-norms-smoke.js | **9/9 PASS**, bez zmiany reguł biznesowych | shard **5/7** |
| cloud-ci-current-boundary-smoke.js | **PASS**, izolowane historyczne drzewo 306f90a4cfd8bcb4277aa8b4d140e911493ddd60, ścisłe odmowy zmienionych źródeł bez I/O i produkcja wyłączona | obowiązkowy current boundary |

Stare natywne local-first-rescue-browser i storage-recovery-browser nie były ponawiane w tym pakiecie; nadal obowiązkowe odpowiednio w shardach **7/7 i 5/7**. Pełny Preflight/static/safety, Firebase CURRENT/Historical SDK, pozostałe regresje WYCENY pozostają **CI_PENDING**. Nie uruchamiano Actions/emulatorów ani nie przypisywano PASS wcześniejszego wydania. Kontrola wersji/assetu/load groups/manifestu/składni/diffu obejmuje finalne drzewo. Pięć zmienionych skryptów ma wersję 20261103_android_globals_recovery_v1; manifest zawiera **488** publicznych plików, bez tools wykonawcy. SW, writer-fence, boot/authority/initial-state/replication, walidatory globals, definicje katalogów i kalkulatory WYCENY, Rules, historyczne piny i workflow pozostają bez zmian względem wejścia 97eb1c58. Runtime zmieniono wyłącznie w cleanup i czasowej ochronie odczytu; Auth/profile wyłącznie w opisanej izolowanej ścieżce ratunkowej.

W pakiecie wejściowego HEAD 1fdc8461 nie wykonano jeszcze scenariusza „stary worker → nowe wydanie → nowy przycisk”. Brakującą regresję uzupełnia późniejsza sekcja [Domknięcie aktualizacji Android recovery — 03.11.2026](#domknięcie-aktualizacji-android-recovery--03112026). Nie przypisujemy tego dowodu samemu cache-bustingowi ani urządzeniu właściciela.

Ograniczenia dowodów: fixture przeglądarkowa używa rzeczywistych main-login/profile/trust/privateCodec/UI/IDB/crypto/SW fixture, lecz loader i granica błędu runtime oraz autoryzacja są syntetyczne. Nie jest testem startu produkcyjnego SDK, prawdziwego Firebase ani telefonu. Quota/abort są kontrolowanymi błędami w rzeczywistej transakcji IDB; nie zapełniano dysku. Próba CDP overrideQuota nie odtworzyła QuotaExceededError — nie zaliczono jej jako dowodu. Restart i SIGKILL są rzeczywiste we własnym jednorazowym profilu, po utrwaleniu syntetycznego setupu. Druga karta i offline są rzeczywiste w Chromium; profil/RAW/IDB są syntetyczne.

Podczas implementacji naprawiono kolejność ogłaszania BACKUP_PASS (dopiero po gotowym prywatnym planie) i zachowanie pierwszej przyczyny abortu (QuotaExceededError nie jest nadpisywane późniejszym AbortError). Błędy nowych fixture obejmowały brak przewinięcia wejścia, niepełne stuby, artefakt pojedynczego watch i odwołanie do ulotnego planu w teście rollbacku po restarcie; poprawiono fixture bez osłabiania asercji. Stary kontrakt wykrył dodatkowy literal etapu LOCAL-FIRST — usunięto powielenie i korzystamy z istniejącego canRecoverGlobals, test bez zmian. Jedno równoległe uruchomienie miało niepotwierdzony cleanup potomków Chromium; nie uznano PASS, sprawdzono brak żywych potomków i zakończono wyłącznie własny runner. Nowe fixture zamykają serwer w zagnieżdżonym finally również po błędzie cleanup; supervisor i stare kontrole bez zmian. Końcowe izolowane próby obu nowych testów Chromium przeszły.

### Android i warunki przyszłej naprawy

Kod dostępu odczytowego gotowy do przeglądu/CI, **jeszcze niewydany i niezweryfikowany na urządzeniu właściciela**. Nie odświeżać obecnej karty z niezabezpieczonym RAM tylko po to, by uzyskać nowy kod. Po osobno zatwierdzonym bezpiecznym wydaniu i potwierdzeniu zachowania RAM:

1. Pozostać przy właściwym koncie, jednej karcie aplikacji i istniejących danych Chrome. Z ekranu błędu globals otworzyć „Tryb ratunkowy — kopia LOCAL-FIRST”. Brak wejścia/STOP to brak potwierdzonej autoryzacji lub gotowości, nie powód do obchodzenia fatal.
2. Wpisać prywatne hasło minimum 12 znaków, zachować je osobno; pobrać plik do prywatnego miejsca. Zaczekać na rzeczywiste ukończenie pobierania.
3. W tym samym panelu natywnie wskazać ukończony plik. Sukces wymaga BACKUP_PASS; BACKUP_PENDING/BLOCKED/FILE_VERIFIED_STALE nie otwierają naprawy. Nie wysyłać pliku, hasła ani szczegółów danych do ChatGPT/GitHub/logów. Przekazać wyłącznie anonimowy status.
4. Zachować oryginalny plik poza aplikacją. Osobno prywatnie przejrzeć każdą różnicę obu warstw względem kodu, brakujące pola materiałów, akcesoria i labor; zatwierdzić dokładny finalny kandydat bez automatycznego wyboru cen/rekordów.
5. Rzeczywisty WRITE wymaga osobnej implementacji/zgody na konkretny artefakt, świeżego BACKUP_PASS i CAS, sprawdzonych Auth/receipt/binding/release/fence, zatrzymania edycji/synchronizacji, niezależnego rozstrzygnięcia każdego ACK, atomowości czterech store i chronionego rollbacku. Po zapisie konieczne readback/restart/full validateBundle/runtime/dependencies/WYCENA przed wznowieniem; nowe zdalne ACK wyklucza rollback starej kolejki. Obecny pakiet nie udostępnia takiego wykonania.

**Syntetyczny zaszyfrowany plik pobrano i niezależnie zweryfikowano: TAK. Pełna kopia właściciela na Androidzie: NIE / BACKUP_PENDING.** Nierozstrzygnięte pozostają rzeczywiste pola/rekordy/ceny/normy/zamienniki, stan zdalnych ACK i zgoda na docelowy obraz. Start i telefon–komputer nadal niepotwierdzone; **REPAIR_BLOCKED**. Brak PR/Actions/merge/Pages/Firebase LIVE/Rules/IAM/billingu oraz jakiejkolwiek naprawy/resetu/importu/migracji urządzenia.

## Domknięcie aktualizacji Android recovery — 03.11.2026

Wejściowy HEAD **1fdc8461b8f23f111323087120e7586169814c82**, main/BASE **317cfce2d43ac5ae4c9ed92c306d5c04d73b3f74**, kontynuacja feat/code-global-catalogs-20261102; SHA lokalne i remote zgodne przed pracą. Jeden nowy commit/push, wynikowy SHA w przekazaniu. Zakres wyłącznie pięciu plików: tools/android-globals-recovery-browser-smoke.js, tools/helpers/android-globals-browser-fixture.js, nowy tools/helpers/android-globals-update-browser.js, CURRENT_STATE.md i niniejszy raport. Kod aplikacji/SW/fence/Auth/wersje/manifest/WYCENA bez zmian; nie wykryto potrzeby poprawki produktu. Nie powtarzano analiz ani zaliczonych testów.

Celowana komenda: `node tools/android-globals-recovery-browser-smoke.js --update-only`. Node **24.19.0**, Chromium **151.0.7922.173**, **2 grupy PASS**:

1. W jednym jednorazowym profilu instalowany jest rzeczywisty offline-worker.js i pełny manifest z BASE (git archive dokładnego SHA). Oryginalny HTML nie zawiera wejścia recovery. Syntetyczne istniejące RAW i pełne control/replicas/protected/outbox zawierają niepewną operację; właścicielski profil/trust są rzeczywiste w IDB. Stary dokument uruchamia stare main-login i moduł offline-update. Po zmianie serwowanych zasobów na bieżący kod update pobiera i weryfikuje cały nowy manifest. Jawne ACK potwierdzają osobno stary active i nowy waiting. Natywne kliknięcie rzeczywistego komunikatu pokazuje instrukcję, nie odświeża. Identyczne pozostają nonce dokumentu, obiekt niezapisanego RAM, input, liczba nawigacji, kontroler (zero controllerchange), biznesowe RAW, pełne cztery store i uncertain outbox. Stary dokument nadal nie ma nowego kodu/przycisku; to poprawne zachowanie. Nowe main-login jest już w oczekującym cache, ale nie jest wykonywane w starej karcie.
2. Dopiero testowe świadome rozliczenie/usunięcie syntetycznego draftu i opuszczenie starego klienta pozwala na naturalną aktywację, potwierdzoną zdarzeniami Chromium ServiceWorker dla nowego versionId. Nie używamy skipWaiting, claim, unregister, czyszczenia cache/danych ani nowego profilu. Nowy dokument dostaje rzeczywisty nowy index i źródła main/bootstrap przez cache SW; wartości źródeł są porównane z plikami wydania. Przy początkowym błędzie globals nowy rzeczywisty main pokazuje zatwierdzone wejście. Natywne kliknięcie otwiera panel z hasłem i wyborem pliku, aktualnym scope właściciela oraz BACKUP_PENDING; główny gate pozostaje nieważny i business WRITE jest odmawiany. Odpowiedzi CDP Network z nowego wydania dla HTML/main/bootstrap/modułu UI mają fromServiceWorker=true. Oryginały i pełne cztery store/outbox są dokładnie równe baseline sprzed aktualizacji.

Hashe zweryfikowanych kompletnych manifestów: BASE **e1f5603a8894b5192dafd29674d6cd83c35f735bc2da17b896a981ecf07c7b3b**, nowe zasoby **e28dd5d6eb3106df97a2f29a6b1e7e34385c99e4d784205371283db5c299321e**. To hashe manifestów, nie SHA commitów. Produkt i jego zasoby są identyczne z wejściowym 1fdc8461, więc nowy commit testowy nie wymaga zmiany wersji ani regeneracji manifestu.

Nowy helper jest wywoływany **bezwarunkowo w domyślnym uruchomieniu** istniejącego android-globals-recovery-browser-smoke po dotychczasowych trzech grupach. Lokalny --update-only pomija wyłącznie wcześniej zaliczone trzy grupy, aby wykonać zleconą brakującą regresję; CI nie podaje tej flagi. Przeczytano workflow i plan podziału: istniejący test nadal dokładnie raz w obowiązkowym Preflight shard **5/7**, inventory **197 smoke**, bez nowego workflow lub uruchomienia Actions. Składnia trzech plików JS, brak zmian produktów/manifestu i diff sprawdzone celowanie. Pozostałych testów, Preflightu i Firebase nie uruchamiano ponownie; **CI_PENDING**.

Granice dowodu: rzeczywiste są worker, pełna instalacja i integralność obu statycznych wydań, cache/fetch, oczekiwanie i naturalna aktywacja w tym samym profilu, main/profile/trust, natywne kliknięcia oraz IDB. Tak jak w poprzedniej fixture, Auth/loader i granica runtime pozostają syntetyczne: stary przyjęty dokument ma kontrolowany pomyślny runtime, nowy reprodukuje błąd globals i cleanup. HTML jest autentyczny, lecz parserowe wykonywanie skryptów jest w fixture wstrzymane przez CDP; następnie źródła wybrane z rzeczywistych URL HTML są pobierane przez SW, sprawdzane bajtowo i uruchamiane z istniejącą izolacją runtime importów. Nie jest to pełny startup produkcyjnego SDK ani test prawdziwego Firebase. Nie pomija sprawdzania starego/nowego workera, manifestu, uprawnień, danych ani oczekiwania. Dane oraz RAM są wyłącznie syntetyczne; drugi scenariusz rozpoczyna się dopiero po jawnej testowej decyzji o draftach, bez obietnicy zachowania niezapisanego RAM przez świadome zamknięcie dokumentu.

Pierwsza próba zatrzymała się przed Chromium podczas przygotowania fixture na istniejącym limicie VM 2 s w generatorze. Osobna minimalna kontrola przygotowania przeszła i nie odtworzyła timeoutu; przyczyna opóźnienia pozostaje niepotwierdzona. Limit/generator/asercje bez zmian i bez automatycznego retry. Końcowy scenariusz Chromium zaliczony. Nie zaliczamy tej pierwotnej odmowy jako PASS ani jako błędu produktu.

**CODE_READY / CI_PENDING / BACKUP_PENDING / REPAIR_BLOCKED.** Domknięto brakujący syntetyczny dowód dostarczenia recovery przez bezpieczną aktualizację. Nie oznacza wydania, BACKUP_PASS danych właściciela, zgody na realny WRITE ani naprawy telefonu. Bez PR, pełnego CI/Actions, merge/Pages, Firebase LIVE i operacji na rzeczywistych danych.

## PR #108 — poprawka dwóch FAIL CI i zasady współpracy — 03.11.2026

Gałąź feat/code-global-catalogs-20261102, wejściowy HEAD **7f64413a8e9c6580a2486c538b9430421c52fe03**, main/BASE **317cfce2d43ac5ae4c9ed92c306d5c04d73b3f74**. Sprawdzono git lokalny/remote i metadane istniejącego [PR #108](https://github.com/mebleszek/meble-app/pull/108): otwarty Ready, niescalony, zgodne HEAD/BASE. Odczytano [CI #41591404186](https://github.com/mebleszek/meble-app/actions/runs/41591404186) oraz [log sharda 7/7](https://github.com/mebleszek/meble-app/actions/runs/41591404186/job/125768797629). Shard **46/48 FAIL**, dokładnie first-sync-error-diagnostics-smoke i local-first-rescue-browser-smoke. Safety, Static, pozostałe shardy oraz Firebase CURRENT/Historical PASS dla wejściowego SHA; agregatory Preflight/ci-summary/final-status FAIL, auto-merge i Pages SKIPPED. Tych historycznych PASS nie przypisujemy nowemu HEAD.

Przyczyny i ograniczone poprawki:

- Test diagnostyki miał historyczny literal 20261102_global_diagnostics_v1 dla main-login/bootstrap, mimo obowiązującego centralnego rejestru authVersions i nowych wersji recovery. Test pobiera teraz wymagane wersje z tego rejestru, wymaga obecności obu wpisów oraz **dokładnie jednego** zgodnego script src. Dotychczasowe assertVersions i wszystkie pozostałe scenariusze pozostają. Cztery negatywne mutacje — stara wersja i duplikat dla każdego z dwóch skryptów — muszą zgłosić ERR_ASSERTION; nie zastąpiono kontroli luźnym includes ani samą obecnością pliku.
- Rescue-file importuje global-code-rebuild-plan.mjs, którego zamknięta lista serwera natywnego testu nie dopuszczała. Chromium zgłaszało Failed to fetch dynamically imported module dla rescue-file, choć przyczyną był odrzucony import zależny. Dopisano **wyłącznie tę nazwę** do istniejącej listy. Sprawdzono jej dalsze importy local-first-values i local-first-rescue-state, już obsługiwane przez serwer. Nie zmieniono aplikacji, ścieżki importu produktu, odmów backupu ani scenariuszy/asercji natywnego testu.
- AGENTS §3 doprecyzowuje obowiązek przeglądu i dostosowania istniejących testów do bieżącego kontraktu, nazw, zależności/list serwera i wersjonowania przy każdej modyfikacji aplikacji. Zakaz osłabiania asercji, usuwania wymaganych scenariuszy i maskowania błędów jest jawny. Nowy §19 utrwala decyzje właściciela o nowych zadaniach/zakresie/zabezpieczeniach po konsultacji; wykryta luka nie wymusza natychmiastowej naprawy, trzeba oddzielić bloker od odraczalnego ryzyka. Priorytet: działająca aplikacja, synchronizacja telefon–komputer, WYCENA i RYSUNKI; bez mnożenia pakietów/modułów/zabezpieczeń bez potrzeby i zgody. Nie wymusza ponownej zgody na ten już zlecony zakres.

Zmiany wyłącznie pięciu plików: AGENTS.md, CURRENT_STATE.md, tools/first-sync-error-diagnostics-smoke.js, tools/local-first-rescue-browser-smoke.js i niniejszy raport. Kod produktu, HTML/wersje, manifest, worker/fence, Auth, reguły domenowe i workflow bez zmian. Jeden nowy commit i push na istniejącą gałąź; wynikowy SHA w przekazaniu.

Celowane wykonania dla drzewa nowego commita, wyłącznie dane syntetyczne, Node **24.19.0** / Chromium **151.0.7922.173**:

| Komenda / kontrola | Faktyczny wynik | Routing obowiązkowego CI |
| --- | --- | --- |
| node tools/first-sync-error-diagnostics-smoke.js | **9/9 PASS**, w tym aktualne dokładne wersje i odrzucenie czterech mutacji; fatal/anonimowość/niezmienność i wszystkie stare scenariusze zachowane | Preflight shard **7/7**, dokładnie raz |
| node tools/local-first-rescue-browser-smoke.js | **2 grupy PASS**, import grafu w natywnym Chromium, faktyczny download na dysk, natywny FileList/odczyt/GCM/SHA, złe hasło/ucięcie, readonly, druga karta, utrata Auth, SIGKILL/restart i jawny brak RAM; identyczne RAW/cztery store/niepewny ACK | Preflight shard **7/7**, dokładnie raz |
| Plan podziału / składnia obu plików / git diff --check | **PASS**, inventory nadal **197**, bez zmiany workflow/trasowania | Siedem istniejących obowiązkowych grup |

Nie uruchamiano innych zaliczonych zestawów, pełnego Preflightu, emulatorów ani GitHub Actions. Wykazano poprawki dwóch przyczyn testowych; nie ogłaszamy CI_PASS dla nowego SHA. Syntetyczny plik nie jest BACKUP_PASS właściciela; Android i rzeczywista naprawa bez zmian.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / BACKUP_PENDING / REPAIR_BLOCKED.** Kolejna próba wydania wymaga osobnej zgody właściciela na dokładny nowy HEAD i aktualny BASE. Istniejący PR nie został zmieniony operacją API; push aktualizuje jego gałąź bez retry Actions. Bez nowego PR, ręcznego merge, Pages i Firebase LIVE.
