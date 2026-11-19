# Preflight #1359 — odczyt ACK kartoteki i naprawa w tym samym PR

## USTALONE
- Repo mebleszek/meble-app, PR #151, gałąź **feat/p0b-project-exclusivity-20261116**.
- HEAD wejściowy: `15c1d468813cccee31002be32b9cd178ff841c34`.
- BASE/main: `d91c48938febe800553def7ed17967d0ffdcfb0b`.
- [Run 44510235803 / #1359](https://github.com/mebleszek/meble-app/actions/runs/44510235803): zakończony, **77 jobów: 71 PASS, 4 FAIL, 2 SKIPPED**.
- Jeden pierwotny FAIL: **firebase-p0b (room-quote-promotion)**, job 135512355009. Pozostałe FAIL: firebase-current (135514096484), ci-summary (135514923353), final-status (135515183258) są agregatami tej samej odmowy. Auto-merge i post-merge-verify poprawnie SKIPPED. Brak dodatkowej pierwotnej awarii w kompletnych logach.
- Nie powtarzano 71 zaliczonych grup ani historycznych napraw #1357/#1358. Bieżąca naprawa jest wykonywana bezpośrednio na gałęzi istniejącego PR, zgodnie z nową zgodą.

## Rzeczywisty pierwszy błąd i dowody
Nazwa joba była myląca: stack zatrzymał się w `p0b-normal-application.test.mjs:102`, przed utworzeniem pokoi i przed konwersją. Test oczekiwał pierwszego verified ACK nowej kartoteki inwestora, nie końcowych statusów oferty. Oba profile miały projectRecords=0.

Pobrano pełny artefakt CI `diagnostics-p0b-room-quote-promotion`, ID 14522656496, w tym failure.json, peer.json i trace. Dowód w rzeczywistym IndexedDB:
- Nadawca: jedna operacja scope `p0b_contact_85627466bb3f856c351fe4875f6367547ee683bbf419063133a1059754cff794`, phase **uncertain**, code **LF_P0B_CONTACT_NOT_FOUND**, expected generation=1, investorId=inv_o456chiv_mwnfrqph, hash=`6e2c0c45e3e19dcfcdd22925eda8299e51608a6632f11b90868b810239ccff1d`; replica dirty=true, base=null.
- Drugi profil: ta sama kartoteka odebrana, dirty=false, base ma **dokładnie ten sam generation/investorId/hash**.
- Zatem publikacja dotarła do serwera i odbiorcy, lecz nadawca nie uzyskał świeżego dowodu ACK. Nie utracono lokalnej kartoteki i nie jest to odmowa Rules ani błąd kalkulatora.
- LF_P0B_REGISTRY_REQUIRED pochodził również z prób obecności przed potwierdzeniem nowej kartoteki. Te bezpieczne odmowy pozostają; nie uznaje się ich za upoważnienie do pominięcia rejestru.

Ścieżka `protocol.investor()` używała dokumentowego `getDocFromServer` poza kolejką transakcji protokołu. Sam fromCache=false nie dawał dowodu uporządkowania tego wyniku względem właśnie zatwierdzonej publikacji przy nakładających się odczytach. W artefakcie nie ma pełnej wewnętrznej kolejki SDK, więc nie przypisuje się mu konkretnego błędu transportu/emulatora. Potwierdzono obserwowalny problem: odczyt ACK widział brak, kiedy drugi profil miał tę samą potwierdzoną rewizję.

## RED → poprawka → GREEN
- Wejściowy job CI jest RED. Lokalny pełny scenariusz wejściowego SHA przeszedł 1/1 (~144 s); sporadycznego wyścigu nie przedstawia się jako deterministycznie odtworzonego całego UI.
- Nowa celowana regresja na **rzeczywistym Firestore Emulator Standard DEMO** pobiera prawdziwy serwerowy snapshot braku dokumentu, następnie rzeczywiście tworzy kartotekę i potwierdza commit niezależną transakcją. Na granicy SDK kontroluje dostarczenie wcześniejszego, nadal nakładającego się wyniku. To celowa instrumentacja dostarczenia rzeczywistego snapshotu, nie atrapa Firebase.
- Na wejściowym kodzie: **RED**, `protocol.investor()` zwraca null mimo dowiedzionego commita. `contact-ack-red.log`: „ACK must see the committed contact despite the overlapping absent result”.
- Poprawka w **p0b-protocol.mjs**: autorytatywny odczyt kartoteki korzysta z istniejącej kolejki transakcji protokołu i nowego odczytu `tx.get`, po jego zapisach. Nadal guard, kontrola metadanych, CAS, dekodowanie pełnej kartoteki, tombstone oraz **maxAttempts:1**. Bez powtórzenia publikacji, retry, timeoutu i zwiększania whitelist.
- Nowa regresja w istniejącym obowiązkowym segmencie **normal-rules**. Oprócz aktualnego ACK wymaga niezmienionego dokumentu/generacji po obserwacji, zachowania nieznanych pól, prawdziwej odmowy stale CAS i duplikatu inwestora, odmowy po zmianie Auth oraz niepotwierdzonej obecności offline.
- Pierwszy run po poprawce przeszedł część ACK, ale ujawnił błędne założenie nowego testu: SDK disableNetwork nie jest pełnym odcięciem RPC transakcji. Poprawiono nowy negatyw do publicznego kontraktu presence(online=false); rzeczywisty offline, niesłane dane i brak fałszywego ACK nadal sprawdza Chromium. Nie usunięto istniejących asercji i nie zmieniono produkcji dla tego założenia.
- Końcowa celowana regresja ACK: **PASS 1/1**, exit 0, ~11 s (`contact-ack-final.log`).
- Wspólny Chromium + emulator: normal-clean i room-quote-promotion: **PASS 2/2**, exit 0, ~265 s; osobno normal-clean ~140 s, promocja ~123 s. Obejmuje istniejące negatywy obcego edytora/PIN, CAS, offline, SIGKILL, recovery/abort, ACK i niezmienną historię promocji.

## WDROŻONE — procedura
W AGENTS §12 i RELEASE §12/§20:
- Osobno zatwierdzona naprawa FAIL istniejącego PR domyślnie bezpośrednio na jego gałęzi; jeden spójny commit/push, bez dodatkowej gałęzi i etapu przenoszenia commita.
- Zapis wejściowych HEAD/BASE, ponowny odczyt przed pushem; obca zmiana któregokolwiek = STOP i zachowanie pracy, bez force-push/nadpisania/rebase/merge.
- Każdy raport: aktualne zdalne HEAD/BASE, faktyczne testy, ograniczenia, CLEAN/push i stan PR.
- Naprawa jest odrębnym trybem od odczytowej obsługi próby wydania przez ChatGPT. Nie udziela zgody na Draft/Ready, Actions, retry ani wydanie.
- Każde wydanie nadal wymaga osobnej zgody na dokładne nowe SHA, jednego pełnego CI, automatycznego merge wyłącznie po PASS/tożsamości SHA i kontroli Pages. Workflow nie zmieniono; push nie uruchamia pełnego CI.

## Zakres plików i kontrola
- tools/firebase-pilot/p0b-protocol.mjs — świeży, uporządkowany odczyt kartoteki/ACK.
- tools/firebase-pilot/p0b-normal-rules.test.mjs — regresja realnego commita z nakładającym się starym wynikiem i negatywami.
- tools/ci-sharding-smoke.js — kompletne pokrycie **33**, zamiast 32 przypadków P0-B; zachowane 20 segmentów, 225 smoke / 251 execution units / 36 grup.
- offline-assets.js — wyłącznie regeneracja hashy zmienionego publicznego modułu.
- AGENTS.md, docs/agents/RELEASE.md — zatwierdzona procedura.
- CURRENT_STATE.md, docs/plans/LOCAL_FIRST_ROADMAP.md oraz ten raport — wykonanie, dowody i bramki.

Składnia zmienionych źródeł, diff/whitespace, manifest oraz gate kompletności CI PASS. Bez zmian UI, cen/kalkulatora, danych, Rules, migracji, resetów, Firebase LIVE i konfiguracji CI.

## BRAKUJE → PROPONOWANE
**CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**, nie gotowość wydania. Pełnego CI nowego SHA nie uruchamiano. Obserwowane PASS poprzednich SHA nie są dziedziczone. Fizyczne urządzenia niebadane, LIVE nadal BLOCKED. Dodatkowy odczyt transakcyjny może zwiększyć liczbę wywołań i czas; zużycie/limity wymagają pomiaru w CI. Nie zmieniono budżetów ani zasad retry.

Końcowe testy celowane PASS; przekazanie: jeden commit/push na gałąź PR #151 po ponownej kontroli wejściowych SHA. PR ma pozostać otwarty Ready, bez zmiany stanu administracyjnego. Potem niezależna kontrola pakietu i osobna zgoda właściciela na dokładny wynikowy HEAD/BASE do nowej próby wydania. Opis starej zgody w PR nie jest automatycznie nową zgodą wydaniową.

Dowody poza repo: outputs/preflight-1359-20261119: jobs.json (77), cztery kompletne logi FAIL, ci-artifact.zip/rozpakowane JSON/trace, promotion-input.log, contact-ack-red.log, contact-ack-final.log, combined-green.log. Nie publikowano całych profili ani trace. Testy: Windows repo/Node + izolowane profile istniejącego Chromium WSL i emulator DEMO 19099/18080. Zastosowano skill firebase:firebase-firestore wyłącznie dla istniejącego emulatora Standard; bez provisioningu lub LIVE.

Końcowe pełne SHA/push/CLEAN/stan PR są w raporcie przekazania; dokument nie wpisuje własnego hasha commita w treść.
