(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function runAll(){
    return H.runSuite('WYCENA smoke testy', [
      H.makeTest('Wycena', 'Katalog usług AGD uzupełnia brakujące pozycje bez duplikowania istniejących', 'Pilnuje, czy Wycena zawsze ma osobne pozycje montażu AGD i czy kolejne przebiegi nie rozmnażają usług.', ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.ensureServiceCatalog === 'function', 'Brak wycenaCore.ensureServiceCatalog');
        const input = [
          { id:'svc_1', category:'AGD', name:'Piekarnik do zabudowy', price:111 },
          { id:'svc_2', category:'Montaż', name:'Montaż blatu', price:80 }
        ];
        const result = FC.wycenaCore.ensureServiceCatalog(input);
        H.assert(result && Array.isArray(result.list), 'ensureServiceCatalog nie zwrócił listy', result);
        const oven = result.list.filter((item)=> String(item && item.name || '') === 'Piekarnik do zabudowy');
        H.assert(oven.length === 1, 'Usługa AGD została zduplikowana', result.list);
        H.assert(result.list.some((item)=> String(item && item.name || '') === 'Zmywarka do zabudowy'), 'Brakuje domyślnej usługi AGD dla zmywarki', result.list);
      }),
      H.makeTest('Wycena', 'Price modal buduje aplikacyjne listy wyboru dla kategorii i producentów', 'Pilnuje, czy cennik może przejść z systemowych selectów na nasze launchery bez gubienia list danych.', ()=>{
        H.assert(FC.priceModal && FC.priceModal._debug, 'Brak debug helpers w priceModal');
        const cats = FC.priceModal._debug.buildServiceCategoryOptions('AGD');
        H.assert(Array.isArray(cats) && cats.some((item)=> String(item && item.value || '') === 'AGD'), 'Lista kategorii nie zawiera AGD', cats);
        const manufacturers = FC.priceModal._debug.buildManufacturerOptions('laminat', 'Egger');
        H.assert(Array.isArray(manufacturers) && manufacturers.some((item)=> String(item && item.value || '') === 'Egger'), 'Lista producentów nie zachowała lub nie dodała wybranego producenta', manufacturers);
      }),
    ]);
  }

  FC.wycenaDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
