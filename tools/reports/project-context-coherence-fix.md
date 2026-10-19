# Spójność kontekstu WYCENY po PR #64 — 2026-10-19

Baza: GitHub main `431545d364b47ee4d0cf8efed7d9e478d43ebe8d`, drzewo
`9605ffb783bbcf89234bb44f2f663e9f0d9b5c86`. Gałąź `fix/project-context-coherence`.
Osobny checkout, dokładny oryginalny obiekt podpisanego main zweryfikowany po SHA.
Poprzedni checkout naprawy i starszy checkout work nie były modyfikowane.

## Dowody i granica ustaleń

Poprzedni audyt odtworzył wybór obcego `__projectOverride` po przełączeniu inwestora,
odmowę inwestora po konkurencyjnej nawigacji podczas realnego obliczenia oraz kasowanie
świeżego błędu przez uzgadnianie statusu. Sam starszy `fc_project_v1` nie wystarczył do awarii.
Nie wykorzystano danych telefonu jako fixture i nie dołączono prywatnego raportu/ID do repo.

Nowa regresja rzeczywistego komponentu wyboru pokojów potwierdza dodatkowy mechanizm:
obcy projekt nie zawiera wybranego pokoju, więc `filterQuoteableRoomIds` zwraca pustą listę;
`getRoomsSummary` dekoduje pustą listę jako wszystkie aktywne pokoje. Draft i normalizacja
kalkulatora nadal wskazują pojedynczy pokój. Usunięcie obcego źródła eliminuje rozbieżność,
bez zmiany modelu wyboru, nazw przycisków lub UI.

`--baseline` nowego smoke ładuje selektor i shell z dokładnej bazy PR #64 do tego samego
syntetycznego harnessu: **11/17 PASS, 6 FAIL**. Są to kontrolowane porównania tych dwóch
modułów, nie twierdzenie o pełnym baseline aplikacji. Ten sam rozszerzony zestaw po zmianie: **17/17 PASS**, w tym utrata potwierdzenia podczas await.

Nie ustalono, który konkretny producent zmienił kontekst podczas incydentu z Pixela.
Reprodukcje dowodzą mechanizmów mogących wywołać te komunikaty, nie tożsamości całego
incydentu. `runtimeProjectData` w starym raporcie pochodziło z selektora, a dry-run wcześniej
wywoływał naprawę kontekstu; nie były to dowody rzeczywistego RAM w chwili wyjątku.

## Kontrakt po zmianie

1. Aktywny inwestor + wskazany fizyczny projectId + dokładnie jeden zgodny rekord centralny
   określają właściciela RAM. `safeGetProject` zwraca tylko aktywowany obiekt tego właściciela;
   przy niezgodności odmawia. Nie porównuje liczby szafek/pokojów i nie wybiera wyniku `load`.
   Dirty RAM nadal pozostaje draftem; istniejące guardy odmawiają obliczeń/zapisu.
2. Detached override pozostaje dostępny w odizolowanych kontekstach bez aktywnego inwestora,
   fizycznego projektu i sesji. Nie ma produkcyjnej flagi wyłączającej kontrolę właściciela.
3. Kontekst kalkulacji zawiera investorId, projectId, świadek rewizji `fc_projects_v1`, wybrany
   zakres i warunki sesji. Licznik w RAM unieważnia trwający przebieg przy zmianie wskazania
   inwestora/projektu lub zakresu draftu; również powrót do poprzedniego ID nie wskrzesza wyniku.
   Nie powstaje klucz storage ani drugi magazyn projektu.
4. WYCENA sprawdza kontekst przy powrocie z obliczeń, przeliczeniach magazynu, przed mapowaniem
   PCV, po nazwaniu/oknie duplikatu i bezpośrednio przed save/replace. ROZRYS sprawdza go przed
   proofem projektu i po pierwszej granicy asynchronicznej. Guardy geometrii, PCV, provenance,
   rewizji oraz proof kandydata nadal obowiązują; nie ma fallbacku do sukcesu.
5. Render nie uruchamia `repairActiveQuoteContext`. Generowanie i diagnostyka używają nowego
   odczytowego `readActiveQuoteContext`; nazwa legacy pozostaje odczytowym aliasem.
   Otwieranie projektu pozostaje w istniejącym investor runtime/session navigation.
   Reader nie aktywuje projektu, nie zapisuje rewizji, nie sanitizuje draftu ani nie uzdrawia
   źródła inwestora z historii. Nieprawidłowy kontekst odmawia, zachowując dane do jawnego
   otwarcia/odzyskania istniejącą ścieżką. Nie wdrożono nowego mechanizmu odzyskiwania.
6. Nie ma automatycznego relinkowania historii. Zachowane legacy API zwraca
   `HISTORY_RELINK_REQUIRES_REVIEW`, bez zapisu. Stare rekordy i oryginalne ID pozostają
   dostępne pod dotychczasowym właścicielem. Jakiekolwiek przyszłe przepięcie wymaga osobnego
   kontraktu/decyzji; nie jest wykonywane jako migracja albo naprawa renderu.
7. Świeży błąd (również walidacyjny) pozostaje w stanie WYCENY mimo zmiany statusu. Ma właściciela
   wyłącznie w RAM; po przejściu do innego projektu nie jest prezentowany jako jego wynik.
   Stary przebieg nie renderuje swojego zakończenia w nowym widoku. Nowa poprawna kalkulacja
   i świadomy wybór historii nadal zastępują błąd.

## Pliki produkcyjne i zależności

- `js/app/rozrys/rozrys-project-source.js`: jedno źródło aktywnego projektu; kompatybilny
  odizolowany override, bez heurystyki zawartości lub zapisu legacy.
- `js/app/ui/session-navigation.js`: investor/revision/scope/session proof i unieważnianie
  kontekstu w RAM; niepotwierdzony stan sesji odrzuca także wynik po await.
- `js/app/investor/investors-local-repository.js`, `js/app/project/project-store.js`,
  `js/app/quote/quote-offer-store.js`: powiadomienie o zmianie istniejących wskazań/zakresu,
  bez dodatkowego zapisu. Dotychczasowe settery i warunki sesji pozostają obowiązujące.
- `js/app/wycena/wycena-core.js`, `wycena-core-material-plan.js`: kontrola kontekstu przez cały
  rzeczywisty przebieg, w tym optymalizator i ponowne obliczenia z magazynem.
- `js/app/rozrys/rozrys-engine.js`, `rozrys-runner.js`: kontrola przed mapowaniem i po await,
  bez zmiany optymalizatora, geometrii lub sposobów liczenia.
- `js/app/wycena/wycena-context-repair.js`: granica odczytu i brak automatycznego relinku;
  `wycena-diagnostics.js`: odczytowy kontekst zamiast mutującej naprawy;
  `wycena-tab-shell.js`: odczytowy render, ochrona zapisu/duplikatu i trwałość błędu.
- `index.html`, `dev_tests.html`, `js/app/rozrys/rozrys-lazy-manifest.js`: cache-busting
  dokładnie zmienionych assetów (`20261019_project_context`), zachowany load order.
- `tools/firebase-pilot/cloud42-source-pins.json`: SHA zmienionych plików źródłowych i indexu.
  Pakiet operatorski ma inne związanie SHA i wymaga osobnego przeglądu/zgód. Nie zmieniono
  Rules, grantu, loadera, transportu, Auth ani odmowy LIVE.

## Regresje i weryfikacja

Nowe: `tools/project-context-coherence-smoke.js`, `tools/project-context-mobile-browser.js`.
Zaktualizowane kontrakty: `tools/wycena-local-storage-context-repair-smoke.js` (odmowa bez
mutacji zamiast automatycznej naprawy), `js/testing/rozrys/suites/project-stock.js` (jawne
źródło zamiast wymogu wyboru bogatszej kopii). Dotychczasowy mobilny runner zachowuje wszystkie
asercje; czeka na istniejące callbacki przywracania scrolla (do 420 ms), przewija do celu
i sprawdza hit-test widocznego przycisku przed dotykiem; przy FAIL pokazuje pełniejszy kontekst.
Nowy runner potwierdza przyjęcie tapnięcia przez rzeczywisty action registry przed oczekiwaniem
na koniec obliczenia. Nie symuluje sukcesu kalkulatora.

Testy cache-bustingu dostosowano do dokładnych nowych wersji, bez rozluźniania asercji:
`app-dev-smoke`, `project-calculation-adapters-smoke`, `wycena-duplicate-offer-guard-smoke`,
`wycena-generate-action-registry-smoke`, `wycena-generate-single-flow-smoke`,
`wycena-orphan-edit-session-cleanup-smoke`, `wycena-snapshot-clean-store-smoke`.

Wyniki końcowe po zakończeniu wszystkich uruchomień:

- kontekst: **17/17 PASS**; PCV UI: **60/60 PASS**; adaptery: **27/27 PASS**;
- wcześniejsza regresja RAM/save: **12/12 PASS**; multiroom/session safety: PASS;
- dotychczasowy mobilny Chromium: **10/10 PASS, 0 FAIL, 0 SKIP**;
- rozszerzony mobilny Chromium: **10/10 PASS, 0 FAIL, 0 SKIP**;
- końcowy `node tools/preflight.js`: **PRE-FLIGHT PASS**, **561/561** składni,
  **128/128** smoke, **APP 110/110**, **331** skryptów load order; audyty dependency/storage PASS.
  Zmierzony czas końcowego przebiegu: **96,022 s**. Zachowano 4/3/6 arkuszy,
  PCV 16,440 → 17,122 → 18,834 mb i fronty 5,010 → 5,511 mb, z pojedynczym zapasem 10%.

Pierwszy Preflight ujawnił historyczny wymóg mutującego context repair, nowy rodzaj błędu
w scenariuszu duplikatu oraz nieaktualne SHA pakietu. Zachowano stare brzmienie informacji
o ponowieniu kalkulacji i naprawiono przechowanie błędu walidacji. Kolejne dwa FAIL dotyczyły
wyłącznie literalnych wersji zmienionych assetów; kontrole pozostają ścisłe.

Podczas rozbudowy mobilnego runnera odrzucono błędne kroki infrastruktury: `session-save`
bez aktywnej edycji po otwarciu inwestora prowadzi istniejącą ścieżką do home; nie był to
błąd restartu aplikacji. Koordynaty tapnięcia nie mogą pochodzić z trwającego smooth scroll,
a samo `!inFlight` nie dowodzi, że zdarzenie już dotarło. Po wyborze inwestora
runner otwiera rzeczywisty kafelek pokoju: samo activeTab lub ukryty DOM WYCENY nie dowodzą
wejścia do widocznego appView. Żadnego z tych przypadków nie
naprawiano przez zmianę aplikacji lub osłabienie asercji.

## Dane, ograniczenia i Android

Nie zmieniono schematu storage, ID, historycznych cen/ofert, cenników, katalogów, magazynu,
PCV/koloru/dekoru, pojedynczego zapasu 10%, logiki cen lub optymalizatora. Bez resetu/importu,
czyszczenia storage, migracji, automatycznego commit/cancel, Firebase LIVE, Rules/grantów/IAM,
synchronizacji, nowych usług, PR/Ready/merge/Pages. Chromium używa prywatnego syntetycznego
profilu, oryginalnego business markup i kolejności modułów; shell logowania pominięto.
Nie jest to ręczny test telefonu ani pełna produkcyjna sesja Google Auth.

Po osobno zatwierdzonym wydaniu: otworzyć testowego inwestora A, zapisać zmianę szafki,
bez restartu sprawdzić MATERIAŁ/PCV i ROZRYS, wycenić jeden pokój oraz wszystkie pokoje;
porównać zakres/nową historię i nienaruszony zaakceptowany snapshot. Przełączyć A→B→A,
powtórzyć, uruchomić aplikację ponownie i otworzyć A. Przy aktywnej edycji oczekiwać odmowy,
bez automatycznego Zapisz/Anuluj. Przy odmowie zachować istniejący raport Diag, nie resetować
profilu. Incydent Pixela nadal wymaga tej osobnej akceptacji.

## Pełna lista zmienionych plików

- `CLOUD_DATA_REGISTER.md`
- `CLOUD_MIGRATION.md`
- `CURRENT_STATE.md`
- `ROADMAP.md`
- `dev_tests.html`
- `index.html`
- `js/app/investor/investors-local-repository.js`
- `js/app/project/project-store.js`
- `js/app/quote/quote-offer-store.js`
- `js/app/rozrys/rozrys-engine.js`
- `js/app/rozrys/rozrys-lazy-manifest.js`
- `js/app/rozrys/rozrys-project-source.js`
- `js/app/rozrys/rozrys-runner.js`
- `js/app/ui/session-navigation.js`
- `js/app/wycena/wycena-context-repair.js`
- `js/app/wycena/wycena-core-material-plan.js`
- `js/app/wycena/wycena-core.js`
- `js/app/wycena/wycena-diagnostics.js`
- `js/app/wycena/wycena-tab-shell.js`
- `js/testing/rozrys/suites/project-stock.js`
- `tools/app-dev-smoke.js`
- `tools/firebase-pilot/cloud42-source-pins.json`
- `tools/pcv-ram-quote-mobile-browser.js`
- `tools/project-calculation-adapters-smoke.js`
- `tools/project-context-coherence-smoke.js`
- `tools/project-context-mobile-browser.js`
- `tools/reports/project-context-coherence-fix.md`
- `tools/wycena-duplicate-offer-guard-smoke.js`
- `tools/wycena-generate-action-registry-smoke.js`
- `tools/wycena-generate-single-flow-smoke.js`
- `tools/wycena-local-storage-context-repair-smoke.js`
- `tools/wycena-orphan-edit-session-cleanup-smoke.js`
- `tools/wycena-snapshot-clean-store-smoke.js`
