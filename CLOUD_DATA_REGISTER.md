# CLOUD-1A — kanoniczny rejestr danych Meble-App

## Lokalny magazyn archiwum backupów — IndexedDB v1 (25.10.2026)

**STORAGE RECOVERY / INDEXEDDB — PRIORYTET 1; CLOUD / FIREBASE LIVE / rozwój SYNCHRONIZACJI — WSTRZYMANE.** Nie zmieniamy dotychczasowych domen i dowodów chmury.

| Magazyn | Właściciel i rola | Zakres / ochrona |
|---|---|---|
| IndexedDB `meble-business-backups-v1`, schema1, `records` / `sources` / `control` | Lokalny profil biznesowy właściciela po istniejącym dopuszczeniu Auth. Archiwum kopii, nie autorytet projektów i nie uprawnienie dostępu. | Rekord per backup, zachowane ID, oryginalne RAW elementu i całego źródła UTF-16LE/SHA-256; journal COPIED/SWITCH_PENDING/ACTIVE, revision i potwierdzone transakcje. LOKALNIE, bez Firestore/synchronizacji. |
| `fc_data_backups_v1` | Istniejący magazyn legacy; do etapu E nadal zachowane źródło. | Kopiowanie nie usuwa ani nie normalizuje RAW. COPIED zamraża zwykłe writery, E wymaga osobnej decyzji i niezależnego pliku; później brak fallbacku do tego klucza. |
| `meble_backup_archive_backend_v1` | Mały techniczny marker routingu po osobno zatwierdzonym E, bez danych i poświadczeń. | Stały JSON `{"v":1,"backend":"indexeddb"}`, zapis i read-back przed jakimkolwiek usunięciem źródła. Po utracie IDB blokuje fallback. Nie wchodzi do standardowego biznesowego restore, nie jest prawem dostępu. Brak miejsca na marker = STOP. |

Baza profilu `meble-access-profile-v1`, Firebase persistence, tokeny i dowody dostępu nie są kopiowane. Prywatny plik ratunkowy nie przywraca autoryzacji. [BACKUP](BACKUP.md#android-storage-recovery--indexeddb-v1) i [raport](tools/reports/android-storage-recovery-indexeddb-v1.md) opisują dokładną migrację, ograniczenia i testy; historyczna inwentaryzacja poniżej pozostaje punktem odniesienia.


## CLOUD-SYNC-1 — wykorzystanie istniejących 14 domen

Nie powstają nowe źródła prawdy ani klucze `fc_*`. Koordynator `sync/global-data-sync.mjs` używa bez zmian tabeli `sources` i schematów CLOUD-3 opisanych poniżej: robocizna/quote rates, materiały/okucia i ich zależności, magazyn, domyślne, profil bez `transport.apiKey`, koszty firmy — pełne 14 domen na emulatorach. Historyczne aliasy/legacy mają kontrolę konfliktów, nie osobne kopie chmurowe. Odbiór jest wyłącznie pamięciowy; realne globalne magazyny użytkownika i dane projektowe nie są zastępowane. Issue #47, edge/material part options/rozrys grain/overrides pozostają nierozstrzygnięte i wyłączone. [Implementacja, wykluczenia i kompatybilność](tools/reports/cloud-sync-1-global-data.md). **CODE_READY / CI_PENDING / LIVE_BLOCKED**, bez migracji.

## CLOUD-4.6E — niezmieniona granica danych

Połączenie operatora dotyczy wyłącznie syntetycznych `cloud4-investor-v1` / `cloud4-project-v1` i istniejących administracyjnych dokumentów grantu/STOP. Nie otrzymuje magazynu aplikacji ani eksportera danych firmy. Cenniki, zamienniki/kompatybilność, katalogi, magazyn, ustawienia globalne, historia ofert oraz WYCENA pozostają poza testem i migracją. Prywatny journal poza repo zawiera identyfikatory/hashy/statusy, bez payloadu, tokenów i Rules; nie tworzy nowej domeny `fc_*`. Właściciel potwierdził kompletną aktualną kopię danych i brak późniejszych zmian — bez nowej przesłanki nie zleca się kolejnego backupu ani pełnego audytu. [Bramki operatora](tools/reports/cloud-4-6d-live-execution-preparation.md#cloud-46e--połączenie-operatora).

## CLOUD-4.3 — bez rozszerzenia zakresu danych (2026-10-20)

Przegląd bieżących kontraktów nie zmienia klasyfikacji danych poniżej. Pilot to
nadal wyłącznie stały syntetyczny inwestor/projekt, 6797 bajtów kanonicznego
payloadu. Nieznane istotne pole jest odmową eksportu, nigdy cichym pominięciem.
Żadne dane właściciela, sesje, techniczne dowody dostępu, backupy, sekrety profilu
ani globalne katalogi nie są źródłem pilota. Nie mapowano globalnych słojów do
projektu i nie ruszano aliasów legacy. Frozen oferty/drafty wymagają odrębnej
własności i kontraktu przed migracją. [Dowody CLOUD-4.3](tools/reports/cloud-4-3-live-readiness-refresh.md).

## Dopisek lokalnej spójności kontekstu — 2026-10-19

Bez nowych kluczy, domen lub zmian formatu. `__projectOverride` nie jest autorytetem aktywnego
projektu; WYCENA renderuje/diagnozuje bez automatycznego zapisu rewizji, sanitizacji draftu
lub relinku historii. Stary `fc_project_v1` i sloty pozostają nietkniętymi danymi legacy.
Licznik unieważnienia obliczenia jest wyłącznie stanem RAM, nie danymi do backupu/chmury.
[Raport, izolacja i testy](tools/reports/project-context-coherence-fix.md).

## Aktualizacja po PR #62 — CLOUD-4.1 scalone, CLOUD-4.2 w przygotowaniu

GitHub potwierdził merge PR #62 do main `d517d598917e5ccd6f1460950697c9ab27f1db1c`,
wydaniowe CI i Pages SUCCESS. CLOUD-4.1: 13/13 live-readiness, 10/10 prywatny pilot,
71/71 SDK, 3/3 startup, 38/38 Chromium, Preflight PASS, bez pominięć.
Starsze nagłówki o blokadzie poniżej są zapisem historycznym sprzed weryfikacji.
CLOUD-4.2 przygotowuje pakiet offline i próby emulatorowe przyszłego LIVE na osobnej
branży, bez produkcyjnych Rules, grantów, zapisów, odczytów ani zmiany UI/autorytetu.
[Artefakty, bramki zgody, procedura i statusy](tools/reports/cloud-4-2-live-pilot-preparation.md).
Aktualny wynik CLOUD-4.2 wymaga zakończonego CI tej gałęzi; nie jest odziedziczonym PASS.

## CLOUD-3 — model domenowy bez transferu danych właściciela

Stan bazy po PR #59 (`65085d18`): CI/auto-merge/Pages PASS, Android zaakceptowany przez właściciela. Nowa gałąź CLOUD-3 nie dodaje kluczy localStorage/IndexedDB ani nie zmienia historycznych liczb inwentaryzacji CLOUD-1A. Przygotowuje niezarejestrowany kontrakt i transport 14 domen: materiały, okucia, producenci, dostawcy, kategorie, typy, parametry techniczne, ustawienia okuć, robocizna/stawki, usługi warsztatowe, magazyn, domyślne programu, profil firmy bez ORS apiKey, koszty firmy.

Właścicielem przyszłej przestrzeni globalnej jest zatwierdzony UID, niezależnie od investorId/projectId. Fizyczne rekordy są immutable, a jeden manifest CAS zatwierdza kompletny zestaw. Źródłowe ID, nazwy-klucze słowników, ceny, parametry i referencje pozostają bez normalizacji; pięć aliasów oraz legacy materials/services mają kontrolę rozbieżności. Nie powstaje druga chmurowa kolekcja kopii kompatybilności. [Tabela źródeł, walidacja, ścieżki, limity i testy CLOUD-3](tools/reports/cloud-3-global-data-foundation.md).

**LOKALNIE i DO WYJAŚNIENIA nadal nie są automatycznie transferowane.** Dotyczy to zwłaszcza fc_edge_v1, globalnych słojów/rotacji (Issue #47), fc_rozrys_overrides_v1, draftów ofert, technicznych dowodów dostępu, sesji, cache i backupów. Zlecenia usługowe, tombstones inwestorów i frozen historia to odrębne domeny biznesowe, nie katalogi globalne; nie są objęte nowym adapterem. Magazyn material keys, domyślne materiałowe i nieużyte kategorie definicji wymagają jawnego rozpoznania zależności przed kalkulacją na pustym urządzeniu. Nie zgadujemy ich mapowania ani nie dopisujemy brakujących danych.


## CLOUD-2B.4a / techniczne CLOUD-2C — atomowy dowód profilu (gałąź robocza)

Nowy **techniczny IndexedDB** `meble-access-profile-v1`, store `ownership`, singleton `owner`: zamknięty rekord `{version:1,uid,state:'pending'|'active',attemptId}`. Rola: rozstrzygający dowód dostępu do tego profilu przeglądarki; **nie** projekt, token, grant Firebase lub własność poszczególnych danych. Właściciel UID jest niezmienny w publicznym API. Rezerwacja i aktywacja używają transakcji readwrite z strict durability; request success nie zastępuje transaction complete. Brak dostępu/błąd/nieznany rekord = odmowa, bez fallbacku do localStorage. Klasyfikacja: **LOKALNIE**, poza chmurą, selektywnym eksportem i backupem danych biznesowych; bez TTL, resetu lub automatycznego usuwania.

`meble_access_profile_v1` zachowuje istniejący poprawny v2 bajt w bajt przy przejściu do IndexedDB po świeżej autoryzacji tego samego UID. Nowe dopuszczenia zapisują odnośnik **v3** `{version:3,uid,attemptId}` — sam v3 bez aktywnego rekordu IndexedDB nigdy nie uprawnia do wejścia. `meble_access_profile_pending_v1` pozostaje dodatkowym wetem; nawet brak lokalnego weta po nieudanej transakcji nie pokona `pending` w IndexedDB. Historyczny v1 wymaga zgody; uszkodzenie lub obcy UID oznacza odmowę. Nie stosować starszego loadera ufającego wyłącznie v2 jako zamiennika tej kontroli.

Moduły: `js/app/cloud/local-access-profile.js`, `js/main-login.js`. Dopuszczenie nadal nie zmienia `fc_*`, aliasów, sesji, backupów ani katalogów i nie wysyła danych. Lokalny dowód nie jest serwerowym ACL ani ochroną przed DevTools/XSS/właścicielem profilu systemowego. Te nowe wpisy nie zmieniają historycznej liczby 46 nazw local/sessionStorage z CLOUD-1A. [Raport i testy](tools/reports/cloud-2b4a-technical-2c.md).


## Historia CLOUD-2B.3 — lokalny dowód przed atomową koordynacją

`meble_access_profile_v1` — lokalny dowód `{version:2, uid, attemptId}` w localStorage, zarządzany przez `js/app/cloud/local-access-profile.js` i główne wejście `js/main-login.js`. Rola: dostęp do profilu przeglądarki, **nie** własność rekordów, grant serwera, token lub drugi autorytet danych biznesowych. Zaufany tylko przy braku blokady opisanej poniżej i po świeżym proofie serwerowym. Pusty profil wiązany jest po proofie; istniejący wymaga osobnej zgody właściciela i oświadczenia o kopii. Historyczny format v1 jest niezaufany (nie odróżniał sukcesu od awarii) i wymaga ponownej zgody, bez resetu danych. Inny UID lub korupcja blokują dostęp.

`meble_access_profile_pending_v1` — **nowa techniczna blokada operacji**, `{version:1, uid, attemptId}`, localStorage, ten sam moduł i Web Lock. Zapisana i sprawdzona przed kandydatem dowodu. Pozostaje po błędzie, nie jest czyszczona przy logout/reload; unieważnia także poprawnie wyglądający kandydat v2. Usuwana wyłącznie jako ostatnia operacja poprawnie potwierdzonego dopuszczenia, po read-back i kontroli danych, albo zastępowana nową próbą tego samego UID po świeżej autoryzacji i zgodzie. Nie usuwać ręcznie jako obejścia; obcy UID/uszkodzona blokada oznaczają odmowę. Nie jest magazynem projektu ani kopią jego treści.

Oba klucze: **LOKALNIE**, bez odwzorowania Firestore, poza selektywnym eksportem i standardowym backupem `fc_*`, chronione przez powłokę przed zwykłym zapisem/usunięciem. Nie odtwarzać z backupu innego profilu. Wartości `fc_*` i pięciu aliasów są porównywane tylko w RAM na czas dopuszczenia, bez zapisu/normalizacji. Blokada oraz dowód nie zastępują Rules ani zabezpieczenia profilu systemowego przed DevTools/XSS. [Kontrakt, wyniki i ograniczenia](tools/reports/cloud-2b3-main-login.md). Liczby historycznej inwentaryzacji CLOUD-1A poniżej nie obejmują tych dwóch późniejszych kluczy.


Stan źródeł: **2026-10-15**, `main` **f3b6905e** po PR #46. Etap wyłącznie analityczny/dokumentacyjny. Żadnych odczytów browser storage użytkownika, eksportów jego danych, migracji ani zmian runtime. Rejestr zastępuje starsze ogólne listy magazynów jako mapa **obecnego kodu**, nie zastępuje `PROJECT_DECISIONS.md` ani historii raportów.

> **CLOUD-2B.1 — dodatek dotyczący tylko testu Auth:** `auth-test.html` korzysta z własnego persistence Firebase SDK (preferowany IndexedDB `firebaseLocalStorageDb`, fallback SDK browser-local). To sesja uwierzytelniania z danymi wrażliwymi/tokenami zarządzanymi wyłącznie przez SDK, nie projekt ani nowy autorytet danych biznesowych. Nie kopiować jej do eksportera/backupów, raportów lub repo. Normalny `index.html` nie inicjuje Auth. Nie zmieniono 46 nazw i 3 rodzin magazynów aplikacji z audytu; SDK-owned storage jest oddzielne od `fc_*`. [Zakres i blokery CLOUD-2B.1](tools/reports/cloud-2b1-google-login.md).

## 1. Status decyzji i ograniczenie pilotażu

**ZATWIERDZONE w bieżącym poleceniu:** jedno autorytatywne źródło projektu; pilot tylko **jeden testowy inwestor I + jeden fizyczny projekt P**, jego pokoje, szafki, zestawy i zapisane projektowe PCV. Globalne słoje, katalogi/cenniki, magazyn płyt, ustawienia firmy, historia i drafty ofert, kopie ratunkowe, sesje/cache i sekrety **nie wchodzą** do testowego eksportu.

**Nie jest to pełny transfer aplikacji między urządzeniami.** Projekt nadal może odwoływać się do nazw/ID lokalnych materiałów i globalnych domyślnych. Ich wykluczenie nie gwarantuje identycznej WYCENY na pustym urządzeniu. Nie spłaszczać tych zależności przez kopiowanie całych katalogów ani derivedFacts do projektu.

**Granica źródeł decyzji:** użytkownik wskazuje zatwierdzony kontrakt CLOUD-1 z 15.10.2026, ale osobnego tekstu kontraktu nie znaleziono w main ani w odczytanej gałęzi PR #41. Obecne polecenie stanowi potwierdzenie powyższej granicy. Szczegółowy format eksportu, znaczenie kolejnych podetapów, metoda logowania i finalne kolekcje Firestore pozostają do potwierdzenia — nie przypisujemy im pozornej wcześniejszej akceptacji.

Wskazana gałąź `docs/collaboration-rules-20261014` została tylko odczytana; nie zmieniono PR #41. Jej oznaczenia PCV „DO WDROŻENIA” są już historyczne wobec scalonych PR #40, #43, #45 i #46. Aktualny kod i późniejsze decyzje mają pierwszeństwo.

## 2. Metoda, liczby i kompletność

- `node tools/local-storage-source-audit.js`: **339** referencji w **41** plikach `js`; **204** to test/tooling (9 plików), **135** to pozostałe źródła (32 pliki). To liczba linii wykrytych przez scanner, **nie liczba kluczy ani pełna liczba wywołań repository**. Wrappery `FC.storage` mogą nie zawierać słowa localStorage w call-site.
- Kontrola uzupełniająca: literalne `fc_*` w produkcyjnym JS, `constants.STORAGE_KEYS`, bootstrapowe fallbacki, classifier, aliasy `catalogStoragePolicy.LEGACY_KEYS`, konstruowanie slotów i przegląd wszystkich 32 plików z referencjami poza testami. Przeszukano także HTML pod bezpośrednimi wywołaniami storage.
- **46 stałych nazw**: 41 `fc_*` (40 nazw localStorage + `fc_reload_restore_v1` w sessionStorage, również znany historyczny cleanup target w localStorage) oraz **5 historycznych nazw bez fc_**.
- **3 rodziny dynamiczne** projektu opisane osobno: slot inwestora i dwa rodzaje jego kopii. Razem **49 pozycji głównego rejestru**; nie sumujemy nieskończonej liczby możliwych investorId.
- Dodatkowo 2 testowe nazwy osadzone w payloadach backupów i ogólny wzorzec nieznanych/importowanych `fc_*` — poza licznikiem 49, bez twierdzenia, że istnieją u użytkownika. Prefiksy `fc_rozrys_`, `fc_rozrys_plan_cache_v` są detektorami rodzin, nie dodatkowymi kluczami.
- Na bazie main: 824 śledzone pliki, 524 JS, 261 Markdown, 118 `tools/*-smoke.js`. Nowy rejestr dodaje jeden Markdown; statystyki powyżej odnoszą się do bazy, nie do przyszłych commitów.

Podział 49 głównych pozycji według przeznaczenia: **PILOT: 2**, **PÓŹNIEJ: 24**, **LOKALNIE: 18**, **DO WYJAŚNIENIA: 5**. Licznik dotyczy nazw/rodzin, nie par (storage, key), wpisów w JSON ani rzeczywistych danych urządzenia.

### Legenda ochrony i propozycji Firestore

Dziś magazyny są lokalne dla origin/przeglądarki/urządzenia, bez konta chmurowego. „Użytkownik globalnie” oznacza logiczną własność konfiguracji instalacji, nie już istniejący Firebase uid ani własność aktualnego inwestora.

`P` = tylko świadomie wybrany, spójny i potwierdzony zakres pilotażu. `D` = dane biznesowe; brak zgody na reset w tym etapie. `G` = bezwzględna ochrona wypracowanych globalnych danych i zgodności wstecznej. `H` = zamrożona historia, nie przeliczać z nowego projektu/cennika. `F` = decyzja produkcyjna o nieustalonej własności, zachować bez zgadywania. `L` = historyczny zapis/kopia, nie importować automatycznie. `T` = lokalna technika, wykluczyć z pilotażu, nie oznacza zgody na jej usuwanie. `S` = może zawierać sekret lub jego kopię; wartości nie są czytane ani podawane w raporcie.

Wszystkie odwzorowania niżej są **PROPOZYCJAMI DOMENOWYMI**, nie zatwierdzonym schematem Firestore. Ilustracja po ustaleniu uwierzytelnienia: osobno dane inwestorów i projektów w przestrzeni użytkownika, np. `users/{uid}/investors/{investorId}` oraz `users/{uid}/projects/{projectId}`; katalogi/ustawienia i historia w odrębnych domenach. Nie wybrano loginu, dokładnych ścieżek, podkolekcji ani strategii synchronizacji. Należy sprawdzić limit dokumentu Firestore (1 MiB) przed decyzją o fizycznym podziale P; nie zapisywać równorzędnej pełnej kopii P.

## 3. Stałe magazyny (46)

Ścieżki modułów w kolumnie dowodowej są względne do `js/app/` (wyjątek `boot.js` = `js/boot.js`). Oznaczają konkretne źródła read/write/lifecycle; sam wpis w classifier nie dowodzi czynnego writera.

| Klucz / magazyn | Domena, rola | Właściciel | Odczyt / zapis / dowód | Okres życia i aktualizacja/usuwanie | Ochrona | Cel | Odwzorowanie / granica |
|---|---|---|---|---|---|---|---|
| `fc_accessories_v1` | Autorytatywny katalog okuć, technical params, bundleItems, supplierPrices | użytkownik globalnie | catalog/catalog-store.js; catalog/hardware-catalog.js | CRUD/import/init; ceny dostawców są wewnątrz pozycji, nie osobnym kluczem. Część legacy materials może być źródłem migracji. | G | PÓŹNIEJ | Katalog okuć; podział produktu/cen dopiero po decyzji. |
| `fc_business_costs_v1` | Koszty firmy i ich ustawienia | użytkownik globalnie | settings/business-costs-store.js | Świadomy write/read-back; nie wyliczony cache WYCENY. | G | PÓŹNIEJ | Ustawienia/koszty użytkownika; nie w pilotażu P. |
| `fc_company_profile_v1` | Profil firmy, zasady transportu, możliwy sekret ORS transport.apiKey | użytkownik/firma globalnie | settings/company-profile-store.js; investor/investor-transport.js | Read/świadomy write z potwierdzeniem; brak automatycznego TTL. Nie ujawniać wartości apiKey. | G,S | PÓŹNIEJ | Dane firmy/konfiguracja po sanitacji; SEKRET wykluczyć, bez decyzji o docelowym magazynie sekretów. |
| `fc_current_investor_v1` | Wskaźnik aktywnego inwestora | lokalne urządzenie/kontekst użytkownika | investor/investors-local-repository.js; investor/session.js | Set/remove przy wyborze/wyjściu; sesja chroni przełączenia. | T | LOKALNIE | Nie migrować. |
| `fc_current_project_id_v1` | Wskaźnik aktywnego rekordu, nie zawartość projektu | lokalne urządzenie/kontekst użytkownika | project/project-store.js; ui/session-navigation.js | Zmiana kontekstu przez guard sesji; nie identyfikuje użytkownika chmury. | T | LOKALNIE | Nie migrować jako dokument projektu. |
| `fc_data_backups_v1` | Lokalny magazyn backupów, nie kanoniczne dane | użytkownik/urządzenie; potencjalnie wiele projektów i sekretów | shared/data-backup-storage.js; shared/data-backup-store.js; shared/data-backup-policy.js | Retencja normalna 7 dni/min10, testowe max10, auto-protect3; osobna awaryjna kompaktacja quota. Bez zmian retencji w CLOUD-1A. | T,S | LOKALNIE | Brak w pilotażu; decyzja o cloud backupach później, nie kopia całego localStorage. |
| `fc_edge_v1` | Legacy ręczne krawędzie PCV w mapie signature → w1/w2/h1/h2 | globalny podpis; fizyczny właściciel NIEUSTALONY | material/material-edge-store.js; rozrys/rozrys-prefs.js; investor/session.js | Legacy API read/write/reset; normalny projektowy tryb nie używa go jako krawędzi. Nie importowany ani czyszczony przez automatyczne PCV. Sesja monitoruje globalne zmiany. | L,F | DO WYJAŚNIENIA | Bez automatycznego przypisania do P; nie eksportować. |
| `fc_edit_session_v1` | Trwały dowód lokalnej edycji + snapshot, revision, expectedOwnerRaw | projectId + roomId + kontekst inwestora | investor/session.js; ui/session-navigation.js | Begin przed mutacją, rewizje po świadomym zapisie, cleanup dopiero po potwierdzonym commit/cancel. Restart odtwarza dowód, nie wykonuje ślepego rollbacku. | T,D | LOKALNIE | Wykluczyć payload/snapshot z eksportu; aktywna lub niepewna sesja blokuje pilotażowy eksport. |
| `fc_hardware_categories_v1` | Okucia — kategorie | użytkownik globalnie | catalog/catalog-store.js; catalog/catalog-storage-policy.js; shared/constants.js | Edycja/import/init przez catalogStore; zachować ID i powiązania. Stary alias bez fc_ odczytywany tylko przy braku głównego; usuwany po potwierdzonym zapisie głównego. | G | PÓŹNIEJ | Ustawienia/słownik katalogu; docelowy podział dokumentów do decyzji. |
| `fc_hardware_manufacturers_v1` | Okucia — producenci | użytkownik globalnie | catalog/catalog-store.js; catalog/catalog-storage-policy.js; shared/constants.js | Edycja/import/init przez catalogStore; zachować ID i powiązania. Brak osobnego historycznego aliasu w LEGACY_KEYS. | G | PÓŹNIEJ | Ustawienia/słownik katalogu; docelowy podział dokumentów do decyzji. |
| `fc_hardware_settings_v1` | Okucia — VAT i polityka katalogu | użytkownik globalnie | catalog/catalog-store.js; catalog/catalog-storage-policy.js; shared/constants.js | Edycja/import/init przez catalogStore; zachować ID i powiązania. Stary alias bez fc_ odczytywany tylko przy braku głównego; usuwany po potwierdzonym zapisie głównego. | G | PÓŹNIEJ | Ustawienia/słownik katalogu; docelowy podział dokumentów do decyzji. |
| `fc_hardware_suppliers_v1` | Okucia — dostawcy, rabaty i dane cenowe | użytkownik globalnie | catalog/catalog-store.js; catalog/catalog-storage-policy.js; shared/constants.js | Edycja/import/init przez catalogStore; zachować ID i powiązania. Stary alias bez fc_ odczytywany tylko przy braku głównego; usuwany po potwierdzonym zapisie głównego. | G | PÓŹNIEJ | Ustawienia/słownik katalogu; docelowy podział dokumentów do decyzji. |
| `fc_hardware_technical_params_v1` | Okucia — definicje parametrów technicznych/porównań | użytkownik globalnie | catalog/catalog-store.js; catalog/catalog-storage-policy.js; shared/constants.js | Edycja/import/init przez catalogStore; zachować ID i powiązania. Stary alias bez fc_ odczytywany tylko przy braku głównego; usuwany po potwierdzonym zapisie głównego. | G | PÓŹNIEJ | Ustawienia/słownik katalogu; docelowy podział dokumentów do decyzji. |
| `fc_hardware_types_v1` | Okucia — typy/cechy | użytkownik globalnie | catalog/catalog-store.js; catalog/catalog-storage-policy.js; shared/constants.js | Edycja/import/init przez catalogStore; zachować ID i powiązania. Stary alias bez fc_ odczytywany tylko przy braku głównego; usuwany po potwierdzonym zapisie głównego. | G | PÓŹNIEJ | Ustawienia/słownik katalogu; docelowy podział dokumentów do decyzji. |
| `fc_investor_removed_ids_v1` | Tombstones przeciw odtwarzaniu usuniętych inwestorów | inwestor → lokalny mechanizm recovery | investor/investors-local-repository.js; investor/investors-store.js | Aktualizacja przy usunięciu/recovery, nie zwykły cache. Brak globalnego TTL w store. | D | PÓŹNIEJ | Przyszła semantyka usunięć do uzgodnienia; nie kopiować lokalnej listy jako ACL. |
| `fc_investors_backup_meta_v1` | Historyczna meta kopii inwestorów | urządzenie/kopia | shared/data-storage-keys.js; quote/quote-snapshot-storage-maintenance.js | Jak backup inwestorów; nie utożsamiać z aktualnym repository. | T,L | LOKALNIE | Nie migrować. |
| `fc_investors_backup_v1` | Historyczna kopia awaryjna inwestorów | historyczna lista inwestorów | shared/data-storage-audit.js; shared/data-storage-keys.js; quote/quote-snapshot-storage-maintenance.js | Brak aktualnego dedykowanego writera znalezionego w runtime; rozpoznawanie/cleanup starszego klucza. | T,L | LOKALNIE | Nie migrować jako inwestorzy. |
| `fc_investors_v1` | Autorytatywna lista inwestorów + rooms (projekcja zarządzania pokojami) | inwestor; dziś lokalny użytkownik | investor/investors-local-repository.js; investor/investors-store.js; project/project-domain-operations.js | CRUD; pokoje/statusy aktualizowane z potwierdzonej operacji centralnej. | P,D | PILOT | Wyłącznie wybrany inwestor I i powiązanie z P; zakres pól do kontraktu eksportu. |
| `fc_material_part_options_v1` | Aktywne kierunki słojów default/horizontal/vertical/none | globalny signature materiał+nazwa+wymiary; NIE project/cabinet owner | material/material-part-options.js; investor/session.js | Wspólne Opcje zapisują słoje niezależnie od projektowego PCV; semantic revert i ochrona RAW, konflikt/partial blokuje sesję. Powrót do default usuwa właściwy wpis. | F | DO WYJAŚNIENIA | Przyszła własność według Issue #47; poza pilotażem, nie migrować pod udawanym właścicielem. |
| `fc_materials_v1` | Historyczna kompatybilność materiałów, źródło migracji i lustro | użytkownik globalnie | catalog/catalog-store.js; bootstrap/app-state-bootstrap.js | Init rozdziela starsze materiały/akcesoria; kopia kompatybilna po zapisie głównego katalogu. Nie jest równorzędnym autorytetem. | G,L | PÓŹNIEJ | Docelowo jeden katalog, nie druga kolekcja dla kopii. |
| `fc_program_defaults_v1` | Globalne domyślne programu version:2 | użytkownik globalnie | settings/program-defaults-store.js; room-preferences/room-preferences-model.js | read normalizuje v1 do v2 w RAM bez zapisu; świadomy Save zapisuje v2 pod tym samym kluczem. general/zones/hardware, kanoniczne drawerPreference. | G | PÓŹNIEJ | Ustawienia użytkownika; room.preferences to override, nie kopia globalnego store. |
| `fc_project_backup_meta_v1` | Metadane kopii ratunkowej (savedAt) | urządzenie/kopia projektu | project/project-bridge.js; shared/data-storage-keys.js | Aktualizacja wraz z kopią; cleanup restore/quota. | T | LOKALNIE | Nie migrować. |
| `fc_project_backup_v1` | Awaryjna poprzednia wersja projectData | kontekst projektu, bez pełnego niezależnego właściciela | project/project-bridge.js; shared/data-storage-keys.js | Bridge zapisuje poprzednie projectData po centralnym zapisie; cleanup restore/quota może usuwać. | T | LOKALNIE | Kopia ratunkowa, nie źródło P. |
| `fc_project_v1` | Legacy aktywnego projektu; nie autorytet | historycznie aktywny inwestor; brak pewnego physical projectId | investor/investor-project-repository.js; project/project-store.js; wycena/wycena-context-repair.js | Publiczne legacy read/write/sync helpery; zwykły bridge.load czyta centralny rekord, runtime nie tworzy lustra. Jawne repair może czytać stare dane. | L | LOKALNIE | Nie eksportować ani importować do P automatycznie. |
| `fc_projects_v1` | Autorytatywne projekty; tablica fizycznych rekordów | projekt → pokój → szafka/element/grupa | project/project-store.js; project/project-bridge.js; project/project-domain-operations.js | Create/update/remove; trwały zapis pokoju scala tylko jego zakres. Intencja pendingDomainOperation w meta rekordu do odzyskania, nie osobny klucz. | P,D | PILOT | Wyłącznie jeden wybrany rekord P; zachować investorId i stabilne ID, bez cache/sesji/intencji. |
| `fc_quote_offer_drafts_v1` | Trwałe robocze ustawienia ofert i wybrany zakres | projectId w pierwszej kolejności; legacy fallback po investorId; nie oferta historyczna | quote/quote-offer-store.js; wycena/wycena-context-repair.js | Read/write draftu, normalizacja selectedRooms/materialScope. findIndex najpierw szuka projectId, potem investorId — nie jest to gwarancja pełnej izolacji draftów dwóch P tego samego I. | D | DO WYJAŚNIENIA | Robocze dane wyceny osobno od frozen snapshot; legacy wybór po I wymaga kontraktu przed ich migracją, poza pilotem. |
| `fc_quote_rates_v1` | Cennik robocizny/usług, reguły, profile stawek godzinowych | użytkownik globalnie | catalog/catalog-store.js; settings/hourly-rates-store.js | Edycja/import/init; hourlyRates.read/write korzysta z tego katalogu, bez fc_hourly_rates_v1. | G | PÓŹNIEJ | Katalog stawek, bez oddzielnego drugiego źródła hourly rates. |
| `fc_quote_snapshots_v1` | Historia zamrożonych ofert version:7/slim | oferta → investorId + physical projectId + exact offerScope | quote/quote-snapshot-store.js; quote/quote-snapshot-scope.js; project/project-domain-operations.js | Save/replace nowego kandydata wymaga aktualnego proofu; dozwolone meta/status oddzielnie. Lokalne limity 30/projekt i 240 ogółem z regułami zachowania; odczyt nie przelicza cen. | H | PÓŹNIEJ | Historyczne oferty jako niezależne dokumenty, nie wynik bieżącego katalogu. Brak w pilotażu. |
| `fc_reload_restore_v1` | SESSIONSTORAGE: jednorazowy stan wznowienia UI/scroll | karta przeglądarki | bootstrap/reload-restore.js; shared/storage.js | Persist na cyklu życia strony; applySnapshot czyta i usuwa, scroll kończy w RAM. W localStorage klucz jest tylko historycznym cleanup target. | T | LOKALNIE | Nie eksportować; nie mylić z durable edit session. |
| `fc_rozrys_grain_state_v1` | Aktywne decyzje enabled i exceptions obrotu według materiału | globalny materiał/podpis części; własność projektowa NIEUSTALONA | rozrys/rozrys-grain.js; rozrys/rozrys-prefs.js; rozrys/rozrys-render-compose.js | Zapis po świadomych przełącznikach/wyjątkach; getMaterialGrainExceptions filtruje kopię RAM bez zapisu (C2.1a). Jawny prune helper nadal istnieje, bez znalezionego konsumenta runtime. | F | DO WYJAŚNIENIA | To dane produkcyjne wpływające na ROZRYS/WYCENĘ, NIE bezwartościowy cache; poza pilotażem. |
| `fc_rozrys_material_accordion_v1` | UI rozwinięć materiałów według scopeKey | lokalne UI zakresu; nie projektowy autorytet | rozrys/rozrys-prefs.js; rozrys/rozrys-render-compose.js | setAccordionPref zapisuje material/open; brak TTL. | T | LOKALNIE | Nie migrować. |
| `fc_rozrys_overrides_v1` | API ogólnej mapy overrides; aktualny konsument nie znaleziony | NIEUSTALONY; nie wnioskować z nazwy | rozrys/rozrys-prefs.js; shared/data-storage-classifier.js | loadOverrides/saveOverrides eksportowane, brak call-site w aktualnym runtime. Ewentualnego historycznego RAW nie zbadano. | L,F | DO WYJAŚNIENIA | Nie usuwać i nie migrować jako cache/PCV bez ustalenia historycznej semantyki. |
| `fc_rozrys_panel_prefs_v1` | Preferencje panelu/parametry ostatnich obliczeń (np. heurystyka) | globalne lokalne preferencje; brak physical project ownership | rozrys/rozrys-prefs.js; rozrys/rozrys-render-compose.js | Zapis panelu; część parametrów wpływa na kalkulację, lecz nie zastępuje geometrii/projektowych krawędzi. Brak TTL. | T | LOKALNIE | Poza pilotem; ewentualna synchronizacja preferencji wymaga osobnej decyzji. |
| `fc_rozrys_plan_cache_v1` | Legacy cache rozkroju | historyczne lokalne obliczenia | shared/data-storage-keys.js; quote/quote-snapshot-storage-maintenance.js | Brak writera nowego planu v1; znany cleanup target, poza backupem. | T,L | LOKALNIE | Nie migrować. |
| `fc_rozrys_plan_cache_v2` | Odtwarzalny cache planów, plan_* i ts | lokalny hash obliczeń; nie właściciel projektu | rozrys/rozrys-cache.js; rozrys/rozrys-runner.js | Limit 100 wpisów sortowanych po ts przy zapisie. Projektowy tryb omija trwały cache. Restore/quota czyści znane cache. | T | LOKALNIE | Nigdy jako kanoniczna cutlista/metry PCV. |
| `fc_service_orders_v1` | Samodzielne zlecenia usługowe | zlecenie użytkownika; nie wymagany inwestor/projekt | service/service-order-store.js; catalog/catalog-store.js | CRUD; własne ID i zapis, brak pilotażowej migracji. | D | PÓŹNIEJ | Oddzielna domena zleceń, nie część P. |
| `fc_services_v1` | Legacy cennika usług / kopia kompatybilności quoteRates | użytkownik globalnie | catalog/catalog-store.js; bootstrap/app-state-bootstrap.js | Odczyt migracyjny, później kopia głównego quoteRates; błędy kopii są częściowym wykonaniem. | G,L | PÓŹNIEJ | Nie tworzyć równoległej kolekcji services i quoteRates dla tych samych stawek. |
| `fc_sheet_materials_v1` | Główny katalog materiałów + ceny i cechy (także obrzeża) | użytkownik globalnie | catalog/catalog-store.js; catalog/catalog-storage-policy.js | Świadoma edycja/import oraz init/migracja katalogu; pierwotny klucz ma pierwszeństwo nad materials. | G | PÓŹNIEJ | Katalog użytkownika; referencje materiałów P nie oznaczają eksportu katalogu. |
| `fc_sheets_v1` | Rzeczywiste stany magazynu płyt: sheets[], wymiary i qty | użytkownik globalnie/magazyn; nie projekt | material/magazyn.js; rozrys/rozrys-stock.js | Upsert/remove przez magazyn; ROZRYS dobiera supply/pozostałe qty w obliczeniu. Brak gwarancji transakcyjnej rezerwacji/zakupu. | G | PÓŹNIEJ | Magazyn użytkownika; nie cache arkuszy, nie eksportować w pilotażu. |
| `fc_ui_v1` | UI: entry/tab/room/wybory i rozwinięcia | lokalne urządzenie; nie właściciel danych | shared/ui-state.js; bootstrap/app-state-bootstrap.js; boot.js | Aktualizacja nawigacji; boot/restore może normalizować lub czyścić UI. | T | LOKALNIE | Nie migrować jako biznesowy stan projektu. |
| `fc_workshop_services_v1` | Cennik drobnych usług stolarskich | użytkownik globalnie | catalog/catalog-store.js | CRUD/import/init; odrębna domena od cennika projektowej wyceny. | G | PÓŹNIEJ | Osobny rodzaj katalogu użytkownika. |
| `hardwareCategories` | Historyczny katalog/ustawienie bez prefiksu fc_ | użytkownik globalnie | catalog/catalog-storage-policy.js; catalog/catalog-store.js | Fallback read wyłącznie gdy fc_hardware_categories_v1 nie istnieje; po potwierdzonym write głównego klucza legacy może być usunięty (obecny kontrakt). | G,L | PÓŹNIEJ | Włączyć do zabezpieczenia globalnych danych; obecny backup fc_* NIE obejmuje tego klucza. |
| `hardwareSettings` | Historyczny katalog/ustawienie bez prefiksu fc_ | użytkownik globalnie | catalog/catalog-storage-policy.js; catalog/catalog-store.js | Fallback read wyłącznie gdy fc_hardware_settings_v1 nie istnieje; po potwierdzonym write głównego klucza legacy może być usunięty (obecny kontrakt). | G,L | PÓŹNIEJ | Włączyć do zabezpieczenia globalnych danych; obecny backup fc_* NIE obejmuje tego klucza. |
| `hardwareSuppliers` | Historyczny katalog/ustawienie bez prefiksu fc_ | użytkownik globalnie | catalog/catalog-storage-policy.js; catalog/catalog-store.js | Fallback read wyłącznie gdy fc_hardware_suppliers_v1 nie istnieje; po potwierdzonym write głównego klucza legacy może być usunięty (obecny kontrakt). | G,L | PÓŹNIEJ | Włączyć do zabezpieczenia globalnych danych; obecny backup fc_* NIE obejmuje tego klucza. |
| `hardwareTechnicalParams` | Historyczny katalog/ustawienie bez prefiksu fc_ | użytkownik globalnie | catalog/catalog-storage-policy.js; catalog/catalog-store.js | Fallback read wyłącznie gdy fc_hardware_technical_params_v1 nie istnieje; po potwierdzonym write głównego klucza legacy może być usunięty (obecny kontrakt). | G,L | PÓŹNIEJ | Włączyć do zabezpieczenia globalnych danych; obecny backup fc_* NIE obejmuje tego klucza. |
| `hardwareTypes` | Historyczny katalog/ustawienie bez prefiksu fc_ | użytkownik globalnie | catalog/catalog-storage-policy.js; catalog/catalog-store.js | Fallback read wyłącznie gdy fc_hardware_types_v1 nie istnieje; po potwierdzonym write głównego klucza legacy może być usunięty (obecny kontrakt). | G,L | PÓŹNIEJ | Włączyć do zabezpieczenia globalnych danych; obecny backup fc_* NIE obejmuje tego klucza. |

## 4. Rodziny dynamiczne (3)

Wszystkie poniższe to **localStorage**, poza pilotem, cel **LOKALNIE**, ochrona `L,T`. Liczba rzeczywistych instancji zależy od historii urządzenia; nie była odczytywana.

| Wzorzec | Właściciel i rola | Read/write / okres życia | Dowód |
|---|---|---|---|
| `fc_project_inv_{investorId}_v1` | Stary slot po investorId, **nie** dowód fizycznego projectId; historyczna kopia projektu | Repository ma publiczne read/write/remove; obecny zwykły runtime używa centralnych metod, nie znaleziono wywołań writeLegacySlotProject. Jawny repair/diagnostyka/cleanup nadal rozpoznają sloty. Orphan cleanup jest osobną akcją, nie częścią pilotażu. | `js/app/investor/investor-project-repository.js` invKey; `js/app/wycena/wycena-context-repair.js`; `js/app/shared/data-storage-audit.js`; `js/app/shared/data-storage-orphan-cleanup.js` |
| `fc_project_inv_{investorId}_backup_v1` | Historyczna kopia ratunkowa slotu | Brak aktualnego writera tworzącego tę rodzinę; obecny kod ją rozpoznaje, wyklucza z backupu, może czyścić przy restore/quota. | `js/app/shared/data-storage-keys.js` isProjectSlotBackupKey; `js/app/quote/quote-snapshot-storage-maintenance.js` |
| `fc_project_inv_{investorId}_backup_meta_v1` | Meta takiej kopii, nie metadane autorytatywnego P | Jak powyżej; nie wyprowadzać projektu/inwestora wyłącznie przez parsowanie nazwy historycznego klucza. | Te same moduły; regex `^fc_project_inv_.+_backup(?:_meta)?_v1$` |

`fc_*` jako **otwarty wzorzec backup/importu**: `dataStorageKeys.isAppDataKey` akceptuje również nieznane nazwy poza listą wykluczeń. To nie czwarta rodzina projektów ani skończony słownik. Nieznany historyczny/importowany klucz ma status **DO WYJAŚNIENIA**, bez automatycznego uploadu/usunięcia. Wrapper `FC.storage` jest ogólnym adapterem i sam nie nadaje własności danym.

Test/tooling: `fc_backup_policy_test` i `fc_backup_delete_test` występują jako nazwy wewnątrz syntetycznych snapshotów w `js/testing/project/tests.js`. Przykłady `fc_project_inv_inv_live_v1`, `...inv_old_v1`, `...inv_keep_backup_v1`, `...inv_keep_backup_meta_v1`, `...inv_real_v1`, `...inv_room_patch_leak_v1` należą już do trzech powyższych rodzin. Dane testów są także oznaczane flagami/ID wewnątrz **normalnych** kluczy, bez nowego storage namespace. Wykluczyć test/tooling z produkcyjnego eksportu; nie usuwać prawdziwych danych na podstawie podobnego prefiksu.

## 5. Wewnątrz jednego projektu: źródło, PCV i cache

`fc_projects_v1` przechowuje tablicę rekordów `{id, investorId, projectData, status, title, meta, ...}`. Jeden fizyczny rekord może zawierać wiele funkcjonalnych projektów/pomieszczeń. investorId **nie jest** projectId; roomId jest kluczem pokoju w projectData. Lista `investor.rooms` i statusy są projekcjami wymagającymi uzgodnionych operacji, nie drugim równorzędnym projektem.

| Pole w rekordzie projektu | Właściciel / znaczenie | Pilot |
|---|---|---|
| `projectData.meta.productionPcvMode = 'project'` | Polityka fizycznego P, wspólna dla MATERIAŁU/ROZRYSU/WYCENY | Zachować wraz z P. Nowy projekt jest oznaczany od utworzenia, istniejący przy bezpiecznym otwarciu; **nie** przy samym renderze. |
| `projectData[roomId].production.partOverrides[cabinetId][partRoleId].edges` | Indywidualny element, np. body.side.left/right | Zachować boolowskie w1/w2/h1/h2, bez odczytu fc_edge_v1. |
| `...production.cabinetGroupOverrides[cabinetId][groupRoleId].edges` | Grupa szablonowa, np. body.shelves, front.drawer.small/large, komponenty szuflad | Jeden override dla wszystkich aktualnych sztuk grupy. Qty i wymiary nie są tożsamością. |
| `...production.setGroupOverrides[setId][groupRoleId].edges` | Rzeczywisty zestaw | Zachować setId; właścicielem nie jest pierwsza szafka zestawu. |
| `cabinet.derivedFacts`, `_derivedFacts` | Odtwarzalne fakty/cache | `projectStore.prepareProjectDataForPersistence` usuwa je z kopii do trwałego zapisu. Nie eksportować/importować jako autorytet. |
| `sourceRefs`, `sourceGroups`, `effectivePcv`, sourceIssues, metry i cutlista | Metadane/wyniki generowane z projektu | Nie zapisywać pełnej listy jako drugiej prawdy. Nierozstrzygnięte źródła wymagają odmowy operacji PCV. |
| `record.meta.pendingDomainOperation` | Intencja odzyskiwania pokoi/statusów/oferty, może zawierać przed/po i historię | **Blokuje eksport**, nie kopiować do cloud dokumentu P ani uruchamiać recovery przez import. |

Dowody: `js/app/project/project-pcv-policy.js`, `project-pcv-overrides.js`, `project-pcv-resolver.js`, `project-store.js`, `project-domain-operations.js`; `js/app/cabinet/part-provenance.js`; raporty `tools/reports/c2-1b2a-project-owned-pcv.md`, `c2-1b2b-effective-project-pcv.md`, `c2-1b2c1-session-save-safety.md`, `c2-1b2c2-project-calculation-adapters.md`, `material-unified-part-options.md`, `material-pcv-save-conflict-hotfix.md`.

Odczyt/podgląd nie nadaje projektu przypadkowemu właścicielowi. SourceRefs pojedynczych sztuk i sourceGroups grup są niezależne od agregacji produkcyjnej. Normalne Opcje mają **jeden przycisk i jeden modal**; projektowe PCV i globalne słoje zapisuje minimalny koordynator. PCV nie zapisuje się w fc_edge_v1. Issue [#47](https://github.com/mebleszek/meble-app/issues/47) pozostaje przyszłą przebudową globalnych słojów według wskazania użytkownika; CLOUD-1A jej nie wdraża.

### Globalne granice zapisu C3.1

`catalog-store.js` chroni uszkodzony RAW blokadą CATALOG_RECOVERY_REQUIRED; widoczne fallbacki nie upoważniają do nadpisania katalogu. Potwierdzenie wymaga nowego zapisu/read-back, nie samego istnienia starego klucza. Operacje wielu katalogów/kopii przekazują partial/confirmedKeys, więc awaria kolejnego klucza nie oznacza „nic nie zapisano”. Migracja globalna musi zachować te dowody i pierwszeństwo kluczy. CLOUD-1A ich nie zmienia ani nie uruchamia.

## 6. Sesja, statusy, oferta i autosave

- Edit scope to **projectId + roomId**; calculationScope = selectedRooms, offerScope = dokładny zakres snapshotu. A, B i A+B pozostają trzema niezależnymi wariantami. Odczyt wielu pokojów nie zmienia właściciela sesji.
- Session.begin wymaga durable payloadu przed mutacją. Potwierdzony projekt to `saveConfirmed(...).ok === true`; compatibility `save()` nadal może zwrócić dane po odmowie i nie stanowi potwierdzenia sukcesu.
- Rollback modyfikuje tylko aktualny rekord/pokój właściciela, nie przywraca całego starego fc_projects_v1. Pozostałe pokoje i fizyczne projekty są zachowane. Niepewna rewizja blokuje Save/commit/nawigację, także po restarcie; bez ślepego przyjęcia najnowszego RAM.
- Sesja monitoruje fc_edge_v1 i fc_material_part_options_v1. Zmiana globalnych decyzji formatek może blokować Cancel kodem UNSCOPED_PART_ROLLBACK_BLOCKED. **Nie** traktować fc_rozrys_grain_state_v1 jako bezpiecznego pokojowego rollbacku tylko z racji etykiety technical; nie należy do tych dwóch globalnych snapshotowanych kluczy.
- `projectDomainOperations` zapisuje minimalną odzyskiwalną intencję w meta rekordu i potwierdza wielomagazynowe operacje pokojów/statusów/historii. Nie eksportować rozpoczętej operacji ani wykorzystywać jej kopii jako drugiego źródła.
- Nowy kandydat oferty wymaga aktualnego proofu projektu/zakresu przed save/replace, również po asynchronicznym dialogu duplikatu. Walidacja fizycznego właściciela jest niezależna od aktualnie wybranego projektu. Odczyt historycznej oferty i dozwolone meta nie wymagają przeliczenia cen. Status wspólnej oferty ma jawny zakres.
- `project-autosave.js` nadal może zapisać niezmieniony projekt po kliknięciu. PR #46 pomija tylko updatedAt **rekordu** w lokalnym świadku edytora formatek; nie usuwa kontroli actual data/conflict ani rewizji sesji. To nie chmurowa transakcja/CAS.

Dowody: `js/app/investor/session.js`, `js/app/ui/session-navigation.js`, `js/app/project/project-bridge.js`, `js/app/project/project-domain-operations.js`, `js/app/quote/quote-snapshot-store.js`, `js/app/quote/quote-snapshot-scope.js`, `js/app/quote/quote-offer-store.js`, `js/app/investor/project-autosave.js`, `js/tabs/material.js`.

## 7. Eksport użytkowy a obecny pełny backup

**Obecny backup** (`data-backup-snapshot.js`, `data-storage-keys.js`, `data-backup-export.js`) zbiera RAW localStorage według fc_* z wykluczeniami. Nie jest gotowym selektywnym eksporterem CLOUD-1. `makeExportPayload()` tylko opakowuje snapshot; nazwa „data-export” nie dowodzi domenowej allowlisty. Restore może usuwać brakujące klucze i wykonywać cleanup — **nie wolno użyć tego jako pilotażowego pobrania P**.

Wykluczone z obecnego snapshotu: magazyn backupów, cztery stałe kopie projektu/inwestorów, dynamiczne backupy slotów, cache planów v1/v2, lokalny klucz sesji i reload restore. sessionStorage nie jest enumerowany. Stan UI, wskaźniki i globalne decyzje słojów nadal mogą wejść do pełnego backupu. Pięć nieprefiksowanych legacy katalogów **nie jest objętych fc_* backupem**, mimo wartości ich danych.

**Ważna luka zakresu, bez zmiany działania:** fc_company_profile_v1 może zawierać transport.apiKey ORS, a obecny kolektor RAW i eksporter **nie filtrują tego pola**. Backupy już zapisane mogą zawierać kopię sekretu. Nie podano ani nie odczytano żadnej jego wartości. Sanitizer backupów odchudza dane/techniczne kopie; nie należy zakładać, że stanowi filtr sekretów. Pełnego lokalnego backupu nie wolno bez sprawdzenia umieszczać w Firestore, załączać publicznie ani używać jako pilot payloadu. Docelowe przechowywanie kluczy usług zewnętrznych wymaga osobnej decyzji; niczego tu nie migrujemy.

**Planowana granica CLOUD-1B (propozycja do potwierdzenia kontraktem):** selektywna allowlista I/P, kontrola aktywnego właściciela, potwierdzonego źródła i zakończonej sesji, brak pendingDomainOperation/niepotwierdzonej rewizji; wykluczenie globalnych kluczy, sekretów, cache, sesji, kopii i historii. Nie wystarczy wyeksportować całej tablicy fc_projects_v1/fc_investors_v1. Pola inwestora, statusy i odsyłacze do niewyeksportowanych ofert wymagają jawnego kontraktu zamiast przypadkowej częściowej rekonstrukcji. Nie wdrożono eksportera w CLOUD-1A.

Retencja i awaryjne odchudzanie lokalnych backupów pozostają bez zmian. Ich optymalizacja jest odłożona do czasu po migracji.

## 8. Osobno: przypadki nierozstrzygnięte i ryzyka

**Pięć pozycji DO WYJAŚNIENIA:** cztery magazyny z nierozstrzygniętą własnością/interpretacją produkcyjną — fc_edge_v1, fc_material_part_options_v1, fc_rozrys_grain_state_v1, fc_rozrys_overrides_v1. Pierwsze trzy zawierają/obsługują decyzje produkcyjne; czwarty nie ma znalezionego konsumenta. Nie wolno ich kasować, przypisywać wybranemu P ani traktować wszystkich jako cache. Nowych użytkowych PCV ta niepewność nie dotyczy — są w P. Piątą pozycją jest fc_quote_offer_drafts_v1: właściciel projektu występuje w modelu, ale findIndex ma fallback po investorId, wymagający rozstrzygnięcia przed przyszłą migracją draftów. To nie dotyczy zamrożonej historii ofert i nie wchodzi do pilotażu.

Dalsze decyzje wymagane przed odpowiednim etapem:

1. Pełny tekst zatwierdzonego kontraktu CLOUD-1 i dokładne definicje CLOUD-1B/2A/2B/2C (nie znalezione w repo).
2. Uwierzytelnienie/identyfikacja właściciela chmury i reguły dostępu, bez samodzielnego wyboru metody loginu.
3. Format/allowlista eksportu I/P, zachowanie ID, statusów i referencji do wyłączonych historii oraz kontrola zgodności katalogowych zależności na docelowym urządzeniu.
4. Finalne dokumenty/podkolekcje Firestore, limit rozmiaru i wersjonowanie. Propozycja użytkownik → inwestor/projekt nie jest decyzją wdrożeniową.
5. Własność słojów/rotacji (Issue #47 i otwarte ograniczenia D1–D6), historyczna zawartość dormant overrides; nie blokuje dokumentacyjnego rejestru ani wąskiego testowego eksportu bez tych danych, ale uniemożliwia deklarację pełnego transferu produkcji.
6. Osobna ochrona sekretów i zabezpieczenie historycznych globalnych aliasów poza fc_* przed szerszym eksportem globalnych danych.

Pozostałe zaobserwowane granice, **bez poprawek runtime**: magazyn płyt `saveAll()` i store zleceń nie mają tego samego kontraktu confirmed co projekt; read/write słojów ROZRYSU bywa best-effort. C3.1 nie oznacza blanket gwarancji wszystkich magazynów. localStorage nie ma atomowego CAS między kartami. To zadania do osobnej decyzji, nie powód do cichego rozszerzenia CLOUD-1A.

## 9. Dowód pokrycia audytu i weryfikacja

Lista poniżej obejmuje wszystkie 32 pliki poza test/tooling wykryte w audycie. Czytanie/writing wrappera z dowolnym kluczem jest rozstrzygnięte przez rejestr, stałe i call-site, nie przez sam scanner. Wartości to liczby referencji źródłowych (łącznie 135).

| Plik | Referencje |
|---|---:|
| `js/app/bootstrap/reload-restore.js` | 3 |
| `js/app/catalog/catalog-storage-policy.js` | 4 |
| `js/app/catalog/catalog-store.js` | 2 |
| `js/app/investor/investor-project-repository.js` | 3 |
| `js/app/investor/investors-local-repository.js` | 9 |
| `js/app/investor/investors-store.js` | 2 |
| `js/app/investor/session.js` | 25 |
| `js/app/material/magazyn.js` | 1 |
| `js/app/material/material-edge-store.js` | 4 |
| `js/app/material/material-part-options.js` | 12 |
| `js/app/project/project-bridge.js` | 1 |
| `js/app/project/project-domain-operations.js` | 3 |
| `js/app/project/project-store.js` | 4 |
| `js/app/quote/quote-snapshot-storage-maintenance.js` | 7 |
| `js/app/quote/quote-snapshot-store.js` | 2 |
| `js/app/rozrys/rozrys-cache.js` | 2 |
| `js/app/rozrys/rozrys-grain.js` | 2 |
| `js/app/rozrys/rozrys-prefs.js` | 2 |
| `js/app/settings/business-costs-store.js` | 1 |
| `js/app/settings/company-profile-store.js` | 1 |
| `js/app/settings/program-defaults-store.js` | 3 |
| `js/app/shared/data-backup-snapshot-apply.js` | 3 |
| `js/app/shared/data-backup-snapshot.js` | 1 |
| `js/app/shared/data-backup-storage.js` | 3 |
| `js/app/shared/data-storage-audit.js` | 4 |
| `js/app/shared/data-storage-keys.js` | 7 |
| `js/app/shared/data-storage-orphan-cleanup.js` | 1 |
| `js/app/shared/storage.js` | 9 |
| `js/app/ui/session-navigation.js` | 6 |
| `js/app/wycena/wycena-context-repair.js` | 4 |
| `js/app/wycena/wycena-diagnostics.js` | 3 |
| `js/boot.js` | 1 |

Powtórzenie audytu: `node tools/local-storage-source-audit.js`. Raport JSON można uzyskać przez `require('./tools/local-storage-source-audit').buildAudit(['js'])` — **nie** używać `--json` jako ścieżki root, bo CLI traktuje argumenty także jako roots. Kontrolę uzupełnić o LEGACY_KEYS, constants i rodziny invKey/backup regex. Żadne narzędzie tu nie odczytuje przeglądarki użytkownika.

Weryfikacja CLOUD-1A: **PRE-FLIGHT PASS** (142,769 s), składnia **524/524**, smoke **118/118**, APP **110/110**, load order **318**, dependency audit **394 domenowe JS / index 318 / dev_tests 346**, storage audit **339 / 41**. Kontrola kompletności potwierdziła 46 unikalnych nazw, pokrycie 41 produkcyjnych literałów fc_* i 5 legacy aliasów, trzy dynamiczne rodziny oraz istnienie wszystkich ścieżek dowodowych tabeli. `git diff --check`: **PASS**. Zmieniono tylko 5 Markdown; brak zmian JS/HTML/CSS/workflows/testów, danych i runtime. Pełny preflight obejmuje dotychczasowe regresje sesji, globalnych danych i kalkulacji 4/3/6; nie dodawano nowych testów ani nie osłabiano ich asercji.

## 10. Propozycja wpisu do istniejącego PROJECT_DECISIONS.md (do przeniesienia osobno)

> **2026-10-15 — CLOUD-1A, propozycja wpisu po akceptacji rejestru:** pilot obejmuje wyłącznie jednego wybranego testowego inwestora i jeden fizyczny projekt z pokojami, szafkami i projektowym PCV. fc_projects_v1 pozostaje jedynym autorytetem P. Globalne słoje, katalogi/cenniki, historia/drafty ofert, backupy, sekrety i stan techniczny są poza pilotem. Globalne dane zachowują ochronę i kompatybilność. CLOUD-1A jest dokumentacją, CLOUD-1B i dalsze etapy wymagają osobnej zgody. Nie wybrano metody logowania ani finalnego schematu Firestore. Bieżący stan po PR #46 opisują CURRENT_STATE.md i CLOUD_DATA_REGISTER.md; historyczne „DO WDROŻENIA” przy PCV i wspólnych Opcjach wymaga sprostowania w osobnym PR dokumentacyjnym.

To wyłącznie propozycja do PR #41/kanonicznego rejestru decyzji, **nie nowy konkurencyjny plik decyzji**. Ręczna akceptacja użytkownika obecnie na Androidzie; tablet/komputer pozostają docelowymi platformami, bez żądania ich ręcznego testu teraz. CLOUD-1A nie uruchamia synchronizacji, UI chmury ani testów na urządzeniach.
