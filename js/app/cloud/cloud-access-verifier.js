// Read-only authorization probe. No business reads/writes, grants or durable cache.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const TTL_MS=45000,REFRESH_MS=30000,TIMEOUT_MS=8000;
  const failures=new WeakMap();
  const cooldowns=new Map();
  const isQuota=error=>/^(?:firestore\/)?resource-exhausted$/.test(error?.code||error?.message||'');
  function quotaGuard(project,uid){
    const key='meble-firestore-cooldown:'+project+':'+uid;
    function current(){
      const now=Date.now();
      let saved=0;try{saved=Number(window.localStorage.getItem(key));}catch(_){}
      const valid=until=>Number.isFinite(until)&&until>now&&until<=now+35000;
      const memory=cooldowns.get(key);
      return Math.max(valid(memory)?memory:0,valid(saved)?saved:0);
    }
    return {
      assert(){if(current()>Date.now())throw Object.assign(Error('resource-exhausted'),{code:'resource-exhausted'});},
      record(error){
        if(!isQuota(error)||current()>Date.now())return;
        const until=Date.now()+30000+Math.floor(Math.random()*5000);
        cooldowns.set(key,until);
        try{window.localStorage.setItem(key,String(until));}catch(_){}
      }
    };
  }
  const phases=['identity','context','sdk-import','firestore-init','server-read','snapshot-proof','transaction','transaction-proof','verify','watch','authorized-callback'];
  const types=['Error','TypeError','FirebaseError','DOMException','AbortError','NetworkError','TimeoutError'];
  const codes=['unavailable','deadline-exceeded','failed-precondition','invalid-argument','unauthenticated','permission-denied','resource-exhausted','cancelled','internal','unknown','unimplemented','already-exists','not-found','data-loss','aborted','AUTH_ACCESS_TIMEOUT','AUTH_ACCESS_UNCONFIRMED'];
  function sanitizeDiagnostic(value){
    return Object.freeze({phase:phases.includes(value?.phase)?value.phase:'unknown',type:types.includes(value?.type)?value.type:'UNKNOWN',code:codes.includes(value?.code)?value.code:'UNRECOGNIZED'});
  }
  function diagnostic(error,phase='verify'){
    if(error&&typeof error==='object'&&failures.has(error))return failures.get(error);
    const code=typeof error?.code==='string'?error.code.replace(/^firestore\//,''):codes.includes(error?.message)?error.message:null;
    return sanitizeDiagnostic({phase,type:error?.name,code});
  }
  function create(auth,{sdk}={}){
    let connection=null,closed=false;
    const watches=new Set();
    const fail=()=>{throw Error('AUTH_ACCESS_UNCONFIRMED');};
    function same(identity){
      if(closed||window.navigator?.onLine===false)fail();const now=auth.identity();
      if(now.uid!==identity.uid||now.epoch!==identity.epoch)fail();
    }
    async function connect(identity,trace){
      trace.phase='identity';
      same(identity);
      if(!connection)connection=(async()=>{
        trace.phase='context';const ctx=auth.verificationContext();
        if(ctx.auth.currentUser?.uid!==identity.uid)fail();
        if(ctx.target==='emulator'){
          if(!/^demo-/.test(ctx.app.options.projectId)||!['localhost','127.0.0.1'].includes(ctx.emulator?.host)||!Number.isInteger(ctx.emulator?.firestorePort)||ctx.emulator.firestorePort<1||ctx.emulator.firestorePort>65535)fail();
        }else if(ctx.target!=='live-auth'||ctx.app.options.projectId!=='mebleszek-meble-app')fail();
        trace.phase='sdk-import';const f=sdk||await import('https://www.gstatic.com/firebasejs/'+FC.firebasePilotTransport.SDK_VERSION+'/firebase-firestore.js');
        trace.phase='firestore-init';const db=f.initializeFirestore(ctx.app,{localCache:f.memoryLocalCache()});
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
    async function read(identity,trace){
      const quota=quotaGuard(auth.verificationContext().app.options.projectId,identity.uid);
      quota.assert();
      const {f,db}=await connect(identity,trace);
      try{
        trace.phase='server-read';const ref=f.doc(db,'appAccess',identity.uid);
        // First reject disabled/offline SDK networking. A server-marked snapshot
        // alone can reuse a listen target and its prior Rules decision. A fresh
        // read-only transaction forces a new authorization RPC, with no writes.
        const snapshot=await f.getDocFromServer(ref);trace.phase='snapshot-proof';
        const available=proof(snapshot,identity);if(!available.ok)return available;
        trace.phase='transaction';
        return await f.runTransaction(db,async tx=>{const snapshot=await tx.get(ref);trace.phase='transaction-proof';return proof(snapshot,identity);},{maxAttempts:1});
      }
      catch(e){quota.record(e);same(identity);if(e.code==='permission-denied')return {ok:false,denied:true};throw e;}
    }
    async function verify(identity){
      const trace={phase:'verify'};let timer;try{return await Promise.race([read(identity,trace),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('AUTH_ACCESS_TIMEOUT')),TIMEOUT_MS);})]);}
      catch(error){if(error&&typeof error==='object')failures.set(error,diagnostic(error,trace.phase));throw error;}
      finally{clearTimeout(timer);}
    }
    function watch(identity,onResult){
      let stopped=false,busy=false;
      const deliver=result=>{if(!stopped){try{same(identity);}catch(_){result={ok:false};}onResult(result);}};
      async function refresh(){if(busy||stopped)return;busy=true;try{deliver(await verify(identity));}catch(error){deliver({ok:false,errorDiagnostic:diagnostic(error,'watch')});}finally{busy=false;}}
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
  FC.cloudAccessVerifier={create,diagnostic,sanitizeDiagnostic,quotaGuard};
})();
