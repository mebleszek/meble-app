// Explicit Web SDK initialization only. No initialization or login at script load.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const SDK_VERSION='12.19.0';
  async function loadSdk(){
    const base='https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/';
    const [app,auth,firestore]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
    return {app,auth,firestore};
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
    let epoch=0,lastUid=null,closed=false,authFailure=false,unsub;
    const ready=new Promise(resolve=>{unsub=a.onAuthStateChanged(auth,user=>{const uid=user?.uid||null;if(uid!==lastUid){epoch++;lastUid=uid;}resolve();},()=>{authFailure=true;epoch++;resolve();});});
    function identity(){
      if(closed||authFailure)c.reject('CLOUD_AUTH_UNCONFIRMED');
      const user=auth.currentUser;if(!user)c.reject('CLOUD_AUTH_REQUIRED');
      if(!user.providerData.some(p=>p.providerId==='google.com'))c.reject('CLOUD_GOOGLE_REQUIRED');
      return {uid:user.uid,epoch};
    }
    function check(scope){const state=identity();if(state.uid!==scope.ownerUid)c.reject('CLOUD_AUTH_CHANGED');}
    function refs(packed){const d=packed.revision,base=f.doc(db,'users',d.ownerUid,'pilotProjects',d.projectId),rev=f.doc(base,'revisions',d.revisionId);return {base,rev,chunks:packed.chunks.map(chunk=>f.doc(rev,'chunks',String(chunk.index)))};}
    function scopeRef(scope){check(scope);return f.doc(db,'users',scope.ownerUid,'pilotProjects',scope.projectId);}
    function fresh(snap){if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)c.reject('CLOUD_REMOTE_UNCONFIRMED');return snap;}
    async function readHead(scope){const snap=fresh(await f.getDocFromServer(scopeRef(scope)));check(scope);return snap.exists()?c.headOf(snap.data(),scope):null;}
    async function stage(packed){
      const scope=packed.revision;check(scope);const r=refs(packed);
      // SDK disableNetwork does not gate every transaction RPC. Explicit server
      // reads also reject a caller-disabled connection before staging/publication.
      await readHead(scope);
      // Transactions are server-only; unlike setDoc/writeBatch they cannot queue
      // an offline authoritative write and later commit after local abandonment.
      await f.runTransaction(db,async tx=>{
        check(scope);const snapshots=await Promise.all([tx.get(r.rev),...r.chunks.map(ref=>tx.get(ref))]);snapshots.forEach(fresh);
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
        check(scope);
      },{maxAttempts:3});
      check(scope);
    }
    async function publish(packed,checkSource){
      const scope=packed.revision,r=refs(packed),next=c.candidateHead(packed);check(scope);await readHead(scope);
      await f.runTransaction(db,async tx=>{
        const snaps=await Promise.all([tx.get(r.base),tx.get(r.rev),...r.chunks.map(ref=>tx.get(ref))]);snaps.forEach(fresh);
        const head=snaps[0].exists()?c.headOf(snaps[0].data(),scope):null;
        // Idempotent retry of this exact attempted publication, never adoption of
        // an arbitrary latest revision or a silent overwrite of a newer device.
        if(c.equal(head,next)){await checkSource();check(scope);return;}
        if(!c.equal(head,packed.base))c.reject('CLOUD_WRITE_CONFLICT');
        if(!snaps[1].exists()||snaps.slice(2).some(s=>!s.exists()))c.reject('CLOUD_REVISION_INCOMPLETE');
        await c.verifyStored(packed,snaps[1].data(),snaps.slice(2).map(s=>s.data()));
        await checkSource();check(scope);
        tx.set(r.base,{...next,formatVersion:1,chunkCount:scope.chunkCount,byteLength:scope.byteLength,updatedAt:f.serverTimestamp()});
      },{maxAttempts:3});
      check(scope);
    }
    const transport={ready:()=>ready,identity,readHead,stage,publish,
      async signInGoogle(){await ready;if(closed)c.reject('CLOUD_AUTH_UNCONFIRMED');return a.signInWithPopup(auth,new a.GoogleAuthProvider());},
      async signOut(){epoch++;await a.signOut(auth);},
      async close(){closed=true;epoch++;unsub?.();await f.terminate(db);await sdk.app.deleteApp(app);}};
    return {transport,app,auth,db}; // Internal handles also allow real SDK emulator tests.
  }
  FC.firebasePilotTransport={SDK_VERSION,loadSdk,create};
})();
