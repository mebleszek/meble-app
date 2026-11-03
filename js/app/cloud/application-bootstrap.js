// Normal business startup hook. Public deployment remains LIVE_BLOCKED.
(function(){
 'use strict';const fc=window.FC=window.FC||{};let configuration=null,runtime=null,starting=null,boot=null,lastContext=null,connectionsActive=null,refreshing=null,lastError=null,lastLocation=null,stage='idle';
 // Diagnostic vocabulary is closed: never retain raw messages, stacks, IDs or payloads.
 const diagnosticCodes=new Set(`
  LF_ACK_UNRESOLVED LF_ACTIVATION_EXPIRED LF_ACTIVATION_RECEIPT_CHANGED LF_ACTIVE_FORM_PROTECTED LF_ACTIVE_RAM_PROTECTED
  LF_APPLICATION_ACCESS_UNCONFIRMED LF_APPLICATION_ACTIVATION_REQUIRED LF_APPLICATION_ALREADY_INITIALIZED LF_APPLICATION_ALREADY_INSTALLED LF_APPLICATION_AUTH_CONFIGURATION_REQUIRED
  LF_APPLICATION_AUTH_REQUIRED LF_APPLICATION_BUSY LF_APPLICATION_CLEAR_REFUSED LF_APPLICATION_CLOSED LF_APPLICATION_CLOSED_OR_OLD_WRITER
  LF_APPLICATION_CONFIGURATION_REFUSED LF_APPLICATION_CONFLICT LF_APPLICATION_CUTOVER_NOT_PROVEN LF_APPLICATION_DEPENDENCIES_REQUIRED LF_APPLICATION_DRAFT_RECOVERY_REQUIRED
  LF_APPLICATION_EDIT_ACTIVE LF_APPLICATION_IMAGE_LOST LF_APPLICATION_INITIALIZATION_REQUIRED LF_APPLICATION_INSTALL_REFUSED LF_APPLICATION_INTEGRITY
  LF_APPLICATION_INVALID LF_APPLICATION_LOCAL_APPLY_NOT_APPROVED LF_APPLICATION_MIGRATION_NOT_APPROVED LF_APPLICATION_NOT_INITIALIZED LF_APPLICATION_OWNER_CHANGED
  LF_APPLICATION_PROJECT_PROFILE_BLOCKED LF_APPLICATION_PROJECT_SCOPE_REQUIRED LF_APPLICATION_RUNTIME_REQUIRED LF_APPLICATION_SAVE_REQUIRED LF_APPLICATION_SAVE_UNCONFIRMED
  LF_APPLICATION_SCOPE_REFUSED LF_APPLICATION_UNCONFIRMED LF_ARCHIVE_RESTORE_PROTOCOL_REQUIRED LF_ASYNC_TRANSACTION_REQUIRED LF_AUTH_CHANGED
  LF_AUTH_INVALID LF_BLOCKER_INVALID LF_BUSINESS_PROJECT_INVALID LF_CHANNEL_CONFLICT LF_CHECKPOINT_DATA_CHANGED
  LF_CLOSED LF_CLOSED_RESULT_UNCONFIRMED LF_CONFLICT LF_DEPENDENCY_REQUIRED LF_DEPLOYMENT_APPROVAL_REQUIRED
  LF_DEPLOYMENT_TARGET_INVALID LF_DRAFT_SESSION_REQUIRED LF_EDITOR_BUSY_OR_HEAD_CHANGED LF_EDITOR_CONFLICT LF_EDITOR_OR_DEPENDENCY_CONFLICT
  LF_EDITOR_RECOVERY_BLOCKED LF_EDITOR_REQUIRED LF_EMULATOR_REQUIRED LF_EXPECTED_REVISION_REQUIRED LF_FACTORY_SOURCE_REQUIRED
  LF_GLOBAL_ALIAS_CONFLICT LF_GLOBAL_CHANNEL_REQUIRED LF_GLOBAL_DEPENDENCIES_STALE LF_GLOBAL_DEPENDENCIES_UNCONFIRMED LF_GLOBAL_DEPENDENCY_INCOMPLETE
  LF_GLOBAL_DEPENDENCY_INTEGRITY LF_HANDOVER_CONFLICT LF_HANDOVER_CONTENT_MISMATCH LF_HANDOVER_PENDING_LOCAL_WORK LF_HANDOVER_UNCERTAIN
  LF_HISTORY_OWNER_REQUIRED LF_IDB_ABORTED LF_IDB_BLOCKED LF_IDB_IDENTITY_OR_LOSS LF_IDB_MISSING_OR_UNAVAILABLE
  LF_IDB_QUOTA LF_IDB_SCHEMA_OR_CLOSED LF_IDB_TRANSACTION_UNAVAILABLE LF_ID_INVALID LF_INDEPENDENT_OWNER_REQUIRED
  LF_INITIAL_GLOBAL_CONFLICT LF_INITIAL_PROJECT_CONFLICT LF_INSTALLATION_RECEIPT_INVALID LF_INSTALLATION_RECEIPT_LOST LF_INSTALLATION_RECEIPT_UNCONFIRMED
  LF_ISOLATED_STORAGE_REQUIRED LF_LEGACY_BOOT_WRITE_REFUSED LF_LEGACY_MATERIAL_COPY_CONFLICT LF_LIVE_ACCESS_UNCONFIRMED LF_LIVE_IDENTITY_INVALID
  LF_LOCAL_ACK_UNCONFIRMED LF_LOCAL_CONFLICT LF_LOCAL_INTEGRITY LF_LOCAL_PROJECT_NOT_READY LF_MIGRATION_BINDING_INVALID
  LF_MIGRATION_NOT_PROVEN LF_MIGRATION_RECOVERY_UNCONFIRMED LF_OFFLINE LF_OFFLINE_EDITOR_REQUIRED LF_OLD_WRITER_DETECTED
  LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN LF_OLD_WRITER_OR_OWNER_CONFLICT LF_OLD_WRITER_OR_SOURCE_CHANGED LF_ONLINE_INSTALLATION_REQUIRED LF_ONLINE_NEW_PROJECT_REQUIRED
  LF_OPERATION_REUSED LF_OTHER_APPLICATION_CLIENT LF_OWNER_SIGNATURE_INVALID LF_OWNER_TRUST_REQUIRED LF_PREDECESSOR_BASE_CONFLICT
  LF_PREDECESSOR_PENDING LF_PRODUCTION_ACTIVATION_REQUIRED LF_PRODUCTION_MIGRATION_NOT_APPROVED LF_PROJECT_CHANNEL_REQUIRED LF_PROJECT_DEPENDENCY_MISSING
  LF_PROJECT_METADATA_INVALID LF_PROJECT_MUST_BE_RECEIVED LF_PROJECT_OWNERSHIP_PENDING LF_PROJECT_OWNER_CHANGED LF_PROJECT_READ_CONFLICT
  LF_PROJECT_SCHEMA_BLOCKED LF_QUEUE_CONFLICT LF_RECEIPT_INVALID LF_REMOTE_APPLY_PENDING LF_REMOTE_CONTENT_MISMATCH
  LF_REMOTE_INTEGRITY LF_REMOTE_UNCONFIRMED LF_ROLLBACK_BASE_UNCONFIRMED LF_RULES_CHANGED LF_RULES_CREDENTIAL_REQUIRED
  LF_RULES_IDENTITY_INVALID LF_RULES_UNCONFIRMED LF_SEPARATE_ACTIVATION_REQUIRED LF_SERVER_UNCONFIRMED LF_SOURCE_INTEGRITY
  LF_STALE_REMOTE LF_STARTUP_UNCONFIRMED LF_STORE_CLOSED LF_SYNC_ACCESS_DENIED LF_SYNC_ACCESS_UNCONFIRMED
  LF_SYNC_AUTH_OWNER_MISMATCH LF_TRANSITION_INVALID LF_VALUE_INVALID LF_WRITER_CONTROLLER_UNCONFIRMED LF_WRITER_FENCE_UNCONFIRMED
  GLOBAL_ACCESS_UNCONFIRMED GLOBAL_ALIAS_CONFLICT GLOBAL_ATTEMPT_UNKNOWN GLOBAL_AUTH_CHANGED GLOBAL_BASE_REQUIRED
  GLOBAL_BUNDLE_INCOMPLETE GLOBAL_CLIENT_CLOSED GLOBAL_CONFIRMATION_REQUIRED GLOBAL_DATE_INVALID GLOBAL_DEPENDENCY_MISSING
  GLOBAL_DEPENDENCY_UNAVAILABLE GLOBAL_DIRECTORY_INVALID GLOBAL_DOMAIN_UNSUPPORTED GLOBAL_DUPLICATE_ID GLOBAL_EDIT_SESSION_ACTIVE
  GLOBAL_HASH_INVALID GLOBAL_HASH_UNAVAILABLE GLOBAL_HEAD_INVALID GLOBAL_ID_INVALID GLOBAL_INTEGRITY_INVALID
  GLOBAL_NETWORK_UNCONFIRMED GLOBAL_NOT_FOUND GLOBAL_OWNER_INVALID GLOBAL_PERMISSION_DENIED GLOBAL_PUBLICATION_NOT_OBSERVED
  GLOBAL_READ_CONFLICT GLOBAL_RECORD_CONFLICT GLOBAL_RECORD_INVALID GLOBAL_RECORD_MISSING GLOBAL_RECORD_TOO_LARGE
  GLOBAL_REFERENCE_CONFLICT GLOBAL_REFERENCE_MISSING GLOBAL_REMOTE_UNCONFIRMED GLOBAL_REQUIRED_FIELD GLOBAL_REVISION_CONFLICT
  GLOBAL_REVISION_INVALID GLOBAL_REVISION_MISSING GLOBAL_SCOPE_INVALID GLOBAL_SECRET_FORBIDDEN GLOBAL_SIZE_LIMIT
  GLOBAL_SOURCE_CHANGED GLOBAL_SOURCE_MISSING GLOBAL_SOURCE_UNCONFIRMED GLOBAL_STORAGE_INVALID GLOBAL_STORAGE_UNAVAILABLE
  GLOBAL_UNKNOWN_FIELD GLOBAL_VALUE_INVALID GLOBAL_WRITE_CONFLICT
  AUTH_ACCESS_DENIED AUTH_ACCESS_EXPIRED AUTH_ACCESS_PENDING AUTH_ACCESS_REVOKED AUTH_ACCESS_TIMEOUT
  AUTH_ACCESS_UNCONFIRMED AUTH_ACCOUNT_CHANGED AUTH_AUTHORIZATION_NOT_CONFIGURED AUTH_CONFIG_INVALID AUTH_CONFIG_REQUIRED
  AUTH_GOOGLE_REQUIRED AUTH_INTERACTION_REQUIRED AUTH_PERSISTENCE_UNAVAILABLE AUTH_RELOAD_REQUIRED AUTH_SCRIPT_ABORTED
  AUTH_SCRIPT_EXECUTION AUTH_SCRIPT_NETWORK AUTH_SCRIPT_SOURCE AUTH_SDK_UNAVAILABLE AUTH_SESSION_UNCONFIRMED
  AUTH_STARTUP_FAILED AUTH_STARTUP_UNCONFIRMED AUTH_STYLE_NETWORK
  LOCAL_ACCESS_CANCELLED LOCAL_ACCESS_CHANGED LOCAL_ACCESS_CONSENT_REQUIRED LOCAL_ACCESS_COORDINATION_INVALID LOCAL_ACCESS_COORDINATION_UNAVAILABLE
  LOCAL_ACCESS_DATA_CHANGED LOCAL_ACCESS_INVALID LOCAL_ACCESS_LOCK_REQUIRED LOCAL_ACCESS_OTHER_ACCOUNT LOCAL_ACCESS_PROTECTED
  LOCAL_ACCESS_UNCONFIRMED LOCAL_DATA_UNCLAIMED LOCAL_MANUAL_LOGOUT LOCAL_SESSION_IDLE LOCAL_SESSION_LOCKED
  LOCAL_SESSION_OWNER_REQUIRED LOCAL_SESSION_RESTORED
  EXPORT_COUNT_MISMATCH EXPORT_DEPENDENCY_UNAVAILABLE EXPORT_DUPLICATE_ID EXPORT_INVALID_DATE EXPORT_INVALID_FIELD
  EXPORT_INVALID_GEOMETRY EXPORT_INVALID_ID EXPORT_INVALID_REFERENCE EXPORT_INVESTOR_MISMATCH EXPORT_PCV_OWNER_INVALID
  EXPORT_PCV_ROLE_INVALID EXPORT_PILOT_DATA_REQUIRED EXPORT_REQUIRED_FIELD EXPORT_ROOM_SCOPE_MISMATCH EXPORT_SCHEMA_UNSUPPORTED
  EXPORT_UNSUPPORTED_FIELD EXPORT_UNSUPPORTED_NOTE EXPORT_UNSUPPORTED_STRUCTURE
  CLOUD_ACCESS_REQUIRED CLOUD_ACCESS_UNCONFIRMED CLOUD_APPROVAL_EXPIRED CLOUD_APPROVAL_REQUIRED CLOUD_ATTEMPT_UNKNOWN
  CLOUD_AUTH_CHANGED CLOUD_AUTH_REQUIRED CLOUD_AUTH_UNCONFIRMED CLOUD_BASE_INVALID CLOUD_CHUNK_CONFLICT
  CLOUD_CHUNK_INVALID CLOUD_CLIENT_CLOSED CLOUD_CONFIRMATION_REQUIRED CLOUD_CONTRACT_MISSING CLOUD_CRYPTO_UNAVAILABLE
  CLOUD_DEPENDENCY_UNAVAILABLE CLOUD_EXPORT_DEPENDENCY CLOUD_EXPORT_INVALID CLOUD_EXPORT_REFUSED CLOUD_GOOGLE_REQUIRED
  CLOUD_INTEGRITY_INVALID CLOUD_LIVE_TRANSPORT_DISABLED CLOUD_MANIFEST_INVALID CLOUD_NETWORK_UNCONFIRMED CLOUD_OPERATION_LIMIT
  CLOUD_PERMISSION_DENIED CLOUD_PRIVATE_SESSION_REQUIRED CLOUD_PROJECT_NOT_FOUND CLOUD_PUBLICATION_NOT_OBSERVED CLOUD_READ_CONFLICT
  CLOUD_REMOTE_UNCONFIRMED CLOUD_REVISION_CONFLICT CLOUD_REVISION_INCOMPLETE CLOUD_REVISION_INVALID CLOUD_SCOPE_INVALID
  CLOUD_SIZE_INVALID CLOUD_SOURCE_CHANGED CLOUD_WRITE_CONFLICT
  OFFLINE_SHELL_INCOMPLETE OFFLINE_SHELL_UNAVAILABLE OFFLINE_SHELL_UNCONFIRMED
  DEVICE_TRUST_AUTH_CHANGED DEVICE_TRUST_BLOCKED DEVICE_TRUST_CONSENT_REQUIRED DEVICE_TRUST_INVALID DEVICE_TRUST_LOGOUT_UNCONFIRMED
  DEVICE_TRUST_MISSING DEVICE_TRUST_ONLINE_APPROVAL_REQUIRED DEVICE_TRUST_OTHER_ACCOUNT DEVICE_TRUST_REVOKED DEVICE_TRUST_STORAGE_UNCONFIRMED
  DEVICE_TRUST_UNAVAILABLE DEVICE_TRUST_UNCONFIRMED
  AbortError QuotaExceededError SecurityError UNRECOGNIZED_ERROR aborted auth/invalid-user-token auth/network-request-failed auth/operation-not-allowed auth/requires-recent-login auth/user-disabled auth/user-token-expired cancelled deadline-exceeded failed-precondition internal permission-denied resource-exhausted unauthenticated unavailable unknown
 `.trim().split(/\s+/));
 const diagnosticStages=new Set(('idle preparing-source source-ready opening-runtime authorizing-cloud binding-runtime checking-installation opening-idb installing-authority initial-global-revision initial-project-revisions ready reconnect-auth reconnect-runtime login-startup checking-local-access loading-business-styles loading-business-scripts starting-business starting-local-first').split(' '));
 let firstError=null,projectTransferBlocked=null,aliasConflict=null,transferStatus='not-started',globalConsistency=null,diagnosing=null;
 async function inspectGlobalConsistency(){
  if(diagnosing)return diagnosing;
  const context=lastContext,source=boot;let expired=false,timer;
  const work=(async()=>{
   if(!fc.globalDataContract)return {status:'BLOCKED',code:'DIAG_CONTEXT_BLOCKED'};
   await import('./global-data-diagnostics.js');
   if(expired)return {status:'BLOCKED',code:'DIAG_TIMEOUT'};
   const {collectGlobalDiagnostics}=await import('../../../sync/local-first-global-diagnostics.mjs');
   if(expired)return {status:'BLOCKED',code:'DIAG_TIMEOUT'};
   return collectGlobalDiagnostics({window,ownerUid:context?.ownerUid,name:configuration?.name,readNative:source?.readNative,release,
    authorize(){
     if(expired||!context||lastContext!==context||boot!==source||context.localAccess?.ownerUid!==context.ownerUid||typeof context.localAccess?.assert!=='function')throw Error();
     context.localAccess.assert();
    }});
  })();
  // Include module loading in a finite observation budget. A late import/result
  // cannot resume data reads or overwrite the report after startup was refused.
  diagnosing=Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{expired=true;resolve({status:'BLOCKED',code:'DIAG_TIMEOUT'});},12000);})]).then(value=>{
   globalConsistency=value;
   return JSON.parse(JSON.stringify(globalConsistency));
  }).catch(()=>{globalConsistency={status:'BLOCKED',code:'DIAG_READ_BLOCKED'};return {...globalConsistency};}).finally(()=>{expired=true;clearTimeout(timer);diagnosing=null;});
  return diagnosing;
 }
 const diagnosticStage=value=>diagnosticStages.has(value)?value:'unknown';
 function errorCode(error){
  try{const code=typeof error==='string'?error:error?.code||error?.message||error?.name;return diagnosticCodes.has(code)?code:'UNRECOGNIZED_ERROR';}catch(_){return 'UNRECOGNIZED_ERROR';}
 }
 function recordFailure(error,at=stage){
  const code=errorCode(error);
  if(!aliasConflict&&code==='GLOBAL_ALIAS_CONFLICT'){
   const metadata=fc.globalDataContract?.aliasConflictMetadata?.(error)||{domain:'UNKNOWN',keys:[]};
   aliasConflict=Object.freeze({stage:diagnosticStage(at),code,domain:metadata.domain,keys:Object.freeze([...metadata.keys])});
  }
  // A reload requirement is a consequence, never evidence of the first fault.
  if(!firstError&&code!=='AUTH_RELOAD_REQUIRED')firstError=Object.freeze({stage:diagnosticStage(at),code});
 }
 function diagnosticState(value){
  if(value.projectTransferBlocked===true){
   if(!projectTransferBlocked)projectTransferBlocked=Object.freeze({stage:diagnosticStage(stage),code:errorCode(value)});
   transferStatus='blocked';recordFailure(value);
  }else if(transferStatus!=='blocked'&&stage==='initial-project-revisions')transferStatus=value.ok===true?'cycle-confirmed':'unconfirmed';
  // An expected pre-authority/offline scheduler result is not a startup fault.
  if(value.ok===false&&value.code!=='LF_OFFLINE')recordFailure(value);
 }
 function setStage(value){stage=value;if(value==='initial-project-revisions'&&transferStatus==='not-started')transferStatus='checking';}
 const note=error=>{recordFailure(error);lastLocation=String(error?.stack||'').match(/\/(?:sync|js\/app\/cloud)\/[a-z0-9/-]+\.(?:mjs|js):[0-9]+/)?.[0]||null;lastError=/^(?:(?:LF_|GLOBAL_|AUTH_|LOCAL_)[A-Z_]+|auth\/[a-z-]+)$/.test(error?.code||error?.message||'')?(error.code||error.message):'LF_STARTUP_UNCONFIRMED';};
 let release=null,configuring=null,recoveryQuiescent=false;
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
   recoveryQuiescent=false;stage='opening-runtime';starting=(async()=>{
    for(const file of ['global-data-contract','cloud-pilot-contract','firebase-global-transport'])await import('./'+file+'.js');
    stage='authorizing-cloud';const connections=navigator.onLine===false?{}:await connect(context);stage='binding-runtime';
    connectionsActive=connections;
    if(runtime){if(navigator.onLine!==false)await runtime.resume(connections);return runtime;}
    const {startApplicationRuntime}=await import('../../../sync/application-runtime.mjs');
    runtime=await startApplicationRuntime({window,ownerUid,name:configuration.name,boot,release,onStage:setStage,onDiagnostic:diagnosticState,onFailureQuiescent(){recoveryQuiescent=true;},...connections});
    return runtime;
   })().then(value=>{stage='ready';return value;}).catch(async error=>{
    note(error);
    // Observe before main-login revokes access. A diagnostic refusal cannot
    // replace the original startup failure or retry any part of startup.
    if(stage==='initial-global-revision'||errorCode(error).startsWith('GLOBAL_'))await inspectGlobalConsistency();
    throw error;
   }).finally(()=>{starting=null;});return starting;
  },
  revokeCloud(){void connectionsActive?.logout?.();},
  canRecoverGlobals(){return recoveryQuiescent&&!runtime&&!starting&&!!boot&&stage==='initial-global-revision'&&firstError?.code?.startsWith('GLOBAL_');},
  async openLocalFirstRecovery(options={}){
   const context=lastContext,source=boot,name=configuration?.name,ownerUid=context?.ownerUid;
   const fatalRead=window.__FC_MAIN_ACCESS__?.isValid()!==true,gate=fatalRead?window.__FC_RECOVERY_ACCESS__:null;
   const authorize=()=>{if(!context||lastContext!==context||source!==boot||!ownerUid)throw Error('RESCUE_AUTH_OR_BUSY');
    if(fatalRead)gate.assert(ownerUid);else context.localAccess.assert();};
   const assertQuiescent=()=>{if(starting||refreshing||fatalRead&&(!recoveryQuiescent||runtime))throw Error('RESCUE_AUTH_OR_BUSY');
    if(!fatalRead){const status=runtime?.authority?.status();if(!status||status.closed||status.external||status.transactionPending||status.incomingPending)throw Error('RESCUE_AUTH_OR_BUSY');}};
   authorize();assertQuiescent();
   const [{createLocalFirstRescue},{openLocalFirstRecovery},{applicationWriterFence}]=await Promise.all([
    import('../../../sync/local-first-rescue-file.mjs'),import('../../../sync/local-first-recovery-ui.mjs'),import('../../../sync/application-writer-fence.mjs')]);
   const readNative=fatalRead?key=>gate.readNative(key):source.readNative;
   const api=createLocalFirstRescue({window,name,ownerUid,release,readNative,readSession:fatalRead?key=>gate.readSession(key):undefined,
    authorize,assertQuiescent,verifyOwner:fatalRead?()=>gate.verify():undefined});
   const exclusive=async operation=>{
    authorize();assertQuiescent();if(release)await applicationWriterFence(window);authorize();
    let receipt;try{receipt=JSON.parse(readNative('meble_application_authority_v1'));}catch(_){throw Error('RESCUE_RECEIPT_INVALID');}
    if(receipt?.name!==name||receipt.ownerUid!==ownerUid||!/^[-A-Za-z0-9_]{1,128}$/.test(receipt.instanceId||''))throw Error('RESCUE_RECEIPT_INVALID');
    const held=()=>navigator.locks.request(name+':'+receipt.instanceId,{ifAvailable:true},async lock=>{if(!lock)throw Error('RESCUE_APPLICATION_BUSY');authorize();const value=await operation();authorize();return value;});
    return fatalRead?navigator.locks.request('meble-application-authority-v1',{ifAvailable:true},lock=>{if(!lock)throw Error('RESCUE_APPLICATION_BUSY');return held();}):runtime.withRescueRead(held);
   };
   return openLocalFirstRecovery({window,api,exclusive,authorize,parent:options.parent||document.body,onClose:options.onClose});
  },
  hasLocalFirst(){return !!configuration&&!!boot;},
  errorCode,
  recordFailure(error,at){recordFailure(error,at==='starting-local-first'?stage:at);},
  inspectGlobalConsistency,
  diagnostics:()=>Object.freeze({status:'READ_ONLY',stage:diagnosticStage(stage),code:lastError?errorCode(lastError):null,firstError:firstError&&{...firstError},transferStatus,projectTransferBlocked:projectTransferBlocked&&{...projectTransferBlocked},aliasConflict:aliasConflict&&{...aliasConflict,keys:[...aliasConflict.keys]},...(globalConsistency?{globalConsistency:JSON.parse(JSON.stringify(globalConsistency))}:{})}),
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
