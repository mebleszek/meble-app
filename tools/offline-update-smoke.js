'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{MessageChannel}=require('node:worker_threads');
async function check({complete=true,foreign=false,scope=false,offline=false}={}){
 const nodes=[],root='https://synthetic.invalid/meble-app/';let registered=0;
 const worker={scriptURL:root+(foreign?'foreign.js':'offline-worker.js'),postMessage(message,ports){assert.deepEqual(JSON.parse(JSON.stringify(message)),{type:'VERIFY_STATIC_SHELL'});ports[0].postMessage({complete,version:'a'.repeat(64)});ports[0].close();}};
 const reg={waiting:worker,scope:root+(scope?'foreign/':''),addEventListener(){},async update(){}};
 const navigator={onLine:!offline,serviceWorker:{async register(){registered++;return reg;}}};
 const window={navigator,isSecureContext:true,addEventListener(){}};
 Object.defineProperty(window,'localStorage',{get(){throw Error('No business storage permitted');}});
 const document={baseURI:root+'index.html',readyState:'loading',addEventListener(){},body:{appendChild:n=>nodes.push(n)},createElement:tag=>({tag,hidden:false,children:[],setAttribute(){},addEventListener(type,fn){this[type]=fn;},append(...args){this.children.push(...args);}})};
 vm.runInNewContext(fs.readFileSync('js/app/cloud/offline-update.js','utf8'),{window,navigator,document,URL,MessageChannel,setTimeout,clearTimeout});await window.FC.offlineUpdate.start();
 assert.equal(nodes[0].hidden,!(complete&&!foreign&&!scope&&!offline));
 if(!nodes[0].hidden){nodes[0].children[0].click();assert.equal(nodes[0].children[1].hidden,false);}
 assert.equal(registered,offline?0:1);
}
(async()=>{for(const x of [{},{complete:false},{foreign:true},{scope:true},{offline:true}])await check(x);console.log('PASS offline update: verified waiting shell only, foreign/incomplete/offline refusal, explicit close-tab guidance, no storage/reload/activation');})().catch(e=>{console.error(e);process.exitCode=1;});
