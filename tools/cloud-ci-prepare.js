'use strict';
// Recreate the same immutable, isolated source in each independent runner.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const context=require('./cloud-ci-context');
function revision(root,expectedHead,expectedBase){
  if(!/^[a-f0-9]{40}$/.test(expectedHead||'')||context.git(root,['rev-parse','HEAD'])!==expectedHead)throw Error('CLOUD_CI_EXACT_HEAD_REQUIRED');
  if(!/^[a-f0-9]{40}$/.test(expectedBase||'')||context.git(root,['merge-base',expectedBase,expectedHead])!==expectedBase)throw Error('CLOUD_CI_EXACT_BASE_REQUIRED');
  if(context.git(root,['diff','HEAD','--']))throw Error('CLOUD_CI_CURRENT_SOURCE_DIRTY');
}
function prepare(root,expectedHead,temp=process.env.RUNNER_TEMP,expectedBase=process.env.APPROVED_BASE){
  revision(root,expectedHead,expectedBase);
  if(!temp)throw Error('CLOUD_CI_RUNNER_TEMP_REQUIRED');
  if(/[\r\n]/.test(root+temp))throw Error('CLOUD_CI_PATH_INVALID');
  const history=path.resolve(temp,'meble-cloud-history');
  if(fs.existsSync(history))throw Error('CLOUD_CI_HISTORY_ALREADY_EXISTS');
  const relative=path.relative(fs.realpathSync(root),history);
  if(!relative.startsWith('..'+path.sep))throw Error('CLOUD_CI_ISOLATION_REQUIRED');
  const clone=spawnSync('git',['clone','--quiet','--no-hardlinks','--no-checkout','--local',root,history],{encoding:'utf8',env:context.cleanEnvironment()});
  if(clone.status!==0)throw Error('CLOUD_CI_HISTORY_CLONE_FAILED');
  context.git(history,['checkout','--quiet','--detach',context.HISTORICAL_SHA]);
  context.verifyHistorical(root,history);context.sdkPlan(root,history);
  if(!process.env.GITHUB_ENV)throw Error('CLOUD_CI_ENV_FILE_REQUIRED');
  fs.appendFileSync(process.env.GITHUB_ENV,'CLOUD_CI_HISTORY_ROOT='+history+'\nPREFLIGHT_DIR='+root+'\n');
  context.report(`Exact HEAD: \`${expectedHead}\`; BASE: \`${expectedBase}\`; historical source: \`${context.HISTORICAL_SHA}\`; 425 pins verified. Firebase LIVE_BLOCKED.`);
  return history;
}
function verifySdk(root,name){
  revision(root,process.env.APPROVED_HEAD,process.env.APPROVED_BASE);
  const {selectPlan,verifyGroup}=require('./cloud-ci-emulators');
  const group=selectPlan(context.sdkPlan(root),['--context='+name])[0];verifyGroup(group);
}
if(require.main===module){try{
  const root=path.resolve(__dirname,'..');
  if(process.argv[2]==='--verify-sdk')verifySdk(root,process.argv[3]);else prepare(root,process.argv[2]);
}catch(error){
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'reason='+(error.message.match(/^[A-Z][A-Z0-9_]+/)?.[0]||'CLOUD_CI_SOURCE_PREPARATION_FAILED')+'\n');
  console.error(error);process.exitCode=1;
}}
module.exports={prepare,verifySdk};
