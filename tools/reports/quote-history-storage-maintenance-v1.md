# WYCENA — historia ofert i storage maintenance v1

Paczka: `site_quote_history_storage_maintenance_v1.zip`

## Zakres

- Dodano moduł `js/app/quote/quote-snapshot-storage-maintenance.js` jako lokalny, chmuro-gotowy adapter awaryjnego odchudzania storage przed zapisem historii WYCENY.
- `quote-snapshot-store` przy błędzie zapisu snapshotu próbuje teraz zwolnić miejsce przez usunięcie cache/kluczy technicznych oraz odchudzenie lokalnych backupów, zamiast od razu kończyć na `Podgląd bez zapisu historii`.
- Zachowano sens flow ofert z BACKUP-u: wiele ofert, wstępna/końcowa, akceptacja, statusy, odrzucenia i historia nadal idą przez `quoteSnapshotStore` / status bridge.
- Zachowano obecny silnik automatów robocizny, `quantitySource`, warunki i audyt robocizny. Nie cofano robocizny do BACKUP-u.
- Historia snapshotów jest limitowana do 30 najnowszych ofert na projekt, z zachowaniem ofert wybranych/zaakceptowanych; globalnie store ma miękki limit techniczny.
- `Diag` nie wkleja już pełnego `previewState.lastQuote`; pokazuje skrót snapshotu oraz rozbicie rozmiarów snapshotu/sekcji.
- Cache-busting: `20260610_quote_history_storage_maintenance_v1`.

## Co może zostać usunięte automatycznie przy pełnym localStorage

- cache ROZRYS,
- `fc_edit_session_v1`, `fc_reload_restore_v1`,
- techniczne kopie awaryjne projektu/inwestorów,
- nadmiar lokalnych backupów `fc_data_backups_v1`.

Nie są usuwane bieżące projekty, inwestorzy, katalogi, cenniki ani aktualnie zapisywany snapshot oferty.

## Testy

- `node --check js/app/quote/quote-snapshot-storage-maintenance.js`
- `node --check js/app/quote/quote-snapshot-store.js`
- `node --check js/app/wycena/wycena-diagnostics.js`
- `node tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/index-load-groups.js`
- `node tools/wycena-quote-history-storage-maintenance-smoke.js`
- `node tools/wycena-snapshot-clean-store-smoke.js`
- `node tools/wycena-diagnostics-report-smoke.js`
- `node tools/wycena-duplicate-offer-guard-smoke.js`
- `node tools/wycena-unsaved-preview-storage-fix-smoke.js`
- `node tools/wycena-generate-single-flow-smoke.js`
- `node tools/wycena-generate-action-registry-smoke.js`
- `node tools/quote-single-truth-pre-labor-smoke.js`

## Świadomie nieruszone

- `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`.
- WYWIAD i plus dodawania szafki.
- Naprawa źródła `drawer.count` — zostaje osobnym etapem przez jawne wymagania szuflad/prowadnic, nie przez whitelistę wariantów.


## Atomowe usuwanie oferty LOCAL-FIRST — 08.11.2026

BASE/main: `10cbe191e4dbac16d1d97a4c157789d5562ac34d`; gałąź `fix/local-first-quote-delete-20261108`.

### Potwierdzona przyczyna i zakres

Handler historii pomijał istniejącą granicę zapisu `applicationWrite.project`. Dodatkowo po wyjątku strict `quoteSnapshotStore.remove` nadal rekonsyliował statusy. Usunięcie historii i późniejszy status mogły więc być dwiema osobnymi operacjami. Screenshot potwierdza odmowę, ale nie rozstrzyga konkretnego reason (np. active-session, needsClosure, intent-write). `writeAll` jest strict i weryfikuje odczyt — nie stwierdzono ignorowania jego `false`. `ensureEditor` nie rozpoczyna sesji edycji; w LOCAL-FIRST localOnly sprawdza istniejący scope, a w online używa istniejącej dzierżawy.

W `wycena-tab-history.js` po świadomym potwierdzeniu ta sama transakcja obejmuje strict remove, istniejące czyszczenie referencji i istniejący plan statusów. `false`, `null`, `{ok:false}` lub wyjątek statusu oznaczają rollback. Nie dodano adaptera ani nie zmieniono recovery/status engine. Wybór oferty w widoku aktualizuje się dopiero po potwierdzeniu; roboczy RAM statusów uczestniczy w istniejącym snapshot/rollback authority. Odmowa/abort zachowuje formularze i wybór, a późniejszy błąd renderu ma odrębny komunikat o już zapisanym usunięciu. Dwa równoczesne kliknięcia tej samej akcji są blokowane przyciskiem.

Zabezpieczenia: zgodny właściciel i projekt, aktualny rekord i snapshot względem renderu, brak aktywnej/niezamkniętej sesji; kontrola przed i po await potwierdzenia i ponownie wewnątrz boundary. Zmiana writera lub trybu podczas potwierdzenia odmawia. Oba istniejące tryby (`localOnly:true/false`) wybierają tę samą granicę zapisu; nie zmieniono aktywacji, Auth, protokołu ani ustawień synchronizacji i nie wykonano LIVE. Legacy bez boundary zachowuje strict remove, a po jego odmowie nie wykonuje rekonsyliacji. Nie deklarujemy transakcyjności legacy.

### Dowody i routing

- `node tools/quote-delete-local-first-smoke.js`: **15/15 PASS** — odmowy statusu i rollback fixture, chroniona sesja, zmiana owner/projektu/snapshotu/writera/trybu, zastany nieaktualny render, strict legacy failure bez rekonsyliacji, zwykła/zaakceptowana oferta i nietknięty obcy projekt, oba tryby boundary bez sieci.
- `node tools/quote-history-session-safety-smoke.js`: **7/7 PASS**.
- `node tools/offer-status-recovery-smoke.js`: **22/22 PASS**.
- `node tools/android-local-first-browser-smoke.js --quote-delete-only`: rzeczywista aplikacja, natywne IDB i kliknięcia w Chromium. Anulowanie nie zmienia RAW/4 stores; abort native transakcji zachowuje historię/statusy/referencje, dokładne `lastQuote`/preview i zaakceptowaną ofertę w widoku; ponowienie zapisuje usunięcie i status `nowy`; pełny cold restart offline potwierdza trwałość. RAW/outbox/protected/replicas pozostają dokładne, cudza baza bez otwierania/zmian, zero zewnętrznych żądań. Fixture odtwarza syntetyczny profil, nie dane telefonu. Początkowy setup odrzucił nieodświeżony manifest; poprawiono wersje i manifest, bez zmian timeoutów. Dalsze dwie odmowy dotyczyły przygotowania nowego scenariusza (aktywna sesja i otwarta informacja o zapisie), nie pominięto guardów: scenariusz zaczyna się po rzeczywistym Save i zamyka informację przez przycisk.
- Składnia zmienionych modułów, zgodność script-versions, manifest i `git diff --check`: **PASS**. Routing: 209 bieżących smoke / 7 grup; nowy Node w shardzie 7, native w domyślnym Android smoke w shardzie 5, session-safety 6, status-recovery 4. Ten sam helper działa zawsze w domyślnym Android smoke; `--quote-delete-only` jedynie skraca dalszą część. Po integracji `node tools/android-local-first-browser-smoke.js`: **18 grup PASS, exit 0**. Ten jeden pełny przebieg potwierdził też dalszy flow zapisu sesji, wyboru pomieszczeń, transportu, katalogów, kolejnych inwestorów i restartów po nowym helperze.

Pełne CI i fizyczny Pixel: **PENDING**. Zmiany wyłącznie w uzgodnionym handlerze, celowanych regresjach, wersjach/manifestach i dokumentacji. Bez PR, Actions, publikacji, LIVE, resetu i ingerencji w reguły/ceny. Jeden końcowy commit/push po niezależnej kontroli wykonuje kontroler; wykonawca pozostawia diff.


### Niezależna kontrola i przekazanie

Kontroler sprawdził gotowy diff, nie powtarzając testów wykonawcy. Uwagi o nieaktualnym snapshotcie z renderu, komunikacie po udanym commicie, zmianie writera/trybu oraz obowiązkowym uruchamianiu native helpera w domyślnym CI zostały uwzględnione. Końcowe kontrole kontrolera: składnia zmienionych modułów i nowych fixture, dokładne wersje obu wejść, manifest, rozłączne inventory 209/7 i diff PASS. Nie stwierdzono dalszych uwag do uzgodnionego zakresu. Wyniki Node/Chromium wyżej wykonał drugi Codex; kontroler zweryfikował dowody i integrację zamiast je dublować. Jeden końcowy commit/push na gałąź roboczą; pełne zdalne HEAD/BASE i CLEAN w końcowym przekazaniu.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.** Poprawka nie jest jeszcze wydaniem na telefon. Kolejny krok: niezależna kontrola dokładnych zdalnych SHA i osobna decyzja właściciela o jednej próbie wydania.
