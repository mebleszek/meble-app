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

## Odczytowa diagnostyka spójności 14 domen — 02.11.2026

BASE `07a4c3d264fcd140c1308ca06d16534732ddc42e` (zweryfikowany aktualny main / merge PR #105); gałąź `feat/global-consistency-diagnostics-20261102`. HEAD to jedyny końcowy commit zawierający ten wpis, SHA w przekazaniu. Właściciel potwierdził na fizycznym Androidzie: initial-global-revision / GLOBAL_ALIAS_CONFLICT, materials, fc_sheet_materials_v1 / fc_materials_v1. **Nie odczytano rzeczywistych katalogów ani bazy telefonu.** Potwierdzenie pary nie wskazuje poprawnej wersji rekordów ani autorytetu; poprzednie CI/Pages nie są dowodem nowego SHA.

### Zakres i droga danych

- `global-data-diagnostics.js`: wszystkie 14 domen i wszystkie 7 par z niezmienionej, zamrożonej tabeli globalDataContract.sources. Każde źródło ma własny wynik odczytu, JSON i schematu; jeden konflikt nie zatrzymuje kolejnych. Nie ma enumerowania storage, domyślnych katalogów, getterów catalogStore, buildSeeds, splitLegacyMaterials, setterów ani capture() zatrzymującego się na pierwszym błędzie.
- Pary: EQUAL, DIFFERENT, ONE_MISSING, BOTH_MISSING, INVALID_JSON, INVALID_SCHEMA, UNREADABLE; dodatkowo BLOCKED przy przekroczeniu bezpiecznej granicy odczytu. Pojedyncze źródła: PRESENT lub SOURCE_MISSING. RAW: IDENTICAL/DIFFERENT/NOT_COMPARABLE; semantyka według istniejącej kanonizacji JSON (kolejność tablic, ID, ceny i nieznane pola nie są ignorowane). Różne formatowanie/porządek pól obiektu może dać EQUAL + RAW DIFFERENT. ONE_MISSING samo nie przesądza o błędzie startupu: istniejący kontrakt dopuszcza jeden poprawny fallback, a polityka pięciu aliasów usuwa kompatybilną kopię po potwierdzonym zapisie głównego klucza. Diagnostyka niczego nie odtwarza.
- Historyczny mieszany katalog materials: wiersz akcesorium oznacza LEGACY_MIXED_CATALOG, nigdy zgodność uzyskaną przez odfiltrowanie akcesoriów lub normalizację w RAM. Osobno pozostaje katalog hardware. Dodatkowe rekordy lub zmieniona kolejność są widoczne jako RECORDS_OR_ORDER, zmienione wartości jako VALUE. Nazwy/ID/ceny/RAW nie wychodzą z analizy.
- Każda domena korzysta z istniejących schemas i validate() na minimalnym zestawie jej zależności. Walidowane są m.in. dostawcy, kategorie/producenci/typy, parametry i cykle zestawów okuć, ustawienia dostawcy oraz stawki godzinowe i ich referencje. Nie wybieramy wersji rozbieżnej domeny jako zależności: DIAG_DEPENDENCY_BLOCKED. `stock.material`, defaults/systemy szuflad i nieużyte kategorie parametrów zachowują istniejące nierozstrzygnięte wymagania jako RUNTIME_REQUIRED. VALID oznacza zaliczenie istniejącego kontraktu, nie identyczność WYCENY, kompletność projektu lub gotowość migracji. Jedyny znany lokalny `company.transport.apiKey` jest wykluczany w prywatnej kopii dokładnie jak w capture; dodatkowe pola nadal odmawiają.
- `local-first-global-diagnostics.mjs`: korzysta z prywatnego boot.readNative, nigdy z aktualnie przechwyconego getItem jako domniemanego oryginału. Oddzielnie bada istniejącą bazę wskazaną przez konfigurację/receipt. Wymaga aktywnego, niemodyfikowalnego gate, prywatnego localAccess.assert tego samego właściciela/kontekstu, zweryfikowanego release w produkcji i zgodnego activationId. Brak bezpiecznego kontekstu = BLOCKED, bez odczytu danych.
- Przed open wymagane są receipt właściwego właściciela i potwierdzenie istnienia bazy w indexedDB.databases(); wersja/schemat muszą odpowiadać istniejącemu LOCAL-FIRST. Ewentualny upgradeneeded po wyścigu z usunięciem jest zawsze abortowany. W transakcji **readonly wyłącznie control** najpierw sprawdzany jest binding; przy obcym bindingu nie odczytuje się source/application. Zachowane source musi być zgodne z receipt, integralnością i bieżącymi oryginalnymi kluczami globals; aktywny application ma własną integralność i wersję. Zmiany application są dozwolone jako obserwacja, nie kopiowane z powrotem do oryginałów.
- Po analizie sprawdzana jest ponownie tożsamość/source/image i RAW. Wykryta zmiana lub utrata właściciela unieważnia potwierdzenie, bez retry. To nie jest transakcja localStorage ↔ IDB ani dowód braku ABA. Nie przejmujemy blokad writera i nie zmieniamy writer-fence. Brak receipt, brak/obca/uszkodzona baza, utrata dostępu, timeout, nadmiar danych lub niepewność = BLOCKED, bez inicjalizacji, recovery czy migracji.
- Limity: jedno globalne źródło do 2 Mi jednostek UTF-16, zestaw globals do 8 Mi; pełne wiersze source/image do 8 Mi na wartość i 16 Mi łącznie, przed serializacją/haszowaniem. IDB/analiza mają limit 10 s; całe wywołanie z ładowaniem modułów 12 s. Po upływie limitu późny import/wynik nie odczytuje dalej danych ani nie podmienia raportu. Bardzo duży obraz jest BLOCKED, nie „naprawiany” przez ucięcie.

Bootstrap zapisuje tylko anonimową obserwację w RAM przed zamknięciem gate przy odmowie startu na etapie globals. `note(error)` i pierwszy błąd pozostają pierwotne; błąd diagnostyki nie zastępuje go i nie ponawia startu. Raport jest widoczny w istniejącym auth-error także przy fatal. Dla działającej aplikacji: **Diagnostyka sesji → Kopiuj raport**, localFirst.globalConsistency. Modal najpierw wykonuje autoryzowany odczyt; collector/bookmarklet odczytuje wyłącznie zamknięty snapshot w RAM. Wygaśnięcie dostępu nadal blokuje świeży odczyt i kopiowanie. Nie dodano przycisku naprawy ani ścieżki omijającej logowanie.

Raport zawiera wyłącznie trzy rozdzielone sekcje (oryginały, istniejący obraz, porównanie), nazwy domen, zaufane klucze, zamknięte statusy/typy rozbieżności/kody. Sanitizer odbudowuje 14 wierszy ze statycznego kontraktu; nie przekazuje cen, nazw, UID, ID rekordów, wartości RAW, hashy danych, tokenów, prywatnych nazw pól ani message/path/stack wyjątku. READ_ONLY opisuje tryb obserwacji, a nie zdrowie danych. Nierozstrzygnięte porównanie przy brakującym/błędnym źródle jest BLOCKED; nie dowodzi, która warstwa powinna zostać zmieniona.

**Bajtowo niezmienione:** global-data-contract, catalog-store/migration/domain/storage-policy, application-boot/authority/initial-state/runtime/replication, local-first-idb i synchronizator, SW/writer-fence, biznesowe settery, Rules, operatorzy i piny, istniejące backupy. Zmieniono wyłącznie moduły obserwacji, ich podłączenie/format w istniejącym UI i style nowych linii raportu, testy oraz wersje/manifest/pochodny bookmarklet. Nie wykonywano Firebase LIVE, eksportu danych właściciela, normalizacji, WRITE katalogów/obrazu/outboxu, kasowania ani scalania.

### Rzeczywiste dowody i obowiązkowy routing

Wykonał Codex, Node 24.19.0 / rzeczywisty Chromium 151, odizolowane syntetyczne fixture i prywatny profil. Testy dodane do istniejącego automatycznego inventory; żaden nie jest opcjonalny ani pominięty. Pełnego Preflightu, SDK/emulatorów i GitHub Actions nie uruchamiano.

| Kontrola | Wynik lokalny | Obowiązkowy shard |
| --- | --- | --- |
| global-consistency-diagnostics-smoke | **13/13 PASS**: 14 domen, każda z 7 par we wszystkich stanach, RAW/semantyka, mieszane akcesoria, ceny/dodatkowe rekordy/porządek, nieznane pola/JSON/braki, zależności, niedostępny i nadmierny odczyt; owner/binding/release/activation/integralność, wyścig z usunięciem i timeout bez inicjalizacji | 5 |
| global-consistency-startup-smoke | **6/6 PASS**: rzeczywisty main-login i capture na kontrolowanych granicach modułów, globalny błąd znany/nieznany, komplet obserwacji przed fatal, brak drugiego startu; modal/kopiowanie i odmowa po revoke; zawieszony import/late result | 6 |
| global-consistency-browser-smoke | **PASS**: prawdziwe IDB source/application, 14 domen/7 par, różne źródło i obraz; rzeczywisty outbox uncertain pozostaje dokładnie niezmieniony, readonly control, brak utworzenia bazy i dostępu obcego właściciela | 4 |
| global-data-write-safety-smoke | **31/31 PASS**, wszystkie stare asercje i nowa diagnostyka po rzeczywiście częściowo potwierdzonym zapisie primary / awarii kopii; zero naprawczego retry | 5 |
| cloud-global-data-smoke | **13/13 PASS**, odmowy/relacje/nieznane pola/immutability i brak utraty wartości | 4 |
| first-sync-error-diagnostics-smoke | **9/9 PASS**, pierwotny błąd i fatal zachowane; aktualizacja jedynie oczekiwania async odczytu modala i jawnej nowej wersji pliku | 7 |
| pixel-session / session-diagnostics-screen | **15/15 + 6/6 PASS**, dotychczasowe bramki, prywatność i niezmienność danych | 4 / 4 |
| main-login / trusted-main-login | **36/36 + 4 grupy PASS**, brak adopcji obcego profilu, utrata Auth, niepewne zapisy, offline i RAM; rzeczywisty standardowy eksport nadal pomija chronione historyczne zakresy | 4 / 7 |
| LOCAL-FIRST contracts | **7 grup PASS**, oryginalne JSON/14 domen/backup/dependencies/WYCENA/aktywacja i podpisy, bez LIVE | 6 |
| Routing / wersje / manifest / składnia / diff | **PASS**, 189 smoke w 7 rozłącznych grupach; nowy test sam trafia dokładnie raz do obowiązkowego planu. Workflow bez zmian; dwa nowe moduły automatycznie w spójnym manifeście. Wszystkie zmienione skrypty w obu HTML mają właściwe wersje, standalone auth-shell osobne ?v= | statyczne / obowiązkowy plan |

Pierwsze niezaliczone próby dotyczyły fixture: test rozbieżności dopisywał niedozwolone pole name do technicalParams zamiast label (poprawiono poprawny pozytywny przypadek, zachowano test unknown fields); przejście rzeczywistego outbox do inflight wymagało istniejącego expected revision (dodano prawidłowy syntetyczny dowód); fixture logowania musiała zachować własną bazę profilu Auth zamiast zastępować ją bazą diagnostyczną. Nie zmieniano produkcyjnych odmów pod test. Wszystkie końcowe kontrole powyżej PASS; brak pełnego CI dla nowego HEAD i testu telefonu pozostaje jawny.

### Warunki i konkretna rekomendacja przyszłej naprawy

1. **Najpierw anonimowy raport z wydanej wersji**, osobno obie warstwy. BLOCKED oznacza STOP dla niepotwierdzonego odczytu/wnioskowania; nie wybierać primary tylko dlatego, że jest pierwszym kluczem i nie zakładać, że localStorage.getItem pokazuje fizyczny oryginał po przełączeniu authority.
2. **Niezależnie zweryfikowana prywatna kopia obu warstw i całego kontekstu naprawy przed WRITE.** Standardowy backup enumeruje localStorage i czyta przechwycony getItem; pomija pięć aliasów bez fc_ i nie gwarantuje kompletności ani fizycznego źródła, ani aktywnego obrazu. Obecny storage-recovery-export.js dopuszcza tylko bazę archiwum i rozpoznane bazy Auth: istniejący LOCAL-FIRST spowoduje RECOVERY_UNKNOWN_DATABASE, jeśli wcześniejsze bramki storage przejdą. Nie rozszerzano tej listy i nie uznawano odmowy za backup PASS. Historia w BACKUP.md o wcześniej potwierdzonej kopii nie dowodzi kompletności nowej, aktywnej warstwy IDB.
3. **Rekomendowany następny pakiet przygotowania naprawy:** osobno zatwierdzony prywatny, tylko odczytowy eksport native originals + wszystkie 7 par (w tym pięć bez prefiksu) + istniejące control.source/application, replicas/outbox/protected oraz niezatwierdzony RAM, z niezależną weryfikacją pliku i właściciela. Powinien rozszerzyć istniejący model rescue, bez tworzenia nowej bazy, aktywacji, importu lub zmiany danych. Bez takiego dowodu przyszła naprawa pozostaje REPAIR_BLOCKED; anonimowy raport nie jest kopią ani planem wartości.
4. **Następnie jawny plan konkretnych różnic na tej kopii, bez automatycznego scalania.** W materials LEGACY_MIXED_CATALOG potrzebny jest zgodny kontrakt dla historycznego katalogu mieszanego, a nie mechaniczne nadpisanie go katalogiem płytowym. Przed ewentualnym uzgodnieniem par należy wykazać zachowanie każdego dodatkowego rekordu akcesoriów w odpowiednim autorytecie lub zachowanym RAW, dokładnych cen/jednostek/ID/pól i referencji oraz wszystkich pozostałych domen. Kopia zgodna semantycznie, lecz różna RAW, nie uzasadnia normalizacji. Brak jednego aliasu nie uzasadnia jego odtworzenia. Źródło i aktywny obraz mogą prawidłowo różnić się po zatwierdzonych zmianach LOCAL-FIRST.
5. **Osobna zgoda na dokładny WRITE i warunek wyłączności.** Naprawa, jeśli zostanie zatwierdzona, musi użyć właściwego istniejącego atomowego obrazu/revizji z CAS, zachować świadectwo źródła i rollback, nie pozostawiać częściowo naprawionych kopii i nie publikować automatycznie zmiany do Firebase. Każdą inflight/uncertain operację trzeba rozstrzygnąć według dotychczasowego protokołu; nie usuwać ani nie ponawiać jej zapisu. Sprawdzić restart, offline/outbox, brak starego writera i zależności projektu/WYCENY/zamienników; diagnoza tego nie zastępuje. Pierwotne globalne dane, katalogi i ceny są chronione bezwzględnie.

Test właściciela po zatwierdzonym wydaniu: bezpiecznie zakończyć pracę, zaktualizować aplikację dotychczasową procedurą i zamknąć również kartę aktualizatora. W tej samej przeglądarce/profilu odczytać pełny komunikat błędu startu albo **Diagnostyka sesji → Kopiuj raport → localFirst.globalConsistency**. Przekazać tylko anonimowy wynik; bez DevTools/USB, ręcznego kodu, resetu lub zmiany katalogów. Brak kompletnego raportu/BLOCKED trzeba zachować jako wynik, nie obchodzić bramki właściciela.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / REPAIR_BLOCKED / PHONE_PENDING.** Jeden commit/push diagnostyki, bez PR, pełnego CI, merge i Firebase LIVE. Kanoniczny bieżący stan i następny ruch wyłącznie w CURRENT_STATE.md.

## Odbudowa 14 domen z kodu — 02.11.2026

Gałąź `feat/code-global-catalogs-20261102`, BASE/main **`317cfce2d43ac5ae4c9ed92c306d5c04d73b3f74`**, potwierdzony git fetch. HEAD to jeden końcowy commit zawierający wpis, pełny SHA w przekazaniu. **CODE_READY / CI_PENDING / REPAIR_BLOCKED / BACKUP_PENDING**. Zakres: generator, walidacja, prywatne porównanie i plan, bez wykonania odbudowy, podłączenia do loginu lub nowego UI. Dane właściciela nie były odczytywane ani zapisywane.

### Właściwe źródła i izolacja

`tools/helpers/code-global-catalogs.js` / `tools/code-global-catalogs.js` tworzą nowy izolowany VM na każde wywołanie. Czytają wyłącznie zahardkodowane źródła programu w repozytorium. Storage, cache/catalogStore, catalogMigration, catalogStoragePolicy, sieć, bieżący zegar i losowe ID są niedostępne. `catalog-store.js` nigdy nie jest wykonywany — jego dwa zamknięte literały DEFAULT_SHEET_MATERIALS i DEFAULT_WORKSHOP_SERVICES są odczytywane osobno; zmiana układu deklaracji oznacza CODE_FACTORY_DECLARATION_CHANGED. Nie ma wywołania migrateLegacy(), completeMissingApplicationGlobals() ani jego getterów cache. Nie budujemy defaultów ze sprzecznych katalogów.

Pozostałe źródła: hardware-catalog-seed-data/hardware-catalog/hardware-technical-params, labor-catalog-definitions/labor-catalog/work-quantity-sources, program-defaults-store, business-costs-store. Firma korzysta jedynie ze zbioru znanych nazw pól ustawionych na pusty string oraz operacyjnej konfiguracji transportu z kodu, bez danych osoby/firmy i apiKey. Hashowany manifest 15 źródeł obejmuje też kontrakty/diagnostykę, silnik zamienników i sam generator. Provenance zawiera SHA źródeł, modelu i reguł zamienników oraz wersję Node/ICU. CLI drukuje wyłącznie zamknięty status/liczności/hashe kodowego artefaktu, bez RAW lub danych właściciela; nie posiada trybu zapisu/importu/restore.

Normalizatory są wywoływane **tylko na definicjach z kodu**. W szczególności historyczne/potencjalnie edytowane katalogi nie są normalizowane do kandydata. Istniejące techniczne ID parametrów powstają według obecnego deterministycznego normalizatora; nie ma nowych losowych ID. ID i kolejność materiałów, okuć i labor zachowują źródła. Fabryczne kwoty katalogowe/zakupowe pozostają dokładne; obliczane ceny ofertowe i czasy korzystają z aktualnych reguł WYCENY, w tym istniejących konwersji jednostek/czasów i narzutu, bez nowej polityki zaokrąglania.

### Kompletność 14 domen

| Domena | Zestaw kodowy i źródło |
| --- | --- |
| materials | **7** pozycji DEFAULT_SHEET_MATERIALS, wszystkie ID/ceny/jednostki/PCV |
| hardware | **16** pozycji hardware-catalog-seed-data, istniejące normalizatory cen i techniki |
| manufacturers | **9** producentów z kodu, bez źródeł właściciela |
| suppliers | **4** dostawców z hardware-catalog |
| categories | **15** kategorii: 12 podstawowych + Systemy narożne, Pantografy, Ociekarki z istniejących definicji parametrów |
| types | **15** typów z kodu, zachowane allowedCategories |
| technicalParams | **46** definicji po istniejącym normalizeDefinitions, z ID/opcjami/regułami zamienności |
| hardwareSettings | Jeden kodowy profil VAT/narzutu/źródła ceny, poprawny dostawca |
| labor | **57** rekordów, w tym **4** stawki i wszystkie bieżące czynności/normy/ilości/warunki/progi |
| workshopServices | Jedna istniejąca definicja ws1, bez losowych ID |
| stock | Neutralne `[]`, w źródle `{sheets:[]}`; bez wymyślonych stanów magazynowych |
| programDefaults | Neutralne v2 z właściwego kodowego defaultu i czystego normalizatora; brak ustawionych materiałów/systemów |
| company | Jawnie puste pola firmy, neutralne metadane, operacyjne ustawienia transportu bez klucza; brak cudzej tożsamości/adresu |
| businessCosts | **16** istniejących szablonów, kwoty/daty/uwagi puste, suma 0; brak wymyślonych kosztów |

Prawidłowe 14 źródeł kanonicznych nie wymaga tworzenia siedmiu aliasów. Przy planowaniu istniejący alias pozostaje zgodny z kanonicznym źródłem; nieobecny historyczny alias pozostaje nieobecny. Na wzorcu Androida aktualizowana propozycja ma 14 kluczy kanonicznych i dwie już istniejące kopie materials/labor; pozostałych pięciu nie inicjalizuje. Fizyczne oryginały nie są modyfikowane.

### Wykryte luki i ich rozstrzygnięcie

1. DEFAULT_COMPANY_PROFILE zawiera dane konkretnej firmy. Obecny normalizeCompany używał `source.field || default`, więc nawet kompletny neutralny profil z jawnymi pustymi polami odzyskiwał cudze dane podczas runtime read. Zmieniono wyłącznie te fallbacki na nullish: jawny pusty string pozostaje pusty, prawidłowe istniejące wartości są zachowane, brak/null nadal ma dotychczasowy fallback. Nie zmieniono historycznych defaultów, read/write, Auth, UI ani automatycznie żadnej wartości. Test wykazuje brak cudzych danych również po read/normalize/companyAddress.
2. Część parametrów technicznych ma kategorie nieobecne w podstawowym DEFAULT_CATEGORIES. Generator uzupełnia słownik wyłącznie trzema istniejącymi nazwami z tych definicji. Znikają wszystkie unusedParameterCategory; nie osłabiono validateBundle ani nie odrzucono definicji.
3. Surowe definicje techniczne nie mają wszystkich ID, a niektóre progi labor nie mają jawnego price. Stosowane są obecne czyste normalizatory programu: stabilne techniczne ID oraz istniejące wartości obliczeniowe, bez wymyślania nowego cennika. Testy porównują każdą definicję przed/po przez rzeczywisty kalkulator oraz konkretne normy minutowe.
4. **Niepełna oferta kodowa pozostaje jawna:** kod ma starter prices i nie obejmuje każdego możliwego produktu/ceny (np. nóżek i zawieszek). WYCENA zachowuje aktualne wymagane ilości oraz ostrzeżenia przy braku produktu; generator nie tworzy cen ani pozornego kompletnego kosztorysu. Ta luka nie uniemożliwia poprawnego zestawu 14 domen/startu globals, ale wyklucza obietnicę pełnej wyceny każdego rzeczywistego projektu. Brakujące dane w rzeczywistym projekcie nadal wymagają decyzji, nie zmiany reguł pod test.

### Wynik walidacji i znaczenie dla startu

Pełne validateBundle, roundtrip pack/unpack wszystkich domen, schematy/ID/ref, dostawcy/typy/kategorie/parametry/cykle, stawki godzinowe, kody źródeł ilości i warunków oraz stabilność normalizacji runtime: **PASS**. Jedyny zwracany znacznik zależności to ogólne programDefaults; runtime potwierdza, że ten konkretny neutralny zestaw nie wskazuje żadnego materiału ani drawer system. Stock jest pusty i nie ma nierozwiązanej referencji materiałowej. Nie pominięto tego znacznika ani nie rozszerzono kontraktu.

Syntetyczny snapshot ma dokładnie raportowany układ: materials INVALID_SCHEMA/GLOBAL_REQUIRED_FIELD, labor DIFFERENT/GLOBAL_ALIAS_CONFLICT, pięć ONE_MISSING i cztery SOURCE_MISSING, identyczne RAW native/source/application. Zachowano kolejność pierwotnego capture: konflikt aliasu labor jest odrzucany przed walidacją całego modelu, podczas gdy pełny raport pokazuje też błąd materials. Propozycja rozwiązuje wszystkie 14 domen, nie tylko pierwszą odmowę. Prawidłowy pojedynczy alias nadal jest dopuszczalny. Aktywna sesja edycji nadal daje GLOBAL_EDIT_SESSION_ACTIVE.

Test wykonuje również rzeczywisty catalog-store/migrację **wyłącznie nad syntetycznym chronionym obrazem**, po zbudowaniu kandydata z niezależnych źródeł. Sprawdza zachowanie dokładnych RAW i przyjęcie zweryfikowanego modelu przez adoptVerified. To test zachowania istniejącego bootu, nie źródło fabrycznych wartości. Nie zmieniono odmów legacy boot ani ich warunków.

Dowód umożliwia przejście **etapu globals** na tym syntetycznym obrazie. Nie jest dowodem uruchomienia telefonu, aktualnego Auth/gate/release ani zgodności nieodczytanych projektów z odbudowanymi referencjami. Nie uruchamiano produkcyjnego SDK, Firestore ani fizycznego Androida. Synchronizacja telefon–komputer pozostaje oddzielnym testem po przyszłej kontrolowanej naprawie.

### Prywatne porównanie i plan bez WRITE

`sync/global-code-rebuild-plan.mjs` działa tylko na przekazanym prywatnym snapshotcie i zatwierdzonym kodowym kandydacie. Sprawdza integralność istniejącej authority oraz SHA modelu/reguł; nie otwiera baz, nie odczytuje lokalnego profilu, nie rejestruje się w startupie i nie ma wykonawcy WRITE. Porównuje **każde źródło osobno w obu warstwach**, bez wyboru aliasu. Wykazuje rekordy wyłączne w historii/kodzie, zmiany wszystkich pól, cen/stawek/norm, duplikaty, rekordy bez ID, niekanoniczne lub uszkodzone JSON i RAW-only. Nie odrzuca nieznanych pól. Niekanoniczny zapis pozostaje prywatnym RAW wymagającym osobnego przeglądu.

Pełny preimage (native, control/source/application, protected/replicas/outbox, session/RAM) pozostaje w prywatnej propozycji. Wszystkie pola poza 14 domenami, w tym reguły zamienników i dane projektów/historii, zachowują dokładne wartości w proponowanym obrazie. Reguły LABOR_REPLACEMENTS i technicznej zamienności z kodu mają odrębny SHA. **Zachowanie preimage w RAM nie jest niezależnym backupem ani dowodem bezstratnego wykonania.** Właścicielskie ceny/rekordy mogą różnić się od kodu mimo braku nowego cennika; każde takie odstępstwo wymaga prywatnego rozstrzygnięcia przed przyszłym zapisem.

Plan zawiera expectedVersion/hash oraz dowody wszystkich czterech store i oryginałów. assertCodeRebuildBaseline odmawia po każdej zmianie snapshotu/propozycji; podrobiony obiekt i plan ze starego życia modułu nie dają dowodu. Wynik matched zawsze ma writeApproved:false. Anonimowy summary opiera się na prywatnej WeakMap, nie edytowalnych polach raportu. Wszystkie stany mają REPAIR_BLOCKED/executeAvailable:false, także przy poprawnej walidacji i pustej kolejce. Nie ma automatycznego merge ani naprawy podczas logowania.

Minimalna bezpieczna procedura przyszłego osobno zatwierdzonego wykonania:

1. Zatwierdzić dokładny artefakt kodowy i jego SHA, HEAD/BASE, źródła i zakres 14 domen. Najpierw bezpieczny odczyt właściciela: bieżący Auth/gate/release, receipt, binding/source/application. Obecny fatal cofa gate — nie obchodzimy go; dostęp i ewentualna integracja wymagają odrębnego pakietu. Nie odświeżać karty z niezabezpieczonym RAM.
2. Faktycznie pobrać i niezależnie zweryfikować pełny zaszyfrowany plik obu warstw, czterech store i znanego RAM. Zachować preimage poza aplikacją; obecny wynik code-only nie daje BACKUP_PASS właściciela. Prywatnie rozstrzygnąć wszystkie zmienione ceny/ID/pola/zamienniki/nieznane rekordy i dopiero zatwierdzić konkretny finalny kandydat. Odbudowa z kodu nie jest zgodą na utratę tych informacji ani danych testowych.
3. Zachować istniejący writer-fence/jednego edytora, zatrzymać aktywną edycję i scheduler w kontrolowanym punkcie bez utraty RAM; wykluczyć pozostałych writerów. Niezależnie ustalić rezultat inflight/uncertain oraz sens queued/blocked/conflict. Nie retry'ować, nie czyścić ani nie cofać ACK. Nierozstrzygnięta operacja = STOP, nie reset outboxu.
4. Wykonawca musi świeżo sprawdzić pełny baseline: image version/hash, source/receipt/binding/release, replicas/protected/outbox i wszystkie dane poza zakresem. Zatwierdzić atomowo spójny application+globals replica+protected+outbox z CAS i monotonicznymi wersjami/ID operacji. Samo podmienienie application przy starej kolejce/replice może odtworzyć dawny model lub wysłać stare wartości — niedopuszczalne. Nie zmieniamy teraz polityki synchronizacji; jeśli nie da się bezpiecznie rozstrzygnąć starej kolejki istniejącymi zasadami, wykonanie pozostaje STOP do osobnej decyzji.
5. Fizyczne oryginały i control.source/receipt pozostają nietknięte. localStorage oraz IDB nie tworzą wspólnej transakcji, więc nie proponujemy podwójnego nadpisania aliasów w obu magazynach. Zmiana artefaktu/gate/źródła lub CAS w trakcie oznacza abort przed mutacją, a nie częściowy sukces.
6. Przed rzeczywistym WRITE osobno wykazać odporność wykonawcy na quota/cofnięcie Auth/przerwanie w każdej granicy, atomowy abort i read-back po restarcie/offline. Po zatwierdzeniu obowiązkowe pełne capture/validateBundle, runtime/adopt, zależności istniejących projektów oraz kontrolna WYCENA; dopiero wtedy wznowienie. Brak tych dowodów oznacza brak gotowości wykonawczej.
7. Rollback musi być CAS do chronionego spójnego preimage przy wstrzymanej synchronizacji i znanym stanie wszystkich ACK. Po potwierdzonym nowym zdalnym zapisie nie wolno odtwarzać starej kolejki/ACK; potrzebna zatwierdzona korekta do przodu. Nie resetować bazy, receipt, oryginałów ani wersji. Ten pakiet nie implementuje rollbacku ani nie udaje jego testu wykonawczego.

### Testy celowane i obowiązkowe CI

Wszystkie dane testów są syntetyczne; lokalnie Node **24.19.0**, bez pełnego CI/Actions/emulatorów i nowego testu Androida/Chromium. Nie dziedziczymy PASS wcześniejszego backupu dla tego HEAD.

| Zestaw | Wykonany wynik | Obowiązkowy Preflight |
| --- | --- | --- |
| code-global-catalogs-smoke.js | **7/7 PASS**: deterministyczność/zakaz IO/cache/migracji/random, 14 domen i roundtrip, neutralna firma po read/runtime, wszystkie 57 definicji przez kalkulator dla 12 kombinacji ilości/gabarytu, konkretne normy/4 stawki, realne fakty/cutlist/manual suppression, wszystkie pary okuć przez istniejący silnik, chroniony boot/adopt | shard **4/7** |
| code-global-rebuild-plan-smoke.js | **6/6 grup PASS**: dokładny Android, wszystkie 14 rozwiązań, brak inicjalizacji pięciu aliasów, edycje cen/norm/unknown/JSON/reguł zachowane prywatnie, pełny CAS/proposal hash, restart/forgery/uncertain/aktywna edycja i niezmienność snapshotu | shard **5/7** |
| wycena-labor-norms-smoke.js | **9/9 PASS**, obecne normy, ilości, manual replacement i jawne braki produktów | shard **5/7** |
| global-data-write-safety-smoke.js | **31/31 PASS**, w tym odczyt/zapis profilu firmy, quota/no-op/partial, zachowanie RAW i historycznych kopii | shard **5/7** |
| company-transport-business-costs-smoke.js | **PASS**, istniejące kontrakty/wersje/transport/koszty | shard **6/7** |
| local-first-contract-smoke.js | **7 grup PASS**, odmowy, podpis/owner/fence/Rules/revocation i zachowanie WYCENY | shard **4/7** |
| ci-sharding / składnia / wersje / load groups / manifest / diff | **PASS**, **194 smoke / 7 rozłącznych grup**, każdy nowy test dokładnie raz | obowiązkowy Preflight |

Istniejące quote-exact-calculations-smoke.js (**shard 7/7**) oraz wycena-hinge-quote-replacement-flow-smoke.js (**shard 6/7**) nadal obowiązkowe w CI; oznaczenia w nawiasie to numery shardów, nie wyniki. Nie powtarzano lokalnie wszystkich regresji wyceny. Advisory cloud-ci-impact wykazał index.html/company-profile-store.js jako zmienione zależności historycznych pinów; oczekiwane odmowy CLOUD42_SOURCE_CHANGED i zależne bramki pozostają w wymaganym current boundary/historycznych zestawach CI. Pinów, workflow, Rules i synchronizacji nie zmieniono.

Pierwsze uruchomienia nowych testów ujawniły brak TextEncoder w testowym VM oraz błędne założenia testu o kolejności capture i pierwszeństwie rateCode nad rateKey. Uzupełniono kontekst i właściwe asercje; produkcyjne walidatory/odmowy bez zmian. Kontrola starego smoke firmy odmówiła przy nieuzupełnionej mapie wersji; dodano dokładny cache-busting i końcowy PASS. Pierwotne CODE_FACTORY_COMPANY_NOT_NEUTRAL było rzeczywistą przeszkodą w normalizatorze, naprawioną przez zachowanie jawnych pustych pól, bez zmiany danych.

**Możliwość przywrócenia globals: wykazana syntetycznie dla kompletnego zestawu. Start właściciela i telefon–komputer: nadal niepotwierdzone.** Brak rzeczywistego WRITE, restore, resetu, kasowania danych, migracji urządzenia, automatycznej naprawy loginu, zmian UI/Auth/fatal/writer-fence/SW/replication, Firebase LIVE/Rules/IAM/billingu, PR, merge i uruchomienia Actions. Następny ruch wykonawczy wymaga osobnej konkretnej zgody i powyższych dowodów.
