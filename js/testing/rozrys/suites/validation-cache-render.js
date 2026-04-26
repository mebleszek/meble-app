(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  FC.rozrysDevTestSuites = FC.rozrysDevTestSuites || {};

  FC.rozrysDevTestSuites.validationCacheRender = function validationCacheRender(ctx){
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
      makeTest('Walidacja', 'Walidacja przechodzi dla planu mieszanego: magazyn + zamówić', 'Sprawdza, czy plan łączący magazyn i nowe płyty nie pokazuje fałszywego nadmiaru.', ()=>{
        const parts = Fx.basicParts();
        const expected = FC.rozrysValidation.rowsFromParts(parts);
        const actual = FC.rozrysValidation.summarizePlan({ sheets: Fx.mixedPlanSheets() }, 'MDF 18 biały').rows;
        const validation = FC.rozrysValidation.validate(expected, actual);
        assert(validation.ok === true, 'Walidacja nie przechodzi dla poprawnego planu mieszanego', validation);
      }),
      makeTest('Walidacja', 'Walidacja łapie sztuczny nadmiar w przeprodukowanym planie', 'Sprawdza, czy przy dodatkowej formatce ponad zapotrzebowanie walidacja zgłosi nadmiar zamiast puścić błąd dalej.', ()=>{
        const parts = Fx.basicParts();
        const expected = FC.rozrysValidation.rowsFromParts(parts);
        const actual = FC.rozrysValidation.summarizePlan({ sheets: Fx.overproducedPlanSheets() }, 'MDF 18 biały').rows;
        const validation = FC.rozrysValidation.validate(expected, actual);
        assert(validation.ok === false, 'Walidacja nie wykryła nadmiaru w przeprodukowanym planie', validation);
        assert(Array.isArray(validation.extra) && validation.extra.length >= 1, 'Walidacja nie zwróciła listy nadmiarowych pozycji', validation);
      }),
      makeTest('Cache', 'Klucz cache jest stabilny dla tych samych danych', 'Sprawdza, czy identyczne dane dają dokładnie ten sam klucz cache.', ()=> withIsolatedLocalStorage(()=>{
        const state = Fx.cacheState('sig-a');
        const parts = Fx.basicParts();
        const keyA = FC.rozrysCache.makePlanCacheKey(state, parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(Fx.clone(state), Fx.clone(parts), {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(keyA === keyB, 'Ten sam stan daje różne klucze cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Klucz cache zmienia się po zmianie stockSignature', 'Sprawdza, czy zmiana stanów magazynu wymusza nowy klucz cache, a więc nowe liczenie.', ()=> withIsolatedLocalStorage(()=>{
        const parts = Fx.basicParts();
        const keyA = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-a'), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-b'), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(keyA !== keyB, 'Zmiana podpisu stanów magazynu nie zmienia klucza cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Klucz cache zmienia się po zmianie wyjątków słojów', 'Sprawdza, czy zmiana wyjątku free/blocked dla formatek wymusza nowy klucz cache.', ()=> withIsolatedLocalStorage(()=>{
        const part = Fx.rotationOnlyPart();
        const parts = [part];
        const sig = fallbackPartSignature(part);
        const keyA = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-a', { grain:true, grainExceptions:{} }), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-a', { grain:true, grainExceptions:{ [sig]:'free' } }), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(keyA !== keyB, 'Zmiana wyjątków słojów nie zmienia klucza cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Klucz cache zmienia się po zmianie oklein formatek', 'Sprawdza, czy zmiana ustawień oklein daje nowy klucz cache i nie podmienia starego wyniku.', ()=> withIsolatedLocalStorage(()=>{
        const state = Fx.cacheState('sig-a');
        const parts = Fx.basicParts();
        const sig = fallbackPartSignature(parts[0]);
        const keyA = FC.rozrysCache.makePlanCacheKey(state, parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(state, parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({ [sig]: { w1:true } }),
        });
        assert(keyA !== keyB, 'Zmiana oklein nie zmienia klucza cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Save/load cache zachowuje ostatni wpis', 'Sprawdza, czy zapisany cache daje się odczytać bez utraty ostatniego wpisu.', ()=> withIsolatedLocalStorage(()=>{
        const cache = {
          a:{ ts:1, value:'x' },
          b:{ ts:2, value:'y' },
        };
        FC.rozrysCache.savePlanCache(cache);
        const loaded = FC.rozrysCache.loadPlanCache();
        assert(loaded && loaded.b && loaded.b.value === 'y', 'Cache nie zapisał/odczytał wpisu', loaded);
      })),
      makeTest('Silnik planowania', 'Engine liczy prosty plan shelf bez pustego wyniku', 'Sprawdza, czy dla prostego zestawu solver zwraca realny plan zamiast pustego wyniku.', ()=>{
        const plan = FC.rozrysEngine.computePlan(Fx.baseState({ heur:'simple', direction:'auto' }), Fx.basicParts(), {
          cutOptimizer: FC.cutOptimizer,
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(Array.isArray(plan.sheets) && plan.sheets.length >= 1, 'Engine zwrócił pusty plan', plan);
        const placements = plan.sheets.reduce((sum, sheet)=> sum + ((sheet && sheet.placements) || []).filter((pl)=> pl && !pl.unplaced).length, 0);
        assert(placements >= 1, 'Engine nie rozmieścił żadnej formatki', plan);
      }),
      makeTest('Silnik planowania', 'Engine opisuje heurystykę zgodnie z trybem i kierunkiem', 'Sprawdza, czy etykieta heurystyki nie myli trybu optimax z kierunkiem pierwszych pasów.', ()=>{
        const label = FC.rozrysEngine.formatHeurLabel({ heur:'optimax', optimaxProfile:'dokladnie', direction:'across' });
        assert(/Dokładnie/.test(label), 'Etykieta heurystyki nie pokazuje profilu', { label });
        assert(/w poprzek/.test(label), 'Etykieta heurystyki nie pokazuje kierunku', { label });
      }),
      makeTest('Eksport i druk', 'Layout druku buduje HTML z tytułem i arkuszami', 'Sprawdza, czy wydruk składa poprawny HTML z tytułem i kartami arkuszy.', ()=>{
        const html = FC.rozrysPrintLayout.buildPrintHtml(Fx.printPayload(), buildPrintDeps());
        assert(/Test rozrysu/.test(html), 'HTML wydruku nie zawiera tytułu', { html });
        assert((html.match(/class="sheet-card"/g) || []).length === 2, 'HTML wydruku nie zawiera dwóch arkuszy', { html });
      }),
      makeTest('Eksport i druk', 'Dwa małe arkusze mieszczą się na jednej stronie wydruku', 'Sprawdza, czy dwa małe arkusze nie są sztucznie rozdzielane na dwie strony, jeśli mieszczą się przy tej samej skali.', ()=>{
        const html = FC.rozrysPrintLayout.buildPrintHtml(Fx.pairPrintPayload(), buildPrintDeps());
        const pageCount = (html.match(/class="print-page"/g) || []).length;
        const sheetCount = (html.match(/class="sheet-card"/g) || []).length;
        assert(sheetCount === 2, 'Testowy wydruk nie zawiera dwóch kart arkuszy', { pageCount, sheetCount, html });
        assert(pageCount === 1, 'Dwa małe arkusze nie zostały złożone na jednej stronie', { pageCount, html });
      }),
      makeTest('Render ROZRYS', 'Walidacja scalania liczy różnice RAW → skomasowana niezależnie od tabeli produkcyjnej', 'Sprawdza, czy techniczna walidacja scalania nadal poprawnie liczy różnice RAW → skomasowana, mimo że sama tabela Skomasowana wróciła do roli listy produkcyjnej.', ()=>{
        const mergeValidation = FC.rozrysValidation.validateResolution([
          { key:'m||A||100x100', material:'M', name:'A', w:100, h:100, qty:2, cabinet:'#1', room:'Kuchnia' },
          { key:'m||A||100x100', material:'M', name:'A', w:100, h:100, qty:1, cabinet:'#2', room:'Salon' },
        ], [
          { key:'m||A||100x100', material:'M', name:'A', w:100, h:100, qty:2, cabinet:'#1', room:'Kuchnia' },
        ]);
        assert(mergeValidation.ok === false, 'Walidacja scalania nie wykryła różnicy RAW → scalanie', mergeValidation);
        assert(mergeValidation.rows[0] && mergeValidation.rows[0].rawQty === 3, 'Walidacja scalania nie policzyła ilości RAW', mergeValidation.rows[0]);
        assert(mergeValidation.rows[0] && mergeValidation.rows[0].mergedQty === 2, 'Walidacja scalania nie policzyła ilości po scaleniu', mergeValidation.rows[0]);
      }),
      makeTest('Render ROZRYS', 'Renderer buduje osobne sekcje summary/actions/sheets i pilnuje kart arkuszy', 'Sprawdza, czy render rozrysu dzieli widok na sekcje oraz czy po renderze istnieje tyle kart i canvasów, ile arkuszy.', ()=>{
        const restoreDom = installFakeDom();
        try{
          const out = host.document.createElement('div');
          const plan = { sheets: Fx.mixedPlanSheets(), meta:{ boardW:2800, boardH:2070 } };
          const meta = { material:'MDF 18 biały', kerf:4, unit:'mm', edgeSubMm:0, parts:Fx.basicParts(), scopeMode:'both', selectedRooms:['Kuchnia'] };
          FC.rozrysRender.renderOutput(plan, meta, {
            out,
            buildRozrysDiagnostics: ()=> ({ validation:{ ok:true, rows:[] }, sheets:[{ rows:[] }, { rows:[] }], rawRows:[], rawCount:0, rawQtyTotal:0, mergedRows:[], mergedCount:0, mergedQtyTotal:0, mergedQtyMatch:true }),
            validationSummaryLabel: ()=> ({ tone:'is-ok', text:'Walidacja OK' }),
            openValidationListModal: ()=>{},
            openSheetListModal: ()=>{},
            buildCsv: ()=> 'x',
            downloadText: ()=>{},
            openPrintView: ()=>{},
            measurePrintHeaderMm: ()=> 10,
            mmToUnitStr: (mm)=> String(mm),
            drawSheet: (canvas)=> { canvas.__drawn = true; },
            cutOptimizer: { placedArea: ()=> 100 },
          });
          const sections = collectNodes(out, (node)=> (node.dataset && node.dataset.rozrysSection));
          assert(sections.length >= 3, 'Renderer nie zbudował osobnych sekcji summary/actions/sheets', sections.map((node)=> node.dataset && node.dataset.rozrysSection));
          const cards = collectNodes(out, (node)=> node.dataset && node.dataset.rozrysSheetCard === '1');
          const canvases = collectNodes(out, (node)=> node.tagName === 'CANVAS' && node.dataset && node.dataset.rozrysSheet === '1');
          assert(cards.length === 2, 'Renderer nie zbudował tylu kart arkuszy, ile plan ma sheetów', { cards:cards.length, expected:2 });
          assert(canvases.length === 2, 'Renderer nie zbudował tylu canvasów, ile plan ma sheetów', { canvases:canvases.length, expected:2 });
        } finally {
          restoreDom();
        }
      }),
      makeTest('Render ROZRYS', 'Guard renderu wykrywa brak kart/canvasów', 'Sprawdza, czy mechanizm anty-regresyjny wykrywa rozjazd między liczbą arkuszy a zbudowanym DOM.', ()=>{
        const restoreDom = installFakeDom();
        try{
          const hostNode = host.document.createElement('div');
          const result = FC.rozrysRender.validateRenderedSheets(hostNode, 1);
          assert(result.ok === false, 'Guard renderu nie wykrył braku kart/canvasów', result);
        } finally {
          restoreDom();
        }
      }),
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
