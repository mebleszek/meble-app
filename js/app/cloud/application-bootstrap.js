// Normal business startup hook. Public deployment remains LIVE_BLOCKED.
(function(){
 'use strict';const fc=window.FC=window.FC||{};let configuration=null,runtime=null,starting=null,boot=null,lastContext=null,connectionsActive=null,refreshing=null,lastError=null,lastLocation=null,stage='idle';
 const note=error=>{lastLocation=String(error?.stack||'').match(/\/(?:sync|js\/app\/cloud)\/[a-z0-9/-]+\.(?:mjs|js):[0-9]+/)?.[0]||null;lastError=/^(?:(?:LF_|GLOBAL_|AUTH_|LOCAL_)[A-Z_]+|auth\/[a-z-]+)$/.test(error?.code||error?.message||'')?(error.code||error.message):'LF_STARTUP_UNCONFIRMED';};
 function demo(){if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('LF_PRODUCTION_ACTIVATION_REQUIRED');}
 fc.applicationStartup={
  configureEmulator(config){demo();if(configuration||!/^meble-lf-test-/.test(config?.name||''))throw Error('LF_APPLICATION_CONFIGURATION_REFUSED');configuration=config;},
  async beforeBusiness({ownerUid}){
   if(localStorage.getItem('meble_application_authority_v1')&&!configuration)throw Error('LF_APPLICATION_RUNTIME_REQUIRED');
   if(!configuration||runtime||boot)return;
   stage='preparing-source';
   await import('./global-data-contract.js');
   const {prepareEmulatorApplicationBoot}=await import('../../../sync/application-boot.mjs');
   try{boot=await prepareEmulatorApplicationBoot({window,ownerUid,name:configuration.name});stage='source-ready';}catch(error){note(error);throw error;}
  },
  async start(context){
   const {ownerUid,authSession,lease}=context;lastContext=context;
   if(!configuration){if(localStorage.getItem('meble_application_authority_v1'))throw Error('LF_APPLICATION_RUNTIME_REQUIRED');return {status:'LIVE_BLOCKED'};}
   demo();if(runtime?.status().state==='active')return runtime;if(starting)return starting;
   stage='opening-runtime';starting=(async()=>{
    for(const file of ['global-data-contract','cloud-pilot-contract','firebase-global-transport'])await import('./'+file+'.js');
    const connect=configuration.connections||((input)=>import('../../../sync/application-connections.mjs').then(m=>m.createApplicationConnections({window,...input,sdk:configuration.sdk})));
    const connections=navigator.onLine===false?{}:await connect(context);
    connectionsActive=connections;
    if(runtime){if(navigator.onLine!==false)await runtime.resume(connections);return runtime;}
    const {startNormalEmulatorApplication}=await import('../../../sync/application-runtime.mjs');
    runtime=await startNormalEmulatorApplication({window,ownerUid,name:configuration.name,boot,...connections});
    return runtime;
   })().then(value=>{stage='ready';return value;}).catch(error=>{note(error);throw error;}).finally(()=>{starting=null;});return starting;
  },
  revokeCloud(){void connectionsActive?.logout?.();},
  inspect:()=>({...runtime?.status(),state:runtime?.status().state||'not-activated',stage,code:lastError,location:lastLocation}),
  async refresh(context=lastContext){
   if(!configuration||!runtime||!context)return;if(refreshing)return refreshing;
   refreshing=(async()=>{try{
    window.__FC_MAIN_ACCESS__.assert();
    const connect=configuration.connections||((input)=>import('../../../sync/application-connections.mjs').then(m=>m.createApplicationConnections({window,...input,sdk:configuration.sdk})));
    stage='reconnect-auth';const next=await connect(context);window.__FC_MAIN_ACCESS__.assert();stage='reconnect-runtime';await runtime.resume(next);const old=connectionsActive;connectionsActive=next;await old?.retire?.();lastError=null;stage='ready';
   }catch(error){note(error);throw error;}})().finally(()=>{refreshing=null;});return refreshing;
  },
  close(){runtime?.close();void connectionsActive?.logout?.();}
 };
 const reconnect=()=>{if(runtime&&runtime.status().state!=='locked'&&navigator.onLine!==false&&window.__FC_MAIN_ACCESS__?.isValid())void fc.applicationStartup.refresh().catch(()=>{});};
 window.addEventListener('online',reconnect);document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconnect();});
})();
