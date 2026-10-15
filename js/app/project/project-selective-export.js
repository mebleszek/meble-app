// Internal selective pilot document builder. No UI, downloads, network or writes.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const I='fc_investors_v1',P='fc_projects_v1',IP='fc_current_investor_v1',PP='fc_current_project_id_v1';
  const error=(code,path)=>({ok:false,code,path});
  const abort=(code,path)=>{throw {exportFailure:true,code,path};};
  function raw(key){
    if(!FC.storage||typeof FC.storage.readRawStrict!=='function')abort('EXPORT_STORAGE_UNAVAILABLE','storage');
    const result=FC.storage.readRawStrict(key);
    if(!result||result.ok!==true)abort('EXPORT_READ_FAILED','storage');
    return result.raw;
  }
  function list(key,path){
    const value=raw(key);if(value===null)abort('EXPORT_SOURCE_MISSING',path);
    let rows;try{rows=JSON.parse(value);}catch(_){abort('EXPORT_SOURCE_INVALID_JSON',path);}
    if(!Array.isArray(rows))abort('EXPORT_SOURCE_INVALID_JSON',path);
    const ids=new Set();
    for(const row of rows){
      if(!row||!FC.projectExportContract.isId(row.id))abort('EXPORT_INVALID_ID',path+'[]');
      if(ids.has(row.id))abort('EXPORT_DUPLICATE_ID',path+'[]');ids.add(row.id);
    }
    return rows;
  }
  function safety(){
    if(!FC.session||typeof FC.session.inspectExportState!=='function')abort('EXPORT_SESSION_UNAVAILABLE','session');
    const state=FC.session.inspectExportState();
    if(!state||state.ok!==true)abort(state&&state.code||'EXPORT_SESSION_UNCONFIRMED','session');
  }
  function observe(opts){
    const contract=FC.projectExportContract;
    safety();
    const pointers={investorId:raw(IP),projectId:raw(PP)};
    if(pointers.investorId!==opts.investorId||pointers.projectId!==opts.projectId)abort('EXPORT_CONTEXT_MISMATCH','context');
    // Cross-check context APIs without using normalizing record getters.
    if(!FC.projectStore||!FC.investors||FC.projectStore.getCurrentProjectId()!==opts.projectId||FC.investors.getCurrentId()!==opts.investorId)abort('EXPORT_CONTEXT_MISMATCH','context');
    if(window.uiState&&window.uiState.currentInvestorId&&window.uiState.currentInvestorId!==opts.investorId)abort('EXPORT_CONTEXT_MISMATCH','context');
    const investors=list(I,'investors'),projects=list(P,'projects');
    const investor=investors.find(row=>row.id===opts.investorId),project=projects.find(row=>row.id===opts.projectId);
    if(!investor)abort('EXPORT_INVESTOR_NOT_FOUND','investor');
    if(!project)abort('EXPORT_PROJECT_NOT_FOUND','project');
    if(project.investorId!==opts.investorId)abort('EXPORT_INVESTOR_MISMATCH','project.investorId');
    if(project.meta&&project.meta.pendingDomainOperation)abort('EXPORT_PENDING_OPERATION','project.meta');
    // An investor.rooms mirror has no physical projectId. Shared referenced room
    // IDs across that investor's records cannot be assigned by guessing.
    const keys=project.projectData&&project.projectData.meta&&project.projectData.meta.roomDefs;
    for(const mirror of investor.rooms||[])if(keys&&Object.prototype.hasOwnProperty.call(keys,mirror.id)){
      if(projects.some(other=>other.id!==project.id&&other.investorId===investor.id&&other.projectData&&other.projectData.meta&&other.projectData.meta.roomDefs&&Object.prototype.hasOwnProperty.call(other.projectData.meta.roomDefs,mirror.id)))abort('EXPORT_OWNER_AMBIGUOUS','investor.rooms');
    }
    // Comparison excludes ONLY native cabinet cache fields; no normalization,
    // default insertion, metadata removal, type coercion or room-scoped compare.
    if(!window.projectData)abort('EXPORT_RAM_DIVERGENCE','projectData');
    const strip=data=>{
      const out={...data};
      for(const [key,value]of Object.entries(data)){
        if(key==='meta'||key==='schemaVersion'||!value||!Array.isArray(value.cabinets))continue;
        out[key]={...value,cabinets:value.cabinets.map(c=>{const copy={...c};delete copy.derivedFacts;delete copy._derivedFacts;return copy;})};
      }
      return out;
    };
    // Exclude native RAM-only cache BEFORE canonicalization: it may legitimately
    // be undefined or contain transient non-JSON values, never project decisions.
    if(contract.canonical(strip(window.projectData))!==contract.canonical(strip(project.projectData)))abort('EXPORT_RAM_DIVERGENCE','projectData');
    safety();
    return {investor,project,pointers};
  }
  async function build(options){
    try{
      const opts=options||{},c=FC.projectExportContract;
      if(!c)abort('EXPORT_DEPENDENCY_UNAVAILABLE','contract');
      if(opts.purpose!=='pilot'||!c.isId(opts.investorId)||!c.isId(opts.projectId)||Object.keys(opts).some(k=>!['investorId','projectId','purpose'].includes(k)))abort('EXPORT_SCOPE_REQUIRED','options');
      const first=observe(opts),source=c.canonical(first);
      const projected=c.validate(first.investor,first.project);
      if(!projected.ok)return projected;
      const utf8=window.TextEncoder&&new window.TextEncoder(),crypto=window.crypto;
      if(!utf8||!crypto||!crypto.subtle||typeof crypto.subtle.digest!=='function')abort('EXPORT_CRYPTO_UNAVAILABLE','integrity');
      const hash=async value=>{
        const digest=await crypto.subtle.digest('SHA-256',utf8.encode(c.canonical(value)));
        const bytes=new Uint8Array(digest);if(bytes.length!==32)throw Error('invalid SHA-256');
        return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      };
      const document={kind:'meble-app-project-export',version:1,profile:'native-project-v1',projectSchemaVersion:12,
        metadata:{exportedAt:new Date().toISOString(),purpose:'pilot'},payload:projected.payload};
      // Hash the document excluding the entire integrity block. Payload hash is
      // stable across export timestamps; neither checksum is an authorization.
      let payloadSha256,documentSha256;
      try{payloadSha256=await hash(document.payload);documentSha256=await hash(document);}catch(_){abort('EXPORT_CRYPTO_UNAVAILABLE','integrity');}
      document.integrity={algorithm:'SHA-256',canonicalization:'sorted-json-v1',payloadSha256,documentSha256};
      const utf8Bytes=utf8.encode(c.canonical(document)).byteLength;
      if(utf8Bytes>c.MAX_BYTES)abort('EXPORT_SIZE_LIMIT','document');
      const last=observe(opts);
      if(c.canonical(last)!==source)abort('EXPORT_SOURCE_CHANGED','source');
      return {ok:true,document,utf8Bytes,dependencies:c.dependencies(document.payload),warnings:[
        'PILOT_SYNTHETIC_DATA_ONLY','CATALOGS_AND_DEFAULTS_NOT_INCLUDED','GLOBAL_GRAIN_NOT_INCLUDED',
        'DATA_RESTORE_IS_NOT_QUOTE_RECALCULATION','READ_CHECK_IS_NOT_CROSS_TAB_TRANSACTION'
      ]};
    }catch(e){return e&&e.exportFailure?error(e.code,e.path):error('EXPORT_READ_FAILED','source');}
  }
  FC.projectSelectiveExport={build};
})();
