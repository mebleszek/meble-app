(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function assertFunctions(H, owner, ownerName, names){
    H.assert(owner && typeof owner === 'object', `Brak ${ownerName}`);
    (Array.isArray(names) ? names : []).forEach((name)=> {
      H.assert(typeof owner[name] === 'function', `${ownerName}.${name} musi pozostać funkcją po splincie wyboru Wyceny`, { ownerName, name, keys:Object.keys(owner || {}) });
    });
  }

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Core selection split', 'Moduł wyboru Wyceny zachowuje publiczny kontrakt funkcji', 'Pilnuje, żeby wyjęcie selection/validation z wycena-core.js nie zgubiło funkcji używanych przez core i testy.', ()=> {
      assertFunctions(H, FC.wycenaCoreSelection, 'FC.wycenaCoreSelection', [
        'getActiveRooms',
        'normalizeMaterialScope',
        'normalizeQuoteSelection',
        'decodeSelectedRooms',
        'decodeMaterialScope',
        'validateQuoteSelection',
        'validateQuoteContent',
        'createQuoteValidationError',
      ]);
      assertFunctions(H, FC.wycenaCore, 'FC.wycenaCore', [
        'normalizeQuoteSelection',
        'validateQuoteSelection',
        'validateQuoteContent',
        'createQuoteValidationError',
      ]);
    }),

    H.makeTest('Wycena ↔ Core selection split', 'WycenaCore deleguje wybór i walidację do tego samego kontraktu selection', 'Pilnuje, żeby publiczne metody FC.wycenaCore i nowy moduł selection dawały ten sam wynik dla wyboru pokojów i błędów walidacji.', ()=> withInvestorProjectFixture({
      investorId:'inv_wycena_core_selection',
      projectId:'proj_wycena_core_selection',
      rooms:[
        { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' },
        { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'nowy' },
      ],
      status:'nowy',
      projectData:{
        schemaVersion:2,
        meta:{
          projectStatus:'nowy',
          roomDefs:{
            room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' },
            room_b:{ id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'nowy' },
          },
          roomOrder:['room_a','room_b'],
        },
        room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
        room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
      },
    }, ()=> {
      const input = { selectedRooms:['room_a'], materialScope:{ kind:'material', material:'Egger W1100', includeFronts:false, includeCorpus:true } };
      const fromCore = FC.wycenaCore.normalizeQuoteSelection(input);
      const fromSelection = FC.wycenaCoreSelection.normalizeQuoteSelection(input);
      H.assert(JSON.stringify(fromCore) === JSON.stringify(fromSelection), 'normalizeQuoteSelection w core i selection musi dawać ten sam wynik', { fromCore, fromSelection });
      H.assert(fromCore.materialScope.kind === 'material' && fromCore.materialScope.material === 'Egger W1100', 'Material scope po normalizacji musi zachować wybrany materiał', fromCore.materialScope);
      const validatedCore = FC.wycenaCore.validateQuoteSelection(fromCore);
      const validatedSelection = FC.wycenaCoreSelection.validateQuoteSelection(fromSelection);
      H.assert(JSON.stringify(validatedCore) === JSON.stringify(validatedSelection), 'validateQuoteSelection w core i selection musi dawać ten sam wynik', { validatedCore, validatedSelection });
      let coreError = null;
      let selectionError = null;
      try{ FC.wycenaCore.validateQuoteSelection(FC.wycenaCore.normalizeQuoteSelection({ selectedRooms:['missing_room'] })); }catch(err){ coreError = err; }
      try{ FC.wycenaCoreSelection.validateQuoteSelection(FC.wycenaCoreSelection.normalizeQuoteSelection({ selectedRooms:['missing_room'] })); }catch(err){ selectionError = err; }
      H.assert(coreError && selectionError, 'Brak błędu walidacji dla nieistniejącego pokoju w core albo selection', { coreError, selectionError });
      H.assert(String(coreError.code || '') === String(selectionError.code || ''), 'Kod błędu core i selection musi pozostać taki sam', { coreError, selectionError });
    })),

    H.makeTest('Wycena ↔ Core selection split', 'Walidacja pustej wyceny nadal blokuje zapis bez linii kosztowych', 'Pilnuje, żeby wyjęcie validateQuoteContent nie pozwoliło zapisać pustej oferty po cichu.', ()=> {
      let error = null;
      try{ FC.wycenaCore.validateQuoteContent({ selectedRooms:['room_a'], materialLines:[], accessoryLines:[], agdLines:[], quoteRateLines:[] }); }catch(err){ error = err; }
      H.assert(error && error.quoteValidation === true, 'Pusta oferta musi nadal rzucać błąd quoteValidation', error);
      H.assert(String(error && error.code || '') === 'empty_quote_scope', 'Pusta oferta ma zachować kod empty_quote_scope', error);
    }),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
