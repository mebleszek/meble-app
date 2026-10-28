'use strict';
// Historical smoke is a separate mandatory group; no source/test rewrites.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const context=require('./cloud-ci-context');
function main(){
  const root=path.resolve(__dirname,'..'),history=context.verifyHistorical(root);context.sdkPlan(root,history);
  let failures=0;
  for(const name of context.historicalSmoke){
    const result=spawnSync(process.execPath,[path.join(history,'tools',name)],{cwd:history,env:context.cleanEnvironment(),encoding:'utf8',maxBuffer:32*1024*1024});
    process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
    if(result.error)console.error(result.error);
    const pass=result.status===0&&!result.error;failures+=pass?0:1;
    context.report(`Historical smoke **${pass?'PASS':'FAIL'}** | ${name} | SHA \`${context.HISTORICAL_SHA}\``);
    context.verifyHistorical(root,history);
  }
  if(failures)throw Error('CLOUD_CI_HISTORICAL_SMOKE_FAILED: '+failures);
}
if(require.main===module){try{main();}catch(error){console.error(error);process.exitCode=1;}}
module.exports={main};
