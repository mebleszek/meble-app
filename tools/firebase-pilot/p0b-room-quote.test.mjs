import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {quoteScope,validateQuoteLedger,validateQuoteLedgerChange,validateQuoteStatusHistoryChange} from '../../sync/local-first-quote-contract.mjs';
const require=createRequire(import.meta.url),{fixture:pcvFixture,load,clone}=require('../effective-project-pcv-smoke.js');
function fixture(){
 const r=pcvFixture();
 // The shared legacy PCV fixture starts with schema 1. Reload the actual native
 // model/store/bridge with the room protocol's schema 12 before seeding data.
 r.FC.schema.CURRENT_SCHEMA_VERSION=12;r.FC.schema.DEFAULT_PROJECT.schemaVersion=12;
 for(const file of ['js/app/project/project-model.js','js/app/project/project-store.js','js/app/project/project-bridge.js'])load(r,file);
 for(const file of ['js/app/cabinet/cabinet-fronts.js','js/app/project/project-local-room-contract.js','js/app/project/project-export-contract.js','js/app/cloud/cloud-pilot-contract.js','js/app/project/room-project-model.js','js/app/project/project-pcv-policy.js','js/app/project/room-quote-sources.js'])load(r,file);
 const original=clone(r.s.projectData.room),make=(id,height)=>{
  const room=clone(original);room.settings.legHeight=height;
  room.fronts=room.cabinets.flatMap(cab=>r.FC.cabinetFronts.previewFrontsForCabinet(room,cab).map((front,index)=>({...front,id:id+'-'+cab.id+'-'+index})));
  room.production={partOverrides:{one:{'body.side.left':{edges:{w1:true,w2:height===10,h1:height===20,h2:false}}}}};
  return r.FC.roomProjectModel.create('inv-A',{id,baseType:'kuchnia',name:id},room);
 };
 const records=[make('kitchen',10),make('wardrobe',20)];
 r.storage.rows.set('fc_projects_v1',JSON.stringify(records));
 r.FC.applicationRegistry={id:'p0b-rooms-v1'};
 r.FC.projectStore.setCurrentProjectId('kitchen');r.s.projectData=r.FC.project.load();
 r.storage.calls.length=0;return r;
}
test('P0-B room quote proof: per-room PCV overrides, identical cabinet IDs and edit fences remain independent',()=>{
 const r=fixture(),fc=r.FC,opts={pcvMode:'project',projectId:'kitchen'},before=Object.fromEntries(r.storage.rows);
 const both=fc.projectPcvResolver.requireCollection(['kitchen','wardrobe'],opts);
 const separate=['kitchen','wardrobe'].map(id=>fc.projectPcvResolver.requireCollection([id],opts));
 for(const key of ['total','body','front'])assert.ok(Math.abs(both.edgeMetersByMode[key]-separate.reduce((sum,row)=>sum+row.edgeMetersByMode[key],0))<1e-9);
 const left=both.details.flatMap(d=>d.parts.flatMap(p=>p.effectivePcv?.contributions||[])).filter(c=>c.address.cabinetId==='one'&&c.address.partRoleId==='body.side.left');
 assert.equal(left.length,2);assert.notDeepEqual(clone(left[0].edges),clone(left[1].edges));
 assert.ok(left.every(c=>c.address.projectId===c.address.roomId&&c.source==='override'));
 const aggregate=fc.wycenaCoreSource.getSelectedAggregate({selectedRooms:['kitchen','wardrobe']},opts);
 fc.projectPcvResolver.validateAggregate(aggregate,opts);
 assert.equal(fc.projectPcvOverrides.get({projectId:'wardrobe',roomId:'wardrobe',cabinetId:'one',partRoleId:'body.side.left'}).code,'PROJECT_CONTEXT_MISMATCH','Calculation must not grant the detached project edit permission');
 assert.deepEqual(Object.fromEntries(r.storage.rows),before);assert.deepEqual(r.storage.calls,[]);
});
test('P0-B room quote proof: stale detached sources and cross-project addresses refuse',()=>{
 const r=fixture(),fc=r.FC,source=fc.roomQuoteSources.revision(['kitchen','wardrobe']),record=fc.projectStore.getById('wardrobe');
 record.projectData.wardrobe.settings.roomHeight=251;
 r.storage.rows.set('fc_projects_v1',JSON.stringify(fc.projectStore.readAll().map(row=>row.id==='wardrobe'?record:row)));
 assert.throws(()=>fc.roomQuoteSources.assertRevision(['kitchen','wardrobe'],source),{code:'PROJECT_PCV_READ_CONFLICT'});
 assert.throws(()=>fc.roomQuoteSources.context('kitchen','wardrobe'),{code:'PROJECT_PCV_SOURCE_CONTEXT_MISMATCH'});
 assert.throws(()=>fc.roomQuoteSources.capture(['kitchen','missing']),{code:'LF_QUOTE_ROOM_SCOPE_REQUIRED'});
});

test('P0-B room quote proof: promotion preserves frozen content and refuses unapproved mutations',()=>{
 const {fixture,offers}=require('../project-navigation-blockers-smoke'),r=fixture(),history=offers(r);
 const combined=history.find(row=>row.id==='AB');combined.meta.preliminary=true;combined.commercial.preliminary=true;
 const source=JSON.stringify(history),planned=r.FC.quoteSnapshotStore.previewSelection('convertPreliminaryToFinal',['P','AB'],history);
 assert.ok(planned.result);assert.equal(planned.result.meta.preliminary,false);
 assert.equal(JSON.stringify(history),source,'Pure preview may not mutate history');
 for(const key of ['scope','lines','totals','calculationRegister','clientOffer'])assert.deepEqual(clone(planned.result[key]),clone(combined[key]));
 const before=ledger(),old=before.offers[0];old.scope.roomLabels=['Kitchen','Wardrobe'];
 old.meta={...old.meta,preliminary:true,versionName:'Wstępna oferta — Kitchen + Wardrobe',acceptedStage:'pomiar'};
 old.commercial={preliminary:true,versionName:old.meta.versionName};
 const next=structuredClone(before),row=next.offers[0];
 row.meta={...row.meta,preliminary:false,versionName:'Oferta — Kitchen + Wardrobe',acceptedStage:'zaakceptowany',rejectedAt:0,rejectedReason:''};
 row.commercial={...row.commercial,preliminary:false,versionName:row.meta.versionName};row.project.status='zaakceptowany';
 assert.equal(validateQuoteLedgerChange(before,next),true);
 for(const mutate of [v=>v.offers[0].lines.materials[0].total++,v=>v.offers[0].scope.sourceProjects[0].recordHash='c'.repeat(64),v=>v.offers[0].unknown='lost',v=>v.offers[0].commercial.versionName='Injected',v=>v.offers[0].meta.acceptedAt++,v=>v.offers[0].meta.preliminary=true]){
  const invalid=structuredClone(next);mutate(invalid);assert.throws(()=>validateQuoteLedgerChange(before,invalid));
 }
 assert.throws(()=>validateQuoteLedgerChange(next,before),'A final snapshot cannot revert to preliminary');
});

function ledger(){
 const hash='a'.repeat(64),head=projectId=>({projectId,investorId:'investor',currentRevisionId:'b'.repeat(32),documentSha256:hash,roomDeleted:false});
 const refs=['kitchen','wardrobe'].map(projectId=>({projectId,roomId:projectId,investorId:'investor',recordHash:hash,documentHash:hash,revision:head(projectId)}));
 const offer={id:'offer',investor:{id:'investor'},project:{id:'kitchen',investorId:'investor',status:'wycena'},scope:{selectedRooms:['kitchen','wardrobe'],sourceProjects:refs},
  lines:{materials:[{total:13.125}]},totals:{grand:13.125},calculationRegister:{version:1},meta:{selectedByClient:true,acceptedAt:1,acceptedStage:'zaakceptowany'}};
 return {kind:'p0b-room-quotes',investorId:'investor',offers:[offer],pins:{offer:refs.map(ref=>({projectId:ref.projectId,recordHash:hash,documentHash:hash,head:head(ref.projectId)}))}};
}
test('P0-B room quote proof: frozen accepted content, complete source pins and independent scope are mandatory',async()=>{
 const before=ledger();assert.equal(validateQuoteLedger(before),true);
 assert.notEqual(await quoteScope('investor'),'kitchen');
 for(const mutate of [v=>v.offers[0].lines.materials[0].total++,v=>v.offers[0].scope.sourceProjects[0].recordHash='c'.repeat(64),v=>v.offers[0].unknown={lost:true}]){
  const next=structuredClone(before);mutate(next);assert.throws(()=>validateQuoteLedgerChange(before,next));
 }
 const status=structuredClone(before);status.offers[0].project.status='umowa';status.offers[0].meta.acceptedStage='umowa';assert.equal(validateQuoteLedgerChange(before,status),true);
 const wrong=structuredClone(before);wrong.pins.offer[0].head.projectId='wardrobe';assert.throws(()=>validateQuoteLedger(wrong),{code:'LF_QUOTE_SOURCE_INVALID'});
 assert.equal(validateQuoteLedgerChange(before,{kind:before.kind,investorId:before.investorId,offers:[],pins:{}}),true,'Explicit active-history removal keeps prior immutable ledger revisions');
});

test('P0-B room quote proof: explicit duplicate refresh keeps frozen accepted values and immutable source pins',()=>{
 const before=ledger();before.offers[0].generatedAt=1000;before.offers[0].calculationRegister.generatedAt=999;
 before.offers[0].meta.source='quote-generation';before.offers[0].clientOffer={builtAt:999,generatedAt:999,unknown:'preserved'};
 const next=structuredClone(before);next.offers[0].generatedAt=2000;next.offers[0].calculationRegister.generatedAt=1999;next.offers[0].meta.source='quote-duplicate-refresh';next.offers[0].clientOffer.builtAt=1999;next.offers[0].clientOffer.generatedAt=1999;
 assert.equal(validateQuoteLedgerChange(before,next),true);
 assert.equal(before.offers[0].generatedAt,1000,'Previous snapshot remains exact');
 for(const mutate of [v=>delete v.offers[0].meta.source,v=>v.offers[0].totals.grand++,v=>v.offers[0].lines.materials[0].total++,v=>v.offers[0].unknown='lost',v=>v.offers[0].scope.sourceProjects[0].recordHash='c'.repeat(64),v=>v.offers[0].calculationRegister.generatedAt=2001,v=>v.offers[0].clientOffer.builtAt=2001,v=>v.offers[0].clientOffer.unknown='lost',v=>v.offers[0].generatedAt=999]){
  const invalid=structuredClone(next);mutate(invalid);assert.throws(()=>validateQuoteLedgerChange(before,invalid));
 }
 for(const metadata of [undefined,'invalid']){const malformed=structuredClone(before);if(metadata===undefined)delete malformed.offers[0].meta;else malformed.offers[0].meta=metadata;assert.throws(()=>validateQuoteLedgerChange(malformed,next),{code:'LF_QUOTE_HISTORY_IMMUTABLE'});}
});

test('P0-B room quote proof: atomic removal status participants cannot change retained offers or unrelated rooms',()=>{
 const before=ledger(),other=structuredClone(before.offers[0]);other.id='other';before.offers.push(other);before.pins.other=structuredClone(before.pins.offer);
 const after=structuredClone(before);after.offers=after.offers.filter(row=>row.id!=='offer');delete after.pins.offer;
 assert.equal(validateQuoteLedgerChange(before,after),true);assert.equal(validateQuoteStatusHistoryChange(before,after,['kitchen','wardrobe']),true);
 for(const [value,scopes]of [[after,['foreign']], [{...after,offers:[]},['kitchen']], [before,['kitchen']]]){
  if(value===before){const changed=structuredClone(after);changed.offers[0].totals.grand++;assert.throws(()=>validateQuoteStatusHistoryChange(before,changed,scopes));}
  else assert.throws(()=>validateQuoteStatusHistoryChange(before,value,scopes));
 }
 assert.throws(()=>validateQuoteStatusHistoryChange(null,after,['kitchen']));
 const added=structuredClone(after);added.offers.push({...other,id:'injected'});assert.throws(()=>validateQuoteStatusHistoryChange(before,added,['kitchen']));
 assert.equal(before.offers[0].totals.grand,13.125);
});
