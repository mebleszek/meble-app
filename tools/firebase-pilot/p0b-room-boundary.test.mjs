import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {compareRoomRevisions} from '../../sync/local-first-room-conflict.mjs';
const require=createRequire(import.meta.url),{ready}=require('../investor-list-delete-smoke.js'),{loadSmokeFiles}=require('../app-dev-smoke.js');
test('P0-B room boundary: only independently changed heads with local work need a choice',()=>{
 const projectId='kitchen',head=(generation,marker)=>({projectId,generation,currentRevisionId:marker.repeat(32)});
 const base=head(1,'a'),same=structuredClone(base),own=head(2,'b'),newer=head(2,'c'),later=head(3,'d');
 const replica={key:projectId,base,dirty:true},queued={scope:projectId,phase:'queued'};
 const check=(remote,operations=[queued],local=replica)=>compareRoomRevisions({projectId,replica:local,operations,remote}).state;
 assert.equal(check(same),'unchanged');
 assert.equal(check(newer),'conflict');
 assert.equal(check(newer,[],{...replica,dirty:false}),'receive');
 for(const phase of ['inflight','uncertain']){
  const pending={...queued,phase,expected:own};
  assert.equal(check(own,[pending]),'awaiting-ack');
  assert.equal(check(same,[pending]),'awaiting-ack');
  assert.equal(check(newer,[pending]),'conflict');
  assert.equal(check(later,[pending]),'awaiting-ack');
 }
 assert.throws(()=>check(head(1,'f')),{code:'LF_STALE_REMOTE'});
 assert.throws(()=>check({...newer,projectId:'wardrobe'}),{code:'LF_ROOM_CONFLICT_WITNESS_REQUIRED'});
 assert.throws(()=>check(newer,[{...queued,scope:'wardrobe'}]),{code:'LF_ROOM_CONFLICT_WITNESS_REQUIRED'});
});
function fixture(){
 const r=ready();loadSmokeFiles(r.s,['js/app/project/project-export-contract.js','js/app/cloud/cloud-pilot-contract.js','js/app/project/room-project-model.js']);
 const create=(id,name)=>r.FC.roomProjectModel.create('K',{id,baseType:'kuchnia',name},r.FC.project.DEFAULT_PROJECT.kuchnia);
 return {...r,create};
}
test('P0-B room boundary: exactly one functional room owns each project and foreign data refuses',()=>{
 const r=fixture(),record=r.create('room-kitchen','Kitchen'),before=JSON.stringify(record);
 assert.equal(r.FC.roomProjectModel.validate(record),true);assert.equal(record.id,'room-kitchen');
 const extra=JSON.parse(before);extra.projectData.meta.roomDefs['room-wardrobe']={id:'room-wardrobe'};
 assert.throws(()=>r.FC.roomProjectModel.validate(extra),{code:'LF_ROOM_PROJECT_SCOPE_REQUIRED'});
 const hidden=JSON.parse(before);hidden.projectData.szafa.settings.roomHeight=999;
 assert.throws(()=>r.FC.roomProjectModel.validate(hidden),{code:'LF_ROOM_PROJECT_FOREIGN_DATA'});
 assert.equal(JSON.stringify(record),before);
});
test('P0-B room boundary: quote input joins detached rooms without creating an apartment project',()=>{
 const r=fixture(),kitchen=r.create('room-kitchen','Kitchen'),wardrobe=r.create('room-wardrobe','Wardrobe');
 const records=[kitchen,wardrobe],before=JSON.stringify(records),model=r.FC.roomProjectModel;
 const input=model.quoteSource('K',['room-kitchen','room-wardrobe'],records);
 assert.equal(Object.hasOwn(input,'id'),false);assert.equal(Object.hasOwn(input,'projectId'),false);
 assert.deepEqual(Array.from(input.projects,row=>row.id),['room-kitchen','room-wardrobe']);
 assert.equal(Object.keys(input.projectData.meta.roomDefs).length,2);
 input.projectData['room-kitchen'].settings.roomHeight=777;
 assert.equal(JSON.stringify(records),before);
 const removed=JSON.parse(JSON.stringify(wardrobe));removed.meta.roomProject.removed=true;
 assert.throws(()=>model.quoteSource('K',['room-wardrobe'],[kitchen,removed]),{code:'LF_QUOTE_ROOM_SCOPE_REQUIRED'});
 assert.throws(()=>model.quoteSource('K',['room-kitchen','foreign-room'],records),{code:'LF_QUOTE_ROOM_SCOPE_REQUIRED'});
 assert.throws(()=>model.quoteSource('K',['room-kitchen','room-kitchen'],records),{code:'LF_QUOTE_ROOM_SCOPE_REQUIRED'});
});
