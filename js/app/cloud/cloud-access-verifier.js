// Read-only authorization probe. No business reads/writes, grants or durable cache.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const TTL_MS=45000,REFRESH_MS=30000,TIMEOUT_MS=8000;
  function create(auth,{sdk}={}){
    let connection=null,closed=false;
    const watches=new Set();
    const fail=()=>{throw Error('AUTH_ACCESS_UNCONFIRMED');};
    function same(identity){
      if(closed||window.navigator?.onLine===false)fail();const now=auth.identity();
      if(now.uid!==identity.uid||now.epoch!==identity.epoch)fail();
    }
    async function connect(identity){
      same(identity);
      if(!connection)connection=(async()=>{
        const ctx=auth.verificationContext();
        if(ctx.auth.currentUser?.uid!==identity.uid)fail();
        if(ctx.target==='emulator'){
          if(!/^demo-/.test(ctx.app.options.projectId)||!['localhost','127.0.0.1'].includes(ctx.emulator?.host)||!Number.isInteger(ctx.emulator?.firestorePort)||ctx.emulator.firestorePort<1||ctx.emulator.firestorePort>65535)fail();
        }else if(ctx.target!=='live-auth'||ctx.app.options.projectId!=='mebleszek-meble-app')fail();
        const f=sdk||await import('https://www.gstatic.com/firebasejs/'+FC.firebasePilotTransport.SDK_VERSION+'/firebase-firestore.js');
        const db=f.initializeFirestore(ctx.app,{localCache:f.memoryLocalCache()});
        if(ctx.target==='emulator')f.connectFirestoreEmulator(db,ctx.emulator.host,ctx.emulator.firestorePort);
        return {f,db};
      })().catch(error=>{connection=null;throw error;});
      const result=await connection;same(identity);return result;
    }
    function proof(snapshot,identity){
      same(identity);
      if(snapshot.metadata?.fromCache!==false||snapshot.metadata?.hasPendingWrites!==false)fail();
      if(!snapshot.exists())return {ok:false,denied:true};
      const data=snapshot.data();
      if(snapshot.id!==identity.uid||!data||Object.keys(data).length!==1||data.schemaVersion!==1)fail();
      return {ok:true,uid:identity.uid,validUntil:Date.now()+TTL_MS};
    }
    async function read(identity){
      const {f,db}=await connect(identity);
      try{
        const ref=f.doc(db,'appAccess',identity.uid);
        // First reject disabled/offline SDK networking. A server-marked snapshot
        // alone can reuse a listen target and its prior Rules decision. A fresh
        // read-only transaction forces a new authorization RPC, with no writes.
        const available=proof(await f.getDocFromServer(ref),identity);if(!available.ok)return available;
        return await f.runTransaction(db,async tx=>proof(await tx.get(ref),identity),{maxAttempts:1});
      }
      catch(e){same(identity);if(e.code==='permission-denied')return {ok:false,denied:true};throw e;}
    }
    async function verify(identity){
      let timer;try{return await Promise.race([read(identity),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('AUTH_ACCESS_TIMEOUT')),TIMEOUT_MS);})]);}
      finally{clearTimeout(timer);}
    }
    function watch(identity,onResult){
      let stopped=false,busy=false;
      const deliver=result=>{if(!stopped){try{same(identity);}catch(_){result={ok:false};}onResult(result);}};
      async function refresh(){if(busy||stopped)return;busy=true;try{deliver(await verify(identity));}catch(_){deliver({ok:false});}finally{busy=false;}}
      // Events shorten the fail-closed window; expiry still guards silent outages
      // and suspended/throttled timers. Cached snapshots never renew a lease.
      const offline=()=>deliver({ok:false}),blur=()=>{if(window.document?.hidden)offline();};
      window.addEventListener?.('offline',offline);
      window.addEventListener?.('pagehide',offline);
      window.document?.addEventListener('visibilitychange',blur);
      const interval=setInterval(refresh,REFRESH_MS);
      const stop=()=>{if(stopped)return;stopped=true;clearInterval(interval);window.removeEventListener?.('offline',offline);window.removeEventListener?.('pagehide',offline);window.document?.removeEventListener('visibilitychange',blur);watches.delete(stop);};
      watches.add(stop);
      return stop;
    }
    return {verify,watch,async close(){closed=true;for(const stop of [...watches])stop();if(connection){try{const {f,db}=await connection;await f.terminate(db);}catch(_){}}}};
  }
  FC.cloudAccessVerifier={create};
})();
