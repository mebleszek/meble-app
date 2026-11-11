'use strict';
const assert=require('node:assert/strict');
module.exports=async({getBrowser,tap,fill,until,reopen,baseProbe=false})=>{
 const evaluate=expression=>getBrowser().evaluate(expression);
 const modal='document.getElementById("cabinetModal").style.display';
 const ready='!window.FC.applicationStartup.inspect().transactionPending';
 if(await evaluate('!!document.querySelector(".info-box button")'))await tap('.info-box button');
 await until(ready);
 const variants=await evaluate(`['stojąca','wisząca','moduł'].flatMap((type,index)=>window.FC.cabinetFronts.getSubTypeOptionsForType(type).map(o=>({type,index,variant:o.v})))`);
 const ids=[];
 for(const {type,index,variant} of baseProbe?[variants.find(v=>v.variant==='piekarnikowa')]:variants){
  await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until(modal+'==="flex"');
  await tap('#cabinetTypeChoices .choice-tile:nth-child('+(index+1)+')');await fill('#cmSubType',variant);
  await fill('#cmWidth','90');await fill('#cmHeight',variant==='lodowkowa'?'210':variant==='uchylne'?'40':type==='stojąca'?'100':'80');await fill('#cmDepth','60');
  if(variant==='narozna_l')for(const [field,value]of Object.entries({cmGL:'100',cmGP:'60',cmST:'100',cmSP:'60'}))await fill('#'+field,value);
  const before=await evaluate('projectData[uiState.roomType].cabinets.map(c=>c.id)');await tap('#cabinetModalSave');
  if(baseProbe){await until('!!document.querySelector(".info-box")&&'+ready);assert.equal(await evaluate(modal),'flex');assert.match(await evaluate('document.querySelector(".info-box").textContent'),/Zapis niepotwierdzony/);assert.deepEqual(await evaluate('projectData[uiState.roomType].cabinets.map(c=>c.id)'),before);console.log('BASE_FAIL native oven cabinetModalSave → LOCAL-FIRST refuses save; form retained');return;}
  await until(modal+'==="none"&&'+ready);
  const cab=await evaluate('projectData[uiState.roomType].cabinets.at(-1)');assert.equal(cab.subType,variant);assert.equal(cab.type,type);assert.ok(!before.includes(cab.id));ids.push({id:cab.id,field:variant==='narozna_l'?'cmST':'cmDepth',value:variant==='narozna_l'?101:61});
  await tap('#cab-'+cab.id+' [data-act="edit"]');await until(modal+'==="flex"');await fill(variant==='narozna_l'?'#cmST':'#cmDepth',variant==='narozna_l'?'101':'61');await tap('#cabinetModalSave');await until(modal+'==="none"&&'+ready);
  assert.equal(await evaluate('Number(projectData[uiState.roomType].cabinets.find(c=>c.id==='+JSON.stringify(cab.id)+')'+(variant==='narozna_l'?'.details.st':'.depth')+')'),variant==='narozna_l'?101:61);
  console.log('PASS native modal add/edit/save '+type+'/'+variant);
 }
 for(const preset of ['A','C','D']){
  await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until(modal+'==="flex"');await tap('#cabinetTypeChoices .choice-tile:nth-child(4)');await tap('#setTiles [data-preset="'+preset+'"]');
  await tap('#cabinetModalSave');await until(modal+'==="none"&&'+ready);console.log('PASS native set '+preset);
 }
 const pcv=await evaluate(`window.FC.applicationWrite.project(()=>{const a={projectId:window.FC.projectStore.getCurrentProjectId(),roomId:uiState.roomType,cabinetId:projectData[uiState.roomType].cabinets[0].id,partRoleId:'body.side.left'};const previous=window.FC.projectPcvOverrides.get(a);if(!previous.ok)throw Error(JSON.stringify(previous));const result=window.FC.projectPcvOverrides.setEdges(a,{w2:!previous.edges.w2});if(!result.ok)throw Error(JSON.stringify(result));return result;})`);assert.equal(pcv.ok,true);assert.equal(pcv.changed,true);
 console.log('PASS actual project-owned PCV mutation through LOCAL-FIRST');
 await tap('#sessionSave');await until('!window.FC.session.active&&'+ready);
 const saved=await evaluate('window.FC.projectStore.readAll()[0].projectData');
 const proof=await evaluate('localProof()');assert.deepEqual(proof.tables.outbox,[]);assert.deepEqual(proof.tables.replicas,[]);
 await reopen();assert.deepEqual(await evaluate('window.FC.projectStore.readAll()[0].projectData'),saved,'Cold offline restart must retain complete native geometry, IDs, sets, PCV and metadata');
 await tap('[data-action="open-room"][data-room^="room_"]');await until('window.FC.session.active&&window.FC.session.durable&&'+ready);
 for(const {id,field,value} of ids){await tap('#cab-'+id+' [data-act="edit"]');await until(modal+'==="flex"');assert.equal(await evaluate('Number(document.getElementById('+JSON.stringify(field)+').value)'),value);await tap('#cabinetModalCancel');await until(modal+'==="none"');}
 console.log('PASS all 17 variants reopen after cold offline Chromium restart; native room exact, IDs and set relations preserved');
};
