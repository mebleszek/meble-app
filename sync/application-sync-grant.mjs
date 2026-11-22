// Routine read-only Rules admission, independent of administrative activation.
import {assertApplicationRelease} from './application-release.mjs';
import {fail} from './local-first-values.mjs';
export async function createApplicationSyncGrant({release,window:w,session,db,firestore:f,onRenew=()=>{},onExpire=()=>{}}){
 const d=assertApplicationRelease(release),initial=session.identity();let until=0,closed=false,pending=null,generation=0,pendingGeneration=0;
 function identity(){const now=session.identity();if(closed||now.uid!==d.ownerUid||now.uid!==initial.uid||now.epoch!==initial.epoch)fail('LF_AUTH_CHANGED');}
 function expire(){until=0;generation++;onExpire();}
 async function refresh(){if(pending)return pending;
  const observed=generation;pendingGeneration=observed;
  pending=(async()=>{identity();if(w.navigator.onLine===false)fail('LF_SYNC_ACCESS_UNCONFIRMED');
   let timer;const snap=await Promise.race([f.runTransaction(db,tx=>tx.get(f.doc(db,'syncAccess',d.ownerUid)),{maxAttempts:1}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('LF_SYNC_ACCESS_UNCONFIRMED')),8000);})]).finally(()=>clearTimeout(timer));identity();
   if(observed!==generation||w.navigator.onLine===false)fail('LF_SYNC_ACCESS_UNCONFIRMED');
   const v=snap.exists()?snap.data():null;
   if(snap.metadata.fromCache||snap.metadata.hasPendingWrites||!v||Object.keys(v).sort().join(',')!=='activationId,schemaVersion'||v.schemaVersion!==1||v.activationId!==d.activationId)fail('LF_SYNC_ACCESS_DENIED');
   const recovering=Date.now()>=until;
   until=Date.now()+45000;
   if(recovering)onRenew();
  })().catch(error=>{until=0;if(!closed)onExpire();throw error;}).finally(()=>{pending=null;});return pending;
 }
 async function resume(){
  if(closed||w.navigator.onLine===false||w.document.hidden)return;
  // A suspended request must finish before the new lifecycle can prove access.
  const ongoing=pending,observed=pendingGeneration;
  if(ongoing){try{await ongoing;}catch(_){}if(observed===generation)return;}
  if(closed||w.navigator.onLine===false||w.document.hidden)return;
  try{await refresh();}catch(_){}
 }
 // Coalesce lifecycle events at the same turn with the current proof request.
 let resuming=null,wanted=-1;const wake=()=>{
  wanted=generation;
  if(!resuming){const observed=generation;resuming=resume().finally(()=>{
   resuming=null;if(!closed&&wanted!==observed&&until<=Date.now())void wake();
  });}
  return resuming;
 };
 await refresh();const timer=setInterval(wake,30000);
 w.addEventListener('offline',expire);w.addEventListener('pagehide',expire);
 w.addEventListener('online',wake);w.addEventListener('pageshow',wake);w.document.addEventListener?.('visibilitychange',wake);
 return {refresh,assert(){identity();if(w.navigator.onLine===false||Date.now()>=until)fail('LF_SYNC_ACCESS_UNCONFIRMED');},
  close(){closed=true;until=0;generation++;clearInterval(timer);w.removeEventListener('offline',expire);w.removeEventListener('pagehide',expire);w.removeEventListener('online',wake);w.removeEventListener('pageshow',wake);w.document.removeEventListener?.('visibilitychange',wake);}};
}
