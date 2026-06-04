const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(condition, message, details){
  if(!condition){
    const err = new Error(message);
    err.details = details;
    throw err;
  }
}
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function loadCatalogSandbox(){
  const sandbox = { console, Date, Math, JSON, window:null, globalThis:null, FC:{} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ['js/app/catalog/hardware-technical-params.js','js/app/catalog/hardware-catalog.js'].forEach((file)=>{
    vm.runInContext(read(file), sandbox, { filename:file });
  });
  return sandbox;
}
function hingeParams(overrides){
  return Object.assign({
    rola_kompletu:{ value:'komplet zawiasowy' },
    system_kompatybilnosci:{ value:'CLIP top' },
    nalozenie:{ value:'nakładany' },
    kat_rzeczywisty:{ from:110, to:'' },
    klasa_kata:{ value:'standardowy 90–120°' },
    hamulec:{ value:true },
    sprezyna:{ value:false },
    typ_prowadnika:{ value:'standardowy' },
    forma_prowadnika:{ value:'krzyżowy' },
    pokrycie_prowadnika:{ value:'w komplecie' },
  }, overrides || {});
}
function makeHinge(id, form){
  return {
    id,
    manufacturer:'Blum',
    hardwareCategory:'Zawiasy',
    hardwareSystem:'CLIP top',
    hardwareType:'nakładany 110° standardowy 90–120° hamulec',
    technicalParams:hingeParams({ forma_prowadnika:{ value:form } }),
  };
}
function runStaticChecks(){
  const bindings = read('js/app/ui/bindings.js');
  const shell = read('js/app/wycena/wycena-tab-shell.js');
  const help = read('js/app/shared/help-registry.js');
  const sharedCss = read('css/shared-overlays-choice.css');
  const wycenaCss = read('css/wycena.css');
  assert(bindings.includes("action === 'wycena-generate'"), 'Delegacja data-action nie połyka globalnie syntetycznego click po Wyceń');
  assert(shell.includes('GENERATE_RELEASE_DEDUP_WINDOW_MS') && shell.includes('generate-skipped-after-release-click'), 'WYCENA nie ma blokady drugiego clicka tuż po zakończeniu liczenia');
  assert(help.includes("btn.textContent = '?';"), 'Centralny helper ? nie ma tekstowego fallbacku');
  assert(sharedCss.includes('.info-trigger:not(:empty)::before') && sharedCss.includes('font-size:17px'), 'CSS helpera ? nie pokazuje tekstowego fallbacku');
  assert(wycenaCss.includes('@media (max-width:640px)') && wycenaCss.includes('.quote-selection-grid') && wycenaCss.includes('grid-template-columns:minmax(0,1fr)'), 'Sekcja wyboru WYCENY nie przechodzi na jedną kolumnę na mobile');
}
function runDuplicateChecks(){
  const sandbox = loadCatalogSandbox();
  const hw = sandbox.FC.hardwareCatalog;
  assert(hw && typeof hw.uniqueTypeConflict === 'function', 'Brak uniqueTypeConflict');
  assert(typeof hw.technicalDuplicateSignature === 'function', 'Brak technicznego podpisu duplikatu');
  const existingCross = makeHinge('existing_cross', 'krzyżowy');
  const candidateStraight = makeHinge('candidate_straight', 'prosty');
  const candidateCross = makeHinge('candidate_cross', 'krzyżowy');
  const list = [existingCross];
  const diff = hw.uniqueTypeConflict(list, candidateStraight, '');
  assert(!diff, 'Różna forma prowadnika nie może być blokowana jako duplikat tylko przez taką samą nazwę techniczną', { diff });
  const same = hw.uniqueTypeConflict(list, candidateCross, '');
  assert(same && same.id === 'existing_cross', 'Identyczne parametry Użyj do porównania muszą dawać duplikat', { same });
  const legacyExisting = { id:'legacy_a', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareSystem:'CLIP top', hardwareType:'legacy typ bez danych tech.' };
  const legacyCandidate = { id:'legacy_b', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareSystem:'CLIP top', hardwareType:'legacy typ bez danych tech.' };
  const legacy = hw.uniqueTypeConflict([legacyExisting], legacyCandidate, '');
  assert(legacy && legacy.id === 'legacy_a', 'Legacy bez pełnych danych technicznych nadal powinno mieć fallback po typie', { legacy });
}
try{
  runStaticChecks();
  runDuplicateChecks();
  console.log('[quote-generate-helper-duplicate-regression-smoke] OK');
}catch(err){
  console.error('[quote-generate-helper-duplicate-regression-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}
