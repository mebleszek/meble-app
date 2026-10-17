# CLOUD-3 — fundament danych globalnych i przyszłego LIVE

Baza: `65085d18bdbefdef0aa256a568b7af0e259a481b`, aktualny origin/main po PR #59. Gałąź `cloud-3-global-data-foundation`. Polecenie właściciela obejmuje implementację, emulatory, regresje, dokumentację i push; **nie** Ready, merge, Pages, operacje produkcyjnego Firebase, granty, Rules, migrację lub przełączenie autorytetu.

## Stan potwierdzony i granica aktywacji

Właściciel potwierdził PR #59: **CI PASS, auto-merge PASS, Pages PASS, Android zaakceptowany**. PR #57 uruchomił główne Google Auth i profil Auth-only; PR #59 dodał atomowy profil IndexedDB, usunął produkcyjny UID i przygotował nieaktywny LIVE oraz emulatorowy odczyt CLOUD-2C. Statusy dawnych gałęzi w historycznych raportach nie opisują już ich stanu scalenia.

CLOUD-3 nie zmienia `index.html`, manifestów, `main-login.js`, App/Auth, konfiguracji, oryginalnego logo, IndexedDB właściciela v2/v3, lokalnych setterów ani kalkulatorów. Nowe trzy moduły **nie należą do żadnego loadera**. Rejestracja ich kodu nie importuje SDK, nie czyta localStorage i nie nawiązuje połączenia. Brak przełącznika LIVE, nowego UI, uploadu przy logowaniu, listenera katalogów, importera, kolejki offline i synchronizacji działającego programu. Lokalne repozytoria nadal są jedynym aktywnym autorytetem.

## Minimalna granica przyszłego LIVE

`cloud-data-session.js`: wewnętrzne `FC.cloudDataSession.borrow({authSession,assertAccess,sdk?})` korzysta z istniejącego `firebasePilotLiveTransport.create()`. Pożycza skonfigurowane App/Auth/Firestore i tworzy dwa odrębne adaptery: `projects` (ten sam CLOUD-1B/2B/2C) oraz `globals`. Nie jest publicznym dostępem do prywatnej sesji main-login i nie tworzy Auth, tokenów, persistence lub drugiej instancji bazy.

Przyszłe wywołanie musi pochodzić z właściciela prywatnego kontekstu main-login, z rzeczywistym `authSession` i synchronicznym `lease.assert()`. **Tego wywołania ani udostępnienia kontekstu nie dodano**. Wymaga osobnej zgody i sprawdzenia zachowania w trakcie utraty uprawnień. Bezpośrednie dotychczasowe `firebasePilotTransport.create({target:'live'})` nadal odmawia przed importem SDK.

`globals.close()` i zamknięcie całej pożyczonej granicy blokują własne uchwyty, lecz nie wywołują signOut, deleteApp, terminate lub initializeFirestore. Każdy adapter wiąże UID i epokę; logout i ponowny login tego samego UID wymagają nowego uchwytu. Kontrole następują przed/po await i wewnątrz ponawianych transakcji. Lokalny proof nie zastępuje Rules; jawny grant biznesowy jest oddzielony od `appEnabled`.

## Kontrakt danych: 14 domen

`global-data-contract.js` zawiera zamknięte, typowane schematy (`schemas`), RAW źródła (`sources`), walidację relacji i deterministyczną kanonizację CLOUD-1B. Brak normalizacji, generowania biznesowych ID lub podmieniania brakujących danych seedem. Nieznane pola, także zagnieżdżone, odmawiają `GLOBAL_UNKNOWN_FIELD` bez ujawnienia ich nazw/wartości w błędzie.

| Domena | Źródło lokalne i dowód modelu | Stabilna tożsamość / zależności |
|---|---|---|
| materials | `fc_sheet_materials_v1`; `catalog-store.normalizeMaterialRow` | `id`; typ/dekor, nazwa, producent/symbol, cena/jednostka, hasGrain, starterPrice, data ręcznej edycji, note |
| hardware | `fc_accessories_v1`; `hardware-catalog.normalizeAccessory` | `id`; manufacturer → słownik nazw, category → kategorie, supplierId/supplierPrices → dostawcy, bundleItems.itemId → okucia |
| manufacturers | `fc_hardware_manufacturers_v1`; `normalizeManufacturerList` | Dokładna nazwa jest istniejącym kluczem; nie wymyślono ID. Zmiana nazwy wymaga grupowego przepisania referencji. |
| suppliers | `fc_hardware_suppliers_v1`, alias `hardwareSuppliers`; `normalizeSupplier` | `id`; nazwa, defaultDiscountPercent, active; wszystkie supplierPrices pozostają we właściwym okuciu |
| categories | `fc_hardware_categories_v1`, alias `hardwareCategories` | Dokładna nazwa; nie indeks ani nowe losowe ID |
| types | `fc_hardware_types_v1`, alias `hardwareTypes`; `normalizeTypeDefinition` | `id`; name, allowedCategories, active |
| technicalParams | `fc_hardware_technical_params_v1`, alias `hardwareTechnicalParams`; `hardware-technical-params.normalizeDefinition` | `id` i unikalna para category/key; label, fieldType, unit, options, keyFeature/typePart, compareMode/order/active/legacyField |
| hardwareSettings | `fc_hardware_settings_v1`, alias `hardwareSettings`; `normalizeSettings` | Singleton; defaultSupplierId, VAT, narzut, baza ceny, pricingMode |
| labor | `fc_quote_rates_v1`; `labor-catalog.normalizeDefinition`, `hourly-rates-store` | `id`; rateKey/rateCode, reguły ilości/czasu/progów/objętości i warunki; brak drugiej kolekcji stawek godzinowych |
| workshopServices | `fc_workshop_services_v1`; `catalog-store.normalizeServiceRow` | `id`; ten sam bezstratny schemat usług/robocizny, odrębny katalog |
| stock | `fc_sheets_v1.sheets`; `magazyn.upsertSheet` | `id`; material, width/height w mm, qty całkowite ≥0. Jednostką jest sztuka arkusza. Nie dodano rezerwacji magazynowych. |
| programDefaults | `fc_program_defaults_v1`; `program-defaults-store` | Singleton v2 (oraz jawnie udokumentowany v1 z materials/hardware, zachowany bez migracji); general, lower/middle/upper, materiał/PCV, preferencje sprzętu i canonical drawerPreference system/box |
| company | `fc_company_profile_v1`; `company-profile-store` | Singleton; dokładne pola firmy, transportu i meta.updatedAt **bez apiKey** |
| businessCosts | `fc_business_costs_v1`; `business-costs-store` | Singleton z rows zachowującymi własne `id`, kategorie, nazwy, kwoty tekstowe, VAT, okres/dzień/notatkę/active i datę aktualizacji |

Pełną listę pól każdego wiersza określa kod `schemas`, a nie otwarty JSON. Zachowano także obecne pola cen pochodnych zapisywane przez normalny katalog okuć; nie przeliczamy ich i nie usuwamy pod pozorem cache. Puste opcjonalne liczby drawerLengthMm/drawerLoadKg pozostają pustym tekstem, zgodnie z rzeczywistym modelem.

Parametry dynamiczne mają jawny klucz z definicji właściwej kategorii; value/from/to i ich typy zależą od fieldType. Brak definicji aktywnie użytego parametru, dostawcy, kategorii, składnika zestawu albo stawki czasowej oznacza odmowę. Cykle bundleItems i duplikaty ID/category+key/kodów stawek są odrzucane. Zamienniki są wynikiem `hardware-replacement-engine`, nie znaleziono oddzielnego autorytatywnego magazynu decyzji zamiany. Zachowujemy wejściowe parametry i reguły compareMode/kompatybilności; nie kopiujemy wyników podglądu do chmury.

**Istotne granice relacji:** natywne definicje parametrów zawierają też kategorie jeszcze nieobecne w słowniku (np. Ociekarki). Nieużyta definicja jest zachowywana i zgłaszana jako `unusedParameterCategory`, a nie usuwana lub automatycznie dopisywana do słownika. Użycie przez okucie kategorii nieobecnej w słowniku jest błędem. `stock.material` jest swobodnym istniejącym kluczem produkcyjnym, nie gwarantowanym materialId. Zwracamy `productionMaterialKey`; powiązanie musi potwierdzić resolver projektu przed kalkulacją. Program defaults również odwołuje się do nazw materiałów i wbudowanych systemów szuflad; ich dostępność na docelowym runtime wymaga sprawdzenia. Nie zmieniamy znaczenia tych pól.

## Ścisły odczyt i ochrona źródła

`capture(storage, domains)` jest wyłącznie wewnętrznym odczytem jawnie wybranych źródeł. Nie enumeruje localStorage, nie korzysta z backupu lub normalizujących getterów. Odmawia przy niedostępnym/błędnym/brakującym RAW i przy istniejącym `fc_edit_session_v1` (także niebrudnym, uszkodzonym lub niepotwierdzonym). Ścisły brak klucza nie staje się pustym katalogiem.

Dla pięciu historycznych aliasów oraz `fc_materials_v1`/`fc_services_v1` obsługuje brak klucza głównego. Gdy oba istnieją, muszą być semantycznie identyczne; rozbieżność oznacza `GLOBAL_ALIAS_CONFLICT`, a nie wybór danych kosztem drugiej wersji. Historyczny mieszany materials z nieobsługiwaną strukturą wymaga świadomego rozstrzygnięcia, nie jest migrowany podczas odczytu. Nie powstają równoległe chmurowe kolekcje kopii kompatybilności.

Znany `company.transport.apiKey` jest **jawnie lokalnym sekretem, wykluczonym przed serializacją**. Nie jest zwracany w diagnostyce. Pozostałe pola transportu zachowujemy dokładnie. Nie dopuszczamy otwartych meta ani dodatkowych kluczy. Rozpoznawalne tokeny Google/klucze Google/private key w polach tekstowych również odmawiają. Walidator nie jest uniwersalnym detektorem dowolnego sekretu ukrytego w notatce; dlatego testy są wyłącznie syntetyczne, a transfer prawdziwych danych wymaga osobnego przeglądu zakresu. Żadnych źródeł firmy, katalogów właściciela ani backupów nie odczytano.

Wynik capture ma odłączony model i `assertUnchanged()`, porównujący RAW wybranych kluczy oraz stan sesji. Przekazać go jako `assertSource` do prepare. Przygotowanie i publikacja sprawdzają źródło przed/po haszowaniu i przed zapisem. Niezwiązany projekt nie jest odczytywany ani blokowany. To kontrola wykrywalnych zmian, nie transakcja localStorage między kartami. Capture nie dowodzi, że stary lokalny writer nie wykonał wcześniej nieudokumentowanego częściowego zapisu; rozbieżne kopie/relacje odmawiają, ale migracja rzeczywistych danych wymaga dodatkowego potwierdzenia kompletności.

## Transport globalny i atomowa publikacja

`firebase-global-transport.js` udostępnia tylko `fromConnection({firestore,db,session,assertAccess})`. Nie posiada tworzącego App/Auth `create({target})`. API: `readHead()`, `prepare({model,expectedHead,assertSource?})`, `publish(handle)`, `confirm(handle)`, `read()`, `close()`. Wymagany jest jawny optimistic base (`null` tylko dla pierwszej publikacji) oraz **kompletny zestaw 14 domen**. Podzbiór domen jest dozwolony do analizy RAW/kontraktu, ale nie może zastąpić zatwierdzonej całości w transporcie.

Kandydackie ścieżki, wyłącznie emulatory:

```text
users/{uid}/globalRecords/{sha256}      # immutable {ownerUid,version,domain,recordId,hash,json,byteLength}
users/{uid}/globalRevisions/{revision} # immutable directory, pełna baza CAS i identyfikatory/hash/licznik
users/{uid}/globalData/current        # jedyny autorytatywny head globalnego zestawu
```

SHA-256 rekordu obejmuje kanoniczną kopertę version/ownerUid/domain/recordId/value, więc identyczne ID innych domen lub UID nie kolidują. Directory zachowuje kolejność tablic i mapuje każdą domenę do `{id,hash}`. Nie jest drugą kopią katalogów; niezmienione rekordy są ponownie używane. Rewizja i current powstają w **jednej transakcji**, dopiero po stagingu wszystkich brakujących rekordów oraz odczycie i pełnej walidacji zestawu. Istniejące immutable dokumenty muszą być dokładnie zgodne, a nie nadpisywane.

Nowa generacja wymaga dokładnie tej samej podstawy generation/revisionId/directoryHash. Dwa klienty nie łączą zmian po cichu; jeden CAS wygrywa, drugi otrzymuje `GLOBAL_WRITE_CONFLICT` i musi przygotować świadomą nową zmianę. No-op rozpoznawany po directoryHash nie tworzy dokumentów. Emulator potrafi zgłosić odrzucenie konkurencyjnego CAS jako permission-denied zanim SDK zwróci aborted. Tylko świeży, nadal autoryzowany odczyt innego head pozwala sklasyfikować je jako konflikt; brak grantu pozostaje odmową. Nie ponawiamy zapisu, nie zmieniamy Rules w celu przepuszczenia starej rewizji. Oprócz 8 rzeczywistych par CAS dodano deterministyczną regresję tej kolejności.

Zapis używa tylko transakcji serwerowych; nie używa offline setDoc/writeBatch/persistence ani kolejki. Server preflight odmawia przy disableNetwork; sam transaction RPC nie jest dowodem online. Awaria stagingu pozostawia najwyżej nieopublikowane immutable rekordy, nie częściowy zatwierdzony model. Błąd publikacji lub read-back jest `published:'unconfirmed'`, nie pozornym niepowodzeniem. Ślepe retry odmawia `GLOBAL_CONFIRMATION_REQUIRED`. `confirm(handle)` uznaje wyłącznie dokładnie własny head; dawna podstawa to `GLOBAL_PUBLICATION_NOT_OBSERVED`, inna rewizja to konflikt. Po utracie RAM uchwytu nie ma automatycznego odtworzenia intencji ani kompensacyjnego zapisu.

Niezależny read: serwerowy current i świeża transakcja uprawnień → rewizja → ograniczona/walidowana directory → odczyt wskazanych immutable rekordów w ograniczonych transakcjach (do 32 na partię, z kontrolą sumy bajtów przed zachowaniem modelu) → SHA-256, rozmiary, kanoniczny JSON, UID/domena/ID, biznesowy schemat i referencje → końcowe porównanie head. Zmiana podczas haszowania daje `GLOBAL_READ_CONFLICT`. Zwraca model do RAM; nie importuje do localStorage. Późniejsza zmiana już po zwrocie wyniku wymaga przyszłego mechanizmu synchronizacji.

## Kandydackie Rules: zakres ochrony i ograniczenia

Zmieniono **tylko emulatorowy `tools/firebase-pilot/firestore.rules`**, dodając trzy powyższe ścieżki. Stare ścieżki pilota, kontrola UID/Google, appAccess i default-deny pozostają. `firestore-auth-only.rules` nie zmieniono; rzeczywista baza nadal używa Auth-only.

Wymagany administracyjny grant `authorizedUsers/{uid}`: dotychczasowe `appEnabled:true` **oraz osobne** `globalDataEnabled:true`, `globalSchemaVersion:1`. Grant projektu `enabled/pilotProjectId/pilotInvestorId` nie daje dostępu do katalogów, a globalny grant nie daje dostępu do projektów. Klient nie listuje/odczytuje/edytuje grantów, cudzej przestrzeni lub nieznanych ścieżek. Global records i revisions są create-only, bez delete/list; current ma CAS i wskazuje rewizję utworzoną w tej samej transakcji. Profile Auth-only i pełny kandydat pozostają oddzielone.

Rules sprawdzają zamknięte koperty, UID, domenę, typy/limity, identyfikatory, generację, bazę rewizji i powiązanie publikacji. **Nie obliczają SHA-256, nie parsują JSON i nie sprawdzą dowolnej liczby referencji katalogowych w limicie get/getAfter.** Tak jak dla pilota projektów, zatwierdzony własny złośliwy klient może zanieczyścić własny staging lub head niepoprawną directory; kontrolowany reader musi odmówić i nigdy nie importować takiego stanu. To nie jest serwerowy dowód biznesowej kompletności. Przy szerszym modelu uprawnień/współpracy potrzebne będzie ponowne zatwierdzenie granicy zaufania lub zaufany walidator. Brak kosztownych Cloud Functions lub Blaze w tym pakiecie.

## Wielkość i koszty Spark

Techniczne granice profilu v1: rekord ≤128 KiB UTF-8, directory ≤128 KiB UTF-8, ≤1024 rekordy, suma ≤32 MiB. Zbyt duża pozycja/singleton/katalog odmawia, bez obcinania, domyślnego pustego stanu lub kompresji. To ograniczenie tego profilu, nie zatwierdzony limit produktu. Przyszły większy model wymaga zatwierdzonego podziału dużych rekordów/directory. Teksty JSON i koperty pozostają poniżej limitu Firestore 1 MiB także z narzutem. Rules stosują dodatkowe ograniczenia długości; klient mierzy faktyczny UTF-8. Kandydacki `firestore.indexes.json` wyłącza nieużywane indeksowanie dużych pól `globalRecords.json` i `globalRevisions.directory`; nie wdrożono go w produkcji.

Zapis zmienionej ceny to **1 nowy rekord + 1 rewizja directory + 1 current**, bez ponownego uploadu pozostałych rekordów. Initial read to około N+5 odczytów, pełna prepare/publish/confirm około 2N+12 (bez ponowień i dodatkowego rozliczania zależności Rules). Nie jest to jeszcze zoptymalizowana subskrypcja różnicowa. Directory jest przepisywana przy publikacji; rekordy katalogów nie. Przy pełnym odczycie dużych katalogów oraz częstych zapisach trzeba zmierzyć rzeczywisty budżet i zaprojektować zatwierdzony cache immutable rekordów; nie dodano nowego frameworka cache.

Spark: planowanie względem darmowego limitu 50 tys. odczytów/dzień, 20 tys. zapisów/dzień, 20 tys. usunięć/dzień, 1 GiB przechowywania i 10 GiB/miesiąc transferu wychodzącego; zweryfikować aktualne kwoty i region przed aktywacją. Weryfikacja appAccess co 30s, granty w Rules, transakcyjne powtórzenia i katalogi dzielą ten sam budżet projektu. Niezmienne stare rewizje/staging rosną; nie wdrożono samoczynnego GC, TTL, retencji ani kasowania. Musi powstać osobna bezpieczna polityka utrzymania przed dłuższym LIVE. 0 zł stałych opłat pozostaje celem; żadnego billingu nie włączono. Limity dokumentu/Rules: https://firebase.google.com/docs/firestore/quotas ; wycena odczytów Rules: https://firebase.google.com/docs/firestore/pricing .

## Dane projektowe, inwestorzy i zamrożona historia — kontrakt przyszły

Nie powstał drugi eksporter pełnego projektu ani ofert. `projects` nadal używa dokładnie CLOUD-1B: jeden syntetyczny investorId + fizyczny projectId, pokoje/roomOrder, cabinets.id, sets.id i projektowe partOverrides/cabinetGroupOverrides/setGroupOverrides. Autoryzowany UID jest właścicielem przestrzeni, **nie** zastępuje investorId/projectId/roomId/cabinetId/setId. Usunięcia/tombstones oraz projekcje investor.rooms wymagają przyszłego zatwierdzonego kontraktu domenowego; nie kopiować lokalnych recovery markerów.

Dla przyszłych historycznych ofert: snapshot.id + investorId + fizyczny projectId + exact scope/roomIds i wersja istniejącego snapshotu. Zamrożone lines/materialLines/hardware/labor, ceny/jednostki/ilości/totals, daty i kontekst obliczeń należą do historycznej wersji, **nie** do aktualnej directory katalogów. Zmiana ceny globalnej nie zmienia snapshotu. Dozwolone metadane/statusy wymagają oddzielnej rewizji/CAS z istniejącym ograniczeniem pól, bez zmiany frozen core. Nowy kandydat wymaga bieżącego proofu projektu/zakresu zgodnie z obecnym magazynem; przyszła integracja chmurowych cen musi dodatkowo przypiąć i sprawdzić head/directoryHash globalnych danych przed save/replace, także po asynchronicznym dialogu. Nie dodano tego proofu do obecnego lokalnego kalkulatora; nie przenosimy starego proofu na dowolny nowy stan. Brak nowej chmurowej ścieżki zapisu ofert w tym pakiecie.

Odtworzenie modelu projektu i 14 domen nie dowodzi jeszcze identycznej WYCENY. Brakuje m.in. projektowej własności słojów/rotacji (Issue #47), rozstrzygnięcia legacy overrides/draftów, pełnego pokrycia produkcyjnych struktur spoza profilu CLOUD-1B, powiązania material keys/program defaults z katalogami i wersją wbudowanych algorytmów/seedów, kontraktu inwestorów/tombstones/projekcji i zamrożonej historii, zatwierdzonej migracji oraz cache/subskrypcji. Jedno urządzenie nie może mieć innych niewysłanych wymagań globalnych.

## Poza transferem, dane nierozstrzygnięte

- `fc_edge_v1`: legacy PCV bez pewnego właściciela, nie mieszać z projektowym PCV.
- `fc_material_part_options_v1`, `fc_rozrys_grain_state_v1`: rzeczywiste decyzje produkcyjne bez docelowego właściciela (Issue #47), **nie** zbędny cache.
- `fc_rozrys_overrides_v1`: nieustalony historyczny konsument/własność.
- `fc_quote_offer_drafts_v1`: niejednoznaczny fallback projectId/investorId; nie frozen history.
- `fc_service_orders_v1`, `fc_investor_removed_ids_v1`, snapshoty ofert: osobne domeny biznesowe, **nie** globalna konfiguracja; potrzebny kolejny kontrakt, nie eksportowane jako katalog.
- Wszystkie wpisy LOKALNIE, backupy/retencja, sesje, UI, cache/derivedFacts, lokalne dowody IndexedDB i Firebase persistence/tokeny: bez transferu, resetu i nowych kopii.

## Weryfikacja

Nowy smoke kontraktu obejmuje 14 domen, dokładny roundtrip/order/referencje, delta rekordów, pięć aliasów i legacy mirror, sekret ORS, nieznane pola, błędne zależności/cykle/typy/ID/rozmiary, RAW/aktywną sesję i brak zapisów. Test natywny używa istniejących writerów katalogu, ustawień i magazynu na izolowanym MemoryStorage, a potem porównuje payload i wszystkie bajty źródła.

Nowy `global.test.mjs` wykonuje realny Auth/Firestore SDK roundtrip dwóch niezależnych klientów, zmianę ceny/pozycji/stanu, CAS dwóch publikacji, granty/UID/anonymous/logout/epokę, offline bez kolejki, przerwany staging, utracony ack i confirm, uszkodzone dane, brak zależności, limity i odmowę Rules. Chromium testuje przyszłą prywatną granicę na **rzeczywistej sesji głównego logowania**: brak pobrania nowych modułów przy normalnym starcie, jawne dołączenie tylko w teście, serwerową odmowę bez osobnego grantu, close bez utraty Auth/Firestore/weryfikatora i niezmienność fc_* oraz aliasów. Nie jest to test prawdziwego Androida ani produkcyjnego Firebase.

Końcowe wyniki po finalnych zmianach kodu/testów:

- `node tools/cloud-global-data-smoke.js`: **13/13 PASS**; także niezależne limity rekordów/directory/sumy bajtów, niezmienność RAW i biznesowy błąd mimo poprawnie przeliczonych hashy.
- `npm --prefix tools/firebase-pilot test`: **58/58 PASS**, zero skipped; 17 nowych testów globalnych, pozostałe regresje Auth/Rules/CLOUD-1B/2B/2C. Obejmuje 8 par konkurencyjnych CAS, deterministyczną odmowę Rules i katalog większy niż 32 rekordy odczytywany przez drugi klient.
- `AUTH_POPUP_TEST=1 npm --prefix tools/firebase-pilot run test:browser`: **28/28 PASS**, zero skipped; rzeczywisty Chromium/Google helper w izolacji emulatorowej, współdzielona sesja, server verifier, restart, rollback, IndexedDB v2/v3, 100 wyścigów różnych UID — zero podwójnych dopuszczeń. To nie rzeczywisty Android ani produkcyjny Firebase.
- Finalny `node tools/preflight.js`: **PRE-FLIGHT PASS**, **547/547 JS syntax**, **123/123 smoke**, APP **110/110**, load order **331**, dependency PASS (411 domenowych JS), storage PASS (342 referencje/42 pliki).
- Zachowane regresje projektowego PCV: **16,440 → 17,122 → 18,834 mb**, fronty **5,010 → 5,511 mb**, pojedynczy zapas 10%, referencyjny ROZRYS **4/3/6 arkuszy**. Preflight obejmuje sesje/rollback, częściowe zapisy, dane globalne, materiały, optymalizator/magazyn i zamrożone oferty. Nie zmieniono ich asercji ani matematyki.
- `node --check` finalnych 6 JS/MJS, parsowanie 3 konfiguracji JSON i `git diff --check`: **PASS**. Ponowne SHA-256 wszystkich 10 plików kodu/testów/konfiguracji potwierdziło brak zmian po końcowej weryfikacji.

Pierwszy pełny przebieg emulatorów miał 54/54 PASS; późniejszy 55/56 ujawnił opisany błąd klasyfikacji CAS, naprawiony bez osłabiania asercji. Kolejny pełny miał 57/57 PASS, a końcowy po ograniczeniu partii odczytu i regresji większego katalogu **58/58 PASS**. Logi tej sesji pozostają poza repozytorium: `/tmp/cloud3-global-contract-final.log`, `/tmp/cloud3-emulators-release.log`, `/tmp/cloud3-chromium-verified.log`, `/tmp/cloud3-preflight-release.log`. Nie zawierają rzeczywistych danych właściciela; testy są syntetyczne.


Pliki pakietu (15):

- `js/app/cloud/global-data-contract.js`
- `js/app/cloud/firebase-global-transport.js`
- `js/app/cloud/cloud-data-session.js`
- `tools/cloud-global-data-smoke.js`
- `tools/firebase-pilot/global.test.mjs`
- `tools/firebase-pilot/auth-browser.test.mjs`
- `tools/firebase-pilot/firestore.rules`
- `tools/firebase-pilot/firestore.indexes.json`
- `tools/firebase-pilot/firebase.json`
- `tools/firebase-pilot/package.json`
- `CURRENT_STATE.md`, `ROADMAP.md`, `CLOUD_MIGRATION.md`, `CLOUD_DATA_REGISTER.md`
- `tools/reports/cloud-3-global-data-foundation.md`

Nie zmieniono produkcyjnego profilu Auth-only, loginu/loadera, Web config, profilu IndexedDB, mechanizmów sesji, backupów, setterów, modeli lub algorytmów. Istniejące bajty localStorage nadal pozostają lokalne po logout; autoryzacja UI/IndexedDB nie szyfruje danych i nie chroni przed właścicielem przeglądarki, DevTools lub XSS. Na współdzielonym urządzeniu wymagane są odrębne profile systemu/przeglądarki. Nowy transport nie przypisuje starych danych do UID i nie rozwiązuje tego ograniczenia przez kasowanie.


## Kolejność przyszłego kontrolowanego uruchomienia

1. Audyt kodu i wyników CLOUD-3; świadoma decyzja wydania osobnego SHA, bez automatycznego LIVE.
2. Rozstrzygnięcie danych nieobjętych kontraktem i zależności koniecznych do identycznych kalkulacji, zakresu własności, migracji i budżetu/retencji; zweryfikowana prywatna kopia wartościowych danych wraz z aliasami (standardowy backup nie obejmuje wszystkiego).
3. Osobna zgoda na minimalne udostępnienie prywatnej sesji main-login i kontrolowany syntetyczny pilot. Nigdy globalny uchwyt sesji lub boolean zamiast lease.
4. Osobny przegląd/wdrożenie kandydackich Rules i administracyjny grant **tylko zatwierdzonego syntetycznego zakresu**, bez publikowania UID w repo. Zachować odrębne uprawnienia aplikacji, projektów i domen globalnych.
5. Dopiero osobno zatwierdzony realny zapis/niezależny odczyt syntetycznego zakresu, pomiar kwot/konfliktów/awarii i potwierdzenie użytkownika. Ten etap nie został wykonany.
6. Zaprojektować i zatwierdzić przełączenie konkretnej domeny na **jeden** autorytet chmurowy, przygotować cache/drafty, świeżość i automatyczne odczyty/zapisy bez UI synchronizacji, zachowując Zapisz/Anuluj. Dopiero wtedy migracja prawdziwych danych i test między rzeczywistymi urządzeniami.

Cofnięcie obecnego pakietu: usunąć/revertować wyłącznie nowe nieaktywne moduły/testy i kandydackie rozszerzenie Rules, bez dotykania istniejącego loginu, IndexedDB, localStorage lub grantów. Nie wdrożono niczego wymagającego przywracania biznesowych danych. Wysłana już transakcja może zostać zatwierdzona przed lokalnym logout/close; późniejsza utrata potwierdzenia pozostaje wynikiem niepewnym, nie automatycznym cofnięciem lub ponowieniem. SHA-256 jest kontrolą integralności, nie podpisem użytkownika ani uprawnieniem.
