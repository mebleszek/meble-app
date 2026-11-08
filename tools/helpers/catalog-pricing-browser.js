'use strict';
const assert=require('node:assert/strict');
module.exports=async function({browser,tap,until,fill,roomId}){
 const evaluate=code=>browser.evaluate(code),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
 let phase='start';
 try{
 const before=await evaluate('localProof()'),rawBefore=before.raw,app=proof=>proof.tables.control.find(row=>row.key==='application').rows;
 const frozen=app(before).fc_quote_snapshots_v1;
 const settled=()=>until('!window.FC.applicationStartup.inspect().transactionPending');
 async function openRule(name){
  phase='rule '+name;
  await evaluate('window.FC.actions.dispatch("open-quote-rates",{})');await until('document.getElementById("priceModal").style.display==="flex"');
  await tap('#clearPriceFiltersBtn');await fill('#priceSearch',name);
  await until(`Array.from(document.querySelectorAll('#priceModal .price-modal-list-row')).some(row=>row.querySelector('.price-modal-list-main > div').textContent.trim().startsWith(${JSON.stringify(name)}))`);
  await evaluate(`(()=>{const row=Array.from(document.querySelectorAll('#priceModal .price-modal-list-row')).find(row=>row.querySelector('.price-modal-list-main > div').textContent.trim().startsWith(${JSON.stringify(name)}));row.querySelector('.price-modal-list-actions button').dataset.testRule='true';return true;})()`);
  await tap('[data-test-rule="true"]');await until('document.getElementById("priceItemModal").style.display==="flex"');await settled();
 }
 async function saveItem(){await tap('#priceItemSaveBtn');await until('!!document.querySelector(".confirm-box")');await tap('.confirm-box .is-success');await until('document.getElementById("priceItemModal").style.display!=="flex"&&!window.FC.applicationStartup.inspect().transactionPending');}
 async function closeCatalog(){await tap('#priceModal [data-action="close-price"]');await settled();}
 await openRule('Wnoszenie korpusu / elementów');
 assert.equal(await evaluate('document.getElementById("laborRateType").value'),'assembly');
 assert.equal(await evaluate('getComputedStyle(document.getElementById("priceItemSaveBtn")).display'),'none','unchanged rule has no Save');
 assert.equal(await evaluate('document.getElementById("laborMinimumLevels").value'),'1');
 await fill('#laborMinimumLevels','2');await saveItem();await closeCatalog();
 const quote=await evaluate(`window.FC.wycenaCore.collectQuoteData({selection:{selectedRooms:[${JSON.stringify(roomId)}]}}).then(q=>({carrying:q.carryingLines,edge:q.materialLines.filter(row=>row.pricingMode==='edge')}))`);
 const carrying=quote.carrying.flatMap(row=>row.details).find(row=>row.sourceRole==='carrying-labor');assert.ok(carrying);assert.equal(carrying.quantity,2);near(carrying.hours*60,20);near(carrying.hourlyRate,250);
 await evaluate('window.FC.dataSettingsModal.open()');await tap('[data-settings-section="hourlyRates"]');await until('!!document.getElementById("breakMinutes")');
 assert.equal(await evaluate('document.getElementById("breakMinutes").value'),'30');assert.equal(await evaluate('document.getElementById("breakAfterHours").value'),'4');
 await fill('#breakMinutes','20');await fill('#breakAfterHours','2');await fill('#workdayHours','6');
 await tap('.data-settings-hourly-rates-card .data-settings-actions .btn-success');await until('!!document.querySelector(".info-box")&&!window.FC.applicationStartup.inspect().transactionPending');
 await tap('.info-box button');
 const br=await evaluate('window.FC.catalogStore.getQuoteRates().find(row=>row.id==="labor_daily_break")');near(br.timeBlockHours,1/3);near(br.breakAfterHours,2);near(br.workdayHours,6);
 await evaluate('window.FC.panelBox.close()');
 await openRule('Przerwa');near(Number(await evaluate('document.getElementById("laborTimeBlockHours").value')),1/3);assert.equal(await evaluate('document.getElementById("laborBreakAfterHours").value'),'2');assert.equal(await evaluate('getComputedStyle(document.getElementById("priceItemSaveBtn")).display'),'none');
 await tap('#priceItemModal [data-action="price-item-exit"]');await closeCatalog();
 phase='PCV';
 await evaluate('window.FC.actions.dispatch("open-sheet-materials",{})');await until('document.getElementById("priceModal").style.display==="flex"');await tap('#clearPriceFiltersBtn');await fill('#priceSearch','Obrzeże PCV standard');await until('document.querySelectorAll("#priceModal .price-modal-list-row").length===1');await tap('#priceModal .price-modal-list-actions button');await until('document.getElementById("priceItemModal").style.display==="flex"');
 assert.equal(await evaluate('document.getElementById("formEdgeWastePercent").value'),'10');await fill('#formEdgeWastePercent','0');await saveItem();await closeCatalog();
 const edges=await evaluate(`window.FC.wycenaCore.collectQuoteData({selection:{selectedRooms:[${JSON.stringify(roomId)}]}}).then(q=>q.materialLines.filter(row=>row.pricingMode==='edge'))`);
 const edge=edges.find(row=>row.edgePricingMode==='body');assert.ok(edge);near(edge.edgeWastePercent,0);near(edge.qty,edge.edgeRawMeters);
 await openRule('Transport do klienta');assert.equal(await evaluate('document.getElementById("laborUnitPriceSource").value'),'fuel');assert.equal(await evaluate('document.getElementById("formServicePrice").readOnly'),true);near(Number(await evaluate('document.getElementById("formServicePrice").value')),1.4);
 await tap('#laborUnitPriceSourceLaunch button');await until('document.querySelectorAll(".rozrys-choice-option").length===2');await tap('.rozrys-choice-option:first-child');await until('document.getElementById("laborUnitPriceSource").value==="manual"&&!document.getElementById("formServicePrice").readOnly');await fill('#formServicePrice','3.125');await saveItem();await closeCatalog();
 const transport=await evaluate(`window.FC.wycenaCore.collectQuoteData({selection:{selectedRooms:[${JSON.stringify(roomId)}]}}).then(q=>q.quoteRateLines.find(row=>row.sourceRole==='transport-distance'))`);near(transport.unitPrice,3.125);near(transport.total,12.5);
 phase='offer break billing';
 await tap('[data-action="tab"][data-tab="wycena"]');await until('!!document.querySelector(".quote-offer-accordion__trigger")');
 await tap('.quote-offer-accordion__trigger');await until('!!document.querySelector("[data-bill-breaks]")');await tap('label:has([data-bill-breaks])');await until('window.FC.quoteOfferStore.getCurrentDraft().commercial.billBreaks===false&&!window.FC.applicationStartup.inspect().transactionPending');
 assert.equal(await evaluate('window.FC.quoteOfferStore.getCurrentDraft().commercial.billBreaks'),false);
 const next=await evaluate(`window.FC.wycenaCore.collectQuoteData({selection:{selectedRooms:[${JSON.stringify(roomId)}]}}).then(q=>({billBreaks:q.commercial.billBreaks,schedule:q.schedule}))`);
 assert.equal(next.billBreaks,false);assert.equal(next.schedule.billBreaks,false);
 await tap('[data-action="tab"][data-tab="inwestor"]');await settled();
 const after=await evaluate('localProof()');assert.deepEqual(after.raw,rawBefore,'physical originals stay exact');assert.equal(app(after).fc_quote_snapshots_v1,frozen,'all saved offers remain exact');assert.equal(app(after).fc_quote_rates_v1,app(after).fc_services_v1,'LOCAL-FIRST catalog aliases match');
 for(const store of ['replicas','protected','outbox'])assert.deepEqual(after.tables[store],before.tables[store]);
 assert.equal(JSON.parse(app(after).fc_sheet_materials_v1).find(row=>row.id==='m5').edgeWastePercent,0);
 console.log('PASS actual Android forms → native LOCAL-FIRST save → common WYCENA: carrying levels/rate, shared break settings, PCV zero and explicit fuel/manual mode; Save hidden when clean; frozen offers/originals/queue exact');
 }catch(error){try{const shot=await browser.send('Page.captureScreenshot',{format:'png'});require('node:fs').writeFileSync('/tmp/catalog-pricing-ui-fail.png',Buffer.from(shot.data,'base64'));}catch(_){};throw Error('Pricing UI '+phase+': '+error.message+' '+JSON.stringify(await evaluate('({close:(()=>{const b=document.getElementById("closePriceModal").getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.outerHTML?.slice(0,250),info:document.querySelector(".info-box")?.textContent,confirm:document.querySelector(".confirm-box")?.textContent};})(),kind:uiState.showPriceList,search:document.getElementById("priceSearch")?.value,rows:Array.from(document.querySelectorAll("#priceModal .price-modal-list-main > div:first-child")).slice(0,6).map(el=>el.textContent)})')),{cause:error});}
};
