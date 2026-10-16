// CLOUD-2B: exact CLOUD-1B bytes, not another project model. No storage/network.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const CHUNK_BYTES=131072,MAX_BYTES=819200,MAX_CHUNKS=7;
  const reject=code=>{const error=new Error(code);error.code=code;throw error;};
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
  const hashId=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  const revisionId=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
  const headKeys=['ownerUid','investorId','projectId','generation','currentRevisionId','fileSha256','documentSha256','payloadSha256'];
  const manifestKeys=[...headKeys,'formatVersion','chunkCount','byteLength','updatedAt'];
  const canonical=value=>{
    if(!FC.projectExportContract)reject('CLOUD_EXPORT_DEPENDENCY');
    return FC.projectExportContract.canonical(value);
  };
  const equal=(a,b)=>canonical(a)===canonical(b);
  async function sha(bytes){
    if(!window.crypto?.subtle)reject('CLOUD_CRYPTO_UNAVAILABLE');
    const result=new Uint8Array(await window.crypto.subtle.digest('SHA-256',bytes));
    return Array.from(result,b=>b.toString(16).padStart(2,'0')).join('');
  }
  function encode(value){if(!window.TextEncoder)reject('CLOUD_CRYPTO_UNAVAILABLE');return new window.TextEncoder().encode(canonical(value));}
  function validHead(head,scope){
    if(head===null)return;
    if(!exact(head,headKeys)||head.ownerUid!==scope.ownerUid||head.investorId!==scope.investorId||head.projectId!==scope.projectId
      ||!Number.isSafeInteger(head.generation)||head.generation<1||!revisionId(head.currentRevisionId)
      ||!['fileSha256','documentSha256','payloadSha256'].every(key=>hashId(head[key])))reject('CLOUD_BASE_INVALID');
  }
  function headOf(data,scope){
    if(!exact(data,manifestKeys)||data.formatVersion!==1||!Number.isSafeInteger(data.chunkCount)||data.chunkCount<1||data.chunkCount>MAX_CHUNKS
      ||!Number.isSafeInteger(data.byteLength)||data.byteLength<1||data.byteLength>MAX_BYTES||data.chunkCount!==Math.ceil(data.byteLength/CHUNK_BYTES)
      ||!data.updatedAt||typeof data.updatedAt.toMillis!=='function')reject('CLOUD_MANIFEST_INVALID');
    const head=Object.fromEntries(headKeys.map(key=>[key,data[key]]));validHead(head,scope);return head;
  }
  async function pack(result,scope,base,newRevisionId){
    if(!result||result.ok!==true)reject(result?.code||'CLOUD_EXPORT_REFUSED');
    if(!['ownerUid','investorId','projectId'].every(key=>id(scope[key]))||!revisionId(newRevisionId))reject('CLOUD_SCOPE_INVALID');
    validHead(base,scope);
    const doc=JSON.parse(canonical(result.document)); // Detach all aliases before asynchronous hashing.
    if(!exact(doc,['kind','version','profile','projectSchemaVersion','metadata','payload','integrity'])
      ||doc.kind!=='meble-app-project-export'||doc.version!==1||doc.profile!=='native-project-v1'||doc.projectSchemaVersion!==12
      ||!exact(doc.metadata,['exportedAt','purpose'])||doc.metadata.purpose!=='pilot'
      ||typeof doc.metadata.exportedAt!=='string'||new Date(doc.metadata.exportedAt).toISOString()!==doc.metadata.exportedAt
      ||!exact(doc.payload,['investor','project'])||doc.payload.investor.id!==scope.investorId
      ||doc.payload.project.id!==scope.projectId||doc.payload.project.investorId!==scope.investorId
      ||!exact(doc.integrity,['algorithm','canonicalization','payloadSha256','documentSha256'])
      ||doc.integrity.algorithm!=='SHA-256'||doc.integrity.canonicalization!=='sorted-json-v1')reject('CLOUD_EXPORT_INVALID');
    // Reuse the closed CLOUD-1B validator; the real builder, not these temporary
    // validation flags or a hash, must establish synthetic eligibility/context.
    const projected=FC.projectExportContract.validate({...doc.payload.investor,meta:{testData:true}}, {...doc.payload.project,meta:{testData:true}});
    if(!projected.ok||!equal(projected.payload,doc.payload))reject('CLOUD_EXPORT_INVALID');
    const withoutIntegrity={...doc};delete withoutIntegrity.integrity;
    if(await sha(encode(doc.payload))!==doc.integrity.payloadSha256||await sha(encode(withoutIntegrity))!==doc.integrity.documentSha256)reject('CLOUD_INTEGRITY_INVALID');
    const bytes=encode(doc);
    if(bytes.byteLength>MAX_BYTES||bytes.byteLength!==result.utf8Bytes)reject('CLOUD_SIZE_INVALID');
    const chunks=[];
    for(let offset=0;offset<bytes.length;offset+=CHUNK_BYTES){const part=bytes.slice(offset,offset+CHUNK_BYTES);chunks.push({index:chunks.length,byteLength:part.length,bytes:part,sha256:await sha(part)});}
    const revision={...scope,revisionId:newRevisionId,formatVersion:1,generationCandidate:(base?.generation||0)+1,
      baseGeneration:base?.generation||0,baseRevisionId:base?.currentRevisionId||'',baseFileSha256:base?.fileSha256||'',
      baseDocumentSha256:base?.documentSha256||'',basePayloadSha256:base?.payloadSha256||'',chunkCount:chunks.length,byteLength:bytes.length,
      chunkSha256:chunks.map(chunk=>chunk.sha256),fileSha256:await sha(bytes),documentSha256:doc.integrity.documentSha256,payloadSha256:doc.integrity.payloadSha256};
    return {revision,chunks,base:base===null?null:JSON.parse(canonical(base))};
  }
  function candidateHead(packed){const d=packed.revision;return {ownerUid:d.ownerUid,investorId:d.investorId,projectId:d.projectId,generation:d.generationCandidate,currentRevisionId:d.revisionId,fileSha256:d.fileSha256,documentSha256:d.documentSha256,payloadSha256:d.payloadSha256};}
  async function verifyStored(packed,header,chunks){
    if(!header||!header.createdAt||typeof header.createdAt.toMillis!=='function')reject('CLOUD_REVISION_INVALID');
    const fields={...header};delete fields.createdAt;
    if(!equal(fields,packed.revision)||chunks.length!==packed.chunks.length)reject('CLOUD_REVISION_INVALID');
    const bytes=new Uint8Array(header.byteLength);let offset=0;
    for(let i=0;i<chunks.length;i++){
      const chunk=chunks[i],expected=packed.chunks[i];
      if(!exact(chunk,['index','byteLength','bytes','sha256'])||chunk.index!==i||chunk.byteLength!==expected.byteLength||chunk.sha256!==expected.sha256
        ||typeof chunk.bytes?.toUint8Array!=='function')reject('CLOUD_CHUNK_INVALID');
      const raw=chunk.bytes.toUint8Array();if(raw.length!==expected.byteLength||await sha(raw)!==expected.sha256)reject('CLOUD_INTEGRITY_INVALID');
      bytes.set(raw,offset);offset+=raw.length;
    }
    if(offset!==header.byteLength||await sha(bytes)!==header.fileSha256)reject('CLOUD_INTEGRITY_INVALID');
  }
  FC.cloudPilotContract={CHUNK_BYTES,MAX_BYTES,MAX_CHUNKS,reject,id,revisionId,canonical,equal,sha,validHead,headOf,pack,candidateHead,verifyStored};
})();
