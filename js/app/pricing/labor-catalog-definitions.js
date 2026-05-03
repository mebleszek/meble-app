// js/app/pricing/labor-catalog-definitions.js
// Stałe i domyślne definicje robocizny używane przez uniwersalny katalog robocizny.
(function(){
  'use strict';
  window.FC = window.FC || {};

  const RATE_TYPES = [
    { key:'workshop', label:'Warsztatowa' },
    { key:'assembly', label:'Montażowa' },
    { key:'helper', label:'Pomocnik' },
    { key:'specialist', label:'Specjalistyczna' },
  ];

  const USAGE_TYPES = [
    { key:'manual', label:'Ręcznie w WYCENIE' },
    { key:'cabinet', label:'Szafka — dodatki' },
    { key:'room', label:'Pomieszczenie' },
    { key:'project', label:'Projekt' },
  ];

  const AUTO_ROLES = [
    { key:'none', label:'Brak automatu' },
    { key:'hourlyRate', label:'Stawka godzinowa' },
    { key:'cabinetBody', label:'Skręcenie korpusu wg wysokości' },
    { key:'cabinetLooseShelves', label:'Półki z danych szafki' },
  ];

  const QUANTITY_MODES = [
    { key:'none', label:'Bez ilości' },
    { key:'linear', label:'Liniowo: czas × ilość' },
    { key:'tiers', label:'Pakiety/progi ilościowe' },
    { key:'startStep', label:'Start + kolejne sztuki' },
  ];

  const DEFAULT_HOURLY_RATES = [
    { id:'labor_rate_workshop', category:'Stawki godzinowe', name:'Stawka warsztatowa', price:120, autoRole:'hourlyRate', rateKey:'workshop', usage:'project', active:true },
    { id:'labor_rate_assembly', category:'Stawki godzinowe', name:'Stawka montażowa', price:140, autoRole:'hourlyRate', rateKey:'assembly', usage:'project', active:true },
    { id:'labor_rate_helper', category:'Stawki godzinowe', name:'Stawka pomocnika', price:60, autoRole:'hourlyRate', rateKey:'helper', usage:'project', active:true },
    { id:'labor_rate_specialist', category:'Stawki godzinowe', name:'Stawka specjalistyczna', price:180, autoRole:'hourlyRate', rateKey:'specialist', usage:'project', active:true },
  ];

  const DEFAULT_LABOR_DEFINITIONS = [
    { id:'labor_body_h072', category:'Korpusy', name:'Skręcenie korpusu do 72 cm', price:0, usage:'cabinet', autoRole:'cabinetBody', rateType:'workshop', timeBlockHours:0.5, defaultMultiplier:1.25, heightMinMm:0, heightMaxMm:720, volumePricePerM3:50, active:true, internalOnly:true },
    { id:'labor_body_h150', category:'Korpusy', name:'Skręcenie korpusu do 150 cm', price:0, usage:'cabinet', autoRole:'cabinetBody', rateType:'workshop', timeBlockHours:1, defaultMultiplier:1.15, heightMinMm:721, heightMaxMm:1500, volumePricePerM3:50, active:true, internalOnly:true },
    { id:'labor_body_h225', category:'Korpusy', name:'Skręcenie korpusu do 225 cm', price:0, usage:'cabinet', autoRole:'cabinetBody', rateType:'workshop', timeBlockHours:1, defaultMultiplier:1.6, heightMinMm:1501, heightMaxMm:2250, volumePricePerM3:50, active:true, internalOnly:true },
    { id:'labor_body_h999', category:'Korpusy', name:'Skręcenie korpusu powyżej 225 cm', price:0, usage:'cabinet', autoRole:'cabinetBody', rateType:'workshop', timeBlockHours:1, defaultMultiplier:2.2, heightMinMm:2251, heightMaxMm:99999, volumePricePerM3:50, active:true, internalOnly:true },
    { id:'labor_loose_shelves', category:'Elementy szafki', name:'Półki luźne — pakiet', price:0, usage:'cabinet', autoRole:'cabinetLooseShelves', rateType:'workshop', quantityMode:'tiers', quantityTiers:[{ min:1, max:2, hours:0.25 },{ min:3, max:5, hours:0.5 },{ min:6, max:10, hours:1 }], active:true, internalOnly:true },
    { id:'labor_hole_fi60', category:'Usługi przy szafce', name:'Otwór fi 60', price:0, usage:'cabinet', autoRole:'none', rateType:'workshop', timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_cutout', category:'Usługi przy szafce', name:'Wcięcie na rury', price:0, usage:'cabinet', autoRole:'none', rateType:'workshop', timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_pipe_boxing', category:'Usługi przy szafce', name:'Zabudowa rur', price:0, usage:'cabinet', autoRole:'none', rateType:'workshop', timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true },
    { id:'labor_vertical_partition_long', category:'Elementy szafki', name:'Przegroda pionowa długa', price:0, usage:'cabinet', autoRole:'none', rateType:'workshop', timeBlockHours:0.5, defaultMultiplier:1.25, quantityMode:'linear', active:true, internalOnly:true },
  ];


  window.FC.laborCatalogDefinitions = {
    RATE_TYPES,
    USAGE_TYPES,
    AUTO_ROLES,
    QUANTITY_MODES,
    DEFAULT_HOURLY_RATES,
    DEFAULT_LABOR_DEFINITIONS,
  };
})();
