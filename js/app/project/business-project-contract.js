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
 // Local is an in-process validation choice, never a transmitted sync profile.
 function validate(payload,options={}){
  safe(payload);const {investor,project,offers}=payload||{};
  if(project?.meta?.pendingDomainOperation)fail();
  if(Object.keys(payload).sort().join(',')!=='investor,offers,project'||!id(investor?.id)||!id(project?.id)
   ||project.investorId!==investor.id||project.projectData?.meta?.assignedInvestorId!==investor.id
   ||project.projectData?.schemaVersion!==12||(investor.rooms!==undefined&&!Array.isArray(investor.rooms))||!Array.isArray(offers))fail();
  const listed=(investor.rooms||[]).map(r=>r.id),defs=project.projectData.meta.roomDefs||{},order=project.projectData.meta.roomOrder||[];
  if(!defs||!Array.isArray(order)||new Set(listed).size!==listed.length||listed.some(x=>!id(x)))fail();
  const rooms=Object.keys(defs);if(rooms.some(x=>!id(x)||defs[x]?.id!==x)||new Set(order).size!==order.length||order.length!==rooms.length||order.some(x=>!rooms.includes(x))||listed.some(x=>!rooms.includes(x)))fail();
  for(const r of rooms){const value=project.projectData[r];try{FC.projectExportContract[options.local===true?'validateLocalOwnedRoom':'validateOwnedRoom'](value);}catch(e){throw Object.assign(Error('LF_PROJECT_SCHEMA_BLOCKED'),{code:'LF_PROJECT_SCHEMA_BLOCKED',reason:/^EXPORT_[A-Z_]+$/.test(e?.code||'')?e.code:'EXPORT_INVALID_FIELD'});}}
  for(const o of offers)if(!id(o.id)||o.project?.id!==project.id||o.investor?.id!==investor.id)fail();
  const names=Object.keys(project.projectData).filter(k=>!['meta','schemaVersion'].includes(k));
  for(const k of names)if(!rooms.includes(k)){
   // Legacy built-in empty room shells are preserved; never omit their data.
   const r=project.projectData[k];if(!r||!Array.isArray(r.cabinets)||r.cabinets.length||r.fronts?.length||r.sets?.length)fail();
  }
  FC.projectExportContract.dependencies({investor,project});return true;
 }
 const draftKey='fc_quote_offer_drafts_v1';
 function draftRows(raw){
  const rows=JSON.parse(raw||'[]');
  if(!Array.isArray(rows))fail();
  return rows;
 }
 function validateOfferDrafts(rows,projects,investors){
  safe(rows);
  const seen=new Set();
  for(const row of rows){
   const owners=projects.filter(p=>p.id===row?.projectId);
   if(!id(row?.projectId)||!id(row.investorId)||seen.has(row.projectId)
    ||owners.length!==1||owners[0].investorId!==row.investorId
    ||investors.filter(i=>i.id===row.investorId).length!==1
    ||!Array.isArray(row.selection?.selectedRooms)||!row.selection.materialScope
    ||!Array.isArray(row.rateSelections)||!row.commercial||typeof row.commercial.versionName!=='string'
    ||!Number.isFinite(row.helperHours)||row.helperHours<0)fail();
   seen.add(row.projectId);
  }
 }
 function validateOfferDraftChange(before,after,scope){
  const old=draftRows(before[draftKey]),next=draftRows(after[draftKey]);
  const refuse=()=>{throw Object.assign(Error('LF_APPLICATION_SCOPE_REFUSED'),{code:'LF_APPLICATION_SCOPE_REFUSED'});};
  const others=rows=>rows.filter(row=>row?.projectId!==scope);
  if(!scope||before.fc_current_project_id_v1!==scope||after.fc_current_project_id_v1!==scope
   ||JSON.stringify(others(old))!==JSON.stringify(others(next)))refuse();
  const owned=next.filter(row=>row?.projectId===scope);
  const previous=old.filter(row=>row?.projectId===scope);
  if(owned.length!==1||owned[0].investorId!==after.fc_current_investor_v1
   ||previous.length>1||previous.some(row=>row.investorId!==owned[0].investorId))refuse();
  const projects=JSON.parse(after.fc_projects_v1||'[]'),investors=JSON.parse(after.fc_investors_v1||'[]');
  validateOfferDrafts(owned,projects,investors);
  const defs=projects.find(p=>p.id===scope).projectData.meta.roomDefs||{};
  const row=owned[0],normalized=FC.quoteOfferStore.normalizeDraft(row,row);
  const canonical=FC.cloudPilotContract.canonical;
  for(const key of Object.keys(normalized)){
   if(!Object.hasOwn(row,key)||canonical(row[key])!==canonical(normalized[key]))fail();
  }
  const rooms=row.selection.selectedRooms;
  if(rooms.some(room=>!id(room)||!Object.hasOwn(defs,room))||new Set(rooms).size!==rooms.length)refuse();
 }
 async function build(storage,projectId){
  if(storage.getItem('fc_edit_session_v1')!==null)fail();
  for(const key of ['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_rozrys_overrides_v1']){
   const raw=storage.getItem(key);if(raw!==null&&raw!=='{}'&&raw!=='[]')throw Object.assign(Error('LF_PROJECT_OWNERSHIP_PENDING'),{code:'LF_PROJECT_OWNERSHIP_PENDING'});
  }
  const projects=JSON.parse(storage.getItem('fc_projects_v1')||'[]'),matches=projects.filter(p=>p.id===projectId);
  if(matches.length!==1)fail();const project=matches[0];
  const allInvestors=JSON.parse(storage.getItem('fc_investors_v1')||'[]');
  // Verified owner-scoped drafts remain device-local. Unresolved legacy rows
  // still block projection rather than being silently omitted.
  try{validateOfferDrafts(draftRows(storage.getItem(draftKey)),projects,allInvestors);}
  catch(_){throw Object.assign(Error('LF_PROJECT_OWNERSHIP_PENDING'),{code:'LF_PROJECT_OWNERSHIP_PENDING'});}
  const investors=allInvestors.filter(i=>i.id===project.investorId);if(investors.length!==1)fail();
  const history=JSON.parse(storage.getItem('fc_quote_snapshots_v1')||'[]');if(!Array.isArray(history))fail();
  if(history.some(o=>!o.project?.id||!o.investor?.id))throw Object.assign(Error('LF_HISTORY_OWNER_REQUIRED'),{code:'LF_HISTORY_OWNER_REQUIRED'});
  const payload={investor:investors[0],project,offers:history.filter(o=>o.project.id===project.id)};validate(payload);
  const c=FC.cloudPilotContract,document={kind:'meble-app-project-export',version:1,profile:'business-project-v1',projectSchemaVersion:12,
   metadata:{exportedAt:new Date().toISOString(),purpose:'business-sync'},payload};
  document.integrity={algorithm:'SHA-256',canonicalization:'sorted-json-v1',payloadSha256:await c.sha(c.encode?c.encode(payload):new TextEncoder().encode(c.canonical(payload))),documentSha256:await c.sha(new TextEncoder().encode(c.canonical(document)))};
  return {ok:true,document,utf8Bytes:new TextEncoder().encode(c.canonical(document)).length};
 }
 FC.businessProjectContract={validate,build,validateOfferDraftChange,dependencies:payload=>FC.projectExportContract.dependencies(payload)};
})();
