// Versioned owned application profile. Old synthetic validator remains closed.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const fail=()=>{throw Object.assign(Error('LF_BUSINESS_PROJECT_INVALID'),{code:'LF_BUSINESS_PROJECT_INVALID'});};
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
 function safe(value,seen=new Set()){
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(value&&typeof value==='object'){if(seen.has(value))fail();seen.add(value);}
  if(Array.isArray(value)){value.forEach(v=>safe(v,seen));seen.delete(value);return;}
  if(!value||typeof value!=='object')fail();
  for(const [k,v]of Object.entries(value)){if(['__proto__','prototype','constructor','apiKey','accessToken','refreshToken','password','privateKey'].includes(k))fail();safe(v,seen);}seen.delete(value);
 }
 function validate(payload){
  safe(payload);const {investor,project,offers}=payload||{};
  if(project?.meta?.pendingDomainOperation)fail();
  if(Object.keys(payload).sort().join(',')!=='investor,offers,project'||!id(investor?.id)||!id(project?.id)
   ||project.investorId!==investor.id||project.projectData?.meta?.assignedInvestorId!==investor.id
   ||project.projectData?.schemaVersion!==12||(investor.rooms!==undefined&&!Array.isArray(investor.rooms))||!Array.isArray(offers))fail();
  const listed=(investor.rooms||[]).map(r=>r.id),defs=project.projectData.meta.roomDefs||{},order=project.projectData.meta.roomOrder||[];
  if(!defs||!Array.isArray(order)||new Set(listed).size!==listed.length||listed.some(x=>!id(x)))fail();
  const rooms=Object.keys(defs);if(rooms.some(x=>!id(x)||defs[x]?.id!==x)||new Set(order).size!==order.length||order.length!==rooms.length||order.some(x=>!rooms.includes(x))||listed.some(x=>!rooms.includes(x)))fail();
  for(const r of rooms){const value=project.projectData[r];try{FC.projectExportContract.validateOwnedRoom(value);}catch(e){throw Object.assign(Error('LF_PROJECT_SCHEMA_BLOCKED'),{code:'LF_PROJECT_SCHEMA_BLOCKED',reason:/^EXPORT_[A-Z_]+$/.test(e?.code||'')?e.code:'EXPORT_INVALID_FIELD'});}}
  for(const o of offers)if(!id(o.id)||o.project?.id!==project.id||o.investor?.id!==investor.id)fail();
  const names=Object.keys(project.projectData).filter(k=>!['meta','schemaVersion'].includes(k));
  for(const k of names)if(!rooms.includes(k)){
   // Legacy built-in empty room shells are preserved; never omit their data.
   const r=project.projectData[k];if(!r||!Array.isArray(r.cabinets)||r.cabinets.length||r.fronts?.length||r.sets?.length)fail();
  }
  FC.projectExportContract.dependencies({investor,project});return true;
 }
 async function build(storage,projectId){
  if(storage.getItem('fc_edit_session_v1')!==null)fail();
  for(const key of ['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_rozrys_overrides_v1','fc_quote_offer_drafts_v1']){
   const raw=storage.getItem(key);if(raw!==null&&raw!=='{}'&&raw!=='[]')throw Object.assign(Error('LF_PROJECT_OWNERSHIP_PENDING'),{code:'LF_PROJECT_OWNERSHIP_PENDING'});
  }
  const projects=JSON.parse(storage.getItem('fc_projects_v1')||'[]'),matches=projects.filter(p=>p.id===projectId);
  if(matches.length!==1)fail();const project=matches[0];
  const investors=JSON.parse(storage.getItem('fc_investors_v1')||'[]').filter(i=>i.id===project.investorId);if(investors.length!==1)fail();
  const history=JSON.parse(storage.getItem('fc_quote_snapshots_v1')||'[]');if(!Array.isArray(history))fail();
  if(history.some(o=>!o.project?.id||!o.investor?.id))throw Object.assign(Error('LF_HISTORY_OWNER_REQUIRED'),{code:'LF_HISTORY_OWNER_REQUIRED'});
  const payload={investor:investors[0],project,offers:history.filter(o=>o.project.id===project.id)};validate(payload);
  const c=FC.cloudPilotContract,document={kind:'meble-app-project-export',version:1,profile:'business-project-v1',projectSchemaVersion:12,
   metadata:{exportedAt:new Date().toISOString(),purpose:'business-sync'},payload};
  document.integrity={algorithm:'SHA-256',canonicalization:'sorted-json-v1',payloadSha256:await c.sha(c.encode?c.encode(payload):new TextEncoder().encode(c.canonical(payload))),documentSha256:await c.sha(new TextEncoder().encode(c.canonical(document)))};
  return {ok:true,document,utf8Bytes:new TextEncoder().encode(c.canonical(document)).length};
 }
 FC.businessProjectContract={validate,build,dependencies:payload=>FC.projectExportContract.dependencies(payload)};
})();
