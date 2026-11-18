import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as f from 'firebase/firestore';

export async function variantsCase(c){
 const {t,phone,computer,offer,iid,pid,db,ownerUid,until,image,rows,restartProbe,artifacts,globalBefore,env}=c;
 const page=phone.page,scope=(await image(phone)).outbox.find(op=>op.scope.startsWith('p0b_quotes_')).scope;
 await until(async()=>(await image(phone)).outbox.find(op=>op.scope===scope)?.phase==='verified');
 const first=await image(phone),firstLedger=JSON.parse(first.replicas.find(row=>row.key===scope).json);
 // Only explicit synthetic commercial inputs differ, never a price list/rule.
 const amount=page.locator('.quote-offer-field').filter({has:page.getByText('Rabat kwotowy',{exact:true})}).locator('input');
 if(!await amount.isVisible())await page.locator('.quote-offer-accordion__trigger').click();
 await amount.fill('1');await amount.blur();await page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());
 const before=await image(phone),keys=Object.keys(rows(before));
 await page.evaluate(keys=>{
  const writer=window.FC.applicationWrite,original=writer.project;
  writer.project=async fn=>{
   const previous=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
   window.normalVariantAttempt={};
   try{return await original(async()=>{
    const result=await fn(),next=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
    const changedKeys=keys.filter(key=>previous[key]!==next[key]);
    window.normalVariantAttempt={changedKeys,before:previous,after:next};
    return result;
   });}catch(error){Object.assign(window.normalVariantAttempt,{code:error.code||error.message,stack:error.stack});throw error;}
  };
  window.normalLoseQuoteAck=true;
 },keys);
 await page.locator('[data-action="wycena-generate"]').click();
 const naming=page.locator('.quote-scope-entry-modal--name');await naming.waitFor();
 await naming.locator('input').fill('P0-B drugi wariant DEMO');
 await naming.getByRole('button',{name:'OK',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.info-box')||!window.FC.applicationStartup.inspect().transactionPending);
 const attempted=await page.evaluate(()=>window.normalVariantAttempt);
 fs.writeFileSync(path.join(artifacts,'variant-attempt.json'),JSON.stringify(attempted,null,2));
 if(attempted?.code)t.diagnostic('First variant refusal: '+JSON.stringify({code:attempted.code,changedKeys:attempted.changedKeys,stack:attempted.stack}));
 const notice=await page.locator('.info-box').allTextContents();
 assert.ok(!attempted?.code,'Variant must commit: '+JSON.stringify({notice,code:attempted?.code,changedKeys:attempted?.changedKeys,stack:attempted?.stack}));
 const after=await image(phone),history=JSON.parse(rows(after).fc_quote_snapshots_v1),second=history.find(row=>row.id!==offer.id);
 assert.equal(history.length,2);assert.ok(second);assert.notEqual(second.id,offer.id);
 assert.deepEqual(history.find(row=>row.id===offer.id),offer,'The first frozen snapshot must remain exactly unchanged');
 assert.equal(second.investor.id,iid);assert.equal(second.project.id,pid);
 assert.equal(second.commercial.versionName,'P0-B drugi wariant DEMO');assert.equal(second.commercial.discountAmount,1);
 assert.ok(Math.abs(second.totals.grand-offer.totals.grand+1)<1e-8,'Only the explicit one-unit discount changes the total');
 assert.deepEqual(second.scope,offer.scope,'Source identities, hashes and pinned revisions stay the same');
 const ledger=JSON.parse(after.replicas.find(row=>row.key===scope).json);
 assert.deepEqual(ledger.pins[offer.id],firstLedger.pins[offer.id]);assert.deepEqual(ledger.pins[second.id],firstLedger.pins[offer.id]);
 for(const key of ['fc_projects_v1','fc_investors_v1'])assert.equal(rows(after)[key],rows(before)[key]);
 const unrelated=Object.keys(rows(before)).filter(key=>!['fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_ui_v1'].includes(key));
 for(const key of unrelated)assert.equal(rows(after)[key],rows(before)[key],key+' must remain unchanged');
 const added=after.outbox.filter(op=>!before.outbox.some(prior=>prior.key===op.key));assert.equal(added.length,1);assert.equal(added[0].scope,scope);
 await page.waitForFunction(()=>window.normalQuoteHeadCommitted===true);
 const ref=f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid),head=(await f.getDoc(ref)).data();assert.equal(head.generation,2);
 await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
 await page.evaluate(()=>{window.normalReleaseQuoteAckLoss();return true;});
 await until(async()=>(await image(phone)).outbox.find(op=>op.key===added[0].key)?.phase==='uncertain');
 await page.context().tracing.stop({path:path.join(artifacts,'variant-before-restart.zip')});
 await restartProbe(phone,{crash:true});
 await until(async()=>(await image(phone)).outbox.find(op=>op.key===added[0].key)?.phase==='verified');
 const restarted=await image(phone);assert.deepEqual(JSON.parse(rows(restarted).fc_quote_snapshots_v1),history);
 assert.equal(restarted.outbox.filter(op=>op.scope===scope).length,2);
 assert.deepEqual((await f.getDoc(ref)).data(),head,'Reconcile the same ACK without a duplicate publication');
 const draft=JSON.parse(rows(restarted).fc_quote_offer_drafts_v1).find(row=>row.projectId===pid);
 assert.equal(draft.commercial.versionName,second.commercial.versionName);
 await until(async()=>JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1||'[]').length===2);
 const received=JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1);assert.deepEqual(received,history);
 await env.withSecurityRulesDisabled(async context=>assert.equal((await f.getDocs(f.collection(context.firestore(),'users',ownerUid,'p0bRoomQuotes',iid,'revisions'))).size,2));
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 t.diagnostic('Two real UI variants: immutable first snapshot/pins, exact second values, one atomic ledger/draft commit, SIGKILL and ACK without duplicates');
}
