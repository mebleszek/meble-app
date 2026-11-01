// One-time owner deployment decision. Verification is local, never a LIVE probe.
import {applicationWriterFence} from './application-writer-fence.mjs';
import {canonical,digest,fail,id} from './local-first-values.mjs';
const releases=new WeakMap(),migrations=new WeakMap();
export async function verifyApplicationRelease({envelope,trustedKeySha256,origin}){
 const {decision,publicKeySpki,signature}=envelope||{};
 const fields=['activationId','database','domain','globalDomains','migrationApproved','origin','ownerUid','profile','projectId','protocol','rulesApproved','rulesSha256','sourcePreserved'];
 if(!decision||Object.keys(decision).sort().join(',')!==fields.join(',')||Object.keys(envelope).sort().join(',')!=='decision,publicKeySpki,signature'||decision.domain!=='MEBLE_APPLICATION_DEPLOYMENT_V1'||decision.protocol!==2
  ||decision.database!=='(default)'||decision.profile!=='business-project-v1'||decision.globalDomains!==14
  ||decision.migrationApproved!==true||decision.sourcePreserved!==true||decision.rulesApproved!==true
  ||!/^([a-f0-9]{64})$/.test(decision.rulesSha256||''))fail('LF_DEPLOYMENT_APPROVAL_REQUIRED');
 id(decision.ownerUid);id(decision.activationId);
 const url=new URL(origin),demo=decision.projectId==='demo-meble-app';
 if(demo?!['127.0.0.1','localhost'].includes(url.hostname):decision.projectId!=='mebleszek-meble-app'||url.origin!=='https://mebleszek.github.io'||url.pathname!=='/meble-app/')fail('LF_DEPLOYMENT_TARGET_INVALID');
 if(decision.origin!==url.href||!(publicKeySpki instanceof Uint8Array)||!(signature instanceof Uint8Array)
  ||!/^[a-f0-9]{64}$/.test(trustedKeySha256||''))fail('LF_OWNER_TRUST_REQUIRED');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',publicKeySpki)),hash=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==trustedKeySha256)fail('LF_OWNER_TRUST_REQUIRED');
 const key=await crypto.subtle.importKey('spki',publicKeySpki,{name:'Ed25519'},false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,signature,new TextEncoder().encode(canonical(decision))))fail('LF_OWNER_SIGNATURE_INVALID');
 const release=Object.freeze({});releases.set(release,Object.freeze(structuredClone(decision)));return release;
}
export function assertApplicationRelease(release,{ownerUid,name,window:w}={}){
 const d=releases.get(release);if(!d)fail('LF_DEPLOYMENT_APPROVAL_REQUIRED');
 if(ownerUid!==undefined&&ownerUid!==d.ownerUid)fail('LF_APPLICATION_OWNER_CHANGED');
 if(name!==undefined&&(d.projectId==='demo-meble-app'?!/^meble-lf-test-/.test(name):name!=='meble-local-first-v1'))fail('LF_MIGRATION_BINDING_INVALID');
 if(w&&new URL('./',w.document.baseURI).href!==d.origin)fail('LF_DEPLOYMENT_TARGET_INVALID');
 return d;
}
// Created only after a verified release, source snapshot and actual writer fence.
export async function prepareApplicationMigration({release,window:w,name,source,readNative,verifyFence}){
 assertApplicationRelease(release,{ownerUid:assertApplicationRelease(release).ownerUid,name,window:w});
 verifyFence=()=>applicationWriterFence(w);await verifyFence();w.__FC_MAIN_ACCESS__.assert();const hash=await digest(source);
 const migration=Object.freeze({});migrations.set(migration,{release,w,name,source:structuredClone(source),hash,readNative,verifyFence});return migration;
}
export async function assertApplicationMigration(migration,{name,ownerUid,rows}){
 const m=migrations.get(migration);if(!m)fail('LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN');
 const d=assertApplicationRelease(m.release,{ownerUid,name,window:m.w});
 await m.verifyFence();m.w.__FC_MAIN_ACCESS__.assert();
 for(const [key,value]of Object.entries(m.source))if(m.readNative(key)!==value||value!==null&&!['fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'].includes(key)&&rows[key]!==value)fail('LF_OLD_WRITER_OR_SOURCE_CHANGED');
 return {key:'source',version:1,activationId:d.activationId,hash:m.hash,rows:structuredClone(m.source)};
}
