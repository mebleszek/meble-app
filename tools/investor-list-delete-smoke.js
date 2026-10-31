'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {setup}=require('./investor-navigation-exit-smoke');
const {fixture}=require('./project-navigation-blockers-smoke');
const REMOVED='fc_investor_removed_ids_v1',PROJECTS='fc_projects_v1';
function ready(){
 const r=setup();r.FC.investorProjectPatches.patchInvestorsAPI();
 r.s.__FC_MAIN_ACCESS__={isValid:()=>true};
 r.FC.views.openInvestorsList();
 const q=r.FC.projectStore.getById('Q');q.projectData.meta.assignedInvestorId='synthetic-conflicting-owner';r.FC.projectStore.upsert(q);
 const rows=r.FC.investors.readAll(),index=rows.findIndex(x=>x.id==='N');assert.ok(index>=0);
 r.FC.choiceBox={ask:async()=>String(index)};
 r.FC.confirmBox={ask:async options=>{assert.match(options.message,/pozostaną zachowane/);assert.ok(options.message.includes(r.FC.investors.getById('N').name));return true;}};
 return r;
}
async function main(){
 const r=ready(),before=r.seed(),ram=JSON.stringify(r.s.projectData);
 const listHtml=r.FC.investorUiRender.buildList(r.FC.investors.readAll(),{});
 assert.match(listHtml,/class="btn-danger"[^>]*data-action="remove-investor-from-list"/);
 assert.ok(listHtml.indexOf('create-investor')<listHtml.indexOf('remove-investor-from-list'));
 assert.match(listHtml,/− Usuń/);assert.match(fs.readFileSync('css/investor-layout.css','utf8'),/investor-list-toolbar__actions\{display:flex/);
 assert.equal(await r.handlers['remove-investor-from-list']({}),true);
 assert.equal(r.FC.investors.getById('N'),null);assert.ok(r.FC.investors.getById('K'));
 for(const[key,value]of Object.entries(before))if(key!==REMOVED)assert.equal(r.storage.getItem(key),value,key+' retained');
 assert.equal(JSON.stringify(r.s.projectData),ram);assert.deepEqual(JSON.parse(r.storage.getItem(REMOVED)),['N']);
 assert.equal(r.FC.investorProjectRuntime.getActivationFailure(),null,'Deletion never activates the conflicting project');
 const restart=fixture(r.seed());assert.equal(restart.FC.investors.getById('N'),null);assert.ok(restart.FC.investors.getById('K'));
 assert.equal(restart.storage.getItem(PROJECTS),before[PROJECTS]);
 console.log('PASS red minus beside Add, explicit choice/confirmation, conflicting owner removed logically, restart and all RAW/RAM retained');
 for(const stage of ['picker','confirmation']){
  const t=ready(),state=t.seed();if(stage==='picker')t.FC.choiceBox.ask=async()=> 'back';else t.FC.confirmBox.ask=async()=>false;
  assert.equal(await t.handlers['remove-investor-from-list']({}),true);assert.deepEqual(t.seed(),state);
 }
 console.log('PASS either Back makes no storage change');
 for(const mode of ['auth','session','unconfirmed','payload','form','sync','stale','quota','noop','changed-other-id','duplicate-id','pending']){
  const t=ready();
  if(mode==='auth')t.s.__FC_MAIN_ACCESS__.isValid=()=>false;
  if(mode==='session')Object.defineProperty(t.FC.session,'active',{value:true});
  if(mode==='unconfirmed')t.FC.session.canSaveProject=()=>false;
  if(mode==='payload')t.storage.setItem('fc_edit_session_v1','{"active":true}');
  if(mode==='form')t.FC.investorEditorState.hasUiLock=()=>true;
  if(mode==='sync')t.FC.applicationSyncActions={installed:()=>true};
  if(mode==='stale')t.FC.confirmBox.ask=async()=>{t.storage.setItem(PROJECTS,t.storage.getItem(PROJECTS)+' ');return true;};
  if(mode==='quota')t.storage.fail.set(REMOVED,true);
  if(mode==='noop'){const set=t.FC.storage.setJSON;t.FC.storage.setJSON=(key,...args)=>key===REMOVED?true:set(key,...args);}
  if(mode==='changed-other-id')t.FC.confirmBox.ask=async()=>{t.storage.setItem(REMOVED,'["synthetic-other-removal"]');return true;};
  if(mode==='duplicate-id'){const rows=JSON.parse(t.storage.getItem('fc_investors_v1'));rows.push(rows[0]);t.storage.setItem('fc_investors_v1',JSON.stringify(rows));}
  if(mode==='pending'){const rows=JSON.parse(t.storage.getItem(PROJECTS));rows.find(x=>x.investorId==='N').meta={pendingDomainOperation:{id:'synthetic'}};t.storage.setItem(PROJECTS,JSON.stringify(rows));}
  const raw=t.storage.getItem(PROJECTS),investors=t.storage.getItem('fc_investors_v1'),ram=JSON.stringify(t.s.projectData),marker=t.storage.getItem(REMOVED);
  assert.equal(await t.handlers['remove-investor-from-list']({}),false,mode);
  assert.equal(t.storage.getItem('fc_investors_v1'),investors,mode);assert.equal(JSON.stringify(t.s.projectData),ram,mode);
  if(mode!=='stale')assert.equal(t.storage.getItem(PROJECTS),raw,mode);
  if(mode!=='changed-other-id')assert.equal(t.storage.getItem(REMOVED),marker,mode);
  else assert.equal(t.storage.getItem(REMOVED),'["synthetic-other-removal"]');
  assert.ok(t.messages.some(x=>x.title==='Nie usunięto inwestora'),mode);
 }
 console.log('PASS 12 fail-closed cases: Auth, session/proof/form/sync, changed source/tombstone, quota/noop, duplicate identity, pending operation');
 const lost=ready();let release;lost.FC.confirmBox.ask=()=>new Promise(resolve=>{release=resolve;});
 const first=lost.handlers['remove-investor-from-list']({});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(await lost.handlers['remove-investor-from-list']({}),false);lost.s.__FC_MAIN_ACCESS__.isValid=()=>false;release(true);
 assert.equal(await first,false);assert.equal(lost.storage.getItem(REMOVED),null);
 console.log('PASS duplicate gesture and logout during confirmation cannot commit removal');
 const ack=ready(),write=ack.FC.storage.setJSON;ack.FC.storage.setJSON=(key,...args)=>{const result=write(key,...args);return key===REMOVED?false:result;};
 const untouched=ack.storage.getItem(PROJECTS);
 assert.equal(await ack.handlers['remove-investor-from-list']({}),false);
 assert.equal(ack.FC.investors.getById('N'),null,'A possibly committed marker is never undone to fabricate failure atomicity');
 assert.equal(ack.storage.getItem(PROJECTS),untouched);assert.equal(ack.messages.some(x=>x.title==='Usunięto z listy'),false);
 console.log('PASS uncertain acknowledgement never reports success or rolls back a possibly committed removal');
 const once=ready(),token=once.FC.investors.prepareListRemoval('N');assert.ok(token);
 assert.equal(once.FC.investors.confirmListRemoval({name:token.name}),false);
 assert.equal(once.FC.investors.confirmListRemoval(token),true);const marker=once.storage.getItem(REMOVED);
 assert.equal(once.FC.investors.confirmListRemoval(token),false);assert.equal(once.storage.getItem(REMOVED),marker);
 console.log('PASS fabricated/replayed confirmation cannot apply another removal');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
