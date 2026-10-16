# CLOUD-2B — przygotowanie pierwszego zapisu Firebase

Data: 2026-10-16. Baza: main `5a63cda6`. Zakres tej gałęzi: nieaktywny adapter, realne SDK i testy Auth/Firestore Emulator Suite. **Bez połączenia aplikacji z rzeczywistym Firebase, publikacji Rules, uploadu, zmiany UI lub lokalnego autorytetu danych.**

## Stan usługi a stan aplikacji

Użytkownik potwierdził konfigurację konsoli: Meble-App / `mebleszek-meble-app`, Spark bez billingu, aplikacja Web, Google Sign-In, authorized domain `mebleszek.github.io`, Firestore Standard `(default)` / `europe-central2` (Warszawa), pusta baza, opublikowane Rules `allow read, write: if false;`. Nie weryfikowano tego połączeniem z usługą i nie zmieniano konsoli. Historyczny raport CLOUD-2A opisuje wcześniejszy etap projektowania.

Ta implementacja **celowo odrzuca każdy transport live**, zanim załaduje SDK. Akceptuje wyłącznie jawne `target:'emulator'`, `demo-*`, loopback i podane porty. Nie zawiera rzeczywistego web config, UID użytkownika, tokenów ani service-account. Rejestracja trzech modułów classic-script tylko tworzy API; nie pobiera SDK, nie loguje i niczego nie wysyła.

## Pliki i odpowiedzialności

- `js/app/cloud/cloud-pilot-contract.js`: walidacja zamkniętej koperty CLOUD-1B, te same walidatory biznesowe, dokładne bajty kanonicznego UTF-8, hashe pliku i fragmentów oraz weryfikacja odczytu.
- `js/app/cloud/firebase-pilot-transport.js`: leniwe importy **Firebase Web SDK 12.19.0** z przypiętych URL `www.gstatic.com/firebasejs/12.19.0/`, jawne Auth Google, pamięciowy cache SDK, transakcje SDK i odczyty serwerowe. Brak bundlera i trwałej kolejki zapisu. Testy wstrzykują te same rzeczywiste moduły npm, bez zastępowania bazy mockiem.
- `js/app/cloud/project-cloud-pilot.js`: koordynacja eksportera, jawnej podstawy rewizji, etapowania, publikacji i potwierdzenia. Uchwyt próby przechowywany wyłącznie w WeakMap w RAM.
- `index.html`, `dev_tests.html`, `tools/index-load-groups.js`: wyłącznie trzy techniczne wpisy ładowania po eksporterze. Bez zmian struktury UI.
- `tools/firebase-pilot/`: izolowany pakiet narzędzi, lockfile, lokalny config emulatorów, Rules i testy rzeczywistego SDK. Brak `.firebaserc`, deploymentu, danych konta lub konfiguracji produkcyjnego projektu.
- `tools/firebase-pilot-smoke.js`: osiem testów kontraktu offline automatycznie wykrywanych przez istniejący preflight. **Nie zastępują** osobnego zestawu emulatorowego.

Nie zmieniono eksportera CLOUD-1B, modelu projektu, sesji/rollbacku, setterów PCV, matematyki WYCENY/ROZRYSU, katalogów, cenników, historii, backupów i retencji. Nie dodano kluczy local/sessionStorage.

## Kontrakt wewnętrzny i lokalny autorytet

`FC.firebasePilotTransport.create(...)` jest wywoływane wyłącznie jawnie przez izolowane testy. `FC.projectCloudPilot.create(transport)` udostępnia:

1. `readHead({investorId,projectId})` — potwierdzony odczyt manifestu serwerowego; brak dokumentu oznacza `null`.
2. `prepare({investorId,projectId,expectedHead})` — wymagany jawny `expectedHead`, `null` tylko dla pierwszej publikacji. Samodzielnie wywołuje rzeczywisty `FC.projectSelectiveExport.build`, nie przyjmuje dokumentu od innego launchera. Odrzuca aktywną sesję (także czystą), niepotwierdzony zapis, rozbieżny RAM, niewłaściwy kontekst i nieobsługiwane dane przez istniejące odmowy CLOUD-1B. Sprawdza podstawę serwerową i ponownie lokalny payload po haszowaniu.
3. `publish(handle)` — ponownie weryfikuje źródła, etapuje fragmenty, ponownie weryfikuje źródła, publikuje transakcyjnie i wymaga odczytu potwierdzającego. To nie jest funkcja produkcyjnego UI.
4. `confirm(handle)` — wyłącznie odczyt serwerowy; potwierdza dokładnie własną rewizję/hashe, nigdy dowolną najnowszą wersję.
5. `close()` — kończy uchwyt/Auth listener/instancję SDK; nie usuwa danych biznesowych.

Każda próba wiąże UID i jego epokę logowania. Zmiana konta, a także logout/login tego samego UID unieważnia stary uchwyt. Google `providerData` sprawdzane po stronie adaptera; Rules niezależnie wymagają `firebase.sign_in_provider == 'google.com'`. Brak/zmiana uprawnień blokuje bazę. `signInGoogle()` jest jawne; nie wywołuje się przy starcie ani renderowaniu.

Nie dodano importera ani podmiany lokalnego projektu. Lokalny projekt pozostaje jedynym źródłem pracy aplikacji; manifest testowy nie staje się konkurencyjnym autorytetem UI.

## Dokładne dane i integralność

Przesyłany jest **dokładny kanoniczny dokument CLOUD-1B**, bez ponownego mapowania modelu biznesowego. Limit 819 200 bajtów; fragmenty binarne po 131 072 bajty, maksymalnie siedem. Podział następuje po bajtach, także gdy przecina wielobajtowy znak UTF-8. Nie ma obcinania danych, kompresji, pełnej cutlisty ani dodatkowej kopii całego projektu.

- `payloadSha256`: dotychczasowy hash payloadu biznesowego, niezależny od daty eksportu.
- `documentSha256`: dotychczasowy hash koperty CLOUD-1B bez bloku integrity.
- `fileSha256`: hash dokładnych bajtów całego pliku łącznie z integrity.
- `chunkSha256[]`: hashe kolejnych fragmentów.

Adapter ponownie stosuje zamknięty walidator eksportu i sprawdza hashe przed etapowaniem. Tymczasowe flagi testowe używane przy walidacji wyeksportowanego payloadu nie są dowodem syntetyczności: rzeczywiste zapisane flagi, kontekst i allowlistę musi potwierdzić oryginalny builder. Hash nie jest podpisem ani autoryzacją i nie dowodzi pochodzenia tekstu.

## Model Firestore i Rules

```text
/authorizedUsers/{uid}                              administracyjny grant; klient read/write DENY
/users/{uid}/pilotProjects/{physicalProjectId}       jedyny wskaźnik opublikowanej rewizji
  /revisions/{random32hex}                          niezmienny opis + podstawa rewizji
    /chunks/{0..6}                                 niezmienne Blob/index/length/hash
```

Grant: `enabled:true`, `pilotProjectId`, `pilotInvestorId`. W teście bootstrap odbywa się tylko przez `withSecurityRulesDisabled` na lokalnym emulatorze; syntetyczny użytkownik Google jest zakładany wyłącznie w Auth emulatorze. Literalny emulatorowy `Bearer owner` w fixture nie jest rzeczywistym tokenem administracyjnym i nigdy nie trafia na adres usługi Google. Test odmawia startu bez dokładnych loopbackowych zmiennych obu emulatorów i używa tylko `demo-meble-app`.

Rules wymagają Google, zatwierdzonego UID, zgodności UID ścieżki i jednego projektu/inwestora przypisanego grantem. Zamknięte klucze dokumentów, wersje, ID, hashe, rozmiary, indeksy i serwerowe timestampy są sprawdzane. Listowanie, usuwanie, modyfikacja istniejącej rewizji/fragmentu, inne projekty/użytkownicy i wszystkie pozostałe ścieżki mają DENY. Klient nie może przyznać sobie grantu.

Publikacja manifestu wymaga wszystkich fragmentów i zgodności rewizji. Maksimum siedmiu fragmentów wymaga do dziewięciu różnych dokumentów kontrolnych (grant + rewizja + siedem fragmentów), mieszcząc się w limicie dziesięciu access calls na operację. Etapowanie maksymalnie ośmiu dokumentów używa wspólnych grant/revision i mieści się w limitach transakcji. **Rzeczywisty test 800 KiB/siedmiu fragmentów przechodzi przez emulatorowe Rules, a nie symulację ich warunków.**

**Granica bezpieczeństwa:** Rules nie mogą obliczać SHA-256 dowolnego Blob ani analizować pełnego JSON projektu. Sprawdzają zgodność zadeklarowanych hashy i struktury; rzeczywiste bajty weryfikuje zaufany adapter przy odczycie przed publikacją. Złośliwy posiadacz zatwierdzonego konta, używając własnego klienta, może podać fałszywe hashe lub dowolne dane wewnątrz Blob i tworzyć staging. Nie deklarujemy walidacji biznesowej po stronie serwera. Pilotaż pozostaje zamknięty, na kontrolowanych danych i koncie; szersze otwarcie wymaga osobnego modelu zagrożeń. Nie dodano Cloud Functions, Admin SDK ani płatnego walidatora.

## Konflikty, awarie i offline

Najpierw transakcja etapuje niezmienną rewizję i wszystkie fragmenty. Potem oddzielna transakcja odczytuje aktualny manifest, rewizję i fragmenty, sprawdza ich rzeczywistą integralność, ponownie sprawdza lokalny payload i UID, i aktualizuje manifest. Wymagany jest dokładny stary `generation`, ID i trzy hashe; nowa generacja to poprzednia + 1. Automatyczne ponowienie transakcji SDK ponownie wykonuje te kontrole. **Nie ma last-write-wins ani automatycznego przyjęcia nowszego head jako własnej podstawy.**

Idempotentna próba własnej już opublikowanej rewizji nie zwiększa generacji. Taki sam biznesowy payload przy zgodnym head daje `unchanged:true` bez nowych zapisów.

- Awaria przed manifestem: stary manifest pozostaje; osierocony staging nie jest aktywną wersją. Brak automatycznego usuwania/kompensacji.
- Utrata odpowiedzi po wysłaniu publikacji: `ok:false`, `published:'unconfirmed'`, blokada ślepego ponowienia (`CLOUD_CONFIRMATION_REQUIRED`). `confirm` sprawdza dokładnie własny head. Stary head pozwala na jawne ponowienie, odmienny head oznacza konflikt; nie dowodzi, że własny zapis nigdy wcześniej nie nastąpił.
- Zmiana lokalnego projektu po etapowaniu lub wewnątrz transakcji: odmowa; lokalny draft/PCV nie jest cofany ani wysyłany jako inny payload.
- Po restarcie uchwyt RAM nie istnieje. Można odczytać potwierdzony manifest, ale nie wolno odtwarzać próby z dowolnej najnowszej rewizji. Nie dodano trwałego dziennika prób ani nowego magazynu; pełne odzyskiwanie po restarcie wymaga przyszłego osobnego kontraktu.
- Odczyty wymagają serwera, bez `fromCache` i `hasPendingWrites`. SDK używa wyłącznie cache RAM, a zapisy są transakcjami, bez trwałej kolejki offline.
- Test wykazał, że w tym SDK `disableNetwork()` samo nie blokuje wszystkich transakcyjnych RPC. Dlatego adapter wykonuje jawny odczyt serwerowy także przed etapowaniem i publikacją; jego odmowa zatrzymuje operację. Potwierdzona regresja: offline przed publikacją nie tworzy fragmentów ani manifestu i nie odtwarza zapisu po odzyskaniu połączenia. Utrata sieci w trakcie zapisu nadal oznacza jawnie niepewny wynik i wymaga odczytu potwierdzenia.

Nie jest to pełna synchronizacja/offline ani atomowa transakcja obejmująca localStorage i Firestore. Między ostatnim sprawdzeniem lokalnego stanu a zdalnym commitem pozostaje granica dwóch systemów; opublikowany snapshot jest wersją przygotowanego, sprawdzonego payloadu. Późniejsza edycja nie modyfikuje historycznej rewizji. Zapis innych projektów nie unieważnia bez potrzeby eksportu wybranego A.

## Testy i odtwarzanie

Wymagania: Node 22+, Java 21, porty 19099/18080/4400/4500/9150 wolne. Instalacja wyłącznie narzędzi testowych:

```sh
cd tools/firebase-pilot
npm ci
npm test
```

`npm test` sam uruchamia i zamyka oba emulatory z `--project demo-meble-app`; UI emulatora wyłączone. Nie podaje rzeczywistego project ID ani nie loguje Firebase CLI. SDK w testach jest rzeczywiste; mockowane są tylko punkty przerwania/utraty odpowiedzi wokół rzeczywistej transakcji. Izolowany MemoryStorage i rzeczywiste moduły eksportu/projektu/sesji zapewniają lokalną część scenariuszy.

W Codex cache/config npm i CLI muszą wskazywać zapisywalne katalogi środowiska; emulator Firestore 1.22.0 pobrano z oficjalnego HTTPS, sprawdzono rozmiar oraz SHA-256 z przypiętego Firebase CLI: `9b6498b7f62714d67f48f59b3818883cd682dbcd46b9f59511de81c97bb5166c`. Nie wyłączano TLS ani weryfikacji artefaktu.

Zestaw emulatorowy obejmuje: rzeczywisty Google emulator/UID; dokładną kopertę i read-back; brak auth/anonymous/obcy UID/projekt/grant; niedozwolone pola/inwestora/fragmenty; kompletność i niezmienność; 800 KiB/siedem fragmentów; konflikt dwóch urządzeń; kolejne rewizje/stary head; przerwanie stagingu; utratę odpowiedzi po commicie; zmianę źródła po stagingu i wewnątrz transakcji; korupcję bajtów; wylogowanie/cofnięcie grantu; aktywną/niepotwierdzoną sesję i RAM; ochronę globalnych danych/ORS/historii; offline; niezwiązany projekt B; epokę ponownego logowania.

Wyniki końcowe, Node **22.23.3**, Java **21.0.12.1**:

| Weryfikacja | Wynik |
|---|---|
| `npm ci --no-audit` z lockfile + `npm test` | **17/17 PASS**, zero skipped; samodzielny start i zatrzymanie Auth/Firestore emulatorów |
| `node tools/firebase-pilot-smoke.js` | **8/8 PASS**, bez SDK/emulatorów/sieci |
| CLOUD-1B selektywny eksport | **62/62 PASS** |
| Niepotwierdzona sesja P1/P2/P3 | **30/30 PASS** |
| Rollback właściciela pokoju/projektu | **26/26 PASS** |
| Bezpieczeństwo globalnych zapisów | **30/30 PASS** |
| Adaptery kalkulacji R1/R2/W1/W2 | **27/27 PASS** |
| Integracja projektowego PCV w UI | **60/60 PASS** |
| Wielopomieszczeniowa kalkulacja i sesja | **PASS**, zachowane **4/3/6 arkuszy** |
| Pełny `node tools/preflight.js` | **PRE-FLIGHT PASS**, 120/120 smoke, APP 110/110, składnia 531/531, load order 323, dependency/storage PASS (341 referencji / 41 plików) |
| Dodatkowy `node --check` wszystkich zmienionych JS oraz `pilot.test.mjs` | **PASS** |
| `git diff --check` | **PASS** |

Regresje adapterów potwierdzają **17,122 → 18,834 mb**, fronty **5,010 → 5,511 mb**, ten sam cennik i **jeden** zapas 10%. Nie zmieniono oczekiwań istniejących testów. Żaden test nie korzystał z produkcyjnych danych użytkownika; emulatory zostały zatrzymane. Testy emulatorowe nie są dowodem działania prawdziwego Google popup na Androidzie ani wdrożonych Rules rzeczywistej bazy.

## Luki i warunki przed pierwszym rzeczywistym zapisem

1. **W tej gałęzi brak transportu live; żadne wywołanie API nie może go włączyć flagą.** Potrzebna osobna, zatwierdzona zmiana kodu z jawnym realnym web config i docelowym środowiskiem, bez automatycznego startu. Nie dodawać ręcznego workflow użytkownika; testowy launcher nadal musi być izolowany i jawny.
2. Użytkownik po osobnej zgodzie musi potwierdzić Spark/bez billingu, region, provider, domenę i własny Firebase UID; UID/grant bootstrapować w konsoli poza repo. Nie przesyłać tokenów/konta do raportu. Przed tą decyzją rzeczywiste Rules pozostają **deny-all**.
3. Przed osobno zatwierdzonym wdrożeniem Rules ponownie przejrzeć dokładny plik i ograniczenia modelu zagrożeń, wykonać emulator suite oraz test odrzucenia obcego konta. Brak możliwości serwerowej walidacji Blob i ryzyko nadużycia stagingu nie mogą być przemilczane. Nie uruchamiać deploymentu z tej gałęzi automatycznie.
4. Przetestować realny Google popup/obsługę zamknięcia i konto na Androidzie w dozwolonym izolowanym środowisku, po osobnej zgodzie. Tablet/komputer pozostają docelowe; nie wymagać od użytkownika ich ręcznej akceptacji teraz. Nie zakładać działającego redirect na GitHub Pages.
5. Audyt npm z 2026-10-16 wykazał **15 zgłoszeń (8 high, 7 moderate)** w drzewie narzędzi/SDK Node: m.in. `@grpc/grpc-js` 1.9.16 przypięty przez Node Firestore SDK, `braces`, `uuid`, `@opentelemetry/core`. Część nie ma naprawy zgodnej z tymi wersjami. Brak `npm audit fix --force`/niezweryfikowanych overrides. Narzędzia działają wyłącznie na loopback, na danych syntetycznych, bez poświadczeń. Browser Web SDK używa innego transportu niż Node gRPC, lecz to nie zamyka przeglądu zależności. **Przed transportem live wymagana ponowna ocena aktualnych wersji i ekspozycji; nie deklarujemy zera podatności.**
6. Przed pierwszym zapisem: wyłącznie jeden istniejący, jawnie wskazany syntetyczny I/P zgodny z grantem, zakończona potwierdzona sesja, zgodny RAM, zamknięta allowlista CLOUD-1B, poprawne PCV/ref/count/date, brak sekretów/swobodnych notatek, do 800 KiB. Znane globalne zależności pozostają poza payloadem.
7. Zmierzyć rzeczywiste operacje/limity Spark przed rozszerzeniem zakresu: nowa rewizja to `chunkCount + 2` zapisów (header, fragmenty, manifest) i dodatkowe odczyty transakcyjne/serwerowe. Ponowienia i odmowy również zużywają odczyty; powtórny niezmieniony payload nie tworzy nowych zapisów. Nie aktywować billingu ani zmieniać retencji/backupów.
8. CLOUD-2C (pobranie, pełna walidacja i kontrolowany test odtworzenia) nadal osobne. Odtworzenie danych nie dowodzi identycznej WYCENY bez katalogów/defaultów/słojów. Issue #47 nadal otwarte. Docelowa automatyczna synchronizacja i chmurowy autorytet wymagają kolejnych zatwierdzonych etapów.
