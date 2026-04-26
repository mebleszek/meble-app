(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  FC.rozrysDevTestSuites = FC.rozrysDevTestSuites || {};

  FC.rozrysDevTestSuites.projectStock = function projectStock(ctx){
    ctx = ctx || {};
    const localHost = ctx.host || root || (typeof window !== 'undefined' ? window : globalThis);
    const FC = ctx.FC || localHost.FC || {};
    const host = localHost;
    const Fx = ctx.Fx;
    const assert = ctx.assert;
    const makeTest = ctx.makeTest;
    const fallbackPartSignature = ctx.fallbackPartSignature;
    const defaultRotationAllowed = ctx.defaultRotationAllowed;
    const withIsolatedLocalStorage = ctx.withIsolatedLocalStorage;
    const readAssetSource = ctx.readAssetSource;
    const getRozrysStartupOrderSource = ctx.getRozrysStartupOrderSource;
    const createFakeNode = ctx.createFakeNode;
    const installFakeDom = ctx.installFakeDom;
    const collectNodes = ctx.collectNodes;
    const withPatchedProjectFixture = ctx.withPatchedProjectFixture;
    const withPatchedRoomRegistry = ctx.withPatchedRoomRegistry;
    const withPatchedUiState = ctx.withPatchedUiState;
    const buildPrintDeps = ctx.buildPrintDeps;

    return [
      makeTest('Projekt i agregacja', 'ROZRYS buduje materiały z projektu i resolvera cutlist', 'Sprawdza, czy przy realnym projekcie z szafką ROZRYS nie pokaże pustego stanu tylko dlatego, że nie podpiął źródła formatek.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          kuchnia:{ cabinets:[{ id:'cab-1', width:60, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          szafa:{ cabinets:[], fronts:[], sets:[], settings:{} },
          pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
          lazienka:{ cabinets:[], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'MDF test biały' },
          { name:'Półka', qty:1, a:56, b:30, material:'MDF test biały' },
        ]);
        assert(FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function', 'Brak FC.rozrys.aggregatePartsForProject');
        const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['kuchnia']));
        assert(Array.isArray(agg.materials) && agg.materials.includes('MDF test biały'), 'Agregacja projektu nie zbudowała materiału z prostego projektu', agg);
        assert(agg.byMaterial && Array.isArray(agg.byMaterial['MDF test biały']) && agg.byMaterial['MDF test biały'].length >= 1, 'Agregacja projektu nie zwróciła formatek materiału', agg);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS wykrywa także niestandardowe klucze pomieszczeń z projektu', 'Sprawdza, czy projekt z własnym kluczem pomieszczenia nadal dostarczy formatki do ROZRYS zamiast pustego stanu.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          salon:{ cabinets:[{ id:'cab-2', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'Dąb test' },
        ]);
        assert(FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function', 'Brak FC.rozrys.aggregatePartsForProject');
        const agg = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['kuchnia'],
        }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['salon'])));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('salon'), 'ROZRYS nie rozpoznał własnego klucza pomieszczenia z projektu', agg);
        assert(Array.isArray(agg.materials) && agg.materials.includes('Dąb test'), 'ROZRYS nie zbudował materiału dla własnego klucza pomieszczenia', agg);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS wybiera bogatszy projekt z dostępnych źródeł danych', 'Sprawdza, czy gdy jeden projekt jest pusty, a drugi ma szafki, ROZRYS bierze ten bogatszy zamiast pokazać pusty stan.', ()=>{
        const prevProject = host.projectData;
        const prevWindowProject = host.window && host.window.projectData;
        const prevLoad = FC.project && FC.project.load;
        const leanProject = { schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} } };
        const richProject = { schemaVersion:9, kuchnia:{ cabinets:[{ id:'cab-rich', width:60, height:72, depth:56 }], fronts:[], sets:[], settings:{} } };
        host.projectData = leanProject;
        if(host.window) host.window.projectData = richProject;
        if(FC.project) FC.project.load = ()=> richProject;
        const fixtureCutList = ()=> ([{ name:'Bok', qty:2, a:72, b:56, material:'MDF rich' }]);
        const prevNs = FC.cabinetCutlist;
        FC.cabinetCutlist = FC.cabinetCutlist || {};
        const prevFn = FC.cabinetCutlist.getCabinetCutList;
        FC.cabinetCutlist.getCabinetCutList = fixtureCutList;
        try{
          assert(FC.rozrys && typeof FC.rozrys.safeGetProject === 'function', 'Brak FC.rozrys.safeGetProject');
          const resolved = FC.rozrys.safeGetProject();
          const agg = FC.rozrys.aggregatePartsForProject(['kuchnia']);
          assert(Array.isArray(resolved.kuchnia && resolved.kuchnia.cabinets) && resolved.kuchnia.cabinets.length === 1, 'ROZRYS nie wybrał bogatszego projektu', resolved);
          assert(Array.isArray(agg.materials) && agg.materials.includes('MDF rich'), 'Agregacja nie skorzystała z bogatszego projektu', agg);
        } finally {
          host.projectData = prevProject;
          if(host.window) host.window.projectData = prevWindowProject;
          if(FC.project) FC.project.load = prevLoad;
          if(prevNs && typeof prevNs === 'object') FC.cabinetCutlist.getCabinetCutList = prevFn;
          else if(prevFn) FC.cabinetCutlist.getCabinetCutList = prevFn;
          else delete FC.cabinetCutlist;
        }
      }),
      makeTest('Projekt i agregacja', 'ROZRYS retryuje pełną listę pomieszczeń, gdy zapisany wybór jest pusty', 'Sprawdza, czy pusty albo stary wybór pomieszczeń nie blokuje materiałów, jeśli projekt realnie ma szafki w innym pokoju.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          inne:{ cabinets:[{ id:'cab-3', width:90, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'Jesion test' },
        ]);
        const agg = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['kuchnia'],
        }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['kuchnia'])));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('inne'), 'ROZRYS nie zrobił retry po realnych pokojach projektu', agg);
        assert(Array.isArray(agg.materials) && agg.materials.includes('Jesion test'), 'ROZRYS po retry nadal nie zbudował materiału', agg);
      }),

      makeTest('Projekt i agregacja', 'ROZRYS nie poszerza scope pustego, ale istniejącego pokoju do innych pokoi projektu', 'Pilnuje dokładnego zakresu: jeśli wybrany pokój istnieje, ale nie ma żadnych szafek, agregacja ma zostać pusta zamiast po cichu pobierać materiał z innego pokoju.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_h:{ cabinets:[], fronts:[], sets:[], settings:{} },
          meta:{
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'A', label:'A' },
              room_h:{ id:'room_h', baseType:'pokoj', name:'H', label:'H' },
            },
            roomOrder:['room_a','room_h']
          }
        };
        const fixtureCutList = (cabinet, roomId)=>{
          if(String(roomId || '') !== 'room_a') return [];
          return [
            { name:'Bok A', qty:2, a:72, b:56, material:'Materiał A' },
          ];
        };
        const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['room_h']));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.length === 1 && String(agg.selectedRooms[0] || '') === 'room_h', 'ROZRYS zgubił exact selectedRooms dla pustego pokoju', agg);
        assert(Array.isArray(agg.materials) && agg.materials.length === 0, 'ROZRYS nie może po cichu pobierać materiału z innego pokoju, gdy exact scope jest pusty', agg);
      }),

      makeTest('Bootstrap i splity', 'ROZRYS source zachowuje bootstrap launcherów po init i po splitach', 'Pilnuje regresji, w której po splicie puste launchery Pomieszczenia / Materiał-grupa zostawały bez labeli i bez klikalności, bo init tracił obowiązkowe kroki bootstrapu.', ()=>{
        const src = readAssetSource('js/app/rozrys/rozrys.js');
        assert(src && src.includes('selectionBridge.init();'), 'Brak bootstrapu selectionBridge.init po splicie ROZRYS');
        assert(/function\s+updateRoomsPickerButton\s*\(\)\s*\{\s*return\s+selectionBridge\.updateRoomsPickerButton\(\);\s*\}/.test(src), 'Rozrys.js nie trzyma wrappera updateRoomsPickerButton nad selectionBridge', { src });
        assert(/function\s+updateMaterialPickerButton\s*\(\)\s*\{\s*return\s+selectionBridge\.updateMaterialPickerButton\(\);\s*\}/.test(src), 'Rozrys.js nie trzyma wrappera updateMaterialPickerButton nad selectionBridge', { src });
        assert(/function\s+syncHiddenSelections\s*\(\)\s*\{\s*return\s+selectionBridge\.syncHiddenSelections\(\);\s*\}/.test(src), 'Rozrys.js nie trzyma wrappera syncHiddenSelections nad selectionBridge', { src });
        assert(/function\s+openRoomsPicker\s*\(\)\s*\{\s*return\s+selectionBridge\.openRoomsPicker\(\);\s*\}/.test(src), 'Launcher Pomieszczenia stracił wrapper do openRoomsPicker po splicie', { src });
        assert(/function\s+openMaterialPicker\s*\(\)\s*\{\s*return\s+selectionBridge\.openMaterialPicker\(\);\s*\}/.test(src), 'Launcher Materiał / grupa stracił wrapper do openMaterialPicker po splicie', { src });
      }),

      makeTest('Bootstrap i splity', 'Nowe bridge moduły ROZRYS muszą być załadowane przed rozrys.js i mieć bezpieczny kontrakt fallbacku', 'Pilnuje regresji po splitach bridge: jeśli rozrys.js wywołuje createController/createApi nowego modułu, to index i dev_tests muszą ładować plik przed rozrys.js, a fallback w rozrys.js nie może kończyć się TypeError-em przy braku modułu.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const rozrysSrc = readAssetSource('js/app/rozrys/rozrys.js');
        const startupOrder = getRozrysStartupOrderSource(['js/app/rozrys/rozrys-controller-bridges.js', 'js/app/rozrys/rozrys-render-compose.js', 'js/app/rozrys/rozrys.js']);
        const controllerBridgeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-controller-bridges.js');
        const renderComposeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-render-compose.js');
        const rozrysIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys.js');
        assert(startupOrder.name !== 'missing' && controllerBridgeIdx >= 0 && rozrysIdx >= 0 && controllerBridgeIdx < rozrysIdx, `Startup entrypoint ładuje rozrys-controller-bridges po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, controllerBridgeIdx, rozrysIdx });
        assert(startupOrder.name !== 'missing' && renderComposeIdx >= 0 && rozrysIdx >= 0 && renderComposeIdx < rozrysIdx, `Startup entrypoint ładuje rozrys-render-compose po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, renderComposeIdx, rozrysIdx });
        const controllerBridgeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-controller-bridges.js');
        const renderComposeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-render-compose.js');
        const rozrysDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(controllerBridgeDevIdx >= 0 && rozrysDevIdx >= 0 && controllerBridgeDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-controller-bridges po rozrys.js', { controllerBridgeDevIdx, rozrysDevIdx });
        assert(renderComposeDevIdx >= 0 && rozrysDevIdx >= 0 && renderComposeDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-render-compose po rozrys.js', { renderComposeDevIdx, rozrysDevIdx });
        assert(/const controllerBridgeApi\s*=\s*\(FC\.rozrysControllerBridges && typeof FC\.rozrysControllerBridges\.createApi === 'function'\)/.test(rozrysSrc), 'Fallback controllerBridgeApi w rozrys.js nie zapewnia createApi mimo że kod go woła', { snippet: rozrysSrc.slice(0, 12000) });
        assert(/const renderComposeApi\s*=\s*\(FC\.rozrysRenderCompose && typeof FC\.rozrysRenderCompose\.createApi === 'function'\)/.test(rozrysSrc), 'Fallback renderComposeApi w rozrys.js nie zapewnia createApi mimo że kod go woła', { snippet: rozrysSrc.slice(9000, 22000) });
        assert(/createSelectionBridge\s*:\s*\(config\)\s*=>/.test(rozrysSrc) && /createOutputBridge\s*:\s*\(config\)\s*=>/.test(rozrysSrc), 'Fallback controllerBridgeApi w rozrys.js nie zapewnia obu bridge factory', { snippet: rozrysSrc.slice(9000, 21000) });
        assert(/buildSelectionBridgeConfig\s*:\s*\(config\)\s*=>/.test(rozrysSrc) && /buildRunControllerConfig\s*:\s*\(config\)\s*=>/.test(rozrysSrc), 'Fallback renderComposeApi w rozrys.js nie zapewnia builderów configów potrzebnych po splicie', { snippet: rozrysSrc.slice(9000, 23000) });
      }),

      makeTest('Projekt i agregacja', 'ROZRYS startując z pokoju bierze exact current room zamiast starego globalnego scope z innego pokoju', 'Pilnuje regresji po fixie exact-scope: gdy zapisany globalny wybór pokoi wskazuje inny pokój niż aktualnie otwarty, ROZRYS ma wystartować od bieżącego roomType zamiast odziedziczyć obcy scope i pokazać pusty stan.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_h:{ cabinets:[], fronts:[], sets:[], settings:{} },
          meta:{
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'A', label:'A' },
              room_h:{ id:'room_h', baseType:'pokoj', name:'H', label:'H' },
            },
            roomOrder:['room_a','room_h']
          }
        };
        const fixtureCutList = (cabinet, roomId)=>{
          if(String(roomId || '') !== 'room_a') return [];
          return [
            { name:'Bok A', qty:2, a:72, b:56, material:'Materiał A' },
          ];
        };
        assert(FC.rozrys && typeof FC.rozrys.resolveInitialSelectedRooms === 'function', 'Brak FC.rozrys.resolveInitialSelectedRooms');
        const resolved = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['room_a', 'room_h'],
        }, ()=> withPatchedUiState({ roomType:'room_a' }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=>{
          const rooms = FC.rozrys.resolveInitialSelectedRooms('room_h');
          const agg = FC.rozrys.aggregatePartsForProject(rooms);
          return { rooms, agg };
        })));
        assert(Array.isArray(resolved.rooms) && resolved.rooms.length === 1 && resolved.rooms[0] === 'room_a', 'ROZRYS nie nadpisał starego scope bieżącym pokojem', resolved);
        assert(Array.isArray(resolved.agg && resolved.agg.materials) && resolved.agg.materials.includes('Materiał A'), 'ROZRYS po starcie z pokoju nadal nie zbudował materiałów bieżącego pokoju', resolved);
      }),



      makeTest('Projekt i agregacja', 'ROZRYS discoverVisibleProjectRoomKeys trzyma meta kolejność i odrzuca puste legacy pokoje', 'Pilnuje splitu helpera źródeł projektu: widoczne pokoje mają brać kolejność z meta projektu, ale nie mogą doklejać pustych legacy kreatorów bez danych.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          meta:{
            roomDefs:{
              room_b:{ id:'room_b', baseType:'pokoj', name:'Salon', label:'Salon' },
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia', label:'Kuchnia' },
            },
            roomOrder:['room_b','room_a']
          },
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab-b', width:70, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} },
          pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
        };
        assert(FC.rozrys && typeof FC.rozrys.discoverVisibleProjectRoomKeys === 'function', 'Brak FC.rozrys.discoverVisibleProjectRoomKeys');
        const rooms = FC.rozrys.discoverVisibleProjectRoomKeys(fixtureProject);
        assert(Array.isArray(rooms) && rooms.length === 2, 'Helper widocznych pokoi nadal dokleił puste legacy pokoje albo zgubił meta pokoje', rooms);
        assert(rooms[0] === 'room_b' && rooms[1] === 'room_a', 'Helper widocznych pokoi nie zachował kolejności roomOrder z meta projektu', rooms);
        assert(!rooms.includes('kuchnia') && !rooms.includes('pokoj'), 'Helper widocznych pokoi nadal przepuszcza puste legacy kreatory', rooms);
      }),

      makeTest('Projekt i agregacja', 'ROZRYS picker pomieszczeń nie pokazuje legacy kreatorów, gdy inwestor ma własne pokoje', 'Pilnuje regresję, w której do wyboru pomieszczeń w ROZRYS wpadały bazowe kreatory kuchnia/szafa/pokój/łazienka mimo że aktywny inwestor miał już własne realne pokoje.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          meta:{
            roomDefs:{
              room_a:{ id:'room_a', baseType:'pokoj', name:'a', label:'a' },
              room_j:{ id:'room_j', baseType:'pokoj', name:'J', label:'J' },
            },
            roomOrder:['room_a','room_j']
          },
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_j:{ cabinets:[{ id:'cab-j', width:70, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} },
          szafa:{ cabinets:[], fronts:[], sets:[], settings:{} },
          pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
          lazienka:{ cabinets:[], fronts:[], sets:[], settings:{} },
        };
        const rooms = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['room_a','room_j'],
          getRoomLabel: (room)=> room === 'room_a' ? 'a' : (room === 'room_j' ? 'J' : String(room || '')),
        }, ()=> withPatchedProjectFixture(fixtureProject, ()=> ([]), ()=> FC.rozrys.getRoomsForProject(fixtureProject)));
        assert(Array.isArray(rooms) && rooms.length === 2, 'ROZRYS nadal miesza realne pokoje inwestora z legacy kreatorami', rooms);
        assert(rooms.includes('room_a') && rooms.includes('room_j'), 'ROZRYS zgubił realne pokoje inwestora po odfiltrowaniu legacy kreatorów', rooms);
        assert(!rooms.includes('kuchnia') && !rooms.includes('szafa') && !rooms.includes('pokoj') && !rooms.includes('lazienka'), 'ROZRYS nadal pokazuje legacy kreatory jako pokoje wyboru', rooms);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS przy aktywnym roomRegistry nie gubi pokojów odkrytych w projekcie', 'Pilnuje first-click regresji, w której aktywny inwestor zwracał stare pokoje z registry i blokował materiały z faktycznego projektu.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          salon:{ cabinets:[{ id:'cab-5', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Półka', qty:3, a:56, b:30, material:'First click test' },
        ]);
        const agg = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['kuchnia'],
        }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['salon'])));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('salon'), 'ROZRYS nie dopuścił pokoju odkrytego w projekcie przy aktywnym roomRegistry', agg);
        assert(Array.isArray(agg.materials) && agg.materials.includes('First click test'), 'ROZRYS nadal zgubił materiały przy pierwszym przebiegu z aktywnym roomRegistry', agg);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS filtruje pokoje z tego samego projektu także przy pierwszym przebiegu', 'Pilnuje, czy agregacja i lista dopuszczalnych pokoi korzystają z tego samego kandydata projektu zamiast mieszać fixture z globalnymi domyślnymi pokojami.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          salon:{ cabinets:[{ id:'cab-4', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'Scoped salon test' },
        ]);
        const prevSchemaRooms = FC.schema && Array.isArray(FC.schema.ROOMS) ? FC.schema.ROOMS.slice() : null;
        const prevWindowProject = host.window && host.window.projectData;
        const prevRoomRegistry = FC.roomRegistry;
        FC.roomRegistry = {
          hasCurrentInvestor: ()=> false,
          getActiveRoomIds: ()=> [],
        };
        if(FC.schema) FC.schema.ROOMS = ['kuchnia','szafa','pokoj','lazienka'];
        if(host.window) host.window.projectData = { schemaVersion:9, kuchnia:{ cabinets:[{ id:'stale-cab', width:60, height:72, depth:56 }], fronts:[], sets:[], settings:{} } };
        try{
          const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['salon']));
          assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('salon'), 'ROZRYS odfiltrował pokój fixture po globalnych pokojach zamiast po scoped projekcie', agg);
          assert(Array.isArray(agg.materials) && agg.materials.includes('Scoped salon test'), 'ROZRYS nie zbudował materiału po scoped wyborze pokoju', agg);
        } finally {
          if(FC.schema){
            if(prevSchemaRooms) FC.schema.ROOMS = prevSchemaRooms;
            else delete FC.schema.ROOMS;
          }
          if(host.window) host.window.projectData = prevWindowProject;
          FC.roomRegistry = prevRoomRegistry;
        }
      }),
      makeTest('Magazyn i arkusze', 'Model arkusza respektuje blokadę obrotu przy słojach', 'Sprawdza, czy formatka nie przejdzie tylko dlatego, że zmieściłaby się po niedozwolonym obrocie.', ()=>{
        const parts = [
          { key:'grain||front||600x350', name:'Front', material:'Dąb dziki', w:600, h:350, qty:2 },
          { key:'grain||wstega||350x600', name:'Wstęga', material:'Dąb dziki', w:350, h:600, qty:1 },
        ];
        const result = FC.rozrysSheetModel.filterPartsForSheet(parts, 2100, 400, 20, true, {}, {
          isPartRotationAllowed: defaultRotationAllowed,
        });
        assert(result.length === 1, 'Przy słojach weszła formatka tylko po obrocie albo odpadła zła liczba elementów', { result });
        assert(result[0].name === 'Front', 'Zły element przeszedł filtr słojów', { result });
      }),
      makeTest('Magazyn i arkusze', 'Wyjątek słojów free dopuszcza obrót tylko dla wskazanej formatki', 'Sprawdza, czy materiał ze słojami może obrócić wyłącznie formatkę oznaczoną wyjątkiem, bez odblokowania reszty.', ()=>{
        const part = Fx.rotationOnlyPart();
        const withoutOverride = FC.rozrysSheetModel.filterPartsForSheet([part], 400, 800, 20, true, {}, {
          isPartRotationAllowed: defaultRotationAllowed,
        });
        const withOverride = FC.rozrysSheetModel.filterPartsForSheet([part], 400, 800, 20, true, {
          [fallbackPartSignature(part)]: 'free',
        }, {
          isPartRotationAllowed: defaultRotationAllowed,
        });
        assert(withoutOverride.length === 0, 'Formatka przeszła mimo blokady obrotu przy słojach', { withoutOverride });
        assert(withOverride.length === 1, 'Wyjątek free nie dopuścił obrotu wskazanej formatki', { withOverride });
      }),
      makeTest('Magazyn i arkusze', 'Podpis magazynu jest stabilny niezależnie od kolejności wierszy', 'Sprawdza, czy te same stany magazynu nie zmieniają podpisu tylko dlatego, że wiersze są w innej kolejności.', ()=>{
        const rowsA = Fx.stockRows();
        const rowsB = [rowsA[2], rowsA[0], rowsA[1]];
        const sigA = FC.rozrysSheetModel.buildStockSignatureForRows(rowsA);
        const sigB = FC.rozrysSheetModel.buildStockSignatureForRows(rowsB);
        assert(sigA === sigB, 'Przestawienie wierszy magazynu zmienia podpis', { sigA, sigB });
      }),
      makeTest('Magazyn i arkusze', 'Format magazynowy działa także po zamianie szerokości z wysokością', 'Sprawdza, czy arkusz 2800×2070 i 2070×2800 jest traktowany jako ten sam format.', ()=>{
        const stock = FC.rozrysSheetModel.getExactSheetStockForRows([
          { width:2070, height:2800, qty:3 },
        ], 2800, 2070);
        assert(stock.qty === 3, 'Obrócony format magazynowy nie został rozpoznany jako ten sam arkusz', stock);
      }),
      makeTest('Magazyn i arkusze', 'Model arkusza odejmuje wykorzystane formatki z magazynu', 'Sprawdza, czy element wycięty z płyty magazynowej nie wraca drugi raz do planu zamówienia.', ()=>{
        const parts = Fx.basicParts();
        const used = FC.rozrysSheetModel.countPlacedPartsByKey(Fx.mixedPlanSheets().filter((sheet)=> sheet.supplySource === 'stock'), {
          parts,
          partSignature: fallbackPartSignature,
        });
        const left = FC.rozrysSheetModel.subtractPlacedParts(parts, used, { partSignature: fallbackPartSignature });
        const bok = left.find((row)=> row.name === 'Bok');
        assert(!bok, 'Boki z magazynu nie zostały odjęte z dalszego planu', { left });
        const polka = left.find((row)=> row.name === 'Półka');
        assert(polka && polka.qty === 4, 'Odjęcie z magazynu naruszyło inne elementy', { left });
      }),
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
