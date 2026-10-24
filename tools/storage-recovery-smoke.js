'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {fixture}=require('./project-navigation-blockers-smoke');
const files=['backup-archive-format','backup-archive-idb','storage-recovery-export'];
function environment(){
  const local=new Map(),session=new Map();let valid=true,writes=0,reads=0,hook=()=>{};
  function storage(rows){return {get length(){return rows.size;},key(i){return [...rows.keys()][i]??null;},getItem(k){reads++;hook(k);return rows.get(k)??null;},setItem(){writes++;throw Error('Forbidden source write');},removeItem(){writes++;throw Error('Forbidden source removal');},clear(){writes++;throw Error('Forbidden clear');}};}
  const s={console,crypto:crypto.webcrypto,Uint8Array,DataView,TextEncoder,Date,JSON,Map,Set,WeakMap,Error,Number,Object,Array,
    btoa,atob,localStorage:storage(local),sessionStorage:storage(session),navigator:{locks:{request:async(n,o,fn)=>fn({name:n})}},
    indexedDB:{databases:async()=>[]},FC:{session:{active:true,durable:false,projectId:'PRIVATE_PROJECT'}},projectData:{private:'UNSAVED'},uiState:{roomType:'PRIVATE_ROOM'}};
  Object.defineProperty(s,'__FC_MAIN_ACCESS__',{value:{isValid:()=>valid},writable:false,configurable:false});s.window=s;
  vm.createContext(s);for(const name of files)vm.runInContext(fs.readFileSync('js/app/shared/'+name+'.js','utf8'),s);
  return {s,local,session,get writes(){return writes;},get reads(){return reads;},revoke(){valid=false;},hook(fn){hook=fn;}};
}
async function main(){
  let passed=0;const test=async(name,run)=>{await run();passed++;console.log('PASS '+name);};
  await test('Lossless UTF-16LE hashing, legacy records, unknown formats and duplicate identities',async()=>{
    const {s}=environment(),f=s.FC.backupArchiveFormat,raw='A\ud800B\udfff';
    assert.deepEqual([...f.utf16(raw)],[65,0,0,216,66,0,255,223]);
    assert.equal(await f.hash(raw),crypto.createHash('sha256').update(Buffer.from(raw,'utf16le')).digest('hex'));
    const row={id:'b',pinned:true,extra:{untouched:'\ud800'},snapshot:{keys:{fc_projects_v1:' \n[] '}}};
    assert.equal(JSON.stringify(await f.decode([await f.encode(row)])),JSON.stringify([row]));
    for(const value of ['{}','[null]',JSON.stringify([row,row]),JSON.stringify([{...row,snapshot:{...row.snapshot,version:99}}]),JSON.stringify([{...row,snapshot:{keys:{fc_projects_v1:{}}}}])])assert.throws(()=>f.parse(value),/ARCHIVE_/);
    const record=await f.encode(row);record.raw+=' ';await assert.rejects(f.decode([record]),/ARCHIVE_RECORD_HASH/);
  });
  await test('Encrypted private rescue: archive, RAW omissions, aliases, sessionStorage and RAM; actual decrypt/re-read, zero source mutations',async()=>{
    const r=environment(),x=r.s.FC.storageRecoveryExport;
    const original=' [ {"id":"old", "snapshot":{"keys":{"fc_projects_v1":" \\ud800 "}}} ] ';
    r.local.set('fc_data_backups_v1',original);r.local.set('hardwareSettings','PRIVATE_ALIAS');r.local.set('fc_project_backup_v1','PRIVATE_RECOVERY');
    r.local.set('fc_quote_offer_drafts_v1','PRIVATE_DRAFT');r.local.set('fc_quote_snapshots_v1','PRIVATE_HISTORY');r.local.set('firebase:authUser:private','SECRET_AUTH_TOKEN');
    r.session.set('fc_reload_restore_v1','PRIVATE_RELOAD');
    const before=JSON.stringify([...r.local]),token=await x.prepare('synthetic strong passphrase');
    assert.ok(!token.text.includes('PRIVATE')&&!token.text.includes('SECRET_AUTH_TOKEN')&&!token.text.includes('fc_data_backups_v1'));
    assert.equal(token.fileHash,crypto.createHash('sha256').update(token.text,'utf8').digest('hex'),'Hash identifies exact downloaded UTF-8 bytes');
    const fileBytes=Buffer.from(token.text,'utf8');
    const copy=await x.readFile({size:fileBytes.length,arrayBuffer:async()=>fileBytes.buffer.slice(fileBytes.byteOffset,fileBytes.byteOffset+fileBytes.byteLength)});
    const receipt=await x.verify(copy,'synthetic strong passphrase',token);
    await assert.rejects(x.readFile({size:3,arrayBuffer:async()=>Uint8Array.from([239,187,191]).buffer}),/FILE_ENCODING_INVALID/);
    assert.equal(x.isReceipt(receipt,token.sourceHash),true);x.assertReceiptCurrent(receipt);
    assert.equal(x.isReceipt({...receipt},token.sourceHash),false,'Forged capability is not valid');
    await assert.rejects(x.verify(copy+' ','synthetic strong passphrase',token),/FILE_MISMATCH/);
    await assert.rejects(x.verify(copy,'wrong but long passphrase',token));
    assert.equal(JSON.stringify([...r.local]),before);assert.equal(r.writes,0);
    r.local.set('fc_quote_offer_drafts_v1','NEWER');assert.throws(()=>x.assertReceiptCurrent(receipt),/SOURCE_CHANGED/);
  });
  await test('Full Pixel-like storage reads completely without probing writes; read errors, changes, unknown stores and access revocation fail closed',async()=>{
    const r=environment(),x=r.s.FC.storageRecoveryExport;
    r.local.set('fc_data_backups_v1','B'.repeat(3317250));r.local.set('fc_quote_snapshots_v1','H'.repeat(1328058));r.local.set('fc_rozrys_plan_cache_v2','C'.repeat(221062));
    const token=await x.prepare('synthetic strong passphrase');assert.equal((await x.verify(token.text,'synthetic strong passphrase',token)).verified,true);assert.equal(r.writes,0);
    const bad=environment();bad.local.set('fc_data_backups_v1','[]');bad.hook(()=>{throw Error('PRIVATE_READ_ERROR');});await assert.rejects(bad.s.FC.storageRecoveryExport.prepare('synthetic strong passphrase'),/PRIVATE_READ_ERROR/);assert.equal(bad.writes,0);
    const changed=environment();changed.local.set('fc_data_backups_v1','[]');let n=0;changed.hook(k=>{if(k==='fc_data_backups_v1'&&++n===2)changed.local.set(k,' [] ');});await assert.rejects(changed.s.FC.storageRecoveryExport.prepare('synthetic strong passphrase'),/SOURCE_CHANGED/);
    const unknown=environment();unknown.local.set('PRIVATE_ID','never omit');await assert.rejects(unknown.s.FC.storageRecoveryExport.prepare('synthetic strong passphrase'),/UNKNOWN_STORAGE/);
    const denied=environment();denied.revoke();await assert.rejects(denied.s.FC.storageRecoveryExport.prepare('synthetic strong passphrase'),/AUTH_DENIED/);assert.equal(denied.reads,0);assert.equal(denied.writes,0);
  });
  await test('Pinned and safe test backups survive unchanged seven-day/minimum-ten retention',()=>{
    const s={FC:{},Date};s.window=s;vm.createContext(s);vm.runInContext(fs.readFileSync('js/app/shared/data-backup-policy.js','utf8'),s);
    const rows=Array.from({length:15},(_,i)=>({id:'test'+i,reason:'before-tests',createdAtMs:i+10}));rows[0].pinned=true;rows[1].safeState=true;
    const kept=s.FC.dataBackupPolicy.pruneBackups(rows);assert.equal(kept.length,12);assert.ok(kept.some(r=>r.id==='test0')&&kept.some(r=>r.id==='test1'));
    assert.equal(s.FC.dataBackupPolicy.RETENTION_DAYS,7);assert.equal(s.FC.dataBackupPolicy.MIN_KEEP,10);
  });
  await test('Genuine quota refuses original begin; approved space removal permits only unchanged proven baseline and durable retry',async()=>{
    for(const newer of [false,true]){
      const r=fixture(undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});r.FC.projectPcvPolicy.ensureProjectMode();r.s.uiState.roomType='room_k';
      const get=r.storage.getItem.bind(r.storage),set=r.storage.setItem.bind(r.storage);
      r.storage.rows.set('fc_data_backups_v1','B'.repeat(3317250));r.storage.rows.set('fc_quote_snapshots_v1','H'.repeat(1328058));
      const baseline=[...r.storage.rows].reduce((n,[k,v])=>n+k.length+v.length,0);
      r.storage.setItem=(k,v)=>{const next=new Map(r.storage.rows);next.set(k,String(v));if([...next].reduce((n,[a,b])=>n+a.length+b.length,0)>baseline+100)throw new DOMException('synthetic full origin','QuotaExceededError');return set(k,v);};
      assert.equal(r.FC.session.begin('room_k'),false);assert.equal(r.FC.session.lastError.code,'SESSION_QUOTA_EXCEEDED');assert.equal(r.FC.session.durable,false);
      const prior=get('fc_projects_v1'),snapshot=r.FC.session.snapshot;
      // Synthetic stage E only. The app never performs this as a quota side effect.
      r.storage.rows.delete('fc_data_backups_v1');
      if(newer){const rows=JSON.parse(prior);rows.find(row=>row.id==='P').projectData.room_k.cabinets[0].width=99;r.storage.rows.set('fc_projects_v1',JSON.stringify(rows));}
      assert.equal(r.FC.session.retryInitialBegin(),!newer);assert.equal(r.FC.session.durable,!newer);assert.equal(r.FC.session.snapshot,snapshot);
      if(!newer){assert.equal(get('fc_projects_v1'),prior);assert.ok(get('fc_edit_session_v1'));}
      else assert.equal(JSON.parse(get('fc_projects_v1')).find(row=>row.id==='P').projectData.room_k.cabinets[0].width,99);
    }
  });
  console.log('Storage recovery targeted groups: '+passed+'/5 PASS');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
