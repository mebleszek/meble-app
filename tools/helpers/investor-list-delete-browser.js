'use strict';
const assert=require('node:assert/strict');
// This intercepted-origin fixture has no controlling Service Worker. Exercise
// real selection/preview/Cancel here; full commit uses the real SW fixture.
async function exerciseListDeletion({evaluate,tap,until,send}){
 const ids=await evaluate('window.FC.investors.readAll().map(inv=>inv.id)');assert.equal(ids.length,3);
 const raw=await evaluate('JSON.stringify([...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).sort().map(k=>[k,localStorage.getItem(k)]))');
 await tap('[data-action="remove-investor-from-list"]');await until('document.querySelectorAll("[data-investor-delete-id]").length===3','selection mode');
 await tap('[data-action="remove-investor-from-list"]');await until('!document.querySelector("[data-investor-delete-id]")','empty selection exits');
 await tap('[data-action="remove-investor-from-list"]');
 for(const id of ids.slice(0,2))await tap('[data-investor-delete-id="'+id+'"]');
 assert.equal(await evaluate('window.FC.investorUI.state.deleteIds.length'),2);
 await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector(".confirm-box")','batch confirmation');
 assert.match(await evaluate('document.querySelector(".confirm-message").textContent'),/Inwestorzy: 2/);
 await tap('.confirm-box .is-neutral');await until('!document.querySelector(".confirm-box")','Cancel');
 assert.equal(await evaluate('window.FC.investorUI.state.deleteIds.length'),2);
 assert.equal(await evaluate('JSON.stringify([...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).sort().map(k=>[k,localStorage.getItem(k)]))'),raw);
 const viewport=await evaluate('({width:innerWidth,height:innerHeight})');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
 const layout=await evaluate(`(()=>{const a=document.querySelector('[data-action="create-investor"]').getBoundingClientRect(),b=document.querySelector('[data-action="remove-investor-from-list"]').getBoundingClientRect(),row=document.querySelector('.investor-list-row-actions'),o=row.querySelector('button').getBoundingClientRect(),c=row.querySelector('input').getBoundingClientRect();return {paired:Math.abs(a.top-b.top)<1&&b.left>=a.right,right:c.left>=o.right,overflow:document.documentElement.scrollWidth>innerWidth,red:getComputedStyle(row.querySelector('input')).accentColor};})()`);
 assert.equal(layout.paired,true);assert.equal(layout.right,true);assert.equal(layout.overflow,false);assert.equal(layout.red,'rgb(220, 38, 38)');
 await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
 for(const id of ids.slice(0,2))await tap('[data-investor-delete-id="'+id+'"]');await tap('[data-action="remove-investor-from-list"]');
 assert.equal(await evaluate('window.FC.investorDeletion.pending()'),false);
 console.log('PASS native mobile batch selection, two minus clicks, red checkboxes right of Open at 320px, Cancel keeps exact RAW; full commit assigned to real-Service-Worker test');
}
module.exports={exerciseListDeletion};
