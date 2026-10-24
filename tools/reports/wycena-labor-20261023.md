# WYCENA-LABOR — raport implementacji 23.10.2026

## Domknięcie audytu półek — 24.10.2026

Na wejściowym HEAD `9eb360085284d5a27e472a32202ee7c97f9f5c67` potwierdzono błąd: prywatny warsztatowy pakiet `shelf.count` blokował niezależne `labor_shelves_place`, bez przypisania i z ręcznym przypisaniem. Dla 2 półek zamiast 7 min / 29,17 zł (250 zł/h) powstawała pozycja `automatic-blocked` z zerową kwotą. Nowa regresja nie przechodziła przed poprawką.

Minimalna naprawa usuwa osadzenie u klienta z grupy kolizji warsztatowego pakietu. Konflikt obu wariantów wiercenia pozostaje audytowany; prywatna norma i ręczna ilość/notatka nie są przepisywane. Regresja sprawdza 6 przypadków: półki regulowane/nieregulowane × brak przypisania/przypisanie przy szafce/przypisanie ofertowe. We wszystkich osadzenie zachowuje automatyczne naliczenie, ilość 2, 7 min i stawkę montażową 250 zł/h; prywatny wpis ręczny przy szafce zachowuje 3 × 45 min / 337,50 zł stawki warsztatowej.

Celowana diagnostyka: nowa grupa (6 przypadków) PASS oraz istniejąca grupa prywatnych konfliktów/zastąpień PASS. Składnia trzech zmienionych JS: 3/3 PASS; dokładne wersje obu loaderów i kontrola diffu PASS. Zmieniono tylko runtime robocizny, jego regresję, niezbędny cache-busting w obu HTML/walidatorze oraz powiązany rejestr i ten raport. Bez zmian chmury, workflow i pozostałych reguł. Pełne CI pozostaje **CI_PENDING**, wydanie **RELEASE_BLOCKED**, Firebase **LIVE_BLOCKED**. Końcowe HEAD jest w raporcie przekazania.


## Aktualizacja 24.10.2026 — WYCENA-LABOR-REPAIR + CLOUD-CI

Zatwierdzono implementację całego pakietu i push istniejącej gałęzi, bez nowej próby wydania. Wejściowy HEAD `6870158361e926551305bedb6a7c348d952a27b5`; BASE/main `306f90a4cfd8bcb4277aa8b4d140e911493ddd60`. Worktree `/workspace/wycena-labor`, gałąź `feat/wycena-labor-20261023`, istniejący PR #79. Końcowe SHA/push/clean są w raporcie przekazania, aby plik nie zapisywał własnego SHA.

Stan pakietu naprawczego: **CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Poprzednie CI #1239 (run 40076185173, job 120819913675) miało 598/598 składnia, 333 load order i 131/147 smoke, SDK/Rules SKIPPED. Nie jest dowodem jakości nowego kodu; nie ponawiano CI.

### Naprawy i kompatybilność

- Transport: zachowanie obu ID i źródłowych cen, efektywne prywatne 5 zł/km przy nieedytowanym systemowym zerze, pierwszeństwo jawnej edycji systemowej (również 0), zachowanie ręcznych przypisań, STOP przy konkurencyjnych stawkach. Brak ogólnego scalania po nazwie; wyłączenie automatu i brak trasy nie uruchamiają wyceny ponownie.
- `startQty`: brak/null/pusty zapis → historyczne 1; jawne 0 → 0. Stara norma n=1, 150 zł/h → 15 min / 37,50 zł; nowa 5+1×4 → 9 min. Bez migracji lub zapisów przy odczycie.
- Brak produktu nóg/zawieszek: puste ID/symbol, zachowana ilość i wymaganie, ostrzeżenia o dopasowaniu/cenie; dopasowany produkt zachowuje realne dane katalogowe. Bez zmiany preferencji producentów i dopasowania zawiasów.
- Konkurujące prywatne/systemowe automaty tej samej roli: zerowe pozycje `automatic-blocked` i STOP z ID w centralnym audycie. Jednoznaczne ręczne przypisanie zastępuje odpowiadające automaty. Wieloznaczne role pozostają konfliktem; niezależne operacje zachowują naliczenie. Rekordy prywatne, ilości, czasy, notatki i ręczne przypisania nie są przepisywane.
- Osiem starych asercji dostosowano do zachowania 45 min, wersji derivedFacts i loaderów oraz agregacji samych zawiasów. Jedna linia z 4 zawiasami nie koliduje z osobną linią 4 nóg. `script-versions.js` wymaga dokładnych wersji i pojedynczych wpisów w obu HTML oraz zgodności API; nie dopuszcza brakującego parametru, starych wersji ani ich mieszania.
- Normy z 23.10, struktura danych, zamrożone oferty, offline/Zapisz/Anuluj, ROZRYS/PCV/magazyn i rzeczywisty CLOUD-SYNC pozostają bez zmian. Nowy SDK scenariusz rozszerzono o odtworzenie starego `startQty`; jego wykonanie jest CI_PENDING.

### Regresje i wykonane kontrole

Celowana diagnostyka na syntetycznych danych, nie pełne lokalne CI:

- transport: PASS — 5 zł/km, prywatne/ręczne ID i ilość, oba edytowane zera, konflikt, niezmieniony katalog, brak trasy i wyłączenie;
- kompatybilność: 4 grupy PASS — siedem trybów/zero, brak/null/pusty/jawne zero startQty i negatywne wersje loaderów, rzeczywisty formularz 45 min/Anuluj, zamknięty roundtrip CLOUD-3 bez zapisów;
- trzy wybrane grupy norm: PASS — nierówne fronty 4+2 z poprawnymi różnymi technologiami i podziałem TIP-ON, pusty zbiór, prywatne/legacy konflikty i ręczne zastąpienia, brakujące i poprawne produkty nóg/zawieszek;
- nowa granica CLOUD: PASS — 425 pinów BASE, przypisanie SDK, odrzucenie niewłaściwego SHA/izolacji, odmowa aktualnego kodu dokładnym SOURCE_CHANGED, brak zdalnego I/O/zapisów, nieaktywna produkcja, odrzucenie niepełnego lub pominiętego TAP i oczyszczenie środowiska;
- składnia zmienionych JS/MJS: **21/21 PASS**; kontrola diffu oraz składnia YAML/shell workflow: **PASS**.

Pierwsze wykonanie rozszerzonego roundtripu ujawniło powielone ID dodanych fixture. Nadano im odrębne syntetyczne ID; kontraktu GLOBAL_DUPLICATE_ID nie osłabiano.

Nie uruchomiono pełnego Preflightu, historycznych zestawów smoke, emulatorów/SDK/Rules ani Chromium. Osiem poprawionych starych skryptów i pozostałe regresje mają pełne wykonanie przypisane GitHub Actions. Historia/backup na rzeczywistych danych właściciela oraz ergonomia fizycznego Android/Windows nie uzyskują PASS z danych syntetycznych.

### CLOUD/CI — dwa jawne konteksty

[Procedura, SHA, przypisanie wszystkich zestawów i granice](cloud-ci-contexts.md). Historyczny dowód: kompletny, odizolowany checkout `306f90a4cfd8bcb4277aa8b4d140e911493ddd60`, 425 oryginalnych pinów. Siedem smoke i trzy zestawy emulatorowe C/D/E wykonuje się tylko tam. Wszystkie pozostałe smoke i osiem pozostałych zestawów SDK (w tym CLOUD-SYNC/WYCENA-LABOR) dotyczą aktualnego checkoutu. Raport rozdziela SHA zdarzenia HEAD/BASE, faktyczny merge testowy i historyczny commit.

Żaden dotychczasowy zestaw SDK nie został pominięty. Niezmienione package.json/lockfile i oryginalne testy są kontrolowane; nieprzypisany zestaw, brak historii, brudne drzewo lub złe SHA powodują FAIL. Dwa procesy Emulator Suite używają wyłącznie demo/loopback, bez odziedziczonych danych produkcyjnych, z osobnymi pustymi ustawieniami CLI. PASS wymaga pełnego TAP bez skip/cancel/todo. Historyczny PASS nie otwiera autoryzacji bieżących źródeł. Podpisy, hashe/piny, manifesty CAS/integralności, Rules i bramki LIVE nie zostały zmienione.

Nie zmieniono zdarzeń wydaniowych, auto-merge ani kontroli Pages. SDK pozostaje obowiązkowe i jest podejmowane po przygotowaniu kontekstów także przy FAIL smoke. Push na tę gałąź nie jest nową próbą wydania. Potrzebna jest osobna zgoda na konkretne nowe HEAD/BASE i próbę w istniejącym PR #79.

### Pliki pakietu naprawczego

- `.github/workflows/preflight-js.yml`
- `QUOTE_CALCULATION_REGISTER.md`
- `dev_tests.html`
- `index.html`
- `js/app/pricing/labor-catalog.js`
- `js/app/wycena/wycena-core-labor.js`
- `js/app/wycena/wycena-core-lines.js`
- `js/app/wycena/wycena-core-offer.js`
- `tools/app-dev-smoke.js`
- `tools/cabinet-derived-facts-cache-smoke.js`
- `tools/cloud-ci-context.js`
- `tools/cloud-ci-current-boundary-smoke.js`
- `tools/cloud-ci-emulators.js`
- `tools/firebase-pilot/cloud-sync-global.test.mjs`
- `tools/labor-appliance-category-clean-rebase-smoke.js`
- `tools/preflight.js`
- `tools/pricing-modes-calculation-coverage-smoke.js`
- `tools/project-design-parts-smoke.js`
- `tools/project-recalculate-smoke.js`
- `tools/reports/cloud-ci-contexts.md`
- `tools/reports/wycena-labor-20261023.md`
- `tools/script-versions.js`
- `tools/transport-catalog-quote-fix-smoke.js`
- `tools/wycena-hinge-requirement-override-smoke.js`
- `tools/wycena-labor-compatibility-smoke.js`
- `tools/wycena-labor-norms-smoke.js`
- `tools/wycena-snapshot-clean-store-smoke.js`

## Pierwotny raport implementacji — stan sprzed PR #79 i napraw

Poniższe kontrole i deklaracje historyczne dotyczą pierwotnego pakietu. Aktualny zakres i brakujące dowody opisano powyżej.


Gałąź: `feat/wycena-labor-20261023`. Worktree: `/workspace/wycena-labor`.
BASE/main: `306f90a4cfd8bcb4277aa8b4d140e911493ddd60` (scalony CLOUD-SYNC-1 / PR #78).
Końcowy HEAD i stan push/clean są podane w raporcie przekazania; ten plik nie próbuje zapisywać własnego SHA.

Implementacja: **CODE_READY**. Pełna weryfikacja: **CI_PENDING**. Wydanie: niewykonane. Firebase: **LIVE_BLOCKED**.

## Zakres i decyzje

Jedynym źródłem zasad jest [QUOTE_CALCULATION_REGISTER.md](../../QUOTE_CALCULATION_REGISTER.md#2026-10-23--zatwierdzone-normy-wycena-labor), ze wszystkimi normami, jednostkami, źródłami, mapowaniem starych ID, wyłączeniami i kompatybilnością. Właściciel w tej sesji potwierdził domyślne regulowane półki, własne puszki oraz standard wiszącej HDF: 2 własne NUT-y + 2 otwory + 2 podcięcia. Nie ma nierozstrzygniętej decyzji dla tego standardu.

Wdrożono 14 nowych definicji cennika: nóżki, zawieszki, wycięcia HDF, NUT-y, dwa alternatywne pakiety wiercenia półek, osadzenie półek, puszki, dodatkowe rozmierzanie per front, przykręcenie zawiasów/prowadników, próbne założenie, zdjęcie/pakowanie, ponowne założenie i regulację drzwi. Skręcanie 60 min oraz dopłaty szerokości/gabarytoczasu zachowano. Wyniki i źródła trafiają do centralnego rejestru. Przy braku identyfikacji konkretnego frontu powstaje jawny audyt STOP, bez zgadywania rozkładu zawiasów. Niestandardowe konstrukcje HDF nie otrzymują automatycznie obróbek zatwierdzonych dla standardu; pozostają dostępne ręczne ilości tych czynności.

Stare cztery ID nie zmieniają znaczenia ani nie są usuwane. Ich automaty zastępuje jawne mapowanie; ręczne przypisania zachowują normę, ilość i notatkę, zastępując odpowiadające automaty. Audyt pokazuje zastąpienie i naliczone zero automatu. Zastąpienie dotyczy tej samej pracy: dawny montaż frontu zastępuje tylko próbne założenie, a dawny pakiet półek tylko wiercenie; pakowanie/ponowne założenie drzwi i osadzenie półek u klienta nadal są osobnymi czynnościami. Prywatne ID nie są deduplikowane po nazwie. Nowe definicje seedowane są idempotentnie. Wyłączenie nowej definicji nie uruchamia ponownie starego automatu.

## Ochrona danych i izolacja chmury

Przed zmianą sprawdzono GitHub main, otwarte PR i gałęzie oraz rzeczywisty diff PR #78. PR #78 był już scalony; użyto aktualnej bazy, bez pracy w gałęzi/worktree CLOUD-SYNC. Aktualny AGENTS i rejestry pozostają obowiązujące. Nie edytowano CURRENT_STATE, ROADMAP, CLOUD_DATA_REGISTER ani CLOUD_MIGRATION.

Nowe pola `details.additionalLegs`, `hangerCount`, `shelfType`, `hingeDrilling` mają zamknięte walidatory eksportu projektu. Dwie liczby są nieujemne i całkowite; dwa enumy mają po dwie zatwierdzone wartości. Zapis, odczyt i backup korzystają z istniejących mechanizmów. Brak migracji i nowego klucza storage. Stare projekty otrzymują odczyt domyślny bez przepisywania danych. Zachowano Zapisz/Anuluj i istniejący układ; dodano cztery niezbędne kontrolki i pomoc cennika. Zmiana wersji cache faktów oraz cache-busting zmienionych skryptów zapobiega używaniu starych wyliczeń w nowym runtime.

Cennik używa istniejących pól CLOUD-3, w tym już dozwolonego `startQty=0`; nie poszerza się schematu globalnego. Bez zmian synchronizatora, transportu Firebase, CAS, manifestów integralności, Rules i bootstrapu. Do istniejącego emulatorowego testu produktu dodano jeden scenariusz nowych norm. Projekty, prawdziwe dane właściciela i snapshoty nie są migrowane ani synchronizowane przez ten pakiet.

## Kontrole faktycznie wykonane lokalnie

- Celowana diagnostyka `wycena-labor-norms-smoke.js`: **6/6 grup PASS**, obejmujących granice nóżek 20/80 i głębokość 20, AGD i dodatki, wspólny materiał/robociznę, HDF 23 min / plecy 18 mm, progi obu półek, cykl zawiasów/drzwi, TIP-ON, stawki użytkownika, zastąpienia ręczne lokalne i ofertowe, unikalne identyfikatory audytu, idempotencję oraz zachowane normy poza zakresem.
- Celowana diagnostyka `wycena-labor-compatibility-smoke.js`: **3/3 grupy PASS**, rzeczywiste zero w siedmiu trybach, formularz 45 min i `startQty=0`, przełączenie edytowanej pozycji, Anuluj oraz zamknięty roundtrip wszystkich nowych norm CLOUD-3 bez zapisów.
- Celowana diagnostyka `wycena-labor-persistence-smoke.js`: **3/3 grupy PASS**, rzeczywisty formularz draftu/Zapisz/Anuluj, native zapis/odczyt projektu, eksport selektywny i ponowna walidacja payloadu, stare dane, odmowa nieznanych pól i pełny backup/export/import z dokładnym zachowaniem bajtów historii.
- Dodatkowa celowana kontrola zachowania prywatnych pozycji nazwanych jak dawne systemowe AGD: PASS; prywatne ID zachowują ceny i kategorię.
- Pierwsze próby nowej diagnostyki ujawniły braki fixture (`persistUi`, licznik zawiasów) i różnicę prototypów vm w porównaniu testowym. Poprawiono fixture/porównanie bez osłabiania asercji i bez dostosowywania reguł produkcyjnych do testu.
- Składnia zmienionych JS/MJS: **29/29 PASS**; `git diff --check`: PASS. Nie uruchamiano pełnego lokalnego Preflightu ani dawnych pełnych regresji.
- Próby lokalnego Chromium: początkowo blokada `setsockopt`, następnie timeout uruchomienia/rendererów w sandboxie. **Nie jest to PASS UI ani dowód regresji formularza.** Również niezależna pusta strona HTML bez kodu i CSS aplikacji zakończyła się timeoutem bez bajtów DOM; potwierdza to ograniczenie lokalnego uruchomienia Chromium. Test przeglądarkowy jest przygotowany dla CI; fizyczny Android i Windows nie były testowane.

PASS diagnostyki nie jest przypisany do pełnego CI. Wyniki dotyczą odizolowanych danych syntetycznych, nie danych właściciela.

## Rzeczywiste podłączenie CI i brakujące dowody

`.github/workflows/preflight-js.yml` uruchamia po osobno zatwierdzonym Ready:

1. `node tools/preflight.js` → faza automatycznie wykrywa wszystkie `tools/*-smoke.js`, w tym cztery nowe pliki tego pakietu. Repo nie ma `site*.zip`, więc workflow przetestuje bieżący root. Zachowano dawne testy; zmieniono jedynie oczekiwania zastąpionych norm, wersję cache oraz dopuszczono ponowne użycie fixture modala.
2. Nowy `wycena-labor-ui-browser-smoke.js` uruchamia rzeczywiste komponenty DOM/CSS w osobnych profilach Chromium, z rozmiarem/UA Androida i Windows. Testuje czytelne kontrolki, brak wyjścia poza ekran, dwa rodzaje półek, nadpisanie 0, powrót do automatu i pomoc `?`. Wymaga Chrome/Chromium (standardowy obraz Ubuntu GitHub lub jawny `CHROMIUM_PATH`); brak przeglądarki kończy się FAIL, bez skip/PASS. To kontrola komponentów, nie akceptacja na rzeczywistych systemach.
3. Istniejący krok `cd tools/firebase-pilot; npm ci; npm test` obejmuje `cloud-sync-global.test.mjs`, do którego dopisano scenariusz WYCENA-LABOR: rzeczywiste Auth/Firestore SDK i Rules na demo emulatorach, pełny model norm/stawek, 45 min, zero startQty, niezależny odczyt B i brak zmiany bajtów historii/projektów. Dawne 14 scenariuszy zachowano. Lokalnie scenariusz SDK **niewykonany**.

Pełny Preflight, wszystkie regresje domen (MATERIAŁ/WYCENA/ROZRYS/PCV/katalog/magazyn/historia), oba profile przeglądarkowe i cały zestaw SDK/Rules: **CI_PENDING** dla finalnego HEAD/BASE. Nie dziedziczymy PASS z PR #78. Właściciel po osobnym wydaniu sprawdza ergonomię na Androidzie oraz Windows: edycję czterech pól, Anuluj/Zapisz, ponowny odczyt i pomoc cennika. Fizyczna akceptacja jest osobnym brakującym dowodem.

Nie utworzono PR Ready/Draft, nie uruchomiono GitHub Actions, nie scalono do main, nie opublikowano Pages i nie wykonano Firebase LIVE.

## Zmienione pliki

- `QUOTE_CALCULATION_REGISTER.md`
- `dev_tests.html`
- `index.html`
- `js/app/cabinet/cabinet-cutlist.js`
- `js/app/cabinet/cabinet-derived-facts.js`
- `js/app/cabinet/cabinet-hardware-requirements.js`
- `js/app/cabinet/cabinet-modal-draft.js`
- `js/app/cabinet/cabinet-modal-labor.js`
- `js/app/material/price-modal-field-help.js`
- `js/app/material/price-modal-item-form.js`
- `js/app/material/price-modal-list.js`
- `js/app/pricing/labor-catalog-definitions.js`
- `js/app/pricing/labor-catalog.js`
- `js/app/pricing/work-quantity-facts.js`
- `js/app/pricing/work-quantity-sources.js`
- `js/app/project/project-export-contract.js`
- `js/app/quote/quote-calculation-register.js`
- `js/app/quote/quote-snapshot.js`
- `js/app/wycena/wycena-core-labor.js`
- `js/app/wycena/wycena-core-lines.js`
- `tools/cabinet-derived-facts-cache-smoke.js`
- `tools/cabinet-modal-safe-dirty-smoke.js`
- `tools/firebase-pilot/cloud-sync-global.test.mjs`
- `tools/labor-appliance-category-clean-rebase-smoke.js`
- `tools/labor-cabinet-single-accordion-dedupe-smoke.js`
- `tools/labor-quantity-values-link-smoke.js`
- `tools/labor-time-minutes-smoke.js`
- `tools/quote-labor-single-truth-smoke.js`
- `tools/reports/wycena-labor-20261023.md`
- `tools/wycena-labor-compatibility-smoke.js`
- `tools/wycena-labor-norms-smoke.js`
- `tools/wycena-labor-persistence-smoke.js`
- `tools/wycena-labor-ui-browser-smoke.js`
