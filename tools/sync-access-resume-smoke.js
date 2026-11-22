'use strict';
// Actual grant source with deterministic time/server replies; no SDK or LIVE I/O.
const assert=require('node:assert/strict'),fs=require('node:fs');
async function main(){
 const source=fs.readFileSync(require.resolve('../sync/application-sync-grant.mjs'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function','async function');
 let now=1000,interval,requests=0,resolveProof,expires=0,renewed=0,closed=false;
 const w=new EventTarget();w.document=new EventTarget();w.document.hidden=false;w.navigator={onLine:true};
 const proof={exists:()=>true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>({schemaVersion:1,activationId:'demo'})};
 const f={doc:()=>({}),runTransaction:()=>{requests++;return requests===1?Promise.resolve(proof):new Promise(resolve=>resolveProof=resolve);}};
 const create=new Function('assertApplicationRelease','fail','Date','setInterval','clearInterval',source+'\nreturn createApplicationSyncGrant;')(
  x=>x,code=>{throw Object.assign(Error(code),{code});},{now:()=>now},fn=>{interval=fn;return 1;},()=>{closed=true;});
 const grant=await create({release:{ownerUid:'owner',activationId:'demo'},window:w,session:{identity:()=>({uid:'owner',epoch:1})},db:{},firestore:f,onRenew:()=>renewed++,onExpire:()=>expires++});
 const settled=()=>new Promise(resolve=>setImmediate(resolve));
 try{
  grant.assert();assert.equal(renewed,1);
  w.document.hidden=true;w.dispatchEvent(new Event('pagehide'));now+=46000;
  assert.throws(()=>grant.assert(),/LF_SYNC_ACCESS_UNCONFIRMED/);
  w.document.hidden=false;w.document.dispatchEvent(new Event('visibilitychange'));await settled();
  assert.equal(requests,2,'Returning from suspended app must immediately request a fresh server proof');
  w.dispatchEvent(new Event('pageshow'));w.dispatchEvent(new Event('online'));interval();await settled();
  assert.equal(requests,2,'Resume events share one pending server read');assert.throws(()=>grant.assert(),/UNCONFIRMED/);
  resolveProof(proof);await settled();grant.assert();assert.equal(renewed,2);assert.equal(requests,2,'Finishing a shared read must not start another refresh');
  interval();await settled();w.navigator.onLine=false;w.dispatchEvent(new Event('offline'));w.navigator.onLine=true;w.dispatchEvent(new Event('online'));
  resolveProof(proof);await settled();await settled();assert.equal(requests,4,'A return event during an obsolete renewal schedules exactly one new-generation proof');
  assert.throws(()=>grant.assert(),/UNCONFIRMED/);resolveProof(proof);await settled();grant.assert();assert.equal(renewed,3);
  const pending=grant.refresh();w.navigator.onLine=false;w.dispatchEvent(new Event('offline'));resolveProof(proof);
  await assert.rejects(pending,/UNCONFIRMED/,'A reply started before invalidation cannot reinstate the grant');
  assert.throws(()=>grant.assert(),/UNCONFIRMED/);assert.equal(renewed,3);
  w.navigator.onLine=true;w.dispatchEvent(new Event('online'));await settled();assert.equal(requests,6);
  resolveProof({...proof,metadata:{fromCache:true,hasPendingWrites:false}});await settled();assert.throws(()=>grant.assert(),/UNCONFIRMED/);
  w.dispatchEvent(new Event('pageshow'));await settled();resolveProof(proof);await settled();grant.assert();
  assert.ok(expires>=1);const obsolete=grant.refresh(),expiredBeforeClose=expires;grant.close();resolveProof(proof);await assert.rejects(obsolete,/LF_AUTH_CHANGED/);
  assert.equal(expires,expiredBeforeClose,'Retired reader completion cannot suspend a newly bound session');assert.equal(closed,true);
  const count=requests;w.dispatchEvent(new Event('online'));w.document.dispatchEvent(new Event('visibilitychange'));await settled();assert.equal(requests,count);
  assert.throws(()=>grant.assert(),/LF_AUTH_CHANGED/);
 }finally{grant.close();}
 console.log('PASS sync grant resume: background/pageshow, coalesced proof, stale reply fenced, offline/cache refusal and cleanup');
 const {closeIdleApplicationVisits}=await import('../sync/application-visit-recovery.mjs');
 let rows={fc_ui_v1:JSON.stringify({entry:'investorsList'}),fc_edit_session_v1:null},active=false,valid=true,listed=0;const removed=[];
 const records=[{investorId:'one',visits:{pc:{token:'own'},phone:{token:'foreign'}}},{investorId:'other',visits:{phone:{token:'foreign-only'}}},{investorId:'deleted',deletionId:'gone',visits:{pc:{token:'archived'}}}];
 const args={authority:{rows:()=>structuredClone(rows),assertIdle(){}},protocol:{listInvestors:async()=>{listed++;return records;},closeInvestor:async(iid,token)=>removed.push([iid,token])},deviceId:'pc',sessionActive:()=>active,assertAccess(){if(!valid)throw Error('LF_SYNC_ACCESS_UNCONFIRMED');}};
 assert.equal(await closeIdleApplicationVisits(args),true);assert.deepEqual(removed,[['one','own']]);removed.length=0;
 active=true;assert.equal(await closeIdleApplicationVisits(args),false);active=false;assert.equal(listed,1);
 rows.fc_edit_session_v1=JSON.stringify({active:true});assert.equal(await closeIdleApplicationVisits(args),false);rows.fc_edit_session_v1=null;
 rows.fc_ui_v1=JSON.stringify({entry:'rooms'});assert.equal(await closeIdleApplicationVisits(args),false);rows.fc_ui_v1=JSON.stringify({entry:'investorsList'});
 valid=false;await assert.rejects(closeIdleApplicationVisits(args),/UNCONFIRMED/);valid=true;assert.deepEqual(removed,[]);
 const list=args.protocol.listInvestors;args.protocol.listInvestors=async()=>{const result=await list();rows.fc_ui_v1=JSON.stringify({entry:'rooms'});return result;};
 await assert.rejects(closeIdleApplicationVisits(args),/LF_ACTIVE_RAM_PROTECTED/);assert.deepEqual(removed,[]);
 console.log('PASS idle visit recovery: only own exact token, durable idle proof, no active drafts, foreign/deleted visits untouched, renewed access and UI race fenced');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
