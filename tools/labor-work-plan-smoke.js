'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./wycena-labor-norms-smoke');
const clone=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const tests=[],test=(name,fn)=>tests.push([name,fn]);
function setup(){
 const r=fixture();r.load('js/app/pricing/labor-work-plan.js');
 const catalog=r.rates().filter(d=>r.FC.laborCatalog.isHourlyRateDefinition(d)||d.id==='labor_daily_break');
 const definition=(id,options={})=>{const d={id,name:id,category:'Synthetic',price:0,rateType:'workshop',billingScope:'quote',dailyStages:'both',pricingMode:'timeStartStep',quantityMode:'startStep',startHours:5/60,startQty:0,stepEveryQty:1,stepHours:1/60,active:true,quantitySource:'shelf.count',...options};catalog.push(d);return d;};
 const item=(d,room,qty)=>{const calc=r.FC.laborCatalog.calculateDefinition(d,{quantity:qty,hourlyRates:{workshop:150,assembly:250}});return {roomId:room,key:d.id+room,details:[{laborDefinitionId:d.id,name:d.name,quantity:qty,hours:calc.pricedHours,total:calc.total,rateType:d.rateType,sourceKind:'automatic',matchedConditions:[]}]};};
 const collections=()=>({labor:[],carrying:[],project:[],agdServices:[],quoteRates:[]});
 const run=(c,rooms=['A','B'],extra={})=>r.FC.laborWorkPlan.build({selectedRooms:rooms,collections:c,catalog,transport:{durationMin:30,transport:{durationMin:30},isStale:false},...extra});
 return {...r,catalog,definition,item,collections,run};
}
test('quote sums quantities before one preparation; room scope prepares separately; selected rooms dedupe',()=>{
 const r=setup(),d=r.definition('q'),c=r.collections();c.labor=[r.item(d,'A',2),r.item(d,'B',3)];
 let p=r.run(c,['B','A','A']);assert.equal(c.labor.length,0);assert.equal(p.scoped.length,2);const q=p.scoped.find(x=>x.id==='q');near(q.hours*60,10);assert.equal(q.quantity,5);
 d.billingScope='room';const c2=r.collections();c2.labor=[r.item(d,'A',2),r.item(d,'B',3)];p=r.run(c2);assert.equal(p.scoped.length,3);near(p.scoped.filter(x=>x.id==='q').reduce((s,x)=>s+x.hours*60,0),15);
});
test('actual cabinet condition evaluation occurs BEFORE aggregation, retains source facts and scope',()=>{
 const r=setup();r.project.other=clone(r.project.kuchnia);r.project.other.cabinets[0].id='other';r.project.other.cabinets[0].width=90;
 Object.assign(r.rates().find(d=>d.id==='labor_shelves_place'),{billingScope:'quote',conditions:[{source:'cabinet.width_mm',operator:'range',min:0,max:800}]});
 const rows=r.FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia','other']);
 const leaves=rows.flatMap(row=>row.details).filter(d=>d.laborDefinitionId==='labor_shelves_place');assert.equal(leaves.length,1);
 const c=r.collections();c.labor=rows;const p=r.FC.laborWorkPlan.build({selectedRooms:['kuchnia','other'],collections:c,catalog:r.rates(),transport:{durationMin:30,transport:{durationMin:30}}});
 const row=p.scoped.find(d=>d.id==='labor_shelves_place');assert.equal(row.quantity,2);near(row.hours*60,7);assert.deepEqual(clone(row.contributingRooms),['kuchnia']);
});
test('fixed no-source rule once per quote or per selected room including an empty room',()=>{
 const r=setup();r.definition('fixed',{quantitySource:'',pricingMode:'fixed',price:100});let c=r.collections(),p=r.run(c);assert.equal(p.scoped.find(x=>x.id==='fixed').total,100);
 r.catalog.find(d=>d.id==='fixed').billingScope='room';p=r.run(r.collections());assert.equal(p.scoped.filter(x=>x.id==='fixed').length,2);
});
test('standard rows keep prices, quantities, fields and per-cabinet preparations',()=>{
 const r=setup(),d=r.definition('standard',{billingScope:'standard'}),c=r.collections();c.labor=[r.item(d,'A',2),r.item(d,'B',3)];const before=clone(c.labor);r.run(c);assert.deepEqual(c.labor.map(x=>x.details),before.map(x=>x.details));near(c.labor.reduce((s,x)=>s+x.hours,0)*60,15);
});
test('generic break is paid with CURRENT workshop rate on BOTH sequential stages; aggregate rooms before ceiling',()=>{
 const r=setup(),c=r.collections();r.catalog.find(d=>d.id==='labor_rate_workshop').price=180;
 c.labor=[{roomId:'A',hours:3,total:750,rateType:'assembly'},{roomId:'B',hours:3,total:750,rateType:'assembly'},{roomId:'A',hours:8,total:1440,rateType:'workshop'}];
 const p=r.run(c);assert.equal(p.schedule.assembly.days,1);assert.equal(p.schedule.workshop.days,2);assert.equal(p.schedule.trips,1);
 const breaks=c.quoteRates.filter(x=>x.id==='labor_daily_break');assert.equal(breaks.length,2);near(breaks.reduce((s,x)=>s+x.total,0),270);assert.equal(p.schedule.assembly.availableMinutes,390);assert.equal(p.schedule.workshop.availableMinutes,450);
});
test('adding a NEW daily rule changes capacity and costs without changing algorithm; daily hours never re-enter numerator',()=>{
 const r=setup();r.definition('daily',{billingScope:'day',dailyStages:'assembly',quantitySource:'',pricingMode:'time',timeBlockHours:1,rateType:'workshop'});
 const c=r.collections();c.labor=[{hours:6,total:1500,rateType:'assembly'}];const p=r.run(c);assert.equal(p.schedule.assembly.days,2);near(p.schedule.assembly.minutes,360);assert.equal(p.schedule.assembly.availableMinutes,330);near(c.quoteRates.filter(x=>x.id==='daily').reduce((s,x)=>s+x.total,0),300);
});
test('zero non-daily time produces NO days, trips, breaks, daily events; helper alone cannot create a workday',()=>{
 const r=setup(),c=r.collections();const p=r.run(c,['A'],{helperHours:2});assert.equal(p.schedule.workshop.days,0);assert.equal(p.schedule.assembly.days,0);assert.equal(p.schedule.trips,0);assert.equal(c.quoteRates.length,1);assert.equal(c.quoteRates[0].sourceRole,'additional-helper');near(c.quoteRates[0].total,160);
});
test('third helper adds manual cost only, does not change crew durations or use two-person multiplier',()=>{
 const r=setup(),a=r.collections(),b=r.collections();a.labor=b.labor=[{hours:5,total:1250,rateType:'assembly'}];const x=r.run(a),y=r.run(b,['A','B'],{helperHours:3.125});assert.deepEqual(clone(x.schedule.assembly),clone(y.schedule.assembly));near(b.quoteRates.find(x=>x.sourceRole==='additional-helper').total,250);
});
test('nonpositive capacity blocks; exact boundaries; high precision does not add an extra day',()=>{
 const r=setup();assert.equal(r.FC.laborWorkPlan.solve(450,30,0).days,1);assert.equal(r.FC.laborWorkPlan.solve(450.01,30,0).days,2);
 assert.throws(()=>r.FC.laborWorkPlan.solve(1,480,0),{code:'SCHEDULE_NONPOSITIVE_CAPACITY'});
 assert.throws(()=>r.FC.laborWorkPlan.solve(1,30,450),{code:'SCHEDULE_NONPOSITIVE_CAPACITY'});
});
test('day-dependent source refuses before evaluation can feed its own denominator',()=>{
 const r=setup(),d=r.definition('cycle',{billingScope:'day',quantitySource:'schedule.days'}),c=r.collections();c.labor=[r.item(d,'A',1)];assert.throws(()=>r.run(c),{code:'SCHEDULE_CIRCULAR_SOURCE'});
});
test('an explicit daily commute-time rule cannot duplicate the physical round trip in the denominator',()=>{
 const r=setup(),d=r.definition('duplicate-travel',{billingScope:'day',quantitySource:'transport.duration_hours'}),c=r.collections();c.quoteRates=[{laborDefinitionId:d.id,quantity:1,hours:1,total:150,rateType:'workshop'}];assert.throws(()=>r.run(c),{code:'SCHEDULE_TRAVEL_SCOPE_CONFLICT'});
});
test('per-trip cost keeps start/included-km pricing; round trip time multiplied exactly once for ALL days',()=>{
 const r=setup(),c=r.collections();c.labor=[{hours:13,total:3250,rateType:'assembly'}];c.quoteRates=[{sourceType:'transport',sourceRole:'transport-distance',qty:20,total:140,hours:0,startPrice:100,includedQty:10},{sourceType:'transport',sourceRole:'transport-travel-time',qty:0.5,total:125,hours:0.5,baseHours:0.5}];
 const p=r.run(c);assert.equal(p.schedule.trips,2);assert.equal(c.quoteRates[0].total,280);assert.equal(c.quoteRates[1].total,500);assert.equal(c.quoteRates[1].hours,2);assert.equal(p.schedule.assembly.days,2);
});
test('unknown/stale route marks incomplete assembly, never silently assumes zero commute',()=>{
 const r=setup(),c=r.collections();c.labor=[{hours:1,total:250,rateType:'assembly'}];const p=r.run(c,['A'],{transport:{durationMin:30,isStale:true,transport:{durationMin:30}}});assert.equal(p.schedule.status,'BLOCKED');assert.equal(p.schedule.assembly,null);assert.equal(p.schedule.trips,0);assert.ok(c.quoteRates.some(x=>x.sourceKind==='automatic-blocked'));
});
test('manual/automatic suppression stays suppressed; no creation from blocked automatic candidates',()=>{
 const r=setup(),d=r.definition('suppressed'),c=r.collections();c.labor=[r.item(d,'A',2)];c.labor[0].details[0].sourceKind='automatic-suppressed';const p=r.run(c);assert.equal(p.scoped.some(x=>x.id===d.id),false);
});
test('actual carrying uses the two-person assembly rate, NEVER helper rate/person-hours',()=>{
 const r=setup();r.load('js/app/pricing/carrying-logistics.js');r.FC.investorPersistence={getCurrentInvestorId:()=> 'synthetic',getInvestorById:()=>({carrying:{floorNumber:3,elevatorStatus:'no'}})};const c=r.FC.wycenaCoreLabor.collectCarryingLines(['kuchnia']);const rows=c.flatMap(r=>r.details);assert.ok(rows.length);for(const row of rows){assert.equal(row.rateType,'assembly');near(row.hourlyRate,250);near(row.total,row.hours*250);}
});
test('scope and day metadata survive closed 14-domain validation and cannot accept an unknown scope',()=>{
 const {model,context}=require('./helpers/code-global-catalogs').buildCodeCatalogs();assert.equal(model.labor.length,121);context.FC.globalDataContract.validateBundle(model);const bad=clone(model);bad.labor[0].billingScope='guess';assert.throws(()=>context.FC.globalDataContract.validateBundle(bad),e=>e.code==='GLOBAL_VALUE_INVALID');
});
test('snapshot normalizers preserve frozen schedule, provenance and third-person cost; old offers gain NO schedule',()=>{
 const r=setup(),c=r.collections();c.labor=[{hours:6,total:1500,rateType:'assembly'}];const plan=r.run(c,['A'],{helperHours:2.5});
 r.load('js/app/quote/quote-snapshot.js');r.load('js/app/quote/quote-snapshot-scope.js');r.load('js/app/quote/quote-snapshot-selection.js');r.load('js/app/quote/quote-snapshot-store.js');
 const original={id:'frozen',selectedRooms:['A'],investor:{id:'inv'},project:{id:'project'},schedule:clone(plan.schedule),quoteRateLines:c.quoteRates};
 const built=r.FC.quoteSnapshot.buildSnapshot(original),stored=r.FC.quoteSnapshotStore.normalizeSnapshot({...built,id:'frozen'});
 assert.deepEqual(clone(stored.schedule),clone(plan.schedule));assert.equal(stored.lines.quoteRates.find(x=>x.laborDefinitionId==='labor_daily_break').billingScope,'day');
 assert.equal(stored.lines.quoteRates.find(x=>x.sourceRole==='additional-helper').helperHours,2.5);
 r.catalog.find(d=>d.id==='labor_rate_workshop').price=999;
 assert.deepEqual(clone(r.FC.quoteSnapshotStore.normalizeSnapshot(stored).schedule),clone(plan.schedule));
 const historical=clone(built);delete historical.schedule;assert.equal(Object.hasOwn(r.FC.quoteSnapshotStore.normalizeSnapshot(historical),'schedule'),false);
});
test('business project export, integrity pack and application projection preserve schedule without network or original writes',async()=>{
 const r=require('./project-selective-export-smoke').fixture();
 for(const file of ['cloud/cloud-pilot-contract','project/business-project-contract'])new Function('window',fs.readFileSync('js/app/'+file+'.js','utf8'))(r.s);
 const built=await r.build(),payload=clone(built.document.payload),g=setup(),c=g.collections();c.labor=[{hours:6,total:1500,rateType:'assembly'}];const schedule=g.run(c,['kuchnia'],{helperHours:2}).schedule;
 payload.offers=[{id:'frozen',investor:{id:payload.investor.id},project:{id:payload.project.id},schedule:clone(schedule),lines:{quoteRates:clone(c.quoteRates)}}];
 const rows=new Map([['fc_projects_v1',JSON.stringify([payload.project])],['fc_investors_v1',JSON.stringify([payload.investor])],['fc_quote_snapshots_v1',JSON.stringify(payload.offers)]]),source={getItem:k=>rows.get(k)??null},before=[...rows];
 const result=await r.FC.businessProjectContract.build(source,payload.project.id),pack=await r.FC.cloudPilotContract.pack(result,{ownerUid:'synthetic-owner',projectId:payload.project.id,investorId:payload.investor.id},null,'a'.repeat(32));assert.ok(pack.chunks.length);assert.deepEqual(clone(result.document.payload.offers[0].schedule),clone(schedule));assert.deepEqual([...rows],before);
 const {projectApplicationRows}=await import('../sync/application-replication.mjs');const applied=projectApplicationRows(Object.fromEntries(rows),{scope:payload.project.id},{value:{document:result.document}},null,r.FC.businessProjectContract);
 assert.deepEqual(JSON.parse(applied.fc_quote_snapshots_v1)[0].schedule,clone(schedule));
});
test('WYCENA orchestration uses one shared plan BEFORE register/totals and exposes the identical frozen schedule',async()=>{
 const r=setup(),f=r.FC,selection={selectedRooms:['kuchnia']};
 f.projectPcvGuard={calculationOptions:o=>o};f.wycenaCoreSelection={normalizeQuoteSelection:x=>x,validateQuoteSelection:x=>x,decodeSelectedRooms:x=>x.selectedRooms,validateQuoteContent(){}};
 f.wycenaCoreSource.getSelectedAggregate=()=>({});f.wycenaCoreMaterialPlan={collectMaterialLines:async()=>[]};
 f.wycenaCoreOffer={getOfferDraft:()=>({selection,helperHours:2}),collectQuoteRateLines:()=>[],collectCommercialDraft:()=>({})};
 f.wycenaCoreLines={collectElementLines:()=>[],collectAccessories:()=>[],collectBuiltInAppliances:()=>[]};
 f.investorTransport={getCurrentTransportContext:()=>({durationMin:30,transport:{durationMin:30},isStale:false})};
 r.load('js/app/quote/quote-snapshot.js');r.load('js/app/wycena/wycena-core.js');const result=await f.wycenaCore.collectQuoteData({selection});
 assert.equal(result.schedule.version,1);assert.equal(result.schedule.helperHours,2);assert.equal(result.quoteRateLines.filter(x=>x.sourceRole==='additional-helper').length,1);
 assert.ok(result.quoteRateLines.some(x=>x.laborDefinitionId==='labor_daily_break'));near(result.totals.grand,result.calculationRegister.totals.grand);
 for(const row of result.quoteRateLines)assert.equal(result.calculationRegister.lines.filter(x=>x.id===row.key).length,1);
 delete f.laborWorkPlan;await assert.rejects(f.wycenaCore.collectQuoteData({selection}),/FC.laborWorkPlan/);
});
async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('PASS work-plan '+tests.length+' targeted groups');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main,setup};
