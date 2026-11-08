'use strict';
const assert=require('node:assert/strict');
const {fixture,offers}=require('./project-navigation-blockers-smoke');
async function main(){
 let count=0;
 for(const invalid of [false,null,{ok:false}]){
  const r=fixture(),snap=offers(r)[0],before=r.seed(),ram=JSON.stringify(r.s.projectData);let calls=0;
  r.FC.applicationWrite={localOnly:true,async project(fn){calls++;try{return fn();}catch(e){r.storage.rows=new Map(Object.entries(before));r.s.projectData=JSON.parse(ram);throw e;}}};
  const expected=r.FC.wycenaTabHistory.captureDeletion(snap);
  await assert.rejects(r.FC.wycenaTabHistory.removeConfirmed(snap,expected,()=>invalid),/STATUS_UNCONFIRMED/);assert.deepEqual(r.seed(),before);assert.equal(calls,1);count++;
 }
 for(const change of ['session','owner','snapshot','project','writer','mode']){
  const r=fixture(),snap=offers(r)[0];let calls=0;r.FC.applicationWrite={localOnly:true,project(){calls++;throw Error('MUST_NOT_ENTER');}};
  const expected=r.FC.wycenaTabHistory.captureDeletion(snap);
  if(change==='session')r.FC.session.active=true;
  if(change==='owner')r.FC.investors.setCurrentId('N');
  if(change==='snapshot'){const s=r.FC.quoteSnapshotStore.getById(snap.id);s.scope.selectedRooms=['room_s'];r.FC.quoteSnapshotStore.save(s);}
  if(change==='project')r.FC.projectStore.setCurrentProjectId('Q');
  if(change==='writer')r.FC.applicationWrite.project=()=>{calls++;throw Error('MUST_NOT_ENTER');};
  if(change==='mode')r.FC.applicationWrite.localOnly=false;
  const before=r.seed();await assert.rejects(r.FC.wycenaTabHistory.removeConfirmed(snap,expected,()=>{throw Error('MUST_NOT_RECONCILE');}),/LF_QUOTE_DELETE/);assert.deepEqual(r.seed(),before);assert.equal(calls,0);count++;
 }
 {
  const r=fixture(),snap=offers(r)[0];r.FC.applicationWrite={localOnly:true,project:async fn=>fn()};const stale=structuredClone(snap);stale.scope.selectedRooms=['room_x'];assert.throws(()=>r.FC.wycenaTabHistory.captureDeletion(stale),/OWNER_CHANGED/);count++;
 }
 {
  const r=fixture(),snap=offers(r)[0];let reconciled=false;r.storage.fail.set('fc_quote_snapshots_v1',true);await assert.rejects(r.FC.wycenaTabHistory.removeConfirmed(snap,null,()=>{reconciled=true;}));assert.equal(reconciled,false);assert.ok(r.FC.quoteSnapshotStore.getById(snap.id));count++;
 }
 for(const selected of [false,true])for(const localOnly of [false,true]){
  const r=fixture(),snap=offers(r)[0];if(selected){snap.meta={...snap.meta,selectedByClient:true,acceptedAt:123};r.FC.quoteSnapshotStore.save(snap);}
  let used=0;r.FC.applicationWrite={localOnly,project:async fn=>{used++;return fn();}};const stored=r.FC.quoteSnapshotStore.getById(snap.id),expected=r.FC.wycenaTabHistory.captureDeletion(stored),foreign=JSON.stringify(r.FC.projectStore.getById('Q'));
  assert.equal(await r.FC.wycenaTabHistory.removeConfirmed(stored,expected,(s,o)=>r.FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval(s,o)),true);assert.equal(r.FC.quoteSnapshotStore.getById(snap.id),null);assert.equal(used,1);assert.equal(JSON.stringify(r.FC.projectStore.getById('Q')),foreign);assert.ok(r.FC.quoteSnapshotStore.getById('B'));count++;
 }
 console.log('quote-delete-local-first smoke: '+count+'/'+count+' PASS');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
