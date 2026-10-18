// Separate demo-only rehearsal. There is deliberately no live loader or target flag.
import {createRequire} from 'node:module';
import {openPrivatePilot} from './private-pilot-runner.mjs';
const {inventory,wrapOperator}=createRequire(import.meta.url)('./cloud42-package.js');
export async function openCloud42Rehearsal(page,address){
 const url=new URL(address);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)
  ||url.pathname!=='/index.html'||url.search||url.hash)throw Error('CLOUD_LIVE_TRANSPORT_DISABLED');
 inventory();
 return wrapOperator(await openPrivatePilot(page,address),null);
}
