(function(root){
  'use strict';

  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function assert(condition, message, details){
    if(!condition){
      const err = new Error(message || 'Assertion failed');
      if(details) err.details = details;
      throw err;
    }
  }

  function fallbackPartSignature(part){
    return `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`;
  }

  function defaultRotationAllowed(part, grainOn, overrides){
    const sig = fallbackPartSignature(part);
    if(overrides && overrides[sig] === 'free') return true;
    return !grainOn;
  }

  function withIsolatedLocalStorage(run){
    const storage = host.localStorage;
    const previous = storage && typeof storage.getItem === 'function' ? storage.getItem('fc_rozrys_plan_cache_v2') : null;
    try{
      if(storage && typeof storage.removeItem === 'function') storage.removeItem('fc_rozrys_plan_cache_v2');
      return run();
    }finally{
      if(!storage || typeof storage.removeItem !== 'function' || typeof storage.setItem !== 'function') return;
      if(previous == null) storage.removeItem('fc_rozrys_plan_cache_v2');
      else storage.setItem('fc_rozrys_plan_cache_v2', previous);
    }
  }

  function makeTest(group, name, explain, fn){
    return { group, name, explain, fn };
  }

  function detailsToText(details){
    if(details == null) return '';
    if(typeof details === 'string') return details;
    try{
      return JSON.stringify(details, null, 2);
    }catch(_error){
      return String(details);
    }
  }

  function makeClipboardReport(report){
    const lines = [];
    lines.push(`ROZRYS smoke testy: ${report.passed}/${report.total} OK`);
    lines.push(`Błędy: ${report.failed}`);
    lines.push(`Czas: ${report.durationMs} ms`);
    report.groups.forEach((group)=>{
      lines.push('');
      lines.push(`[${group.name}] ${group.passed}/${group.total} OK`);
      group.results.forEach((row)=>{
        lines.push(`- ${row.ok ? 'OK' : 'BŁĄD'}: ${row.name}`);
        if(row.explain) lines.push(`  Po co: ${row.explain}`);
        if(!row.ok && row.message) lines.push(`  Powód: ${row.message}`);
        const detailsText = !row.ok ? detailsToText(row.details) : '';
        if(detailsText) lines.push(`  Szczegóły: ${detailsText}`);
      });
    });
    return lines.join('\n');
  }

  function runAll(){
    const Fx = FC.rozrysDevFixtures;
    assert(Fx, 'Brak FC.rozrysDevFixtures');
    assert(FC.rozrysState, 'Brak FC.rozrysState');
    assert(FC.rozrysSheetModel, 'Brak FC.rozrysSheetModel');
    assert(FC.rozrysValidation, 'Brak FC.rozrysValidation');
    assert(FC.rozrysCache, 'Brak FC.rozrysCache');
    assert(FC.rozrysEngine, 'Brak FC.rozrysEngine');
    assert(FC.cutOptimizer, 'Brak FC.cutOptimizer');
    assert(FC.rozrysPrintLayout, 'Brak FC.rozrysPrintLayout');

    const tests = [
      makeTest('Stan i wybór', 'Store ROZRYS zapamiętuje selection/options/ui/cache', 'Sprawdza, czy wspólny stan ROZRYS nie gubi wyboru pomieszczeń, zakresu materiału, opcji, UI i cache.', ()=>{
        const store = FC.rozrysState.createStore({
          selectedRooms:['Salon'],
          options:{ unit:'cm', heur:'optimax' },
          ui:{ buttonMode:'running', running:true },
          cache:{ lastAutoRenderHit:true, lastScopeKey:'abc' },
        });
        store.setSelectedRooms(['Salon', 'Kuchnia']);
        store.setAggregate({ byMaterial:{}, materials:['MDF'], groups:{}, selectedRooms:['Salon', 'Kuchnia'] });
        store.setMaterialScope({ kind:'material', material:'MDF', includeFronts:false, includeCorpus:true });
        const selection = store.getSelection();
        assert(selection.selectedRooms.length === 2, 'Store nie trzyma selectedRooms');
        assert(selection.materialScope.kind === 'material', 'Store zgubił materialScope');
        assert(store.getOptionState().heur === 'optimax', 'Store zgubił options');
        assert(store.getUiState().running === true, 'Store zgubił ui.running');
        assert(store.getCacheState().lastAutoRenderHit === true, 'Store zgubił cache flag');
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
      makeTest('Walidacja', 'Walidacja przechodzi dla planu mieszanego: magazyn + zamówić', 'Sprawdza, czy plan łączący magazyn i nowe płyty nie pokazuje fałszywego nadmiaru.', ()=>{
        const parts = Fx.basicParts();
        const expected = FC.rozrysValidation.rowsFromParts(parts);
        const actual = FC.rozrysValidation.summarizePlan({ sheets: Fx.mixedPlanSheets() }, 'MDF 18 biały').rows;
        const validation = FC.rozrysValidation.validate(expected, actual);
        assert(validation.ok === true, 'Walidacja nie przechodzi dla poprawnego planu mieszanego', validation);
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
      makeTest('Eksport i druk', 'Layout druku buduje HTML z tytułem i arkuszami', 'Sprawdza, czy wydruk składa poprawny HTML z tytułem i kartami arkuszy.', ()=>{
        const html = FC.rozrysPrintLayout.buildPrintHtml(Fx.printPayload(), {
          measurePrintHeaderMm: ()=> 14,
          mmToUnitStr: (mm)=> String(mm),
          getBoardMeta: (sheet)=> ({ boardW:sheet.boardW, boardH:sheet.boardH, referenceBoardW:sheet.boardW, referenceBoardH:sheet.boardH }),
          calcDisplayWaste: ()=> ({ total:100, waste:20, realHalf:false, virtualHalf:false }),
        });
        assert(/Test rozrysu/.test(html), 'HTML wydruku nie zawiera tytułu', { html });
        assert((html.match(/class="sheet-card"/g) || []).length === 2, 'HTML wydruku nie zawiera dwóch arkuszy', { html });
      }),
      makeTest('Cache', 'Save/load cache zachowuje ostatni wpis', 'Sprawdza, czy zapisany cache daje się odczytać bez utraty ostatniego wpisu.', ()=> withIsolatedLocalStorage(()=>{
        const cache = {
          a:{ ts:1, value:'x' },
          b:{ ts:2, value:'y' },
        };
        FC.rozrysCache.savePlanCache(cache);
        const loaded = FC.rozrysCache.loadPlanCache();
        assert(loaded && loaded.b && loaded.b.value === 'y', 'Cache nie zapisał/odczytał wpisu', loaded);
      })),
    ];

    const startedAt = Date.now();
    const results = tests.map((test)=>{
      try{
        test.fn();
        return { group:test.group, name:test.name, explain:test.explain, ok:true };
      }catch(error){
        return {
          group:test.group,
          name:test.name,
          explain:test.explain,
          ok:false,
          message:error && error.message ? error.message : String(error),
          details:error && error.details ? error.details : null,
        };
      }
    });
    const passed = results.filter((row)=> row.ok).length;
    const groupsMap = new Map();
    results.forEach((row)=>{
      if(!groupsMap.has(row.group)) groupsMap.set(row.group, []);
      groupsMap.get(row.group).push(row);
    });
    const groups = Array.from(groupsMap.entries()).map(([name, rows])=>({
      name,
      total: rows.length,
      passed: rows.filter((row)=> row.ok).length,
      failed: rows.filter((row)=> !row.ok).length,
      results: rows,
    }));
    const report = {
      ok: passed === results.length,
      total: results.length,
      passed,
      failed: results.length - passed,
      durationMs: Date.now() - startedAt,
      results,
      groups,
    };
    report.summaryText = `${report.passed}/${report.total} OK`;
    report.clipboardText = makeClipboardReport(report);
    return report;
  }

  FC.rozrysDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
