// js/app/catalog/hardware-catalog-seeds.js
// Merge realnych seedów okuć do katalogu bez nadpisywania ręcznie edytowanych rekordów użytkownika.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const seedData = FC.hardwareCatalogSeedData || {};
  const ACCESSORY_SEEDS = Array.isArray(seedData.ACCESSORY_SEEDS) ? seedData.ACCESSORY_SEEDS : [];
  const PRICE_DATE = seedData.PRICE_DATE || '2026-05-07';

  const LEGACY_PLACEHOLDER = {
    id:'a1',
    manufacturer:'Blum',
    symbol:'B1',
    name:'Zawias Blum'
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function key(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function clone(value){
    try{ return (FC.utils && typeof FC.utils.clone === 'function') ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }
  function signature(row){
    const src = row || {};
    return [key(src.manufacturer), key(src.symbol), key(src.name)].join('|');
  }
  function isLegacyPlaceholder(row){
    const src = row || {};
    return text(src.id) === LEGACY_PLACEHOLDER.id
      && key(src.manufacturer) === key(LEGACY_PLACEHOLDER.manufacturer)
      && key(src.symbol) === key(LEGACY_PLACEHOLDER.symbol)
      && key(src.name) === key(LEGACY_PLACEHOLDER.name)
      && !text(src.priceSource)
      && !text(src.note);
  }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function hasCommercialValues(row){
    const src = row || {};
    return !!text(src.priceSource)
      || !!text(src.note)
      || number(src.catalogPriceGross) > 0
      || number(src.purchasePriceGross) > 0
      || number(src.price) > 0;
  }
  function findSeedFor(row){
    const id = text(row && row.id);
    const sig = signature(row);
    return ACCESSORY_SEEDS.find((seedRow)=> text(seedRow && seedRow.id) === id || signature(seedRow) === sig) || null;
  }
  function mergeAccessorySeeds(list){
    const rows = (Array.isArray(list) ? list : [])
      .filter((row)=> !isLegacyPlaceholder(row))
      .map((row)=>{
        const seedRow = findSeedFor(row);
        if(seedRow && !hasCommercialValues(row)) return clone(seedRow);
        return Object.assign({}, row);
      });
    const ids = new Set(rows.map((row)=> text(row && row.id)).filter(Boolean));
    const signatures = new Set(rows.map(signature));
    ACCESSORY_SEEDS.forEach((row)=>{
      const id = text(row && row.id);
      const sig = signature(row);
      if(!id || ids.has(id) || signatures.has(sig)) return;
      rows.push(clone(row));
      ids.add(id);
      signatures.add(sig);
    });
    return rows;
  }

  FC.hardwareCatalogSeeds = {
    VERSION:'hardware_catalog_seed_v1',
    PRICE_DATE,
    ACCESSORY_SEEDS: clone(ACCESSORY_SEEDS),
    isLegacyPlaceholder,
    mergeAccessorySeeds,
  };
})();
