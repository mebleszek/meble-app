// Future private main-login handoff. NOT registered or called by the application.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  async function borrow({authSession,assertAccess,sdk}={}){
    if(!FC.firebasePilotLiveTransport||!FC.firebaseGlobalTransport||!FC.projectCloudPilot)throw Error('CLOUD_DEPENDENCY_UNAVAILABLE');
    // The existing adapter checks the actual shared App/Auth, UID and epoch.
    // There is no target flag, login, persistence, token or App initialization here.
    const shared=await FC.firebasePilotLiveTransport.create({authSession,assertAccess,sdk});
    try{
      const firestore=sdk?.firestore||await import('https://www.gstatic.com/firebasejs/'+FC.firebasePilotTransport.SDK_VERSION+'/firebase-firestore.js');
      const projects=FC.projectCloudPilot.create(shared.transport);
      const globals=FC.firebaseGlobalTransport.fromConnection({firestore,db:shared.db,session:authSession,assertAccess});
      return {projects,globals,async close(){await globals.close();await projects.close();}};
    }catch(error){await shared.transport.close();throw error;}
  }
  FC.cloudDataSession={borrow};
})();
