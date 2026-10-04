#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOLS = path.join(ROOT, 'tools');
const STARTED = Date.now();

function rel(file){
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function walkFiles(dir, predicate){
  const out = [];
  if(!fs.existsSync(dir)) return out;
  const stack = [dir];
  while(stack.length){
    const current = stack.pop();
    const stat = fs.statSync(current);
    if(stat.isDirectory()){
      const base = path.basename(current);
      if(base === '.git' || base === 'node_modules') continue;
      fs.readdirSync(current).forEach((name)=> stack.push(path.join(current, name)));
      continue;
    }
    if(!predicate || predicate(current)) out.push(current);
  }
  return out.sort();
}

function runNode(file, args = []){
  return spawnSync(process.execPath, [file, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function outputFor(result){
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function printFailure(label, details){
  console.error(`\n[FAIL] ${label}`);
  if(details) console.error(details);
}

function phaseSyntax(){
  const files = walkFiles(ROOT, (file)=> file.toLowerCase().endsWith('.js'));
  const failed = [];
  for(const file of files){
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    if(result.status !== 0){
      failed.push({ file:rel(file), output:outputFor(result) });
    }
  }
  if(failed.length){
    failed.forEach((row)=> printFailure(`Składnia: ${row.file}`, row.output));
    throw new Error(`Kontrola składni: ${files.length - failed.length}/${files.length} PASS`);
  }
  return `Składnia JS: ${files.length}/${files.length} PASS`;
}

function phaseLoadOrder(){
  const checker = path.join(TOOLS, 'check-index-load-groups.js');
  const result = runNode(checker);
  if(result.status !== 0){
    printFailure('Kolejność skryptów', outputFor(result));
    throw new Error('Audyt kolejności skryptów nie przeszedł');
  }
  const config = require(path.join(TOOLS, 'index-load-groups.js'));
  const count = (config.INDEX_LOAD_GROUPS || []).reduce(
    (sum, group)=> sum + (group.scripts || []).length,
    0
  );
  return `Kolejność skryptów: ${count} pozycji PASS`;
}

function phaseSmoke(){
  const files = fs.readdirSync(TOOLS)
    .filter((name)=> /-smoke\.js$/i.test(name))
    .sort();

  const failed = [];
  let appInternal = '';

  for(const name of files){
    const result = runNode(path.join(TOOLS, name));
    const output = outputFor(result);

    if(name === 'app-dev-smoke.js'){
      const match = output.match(/APP smoke testy:\s*(\d+)\/(\d+)\s+OK/i);
      if(match) appInternal = `${match[1]}/${match[2]}`;
    }

    if(result.status !== 0){
      failed.push({ name, output });
    }
  }

  if(failed.length){
    failed.forEach((row)=> printFailure(`Smoke: ${row.name}`, row.output));
    throw new Error(
      `Smoke testy: ${files.length - failed.length}/${files.length} PASS`
    );
  }

  return `Smoke testy: ${files.length}/${files.length} PASS${
    appInternal ? ` | APP: ${appInternal} PASS` : ''
  }`;
}

function phaseDependencyAudit(){
  const { scanDependencies } = require(
    path.join(TOOLS, 'dependency-audit-lib', 'scan-dependencies.js')
  );

  const scan = scanDependencies(ROOT);

  const missing = Array.from(
    new Set([...scan.indexOrder, ...scan.devOrder])
  ).filter((file)=> !fs.existsSync(path.join(ROOT, file)));

  if(missing.length){
    throw new Error(
      `Audyt zależności: HTML odwołuje się do brakujących plików: ${missing.join(', ')}`
    );
  }

  return `Audyt zależności: PASS | JS domenowe: ${scan.jsFiles.length} | index: ${scan.indexOrder.length} | dev_tests: ${scan.devOrder.length}`;
}

function phaseStorageAudit(){
  const { buildAudit } = require(
    path.join(TOOLS, 'local-storage-source-audit.js')
  );

  const previousCwd = process.cwd();

  try{
    process.chdir(ROOT);
    const audit = buildAudit(['js']);

    if(!audit || !Array.isArray(audit.rows)){
      throw new Error('brak wyniku audytu');
    }

    return `Audyt storage: PASS | referencje: ${audit.totalReferences} | pliki: ${audit.filesWithHits.length}`;
  }finally{
    process.chdir(previousCwd);
  }
}

const phases = [
  ['Składnia JavaScript', phaseSyntax],
  ['Kolejność ładowania', phaseLoadOrder],
  ['Smoke testy', phaseSmoke],
  ['Zależności', phaseDependencyAudit],
  ['Storage', phaseStorageAudit],
];

console.log('Meble-App — lokalny preflight');
console.log(`Katalog: ${ROOT}`);
console.log('');

let failed = false;

for(const [name, fn] of phases){
  const started = Date.now();

  process.stdout.write(`[RUN ] ${name} ... `);

  try{
    const message = fn();
    console.log(`OK (${Date.now() - started} ms)`);
    console.log(`       ${message}`);
  }catch(error){
    failed = true;
    console.log(`FAIL (${Date.now() - started} ms)`);
    console.error(
      `       ${error && error.message ? error.message : String(error)}`
    );
    break;
  }
}

console.log('');

if(failed){
  console.error(
    `PRE-FLIGHT FAIL — zatrzymano po ${Date.now() - STARTED} ms`
  );
  process.exit(1);
}

console.log(
  `PRE-FLIGHT PASS — wszystkie kontrole zakończone poprawnie (${Date.now() - STARTED} ms)`
);
