const fs = require('fs');
const path = require('path');

function assert(condition, message, details){
  if(!condition){
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function runStaticChecks(){
  const version = '20260628_drawer_systems_materials_v1';
  const shell = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-tab-shell.js'), 'utf8');
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  assert(shell.includes('GENERATE_DEDUP_WINDOW_MS'), 'Brak okna deduplikacji generowania WYCENY');
  assert(shell.includes('generate-skipped-duplicate-event'), 'Brak diagnostyki pominiętego zdublowanego eventu generowania');
  assert(shell.includes('_generateRuntime:generateRuntime'), 'Runtime lock generowania nie jest dostępny do testów/debugu');
  assert(shell.includes('duplicateFound'), 'Single-flow powinien współpracować z guardem identycznych ofert');
  ['js/app/wycena/wycena-tab-shell.js','js/app/wycena/wycena-diagnostics.js'].forEach((script)=>{
    const expectedVersion = ['js/app/wycena/wycena-tab-shell.js','js/app/wycena/wycena-diagnostics.js'].includes(script) ? '20261019_project_context' : script === 'js/app/wycena/wycena-tab-shell.js' ? '20261018_pcv_ram_quote_fix' : script === 'js/app/quote/quote-snapshot-store.js' ? '20261014_c2_1b2c3b' : ['js/app/wycena/wycena-tab-shell.js','js/app/quote/quote-snapshot-store.js'].includes(script) ? '20261014_c2_1b2c3a' : script === 'js/app/ui/actions-register.js' ? '20261012_c2_0b3' : ['js/app/ui/actions-register.js','js/app/wycena/wycena-tab-shell.js'].includes(script) ? '20261012_c2_0b' : version;
    assert(index.includes(`${script}?v=${expectedVersion}`), `index.html nie ma cache-bustingu ${expectedVersion} dla ${script}`);
    assert(dev.includes(`${script}?v=${expectedVersion}`), `dev_tests.html nie ma cache-bustingu ${expectedVersion} dla ${script}`);
  });
}

try{
  runStaticChecks();
  console.log('[wycena-generate-single-flow-smoke] OK');
}catch(err){
  console.error('[wycena-generate-single-flow-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}
