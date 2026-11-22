// Real Auth/Firestore emulators. Only the external Google popup is substituted;
// the application's appAccess verifier/gate/lease and reconnect run unchanged.
export function realMainAuthInjection(uid){return `(()=>{
 const config={apiKey:'demo-only',projectId:'demo-meble-app',appId:'demo-only',authDomain:'demo-meble-app.firebaseapp.com'};
 const emulator={host:'127.0.0.1',port:19099,firestorePort:18080};
 Object.defineProperty(window,'FC_APPLICATION_RELEASE',{configurable:true,get:()=>({trustedKeySha256:null,envelope:null}),set(){}});
 let options={target:'emulator',firebaseConfig:config,emulator},loading;
 window.popupCalls=0;window.authCalls=0;
 Object.defineProperty(window,'FC_AUTH_TEST_OPTIONS',{get:()=>options,set:v=>{options={...v,...options};}});
 const fc=window.FC=window.FC||{};
 Object.defineProperty(fc,'cloudAuth',{configurable:true,set(api){
  Object.defineProperty(fc,'cloudAuth',{configurable:true,writable:true,value:api});
  const create=api.create;
  api.create=async args=>{
   if(args.appName)return create(args);
   loading||=Promise.all([import('/__sdk/firebase-app.js'),import('/__sdk/firebase-auth.js'),import('/__sdk/firebase-firestore.js')]).then(([app,auth,firestore])=>({app,firestore,auth:{...auth,
    async signInWithPopup(instance){
     window.popupCalls++;
     const token='e30.'+btoa(JSON.stringify({sub:${JSON.stringify(uid)},email:${JSON.stringify(uid+'@example.invalid')},email_verified:true})).replaceAll('=','')+'.';
     return auth.signInWithCredential(instance,auth.GoogleAuthProvider.credential(token));
    }
   }}));
   options={...options,sdk:await loading};window.authCalls++;
   return create({...args,...options});
  };
 }});
})();`;}
