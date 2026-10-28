#!/usr/bin/env node
'use strict';
const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const context=require('./cloud-ci-context.js');
const root=path.resolve(__dirname,'..');
function completeTap(output){
  const count=name=>Number(Array.from(output.matchAll(new RegExp('^# '+name+' (\\d+)\\s*$','gm')),m=>m[1]).at(-1)??NaN);
  return count('tests')>0 && count('tests')===count('pass') && ['fail','cancelled','skipped','todo'].every(name=>count(name)===0);
}
function selectPlan(plan,args){
  if(args.length===0)return plan;
  if(args.length!==1||!['--context=current','--context=historical'].includes(args[0]))throw Error('CLOUD_CI_CONTEXT_INVALID');
  const selected=plan.filter(group=>group.context===args[0].split('=')[1]);
  if(selected.length!==1)throw Error('CLOUD_CI_CONTEXT_UNCONFIRMED');return selected;
}
function verifyGroup(group){
  const cwd=path.join(group.root,'tools/firebase-pilot');
  const cli=path.join(cwd,'node_modules/firebase-tools/lib/bin/firebase.js');
  if(!fs.existsSync(cli))throw Error('CLOUD_CI_SDK_DEPENDENCIES_REQUIRED: '+group.context);
  const config=JSON.parse(fs.readFileSync(path.join(cwd,'firebase.json'),'utf8'));
  try{
    assert.deepEqual(config.emulators.auth,{host:'127.0.0.1',port:19099});
    assert.deepEqual(config.emulators.firestore,{host:'127.0.0.1',port:18080});
    assert.equal(config.emulators.singleProjectMode,true);assert.equal(config.emulators.ui.enabled,false);
  }catch(error){throw Error('CLOUD_CI_EMULATOR_CONFIG_UNSAFE',{cause:error});}
  return{cwd,cli};
}
function main(){
  const plan=selectPlan(context.sdkPlan(root),process.argv.slice(2));
  let failed=false;
  for(const group of plan){
    const {cwd,cli}=verifyGroup(group);
    // The allowlisted files have no shell metacharacters. Two separate demo emulator lifetimes.
    const command='node --test --test-reporter=tap --test-concurrency=1 '+group.files.join(' ');
    const settings=fs.mkdtempSync(path.join(os.tmpdir(),'meble-demo-cli-'));
    let result;
    try{
      result=spawnSync(process.execPath,[cli,'emulators:exec','--config','firebase.json','--project','demo-meble-app','--only','auth,firestore','--non-interactive',command],
        {cwd,env:{...context.cleanEnvironment(),XDG_CONFIG_HOME:settings},encoding:'utf8',maxBuffer:64*1024*1024});
    }finally{fs.rmSync(settings,{recursive:true,force:true});}
    process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
    if(result.error)console.error(result.error);
    const output=(result.stdout||'')+'\n'+(result.stderr||'');
    const complete=completeTap(output);
    const status=result.status===0&&complete?'PASS':'FAIL';failed ||= status==='FAIL';
    context.report(`SDK/Auth/Firestore/Rules **${status}** | ${group.context} | SHA \`${context.git(group.root,['rev-parse','HEAD'])}\` | ${group.files.join(', ')}`);
    context.verifyHistorical(root);
  }
  if(failed) throw Error('CLOUD_CI_SDK_FAILED');
}
if(require.main===module){try{main();}catch(error){console.error(error);process.exitCode=1;}}
module.exports={main,completeTap,selectPlan,verifyGroup};
