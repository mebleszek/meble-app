// Read-only session evidence; shared by the app and diagnostic tools.
(function(root){
  'use strict';
function pixelSessionReadonly(w,options){
  'use strict';
  const no=status=>({v:1,status});
  const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const own=(x,k)=>object(x)&&Object.prototype.hasOwnProperty.call(x,k);
  const keys=['fc_edit_session_v1','fc_projects_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_edge_v1','fc_material_part_options_v1'];
  const partKeys=keys.slice(5),snapKeys=[keys[1],...partKeys];
  let gate;
  const authorized=()=>{try{return !!gate&&gate.isValid()===true;}catch(_){return false;}};
  try{
    if(w.location.origin!=='https://mebleszek.github.io'||!['/meble-app/','/meble-app/index.html'].includes(w.location.pathname))return no('WRONG_PAGE');
    const descriptor=Object.getOwnPropertyDescriptor(w,'__FC_MAIN_ACCESS__');
    gate=descriptor&&descriptor.value;
    if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||typeof gate?.isValid!=='function'||!authorized())return no('AUTH_DENIED');
    const s=w.FC?.session;
    const readUi=()=>typeof uiState!=='undefined'?uiState:w.uiState;
    const ui=readUi();
    const codes=['SESSION_QUOTA_EXCEEDED','SESSION_STORAGE_DENIED','SESSION_STORAGE_WRITE_FAILED','SESSION_WRITE_UNCONFIRMED','SESSION_SERIALIZATION_FAILED','SESSION_UNCONFIRMED','PROJECT_WRITE_CONFLICT','SESSION_OWNER_MISMATCH','SESSION_OWNER_MISSING','SESSION_ROOM_MISSING','SESSION_READ_FAILED','SESSION_CLEANUP_FAILED','PROJECT_ROLLBACK_INVALID','PROJECT_ROLLBACK_WRITE_FAILED','PENDING_DOMAIN_OPERATION','UNSCOPED_PART_ROLLBACK_BLOCKED'];
    const refusal=()=>s?.lastError?codes.includes(s.lastError.code)?s.lastError.code:'OTHER':'NONE';
    const runtime=()=>JSON.stringify([s?.active,s?.durable,s?.projectId,s?.roomId,s?.startedAt,s?.context,s?.expectedOwnerKnown,s?.expectedOwnerRaw,s?.snapshot,refusal(),ui?.roomType,ui?.currentInvestorId]);
    const beforeRuntime=runtime(),code=refusal();
    let raw;
    try{raw=keys.map(k=>w.localStorage.getItem(k));}catch(_){return no(authorized()?'STORAGE_UNREADABLE':'AUTH_DENIED');}
    if(raw.reduce((n,x)=>n+(typeof x==='string'?x.length:0),0)>8*1024*1024)return no('DIAGNOSTIC_TOO_LARGE');
    const parse=x=>{try{return JSON.parse(x);}catch(_){return null;}};
    const p=parse(raw[0]),currentUi=parse(raw[4]);
    const schema=Number.isInteger(p?.schemaVersion)&&p.schemaVersion>=1&&p.schemaVersion<=4?p.schemaVersion:p? 'OTHER':null;
    const snapshot=object(p?.snapshot)?p.snapshot:null,context=object(p?.context)?p.context:null;
    const requiredKeys=!!snapshot&&snapKeys.every(k=>own(snapshot,k)&&(snapshot[k]===null||typeof snapshot[k]==='string'));
    const room=typeof p?.roomId==='string'?p.roomId:'';
    const record=(text,id)=>{
      const rows=text===null?[]:parse(text),ids=new Set();
      if(!Array.isArray(rows))return {valid:false,row:null};
      for(const row of rows){
        const key=String(row?.id||'');
        if(!object(row)||!key.trim()||ids.has(key))return {valid:false,row:null};
        ids.add(key);
      }
      return {valid:true,row:rows.find(row=>String(row.id)===id)||null};
    };
    const c=record(raw[1],p?.projectId),b=snapshot&&own(snapshot,keys[1])?record(snapshot[keys[1]],p?.projectId):{valid:false,row:null};
    const scope=row=>{
      if(!row)return null;
      if(!room)return JSON.stringify(row);
      const data=object(row.projectData)?row.projectData:{},defs=data.meta?.roomDefs||{};
      return JSON.stringify({roomPresent:own(data,room),room:own(data,room)?data[room]:null,definitionPresent:own(defs,room),definition:own(defs,room)?defs[room]:null});
    };
    const C=scope(c.row),B=scope(b.row),E=typeof p?.expectedOwnerRaw==='string'?p.expectedOwnerRaw:null;
    const ownerMatch=!!(c.row&&b.row&&context&&String(c.row.investorId||'')===String(context.investorId||'')&&String(b.row.investorId||'')===String(context.investorId||'')&&(!room||(own(c.row.projectData,room)&&own(b.row.projectData,room))));
    const payloadShape=!!(object(p)&&p.schemaVersion===4&&p.active===true&&typeof p.projectId==='string'&&p.projectId.trim()&&typeof p.roomId==='string'&&Number.isFinite(p.startedAt)&&context&&context.projectId===p.projectId&&context.roomId===p.roomId&&typeof context.investorId==='string'&&requiredKeys&&p.expectedOwnerKnown===true&&E!==null&&c.valid&&b.valid);
    const ramMatch=!!(object(s)&&object(p)&&s.active===p.active&&s.projectId===p.projectId&&s.roomId===p.roomId&&s.startedAt===p.startedAt&&s.expectedOwnerKnown===p.expectedOwnerKnown&&s.expectedOwnerRaw===p.expectedOwnerRaw&&s.context?.investorId===context?.investorId&&s.context?.projectId===context?.projectId&&s.context?.roomId===context?.roomId&&requiredKeys&&snapKeys.every(k=>own(s.snapshot,k)&&s.snapshot[k]===snapshot[k]));
    const report={v:1,status:'READ_ONLY',storage:'READABLE',present:raw[0]!==null,schema,active:p?.active===true,ram:object(s),durable:s?.durable===true,requiredKeys,payloadShape,ownerMatch,uiRam:object(ui),uiStoredMatch:!!(object(ui)&&object(currentUi)&&ui.roomType===currentUi.roomType&&ui.currentInvestorId===currentUi.currentInvestorId),contextMatch:!!(context&&raw[2]===p.projectId&&raw[3]===context.investorId&&(!room||ui?.roomType===room)),ramMatch,expectedKnown:p?.expectedOwnerKnown===true,CB:C!==null&&B!==null?C===B:null,CE:C!==null&&E!==null?C===E:null,partsMatch:requiredKeys?partKeys.every((k,i)=>raw[i+5]===snapshot[k]):null,pending:!!c.row?.meta?.pendingDomainOperation,code};
    if(options?.storageUsage===true){
      // Text footprint only: no quota probe, capacity assertion, record names or IDs.
      const storage=w.localStorage, groups=['session','projects','investors','catalogs','history','backups','other'];
      const categories=Object.fromEntries(groups.map(key=>[key,{keys:0,units:0}]));
      const catalogKeys=new Set(['fc_sheet_materials_v1','fc_materials_v1','fc_accessories_v1','fc_hardware_manufacturers_v1','fc_hardware_suppliers_v1','hardwareSuppliers','fc_hardware_categories_v1','hardwareCategories','fc_hardware_types_v1','hardwareTypes','fc_hardware_technical_params_v1','hardwareTechnicalParams','fc_hardware_settings_v1','hardwareSettings','fc_quote_rates_v1','fc_services_v1','fc_workshop_services_v1','fc_sheets_v1','fc_program_defaults_v1','fc_company_profile_v1','fc_business_costs_v1']);
      const category=key=>key===keys[0]?'session':['fc_projects_v1','fc_project_v1'].includes(key)?'projects':key==='fc_investors_v1'?'investors':key==='fc_quote_snapshots_v1'?'history':/^fc_(?:project_backup|backup|safety_backup)/.test(key)?'backups':catalogKeys.has(key)?'catalogs':'other';
      const names=()=>{
        const count=storage.length;
        if(!Number.isInteger(count)||count<0||count>2000||typeof storage.key!=='function')return null;
        const out=Array.from({length:count},(_,i)=>storage.key(i));
        return out.every(key=>typeof key==='string')&&new Set(out).size===count?out.sort():null;
      };
      const list=names();
      if(!list)report.usage={status:'UNAVAILABLE'};
      else{
        let totalUnits=0,largestValueUnits=0;
        const observed=[];
        for(const key of list){
          if(!authorized())return no('AUTH_DENIED');
          const value=storage.getItem(key);
          if(typeof value!=='string')return no('DIAGNOSTIC_STATE_CHANGED');
          totalUnits+=key.length+value.length;largestValueUnits=Math.max(largestValueUnits,value.length);
          const group=categories[category(key)];group.keys++;group.units+=key.length+value.length;
          observed.push([key,value]);
          if(totalUnits>8*1024*1024)break;
        }
        if(totalUnits>8*1024*1024)report.usage={status:'TOO_LARGE'};
        else{
          if(JSON.stringify(names())!==JSON.stringify(list)||observed.some(([key,value])=>storage.getItem(key)!==value))return no('DIAGNOSTIC_STATE_CHANGED');
          const rows=parse(raw[1]),projects=Array.isArray(rows)?rows:null;
          const selected=projects?.find(row=>object(row)&&String(row.id||'')===raw[2]);
          let ramPayloadUnitsEstimate=null;
          if(s?.active===true&&object(s.snapshot)){
            ramPayloadUnitsEstimate=JSON.stringify({schemaVersion:4,active:true,projectId:s.projectId,roomId:s.roomId,expectedOwnerRaw:s.expectedOwnerRaw,expectedOwnerKnown:s.expectedOwnerKnown,startedAt:Number(s.startedAt||0),updatedAt:Number(s.updatedAt||0),context:s.context,snapshot:s.snapshot}).length;
          }
          report.usage={status:'MEASURED',unit:'UTF16_CODE_UNITS',totalUnits,categories,largestValueUnits,
            projectCount:projects?.length??null,largestProjectUnits:projects?projects.reduce((n,row)=>Math.max(n,JSON.stringify(row).length),0):null,
            currentProjectUnits:selected?JSON.stringify(selected).length:null,sessionPayloadUnits:raw[0]?.length??0,ramPayloadUnitsEstimate,
            replacementNetUnitsEstimate:ramPayloadUnitsEstimate===null?null:Math.max(0,ramPayloadUnitsEstimate-(raw[0]?.length??0))+(raw[0]===null?keys[0].length:0),quotaLimitKnown:false,transientWriteCostKnown:false};
        }
      }
      report.ramActive=s?.active===true;
    }
    if(!authorized())return no('AUTH_DENIED');
    try{if(keys.some((k,i)=>w.localStorage.getItem(k)!==raw[i])||w.FC?.session!==s||readUi()!==ui||runtime()!==beforeRuntime)return no('DIAGNOSTIC_STATE_CHANGED');}catch(_){return no(authorized()?'STORAGE_UNREADABLE':'AUTH_DENIED');}
    return authorized()?report:no('AUTH_DENIED');
  }catch(_){return no(authorized()?'DIAGNOSTIC_FAILED':'AUTH_DENIED');}
}
  if(typeof module==='object' && module.exports) module.exports=pixelSessionReadonly;
  else { root.FC=root.FC||{};root.FC.sessionDiagnosticsReadonly=pixelSessionReadonly; }
})(typeof window!=='undefined'?window:globalThis);
