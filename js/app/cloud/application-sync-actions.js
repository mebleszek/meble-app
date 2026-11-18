// Optional activated composition only. No SDK or data access during import.
(function(){
 'use strict';const FC=window.FC=window.FC||{};let binding=null;
 const codeOf=error=>{
  const code=error?.code || error?.message;
  return /^(LF_|SESSION_|GLOBAL_|CLOUD_)[A-Z0-9_]+$/.test(code||'') ? code : 'LF_APPLICATION_UNCONFIRMED';
 };
 FC.applicationSyncActions={
  installed:()=>!!binding,
  install(controller){
   if(binding || !controller || typeof controller.save!=='function' || typeof controller.close!=='function')throw Error('LF_APPLICATION_INSTALL_REFUSED');
   binding=controller;
  },
  save(saveLocal){
   if(!binding)return saveLocal();
   return binding.save({operationId:crypto.randomUUID(),saveLocal}).catch(error=>{
    FC.infoBox?.open({title:'Zapis projektu niepotwierdzony',message:'Zachowano dane projektu i stan edycji. '+codeOf(error),okOnly:true});
    return {ok:false,code:codeOf(error)};
   });
  },
  cancel(cancelLocal){
   if(!binding?.cancel)return cancelLocal();
   return binding.cancel({cancelLocal}).catch(error=>{
    FC.infoBox?.open({title:'Anulowanie niepotwierdzone',message:'Zachowano lokalne dane i sesję. Nie potwierdzono trwałego zakończenia anulowania. '+codeOf(error),okOnly:true});
    return false;
   });
  },
  close(){const old=binding;binding=null;old?.close();}
 };
})();
