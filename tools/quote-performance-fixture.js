'use strict';
function rows(size=9,multi=false){
 const r=require('./project-pcv-ui-activation-smoke').fixture(),rows=r.rows();
 const records=JSON.parse(rows.fc_projects_v1);
 for(const record of records){
  record.__test=true;record.__testRunId='project-context-browser';
  const data=record.projectData;data.room_test_A=data.room;delete data.room;
  if(data.other){data.room_test_B=data.other;delete data.other;}
  const ids=Object.keys(data).filter(k=>k.startsWith('room_test_'));
  data.meta.productionPcvMode='project';data.meta.roomOrder=ids;
  data.meta.roomDefs=Object.fromEntries(ids.map(id=>[id,{id,baseType:'kuchnia',name:id,label:id}]));
 }
 const active=records.find(r=>r.id==='A'),stale=records.find(r=>r.id==='B');
 const clone=x=>JSON.parse(JSON.stringify(x));
 const room=active.projectData.room_test_A,template=clone(room.cabinets[0]);
 room.cabinets=Array.from({length:size},(_,i)=>({...clone(template),id:'synth_cab_'+i}));room.fronts=[];if(size>=3)room.cabinets.forEach((c,i)=>{if(i%2)c.frontColor='Oak';});
 for(const [key,count] of (multi?[['room_test_B',1],['room_test_C',1]]:[])){active.projectData[key]=clone(room);active.projectData[key].cabinets=Array.from({length:count},(_,i)=>({...clone(template),id:key+'_cab_'+i}));active.projectData[key].fronts=[];}
 active.projectData.meta.roomOrder=multi?['room_test_A','room_test_B','room_test_C']:['room_test_A']; if(!multi)delete active.projectData.room_test_B;
 active.projectData.meta.roomDefs=Object.fromEntries(active.projectData.meta.roomOrder.map(id=>[id,{id,baseType:'kuchnia',name:id,label:id}]));
 const staleRoom=clone(room);staleRoom.cabinets=Array.from({length:10},(_,i)=>({...clone(template),id:'stale_cab_'+i}));
 stale.projectData.room_stale=staleRoom;delete stale.projectData.room_test_A;
 stale.projectData.meta.roomOrder=['room_stale'];stale.projectData.meta.roomDefs={room_stale:{id:'room_stale',baseType:'kuchnia',name:'Stale',label:'Stale'}};
 rows.fc_project_v1=JSON.stringify(stale.projectData);
 rows.fc_projects_v1=JSON.stringify(records);
 rows.fc_investors_v1=JSON.stringify(records.map(record=>({id:record.investorId,name:'Syntetyczny '+record.id,__test:true,__testRunId:'project-context-browser',rooms:record.projectData.meta.roomOrder.map(id=>({id,baseType:'kuchnia',name:id,label:id}))})));
 r.s.materials.push({name:'laminat Oak',materialType:'laminat',price:135,priceUnit:'sheet'});
 rows.fc_materials_v1=JSON.stringify(r.s.materials.map(m=>({...m,priceUnit:m.materialType==='laminat'?'sheet':m.priceUnit})));
 rows.fc_ui_v1=JSON.stringify({...r.s.uiState,roomType:'room_test_A',entry:'app',activeTab:'wywiad'});
 return rows;
}
module.exports={rows};
