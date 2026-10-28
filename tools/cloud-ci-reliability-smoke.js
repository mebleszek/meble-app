#!/usr/bin/env node
'use strict';
// Targeted offline regression, not an emulator or a second CI runner.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const context=require('./cloud-ci-context'),impact=require('./cloud-ci-impact');
const boundary=require('./cloud-ci-current-boundary-smoke');
const root=path.resolve(__dirname,'..'),file=name=>'tools/firebase-pilot/'+name;
function step(workflow,name){
  const marker='      - name: '+name+'\n';assert.equal(workflow.split(marker).length,2,name);
  return workflow.split(marker)[1].split('\n      - name: ')[0].split('\n  auto-merge:')[0];
}
function permitted(block,outcomes,cancelled=false){
  const expression=block.match(/^        if: \$\{\{ (.+) \}\}$/m)?.[1];assert.ok(expression,'Explicit step condition');
  return expression.split(' && ').every(term=>{
    if(term==='!cancelled()')return !cancelled;
    const match=term.match(/^steps\.([a-z0-9-]+)\.outcome == 'success'$/);assert.ok(match,'Unknown condition: '+term);
    return outcomes[match[1]]==='success';
  });
}
const {workflowChecks,diagnosticChecks}=require('./cloud-ci-workflow-checks');
async function main(){
  const history=context.verifyHistorical(root),reference=impact.protection(root,history);
  let count=0;const pass=name=>{count++;console.log('PASS '+name);};
  const report=impact.analyze(root,['AGENTS.md','index.html','tools/reports/synthetic-unprotected.md'],reference);
  const agent=report.protectedChanges.find(row=>row.file==='AGENTS.md');
  assert.equal(agent.direct[0].code,'CLOUD46C_DEPENDENCY_CHANGED');assert.equal(agent.direct[0].matchesHistorical,false);
  assert.ok(agent.indirect.some(row=>row.manifest===file('cloud46e-integrity.json')&&row.code==='CLOUD46C_DEPENDENCY_CHANGED'));
  assert.ok(agent.tests.includes('cloud-ci-current-boundary-smoke.js'));assert.ok(agent.tests.includes('cloud46e-connection-smoke.js'));
  assert.deepEqual(report.unprotectedChanges,['tools/reports/synthetic-unprotected.md']);
  const source=report.protectedChanges.find(row=>row.file==='index.html');assert.ok(source.indirect.every(row=>row.code==='CLOUD42_SOURCE_CHANGED'));
  const added=impact.analyze(root,['js/app/synthetic-added.js'],reference);assert.equal(added.protectedChanges[0].direct[0].reason,'SOURCE_SET_CHANGED');
  assert.ok(impact.changedFiles(root,'767c1c79acacc4d8334aa0d79a99b36d7af28ba8').includes('AGENTS.md'));
  assert.throws(()=>impact.changedFiles(root,'main'),/EXACT_BASE_REQUIRED/);
  const delta=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-ci-path-delta-'));
  try{
    context.git(delta,['init','--quiet']);fs.writeFileSync(path.join(delta,'AGENTS.md'),'Synthetic protected path\n');
    context.git(delta,['add','AGENTS.md']);
    context.git(delta,['-c','user.name=CI fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','--quiet','-m','Synthetic path fixture']);
    const base=context.git(delta,['rev-parse','HEAD']);fs.renameSync(path.join(delta,'AGENTS.md'),path.join(delta,'renamed.md'));
    assert.deepEqual(impact.changedFiles(delta,base).sort(),['AGENTS.md','renamed.md'],'A rename must retain the removed protected path');
  }finally{fs.rmSync(delta,{recursive:true,force:true});}
  pass('read-only manifest graph: direct/propagated impact, new source set and no false warning for unprotected docs');
  for(const value of [Error('UNEXPECTED_ERROR'),TypeError('CLOUD42_SOURCE_CHANGED'),Error('CLOUD46C_DEPENDENCY_CHANGED'),{message:'CLOUD42_SOURCE_CHANGED'}])assert.throws(()=>assert.throws(()=>{throw value;},boundary.exact('CLOUD42_SOURCE_CHANGED')));
  assert.throws(()=>assert.throws(()=>{},boundary.exact('CLOUD42_SOURCE_CHANGED')));
  assert.throws(()=>boundary.exact('ARBITRARY_ERROR'));
  pass('unexpected errors, unrelated refusal codes and unexpected success are rejected');
  const ioRoot=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-ci-io-trap-')),neverWritten=path.join(ioRoot,'never-written');
  try{
    for(const operation of [()=>fs.writeFileSync(neverWritten,'x'),()=>fs.openSync(neverWritten,'w'),()=>fs.promises.writeFile(neverWritten,'x'),()=>fetch('https://example.invalid')]){
      await assert.rejects(boundary.withoutEffects(async()=>{try{await operation();}catch(_){}}),/before any network, write, timer or child process/);
    }
    assert.equal(fs.existsSync(neverWritten),false);
  }finally{fs.rmSync(ioRoot,{recursive:true,force:true});}
  pass('IO guard detects even swallowed network and sync/async write attempts before effects');
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-ci-integrity-fixture-'));
  try{
    // Complete tracked historical source copy, explicitly UNAPPROVED after each
    // synthetic alteration. Never substitute files in the real current/history tree.
    fs.cpSync(history,fixture,{recursive:true,filter:source=>!path.relative(history,source).split(path.sep).some(part=>part==='.git'||part==='node_modules'||/^(?:firebase|firestore|ui|auth)-debug.*\.log$/.test(part))});
    const variants=[
      ['application source','index.html',bytes=>Buffer.concat([bytes,Buffer.from('\n<!-- synthetic drift -->\n')]),{c42:'CLOUD42_SOURCE_CHANGED',c:'CLOUD42_SOURCE_CHANGED',d:'CLOUD42_SOURCE_CHANGED',e:'CLOUD42_SOURCE_CHANGED'}],
      ['protected document','AGENTS.md',bytes=>Buffer.concat([bytes,Buffer.from('\nSynthetic dependency change\n')]),{c:'CLOUD46C_DEPENDENCY_CHANGED',d:'CLOUD46C_DEPENDENCY_CHANGED',e:'CLOUD46C_DEPENDENCY_CHANGED'}],
      ['source manifest',file('cloud42-source-pins.json'),bytes=>Buffer.from(JSON.stringify({...JSON.parse(bytes),baseCommit:'0'.repeat(40)})),{c42:'CLOUD42_SOURCE_CHANGED',c:'CLOUD46C_DEPENDENCY_CHANGED',d:'CLOUD46C_DEPENDENCY_CHANGED',e:'CLOUD46C_DEPENDENCY_CHANGED'}],
      ['CLOUD-4.4 manifest byte pin',file('cloud44-integrity.json'),bytes=>Buffer.concat([bytes,Buffer.from('\n')]),{c:'CLOUD46C_DEPENDENCY_CHANGED',d:'CLOUD46C_DEPENDENCY_CHANGED',e:'CLOUD46C_DEPENDENCY_CHANGED'}],
      ['C package manifest',file('cloud46c-integrity.json'),bytes=>Buffer.from(JSON.stringify({...JSON.parse(bytes),productionExecutionAllowed:true})),{c:'CLOUD46C_PACKAGE_CHANGED',d:'CLOUD46C_PACKAGE_CHANGED',e:'CLOUD46C_PACKAGE_CHANGED'}],
      ['D package manifest',file('cloud46d-integrity.json'),bytes=>Buffer.from(JSON.stringify({...JSON.parse(bytes),productionExecutionAllowed:true})),{d:'CLOUD46D_REVIEWED_SOURCE_CHANGED',e:'CLOUD46D_REVIEWED_SOURCE_CHANGED'}],
      ['E package manifest',file('cloud46e-integrity.json'),bytes=>Buffer.from(JSON.stringify({...JSON.parse(bytes),productionExecutionAllowed:true})),{e:'CLOUD46E_PACKAGE_CHANGED'}],
    ];
    for(const [name,relative,alter,codes]of variants){
      const target=path.join(fixture,relative),original=fs.readFileSync(target);
      try{
        fs.writeFileSync(target,alter(original));
        await boundary.probe(fixture,codes);
        if(name==='protected document')assert.equal(boundary.expectations(fixture,reference).e,'CLOUD46C_DEPENDENCY_CHANGED');
        if(name==='application source')assert.equal(boundary.expectations(fixture,reference).e,'CLOUD42_SOURCE_CHANGED');
        if(name.endsWith('manifest'))assert.throws(()=>boundary.expectations(fixture,reference),/Historical manifest changed/);
      }finally{fs.writeFileSync(target,original);}
      pass(name+': exact refusal propagated before IO/LIVE');
    }
  }finally{fs.rmSync(fixture,{recursive:true,force:true});}
  workflowChecks(fs.readFileSync(path.join(root,'.github/workflows/preflight-js.yml'),'utf8'));
  await diagnosticChecks(fs.readFileSync(path.join(root,'.github/workflows/preflight-js.yml'),'utf8'));
  pass('independent complete diagnostics after Preflight FAIL; exact safety gates and all-groups-PASS-only merge');
  context.verifyHistorical(root);
  console.log('CLOUD/CI reliability: '+count+' targeted groups PASS; no Actions/emulators run; historical source unchanged');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,workflowChecks,diagnosticChecks,permitted};
