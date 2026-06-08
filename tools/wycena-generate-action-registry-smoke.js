const fs = require('fs');
const path = require('path');

function assert(condition, message){
  if(!condition){
    throw new Error(message);
  }
}

function read(file){
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

function main(){
  const actions = read('js/app/ui/actions-register.js');
  const shell = read('js/app/wycena/wycena-tab-shell.js');
  const index = read('index.html');
  const devTests = read('dev_tests.html');
  const version = '20260609_work_quantity_sources_settings_clean_v1';

  assert(actions.includes("'wycena-generate'"), 'Actions registry nie rejestruje akcji wycena-generate');
  assert(actions.includes('FC.wycenaGenerateAction') && actions.includes('.run'), 'Akcja wycena-generate nie woła runtime handlera WYCENY');
  assert(shell.includes("runBtn.setAttribute('data-action', 'wycena-generate')"), 'Przycisk Wyceń nie ma data-action=wycena-generate');
  assert(shell.includes('FC.wycenaGenerateAction = {'), 'Shell WYCENY nie wystawia runtime handlera dla Actions registry');
  assert(!shell.includes("runBtn.addEventListener('pointerup'") && !shell.includes('runBtn.addEventListener("pointerup"'), 'Przycisk Wyceń ma nadal bezpośredni pointerup zamiast jednego źródła prawdy');
  assert(!shell.includes("runBtn.addEventListener('click'") && !shell.includes('runBtn.addEventListener("click"'), 'Przycisk Wyceń ma nadal bezpośredni click zamiast jednego źródła prawdy');
  ['js/app/ui/actions-register.js','js/app/wycena/wycena-diagnostics.js','js/app/wycena/wycena-tab-shell.js'].forEach((script)=>{
    assert(index.includes(`${script}?v=${version}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(devTests.includes(`${script}?v=${version}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
  });
  console.log('[wycena-generate-action-registry-smoke] OK');
}

try{ main(); }
catch(err){
  console.error('[wycena-generate-action-registry-smoke] FAIL:', err && err.message ? err.message : err);
  process.exit(1);
}
