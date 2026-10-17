// Prepared adapter only: deliberately absent from all application manifests.
// No App/Auth initialization, login, token handling or work at script evaluation.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  async function create({authSession,assertAccess,sdk}={}){
    const c=FC.cloudPilotContract,transport=FC.firebasePilotTransport;
    if(!c||!transport)throw Error('CLOUD_DEPENDENCY_UNAVAILABLE');
    if(typeof assertAccess!=='function'||typeof authSession?.verificationContext!=='function')c.reject('CLOUD_ACCESS_REQUIRED');
    const same=expected=>{
      assertAccess();const who=authSession.identity();
      if(who.uid!==expected.uid||who.epoch!==expected.epoch)c.reject('CLOUD_AUTH_CHANGED');
      return who;
    };
    assertAccess();const who=authSession.identity(),ctx=authSession.verificationContext();
    const em=ctx.emulator;
    if(ctx.auth?.currentUser?.uid!==who.uid||ctx.auth.app!==ctx.app)c.reject('CLOUD_AUTH_CHANGED');
    // Emulator support exercises this exact adapter with real shared SDK objects.
    if(ctx.target==='emulator'){
      if(!/^demo-[a-z0-9-]+$/.test(ctx.app.options.projectId)||!['localhost','127.0.0.1'].includes(em?.host)
        ||!Number.isInteger(em.firestorePort)||em.firestorePort<1||em.firestorePort>65535)c.reject('CLOUD_SCOPE_INVALID');
    }else if(ctx.target!=='live-auth'||ctx.app.options.projectId!=='mebleszek-meble-app')c.reject('CLOUD_LIVE_TRANSPORT_DISABLED');
    const f=sdk?.firestore||await import('https://www.gstatic.com/firebasejs/'+transport.SDK_VERSION+'/firebase-firestore.js');
    same(who);
    // The authorized verifier already initialized/configured this connection.
    // Never reconnect an emulator, change cache settings or terminate this db.
    const db=f.getFirestore(ctx.app);
    const borrowed=transport.fromConnection({firestore:f,db,session:authSession,assertAccess:()=>same(who)});
    return {transport:borrowed,app:ctx.app,auth:ctx.auth,db};
  }
  FC.firebasePilotLiveTransport={create};
})();
