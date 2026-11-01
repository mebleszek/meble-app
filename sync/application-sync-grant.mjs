// Routine read-only Rules admission, independent of administrative activation.
import {assertApplicationRelease} from './application-release.mjs';
import {fail} from './local-first-values.mjs';
export async function createApplicationSyncGrant({release,window:w,session,db,firestore:f,onRenew=()=>{}}){
 const d=assertApplicationRelease(release),initial=session.identity();let until=0,closed=false,pending=null;
 function identity(){const now=session.identity();if(closed||now.uid!==d.ownerUid||now.uid!==initial.uid||now.epoch!==initial.epoch)fail('LF_AUTH_CHANGED');}
 async function refresh(){if(pending)return pending;
  pending=(async()=>{identity();if(w.navigator.onLine===false)fail('LF_SYNC_ACCESS_UNCONFIRMED');
   let timer;const snap=await Promise.race([f.runTransaction(db,tx=>tx.get(f.doc(db,'syncAccess',d.ownerUid)),{maxAttempts:1}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('LF_SYNC_ACCESS_UNCONFIRMED')),8000);})]).finally(()=>clearTimeout(timer));identity();
   const v=snap.exists()?snap.data():null;
   if(snap.metadata.fromCache||snap.metadata.hasPendingWrites||!v||Object.keys(v).sort().join(',')!=='activationId,schemaVersion'||v.schemaVersion!==1||v.activationId!==d.activationId)fail('LF_SYNC_ACCESS_DENIED');
   until=Date.now()+45000;onRenew();
  })().catch(error=>{until=0;throw error;}).finally(()=>{pending=null;});return pending;
 }
 await refresh();const expire=()=>{until=0;},timer=setInterval(()=>{if(w.navigator.onLine!==false&&!w.document.hidden)void refresh().catch(expire);},30000);
 w.addEventListener('offline',expire);w.addEventListener('pagehide',expire);
 return {refresh,assert(){identity();if(w.navigator.onLine===false||Date.now()>=until)fail('LF_SYNC_ACCESS_UNCONFIRMED');},
  close(){closed=true;until=0;clearInterval(timer);w.removeEventListener('offline',expire);w.removeEventListener('pagehide',expire);}};
}
