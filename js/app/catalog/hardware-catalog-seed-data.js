// js/app/catalog/hardware-catalog-seed-data.js
// Lista realnych startowych pozycji katalogu okuć. To są dane seedów, bez logiki storage/merge.
(function(){
  'use strict';
  window.FC = window.FC || {};

  const PRICE_DATE = '2026-05-07';
  const DEFAULT_MARKUP = 20;

  function seed(row){
    return Object.assign({
      hardwareCategory:'Inne',
      hardwareUnit:'szt.',
      supplierId:'bivert',
      vatRate:23,
      supplierDiscountPercent:0,
      quoteBase:'catalogGross',
      pricingMode:'markup',
      markupPercent:DEFAULT_MARKUP,
      priceUpdatedAt:PRICE_DATE,
      status:'active',
      bundleCostMode:'ownPrice',
      bundleItems:[],
    }, row || {});
  }

  const ACCESSORY_SEEDS = [
    seed({
      id:'hw_seed_blum_71b3550_173l6100',
      manufacturer:'Blum',
      symbol:'71B3550+173L6100',
      name:'Zawias nakładany CLIP TOP BLUMOTION 110° + prowadnik',
      hardwareCategory:'Zawiasy',
      hardwareUnit:'kpl.',
      series:'CLIP top BLUMOTION',
      catalogPriceGross:11.37,
      purchasePriceGross:11.37,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Cena startowa brutto z Bivert; przed realną ofertą sprawdzić aktualność i własny rabat.'
    }),
    seed({
      id:'hw_seed_blum_71b3750_110_inset',
      manufacturer:'Blum',
      symbol:'71B3750',
      name:'Zawias wpuszczany CLIP TOP BLUMOTION 110°',
      hardwareCategory:'Zawiasy',
      hardwareUnit:'szt.',
      series:'CLIP top BLUMOTION',
      catalogPriceGross:12.85,
      purchasePriceGross:12.85,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Pozycja do frontów wpuszczanych; przed ofertą dobrać właściwy prowadnik i sprawdzić cenę kompletu.'
    }),
    seed({
      id:'hw_seed_blum_71b7550_155_zero',
      manufacturer:'Blum',
      symbol:'71B7550+173L6100',
      name:'Zawias CLIP TOP BLUMOTION 155° zerowy uskok + prowadnik',
      hardwareCategory:'Zawiasy',
      hardwareUnit:'kpl.',
      series:'CLIP top BLUMOTION',
      catalogPriceGross:22.51,
      purchasePriceGross:22.51,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Zerowy uskok 155°; cena startowa brutto z Bivert.'
    }),
    seed({
      id:'hw_seed_blum_71t6550_170_corner',
      manufacturer:'Blum',
      symbol:'71T6550+174E6100',
      name:'Zawias CLIP TOP 170° do narożnej szafki L + prowadnik',
      hardwareCategory:'Zawiasy',
      hardwareUnit:'kpl.',
      series:'CLIP top',
      catalogPriceGross:13.48,
      purchasePriceGross:13.48,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Do szerokiego otwarcia / narożnych rozwiązań; dobrać zgodnie z konstrukcją szafki.'
    }),
    seed({
      id:'hw_seed_blum_79b9550_173l6130_parallel_inset',
      manufacturer:'Blum',
      symbol:'79B9550+173L6130',
      name:'Zawias równoległy wpuszczany CLIP TOP BLUMOTION 95° + prowadnik',
      hardwareCategory:'Zawiasy',
      hardwareUnit:'kpl.',
      series:'CLIP top BLUMOTION',
      catalogPriceGross:16.25,
      purchasePriceGross:16.25,
      priceSource:'Bivert',
      priceUpdatedAt:'2026-05-26',
      technicalParams:{
        nalozenie:{ value:'równoległy wpuszczany' },
        kat_otwarcia:{ from:95 },
        prowadnik:{ value:'specjalny' }
      },
      note:'Seed katalogu okuć. Realna pozycja Bivert dla rogowej ślepej: zawias równoległy wpuszczany 95° z prowadnikiem. Przed ofertą sprawdzić aktualność ceny.'
    }),
    seed({
      id:'hw_seed_blum_91k9550_194k6100_fridge_overlay',
      manufacturer:'Blum',
      symbol:'91K9550+194K6100',
      name:'Zawias lodówkowy nakładany MODUL 95° + prowadnik',
      hardwareCategory:'Zawiasy',
      hardwareUnit:'kpl.',
      series:'MODUL',
      catalogPriceGross:8.14,
      purchasePriceGross:8.14,
      priceSource:'Bivert',
      priceUpdatedAt:'2026-05-26',
      technicalParams:{
        nalozenie:{ value:'lodówkowy nakładany' },
        kat_otwarcia:{ from:95 },
        prowadnik:{ value:'specjalny' }
      },
      note:'Seed katalogu okuć. Realny komplet Bivert do frontów lodówki: zawias 91K9550 + prowadnik 194K6100E. Przed ofertą sprawdzić aktualność ceny.'
    }),
    seed({
      id:'hw_seed_gtv_fchc_110_soft_euro',
      manufacturer:'GTV',
      symbol:'FCHC 110° + euro',
      name:'Zawias GTV 110° cichy domyk clip-on + eurowkręty',
      hardwareCategory:'Zawiasy',
      hardwareUnit:'kpl.',
      series:'GTV FCHC',
      supplierId:'local',
      catalogPriceGross:8.00,
      purchasePriceGross:8.00,
      priceSource:'Filon / cena do weryfikacji',
      note:'Seed odpowiednika GTV. Nie jest to pozycja Bivert; przed ofertą sprawdzić realne źródło zakupu i czy wariant ma wymaganą regulację.'
    }),
    seed({
      id:'hw_seed_blum_tandembox_m_450_30kg',
      manufacturer:'Blum',
      symbol:'TANDEMBOX M 450 30kg',
      name:'Szuflada TANDEMBOX z BLUMOTION M 450 mm 30 kg',
      hardwareCategory:'Szuflady / prowadnice',
      hardwareUnit:'kpl.',
      series:'TANDEMBOX antaro',
      catalogPriceGross:126.45,
      purchasePriceGross:126.45,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Komplet startowy do późniejszego wyboru szuflad; kolor/wysokość/długość sprawdzić przed ofertą.'
    }),
    seed({
      id:'hw_seed_blum_tandembox_d_300_30kg',
      manufacturer:'Blum',
      symbol:'TANDEMBOX D 300 30kg',
      name:'Szuflada TANDEMBOX z BLUMOTION D 300 mm 30 kg',
      hardwareCategory:'Szuflady / prowadnice',
      hardwareUnit:'kpl.',
      series:'TANDEMBOX antaro',
      catalogPriceGross:151.99,
      purchasePriceGross:151.99,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Cena startowa brutto z Bivert; wariant do weryfikacji przy konkretnym projekcie.'
    }),
    seed({
      id:'hw_seed_rejs_comfort_box_plus_h69_500',
      manufacturer:'Rejs',
      symbol:'TH03.1293.05.003',
      name:'Szuflada REJS Comfort Box Plus H69 L500 biała',
      hardwareCategory:'Szuflady / prowadnice',
      hardwareUnit:'kpl.',
      series:'Comfort Box Plus',
      supplierId:'local',
      catalogPriceGross:115.28,
      purchasePriceGross:115.28,
      priceSource:'BIMEB',
      note:'Seed katalogu okuć. Cena startowa brutto z BIMEB; przed ofertą sprawdzić kolor, wysokość i dostępność.'
    }),
    seed({
      id:'hw_seed_rejs_comfort_box_h140_500',
      manufacturer:'Rejs',
      symbol:'Comfort Box L500 H140',
      name:'Szuflada REJS Comfort Box L500 H140 średnia biała',
      hardwareCategory:'Szuflady / prowadnice',
      hardwareUnit:'kpl.',
      series:'Comfort Box',
      supplierId:'local',
      catalogPriceGross:78.25,
      purchasePriceGross:78.25,
      priceSource:'Akcesoria Matryk',
      note:'Seed katalogu okuć. Cena startowa brutto ze sklepu internetowego; traktować jako punkt odniesienia.'
    }),
    seed({
      id:'hw_seed_gtv_modern_box_b_500',
      manufacturer:'GTV',
      symbol:'PB-KW-KPL500B',
      name:'Szuflada GTV Modern Box średnia L500 szara',
      hardwareCategory:'Szuflady / prowadnice',
      hardwareUnit:'kpl.',
      series:'Modern Box',
      supplierId:'local',
      catalogPriceGross:83.69,
      purchasePriceGross:83.69,
      priceSource:'Akcesoria za grosze / do weryfikacji',
      note:'Seed odpowiednika GTV. Cena startowa do porównania z Blum/Rejs; przed ofertą sprawdzić realnego dostawcę.'
    }),
    seed({
      id:'hw_seed_peka_snello_150_white',
      manufacturer:'Peka',
      symbol:'04.801.B',
      name:'PEKA Cargo SNELLO 150 białe',
      hardwareCategory:'Cargo / organizery',
      hardwareUnit:'kpl.',
      series:'SNELLO',
      catalogPriceGross:416.80,
      purchasePriceGross:416.80,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Cena startowa brutto z Bivert; szerokość i kolor dobrać do projektu.'
    }),
    seed({
      id:'hw_seed_peka_snello_fioro_200_anthracite',
      manufacturer:'Peka',
      symbol:'04.2802.KPL',
      name:'PEKA SNELLO FIORO 200 antracyt podblatowe cargo',
      hardwareCategory:'Cargo / organizery',
      hardwareUnit:'kpl.',
      series:'SNELLO FIORO',
      catalogPriceGross:758.89,
      purchasePriceGross:758.89,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Cena startowa brutto z Bivert; traktować jako wariant premium cargo podblatowego.'
    }),
    seed({
      id:'hw_seed_nomet_w2334m_150l_p22',
      manufacturer:'Nomet',
      symbol:'W-2334M-150L.P22',
      name:'NOMET cargo 150 Standard Pro 3 poziomy lewe srebrne',
      hardwareCategory:'Cargo / organizery',
      hardwareUnit:'kpl.',
      series:'STANDARD PRO',
      catalogPriceGross:211.08,
      purchasePriceGross:211.08,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Cena startowa brutto z Bivert; wariant tańszy od Peka do porównań.'
    }),
    seed({
      id:'hw_seed_nomet_w5600_500_g2',
      manufacturer:'Nomet',
      symbol:'W-5600-500.G2',
      name:'NOMET Cargo MAXI 500 Prestige 6 półek chrom',
      hardwareCategory:'Cargo / organizery',
      hardwareUnit:'kpl.',
      series:'PRESTIGE',
      catalogPriceGross:1874.21,
      purchasePriceGross:1874.21,
      priceSource:'Bivert',
      note:'Seed katalogu okuć. Cena startowa brutto z Bivert dla wysokiego cargo; przed ofertą sprawdzić wysokość i wersję.'
    })
  ];


  window.FC.hardwareCatalogSeedData = {
    VERSION:'hardware_catalog_seed_v1',
    PRICE_DATE,
    ACCESSORY_SEEDS,
  };
})();
