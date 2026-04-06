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
      H.makeTest('Wycena', 'Price modal buduje pełniejsze listy wyboru i filtry dla cennika', 'Pilnuje, czy cennik ma własne filtry, zachowuje producentów z registry i nie gubi opcji „wszystkie”.', ()=>{
        H.assert(FC.priceModal && FC.priceModal._debug, 'Brak debug helpers w priceModal');
        const cats = FC.priceModal._debug.buildServiceCategoryOptions('AGD', { includeAll:true });
        H.assert(Array.isArray(cats) && cats.some((item)=> String(item && item.value || '') === 'AGD'), 'Lista kategorii nie zawiera AGD', cats);
        H.assert(cats.some((item)=> String(item && item.value || '') === ''), 'Lista kategorii nie ma opcji wszystkich', cats);
        const manufacturers = FC.priceModal._debug.buildManufacturerOptions('akcesoria', 'Blum', { includeAll:true });
        H.assert(Array.isArray(manufacturers) && manufacturers.some((item)=> /blum/i.test(String(item && item.value || ''))), 'Lista producentów akcesoriów nie zawiera Blum', manufacturers);
        H.assert(manufacturers.some((item)=> String(item && item.value || '') === ''), 'Lista producentów nie ma opcji wszystkich', manufacturers);
        const editManufacturers = FC.priceModal._debug.buildManufacturerOptions('akcesoria', 'Blum');
        H.assert(!editManufacturers.some((item)=> /brak/i.test(String(item && item.label || ''))), 'Do wyboru producenta wróciła pseudo-opcja Brak / własny wpis', editManufacturers);
        const materialTypes = FC.priceModal._debug.buildMaterialTypeOptions('akcesoria', { includeAll:true });
        H.assert(materialTypes.some((item)=> String(item && item.value || '') === 'akcesoria'), 'Lista typów materiału nie zawiera akcesoriów', materialTypes);
      }),
    ]);
  }

  FC.wycenaDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
