'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function run(source){
 const listeners={window:[],document:[]},calls=[];let summaries=0;
 const window={FC:{actions:{has:()=>true,dispatch:name=>{calls.push(name);return true;}}},addEventListener:(type,fn)=>listeners.window.push({type,fn})};
 const document={getElementById:()=>null,addEventListener:(type,fn)=>listeners.document.push({type,fn})};
 // Real ordering: accordion document capture registers before bindings install.
 document.addEventListener('click',e=>{if(e.target.summary)summaries++;});
 vm.runInNewContext(source,{window,document});window.FC.bindings.install();
 const button=name=>{const node={getAttribute:()=>name};node.closest=s=>s==='[data-action]'?node:null;return node;};
 const room=button('open-room'),summary={summary:true,closest:()=>null};
 const fire=(type,target,detail=1)=>{const e={target,detail,preventDefault(){},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;this.stopped=true;}};
  for(const scope of ['window','document']){for(const l of listeners[scope]){if(l.type===type)l.fn(e);if(e.immediate)break;}if(e.stopped)break;}
 };
 fire('pointerdown',room);fire('pointerup',room);fire('click',summary);
 const blocked=summaries===0;assert.deepEqual(calls,['open-room']);
 // Exactly one consumed click: the next ordinary/keyboard click still works.
 fire('click',summary,0);assert.equal(summaries,blocked?1:2);
 const normal=button('ordinary');fire('click',normal,0);assert.equal(calls.at(-1),'ordinary');
 fire('pointerdown',room);fire('pointerup',room);
 fire('pointerdown',normal);fire('pointerup',normal);fire('click',normal);
 assert.equal(calls.filter(x=>x==='ordinary').length,2,'New physical pointerdown resets stale global guard, own compatibility click cannot double dispatch');
 return blocked;
}
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/app/ui/bindings.js'),'utf8');
assert.equal(run(source),true,'Window capture must consume retargeted click before earlier document accordion listener');
console.log('PASS compatibility click: window-before-document, exactly one consumed click, keyboard/normal click, fresh pointerdown reset and no double dispatch');
module.exports={run};
