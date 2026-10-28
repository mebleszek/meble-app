'use strict';
// Read-only structural/model checks of the actual workflow, not emulator mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const context=require('./cloud-ci-context'),{selectPlan,verifyGroup}=require('./cloud-ci-emulators');
function jobs(source){
  source=source.split('\njobs:\n')[1];assert.ok(source,'Missing workflow jobs');
  const rows=[...source.matchAll(/^  ([a-z0-9-]+):\n/gm)];
  return Object.fromEntries(rows.map((row,i)=>[row[1],source.slice(row.index,rows[i+1]?.index||source.length)]));
}
function steps(job){
  const rows=[...job.matchAll(/^      - name: (.+)\n/gm)];
  return Object.fromEntries(rows.map((row,i)=>{const block=job.slice(row.index,rows[i+1]?.index||job.length),id=block.match(/^        id: (.+)$/m)?.[1];return[id||row[1],block];}));
}
const condition=block=>block.match(/^\s*if: (.+)$/m)?.[1];
const script=block=>{const body=block.split('          script: |\n')[1];assert.ok(body,'Missing actual github-script body');return body.split('\n').map(line=>line.startsWith('            ')?line.slice(12):line).join('\n');};
const required=block=>block.match(/^          REQUIRED_STEPS: (.+)$/m)[1].split(',');
function enabled(expression,{outcomes={},results={},cancelled=false}={}){
  assert.ok(expression?.startsWith('${{ ')&&expression.endsWith(' }}'));
  return expression.slice(4,-3).split(' && ').every(term=>{
    if(term==='!cancelled()')return !cancelled;
    if(term==='always()')return true;
    const m=term.match(/^(steps|needs)\.([a-z0-9-]+)\.(outcome|result) == 'success'$/);assert.ok(m,'Unknown execution condition: '+term);
    return(m[1]==='steps'?outcomes:results)[m[2]]==='success';
  });
}
function workflowChecks(source){
  const j=jobs(source);for(const id of ['safety','preflight','firebase-current','cloud-historical','ci-summary','auto-merge','post-merge-verify','final-status'])assert.ok(j[id],id);
  assert.doesNotMatch(source,/continue-on-error:/);const trigger=source.split('\njobs:')[0];
  assert.match(trigger,/types: \[opened, ready_for_review\]/);assert.doesNotMatch(trigger,/^  push:|types:.*synchronize/m);
  for(const id of ['preflight','firebase-current','cloud-historical']){
    assert.match(j[id],/^    needs: safety$/m);assert.equal(condition(j[id]),"${{ !cancelled() && needs.safety.result == 'success' }}");
    const s=steps(j[id]);assert.match(s.checkout,/ref: \$\{\{ needs\.safety\.outputs\.head_sha \}\}/);assert.match(s.source,/cloud-ci-prepare\.js/);assert.match(s.source,/APPROVED_BASE: \$\{\{ needs\.safety\.outputs\.base_sha \}\}/);
    assert.equal(condition(s.report),'${{ always() }}');assert.equal(condition(s.artifact),'${{ always() }}');
    for(const key of ['checkout','node','source'])assert.ok(required(s.report).includes(key));
  }
  const pre=steps(j.preflight),current=steps(j['firebase-current']),historical=steps(j['cloud-historical']);
  assert.match(pre.tests,/preflight\.js" --current-only/);assert.equal(condition(pre.tests),"${{ !cancelled() && steps.source.outcome == 'success' }}");
  for(const [id,s]of [['current',current],['historical',historical]]){
    assert.match(s.sdk,new RegExp('cloud-ci-emulators\\.js" --context='+id));
    assert.equal(condition(s.sdk),"${{ !cancelled() && steps.source.outcome == 'success' && steps.java.outcome == 'success' && steps.emulator-deps.outcome == 'success' && steps.sdk-safety.outcome == 'success' }}");
    assert.equal(condition(s['sdk-safety']),"${{ !cancelled() && steps.source.outcome == 'success' && steps.java.outcome == 'success' && steps.emulator-deps.outcome == 'success' }}");
    assert.match(s['sdk-safety'],new RegExp('cloud-ci-prepare\\.js --verify-sdk '+id));
    assert.equal(condition(s.java),"${{ !cancelled() && steps.source.outcome == 'success' }}");
    assert.equal(condition(s['emulator-deps']),"${{ !cancelled() && steps.source.outcome == 'success' && steps.java.outcome == 'success' }}");
    assert.match(s['emulator-deps'],id==='current'?/PREFLIGHT_DIR\/tools\/firebase-pilot" ci --no-audit --no-fund/:/CLOUD_CI_HISTORY_ROOT\/tools\/firebase-pilot" ci --no-audit --no-fund/);
    for(const key of ['java','emulator-deps','sdk-safety','sdk'])assert.ok(required(s.report).includes(key));
    for(const block of [s.sdk,...(id==='historical'?[s.smoke]:[])]){assert.match(block,/statuses=\("\$\{PIPESTATUS\[@\]\}"\)/);assert.match(block,/status=\$\{statuses\[0\]\}/);assert.match(block,/DIAGNOSTIC_LOG_WRITE_FAILED/);assert.match(block,/exit "\$status"/);}
  }
  assert.match(historical.smoke,/cloud-ci-historical\.js/);assert.equal(condition(historical.smoke),"${{ !cancelled() && steps.source.outcome == 'success' }}");
  assert.ok(required(historical.report).includes('smoke'));assert.ok(current.browser);assert.ok(pre.browser);assert.equal(historical.browser,undefined);
  for(const id of ['preflight','firebase-current'])assert.match(steps(j[id]).browser,/helpers\/chromium-runtime/);
  assert.equal(condition(j['ci-summary']),'${{ always() }}');assert.match(j['ci-summary'],/needs: \[safety, preflight, firebase-current, cloud-historical\]/);
  const merge=j['auto-merge'];assert.match(merge,/needs: \[safety, preflight, firebase-current, cloud-historical, ci-summary\]/);
  for(const id of ['safety','preflight','firebase-current','cloud-historical','ci-summary'])assert.ok(condition(merge).includes(`needs.${id}.result == 'success'`));
  assert.ok(condition(merge).includes("needs.ci-summary.outputs.status == 'RELEASE_READY'"));
  for(const check of ['current.data.head.sha !== pr.head.sha','current.data.base.sha !== pr.base.sha','current.data.draft','sha: pr.head.sha'])assert.ok(merge.includes(check));
  assert.match(j['post-merge-verify'],/^    needs: auto-merge$/m);assert.match(j['post-merge-verify'],/needs\.auto-merge\.result == 'success'/);
  assert.match(j['post-merge-verify'],/head_sha: mergeSha/);assert.match(j['final-status'],/DIAGNOSTIC_STATUS/);
  assert.match(j['final-status'],/core\.summary\.addHeading\(ready \? 'RELEASE_READY' : 'RELEASE_BLOCKED'\)/);
  assert.match(j['final-status'],/if \(!ready\) core\.setFailed\('RELEASE_BLOCKED'\)/);
  const revision=steps(j.safety).revision;for(const token of ['APPROVED_HEAD_CHANGED','APPROVED_BASE_CHANGED','MAIN_CHANGED','PR_NOT_OPEN_READY','FOREIGN_HEAD_REPOSITORY'])assert.ok(revision.includes(token));
  for(const id of ['revision','checkout','node','source'])assert.ok(required(steps(j.safety).report).includes(id));
  return j;
}
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function execute(code,{env={},current,main,action='ready_for_review',apiFailure=false}={}){
  const sha='a'.repeat(40),base='b'.repeat(40),pr={number:84,draft:false,state:'open',merged:false,head:{sha,repo:{full_name:'mebleszek/meble-app'}},base:{sha:base,ref:'main'}};
  const outputs={},failures=[],tables=[];const summary={addHeading(){return this;},addRaw(){return this;},addTable(rows){tables.push(rows);return this;},async write(){}};
  const core={summary,setOutput:(key,value)=>outputs[key]=value,setFailed:value=>failures.push(value),notice(){}};
  const github={rest:{pulls:{get:async()=>{if(apiFailure)throw Error('Synthetic unavailable API');return{data:current||pr};}},git:{getRef:async()=>({data:{object:{sha:main||base}}})},issues:{async createComment(){}}}};
  await new AsyncFunction('core','github','context','process',code)(core,github,{payload:{pull_request:pr,action},repo:{owner:'mebleszek',repo:'meble-app'}},{env});
  return{outputs,failures,tables,pr};
}
async function diagnosticChecks(source){
  const j=workflowChecks(source);let count=0;const pass=name=>{count++;console.log('PASS CI diagnostics: '+name);};
  for(const mutate of [s=>s.replace('    needs: safety','    needs: [safety, preflight]'),s=>s.replace("steps.emulator-deps.outcome == 'success'", "steps.tests.outcome == 'success'"),s=>s.replace("needs.cloud-historical.result == 'success' && ",''),s=>s.replace('ref: ${{ needs.safety.outputs.head_sha }}','ref: main'),s=>s.replace("needs.ci-summary.outputs.status == 'RELEASE_READY' && ",''),s=>s.replace('types: [opened, ready_for_review]','types: [opened, synchronize]')])assert.throws(()=>workflowChecks(mutate(source)));
  pass('actual DAG and mutation rejection; independent runners, approved checkout, full-PASS merge/Pages');
  for(const result of ['failure','skipped','cancelled','success']){
    assert.equal(enabled(condition(j['firebase-current']),{results:{safety:'success',preflight:result}}),true);
    assert.equal(enabled(condition(j['cloud-historical']),{results:{safety:'success','firebase-current':result}}),true);
    assert.equal(enabled(condition(j['firebase-current']),{results:{safety:result}}),result==='success');
  }
  const hist=steps(j['cloud-historical']);assert.equal(enabled(condition(hist.sdk),{outcomes:{source:'success',java:'success','emulator-deps':'success','sdk-safety':'success',smoke:'failure'}}),true);
  assert.equal(enabled(condition(hist.smoke),{outcomes:{source:'success',java:'failure','emulator-deps':'skipped'}}),true);
  assert.equal(enabled(condition(hist.sdk),{outcomes:{source:'success',java:'failure','emulator-deps':'skipped'}}),false);
  pass('Preflight/current SDK failures do not suppress other safe groups; setup failure gates only its SDK');
  for(const name of ['safety','preflight','firebase-current','cloud-historical']){
    const s=steps(j[name]),list=required(s.report),base=Object.fromEntries(list.map(id=>[id,{outcome:'success'}]));
    const run=value=>execute(script(s.report),{env:{GROUP_STEPS:JSON.stringify(value),REQUIRED_STEPS:list.join(',')}});
    assert.equal((await run(base)).outputs.status,'PASS');
    const id=list.at(-1);assert.equal((await run({...base,[id]:{outcome:'failure',outputs:{reason:'SYNTHETIC_FAILURE'}}})).outputs.status,'FAIL');
    const skipped=await run({...base,[id]:{outcome:'skipped'}});assert.equal(skipped.outputs.status,'SKIPPED');assert.ok(skipped.outputs.reason.includes(id));
    assert.equal((await run({...base,source:{outcome:'failure',outputs:{reason:'CLOUD_CI_HISTORY_SHA_MISMATCH'}}})).outputs.status,'FAIL');
  }
  const finalCode=script(steps(j['final-status'])['Comment READY or BLOCKED on PR']);
  const finalEnv={PREFLIGHT_RESULT:'success',FIREBASE_RESULT:'success',HISTORICAL_RESULT:'success',SAFETY_RESULT:'success',PREFLIGHT_STATUS:'PASS',FIREBASE_STATUS:'PASS',HISTORICAL_STATUS:'PASS',SAFETY_STATUS:'PASS',MERGE_RESULT:'success',VERIFY_RESULT:'success',DIAGNOSTIC_STATUS:'RELEASE_READY'};
  assert.equal((await execute(finalCode,{env:finalEnv})).failures.length,0);
  for(const change of [{FIREBASE_STATUS:'SKIPPED'},{PREFLIGHT_RESULT:'failure'},{DIAGNOSTIC_STATUS:'RELEASE_BLOCKED'},{MERGE_RESULT:'skipped'},{VERIFY_RESULT:'failure'}])assert.ok((await execute(finalCode,{env:{...finalEnv,...change}})).failures.length);
  pass('actual report scripts retain FAIL/SKIPPED, missing step and exact safety/setup reasons');
  const summary=script(steps(j['ci-summary']).summary),groupKeys=['preflight','firebase-current','cloud-historical'];
  const group=result=>({result,outputs:{status:result==='success'?'PASS':result==='failure'?'FAIL':'SKIPPED',reason:result==='success'?'All required steps passed':'Synthetic '+result}});
  const all=()=>Object.fromEntries(['safety',...groupKeys].map(id=>[id,group('success')]));
  for(const a of ['success','failure','skipped','cancelled','unknown'])for(const b of ['success','failure','skipped','cancelled','unknown'])for(const c of ['success','failure','skipped','cancelled','unknown']){
    const groups=all();[a,b,c].forEach((value,i)=>groups[groupKeys[i]]=group(value));
    const r=await execute(summary,{env:{GROUPS:JSON.stringify(groups)}});const ready=[a,b,c].every(v=>v==='success');
    assert.equal(r.outputs.status,ready?'RELEASE_READY':'RELEASE_BLOCKED');assert.equal(r.failures.length,ready?0:1);
  }
  for(const variant of [{result:'failure',outputs:{status:'PASS'}},{result:'success',outputs:{}},{result:'success',outputs:{status:'SKIPPED'}}]){
    const groups=all();groups['firebase-current']=variant;assert.equal((await execute(summary,{env:{GROUPS:JSON.stringify(groups)}})).outputs.status,'RELEASE_BLOCKED');
  }
  pass('125 actual aggregation cases plus contradictory/missing receipts: no FAIL/SKIPPED/uncertainty can release');
  const good=(await execute(summary,{env:{GROUPS:JSON.stringify(all())}})).pr;
  const variants=[{...good,draft:true},{...good,state:'closed'},{...good,head:{...good.head,sha:'c'.repeat(40)}},{...good,base:{...good.base,sha:'c'.repeat(40)}},{...good,base:{...good.base,ref:'other'}}];
  for(const current of variants){assert.equal((await execute(summary,{env:{GROUPS:JSON.stringify(all())},current})).outputs.status,'RELEASE_BLOCKED');assert.ok((await execute(script(steps(j.safety).revision),{current})).failures.length);}
  for(const extra of [{main:'c'.repeat(40)},{apiFailure:true},{action:'synchronize'}]){
    assert.equal((await execute(summary,{env:{GROUPS:JSON.stringify(all())},...extra})).outputs.status,'RELEASE_BLOCKED');
    assert.ok((await execute(script(steps(j.safety).revision),extra)).failures.length);
  }
  pass('moved HEAD/BASE/main, revoked Ready, closed PR, API uncertainty and unapproved event block release');
  const plan=[{context:'current',files:context.currentSdk},{context:'historical',files:context.historicalSdk}];
  assert.deepEqual(selectPlan(plan,['--context=current']),[plan[0]]);assert.deepEqual(selectPlan(plan,['--context=historical']),[plan[1]]);assert.deepEqual(selectPlan(plan,[]),plan);
  for(const args of [['--context=production'],['--context=current','--context=historical'],['--skip']])assert.throws(()=>selectPlan(plan,args),/CLOUD_CI_CONTEXT_INVALID/);
  assert.deepEqual([...new Set(plan.flatMap(row=>row.files))].sort(),[...context.currentSdk,...context.historicalSdk].sort());
  pass('all original SDK files assigned once, explicit context partition, invalid selection refused');
  const {prepare}=require('./cloud-ci-prepare'),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-ci-prepare-'));
  try{
    context.git(fixture,['init','--quiet']);fs.writeFileSync(path.join(fixture,'source.txt'),'Synthetic source\n');context.git(fixture,['add','source.txt']);
    context.git(fixture,['-c','user.name=CI fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','--quiet','-m','Synthetic source gate']);
    const head=context.git(fixture,['rev-parse','HEAD']);
    assert.throws(()=>prepare(fixture,'main',fixture,head),/EXACT_HEAD_REQUIRED/);
    assert.throws(()=>prepare(fixture,head,fixture,'main'),/EXACT_BASE_REQUIRED/);
    assert.throws(()=>prepare(fixture,head,fixture,head),/ISOLATION_REQUIRED/);
    assert.throws(()=>prepare(fixture,head,fixture+'\n',head),/PATH_INVALID/);
    fs.writeFileSync(path.join(fixture,'source.txt'),'Unapproved mutation\n');assert.throws(()=>prepare(fixture,head,fixture,head),/CURRENT_SOURCE_DIRTY/);
    assert.equal(fs.existsSync(path.join(fixture,'meble-cloud-history')),false);
  }finally{fs.rmSync(fixture,{recursive:true,force:true});}
  pass('actual source gate rejects wrong HEAD/BASE, dirty source and unsafe paths before clone/install/test effects');
  const emulator=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-ci-emulator-boundary-'));
  try{
    const cwd=path.join(emulator,'tools/firebase-pilot'),cli=path.join(cwd,'node_modules/firebase-tools/lib/bin/firebase.js');fs.mkdirSync(path.dirname(cli),{recursive:true});fs.writeFileSync(cli,'// Synthetic marker: never executed\n');
    const config={emulators:{auth:{host:'127.0.0.1',port:19099},firestore:{host:'127.0.0.1',port:18080},singleProjectMode:true,ui:{enabled:false}}};
    const write=value=>fs.writeFileSync(path.join(cwd,'firebase.json'),JSON.stringify(value));write(config);assert.equal(verifyGroup({root:emulator,context:'current'}).cli,cli);
    for(const change of [c=>c.emulators.auth.host='firebase.googleapis.com',c=>c.emulators.firestore.port=443,c=>c.emulators.singleProjectMode=false,c=>c.emulators.ui.enabled=true]){
      const altered=JSON.parse(JSON.stringify(config));change(altered);write(altered);assert.throws(()=>verifyGroup({root:emulator,context:'current'}),/CLOUD_CI_EMULATOR_CONFIG_UNSAFE/);
    }
    write(config);fs.unlinkSync(cli);assert.throws(()=>verifyGroup({root:emulator,context:'historical'}),/CLOUD_CI_SDK_DEPENDENCIES_REQUIRED/);
  }finally{fs.rmSync(emulator,{recursive:true,force:true});}
  pass('actual emulator safety gate refuses wrong host/port, UI, shared project mode or missing CLI before execution');
  const logs=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-ci-log-pipeline-'));
  try{
    const run=steps(j.preflight).tests.split('        run: |\n')[1].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
    const producer=/^node "\$PREFLIGHT_DIR\/tools\/preflight\.js" --current-only /m;assert.match(run,producer);
    for(const [exitCode,brokenLog]of [[0,false],[7,false],[0,true]]){
      const logDir=path.join(logs,'ci-logs');fs.rmSync(logDir,{recursive:true,force:true});fs.mkdirSync(logDir);
      if(brokenLog)fs.mkdirSync(path.join(logDir,'preflight.txt'));
      const command=run.replace(producer,"bash -c 'printf synthetic-diagnostic; exit "+exitCode+"' ");
      assert.equal(command.includes('node "$PREFLIGHT_DIR'),false,'Never execute real Preflight in this unit diagnostic');
      const result=require('node:child_process').spawnSync('bash',['-c',command],{encoding:'utf8',env:{...process.env,RUNNER_TEMP:logs,GITHUB_OUTPUT:path.join(logs,'outputs')}});
      assert.equal(result.status===0,exitCode===0&&!brokenLog);if(exitCode)assert.equal(result.status,exitCode);if(brokenLog)assert.match(result.stderr,/DIAGNOSTIC_LOG_WRITE_FAILED/);
    }
  }finally{fs.rmSync(logs,{recursive:true,force:true});}
  pass('actual shell pipeline preserves producer FAIL and refuses PASS if diagnostic log writing fails');
  return count;
}
module.exports={workflowChecks,diagnosticChecks};
