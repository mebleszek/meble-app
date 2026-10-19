#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createSandbox,loadSmokeFiles}=require('./app-dev-smoke');
const {APP_DEV_SMOKE_FILES}=require('./app-dev-smoke-lib/file-list');
const clone=x=>JSON.parse(JSON.stringify(x)),P='fc_projects_v1',I='fc_investors_v1',H='fc_quote_snapshots_v1',E='fc_edit_session_v1';
function fixture(seed,options){
 class Memory{
  constructor(values={}){this.rows=new Map(Object.entries(values));this.fail=new Map();this.calls=[];this.hook=null;}
  get length(){return this.rows.size;} key(i){return [...this.rows.keys()][i]||null;}
  getItem(k){return this.rows.get(String(k))??null;}
  setItem(k,v){k=String(k);this.calls.push(k);if(this.hook)this.hook(k,String(v));if(this.fail.get(k)==='false')return false;if(this.fail.get(k)==='noop')return;if(this.fail.has(k))throw Error('Forced '+k+' failure');this.rows.set(k,String(v));}
  removeItem(k){if(this.fail.has('remove:'+k))throw Error('Forced cleanup failure');this.rows.delete(k);}
  clear(){throw Error('clear is forbidden');}
 }
 const s=createSandbox(),storage=new Memory(seed);s.Storage=Memory;s.localStorage=storage;s.sessionStorage=new Memory();s.location={reload(){}};s.scrollTo=()=>{};
 if(options&&options.timers){s.setTimeout=options.timers.setTimeout;s.clearTimeout=options.timers.clearTimeout;}
 loadSmokeFiles(s,APP_DEV_SMOKE_FILES);
 s.STORAGE_KEYS=s.FC.constants.STORAGE_KEYS;
 for(const file of ['js/app/shared/ui-state.js','js/app/ui/tab-navigation.js','js/app/shared/public-api.js'])vm.runInContext(fs.readFileSync(file,'utf8'),s,{filename:file});
 const FC=s.FC,messages=[],handlers={};FC.actions={register:actions=>Object.assign(handlers,actions)};
 vm.runInContext(fs.readFileSync('js/app/ui/actions-register.js','utf8'),s);
 FC.infoBox={open:cfg=>messages.push(cfg)};
 if(!seed){
  FC.investors.writeAll([{id:'K',name:'Kowalski',kind:'person',rooms:[{id:'room_k',baseType:'kuchnia',name:'Kuchnia',label:'Kuchnia',projectStatus:'nowy'},{id:'room_s',baseType:'pokoj',name:'Salon',label:'Salon',projectStatus:'nowy'},{id:'room_x',baseType:'pokoj',name:'Gabinet',label:'Gabinet',projectStatus:'umowa'}]},{id:'N',name:'Nowak',kind:'person',rooms:[]}]);
  const room=(id,w)=>({cabinets:[{id,width:w,type:'stojąca',subType:'drzwi'}],fronts:[{id:'front-'+id}],sets:[],settings:{}});
  FC.projectStore.upsert({id:'P',investorId:'K',status:'nowy',projectData:{meta:{assignedInvestorId:'K',roomDefs:Object.fromEntries(FC.investors.getById('K').rooms.map(r=>[r.id,r])),roomOrder:['room_k','room_s','room_x']},room_k:room('k',60),room_s:room('s',70),room_x:room('x',80)}});
  FC.projectStore.upsert({id:'Q',investorId:'N',projectData:{room_n:room('n',90)}});
  storage.setItem('fc_current_investor_v1','K');FC.projectStore.setCurrentProjectId('P');
 }
 s.projectData=FC.project.load();s.uiState=FC.uiState.get();
 if(!seed)s.uiState=FC.uiState.set({entry:'rooms',activeTab:'pokoje',roomType:null,currentInvestorId:'K'});
 FC.choiceBox={async ask(){return 'back';}};
 const record=()=>FC.projectStore.getById('P');
 return {s,FC,storage,messages,handlers,record,seed:()=>Object.fromEntries(storage.rows),inv:()=>FC.investors.getById('K'),open:()=>FC.views.openRoom('room_k')};
}
function offers(r){
 const out=[];
 for(const [id,rooms] of [['A',['room_k']],['B',['room_s']],['AB',['room_k','room_s']]])out.push(r.FC.quoteSnapshotStore.save({id,project:{id:'P',investorId:'K'},investor:{id:'K'},scope:{selectedRooms:rooms},lines:{materials:[{name:'Płyta',qty:6,unitPrice:100,total:600}]},totals:{grand:600},commercial:{preliminary:false}}));
 return out;
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('1 clean Kitchen opens a durable owned session and switches to Salon without a prompt',async()=>{
 const r=fixture();assert.equal(await r.open(),true);assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,true);
 const payload=JSON.parse(r.storage.getItem(E));assert.equal(payload.projectId,'P');assert.equal(payload.roomId,'room_k');assert.equal(r.FC.session.isDirty(),false);
 let prompts=0;r.FC.choiceBox.ask=async()=>{prompts++;return 'back';};assert.equal(await r.FC.views.openRoom('room_s'),true);assert.equal(r.s.uiState.roomType,'room_s');assert.equal(prompts,0);assert.equal(r.FC.session.roomId,'room_s');
});
test('2 clean Kitchen enters ROZRYS without asking, saving or rebeginning',async()=>{
 const r=fixture();await r.open();let prompts=0;r.FC.choiceBox.ask=async()=>{prompts++;return 'back';};const raw=r.storage.getItem(P);await r.FC.tabNavigation.setActiveTab('rozrys');assert.equal(prompts,0);assert.equal(r.storage.getItem(P),raw);
 assert.equal(r.s.uiState.activeTab,'rozrys');assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem(E),null);
 r.FC.views.applyFromState(r.s.uiState);assert.equal(r.FC.session.active,false);
});
test('3 changed Kitchen Discard and Go to WYCENA restores only Kitchen',async()=>{
 const r=fixture();await r.open();r.s.projectData.room_k.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
 const row=r.record();row.projectData.room_s.cabinets[0].width=75;assert.ok(r.FC.projectStore.upsert(row));
 r.FC.choiceBox.ask=async()=> 'discard';await r.FC.tabNavigation.setActiveTab('wycena');
 assert.equal(r.record().projectData.room_k.cabinets[0].width,60);assert.equal(r.record().projectData.room_s.cabinets[0].width,75);
 assert.equal(r.s.uiState.activeTab,'wycena');assert.equal(r.FC.session.active,false);
});
test('4 Back and same-room/internal tabs preserve snapshot and draft',async()=>{
 const r=fixture();await r.open();const snapshot=r.FC.session.snapshot;r.s.projectData.room_k.cabinets[0].width=65;
 assert.equal(await r.FC.tabNavigation.setActiveTab('wycena'),false);assert.equal(r.s.uiState.activeTab,'wywiad');
 await r.FC.openRoom('room_k');await r.FC.tabNavigation.setActiveTab('material');
 assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.s.projectData.room_k.cabinets[0].width,65);
});
test('5 save, rollback and session cleanup failures block navigation',async()=>{
 for(const action of ['save','discard'])for(const failure of [P,'remove:'+E]){
  const r=fixture();await r.open();r.s.projectData.room_k.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
  const snapshot=r.FC.session.snapshot;r.FC.choiceBox.ask=async()=>action;r.storage.fail.set(failure,true);
  assert.equal(await r.FC.tabNavigation.setActiveTab('rozrys'),false);assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.s.uiState.activeTab,'wywiad');
  r.storage.fail.clear();await r.FC.tabNavigation.setActiveTab('rozrys');assert.equal(r.FC.session.active,false);
 }
});
test('6 failed durable begin does not open editor, retry reuses baseline',async()=>{
 const r=fixture(),before=clone(r.s.projectData),ui=r.storage.getItem('fc_ui_v1');r.storage.fail.set(E,true);
 assert.equal(await r.open(),false);before.meta.productionPcvMode='project';assert.deepEqual(clone(r.s.projectData),before);assert.equal(r.record().projectData.meta.productionPcvMode,'project');assert.equal(r.storage.getItem('fc_ui_v1'),ui);assert.equal(r.FC.session.durable,false);
 const snapshot=r.FC.session.snapshot;r.storage.fail.clear();assert.equal(await r.open(),true);assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.FC.session.durable,true);
});
test('7 reload of clean editor restores ownership without rollback or rebaseline',async()=>{
 const r=fixture();await r.open();const payload=r.storage.getItem(E),raw=r.storage.getItem(P);
 const reboot=fixture(r.seed());assert.equal(reboot.FC.views.applyFromState(reboot.s.uiState)!==false,true);
 assert.equal(reboot.storage.getItem(E),payload);assert.equal(reboot.storage.getItem(P),raw);assert.equal(reboot.FC.session.roomId,'room_k');
});
test('8 room create primary failure preserves RAM, investor and history',()=>{
 const r=fixture();offers(r);const before=clone(r.s.projectData),inv=r.storage.getItem(I),history=r.storage.getItem(H);r.storage.fail.set(P,true);
 assert.equal(r.FC.roomRegistryProjectSync.createRoomRecord(r.inv(),{name:'Sypialnia',baseType:'pokoj'}).ok,false);
 assert.deepEqual(clone(r.s.projectData),before);assert.equal(r.storage.getItem(I),inv);assert.equal(r.storage.getItem(H),history);
 r.storage.fail.clear();assert.equal(r.FC.roomRegistryProjectSync.createRoomRecord(r.inv(),{name:'Sypialnia',baseType:'pokoj'}).ok,true);
});
test('9 rename and delete primary failure preserve metadata, other rooms and history',()=>{
 for(const action of ['rename','delete']){
  const r=fixture();offers(r);const raw=r.storage.getItem(P),ram=clone(r.s.projectData),inv=r.storage.getItem(I),history=r.storage.getItem(H);r.storage.fail.set(P,true);
  const result=action==='rename'?r.FC.roomRegistryProjectSync.updateRoomRecord(r.inv(),'room_s',{name:'Nowy Salon',baseType:'pokoj'}):r.FC.roomRegistryProjectSync.removeRoomByIdDetailed('room_s');
  assert.equal(result.ok,false);assert.equal(r.storage.getItem(P),raw);assert.deepEqual(clone(r.s.projectData),ram);assert.equal(r.storage.getItem(I),inv);assert.equal(r.storage.getItem(H),history);
 }
});
test('10 interrupted room mirror is durable, blocks editor and recovers after reload',async()=>{
 const r=fixture(),before=clone(r.s.projectData);r.storage.fail.set(I,true);
 const result=r.FC.roomRegistryProjectSync.updateRoomRecord(r.inv(),'room_s',{name:'Salon Nowy',baseType:'pokoj'});
 assert.equal(result.ok,false);assert.equal(result.partial,true);assert.deepEqual(clone(r.s.projectData),before);
 assert.equal(r.record().projectData.meta.roomDefs.room_s.name,'Salon Nowy');assert.ok(r.record().meta.pendingDomainOperation);
 assert.equal(await r.open(),false);
 const reboot=fixture(r.seed());assert.equal(reboot.FC.projectDomainOperations.recoverProject('P').ok,true);
 assert.equal(reboot.inv().rooms.find(room=>room.id==='room_s').name,'Salon Nowy');assert.equal(reboot.record().meta.pendingDomainOperation,undefined);
 assert.equal(await reboot.open(),true);
});
test('11 same create retry finishes one intent without duplicate room',()=>{
 const r=fixture();r.storage.fail.set(I,true);const payload={name:'Sypialnia',baseType:'pokoj'};
 assert.equal(r.FC.roomRegistryProjectSync.createRoomRecord(r.inv(),payload).ok,false);const count=Object.keys(r.record().projectData.meta.roomDefs).length;
 r.storage.fail.clear();assert.equal(r.FC.roomRegistryProjectSync.createRoomRecord(r.inv(),payload).ok,true);
 assert.equal(Object.keys(r.record().projectData.meta.roomDefs).length,count);
});
test('12 newer conflicting room mirror is never overwritten by recovery',()=>{
 const r=fixture();r.storage.fail.set(I,true);r.FC.roomRegistryProjectSync.updateRoomRecord(r.inv(),'room_s',{name:'Salon Nowy',baseType:'pokoj'});r.storage.fail.clear();
 const rows=JSON.parse(r.storage.getItem(I));rows.find(i=>i.id==='K').rooms.find(room=>room.id==='room_s').name='Concurrent';r.storage.setItem(I,JSON.stringify(rows));
 const raw=r.storage.getItem(I);assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.equal(r.storage.getItem(I),raw);assert.ok(r.record().meta.pendingDomainOperation);
});
test('13 successful room deletion preserves archived A/B/AB and unrelated projects',()=>{
 const r=fixture();offers(r);const history=r.storage.getItem(H),other=clone(r.FC.projectStore.getById('Q'));
 assert.equal(r.FC.roomRegistryProjectSync.removeRoomByIdDetailed('room_s').ok,true);
 assert.equal(r.record().projectData.room_s,undefined);assert.equal(r.inv().rooms.some(room=>room.id==='room_s'),false);assert.equal(r.storage.getItem(H),history);assert.deepEqual(clone(r.FC.projectStore.getById('Q')),other);
});
test('14 common offer acceptance persists exact scope, without modifying Gabinet',()=>{
 const r=fixture(),rows=offers(r),outside=clone(r.record().projectData.meta.roomDefs.room_x);
 const result=r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');
 assert.equal(result.ok,true);assert.equal(r.FC.quoteSnapshotStore.listForProject('P').length,3);
 assert.equal(r.FC.quoteSnapshotStore.getById('AB').meta.selectedByClient,true);
 for(const id of ['room_k','room_s'])assert.equal(r.record().projectData.meta.roomDefs[id].projectStatus,'zaakceptowany');
 assert.deepEqual(clone(r.record().projectData.meta.roomDefs.room_x),outside);assert.equal(r.record().meta.pendingDomainOperation,undefined);
});
test('15 offer history written but status failure is explicit and reload-recoverable',()=>{
 const r=fixture(),rows=offers(r),original=r.record().projectData.meta.roomDefs.room_k.projectStatus;
 r.storage.hook=(key,value)=>{if(key===H && JSON.parse(value).some(row=>row.id==='AB' && row.meta.selectedByClient))r.storage.fail.set(P,true);};
 const result=r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');assert.equal(result.ok,false);assert.equal(result.partial,true);
 assert.equal(r.FC.quoteSnapshotStore.getById('AB').meta.selectedByClient,true);assert.equal(r.record().projectData.meta.roomDefs.room_k.projectStatus,original);assert.ok(r.record().meta.pendingDomainOperation);
 const reboot=fixture(r.seed());assert.equal(reboot.FC.projectDomainOperations.recoverProject('P').ok,true);
 assert.equal(reboot.record().projectData.meta.roomDefs.room_k.projectStatus,'zaakceptowany');assert.equal(reboot.inv().rooms.find(room=>room.id==='room_s').projectStatus,'zaakceptowany');
 assert.equal(reboot.FC.quoteSnapshotStore.listForProject('P').length,3);assert.equal(reboot.FC.quoteSnapshotStore.getById('AB').totals.grand,600);
});
test('16 history failure leaves statuses intact and retry preserves archived results',()=>{
 const r=fixture(),rows=offers(r);r.storage.fail.set(H,true);
 const result=r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');assert.equal(result.ok,false);assert.equal(r.record().projectData.meta.roomDefs.room_s.projectStatus,'nowy');
 r.storage.fail.clear();assert.equal(r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany').ok,true);
 for(const id of ['A','B','AB'])assert.equal(r.FC.quoteSnapshotStore.getById(id).totals.grand,600);
});
test('17 pending offer detects newer conflicting history without compensation',()=>{
 const r=fixture(),rows=offers(r);r.storage.fail.set(H,true);r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');r.storage.fail.clear();
 const changed=JSON.parse(r.storage.getItem(H));changed.find(row=>row.id==='AB').meta.versionName='Concurrent';r.storage.setItem(H,JSON.stringify(changed));
 const history=r.storage.getItem(H);assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.equal(r.storage.getItem(H),history);assert.ok(r.record().meta.pendingDomainOperation);
});
test('18 active edit and wrong offer owner/scope cannot mutate history or statuses',async()=>{
 const r=fixture(),rows=offers(r);await r.open();const history=r.storage.getItem(H),central=r.storage.getItem(P);
 assert.equal(r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany').ok,false);assert.equal(r.storage.getItem(H),history);assert.equal(r.storage.getItem(P),central);
 assert.equal(r.FC.session.cancel(),true);assert.equal(r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany',{roomIds:['room_k']}).ok,false);
 const wrong=clone(rows[2]);wrong.project.id='Q';assert.equal(r.FC.projectStatusSync.commitAcceptedSnapshot(wrong,'zaakceptowany').ok,false);assert.equal(r.storage.getItem(H),history);
});
test('19 scoped Save and Cancel preserve a newer Salon',async()=>{
 const r=fixture();await r.open();r.s.projectData.room_k.cabinets[0].width=65;const row=r.record();row.projectData.room_s.cabinets[0].width=75;r.FC.projectStore.upsert(row);
 assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);assert.equal(r.record().projectData.room_s.cabinets[0].width,75);
 assert.equal(r.FC.session.cancel(),true);assert.equal(r.record().projectData.room_k.cabinets[0].width,60);assert.equal(r.record().projectData.room_s.cabinets[0].width,75);
});
test('20 global catalogs, prices and legacy part stores are untouched',async()=>{
 const r=fixture(),keys=['fc_company_profile_v1','fc_program_defaults_v1','fc_edge_v1','fc_material_part_options_v1','materials','accessories','quoteRates'];
 keys.forEach(key=>r.storage.setItem(key,'{"sentinel":"'+key+'"}'));const raw=keys.map(key=>r.storage.getItem(key)),rows=offers(r);
 await r.open();assert.equal(r.FC.session.cancel(),true);r.FC.sessionNavigation.reloadCentral();
 assert.equal(r.FC.roomRegistryProjectSync.updateRoomRecord(r.inv(),'room_s',{name:'Salon Nowy',baseType:'pokoj'}).ok,true);
 assert.equal(r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany').ok,true);
 assert.deepEqual(keys.map(key=>r.storage.getItem(key)),raw);
});
test('21 ordering and metadata edits are confirmed without changing cabinet data',()=>{
 const r=fixture(),before=clone(r.record().projectData.room_s),drafts=r.FC.roomRegistryProjectSync.getManageableRooms(r.inv()).filter(room=>room.id.startsWith('room_')).reverse();
 const result=r.FC.roomRegistryProjectSync.applyManageRoomsDraftDetailed(r.inv(),drafts);
 assert.equal(result.ok,true);assert.deepEqual(clone(r.record().projectData.meta.roomOrder),clone(drafts.map(room=>room.id)));assert.deepEqual(clone(r.record().projectData.room_s),before);
});
test('22 intent cleanup failure cannot report success and retry after reload is idempotent',()=>{
 const r=fixture(),rows=offers(r);let writes=0;
 r.storage.hook=(key,value)=>{if(key===P && ++writes===3)throw Error('Forced final intent cleanup');};
 const result=r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');assert.equal(result.ok,false);assert.equal(result.partial,true);assert.ok(r.record().meta.pendingDomainOperation);
 assert.equal(r.record().projectData.meta.roomDefs.room_s.projectStatus,'zaakceptowany');const history=r.storage.getItem(H);
 const reboot=fixture(r.seed());assert.equal(reboot.FC.projectDomainOperations.recoverProject('P').ok,true);assert.equal(reboot.storage.getItem(H),history);assert.equal(reboot.record().meta.pendingDomainOperation,undefined);
});
test('23 investor contact and unrelated room changes survive partial recovery',()=>{
 const r=fixture();r.storage.fail.set(I,true);r.FC.roomRegistryProjectSync.updateRoomRecord(r.inv(),'room_s',{name:'Salon Nowy',baseType:'pokoj'});r.storage.fail.clear();
 const investors=JSON.parse(r.storage.getItem(I));const inv=investors.find(i=>i.id==='K');inv.phone='123456789';inv.rooms.find(room=>room.id==='room_x').projectStatus='produkcja';r.storage.setItem(I,JSON.stringify(investors));
 const reboot=fixture(r.seed());assert.equal(reboot.FC.projectDomainOperations.recoverProject('P').ok,true);assert.equal(reboot.inv().phone,'123456789');assert.equal(reboot.inv().rooms.find(room=>room.id==='room_x').projectStatus,'produkcja');
});
test('24 newer project statuses stop recovery without overwriting history or project',()=>{
 const r=fixture(),rows=offers(r);r.storage.fail.set(H,true);r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');r.storage.fail.clear();
 const projects=JSON.parse(r.storage.getItem(P));projects.find(row=>row.id==='P').projectData.meta.roomDefs.room_s.projectStatus='produkcja';r.storage.setItem(P,JSON.stringify(projects));
 const history=r.storage.getItem(H),primary=r.storage.getItem(P);assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.equal(r.storage.getItem(H),history);assert.equal(r.storage.getItem(P),primary);
});
test('25 false and silent storage failures cannot use an older key as proof of success',()=>{
 for(const mode of ['false','noop']){
  const r=fixture(),primary=r.storage.getItem(P);r.storage.fail.set(P,mode);
  assert.equal(r.FC.roomRegistryProjectSync.updateRoomRecord(r.inv(),'room_s',{name:'Salon Nowy',baseType:'pokoj'}).ok,false);assert.equal(r.storage.getItem(P),primary);
 }
});
test('26 direct stale RAM entry cannot establish a baseline and overwrite fresher data',()=>{
 const r=fixture(),row=r.record();row.projectData.room_k.cabinets[0].width=69;r.FC.projectStore.upsert(row);
 const raw=r.storage.getItem(P);assert.equal(r.FC.views.applyFromState({entry:'app',activeTab:'wywiad',roomType:'room_k',currentInvestorId:'K'}),false);
 assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem(P),raw);assert.equal(r.s.projectData.room_k.cabinets[0].width,60);
});
test('27 delete modal stays open on failure and retains its selected room',async()=>{
 const r=fixture();let panel=null,closes=0;r.FC.panelBox={open:cfg=>{panel=cfg;},close:()=>{closes++;}};r.FC.confirmBox={ask:async()=>true};
 r.FC.roomRegistryModalsAddEdit._debug.openEditRoomModal('room_s');assert.ok(panel);r.storage.fail.set(P,true);
 const remove=[...panel.contentNode.querySelectorAll('button')].find(button=>button.textContent==='Usuń');assert.ok(remove);remove.click();
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(closes,0);assert.ok(r.record().projectData.room_s);
});
test('28 room metadata modal retains its typed draft on save failure',async()=>{
 const r=fixture();let panel=null,closes=0;r.FC.panelBox={open:cfg=>{panel=cfg;},close:()=>{closes++;}};r.FC.confirmBox={ask:async()=>true};
 r.FC.roomRegistryModalsAddEdit._debug.openEditRoomModal('room_s');const input=panel.contentNode.querySelector('input');input.value='Salon Draft';input.dispatchEvent({type:'input'});
 r.storage.fail.set(P,true);const save=[...panel.contentNode.querySelectorAll('button')].find(button=>button.textContent==='Zapisz');save.click();
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(closes,0);assert.equal(input.value,'Salon Draft');assert.equal(r.record().projectData.meta.roomDefs.room_s.name,'Salon');
});
test('29 quote entry Back does not patch calculation draft or show historical offer',async()=>{
 const r=fixture(),rows=offers(r);await r.open();r.s.projectData.room_k.cabinets[0].width=65;const history=r.storage.getItem(H),draft=r.storage.getItem('fc_quote_offer_drafts_v1');
 assert.equal(await r.FC.quoteScopeEntryFlow.openExistingSnapshot(rows[2]),false);assert.equal(r.s.uiState.activeTab,'wywiad');assert.equal(r.storage.getItem(H),history);assert.equal(r.storage.getItem('fc_quote_offer_drafts_v1'),draft);
});
test('30 explicit Save finishes once; rerender does not rebegin, explicit reopen does',async()=>{
 const r=fixture();await r.open();r.s.projectData.room_k.cabinets[0].width=65;
 r.handlers['session-save']({});assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem(E),null);
 r.FC.views.applyFromState(r.s.uiState);assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem(E),null);
 await r.open();assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.roomId,'room_k');
});
test('31 explicit Cancel reopens the same room with a new durable clean session',async()=>{
 const r=fixture();await r.open();r.FC.confirmBox={ask:async()=>true};r.s.projectData.room_k.cabinets[0].width=65;
 const previous=r.FC.session.snapshot;await r.handlers['session-cancel']({});assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,true);assert.equal(r.FC.session.roomId,'room_k');assert.notEqual(r.FC.session.snapshot,previous);assert.equal(r.FC.session.isDirty(),false);assert.equal(r.s.uiState.entry,'app');
 const reboot=fixture(r.seed());reboot.FC.views.applyFromState(reboot.s.uiState);assert.equal(reboot.FC.session.active,true);assert.equal(reboot.FC.session.roomId,'room_k');
});
test('32 unfinished intention cannot be deleted or replaced through project API',()=>{
 const r=fixture();r.storage.fail.set(I,true);r.FC.roomRegistryProjectSync.updateRoomRecord(r.inv(),'room_s',{name:'Salon Nowy',baseType:'pokoj'});
 const raw=r.storage.getItem(P);assert.equal(r.FC.projectStore.writeAll([]),null);assert.equal(r.FC.projectStore.removeByInvestorId('K'),false);assert.equal(r.storage.getItem(P),raw);
});
test('33 corrupt pending operation cannot reprice an archived offer',()=>{
 const r=fixture(),rows=offers(r);r.storage.fail.set(H,true);r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany');r.storage.fail.clear();
 const projects=JSON.parse(r.storage.getItem(P));projects.find(row=>row.id==='P').meta.pendingDomainOperation.historyChanges[0].after.totals.grand=999;
 r.storage.setItem(P,JSON.stringify(projects));const history=r.storage.getItem(H);assert.equal(r.FC.projectDomainOperations.recoverProject('P').ok,false);assert.equal(r.storage.getItem(H),history);assert.ok(r.record().meta.pendingDomainOperation);
});
test('34 recovering a split common acceptance keeps offer scope distinct from affected statuses',()=>{
 const r=fixture(),rows=offers(r);assert.equal(r.FC.projectStatusSync.commitAcceptedSnapshot(rows[2],'zaakceptowany').ok,true);
 r.storage.fail.set(I,true);const pending=r.FC.projectStatusSync.commitAcceptedSnapshot(rows[0],'zaakceptowany');assert.equal(pending.ok,false);
 const reboot=fixture(r.seed());const done=reboot.FC.projectDomainOperations.recoverProject('P');assert.equal(done.ok,true);
 assert.deepEqual(clone(done.roomIds),['room_k']);assert.deepEqual(clone(done.affectedRoomIds),['room_k','room_s']);
 assert.deepEqual(clone(done.snapshot.scope.selectedRooms),['room_k']);assert.deepEqual(clone(reboot.FC.quoteSnapshotStore.getById('AB').scope.selectedRooms),['room_k','room_s']);
 assert.equal(reboot.record().projectData.meta.roomDefs.room_x.projectStatus,'umowa');
});
test('35 missing navigation gate cannot open an unsecured editor through direct APIs',async()=>{
 const r=fixture(),ui=r.storage.getItem('fc_ui_v1');delete r.FC.sessionNavigation;
 assert.equal(await r.FC.openRoom('room_k'),false);assert.equal(await r.FC.views.openRoom('room_k'),false);
 assert.equal(r.storage.getItem('fc_ui_v1'),ui);assert.equal(r.FC.session.active,false);
});
async function main(){let failures=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);if(failures)process.exitCode=1;}
if(require.main===module)main();
module.exports={fixture,offers};
