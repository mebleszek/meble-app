'use strict';
// Reviewed standalone VM tests only. Changing this policy/harness requires full CI.
// Shared fixtures, browser/SDK tests, additions and unknown files are NOT admitted.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const context=require('./cloud-ci-context');
const standalone=Object.freeze([
 'project-owned-pcv-smoke.js',
 'quote-generate-helper-duplicate-regression-smoke.js',
 'quote-history-session-safety-smoke.js',
 'quote-details-accordion-scroll-smoke.js',
 'cabinet-hinge-tipon-spring-smoke.js',
 'cabinet-hinge-quantity-kg-smoke.js',
 'work-quantity-facts-cabinet-smoke.js',
 'carrying-separate-quote-smoke.js',
 'transport-catalog-quote-fix-smoke.js',
 'quote-project-preparation-section-smoke.js'
]);
function selected(result){
 if(result.mode!=='tests')throw Error('CI_TEST_MAINTENANCE_SCOPE_REQUIRED');
 const files=result.changes.filter(row=>row.path.startsWith('tools/')).map(row=>row.path);
 if(!files.length||files.some(file=>!standalone.includes(file.slice(6))))throw Error('CI_TEST_MAINTENANCE_PLAN_INVALID');
 return [...new Set(files)].sort();
}
function executeFiles(root,files){
 let failed=0;
 for(const file of files){
  const started=Date.now();console.log('SELECTED TEST START '+file);
  // Same Node runner and sanitized environment as full Preflight; no retries,
  // case filters, time limits or synthetic success. Every selected file runs whole.
  const result=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,env:context.cleanEnvironment(),stdio:'inherit'});
  console.log('SELECTED TEST END '+file+' status='+result.status+' elapsedMs='+(Date.now()-started));
  if(result.error||result.signal||result.status!==0)failed++;
 }
 return failed;
}
function run(root,base,head){
 const {inspect,verifyDocuments}=require('./ci-docs-scope');
 const plan=inspect(root,base,head),files=selected(plan);
 verifyDocuments(root,base,head,true);
 const history=context.verifyHistorical(root);context.sdkPlan(root,history);
 const unchanged=()=>{
  if(context.git(root,['rev-parse','HEAD'])!==head||context.git(root,['diff','--no-ext-diff','--no-textconv','HEAD','--']))throw Error('CI_TEST_MAINTENANCE_SOURCE_CHANGED');
  context.verifyHistorical(root,history);
 };
 unchanged();const failed=executeFiles(root,files);
 unchanged();
 if(failed)throw Error('CI_TEST_MAINTENANCE_FAILED:'+failed+'/'+files.length);
 console.log('PASS selected test maintenance '+files.length+'/'+files.length+'; application/SDK tests NOT EXECUTED (unchanged sources); HEAD '+head+' BASE '+base);
 return files;
}
module.exports={standalone,selected,executeFiles,run};
if(require.main===module){try{run(path.resolve(__dirname,'..'),...process.argv.slice(2));}catch(error){console.error(error);process.exitCode=1;}}
