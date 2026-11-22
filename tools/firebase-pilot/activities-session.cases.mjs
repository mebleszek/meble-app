import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function activitiesSessionCase({t,phone,addCabinet,image,rows,restartProbe,artifacts}){
 const page=phone.page;
 await addCabinet(phone,61);await addCabinet(phone,62);
 await page.evaluate(()=>{
  // Only discard reproducible RAM caches in this disposable DEMO profile.
  // A cold activities entry must not depend on a prior calculator visit.
  for(const room of Object.values(window.projectData))for(const cab of room?.cabinets||[]){delete cab.derivedFacts;delete cab._derivedFacts;}
 });
 const before=await image(phone);
 await page.evaluate(()=>{
  const trace=window.normalActivities={renders:0,contexts:0,sourcesPerRender:[],renderMs:[],checks:[]};
  const view=window.FC.tabsRouter.get('czynnosci'),render=view.render;
  view.render=function(...args){trace.renders++;const before=trace.contexts,started=performance.now();try{return render.apply(this,args);}finally{trace.sourcesPerRender.push(trace.contexts-before);trace.renderMs.push(performance.now()-started);}};
  const source=window.FC.roomProjectModel,context=source.quoteSource;
  source.quoteSource=function(...args){trace.contexts++;return context.apply(this,args);};
  const session=window.FC.session,check=session.canSaveProject;
  session.canSaveProject=function(...args){const result=check.apply(this,args);if(result!==true&&trace.checks.length<5)trace.checks.push({result,error:session.lastError?.code});return result;};
 });
 const profiler=process.env.MEBLE_ACTIVITIES_PROFILE==='1'?await page.context().newCDPSession(page):null;
 if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
 try{
  await page.locator('[data-action="tab"][data-tab="czynnosci"]').filter({visible:true}).first().click();
  await page.waitForFunction(()=>window.uiState.activeTab==='czynnosci'&&!window.FC.applicationStartup.inspect().transactionPending);
  await page.locator('.czynnosci-cabinet-section').waitFor({state:'visible'});
  await page.locator('details.czynnosci-cabinet summary').first().click();
  await page.waitForFunction(()=>document.querySelector('details.czynnosci-cabinet').open===true);
  await page.locator('[data-action="tab"][data-tab="material"]').filter({visible:true}).first().click();
  await page.waitForFunction(()=>window.uiState.activeTab==='material'&&!window.FC.applicationStartup.inspect().transactionPending);
  await page.locator('[data-action="tab"][data-tab="czynnosci"]').filter({visible:true}).first().click();
  await page.waitForFunction(()=>window.uiState.activeTab==='czynnosci'&&!window.FC.applicationStartup.inspect().transactionPending);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 }finally{
  if(profiler){const profile=await profiler.send('Profiler.stop');await profiler.detach();fs.writeFileSync(path.join(artifacts,'activities.cpuprofile'),JSON.stringify(profile.profile));}
  t.diagnostic('Activities entry '+JSON.stringify(await page.evaluate(()=>window.normalActivities)));
 }
 const after=await image(phone);
 const reads=await page.evaluate(()=>window.normalActivities);
 assert.equal(reads.renders,2,'Both real entries must render activities');
 assert.ok(reads.sourcesPerRender.every(count=>count>0&&count<=2),'One verified all-room and current-room snapshot per render: '+JSON.stringify(reads));
 assert.deepEqual(reads.checks,[],'No owner refusal may occur during the view read');
 const business=value=>Object.fromEntries(Object.entries(rows(value)).filter(([key])=>!['fc_ui_v1','fc_edit_session_v1'].includes(key)));
 assert.deepEqual(business(after),business(before),'Opening activities must not change persisted business records');
 assert.deepEqual(after.outbox,before.outbox,'Opening activities must not publish the draft');
 assert.equal(await page.evaluate(()=>window.FC.session.lastError?.code||null),null);
 assert.equal(await page.locator('.info-box').isVisible(),false,'Opening activities must not show session diagnostics');
 await restartProbe(phone,{crash:true});
 assert.equal(await phone.page.evaluate(()=>window.uiState.activeTab),'czynnosci');
 assert.equal(await phone.page.evaluate(()=>window.FC.session.lastError?.code||null),null,'Restart must restore the same session without an owner refusal');
 assert.equal(await phone.page.locator('.info-box').isVisible(),false,'Restart must not open diagnostics for the confirmed session');
 assert.deepEqual(business(await image(phone)),business(before));
}
