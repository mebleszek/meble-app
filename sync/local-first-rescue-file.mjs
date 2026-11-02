// No UI or startup hook. A future owner-approved UI must supply private context.
import {readRescueSnapshot} from './local-first-rescue-snapshot.mjs';
import {boundedJson,rescueManifest,refuse,RescueFailure} from './local-first-rescue-state.mjs';
import {analyzeRescue,simulateRescueCandidate} from './local-first-rescue-analysis.mjs';
import {equal} from './local-first-values.mjs';
import {readCurrentBusinessRam} from './local-first-rescue-ram.mjs';
export function createLocalFirstRescue(context){
 context={...context,readRam:context.readRam||(()=>readCurrentBusinessRam(context.window))};
 const w=context.window,codec=w.FC.storageRecoveryExport?.privateCodec,F=w.FC.backupArchiveFormat;
 if(!codec||!F)refuse('RESCUE_CODEC_REQUIRED');
 const prepared=new WeakMap(),verified=new WeakMap();
 const snapshot=(allowMissingRam=false)=>readRescueSnapshot({...context,allowMissingRam});
 const guard=()=>{try{const d=Object.getOwnPropertyDescriptor(w,'__FC_MAIN_ACCESS__');if(!d||d.writable!==false||d.configurable!==false||d.value.isValid()!==true)throw Error();d.value.assert();context.authorize();context.assertQuiescent();}catch(_){refuse('RESCUE_AUTH_OR_BUSY');}};
 async function safe(operation){try{return await operation();}catch(error){throw error instanceof RescueFailure?error:new RescueFailure('RESCUE_OPERATION_FAILED');}}
 function selected(input,event){
  guard();const getter=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'files')?.get;
  if(!(input instanceof w.HTMLInputElement)||input.type!=='file'||!input.isConnected||!(event instanceof w.Event)||event.type!=='change'||event.target!==input||event.isTrusted!==true||typeof getter!=='function')refuse('RESCUE_INDEPENDENT_FILE_REQUIRED');
  const files=getter.call(input);if(files?.length!==1||!(files[0] instanceof w.File))refuse('RESCUE_INDEPENDENT_FILE_REQUIRED');return files[0];
 }
 async function validateFile(text,password){
  let body;try{body=await codec.open(text,password);}catch(_){refuse('RESCUE_DECRYPT_OR_FORMAT');}guard();
  if(!body||Object.keys(body).sort().join(',')!=='captureId,data,kind,manifest,manifestHash,version'||body.kind!=='meble-app-local-first-private-rescue'||body.version!==1||typeof body.captureId!=='string')refuse('RESCUE_FILE_INVALID');
  const manifest=await rescueManifest(body.data,F.hash);
  if(!equal(body.manifest,manifest)||body.manifestHash!==await F.hash(boundedJson(manifest)))refuse('RESCUE_FILE_INTEGRITY');
  if(body.data.identity?.receipt?.ownerUid!==context.ownerUid||body.data.identity?.receipt?.name!==context.name)refuse('RESCUE_RECEIPT_INVALID');return body;
 }
 return Object.freeze({
  async prepare(password){return safe(async()=>{
   const data=await snapshot(),manifest=await rescueManifest(data,F.hash),body={kind:'meble-app-local-first-private-rescue',version:1,captureId:w.crypto.randomUUID(),data,manifest,manifestHash:await F.hash(boundedJson(manifest))};
   const text=await codec.seal(body,password),fileHash=await codec.fileHash(text);guard();
   if(!equal(data,await snapshot()))refuse('RESCUE_SOURCE_CHANGED');
   const token=Object.freeze({status:'BACKUP_PENDING',fileHash});prepared.set(token,{text,data,body,requested:false});return token;
  });},
  async download(token){return safe(async()=>{
   guard();const p=prepared.get(token);if(!p)refuse('RESCUE_PREPARATION_REQUIRED');if(!equal(p.data,await snapshot()))refuse('RESCUE_SOURCE_CHANGED');
   const blob=new w.Blob([p.text],{type:'application/json'}),url=w.URL.createObjectURL(blob),a=w.document.createElement('a');
   try{a.href=url;a.download='meble-app-local-first-rescue.encrypted.json';guard();a.click();p.requested=true;}catch(_){refuse('RESCUE_DOWNLOAD_FAILED');}
   finally{w.setTimeout(()=>w.URL.revokeObjectURL(url),60000);}return {status:'BACKUP_PENDING',independentReadRequired:true};
  });},
  async verifySelection(input,event,password,token){return safe(async()=>{
   const file=selected(input,event),p=token?prepared.get(token):null;
   if(token&&(!p||!p.requested))refuse('RESCUE_DOWNLOAD_REQUIRED');
   let text;try{text=await codec.readFile(file);}catch(_){refuse('RESCUE_FILE_READ_FAILED');}guard();const fileHash=await codec.fileHash(text);
   if(p&&fileHash!==token.fileHash)refuse('RESCUE_FILE_HASH_MISMATCH');
   const body=await validateFile(text,password);if(p&&!equal(body.data,p.data))refuse('RESCUE_FILE_INTEGRITY');
   const current=await snapshot(true);guard();
   const persisted=data=>({local:data.local,databases:data.databases,identity:data.identity});
   if(!equal(persisted(body.data),persisted(current)))refuse('RESCUE_SOURCE_CHANGED');
   // Restart may lose RAM/sessionStorage: the old file stays useful, but is
   // never claimed to cover a new document's unconfirmed state.
   const currentMatched=equal(body.data,current);
   const receipt=Object.freeze({status:currentMatched?'BACKUP_PASS':'FILE_VERIFIED_STALE',fileHash,currentMatched,completeWithinScope:currentMatched,otherTabsRam:false,cloudBackupConfirmed:false});
   verified.set(receipt,body.data);return receipt;
  });},
  analyzePrivate(receipt){guard();const data=verified.get(receipt);if(!data)refuse('RESCUE_VERIFIED_FILE_REQUIRED');return analyzeRescue(data,w.FC.globalDataContract,w.FC.globalDataDiagnostics);},
  simulate(receipt,explicitCandidate){guard();if(!verified.has(receipt))refuse('RESCUE_VERIFIED_FILE_REQUIRED');return simulateRescueCandidate(explicitCandidate,w.FC.globalDataContract);},
  summary(receipt){guard();if(!verified.has(receipt))refuse('RESCUE_VERIFIED_FILE_REQUIRED');return {status:receipt.status,repair:'REPAIR_BLOCKED',completeWithinScope:receipt.completeWithinScope,otherTabsRam:false,entireHeap:false,cloudBackupConfirmed:false};}
 });
}
