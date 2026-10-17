// Explicit tool/worker fixture only. Never loaded by the application.
(function(root){
 'use strict';
 const files=['shared/constants','shared/storage','shared/schema','room-preferences/room-preferences-model','investor/investors-model','investor/investors-local-repository','investor/investors-store','project/project-model','project/project-store','project/project-bridge','investor/session','cabinet/part-provenance','material/material-common','cabinet/front-hardware-fronts','cabinet/cabinet-cutlist','material/material-edge-store','project/project-pcv-overrides','project/project-domain-operations','project/project-export-contract','project/project-selective-export'];
 const scope=Object.freeze({investorId:'cloud4-investor-v1',projectId:'cloud4-project-v1'});
 const epoch=1792195200000; // Synthetic fixture timestamp, not the server operation time.
 class FixedDate extends Date{constructor(...a){super(...(a.length?a:[epoch]));}static now(){return epoch;}}
 class MemoryStorage{
  constructor(){this.rows=new Map();this.sealed=false;this.writes=0;}
  getItem(k){return this.rows.get(String(k))??null;}
  setItem(k,v){if(this.sealed)throw Error('CLOUD4_SOURCE_READ_ONLY');this.writes++;this.rows.set(String(k),String(v));}
  removeItem(k){if(this.sealed)throw Error('CLOUD4_SOURCE_READ_ONLY');this.writes++;this.rows.delete(String(k));}
  get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
  clear(){throw Error('CLOUD4_RESET_FORBIDDEN');}
 }
 function create(FC,local,session,realm){
  const clone=v=>JSON.parse(JSON.stringify(v)),check=v=>{if(!v)throw Error('CLOUD4_SOURCE_SETUP_FAILED');};
  const investor=FC.investorsModel.normalizeInvestor({id:scope.investorId,name:'Fikcyjny inwestor CLOUD-4',createdAt:1000,updatedAt:2000,meta:{testData:true}});
  check(FC.investorsLocalRepository.writeAll([investor]));
  const data=clone(FC.schema.DEFAULT_PROJECT),keys=Object.keys(data).filter(k=>k!=='schemaVersion');
  data.meta={assignedInvestorId:scope.investorId,productionPcvMode:'project',roomOrder:keys,roomDefs:Object.fromEntries(keys.map(k=>[k,{id:k,baseType:k,name:k,label:k,legacy:true}]))};
  const cabinet=id=>({id,type:'stojąca',subType:'standardowa',width:60,height:82,depth:51,frontCount:2,bodyColor:'laminat TEST',frontMaterial:'laminat',frontColor:'TEST',backMaterial:'HDF',bodyPcvMode:'body',details:{shelves:3}});
  data.kuchnia.cabinets=[cabinet('one'),cabinet('two')];data.pokoj.cabinets=[cabinet('one')];
  const room=data.kuchnia;room.cabinets[0].subType='szuflady';room.cabinets[0].details={drawerLayout:'3_1_2_2',drawerSystem:'skrzynkowe'};
  room.cabinets[1].setId='set-A';room.cabinets[1].details.shelves=5;
  room.sets=[{id:'set-A',presetId:'A',frontCount:2,params:{w1:30,w2:30,hB:72,hTop:20}}];
  const edges={w1:true,w2:false,h1:true,h2:false};
  room.production={cabinetGroupOverrides:{one:{'front.drawer.small':{edges},'front.drawer.large':{edges},'drawer.front_drawers.sides':{edges}},two:{'body.shelves':{edges}}},setGroupOverrides:{'set-A':{'front.A.left':{edges}}}};
  check(FC.projectStore.upsert({id:scope.projectId,investorId:scope.investorId,title:'Fikcyjny projekt CLOUD-4',status:'nowy',createdAt:1000,updatedAt:2000,meta:{testData:true},projectData:data}));
  FC.projectStore.setCurrentProjectId(scope.projectId);local.setItem('fc_current_investor_v1',scope.investorId);
  realm.uiState={roomType:'kuchnia',currentInvestorId:scope.investorId};realm.projectData=FC.project.load();realm.materials=[{name:'laminat TEST',materialType:'laminat'}];
  for(const [cabinetId,partRoleId,selected]of [['one','body.side.left',{w1:true,w2:true,h1:false,h2:true}],['one','body.side.right',{w1:false,w2:false,h1:false,h2:true}],['two','body.side.left',{w1:true,w2:false,h1:false,h2:false}]]){
   const result=FC.projectPcvOverrides.setEdges({projectId:scope.projectId,roomId:'kuchnia',cabinetId,partRoleId},selected);if(result.ok!==true)throw Error(result.code||'CLOUD4_SOURCE_SETUP_FAILED');
  }
  check(FC.session.commit()===true);check(FC.session.inspectExportState().ok===true);
  // Only this isolated synthetic store is sealed; never an application Storage.
  const before=JSON.stringify([...local.rows]),sessionBefore=JSON.stringify([...session.rows]),ram=JSON.stringify(realm.projectData);
  local.sealed=true;session.sealed=true;
  return {async build(options){
   if(JSON.stringify(options)!==JSON.stringify({...scope,purpose:'pilot'}))return {ok:false,code:'CLOUD4_SCOPE_INVALID',path:'scope'};
   const result=await FC.projectSelectiveExport.build(options);
   if(JSON.stringify([...local.rows])!==before||JSON.stringify([...session.rows])!==sessionBefore||JSON.stringify(realm.projectData)!==ram)throw Error('CLOUD4_SOURCE_CHANGED');return result;
  }};
 }
 const api={files,scope,FixedDate,MemoryStorage,create};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CLOUD4SyntheticSource=api;
})(globalThis);
