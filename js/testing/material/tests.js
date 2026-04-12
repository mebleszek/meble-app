(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function runAll(){
    return H.runSuite('APP smoke testy', [
      H.makeTest('Materiały', 'Registry materiałów rozpoznaje słoje z listy materiałów', 'Sprawdza, czy helper grain działa na realnej liście materiałów zamiast zgadywać po nazwie.', ()=>{
        if(typeof FC.materialHasGrain !== 'function') throw new Error('Brak FC.materialHasGrain');
        const list = [
          { name:'Dąb Halifax', hasGrain:true },
          { name:'Biały Alpejski', hasGrain:false },
        ];
        H.assert(FC.materialHasGrain('Dąb Halifax', list) === true, 'Nie wykryto słojów dla materiału z flagą', list);
        H.assert(FC.materialHasGrain('Biały Alpejski', list) === false, 'Fałszywie wykryto słoje dla gładkiego materiału', list);
      }),
      H.makeTest('Materiały', 'Walidacja materiałów normalizuje cenę i flagę słojów', 'Sprawdza, czy uszkodzony wpis materiału nie rozwala listy i dostaje bezpieczne wartości.', ()=>{
        if(!FC.validate || typeof FC.validate.validateMaterials !== 'function') throw new Error('Brak validateMaterials');
        const rows = FC.validate.validateMaterials([
          { name:'MDF test', price:'12.50', hasGrain:1 },
          { name:'Brak ceny', price:'abc', hasGrain:0 },
        ]);
        H.assert(rows.length === 2, 'Walidacja nie zwróciła 2 materiałów', rows);
        H.assert(rows[0].price === 12.5, 'Walidacja nie znormalizowała ceny materiału', rows[0]);
        H.assert(rows[0].hasGrain === true, 'Walidacja nie znormalizowała hasGrain=true', rows[0]);
        H.assert(rows[1].price === 0, 'Walidacja nie ustawiła bezpiecznej ceny 0', rows[1]);
      }),

      H.makeTest('Materiały', 'Zapis materiałów nie przepuszcza akcesoriów do listy płyt i mirroruje dane do legacy key', 'Pilnuje, czy lista materiałów arkuszowych nie miesza się z akcesoriami i czy zapis dalej zasila zgodność wsteczną dla starszych odczytów.', ()=>{
        H.assert(FC.catalogStore && typeof FC.catalogStore.savePriceList === 'function', 'Brak FC.catalogStore.savePriceList');
        const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
        const prevSheet = localStorage.getItem(keys.sheetMaterials);
        const prevLegacy = localStorage.getItem(keys.materials);
        try{
          const saved = FC.catalogStore.savePriceList('materials', [
            { id:'m_sheet', materialType:'laminat', manufacturer:'Egger', symbol:'W1000', name:'Biały test', price:33, hasGrain:false },
            { id:'m_acc_wrong', materialType:'akcesoria', manufacturer:'Blum', symbol:'A1', name:'Zawias błędny', price:18 }
          ]);
          H.assert(Array.isArray(saved) && saved.length === 1, 'Lista materiałów arkuszowych przyjęła akcesorium', saved);
          H.assert(String(saved[0].name || '') === 'Biały test', 'Zapis materiałów nie zachował płyty arkuszowej', saved);
          const legacyRows = JSON.parse(localStorage.getItem(keys.materials) || '[]');
          H.assert(Array.isArray(legacyRows) && legacyRows.length === 1 && String((legacyRows[0] && legacyRows[0].materialType) || '') !== 'akcesoria', 'Legacy key materials nadal zawiera akcesorium', legacyRows);
        } finally {
          if(prevSheet == null) localStorage.removeItem(keys.sheetMaterials); else localStorage.setItem(keys.sheetMaterials, prevSheet);
          if(prevLegacy == null) localStorage.removeItem(keys.materials); else localStorage.setItem(keys.materials, prevLegacy);
          try{ FC.catalogStore.migrateLegacy({ preferStoredSplit:true }); }catch(_){ }
        }
      }),
      H.makeTest('Materiały', 'Migracja z preferStoredSplit trzyma zapisane listy rozdzielone mimo starych legacy danych', 'Pilnuje, czy pierwszy odczyt po starcie nie wskrzesi starych materiałów i usług, jeśli nowe rozdzielone listy są już zapisane.', ()=>{
        H.assert(FC.catalogStore && typeof FC.catalogStore.migrateLegacy === 'function', 'Brak FC.catalogStore.migrateLegacy');
        const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
        const prevMaterials = localStorage.getItem(keys.materials);
        const prevServices = localStorage.getItem(keys.services);
        const prevSheet = localStorage.getItem(keys.sheetMaterials);
        const prevAccessories = localStorage.getItem(keys.accessories);
        const prevQuoteRates = localStorage.getItem(keys.quoteRates);
        try{
          localStorage.setItem(keys.materials, JSON.stringify([{ id:'legacy_sheet', materialType:'laminat', name:'Legacy płyta', price:9 }]));
          localStorage.setItem(keys.services, JSON.stringify([{ id:'legacy_rate', category:'Montaż', name:'Legacy stawka', price:11 }]));
          localStorage.setItem(keys.sheetMaterials, JSON.stringify([{ id:'stored_sheet', materialType:'laminat', name:'Stored płyta', price:21 }]));
          localStorage.setItem(keys.accessories, JSON.stringify([{ id:'stored_acc', name:'Stored zawias', price:7 }]));
          localStorage.setItem(keys.quoteRates, JSON.stringify([{ id:'stored_rate', category:'Montaż', name:'Stored stawka', price:99 }]));
          const migrated = FC.catalogStore.migrateLegacy({ preferStoredSplit:true });
          H.assert(Array.isArray(migrated.sheetMaterials) && migrated.sheetMaterials.length === 1 && String(migrated.sheetMaterials[0].id || '') === 'stored_sheet', 'Migracja preferStoredSplit nie utrzymała zapisanej listy płyt', migrated);
          H.assert(Array.isArray(migrated.accessories) && migrated.accessories.length === 1 && String(migrated.accessories[0].id || '') === 'stored_acc', 'Migracja preferStoredSplit nie utrzymała zapisanej listy akcesoriów', migrated);
          H.assert(Array.isArray(migrated.quoteRates) && migrated.quoteRates.length === 1 && String(migrated.quoteRates[0].id || '') === 'stored_rate', 'Migracja preferStoredSplit nie utrzymała zapisanych stawek', migrated);
        } finally {
          const restore = (key, value)=> value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
          restore(keys.materials, prevMaterials);
          restore(keys.services, prevServices);
          restore(keys.sheetMaterials, prevSheet);
          restore(keys.accessories, prevAccessories);
          restore(keys.quoteRates, prevQuoteRates);
          try{ FC.catalogStore.migrateLegacy({ preferStoredSplit:true }); }catch(_){ }
        }
      }),
    ]);
  }

  FC.materialDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
