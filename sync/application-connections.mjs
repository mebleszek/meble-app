// Reuse Google SDK sessions, never extract or store provider tokens ourselves.
import {createApplicationSyncGrant} from './application-sync-grant.mjs';
import {authorizeApplicationSession} from './firebase-activation.mjs';
import {fail} from './local-first-values.mjs';
const trustedSessions=new WeakMap();
export async function createApplicationConnections({window:w,authSession,lease,sdk,localAccess,release}){
 const fc=w.FC;w.__FC_MAIN_ACCESS__.assert();
 sdk=sdk||await fc.firebasePilotTransport.loadSdk();
 let session=authSession,ownWriter=false,currentLease=lease,verifier,gate,secondary,trustedContext,syncGrant,permit;
 try{
 const trusted=localAccess?.mode==='trusted';
 if(trusted){
  localAccess.assert();
  const options=authSession?.verificationContext(),config=options?.app.options||localAccess.firebaseConfig;
  if(!config)fail('LF_APPLICATION_AUTH_CONFIGURATION_REQUIRED');
  const cached=trustedSessions.get(w);
  if(cached&&cached.ownerUid!==localAccess.ownerUid)fail('LF_SYNC_AUTH_OWNER_MISMATCH');
  session=cached?.session||await fc.cloudAuth.create({target:options?.target||localAccess.target,
   appName:'meble-sync-trusted-writer-v1',firebaseConfig:{...config},emulator:options?.emulator||localAccess.emulator,sessionOnly:false,sdk});
  trustedContext=cached||{session,ownerUid:localAccess.ownerUid};trustedSessions.set(w,trustedContext);
  ownWriter=true;
  const app=sdk.app.getApp('meble-sync-trusted-writer-v1'),auth=sdk.auth.getAuth(app);
  if(options?.auth.currentUser)await sdk.auth.updateCurrentUser(auth,options.auth.currentUser);
  if(auth.currentUser?.uid!==localAccess.ownerUid)fail('LF_SYNC_AUTH_OWNER_MISMATCH');
  trustedContext.gate?.close();
  verifier=trustedContext.verifier||(trustedContext.verifier=fc.cloudAccessVerifier.create(session,{sdk:sdk.firestore}));
  await new Promise((resolve,reject)=>{
   gate=fc.authAccessGate.create(session,{verifyAccess:verifier.verify,watchAccess:verifier.watch,
    onAuthorized:value=>{currentLease=value;resolve();},onState:state=>{if(state.denied===true||state.status==='revoked')localAccess.deny?.();if(['error','revoked','unapproved','unauthenticated'].includes(state.status))reject(Error('LF_APPLICATION_ACCESS_UNCONFIRMED'));}});trustedContext.gate=gate;
  });
 }
 const ctx=session?.verificationContext(),identity=session?.identity();
 if(!ctx||!identity?.uid||currentLease?.uid!==identity.uid)fail('LF_APPLICATION_AUTH_REQUIRED');
 currentLease.assert();const f=sdk.firestore;
 const dbFor=app=>{const db=f.getFirestore(app);if(ctx.target==='emulator'&&db._settings.host!=='127.0.0.1:18080')f.connectFirestoreEmulator(db,'127.0.0.1',18080);return db;};
 const writerDb=dbFor(ctx.app),name='meble-sync-reader-'+crypto.randomUUID();
  secondary=await fc.cloudAuth.create({target:ctx.target,appName:name,firebaseConfig:{...ctx.app.options},emulator:ctx.emulator,sessionOnly:true,sdk});
  const readerApp=sdk.app.getApp(name),readerAuth=sdk.auth.getAuth(readerApp);
  await sdk.auth.updateCurrentUser(readerAuth,ctx.auth.currentUser);
  const readerCtx=secondary.verificationContext();
  if(readerCtx.auth.currentUser?.uid!==identity.uid)fail('LF_APPLICATION_OWNER_CHANGED');
  const readerDb=dbFor(readerApp);
  if(release)syncGrant=await createApplicationSyncGrant({release,window:w,session,db:readerDb,firestore:f,onRenew:()=>w.dispatchEvent(new w.Event('meble-sync-authorized'))});
  const guard=()=>{syncGrant?.assert();w.__FC_MAIN_ACCESS__.assert();localAccess?.assert();currentLease.assert();
   if(session.identity().uid!==identity.uid||session.identity().epoch!==identity.epoch)fail('LF_AUTH_CHANGED');};
  const leaseView={uid:identity.uid,assert:()=>currentLease.assert(),isValid:()=>currentLease.isValid()};
  const result={writer:{db:writerDb,auth:ctx.auth,session,lease:leaseView,firestore:f,assertAccess:guard},
   reader:{db:readerDb,auth:readerAuth,session:secondary,lease:leaseView,firestore:f,assertAccess:guard},
   // On logout revoke the independent persisted SDK login too. Local IDB/outbox
   // is retained; an already-submitted RPC can still have an uncertain outcome.
   async logout(){permit?.revoke();syncGrant?.close();gate?.close();if(ownWriter)await session.signOut();await secondary.signOut();},
   async retire(){permit?.revoke();syncGrant?.close();await f.terminate(readerDb);await secondary.close();},
   async close(){permit?.revoke();syncGrant?.close();gate?.close();await verifier?.close();await f.terminate(readerDb);await secondary.close();if(ownWriter){await f.terminate(writerDb);await session.close();}}};
  if(release)permit=authorizeApplicationSession({release,...result});return result;
 }catch(error){syncGrant?.close();gate?.close();await secondary?.close();throw error;}
}
