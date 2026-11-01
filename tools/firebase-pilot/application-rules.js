'use strict';
// Reviewed source composition, never a deployment command. No private baseline.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..');
function once(source,from,to){if(source.split(from).length!==2)throw Error('LF_RULES_SOURCE_CHANGED');return source.replace(from,()=>to);}
function applicationRules(){
 let source=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
 source=once(source,'return appApproved(uid)\n        && grant(uid).enabled', 'return false && appApproved(uid)\n        && grant(uid).enabled');
 source=once(source,'return appApproved(uid) && grant(uid).globalDataEnabled', 'return syncOwner(uid) && appApproved(uid) && grant(uid).globalDataEnabled');
 const fragment=fs.readFileSync(path.join(root,'sync/local-first-project.rules'),'utf8');
 const owner=`    // One owner, one approved application deployment. Admin-created only.
    function syncOwner(uid) {
      let config = get(/databases/$(database)/documents/syncConfig/owner).data;
      let access = get(/databases/$(database)/documents/syncAccess/$(uid)).data;
      return request.auth != null && request.auth.uid == uid
        && request.auth.token.email_verified == true
        && request.auth.token.firebase.sign_in_provider == 'google.com'
        && config.keys().hasOnly(['ownerUid','activationId','schemaVersion'])
        && config.ownerUid == uid && config.schemaVersion == 1
        && config.activationId is string && config.activationId.matches('^[A-Za-z0-9_-]{1,128}$')
        && access.keys().hasOnly(['activationId','schemaVersion'])
        && access.schemaVersion == 1 && access.activationId == config.activationId;
    }
    match /syncConfig/{document} { allow read, write: if false; }
    match /syncAccess/{uid} {
      allow get: if globalApproved(uid);
      allow list, create, update, delete: if false;
    }
`;
 return once(source,'    match /{document=**}',owner+fragment+'\n    match /{document=**}');
}
if(require.main===module)process.stdout.write(applicationRules());
module.exports={applicationRules};
