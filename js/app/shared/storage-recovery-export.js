(function(root){
  'use strict';
  const FC=root.FC=root.FC||{},F=FC.backupArchiveFormat,{access,fail,hash}=F;
  const receipts=new WeakMap(),prepared=new WeakMap();
  const aliases=new Set(['hardwareSuppliers','hardwareSettings','hardwareCategories','hardwareTypes','hardwareTechnicalParams']);
  const excluded=k=>/^firebase[:_]/.test(k)||/^meble_access_profile_(v1|pending_v1)$/.test(k)||k===F.ROUTE;
  const allowed=k=>k.startsWith('fc_')||aliases.has(k);
  async function fileHash(text){
    const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function readFile(file){
    access();if(!file||file.size>90*1024*1024)fail('RECOVERY_EXPORT_TOO_LARGE');
    const bytes=new Uint8Array(await file.arrayBuffer());access();
    // The generated envelope is strictly ASCII. Do not let File.text() silently
    // strip a BOM or replace malformed UTF-8 before checking exact file bytes.
    if(bytes.some(x=>x>127))fail('RECOVERY_FILE_ENCODING_INVALID');
    let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));access();return text;
  }
  function storageRead(storage){
    const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(typeof key!=='string'||keys.includes(key))fail('RECOVERY_READ_INCOMPLETE');keys.push(key);}
    keys.sort();let units=0;const rows=[],omitted=[];
    for(const key of keys){
      if(excluded(key)){omitted.push(key);continue;}
      if(!allowed(key))fail('RECOVERY_UNKNOWN_STORAGE');
      const raw=storage.getItem(key);if(typeof raw!=='string')fail('RECOVERY_READ_INCOMPLETE');
      units+=key.length+raw.length;if(units>16*1024*1024)fail('RECOVERY_EXPORT_TOO_LARGE');
      rows.push({key,raw});
    }
    if(storage.length!==keys.length)fail('RECOVERY_SOURCE_CHANGED');return {rows,omitted};
  }
  function runtime(){
    const session=FC.session||null,project=typeof projectData!=='undefined'?projectData:root.projectData,
      ui=typeof uiState!=='undefined'?uiState:root.uiState;
    const fields=['active','durable','projectId','roomId','startedAt','context','snapshot','expectedOwnerKnown','expectedOwnerRaw','lastError'];
    const sessionEvidence=Object.fromEntries(fields.map(k=>[k,session?.[k]??null]));
    const controls=root.document?Array.from(root.document.querySelectorAll('#appView input, #appView select, #appView textarea, .modal input, .modal select, .modal textarea'))
      .filter(el=>!el.closest('[data-storage-recovery]')).map(el=>({tag:el.tagName,id:el.id,name:el.name,value:el.value,checked:el.checked,selected:el.selectedIndex})):[];
    let units=0,nodes=0;
    return JSON.stringify({sessionEvidence,project:project??null,ui:ui??null,controls},(key,value)=>{
      units+=key.length*6+8+(typeof value==='string'?value.length*6:24);
      if(units>16*1024*1024||++nodes>200000)fail('RECOVERY_RAM_TOO_LARGE');return value;
    });
  }
  function witness(){access();return {local:storageRead(root.localStorage),session:storageRead(root.sessionStorage),runtime:runtime()};}
  function unchanged(before){access();if(JSON.stringify(witness())!==JSON.stringify(before))fail('RECOVERY_SOURCE_CHANGED');}
  async function idb(){
    if(!root.indexedDB?.databases)fail('RECOVERY_IDB_INVENTORY_UNAVAILABLE');
    const dbs=await root.indexedDB.databases();access();
    const auth=new Set(['meble-access-profile-v1','firebaseLocalStorageDb','firebase-heartbeat-database','firebase-installations-database']);
    if(dbs.some(d=>d.name!==F.DB&&!auth.has(d.name)))fail('RECOVERY_UNKNOWN_DATABASE');
    const archive=dbs.some(d=>d.name===F.DB)?await FC.backupArchive.read():null;
    return {archive,excluded:dbs.filter(d=>auth.has(d.name)).map(d=>({name:d.name,reason:'ACCESS_NOT_BUSINESS_BACKUP'}))};
  }
  const base64=bytes=>{
    let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return root.btoa(text);
  };
  function unbase64(text){const raw=root.atob(text),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  function fromUtf16(bytes){
    if(bytes.length%2)fail('RECOVERY_ENCODING_INVALID');let out='';const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let i=0;i<bytes.length;i+=16384){const values=[];for(let n=i;n<Math.min(i+16384,bytes.length);n+=2)values.push(view.getUint16(n,true));out+=String.fromCharCode(...values);}return out;
  }
  async function key(password,salt){
    if(typeof password!=='string'||password.length<12)fail('RECOVERY_PASSPHRASE_TOO_SHORT');
    const material=await root.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return root.crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:310000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function manifest(data){
    const entries=[];
    for(const scope of ['local','session'])for(const row of data[scope].rows)entries.push({scope,key:row.key,valueUnits:row.raw.length,sha256:await hash(row.raw)});
    return {schema:1,encoding:'UTF-16LE-code-units',entries,runtimeHash:await hash(data.runtime),idbHash:await hash(JSON.stringify(data.idb)),
      scope:'CURRENT_DOCUMENT_BUSINESS_RAW',complete:true,otherTabsRam:false,cloudBackupConfirmed:false,
      authorizationRestorable:false,ramIsCommitProof:false};
  }
  async function prepare(password){
    access();const before=witness(),databases=await idb();unchanged(before);
    const data={...before,idb:databases},m=await manifest(data),body={kind:'meble-app-private-recovery',version:1,data,manifest:m,manifestHash:await hash(JSON.stringify(m))};
    const salt=root.crypto.getRandomValues(new Uint8Array(16)),iv=root.crypto.getRandomValues(new Uint8Array(12)),secret=await key(password,salt);
    const plain=F.utf16(JSON.stringify(body));if(plain.length>64*1024*1024)fail('RECOVERY_EXPORT_TOO_LARGE');
    const aad=F.utf16('meble-app-private-recovery-v1');
    const encrypted=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},secret,plain);
    plain.fill(0);access();unchanged(before);
    if(JSON.stringify(await idb())!==JSON.stringify(databases))fail('RECOVERY_SOURCE_CHANGED');
    const envelope={kind:'meble-app-encrypted-recovery',version:1,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:310000,
      salt:base64(salt),iv:base64(iv),encoding:'UTF-16LE-code-units',ciphertext:base64(new Uint8Array(encrypted))};
    const text=JSON.stringify(envelope),digest=await fileHash(text),sourceRaw=before.local.rows.find(r=>r.key===F.KEY)?.raw
      ??(databases.archive?.state?.phase==='SWITCH_PENDING'?databases.archive.source.raw:undefined);
    if(sourceRaw===undefined)fail('RECOVERY_ARCHIVE_SOURCE_MISSING');
    const token=Object.freeze({text,fileHash:digest,sourceHash:await hash(sourceRaw),complete:true});
    access();prepared.set(token,{before,databases});return token;
  }
  async function verify(text,password,token){
    access();const expected=prepared.get(token);if(!expected)fail('RECOVERY_PREPARATION_REQUIRED');
    if(typeof text!=='string'||text.length>90*1024*1024||await fileHash(text)!==token.fileHash)fail('RECOVERY_FILE_MISMATCH');
    const e=JSON.parse(text);
    if(e.kind!=='meble-app-encrypted-recovery'||e.version!==1||e.cipher!=='AES-256-GCM'||e.kdf!=='PBKDF2-SHA256'||e.iterations!==310000||e.encoding!=='UTF-16LE-code-units')fail('RECOVERY_ENVELOPE_INVALID');
    const salt=unbase64(e.salt),iv=unbase64(e.iv);if(salt.length!==16||iv.length!==12)fail('RECOVERY_ENVELOPE_INVALID');
    let decrypted;
    try{decrypted=await root.crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:F.utf16('meble-app-private-recovery-v1'),tagLength:128},await key(password,salt),unbase64(e.ciphertext));}
    catch(_){fail('RECOVERY_DECRYPT_FAILED');}
    const bytes=new Uint8Array(decrypted);let body;try{body=JSON.parse(fromUtf16(bytes));}finally{bytes.fill(0);}
    if(body.kind!=='meble-app-private-recovery'||body.version!==1||body.manifestHash!==await hash(JSON.stringify(body.manifest))||JSON.stringify(body.manifest)!==JSON.stringify(await manifest(body.data))
      ||JSON.stringify({local:body.data.local,session:body.data.session,runtime:body.data.runtime})!==JSON.stringify(expected.before)
      ||JSON.stringify(body.data.idb)!==JSON.stringify(expected.databases))fail('RECOVERY_FILE_INCOMPLETE');
    unchanged(expected.before);
    // Copying to IDB is allowed between export and verification, never activation/writes.
    const receipt=Object.freeze({fileHash:token.fileHash,sourceHash:token.sourceHash,verified:true});
    access();receipts.set(receipt,expected.before);return receipt;
  }
  function isReceipt(receipt,sourceHash){access();return receipts.has(receipt)&&receipt.sourceHash===sourceHash&&receipt.verified===true;}
  function assertReceiptCurrent(receipt){access();const before=receipts.get(receipt);if(!before)fail('RECOVERY_FILE_NOT_VERIFIED');unchanged(before);}
  function download(token){
    access();if(!prepared.has(token))fail('RECOVERY_PREPARATION_REQUIRED');
    unchanged(prepared.get(token).before);
    const blob=new Blob([token.text],{type:'application/json'}),url=URL.createObjectURL(blob),a=root.document.createElement('a');
    a.href=url;a.download='meble-app-private-recovery.encrypted.json';access();a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  FC.storageRecoveryExport={prepare,verify,download,isReceipt,assertReceiptCurrent,readFile};
})(typeof window!=='undefined'?window:globalThis);
