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
    ]);
  }

  FC.materialDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
