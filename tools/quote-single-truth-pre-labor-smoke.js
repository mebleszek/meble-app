#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){
      try{ console.error(JSON.stringify(details, null, 2)); }
      catch(_){ console.error(details); }
    }
    process.exit(1);
  }
}
function near(actual, expected, tolerance, msg){
  const a = Number(actual);
  const e = Number(expected);
  assert(Number.isFinite(a) && Math.abs(a - e) <= tolerance, `${msg}: expected ${e}, got ${actual}`);
}
function round(value, digits){
  const f = Math.pow(10, digits || 3);
  return Math.round((Number(value) || 0) * f) / f;
}
function slug(value){
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'x';
}
function createStorage(){
  const data = new Map();
  return {
    getItem(key){ return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value){ data.set(String(key), String(value)); },
    removeItem(key){ data.delete(String(key)); },
    clear(){ data.clear(); }
  };
}
function load(ctx, files){
  files.forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
}

function normalizeFrontSourceMaterial(material){
  const raw = String(material || '').trim();
  const m = raw.match(/^\s*Front\s*:\s*[^•]+?\s*•\s*(.+)$/i);
  return m ? String(m[1] || '').trim() : raw;
}
function areaM2FromCmParts(parts){
  return round((Array.isArray(parts) ? parts : []).reduce((sum, part)=>{
    return sum + ((Number(part && part.a) || 0) * (Number(part && part.b) || 0) * (Number(part && part.qty) || 0)) / 10000;
  }, 0), 3);
}
function sumMaterialTotalsForRooms(FC, rooms, materialName){
  const edgeApi = FC.materialEdgeStore.createEdgeStore({ persist:false });
  let total = 0;
  (Array.isArray(rooms) ? rooms : []).forEach((room)=>{
    const model = FC.materialTabData.collectRoomMaterials(room, { edgeApi });
    Object.entries(model.projectTotals || {}).forEach(([material, value])=>{
      if(normalizeFrontSourceMaterial(material) === materialName) total += Number(value) || 0;
    });
  });
  return round(total, 3);
}
function sourceFrontAreaForRooms(projectData, cutlists, rooms, materialName){
  const parts = [];
  rooms.forEach((room)=>{
    const cabs = projectData[room] && projectData[room].cabinets || [];
    cabs.forEach((cab)=>{
      (cutlists[cab.id] || []).forEach((part)=>{
        if(String(part && part.name || '').trim() !== 'Front') return;
        if(normalizeFrontSourceMaterial(part.material) === materialName) parts.push(part);
      });
    });
  });
  return areaM2FromCmParts(parts);
}

async function runMaterialQuoteParity(){
  const FC = {};
  const localStorage = createStorage();
  const materials = [
    { id:'mat_egger', materialType:'laminat', manufacturer:'Egger', symbol:'W1100', name:'Egger W1100 ST9 Biały Alpejski', price:280, priceUnit:'sheet', starterPrice:true },
    { id:'mat_lakier', materialType:'lakier', manufacturer:'Start', symbol:'LAK-STD', name:'Front lakierowany standard', price:450, priceUnit:'m2', starterPrice:true },
    { id:'mat_akryl', materialType:'akryl', manufacturer:'Rehau', symbol:'AKR-BIALY', name:'Akryl Biały', price:380, priceUnit:'m2', starterPrice:true },
    { id:'mat_hdf', materialType:'hdf', manufacturer:'Start', symbol:'HDF-3', name:'HDF 3mm biała', price:18, priceUnit:'m2', starterPrice:true },
    { id:'mat_pcv', materialType:'obrzeże', manufacturer:'Start', symbol:'PCV-STD', name:'Obrzeże PCV standard', price:3, priceUnit:'mb', starterPrice:true },
  ];
  const projectData = {
    room_one:{ cabinets:[{ id:'cab_one', type:'stojąca', subType:'drzwi' }] },
    room_multi:{ cabinets:[{ id:'cab_multi_a', type:'stojąca', subType:'szuflada_drzwi' }, { id:'cab_multi_b', type:'moduł', subType:'standard' }] },
  };
  const cutlists = {
    cab_one:[
      { name:'Bok', qty:2, a:72, b:51, material:'Egger W1100 ST9 Biały Alpejski' },
      { name:'Front', qty:2, a:30, b:72, material:'Front: lakier • Front lakierowany standard' },
      { name:'Plecy', qty:1, a:59.5, b:81.5, material:'HDF 3mm biała' },
    ],
    cab_multi_a:[
      { name:'Bok', qty:2, a:72, b:51, material:'Egger W1100 ST9 Biały Alpejski' },
      { name:'Front', qty:1, a:60, b:20, material:'Front: akryl • Akryl Biały' },
      { name:'Front', qty:2, a:30, b:52, material:'Front: akryl • Akryl Biały' },
      { name:'Plecy', qty:1, a:59.5, b:81.5, material:'HDF 3mm biała' },
    ],
    cab_multi_b:[
      { name:'Półka', qty:1, a:56.4, b:50.5, material:'Egger W1100 ST9 Biały Alpejski' },
      { name:'Front', qty:1, a:66, b:105, material:'Front: laminat • Egger W1100 ST9 Biały Alpejski' },
      { name:'Plecy', qty:1, a:65.5, b:104.5, material:'HDF 3mm biała' },
    ],
  };
  const ctx = {
    window:{ FC, localStorage, projectData },
    FC,
    console,
    localStorage,
    materials,
    projectData,
    document:{ getElementById(){ return null; } },
    setTimeout,
    clearTimeout,
    getCabinetCutList(cab){ return (cutlists[cab && cab.id] || []).map((part)=> Object.assign({}, part)); },
  };
  ctx.globalThis = ctx.window;
  FC.utils = { clone:v=> JSON.parse(JSON.stringify(v)), slug };
  FC.wycenaCoreUtils = { clone:v=> JSON.parse(JSON.stringify(v)), slug };
  FC.catalogStore = function(){ return { getMaterials(){ return materials.slice(); } }; };
  FC.wycenaCoreCatalog = {
    materialPriceLookup(name){ return materials.find((row)=> String(row.name) === String(name)) || null; },
  };
  FC.wycenaCoreSource = {
    getScopedMaterials(aggregate){ return Array.isArray(aggregate && aggregate.materials) ? aggregate.materials.slice() : Object.keys((aggregate && aggregate.groups) || {}); },
    roomLabel(id){ return id === 'room_one' ? 'Pojedynczy' : (id === 'room_multi' ? 'Kilka' : String(id || '')); },
  };
  FC.wycenaCoreSelection = {
    decodeMaterialScope(selection){ return (selection && selection.materialScope) || { kind:'all', material:'', includeFronts:true, includeCorpus:true }; },
  };
  vm.createContext(ctx);
  load(ctx, [
    'js/app/material/material-common.js',
    'js/app/material/material-part-options.js',
    'js/app/material/material-edge-store.js',
    'js/app/material/material-tab-data.js',
    'js/app/rozrys/rozrys-scope.js',
    'js/app/rozrys/rozrys-part-helpers.js',
    'js/app/wycena/wycena-core-material-plan.js',
  ]);
  const helper = FC.rozrysPartHelpers.createApi({ FC, host:ctx.window, cmToMm:(v)=> Math.round((Number(v) || 0) * 10) });
  function aggregate(rooms){
    return FC.rozrysScope.aggregatePartsForProject(rooms, {
      safeGetProject:()=> projectData,
      getCabinetCutList:ctx.getCabinetCutList,
      resolveRozrysPartFromSource:helper.resolveRozrysPartFromSource,
      isFrontMaterialKey:helper.isFrontMaterialKey,
    });
  }
  async function quoteLinesFor(rooms){
    return FC.wycenaCoreMaterialPlan.collectMaterialLines(aggregate(rooms), { materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } });
  }
  async function assertHdfParity(rooms, label){
    const lines = await quoteLinesFor(rooms);
    const hdf = lines.find((row)=> row.name === 'HDF 3mm biała');
    const materialHdf = sumMaterialTotalsForRooms(FC, rooms, 'HDF 3mm biała');
    assert(hdf, `${label}: WYCENA musi mieć linię HDF`, lines);
    near(hdf.qty, materialHdf, 0.001, `${label}: HDF MATERIAŁ ↔ WYCENA`);
  }
  await assertHdfParity(['room_one'], 'jedna szafka');
  await assertHdfParity(['room_multi'], 'kilka szafek');
  await assertHdfParity(['room_one', 'room_multi'], 'wybór projektu/pokoi');

  const allRooms = ['room_one', 'room_multi'];
  const lines = await quoteLinesFor(allRooms);
  const lakier = lines.find((row)=> row.name === 'Front lakierowany standard');
  const akryl = lines.find((row)=> row.name === 'Akryl Biały');
  assert(lakier, 'WYCENA musi normalizować Front: lakier • X do pozycji cennika X', lines);
  assert(akryl, 'WYCENA musi normalizować Front: akryl • X do pozycji cennika X', lines);
  near(lakier.qty, sumMaterialTotalsForRooms(FC, allRooms, 'Front lakierowany standard'), 0.001, 'front lakier MATERIAŁ ↔ WYCENA m²');
  near(akryl.qty, sumMaterialTotalsForRooms(FC, allRooms, 'Akryl Biały'), 0.001, 'front akryl MATERIAŁ ↔ WYCENA m²');

  const agg = aggregate(allRooms);
  const eggerGroup = agg.groups['Egger W1100 ST9 Biały Alpejski'];
  assert(eggerGroup && Array.isArray(eggerGroup.frontParts) && eggerGroup.frontParts.length === 1, 'Front laminat ma trafić do wspólnej grupy arkuszowej Egger, nie do osobnego klucza Front: laminat', eggerGroup);
  near(round((eggerGroup.frontParts[0].w * eggerGroup.frontParts[0].h * eggerGroup.frontParts[0].qty) / 1000000, 3), sourceFrontAreaForRooms(projectData, cutlists, allRooms, 'Egger W1100 ST9 Biały Alpejski'), 0.001, 'front laminat w agregacie ROZRYS/WYCENA ma zgadzać się ze źródłem MATERIAŁU');

  const edgeBasis = FC.materialTabData.collectEdgeMetersForRooms(allRooms, { persist:false, materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } });
  const edgeLine = lines.find((row)=> row.pricingMode === 'edge');
  assert(edgeLine, 'WYCENA musi mieć linię PCV/obrzeża z edge store dla laminatu');
  near(edgeLine.edgeRawMeters, edgeBasis.edgeMeters, 0.001, 'raw PCV WYCENA = MATERIAŁ/edge store');
  near(edgeLine.qty, round(edgeBasis.edgeMeters * 1.1, 3), 0.001, 'WYCENA dolicza tylko +10% zapasu od surowych mb MATERIAŁU');
}

function runRegisterSnapshotTruth(){
  const FC = { utils:{ clone:v=> JSON.parse(JSON.stringify(v)), slug }, wycenaCoreUtils:{ slug } };
  const ctx = { window:{ FC }, FC, console };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  load(ctx, ['js/app/quote/quote-calculation-register.js', 'js/app/quote/quote-snapshot.js']);
  const inputLines = {
    materials:[{ key:'mat', name:'Płyta test', qty:2, unit:'ark.', unitPrice:100, total:200 }],
    accessories:[{ key:'acc', name:'Zawias test', qty:4, unit:'kpl.', unitPrice:10, total:40 }],
    labor:[{ key:'lab_cab', name:'Szafka #1', total:60, details:[{ key:'lab_1', name:'Skręcanie', quantity:1, unit:'x', total:60, hours:2, hourlyRate:30 }] }],
    quoteRates:[{ key:'manual', name:'Ręczna pozycja robocizny', qty:1, unit:'x', unitPrice:25, total:25 }],
    agdServices:[{ key:'agd', name:'Zmywarka do zabudowy', qty:1, unit:'szt.', unitPrice:170, total:170 }],
  };
  const register = FC.quoteCalculationRegister.buildRegister(inputLines, { discountPercent:10 });
  near(register.totals.materials, 200, 0.001, 'register: materiały');
  near(register.totals.accessories, 40, 0.001, 'register: akcesoria');
  near(register.totals.labor, 60, 0.001, 'register: robocizna szafek');
  near(register.totals.quoteRates, 25, 0.001, 'register: robocizna/stawki');
  near(register.totals.services, 170, 0.001, 'register: montaż AGD');
  near(register.totals.subtotal, 495, 0.001, 'register: suma przed rabatem');
  near(register.totals.discount, 49.5, 0.001, 'register: rabat');
  near(register.totals.grand, 445.5, 0.001, 'register: razem');

  const snapshot = FC.quoteSnapshot.buildSnapshot({
    materialLines:inputLines.materials,
    accessoryLines:inputLines.accessories,
    laborLines:inputLines.labor,
    quoteRateLines:inputLines.quoteRates,
    agdLines:inputLines.agdServices,
    calculationRegister:register,
    totals:{ materials:9999, accessories:9999, services:9999, quoteRates:9999, labor:9999, subtotal:9999, discount:0, grand:9999 },
    commercial:{ discountPercent:10, versionName:'Test rejestru' },
  });
  near(snapshot.totals.materials, register.totals.materials, 0.001, 'snapshot ma brać materiały z rejestru, nie z podanych bokiem totals');
  near(snapshot.totals.grand, register.totals.grand, 0.001, 'snapshot ma brać razem z rejestru, nie z podanych bokiem totals');
  assert(snapshot.calculationRegister && snapshot.calculationRegister.lines.length === register.lines.length, 'snapshot zapisuje calculationRegister dla audytu i historii', snapshot.meta);

  const coreSrc = fs.readFileSync(path.join(root, 'js/app/wycena/wycena-core.js'), 'utf8');
  assert(coreSrc.includes('FC.quoteCalculationRegister.buildRegister'), 'collectQuoteData musi budować calculationRegister');
  assert(coreSrc.includes('(calculationRegister && calculationRegister.totals)'), 'collectQuoteData musi przekazywać sumy z rejestru do totals');
  const detailsSrc = fs.readFileSync(path.join(root, 'js/app/wycena/wycena-summary-details-modal.js'), 'utf8');
  assert(detailsSrc.includes('snap.calculationRegister && snap.calculationRegister.lines'), 'audyt ma preferować calculationRegister ze snapshotu');
}

function runSupplierPriceQuoteFlag(){
  const FC = { utils:{ clone:v=> JSON.parse(JSON.stringify(v)), uid:()=> 'id_' + Math.random().toString(36).slice(2) } };
  const ctx = { window:{ FC }, FC, console, localStorage:createStorage() };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  load(ctx, ['js/app/catalog/hardware-catalog.js']);
  assert(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeAccessory === 'function', 'brak normalizeAccessory');
  const suppliers = [{ id:'a', name:'Dostawca A' }, { id:'b', name:'Dostawca B' }];
  const marked = FC.hardwareCatalog.normalizeAccessory({
    id:'hw_marked', manufacturer:'Test', name:'Zawias test', hardwareCategory:'Zawiasy', hardwareUnit:'kpl.',
    supplierPrices:[
      { supplierId:'a', catalogPriceGross:10, useForQuote:false },
      { supplierId:'b', catalogPriceGross:20, useForQuote:true },
    ],
  }, ()=> 'hw_marked', { hardwareSuppliers:suppliers, defaultMarkupPercent:20, defaultQuoteBase:'catalogGross', defaultPricingMode:'markup' });
  near(marked.catalogPriceGross, 20, 0.001, 'oznaczona cena dostawcy Do wyceny ma być bazą ceny katalogowej');
  near(marked.price, 24, 0.001, 'WYCENA ma użyć oznaczonej ceny dostawcy z narzutem');
  assert(marked.supplierPrices.filter((row)=> row.useForQuote).length === 1 && marked.supplierId === 'b', 'po normalizacji dokładnie jedna cena dostawcy jest Do wyceny', marked.supplierPrices);

  const unmarked = FC.hardwareCatalog.normalizeAccessory({
    id:'hw_unmarked', manufacturer:'Test', name:'Zawias bez flagi', hardwareCategory:'Zawiasy', hardwareUnit:'kpl.',
    supplierPrices:[
      { supplierId:'a', catalogPriceGross:10 },
      { supplierId:'b', catalogPriceGross:20 },
    ],
  }, ()=> 'hw_unmarked', { hardwareSuppliers:suppliers, defaultMarkupPercent:20, defaultQuoteBase:'catalogGross', defaultPricingMode:'markup' });
  assert(unmarked.supplierPrices.filter((row)=> row.useForQuote).length === 0, 'brak flagi Do wyceny przy wielu dostawcach zostaje nieoznaczony — to ryzyko, nie finalny model', unmarked.supplierPrices);
  near(unmarked.catalogPriceGross, 10, 0.001, 'obecne zachowanie bez flagi: fallback bierze pierwszą cenę z katalogu');
  near(unmarked.price, 12, 0.001, 'obecne zachowanie bez flagi: fallback pierwszej ceny przechodzi do ceny do wyceny');
}

(async()=>{
  await runMaterialQuoteParity();
  runRegisterSnapshotTruth();
  runSupplierPriceQuoteFlag();
  console.log('OK quote-single-truth-pre-labor smoke');
})().catch((err)=>{
  console.error(err && err.stack || err);
  process.exit(1);
});
