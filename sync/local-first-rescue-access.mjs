// Read capability only. The revoked main gate is never revived.
import {refuse} from './local-first-rescue-state.mjs';
export function assertRescueReadAccess(w){
 for(const name of ['__FC_MAIN_ACCESS__','__FC_RECOVERY_ACCESS__']){
  const d=Object.getOwnPropertyDescriptor(w,name);
  if(d?.writable===false&&d.configurable===false&&d.value?.isValid()===true
   &&(name==='__FC_MAIN_ACCESS__'||d.value.scope==='LOCAL_FIRST_RESCUE_READ_ONLY_V1')){d.value.assert();return;}
 }
 refuse('RESCUE_AUTH_OR_BUSY');
}
