'use strict';
// Anonymous code-build inspection. No output file, private data or WRITE mode.
const {buildCodeCatalogs}=require('./helpers/code-global-catalogs');
if(require.main===module){
 try{
  if(process.argv.length!==2)throw Error('CODE_FACTORY_ARGUMENTS_FORBIDDEN');
  const {model,provenance,runtime}=buildCodeCatalogs();
  console.log(JSON.stringify({status:'CODE_CANDIDATE_READY',domains:14,counts:Object.fromEntries(Object.entries(model).map(([domain,value])=>[domain,Array.isArray(value)?value.length:1])),
   sourceHash:provenance.sourceHash,modelHash:provenance.modelHash,runtime,writeApproved:false,ownerBackupVerified:false}));
 }catch(error){console.error(/^(CODE_FACTORY_|GLOBAL_)[A-Z_]+$/.test(error.code||error.message||'')?(error.code||error.message):'CODE_FACTORY_BUILD_BLOCKED');process.exitCode=1;}
}
module.exports={buildCodeCatalogs};
