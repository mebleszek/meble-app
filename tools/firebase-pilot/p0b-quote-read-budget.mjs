// Count verified source captures, not machine-dependent wall-clock deadlines.
// All wrapped calls execute the real guards and calculations unchanged.
import assert from 'node:assert/strict';
export async function observeQuoteReads(page){
 await page.evaluate(()=>{
  const fc=window.FC,api=fc.projectPcvOverrides,read=api.withCalculationRead,context=fc.roomQuoteSources.context;
  const events=window.normalQuoteReadBudget={reads:[],startedAt:performance.now(),prepared:false,normalization:{records:0,max:0}};let active=null;
  const run=fc.roomQuoteAccess.run;
  fc.roomQuoteAccess.run=function(...args){
   const button=document.querySelector('[data-action="wycena-generate"]');
   events.prepared=button?.disabled===true&&button?.textContent==='Liczę…';
   return run.apply(this,args);
  };
  const schemaNormalize=fc.schema.normalizeProject,recordNormalize=fc.projectModel.normalizeProjectRecord;let normalizing=null;
  fc.schema.normalizeProject=function(...args){if(normalizing)normalizing.count++;return schemaNormalize.apply(this,args);};
  fc.projectModel.normalizeProjectRecord=function(...args){
   const previous=normalizing,entry=normalizing={count:0};
   try{return recordNormalize.apply(this,args);}finally{events.normalization.records++;events.normalization.max=Math.max(events.normalization.max,entry.count);normalizing=previous;}
  };
  api.withCalculationRead=function(callback){
   if(active)return read.call(this,callback);
   const scope=active={count:0,rooms:new Set()};
   try{return read.call(this,callback);}finally{events.reads.push({count:scope.count,rooms:scope.rooms.size});active=null;}
  };
  fc.roomQuoteSources.context=function(projectId,roomId){
   if(active){active.count++;active.rooms.add(JSON.stringify([projectId,roomId]));}
   return context.call(this,projectId,roomId);
  };
 });
}
export async function assertQuoteReadBudget(page,t){
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.roomQuoteAccess.busy());
 const result=await page.evaluate(()=>{const button=document.querySelector('[data-action="wycena-generate"]');return {...window.normalQuoteReadBudget,button:{text:button?.textContent,disabled:button?.disabled},elapsedMs:performance.now()-window.normalQuoteReadBudget.startedAt};});
 assert.equal(result.button.text,'Wyceń');assert.equal(result.button.disabled,false,'Completion restores the real current button after rerenders');
 assert.equal(result.prepared,true,'Existing busy feedback precedes synchronization/source preparation');
 assert.ok(result.normalization.records>0,'The real flow normalizes project records');assert.equal(result.normalization.max,1,'A project record is normalized once, not three times for a summary');
 assert.ok(result.reads.some(row=>row.rooms===2),'The real quote must verify both independent rooms');
 for(const row of result.reads)assert.equal(row.count,row.rooms,'A synchronous calculation must verify each room exactly once, without repeated full normalization');
 t.diagnostic('Three-cabinet kitchen + independent wardrobe: '+JSON.stringify(result));
}
