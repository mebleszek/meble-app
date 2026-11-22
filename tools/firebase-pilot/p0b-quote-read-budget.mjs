// Count verified source captures, not machine-dependent wall-clock deadlines.
// All wrapped calls execute the real guards and calculations unchanged.
import assert from 'node:assert/strict';
export async function observeQuoteReads(page){
 await page.evaluate(()=>{
  const fc=window.FC,api=fc.projectPcvOverrides,read=api.withCalculationRead,context=fc.roomQuoteSources.context;
  const events=window.normalQuoteReadBudget={reads:[],startedAt:performance.now()};let active=null;
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
 const result=await page.evaluate(()=>({...window.normalQuoteReadBudget,elapsedMs:performance.now()-window.normalQuoteReadBudget.startedAt}));
 assert.ok(result.reads.some(row=>row.rooms===2),'The real quote must verify both independent rooms');
 for(const row of result.reads)assert.equal(row.count,row.rooms,'A synchronous calculation must verify each room exactly once, without repeated full normalization');
 t.diagnostic('Three-cabinet kitchen + independent wardrobe: '+JSON.stringify(result));
}
