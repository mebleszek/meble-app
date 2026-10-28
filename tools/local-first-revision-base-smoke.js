'use strict';
// Exercise the real coordinator with an injected queue/channel, no Firebase or
// IDB durability claim. Real storage and SDK boundaries remain CI requirements.
const assert=require('node:assert/strict');
async function main(){
  const {createDurableSynchronizer}=await import('../sync/local-first-sync.mjs');
  const head=generation=>({ownerUid:'synthetic-owner',generation,revisionId:'synthetic-'+generation});
  const clone=structuredClone;
  async function run({base,receipt,previousPhase='verified',phase='queued',remote=head(2)}){
    const value={stock:[{id:'unchanged-id',qty:17}],price:281.123456789};
    const previous={key:'previous',scope:'globals',localVersion:1,phase:previousPhase,receipt};
    const operation={key:'current',scope:'globals',localVersion:3,phase,base,previousOperation:'previous',json:JSON.stringify(value),expected:head(3)};
    const operations=[previous,operation];let dirty=true,prepares=0,publishes=0,applies=0,online=false;
    const expected=head(3),store={
      snapshot:async()=>clone({replica:{version:3,dirty,json:operation.json},operations}),
      exclusive:fn=>fn(),
      transition:async(key,from,to,patch={})=>{
        const op=operations.find(row=>row.key===key);assert.equal(op.phase,from);Object.assign(op,patch,{phase:to});
        if(to==='verified'){assert.deepEqual(op.receipt,op.expected);dirty=false;}return clone(op);
      },
      apply:async()=>{applies++;assert.equal(dirty,false);}
    };
    let server=clone(remote),seenBase;
    const channel={scope:'globals',kind:'globals',
      prepare:async(_value,receivedBase)=>{
        prepares++;seenBase=clone(receivedBase);
        if(JSON.stringify(receivedBase)!==JSON.stringify(server))throw Object.assign(Error('GLOBAL_WRITE_CONFLICT'),{code:'GLOBAL_WRITE_CONFLICT'});
        return {expected,publish:async()=>{publishes++;server=clone(expected);}};
      },
      read:async()=>({head:clone(server),value:clone(value)})
    };
    const sync=createDurableSynchronizer({store,channels:[channel],eventTarget:new EventTarget(),online:()=>online});
    await sync.flush();online=true;
    let result;try{result=await sync.flush();}finally{sync.close();}
    return {result,prepares,publishes,applies,seenBase,operation,dirty,value};
  }
  const incoming=await run({base:head(2),receipt:head(1)});
  assert.deepEqual(incoming.result,{ok:true});assert.deepEqual(incoming.seenBase,head(2));
  assert.equal(incoming.publishes,1);assert.equal(incoming.operation.phase,'verified');assert.equal(incoming.dirty,false);
  const successor=await run({base:head(1),receipt:head(2)});
  assert.equal(successor.result.ok,true);assert.deepEqual(successor.seenBase,head(2));assert.equal(successor.publishes,1);
  const first=await run({base:null,receipt:head(2)});
  assert.equal(first.result.ok,true);assert.deepEqual(first.seenBase,head(2));
  const stale=await run({base:head(2),receipt:head(1),remote:head(4)});
  assert.equal(stale.result.code,'GLOBAL_WRITE_CONFLICT');assert.equal(stale.publishes,0);
  assert.equal(stale.operation.phase,'conflict');assert.equal(stale.dirty,true);assert.deepEqual(JSON.parse(stale.operation.json),stale.value);
  for(const options of [
    {base:head(2),receipt:{...head(2),revisionId:'conflicting-head'}},
    {base:head(2),receipt:null},
    {base:head(2),receipt:head(0)}
  ]){
    const refused=await run(options);assert.equal(refused.result.code,'LF_PREDECESSOR_BASE_CONFLICT');
    assert.equal(refused.prepares,0);assert.equal(refused.publishes,0);assert.equal(refused.operation.phase,'queued');assert.equal(refused.dirty,true);
  }
  const pending=await run({base:head(2),receipt:head(1),previousPhase:'uncertain'});
  assert.equal(pending.result.code,'LF_ACK_UNRESOLVED');assert.equal(pending.prepares,0);assert.equal(pending.publishes,0);
  // Restored inflight/uncertain operations only read; they never re-prepare or
  // publish even if they carry the older predecessor link.
  for(const phase of ['inflight','uncertain']){
    const recovered=await run({base:head(2),receipt:head(1),phase,remote:head(3)});
    assert.equal(recovered.result.ok,true);assert.equal(recovered.prepares,0);assert.equal(recovered.publishes,0);
    assert.equal(recovered.operation.phase,'verified');assert.equal(recovered.dirty,false);
  }
  console.log('PASS LOCAL-FIRST revision base: 10 cases; incoming/chained bases, stale CAS, conflicting heads, predecessor uncertainty, read-only ACK recovery');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
