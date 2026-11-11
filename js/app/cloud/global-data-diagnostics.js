// Observation only: exact contract keys, no stores, factories or normalizers.
(function(){
 'use strict';const fc=window.FC=window.FC||{};
 const codes=new Set(('NONE GLOBAL_VALUE_INVALID GLOBAL_ID_INVALID GLOBAL_DATE_INVALID GLOBAL_SECRET_FORBIDDEN GLOBAL_UNKNOWN_FIELD GLOBAL_REQUIRED_FIELD GLOBAL_DUPLICATE_ID GLOBAL_DEPENDENCY_MISSING GLOBAL_DEPENDENCY_UNAVAILABLE GLOBAL_REFERENCE_MISSING GLOBAL_REFERENCE_CONFLICT GLOBAL_SOURCE_MISSING GLOBAL_SOURCE_CHANGED GLOBAL_STORAGE_INVALID GLOBAL_STORAGE_UNAVAILABLE GLOBAL_ALIAS_CONFLICT DIAG_SCHEMA_INVALID DIAG_LEGACY_MIXED_CATALOG DIAG_READ_BLOCKED DIAG_TOO_LARGE DIAG_RUNTIME_RESOLUTION_REQUIRED DIAG_DEPENDENCY_BLOCKED DIAG_SOURCE_AMBIGUOUS DIAG_RAW_ONLY DIAG_VALUE_DIFFERENCE DIAG_RECORD_DIFFERENCE DIAG_SOURCE_UNAVAILABLE DIAG_AUTH_BLOCKED DIAG_CONTEXT_BLOCKED DIAG_RECEIPT_INVALID DIAG_OWNER_BLOCKED DIAG_IDB_MISSING DIAG_IDB_UNAVAILABLE DIAG_IDB_SCHEMA DIAG_BINDING_INVALID DIAG_SOURCE_INTEGRITY DIAG_IMAGE_INTEGRITY DIAG_IMAGE_CHANGED DIAG_RELEASE_BLOCKED DIAG_TIMEOUT DIAG_IMAGE_MISSING').split(' '));
 const statuses=new Set(['READ_ONLY','BLOCKED','PRESENT','EQUAL','DIFFERENT','ONE_MISSING','BOTH_MISSING','SOURCE_MISSING','INVALID_JSON','INVALID_SCHEMA','UNREADABLE','VALID','INVALID','RUNTIME_REQUIRED','NOT_COMPARABLE','IDENTICAL']);
 const differences=new Set(['NONE','RAW_ONLY','VALUE','RECORDS_OR_ORDER','MISSING','JSON','SCHEMA','READ','LEGACY_MIXED_CATALOG','DEPENDENCY','UNRESOLVED','UNKNOWN']);
 const dependencies={hardware:['manufacturers','categories','suppliers','technicalParams'],types:['categories'],technicalParams:['categories'],hardwareSettings:['suppliers']};
 const safeCode=error=>{try{return codes.has(error?.code)?error.code:'DIAG_SCHEMA_INVALID';}catch(_){return 'DIAG_SCHEMA_INVALID';}};
 const contract=()=>fc.globalDataContract;
 const domains=()=>Object.keys(contract().sources);
 const rawKeys=()=>Object.values(contract().sources).flat();
 function blocked(code='DIAG_READ_BLOCKED'){
  if(!codes.has(code))code='DIAG_READ_BLOCKED';
  return {status:'BLOCKED',code,domains:domains().map(domain=>({domain,keys:[...contract().sources[domain]],status:'BLOCKED',raw:'NOT_COMPARABLE',semantic:'NOT_COMPARABLE',discrepancy:'READ',code,
   sources:contract().sources[domain].map(key=>({key,status:'BLOCKED',code})),validation:{status:'BLOCKED',code}}))};
 }
 function inspect(read){
  const c=contract(),values={},results=[];let units=0;
  for(const domain of domains()){
   const keys=c.sources[domain],items=[];
   for(const key of keys){
    const item={key,status:'PRESENT',code:'NONE',value:null,raw:null,mixed:false};items.push(item);
    try{
     item.raw=read(key);
     if(item.raw===null){item.status='SOURCE_MISSING';item.code='GLOBAL_SOURCE_MISSING';continue;}
     if(typeof item.raw!=='string')throw Error();
    }catch(_){item.status='UNREADABLE';item.code='GLOBAL_STORAGE_UNAVAILABLE';continue;}
    units+=item.raw.length;
    if(item.raw.length>2*1024*1024||units>8*1024*1024){item.status='BLOCKED';item.code='DIAG_TOO_LARGE';continue;}
    let parsed;try{parsed=JSON.parse(item.raw);}catch(_){item.status='INVALID_JSON';item.code='GLOBAL_STORAGE_INVALID';continue;}
    try{
     // Same known local-only credential exclusion as capture(), in a private
     // parsed copy. Never ignore unknown business fields or change the RAW.
     if(domain==='company'&&parsed?.transport&&Object.hasOwn(parsed.transport,'apiKey')){
      if(typeof parsed.transport.apiKey!=='string')c.fail('GLOBAL_VALUE_INVALID');delete parsed.transport.apiKey;
     }
     if(domain==='stock'){
      c.shape({sheets:v=>{if(!Array.isArray(v)||v.length>4096)c.fail('GLOBAL_VALUE_INVALID');}},['sheets'])(parsed,'stock');
      item.value=parsed.sheets;
     }else item.value=parsed;
     const rows=c.single.has(domain)?[item.value]:item.value;
     if(!Array.isArray(rows)||rows.length>4096)c.fail('GLOBAL_VALUE_INVALID');
     // Classify the original mixed catalog; do NOT split it or compare only a
     // projected sheet subset (which would silently discard accessories).
     item.mixed=domain==='materials'&&rows.some(row=>typeof row?.materialType==='string'&&['akcesoria','accessories','akcesorium'].includes(row.materialType.trim().toLowerCase()));
     if(item.mixed){item.status='INVALID_SCHEMA';item.code='DIAG_LEGACY_MIXED_CATALOG';continue;}
     const ids=new Set();
     for(const row of rows){
      c.schemas[domain](row,domain);const id=c.single.has(domain)?'singleton':c.dictionary.has(domain)?row:row.id;c.id(id);
      if(ids.has(id))c.fail('GLOBAL_DUPLICATE_ID');ids.add(id);
     }
    }catch(error){item.status='INVALID_SCHEMA';item.code=safeCode(error);}
   }
   const a=items[0],b=items[1],present=items.filter(i=>i.status!=='SOURCE_MISSING');
   let status=b?'EQUAL':'PRESENT',code='NONE',discrepancy='NONE',raw='NOT_COMPARABLE',semantic='NOT_COMPARABLE';
   if(b&&typeof a.raw==='string'&&typeof b.raw==='string')raw=a.raw===b.raw?'IDENTICAL':'DIFFERENT';
   if(b&&items.every(i=>i.status==='PRESENT')){
    try{semantic=c.canonical(a.value)===c.canonical(b.value)?'EQUAL':'DIFFERENT';}catch(_){status='INVALID_SCHEMA';code='DIAG_SCHEMA_INVALID';discrepancy='SCHEMA';}
    if(semantic==='DIFFERENT'){
     status='DIFFERENT';code='GLOBAL_ALIAS_CONFLICT';discrepancy='VALUE';
     if(Array.isArray(a.value)&&Array.isArray(b.value)){
      const id=row=>c.dictionary.has(domain)?row:row.id;
      if(c.canonical(a.value.map(id))!==c.canonical(b.value.map(id)))discrepancy='RECORDS_OR_ORDER';
     }
    }else if(semantic==='EQUAL'&&raw==='DIFFERENT')discrepancy='RAW_ONLY';
   }
   const bad=items.find(i=>['UNREADABLE','BLOCKED','INVALID_JSON','INVALID_SCHEMA'].includes(i.status));
   if(bad){status=bad.status;code=bad.code;discrepancy=items.some(i=>i.mixed)?'LEGACY_MIXED_CATALOG':status==='INVALID_JSON'?'JSON':status==='INVALID_SCHEMA'?'SCHEMA':'READ';}
   else if(present.length!==items.length){status=!present.length?(b?'BOTH_MISSING':'SOURCE_MISSING'):'ONE_MISSING';code='GLOBAL_SOURCE_MISSING';discrepancy='MISSING';}
   // A single valid fallback may be examined, never written or called a match.
   if(!bad&&present.length&&(items.length===1||present.length===1||semantic==='EQUAL'))values[domain]=present[0].value;
   results.push({domain,keys:[...keys],status,raw,semantic,discrepancy,code,sources:items.map(({key,status,code})=>({key,status,code})),validation:{status:'BLOCKED',code:'DIAG_SOURCE_AMBIGUOUS'}});
  }
  for(const row of results){
   const domain=row.domain;if(!Object.hasOwn(values,domain))continue;
   const needed=dependencies[domain]||[];
   if(needed.some(d=>!Object.hasOwn(values,d))){row.validation={status:'BLOCKED',code:'DIAG_DEPENDENCY_BLOCKED'};continue;}
   try{
    // Minimal dependency closure: a fault in an unrelated domain must not hide
    // this domain's result. Reuse the existing validator, never its capture.
    const model=Object.fromEntries([domain,...needed].map(d=>[d,values[d]])),out=c.validate(model);
    row.validation=out.dependencies.length?{status:'RUNTIME_REQUIRED',code:'DIAG_RUNTIME_RESOLUTION_REQUIRED'}:{status:'VALID',code:'NONE'};
   }catch(error){row.validation={status:'INVALID',code:safeCode(error)};}
  }
  return {status:'READ_ONLY',code:'NONE',domains:results};
 }
 function compare(left,right){
  const c=contract(),aReport=inspect(left),bReport=inspect(right);
  return {status:'READ_ONLY',code:'NONE',domains:domains().map(domain=>{
   const keys=c.sources[domain];let raw='IDENTICAL',semantic='EQUAL',code='NONE',discrepancy='NONE',status='EQUAL';
   const invalid=[aReport,bReport].some(r=>r.domains.find(row=>row.domain===domain).sources.some(s=>!['PRESENT','SOURCE_MISSING'].includes(s.status)));
   for(const key of keys){
    const a=left(key),b=right(key);if(a!==b)raw='DIFFERENT';
    if(a===null||b===null){semantic='NOT_COMPARABLE';status='BLOCKED';code='DIAG_SOURCE_UNAVAILABLE';discrepancy='MISSING';continue;}
    if(invalid)continue; // Never parse again after a size/schema/read refusal.
    try{
     const parse=raw=>{const value=JSON.parse(raw);if(domain==='company'&&typeof value?.transport?.apiKey==='string')delete value.transport.apiKey;return value;};
     if(c.canonical(parse(a))!==c.canonical(parse(b))&&semantic!=='NOT_COMPARABLE')semantic='DIFFERENT';
    }
    catch(_){semantic='NOT_COMPARABLE';status='BLOCKED';code='GLOBAL_STORAGE_INVALID';discrepancy='JSON';}
   }
   if(invalid){
    status='BLOCKED';semantic='NOT_COMPARABLE';code='DIAG_SOURCE_UNAVAILABLE';discrepancy='SCHEMA';
   }
   if(status!=='BLOCKED'){
    if(semantic==='DIFFERENT'){status='DIFFERENT';code='DIAG_VALUE_DIFFERENCE';discrepancy='VALUE';}
    else if(raw==='DIFFERENT'){code='DIAG_RAW_ONLY';discrepancy='RAW_ONLY';}
   }
   return {domain,keys:[...keys],status,raw,semantic,discrepancy,code};
  })};
 }
 // Rebuild a closed report before any UI/copy boundary, even for unavailable,
 // stale or forged observations. No supplied keys/codes/strings are echoed.
 function sanitize(value){
  if(!value)return null;
  const code=v=>codes.has(v)?v:'DIAG_READ_BLOCKED',state=v=>statuses.has(v)?v:'BLOCKED',difference=v=>differences.has(v)?v:'UNKNOWN';
  const section=s=>({status:s?.status==='READ_ONLY'?'READ_ONLY':'BLOCKED',code:code(s?.code),domains:domains().map(domain=>{
   const r=(Array.isArray(s?.domains)?s.domains:[]).find(r=>r?.domain===domain),keys=[...contract().sources[domain]];
   return {domain,keys,status:state(r?.status),raw:state(r?.raw),semantic:state(r?.semantic),discrepancy:difference(r?.discrepancy),code:code(r?.code),
    ...(Array.isArray(r?.sources)?{sources:keys.map(key=>{const src=r.sources.find(s=>s?.key===key);return {key,status:state(src?.status),code:code(src?.code)};})}:{}),
    ...(r?.validation?{validation:{status:state(r.validation.status),code:code(r.validation.code)}}:{})};
  })});
  const status=value.status==='READ_ONLY'?'READ_ONLY':'BLOCKED';
  const catalogDirectoryHash=status==='READ_ONLY'&&typeof value.catalogDirectoryHash==='string'&&/^[a-f0-9]{64}$/.test(value.catalogDirectoryHash)?value.catalogDirectoryHash:null;
  return {status,code:code(value.code),originals:section(value.originals),localFirst:section(value.localFirst),comparison:section(value.comparison),catalogDirectoryHash};
 }
 function format(value){
  const r=sanitize(value);if(!r)return '';
  const lines=['DANE GLOBALNE — tylko odczyt: '+r.status+' / '+r.code];
  lines.push('SHA-256 indeksu katalogów LOCAL-FIRST: '+(r.catalogDirectoryHash||'NIEPOTWIERDZONY'));
  for(const [key,label]of [['originals','Oryginały localStorage'],['localFirst','Istniejący obraz LOCAL-FIRST'],['comparison','Oryginały ↔ obraz']]){
   const s=r[key];lines.push(label+': '+s.status+' / '+s.code);
   for(const d of s.domains)lines.push(d.domain+' ['+d.keys.join(' / ')+']: '+d.status+'; RAW='+d.raw+'; semantyka='+d.semantic+'; typ='+d.discrepancy+'; kod='+d.code+(d.validation?'; kontrakt='+d.validation.status+'/'+d.validation.code:''));
  }
  return lines.join('\n');
 }
 fc.globalDataDiagnostics=Object.freeze({inspect,compare,blocked,sanitize,format,rawKeys});
})();
