// Explicit operator entry, no executable CLI, no network/SDK work on import.
// The caller owns a fresh isolated Playwright page and its emulator-only routing.
import {createRequire} from 'node:module';
const {compile}=createRequire(import.meta.url)('./private-pilot-source.js');
export async function openPrivatePilot(page,address){
 const url=new URL(address);
 if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/index.html'||url.search||url.hash
  ||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099')throw Error('CLOUD_LIVE_TRANSPORT_DISABLED');
 if(page.url()!=='about:blank')throw Error('CLOUD_OPERATOR_FRESH_CONTEXT_REQUIRED');
 const artifact=compile();
 // Run the unchanged ordered entry exactly once, retaining only its lexical
 // operator result in a Playwright JSHandle, never on window or the page DOM.
 const pattern=url.origin+'/js/main-login.js*';
 await page.route(pattern,route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 if(await page.evaluate(()=>!!window.__FC_MAIN_ACCESS__))throw Error('CLOUD_OPERATOR_ALREADY_STARTED');
 if(!await page.evaluate(()=>{
  const options=window.FC_AUTH_TEST_OPTIONS;
  return options?.target==='emulator'&&options.firebaseConfig?.projectId==='demo-meble-app'
   &&['localhost','127.0.0.1'].includes(options.emulator?.host)
   &&options.emulator.port===19099&&options.emulator.firestorePort===18080;
 }))throw Error('CLOUD_LIVE_TRANSPORT_DISABLED');
 const handle=await page.evaluateHandle(artifact.source);
 if(await handle.evaluate(value=>!value||typeof value.execute!=='function')){await handle.dispose();throw Error('CLOUD_OPERATOR_STARTUP_FAILED');}
 let closed=false;
 return Object.freeze({
  sourceSha256:artifact.sourceSha256,
  async execute(request){if(closed)return {ok:false,code:'CLOUD_CLIENT_CLOSED'};return handle.evaluate((driver,value)=>driver.execute(value),request);},
  async close(){if(closed)return;closed=true;try{await handle.evaluate(driver=>driver.close());}finally{await handle.dispose();}}
 });
}
