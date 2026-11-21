# WYCENA i zapis przy zmianie zakładek — 21.11.2026

## USTALONE

Zgoda właściciela obejmuje naprawę odmowy zapisu przy przechodzeniu między zakładkami oraz `LF_QUOTE_HISTORY_IMMUTABLE` przy jawnej zamianie identycznej oferty. Gałąź `fix/quote-replacement-tab-save-20261121`, BASE/main `f8a3244e4169a16e4f8a205d0740a26c5ce2282e`. Drzewo przy rozpoczęciu CLEAN. Bez zmian Firebase LIVE, UI/tekstów, kalkulatora/cen, resetu danych i wydania.

Raport telefonu: sesja aktywna/durable, zgodne RAM/storage/context/owner, czytelny magazyn; aktualne domeny LOCAL-FIRST obecne i poprawne. Brak starych `originals` uniemożliwia ich porównanie, ale nie dowodzi utraty aktualnych cenników. `cycle-confirmed` nie jest potwierdzeniem ACK konkretnego projektu; `quotaLimitKnown:false` nie dowodzi ani braku, ani przekroczenia quota. Raport nie uzasadnia czyszczenia danych.

## Decyzje znalezione w MD, zamiast ponownego ustalania biznesu

Przeszukano repozytoryjne MD dla zamiany/duplikatów oraz ochrony ofert. Bezpośrednie ustalenia: `BACKUP.md:505`, `tools/reports/wycena-duplicate-offer-guard-v1.md`, `wycena-duplicate-modal-fix-v1.md` i zgodne wpisy archiwów README/DEV/CURRENT_STATE sprzed 31.10.2026. Zamiana ma zachować slot/ID, nazwę i metadane statusu, odświeżając przeliczenie; Anuluj niczego nie zapisuje. Późniejsze CURRENT_STATE/LOCAL_FIRST_ROADMAP wymagają zachowania źródeł, cen, zaakceptowanych treści i niezmiennych rewizji. Nie przyjęto samowolnie nowego ID ani no-op.

## Przyczyny i implementacja

1. **Tab → Zapisz i przejdź.** Handler `tab` ignorował Promise zwracane przez `setActiveTab`. Authority kończyło transakcję podczas oczekiwania dialogu; późniejszy `saveConfirmed` próbował zapisać `fc_projects_v1` poza transakcją. Odtworzono dokładny `LF_ASYNC_TRANSACTION_REQUIRED`. Handler zwraca teraz prawdziwy wynik asynchroniczny; synchroniczne zakładki zachowują dotychczasowe potwierdzenie. Nie zmieniono dialogów ani walidacji. Dodatkowy RED wymuszonego abortu: authority przywracało uiState i CSS, ale render WYCENY zdążył zastąpić DOM edycji. Render zakładki korzysta teraz z istniejącego afterCommit. Ponieważ inne odświeżenia współdzielonego kontenera mogą działać podczas oczekiwania, rollback authority odtwarza także widok przy zmianie zakładki, po przywróceniu RAM/sesji/wierszy. Oryginalny kod błędu pozostaje zachowany; nie potwierdza się nieudanego zapisu.
2. **Duplikat.** `replaceSnapshot` zachowywał ID i biznesową treść, ale odświeżał cztery techniczne czasy: `generatedAt`, `calculationRegister.generatedAt`, `clientOffer.builtAt`, `clientOffer.generatedAt`. Rejestr P0-B traktował to jak niedozwoloną zmianę zamrożonej treści. Prawdziwy UI/Emulator odtworzył `LF_QUOTE_HISTORY_IMMUTABLE`; diagnostyka podała dokładnie te cztery ścieżki.

Jawna zamiana jest oznaczana istniejącym technicznym polem `meta.source=quote-duplicate-refresh`, bez nowego klucza magazynu/migracji. Walidator dopuszcza jedynie to oznaczenie i cztery poprawne, niemalejące czasy ograniczone czasem snapshotu. Porównuje całą pozostałą treść wraz z nieznanymi polami i zachowuje ścisłą równość pinów. Sama zmiana timestampu bez oznaczenia nie wystarcza. Zmiana ceny, linii, źródła, zakresu lub nieznanego pola nadal odmawia. Nie przepisuje się wcześniejszych chronionych obrazów lokalnych, rewizji ani fragmentów Firestore. Poprzednie zaakceptowane wartości i metadane statusu pozostają zachowane; nowy commit to kolejna rewizja istniejącego logicznego slotu.

## Dowody i testy

- Domenowy RED: przy dialogu wyboru `transactionPending:false`, późniejszy zapis odmawia `LF_ASYNC_TRANSACTION_REQUIRED`; po poprawce **14/14 PASS** modułu `application-project-exit-smoke.js`, w tym synchroniczna zakładka, atomowy Exit, draft, abort i handover.
- Rzeczywisty Chromium/Emulator RED: Save i przejdź nie zmienia zakładki, duplikat odmawia na `application-quote-ledger → validateQuoteLedgerChange`. Log `quote-tab-confirmed-red.log` i ścieżki różnic zachowane poza repo.
- Quote proof **5/5 PASS**, z nową kontrolą dozwolonego refresh zaakceptowanej treści i negatywami ceny, linii, źródeł, unknown, oznaczenia oraz błędnych czasów; stare negatywy i promocja pozostają.
- Powiązane regresje nawigacji `room-navigation-view-refresh-smoke.js` **17/17 PASS** i `project-clean-session-navigation-smoke.js` **14/14 PASS**, w tym Anuluj, odmowy, ponowienie oraz stary tryb bez authority.
- Dotychczasowy `wycena-duplicate-offer-guard-smoke.js` PASS: istniejące ID, nazwa i status oraz oddzielny rzeczywisty wariant. Nie zmieniono jego biznesowych asercji.
- Rzeczywisty Chromium/Emulator: **Zapisz i przejdź 1/1 PASS, exit 0, zero skipped**, po poprawce rollbacku: warunek widocznej edycji także przed odmową, dokładne IDB/outbox po wymuszonym abort, prawdziwe ponowienie offline, SIGKILL/restart. Log `quote-tab-final-green.log`.
- Rzeczywista jawna zamiana: **1/1 PASS** w `quote-duplicate-green-tab-dom-red.log`: ten sam ID/nazwa/status/totals/pins, jeden nowy wpis, exact poprzednie protected/revision, niepewny ACK/SIGKILL i drugi profil. Ten przebieg miał równoległy FAIL wyłącznie widoku po abort; nie przedstawiamy całego przebiegu jako PASS. Następna poprawka rollbacku nie zmienia udanej ścieżki zamiany; nie powtarzano jej bez nowego powodu.

Nowe scenariusze mają dwa odrębne obowiązkowe segmenty `tab-save` i `duplicate-replacement`; razem **27 segmentów / 42 przypadki**. Zachowane **36 grup / 229 plików / 260 jednostek smoke**. Pełnego Preflightu lokalnie ani GitHub Actions nie uruchamiano. Źródła skryptów/version/manifest aktualizowane spójnie.

Wczesna diagnostyka testu miała błędny selektor `.choice-box` zamiast rzeczywistego `.confirm-box` oraz próbę otwarcia Projektów bez przejścia na kartę inwestora. Poprawiono setup/selektory; tych timeoutów nie traktujemy jako błędów produkcji ani dowodów PASS. Pierwsza iteracja walidacji uwzględniała dwa czasy; realny ślad ujawnił dodatkowo dwa czasy modelu oferty klienta. Walidacja pozostaje ograniczona do tych wykazanych pól, bez zwiększania timeoutów. Gotowość odbioru drugiego profilu sprawdza konkretną rewizję, po czym pełną głęboką równość danych; kolejność kluczy JSON nie jest dowodem zmiany treści. Nieudana kontrola instalacji SW w pierwszej kopii środowiska wynikała z nieskopiowanego manifestu; skopiowano pełne zmienione źródła i manifest, bez modyfikacji mechanizmu SW.

## Zakres i bramki

Kod: `js/app/ui/actions-register.js`, `js/app/ui/tab-navigation.js`, `js/app/quote/quote-snapshot-store.js`, `sync/local-first-quote-contract.mjs`, `sync/application-authority.mjs`; indeksy, wersje i manifest. Testy: istniejący moduł Exit, SDK proof, rodzic testów P0-B, nowy helper UI; plan/macierz i kontrola pokrycia CI. Dokumentacja: CURRENT_STATE, roadmapa LOCAL-FIRST, BACKUP i ten raport. Bez zmian Rules, IAM, billingu, globalnych danych i cenników.

Status po zakończeniu 22.11.2026: CODE_READY tego pakietu / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING. Pełne CI, realna aktualizacja starego SW do nowego pakietu oraz odbiór telefonu należą do osobnej zatwierdzonej próby; obecne testy używają świeżych profili DEMO. Nie dziedziczyć CI_PASS wcześniejszego wydania. Artefakty w `/tmp/meble-p1.KVrFtN/quote-tab-*.log` i katalogach screenshot/trace wskazanych w logach; dane wyłącznie syntetyczne DEMO. Repozytorium edytowane na Windows; Chromium i istniejące emulatory uruchomione w izolowanej kopii WSL/Linux, bez profilu i danych właściciela. Zgodność wszystkich 520 plików z manifestem kopii testowej potwierdzono przed końcowym uruchomieniem.
