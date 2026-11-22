import {copy,equal,fail} from './local-first-values.mjs';
import {quoteReleaseEditor} from './local-first-quote-release.mjs';

// Reuses the existing PIN/epoch takeover and ordinary owner release. No room,
// revision, draft, RAW image or outbox payload is replaced by this operation.
export function createQuoteRelease({store,protocol,assertAccess,label}){
 let working=null;
 async function reconcile(row){
  assertAccess();let status=await protocol.projectStatus(row.investorId,row.projectId);
  const owned=quoteReleaseEditor(row),released={editor:{...owned,active:false},revision:row.expected.revision};
  if(equal(status,released))return store.finishQuoteRelease(row,'released',status);
  if(!equal(status,row.expected)&&!equal(status,{editor:owned,revision:row.expected.revision})){
   await store.finishQuoteRelease(row,'changed',status);fail('LF_P0B_EDITOR_CONFLICT');
  }
  if(equal(status,row.expected)){
   if((await protocol.pin.status()).revision!==row.pinRevision)fail('LF_P0B_PIN_CONFLICT');
   try{await protocol.advanceEditor({iid:row.investorId,pid:row.projectId,expected:row.expected,deviceLabel:row.deviceLabel,pinRevision:row.pinRevision});}
   catch(error){status=await protocol.projectStatus(row.investorId,row.projectId);if(!equal(status,{editor:owned,revision:row.expected.revision}))throw error;}
  }
  assertAccess();await protocol.release({iid:row.investorId,pid:row.projectId,expectedHead:row.expected.revision,expectedEditor:owned});
  status=await protocol.projectStatus(row.investorId,row.projectId);
  if(!equal(status,released)){await store.finishQuoteRelease(row,'changed',status);fail('LF_P0B_EDITOR_CONFLICT');}
  return store.finishQuoteRelease(row,'released',status);
 }
 async function reconcileAll(investorId){for(const row of await store.pendingQuoteReleases())if(!investorId||row.investorId===investorId)await reconcile(row);}
 async function resume(investorId){
  if(working)return working;
  working=reconcileAll(investorId).finally(()=>{working=null;});return working;
 }
 async function release({investorId,targets,pin}){
  assertAccess();if(working)fail('LF_APPLICATION_BUSY');
  working=(async()=>{
  const pinRevision=await protocol.pin.verify(pin);
  for(const target of targets){const current=await protocol.projectStatus(investorId,target.projectId);if(!equal(current,target.expected))fail('LF_P0B_EDITOR_CONFLICT');}
  const pending=await store.pendingQuoteReleases();
  for(const row of pending)if(row.investorId===investorId&&row.pinRevision!==pinRevision&&targets.some(target=>target.projectId===row.projectId&&equal(target.expected,row.expected)))await store.reauthorizeQuoteRelease(row,pinRevision);
  const fresh=targets.filter(target=>!pending.some(row=>row.projectId===target.projectId));
  const application=await store.readApplication();
  if(fresh.length)await store.stageQuoteReleases({investorId,targets:copy(fresh),pinRevision,deviceLabel:label(),application});
  await reconcileAll(investorId);return {ok:true};
  })().finally(()=>{working=null;});return working;
 }
 return {release,resume};
}
