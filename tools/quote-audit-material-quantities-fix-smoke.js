#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond){ throw new Error(msg); } }

async function runMaterialPlanFunctional(){
  const FC = {};
  const ctx = {
    window:{ FC },
    console,
    document:{ getElementById(){ return null; } },
    setTimeout,
    clearTimeout,
    materials:[],
  };
  ctx.globalThis = ctx.window;
  FC.wycenaCoreUtils = {
    clone:v=> JSON.parse(JSON.stringify(v)),
    slug:v=> String(v || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '_'),
  };
  FC.wycenaCoreCatalog = {
    materialPriceLookup(name){
      if(String(name).includes('HDF')) return { name:'HDF 3mm biała', price:18, priceUnit:'m2', starterPrice:true };
      return null;
    },
  };
  FC.wycenaCoreSource = {
    getScopedMaterials(){ return ['HDF 3mm biała']; },
    roomLabel(id){ return String(id || ''); },
  };
  FC.wycenaCoreSelection = { decodeMaterialScope(){ return 'both'; } };
  FC.rozrysScope = { getGroupPartsForScope(group){ return group.allParts || []; } };
  FC.catalogStore = function(){
    return { getMaterials(){ return [{ id:'m_pcv', materialType:'obrzeże', name:'Obrzeże PCV standard', price:3, priceUnit:'mb', starterPrice:true }]; } };
  };
  FC.materialEdgeStore = {
    createEdgeStore(){
      return {
        calcEdgeMetersForParts(parts){
          assert(Math.abs(parts[0].a - 60) < 0.001, 'część do edge-store ma być w cm, nie mm');
          assert(Math.abs(parts[0].b - 80) < 0.001, 'część do edge-store ma być w cm, nie mm');
          return parts.reduce((sum, p)=> sum + (2 * Number(p.a || 0) + 2 * Number(p.b || 0)) * Number(p.qty || 1) / 100, 0);
        }
      };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/app/wycena/wycena-core-material-plan.js'), 'utf8'), ctx, { filename:'wycena-core-material-plan.js' });
  const aggregate = {
    selectedRooms:['room_s'],
    groups:{ 'HDF 3mm biała':{ allParts:[{ name:'Plecy', material:'HDF 3mm biała', w:600, h:800, qty:1 }] } }
  };
  const lines = await FC.wycenaCoreMaterialPlan.collectMaterialLines(aggregate, {});
  const hdf = lines.find((row)=> row.name === 'HDF 3mm biała');
  const edge = lines.find((row)=> row.subsection === 'Obrzeża');
  assert(hdf, 'brak linii HDF');
  assert(Math.abs(Number(hdf.qty) - 0.48) < 0.001, `HDF ma mieć 0.480 m², jest ${hdf.qty}`);
  assert(edge, 'brak linii obrzeża PCV');
  assert(edge.name === 'Obrzeże PCV standard', 'obrzeże ma korzystać z PCV');
  assert(Math.abs(Number(edge.qty) - 3.08) < 0.001, `obrzeże z 2.800 mb +10% ma mieć 3.080 mb, jest ${edge.qty}`);
}

function runStaticPreviewCheck(){
  const src = fs.readFileSync(path.join(root, 'js/app/wycena/wycena-tab-preview.js'), 'utf8');
  assert(!src.includes("renderSection(card, 'Materiały z ROZRYS'"), 'główny widok nie może renderować szczegółów materiałów');
  assert(!src.includes("renderSection(card, 'Akcesoria'"), 'główny widok nie może renderować szczegółów akcesoriów');
}

function runCatalogSeedCheck(){
  const src = fs.readFileSync(path.join(root, 'js/app/catalog/catalog-store.js'), 'utf8');
  assert(src.includes('ensureStarterMaterialSeeds'), 'brak migracyjnego dopisania widocznych cen startowych');
  assert(src.includes('Obrzeże PCV standard'), 'brak startowego PCV');
  assert(!src.includes('Obrzeże ABS'), 'nie dodawać startowego ABS');
}

(async()=>{
  await runMaterialPlanFunctional();
  runStaticPreviewCheck();
  runCatalogSeedCheck();
  console.log('OK quote-audit-material-quantities-fix smoke');
})().catch((err)=>{
  console.error(err && err.stack || err);
  process.exit(1);
});
