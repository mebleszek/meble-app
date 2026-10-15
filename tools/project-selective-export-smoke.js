#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),I='fc_investors_v1',P='fc_projects_v1',S='fc_edit_session_v1';
const clone=v=>JSON.parse(JSON.stringify(v)),tests=[],test=(name,fn)=>tests.push([name,fn]);
class MemoryStorage{
 constructor(seed={}){this.rows=new Map(Object.entries(seed));this.calls=[];this.reads=[];this.fail=new Set();this.onRead=null;}
 getItem(k){this.reads.push(k);if(this.onRead)this.onRead(k);if(this.fail.has('get:'+k))throw Error('read');return this.rows.get(k)??null;}
 setItem(k,v){this.calls.push(['set',k]);if(this.fail.has('set:'+k))throw Error('write');this.rows.set(String(k),String(v));}
 removeItem(k){this.calls.push(['remove',k]);if(this.fail.has('remove:'+k))throw Error('remove');this.rows.delete(k);}
 clear(){throw Error('clear forbidden');}
 get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
}
const files=['js/app/shared/constants.js','js/app/shared/storage.js','js/app/shared/schema.js',
 'js/app/room-preferences/room-preferences-model.js','js/app/investor/investors-model.js','js/app/investor/investors-local-repository.js','js/app/investor/investors-store.js',
 'js/app/project/project-model.js','js/app/project/project-store.js','js/app/project/project-bridge.js','js/app/investor/session.js',
 'js/app/cabinet/part-provenance.js','js/app/material/material-common.js','js/app/cabinet/front-hardware-fronts.js','js/app/cabinet/cabinet-cutlist.js','js/app/material/material-edge-store.js',
 'js/app/project/project-pcv-overrides.js','js/app/project/project-domain-operations.js',
 'js/app/project/project-export-contract.js','js/app/project/project-selective-export.js'];
function fixture(seed){
 const Storage=class extends MemoryStorage{}; // Session tracking patches prototypes per isolated runtime.
 const storage=new Storage(seed),sessionStorage=new Storage(),messages=[];
 const s={console,Date,setTimeout,clearTimeout,TextEncoder,Uint8Array,crypto:webcrypto,Storage,localStorage:storage,sessionStorage,
  uiState:{roomType:'kuchnia',currentInvestorId:'inv-A'},FC:{utils:{clone},infoBox:{open:m=>messages.push(m)}}};
 s.window=s;vm.createContext(s);for(const file of files)vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{filename:file});
 const FC=s.FC;
 if(!seed){
  const investors=['A','B'].map(id=>FC.investorsModel.normalizeInvestor({id:'inv-'+id,name:'Fikcyjny '+id,meta:{testData:true},createdAt:1000,updatedAt:2000}));
  assert.equal(FC.investorsLocalRepository.writeAll(investors),true);
  for(const id of ['A','B']){
   const data=clone(FC.schema.DEFAULT_PROJECT),keys=Object.keys(data).filter(k=>k!=='schemaVersion');
   data.meta={assignedInvestorId:'inv-'+id,productionPcvMode:'project',roomOrder:keys,roomDefs:Object.fromEntries(keys.map(k=>[k,{id:k,baseType:k,name:k,label:k,legacy:true}]))};
   const cab=n=>({id:n,type:'stojąca',subType:'standardowa',width:60,height:82,depth:51,frontCount:2,bodyColor:'laminat TEST',frontMaterial:'laminat',frontColor:'TEST',backMaterial:'HDF',bodyPcvMode:'body',details:{shelves:3}});
   data.kuchnia.cabinets=[cab('one'),cab('two')];data.pokoj.cabinets=[cab('one')];
   assert.ok(FC.projectStore.upsert({id,investorId:'inv-'+id,title:'Fikcyjny projekt '+id,status:'nowy',meta:{testData:true},createdAt:1000,updatedAt:2000,projectData:data}));
  }
  FC.projectStore.setCurrentProjectId('A');storage.setItem('fc_current_investor_v1','inv-A');
 }
 s.projectData=FC.project.load();s.materials=[{name:'laminat TEST',materialType:'laminat'}];
 const rows=()=>Object.fromEntries(storage.rows),row=()=>JSON.parse(storage.getItem(P)).find(x=>x.id==='A');
 const mutate=fn=>{const list=JSON.parse(storage.getItem(P)),p=list.find(x=>x.id==='A');fn(p,list);storage.rows.set(P,JSON.stringify(list));s.projectData=clone(p.projectData);};
 const inv=fn=>{const list=JSON.parse(storage.getItem(I));fn(list[0],list);storage.rows.set(I,JSON.stringify(list));};
 const build=()=>FC.projectSelectiveExport.build({investorId:'inv-A',projectId:'A',purpose:'pilot'});
 storage.calls=[];storage.reads=[];
 return {s,FC,storage,sessionStorage,messages,rows,row,mutate,inv,build};
}
async function unchanged(r,fn=r.build){
 const before=r.rows(),ram=clone(r.s.projectData),session={...r.FC.session},messages=clone(r.messages),sessionRaw=Object.fromEntries(r.sessionStorage.rows);
 r.storage.calls=[];r.sessionStorage.calls=[];
 const result=await fn();
 assert.deepEqual(r.rows(),before);assert.deepEqual(clone(r.s.projectData),ram);assert.deepEqual({...r.FC.session},session);
 assert.deepEqual(r.storage.calls,[]);assert.deepEqual(r.sessionStorage.calls,[]);assert.deepEqual(Object.fromEntries(r.sessionStorage.rows),sessionRaw);assert.deepEqual(clone(r.messages),messages);
 return result;
}
async function refused(r,code,fn){const result=await unchanged(r,fn);assert.equal(result.ok,false,JSON.stringify(result));if(code)assert.equal(result.code,code,JSON.stringify(result));assert.deepEqual(Object.keys(result).sort(),['code','ok','path']);return result;}
async function success(r){const result=await unchanged(r);assert.equal(result.ok,true,JSON.stringify(result));return result;}
const edges={w1:true,w2:false,h1:false,h2:true};
const address=(cabinetId='one',partRoleId='body.side.left',roomId='kuchnia')=>({projectId:'A',roomId,cabinetId,partRoleId});
test('Native stores: one explicit investor/project, all rooms, dates and counts; byte-stable sources',async()=>{
 const r=fixture(),out=await success(r),p=out.document.payload.project;
 assert.equal(p.id,'A');assert.equal(out.document.payload.investor.id,'inv-A');assert.equal(p.projectData.schemaVersion,12);
 assert.equal(p.roomCount,4);assert.equal(p.cabinetCount,3);assert.equal(p.createdAt,r.row().createdAt);assert.equal(p.updatedAt,r.row().updatedAt);
 assert.deepEqual(clone(p.projectData),r.row().projectData);assert.equal(p.projectData.kuchnia.cabinets.length,2);assert.equal(p.projectData.pokoj.cabinets.length,1);
 assert.equal(JSON.stringify(out).includes('Fikcyjny projekt B'),false);assert.ok(out.warnings.includes('DATA_RESTORE_IS_NOT_QUOTE_RECALCULATION'));
 assert.ok(r.storage.reads.every(k=>[P,I,S,'fc_current_investor_v1','fc_current_project_id_v1'].includes(k)),r.storage.reads.join(','));
});
test('Real PCV setEdges + commit: independent left/right, cabinets and rooms survive export and restart',async()=>{
 const r=fixture();assert.equal(r.FC.projectPcvOverrides.setEdges(address(),edges).ok,true);
 assert.equal(r.FC.projectPcvOverrides.setEdges(address('two','body.side.right'),{w2:true}).ok,true);
 assert.equal(r.FC.session.commit(),true);
 const a=await success(r),prod=a.document.payload.project.projectData.kuchnia.production;
 assert.deepEqual(clone(prod.partOverrides.one['body.side.left'].edges),edges);
 assert.equal(prod.partOverrides.two['body.side.right'].edges.w2,true);assert.equal(prod.partOverrides.one['body.side.right'],undefined);
 assert.equal(a.document.payload.project.projectData.pokoj.production,undefined);
 const restarted=fixture(r.rows()),b=await success(restarted);assert.equal(a.document.integrity.payloadSha256,b.document.integrity.payloadSha256);
});
test('Native group and set owners are preserved, never replaced with qty/first cabinet addresses',async()=>{
 const r=fixture();r.mutate(p=>{
  const room=p.projectData.kuchnia,cab=room.cabinets[0];cab.subType='szuflady';cab.details={drawerLayout:'3_1_2_2',drawerSystem:'skrzynkowe'};
  const other=room.cabinets[1];other.details.shelves=5;other.setId='set-A';
  room.sets=[{id:'set-A',presetId:'A',frontCount:2,params:{w1:30,w2:30,hB:72,hTop:20}}];
  room.production={cabinetGroupOverrides:{one:{'front.drawer.small':{edges},'front.drawer.large':{edges},'drawer.front_drawers.sides':{edges}},two:{'body.shelves':{edges}}},setGroupOverrides:{'set-A':{'front.A.left':{edges}}}};
 });
 const out=await success(r),p=out.document.payload.project.projectData.kuchnia.production;
 assert.equal(Object.keys(p.cabinetGroupOverrides.one).length,3);assert.deepEqual(clone(p.setGroupOverrides['set-A']['front.A.left'].edges),edges);
 assert.equal(JSON.stringify(p).includes('qty'),false);
});
test('Actual native PCV group setter exports one shelf address before/after 3 to 5',async()=>{
 const r=fixture(),a={projectId:'A',roomId:'kuchnia',ownerType:'cabinet',cabinetId:'one',groupRoleId:'body.shelves'};
 assert.equal(r.FC.projectPcvOverrides.setEdges(a,edges).ok,true);assert.equal(r.FC.session.commit(),true);
 const first=await success(r);r.mutate(p=>p.projectData.kuchnia.cabinets[0].details.shelves=5);
 const next=await success(r);assert.deepEqual(clone(first.document.payload.project.projectData.kuchnia.production),clone(next.document.payload.project.projectData.kuchnia.production));
});
test('Exact SHA-256 canonical UTF-8; payload independent of export timestamp and key order',async()=>{
 const r=fixture(),first=await success(r),c=r.FC.projectExportContract;
 const hash=v=>createHash('sha256').update(c.canonical(v),'utf8').digest('hex');
 assert.equal(first.document.integrity.payloadSha256,hash(first.document.payload));
 const header=clone(first.document);delete header.integrity;assert.equal(first.document.integrity.documentSha256,hash(header));
 assert.equal(first.utf8Bytes,Buffer.byteLength(c.canonical(first.document),'utf8'));
 class LaterDate extends Date{constructor(...args){super(...(args.length?args:[1900000000000]));}}r.s.Date=LaterDate;
 r.mutate(p=>{p.projectData.kuchnia.settings=Object.fromEntries(Object.entries(p.projectData.kuchnia.settings).reverse());});
 const second=await success(r);assert.equal(first.document.integrity.payloadSha256,second.document.integrity.payloadSha256);assert.notEqual(first.document.integrity.documentSha256,second.document.integrity.documentSha256);
});
test('Closed nested allowlist refuses unknown business fields and notes, including front.note',async()=>{
 for(const fn of [p=>p.projectData.kuchnia.cabinets[0].details.hardwareRequirementOverrides={secret:'synthetic'},p=>p.projectData.kuchnia.finishes={board:'x'},p=>p.projectData.meta.extra={apiKey:'synthetic'},p=>p.projectData.kuchnia.cabinets[0].drawerRequirements=[{qty:1}],p=>p.projectData.kuchnia.sets=[{id:'x',presetId:'A',frontCount:1,params:{apiKey:'synthetic'}}]]){
  const r=fixture();r.mutate(fn);const out=await refused(r,'EXPORT_UNSUPPORTED_FIELD');assert.equal(JSON.stringify(out).includes('synthetic'),false);assert.equal(out.path.includes('apiKey'),false);
 }
 const r=fixture();r.inv(i=>i.notes='synthetic note');await refused(r,'EXPORT_UNSUPPORTED_NOTE');
 const diagnostic=fixture();diagnostic.inv(i=>i.transport.lastError='SYNTHETIC_ORS_DIAGNOSTIC_ONLY');const rejected=await refused(diagnostic,'EXPORT_UNSUPPORTED_NOTE');assert.equal(JSON.stringify(rejected).includes('SYNTHETIC_ORS_DIAGNOSTIC_ONLY'),false);
 const f=fixture();f.mutate(p=>p.projectData.kuchnia.fronts=[{id:'front',cabId:'one',width:60,height:72,note:'1 front'}]);await refused(f,'EXPORT_UNSUPPORTED_NOTE');
});
test('Empty notes and front geometry are retained; unrelated source cache is explicitly excluded',async()=>{
 const r=fixture();r.mutate(p=>{p.projectData.kuchnia.fronts=[{id:'front',cabId:'one',width:60,height:72,note:''}];p.projectData.kuchnia.cabinets[0].derivedFacts={secret:'not exported'};});
 r.s.projectData.kuchnia.cabinets[0].derivedFacts={cache:'RAM differs'};
 const out=await success(r);assert.equal(out.document.payload.project.projectData.kuchnia.fronts[0].note,'');assert.equal(JSON.stringify(out).includes('not exported'),false);
 r.s.projectData.kuchnia.cabinets[0].derivedFacts=undefined;const fresh=await success(r);assert.ok(Object.prototype.hasOwnProperty.call(r.s.projectData.kuchnia.cabinets[0],'derivedFacts'));assert.equal(fresh.document.integrity.payloadSha256,out.document.integrity.payloadSha256);
});
test('IDs, dates, counters, schemas, owner, room order and references are strict, never repaired',async()=>{
 const cases=[['EXPORT_INVALID_DATE',p=>p.updatedAt=0],['EXPORT_INVALID_DATE',p=>p.updatedAt=p.createdAt-1],['EXPORT_COUNT_MISMATCH',p=>p.cabinetCount++],['EXPORT_ROOM_SCOPE_MISMATCH',p=>p.roomKeys.pop()],['EXPORT_ROOM_SCOPE_MISMATCH',p=>p.projectData.meta.roomOrder.pop()],['EXPORT_DUPLICATE_ID',p=>p.projectData.meta.roomOrder.push('kuchnia')],['EXPORT_DUPLICATE_ID',p=>p.projectData.kuchnia.cabinets[1].id='one'],['EXPORT_INVALID_ID',p=>p.id=''],['EXPORT_SCHEMA_UNSUPPORTED',p=>p.projectData.schemaVersion=11],['EXPORT_INVESTOR_MISMATCH',p=>p.investorId='inv-B'],['EXPORT_INVALID_REFERENCE',p=>p.projectData.kuchnia.cabinets[0].setId='missing'],['EXPORT_INVALID_GEOMETRY',p=>p.projectData.kuchnia.cabinets[0].width=-1],['EXPORT_REQUIRED_FIELD',p=>delete p.createdAt]];
 for(const [code,fn]of cases){const r=fixture();r.mutate(fn);await refused(r,code);}
});
test('Invalid PCV edges/roles/owner and unsupported production structures are refused',async()=>{
 for(const [code,fn]of [
  ['EXPORT_PCV_OWNER_INVALID',p=>p.projectData.kuchnia.production={partOverrides:{absent:{'body.side.left':{edges}}}}],
  ['EXPORT_PCV_ROLE_INVALID',p=>p.projectData.kuchnia.production={partOverrides:{one:{'not-a-role':{edges}}}}],
  ['EXPORT_REQUIRED_FIELD',p=>p.projectData.kuchnia.production={partOverrides:{one:{'body.side.left':{edges:{w1:true}}}}}],
  ['EXPORT_INVALID_FIELD',p=>p.projectData.kuchnia.production={partOverrides:{one:{'body.side.left':{edges:{...edges,w1:1}}}}}],
  ['EXPORT_INVALID_FIELD',p=>p.projectData.meta.productionPcvMode='legacy'],
  ['EXPORT_UNSUPPORTED_STRUCTURE',p=>p.projectData.kuchnia.cabinets[0].subType='custom'],
  ['EXPORT_INVALID_GEOMETRY',p=>{const c=p.projectData.kuchnia.cabinets[0];c.subType='szuflady';c.height=40;c.details.drawerLayout='3_1_2_2';}]
 ]){const r=fixture();r.mutate(fn);await refused(r,code);}
});
test('Wrong selected context, missing records and duplicate IDs cannot select another owner',async()=>{
 for(const opts of [{investorId:'inv-B',projectId:'B',purpose:'pilot'},{investorId:'inv-A',projectId:'A',purpose:'wrong'}]){const r=fixture();await refused(r,opts.purpose==='wrong'?'EXPORT_SCOPE_REQUIRED':'EXPORT_CONTEXT_MISMATCH',()=>r.FC.projectSelectiveExport.build(opts));}
 const r=fixture();r.storage.rows.set(I,'[]');await refused(r,'EXPORT_INVESTOR_NOT_FOUND');
 const b=fixture();b.storage.rows.set(P,'[]');await refused(b,'EXPORT_PROJECT_NOT_FOUND');
 const c=fixture();c.inv((i,list)=>list.push(clone(i)));await refused(c,'EXPORT_DUPLICATE_ID');
});
test('Ambiguous investor.rooms mirror across physical projects refuses; canonical distinct scopes work',async()=>{
 const r=fixture();r.inv(i=>i.rooms=[{id:'kuchnia',baseType:'kuchnia',name:'kuchnia',label:'kuchnia'}]);
 await success(r);
 r.mutate((p,list)=>list.push({...clone(p),id:'same-investor-second'}));await refused(r,'EXPORT_OWNER_AMBIGUOUS');
});
test('Active clean/dirty sessions block without notices or any new mutation',async()=>{
 for(const dirty of [false,true]){const r=fixture();assert.equal(r.FC.session.begin('kuchnia'),true);if(dirty)r.s.projectData.kuchnia.cabinets[0].width=65;await refused(r,'EXPORT_ACTIVE_SESSION');}
});
test('Partial real PCV write, failed revision, restart and failed begin never export as confirmed',async()=>{
 const r=fixture();assert.equal(r.FC.session.begin('kuchnia'),true);r.storage.fail.add('set:'+S);
 const result=r.FC.projectPcvOverrides.setEdges(address(),edges);assert.equal(result.ok,false);assert.equal(result.projectSaved,true);
 r.storage.fail.clear();await refused(r,'EXPORT_SESSION_UNCONFIRMED');
 const fresh=fixture(r.rows());await refused(fresh,'EXPORT_ACTIVE_SESSION');
 const failed=fixture();failed.storage.fail.add('set:'+S);assert.equal(failed.FC.session.begin('kuchnia'),false);failed.storage.fail.clear();await refused(failed);
});
test('Failed confirmed save retains actual stored state; dirty session/RAM cannot export',async()=>{
 const r=fixture();assert.equal(r.FC.session.begin('kuchnia'),true);const next=clone(r.s.projectData);next.kuchnia.cabinets[0].width=77;r.s.projectData=next;
 const old=r.storage.getItem(P);r.storage.fail.add('set:'+P);const saved=r.FC.project.saveConfirmed(next);assert.equal(saved.ok,false);assert.equal(r.storage.getItem(P),old);await refused(r,'EXPORT_ACTIVE_SESSION');
});
test('Missing durable source/payload, invalid JSON, strict read exception and pending operation fail closed',async()=>{
 for(const [code,fn]of [
 ['EXPORT_SOURCE_MISSING',r=>r.storage.rows.delete(P)],['EXPORT_SOURCE_INVALID_JSON',r=>r.storage.rows.set(P,'{bad')],['EXPORT_READ_FAILED',r=>r.storage.fail.add('get:'+P)],
 ['EXPORT_SESSION_UNCONFIRMED',r=>r.storage.rows.set(S,'{bad')],['EXPORT_PENDING_OPERATION',r=>r.mutate(p=>p.meta.pendingDomainOperation={version:1})],
 ['EXPORT_RAM_DIVERGENCE',r=>r.s.projectData.pokoj.cabinets[0].width=90]
 ]){const r=fixture();fn(r);await refused(r,code);}
});
test('No implicit dependency repairs or copying global prices, secrets, grain, snapshots and other projects',async()=>{
 const r=fixture();for(const key of ['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_company_profile_v1','fc_materials_v1','fc_accessories_v1','fc_quote_rates_v1','fc_program_defaults_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_data_backups_v1'])r.storage.rows.set(key,'{"apiKey":"SECRET_FIXTURE_ONLY","catalog":"DO_NOT_COPY"}');
 const out=await success(r);assert.equal(JSON.stringify(out).includes('SECRET_FIXTURE_ONLY'),false);assert.equal(JSON.stringify(out).includes('DO_NOT_COPY'),false);assert.ok(out.dependencies.some(d=>d.reference==='laminat TEST'));
});
test('Crypto absence/failure and oversize UTF-8 refuse without truncation or fallback',async()=>{
 const r=fixture();delete r.s.crypto;await refused(r,'EXPORT_CRYPTO_UNAVAILABLE');
 const f=fixture();f.s.crypto={subtle:{digest:async()=>{throw Error('unavailable');}}};await refused(f,'EXPORT_CRYPTO_UNAVAILABLE');
 const large=fixture();large.mutate(p=>p.title='ż'.repeat(410000));await refused(large,'EXPORT_SIZE_LIMIT');
});
test('Async hash window: changed selected records, RAM, session or pointers refuse; unrelated project allowed',async()=>{
 for(const which of ['project','investor','ram','session','context','unrelated']){
  const r=fixture();let fired=false;r.s.crypto={subtle:{digest:async(...args)=>{
   if(!fired){fired=true;if(which==='project')r.mutate(p=>p.title='changed');if(which==='investor')r.inv(i=>i.city='changed');if(which==='ram')r.s.projectData.kuchnia.cabinets[0].width=75;if(which==='session')assert.equal(r.FC.session.begin('kuchnia'),true);if(which==='context')r.storage.rows.set('fc_current_project_id_v1','B');if(which==='unrelated')r.mutate((p,list)=>list.find(x=>x.id==='B').title='new unrelated');}
   return webcrypto.subtle.digest(...args);
  }}};
  // The external fixture mutation during digest is intentional; only the
  // exporter must not add writes, so compare against the post-injection state.
  const result=await r.build();assert.equal(result.ok,which==='unrelated',which+': '+JSON.stringify(result));
  if(['project','investor'].includes(which))assert.equal(result.code,'EXPORT_SOURCE_CHANGED');
 }
});
test('Native empty base templates need no invented definitions; populated unregistered rooms refuse',async()=>{
 const r=fixture();r.mutate(p=>{delete p.projectData.meta.roomDefs.szafa;delete p.projectData.meta.roomDefs.lazienka;p.projectData.meta.roomOrder=['kuchnia','pokoj'];});
 const out=await success(r);assert.equal(out.document.payload.project.roomCount,4);assert.equal(out.document.payload.project.projectData.szafa.settings.roomHeight,250);assert.equal(out.document.payload.project.projectData.meta.roomDefs.szafa,undefined);
 const bad=fixture();bad.mutate(p=>{delete p.projectData.meta.roomDefs.kuchnia;p.projectData.meta.roomOrder=p.projectData.meta.roomOrder.filter(k=>k!=='kuchnia');});await refused(bad,'EXPORT_ROOM_SCOPE_MISMATCH');
});
test('No save, normalization, recovery or session lifecycle API is invoked by export',async()=>{
 const r=fixture(),forbidden=()=>{throw Error('export called forbidden mutation/normalizer');};
 for(const k of ['begin','commit','cancel','canSaveProject','isDirty'])r.FC.session[k]=forbidden;
 for(const k of ['save','saveConfirmed','normalize','load'])r.FC.project[k]=forbidden;
 for(const k of ['getById','readAll','getCurrentRecord','prepareProjectDataForPersistence'])r.FC.projectStore[k]=forbidden;
 r.FC.investors.getById=forbidden;r.FC.projectModel.normalizeProjectData=forbidden;
 const out=await success(r);assert.equal(out.document.payload.project.id,'A');
});
test('Room preference drawer selections retain shared domain keys; incomplete choices refuse',async()=>{
 const r=fixture();r.mutate(p=>p.projectData.kuchnia.preferences.drawerPreference={kind:'system',systemKey:'blum_tandembox_antaro'});let out=await success(r);assert.equal(out.document.payload.project.projectData.kuchnia.preferences.drawerPreference.systemKey,'blum_tandembox_antaro');
 r.mutate(p=>p.projectData.kuchnia.preferences.drawerPreference={kind:'box',runnerType:'undermount',manufacturer:'TEST',runnerSeries:'SERIES TEST'});out=await success(r);assert.equal(out.document.payload.project.projectData.kuchnia.preferences.drawerPreference.runnerSeries,'SERIES TEST');
 r.mutate(p=>p.projectData.kuchnia.preferences.drawerPreference.systemKey='invented');await refused(r,'EXPORT_UNSUPPORTED_FIELD');
 const b=fixture();b.mutate(p=>p.projectData.kuchnia.preferences.drawerPreference={kind:'system',systemKey:'invented'});await refused(b,'EXPORT_INVALID_FIELD');
});
test('Confirmed clearEdges returns to absence; a separate physical project exports its own payload',async()=>{
 const r=fixture();assert.equal(r.FC.projectPcvOverrides.setEdges(address(),edges).ok,true);assert.equal(r.FC.session.commit(),true);
 assert.equal(r.FC.projectPcvOverrides.clearEdges(address()).ok,true);assert.equal(r.FC.session.commit(),true);
 const out=await success(r);assert.deepEqual(clone(out.document.payload.project.projectData.kuchnia.production),r.row().projectData.kuchnia.production);assert.equal(out.document.payload.project.projectData.kuchnia.production?.partOverrides?.one?.['body.side.left'],undefined);
 r.storage.rows.set('fc_current_investor_v1','inv-B');r.storage.rows.set('fc_current_project_id_v1','B');r.s.uiState.currentInvestorId='inv-B';r.s.projectData=r.FC.project.load();
 const b=await unchanged(r,()=>r.FC.projectSelectiveExport.build({investorId:'inv-B',projectId:'B',purpose:'pilot'}));assert.equal(b.ok,true,JSON.stringify(b));assert.equal(b.document.payload.project.id,'B');assert.equal(b.document.payload.investor.id,'inv-B');
});
test('Allowed nested preferences/layout and source metadata do not collapse business values',async()=>{
 const r=fixture();r.mutate(p=>{
  const room=p.projectData.kuchnia;room.preferences.finishStandard='TEST';room.preferences.zones.lower.bodyColor='CUSTOM TEST';room.preferences.hardwareProducers.hinges='TEST HW';
  room.cabinets[0].laborItems=[{rateId:'test-rate',qty:2}];
  room.layout={segments:[{id:'seg',name:'TEST',anchor:'left',offsets:{base:0,module:0,wall:0},rows:{base:[{kind:'cabinet',id:'one'},{kind:'gap',id:'gap',width:10,label:'TEST GAP'},{kind:'cabinet',id:'two'}],module:[],wall:[]}}],activeSegmentId:'seg'};
 });
 const out=await success(r),room=out.document.payload.project.projectData.kuchnia;
 assert.equal(room.preferences.finishStandard,'TEST');assert.equal(room.preferences.zones.lower.bodyColor,'CUSTOM TEST');assert.deepEqual(clone(room.cabinets[0].laborItems),[{rateId:'test-rate',qty:2}]);assert.equal(room.layout.segments[0].rows.base[1].width,10);assert.equal(room.layout.activeSegmentId,undefined);
 assert.ok(out.dependencies.some(d=>d.domain==='rate'&&d.reference==='test-rate'));assert.ok(out.dependencies.some(d=>d.domain==='hardware'&&d.reference==='TEST HW'));
 r.mutate(p=>p.projectData.kuchnia.layout.segments[0].rows.base[0].id='missing');await refused(r,'EXPORT_INVALID_REFERENCE');
});
test('Malformed investor RAW, denied context/session reads and missing guard modules refuse safely',async()=>{
 for(const [key,code]of [[I,'EXPORT_READ_FAILED'],['fc_current_project_id_v1','EXPORT_READ_FAILED'],[S,'EXPORT_READ_FAILED']]){const r=fixture();r.storage.fail.add('get:'+key);await refused(r,code);}
 const bad=fixture();bad.storage.rows.set(I,'{}');await refused(bad,'EXPORT_SOURCE_INVALID_JSON');
 const guard=fixture();delete guard.FC.session.inspectExportState;await refused(guard,'EXPORT_SESSION_UNAVAILABLE');
 const store=fixture();delete store.FC.storage.readRawStrict;await refused(store,'EXPORT_STORAGE_UNAVAILABLE');
});
test('Only explicitly marked synthetic pilot fixtures qualify; flags are not fabricated',async()=>{
 const r=fixture();r.inv(i=>{i.meta.testData=false;delete i.__test;});await refused(r,'EXPORT_PILOT_DATA_REQUIRED');
 const p=fixture();p.mutate(row=>{row.meta={};delete row.__test;});await refused(p,'EXPORT_PILOT_DATA_REQUIRED');
});
test('Exact 800 KiB boundary uses the canonical UTF-8 file including hashes',async()=>{
 const r=fixture(),base=await success(r),originalTitle=r.row().title,delta=819200-base.utf8Bytes;
 r.mutate(p=>p.title=originalTitle+'x'.repeat(delta));const exact=await success(r);assert.equal(exact.utf8Bytes,819200);
 r.mutate(p=>p.title+='x');await refused(r,'EXPORT_SIZE_LIMIT');
});
test('Canonicalizer rejects non-JSON and invalid Unicode without coercion',()=>{
 const c=fixture().FC.projectExportContract;for(const value of [undefined,NaN,Infinity,{x:undefined},'\ud800'])assert.throws(()=>c.canonical(value));
 assert.equal(c.canonical({b:2,a:[true,null,'ż']}),'{"a":[true,null,"ż"],"b":2}');
});
// Native creators, wizard and global Save, with the full existing module loader.
// No cabinet/front/set fixture is shaped to the export allowlist.
async function nativeFixture(seed){
 const {createSandbox,loadSmokeFiles}=require('./app-dev-smoke');
 const {APP_DEV_SMOKE_FILES}=require('./app-dev-smoke-lib/file-list');
 const s=createSandbox(),Storage=class extends MemoryStorage{};
 s.Storage=Storage;s.localStorage=new Storage(seed);s.sessionStorage=new Storage();s.TextEncoder=TextEncoder;s.Uint8Array=Uint8Array;
 s.location={reload(){throw Error('Unexpected reload');}};s.scrollTo=()=>{};
 loadSmokeFiles(s,APP_DEV_SMOKE_FILES);
 for(const file of ['js/app/shared/calc.js','js/app/shared/ui-state.js','js/app/project/project-export-contract.js','js/app/project/project-selective-export.js']){
  if(!APP_DEV_SMOKE_FILES.includes(file))vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{filename:file});
 }
 // Let the real scheduled investor/project bootstrap finish before measuring an export.
 await new Promise(resolve=>setTimeout(resolve,0));
 const FC=s.FC,messages=[],handlers={};s.STORAGE_KEYS=FC.constants.STORAGE_KEYS;
 FC.infoBox={open:m=>messages.push(m)};FC.actions={register:map=>Object.assign(handlers,map)};
 vm.runInContext(fs.readFileSync(path.join(ROOT,'js/app/ui/actions-register.js'),'utf8'),s,{filename:'js/app/ui/actions-register.js'});
 let investorId,projectId,roomId;
 if(!seed){
  const inv=FC.investors.create({name:'Fikcyjny CLOUD-1B',notes:'',meta:{testData:true,testOwner:'cloud-1b-native'}});assert.ok(inv);investorId=inv.id;
  let record=FC.projectStore.ensureForInvestor(inv.id,{title:'Fikcyjny natywny projekt',meta:{testData:true,testOwner:'cloud-1b-native'}});assert.ok(record);
  // The boot-patched investor create may already have created its physical project.
  // Explicitly label that isolated synthetic record through the real store API.
  record=FC.projectStore.upsert({...record,meta:{...record.meta,testData:true,testOwner:'cloud-1b-native'}});assert.ok(record);projectId=record.id;
  s.projectData=FC.project.load();s.uiState=FC.uiState.set({entry:'rooms',activeTab:'pokoje',roomType:null,currentInvestorId:inv.id});
  const created=FC.roomRegistryProjectSync.createRoomRecord(FC.investors.getById(inv.id),{name:'Kuchnia testowa',baseType:'kuchnia'});assert.equal(created.ok,true,JSON.stringify(created));roomId=created.room.id;
  s.projectData=FC.project.load();s.uiState=FC.uiState.set({entry:'app',activeTab:'wywiad',roomType:roomId,currentInvestorId:inv.id});
 }else{
  investorId=s.localStorage.getItem('fc_current_investor_v1');projectId=s.localStorage.getItem('fc_current_project_id_v1');
  s.projectData=FC.project.load();roomId=s.projectData.meta.roomOrder[0];
  s.uiState=FC.uiState.set({entry:'rooms',activeTab:'pokoje',roomType:null,currentInvestorId:investorId});
 }
 s.cabinetModalState={mode:'add',editingId:null};s.materials=[{name:'TEST laminat',materialType:'laminat'}];
 s.generateFrontsForCabinet=FC.cabinetFronts.generateFrontsForCabinet;
 const storage=s.localStorage,rows=()=>Object.fromEntries(storage.rows),row=()=>JSON.parse(storage.getItem(P)).find(x=>x.id===projectId);
 function finish(){
  const previous=messages.length;handlers['session-save']({event:null});
  assert.equal(FC.session.active,false,JSON.stringify(FC.session.lastError));assert.equal(storage.getItem(S),null);
  assert.ok(messages.slice(previous).some(m=>m.title==='Projekt zapisany'));
  assert.deepEqual(clone(s.projectData),row().projectData);
 }
 function addCab({frontCount=2,drawer=false,box=false,type='stojąca',shelves,layout='3_1_2_2'}={}){
  const draft=FC.cabinetModalDraft.makeDefaultCabinetDraftForType(roomId,type);draft.frontCount=frontCount;
  if(drawer){FC.cabinetFronts.applySubTypeRules(roomId,draft,'szuflady');draft.details.drawerLayout=layout;draft.details.drawerSystem=box?'skrzynkowe':'systemowe';if(!box){draft.details.drawerBrand='blum';draft.details.drawerModel='tandembox_antaro';}}
  if(shelves!==undefined)draft.details.shelves=shelves;
  s.cabinetModalState={mode:'add',editingId:null,draft};
  assert.equal(FC.cabinetModalFinalize.saveRegularCabinetDraft({draft}),true,JSON.stringify(messages));finish();
  return row().projectData[roomId].cabinets.at(-1);
 }
 function addSet(preset,count,source='custom'){
  const values={setFrontCount:count,setFrontMaterial:'laminat',setFrontColor:'TEST laminat',setFrontSource:source,setBodyColor:'TEST laminat',setBackMaterial:'HDF 3mm biała',setOpeningSystem:'uchwyt klienta',setW1:60,setW2:60,setW:60,setHBottom:82,setHMiddle:100,setDBottom:51,setBlende:7};
  for(const [id,value]of Object.entries(values)){let el=s.document.getElementById(id);if(!el){el=s.document.createElement('input');el.setAttribute('id',id);s.document.body.appendChild(el);}el.value=String(value);}
  s.cabinetModalState={mode:'add',chosen:'zestaw',setPreset:preset,setEditId:null};FC.cabinetModalSetWizard.createOrUpdateSetFromWizard();
  assert.equal(s.projectData[roomId].sets.length,1,JSON.stringify(messages));finish();return row().projectData[roomId].sets[0];
 }
 // Corruption/concurrency injection for negative tests only, never a positive fixture repair.
 const mutate=fn=>{const list=JSON.parse(storage.getItem(P)),record=list.find(p=>p.id===projectId);fn(record,list);storage.rows.set(P,JSON.stringify(list));s.projectData=clone(record.projectData);};
 const inv=fn=>{const list=JSON.parse(storage.getItem(I));fn(list.find(i=>i.id===investorId));storage.rows.set(I,JSON.stringify(list));};
 const build=()=>FC.projectSelectiveExport.build({investorId,projectId,purpose:'pilot'});
 return {s,FC,storage,sessionStorage:s.sessionStorage,messages,handlers,investorId,projectId,roomId,rows,row,finish,addCab,addSet,mutate,inv,build};
}
function assertNativePayload(r,out){
 assert.equal(out.ok,true,JSON.stringify(out));const saved=r.row(),payload=clone(out.document.payload);
 assert.deepEqual(payload.project.projectData,saved.projectData,'No lost or transformed project business fields');
 const expectedProject=clone(saved);delete expectedProject.meta;delete expectedProject.__test;delete expectedProject.__testRunId;
 assert.deepEqual(payload.project,expectedProject);
 const expectedInvestor=JSON.parse(r.storage.getItem(I)).find(i=>i.id===r.investorId);delete expectedInvestor.rooms;delete expectedInvestor.meta;delete expectedInvestor.__test;delete expectedInvestor.__testRunId;
 assert.deepEqual(payload.investor,expectedInvestor,'Native empty geocodes and notes remain byte-for-byte values');
 assert.deepEqual({roomKeys:saved.roomKeys,roomCount:saved.roomCount,cabinetCount:saved.cabinetCount},clone(r.FC.projectModel.summarizeProjectData(saved.projectData)));
}
async function nativeRoundTrip(r){
 const out=await unchanged(r);assertNativePayload(r,out);
 const restarted=await nativeFixture(r.rows()),next=await unchanged(restarted);assertNativePayload(restarted,next);
 assert.equal(out.document.integrity.payloadSha256,next.document.integrity.payloadSha256);
 return out;
}
test('Native empty investor/project/room: confirmed global Save, restart and lossless export',async()=>{
 const r=await nativeFixture();r.finish();await nativeRoundTrip(r);
});
for(const spec of [{frontCount:1},{frontCount:2},{frontCount:2,shelves:3},{drawer:true},{drawer:true,box:true},{type:'wisząca',frontCount:1},{type:'wisząca',frontCount:2},{type:'moduł',frontCount:1},{type:'moduł',frontCount:2},{type:'moduł',drawer:true},...['1_big','2_equal','3_equal','5_equal'].map(layout=>({drawer:true,layout}))])test('Native cabinet '+JSON.stringify(spec)+': fronts, PCV, Save/restart/export',async()=>{
 const r=await nativeFixture(),cab=r.addCab(spec),room=r.row().projectData[r.roomId];
 if(spec.drawer){const geometry=r.FC.cabinetCutlist.resolveDrawerFrontGeometry(cab,room);assert.deepEqual(room.fronts.map(f=>Math.round(f.height*10)),clone(geometry.panels.map(panel=>panel.heightMm)));if(!spec.layout&&!spec.type)assert.deepEqual(room.fronts.map(f=>f.height*10),[139,283,283]);}
 assert.equal(r.FC.projectPcvOverrides.setEdges({projectId:r.projectId,roomId:r.roomId,cabinetId:cab.id,partRoleId:'body.side.left'},edges).ok,true);r.finish();
 await nativeRoundTrip(r);
});
for(const preset of ['A','C','D'])for(const count of [1,2])for(const source of ['custom','lower'])test(`Native wizard ${preset}, ${count} fronts, ${source}: set owner, sources and PCV round-trip`,async()=>{
 const r=await nativeFixture(),set=r.addSet(preset,count,source),role=preset==='A'?(count===1?'front.A.single':'front.A.left'):'front.'+preset+'.panels';
 const room=r.row().projectData[r.roomId];assert.equal(room.fronts.length,count);assert.ok(room.fronts.every(f=>f.setId===set.id));
 assert.deepEqual(Object.keys(set.frontSource).sort(),['color','label','material','source']);
 assert.equal(r.FC.projectPcvOverrides.setEdges({projectId:r.projectId,roomId:r.roomId,ownerType:'set',setId:set.id,groupRoleId:role},edges).ok,true);r.finish();
 await nativeRoundTrip(r);
});

test('Native independent cabinet/side and shelf/drawer group PCV survives export without global data',async()=>{
 const r=await nativeFixture(),first=r.addCab({shelves:3}),second=r.addCab({shelves:5});
 const protectedKeys=['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_company_profile_v1','fc_materials_v1','fc_accessories_v1','fc_quote_rates_v1','fc_program_defaults_v1','fc_quote_snapshots_v1'];
 for(const key of protectedKeys)r.storage.rows.set(key,'{"synthetic":"DO_NOT_EXPORT","apiKey":"SECRET_TEST_ONLY"}');
 const before=Object.fromEntries(protectedKeys.map(key=>[key,r.storage.getItem(key)]));
 const part=(cabinetId,partRoleId)=>({projectId:r.projectId,roomId:r.roomId,cabinetId,partRoleId});
 for(const [a,e]of [[part(first.id,'body.side.left'),edges],[part(first.id,'body.side.right'),{...edges,w2:true}],[part(second.id,'body.side.left'),{...edges,h1:true}],
  [{projectId:r.projectId,roomId:r.roomId,ownerType:'cabinet',cabinetId:first.id,groupRoleId:'body.shelves'},edges]])assert.equal(r.FC.projectPcvOverrides.setEdges(a,e).ok,true);
 r.finish();const out=await nativeRoundTrip(r),prod=out.document.payload.project.projectData[r.roomId].production;
 assert.notDeepEqual(clone(prod.partOverrides[first.id]),clone(prod.partOverrides[second.id]));
 assert.equal(prod.partOverrides[first.id]['body.side.right'].edges.w2,true);
 assert.deepEqual(clone(prod.cabinetGroupOverrides[first.id]['body.shelves'].edges),edges);
 assert.equal(JSON.stringify(out).includes('SECRET_TEST_ONLY'),false);
 assert.deepEqual(Object.fromEntries(protectedKeys.map(key=>[key,r.storage.getItem(key)])),before);
 const d=await nativeFixture(),drawer=d.addCab({drawer:true});
 for(const groupRoleId of ['front.drawer.small','front.drawer.large'])assert.equal(d.FC.projectPcvOverrides.setEdges({projectId:d.projectId,roomId:d.roomId,ownerType:'cabinet',cabinetId:drawer.id,groupRoleId},edges).ok,true);
 d.finish();await nativeRoundTrip(d);
 const b=await nativeFixture(),box=b.addCab({drawer:true,box:true});
 for(const groupRoleId of ['drawer.front_drawers.sides','drawer.front_drawers.back'])assert.equal(b.FC.projectPcvOverrides.setEdges({projectId:b.projectId,roomId:b.roomId,ownerType:'cabinet',cabinetId:box.id,groupRoleId},edges).ok,true);b.finish();await nativeRoundTrip(b);
});
test('Native zone source retains remembered custom fields separately from resolved front material',async()=>{
 const r=await nativeFixture(),prefs=r.FC.roomPreferences.getRoomPreferences(r.roomId);
 prefs.zones.lower.frontMaterial='akryl';prefs.zones.lower.frontColor='TEST AKRYL';
 assert.equal(r.FC.roomPreferences.setRoomPreferencesConfirmed(r.roomId,prefs).ok,true);r.finish();
 const set=r.addSet('C',2,'lower');assert.equal(set.frontMaterial,'akryl');assert.equal(set.frontSource.material,'laminat');
 await nativeRoundTrip(r);
});
test('Empty native geocodes are lossless; populated text, coordinates and unknown secrets still refuse',async()=>{
 const r=await nativeFixture();r.finish();const seed=r.rows();
 for(const [code,mutate]of [
  ['EXPORT_UNSUPPORTED_NOTE',i=>i.transport.originGeocode.label='SYNTHETIC_SECRET'],
  ['EXPORT_INVALID_FIELD',i=>i.transport.destinationGeocode.coordinates=[1,2]],
  ['EXPORT_UNSUPPORTED_FIELD',i=>i.transport.originGeocode.apiKey='SYNTHETIC_SECRET'],
  ['EXPORT_UNSUPPORTED_NOTE',i=>i.notes='dowolna notatka']
 ]){const bad=await nativeFixture(seed);bad.inv(mutate);const result=await refused(bad,code);assert.equal(JSON.stringify(result).includes('SYNTHETIC_SECRET'),false);}
});
test('Native captions require exact owner/count/geometry; no free text or duplicate captions',async()=>{
 const r=await nativeFixture();r.addCab({frontCount:1});const seed=r.rows();
 for(const [code,mutate]of [
  ['EXPORT_UNSUPPORTED_NOTE',room=>room.fronts[0].note+=' dodatkowy tekst'],
  ['EXPORT_UNSUPPORTED_NOTE',room=>room.fronts[0].note='Front 1/2'],
  ['EXPORT_INVALID_GEOMETRY',room=>room.fronts[0].height++],
  ['EXPORT_INVALID_REFERENCE',room=>room.fronts[0].material='inny'],
  ['EXPORT_INVALID_REFERENCE',room=>room.fronts[0].cabId='missing'],
  ['EXPORT_UNSUPPORTED_NOTE',room=>room.fronts.push({...room.fronts[0],id:'extra-native-caption'})],
  ['EXPORT_UNSUPPORTED_FIELD',room=>room.fronts[0].meta={apiKey:'SYNTHETIC_SECRET'}]
 ]){const bad=await nativeFixture(seed);bad.mutate(p=>mutate(p.projectData[r.roomId]));await refused(bad,code);}
 const d=await nativeFixture();d.addCab({drawer:true});d.mutate(p=>p.projectData[d.roomId].cabinets[0].height=40);await refused(d,'EXPORT_INVALID_GEOMETRY');
});
test('Native sets refuse inconsistent source labels/material/owner, wrong count or geometry',async()=>{
 const r=await nativeFixture();r.addSet('A',2,'custom');const seed=r.rows();
 for(const [code,mutate]of [
  ['EXPORT_UNSUPPORTED_FIELD',room=>room.sets[0].frontSource.apiKey='SYNTHETIC_SECRET'],
  ['EXPORT_INVALID_FIELD',room=>room.sets[0].frontSource.source='unknown'],
  ['EXPORT_INVALID_REFERENCE',room=>room.sets[0].frontSource.label='inne'],
  ['EXPORT_INVALID_REFERENCE',room=>room.sets[0].frontSource.material='inne'],
  ['EXPORT_INVALID_REFERENCE',room=>room.fronts[0].frontMaterialSource.color='inne'],
  ['EXPORT_INVALID_REFERENCE',room=>room.fronts[0].frontMaterialSource.part='lower'],
  ['EXPORT_INVALID_REFERENCE',room=>room.fronts[0].setId='missing'],
  ['EXPORT_INVALID_REFERENCE',room=>{room.fronts[0].cabId=room.cabinets[0].id;delete room.fronts[0].setId;delete room.fronts[0].setNumber;}],
  ['EXPORT_INVALID_GEOMETRY',room=>room.fronts[0].width++],
  ['EXPORT_INVALID_GEOMETRY',room=>room.fronts.pop()]
 ]){const bad=await nativeFixture(seed);bad.mutate(p=>mutate(p.projectData[r.roomId]));await refused(bad,code);}
});
test('Confirmed scoped save summarizes the merged rooms once, preserving newer room/project data and Cancel',async()=>{
 const r=fixture(),otherProject=clone(JSON.parse(r.storage.getItem(P)).find(p=>p.id==='B'));
 assert.equal(r.FC.session.begin('kuchnia'),true);
 const latest=r.FC.projectStore.getById('A');latest.projectData.pokoj.cabinets.push({...latest.projectData.pokoj.cabinets[0],id:'new-other'});
 Object.assign(latest,r.FC.projectModel.summarizeProjectData(latest.projectData));assert.ok(r.FC.projectStore.upsert(latest));
 const newerOther=clone(r.row().projectData.pokoj);
 r.s.projectData.kuchnia.cabinets.push({...r.s.projectData.kuchnia.cabinets[0],id:'new-owned'});
 const expected=r.FC.projectStore.getById('A');r.storage.calls=[];
 const saved=r.FC.project.saveConfirmed(r.s.projectData,{expectedRecord:expected});assert.equal(saved.ok,true);
 assert.equal(r.storage.calls.filter(c=>c[0]==='set'&&c[1]===P).length,1,'No second repair write');
 assert.equal(r.row().cabinetCount,5);assert.deepEqual(r.row().projectData.pokoj,newerOther);
 assert.deepEqual(clone(JSON.parse(r.storage.getItem(P)).find(p=>p.id==='B')),otherProject);
 r.s.projectData=saved.project;assert.equal(r.FC.session.commit(),true);
 assert.equal(r.FC.session.begin('kuchnia'),true);r.s.projectData.kuchnia.cabinets.pop();
 const changed=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(changed.ok,true);assert.equal(r.row().cabinetCount,4);
 assert.equal(r.FC.session.cancel(),true);assert.equal(r.row().cabinetCount,5);assert.deepEqual(r.row().projectData.pokoj,newerOther);
});
test('Summary follows a full confirmed room-set save, not a stale saved count',()=>{
 const r=fixture(),next=clone(r.s.projectData);next.salon=clone(next.pokoj);next.meta.roomDefs.salon={id:'salon',baseType:'pokoj',name:'Salon',label:'Salon'};next.meta.roomOrder.push('salon');
 r.storage.calls=[];const result=r.FC.project.saveConfirmed(next);assert.equal(result.ok,true);
 assert.equal(r.row().roomCount,5);assert.equal(r.row().cabinetCount,4);assert.ok(r.row().roomKeys.includes('salon'));
 assert.equal(r.storage.calls.filter(c=>c[0]==='set'&&c[1]===P).length,1);
});
test('Counter update honors failed writes, optimistic conflicts and unconfirmed read-back',()=>{
 const r=fixture();assert.equal(r.FC.session.begin('kuchnia'),true);r.s.projectData.kuchnia.cabinets.push({...r.s.projectData.kuchnia.cabinets[0],id:'new'});
 const original=r.storage.getItem(P),draft=JSON.stringify(r.s.projectData),snapshot=JSON.stringify(r.FC.session.snapshot);
 r.storage.fail.add('set:'+P);assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);assert.equal(r.storage.getItem(P),original);assert.equal(JSON.stringify(r.s.projectData),draft);assert.equal(JSON.stringify(r.FC.session.snapshot),snapshot);
 r.storage.fail.clear();const stale=r.FC.projectStore.getById('A');
 const concurrent=r.FC.projectStore.getById('A');concurrent.title='Concurrent synthetic';assert.ok(r.FC.projectStore.upsert(concurrent));const before=r.storage.getItem(P);
 assert.equal(r.FC.project.saveConfirmed(r.s.projectData,{expectedRecord:stale}).ok,false);assert.equal(r.storage.getItem(P),before);
 const update=r.FC.projectStore.updateRecordConfirmed;
 r.FC.projectStore.updateRecordConfirmed=(...args)=>{const saved=update(...args);assert.ok(saved);const list=JSON.parse(r.storage.getItem(P));list.find(p=>p.id==='A').cabinetCount++;r.storage.rows.set(P,JSON.stringify(list));return saved;};
 const result=r.FC.project.saveConfirmed(r.s.projectData,{expectedRecord:r.FC.projectStore.getById('A')});
 assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.equal(result.code,'SAVE_UNCONFIRMED');assert.equal(JSON.stringify(r.s.projectData),draft);
 assert.equal(r.FC.session.commit(),false);assert.equal(r.FC.session.canSaveProject(),false);
});

async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('CLOUD-1B selective project export: '+tests.length+'/'+tests.length+' PASS');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture};
