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
    const business=doc.profile==='business-project-v1';
    if(!exact(doc,['kind','version','profile','projectSchemaVersion','metadata','payload','integrity'])
      ||doc.kind!=='meble-app-project-export'||doc.version!==1||(!business&&doc.profile!=='native-project-v1')||doc.projectSchemaVersion!==12
      ||!exact(doc.metadata,['exportedAt','purpose'])||doc.metadata.purpose!==(business?'business-sync':'pilot')
      ||typeof doc.metadata.exportedAt!=='string'||new Date(doc.metadata.exportedAt).toISOString()!==doc.metadata.exportedAt
      ||!exact(doc.payload,business?['investor','project','offers']:['investor','project'])||doc.payload.investor.id!==scope.investorId
      ||doc.payload.project.id!==scope.projectId||doc.payload.project.investorId!==scope.investorId
      ||!exact(doc.integrity,['algorithm','canonicalization','payloadSha256','documentSha256'])
      ||doc.integrity.algorithm!=='SHA-256'||doc.integrity.canonicalization!=='sorted-json-v1')reject('CLOUD_EXPORT_INVALID');
    // Reuse the closed CLOUD-1B validator; the real builder, not these temporary
    // validation flags or a hash, must establish synthetic eligibility/context.
    if(business){if(!FC.businessProjectContract || FC.businessProjectContract.validate(doc.payload)!==true)reject('CLOUD_EXPORT_INVALID');}
    else{
    const projected=FC.projectExportContract.validate({...doc.payload.investor,meta:{testData:true}}, {...doc.payload.project,meta:{testData:true}});
    if(!projected.ok||!equal(projected.payload,doc.payload))reject('CLOUD_EXPORT_INVALID');
    }
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
  // Independent reader: no writer handle, local project, storage or import.
  async function unpack(manifest,header,chunks,scope){
    const head=headOf(manifest,scope);
    if(!header||header.chunkCount!==manifest.chunkCount||header.byteLength!==manifest.byteLength
      ||header.generationCandidate!==head.generation||header.baseGeneration!==head.generation-1
      ||!Array.isArray(header.chunkSha256)||header.chunkSha256.length!==manifest.chunkCount
      ||!header.chunkSha256.every(hashId)||chunks.length!==manifest.chunkCount)reject('CLOUD_REVISION_INVALID');
    const bytes=new Uint8Array(manifest.byteLength);let offset=0;
    for(let i=0;i<chunks.length;i++){
      const chunk=chunks[i],length=Math.min(CHUNK_BYTES,bytes.length-offset);
      if(!exact(chunk,['index','byteLength','bytes','sha256'])||chunk.index!==i||chunk.byteLength!==length
        ||chunk.sha256!==header.chunkSha256[i]||typeof chunk.bytes?.toUint8Array!=='function')reject('CLOUD_CHUNK_INVALID');
      const raw=chunk.bytes.toUint8Array();
      if(raw.length!==length||await sha(raw)!==chunk.sha256)reject('CLOUD_INTEGRITY_INVALID');
      bytes.set(raw,offset);offset+=raw.length;
    }
    if(offset!==bytes.length||await sha(bytes)!==head.fileSha256)reject('CLOUD_INTEGRITY_INVALID');
    let document;
    try{
      if(!window.TextDecoder)reject('CLOUD_EXPORT_DEPENDENCY');
      const text=new window.TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
      document=JSON.parse(text);
      if(text!==canonical(document))reject('CLOUD_EXPORT_INVALID');
    }catch(_){reject('CLOUD_EXPORT_INVALID');}
    const base=header.baseGeneration===0?null:{ownerUid:scope.ownerUid,investorId:scope.investorId,projectId:scope.projectId,
      generation:header.baseGeneration,currentRevisionId:header.baseRevisionId,fileSha256:header.baseFileSha256,
      documentSha256:header.baseDocumentSha256,payloadSha256:header.basePayloadSha256};
    // Reuse exactly the CLOUD-1B schema, PCV/reference validator and hashes.
    const packed=await pack({ok:true,document,utf8Bytes:bytes.length},scope,base,head.currentRevisionId);
    if(!equal(candidateHead(packed),head))reject('CLOUD_REVISION_INVALID');
    await verifyStored(packed,header,chunks);
    return {document,bytes,utf8Bytes:bytes.length,dependencies:FC.projectExportContract.dependencies(document.payload),
      warnings:['Catalogs, prices, global grain settings and offer history are not included; identical quotation is not guaranteed.']};
  }
  FC.cloudPilotContract={CHUNK_BYTES,MAX_BYTES,MAX_CHUNKS,reject,id,revisionId,canonical,equal,sha,validHead,headOf,pack,candidateHead,verifyStored,unpack};
})();
