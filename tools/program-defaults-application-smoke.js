const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeStorage } = require('./app-dev-smoke-lib/smoke-storage');

function assert(condition, message, details){
  if(condition) return;
  const suffix = details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`;
  throw new Error(message + suffix);
}

function load(sandbox, file){
  const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  vm.runInContext(code, sandbox, { filename:file });
}

function makeSandbox(){
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    structuredClone: global.structuredClone || ((value)=> JSON.parse(JSON.stringify(value))),
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {};
  vm.createContext(sandbox);
  [
    'js/app/shared/utils.js',
    'js/app/shared/constants.js',
    'js/app/shared/storage.js',
    'js/app/settings/program-defaults-store.js',
    'js/app/room-preferences/room-preferences-model.js',
    'js/app/cabinet/cabinet-modal-draft.js',
  ].forEach((file)=> load(sandbox, file));
  return sandbox;
}

function blankRoom(cabinets, zoneOverrides){
  return {
    cabinets:Array.isArray(cabinets) ? cabinets : [],
    fronts:[],
    sets:[],
    settings:{ roomHeight:250, bottomHeight:86, legHeight:10, counterThickness:3.8, gapHeight:60, ceilingBlende:10 },
    preferences:{ zones:Object.assign({ lower:{}, middle:{}, upper:{} }, zoneOverrides || {}) }
  };
}

function run(){
  const sandbox = makeSandbox();
  const FC = sandbox.FC;
  sandbox.materials = [
    { name:'Pierwszy laminat', materialType:'laminat' },
    { name:'Stary korpus', materialType:'laminat' },
    { name:'Globalny korpus', materialType:'laminat' },
    { name:'Globalny front', materialType:'akryl' },
    { name:'Front pokoju', materialType:'akryl' },
  ];

  FC.programDefaults.write({
    materials:{
      bodyColor:'Globalny korpus',
      frontMaterial:'akryl',
      frontColor:'Globalny front',
      backMaterial:'Globalne plecy'
    }
  });

  const stored = FC.programDefaults.read();
  assert(stored.materials.bodyColor === 'Globalny korpus', 'Store nie zapisał globalnego korpusu.', stored);
  assert(stored.materials.frontMaterial === 'akryl' && stored.materials.frontColor === 'Globalny front', 'Store nie zapisał globalnego frontu.', stored);
  assert(stored.materials.backMaterial === 'Globalne plecy', 'Store nie zapisał globalnych pleców.', stored);

  sandbox.projectData = { schemaVersion:12, kuchnia:blankRoom([]) };
  const first = FC.cabinetModalDraft.makeDefaultCabinetDraftForRoom('kuchnia');
  assert(first.bodyColor === 'Globalny korpus', 'Pierwsza szafka nie użyła globalnego korpusu.', first);
  assert(first.frontMaterial === 'akryl' && first.frontColor === 'Globalny front', 'Pierwsza szafka nie użyła globalnego frontu.', first);
  assert(first.backMaterial === 'Globalne plecy', 'Pierwsza szafka nie użyła globalnych pleców.', first);

  const previous = {
    id:'cab_previous',
    width:77,
    height:88,
    depth:55,
    type:'stojąca',
    subType:'standardowa',
    bodyColor:'Stary korpus',
    frontMaterial:'laminat',
    frontColor:'Stary front',
    backMaterial:'Brak',
    openingSystem:'uchwyt klienta',
    details:{ shelves:3 }
  };
  sandbox.projectData = { schemaVersion:12, kuchnia:blankRoom([previous]) };
  const next = FC.cabinetModalDraft.makeDefaultCabinetDraftForRoom('kuchnia');
  assert(next.id == null && Number(next.width) === 77 && Number(next.details && next.details.shelves) === 3, 'Nowa szafka nie zachowała konstrukcji poprzednika.', next);
  assert(next.bodyColor === 'Globalny korpus', 'Szafka po poprzedniku nie użyła globalnego korpusu.', next);
  assert(next.frontMaterial === 'akryl' && next.frontColor === 'Globalny front', 'Szafka po poprzedniku nie użyła globalnego frontu.', next);
  assert(next.backMaterial === 'Globalne plecy', 'Szafka po poprzedniku nie użyła globalnych pleców.', next);
  assert(previous.bodyColor === 'Stary korpus' && previous.id === 'cab_previous', 'Tworzenie draftu zmieniło zapisaną poprzednią szafkę.', previous);

  sandbox.projectData = {
    schemaVersion:12,
    kuchnia:blankRoom([previous], {
      lower:{ bodyColor:'Korpus pokoju', frontColor:'Front pokoju', openingSystem:'TIP-ON' }
    })
  };
  const roomPreferred = FC.cabinetModalDraft.makeDefaultCabinetDraftForType('kuchnia', 'stojąca');
  assert(roomPreferred.bodyColor === 'Korpus pokoju', 'Preferencja pokoju nie wygrała z globalnym korpusem.', roomPreferred);
  assert(roomPreferred.frontMaterial === 'akryl' && roomPreferred.frontColor === 'Front pokoju', 'Preferencja pokoju nie połączyła się poprawnie z globalnym frontem.', roomPreferred);
  assert(roomPreferred.backMaterial === 'Globalne plecy', 'Brak preferencji pleców pokoju nie użył globalnej wartości.', roomPreferred);
  assert(roomPreferred.openingSystem === 'TIP-ON', 'Preferencja otwierania pokoju nie została zastosowana.', roomPreferred);

  const setDefaults = FC.roomPreferences.resolveZoneDefaults('kuchnia', 'upper', {
    bodyColor:'Awaryjny korpus',
    frontMaterial:'laminat',
    frontColor:'Awaryjny front',
    backMaterial:'Awaryjne plecy'
  });
  assert(setDefaults.bodyColor === 'Globalny korpus', 'Resolver zestawu/strefy nie użył globalnego korpusu.', setDefaults);
  assert(setDefaults.frontMaterial === 'akryl' && setDefaults.frontColor === 'Globalny front', 'Resolver zestawu/strefy nie użył globalnego frontu.', setDefaults);
  assert(setDefaults.backMaterial === 'Globalne plecy', 'Resolver zestawu/strefy nie użył globalnych pleców.', setDefaults);

  console.log('Program defaults application smoke: OK');
  console.log('- zapis/odczyt ustawień: OK');
  console.log('- pierwsza szafka: OK');
  console.log('- kolejna szafka po sklonowaniu konstrukcji: OK');
  console.log('- pierwszeństwo pokój → trybik → fallback: OK');
  console.log('- resolver stref i zestawów: OK');
}

try{
  run();
}catch(error){
  console.error('Program defaults application smoke: BŁĄD');
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
