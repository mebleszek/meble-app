// Normal business startup hook. Public deployment remains LIVE_BLOCKED.
(function(){
 'use strict';const fc=window.FC=window.FC||{};let configuration=null,runtime=null,starting=null,boot=null,lastContext=null,connectionsActive=null,refreshing=null,lastError=null,lastLocation=null,stage='idle';
 const note=error=>{lastLocation=String(error?.stack||'').match(/\/(?:sync|js\/app\/cloud)\/[a-z0-9/-]+\.(?:mjs|js):[0-9]+/)?.[0]||null;lastError=/^(?:(?:LF_|GLOBAL_|AUTH_|LOCAL_)[A-Z_]+|auth\/[a-z-]+)$/.test(error?.code||error?.message||'')?(error.code||error.message):'LF_STARTUP_UNCONFIRMED';};
 let release=null,configuring=null;
 async function deployment(){if(release||configuration)return;const slot=window.FC_APPLICATION_RELEASE;if(!slot?.envelope&&!slot?.trustedKeySha256)return;const {verifyApplicationRelease}=await import('../../../sync/application-release.mjs');release=await verifyApplicationRelease({...slot,origin:new URL('./',document.baseURI).href});configuration={name:'meble-local-first-v1'};}
 function connect(input){return configuration.connections?configuration.connections({...input,release}):import('../../../sync/application-connections.mjs').then(m=>m.createApplicationConnections({window,...input,release,sdk:configuration.sdk}));}
 function demo(){if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('LF_PRODUCTION_ACTIVATION_REQUIRED');}
 fc.applicationStartup={
  configureEmulator(config){demo();if(configuration||!/^meble-lf-test-/.test(config?.name||''))throw Error('LF_APPLICATION_CONFIGURATION_REFUSED');configuration=config;},
  configureReleaseEmulator(config){demo();if(configuration||configuring)throw Error('LF_APPLICATION_CONFIGURATION_REFUSED');configuring=(async()=>{const {verifyApplicationRelease,assertApplicationRelease}=await import('../../../sync/application-release.mjs');const verified=await verifyApplicationRelease({...config,origin:new URL('./',document.baseURI).href});if(assertApplicationRelease(verified).projectId!=='demo-meble-app')throw Error('LF_EMULATOR_REQUIRED');release=verified;configuration=config;})();return configuring;},
  async beforeBusiness({ownerUid}){
   if(configuring)await configuring;await deployment();
   if(localStorage.getItem('meble_application_authority_v1')&&!configuration)throw Error('LF_APPLICATION_RUNTIME_REQUIRED');
   if(!configuration||runtime||boot)return;
   stage='preparing-source';
   await import('./global-data-contract.js');
   const {prepareApplicationBoot}=await import('../../../sync/application-boot.mjs');
   try{boot=await prepareApplicationBoot({window,ownerUid,name:configuration.name,release});stage='source-ready';}catch(error){note(error);throw error;}
  },
  async start(context){
   const {ownerUid,authSession,lease}=context;lastContext=context;
   if(!configuration){if(localStorage.getItem('meble_application_authority_v1'))throw Error('LF_APPLICATION_RUNTIME_REQUIRED');return {status:'LIVE_BLOCKED'};}
   if(!release)demo();if(runtime?.status().state==='active')return runtime;if(starting)return starting;
   stage='opening-runtime';starting=(async()=>{
    for(const file of ['global-data-contract','cloud-pilot-contract','firebase-global-transport'])await import('./'+file+'.js');
    stage='authorizing-cloud';const connections=navigator.onLine===false?{}:await connect(context);stage='binding-runtime';
    connectionsActive=connections;
    if(runtime){if(navigator.onLine!==false)await runtime.resume(connections);return runtime;}
    const {startApplicationRuntime}=await import('../../../sync/application-runtime.mjs');
    runtime=await startApplicationRuntime({window,ownerUid,name:configuration.name,boot,release,onStage:value=>{stage=value;},...connections});
    return runtime;
   })().then(value=>{stage='ready';return value;}).catch(error=>{note(error);throw error;}).finally(()=>{starting=null;});return starting;
  },
  revokeCloud(){void connectionsActive?.logout?.();},
  inspect:()=>({...runtime?.status(),state:runtime?.status().state||'not-activated',stage,code:lastError,location:lastLocation}),
  async refresh(context=lastContext){
   if(!configuration||!runtime||!context)return;if(refreshing)return refreshing;
   refreshing=(async()=>{try{
    window.__FC_MAIN_ACCESS__.assert();
    stage='reconnect-auth';const next=await connect(context);window.__FC_MAIN_ACCESS__.assert();stage='reconnect-runtime';const old=connectionsActive;try{await runtime.resume(next);}finally{connectionsActive=next;await old?.retire?.();}lastError=null;stage='ready';
   }catch(error){note(error);throw error;}})().finally(()=>{refreshing=null;});return refreshing;
  },
  close(){runtime?.close();void connectionsActive?.logout?.();}
 };
 const reconnect=()=>{if(runtime&&runtime.status().state!=='locked'&&navigator.onLine!==false&&window.__FC_MAIN_ACCESS__?.isValid())void fc.applicationStartup.refresh().catch(()=>{});};
 window.addEventListener('online',reconnect);document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconnect();});
})();
