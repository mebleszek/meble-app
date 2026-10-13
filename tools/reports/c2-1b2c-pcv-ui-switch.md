# C2.1b.2c — analiza bezpiecznego uruchomienia projektowego PCV

Raport historyczny dla bazy PR #37, zachowany z wcześniejszej analizy. Naprawę P1/P2/P3 i nowe testy opisuje [C2.1b.2c.1](c2-1b2c1-session-save-safety.md). Reprodukcje poniżej dokumentują stan bazowy; nie są obecnymi oczekiwaniami testów akceptacyjnych.

## Decyzja i stan pracy

Baza: `4cabe76b33d348ce442a7439d86f2e0203a67102`, aktualny `origin/main`, po PR #37.

**STOP przed zmianą kodu produkcyjnego. Projektowe PCV nie zostało uruchomione w UI.**

Zastosowano warunek zatrzymania z punktu 8 zadania. Potwierdzono rzeczywistą utratę centralnie zapisanego PCV przez istniejący globalny Zapisz po częściowym wykonaniu operacji. Dodatkowo podłączenie samego agregatu do runnera daje wynik z globalnymi krawędziami, mimo projektowych danych wejściowych. Potrzebne zmiany obejmują wspólną ochronę zapisu i odzyskiwania sesji, adapter runnera ze wszystkimi fallbackami i cache oraz kontrolę świeżości nowej oferty. Nie są bezpieczną podmianą jednego settera lub trzech liczników.

Nie zmieniono modułów aplikacji, modeli danych, manifestów ani istniejących testów. Nie aktywowano żadnego projektu. Raport jest materiałem do decyzji o podziale zadania, a nie deklaracją zakończenia C2.1b.2c. Nie utworzono PR z częściowym przełączeniem produkcyjnym.

## Przeczytany kontrakt

Przeanalizowano raporty `c2-1b-part-override-contract.md`, `c2-1b1-template-part-groups.md`, `c2-1b1a-drawer-front-geometry.md`, `c2-1b2a-project-owned-pcv.md` i `c2-1b2b-effective-project-pcv.md` oraz obecne moduły projektu, sesji, MATERIAŁU, ROZRYSU i WYCENY.

Fundament 2a/2b jest użyteczny: pełne booleany `w1/w2/h1/h2`, indywidualne adresy boków, adres grupy półek, osobne grupy małych/dużych frontów i rzeczywisty `setId`. Kolejność liczenia pozostaje: rzeczywiste części → właściciele/ilości → efektywne krawędzie → metry → agregacja. Nie potrzeba nowego kalkulatora, magazynu cutlisty, optymalizatora ani modelu PCV.

## Rzeczywiste wejścia użytkownika i połączenia

| Obszar / moduły | Obecna ścieżka | Co wymaga przygotowania przed aktywacją |
|---|---|---|
| `js/tabs/material.js` | `renderMaterialsTab` → `getMaterialModel` → legacy `createEdgeStore` + `collectRoomMaterials`. Wiersz ma jeden przycisk Opcje. | Wspólna polityka projektu, obsługa błędów bez zerowania metrów, oddzielny wybór właściciela PCV. |
| `material-edge-store.js` | `openPartOptions` przekazuje `edgeEditor.prepare/apply` dla globalnego podpisu; `prepareEdges/setEdges` utrwalają `fc_edge_v1`. | Zachować legacy dla nieprzełączonych projektów. W projektowym przepływie nie używać tego settera ani store. |
| `material-part-options.js` | Jeden lokalny draft obejmuje PCV i słoje. `saveDraft` przygotowuje i zapisuje dwa globalne magazyny. | Oddzielny niewielki edytor projektowego PCV; dotychczasowy modal w trybie samych słojów z nieedytowalnymi wskaźnikami PCV. Brak pozornej transakcji dwóch źródeł. |
| `material-tab-data.js` | Collectory pokoju i zakresu obsługują jawne `pcvMode:'project'`; domyślnie liczą z legacy edgeApi. | Przekazywać ten sam zweryfikowany kontekst, którego użył edytor. |
| `project-pcv-overrides.js` | `get/getForCalculation`, `setEdges/clearEdges`, `inspectRoom`, kontrola RAM i właściciela, clone-first, confirmed save. | Uszczelnić stan częściowy opisany niżej w całej wspólnej ścieżce zapisu, nie tylko w oknie PCV. |
| `project-pcv-resolver.js` | Wspólne kolekcje, wkłady źródeł, walidacja agregatu/planów, `planKey`, `withQuantity`. | Wykorzystać bez kopiowania algorytmu. |
| `cabinet-derived-facts.js` | Legacy PCV w odtwarzalnym RAM cache; projektowe agregowanie jest osobną jawną ścieżką. | Nie używać legacy cache jako źródła projektowego PCV. |
| `rozrys.js`, `rozrys-scope.js`, `rozrys-run-controller.js` | UI tworzy agregat bez jawnego trybu; publiczny agregator ma już opcjonalny tryb projektowy. | Jedna polityka dla wejścia, odświeżenia zakresu i uruchomienia. |
| `rozrys-engine-bridge.js` | Wywołuje silnik bez `pcvMode/projectId`. | Przenieść jawny kontekst do obu metod silnika. |
| `rozrys-runner.js` | Ponownie pobiera agregat; używa cache; catch Optimax uruchamia własny mapper z `loadEdgeStore` i globalnym podpisem; zapisuje cache. | Diagnostyka PCV musi zatrzymywać run. Cały mapper/fallback/stock musi zachować tę samą politykę, flagi, klucze i ilości. |
| `rozrys-engine.js` | Jawny tryb projektowy działa; projektowe części bez kontekstu są odrzucane. | Zachować walidacje, rotację i dotychczasowy silnik. Nie omijać ich w fallbacku runnera. |
| `rozrys-stock.js`, `rozrys-sheet-model.js` | Ponowne obliczenia i odejmowanie ilości według przekazanego podpisu. | Adapter musi przekazywać projektowy `planKey` i aktualizować ledger przez istniejące `withQuantity`. Nie zmieniać polityki magazynu. |
| `rozrys-render.js`, `rozrys-plan-helpers.js`, `rozrys-cache.js`, `rozrys-render-compose.js` | Auto-render i klucze cache używają legacy deps; rysowanie/druk konsumują flagi placements. | Początkowo ominąć odczyt/zapis cache w projektowym trybie, tak jak robi 2b w WYCENIE. Zweryfikować flagi w rzeczywistych placements i wydrukach. |
| `wycena-core.js` | Normalny `collectQuoteData` wywołuje source/material-plan bez opcji projektowych. | Przekazać wspólną politykę i zachować istniejące zabezpieczenie końca sesji oraz zakresu. |
| `wycena-core-source.js`, `wycena-core-material-plan.js` | Jawny tryb projektowy już działa: świeży proof przed/po liczeniu, standard/front, stawki katalogowe i jeden zapas 10%. | Nie dodawać alternatywnej ceny ani narzutu. |
| `wycena-tab-shell.js`, `quote-snapshot.js`, `quote-snapshot-store.js` | Collect → kandydat → możliwy asynchroniczny dialog duplikatu → save/replace. Kontrola kontekstu collect kończy się przed dialogiem. | Potwierdzić świeżość **nowego kandydata** przy rzeczywistym utrwaleniu. Nie przeliczać ani blokować zwykłego odczytu starych ofert. |
| `session.js`, `actions-register.js`, `project-bridge.js`, `session-navigation.js` | Lokalne save są wewnątrz sesji pokoju; nawigacja sprawdza trwały proof, globalny Zapisz/bezpośredni commit nie używają identycznej bramki. | Wspólna ochrona przed ponownym zapisem starego RAM po częściowym wykonaniu. |

Przeszukano także wszystkie JS po `fc_edge_v1`, `createEdgeStore`, setterach oraz funkcjach liczących metry. Poza powyższymi ścieżkami występują odczyty klasyfikatora/backupów i narzędzia testowe — pozostają poza zakresem. Nie znaleziono drugiego zwykłego launchera zapisu krawędzi poza MATERIAŁ → Opcje formatki. Ustawienie trybu body/front szafki/pokoju jest odrębną preferencją technologiczną, a nie setterem czterech krawędzi.

## Potwierdzone zachowania — izolowana diagnostyka

Wykorzystano rzeczywisty `projectStore`, bridge, sesję, akcje Zapisz, generatory, oba API PCV, silnik, engine bridge, runner oraz źródło i orchestrator WYCENY. Wszystkie zapisy zachodziły w `MemoryStorage` istniejącej fixture. Adaptery DOM/progress/stock służą wyłącznie uruchomieniu runnera bez przeglądarki; nie zastępują mappera ani optymalizatora. Puste zależności robocizny/oferty nie są przedmiotem diagnostyki PCV.

| ID | Reprodukcja i wynik | Znaczenie |
|---|---|---|
| P1 | Zapis lewego boku `w2:true`; centralny zapis udany, `set:fc_edit_session_v1` rzuca. Setter zwraca `SESSION_UNCONFIRMED`, `projectSaved:true`, RAM zostaje stary. Po usunięciu awarii kliknięcie istniejącego globalnego Zapisz usuwa zapisany override i pokazuje „Projekt zapisany”. | **Potwierdzona utrata zapisanego PCV przez starą kopię RAM; bloker aktywacji.** |
| P2 | W tym samym stanie `inspectNavigationState() === null`, ale `canSaveProject() === true`, a bezpośredni `commit() === true`. | Nie wystarczy blokada nawigacji lub przycisku wewnątrz nowego okna. |
| P3 | Ponowienie `setEdges` po ustąpieniu awarii daje `RAM_DIVERGENCE`. | Sam komunikat i pozostawiony draft nie zapewniają ścieżki odzyskania. Nie wolno automatycznie używać Cancel ani zmieniać baseline. |
| R1 | Rzeczywisty engine bridge otrzymuje poprawne projektowe części i zwraca `PROJECT_PCV_PLAN_MODE_MISMATCH`. | Jest to prawidłowa odmowa silnika; brakuje propagacji kontekstu przez adapter. |
| R2 | Do rzeczywistego runnera podano tylko projektowy agregat. Błąd bridge'a zostaje złapany, fallback tworzy placements z globalnego pustego edge store i zapisuje wynik w cache. Projektowe części miały włączone krawędzie, placements mają wszystkie false. | **Samo podłączenie agregatu powodowałoby ciche pomieszanie źródeł.** To kontrolowany eksperyment częściowego podłączenia, nie istniejący aktywowany tryb UI. |
| W1 | Niskopoziomowy projektowy collector: 17,122 mb surowo / 18,834 mb z zapasem. `collectQuoteData({pcvMode:'project',projectId:'A',selection})`: 16,440 / 18,084 mb. | Obecny orchestrator nie obsługuje tych opcji; przepięcie tylko licznika MATERIAŁU rozjechałoby cenę. |
| W2 | Z prawdziwych projektowych linii zbudowano kandydata 18,834 mb. Następnie przywrócono default PCV i zakończono sesję. Rzeczywisty snapshot store przyjął starego kandydata, mimo że świeży wynik to 18,084 mb. | Brakuje proofu świeżości nowego kandydata przy save/replace. To nie jest żądanie przeliczania historii. |

**7 otwartych obserwacji zostało odtworzonych. Nie są to 7 zaliczonych testów akceptacyjnych C2.1b.2c.** R1/R2/W1 opisują brakującą integrację fundamentu, nie regresję już uruchomionego projektowego UI. P1/P2 ujawniają rzeczywiste ograniczenie bezpieczeństwa dostępnego API zapisu.

## Najmniejszy bezpieczny podział prac

### Krok 1 — częściowy zapis i ochrona wspólnej sesji

Najpierw uszczelnić zapis po `SESSION_UNCONFIRMED/SAVE_UNCONFIRMED`. Dotyczy `session.js`, wspólnego save w bridge/akcjach i API PCV, z testami trwałego payloadu, stale RAM, retry oraz restartu. Nie zmieniać własności pokoju ani algorytmu rollbacku.

- Żaden wspólny Zapisz/commit ani inny setter projektu nie może przyjąć starego RAM, gdy rewizja durable sesji nie została potwierdzona.
- Trzeba zdefiniować małe jawne odzyskiwanie zgodnego kontekstu: ponowny odczyt centralny, kontrola właściciela i wersji, zachowanie pierwotnego snapshotu i draftu, potwierdzenie trwałego stanu sesji. Nie przyjmować bez kontroli nowej rewizji jako baseline.
- Restart z niezgodną rewizją pozostaje fail-closed; ewentualna automatyczna naprawa musi mieć dowód, że odtwarzana jest ta konkretna operacja, a nie cudza zmiana. Nie dodawać ogólnego frameworka transakcji. Jeśli potrzebna jest trwała intencja operacji, najpierw ustalić minimalny kontrakt w istniejącym kanonicznym mechanizmie.
- UI pokazuje prawdę: „PCV zapisano w projekcie, ale nie potwierdzono stanu sesji. Dalszy zapis został wstrzymany.” Nie „nic nie zapisano”.

Bramka: P1/P2 przestają się odtwarzać; poprawne Cancel/Save/retry nie tracą PCV ani innych danych, restart nie wykonuje destrukcyjnego cofnięcia. Legacy UI nadal działa w dotychczasowym trybie.

### Krok 2 — kompletne adaptery obliczeniowe, nadal bez przełączania użytkownika

Przygotować jawny kontekst projektowy przez prawdziwy controller/runner/engine bridge, ścieżki stock, cache i render; następnie przez `collectQuoteData` do source/material-plan i save/replace nowego kandydata. Wykorzystać resolver i mapper 2b, nie kopiować formuł ani optymalizatora.

- Błąd PCV zatrzymuje run/wycenę; nie jest zamieniany w pusty plan, zero mb lub legacy fallback.
- Zachować identyczne krawędzie, klucze, ledger i ilości także po częściowym wykorzystaniu arkuszy magazynowych.
- Początkowo bez trwałego cache w jawnym trybie projektowym. Nie potrzeba nowego frameworka cache.
- Proof wybranego zakresu i rewizji sprawdzać również po asynchronicznym dialogu, bezpośrednio przed utrwaleniem nowej oferty. Zapisane historyczne snapshoty pozostają niezmienne.
- Bez globalnej flagi aktywacji; produkcyjny legacy nadal działa jak wcześniej.

Bramka: R1/R2/W1/W2 wyeliminowane w jawnym trybie, rzeczywisty runner i orchestrator dają te same metry/placements dla A, B i A+B; 5,010 → 5,511 mb, jedna istniejąca stawka, referencja 4/3/6 arkuszy.

### Krok 3 — jedno końcowe, jawne przełączenie UI

Dopiero po dwóch wcześniejszych bramkach uruchomić wspólnie edycję i wszystkie trzy moduły użytkownika:

- Proponowany marker per fizyczny projekt: np. `projectData.meta.productionPcvMode = 'project'`. To propozycja, nie wdrożony schemat. Brak markera oznacza legacy. Zapis w istniejącym `fc_projects_v1`, bez nowego storage key.
- Aktywacja wymaga jawnego potwierdzenia: stare globalne nadpisania nie mają ustalonego właściciela i **nie zostaną zaimportowane**. RAW legacy pozostaje nietknięty.
- Zakończyć bieżącą sesję dotychczasowym bezpiecznym dialogiem przed zmianą metadanych całego projektu. Scoped room save odmawia zmian metadanych projektu; nie obchodzić tej ochrony. Po confirmed aktywacji ponownie otworzyć właściwy pokój ze świeżą sesją. Awaria aktywacji nie zmienia markera ani RAM.
- W MATERIALE mały oddzielny edytor PCV. Dla `Bok ×2` wybór Lewy/Prawy według refs; jedna grupa półek, osobne mały/duże fronty, grupy zestawu z setId. Nie adresować agregowanego wiersza jako jednej fizycznej sztuki.
- Save/default wyłącznie przez `setEdges/clearEdges`; no-op bez zapisu. Failed begin/save zachowują draft. Stan częściowy korzysta z ochrony kroku 1.
- Dotychczasowy modal słojów nie zapisuje PCV w tym trybie. Edycja samych krawędzi nie dotyka żadnego globalnego store słojów.
- Jeden read-only resolver polityki dla MATERIAŁU, ROZRYSU i WYCENY; różnica markera RAM/centralnego to błąd, nie wybór wygodniejszego źródła. Każda odmowa właściciela/sourceIssues/geometrii/materiału zatrzymuje daną operację bez pozornego sukcesu.

Ten podział nie wdraża częściowego przełączenia produkcyjnego: kroki 1/2 przygotowują bezpieczeństwo i jawną integrację; dopiero krok 3 aktywuje cały zgodny przepływ.

## Weryfikacja bazy i ograniczenia wyniku

Pełny `node tools/preflight.js` wykonany na niezmienionym kodzie bazowym:

- **PRE-FLIGHT PASS**, JS **518/518**, kolejność **317**, smoke **113/113**, APP **110/110**.
- Audyt zależności PASS: JS domenowe 393, index 317, dev_tests 345.
- Audyt storage PASS: referencje 326, pliki 40.
- Czas 96,450 s; log `/tmp/c2-1b2c-preflight.log`.

Preflight obejmuje dotychczasowe testy sesji, PCV 2a/2b, MATERIAŁU, rozkroju, ofert i danych globalnych. Niezależna wielopomieszczeniowa referencja pozostaje 4/3/6 arkuszy. Zielony wynik potwierdza dotychczasową bazę, **nie bezpieczeństwo niezaimplementowanego przełączenia UI**.

Nowa diagnostyka siedmiu obserwacji była wykonana oddzielnie, poza preflight. Nie dodano do obowiązkowego smoke testu, który oczekuje istnienia błędu. Nie wykonano 20 testów akceptacyjnych nowego UI: takiego przepływu nie aktywowano i nie można uczciwie oznaczyć go PASS.

`node --check /tmp/c2-1b2c-flow-diagnostic.js`: PASS. Brak zmienionych produkcyjnych JS. `git diff --check` i sprawdzenie staged raportu `git diff --cached --check`: PASS. Gałąź analizy: `c2-1b2c-pcv-ui-switch-analysis`; HEAD, main i origin/main pozostają na podanym commicie bazowym. Jedyna zmiana repozytorium to ten raport, pozostawiony do przeglądu bez nowego commita/push/PR. Nie wykonano Ready, merge ani publikacji.

Kod produkcyjny i wszystkie globalne dane są niezmienione. Żaden test nie używał danych użytkownika. Dotychczasowe ograniczenia własności globalnych słojów/rotacji, niejednoznacznych legacy wpisów, sourceIssues i międzykartowej atomowości localStorage pozostają otwarte.

## Scenariusz ręczny po przyszłym kompletnym wdrożeniu

1. Otworzyć testowy projekt z dwiema identycznymi szafkami; sprawdzić dotychczasowe legacy PCV przed aktywacją.
2. Jawnie aktywować projektowe PCV po przeczytaniu informacji o braku importu legacy. Zakończyć edycję i ponownie wejść do pokoju.
3. W jednej szafce zmienić PCV lewego boku, zachowując prawy i drugą szafkę. Zapis/reopen pokazuje właścicieli i nowe krawędzie. Osobno sprawdzić grupy półek i frontów.
4. Po zakończeniu sesji sprawdzić MATERIAŁ → prawdziwy runner ROZRYSU → WYCENA dla A, B i A+B. Fronty 600 × 139/283/283 mm: 5,010 mb surowo, 5,511 mb z zapasem.
5. Sprawdzić Cancel i restart oraz błędy begin/save/utrwalenia sesji w środowisku testowym. Historyczne oferty i globalne ustawienia pozostają bez zmian.

## Reprodukcja blokera P1

Z katalogu repozytorium, Node 22.23.3; wyłącznie izolowany `MemoryStorage`:

```js
const fs = require('node:fs'), vm = require('node:vm');
const { fixture } = require('./tools/part-provenance-stability-smoke');
const r = fixture();
r.s.uiState.roomType = 'room';
vm.runInContext(fs.readFileSync('js/app/project/project-pcv-overrides.js', 'utf8'), r.s);
const address = { projectId:'A', roomId:'room', cabinetId:'one', partRoleId:'body.side.left' };
r.session.begin('room');
r.storage.fail.set('set:fc_edit_session_v1', 'throw');
console.log(r.FC.projectPcvOverrides.setEdges(address, { w2:true }));
// { ok:false, code:'SESSION_UNCONFIRMED', projectSaved:true }
console.log(r.row('A').projectData.room.production.partOverrides.one['body.side.left'].edges.w2);
// true: projekt centralny otrzymał ustawienie
r.storage.fail.clear();
r.handlers['session-save']({});
console.log(r.row('A').projectData.room.production);
// undefined: stary RAM nadpisał centralnie zapisany override
console.log(r.session.active, r.messages.map(m => m.title));
// false, ['Projekt zapisany']
```

Pełny skrypt siedmiu reprodukcji z rzeczywistym runnerem i orchestratorami umieszczono w poniższym aneksie. Nie jest testem akceptacyjnym ani częścią preflight; kod wyjścia 0 oznacza odtworzenie opisanych **otwartych** zachowań, a nie ich naprawę.

## Aneks — pełna diagnostyka

Skopiować kod do pliku tymczasowego, uruchomić `node /tmp/c2-1b2c-flow-diagnostic.js` z katalogu repozytorium.

```js
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=process.cwd();
const {fixture:sourceFixture}=require(path.join(ROOT,'tools/part-provenance-stability-smoke'));
const load=(r,file)=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),r.s,{filename:file});
const address={projectId:'A',roomId:'room',cabinetId:'one',partRoleId:'body.side.left'};
const options={pcvMode:'project',projectId:'A'};
function fixture(){
 const r=sourceFixture();r.s.uiState.roomType='room';
 r.s.materials.forEach(m=>Object.assign(m,{price:100,priceUnit:'m2'}));
 r.s.materials.push({name:'HDF',materialType:'hdf',price:20,priceUnit:'m2'},
 {name:'Obrzeże PCV standard',symbol:'PCV-STD',materialType:'obrzeże',price:3,priceUnit:'mb'},
 {name:'PCV pod kolor frontów',symbol:'PCV-FRONT',materialType:'obrzeże',price:5,priceUnit:'mb'});
 for(const file of ['js/app/project/project-pcv-overrides.js','js/app/project/project-pcv-resolver.js',
 'js/app/wycena/wycena-core-utils.js','js/app/wycena/wycena-core-catalog.js','js/app/wycena/wycena-core-material-plan.js',
 'js/app/optimizer/cut-optimizer.js','js/app/rozrys/rozrys-engine.js','js/app/rozrys/rozrys-engine-bridge.js','js/app/rozrys/rozrys-cache.js'])load(r,file);
 return r;
}
function partial(){const r=fixture();assert.equal(r.session.begin('room'),true);r.storage.fail.set('set:fc_edit_session_v1','throw');
 assert.deepEqual(JSON.parse(JSON.stringify(r.FC.projectPcvOverrides.setEdges(address,{w2:true}))),{ok:false,code:'SESSION_UNCONFIRMED',projectSaved:true});
 assert.equal(r.session.inspectNavigationState(),null);return r;}
const edge=r=>r.row('A').projectData.room.production?.partOverrides?.one?.['body.side.left']?.edges?.w2;
async function main(){
 let open=0;
 {
 const r=partial();assert.equal(edge(r),true);assert.equal(r.session.canSaveProject(),true);r.storage.fail.clear();r.handlers['session-save']({});
 assert.equal(edge(r),undefined);assert.equal(r.session.active,false);assert.ok(r.messages.some(m=>m.title==='Projekt zapisany'));
 console.log('OPEN P1: global Save removes centrally saved PCV from stale RAM and reports success.');open++;
 }
 {
 const r=partial();r.storage.fail.clear();assert.equal(r.session.commit(),true);assert.equal(edge(r),true);
 console.log('OPEN P2: direct commit finishes an unconfirmed session (navigation proof was null).');open++;
 }
 {
 const r=partial();r.storage.fail.clear();assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).code,'RAM_DIVERGENCE');
 console.log('OPEN P3: setter retry cannot recover the partial state; old RAM remains.');open++;
 }
 {
 const r=fixture();assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).ok,true);assert.equal(r.session.commit(),true);
 const opts={...options,safeGetProject:()=>r.s.projectData,resolveRozrysPartFromSource:r.FC.materialPartOptions.resolvePartForRozrys};
 const agg=r.FC.rozrysScope.aggregatePartsForProject(['room'],opts);const mat=agg.materials.find(m=>m.toLowerCase().includes('laminat'));const parts=agg.groups[mat].allParts;
 const bridge=r.FC.rozrysEngineBridge.createApi({FC:r.FC,loadEdgeStore:()=>({}),partSignature:p=>p.sourceSig,isPartRotationAllowed:()=>true});
 assert.throws(()=>bridge.computePlan({unit:'mm',boardW:2800,boardH:2070,kerf:4,edgeTrim:10,grain:false,heur:'max'},parts),e=>e.code==='PROJECT_PCV_PLAN_MODE_MISMATCH');
 console.log('OPEN R1: actual engine bridge drops project context and rejects project parts.');open++;
 // Inject ONLY the new aggregate to demonstrate why that tempting switch is unsafe.
 // Actual runner/bridge/optimizer are used; DOM/progress/stock presentation are test adapters.
 r.FC.rozrys.aggregatePartsForProject=()=>agg;
 load(r,'js/app/rozrys/rozrys-runner.js');let rendered=null,legacyReads=0,cacheWrites=0,engineError=null;
 const loadEdges=()=>{legacyReads++;return {};};
 const progress={startRun:()=>1,isActiveRun:()=>true,beginGlobalTicker(){},setActiveHooks(){},clearActiveHooks(){},
 setGenBtnMode(){},setStatus(){},formatElapsed:()=>'',progressPercent:()=>0,buildProgressMeta:()=>'',
 wasCancelRequested:()=>false,finishRun(){},getButtonMode:()=> 'idle'};
 r.s.document.createElement=()=>({appendChild(){},setAttribute(){}});r.s.setInterval=setInterval;r.s.clearInterval=clearInterval;r.s.requestAnimationFrame=fn=>fn();
 await r.FC.rozrysRunner.generate(true,{agg,progressCtrl:progress,matSelValue:'all',unitValue:'mm',boardWValue:2800,boardHValue:2070,
 kerfValue:4,trimValue:10,heurValue:'fast',directionValue:'start-along',out:{innerHTML:'',appendChild(){}},
 normalizeMaterialScopeForAggregate:()=>({kind:'all'}),decodeMaterialScope:()=>({kind:'all'}),normalizeCutDirection:x=>x,
 loadPlanCache:()=>({}),savePlanCache:()=>cacheWrites++,materialHasGrain:()=>false,getMaterialGrainEnabled:()=>false,getMaterialGrainExceptions:()=>({}),
 partSignature:p=>p.sourceSig,isPartRotationAllowed:()=>true,loadEdgeStore:loadEdges,
 getRealHalfStockForMaterial:()=>({qty:0}),getExactSheetStockForMaterial:()=>({qty:0}),getLargestSheetFormatForMaterial:()=>({}),buildStockSignatureForMaterial:()=>'',
 makePlanCacheKey:()=> 'legacy-key',speedLabel:()=>'',directionLabel:()=>'',formatHeurLabel:()=>'',getOptimaxProfilePreset:()=>({}),
 renderLoadingInto:()=>({}),computePlanPanelProAsync:async(...args)=>{try{return await bridge.computePlanPanelProAsync(...args);}catch(e){engineError=e.code;throw e;}},
 applySheetStockLimit:async(m,s,p,plan)=>plan,renderOutput:plan=>rendered=plan,
 buildEntriesForScope:()=>[{material:mat,parts}],getAccordionScopeKey:()=>'',getAccordionPref:()=>({}),createMaterialAccordionSection:()=>({wrap:{},body:{}}),getRozrysScopeMode:()=> 'all'});
 assert.equal(engineError,'PROJECT_PCV_PLAN_MODE_MISMATCH');assert.ok(rendered?.sheets.length);assert.ok(legacyReads>0);assert.equal(cacheWrites,1);
 const placements=rendered.sheets.flatMap(s=>s.placements||[]);assert.ok(placements.length);assert.ok(placements.every(p=>!p.edgeW1&&!p.edgeW2&&!p.edgeH1&&!p.edgeH2));
 assert.ok(parts.some(p=>p.effectivePcv.edges.w1));
 console.log('OPEN R2: normal runner catches project error, produces placements with legacy edges and caches result.');open++;
 // Unrelated labor/offer UI inputs are empty; actual source/material price/resolver are used.
 r.FC.wycenaCoreOffer={getOfferDraft:()=>({selection:{selectedRooms:['room']}}),collectQuoteRateLines:()=>[],collectCommercialDraft:()=>({})};
 r.FC.wycenaCoreLines={collectElementLines:()=>[],collectAccessories:()=>[],collectBuiltInAppliances:()=>[]};r.FC.wycenaCoreLabor={collectCabinetLabor:()=>[]};
 // Restore the ordinary source path rather than the runner's injected project aggregate.
 r.FC.rozrys.aggregatePartsForProject=rooms=>r.FC.rozrysScope.aggregatePartsForProject(rooms,{safeGetProject:()=>r.s.projectData,getRooms:()=>['room','other'],getCabinetCutList:r.FC.cabinetCutlist.getCabinetCutList,resolveRozrysPartFromSource:r.FC.materialPartOptions.resolvePartForRozrys});
 load(r,'js/app/wycena/wycena-core.js');
 const selection={selectedRooms:['room']};const explicit=r.FC.wycenaCoreSource.getSelectedAggregate(selection,options);
 const good=await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(explicit,selection,options);
 const data=await r.FC.wycenaCore.collectQuoteData({...options,selection});
 const edgeLines=rows=>rows.filter(x=>String(x.name).includes('PCV'));
 assert.equal(edgeLines(good)[0].qty,18.834);assert.equal(edgeLines(data.materialLines)[0].qty,18.084);
 console.log('OPEN W1: collectQuoteData ignores supplied project mode: 18.084 vs 18.834 mb with allowance.');open++;
 r.FC.utils.uid=()=> 'diagnostic-offer';
 for(const file of ['js/app/quote/quote-snapshot.js','js/app/quote/quote-snapshot-scope.js','js/app/quote/quote-snapshot-selection.js','js/app/quote/quote-snapshot-store.js'])load(r,file);
 const candidate=r.FC.quoteSnapshot.buildSnapshot({...data,materialLines:good});candidate.id='diagnostic-offer';
 assert.equal(r.FC.projectPcvOverrides.clearEdges(address).ok,true);assert.equal(r.session.commit(),true);
 const saved=r.FC.quoteSnapshotStore.save(candidate);assert.equal(saved.id,'diagnostic-offer');
 assert.equal(edgeLines(saved.lines.materials)[0].qty,18.834);
 console.log('OPEN W2: candidate collected before a PCV change is accepted by snapshot store after the change; no source revision guard.');open++;
 }
 console.log(`C2.1b.2c diagnostic: ${open} open observations reproduced; NOT an acceptance PASS.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
```
