const fs = require('fs');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

function assert(condition, message, details){
  if(!condition){
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : '';
    throw new Error(message + suffix);
  }
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  Math,
  JSON,
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  Storage: SmokeStorage,
  document: makeMiniDocument(),
  structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
  crypto: require('crypto').webcrypto,
  __DEV_ASSETS__: {
    'index.html': fs.readFileSync('index.html', 'utf8'),
    'dev_tests.html': fs.readFileSync('dev_tests.html', 'utf8'),
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.FC = {};
vm.createContext(sandbox);
APP_DEV_SMOKE_FILES.forEach((file)=>{
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, sandbox, { filename:file });
});

const FC = sandbox.FC;
const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
assert(FC.catalogStore && typeof FC.catalogStore.migrateLegacy === 'function', 'Brak FC.catalogStore.migrateLegacy');

sandbox.localStorage.setItem(keys.materials, JSON.stringify([
  { id:'m_lam', materialType:'laminat', manufacturer:'Egger', symbol:'W1', name:'Laminat test', price:10, hasGrain:false },
  { id:'m_acc', materialType:'akcesoria', manufacturer:'blum', symbol:'B1', name:'Zawias test', price:5, hasGrain:false },
]));
sandbox.localStorage.setItem(keys.services, JSON.stringify([{ id:'s_rate', category:'Montaż', name:'Stawka montażowa', price:100 }]));

const migrated = FC.catalogStore.migrateLegacy();
const sheetMaterials = Array.isArray(migrated.sheetMaterials) ? migrated.sheetMaterials : [];
const accessories = Array.isArray(migrated.accessories) ? migrated.accessories : [];
const quoteRates = Array.isArray(migrated.quoteRates) ? migrated.quoteRates : [];
const legacyRate = quoteRates.find((row)=> String((row && row.id) || '') === 's_rate');

assert(sheetMaterials.some((row)=> row && row.id === 'm_lam'), 'Legacy materiał arkuszowy nie został zachowany', migrated);
assert(!sheetMaterials.some((row)=> row && row.id === 'm_acc'), 'Legacy akcesorium zostało w materiałach arkuszowych', sheetMaterials);
assert(accessories.some((row)=> row && row.id === 'm_acc'), 'Legacy akcesorium nie trafiło do akcesoriów', migrated);
assert(!!legacyRate && legacyRate.name === 'Stawka montażowa' && legacyRate.category === 'Montaż' && legacyRate.isHourlyRate !== true, 'Legacy usługa nie trafiła jako zwykła stawka wyceny mebli', { legacyRate, quoteRates: quoteRates.slice(0, 8) });
assert(quoteRates[0] && quoteRates[0].id !== 's_rate', 'Test smoke powinien potwierdzać, że legacy usługa nie musi być pierwsza po dopięciu stawek systemowych', quoteRates.slice(0, 5));

console.log('catalog-migration-test-fix smoke: OK');
