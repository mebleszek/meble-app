// Explicit application composition, not an automatic LIVE switch. No IO on import.
import {openLocalFirstStore} from './local-first-idb.mjs';
import {createGlobalChannel,createDurableSynchronizer} from './local-first-sync.mjs';
import {assertGlobalConnection} from './firebase-activation.mjs';
import {createApplicationSession} from './application-session.mjs';
import {fail} from './local-first-values.mjs';
export async function startApplicationSync({binding,indexedDB,locks,writer,reader,source,contract,factory,
  access,session,eventTarget,online,onState,onRemote,projectChannels=[],projectContract,buildProject,projectId,
  initializationApproved=false}={}){
  // Require the existing emulator identity or signed production activation.
  // No ADC, auth initialization, credentials, migration or source deletion.
  const a=assertGlobalConnection(writer),b=assertGlobalConnection(reader);
  if(a.uid!==binding?.ownerUid||b.uid!==binding.ownerUid||!access||writer.db.app===reader.db.app)fail('LF_APPLICATION_OWNER_CHANGED');
  access.assertLocal(binding.ownerUid);access.assertCloud(binding.ownerUid);
  if(binding.initialize && !initializationApproved)fail('LF_APPLICATION_INITIALIZATION_REQUIRED');
  const store=await openLocalFirstStore({...binding,indexedDB,locks});let sync;
  try{
    const g=createGlobalChannel({writer,reader,ownerUid:binding.ownerUid,contract,factory});
    sync=createDurableSynchronizer({store,channels:[g,...projectChannels],eventTarget,online,onState});
    return createApplicationSession({synchronizer:sync,store,access,session,source,globalContract:contract,
      projectContract,buildProject,projectId,eventTarget,onRemote});
  }catch(e){sync?.close();store.close();throw e;}
}
