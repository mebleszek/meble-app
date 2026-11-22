'use strict';
// Read-only structural/model checks of the actual workflow, not emulator mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const context=require('./cloud-ci-context'),{selectPlan,verifyGroup,batchesForGroup,completeTap}=require('./cloud-ci-emulators');
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
function enabled(expression,{outcomes={},results={},cancelled=false,mode='full'}={}){
  assert.ok(expression?.startsWith('${{ ')&&expression.endsWith(' }}'));
  return expression.slice(4,-3).split(' && ').every(term=>{
    if(term==='!cancelled()')return !cancelled;
    if(term==='always()')return true;
    const scope=term.match(/^needs\.safety\.outputs\.release_mode == '(full|documents)'$/);if(scope)return mode===scope[1];
    const m=term.match(/^(steps|needs)\.([a-z0-9-]+)\.(outcome|result) == 'success'$/);assert.ok(m,'Unknown execution condition: '+term);
    return(m[1]==='steps'?outcomes:results)[m[2]]==='success';
  });
}
function workflowChecks(source){
  const j=jobs(source);
  const ids=['safety','documents','preflight-static','preflight-shards','playwright-local-ui','owner-signing-windows','preflight','firebase-current-shards','playwright-sync-ui','firebase-p0b','firebase-current','cloud-historical-smoke','cloud-historical-sdk','cloud-historical','ci-summary','auto-merge','post-merge-verify','final-status'];
  assert.deepEqual(Object.keys(j).sort(),ids.slice().sort(),'Unclassified CI jobs');
  assert.doesNotMatch(source,/continue-on-error:/);
  const trigger=source.split('\njobs:')[0];
  assert.match(trigger,/types: \[opened, ready_for_review\]/);
  assert.doesNotMatch(trigger,/^  push:|types:.*synchronize/m);
  const documents=j.documents,docSteps=steps(documents);
  assert.equal(condition(documents),"${{ !cancelled() && needs.safety.result == 'success' && needs.safety.outputs.release_mode == 'documents' }}");
  assert.match(documents,/needs: safety/);assert.match(docSteps['Verify isolated source and 425 pins'],/cloud-ci-prepare/);
  assert.match(docSteps['Checkout exact approved head'],/ref: \$\{\{ needs.safety.outputs.head_sha \}\}/);assert.match(docSteps['Checkout exact approved head'],/persist-credentials: false/);
  for(const command of ['ci-docs-scope.js','--verify-documents','ci-docs-scope-smoke.js','cloud-ci-current-boundary-smoke.js','set -euo pipefail'])assert.ok(docSteps.verify.includes(command));
  assert.match(j.safety,/release_mode: \$\{\{ steps.scope.outputs.release_mode \}\}/);
  assert.match(steps(j.safety).scope,/ci-docs-scope.js "\$APPROVED_BASE" "\$APPROVED_HEAD"/);
  const owner=j['owner-signing-windows'],ownerSteps=steps(owner);
  assert.match(owner,/^    needs: safety$/m);
  assert.equal(condition(owner),"${{ !cancelled() && needs.safety.result == 'success' && needs.safety.outputs.release_mode == 'full' }}");
  assert.match(owner,/^    runs-on: windows-latest$/m);
  assert.match(ownerSteps['Checkout exact approved head'],/ref: \$\{\{ needs.safety.outputs.head_sha \}\}/);
  assert.match(ownerSteps['Checkout exact approved head'],/persist-credentials: false/);
  assert.match(ownerSteps['Checkout exact approved head'],/GIT_CONFIG_COUNT: '1'\n          GIT_CONFIG_KEY_0: core.autocrlf\n          GIT_CONFIG_VALUE_0: 'false'/);
  assert.match(ownerSteps['Test isolated DPAPI owner signing'],/shell: pwsh\n        run: node tools\/application-owner-signing-smoke.js/);
  const runners=['preflight-static','preflight-shards','firebase-current-shards','cloud-historical-smoke','cloud-historical-sdk'];
  for(const id of runners){
    const job=j[id],s=steps(job);
    assert.match(job,/^    needs: safety$/m);
    assert.equal(condition(job),"${{ !cancelled() && needs.safety.result == 'success' && needs.safety.outputs.release_mode == 'full' }}");
    assert.match(s['Checkout exact approved head'],/ref: \$\{\{ needs\.safety\.outputs\.head_sha \}\}/);
    assert.match(s['Verify isolated source and 425 pins'],/cloud-ci-prepare\.js "\$APPROVED_HEAD"/);
    assert.match(s['Verify isolated source and 425 pins'],/APPROVED_BASE: \$\{\{ needs\.safety\.outputs\.base_sha \}\}/);
    assert.ok(s['Use Node.js 22']);
    const label=id==='preflight-shards'?'smoke-shard-${{ matrix.shard }}':id==='firebase-current-shards'?'firebase-current-${{ matrix.segment }}':id;
    assert.equal(condition(s['Upload '+label+' diagnostics']),'${{ always() }}');
  }
  // New Playwright jobs are mandatory members of the same fail-closed DAG.
  for(const [id,runStep,uploadStep] of [
    ['playwright-local-ui','Test Playwright localOnly UI and IDB restart','Upload Playwright localOnly diagnostics'],
    ['playwright-sync-ui','Run signed DEMO Playwright against isolated Auth and Firestore emulators','Upload synchronized UI diagnostics'],
    ['firebase-p0b','Run mandatory P0-B candidate segment','Upload P0-B diagnostics']
  ]){
    const job=j[id],s=steps(job);
    assert.match(job,/^    needs: safety$/m,id);
    assert.equal(condition(job),"${{ !cancelled() && needs.safety.result == 'success' && needs.safety.outputs.release_mode == 'full' }}",id);
    assert.match(s['Checkout exact approved head'],/ref: \$\{\{ needs\.safety\.outputs\.head_sha \}\}/,id);
    assert.match(s['Verify isolated source and 425 pins'],/cloud-ci-prepare\.js "\$APPROVED_HEAD"/,id);
    assert.match(s['Verify isolated source and 425 pins'],/APPROVED_BASE: \$\{\{ needs\.safety\.outputs\.base_sha \}\}/,id);
    assert.match(job,/uses: actions\/setup-node@v4/,id);
    assert.equal(condition(s[uploadStep]),'${{ always() }}',id);
    const command=s[runStep];
    assert.match(command,/set -euo pipefail/,id);
    assert.match(command,/2>&1 \| tee "\$RUNNER_TEMP\/ci-logs\//,id);
    assert.doesNotMatch(command,/timeout /,id);
  }
  assert.match(steps(j['playwright-local-ui'])['Test Playwright localOnly UI and IDB restart'],/node --test tools\/firebase-pilot\/playwright-local-ui\.test\.mjs/);
  assert.match(steps(j['playwright-sync-ui'])['Run signed DEMO Playwright against isolated Auth and Firestore emulators'],/cloud-ci-emulators\.js --context=current --playwright-sync/);
  assert.match(j['playwright-sync-ui'],/uses: actions\/setup-java@v4/);
  assert.match(j['firebase-p0b'],/fail-fast: false/);
  const p0bSegments=j['firebase-p0b'].match(/^        segment: \[([^\]]+)\]$/m);
  assert.ok(p0bSegments);
  assert.deepEqual(p0bSegments[1].split(', '),require('./p0b-ci-plan').groups.map(row=>row.id));
  assert.match(steps(j['firebase-p0b'])['Run mandatory P0-B candidate segment'],/cloud-ci-emulators\.js --context=current --p0b=\$\{\{ matrix\.segment \}\}/);
  assert.match(j['firebase-p0b'],/uses: actions\/setup-java@v4/);
  const stat=steps(j['preflight-static']),smoke=steps(j['preflight-shards']),cur=steps(j['firebase-current-shards']),histSmoke=steps(j['cloud-historical-smoke']),histSdk=steps(j['cloud-historical-sdk']);
  assert.match(stat['Test preflight-static'],/tools\/preflight\.js --current-only --static-only/);
  assert.match(stat['Audit module growth against approved BASE'],/tools\/ci-module-growth\.js/);
  assert.match(stat['Audit module growth against approved BASE'],/APPROVED_BASE: \$\{\{ needs\.safety\.outputs\.base_sha \}\}/);
  assert.match(j['preflight-shards'],/fail-fast: false/);
  const expectedShards=Array.from({length:36},(_,i)=>i+1);
  const listedShards=j['preflight-shards'].match(/^        shard: \[([^\]]+)\]$/m);
  assert.ok(listedShards,'Missing explicit smoke matrix');
  assert.deepEqual(listedShards[1].split(', ').map(Number),expectedShards,'All 36 smoke groups required');
  assert.ok(smoke['Test smoke-shard-${{ matrix.shard }}'].includes('--smoke-shard=${{ matrix.shard }}'));
  assert.match(smoke['Inspect isolated browser runtime'],/CHROMIUM_PATH/);
  assert.match(j['firebase-current-shards'],/fail-fast: false/);
  const actualSegments=Array.from(j['firebase-current-shards'].matchAll(/^          - \{batch: ([123]), segment: '([^']+)'\}$/gm),m=>[Number(m[1]),m[2]]);
  assert.deepEqual(actualSegments,[[1,'1a'],[1,'1b'],[2,'2'],[3,'3a'],[3,'3b'],[3,'3c'],[3,'3d'],[3,'3e']],'Complete eight isolated Firebase DEMO segments required');
  assert.ok(cur['Test firebase-current-${{ matrix.segment }}'].includes('--context=current --batch=${{ matrix.batch }}'));
  assert.match(cur['Inspect isolated browser runtime'],/CHROMIUM_PATH/);
  assert.match(histSmoke['Test cloud-historical-smoke'],/tools\/cloud-ci-historical\.js/);
  for(const [id,s,contextName,deps] of [
    ['firebase-current-shards',cur,'current','PREFLIGHT_DIR'],
    ['cloud-historical-sdk',histSdk,'historical','CLOUD_CI_HISTORY_ROOT']
  ]){
    assert.ok(s['Use Java 21 for DEMO emulators'],id);
    assert.match(s['Install locked DEMO emulator dependencies'],new RegExp(deps+'\\/tools\\/firebase-pilot" ci --prefer-offline --no-audit --no-fund'));
    assert.match(s['Verify SDK source, pins and DEMO boundaries'],new RegExp('cloud-ci-prepare\\.js --verify-sdk '+contextName));
    assert.match(s['Verify SDK source, pins and DEMO boundaries'],/APPROVED_BASE: \$\{\{ needs\.safety\.outputs\.base_sha \}\}/);
  }
  const runs=[
    ['preflight-static',stat['Test preflight-static'],'preflight-static'],
    ['preflight-shards',smoke['Test smoke-shard-${{ matrix.shard }}'],'smoke-shard-${{ matrix.shard }}'],
    ['firebase-current-shards',cur['Test firebase-current-${{ matrix.segment }}'],'firebase-current-${{ matrix.segment }}'],
    ['cloud-historical-smoke',histSmoke['Test cloud-historical-smoke'],'cloud-historical-smoke'],
    ['cloud-historical-sdk',histSdk['Test cloud-historical-sdk'],'cloud-historical-sdk']
  ];
  for(const [id,run,label] of runs){
    assert.ok(run,id);
    assert.match(run,/set -euo pipefail/);
    assert.ok(run.includes('node tools/ci-budget-watch.js --label='+label+' --warn-ms=75000 --target-ms=90000 -- node tools/'));
    assert.match(run,/2>&1 \| tee "\$RUNNER_TEMP\/ci-logs\//);
    assert.doesNotMatch(run,/timeout /);
  }
  assert.match(cur['Test firebase-current-${{ matrix.segment }}'],/tools\/cloud-ci-emulators\.js --context=current --batch=\$\{\{ matrix\.batch \}\} --segment=\$\{\{ matrix\.segment \}\}/);
  assert.match(histSdk['Test cloud-historical-sdk'],/tools\/cloud-ci-emulators\.js --context=historical/);
  const aggregates={
    preflight:['safety','preflight-static','preflight-shards','playwright-local-ui','owner-signing-windows'],
    'firebase-current':['safety','firebase-current-shards','playwright-sync-ui','firebase-p0b'],
    'cloud-historical':['safety','cloud-historical-smoke','cloud-historical-sdk']
  };
  for(const [id,members] of Object.entries(aggregates)){
    const job=j[id],s=steps(job);
    assert.equal(condition(job),'${{ always() }}');
    assert.ok(job.includes('needs: ['+members.join(', ')+', documents]'));
    const body=script(s.report);
    assert.ok(body.includes('const names='+JSON.stringify(members)+';'));
    assert.match(body,/groups\[name\]\?\.result!=='success'/);
    assert.match(body,/status=missing\.length\?'FAIL':'PASS'/);
    assert.match(body,/core\.setOutput\('status',status\)/);
    assert.match(body,/core\.setOutput\('reason',reason\)/);
    assert.match(body,/if\(missing\.length\)core\.setFailed\(reason\)/);
    assert.ok(body.includes("if(groups.safety?.outputs?.release_mode==='documents')names.splice(0,names.length,'safety','documents');"));
    assert.ok(body.includes("groups.documents?.outputs?.status!=='PASS')missing.push('documents-proof')"));
    assert.match(job,/status: \$\{\{ steps\.report\.outputs\.status \}\}/);
  }
  assert.equal(condition(j['ci-summary']),'${{ always() }}');
  assert.match(j['ci-summary'],/needs: \[safety, preflight, firebase-current, cloud-historical\]/);
  const sum=script(steps(j['ci-summary']).summary);
  assert.ok(sum.includes("const keys = ['safety','preflight','firebase-current','cloud-historical'];"));
  assert.match(sum,/job\.result === 'success' && job\.outputs\?\.status === 'PASS'/);
  assert.match(sum,/main\.object\.sha === pr\.base\.sha/);
  assert.match(sum,/current\.head\.sha === pr\.head\.sha && current\.base\.sha === pr\.base\.sha/);
  assert.match(sum,/if \(!ready\) core\.setFailed\('RELEASE_BLOCKED:/);
  const merge=j['auto-merge'];
  assert.ok(condition(merge).startsWith('${{ !cancelled() && '),'Publication must explicitly evaluate verified gates despite a non-applicable ancestor');
  assert.match(merge,/needs: \[safety, preflight, firebase-current, cloud-historical, ci-summary\]/);
  for(const id of ['safety','preflight','firebase-current','cloud-historical','ci-summary'])assert.ok(condition(merge).includes("needs."+id+".result == 'success'"));
  assert.ok(condition(merge).includes("needs.ci-summary.outputs.status == 'RELEASE_READY'"));
  for(const check of ['current.data.head.sha !== pr.head.sha','current.data.base.sha !== pr.base.sha','current.data.draft','sha: pr.head.sha'])assert.ok(merge.includes(check));
  assert.match(j['post-merge-verify'],/^    needs: auto-merge$/m);
  assert.ok(condition(j['post-merge-verify']).startsWith('${{ !cancelled() && '));
  assert.match(j['post-merge-verify'],/needs\.auto-merge\.result == 'success'/);
  assert.match(j['post-merge-verify'],/head_sha: mergeSha/);
  assert.match(j['final-status'],/DIAGNOSTIC_STATUS/);
  assert.match(j['final-status'],/core\.summary\.addHeading\(ready \? 'RELEASE_READY' : 'RELEASE_BLOCKED'\)/);
  assert.match(j['final-status'],/if \(!ready\) core\.setFailed\('RELEASE_BLOCKED'\)/);
  const revision=steps(j.safety).revision;
  for(const token of ['APPROVED_HEAD_CHANGED','APPROVED_BASE_CHANGED','MAIN_CHANGED','PR_NOT_OPEN_READY','FOREIGN_HEAD_REPOSITORY'])assert.ok(revision.includes(token));
  for(const id of ['revision','checkout','node','source','scope'])assert.ok(required(steps(j.safety).report).includes(id));
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
  const j=workflowChecks(source);let count=0;
  const pass=name=>{count++;console.log('PASS CI diagnostics: '+name);};
  const mutation=(from,to)=>Object.assign(s=>{assert.ok(s.includes(from),'Missing fixture mutation: '+from);return s.replace(from,to);},{from});
  for(const change of [
    mutation('  auto-merge:\n    if: ${{ !cancelled() && ','  auto-merge:\n    if: ${{ '),
    mutation('  post-merge-verify:\n    if: ${{ !cancelled() && ','  post-merge-verify:\n    if: ${{ '),
    mutation("needs.safety.outputs.release_mode == 'full'","needs.safety.outputs.release_mode != 'documents'"),
    mutation('node tools/ci-docs-scope.js "$APPROVED_BASE" "$APPROVED_HEAD" --verify-documents','echo unverified-documentation'),
    mutation("groups.documents?.outputs?.status!=='PASS'","false"),
    mutation("GIT_CONFIG_VALUE_0: 'false'", "GIT_CONFIG_VALUE_0: 'true'"),
    mutation('runs-on: windows-latest','runs-on: ubuntu-latest'),
    mutation('run: node tools/application-owner-signing-smoke.js','run: echo unverified'),
    mutation('    needs: [safety, preflight-static, preflight-shards, playwright-local-ui, owner-signing-windows, documents]','    needs: safety'),
    mutation('shard: ['+Array.from({length:36},(_,i)=>i+1).join(', ')+']','shard: [1, 2, 3, 4, 5, 6]'),
    mutation("- {batch: 3, segment: '3e'}","- {batch: 3, segment: '3z'}"),
    mutation('    needs: [safety, firebase-current-shards, playwright-sync-ui, firebase-p0b, documents]','    needs: [safety, firebase-current-shards, firebase-p0b]'),
    mutation('    needs: [safety, firebase-current-shards, playwright-sync-ui, firebase-p0b, documents]','    needs: [safety, firebase-current-shards, playwright-sync-ui]'),
    mutation(j['firebase-p0b'].match(/^        segment: .*$/m)[0].trim(),'segment: [rules, profiles, compatibility, normal-startup, signed-startup]'),
    mutation('node --test tools/firebase-pilot/playwright-local-ui.test.mjs','node --test tools/firebase-pilot/removed-ui.test.mjs'),
    mutation('cloud-ci-emulators.js --context=current --playwright-sync','cloud-ci-emulators.js --context=current --no-sync'),
    mutation('const names=["safety","cloud-historical-smoke","cloud-historical-sdk"];','const names=["safety","cloud-historical-smoke"];'),
    mutation('if(missing.length)core.setFailed(reason);','if(false)core.setFailed(reason);'),
    mutation('ref: ${{ needs.safety.outputs.head_sha }}','ref: main'),
    mutation('cloud-ci-prepare.js --verify-sdk current','cloud-ci-prepare.js --verify-sdk historical'),
    mutation("needs.cloud-historical.result == 'success' && ",''),
    mutation("needs.ci-summary.outputs.status == 'RELEASE_READY' && ",''),
    mutation('types: [opened, ready_for_review]','types: [opened, synchronize]'),
    mutation('--label=preflight-static --warn-ms=75000 --target-ms=90000','--label=preflight-static --warn-ms=75000 --target-ms=90001'),
    mutation('      - name: Audit module growth against approved BASE','      - name: Unapproved module step')
  ]){const changed=change(source);assert.notEqual(changed,source);assert.throws(()=>workflowChecks(changed),undefined,'Mutation must be rejected: '+change.from);}
  pass('actual DAG, required groups, full-PASS merge/Pages and negative mutations');
  for(const id of ['preflight-static','preflight-shards','playwright-local-ui','owner-signing-windows','firebase-current-shards','playwright-sync-ui','firebase-p0b','cloud-historical-smoke','cloud-historical-sdk']){
    for(const result of ['failure','skipped','cancelled','success'])
      assert.equal(enabled(condition(j[id]),{results:{safety:result}}),result==='success');
    assert.equal(enabled(condition(j[id]),{results:{safety:'success'},mode:'documents'}),false);
    assert.equal(enabled(condition(j[id]),{results:{safety:'success'},mode:'unknown'}),false);
  }
  for(const mode of ['full','documents','unknown'])assert.equal(enabled(condition(j.documents),{results:{safety:'success'},mode}),mode==='documents');
  for(const id of ['preflight','firebase-current','cloud-historical'])
    assert.equal(enabled(condition(j[id]),{results:{safety:'failure'}}),true);
  pass('independent runners and fail-closed always-running aggregates');
  // Model the documented implicit success() at the runner boundary, using the
  // real publication expressions. Non-applicable ancestors are not failures.
  const publications=['safety','preflight','firebase-current','cloud-historical','ci-summary'];
  const publishedNeeds=Object.fromEntries(publications.map(name=>[name,{result:'success',outputs:{status:name==='ci-summary'?'RELEASE_READY':'PASS'}}]));
  const gh={event_name:'pull_request',event:{action:'ready_for_review',pull_request:{draft:false,head:{repo:{full_name:'mebleszek/meble-app'}}}},repository:'mebleszek/meble-app'};
  const gate=(expression,needs,cancelled=false)=>{
   if(!/\b(?:always|cancelled|success|failure)\(/.test(expression))return false; // skipped documents ancestor
   const js=expression.slice(4,-3).replace(/needs\.([a-z0-9-]+)/g,(_,name)=>'needs['+JSON.stringify(name)+']');
   return new Function('needs','github','cancelled','return ('+js+');')(needs,gh,()=>cancelled);
  };
  assert.equal(gate(condition(j['auto-merge']),publishedNeeds),true);
  assert.equal(gate(condition(j['auto-merge']),publishedNeeds,true),false);
  for(const name of publications)for(const result of ['failure','cancelled','skipped'])assert.equal(gate(condition(j['auto-merge']),{...publishedNeeds,[name]:{result}}),false);
  assert.equal(gate(condition(j['post-merge-verify']),{'auto-merge':{result:'success'}}),true);
  assert.equal(gate(condition(j['post-merge-verify']),{'auto-merge':{result:'skipped'}}),false);
  pass('actual publication conditions survive non-applicable ancestors but refuse every failed/cancelled/skipped mandatory gate');
  const safety=steps(j.safety),list=required(safety.report);
  const run=value=>execute(script(safety.report),{env:{GROUP_STEPS:JSON.stringify(value),REQUIRED_STEPS:list.join(',')}});
  const ok=Object.fromEntries(list.map(id=>[id,{outcome:'success'}]));
  assert.equal((await run(ok)).outputs.status,'PASS');
  for(const bad of [{outcome:'failure',outputs:{reason:'CLOUD_CI_HISTORY_SHA_MISMATCH'}},{outcome:'skipped'},{outcome:'cancelled'},null])
    assert.notEqual((await run(bad===null?Object.fromEntries(Object.entries(ok).filter(([name])=>name!=='source')):{...ok,source:bad})).outputs.status,'PASS');
  pass('actual Safety report refuses missing/skipped/failing source and pin checks');
  const aggregates={preflight:['safety','preflight-static','preflight-shards','playwright-local-ui','owner-signing-windows'],'firebase-current':['safety','firebase-current-shards','playwright-sync-ui','firebase-p0b'],'cloud-historical':['safety','cloud-historical-smoke','cloud-historical-sdk']};
  for(const [id,members] of Object.entries(aggregates)){
    const body=script(steps(j[id]).report),good=Object.fromEntries(members.map(name=>[name,{result:'success'}]));
    const success=await execute(body,{env:{GROUPS:JSON.stringify(good)}});
    assert.equal(success.outputs.status,'PASS');assert.equal(success.failures.length,0);
    const docs={safety:{result:'success',outputs:{release_mode:'documents'}},documents:{result:'success',outputs:{status:'PASS'}}};
    assert.equal((await execute(body,{env:{GROUPS:JSON.stringify(docs)}})).outputs.status,'PASS');
    assert.equal((await execute(body,{env:{GROUPS:JSON.stringify({...docs,documents:{result:'success'}})}})).outputs.status,'FAIL','Missing documentation receipt refuses');
    for(const result of ['failure','skipped','cancelled','unknown',null]){
     const refused={...docs,documents:result?{result}:undefined};
     assert.equal((await execute(body,{env:{GROUPS:JSON.stringify(refused)}})).outputs.status,'FAIL','Documentation proof cannot be omitted');
    }
    for(const member of members)for(const bad of ['failure','skipped','cancelled','unknown',null]){
      const groups={...good};if(bad===null)delete groups[member];else groups[member]={result:bad};
      const receipt=await execute(body,{env:{GROUPS:JSON.stringify(groups)}});
      assert.equal(receipt.outputs.status,'FAIL',id+' '+member+' '+bad);
      assert.ok(receipt.failures.length);assert.ok(receipt.outputs.reason.includes(member));
    }
  }
  pass('actual three aggregators refuse FAIL/SKIPPED/CANCELLED/missing inputs');
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
  assert.deepEqual(batchesForGroup(plan[0]).map(files=>files.length),[5,1,2]);
  assert.deepEqual(batchesForGroup(plan[0]).flat(),context.currentSdk);
  assert.throws(()=>batchesForGroup({context:'current',files:context.currentSdk.slice(0,-1)}),/CLOUD_CI_BATCH_PLAN_CHANGED/);
  const tap='# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(completeTap(tap),true);
  assert.equal(completeTap(tap.replace('# skipped 0','# skipped 1')),false);
  pass('all SDK files assigned once; current [5,1,2] complete with strict TAP, invalid selections rejected');
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
    const run=steps(j['preflight-static'])['Test preflight-static'].split('        run: |\n')[1].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
    const producer=/node tools\/ci-budget-watch\.js --label=preflight-static --warn-ms=75000 --target-ms=90000 -- node tools\/preflight\.js --current-only --static-only/;
    assert.match(run,producer);
    for(const [exitCode,brokenLog] of [[0,false],[7,false],[0,true]]){
      const logDir=path.join(logs,'ci-logs');fs.rmSync(logDir,{recursive:true,force:true});fs.mkdirSync(logDir);
      if(brokenLog)fs.mkdirSync(path.join(logDir,'preflight-static.txt'));
      const command=run.replace(producer,"bash -c 'printf synthetic-diagnostic; exit "+exitCode+"'");
      assert.ok(!command.includes('node tools/ci-budget-watch.js'),'No actual full Preflight in unit diagnostic');
      const result=require('node:child_process').spawnSync('bash',['-c',command],{encoding:'utf8',env:{...process.env,RUNNER_TEMP:logs}});
      assert.equal(result.status===0,exitCode===0&&!brokenLog);
      if(exitCode)assert.equal(result.status,exitCode);
      if(brokenLog)assert.match(result.stderr,/Is a directory|directory|cannot open/i);
    }
  }finally{fs.rmSync(logs,{recursive:true,force:true});}
  pass('actual shell pipeline preserves producer FAIL and refuses PASS if diagnostic log writing fails');
  return count;
}
module.exports={workflowChecks,diagnosticChecks};
