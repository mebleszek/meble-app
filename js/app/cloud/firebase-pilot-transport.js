// Explicit Web SDK initialization only. No initialization or login at script load.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const SDK_VERSION='12.19.0';
  let authSdkPromise;
  function loadAuthSdk(){
    // Auth test page must not import or initialize Firestore.
    if(!authSdkPromise){
      const base='https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/';
      authSdkPromise=Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js')])
        .then(([app,auth])=>({app,auth})).catch(error=>{authSdkPromise=null;throw error;});
    }
    return authSdkPromise;
  }
  async function loadSdk(){
    const [sdk,firestore]=await Promise.all([loadAuthSdk(),import('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-firestore.js')]);
    return {...sdk,firestore};
  }
  function observeIdentity(auth,a,onState=()=>{}){
    let epoch=0,lastUid=null,closed=false,failed=false,unsubscribe;
    const reject=code=>{const error=new Error(code);error.code=code;throw error;};
    const ready=new Promise(resolve=>{
      unsubscribe=a.onAuthStateChanged(auth,user=>{
        const uid=user?.uid||null;if(uid!==lastUid){epoch++;lastUid=uid;}
        onState({uid,epoch,failed:false});resolve();
      },()=>{failed=true;epoch++;onState({uid:null,epoch,failed:true});resolve();});
    });
    return {ready:()=>ready,identity(){
      if(closed||failed)reject('CLOUD_AUTH_UNCONFIRMED');
      const user=auth.currentUser;if(!user)reject('CLOUD_AUTH_REQUIRED');
      if(!user.providerData.some(p=>p.providerId==='google.com'))reject('CLOUD_GOOGLE_REQUIRED');
      return {uid:user.uid,epoch};
    },invalidate(){epoch++;},close(){closed=true;epoch++;unsubscribe?.();}};
  }
  async function create(options){
    const c=FC.cloudPilotContract,opts=options||{},em=opts.emulator;
    if(!c)throw Error('CLOUD_CONTRACT_MISSING');
    // This preparation stage has NO live transport. No real Firebase config,
    // default project, production credentials or persistent/offline write queue.
    if(opts.target!=='emulator'||!/^demo-[a-z0-9-]+$/.test(opts.projectId||'')||!em
      ||!['127.0.0.1','localhost'].includes(em.host)||![em.authPort,em.firestorePort].every(p=>Number.isInteger(p)&&p>0&&p<65536))c.reject('CLOUD_LIVE_TRANSPORT_DISABLED');
    const sdk=opts.sdk||await loadSdk(),f=sdk.firestore,a=sdk.auth;
    const app=sdk.app.initializeApp({projectId:opts.projectId,apiKey:'demo-emulator-only',appId:'demo-emulator-only',authDomain:opts.projectId+'.firebaseapp.com'},opts.appName);
    const auth=a.initializeAuth(app,{persistence:a.inMemoryPersistence,...(typeof a.browserPopupRedirectResolver==='function'?{popupRedirectResolver:a.browserPopupRedirectResolver}:{})});
    a.connectAuthEmulator(auth,'http://'+em.host+':'+em.authPort,{disableWarnings:true});
    const db=f.initializeFirestore(app,{localCache:f.memoryLocalCache()});f.connectFirestoreEmulator(db,em.host,em.firestorePort);
    const observer=observeIdentity(auth,a);
    const transport=fromConnection({firestore:f,db,session:observer,dispose:async()=>{observer.close();await f.terminate(db);await sdk.app.deleteApp(app);}});
    transport.signInGoogle=async()=>{await transport.ready();transport.assertOpen();return a.signInWithPopup(auth,new a.GoogleAuthProvider());};
    transport.signOut=async()=>{transport.assertOpen();observer.invalidate();await a.signOut(auth);};
    return {transport,app,auth,db}; // Internal handles also allow real SDK emulator tests.
  }
  // Connection ownership is explicit. A borrowed transport never owns Auth,
  // its observer, SDK persistence, Firestore termination or Firebase App deletion.
  function fromConnection({firestore:f,db,session,assertAccess=()=>{},dispose=async()=>{}}){
    const c=FC.cloudPilotContract;let closed=false;
    if(!c||!f||!db||typeof session?.identity!=='function'||typeof assertAccess!=='function')throw Error('CLOUD_DEPENDENCY_UNAVAILABLE');
    function assertOpen(){if(closed)c.reject('CLOUD_CLIENT_CLOSED');}
    function identity(){
      assertOpen();
      try{const value=assertAccess();if(value&&typeof value.then==='function')c.reject('CLOUD_ACCESS_UNCONFIRMED');}
      catch(_){c.reject('CLOUD_ACCESS_UNCONFIRMED');}
      return session.identity();
    }
    function check(scope,expected){
      const state=identity();
      if(state.uid!==scope.ownerUid||!Number.isSafeInteger(state.epoch)||(expected&&(state.uid!==expected.uid||state.epoch!==expected.epoch)))c.reject('CLOUD_AUTH_CHANGED');
      return state;
    }
    function refs(packed){const d=packed.revision,base=f.doc(db,'users',d.ownerUid,'pilotProjects',d.projectId),rev=f.doc(base,'revisions',d.revisionId);return {base,rev,chunks:packed.chunks.map(chunk=>f.doc(rev,'chunks',String(chunk.index)))};}
    function scopeRef(scope){check(scope);return f.doc(db,'users',scope.ownerUid,'pilotProjects',scope.projectId);}
    function fresh(snap){if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)c.reject('CLOUD_REMOTE_UNCONFIRMED');return snap;}
    async function readManifest(scope){
      const who=check(scope),ref=scopeRef(scope);
      fresh(await f.getDocFromServer(ref));check(scope,who);
      // A new transaction forces Rules to re-evaluate revoked grants, even if
      // an earlier server listen target still remembers its authorization.
      const snap=await f.runTransaction(db,async tx=>{check(scope,who);const value=fresh(await tx.get(ref));check(scope,who);return value;},{maxAttempts:3});
      check(scope,who);if(!snap.exists())return null;
      const data=snap.data();c.headOf(data,scope);return data;
    }
    async function readHead(scope){const value=await readManifest(scope);return value===null?null:c.headOf(value,scope);}
    async function readProject(scope){
      const who=check(scope),manifest=await readManifest(scope);check(scope,who);
      if(!manifest)c.reject('CLOUD_PROJECT_NOT_FOUND');
      const head=c.headOf(manifest,scope),base=f.doc(db,'users',scope.ownerUid,'pilotProjects',scope.projectId),revision=f.doc(base,'revisions',head.currentRevisionId);
      const refs=[revision,...Array.from({length:manifest.chunkCount},(_,i)=>f.doc(revision,'chunks',String(i)))];
      const snaps=await f.runTransaction(db,async tx=>{check(scope,who);const values=await Promise.all(refs.map(ref=>tx.get(ref)));values.forEach(fresh);check(scope,who);return values;},{maxAttempts:1});
      check(scope,who);if(snaps.some(s=>!s.exists()))c.reject('CLOUD_REVISION_INCOMPLETE');
      const result=await c.unpack(manifest,snaps[0].data(),snaps.slice(1).map(s=>s.data()),scope);check(scope,who);
      const current=await readManifest(scope);check(scope,who);
      if(!current||!c.equal(c.headOf(current,scope),head)||current.chunkCount!==manifest.chunkCount
        ||current.byteLength!==manifest.byteLength||current.updatedAt.toMillis()!==manifest.updatedAt.toMillis())c.reject('CLOUD_READ_CONFLICT');
      return {...result,head};
    }
    async function stage(packed){
      const scope=packed.revision,who=check(scope);const r=refs(packed);
      // SDK disableNetwork does not gate every transaction RPC. Explicit server
      // reads also reject a caller-disabled connection before staging/publication.
      await readHead(scope);check(scope,who);
      // Transactions are server-only; unlike setDoc/writeBatch they cannot queue
      // an offline authoritative write and later commit after local abandonment.
      await f.runTransaction(db,async tx=>{
        check(scope,who);const snapshots=await Promise.all([tx.get(r.rev),...r.chunks.map(ref=>tx.get(ref))]);snapshots.forEach(fresh);
        const existing=snapshots[0];
        if(existing.exists()){
          const data=existing.data(),copy={...data};delete copy.createdAt;
          if(!c.equal(copy,scope))c.reject('CLOUD_REVISION_CONFLICT');
        }else tx.set(r.rev,{...scope,createdAt:f.serverTimestamp()});
        for(let i=0;i<packed.chunks.length;i++){
          const chunk=packed.chunks[i],data={...chunk,bytes:f.Bytes.fromUint8Array(chunk.bytes)};
          if(snapshots[i+1].exists()){
            const old=snapshots[i+1].data();
            if(!c.equal({...old,bytes:null},{...data,bytes:null})||typeof old.bytes?.toUint8Array!=='function'
              ||await c.sha(old.bytes.toUint8Array())!==chunk.sha256)c.reject('CLOUD_CHUNK_CONFLICT');
          }else tx.set(r.chunks[i],data);
        }
        check(scope,who);
      },{maxAttempts:3});
      check(scope,who);
    }
    async function publish(packed,checkSource){
      const scope=packed.revision,who=check(scope),r=refs(packed),next=c.candidateHead(packed);await readHead(scope);check(scope,who);
      await f.runTransaction(db,async tx=>{
        check(scope,who);
        const snaps=await Promise.all([tx.get(r.base),tx.get(r.rev),...r.chunks.map(ref=>tx.get(ref))]);snaps.forEach(fresh);
        const head=snaps[0].exists()?c.headOf(snaps[0].data(),scope):null;
        // Idempotent retry of this exact attempted publication, never adoption of
        // an arbitrary latest revision or a silent overwrite of a newer device.
        if(c.equal(head,next)){await checkSource();check(scope,who);return;}
        if(!c.equal(head,packed.base))c.reject('CLOUD_WRITE_CONFLICT');
        if(!snaps[1].exists()||snaps.slice(2).some(s=>!s.exists()))c.reject('CLOUD_REVISION_INCOMPLETE');
        await c.verifyStored(packed,snaps[1].data(),snaps.slice(2).map(s=>s.data()));
        await checkSource();check(scope,who);
        tx.set(r.base,{...next,formatVersion:1,chunkCount:scope.chunkCount,byteLength:scope.byteLength,updatedAt:f.serverTimestamp()});
      },{maxAttempts:3});
      check(scope,who);
    }
    return {ready:async()=>{assertOpen();if(session.ready)await session.ready();assertOpen();},identity,assertOpen,readHead,readProject,stage,publish,
      async close(){if(closed)return;closed=true;await dispose();}};
  }
  FC.firebasePilotTransport={SDK_VERSION,loadAuthSdk,observeIdentity,loadSdk,create,fromConnection};
})();
