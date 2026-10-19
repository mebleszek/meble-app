#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {fixture:baseFixture,offers}=require('./project-navigation-blockers-smoke');
const baseline=process.argv.includes('--baseline'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
function fixture(seed){const r=baseFixture(seed);if(baseline)for(const file of ['js/app/project/project-domain-operations.js','js/app/project/project-status-sync.js','js/app/project/project-status-snapshot-flow.js'])vm.runInContext(execFileSync('git',['show','0ae7d1a24091d4a57460bacc9d30b9ea386f5b35:'+file],{encoding:'utf8'}),r.s,{filename:file});return r;}
const clone=x=>JSON.parse(JSON.stringify(x)),P='fc_projects_v1',I='fc_investors_v1',H='fc_quote_snapshots_v1';
const tests=[],test=(name,fn)=>tests.push([name,fn]);
function legacy(){
 const r=fixture(),rows=JSON.parse(r.storage.getItem(P)),row=rows.find(x=>x.id==='P');
 row.projectData.meta.projectStatus='nowy';row.projectData.meta.roomDefs.room_k.legacy=false;
 const before={id:'room_k',baseType:'kuchnia',name:'Kuchnia',label:'Kuchnia',projectStatus:'nowy',lastManualProjectStatus:''};
 row.meta.pendingDomainOperation={version:1,id:'synthetic-v1',kind:'offerStatus',projectId:'P',investorId:'K',historyChanges:[],mirrorChanges:[{id:'room_k',before,after:{...before,legacy:false}}],statusChanges:[{id:'room_k',before:{projectStatus:'nowy',lastManualProjectStatus:''},after:{projectStatus:'nowy',lastManualProjectStatus:''}}],beforeStatus:'nowy',afterStatus:'nowy',beforeMetaStatus:'nowy',requestKey:'status:synthetic',result:{roomIds:['room_k'],projectId:'P',investorId:'K'}};
 r.storage.setItem(P,JSON.stringify(rows));
 const investors=JSON.parse(r.storage.getItem(I));for(const room of investors.find(x=>x.id==='K').rooms){delete room.lastManualProjectStatus;delete room.legacy;}
 r.storage.setItem(I,JSON.stringify(investors));r.s.projectData=r.FC.project.load();r.storage.calls=[];return r;
}
function rawRoom(r,patch){const investors=JSON.parse(r.storage.getItem(I)),room=investors.find(x=>x.id==='K').rooms.find(x=>x.id==='room_k');Object.assign(room,patch);r.storage.setItem(I,JSON.stringify(investors));}
test('Exact old v1 empty-history intention recovers missing optional fields after restart',()=>{
 const original=legacy(),r=fixture(original.seed()),raw=r.storage.getItem(I),other=clone(r.FC.projectStore.getById('Q'));
 const result=r.FC.projectDomainOperations.recoverProject('P');assert.equal(result.ok,true);assert.equal(r.record().meta.pendingDomainOperation,undefined);assert.equal(r.storage.getItem(I),raw,'Recovery must not persist defaults just for normalization');assert.deepEqual(clone(r.FC.projectStore.getById('Q')),other);
 const central=r.storage.getItem(P),calls=r.storage.calls.length;assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,true);assert.equal(r.storage.getItem(P),central);assert.equal(r.storage.calls.length,calls,'Repeated recovery must write nothing');assert.equal(r.FC.sessionNavigation.canCalculate(),true);
});
for(const patch of [{lastManualProjectStatus:'produkcja'},{legacy:true},{name:'Newer name'},{label:'Newer label'},{baseType:'pokoj'},{projectStatus:'produkcja'},{unknownNewField:42},{legacy:null},{lastManualProjectStatus:null}])test('Real mirror conflict is preserved: '+JSON.stringify(patch),()=>{
 const r=legacy();rawRoom(r,patch);const rawI=r.storage.getItem(I),rawP=r.storage.getItem(P),rawH=r.storage.getItem(H);
 assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.equal(r.storage.getItem(I),rawI);assert.equal(r.storage.getItem(P),rawP);assert.equal(r.storage.getItem(H),rawH);assert.ok(r.record().meta.pendingDomainOperation);
});
test('An already-applied mirror with different property order needs no replay',()=>{const r=legacy();const list=JSON.parse(r.storage.getItem(I)),inv=list.find(x=>x.id==='K');inv.rooms[0]=Object.fromEntries(Object.entries({...inv.rooms[0],legacy:false,lastManualProjectStatus:''}).reverse());r.storage.setItem(I,JSON.stringify(list));const raw=r.storage.getItem(I);assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,true);assert.equal(r.storage.getItem(I),raw);});
test('No-op reconciliation of raw sparse rooms creates neither intent nor writes',()=>{
 const r=legacy(),rows=JSON.parse(r.storage.getItem(P));delete rows.find(x=>x.id==='P').meta.pendingDomainOperation;r.storage.setItem(P,JSON.stringify(rows));r.s.projectData=r.FC.project.load();const primary=r.storage.getItem(P),investors=r.storage.getItem(I);r.storage.calls=[];
 for(let n=0;n<3;n++){const result=r.FC.projectStatusSync.reconcileProjectStatuses({projectId:'P',investorId:'K',roomIds:['room_k'],restrictToRoomIds:true,refreshUi:false});assert.equal(result.ok,true);assert.equal(result.noChange,true);}
 assert.equal(r.storage.getItem(P),primary);assert.equal(r.storage.getItem(I),investors);assert.deepEqual(r.storage.calls,[]);
});
for(const phase of ['history','status','mirror','cleanup'])test('Partial '+phase+' write resumes after reboot without duplicate history effects',()=>{
 const r=fixture(),rows=offers(r);let writes=0;
 r.storage.hook=(key)=>{if(phase==='status'&&key===P&&++writes===2)throw Error('status fail');if(phase==='cleanup'&&key===P&&++writes===3)throw Error('cleanup fail');};
 if(phase==='history')r.storage.fail.set(H,true);if(phase==='mirror')r.storage.fail.set(I,true);
 const failed=r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');assert.equal(failed.ok,false);assert.ok(r.record().meta.pendingDomainOperation);
 const reboot=fixture(r.seed()),beforeCount=reboot.FC.quoteSnapshotStore.readAll().length;
 assert.equal(reboot.FC.projectDomainOperations.recoverProject('P').ok,true);assert.equal(reboot.record().meta.pendingDomainOperation,undefined);assert.equal(reboot.FC.quoteSnapshotStore.readAll().length,beforeCount);assert.equal(reboot.FC.quoteSnapshotStore.getById('AB').meta.selectedByClient,true);
 const raw=reboot.seed(),count=reboot.storage.calls.length;assert.equal(reboot.FC.projectDomainOperations.recoverProject('P').ok,true);assert.deepEqual(reboot.seed(),raw);assert.equal(reboot.storage.calls.length,count);
});
test('Failed cleanup of old sparse intent remains durable and retries safely',()=>{const r=legacy();r.storage.fail.set(P,true);assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.ok(r.record().meta.pendingDomainOperation);r.storage.fail.clear();assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,true);});
test('Fresh history change after partial mirror write is not declared completed or overwritten',()=>{
 const r=fixture(),rows=offers(r);let changed=false;r.storage.hook=key=>{if(key===I&&!changed){changed=true;const history=JSON.parse(r.storage.getItem(H));history.find(x=>x.id==='AB').totals.grand=999;r.storage.rows.set(H,JSON.stringify(history));}};
 assert.equal(r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany').ok,false);assert.equal(changed,true);assert.ok(r.record().meta.pendingDomainOperation);assert.equal(r.FC.quoteSnapshotStore.getById('AB').totals.grand,999);
 const raw=r.seed();r.storage.hook=null;assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.deepEqual(r.seed(),raw);
});
test('Invalid owner, missing room, corrupt history and active session never clear intent',()=>{
 for(const mode of ['owner','room','history','session']){const r=legacy();if(mode==='session')r.FC.session.active=true;else if(mode==='history')r.storage.rows.set(H,'{bad');else{const rows=JSON.parse(r.storage.getItem(P));if(mode==='owner')rows.find(x=>x.id==='P').meta.pendingDomainOperation.investorId='N';else delete rows.find(x=>x.id==='P').projectData.room_k;r.storage.rows.set(P,JSON.stringify(rows));}const raw=r.seed();assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false,mode);assert.deepEqual(r.seed(),raw);}
});
test('A raw missing room cannot be recreated from roomDefs as recovery evidence',()=>{
 const r=legacy(),investors=JSON.parse(r.storage.getItem(I));investors.find(x=>x.id==='K').rooms[0]={...r.record().meta.pendingDomainOperation.mirrorChanges[0].after};r.storage.setItem(I,JSON.stringify(investors));
 const rows=JSON.parse(r.storage.getItem(P));delete rows.find(x=>x.id==='P').projectData.room_k;r.storage.setItem(P,JSON.stringify(rows));const raw=r.seed();
 assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.deepEqual(r.seed(),raw);
});
test('Duplicate mirror identities and an unconfirmed session preserve the old intention',()=>{
 for(const mode of ['duplicate','unconfirmed']){const r=legacy();if(mode==='duplicate'){const rows=JSON.parse(r.storage.getItem(I)),rooms=rows.find(x=>x.id==='K').rooms;rooms.push(clone(rooms[0]));r.storage.setItem(I,JSON.stringify(rows));}else r.FC.session.markUnconfirmedProjectWrite();const raw=r.seed();assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.deepEqual(r.seed(),raw);}
});
test('Synthetic 6-project/4-investor/11-snapshot/12-draft profile recovers only the active 8+1+1 project',()=>{
 const r=legacy(),rows=JSON.parse(r.storage.getItem(P)),active=rows.find(x=>x.id==='P');
 active.projectData.room_k.cabinets=Array.from({length:8},(_,i)=>({...active.projectData.room_k.cabinets[0],id:'synthetic-'+i}));
 for(let i=0;i<4;i++){const owner=['K','N','C','D'][i],roomId='room_isolated_'+i;rows.push({id:'extra-'+i,investorId:owner,status:'nowy',meta:{},projectData:{meta:{assignedInvestorId:owner,roomDefs:{[roomId]:{id:roomId,baseType:'pokoj',name:roomId}},roomOrder:[roomId]},[roomId]:{cabinets:[],fronts:[],sets:[],settings:{}}}});}
 const investors=JSON.parse(r.storage.getItem(I));for(const id of ['C','D'])investors.push({id,name:'Synthetic '+id,rooms:[]});r.storage.setItem(I,JSON.stringify(investors));r.storage.setItem(P,JSON.stringify(rows));
 const template=offers(r)[0],histories=Array.from({length:11},(_,i)=>({...clone(template),id:'frozen-'+i,commercial:{...template.commercial,versionName:'Synthetic historical '+i},totals:{...template.totals,grand:100+i}}));
 r.FC.quoteSnapshotStore.writeAll(histories);r.storage.setItem('fc_quote_offer_drafts_v1',JSON.stringify(Array.from({length:12},(_,i)=>({id:'draft-'+i,projectId:rows[i%6].id,investorId:rows[i%6].investorId,selection:{selectedRooms:[]},commercial:{versionName:'Synthetic draft '+i}}))));
 const before=r.seed(),reboot=fixture(before);assert.equal(reboot.FC.projectDomainOperations.recoverProject('P').ok,true);
 assert.equal(reboot.storage.getItem(H),before[H]);assert.equal(reboot.storage.getItem('fc_quote_offer_drafts_v1'),before.fc_quote_offer_drafts_v1);assert.equal(reboot.storage.getItem(I),before[I]);
 assert.deepEqual(JSON.parse(reboot.storage.getItem(P)).filter(x=>x.id!=='P'),rows.filter(x=>x.id!=='P'));
 assert.equal(reboot.record().projectData.room_k.cabinets.length,8);assert.equal(reboot.record().projectData.room_s.cabinets.length,1);assert.equal(reboot.record().projectData.room_x.cabinets.length,1);
});
async function main(){let failed=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`offer-status-recovery: ${tests.length-failed}/${tests.length} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;}
if(require.main===module)main();module.exports={legacy};
