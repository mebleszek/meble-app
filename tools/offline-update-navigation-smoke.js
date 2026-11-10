'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{MessageChannel}=require('node:worker_threads');
async function run(mutate=()=>{},exclusive=true,race=false){
 const root='https://synthetic.invalid/meble-app/',nodes=[],navigations=[];
 const FC={session:{active:false,snapshot:null,durable:false,isDirty:()=>false},investorEditorState:{hasUiLock:()=>false},investorDeletion:{pending:()=>false},applicationStartup:{inspect:()=>({state:'local-only',stage:'ready',transactionPending:false})}};
 const access={isValid:()=>true,isLoading:()=>false};
 const worker={scriptURL:root+'offline-worker.js',postMessage(data,ports){if(race&&data.type==='VERIFY_APPLICATION_AUTHORITY')FC.session.active=true;ports[0].postMessage(data.type==='VERIFY_STATIC_SHELL'?{complete:true,version:'a'.repeat(64)}:{protocol:1,nonce:data.nonce,exclusive});ports[0].close();}};
 const reg={waiting:worker,scope:root,update:async()=>{},addEventListener(){}};
 const navigator={onLine:true,serviceWorker:{controller:worker,register:async()=>reg}};
 const w={FC,navigator,localStorage:{getItem:()=>null},isSecureContext:true,__FC_MAIN_ACCESS__:access,uiState:{entry:'investorsList'},crypto:require('node:crypto').webcrypto,location:{assign:href=>navigations.push(href)},addEventListener(){}};
 const d={baseURI:root+'index.html',readyState:'loading',addEventListener(){},querySelectorAll:()=>[],body:{appendChild:node=>nodes.push(node)},createElement:tag=>({tag,children:[],hidden:false,setAttribute(){},addEventListener(type,fn){this[type]=fn;},append(...children){this.children.push(...children);}})};
 mutate({FC,w,d,navigator,access});vm.runInNewContext(fs.readFileSync('js/app/cloud/offline-update.js','utf8'),{window:w,document:d,navigator,URL,MessageChannel,setTimeout,clearTimeout});await FC.offlineUpdate.start();await nodes[0].children[0].click();return navigations;
}
(async()=>{
 assert.equal((await run()).length,1);
 const refusals=[({FC})=>FC.session.active=true,({FC})=>FC.session.snapshot={},({FC})=>FC.session.durable=true,({FC})=>FC.session.isDirty=()=>true,({FC})=>FC.investorEditorState.hasUiLock=()=>true,({FC})=>FC.investorDeletion.pending=()=>true,({FC})=>FC.applicationStartup.inspect=()=>({state:'local-only',stage:'ready',transactionPending:true}),({w})=>w.uiState.currentInvestorId='PRIVATE',({d})=>d.querySelectorAll=()=>[{getClientRects:()=>[{}]}],({navigator})=>navigator.onLine=false,({access})=>access.isValid=()=>false,({access})=>access.isLoading=()=>true,({FC})=>delete FC.session,({w})=>w.localStorage.getItem=()=>'{PENDING_DRAFT}',({w})=>w.localStorage.getItem=()=>{throw Error('READ_DENIED');}];
 for(const mutate of refusals)assert.equal((await run(mutate)).length,0);
 assert.equal((await run(()=>{},false)).length,0);assert.equal((await run(()=>{},true,true)).length,0);
 console.log('offline-update-navigation: 18/18 PASS; same-window navigation only after clean session, idle storage, home/list, exclusive worker proof and post-ACK recheck');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
