'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./project-selective-export-smoke');
const clone=x=>JSON.parse(JSON.stringify(x));
const r=fixture();for(const f of ['cabinet/front-material-source','cloud/cloud-pilot-contract','project/business-project-contract'])new Function('window',fs.readFileSync('js/app/'+f+'.js','utf8'))(r.s);
let sequence=0;r.FC.utils.uid=()=> 'generated-'+(++sequence);const c=r.FC.businessProjectContract,fronts=r.FC.cabinetFronts;
(async()=>{
 const {projectApplicationRows}=await import('../sync/application-replication.mjs');
 let n=0;
 for(const type of ['stojąca','wisząca','moduł'])for(const opt of fronts.getSubTypeOptionsForType(type)){
  const project=r.row();for(const value of Object.values(project.projectData))if(value&&Array.isArray(value.cabinets)){value.cabinets=[];value.fronts=[];value.sets=[];delete value.production;delete value.layout;}const room=project.projectData.kuchnia;room.cabinets=[];room.fronts=[];room.sets=[];delete room.production;delete room.layout;
  room.settings={...room.settings,legHeight:10,bottomHeight:82};
  const cab={id:'native',type,subType:opt.v,width:90,height:type==='stojąca'?100:80,depth:60,frontCount:2,bodyColor:'laminat',frontMaterial:'laminat',frontColor:'',backMaterial:'HDF',details:{shelves:2,ovenHeight:60,gl:100,gp:60,st:100,sp:60,blindPart:20,fridgeOption:'zabudowa',fridgeFrontCount:'2',drawerSystem:'skrzynkowe',drawerLayout:'3_1_2_2',podFrontMode:'drzwi'}};
  if(opt.v==='lodowkowa')cab.height=210;
  room.cabinets.push(cab);r.s.projectData=project.projectData;fronts.generateFrontsForCabinet('kuchnia',cab);
  const before=clone(room);const payload={project,investor:r.FC.investors.readAll().find(i=>i.id===project.investorId),offers:[]};
  assert.equal(c.validate(payload,{local:true}),true,type+'/'+opt.v);assert.deepEqual(clone(room),before,'Validation must not mutate IDs/fronts/model');
  const bad=clone(payload);bad.project.projectData.kuchnia.cabinets[0].width=-1;assert.throws(()=>c.validate(bad,{local:true}));
  if(room.fronts.length){const badFront=clone(payload);badFront.project.projectData.kuchnia.fronts[0].height+=7;assert.throws(()=>c.validate(badFront,{local:true}),/LF_PROJECT_SCHEMA_BLOCKED/);}
  if(!['standardowa','szuflady'].includes(opt.v))assert.throws(()=>c.validate(payload),e=>e.code==='LF_PROJECT_SCHEMA_BLOCKED'&&e.reason==='EXPORT_UNSUPPORTED_STRUCTURE');
  if(opt.v==='piekarnikowa'){
   const rows={fc_projects_v1:JSON.stringify([project]),fc_investors_v1:JSON.stringify([payload.investor]),fc_quote_snapshots_v1:'[]'};
   await assert.rejects(c.build({getItem:k=>rows[k]??null},project.id),e=>e.reason==='EXPORT_UNSUPPORTED_STRUCTURE');
   assert.throws(()=>projectApplicationRows(rows,{scope:project.id},{value:{document:{payload}}},{},c),e=>e.reason==='EXPORT_UNSUPPORTED_STRUCTURE');
  }
  for(const change of [
   room=>room.production=[],room=>room.production={partOverrides:{native:2}},
   room=>room.cabinets[0].id='',room=>room.cabinets.push(clone(room.cabinets[0])),
   room=>room.cabinets[0].setId='missing-set',
   room=>{if(room.fronts[0])room.fronts[0].cabId='missing-cab';else room.fronts.push({id:'bad',cabId:'missing-cab',width:2,height:2});},
   room=>room.production={partOverrides:{missing:{'body.side.left':{edges:{w1:true,w2:false,h1:false,h2:false}}}}},
   room=>room.production={partOverrides:{native:{'invented.role':{edges:{w1:true,w2:false,h1:false,h2:false}}}}}
  ]){const bad=clone(payload);change(bad.project.projectData.kuchnia);assert.throws(()=>c.validate(bad,{local:true}));}
  const generated=[...r.FC.cabinetCutlist.getCabinetCutList(clone(cab),room),...r.FC.frontHardware.getCabinetFrontPartsForLocalDraft(room,clone(cab))];
  const edges={w1:true,w2:false,h1:false,h2:true};room.production={partOverrides:{native:{}},cabinetGroupOverrides:{native:{}}};
  for(const part of generated){for(const role of part.partRoleIds||[])room.production.partOverrides.native[role]={edges:clone(edges)};for(const role of part.sourceGroupRoles||[])if(role.ownerType==='cabinet')room.production.cabinetGroupOverrides.native[role.groupRoleId]={edges:clone(edges)};}
  assert.equal(c.validate(payload,{local:true}),true,'All generated body/front/drawer PCV roles');
  const withEdges=clone(room);assert.equal(c.validate(payload,{local:true}),true);assert.deepEqual(clone(room),withEdges);
  const malformed=clone(payload);malformed.project.projectData.kuchnia.production.partOverrides.native['body.side.left']={edges:{w1:'yes',w2:false,h1:false,h2:true}};assert.throws(()=>c.validate(malformed,{local:true}));
  room.layout={segments:[{id:'wall-1',rows:{base:[{kind:'cabinet',id:cab.id}]}},{id:'wall-2',rows:{base:[]}}],activeSegmentId:'wall-2'};
  room.futurePlacement={cabinetId:cab.id,x:23,y:0};const retained=clone(room);assert.equal(c.validate(payload,{local:true}),true);assert.deepEqual(clone(room),retained);
  const broken=clone(payload);broken.project.projectData.kuchnia.layout.segments[0].rows.base[0].id='missing';assert.throws(()=>c.validate(broken,{local:true}));
  // Empty override entries and unrelated native metadata are retained by the PCV API.
  const empty=clone(payload);empty.project.projectData.kuchnia.production.partOverrides.native[Object.keys(room.production.partOverrides.native)[0]]={};assert.equal(c.validate(empty,{local:true}),true);
  delete room.production;delete room.layout;delete room.futurePlacement;
  const modes=opt.v==='lodowkowa'?[{fridgeFrontCount:'1'},{fridgeOption:'wolnostojaca'}]:opt.v==='dolna_podblatowa'?[{podFrontMode:'brak'},{podFrontMode:'szuflady'}]:opt.v==='uchylne'?[{flapVendor:'blum',flapKind:'HF_top'}]:[];
  for(const mode of modes){cab.details={...cab.details,...mode};fronts.generateFrontsForCabinet('kuchnia',cab);assert.equal(c.validate(payload,{local:true}),true,'Native special front mode '+JSON.stringify(mode));if(mode.flapKind==='HF_top')assert.equal(room.fronts.length,2);}
  console.log('PASS local/native '+type+'/'+opt.v);n++;
 }
 for(const presetId of ['A','C','D'])for(const frontCount of [1,2]){
  const project=r.row();for(const value of Object.values(project.projectData))if(value&&Array.isArray(value.cabinets)){value.cabinets=[];value.fronts=[];value.sets=[];delete value.production;delete value.layout;}
  const room=project.projectData.kuchnia,set={id:'set-native',presetId,number:1,frontCount,frontMaterial:'laminat',frontColor:'',params:{presetId,hB:82,hTop:50,...(presetId==='A'?{w1:60,w2:60}:{w:60}),...(presetId==='D'?{hM:70}:{})}};
  room.sets=[set];room.cabinets=[{id:'member',setId:set.id,setPreset:presetId,setNumber:1,type:'stojąca',subType:'standardowa',width:60,height:82,depth:51,frontCount:2,details:{}}];
  room.fronts=clone(r.FC.frontHardware.deriveSetFrontsFromRecord(room,set.id)).map((f,i)=>({...f,id:'set-front-'+i}));
  room.production={setGroupOverrides:{[set.id]:Object.fromEntries(room.fronts.map(f=>[f.groupRoleId,{edges:{w1:true,w2:false,h1:false,h2:true}}]))}};
  const payload={project,investor:r.FC.investors.readAll().find(i=>i.id===project.investorId),offers:[]},before=clone(room);assert.equal(c.validate(payload,{local:true}),true);assert.deepEqual(clone(room),before);
  for(const mutate of [r=>r.sets[0].number=0,r=>r.sets[0].frontCount=3,r=>r.fronts[0].width+=1,r=>r.cabinets[0].setNumber=99,r=>r.sets[0].presetId='future']){const bad=clone(payload);mutate(bad.project.projectData.kuchnia);assert.throws(()=>c.validate(bad,{local:true}));}
 }
 console.log('PASS native sets A/C/D, 1/2 fronts, set PCV and invalid set geometry/relations');
 console.log('local-cabinet-validation: '+n+' creator variants PASS, negative geometry and unchanged pilot refusal');
})().catch(e=>{console.error(e.code,e.reason,e.stack||e);process.exitCode=1;});
