#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond){ throw new Error(msg); } }
function near(actual, expected, tolerance, msg){
  const a = Number(actual);
  assert(Math.abs(a - expected) <= tolerance, `${msg}: expected ${expected}, got ${actual}`);
}

function makeLocalStorage(){
  const state = new Map();
  return {
    getItem(key){ return state.has(String(key)) ? state.get(String(key)) : null; },
    setItem(key, value){ state.set(String(key), String(value)); },
    removeItem(key){ state.delete(String(key)); },
    clear(){ state.clear(); },
  };
}

function createContext(){
  const FC = {};
  const egger = 'Egger W1100 ST9 Biały Alpejski';
  const parts = [
    { name:'Półka', qty:1, a:56.4, b:50.5, material:egger },
    { name:'Front', qty:2, a:30, b:72, material:`Front: laminat • ${egger}` },
    { name:'Front', qty:1, a:30, b:72, material:'Front: lakier • Front lakierowany standard' },
    { name:'Bok', qty:1, a:60, b:50, material:'Front lakierowany standard' },
    { name:'Plecy', qty:1, a:59.5, b:81.5, material:'HDF 3mm biała' },
  ];
  const materials = [
    { id:'m1', materialType:'laminat', manufacturer:'Egger', symbol:'W1100', name:egger, price:280, priceUnit:'sheet', starterPrice:true },
    { id:'m2', materialType:'lakier', manufacturer:'Start', symbol:'LAK-MAT', name:'Front lakierowany standard', price:450, priceUnit:'m2', starterPrice:true },
    { id:'m3', materialType:'akryl', manufacturer:'Rehau', symbol:'A01', name:'Akryl Biały', price:380, priceUnit:'m2', starterPrice:true },
    { id:'m4', materialType:'hdf', manufacturer:'Start', symbol:'HDF-3-BIALY', name:'HDF 3mm biała', price:18, priceUnit:'m2', starterPrice:true },
    { id:'m5', materialType:'obrzeże', manufacturer:'Start', symbol:'PCV-STD', name:'Obrzeże PCV standard', price:3, priceUnit:'mb', starterPrice:true },
  ];
  const localStorage = makeLocalStorage();
  const ctx = {
    window:{ FC },
    console,
    document:{ getElementById(){ return null; } },
    localStorage,
    setTimeout,
    clearTimeout,
    materials,
    projectData:{ room_a:{ cabinets:[{ id:'cab_a', type:'stojąca', subType:'drzwi' }] } },
    getCabinetCutList(){ return parts.map((p)=> Object.assign({}, p)); },
  };
  ctx.globalThis = ctx.window;
  ctx.window.localStorage = localStorage;
  FC.catalogStore = function(){ return { getMaterials(){ return materials.slice(); } }; };
  FC.wycenaCoreUtils = {
    clone:v=> JSON.parse(JSON.stringify(v)),
    slug:v=> String(v || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '_'),
  };
  FC.wycenaCoreCatalog = {
    materialPriceLookup(name){
      return materials.find((row)=> String(row.name) === String(name)) || null;
    },
  };
  FC.wycenaCoreSource = {
    getScopedMaterials(aggregate){ return Object.keys((aggregate && aggregate.groups) || {}); },
    roomLabel(id){ return id === 'room_a' ? 'A' : String(id || ''); },
  };
  FC.wycenaCoreSelection = {
    decodeMaterialScope(selection){
      return (selection && selection.materialScope) || { kind:'all', material:'', includeFronts:true, includeCorpus:true };
    },
  };
  FC.rozrysScope = { getGroupPartsForScope(group){ return group && group.allParts ? group.allParts.slice() : []; } };
  vm.createContext(ctx);
  return { ctx, FC, egger, parts, materials };
}

async function runMaterialAndQuoteSingleTruthCheck(){
  const { ctx, FC, egger } = createContext();
  ['js/app/material/material-edge-store.js', 'js/app/material/material-tab-data.js', 'js/app/wycena/wycena-core-material-plan.js']
    .forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));

  const edgeApi = FC.materialEdgeStore.createEdgeStore({ persist:false });
  const materialModel = FC.materialTabData.collectRoomMaterials('room_a', { edgeApi });
  const materialEdgeMeters = Number(materialModel.projectEdgeMeters) || 0;
  near(materialEdgeMeters, 4.644, 0.001, 'MATERIAŁ ma liczyć PCV tylko z laminatu');

  const frontOnly = FC.materialTabData.collectEdgeMetersForRooms(['room_a'], {
    materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:false },
    persist:false,
  });
  near(frontOnly.edgeMeters, 4.08, 0.001, 'scope „same fronty” ma liczyć tylko laminowane fronty');

  const corpusOnly = FC.materialTabData.collectEdgeMetersForRooms(['room_a'], {
    materialScope:{ kind:'all', material:'', includeFronts:false, includeCorpus:true },
    persist:false,
  });
  near(corpusOnly.edgeMeters, 0.564, 0.001, 'scope „same korpusy” ma liczyć tylko laminowane części korpusowe');

  const aggregate = {
    selectedRooms:['room_a'],
    groups:{
      [egger]:{ allParts:[{ name:'Półka', material:egger, w:564, h:505, qty:1 }, { name:'Front', material:egger, w:300, h:720, qty:2 }] },
      'Front lakierowany standard':{ allParts:[{ name:'Bok', material:'Front lakierowany standard', w:600, h:500, qty:1 }] },
      'HDF 3mm biała':{ allParts:[{ name:'Plecy', material:'HDF 3mm biała', w:595, h:815, qty:1 }] },
    },
  };
  const lines = await FC.wycenaCoreMaterialPlan.collectMaterialLines(aggregate, { materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } });
  const edge = lines.find((row)=> row.subsection === 'Obrzeża');
  assert(edge, 'WYCENA ma mieć linię PCV przy laminowanych krawędziach');
  near(edge.edgeRawMeters, materialEdgeMeters, 0.001, 'WYCENA raw PCV musi być taka sama jak suma oklein w MATERIAŁ');
  near(edge.qty, 5.108, 0.001, 'WYCENA ma doliczać +10% zapasu do tej samej wartości PCV');
  assert(edge.note.includes('Z elementów: 4.644 mb'), 'audyt PCV ma pokazywać realne mb z elementów');
  assert(edge.note.includes('zapas +10%'), 'audyt PCV ma pokazywać zapas +10%');
  assert(edge.source === 'material-edge-policy', 'źródłem PCV w WYCENIE ma być centralna polityka materiałowa');
}

function runPcvEligibilityCheck(){
  const { ctx, FC, egger } = createContext();
  vm.runInContext(fs.readFileSync(path.join(root, 'js/app/material/material-edge-store.js'), 'utf8'), ctx, { filename:'material-edge-store.js' });
  const api = FC.materialEdgeStore.createEdgeStore({ persist:false });
  assert(api.isPcvEligiblePart({ name:'Bok', qty:1, a:60, b:50, material:egger }), 'laminat z katalogu ma pozwalać na PCV');
  assert(api.isPcvEligiblePart({ name:'Front', qty:1, a:30, b:72, material:`Front: laminat • ${egger}` }), 'front laminat ma pozwalać na PCV');
  assert(!api.isPcvEligiblePart({ name:'Bok', qty:1, a:60, b:50, material:'Front lakierowany standard' }), 'korpus z lakieru nie może pozwalać na PCV');
  assert(!api.isPcvEligiblePart({ name:'Front', qty:1, a:30, b:72, material:'Front: lakier • Front lakierowany standard' }), 'front lakier nie może pozwalać na PCV');
  assert(!api.isPcvEligiblePart({ name:'Front', qty:1, a:30, b:72, material:'Front: akryl • Akryl Biały' }), 'front akryl nie może pozwalać na PCV');
  assert(!api.isPcvEligiblePart({ name:'Plecy', qty:1, a:60, b:80, material:'HDF 3mm biała' }), 'HDF nie może pozwalać na PCV');

  const lakierPart = { name:'Front', qty:1, a:30, b:72, material:'Front: lakier • Front lakierowany standard' };
  const sig = api.signatureFromPart(lakierPart);
  const oldStoreApi = FC.materialEdgeStore.createEdgeStore({
    persist:false,
    initialStore:{ [sig]:{ w1:true, w2:true, h1:true, h2:true } },
  });
  near(oldStoreApi.calcEdgeMetersForParts([lakierPart], null), 0, 0.001, 'stare zapisane krawędzie lakieru muszą być ignorowane');
}

function runStaticPreviewCheck(){
  const preview = fs.readFileSync(path.join(root, 'js/app/wycena/wycena-tab-preview.js'), 'utf8');
  assert(!preview.includes("renderSection(card, 'Materiały z ROZRYS'"), 'główny widok nie może renderować szczegółów materiałów');
  assert(!preview.includes("renderSection(card, 'Akcesoria'"), 'główny widok nie może renderować szczegółów akcesoriów');

  const material = fs.readFileSync(path.join(root, 'js/tabs/material.js'), 'utf8');
  assert(material.includes('Bez PCV — materiał nie jest laminatem'), 'MATERIAŁ ma blokować checkboxy PCV dla nie-laminatu widocznym komunikatem');
  assert(material.includes('isPcvEligiblePart'), 'render MATERIAŁ ma korzystać z centralnej kwalifikacji PCV');

  const plan = fs.readFileSync(path.join(root, 'js/app/wycena/wycena-core-material-plan.js'), 'utf8');
  assert(plan.includes('collectEdgeMetersFromMaterialSource'), 'WYCENA ma pobierać PCV przez helper materiałowy');
  assert(!plan.includes('totalEdgeMeters += edgeMeters(selectedParts)'), 'WYCENA nie może sumować PCV osobno z agregatu ROZRYSU');
}

function runCatalogSeedCheck(){
  const src = fs.readFileSync(path.join(root, 'js/app/catalog/catalog-store.js'), 'utf8');
  assert(src.includes('ensureStarterMaterialSeeds'), 'brak migracyjnego dopisania widocznych cen startowych');
  assert(src.includes('Obrzeże PCV standard'), 'brak startowego PCV');
  assert(!src.includes('Obrzeże ABS'), 'nie dodawać startowego ABS');
}

(async()=>{
  await runMaterialAndQuoteSingleTruthCheck();
  runPcvEligibilityCheck();
  runStaticPreviewCheck();
  runCatalogSeedCheck();
  console.log('OK quote-audit-material-quantities-fix smoke');
})().catch((err)=>{
  console.error(err && err.stack || err);
  process.exit(1);
});
