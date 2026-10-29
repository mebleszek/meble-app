'use strict';
// Test-only CDP barriers. A navigate ACK is not a new, parsed document, and a
// visible rectangle is not proof that a native gesture will hit that element.
function documentNavigation(send,{timeoutMs=30000}={}){
 const parsed=new Set();let wake;
 return {
  event(message){
   if(message.method!=='Page.lifecycleEvent'||message.params.name!=='DOMContentLoaded')return;
   parsed.add(message.params.frameId+':'+message.params.loaderId);wake?.();
  },
  async navigate(url){
   await send('Page.setLifecycleEventsEnabled',{enabled:true});
   const result=await send('Page.navigate',{url});
   if(result.errorText)throw Error('Navigation failed: '+result.errorText);
   if(!result.frameId||!result.loaderId)throw Error('Navigation did not create a document');
   const key=result.frameId+':'+result.loaderId;
   await new Promise((resolve,reject)=>{
    const finish=()=>{if(!parsed.has(key))return;clearTimeout(timer);wake=null;resolve();};
    const timer=setTimeout(()=>{wake=null;reject(Error('DOMContentLoaded missing for requested navigation'));},timeoutMs);
    wake=finish;finish(); // Lifecycle event can precede the navigate response.
   });
  }
 };
}
// Serialized into the page; no production handler is invoked synthetically.
function gesturePoint(selector,{scroll=true}={}){
 const e=[...document.querySelectorAll(selector)].find(node=>node.getClientRects().length&&!node.disabled);
 if(!e||e.closest('[inert],.modal-open-guard'))return null;
 if(scroll)e.scrollIntoView({block:'center',behavior:'instant'});
 const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
 const hit=document.elementFromPoint(x,y);
 return hit&&(hit===e||e.contains(hit))?{x,y}:null;
}
// CDP input is handled after this JS task. A same-task hit test following
// scrollIntoView is insufficient: require a rendered frame and stable geometry.
async function stableGesturePoint(selector,sample){
 const before=sample(selector);if(!before)return null;
 const hit=document.elementFromPoint(before.x,before.y);
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const after=sample(selector,{scroll:false});
 return after&&Math.abs(after.x-before.x)<=0.5&&Math.abs(after.y-before.y)<=0.5&&document.elementFromPoint(after.x,after.y)===hit?after:null;
}
// Read-only per-gesture evidence in a disposable test document. No text/values,
// UID or storage inspection; no event cancellation, synthesis or retry.
function observeGesture(selector){
 const target=document.querySelector(selector),events=[];
 const types=['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','click'];
 const record=event=>{events.push({type:event.type,trusted:event.isTrusted,onTarget:!!target&&(event.target===target||target.contains(event.target))});if(events.length>16)events.shift();};
 for(const type of types)window.addEventListener(type,record,true);
 return {snapshot:()=>({events:[...events],connected:!!target?.isConnected}),close(){for(const type of types)window.removeEventListener(type,record,true);}};
}
async function waitForGesturePoint(evaluate,selector,{timeoutMs=20000,pause=ms=>new Promise(r=>setTimeout(r,ms)),stable=false}={}){
 const argument=JSON.stringify(selector),sample='('+gesturePoint.toString()+')';
 const expression=stable?'('+stableGesturePoint.toString()+')('+argument+','+sample+')':sample+'('+argument+')',end=Date.now()+timeoutMs;
 do{const point=await evaluate(expression);if(point)return point;await pause(50);}while(Date.now()<end);
 throw Error('Native gesture target not ready: '+selector);
}
module.exports={documentNavigation,gesturePoint,stableGesturePoint,observeGesture,waitForGesturePoint};
