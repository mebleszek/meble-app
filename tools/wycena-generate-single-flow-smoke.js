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
  const version = '20260610_labor_audit_readable_lines_v1';
  const shell = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-tab-shell.js'), 'utf8');
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  assert(shell.includes('GENERATE_DEDUP_WINDOW_MS'), 'Brak okna deduplikacji generowania WYCENY');
  assert(shell.includes('generate-skipped-duplicate-event'), 'Brak diagnostyki pominiętego zdublowanego eventu generowania');
  assert(shell.includes('_generateRuntime:generateRuntime'), 'Runtime lock generowania nie jest dostępny do testów/debugu');
  assert(shell.includes('duplicateFound'), 'Single-flow powinien współpracować z guardem identycznych ofert');
  ['js/app/wycena/wycena-tab-shell.js','js/app/wycena/wycena-diagnostics.js'].forEach((script)=>{
    assert(index.includes(`${script}?v=${version}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(dev.includes(`${script}?v=${version}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
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
