# CLOUD-4.1 — prywatne wykonanie syntetycznego pilota

## Aktualizacja po weryfikacji i scaleniu

PR #62 scalony do main `d517d598917e5ccd6f1460950697c9ab27f1db1c`; wydaniowe CI i Pages SUCCESS.
Pełne CI CLOUD-4.1: 13/13 live-readiness, 10/10 prywatny pilot, 71/71 SDK, 3/3 startup, 38/38 Chromium i Preflight PASS.
Poniższy opis blokad jest historią pierwotnej próby. Nie oznacza aktywacji produkcyjnej.
[CLOUD-4.2 — przygotowanie dalszych osobnych zgód](cloud-4-2-live-pilot-preparation.md).

## Status i granice

Baza: `origin/main` **62f80433c28cfd1ed0370618b58db8f4e88fad68**, gałąź `cloud-4-1-private-pilot-execution`. CLOUD-4 jest w tej bazie; nie powtarzano audytu CLOUD-1/2/3. `PROJECT_DECISIONS.md` odczytano z gałęzi PR #41, bez jej zmieniania.

**Implementacja przygotowana; weryfikacja emulatorowa NIEZAKOŃCZONA. Nie kierować do Ready ani aktywacji LIVE.** Środowisko odmawia pobrania oficjalnego emulatora Firestore (proxy HTTP 403). Wyniki historycznych 71/71 SDK i 28/28 Chromium z CLOUD-4 nie są wynikami tej gałęzi.

Nie zmieniono `index.html`, `main-login.js`, manifestów, Auth, lokalnego profilu IndexedDB, modeli danych, setterów, Rules, grantów ani UI. Nie wykonano żadnych operacji na produkcyjnym Firebase. Informacja o obecnym produkcyjnym Auth-only pochodzi od właściciela; nie sprawdzano produkcyjnych dokumentów dostępu. Dostęp administracyjny z Cloud Shell nie potwierdza uprawnień klienta Web SDK.

## Prywatny call-site

`tools/firebase-pilot/private-pilot-source.js` buduje **wyłącznie w RAM** operatorską kopię istniejącego `main-login.js`. Wymaga zgodności SHA-256 pliku oraz dokładnego zakończenia IIFE. Dołącza zamknięty wykonawca w tym samym zakresie leksykalnym, po pojedynczym istniejącym `initialize()`. Oryginalny plik i zwykły startup pozostają identyczne bajtowo. Każda przyszła zmiana właściciela sesji wymaga ponownego przeglądu i aktualizacji przypięcia; brak dopasowania oznacza odmowę.

- `main-login.js`: `6b6aeb7ffb8dc10664b5ae7a0cf5af10f0b5dcf7b130ed829798f23438fff7f3`.
- Minimalne Rules CLOUD-4: `eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92` — bez zmian.

`private-pilot-runner.mjs` przyjmuje wyłącznie świeżą stronę Playwright, lokalny HTTP `/index.html`, dokładne adresy emulatorów oraz konfigurację `demo-meble-app`. Przed inicjalizacją Auth odrzuca brak konfiguracji i `live-auth`, również na lokalnym adresie. W odseparowanym kontekście operatorskim wstrzymuje pobranie oryginalnego main-login i wykonuje sprawdzoną kopię dokładnie raz. Otrzymuje tylko prywatny JSHandle; nic nie jest rejestrowane w `window`, DOM, localStorage ani globalnym FC.

Przekazanie rzeczywistego `auth`, `lease` i kontroli lokalnego profilu odbywa się wewnątrz zamknięcia. Sesja musi być zatwierdzona, biznesowy loader zakończony, a istniejący read-only `session.inspectExportState()` musi potwierdzić brak aktywnej sesji i niepotwierdzonych pozostałości trwałego payloadu. UID, epoka Auth, tożsamość lease, jego `assert()` oraz lokalny dowód są sprawdzane przed i po oczekiwaniu. Nie ma getterów Auth/tokenów, dodatkowego logowania ani niezależnego mechanizmu persistence.

To narzędzie operatorskie, **nie nowy sposób zwykłego uruchamiania Meble-App**. Sam import plików, logowanie, otwarcie strony lub start aplikacji nie uruchamia pilota. Nie można dołączyć wykonawcy do już uruchomionej strony ani przełączyć go na produkcję flagą.

## Jedna próba zapisu albo niezależny odczyt

`private-pilot-execution.js` jest wyrażeniem/fabryką bez publicznej rejestracji. Przyjmuje dokładnie `{role:'write'|'read', approval}`. Obiekt approval zachowuje istniejący kontrakt CLOUD-4: wersja, rzeczywisty UID w pamięci operatora, stałe ID, hash payloadu, hash Rules i termin nie dłuższy niż 15 minut. Nie jest grantem ani dowodem autoryzacji — uprawnienia egzekwują serwerowe Rules.

- Jedna próba na uchwyt, zużywana również przy odmowie. Nie ma automatycznego retry ani późniejszej kolejki.
- Zapis wywołuje istniejące `controlledProjectPilot.prepare/write`, bez dostępu do ogólnego transportu i bez możliwości podania innego projektu lub payloadu.
- Źródło to istniejący `cloud4-source-worker.js`: rzeczywiste moduły tworzenia, zapisu, sesji, PCV i eksportu CLOUD-1B, uruchomione w oddzielnym MemoryStorage. Brak dostępu do magazynów strony właściciela. Worker jest uruchamiany dopiero wewnątrz jawnej operacji i zawsze kończony po niej.
- Fabryki kontraktów/transportu są ładowane do prywatnej przestrzeni, korzystają tylko z czystych zależności geometrii/opcji. Nie podmieniają globalnego FC, Storage ani eksportera strony.
- Odczyt używa istniejącego CLOUD-2C i `readVerify`: manifest/rewizja/fragmenty z serwera, dokładne bajty, długości, kanoniczny JSON, SHA-256, natywny schemat i relacje, porównanie z tym samym syntetycznym źródłem. Wynik jest wyłącznie w RAM.
- Klient odczytujący jest osobnym kontekstem przeglądarki z własnym SDK/App/Auth, zatwierdzonym do tego samego UID. Nie współdzieli uchwytu ani cache klienta zapisującego. W każdym kliencie pilot pożycza już istniejącą instancję utworzoną przez jego normalne logowanie.
- Zamknięcie wykonawcy nie wylogowuje, nie usuwa Firebase App i nie zamyka wspólnego Firestore.

Stały zakres: inwestor `cloud4-investor-v1`, projekt `cloud4-project-v1`, payload **6797 B**, `payloadSha256=711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`, `documentSha256=5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1`. Limit 800 KiB, model fragmentów, rewizji i first-publication-only CAS pozostają z CLOUD-4.

Niepewna odpowiedź lub utrata autoryzacji po rozpoczęciu publikacji daje `published:'unconfirmed', requiresIndependentRead:true`. Nie jest to deklaracja porażki serwera ani rollbacku. Próbę należy zakończyć i niezależnie odczytać ten sam zakres; nie tworzyć nowej próby zapisu. Zamknięcie w trakcie operacji również nie cofa możliwego zatwierdzenia na serwerze.

## Testy i dowody

Wykonano:

- `node tools/cloud41-private-pilot-smoke.js` — PASS: deterministyczny artefakt, przypięcia, brak rejestracji/startu, zamknięty zakres, limit próby i odmowa LIVE.
- `node tools/cloud4-pilot-readiness-smoke.js` — PASS: natywne źródło, niezmienność syntetycznych magazynów, PCV, schemat i hashe CLOUD-4.
- `test:private-startup` — **3/3 PASS**, Node 22.23.3, osobne rzeczywiste Chromium i lokalne, oryginalne pliki Firebase Web SDK; kontrola zwykłego startupu i prywatnego uchwytu, brak dostępu przed autoryzacją, odmowa ponownego uruchomienia/produkcji i odmowa live-auth przed inicjalizacją. Nie jest to test Google popup ani emulatorowy roundtrip. Pierwsze próby ujawniły błąd fixture (routing nie uwzględniał wersjonującego query, następnie brak authDomain); poprawiono konfigurację testu, bez zmiany produkcyjnego Auth ani osłabiania asercji.
- Sam emulator Authentication: `firebase emulators:exec --config firebase.json --project demo-meble-app --only auth --non-interactive 'node --test auth.test.mjs'` — **3/3 PASS**, rzeczywisty Firebase Web SDK, syntetyczna tożsamość Google, zmiana konta/unieważnienie starego lease i odmowa kontu anonimowemu. Bez Firestore i bez rzeczywistego konta/OAuth produkcyjnego. Nie jest to dodatkowe 3 ponad historyczne 71 — to wykonany osobno podzbiór.
- Pełny Preflight — **125/125 smoke, 555/555 składni JS, APP 110/110, 331 pozycji kolejności ładowania; dependency/storage PASS**. Zachowuje regresje PCV 16,440 → 17,122 → 18,834 mb i 5,010 → 5,511 mb, jeden zapas 10%, 4/3/6 arkuszy, sesje, rollback i historię. Ten wynik nie zastępuje testów emulatorowych.
- Kontrole składni nowych/zmienionych JS/MJS oraz `git diff --check`.

**Zablokowane przed wykonaniem testów:** `npm --prefix tools/firebase-pilot test` oraz `run test:private-pilot`. CLI odmawia pobrania `cloud-firestore-emulator-v1.22.0.jar` z `storage.googleapis.com`; nie wystartował Firestore i nie zaliczono żadnego testu tej próby. Pełne Chromium wymagające tego emulatora także pozostaje do uruchomienia.

Dodane, ale jeszcze **niepotwierdzone wykonaniem** podtesty rzeczywistego Web SDK w `auth-browser.test.mjs` obejmują: prywatny call-site zamiast przechwytywania fabryk; zapis i dokładny odczyt w niezależnych kontekstach; brak operacji na login; close bez utraty Auth; brak grantu i obcy UID; niezmienny manifest; dwóch konkurujących klientów; logout podczas oczekiwania na worker; odmowę przy realnej trwałej sesji pokoju; utratę odpowiedzi po rzeczywistym commit manifestu; zmieniony/brakujący fragment; cofnięcie appEnabled/grantu oraz offline. Nie usunięto ani nie osłabiono wcześniejszych testów.

Zmiany są ograniczone do trzech modułów operatorskich `private-pilot-{source,execution,runner}`, nowego `private-pilot-startup.test.mjs`, smoke `tools/cloud41-private-pilot-smoke.js`, rozszerzenia istniejącego `auth-browser.test.mjs`, dwóch poleceń w testowym package.json oraz tego raportu/CURRENT_STATE/ROADMAP/CLOUD_MIGRATION. Żaden plik produkcyjnego JavaScript nie został zmieniony. Plik package-lock i istniejące przypięcia zależności pozostały bez zmian.

Po udostępnieniu publicznych artefaktów trzeba wykonać kolejno (jedna instancja emulatorów naraz):

```sh
export PATH=/workspace/.cloud-tools/node-v22.23.3-linux-x64/bin:$PATH
export XDG_CONFIG_HOME=/workspace/.cloud-tools/config
export FIREBASE_EMULATORS_PATH=/workspace/.cloud-tools/firebase-emulators
export CI=1
npm --prefix tools/firebase-pilot run test:private-pilot
npm --prefix tools/firebase-pilot test
AUTH_POPUP_TEST=1 npm --prefix tools/firebase-pilot run test:browser
node tools/preflight.js
git diff --check
```

Nie pobierać zamienników emulatora z przypadkowych źródeł, nie zmieniać przypiętych hashy i nie osłabiać TLS. Publiczny plik emulatora wymaga dozwolonej domeny `storage.googleapis.com`; pełny Google popup także `apis.google.com`, a standardowy CDN SDK `www.gstatic.com`. Zapisano wymagania w szkicu konfiguracji środowiska; nie jest to ich zastosowanie ani publikacja. Oficjalny pakiet npm Firebase zawiera te same pliki SDK, o zgodnych hashach; wykorzystano je lokalnie bez zewnętrznych połączeń.

## Późniejsza aktywacja — nadal oddzielne zgody

1. Najpierw doprowadzić wszystkie powyższe testy do pełnego PASS i przejrzeć dokładny commit/artefakt. Obecna gałąź nie spełnia jeszcze tego warunku.
2. Osobna zgoda na Ready/auto-merge/Pages kodu. Wdrożenie samego kodu nie uruchamia operatora ani transportu LIVE.
3. Osobna zgoda na dokładnie sprawdzone minimalne Rules CLOUD-4. Porównać SHA pliku i artefaktu wdrożonego; zachować Auth-only. Nie używać pełnego profilu globalnego CLOUD-3.
4. Osobna zgoda na minimalny grant administracyjny i singleton CLOUD-4. Użyć istniejącej procedury i planu, zachować appEnabled i inne uprawnienia; nie zakładać stanu grantu na podstawie samego logowania.
5. Osobna zgoda na rzeczywisty syntetyczny zapis i niezależny odczyt. **Obecny wykonawca odmawia LIVE.** Dopiero wtedy poddać przeglądowi ograniczoną operatorską aktywację tego samego prywatnego call-site dla konkretnego projektu/pochodzenia i świeżej krótkiej zgody; nie usuwać bramki przez ogólną flagę ani dodawać publicznego UI/API. Użyć odseparowanych profili operatorskich bez danych właściciela, odtworzyć istniejące Google Auth i serwerową zgodę, potwierdzić brak sesji edycji. Nie dołączać do już uruchomionego programu ani przechwytywać jego sesji przez window.
6. Zapisać raz stałe syntetyczne źródło. Zanotować wyłącznie bezpieczny wynik i rewizję, nie tokeny/UID/RAW. Po niepewności zatrzymać kolejne zapisy. Odczytać z niezależnego klienta, porównać wszystkie bajty/hashe/model/PCV w RAM, bez importu.
7. Zatrzymanie: zamknąć prywatne uchwyty, po zgodzie wyłączyć wyłącznie grant pilota/singleton, pozostawić syntetyczne dokumenty do inspekcji. Cofnięcie Rules ma zachować profil Auth-only; żadnego automatycznego delete, resetu lub kompensacyjnego zapisu.

Budżet i limity Spark ponownie sprawdzić przed realną operacją zgodnie z CLOUD-4. Nie zwiększono uprawnień ani kosztowego zakresu pilota. SHA-256 zapewnia kontrolę integralności, nie podpis/autoryzację. Rules pozostają granicą danych w publicznej aplikacji; prywatność uchwytu nie zastępuje ich egzekwowania.

Odtworzenie modelu nie oznacza takiej samej WYCENY na nowym urządzeniu bez katalogów/cen. Globalne domeny, Issue #47, legacy overrides, drafty i historia ofert nie są transferowane. Lokalny autorytet nie został przełączony; pilot nie jest synchronizacją.
