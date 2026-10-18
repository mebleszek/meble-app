// Builds an operator-only in-memory variant. Never rewrites the served application.
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const MAIN_SHA256='6b6aeb7ffb8dc10664b5ae7a0cf5af10f0b5dcf7b130ed829798f23438fff7f3';
const RULES_SHA256='eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92';
const sha=data=>createHash('sha256').update(data).digest('hex');
function compile(){
 const main=fs.readFileSync(path.join(root,'js/main-login.js'),'utf8');
 if(sha(main)!==MAIN_SHA256||sha(fs.readFileSync(path.join(__dirname,'firestore-live-pilot.rules')))!==RULES_SHA256)throw Error('CLOUD_OPERATOR_SOURCE_CHANGED');
 const tail='  initialize();\n})();\n';
 if(!main.endsWith(tail)||main.split(tail).length!==2)throw Error('CLOUD_OPERATOR_SOURCE_CHANGED');
 const files=['project/project-export-contract','cloud/cloud-pilot-contract','cloud/firebase-pilot-transport',
  'cloud/project-cloud-pilot','cloud/firebase-pilot-live-transport','cloud/controlled-project-pilot'];
 const sources=files.map(file=>fs.readFileSync(path.join(root,'js/app',file+'.js'),'utf8'));
 const driver=fs.readFileSync(path.join(__dirname,'private-pilot-execution.js'),'utf8');
 const source=main.slice(0,-tail.length)+`  initialize();
  return (${driver})(async operation=>{
    assert();
    if(!started||starting||fatal)throw Error('CLOUD_PRIVATE_SESSION_REQUIRED');
    const expected=auth.identity(),granted=lease;
    const check=()=>{
      assert();granted.assert();const current=auth.identity();
      if(lease!==granted||current.uid!==expected.uid||current.epoch!==expected.epoch)throw Error('CLOUD_AUTH_CHANGED');
      // Existing read-only inspector rejects active AND unconfirmed remnants;
      // never save/commit/cancel/recover the page's session to run this pilot.
      if(FC.session?.inspectExportState?.().ok!==true)throw Error('CLOUD_PRIVATE_SESSION_REQUIRED');
    };
    check();try{return await operation({authSession:auth,lease:granted,assertLocalAccess:check});}finally{check();}
  },${JSON.stringify(sources)});
})();\n`;
 return Object.freeze({source,sourceSha256:sha(source),mainSha256:MAIN_SHA256,rulesSha256:RULES_SHA256});
}
module.exports={compile,MAIN_SHA256,RULES_SHA256};
