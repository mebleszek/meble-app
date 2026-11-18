import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {quoteScope,validateQuoteLedger,validateQuoteLedgerChange} from '../../sync/local-first-quote-contract.mjs';
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
