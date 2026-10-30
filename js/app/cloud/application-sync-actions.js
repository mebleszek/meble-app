// Optional activated composition only. No SDK or data access during import.
(function(){
 'use strict';const FC=window.FC=window.FC||{};let binding=null;
 FC.applicationSyncActions={
  installed:()=>!!binding,
  install(controller){
   if(binding || !controller || typeof controller.save!=='function' || typeof controller.close!=='function')throw Error('LF_APPLICATION_INSTALL_REFUSED');
   binding=controller;
  },
  save(saveLocal){
   if(!binding)return saveLocal();
   return binding.save({operationId:crypto.randomUUID(),saveLocal}).catch(error=>{
    FC.infoBox?.open({title:'Synchronizacja wstrzymana',message:'Zachowano lokalne dane. Nie potwierdzono kolejki synchronizacji. Nie ponawiaj niepewnego zapisu.',okOnly:true});
    return {ok:false,code:/^LF_[A-Z_]+$/.test(error?.code||'')?error.code:'LF_APPLICATION_UNCONFIRMED'};
   });
  },
  cancel(cancelLocal){
   if(!binding?.cancel)return cancelLocal();
   return binding.cancel({cancelLocal}).catch(()=>{
    FC.infoBox?.open({title:'Anulowanie niepotwierdzone',message:'Zachowano lokalne dane i sesję. Nie potwierdzono trwałego zakończenia anulowania.',okOnly:true});
    return false;
   });
  },
  close(){const old=binding;binding=null;old?.close();}
 };
})();
