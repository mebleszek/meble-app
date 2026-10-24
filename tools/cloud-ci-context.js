'use strict';
// CI routing only. This file grants no authority and never rewrites reviewed evidence.
const fs = require('node:fs'), path = require('node:path');
const {spawnSync} = require('node:child_process');
const HISTORICAL_SHA = '306f90a4cfd8bcb4277aa8b4d140e911493ddd60';
const historicalSmoke = Object.freeze([
  'cloud42-live-preparation-smoke.js','cloud43a-production-baseline-smoke.js',
  'cloud43b-gate1-approval-smoke.js','cloud44-gate2-smoke.js',
  'cloud46c-proof-smoke.js','cloud46d-preparation-smoke.js','cloud46e-connection-smoke.js'
]);
const historicalSdk = Object.freeze(['cloud46c-executor.test.mjs','cloud46d-emulator.test.mjs','cloud46e-emulator.test.mjs']);
const currentSdk = Object.freeze(['pilot.test.mjs','auth.test.mjs','access.test.mjs','global.test.mjs','live-readiness.test.mjs','cloud42-plan.test.mjs','cloud44-admin.test.mjs','cloud-sync-global.test.mjs']);
function git(root,args){
  const result=spawnSync('git',['-C',root,...args],{encoding:'utf8'});
  if(result.status!==0) throw Error('CLOUD_CI_GIT_FAILED: '+args.join(' '));
  return result.stdout.trim();
}
function cleanEnvironment(env=process.env){
  const out={...env};
  for(const key of Object.keys(out)) if(/^(GOOGLE|GCLOUD|FIREBASE|CLOUDSDK|CLOUD4[0-9A-Z]*)_/.test(key) || /(?:TOKEN|CREDENTIAL|SECRET|ACCESS_KEY)/.test(key)) delete out[key];
  // Explicit demo target is supplied on the CLI. No production credential or emulator address is inherited.
  out.GCLOUD_PROJECT='demo-meble-app';out.GOOGLE_CLOUD_PROJECT='demo-meble-app';
  out.CI='1';
  return out;
}
function verifyHistorical(currentRoot, historyRoot=process.env.CLOUD_CI_HISTORY_ROOT){
  if(!historyRoot) throw Error('CLOUD_CI_HISTORY_REQUIRED');
  const current=fs.realpathSync(currentRoot), history=fs.realpathSync(historyRoot);
  const relative=path.relative(current,history), reverse=path.relative(history,current);
  if(!relative || !relative.startsWith('..'+path.sep) || !reverse.startsWith('..'+path.sep)) throw Error('CLOUD_CI_ISOLATION_REQUIRED');
  if(git(history,['rev-parse','HEAD'])!==HISTORICAL_SHA) throw Error('CLOUD_CI_HISTORY_SHA_MISMATCH');
  // Check the worktree against the immutable commit, including staged changes.
  if(git(history,['diff',HISTORICAL_SHA,'--']) || git(history,['diff','--cached',HISTORICAL_SHA,'--'])) throw Error('CLOUD_CI_HISTORY_DIRTY');
  const extra=git(history,['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean);
  if(extra.some(file=>!/^tools\/firebase-pilot\/(node_modules\/|(?:firebase|firestore|ui|auth)-debug(?:\.[^/]*)?\.log$)/.test(file))) throw Error('CLOUD_CI_HISTORY_EXTRA_FILES');
  const inventory=require(path.join(history,'tools/firebase-pilot/cloud42-package.js')).inventory();
  if(inventory.sourceCount!==425) throw Error('CLOUD_CI_HISTORY_INVENTORY_MISMATCH');
  return history;
}
function sdkPlan(currentRoot, historyRoot){
  const history=verifyHistorical(currentRoot,historyRoot);
  for(const file of historicalSmoke.map(name=>'tools/'+name).concat(historicalSdk.map(name=>'tools/firebase-pilot/'+name))){
    if(!fs.readFileSync(path.join(currentRoot,file)).equals(fs.readFileSync(path.join(history,file)))) throw Error('CLOUD_CI_HISTORICAL_TEST_CHANGED: '+file);
  }
  const parse=root=>{
    const script=JSON.parse(fs.readFileSync(path.join(root,'tools/firebase-pilot/package.json'),'utf8')).scripts.test;
    const match=script.match(/node --test --test-concurrency=1 ([^"]+)"$/);
    if(!match) throw Error('CLOUD_CI_SDK_PLAN_CHANGED');
    return match[1].trim().split(/\s+/).sort();
  };
  const all=[...historicalSdk,...currentSdk].sort();
  for(const root of [currentRoot,history]) if(JSON.stringify(parse(root))!==JSON.stringify(all)) throw Error('CLOUD_CI_SDK_UNCLASSIFIED_TEST');
  return [{context:'current',root:currentRoot,files:currentSdk},{context:'historical',root:history,files:historicalSdk}];
}
function report(message){
  console.log(message);
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,message+'\n\n');
}
module.exports={HISTORICAL_SHA,historicalSmoke,historicalSdk,currentSdk,git,cleanEnvironment,verifyHistorical,sdkPlan,report};
