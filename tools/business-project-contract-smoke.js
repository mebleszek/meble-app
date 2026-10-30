'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {fixture}=require('./project-selective-export-smoke');const r=fixture();
 for(const p of ['cloud/cloud-pilot-contract','project/business-project-contract'])new Function('window',fs.readFileSync('js/app/'+p+'.js','utf8'))(r.s);
 const c=r.FC.businessProjectContract,doc=await r.build(),payload=structuredClone(doc.document.payload);
 // Real ownership is proven by existing records, never by a synthetic flag.
 if(payload.project.meta)delete payload.project.meta.testData;if(payload.investor.meta)delete payload.investor.meta.testData;payload.offers=[{id:'frozen',project:{id:payload.project.id},investor:{id:payload.investor.id},frozen:{total:21.375,pcv:0.8125}}];
 payload.project.projectData.meta.futureField={precise:7.125};assert.equal(c.validate(payload),true);
 const bad=structuredClone(payload);bad.project.investorId='foreign';assert.throws(()=>c.validate(bad),/LF_BUSINESS_PROJECT_INVALID/);
 const wrongOffer=structuredClone(payload);wrongOffer.offers[0].investor.id='foreign';assert.throws(()=>c.validate(wrongOffer),/LF_BUSINESS_PROJECT_INVALID/);
 const secret=structuredClone(payload);secret.project.projectData.meta.apiKey='synthetic';assert.throws(()=>c.validate(secret),/LF_BUSINESS_PROJECT_INVALID/);
 const cyclic=structuredClone(payload);cyclic.project.loop=cyclic;assert.throws(()=>c.validate(cyclic),/LF_BUSINESS_PROJECT_INVALID/);
 const invalidGeometry=structuredClone(payload);invalidGeometry.project.projectData.kuchnia.cabinets[0].width=-1;assert.throws(()=>c.validate(invalidGeometry),e=>e.code==='LF_PROJECT_SCHEMA_BLOCKED'&&e.reason==='EXPORT_INVALID_GEOMETRY');
 const invalidReference=structuredClone(payload);invalidReference.project.projectData.kuchnia.cabinets[0].setId='foreign-set';assert.throws(()=>c.validate(invalidReference),e=>e.code==='LF_PROJECT_SCHEMA_BLOCKED'&&e.reason==='EXPORT_INVALID_REFERENCE');
 const pending=structuredClone(payload);pending.project.meta={pendingDomainOperation:{kind:'rooms'}};assert.throws(()=>c.validate(pending),/LF_BUSINESS_PROJECT_INVALID/);
 const source=new Map([['fc_projects_v1',JSON.stringify([payload.project])],['fc_investors_v1',JSON.stringify([payload.investor])],['fc_quote_snapshots_v1',JSON.stringify(payload.offers)]]),storage={getItem:k=>source.get(k)??null};
 const before=[...source],built=await c.build(storage,payload.project.id);assert.equal(built.document.profile,'business-project-v1');assert.deepEqual(built.document.payload,payload);
 const packed=await r.FC.cloudPilotContract.pack(built,{ownerUid:'owner',projectId:payload.project.id,investorId:payload.investor.id},null,'a'.repeat(32));assert.ok(packed.chunks.length);assert.deepEqual([...source],before);
 source.set('fc_rozrys_grain_state_v1','{"ambiguous":true}');await assert.rejects(c.build(storage,payload.project.id),/LF_PROJECT_OWNERSHIP_PENDING/);assert.equal(source.get('fc_rozrys_grain_state_v1'),'{"ambiguous":true}');
 const {projectApplicationRows}=await import('../sync/application-replication.mjs');
 const contract={validateBundle(){},sources:{stock:['fc_sheets_v1'],company:['fc_company_profile_v1']}};
 const rows={fc_company_profile_v1:JSON.stringify({transport:{apiKey:'local-only-synthetic'}}),fc_rozrys_grain_state_v1:'EXACT',fc_projects_v1:'[]',fc_investors_v1:'[]'};
 const next=projectApplicationRows(rows,{scope:'globals'},{value:{stock:[{id:'stock',qty:17}],company:{transport:{}}}},contract,c);
 assert.equal(JSON.parse(next.fc_company_profile_v1).transport.apiKey,'local-only-synthetic');assert.equal(next.fc_rozrys_grain_state_v1,'EXACT');assert.equal(JSON.parse(next.fc_sheets_v1).sheets[0].qty,17);
 contract.sources.stock.push('legacyStock');const conflict={...rows,fc_sheets_v1:'{\"sheets\":[]}',legacyStock:'{\"sheets\":[{\"id\":\"old\"}]}'};const saved=structuredClone(conflict);assert.throws(()=>projectApplicationRows(conflict,{scope:'globals'},{value:{stock:[]}},contract,c),/LF_GLOBAL_ALIAS_CONFLICT/);assert.deepEqual(conflict,saved);
 console.log('PASS business project ownership, complete raw owned fields/frozen offers, hashes, ambiguous RAW refusal and local-only company credential preservation');
})().catch(e=>{console.error(e);process.exitCode=1;});
