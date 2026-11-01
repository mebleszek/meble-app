'use strict';
// Offline public approval packaging. Never signs, deploys, edits the app or GETs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function reviewApplicationRelease(input){
 if(!input||Object.keys(input).sort().join(',')!=='envelope,trustedKeySha256')throw Error('LF_PUBLIC_APPROVAL_FORMAT');
 const {applicationRules}=require('./firebase-pilot/application-rules.js');
 const rules=applicationRules(),hash=crypto.createHash('sha256').update(rules).digest('hex');
 if(input?.envelope?.decision?.projectId!=='mebleszek-meble-app'||input.envelope.decision.rulesSha256!==hash)throw Error('LF_RULES_PACKAGE_MISMATCH');
 const bytes=value=>{if(!Array.isArray(value)||value.some(b=>!Number.isInteger(b)||b<0||b>255))throw Error('LF_PUBLIC_APPROVAL_FORMAT');return new Uint8Array(value);};
 const envelope={...input.envelope,publicKeySpki:bytes(input.envelope.publicKeySpki),signature:bytes(input.envelope.signature)};
 const {verifyApplicationRelease}=await import('../sync/application-release.mjs');
 await verifyApplicationRelease({envelope,trustedKeySha256:input.trustedKeySha256,origin:'https://mebleszek.github.io/meble-app/'});
 const source='// Public approval artifact. Publish only with a separate activation authorization.\nwindow.FC_APPLICATION_RELEASE=Object.freeze({trustedKeySha256:'+JSON.stringify(input.trustedKeySha256)+',envelope:Object.freeze({decision:Object.freeze('+JSON.stringify(envelope.decision)+'),publicKeySpki:new Uint8Array('+JSON.stringify([...envelope.publicKeySpki])+'),signature:new Uint8Array('+JSON.stringify([...envelope.signature])+')})});\n';
 return {source,rulesSha256:hash};
}
if(require.main===module)(async()=>{
 const [inputFile,outputFile]=process.argv.slice(2);if(!inputFile||!outputFile)throw Error('Use: node tools/application-release-package.js PRIVATE_PUBLIC_APPROVAL_JSON PRIVATE_OUTPUT_JS');
 const root=path.resolve(__dirname,'..'),output=path.resolve(outputFile);if(output===root||output.startsWith(root+path.sep))throw Error('LF_PRIVATE_REVIEW_PATH_REQUIRED');
 const reviewed=await reviewApplicationRelease(JSON.parse(fs.readFileSync(inputFile,'utf8')));
 fs.writeFileSync(output,reviewed.source,{flag:'wx',mode:0o600});console.log('PUBLIC_APPROVAL_VERIFIED_NO_ACTIVATION rulesSha256='+reviewed.rulesSha256);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={reviewApplicationRelease};
