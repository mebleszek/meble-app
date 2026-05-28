const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

function createSandbox(){
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    requestAnimationFrame:(fn)=> setTimeout(fn, 0),
    Date, Math, JSON,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    Storage: SmokeStorage,
    document: makeMiniDocument(),
    structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
    crypto: require('crypto').webcrypto,
    __DEV_ASSETS__: {
      'index.html': fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8'),
      'dev_tests.html': fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8'),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {};
  return sandbox;
}

function loadSmokeFiles(sandbox){
  vm.createContext(sandbox);
  APP_DEV_SMOKE_FILES.forEach((file)=>{
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(code, sandbox, { filename:file });
  });
  return sandbox;
}

function wait(ms){ return new Promise((resolve)=> setTimeout(resolve, ms)); }
function assert(condition, message, details){
  if(condition) return;
  const err = new Error(message);
  if(details !== undefined) err.details = details;
  throw err;
}
function textOf(node){ return String(node && node.textContent || '').replace(/\s+/g, ' '); }

async function run(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC || {};
  assert(FC.wycenaTestFixtures && typeof FC.wycenaTestFixtures.withInvestorProjectFixture === 'function', 'Brak fixture WYCENY');
  assert(FC.tabsRouter && typeof FC.tabsRouter.get === 'function', 'Brak routera zakładek');

  const rooms = [{ id:'room_quote_click', baseType:'kuchnia', name:'Kuchnia', label:'Kuchnia', projectStatus:'pomiar' }];
  const projectData = {
    schemaVersion:9,
    meta:{ roomDefs:{ room_quote_click:{ id:'room_quote_click', baseType:'kuchnia', name:'Kuchnia', label:'Kuchnia' } }, roomOrder:['room_quote_click'] },
    room_quote_click:{
      cabinets:[{ id:'cab_quote_click', type:'stojąca', subType:'standardowa', width:60, height:82, depth:56, frontCount:2, bodyColor:'Egger W1100 ST9 Biały Alpejski', frontMaterial:'laminat', frontColor:'Egger W1100 ST9 Biały Alpejski', backMaterial:'HDF 3mm biała', details:{} }],
      fronts:[], sets:[], settings:{}, preferences:{ hardwareProducers:{ hinges:'Blum' } }
    }
  };

  await FC.wycenaTestFixtures.withInvestorProjectFixture({
    rooms,
    projectData,
    cutListFn(){
      return [
        { name:'Bok', qty:2, a:80, b:56, w:80, h:56, material:'Egger W1100 ST9 Biały Alpejski' },
        { name:'Front', qty:2, a:30, b:82, w:30, h:82, material:'Front: laminat • Egger W1100 ST9 Biały Alpejski' },
        { name:'Zawias 110° nakładany', qty:4, a:0, b:0, w:0, h:0, material:'Okucia: zawiasy BLUM', hardwareRequirement:{ kind:'hinge', typeId:'hinge_110_overlay', label:'Zawias 110° nakładany', qty:4 } },
      ];
    }
  }, async()=>{
    const tab = FC.tabsRouter.get('wycena');
    assert(tab && typeof tab.render === 'function', 'Brak renderu zakładki WYCENA');
    const mount = sandbox.document.createElement('div');
    tab.render({ listEl:mount });
    const runBtn = (mount.querySelectorAll('button') || []).find((btn)=> String(btn.textContent || '').trim() === 'Wyceń');
    assert(runBtn, 'Nie znaleziono zielonego przycisku Wyceń', textOf(mount).slice(0, 500));
    runBtn.click();
    await wait(25);
    await wait(75);
    await wait(150);
    const out = textOf(mount);
    const projectId = FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : '';
    const history = projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function' ? FC.quoteSnapshotStore.listForProject(projectId) : [];
    assert(history.length >= 1, 'Kliknięcie Wyceń nie zapisało snapshotu do historii', { projectId, out:out.slice(0, 800) });
    assert(/Podsumowanie/.test(out) && /Razem/.test(out), 'Kliknięcie Wyceń zapisało snapshot, ale nie wyrenderowało podglądu', out.slice(0, 1200));
    assert(/Historia wycen/.test(out), 'Po kliknięciu Wyceń nie widać historii wycen', out.slice(0, 1200));
    assert(!/Brak zapisanych wersji oferty/.test(out), 'Po kliknięciu Wyceń nadal widać pustą historię', out.slice(0, 1200));
  });
}

run().then(()=>{
  console.log('OK: kliknięcie Wyceń generuje widoczny podgląd i historię');
}).catch((err)=>{
  console.error('BŁĄD: regresja kliknięcia Wyceń');
  console.error(err && err.stack || err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
