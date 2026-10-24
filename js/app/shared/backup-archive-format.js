(function(root){
  'use strict';
  const FC=root.FC=root.FC||{};
  const KEY='fc_data_backups_v1', DB='meble-business-backups-v1', LOCK='meble-business-backups-v1', ROUTE='meble_backup_archive_backend_v1';
  const fail=code=>{throw Error(code);};
  function access(){
    const d=Object.getOwnPropertyDescriptor(root,'__FC_MAIN_ACCESS__');
    if(!d||d.writable!==false||d.configurable!==false||d.value?.isValid()!==true)fail('RECOVERY_AUTH_DENIED');
  }
  // Hash code units, never TextEncoder's replacement of lone surrogates.
  function utf16(text){
    const bytes=new Uint8Array(text.length*2),view=new DataView(bytes.buffer);
    for(let i=0;i<text.length;i++)view.setUint16(i*2,text.charCodeAt(i),true);
    return bytes;
  }
  async function hash(text){
    const bytes=await root.crypto.subtle.digest('SHA-256',utf16(text));
    return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function parse(raw){
    if(typeof raw!=='string')fail('ARCHIVE_SOURCE_MISSING');
    let rows;try{rows=JSON.parse(raw);}catch(_){fail('ARCHIVE_FORMAT_INVALID');}
    if(!Array.isArray(rows))fail('ARCHIVE_FORMAT_UNKNOWN');
    const ids=new Set();
    for(const row of rows){
      if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id||ids.has(row.id))fail('ARCHIVE_RECORD_INVALID');
      const s=row.snapshot;
      if(!s||typeof s!=='object'||Array.isArray(s)||!s.keys||typeof s.keys!=='object'||Array.isArray(s.keys)
        ||(s.kind!==undefined&&s.kind!=='meble-app-storage-snapshot')||(s.version!==undefined&&s.version!==1)
        ||(row.version!==undefined&&row.version!==1))fail('ARCHIVE_FORMAT_UNKNOWN');
      if(Object.values(s.keys).some(v=>v!==null&&typeof v!=='string'))fail('ARCHIVE_RECORD_INVALID');
      for(const k of ['pinned','safeState'])if(row[k]!==undefined&&typeof row[k]!=='boolean')fail('ARCHIVE_RECORD_INVALID');
      for(const k of ['createdAt','reason','label'])if(row[k]!==undefined&&typeof row[k]!=='string')fail('ARCHIVE_RECORD_INVALID');
      if(row.createdAtMs!==undefined&&(!Number.isFinite(row.createdAtMs)||row.createdAtMs<0))fail('ARCHIVE_RECORD_INVALID');
      ids.add(row.id);
    }
    return rows;
  }
  function rawRecords(raw){
    parse(raw);const out=[];let start=raw.indexOf('[')+1,depth=1,quoted=false,escaped=false;
    for(let i=start;i<raw.length;i++){
      const c=raw[i];
      if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
      if(c==='"'){quoted=true;continue;}
      if(c==='['||c==='{')depth++;
      else if(c===']'||c==='}'){
        depth--;if(depth===0){if(raw.slice(start,i).trim())out.push(raw.slice(start,i));break;}
      }else if(c===','&&depth===1){out.push(raw.slice(start,i));start=i+1;}
    }
    return out;
  }
  async function encode(row,originalRaw){
    const raw=originalRaw??JSON.stringify(row);
    return {id:row.id,raw,sha256:await hash(raw),group:row.reason==='before-tests'?'test':'app',
      pinned:!!row.pinned,safeState:!!row.safeState||row.reason==='safe-state',createdAtMs:row.createdAtMs??null};
  }
  async function decode(records){
    const rows=[];
    for(const record of records){
      if(await hash(record.raw)!==record.sha256)fail('ARCHIVE_RECORD_HASH');
      const row=parse('['+record.raw+']')[0],expected=await encode(row,record.raw);
      if(JSON.stringify(expected)!==JSON.stringify(record))fail('ARCHIVE_RECORD_METADATA');
      rows.push(row);
    }
    if(new Set(rows.map(r=>r.id)).size!==rows.length)fail('ARCHIVE_RECORD_INVALID');
    return rows;
  }
  async function exclusive(run){
    access();
    if(!root.navigator?.locks?.request)fail('ARCHIVE_LOCK_UNAVAILABLE');
    return root.navigator.locks.request(LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)fail('ARCHIVE_BUSY');access();return run();
    });
  }
  FC.backupArchiveFormat={KEY,DB,LOCK,ROUTE,access,fail,utf16,hash,parse,rawRecords,encode,decode,exclusive};
})(typeof window!=='undefined'?window:globalThis);
