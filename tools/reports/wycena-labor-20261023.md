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


## 05.11.2026 — PDF 27.10: rozszerzenie istniejącego cennika, etap niezamknięty

Gałąź `feat/labor-pdf-rules-20261105`, BASE/main `8d24f81e14e248f5496e2f450169bfea1000592d`. Zlecenie obejmuje implementację reguł PDF w dotychczasowym modelu cen/czasu, bez zmian UI cennika i RYSUNKU. Identyfikacja PDF i szczegółowy kontrakt: nowy wpis w `QUOTE_CALCULATION_REGISTER.md` (stare ustalenia pozostawiono jako historię).

### Zależności i faktyczne zmiany

- `labor-catalog-definitions.js`: 63 nowe stabilne ID `pdf_*`; zachowano wszystkie 57 dotychczasowych pozycji wraz ze stawkami, starymi normami i ręcznymi przypisaniami. 120 pozycji łącznie, bez nowego trybu kalkulatora albo bloku czasu.
- `work-quantity-sources.js` i `work-quantity-facts.js`: źródła ilości pochodzą z istniejących wymagań podpór, szuflad i AGD. Brak drugiego licznika, bez DOM i nowych zapisów. Generowane wiersze szuflad mają role wyprowadzone z zamkniętego kodu `source`, ponieważ obecny centralny generator pomija `usage`; prywatne jawne wymagania bez danych technicznych odmawiają wyceny etapów z STOP.
- `wycena-core-labor.js` i `wycena-core-lines.js`: AGD korzysta z nowego zestawu etapów wyłącznie w dotychczasowym osobnym dziale, bez równoległego automatu historycznego i bez duplikatu w robociźnie szafki. Ręczne przypisania korzystają z istniejącej kontroli zastępowania. Silnik rozpoznaje odrębne tożsamości nowych operacji w istniejącej kontroli duplikatów. Mapa zastępuje stare automaty dopiero przy obecności następców; stara wybrana ręcznie norma nadal obowiązuje. Nowe łączenie ma własny licznik operacyjny, żeby nie blokować niezależnej prywatnej pracy używającej ogólnego `cabinet.count`.
- Wersje pięciu zmienionych skryptów w obu HTML i rejestrze: `20261105_pdf_labor_v1`. Artefakt fabrycznych 14 domen i manifest offline odtworzono ze źródeł. Nie zmieniono Service Workera, Auth, synchronizacji, cennika materiałów, geometrii, ofert ani zapisu danych właściciela.

### PDF — kompletna mapa zakresu

| Sekcje PDF | Wynik |
|---|---|
| 01–04: model czasu, korpus, podpory, półki, zawiasy | Dotychczasowe normy są zgodne; zachowano 60 min korpusu, pakiety półek, wspólne ilości okuć, HDF/NUT 23 min i stare 45 min. Nie wymuszono przykładowej stawki 240/250. |
| Cykl drzwi | Nowa regulacja 1 min/korpus + 1/zawias (doprecyzowanie właściciela), nie 1/front; ponowne założenie pozostaje niezależne. |
| 05–06: szuflady | Nowe rozbite etapy dla systemowych, skrzynkowych kulkowych/rolkowych i dolnego montażu, zewnętrznych i wewnętrznych. Nie implementowano wyjmowania/wkładania przy rozładunku bez informacji o faktycznym wykonaniu i profilu stawki. |
| 07: klient | Łączenie 5/każdą szafkę także samotną; postawienie 5; warianty wiszące HDF/18; ręczne dodatkowe mocowania i uchwyty. Poziomowanie tylko przy nóżkach lub zawieszkach; stojąca4/6 nóżek daje34/36 min, przy0 poziomowania nie ma. |
| 08–12: cokoły, blendy, blaty, otwory, łączenia | Odłożono automaty zależne od RYSUNKU, partii, odcinków i niewprowadzonych ilości. Robocze osadzanie/szablony nie są zgadywane. Metoda do zatwierdzenia: jawne ręczne ilości operacji w obecnym cenniku, bez nowego UI. |
| 13–15: cargo, mechanizmy, podnośniki | Właściciel określił warsztatowy profil cargo i instalacji podnośników. Cargo: zamknięte normy17/60/90 przez ręczne ilości obecnego edytora, bez zgadywania wyposażenia. HK-XS/HK-S/HK top korzystają z bieżącego doboru AVENTOS i pełnego cyklu jednoznacznego frontu; HF/HSiHL robocze jednostki pozostają odłożone, bez wymyślania norm. |
| 16–17: AGD | Zmywarka 30 + 45/front, piekarnik 15+15, mikrofala 5+30. Lodówka wymaga zamknięcia jednostki regulacji; model płyty nie rozróżnia potwierdzonego gazu/indukcji. Okap zatwierdzony150 min warsztatowych: korpus60 + dodatkowe60 + osobne przygotowanie30. Bez hydrauliki i podłączeń elektrycznych. |
| LED / końcowe otwarte ustalenia | W/M ustalone przez właściciela; implementację LED wyraźnie odłożono do RYSUNKU i zapisano w ROADMAP. Pomocnik/ekipa i równoległe sprzątanie bez zmian. |

### Doprecyzowania właściciela i aktywacja istniejącego cennika

Właściciel potwierdził: okap150 min (oddzielne30 przygotowania), bez poziomowania korpusów bez nóżek/zawieszek i bez podkładania; cargo montuje na warsztacie, podnośniki również, a cykl frontu dzieli na warsztat/klienta. Frezowanie/lutowanie/profil/wklejanie LED jest warsztatowe; dopasowanie panelu i podłączenia u klienta montażowe. LED nie implementować teraz, plan wraz z przyszłymi małymi regulatorami meblowymi zapisano w ROADMAP.

Obecny cennik jest fabryczny, bez edycji właściciela. Nie wdrożono ukrytej migracji przy logowaniu, zapisu przy renderowaniu ani drugiego cennika. Istniejący `catalogStore.savePriceList('quoteRates', list)` już wywołuje `ensureDefaultDefinitions()`, zatem świadomy zapis w obecnym edytorze dopisuje brakujące ID. Po osobnym wydaniu: otworzyć istniejącą czynność w CENNIKU CZYNNOŚCI i zapisać bez zmiany ceny; następnie sprawdzić nowe pozycje i WYCENĘ. Jest to propozycja użycia istniejącego mechanizmu, nie wykonany zapis na Pixelu. Test przypina idempotencję, zachowanie57 cen/norm/ID i pozostałych pól (wynik finalnego wykonania odnotowano poniżej). Dotychczasowy normalizator nadaje znacznik `priceUserEditedAt` czterem starym ręcznym usługom z `starterPrice:false`; test przypina dokładną datę i dokładnie te4 ID, zamiast udawać pełną identyczność RAW. Kwoty i normy pozostają niezmienione. Rzeczywistego zapisu w LOCAL-FIRST ani tej czynności właściciela nie oznaczamy jako zweryfikowanych testem samego normalizatora.

HK-XS: centralna liczba jego zawiasów jest przypisana do jednego potwierdzonego frontu (wymagania pomocnicze nie mają `doorKey`); w tym jedynym jednoznacznym przypadku obowiązuje zwykły cykl puszek, zawiasów, próby, pakowania, ponownego założenia i regulacji. Dwa fronty lub brak potwierdzonego doboru podnośnika nie są rozstrzygane automatycznie. HK-S/HK top: faktyczna liczba mechanizmów z AVENTOS, komplet przygotowanie5+montaż15, osobne pakowanie5, założenie1+mechanizmy, szczeliny1+mechanizmy i siła5 na jeden front. Ręczny stary montaż podnośnika zastępuje instalację, nie niezależne prace u klienta. Nie włączono HKi ani nie zamknięto roboczych HF/HS/HL i jednostki frontu łamanego bez decyzji.

### Faktycznie wykonane kontrole celowane

Dane wyłącznie syntetyczne, stan roboczy tej gałęzi (nie PASS CI dla finalnego SHA):

- `wycena-labor-pdf-smoke.js`: 13 grup PASS. Cztery fronty/8 zawiasów → regulacja9 i niezależne założenie12; brak drzwi0; samotna szafka łączenie5; wiszące24/25; trzy szuflady106/200/172; mieszane wewnętrzne i przygotowania; STOP nieznanych wymagań; ręczne zastępowanie; AGD75/120/30/35 i jego wyłączenie; uchwyty170; zera, bloki i prywatna stawka237.12345.
- `wycena-labor-norms-smoke.js`: 9/9 PASS. Zachowano negatywne asercje konfliktów prywatnych norm; zaktualizowano dokładne oczekiwania nowej regulacji i odrębność jej źródła.
- `wycena-labor-compatibility-smoke.js`: PASS — siedem trybów, zero, historyczne45, formularz/Anuluj, pack/unpack bez zapisu.
- `wycena-labor-persistence-smoke.js`: PASS — zapis parametrów, backup/export/import, historyczne projekty i zamrożone oferty.
- `code-global-catalogs-smoke.js`: 7/7 PASS — pełne validateBundle14 domen, referencje, runtime, generowany katalog, dokładne ID i ceny, RAW bez zmian. Poprawiono oczekiwanie liczby pozycji57→120, zachowując porównanie wszystkich ID ze źródłami.
- `ci-sharding-smoke.js`: PASS — 202 testy, dokładnie7 rozłącznych obowiązkowych grup. Nowa regresja wykrywana przez istniejący Preflight w `.github/workflows/preflight-js.yml`; nie uruchamiano workflow.
- Integralność artefaktu i manifestu, dokładne wersje obu entrypointów, składnia zmienionych JS/MJS i diff: PASS.
- `wycena-labor-ui-browser-smoke.js`: **BLOCKED/FAIL wykonania** — Chromium nie zwrócił DOM w30s. Odczytowy eksperyment CDP potwierdził `chrome-error://chromewebdata/` z komunikatem „Your organization doesn’t allow you to view this site”: polityka zarządzanej przeglądarki blokuje `file://` używany przez istniejący test. Odczyt konfiguracji potwierdził URLBlocklist `*` z ograniczoną allowlistą; polityki nie zmieniono i nie próbowano jej obchodzić. Nie jest to FAIL asercji aplikacji. Pierwsze uruchomienie i diagnostyczny wariant istniejącego `MEBLE_CHROMIUM_SINGLE_PROCESS=1` zakończyły się tym samym deadline. Nie podniesiono timeoutu, nie zmieniono asercji ani UI; nie zadeklarowano PASS Chromium. To nie dowodzi przyczyny biznesowej ani nie potwierdza fizycznego telefonu.
- `quote-exact-calculations-smoke.js`: 83 przypadki PASS. Zachowano porównanie niezmienionych mechanizmów prezentacji/zaokrągleń z BASE; referencje modułu i wiszącej zaktualizowano o jawne nowe minuty łączenia, montażu i korektę regulacji (369.17 / 517.63).
- `labor-appliance-separate-automats-smoke.js` i `labor-appliance-category-clean-rebase-smoke.js`: PASS — osobny dział AGD, sześć etapów zamiast trzech zbiorczych linii, brak duplikatów, wyłączony montaż pominięty i stare normy nadal zachowane. Fixture jawnie zawiera jeden front zmywarki, zamiast zgadywania jego ilości.

**BLOCKED / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING.** Nie jest to kompletny pakiet całego PDF ani dowód aktualizacji katalogu na obecnym Pixelu. Bez Firebase LIVE, PR, Actions, merge i publikacji. Następny ruch: rozstrzygnięcie braku dowodu Chromium i weryfikacja świadomego uzupełnienia cennika przed osobną zgodą wydaniową.

Nie deklarujemy CODE_READY ani wydania przy niezaliczonym teście Chromium. Stan commit/push i dokładny HEAD/BASE podaje raport przekazania; samo zapisanie gałęzi nie jest zgodą na PR ani Actions.

Dodatkowa granica poziomowania: przy jawnym nadpisaniu liczby zawieszek na3 także korpus18 mm dostaje należne5+3 min regulacji, bez uruchamiania szyny HDF; standardowe18 mm bez zawieszek pozostaje25 min. Nie wyłączamy rzeczywistych zawieszek przez sam materiał pleców.

**Zakres dowodu83 przypadków dokładnych obliczeń:** zaliczono we wcześniejszym stanie tego samego pakietu, przed ostatnim dodaniem okapu/poziomowania/podnośników. Nie przypisujemy automatycznie tego PASS końcowemu HEAD; regresja pozostaje obowiązkowo w CI. Końcowe nowe reguły obejmuje `wycena-labor-pdf-smoke.js`, a osobno bieżące normy i generator14 domen.

Końcowy stan roboczy po doprecyzowaniach: `wycena-labor-pdf-smoke.js` **13/13 PASS**, `wycena-labor-norms-smoke.js` **9/9 PASS**, `code-global-catalogs-smoke.js` **7/7 PASS**. Ponowione po ostatnich zmianach powiązane AGD/kompatybilność/persistence PASS. Routing202/7, składnia, manifest, artefakt definicji i wersje PASS. Chromium pozostaje BLOCKED polityką sesji; pełnego CI nie uruchamiano.


## 05.11.2026 — domknięcie Chromium i rzeczywistego zapisu cennika

Wejście `c04441d03a270a97064002e54be03054c76303a5`, ta sama gałąź i BASE `8d24f81e14e248f5496e2f450169bfea1000592d`. Właściciel zatwierdził domknięcie testu przeglądarkowego i całego zapisu cennika w LOCAL-FIRST. Nie powtarzano ogólnego audytu ani pełnego CI.

**Chromium odblokowany bez zmiany polityk:** poprzednia diagnoza była zbyt szeroka: zarządzana przeglądarka blokuje `file://`, ale bieżąca allowlista dopuszcza HTTP/HTTPS. Ten sam komponent i wszystkie asercje podajemy przez lokalny serwer HTTP. Odczyt przez istniejący CDP zastąpił zależność od zakończenia procesu `--dump-dom`; viewport i user-agent ustawiamy przed wywołaniem funkcji testowej. Nie uruchamiano alternatywnej niezarządzanej przeglądarki, nie zmieniano proxy/polityk ani asercji. `wycena-labor-ui-browser-smoke.js`: **Android-size393×851 PASS, Windows-size1280×900 PASS** — istniejące komponenty, diagnostyka anonimowa, brak zapisów diagnostycznych, równania i zamrożone snapshoty.

**Nowa regresja `labor-catalog-local-first-browser-smoke.js`: 7 grup PASS**, rzeczywista IndexedDB i moduły katalogu/formularza/authority/write-boundary/committera. Dane wyłącznie syntetyczne, loopback, dyspozytor akcji `price-item-save`, testowe wejście formularza i testowa bramka właściciela; nie jest to integracja Google Auth ani pełny boot ekranu telefonu. Wartości innych projektów/inwestorów/ofert są nieprzezroczystymi sentinelami — sprawdzamy ich całkowitą niezmienność, nie ich domenową walidację. Sprawdzono:

1. Niezmieniony formularz: handler tylko zamyka, nadal57 norm; **to dowodzi błędności wcześniejszej instrukcji aktywacji „Zapisz bez zmiany”**.
2. Odmowa potwierdzenia rzeczywistej edycji: pełna identyczność czterech store, cache, RAW, RAM i otwartego formularza.
3. Zaobserwowany natywny abort transakcji: nie ma commita częściowego, cache wraca do57 oryginalnych norm, formularz i RAM pozostają.
4. Zaobserwowany `QuotaExceededError` podczas zapisu `control/application`: identyczny rollback i możliwość świadomego ponowienia.
5. Cofnięcie testowej autoryzacji: brak zapisu i zmiany obrazu.
6. Potwierdzony rzeczywisty zapis po syntetycznej edycji nazwy: atomowy CAS wersji aplikacji +1,120 norm, obydwa aliasy labor zgodne, pełne validateBundle14 domen. Wszystkie stare ceny, normy i profile bez zmian; okap z zapisanego katalogu daje150 min. Pozostałe domeny, projekty, inwestorzy, zamrożone oferty, fizyczne RAW, RAM, binding oraz całe replicas/protected/outbox identyczne.
7. SIGKILL i ponowne otwarcie w tym samym profilu: katalog i jego RAW obrazu identyczne z potwierdzonym zapisem, stara kolejka nadal `uncertain`, zero połączeń zewnętrznych i brak fałszywego ACK. Native źródła testowe zostały uprzednio utrwalone przez normalne zamknięcie profilu, żeby test nie utożsamiał niedokończonego bootstrapu localStorage z danymi istniejącej instalacji.

**Odtworzony błąd i minimalna poprawka:** przed poprawką test3 faktycznie abortował transakcję, baza miała57 norm, a cache katalogu120 i nową nazwę. `application-authority.hydrateCatalogs()` pomijał odtworzenie cache, jeżeli nie było repliki globals. W localOnly brak takiej repliki jest prawidłowy, bo lokalny zapis nie tworzy cloud ACK/outboxu. Poprawiono wyłącznie tę przesłankę: w localOnly pełne capture/validateBundle i adoptVerified dotyczą potwierdzonych rows obrazu zarówno po commicie, jak i rollbacku. Gałąź chmurowa zachowuje wcześniejszy wymóg repliki; Auth, writer-fence, CAS i kolejka nie zostały zmienione. `application-authority-store-smoke.js`: **PASS** rzeczywistego IDB/CAS/duplikatu/SIGKILL i odmowy produkcyjnej migracji.

**Pozostała decyzja UI, bez implementacji:** rzeczywisty `saveActivePriceItem()` przy braku edycji wywołuje jedynie zamknięcie, a `updateItemActionState()` ukrywa Zapisz. Nie wolno przedstawiać tego jako działającej aktualizacji katalogu. Zapytano właściciela o minimalny wyjątek: ten sam istniejący Zapisz ma być dostępny również przy brakujących nowych normach, z dotychczasowym świadomym potwierdzeniem i bez zmiany istniejących cen/norm. To zmienia zachowanie interakcji, więc wymaga decyzji zgodnie z zakazem UI właściciela i AGENTS§13. Bez zgody nie wdrożono zmiany, nie proponujemy fikcyjnej edycji ceny ani resetu telefonu.

Routing: **203 aktualne smoke, dokładnie7 obowiązkowych rozłącznych grup**, nowa regresja wykrywana automatycznie przez istniejący Preflight. Kontrole składni/diffu/manifestu i wyniki końcowe w przekazaniu. **BLOCKED / DECISION_PENDING / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING**. Dawne83/13/9/7 PASS norm dotyczą wejściowego pakietu; nie uruchamiano ich ponownie bez zmiany cen/formuł. Bez PR, Actions, Firebase LIVE, publikacji, nowego UI i zapisu na urządzeniu właściciela.


## 05.11.2026 — przywrócenie fabrycznych norm przy starcie LOCAL-FIRST

Wejście `1d97be8fe22a35cd1c33c9babae2dfe749697b9c`, ta sama gałąź i BASE/main `8d24f81e14e248f5496e2f450169bfea1000592d`. Właściciel odrzucił proponowany wyjątek UI Save i zatwierdził analizę/implementację uzupełniania brakujących fabrycznych norm przy ładowaniu, jak dawniej. Wpisy o oczekiwaniu na zgodę UI wyżej są historią; nie stanowią aktualnej blokady ani instrukcji wydania.

**Przyczyna:** legacy `catalog-store.migrateLegacy()` wywołuje `ensureDefaultDefinitions()`, ale chroniony boot nie dopuszcza przepisywania oryginałów, a `adoptVerified()` przywraca dokładny zapisany obraz. Samo dopisanie fabryk do kodu lub cache nie aktualizowało katalogu używanego przez LOCAL-FIRST. Wywołanie całego `ensureDefaultDefinitions()` na istniejących rekordach nie jest bezstratnym rozwiązaniem: funkcja usuwa/scala wybrane stare pozycje i deduplikuje/resetuje nieoznaczone stawki. Wybrano przywrócenie semantyki dopisywania brakujących fabrycznych ID przy starcie, bez przenoszenia tych skutków ubocznych.

**Minimalna implementacja:** `application-authority.missingFactoryLabor()` porównuje dokładne ID z tymi samymi fabrykami godzin/czynności. Wszystkie istniejące rekordy pozostają dokładnie zachowane; tylko nowe definicje przechodzą `normalizeDefinition`. Kandydat przechodzi pełne capture/validateBundle14 domen. Przy czystym localOnly starcie już istniejąca techniczna transakcja inicjalizacji staje się transakcją globals z dopisaniem labor; nie dokładamy drugiego silnika ani drugiego zapisu. Zachowane są kontrole właściciela, oryginalnych RAW, wyłączności i CAS, rozstrzyganie aliasów oraz odtworzenie cache po commicie/rollbacku. Przy kompletnym katalogu pozostaje dotychczasowy checkpoint. Globalny outbox nie jest tworzony i nie ma chmurowego ACK. Żaden kod UI, przycisk, sposób edycji, stawka ani oferta nie został zmieniony. Manifest offline odtworzono dla zmienionego modułu authority.

**Trwały draft:** świadomie pomijamy dopisywanie w gałęzi recovery aktywnej sesji, bo zmiana katalogu podczas odzyskiwania niezapisanej pracy mogłaby zmienić jej punkt odniesienia. Draft i RAM wracają ze starym katalogiem; uzupełnienie nastąpi przy następnym czystym starcie po zakończeniu tej pracy. Bez wymuszonego reloadu lub modyfikowania snapshotu draftu. Cloud runtime nie wykonuje tej lokalnej operacji — jego publikacja/synchronizacja pozostaje odrębnym zatwierdzanym zakresem.

**Celowane dowody bieżącego kodu, syntetyczne dane:**
- `labor-catalog-local-first-browser-smoke.js`: **17 grup PASS**, rzeczywisty Chromium/IndexedDB. Istniejący profil57 norm→120 przed Save, wszystkie stare rekordy dokładnie zachowane, rzeczywisty silnik WYCENY odczytuje nowy katalog i daje150 min okapu. Rzeczywista logika formularza nadal ukrywa Save bez edycji. Zachowano poprzednie próby odmowy/abort/quota/Auth/zapisu/restartu/całych store i dodano osobne profile abortu startu, quota, odebrania dostępu i konkurencyjnego CAS: bez częściowego dopisania, udany kolejny niezależny start. Osobny profil ma nieoznaczoną prywatną stawkę237.12345, nieaktywną starą normę, istniejącą nieaktywną normę PDF i prywatną normę45 min — wszystkie pola pozostają dokładne,121 unikalnych ID, kolejny start idempotentny. Odtworzenie draftu bez zmiany jego baseline i odmowa sprzecznych aliasów bez naprawy. Wszystkie scenariusze bez żądań zewnętrznych, przy niezmienionych replicas/protected/uncertain outbox i fizycznych RAW.
- W jednym wcześniejszym rozszerzonym przebiegu wystąpił `LF_CDP_TIMEOUT` po próbach quota; nie uznano tego za PASS. Dodano etykiety faz diagnostycznych bez zmiany limitów/asercji; końcowy pełny przebieg17 grup PASS. Nie dodano automatycznych retry.
- `android-local-first-browser-smoke.js`: **9 grup PASS** pełnej aplikacji w Chromium: istniejąca odmowa globals i rescue, drugi klient, abort resetu, obca baza bez zmian, trzy szafki z rzeczywistych formularzy, abort zapisu z otwartym formularzem/RAM/4store, receipt/binding/pending, dwa restarty offline i draft/Cancel, pełny inwestor/projekt/WYCENA/zapis/reopen. To izolowana regresja syntetyczna; nie wykonano resetu Pixela.
- `application-replication-readiness-smoke.js`: PASS dotychczasowych granic integracji/Save/immutability/routingu.
- `ci-sharding-smoke.js`: **203/7 PASS**, rozszerzona regresja przypisana dokładnie raz do obowiązkowej grupy7/7 w istniejącym Preflight. Żadnego uruchomienia GitHub Actions ani pełnego lokalnego CI.
- Składnia zmienionych JS/MJS, manifest offline i diff: PASS. Dawne testy samych norm dotyczą poprzednich SHA; nie powtarzano ich bez zmiany cen lub formuł.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING.** Blokada aktywacji starego cennika została usunięta dla czystego startu localOnly; zgoda wydaniowa pozostaje osobna. Gałąź/HEAD/BASE i commit/push/CLEAN w przekazaniu. Nie wykonano operacji Firebase LIVE, PR, Actions, merge, publikacji ani zmian danych właściciela. Po osobnym wydaniu właściciel uruchomi nową wersję na istniejącym profilu bez resetu i edytowania cen; sprawdzi nowe normy i WYCENĘ. Aktywną pracę trzeba najpierw bezpiecznie zakończyć — nie odświeżać niezapisanego formularza w celu przyspieszenia aktualizacji.


## 05.11.2026 — PR #114: dwa FAIL w obowiązkowej grupie7/7

Gałąź bez zmian, wejście `f69d75e3618bb883dd83e908014a8c4519fc35b5`, BASE/main `8d24f81e14e248f5496e2f450169bfea1000592d`. Odczyt GitHuba potwierdził otwarty Ready PR114 i [run42114160062](https://github.com/mebleszek/meble-app/actions/runs/42114160062), job127549351172:48/50 smoke, FAIL dwóch regresji. Pozostałe obowiązkowe grupy PASS dotyczą f69, nie nowego SHA. Auto-merge/Pages SKIPPED, main bez zmiany. Nie utworzono PR, nie komentowano ani nie ponawiano Actions.

**Regulacja — rzeczywiście stare oczekiwanie:** `labor-quantity-values-link` oczekiwał źródła `hinge.door_cycle_count`, ilości6 dla dwóch frontów/czterech zawiasów. Aktualny kontrakt reguluje1 korpus +4 zawiasy, czyli5 min. Zmieniona asercja wymaga jednej linii, źródła `hinge.door_hinge_count` z ilością4, dokładnie5 min i kwoty według250/h. Dodano niezależne sprawdzenie ponownego założenia drzwi z ilością6. Kolejna asercja w tym samym starym teście dotyczyła wycofanego zbiorczego automatu szuflad: obecnie sprawdzamy rzeczywiste3 szuflady/15 min regulacji na miejscu, brak duplikatu starej normy i obowiązkowy STOP/zero wszystkich warsztatowych etapów przy jawnych wymaganiach bez typu szuflady/prowadnic. Zachowano dotychczasowe kontrole źródeł/rejestru/sum, zawiasów i braku UI podglądu.

**RAW — konkretna diagnoza przed zmianą oczekiwań:** w rzeczywistym Chromium zmieniły się wyłącznie `fc_quote_rates_v1` i `fc_services_v1`:57→120,63 nowe ID `pdf_*`, zero zmienionych istniejących rekordów. Sprawdzono również każdy dopisany atrybut, zamiast uznać samą liczbę rekordów za sukces. Ta silniejsza kontrola pokazała istniejący kontrakt legacy: fixture `android-safe-sw-update` świadomie wyłącza produkcyjne wdrożenie LOCAL-FIRST przez `trusted-session-browser`, główny `fc_quote_rates_v1` zachowuje pełne definicje, natomiast `validate.validateServices()` zapisuje historyczny `fc_services_v1` jako `id/category/name/price`. Pełne normy pozostają też w `catalogStore`, z którego czyta WYCENA. Nie porównujemy czteropolowego historycznego RAW do modelu transportu LOCAL-FIRST ani nie naprawiamy przy okazji historycznego walidatora. Native LOCAL-FIRST17 grup przeszło w tym CI, z pełnymi definicjami w autorytatywnym obrazie.

**Nowe ścisłe asercje aktualizacji:** przed opuszczeniem starej karty dotychczasowe pełne porównania RAW/RAM/formularza/controllera pozostają bez zmian. Po uruchomieniu nowej aplikacji wymagamy tej samej listy kluczy RAW i identycznych bajtów każdego innego magazynu. Oba aliasy labor muszą zachować wszystkie stare rekordy i kolejność dokładnie przez JSON.stringify, bez zmiany ceny lub dodatkowego pola; wyłącznie63 brakujące fabryczne ID mogą być dopisane, w dokładnej kolejności i z dokładnymi zatwierdzonymi polami: pełnymi dla `fc_quote_rates_v1`, czteropolowymi dla kompatybilnościowego `fc_services_v1`. Cały historyczny alias musi odpowiadać projekcji głównego katalogu, nie jego pełnemu RAW. Dodatkowa niezależna kontrola cache wymaga wszystkich pełnych pól nowych norm zgodnych z kodowym artefaktem. Zachowano sprawdzenie dokładnej wartości IndexedDB, rzeczywisty offline/restart tego samego profilu,32-sekundową instalację i ręczne gesty. Nie dodano wyjątku „ignoruj klucze cennika” ani normalizacji danych porównywanych po obu stronach.

**Próby negatywne przed przeglądarką:** poprawna transformacja przechodzi; sprawdzanie musi odrzucić zmianę starej ceny, zmianę nowej normy, usunięcie rekordu, dopisanie obcego ID, zmianę projektu, utratę klucza, nowy klucz, niezgodny alias i różnicę RAW aliasu oraz uszkodzoną pełną definicję cache. Każda próba wymaga rzeczywistego ERR_ASSERTION. Pozostałe scenariusze/asercje pozostawiono.

Lokalne próby diagnostyczne wykazały też pojedynczy brak odzyskania zaufania offline; nie uznano go za PASS. Do testu dodano wyłącznie odczytowy, anonimowy stan proof/fence/binding przy takim błędzie. Diagnostyczną próbę dodatkowego Browser.close usunięto: współdzielony helper już wykonuje normalne zamknięcie i drugi close nie jest poprawnym protokołem. Nie zmieniono helpera, Auth, limitów czasu ani zachowania produkcyjnego.

**Końcowe wyniki lokalne, 05.11.2026, na plikach tej poprawki:**

- `node tools/labor-quantity-values-link-smoke.js` — PASS.
- `node tools/android-safe-sw-update-smoke.js` — PASS w rzeczywistym Chromium: instalacja >30 s, active/waiting ACK, stary dokument z niezapisanym RAM, retry/offline, naturalna aktywacja, zimne otwarcie offline tego samego profilu, dokładne RAW i IDB oraz dopisane normy. Wbudowane negatywne mutacje asercji — PASS (odrzucone wszystkie celowe uszkodzenia).
- `node tools/ci-sharding-smoke.js` — PASS: 203 testy/7 rozłącznych obowiązkowych grup; oba poprawiane testy nadal w grupie 7.
- `node --check` obu testów, `node tools/offline-assets.js`, `git diff --check` — PASS. Produkcyjny manifest i wersja bez zmian: poprawka nie zmienia zasobów aplikacji.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING.** Bez pełnego lokalnego CI, ponawiania Actions, zmian Firebase LIVE, manifestu produkcyjnego, cen albo synchronizacji. Nowy HEAD wymaga osobnej zgody wydaniowej; poprzedni run pozostaje CI_FAIL i nie jest wynikiem nowej poprawki.


## 06.11.2026 — zakresy robocizny, dni i wspólny plan

Zgoda wykonawcza właściciela po analizie: gałąź `feat/labor-scope-schedule-20261106`, BASE/main `69515297f8c12af62ed0d16e7f6da5f891366845`. Osobny wybór zakresu zamiast checkboxów: Standardowo, raz/pomieszczenie, raz/wycena, raz/dzień; dla dnia warsztat/montaż/oba. Warunki przed agregacją, sumowanie właściwych ilości, jedna formuła/przygotowanie na zakres; stała czynność bez źródła ilości raz. Stare rekordy bez nowych pól pozostają standardowe i nie są nadpisywane ani migrowane. Jedyna nowa norma fabryczna to `labor_daily_break`: oba etapy, 30 min, stawka warsztatowa. Fabryczny generator ma 121 rekordów robocizny, 14 domen nadal walidowane; istniejący append-only startup dopisuje tylko brakujące ID i nadal odracza operację przy draftach.

`labor-work-plan.js` jest czystą projekcją już obliczonych, warunkowo dopuszczonych czynności i istniejącego kalkulatora cennika. Nie jest drugim magazynem ani silnikiem cen. Kolektory zachowują źródła/warunki/ręczne zastępowanie/STOP. Standardowe pozycje pozostają w swoich działach; nowe zakresy wyjmowane z naliczania przy szafkach i wyceniane tylko raz po agregacji po ID. CZYNNOŚCI pokazują trzy akordeony bieżącego pomieszczenia; wspólne prace są opisane jako agregowane w WYCENIE. WYCENA wywołuje plan przed zbudowaniem rejestru i sum.

Dla etapu: T = czas niecodziennych prac; C = czas właściwych reguł dziennych. Dostępność warsztatu 480−C, montażu 480−C−2×czas trasy. N = ceil(T/dostępność), osobno po sumowaniu wszystkich wybranych pomieszczeń. T=0 daje N=0 bez przerw/wyjazdów/dziennych pozycji. Po N naliczane są dzienne wystąpienia i przejazdy; nigdy nie wracają do T. Przerwa nie ma specjalnego odjęcia ani osobnego dodatkowego naliczenia. Nowa reguła dzienna wpływa na C i koszty bez zmian algorytmu. Ujemna/zerowa dostępność, niepoprawne lub nieskończone czasy i zależność od wyniku dni odmawiają. Jawna dzienna reguła o źródle `transport.duration_hours` odmawia `SCHEDULE_TRAVEL_SCOPE_CONFLICT`, zamiast podwójnie rezerwować dojazd, który już należy do fizycznej dostępności. Nie zgadujemy tej roli po nazwie.

Czas trasy pochodzi z istniejącego Inwestora. Brak/nieaktualna trasa oznacza `BLOCKED` harmonogramu montażu, jawny komunikat i ostrzeżenie w rejestrze; dni i niepotwierdzone koszty dzienne/przejazdów montażowych nie są zgadywane. Pozostałe pozycje wyceny pozostają widoczne; nie oznacza to kompletnej ceny montażu. Istniejące stawki km/startu/limitów na kurs są zachowane i mnożone przez wyjazdy; czas trasy w obie strony. Nie doliczamy nieustalonych osobnych kursów dostawczych. Zwykłe prace o stawce montażowej należą do montażu, pozostałe niepomocnicze przygotowania (także projekt specjalistyczny) do części warsztatowej; stawki ich ceny pozostają własne. Dni nie są mieszane ani kalendarzowo datowane.

Wnoszenie zachowuje normy minut/poziomów/elementów i techniczne informacje o potrzebnych osobach, ale czas ekipy nie jest mnożony przez osoby. Obowiązuje aktualna stawka montażowa obejmująca dwie osoby; dawnego zapisanego pola `helper` w normie nie migrujemy. Dodatkowe godziny trzeciej osoby są ręczne na draftcie oferty, koszt = godziny × aktualna stawka pomocnika, bez zwiększenia czasu/dni standardowej ekipy. Nowy przycisk zapisu godzin jest widoczny dopiero po edycji, znika po potwierdzeniu; awaria zachowuje wpisany RAM.

Zapis zakresów wykorzystuje istniejący zapis cennika/globals; godzin pomocnika — istniejącą transakcję projectHandler. Zachowano właściciela, fence, CAS, abort/quota, outbox, Zapisz/Anuluj. Zmiana godzin unieważnia kontekst obliczenia dopiero po zatwierdzonym commicie. Snapshot zawiera wersję planu, stawki, reguły dzienne, czasy/dni/wyjazdy, godziny pomocnika i pochodzenie zakresów; normalizacja i fingerprint zachowują wynik. Stara oferta bez harmonogramu nie dostaje go z dzisiejszego cennika. Eksport biznesowego projektu, pakowanie integralności i projekcja LOCAL-FIRST zachowują nowy snapshot bez zmian protokołu synchronizacji. Starszy klient z zamkniętym kontraktem globals wymaga aktualizacji przed odczytem nowej rewizji; nie obchodzimy walidacji. Nie uruchomiono Firebase.

Nowe moduły mają rozdzielone obliczenia (`pricing/labor-work-plan`) i prezentację (`wycena-work-plan-view`). Istniejące duże moduły otrzymały tylko metadane/delegację. Uzupełniono listę modułów wspólnych fixture, wersje obu wejść, manifest i wygenerowany artefakt. Routing nowej regresji i obu przeglądarkowych nadal obowiązkowy (204 testy / 7 grup, wszystkie trzy w grupie 7). Nie zmieniono workflow, SW, Auth ani writer-fence. Finalne wyniki i ograniczenia poniżej.


**Faktyczne kontrole celowane (Node 24.19.0, syntetyczne dane):**

- `labor-work-plan-smoke.js`: **19/19 PASS** — ilości/przygotowania, rzeczywiste warunki szafek przed agregacją, zakresy, standardowe rekordy, bieżąca stawka przerwy na obu etapach, nowe reguły dzienne, zero dni, pomocnik bez czasu ekipy, granice, cykle i powielenie czasu przejazdu, transport na kurs, brak trasy, suppression/STOP, wnoszenie, zamknięte 14 domen, zamrożony snapshot, integralność eksportu/projekcja oraz rzeczywista orkiestracja WYCENY przed rejestrem. Brak wspólnego modułu odmawia obliczenia; nie ma cichego powrotu do pomijania harmonogramu.
- `labor-catalog-local-first-browser-smoke.js`: pełny przebieg **19 grup PASS**; następnie celowane `--scope-only` **3 grupy PASS** po uzupełnieniu asercji nowych widoków/pomocnika. Prawdziwy Chromium/IDB: stary profil 57→121, brak zmian starych rekordów, niezmienny RAM/RAW/replicas/protected/uncertain outbox, ukryty nieedytowany Zapisz, odmowa/abort/quota/Auth/CAS/restart/draft/alias refusal; nowe zakresy w rzeczywistym formularzu i commicie, trzy akordeony z rzeczywistym kolektorem, zapis pomocnika przez projectHandler z wywołaniem unieważnienia kontekstu dopiero po commicie, brak unieważnienia przy abort, zachowanie formularza i zimny restart. Bez `--scope-only` wszystkie nowe scenariusze nadal są obowiązkową częścią CI.
- `android-safe-sw-update-smoke.js`: **PASS** real Chromium — stary worker, rzeczywista instalacja >30 s, ACK active/waiting, dotyk/retry/offline, niezapisany RAM starego dokumentu, naturalna aktywacja i zimny start offline; dokładne stare RAW/IDB oraz dokładne 64 nowe fabryczne rekordy (63 PDF + przerwa). Asercje mutacji cen/norm/rekordów/kluczy nadal odrzucają uszkodzenia. Dodano readonly dowód aktywnego, zgodnego fence zaufania PRZED zamknięciem przeglądarki.
- `code-global-catalogs-smoke.js`: **7/7 PASS**; `wycena-labor-pdf-smoke.js`: **13/13 PASS** (liczba 121 uwzględnia nową regułę, dotychczasowe przykłady pozostają bez zmian).
- `quote-exact-calculations-smoke.js`: **83 przypadki PASS**; `project-calculation-adapters-smoke.js`: **27/27 PASS**; `multiroom-calculation-session-safety-smoke.js`: **PASS**, także odmowa aktywnej edycji, zmiana danych w trakcie i niezmienność historii. Dwa cienkie fixture otrzymały rzeczywisty nowy moduł, zamiast stubu omijającego plan.
- `wycena-snapshot-clean-store-smoke.js`, `labor-quantity-values-link-smoke.js`, `carrying-lift-logistics-smoke.js`, `carrying-separate-quote-smoke.js`, `labor-audit-readable-lines-smoke.js`, `czynnosci-manual-time-display-smoke.js`, `czynnosci-project-preparation-smoke.js`, `labor-conditions-editor-preview-smoke.js`, `labor-readable-modes-accordion-smoke.js`, `transport-catalog-quote-fix-smoke.js`: **PASS**. Nieaktualne dwie asercje stawki pomocnika przy wnoszeniu zastąpiono dokładną stawką ekipy 250 i równaniem kosztu; wszystkie testy geometrii, ilości, rozkręcania, frontów, windy i pozostałych stawek zachowano.
- Routing **204/7 PASS**, każdy test dokładnie raz; nowe obliczenia i obie regresje Chromium w grupie 7. Wersje obu wejść, deterministyczny artefakt, manifest, składnia i diff PASS. Kontrola `APPROVED_BASE=69515297f8c12af62ed0d16e7f6da5f891366845 node tools/ci-module-growth.js` — PASS, 27 zmienionych plików JS/MJS, 12 ostrzeżeń o małym przyroście istniejących modułów, 0 blokad; nie dodano wyjątków od bramki monolitów.

**Ograniczenia i przebieg diagnozy:** pierwsze wykonanie aktualizacji odmówiło zimnego startu offline przy brakującym lokalnym znaczniku zaufania (proof/IDB obecne). Nie uznano go za PASS i nie ustalono przyczyny. W kolejnym wykonaniu po dodaniu asercji przed zamknięciem, a następnie po ostatniej zmianie delegacji/kontekstu, cały scenariusz przeszedł. Nie klasyfikujemy wcześniejszego błędu jako naprawionego ani nie zmieniamy Auth/fence; pozostaje jawne ryzyko do obserwacji w CI. Nie zastosowano retry w teście ani nie pominięto żadnego kroku. Początkowe błędy nowych fixture (brak zależności normalizatora snapshotu, komercyjnego kontraktu/projektu lub przekazania projectId) skorygowano po stronie setupu, zachowując rzeczywiste odmowy i asercje.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.** Żadnego pełnego lokalnego CI, Actions, PR, merge, wydania, resetu telefonu ani Firebase LIVE. Po osobno zatwierdzonym wydaniu: na Pixelu bez resetu sprawdzić dwie sale/pomieszczenia, zakres pomieszczenie/wycena i jedno przygotowanie, zwykłą regułę Przerwa w obu etapach, sumowanie dni i wyjazdów, ręczne godziny trzeciej osoby, zapis/offline/restart oraz starą ofertę bez zmiany ceny. Zakresów starych norm nie przełączamy automatycznie — właściciel wybiera je w cenniku.


## 07.11.2026 — minimalna korekta listy skryptów po CI PR #116

Istniejąca gałąź `feat/labor-scope-schedule-20261106`, wejście `5ff11288a81ec23b58a8446720cf78322bf0faf2`, BASE/main `69515297f8c12af62ed0d16e7f6da5f891366845`. Przed pracą potwierdzono lokalne i zdalne SHA oraz czyste drzewo; odczyt PR #116 i [CI #42313650605](https://github.com/mebleszek/meble-app/actions/runs/42313650605) potwierdził zakończoną nieudaną próbę. Job `128221006473` (preflight-static): składnia 719/719 PASS, FAIL porządku skryptów 347/345. Job `128221006533` (shard 5): jedyny FAIL `main-login-smoke.js`, 335/333 elementy manifestu biznesowego. Pozostałe shardy, Firebase CURRENT i CLOUD PASS dla tego wejściowego SHA; merge/Pages SKIPPED. To nie jest CI_PASS nowej poprawki.

Rzeczywista przyczyna: podczas poprzedniego pakietu dodano oba nowe skrypty do HTML i wersjonowania, ale pominięto kanoniczną listę `tools/index-load-groups.js`. Poprawka dodaje dokładnie `js/app/pricing/labor-work-plan.js`, następnie `js/app/wycena/wycena-work-plan-view.js` w `tabs-quote-wycena`, po `wycena-core-labor.js`, przed `wycena-core.js`. Lista znów obejmuje wszystkie 347 skryptów, z 335 biznesowymi; liczników testów nie wpisywano na sztywno i nie zmieniono ich oczekiwań/asercji. Obie istniejące kontrole są już obowiązkowe w CI: audyt kolejności w preflight-static, main-login w shardzie 5. Nie dodano testów odtwarzających implementację ani nowego workflow.

Wykonane wyłącznie kontrole celowane:

- `node tools/check-index-load-groups.js` — **PASS**, kompletność/kolejność/grupy zgodne, `tabs-quote-wycena` ma 66 skryptów.
- `node tools/main-login-smoke.js` — **36/36 PASS**, wraz z kontrolą inertnego manifestu oraz wszystkimi dotychczasowymi odmowami właściciela, dostępu, zapisu i restartu.
- `git diff --check` — **PASS**. Diff obejmuje tylko dwa wpisy konfiguracji oraz CURRENT_STATE.md i niniejszy raport.

Nie powtarzano zakończonych testów obliczeń, Chromium, Firebase ani pełnego CI. Kod produkcyjny, UI, ceny/normy, Auth, SW, writer-fence, manifest i workflow bez zmian. Jeden commit i push na istniejącą gałąź; nowy HEAD i aktualny BASE w przekazaniu po odczycie remote. **CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED**. Nie zmieniano PR, nie ponawiano Actions, nie wydano aplikacji i nie wykonano Firebase LIVE. Wcześniejsze ryzyko odtworzenia zaufania pozostaje opisane w poprzedniej sekcji; nie naprawiano go przy okazji. Nowa próba wydania wymaga osobnej zgody właściciela na nowy HEAD/BASE.


## 07.11.2026 — CI PR #116: utracona odpowiedź Browser.close a dowód wyjścia

Gałąź `feat/labor-scope-schedule-20261106`, wejście `b2eaa8105d69cf498331aa7b95a7e7bc1295622b`, BASE/main `69515297f8c12af62ed0d16e7f6da5f891366845`, SHA i czyste drzewo potwierdzone przed pracą. Odczyt PR potwierdził stan open/Ready, bez merge, a [log joba 128235561918](https://github.com/mebleszek/meble-app/actions/runs/42318050322/job/128235561918) wskazał jedyny FAIL sharda 7 (49/50): `LF_CDP_TIMEOUT [startup-cas:graceful]`. Asercje zaobserwowania CAS, oczekiwanej wersji application, niezmienności innych store/RAW i starego katalogu wykonywane są PRZED przypisaniem tej fazy. Zatem timeout nie był odmową tych asercji ani dowodem błędu danych CAS. Log nie zawierał niezależnego kodu wyjścia procesu z tej próby — nie twierdzimy, że sam log dowodzi naturalnego zakończenia Chromium.

**Potwierdzony błąd mechanizmu testowego:** `gracefulClose()` czekał najpierw na odpowiedź CDP `Browser.close` po połączeniu strony, a dopiero potem na `browser.exited`. Zamykanie przeglądarki może zakończyć transport strony przed otrzymaniem odpowiedzi. Regresja w prawdziwym Chromium celowo wstrzymująca wyłącznie ACK `Browser.close` odtworzyła przed zmianą ten sam `LF_CDP_TIMEOUT`. Nie wstrzymywano samej komendy ani procesu, nie zmieniano Auth, danych czy CAS.

**Minimalna korekta:** w tym samym `tools/helpers/local-first-browser.mjs` helper `waitForOrderlyBrowserExit` wysyła komendę raz i równolegle obserwuje naturalne zakończenie procesu oraz ewentualny błąd CDP. Obowiązuje dotychczasowy limit 20 s, od wysłania do dowodu wyjścia (bez nowego budżetu po ACK). Otrzymanie ACK samo nigdy nie kończy sprawdzania sukcesem. PASS wymaga obiektu wyjścia z `code:0`, bez sygnału i błędu, przed cleanupem; reaping/receipt właścicielskiego supervisora nadal musi się potwierdzić. Brak procesu w terminie, niezerowe wyjście, sygnał/spawn error, jawna odmowa CDP/wysłania i błąd cleanupu odmawiają. Cleanup awaryjny po odmowie nie jest dowodem sukcesu. Równoległe `gracefulClose()` tej samej instancji współdzielą jedną komendę i jeden wynik, bez retry. Nie zmieniono `close()`/`crash()`, supervisora ani innych helperów Auth.

**Celowane dowody wykonania:**

- Przed poprawką: rzeczywisty Chromium z zatrzymanym ACK — **odtworzony FAIL `LF_CDP_TIMEOUT`**.
- `node tools/local-first-browser-close-smoke.js` — **5 grup PASS**. Cztery grupy kontraktu: naturalne wyjście przed cleanupem mimo braku ACK; ACK bez wyjścia oraz brak obu osiągają deadline; niezerowe/sygnał/spawn error/brak statusu nie mogą dać PASS; błędy wysłania/CDP i cleanupu nie są ukrywane. Krótki 5-ms deadline dotyczy wyłącznie sztucznych nierozwiązywalnych obietnic w jednostkowym teście, nie limitu Chromium.
- Piąta grupa powyższego testu: prawdziwy Chromium, dwie celowo zatrzymane odpowiedzi zamknięcia, jedna komenda na instancję, faktyczny naturalny exit, zimne ponowne otwarcie tego samego profilu i dokładne localStorage/control/replicas/protected/outbox, z fazą `uncertain` oraz niezmienioną ceną syntetyczną. To nie samo zamknięcie WebSocket ani force-kill.
- `node tools/labor-catalog-local-first-browser-smoke.js` — **20 grup PASS**, cały dotychczasowy scenariusz wraz ze startup-abort/quota/Auth/CAS, graceful/reopen po CAS, alias refusal, prywatnymi normami, RAM, formularzem, godzinami pomocnika i uncertain outbox. Żadnej asercji ani scenariusza nie usunięto.
- `node tools/ci-sharding-smoke.js` — **205 testów / 7 grup PASS**. Nowa regresja jest automatycznie obowiązkowa w grupie 4, test katalogu pozostaje w grupie 7. Workflow bez zmian.
- `node --check` helpera i nowego smoke oraz `git diff --check` — **PASS**. Brak zmian produkcyjnych, wersji zasobów i manifestu; nie powtarzano testów wyceny ani pełnego CI.

**Granice:** poprawiono odtworzony fałszywy timeout helpera. Gdyby w konkretnym CI Chromium rzeczywiście nie zakończył się naturalnie lub uszkodził dane, nowe kontrole nadal zakończą się FAIL; nie uznajemy tego za wykluczone samym odczytem starego logu. Wcześniejsze oddzielne ryzyko brakującego znacznika zaufania z testu aktualizacji pozostaje niezmienione i nie jest przedmiotem tej poprawki. Shared helper obsługuje także inne testy LOCAL-FIRST/SDK — pełna ich weryfikacja należy do nowego, osobno zatwierdzonego CI, bez dziedziczenia PASS z b2eaa810.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.** Jeden commit i push na istniejącą gałąź; końcowe zdalne HEAD/BASE i CLEAN w przekazaniu. Bez zmian biznesowych/UI/Auth/Firebase LIVE, PR #116, workflow, ponowienia Actions, merge i wydania.


## Akordeony wzorcowe i zakres usług — 07.11.2026

Gałąź `feat/service-scope-ui-20261107`, BASE/main `6dfe8bec5a2fd41b0d5c03f0441483d5c3f91687` (GitHub/git), wynikowy HEAD w przekazaniu. PR #116 jest scalony, merge `6dfe8bec…`, HEAD `ae49b958…`; odczytano metadane, nie ponawiano zakończonych diagnoz ani CI. Stan tego pakietu nie dziedziczy PASS wydania #116.

**Zrealizowana część:** `wycena-work-plan-view.js` kopiuje kompletną strukturę akordeonu `rozrys-accordion` z `dev_ui_patterns.html`: nagłówek/przycisk, tytuł, zielony chevron, zwinięte body, aria-expanded i istniejące `accordionBehavior`. Dotyczy trzech zakresów CZYNNOŚCI i HARMONOGRAMU. Nie dodano lokalnego CSS ani nowego wariantu wzorca. Zmieniono cache-busting w obu loaderach/walidatorze i manifest. Stabilny atrybut przycisku zapisu pomocnika rozróżnia go od nowego przycisku nagłówka. Dotychczasowe chowanie Zapisz do czasu zmiany formularza i transakcja zapisu pozostają; testy zachowano. `AGENTS.md` §13 utrwala obowiązek galerii, pytania o brakujący wzorzec i równoczesnego dodania nowego zaakceptowanego elementu. `ROADMAP.md` odkłada estymator pojemności pojazdu.

**Uzgodnienia biznesowe i niewykonana część:** dostawa jest dodatkowo płatna raz na pomieszczenie; wyjazd ekipy jest osobno płatny z dostawą lub bez. Ekipa dwóch osób jedzie z meblami tym samym samochodem; jej czas ma być opłacony również przy dostawie bez montażu. Wnoszenie i montaż mają być niezależnymi wyborami. Obecny kod ma `transport_distance_km` (kwota startowa/km na wyjazd) oraz `transport_travel_time` (czas ekipy), ale nie ma osobnej fabrycznej stawki dostawy raz na pomieszczenie. Harmonogram wiąże dziś wyjazdy z dniami montażu; nie wystarczy dodać checkboxów, bo sama dostawa przy zerowym montażu mogłaby nie naliczyć wyjazdu. Nie zgadywano kwoty i nie podmieniano norm. Czas przejazdu ma istniejące źródło u inwestora; samo rozdzielenie opłat nie daje zgody na dopisywanie norm załadunku/rozładunku.

Właściciel otrzymał pytania: (1) kwota dostawy za pomieszczenie i minuty pracy samej dostawy bez wnoszenia/montażu; (2) fizyczne łączenie kursów dostawy z dniami montażu — wspólne kursy czy dostawa osobno. Odpowiedzi nie ma w chwili zapisu raportu. Wymagane przed naliczaniem są kwota osobnej dostawy oraz zasada kursów; nowa norma czasowa dostawy nie jest konieczna, jeśli właściciel pozostawi wyłącznie istniejący czas przejazdu. Jeden kurs/opłata dostawy na pomieszczenie nie przesądza fizycznego współdzielenia przejazdu z kilkudniowym montażem. Zgodnie z `AGENTS.md` §4 nie implementowano jeszcze wyborów usług, nowych opłat, filtrowania etapów ani zmian snapshotów. **Cały zatwierdzony pakiet: BLOCKED**, mimo ukończenia niezależnej części UI.

**Celowane wyniki na drzewie zawierającym wpis (dane wyłącznie syntetyczne):**

- `node tools/labor-catalog-local-first-browser-smoke.js --scope-only` — **3 grupy PASS**. Faktyczne scope/stage formularza i trwałe native IDB/restart; cztery akordeony z realnym modułem zachowania i produkcyjnym CSS; brak native summary, prawidłowe klasy, aria, zielony chevron; otwarcie/zamknięcie i zamykanie poprzedniego akordeonu. Obsługa klawiatury Enter na rzeczywistym przycisku. Dodatkowa asercja najpierw odmówiła, bo CDP wysyłało sam keyDown/keyUp bez `text: \r`: niezależna próba na zwykłym natywnym button potwierdziła brak keypress/click bez tego pola, a prawidłową aktywację z nim. Skorygowano wysłanie Enter w teście, bez handlera klawiatury w produkcie i bez zmiany asercji. Dokładnie niezmienione RAW/RAM/control/replicas/protected/outbox przy odczycie i klikaniu. Zapis pomocnika: quota-abort zachowuje input, nie unieważnia obliczeń; poprawny commit/restart zachowuje historię i uncertain outbox. Pełnych wcześniejszych 20 scenariuszy nie powtarzano lokalnie; domyślny test w CI nadal zawiera je wszystkie.
- `node tools/android-safe-sw-update-smoke.js` — **PASS**: stary SW/dane jednego profilu, opóźniona instalacja ponad 30 s i pełne ACK, brak odświeżania dirty RAM, nowy offline shell, dokładne oryginalne RAW/IDB i wyłącznie zatwierdzone wcześniejsze uzupełnienia fabrycznych norm. Bez zmian SW/startupu/katalogów w tym pakiecie.
- Osobny podgląd czterech akordeonów w Chromium przy szerokości 412 px — wizualnie sprawdzony na danych syntetycznych, z użyciem produkcyjnych CSS. Pierwsza pomocnicza strona podglądu nie ustawiła `lfReady`, więc helper odmówił startu; poprawiono wyłącznie tymczasową stronę, bez zmiany produktu/testów/timeoutów.
- `node tools/ui-patterns-housekeeping-smoke.js` — **6/6 PASS**.
- `node tools/main-login-smoke.js` — **36/36 PASS**; `check-index-load-groups.js` — **PASS**, nadal 347 skryptów; nowe moduły nie powstały.
- `node tools/ci-sharding-smoke.js` — **205/7 PASS**. Pełny test katalogu i aktualizacja SW: obowiązkowo grupa 7; wzorce UI: grupa 4. Workflow bez zmian.
- `node --check` zmienionego modułu i browser smoke, `node tools/offline-assets.js`, `git diff --check` — **PASS**.

Nie zmieniono algorytmu obliczeń, źródeł ilości, cenników, stawek, norm, historii/snapshotów, zapisu projektów, Auth, writer-fence, synchronizacji ani Firebase. Nie wykonano operacji na urządzeniu. Bez PR/Actions/merge/Pages i Firebase LIVE. **BLOCKED / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED** dla całego zakresu. Następny ruch to odpowiedzi biznesowe i dokończenie usług na tej gałęzi; niezależna część UI jest zapisana, lecz nie jest dowodem ukończenia usług.


## Załadunek i rozładunek łącznie 5 min/korpus — 07.11.2026

**Stan: CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.** Branch `feat/service-scope-ui-20261107`, wejściowy HEAD `71e0f4a7a0d6df3a1dea0c8a490a7cb757ecb7bf`, BASE/main `6dfe8bec5a2fd41b0d5c03f0441483d5c3f91687` potwierdzony przez git/GitHub. Dotychczasowy commit wzorcowych akordeonów pozostaje na gałęzi; poniższa kontynuacja jest jednym nowym commitem, bez przepisywania historii. Wynikowy zdalny HEAD/push/CLEAN potwierdzamy w przekazaniu; plik nie zapisuje własnego SHA.

### Decyzje i zakres

Właściciel zastąpił pomysł stałych 30 min/opłaty na pomieszczenie normą **łącznie 5 min na korpus za załadunek i rozładunek**. Stawka montażowa obejmuje dwie osoby, bez mnożenia przez dwie. Dostawa, wnoszenie i montaż odbywają się podczas tego samego wyjazdu, nie ma odrębnego kursu tylko z dostawą. Czas przejazdu nadal pochodzi z trasy firmy/inwestora; kwota za km i start pozostają w istniejącym cenniku (fabrycznie 0 zł). Nie dopisano cen paliwa, nowej stałej opłaty, osobnych 5 minut za rozładunek ani kolejnego kursu. Przyszła estymacja kursów z kubatury została odłożona w ROADMAP.

- `labor_delivery_loading`: zwykła norma katalogowa, `cabinet.count`, `time`, 5/60 h, aktualna stawka montażowa, domyślny zakres `room`. Grupuje ilości korpusów w pomieszczeniu przed jedną formułą; cały zestaw nadal jest liniowo 5 min/korpus. Nie powtarza się w kolejnych dniach. Jedna nowa pozycja 121→122; istniejący mechanizm dopisuje brakującą fabryczną normę przed użyciem także na starym profilu. Nie zmieniono normalizatora, cennika UI ani starych rekordów. Jedyna linia w istniejącym dużym module `wycena-core-labor.js` nadaje tej normie jednoznaczną rolę `delivery-loading`; nie rozbudowano go o UI/storage/drugi silnik (§16 AGENTS).
- Wspólny work plan filtruje wybrane usługi przed agregacją i harmonogramem. Załadunek należy do dostawy, wnoszenie do swoich istniejących źródeł, czynności montażowe do montażu. Osobny fallback usługi AGD również respektuje wyłączenie montażu. Warsztat pozostaje; wyłącznie warsztat nie generuje dni/tras/przerw montażowych. Oferta tylko na fronty nie nalicza załadunku korpusów. Etapy i stawki są odróżniane: przerwa na montażu zachowuje stawkę warsztatową, lecz czas montażowego dnia. Wspólny przejazd liczony według dni, bez mnożnika liczby pomieszczeń/usług. Nie zmieniono norm wnoszenia ani mechanizmu obliczeń formuł.
- Ustawienie `services` w istniejącym drafcie projektu jest opcjonalne: brak pola zachowuje dotychczasowy pełny zakres. Zapis przez istniejący `projectHandler`, potwierdzony native IDB commit, invalidacja obliczeń dopiero po commit; abort zachowuje wybory. Scope właściciela/projektu i aktualność otwartego wyboru są sprawdzane przed zapisem. Nie ma dodatkowego magazynu/klucza/writera. Harmonogram v2 zamraża usługi; snapshoty v1 i starsze oferty bez harmonogramu nie otrzymują nowych pól ani przeliczeń. Eksport/pakowanie ofert zachowuje harmonogram; niepusty draft nadal blokuje dawny transfer przez istniejące `LF_PROJECT_OWNERSHIP_PENDING`, bez obchodzenia tej odmowy i bez LIVE.
- Przygotowany launcher „Zakres usług” w dotychczasowym wyborze WYCENY otwiera istniejący panel/picker. Checkboxy, footer, Anuluj/Zatwierdź tylko przy zmianach i Wyjdź dla stanu CLEAN kopiują obecny wybór Fronty/Korpusy. Wspólne akordeony pozostają zgodne z wcześniejszym wzorcem. CZYNNOŚCI rozdzielają podpisy czasu warsztatowego i montażowego oraz używają tego samego filtrowania. **Checkboxy zatwierdzone przez właściciela:** po pytaniu wymaganym przez AGENTS §13 właściciel odpowiedział „Zatwierdzam checkbox”. Dodano do `dev_ui_patterns.html` zatwierdzony wzorzec natywnych checkboxów/chipów 1:1 z istniejącego wyboru Fronty/Korpusy, wraz z tym samym CSS i przełączaniem klasy `is-checked`. Bez nowego lokalnego CSS. Podgląd 412 px obejmuje wyłącznie dane syntetyczne.

### Celowane kontrole — faktyczne wyniki

- `labor-work-plan-smoke.js`: pełne **22 grupy PASS**, potem nowe przypadki usług uruchamiane przez `--services-only` **4/4 PASS** (w tym jeden nowy test widoku pomieszczenia; łącznie pokryte 23 grupy; pełny domyślny zestaw zawiera je wszystkie). 6 korpusów w dwóch pomieszczeniach = 30 min / 125 zł, aktualna ułamkowa stawka 312.125 zł/h = 156.0625 zł bez przedwczesnego zaokrąglania; prywatna 1-minutowa norma pozostaje dokładna; wielodniowy montaż nie powiela załadunku. Osobne flagi, tylko warsztat, fallback AGD, fronty bez korpusów, wspólny dojazd i podział czasów. Snapshot v1 nie dostaje usług, snapshot v2 zachowuje zamrożone dane, eksport/replikacja zachowują harmonogram; dawny guard niepustych draftów nadal odmawia bez zapisów. Podczas przygotowania testu poprawiono jego stare oczekiwanie wersji harmonogramu 1→2 oraz niemożliwą w dotychczasowym `clampTimeBlock` próbkę 3 min na obsługiwaną 1 min; nie zmieniono kontraktu normalizacji ani asercji zachowania prywatnych norm.
- `code-global-catalogs-smoke.js` — **7/7 PASS**, pełne 14 domen, validateBundle/runtime, ceny, normy i zależności; odtworzony asset deterministyczny. `wycena-labor-pdf-smoke.js` — **13/13 PASS**; zachowane dotychczasowe normy i przykłady. `wycena-labor-compatibility-smoke.js` — **4 grupy PASS** (zero/qty, źródła i wersje, 45 min/Cancel, zamknięte pakowanie).
- `labor-catalog-local-first-browser-smoke.js`: pełny przebieg **22 grupy PASS** po dodaniu nowej normy/usług, następnie rozszerzone `--scope-only` **5 grup PASS** z nowymi asercjami Auth/odczytu CZYNNOŚCI. Stary profil 57→122 oraz osobny wydany 121→122 z dokładnie jedną dopisaną normą, niezmienione wcześniejsze rekordy i idempotentny restart. Faktyczny launcher i panel, Save tylko dla DIRTY, Escape/odmowa/anulowanie, błąd quota i retry, odwołanie Auth bez zapisu i utraty wyborów, odmowa starego projektu, native restart i trwałe flagi/helperHours. RAM, oryginalny localStorage, snapshoty, replicas/protected/outbox z fazą uncertain zachowane dokładnie. W zapisie lokalnym nie powstają synchronizacyjne operacje. W testach sieć jest wyłączona podczas edycji usług; bootstrap fixture jest syntetyczny na loopback, nie jest to prawdziwy Google/Firebase ani dowód Pixela.
- Dodatkowy test odmowy po zmianie projektu początkowo porównał wersję application z obrazem sprzed restartu (5 vs 6). Odczyt istniejącego `application-authority.mjs:121` i `local-first-idb.mjs:83` wykazał obligatoryjny checkpoint startupu +1. Test teraz wymaga dokładnie tego jednego wzrostu oraz identyczności całych pozostałych rekordów, wszystkich rows/hash; osobno wymaga całkowitej niezmienności 4 store podczas samej odmowy. Nie zmieniono kodu authority/store ani nie pominięto porównania control.
- `android-safe-sw-update-smoke.js` — **PASS**, rzeczywisty stary SW i jeden profil, instalacja >30 s, active/waiting ACK, dirty RAM bez wymuszonego reloadu, zimny offline shell, RAW/IDB i ścisłe dopisanie 65 fabrycznych norm (poprzednie 64 + nowy łączny załadunek/rozładunek). Wszystkie stare wartości/rekordy pozostają dokładne. SW/aktualizator/startup niezmienione.
- `transport-catalog-quote-fix-smoke.js`, `czynnosci-project-preparation-smoke.js`, `czynnosci-manual-time-display-smoke.js` — **PASS**. Main-login **36/36 PASS**, exact asset versions, kolejność 347 skryptów, generator/manifest/składnia/diff **PASS**; aktualne `?v=` w obu loaderach i walidatorze. Nie dodano modułów, canonical load list pozostaje kompletna.
- Routing **205 testów / 7 grup PASS**, bez zmian workflow: rozszerzone testy silnika, katalogu, PDF i aktualizacji SW są domyślnie obowiązkowe w swoim istniejącym shardzie (katalog/SW w 7). Nie pominięto wcześniejszych scenariuszy. Nie uruchamiano całego lokalnego CI, Actions, PR, merge, Pages ani Firebase LIVE.

- Po zatwierdzeniu checkboxów: `ui-patterns-housekeeping-smoke.js` — **7/7 PASS**, w tym nowy obowiązkowy kontrakt galerii z klasami aktualnego pickera Fronty/Korpusy i nowego launchera. Brak lokalnego CSS i zapisów z galerii. Routing tego testu: obowiązkowa grupa 4. Rzeczywisty Chromium sprawdził osobno nową galerię: etykiety trzech checkboxów, kliknięcie input/etykiety i synchronizację checked/is-checked przy zabronionych zapisach storage — PASS. Zachowanie skryptu galerii false/true oraz niezmienność pozostałych checkboxów jest także częścią powyższego obowiązkowego testu UI (VM); nie pozostaje wyłącznie jednorazową próbą poza CI. Dla uzupełnienia galerii nie powtarzano zakończonych zestawów biznesowych, katalogu Chromium ani SW.

**Ograniczenia i następny ruch:** właściciel zatwierdził zarówno normę, jak i wygląd checkboxów. Kod i dokumentacja są domknięte; jeden nowy commit/push na tej gałęzi, dokładny wynikowy zdalny HEAD/BASE i CLEAN w przekazaniu. **CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED**. Fizycznego telefonu nie zmieniano. Dotychczasowe ograniczenia synchronizacji draftów pozostają, pełny CI i wydanie wymagają osobnych dowodów i zgody. Następny ruch: niezależna kontrola tego pakietu i osobna zgoda na dokładne HEAD/BASE do wydania; bez PR/Actions/merge/Pages/Firebase LIVE w tej kontynuacji.


## PR #118 — dwie korekty testów po CI #42399738765

**07.11.2026, CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.** Kontynuacja `feat/service-scope-ui-20261107` od `51a80f5103ff0748ec02bd66100d4414f8ece208`, BASE/main `6dfe8bec5a2fd41b0d5c03f0441483d5c3f91687`, zgodne z odczytem GitHub/git. Wynikowy HEAD oraz potwierdzenie jednego nowego commita/pushu/CLEAN w przekazaniu. Nie przepisano poprzednich commitów.

**Dowód nieudanego wydania:** [PR #118](https://github.com/mebleszek/meble-app/pull/118) otwarty Ready, bez merge, HEAD wejściowy jak wyżej. [CI #42399738765](https://github.com/mebleszek/meble-app/actions/runs/42399738765) zakończone FAIL. [Shard 6, job 128484778971](https://github.com/mebleszek/meble-app/actions/runs/42399738765/job/128484778971): smoke **48/49**, wyłącznie `project-context-coherence-smoke.js` **16/17** i `TypeError: Cannot read properties of undefined (reading 'servicesLauncher')`. [Shard 7, job 128484778981](https://github.com/mebleszek/meble-app/actions/runs/42399738765/job/128484778981): smoke **49/50**, wyłącznie `quote-exact-calculations-smoke.js:103`, `390 !== 369.17`. Safety/static/shardy 1–5/Firebase CURRENT (wszystkie 3)/CLOUD historical smoke+SDK PASS wyłącznie dla `51a80f51…`; agregaty preflight/ci-summary/final-status FAIL, auto-merge/post-merge-verify SKIPPED. To nie jest CI_PASS nowego commita. Odczytano metadane i oba logi, bez uruchamiania Actions.

### Przyczyny i minimalna poprawka

1. Izolowany test kontekstu ładował selection renderer bez `wycena-work-plan-view.js`. Produkcyjne `index.html`, `dev_tests.html` i kanoniczny load-group już mają kompletną kolejność store → work plan → view → selection render. Bazowy fixture ma rzeczywisty work plan, lecz handlery robocizny/oferty są celowo puste i nie zawiera on store oferty ani nowego widoku. Zależności dodano wyłącznie do przypadku rzeczywistego renderowania w tym teście: prawdziwy `quote-offer-store.js` i `wycena-work-plan-view.js`, bez stubowania launchera. Nowe asercje wymagają faktycznego przycisku z Dostawa/Wnoszenie/Montaż, dokładnie jednego wystąpienia wszystkich zależności i poprawnej kolejności obu loaderów oraz niezmienionych RAW/RAM/draftu. Stare kontrole właściciela, obcego override, pustego zakresu, przełączeń projektu, utraty kontekstu podczas await i odmów RAM/sesji pozostają. Przed poprawką odtworzono lokalnie **16/17 FAIL** z tym samym stackiem; po poprawce **17/17 PASS**. Weryfikacja obu punktów wejścia oraz renderu realnego modułu nie wykazała analogicznego braku zależności produkcyjnej. Nie wykonywano nowego pełnego startupu w Chromium; kod aplikacji nie uległ zmianie, a poprzednie dowody Chromium/CI dotyczą osobno wejściowego SHA.

2. Dwie referencje kwot PDF obejmowały kiedyś wyłącznie stare operacje, ale po dodaniu zatwierdzonej normy rzeczywisty kolektor zwraca też jedną pozycję załadunku/rozładunku. Rozpoznano ją wyłącznie po stabilnym `labor_delivery_loading`. Zachowano stare referencje **369,17 zł (moduł) i 517,63 zł (wisząca)**: rzeczywisty kolektor jest uruchamiany ponownie z katalogiem bez wyłącznie tej nowej definicji, a wszystkie stare szczegóły są porównywane pole po polu z odpowiednimi operacjami w pełnym zestawie (ilości/normy/stawki/ID/warunki i pozostałe pola). Nowa pozycja musi być dokładnie jedna, źródło `cabinet.count`, ilość 1, stawka montażowa 250 zł/h, łącznie 5/60 h, surowa cena `5/60*250`, prezentacja i osobna suma **20,83 zł**. Pełny rejestr ma jedną dodatkową linię i niezależne referencje **390,00 / 538,47 zł**. Zaokrąglenie sprawdzane jest dopiero po zsumowaniu niezaokrąglonych źródeł: dla wiszącej suma zaokrąglonych podsumowań 517,63+20,83 dałaby błędnie 538,46 zamiast 538,47. Katalog po kontroli musi pozostać dokładnie niezmieniony, getter jest zawsze przywracany. Zachowano `unchangedTotals` z przypiętymi SHA historycznych blobów BASE oraz niezależny parser widocznych równań, także dla nowej opłaty i obu referencji. Przed poprawką odczyt rozbicia potwierdził te same stare kwoty i dokładnie jedną nową normę; nie zmieniano norm ani algorytmu zaokrąglania.

### Faktycznie wykonane kontrole

- `node tools/project-context-coherence-smoke.js` — **17/17 PASS**, 0 FAIL, po odtworzeniu starego FAIL.
- `node tools/quote-exact-calculations-smoke.js` — **83 przypadki PASS**, w tym obie stare referencje, oba nowe pełne wyniki, opłata 5 min, porównanie każdego starego szczegółu i niezależne równania. Pozostałe przypadki prywatnych stawek ułamkowych, trybów ilościowych, gabarytu, transportu/konfliktu STOP, zerowych wartości, rabatów, DOM i niezmienności snapshotów bez usunięcia lub osłabienia asercji.
- `node tools/check-index-load-groups.js` — **PASS**, 347 skryptów, bez modyfikacji loaderów lub listy.
- `node tools/ci-sharding-smoke.js` — **205 testów / 7 rozłącznych grup PASS**; oba poprawione pliki nadal obowiązkowo raz w CI: kontekst **6/7**, dokładne obliczenia **7/7**. Nie dodano skip/retry i nie zmieniono workflow.
- `node --check` obu testów oraz `git diff --check` — **PASS**. Lokalny Node **24.19.0**; nieudany CI używał Node **22.23.4**. Nie powtarzano pełnego lokalnego Preflightu, zaliczonych wcześniej zestawów Chromium/SDK ani Firebase.

**Zakres plików:** wyłącznie `tools/project-context-coherence-smoke.js`, `tools/quote-exact-calculations-smoke.js`, `CURRENT_STATE.md` i ten raport. Bez zmian produkcyjnych, cenników, norm, UI, Auth, SW, storage/synchronizacji, manifestu/wersji zasobów i workflow. PR #118 nie przełączano, nie tworzono PR, nie ponawiano Actions, nie scalano, nie publikowano i nie wykonano Firebase LIVE. Następny ruch: niezależna kontrola wynikowego zdalnego HEAD/BASE i osobna zgoda właściciela na kolejną próbę istniejącego PR #118. Brak dodatkowego blokera samej poprawki; wymagane nowe CI i akceptacja fizycznego telefonu pozostają PENDING.


## Kontrola źródeł reguł i propozycja przerwy — 08.11.2026

**Wyłącznie analiza i utrwalenie decyzji w AGENTS.md. Nie jest to naprawa WYCENY.**
Gałąź `docs/pricing-rule-authority-review-20261108`, BASE/main
`f29e8d3797108068130cfb73c3393a066e050c43`. Odczytano bieżące repo i uzgodnienia;
bez ogólnego audytu Auth/SW/Firebase. Zakres: aktywne kolektory robocizny, wnoszenia,
transportu, AGD, materiałów/PCV i wspólny plan; normalizacja reguł i ich źródła.
Nie jest to zapewnienie, że zbadano każdą kombinację prywatnych danych lub każdy
historyczny wariant. Żadnych RAW właściciela nie użyto w próbach.

### Potwierdzone odstępstwa do decyzji naprawczej

1. **Wnoszenie korpusu** — `wycena-core-labor.js:675` i dalsze: zamiast
   calculateDefinition kod liczy startHours + floorUnits × stepHours i narzuca
   rates.assembly / rateType assembly. Definicja `labor_carrying_cabinet` w
   labor-catalog-definitions.js nadal wskazuje helper, startQty 1; opis notatki
   historycznie mówi 15 + 5/poziom, a opis formularza 15 za pierwszy. Ignorowane
   są m.in. startQty, stepEveryQty, defaultMultiplier, formuła i warunki.
   Aktywność jest filtrowana przez laborDefs — nie stwierdzono ignorowania active.
   Syntetycznie jeden poziom: wspólny kalkulator 15 min/20 zł (helper80), automat
   20 min/83,33 zł (assembly250). Wpisanie obu czasów zero, mnożnika3 i niespełnionego
   warunku nadal daje około20 min/83,33 zł, mimo evaluateConditions=false.
   `|| 0.25` i `|| 0.0833333333` zamieniają prawidłowe zera na stare normy.
2. **Wysokie fronty** — `wycena-core-labor.js:591–673`: analogiczna osobna
   formuła i narzucenie assembly dla tej samej reguły, osobno dla windy/schodów.
   Ten sam problem startu/kroków/zera/warunków; nie jest to poprawione przez
   prawidłowe korzystanie z reguł przez pozostałe automaty szafek.
3. **Niespójna informacja o czasie wnoszenia** — carrying-logistics.js DEFAULTS
   15 min + 5 min/poziom wylicza ev.baseMinutes niezależnie od cennika;
   carryingLineNote używa tej liczby jako czasu ekipy. Edycja startHours/stepHours
   może więc zmienić koszt, a nie tekst źródła. Stałe logistyczne obejmują też
   progi20/45 kg, windę2 poziomy i gęstości materiałów. To osobne luki jawności;
   nie należy ich dowolnie zastępować stawkami lub wymyślać nowych wartości.
4. **Czas dojazdu** — `wycena-core-offer.js:183–229`: stawkę odczytuje z def.rateType,
   lecz cenę liczy bezpośrednio durationHours × hourlyRate. Pomija wspólną formułę,
   blok czasu, mnożnik i warunki; jawne przypisanie ręczne zatrzymuje automat.
   Poprawna syntetyczna definicja: duration1h, timeBlock0.5h, multiplier3,
   assembly250; kalkulator reguły375 zł, automat250 zł. Nie wykorzystano
   niedozwolonego bloku2h (normalizer go zeruje); to nie byłby poprawny dowód.
5. **AGD — precyzja i opis** — `wycena-core-lines.js:695–748`: normalny kolektor
   używa wspólnego kalkulatora, ale stara gałąź zaokrągla hours do0.01h przed
   harmonogramem oraz total przed dalszą agregacją;1 minuta staje się0.02h.
   Tekst wyliczenia zakłada qty × timeBlockHours × stawka również przy innej
   formule. Osiągalność tej gałęzi zależy od obecności nowszych zamienników.
   Historyczny addFallback bierze svc.price zamiast całej reguły; zwykła ścieżka
   nowych norm ma pierwszeństwo. Nie przedstawiać tego jako potwierdzonego błędu
   każdej aktualnej oferty AGD lub dowodu podwójnego naliczenia.
6. **Cena kilometra a widok reguły** — `wycena-core-offer.js:139`: uzgodniona
   cena paliwowa jest podstawiana do lokalnej kopii nieedytowanej reguły fabrycznej
   zero; cennik zachowuje zero, ustawienia pokazują cenę pochodną. Jest to jawny,
   wcześniej zatwierdzony wyjątek źródła ceny, lecz nie spełnia nowego wymagania
   jednego widocznego powiązania reguły z jej parametrami. Ręczne stawki zachowane;
   nie zmieniać uzgodnionej formuły paliwa ani nie nadpisywać katalogów w audycie.
7. **Stałe biznesowe poza ustawieniami** — PCV ma rawMeters ×1.1 w
   wycena-core-material-plan.js:220. Zapas10% był uzgodniony, więc nie jest dowodem
   błędnej kwoty; według nowej zasady jawności należy ustalić jego edytowalne
   miejsce. Dzień480 min jest wcześniejszym jawnym ustaleniem, lecz stałą kodu.
   Prosta suma ilości/kosztów lub przelicznik minut na godziny nie są odstępstwami.

Pozostałe sprawdzone typowe kolektory szafek/przygotowania/nowych norm AGD i zakresów
korzystają z calculateDefinition. Dodatkowy trzeci pomocnik używa ręcznych godzin
oraz aktualnej stawki helper, zgodnie z wcześniejszą decyzją; nie jest drugą opłatą
za standardową ekipę. Nie dowiedziono braku innych błędów we wszystkich wariantach.

### Przerwa — obecne działanie i propozycja, bez implementacji

Definicja `labor_daily_break` ma0.5h, stawkę workshop, zakres day i oba etapy.
Work-plan stosuje wszystkie właściwe reguły codzienne do każdego rozpoczętego dnia:
nie ma progu przepracowanych godzin ani osobnego wyboru, czy klient płaci przerwę.
To odpowiada poprzedniemu zatwierdzeniu „raz na dzień”, ale wymaga zmiany zgodnie
z nową propozycją właściciela. Syntetycznie5 min prac montażowych i5 min trasy
w jedną stronę tworzy1 dzień oraz0.5h/75 zł przerwy przy150 zł/h warsztatowej.
Sam przejazd przy zerze prac niecodziennych daje0 dni i nie tworzy przerwy;
nie potwierdzono literalnego przypadku „tylko transport” bez innych czynności.
Załadunek/wnoszenie mogą jednak stworzyć krótki dzień i tę opłatę.

Rekomendacja do zatwierdzenia:
- Czas przerwy pozostaje w istniejącej regule Przerwa; ewentualne pole ustawień
  edytuje ten sam parametr, nie tworzy drugiej niezależnej wartości.
- Dodać do tej reguły jawny próg godzinowy uprawniający do przerwy oraz wybór
  naliczania jej kosztu klientowi. Nie implementować sztywnego progu w harmonogramie.
- Zasadność i czas przerwy liczyć raz wspólnie dla harmonogramu i kosztu.
  Przy wyłączonej opłacie klienta należna przerwa nadal zajmuje czas dnia.
- Próg liczyć bez czasu samej przerwy; sprawdzać każdy dzień, także krótki ostatni.
  Algorytm musi uwzględnić warunkową przerwę bez dodawania jej drugi raz i bez
  uzależniania progu od czasu, który sama wygenerowała. Zachować limit dnia,
  inne reguły codzienne, dojazdy, zero dni i ochronę przed zależnością kołową.
- Potrzebne decyzje właściciela: czas/prog (30 min nadal jest dotychczasowym czasem,
  nowego progu nie podano), czy do progu liczy się dojazd, zakres wyboru opłaty
  w ofercie czy domyślnej regule. Umiejscowienie nowych kontrolek UI do potwierdzenia.

Nie zmieniono norm, cen, ustawień użytkownika, reguł aktywnego profilu, snapshotów,
LOCAL-FIRST, synchronizacji, UI ani algorytmu przerw. Zmieniono AGENTS §4,
ten raport i CURRENT_STATE. Wykonano wyłącznie odczyt kodu i syntetyczne próby
w pamięci; nie uruchamiano pełnego CI/Actions ani Firebase. Dalsze naprawy wymagają
wyboru zakresu i zatwierdzenia właściciela. To pakiet dokumentacyjny, nie poprawka
cennika/WYCENY; nie przedstawiać wykrytych rozbieżności jako zaliczonych testów.


## Wdrożenie jawnych reguł i przerw — 08.11.2026

Właściciel zatwierdził kompletny pakiet po analizie powyżej. Poniższe decyzje
zastępują otwarte rekomendacje z poprzedniego wpisu. Implementacja na
`feat/catalog-driven-pricing-20261108`, BASE/main
`f29e8d3797108068130cfb73c3393a066e050c43`; wynikowy HEAD w końcowym przekazaniu.
Jeden commit obejmuje także wcześniejszą dokumentacyjną zasadę AGENTS §4.

### Zatwierdzony kontrakt i implementacja

- Wnoszenie: istniejąca fabryczna reguła otrzymuje stawkę montażową; przy obecnym
  250 zł/h jest to koszt standardowej ekipy dwóch osób. Automat nie podmienia
  stawki, formuły, startQty, stepEveryQty, mnożnika, źródła ani warunków.
  Zero czasu/mnożnika jest rzeczywistym zerem. Domyślnie 15 min za pierwszy
  poziom + 5 min za każdy następny; parametry minimum 1 i winda 2 są widoczne
  w edycji reguły. Winda nie podwaja parteru.
- Rozkręcona szafka: jedna jednostka wnoszenia, niezależnie od liczby paneli.
  Rozkręcenie i ponowne skręcenie: osobna reguła, łącznie 60 min; próg masy
  45 kg edytowany w tej regule. Bez rozkręcenia przy dopasowaniu korpusu do windy.
  Fakty nadal udostępniają rzeczywistą liczbę elementów niewchodzących do windy.
- Fronty małe: pakiet w ramach szafki. Duże, wymagające osobnego transportu:
  osobne jednostki tej samej reguły, rzeczywiste dopasowanie do drzwi i kabiny,
  także po przekątnej. Tryby kwotowy, za ilość i start + ilość również korzystają
  z reguły, bez przeliczania ich na ukryte roboczogodziny.
- Nowy inwestor: domyślny parter 0 i etykieta „Parter (0)”. Istniejący pusty/
  nieznany poziom nie jest przepisywany przy odczycie. Liczbowe zero nie znika.
- „Stawki i przerwy”: czas 30 min, próg po przekroczeniu 4 h, dzień 8 h —
  wszystkie wartości edytowalne. Kontrolki ustawień modyfikują istniejącą regułę
  `labor_daily_break`, a nie drugi zestaw danych. Reguła pozostaje codzienna,
  oba etapy, stawka warsztatowa. Własny czas, np. 20 min, zachowuje się również
  po otwarciu formularza reguły; nie wypada z listy standardowych czasów.
- Próg obejmuje pracę, załadunek, wnoszenie i przejazdy w obie strony. Nie
  obejmuje czasu samej przerwy. Do progu włącznie nie ma przerwy; powyżej jest
  jedna. Dla każdego etapu osobno, każdego dnia, także krótkiego ostatniego.
- Nowa oferta ma zaznaczone „Naliczaj klientowi koszt przerw”. Wyłączenie
  zachowuje czas, dni i wyjazdy, lecz zeruje kwotę przerwy. Wybór zapisuje się
  w szkicu i snapshotach przez istniejącą granicę projektu LOCAL-FIRST,
  z odmową zmiany właściciela/starego kontekstu. Nie przelicza archiwalnych ofert.
- Dodatkowa trzecia osoba nadal wyłącznie z ręcznych godzin; bez wydłużania
  harmonogramu standardowej ekipy i bez mnożenia kosztu dwóch monterów.
- Kilometr: istniejąca reguła `transport_distance_km` ma jawny wybór źródła:
  paliwo / cena ręczna. W trybie paliwowym kalkulator, lista i formularz używają
  jednego resolvera opartego na ustawieniach firmy; pochodna cena nie jest
  zapisywana jako niezależna kopia. Domyślnie 10 l/100 km × 7 zł/l × 2 = 1,40 zł/km.
  Cena ręczna, także 0 zł, pozostaje wiążąca. Start i kilometry wliczone zostają.
  Czas przejazdu również przechodzi przez calculateDefinition, ze źródłem trasy
  i kompletnymi parametrami użytej formuły w audycie.
- PCV: „Zapas do wyceny (%)” jest polem rzeczywistego obrzeża w cenniku
  materiałów, osobno dla korpusu/frontów. Domyślnie 10%, także dla starych
  rekordów bez pola; odczyt nie dopisuje wartości do profilu. Zero oznacza
  rzeczywiste metry. WYCENA czyta aktualny LOCAL-FIRST przez selektor katalogu.
- Historyczne AGD: pełna znaleziona reguła zamiast samej price, warunki i źródło
  ilości, dokładne godziny i kwoty przed końcowym zaokrągleniem. Nieudany warunek
  znalezionej reguły nie uruchamia zastępczej opłaty. Istniejące normy PDF i ceny
  usług stałych nie zostały zmienione.

### Algorytm i ochrona danych

Prace niecodzienne są agregowane przed ustaleniem dni, zgodnie z zakresem reguł.
Stałe czynności codzienne i przejazdy zmniejszają dostępność. Dla przerwy badane
są granice jawnego progu i pojemności przed/po nim, bez iterowania liczby dni
z powrotem do licznika. Pełne dni i ostatni dzień są reprezentowane najwyżej
przez dwie grupy, z osobną liczbą wystąpień przerwy. Koszty codzienne i wyjazdy
naliczane są po ustaleniu dni; nie zwiększają drugi raz licznika. Zerowe prace
niecodzienne nie tworzą dni. Niedodatnia pojemność dla dodatniej pracy, źródło
zależne od harmonogramu i podwójna codzienna reguła przejazdu nadal blokują.

Przykłady kontrolne: parter/minimum 1 → 15 min → 62,50 zł przy 250 zł/h;
4 poziomy → 30 min, a nie 35 min. Dwie osobne duże sztuki to dwa przejścia.
230 min prac + 10 min przejazdu = 4 h: bez przerwy. 450 min prac przy takim
przejeździe: dzień 440+10+30=480 min i ostatni 10+10=20 min; jedna przerwa,
dwa wyjazdy. Wyłączenie opłaty nie zmienia tych dni. Domyślna krótka trasa:
4 km × 1,40 + 10 min × 250/60 = 47,27 zł, bez automatycznej przerwy.

Korekta istniejącego cennika dotyczy wyłącznie czterech dokładnych, nieedytowanych
fabrycznych definicji: wnoszenie, rozkręcenie, km i przerwa. Porównanie całej
poprzedniej znormalizowanej definicji, brak znacznika edycji i obcych pól;
prywatne zmiany oraz ich oryginalne wartości zostają. Uzgodnione nowe parametry
trafiają do fabrycznych rekordów przy czystym starcie LOCAL-FIRST, tą samą
atomową ścieżką co brakujące normy. Brudny/trwały draft jest wznawiany bez
zmiany jego katalogu. Aktualizacja jest idempotentna; źródłowy RAW, stare
snapshoty i niepewne outbox/replicas/protected nie są przepisywane.

Kontrola starego SW wykryła, że stosowanie parteru 0 podczas normalizacji
historycznych inwestorów naruszało zachowanie starego profilu. Potwierdzono,
że baza main zaliczała ten test. Poprawiono przyczynę: domyślne 0 wyłącznie
przy tworzeniu nowego inwestora/szkicu. Pełny test aktualizacji ponownie PASS,
z zachowaniem kompletu kluczy, dokładnych pól historycznych i natywnego IDB.
Asercje nadal odrzucają utratę/dopisanie kluczy, zmianę prywatnej ceny lub normy,
zmianę projektów, rozbieżne aliasy i nadmiarowe rekordy. Jedyny wyjątek to
jawnie wymienione pola zatwierdzonych, dokładnych fabrycznych korekt.

### Pliki i faktyczne kontrole

Reguły i silnik: `labor-catalog-definitions.js`, `labor-catalog.js`,
`carrying-logistics.js`, `work-quantity-facts.js`, `labor-work-plan.js`.
Integracja: `wycena-core-{labor,lines,material-plan,offer}.js`, `wycena-core.js`.
Formularze: `price-modal-{item-form,list}.js`, `data-settings-*-view.js`,
`hourly-rates-store.js`, `wycena-tab-editor.js`, `wycena-work-plan-view.js`,
`investor-{carrying,editor-state}.js`, `investors-store.js`.
Kontrakty: `global-data-contract.js`, `catalog-store.js`,
`quote-{offer,snapshot}-store.js`, `sync/application-authority.mjs`.
Wersje obu wejść, `tools/script-versions.js`, fabryczny artefakt i manifest
odświeżone; produkcyjna kolejność ładowania i workflow bez zmiany.
`dev_tests.html` uzupełniono o pominięte wcześniej dwa istniejące moduły
stawek (store i widok), w kolejności zgodnej z produkcyjnym wejściem. UI kopiuje istniejące
pola, wybór z modala, chip checkbox i akordeon; bez nowego wzorca wizualnego.

Celowane kontrole Codexa na danych syntetycznych, w roboczym drzewie tej gałęzi:

| Kontrola | Wynik |
| --- | --- |
| `catalog-rule-authority-smoke.js` | 11 grup PASS: zgłoszone obejścia, zero, warunki, źródła, progi, ceny, prywatne korekty, oferty, parter |
| `labor-work-plan-smoke.js` | 23 grupy PASS |
| `wycena-labor-norms-smoke.js` | 9/9 PASS |
| `quote-exact-calculations-smoke.js` | 83 przypadki PASS; stare 369,17/517,63 i osobny załadunek zachowane |
| `effective-project-pcv-smoke.js` | 30/30 PASS |
| `transport-settings-pricing-smoke.js` | 4 grupy PASS |
| `code-global-catalogs-smoke.js` | 7/7 PASS; 14 domen |
| `carrying-lift-logistics-smoke.js` | PASS; wymiary, przekątna, rozkręcona szafka, duże fronty i trzy tryby kwotowe |
| `labor-catalog-local-first-browser-smoke.js` | Chromium/native 22 grupy PASS, także CAS/abort/quota/odmowa/prywatne zmiany/draft/restart |
| `android-local-first-browser-smoke.js` | Pełna aplikacja Chromium/offline 15 grup PASS, nowe rzeczywiste formularze i wybór opłaty, zachowanie ofert/RAW/kolejek |
| `android-safe-sw-update-smoke.js` | Rzeczywista aktualizacja starej aplikacji/SW, 320/360/412 px, aktywny/brudny profil, opóźnienie >30 s i późniejszy offline PASS |
| `main-login-smoke.js` | 36/36 PASS; zależności i granica startu |
| Wersje, składnia zmienionych modułów, kolejność ładowania, generatory, diff | PASS |

Aktualizowano wyłącznie oczekiwania wynikające z zatwierdzonej zmiany:
krótki dzień bez przerwy, nowa fabryczna stawka, jedna szafka po rozkręceniu,
fabryczne metadane i wersje zależności. Test zachowania danych po usunięciu
porównuje stan po celowo zapisanym nowym wyborze przerw; nie uznaje tego wyboru
za nieautoryzowaną zmianę starej oferty. Wszystkie pozostałe asercje zachowane.

Rzeczywisty routing z `cloud-ci-context.historicalSmoke`: 208 bieżących smoke
w 7 rozłącznych grupach, bez 8 historycznych (odrębne zadanie). Nowe regresje
w shardzie 7, natywny cennik/harmonogram w 4, pełny Android/PCV w 5,
aktualizacja SW i dokładne kwoty w 7. Nie wykonano pełnego Preflightu ani
Firebase SDK/emulatorów; należą do GitHub Actions dla przyszłego zatwierdzonego SHA.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.**
Bez PR, Actions, merge, wydania i Firebase LIVE. Żadnego dostępu do danych
telefonu ani resetowania profilu właściciela. Następny ruch: niezależna kontrola
wypchniętego HEAD/BASE, następnie osobna zgoda na jedną próbę wydania.
