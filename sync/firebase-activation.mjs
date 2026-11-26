// Production integration boundary. Import performs no auth, network or writes.
// Receives existing authenticated Firebase sessions; it never logs in or uses ADC.
import {assertApplicationRelease} from './application-release.mjs';
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
// P0-B requires a distinct, verified room deployment. Legacy project permits
// and one-time global activation can never grant this capability.
export function assertP0BConnection(connection){
 if(connection?.db?.app?.options?.projectId==='demo-meble-app'){connection.assertAccess?.();return assertEmulator(connection);}
 const permit=active.get(connection);if(!permit?.p0b)fail('LF_P0B_REGISTRY_REQUIRED');return permit.assert();
}
export function mapP0BConnection(connection){
 assertP0BConnection(connection);
 const f=connection.firestore,names={localFirstInvestors:'p0bRoomInvestors',localFirstProjects:'p0bRoomProjects',localFirstEditors:'p0bRoomEditors',p0bDeletionGroups:'p0bRoomGroups',p0bSettings:'p0bSettings'};
 const path=parts=>parts[0]==='users'&&names[parts[2]]?parts.map((v,i)=>i===2?names[v]:v):parts;
 const mapped={...connection,firestore:{...f,doc:(db,...parts)=>f.doc(db,...path(parts)),collection:(db,...parts)=>f.collection(db,...path(parts))}};
 // The adapter retains the original live permit and its revocation/identity
 // checks. Copying an object or its methods does not copy the capability.
 if(active.has(connection))active.set(mapped,{application:true,p0b:true,assert:()=>assertP0BConnection(connection)});
 return mapped;
}
// Daily operation: a verified deployment and fresh Google/Rules lease, no
// administrative token, short-lived owner signature or Rules API request.
export function authorizeApplicationSession({release,writer,reader}){
 const d=assertApplicationRelease(release);
 const who=connection=>{connection.assertAccess();return d.projectId==='demo-meble-app'?assertEmulator(connection):liveIdentity(connection,d.ownerUid);};
 const a=who(writer),b=who(reader);
 if(a.uid!==d.ownerUid||b.uid!==d.ownerUid||writer.db.app===reader.db.app||writer.auth===reader.auth)fail('LF_INDEPENDENT_OWNER_REQUIRED');
 const check=()=>{if(!equal(who(writer),a)||!equal(who(reader),b))fail('LF_AUTH_CHANGED');};
 check();active.set(writer,{assert:()=>{check();return a;},application:true,p0b:d.protocol===3});active.set(reader,{assert:()=>{check();return b;},application:true,p0b:d.protocol===3});
 return {revoke(){active.delete(writer);active.delete(reader);}};
}
// A separate SDK queue may stage immutable global records. It inherits only
// the parent's global capability; it never becomes a project/room writer.
export function authorizeGlobalStagingConnection(parent,staging){
 const original=assertGlobalConnection(parent);
 if(!staging||staging.db===parent.db||staging.db?.app===parent.db?.app||staging.auth===parent.auth)fail('LF_INDEPENDENT_OWNER_REQUIRED');
 const who=()=>{staging.assertAccess();return parent.db.app.options.projectId==='demo-meble-app'?assertEmulator(staging):liveIdentity(staging,original.uid);};
 const initial=who();if(initial.uid!==original.uid)fail('LF_AUTH_CHANGED');
 const check=()=>{if(!equal(assertGlobalConnection(parent),original))fail('LF_AUTH_CHANGED');const identity=who();if(!equal(identity,initial))fail('LF_AUTH_CHANGED');return identity;};
 check();active.set(staging,{assert:check});
 return {revoke(){active.delete(staging);}};
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
