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
 const point=()=>{const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
  const hit=document.elementFromPoint(x,y),width=typeof innerWidth==='number'?innerWidth:Infinity,height=typeof innerHeight==='number'?innerHeight:Infinity;
  return x>=0&&y>=0&&x<width&&y<height&&hit&&(hit===e||e.contains(hit))?{x,y}:null;};
 // Do not scroll an already hittable sticky header. Unnecessary centering can
 // move its hitbox after the DOM sample but before native pointerdown.
 let ready=point();if(ready||!scroll)return ready;
 e.scrollIntoView({block:'center',behavior:'instant'});return point();
}
// CDP input is handled after this JS task. A same-task hit test following
// scrollIntoView is insufficient: require a rendered frame and stable geometry.
async function stableGesturePoint(selector,sample){
 const before=sample(selector);if(!before)return null;
 const hit=document.elementFromPoint(before.x,before.y);
 // Smooth project scrolling and the mobile header can move a ready target
 // after two frames. Require a continuous rendered interval with unchanged
 // coordinates, hit target and scroll position before sending a single input.
 const y=window.scrollY,x=window.scrollX;
 for(let frame=0;frame<6;frame++){
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const next=sample(selector,{scroll:false});
  if(!next||Math.abs(next.x-before.x)>0.5||Math.abs(next.y-before.y)>0.5||window.scrollY!==y||window.scrollX!==x||document.elementFromPoint(next.x,next.y)!==hit)return null;
 }
 return before;
}
// A preceding tab may leave a compositor-driven smooth scroll pending even
// when the renderer reports a stable rectangle for six frames. Before a NEW
// trusted test gesture, end that animation without moving the viewport.
// No synthetic input, event suppression, retries or production UI changes.
function finishPendingTouchScroll(){
 const x=window.scrollX,y=window.scrollY;
 window.scrollTo({left:x,top:y,behavior:'instant'});
 return {x:window.scrollX,y:window.scrollY};
}
// Read-only test evidence at the exact sampled coordinate and at trusted
// pointerdown. Geometry and tab labels only: no business data or storage.
function nativeTouchProbe(selector,x,y){
 const wanted=document.querySelector(selector),header=document.querySelector('header'),tabs=document.getElementById('topTabs');
 const rect=node=>{if(!node)return null;const b=node.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
 const hit=document.elementFromPoint(x,y),viewport=window.visualViewport;
 return {point:{x,y},scroll:{x:window.scrollX,y:window.scrollY,documentY:document.documentElement?.scrollTop,bodyY:document.body?.scrollTop},
  viewport:{width:window.innerWidth,height:window.innerHeight,offsetTop:viewport?.offsetTop,pageTop:viewport?.pageTop,scale:viewport?.scale},
  header:rect(header),tabs:rect(tabs),wanted:rect(wanted),
  hit:{tag:hit?.tagName||null,tab:hit?.dataset?.tab||null,onTarget:!!wanted&&!!hit&&(hit===wanted||wanted.contains(hit))}};
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
module.exports={documentNavigation,gesturePoint,stableGesturePoint,finishPendingTouchScroll,nativeTouchProbe,observeGesture,waitForGesturePoint};
