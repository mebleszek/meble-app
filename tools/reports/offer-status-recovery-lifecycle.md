# WYCENA — odzyskiwanie operacji i cykl ofert po PR #65

Baza: GitHub main `0ae7d1a24091d4a57460bacc9d30b9ea386f5b35`, PR #65 MERGED,
identyczne drzewo `b5eda0dd8b85a57c9e1ff7e86afa496b3f71e387` jak zatwierdzona poprawka kontekstu.
Gałąź: `fix/offer-status-recovery-lifecycle`, osobny checkout od dokładnego podpisanego obiektu main.
Nie wycofano PR #65. Właściciel potwierdził publikację; ten pakiet nie wykonuje nowego wydania.

## Potwierdzone przyczyny

1. `investorsModel.normalizeRoom()` dodaje `lastManualProjectStatus: ''` do odczytanej kopii.
   `roomRegistryDefinitions.normalizeRoomDef()` definiuje `legacy: false` dla zwykłego pokoju.
   `projectStatusSync.persistStatusPlan()` scala tę definicję z pokojem inwestora i porównywał
   całe obiekty przez JSON, więc sama normalizacja tworzyła `mirrorChanges` i trwałą intencję.
   `projectDomainOperations.mergeRows()` następnie porównywał te kopie z surowym rekordem,
   który nie miał obu opcjonalnych pól. Nie odpowiadał on ani before, ani after: odzyskiwanie odmawiało.
2. Ta sama ścieżka zapisywała intencję także wtedy, gdy status, historia i wszystkie wartości
   biznesowe pozostawały identyczne. Samo `beforeStatus === afterStatus` nie dowodzi jednak braku
   operacji: akceptacja lub zmiana zakresu może wymagać zmiany historii i luster bez zmiany agregatu.
3. Zakończenie odzyskiwania nie odczytywało ponownie wszystkich celów po ostatnim zapisie.
   Test z rzeczywistymi modułami zmienił historię po zapisie lustra; baza zwróciła sukces i usunęła
   intencję mimo innego stanu historii. Po poprawce pozostawia intencję i nowszą historię.
4. Odczyt modelowy może odtworzyć pusty pokój z roomDefs. Nie stanowi to potwierdzenia istnienia
   fizycznego celu starej operacji. Odzyskiwanie sprawdza również surowy rekord przed zapisami.

Nie użyto prywatnego eksportu ani jego sekretów/identyfikatorów. Opisany kształt danych
odtworzono syntetycznie, w tym osobno profil 6 projektów / 4 inwestorów / 11 snapshotów /
12 draftów i aktywny projekt 8+1+1. Test mobilny ma natywne fronty i projektowe PCV.
Pierwsza reprodukcja na niezmienionym main utworzyła dokładnie opisaną intencję v1:
0 zmian historii, 1 lustro, 1 status, nowy → nowy; rzeczywisty recoverProject odmówił po restarcie.

## Minimalny kontrakt naprawy

Produkcja: tylko `project-domain-operations.js` i `project-status-sync.js`.

- Porównanie luster uzupełnia do porównania wyłącznie brak `lastManualProjectStatus` wartością
  `''` i brak `legacy` wartością `false`, zgodnie z istniejącymi modelami. Nie utrwala tych wartości
  tylko po to, aby ujednolicić zapis. Kolejność pól obiektu nie jest różnicą wartości.
- Nie używa pełnej normalizacji inwestora jako porównania: nie usuwa nieznanych pól.
  Zmiana nazwy, etykiety, typu, statusu, ręcznego statusu, legacy=true, null lub nieznanego pola
  pozostaje konfliktem. Snapshoty nadal mają dotychczasowe ścisłe porównanie i ochronę kalkulacji.
- Nowa intencja jest pomijana tylko przy braku zmian historii, luster, pokojów oraz obu agregatów.
  Istniejąca intencja jest sprawdzana przed tą decyzją i nadal wymaga recoverProject.
- Stare operacje v1 pozostają obsługiwane bez migracji. Najpierw weryfikowane są właściciel,
  fizyczne pokoje, wszystkie pozostałe cele, sesja i bieżące wartości; stosowane są wyłącznie
  jeszcze niewykonane zmiany. Nie ma rollbacku ani nadpisywania konfliktu nowszych danych.
- Po zapisach następuje ponowny odczyt historii, inwestora i projektu. Dopiero potwierdzone cele
  pozwalają usunąć intencję przez istniejący confirmed/CAS write z read-back.
- Kolejne odzyskanie zakończonej operacji nie zapisuje niczego. Błąd zapisu, brak potwierdzenia,
  uszkodzony format, aktywna sesja i duplikaty to odmowa z zachowaniem trwałej intencji.

To nadal lokalny wieloetapowy protokół oparty na localStorage, a nie transakcja kilku kluczy.
Nie dodano nowej architektury ani gwarancji atomowości między kartami/przyszłymi urządzeniami.

## Pełny cykl i obowiązujące reguły

Potwierdzone poprawne zachowania, bez nowych reguł biznesowych:

- Nowa oferta jest osobnym snapshotem; historyczne linie, wartości, zakres i model klienta
  pozostają zamrożone. Nowy projekt/zakres wymaga aktualnego kontekstu i proof PCV.
- Utworzenie wstępnej nie oznacza akceptacji. Jej jawna akceptacja prowadzi do Pomiaru.
  Konwersja do końcowej jest jawną istniejącą operacją na tym samym ID; kalkulacja nie jest
  powtarzana. Uzgodnione pola etapu/nazwy mogą się zmienić w tej jawnej konwersji.
- Końcowa akceptacja daje Zaakceptowany. Umowa/Produkcja/Montaż/Zakończone są chronione
  przez istniejące warunki zaakceptowanej końcowej oferty dla właściwego zakresu.
- Wstępna wycena nie jest dowolnym ręcznym statusem w Inwestorze. Pomiar/Wycena mogą istnieć
  bez oferty wstępnej. Nie zmieniono rang ani przejść.
- A, B, A+B i kolejne wersje zachowują własne zakresy. Zastąpienie pokrywającej się akceptacji
  zmienia dopuszczone metadane selekcji/odrzucenia, nie archiwalną kalkulację. Zwolniony pokój
  wraca do swojej historii/ręcznego etapu; rozłączny zaakceptowany pokój jest zachowany.
- UI nie pozwala ponownie zaakceptować odrzuconego snapshotu. Test nie omija tej zasady
  wewnętrznym API: sprawdza odmowę w UI i akceptuje nowy, rzeczywiście obliczony wariant B.
- Agregat statusowy jest istniejącym lustrem ostatniej operacji exact-scope; nie oznacza
  automatycznie etapu całego inwestora. Agregacja w jawnym zakresie używa istniejących rang.
  Nie zastąpiono tego kontraktu arbitralnym statusem wszystkich pokojów.

Nie stwierdzono nowej usterki matematyki, źródła projektu, PCV lub wariantów poza potwierdzonymi
błędami trwałej operacji. Nie ustalono historii wszystkich zdarzeń z Pixela ani innych możliwych
różnic prywatnego profilu. Inna sprzeczna wartość nadal ma zatrzymać odzyskiwanie, nie zostać
uznana za normalizację. Nie pozostaje nowa decyzja biznesowa konieczna do tej naprawy.

## Testy i infrastruktura

- `tools/offer-status-recovery-smoke.js`: **22/22 PASS**. Stara intencja, opcjonalne pola,
  istotne konflikty, null/unknown fields, kolejność kluczy, wszystkie fazy częściowego zapisu,
  ponowienie/restart, brak historii, brak fizycznego pokoju, duplikaty, sesja niepotwierdzona,
  no-op bez zapisów i syntetyczny pełny profil o opisanych liczbach.
- `--baseline`: **15/22 PASS, 7 FAIL** na dokładnych modułach domain/status/snapshot-flow z main.
  To porównanie tych modułów w tym samym harnessie, nie pełny baseline całej aplikacji.
- `tools/wycena-full-contracts-smoke.js`: **113/113 PASS**. Uruchamia wszystkie istniejące
  kontrakty, a nie tylko mały podzbiór APP. Wchodzi automatycznie do Preflight.
- Początkowe 14 FAIL pełnego zestawu dotyczyły starych fixture'ów bez właściciela RAM, z różnymi
  investorId w snapshotach lub kalkulacjami bez aktualnego kontraktu PCV. Poprawiono przygotowanie
  danych, nie guardy. Historyczne testy nie uruchamiają aktywacji/migracji projektu przy wyborze
  właściciela; nowe kalkulacje jawnie aktywują natywny projekt z prawidłową geometrią.
  Dwa stare mocki formatek zastąpiono natywnymi formatkami i kontrolą roomId, materiału oraz ilości.
  Zachowano komplet 113 kontraktów, kontrole odmów, historii i zakresów.
- Celowane: PCV UI **60/60**, nawigacja/domain **35/35**, kontekst PR #65 **17/17**,
  historia/sesje **7/7**, APP **110/110**, multiroom/session safety PASS.
- Mobilny `tools/project-context-mobile-browser.js --offer-lifecycle`: **16/16 PASS, 0 FAIL, 0 SKIP**.
  Rzeczywiste touch/action registry, kalkulator, zapis, akceptacja z modalem, warianty,
  konwersja, statusy, usunięcie wyłącznie testowej oferty, A→B→A i restart. Dane syntetyczne,
  oryginalny business markup/load order; brak produkcyjnego origin i logowania Google.
- Standardowy mobilny kontekst: **10/10 PASS**; mobilny RAM/PCV: **10/10 PASS**.
  Łącznie trzy jawne przebiegi Chromium: **36/36 PASS, 0 FAIL, 0 SKIP**.
- Końcowy `node tools/preflight.js`: **PRE-FLIGHT PASS**, **563/563** składni, **130/130** smoke,
  load order **331**, dependency/storage PASS (412 domenowych JS; 342 referencje / 42 pliki).
  Czas **116,077 s**. Zachowano 4/3/6 arkuszy, PCV 16,440 → 17,122 → 18,834 mb,
  fronty 5,010 → 5,511 mb i pojedynczy zapas 10%.

Zmienione assety mają dokładny cache-busting `20261019_offer_status_recovery` w index/dev_tests.
SHA źródeł nieaktywnego pakietu CLOUD-4.2 zaktualizowano bez zmiany loadera, transportu,
Rules lub uprawnień. Ich nowe wiązanie wymaga osobnego przeglądu przed przyszłym LIVE.

## Nietknięte i granice akceptacji

Bez prywatnego eksportu, importu/resetu/migracji, ręcznego usuwania blokady z telefonu,
zmiany UI, cen, optymalizatora, globalnych katalogów/magazynu/ustawień, Zapisz/Anuluj,
sesji, proof PCV lub napraw kontekstu PR #65. Bez Firebase LIVE, Rules, grantów, IAM,
PR/Draft/Ready, merge lub Pages. Docelowy autorytet projektu pozostaje ten sam.

Po osobno zatwierdzonym wydaniu na Pixelu: uruchomić istniejący profil bez resetu/importu,
otworzyć testowy projekt i sprawdzić odzyskanie operacji; zapisać zmianę szafki i bez restartu
sprawdzić MATERIAŁ/PCV, ROZRYS oraz ofertę jednego i wszystkich pokojów. Utworzyć i zaakceptować
wstępną, jawnie przekształcić ją w końcową, porównać A/B/A+B i stare wartości. Przejść do późnego
statusu tylko we właściwym pokoju, przełączyć inwestora i uruchomić aplikację ponownie.
Przy odmowie zachować diagnostykę i eksport prywatnie; nie czyścić intencji lub storage.
Test syntetyczny nie zastępuje tej akceptacji prywatnego profilu.

## Pełna lista zmienionych plików

- `BACKUP.md`
- `CLOUD_MIGRATION.md`
- `CURRENT_STATE.md`
- `ROADMAP.md`
- `dev_tests.html`
- `index.html`
- `js/app/project/project-domain-operations.js`
- `js/app/project/project-status-sync.js`
- `js/testing/wycena/fixtures.js`
- `js/testing/wycena/suites/architecture-contract.js`
- `js/testing/wycena/suites/core-offer-basics.js`
- `js/testing/wycena/suites/core-offer-workflow.js`
- `js/testing/wycena/suites/cross-systems.js`
- `js/testing/wycena/suites/scope-entry.js`
- `js/testing/wycena/suites/snapshot-scope-contract.js`
- `tools/firebase-pilot/cloud42-source-pins.json`
- `tools/offer-status-recovery-smoke.js`
- `tools/project-context-mobile-browser.js`
- `tools/reports/offer-status-recovery-lifecycle.md`
- `tools/wycena-full-contracts-smoke.js`
