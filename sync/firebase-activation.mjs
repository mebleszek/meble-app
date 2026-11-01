// Production integration boundary. Import performs no auth, network or writes.
// Receives existing authenticated Firebase sessions; it never logs in or uses ADC.
import {assertEmulator,canonical,digest,equal,fail,id} from './local-first-values.mjs';
const active = new WeakMap(), PROJECT='mebleszek-meble-app';
export function assertGlobalConnection(connection) {
  if(connection?.db?.app?.options?.projectId==='demo-meble-app'){connection.assertAccess?.();return assertEmulator(connection);}
  const permit=active.get(connection);if(!permit)fail('LF_PRODUCTION_ACTIVATION_REQUIRED');return permit.assert();
}
// A global-only authorization never grants project access.
export function assertApplicationConnection(connection){
 if(connection?.db?.app?.options?.projectId==='demo-meble-app'){connection.assertAccess?.();return assertEmulator(connection);}
 const permit=active.get(connection);if(!permit?.application)fail('LF_APPLICATION_ACTIVATION_REQUIRED');return permit.assert();
}
export async function authorizeApplicationFirebase(input={}){
 const d=input.decision;
 if(d?.scope!=='application-data-sync'||d.projectProfile!=='business-project-v1'||d.globalDomains!==14
  ||d.oldWritersExcluded!==true||!/^[a-f0-9]{64}$/.test(d.applicationImageHash||''))fail('LF_APPLICATION_CUTOVER_NOT_PROVEN');
 return authorizeConnections(input,'application-data-sync');
}
export function authorizeGlobalFirebase(input={}){return authorizeConnections(input,'global-data-sync');}
function liveIdentity(connection,uid){
  const {db,auth,session,lease}=connection||{},native=db?._delegate||db,who=session?.identity();
  if(db?.app?.options?.projectId!==PROJECT||native?._databaseId?.projectId!==PROJECT||native._databaseId.database!=='(default)'
    ||native?._settings?.host!=='firestore.googleapis.com'||native._settings.ssl!==true||auth?.app!==db.app||auth.emulatorConfig
    ||auth.currentUser?.uid!==uid||who?.uid!==uid||!auth.currentUser.emailVerified
    ||!auth.currentUser.providerData?.some(p=>p.providerId==='google.com')||!Number.isSafeInteger(who.epoch))fail('LF_LIVE_IDENTITY_INVALID');
  lease.assert();if(lease.uid!==uid||lease.isValid()!==true)fail('LF_LIVE_ACCESS_UNCONFIRMED');return who;
}
// Call ONLY after separately authorized migration and activation. Public trust
// fingerprint must be established independently of the received decision.
async function authorizeConnections({decision,signature,publicKeySpki,ownerKeySha256,
  writer,reader,store,source,contract,rulesAccessToken,artifactSha256,request=fetch}={},scope){
  const d=structuredClone(decision);
  if(!d||d.domain!=='MEBLE_LOCAL_FIRST_ACTIVATION_v1'||d.scope!==scope
    ||d.projectId!==PROJECT||d.database!=='(default)'||!Number.isFinite(d.expiresAt)
    ||d.expiresAt<=Date.now()||d.expiresAt>Date.now()+900000||d.migrationApproved!==true
    ||d.sourcePreserved!==true||d.productionRulesApproved!==true
    ||!/^[a-f0-9]{64}$/.test(artifactSha256||'')||d.artifactSha256!==artifactSha256)fail('LF_SEPARATE_ACTIVATION_REQUIRED');
  id(d.ownerUid);id(d.deviceId);id(d.instanceId);
  if(!(publicKeySpki instanceof Uint8Array)||await digestBytes(publicKeySpki)!==ownerKeySha256)fail('LF_OWNER_TRUST_REQUIRED');
  const key=await crypto.subtle.importKey('spki',publicKeySpki,{name:'Ed25519'},false,['verify']);
  if(!(signature instanceof Uint8Array)||!await crypto.subtle.verify('Ed25519',key,signature,new TextEncoder().encode(canonical(d))))fail('LF_OWNER_SIGNATURE_INVALID');
  if(store.ownerUid!==d.ownerUid||store.deviceId!==d.deviceId||store.instanceId!==d.instanceId||store.name!==d.databaseName)fail('LF_MIGRATION_BINDING_INVALID');
  if(scope==='application-data-sync'){const image=await store.readApplication();if(!image||image.hash!==d.applicationImageHash)fail('LF_APPLICATION_CUTOVER_NOT_PROVEN');}
  const local=await store.snapshot('globals'),captured=contract.capture(source,Object.keys(contract.schemas));
  if(!local.replica||local.replica.dirty||local.operations.some(o=>o.phase!=='verified')
    ||await digest(local.replica.json)!==d.baselineHash||!equal(JSON.parse(local.replica.json),captured.model))fail('LF_MIGRATION_NOT_PROVEN');
  const a=liveIdentity(writer,d.ownerUid),b=liveIdentity(reader,d.ownerUid);
  if(writer.db.app===reader.db.app||writer.auth===reader.auth)fail('LF_INDEPENDENT_OWNER_REQUIRED');
  if(typeof rulesAccessToken!=='string'||rulesAccessToken.length<20)fail('LF_RULES_CREDENTIAL_REQUIRED');
  // Authenticated exact source/release read, after the signed decision is verified.
  const root='https://firebaserules.googleapis.com/v1/',releaseName='projects/'+PROJECT+'/releases/cloud.firestore';
  async function get(name){const r=await request(root+name,{method:'GET',redirect:'error',headers:{authorization:'Bearer '+rulesAccessToken},signal:AbortSignal.timeout(8000)});
    if(r.status!==200)fail('LF_RULES_UNCONFIRMED');return r.json();}
  const release=await get(releaseName);
  if(release.name!==releaseName||!/^projects\/mebleszek-meble-app\/rulesets\/[A-Za-z0-9_-]+$/.test(release.rulesetName||''))fail('LF_RULES_IDENTITY_INVALID');
  const ruleset=await get(release.rulesetName),again=await get(releaseName);
  if(!equal(release,again)||ruleset.name!==release.rulesetName||!equal(release,d.expectedRelease)
    ||await digest(canonical(ruleset.source))!==d.rulesSourceHash)fail('LF_RULES_CHANGED');
  captured.assertUnchanged();
  const assert=()=>{if(Date.now()>=d.expiresAt)fail('LF_ACTIVATION_EXPIRED');
    if(!equal(liveIdentity(writer,d.ownerUid),a)||!equal(liveIdentity(reader,d.ownerUid),b))fail('LF_AUTH_CHANGED');};
  assert();active.set(writer,{assert:()=>{assert();return a;},application:scope==='application-data-sync'});active.set(reader,{assert:()=>{assert();return b;},application:scope==='application-data-sync'});
  return Object.freeze({status:'AUTHORIZED_GLOBAL_CONNECTIONS',expiresAt:d.expiresAt,
    revoke(){active.delete(writer);active.delete(reader);}});
}
async function digestBytes(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
