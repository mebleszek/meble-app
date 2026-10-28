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
function gesturePoint(selector){
 const e=[...document.querySelectorAll(selector)].find(node=>node.getClientRects().length&&!node.disabled);
 if(!e||e.closest('[inert],.modal-open-guard'))return null;
 e.scrollIntoView({block:'center',behavior:'instant'});
 const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
 const hit=document.elementFromPoint(x,y);
 return hit&&(hit===e||e.contains(hit))?{x,y}:null;
}
async function waitForGesturePoint(evaluate,selector,{timeoutMs=20000,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const expression='('+gesturePoint.toString()+')('+JSON.stringify(selector)+')',end=Date.now()+timeoutMs;
 do{const point=await evaluate(expression);if(point)return point;await pause(50);}while(Date.now()<end);
 throw Error('Native gesture target not ready: '+selector);
}
module.exports={documentNavigation,gesturePoint,waitForGesturePoint};
