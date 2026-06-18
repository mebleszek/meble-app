#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'js/app/wycena/wycena-core-catalog.js',
  'js/app/wycena/wycena-core-source.js',
  'js/app/wycena/wycena-core-material-plan.js',
  'js/app/wycena/wycena-core-offer.js',
  'js/app/wycena/wycena-core-lines.js',
  'js/app/wycena/wycena-core-labor.js',
];

function assert(condition, message, details){
  if(!condition){
    const err = new Error(message);
    err.details = details;
    throw err;
  }
}

for(const rel of files){
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, 'utf8');
  assert(src.includes('retryWycenaCoreModule'), `${rel} nie ma miękkiego retry zależności`);
  assert(!/throw new Error\('Brak (FC|zależności) FC\.wycenaCore/.test(src), `${rel} nadal ma twardy throw zależności przy starcie`);

  const appended = [];
  const context = {
    console: { warn(){}, log(){}, error(){} },
    window: {},
    document: {
      currentScript: { getAttribute(name){ return name === 'src' ? `${rel}?v=test` : ''; } },
      createElement(tag){ return { tagName: tag.toUpperCase(), set defer(v){ this._defer = v; }, set async(v){ this._async = v; }, set src(v){ this._src = v; }, get src(){ return this._src; } }; },
      head: { appendChild(node){ appended.push(node); } },
    },
    setTimeout(fn){ fn(); },
    Date: { now(){ return 123456; } },
  };
  context.window.FC = {};
  context.window.setTimeout = context.setTimeout;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(src, context, { filename: rel });
  assert(appended.length === 1, `${rel} nie zaplanował ponownego załadowania przy brakujących zależnościach`, appended);
  assert(String(appended[0].src || '').includes('wycena_dep_retry='), `${rel} retry nie dodaje parametru cache-busting`, appended[0]);
}

const boot = fs.readFileSync(path.join(ROOT, 'js/boot.js'), 'utf8');
assert(boot.includes('retryFailedScript'), 'boot.js nie ma retry niezaładowanych skryptów');
assert(boot.includes('boot_script_retry='), 'boot.js retry skryptu nie dodaje parametru recovery');
assert(/window\.addEventListener\('error',[\s\S]*retryFailedScript[\s\S]*, true\);/.test(boot), 'boot.js nie nasłuchuje błędów skryptów w fazie capture');

console.log('wycena-boot-dependency-retry-smoke OK');
