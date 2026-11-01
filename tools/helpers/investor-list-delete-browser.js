'use strict';
const assert=require('node:assert/strict');
// Mandatory real touch fixture; deletion safety/commit stays in its existing SW suite.
async function exerciseListDeletion({evaluate,tap,until,send}){
 const ids=await evaluate('window.FC.investors.readAll().map(inv=>inv.id)');assert.equal(ids.length,3);
 const raw=await evaluate('JSON.stringify([...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).sort().map(k=>[k,localStorage.getItem(k)]))');
 const viewport=await evaluate('({width:innerWidth,height:innerHeight})');
 const geometry=()=>evaluate(`(()=>{document.querySelector('.investor-list-row-text > div').textContent='Bardzo długa nazwa inwestora wymagająca skrócenia i zachowania miejsca na wybór';const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};};return [...document.querySelectorAll('#invItems .item')].map(row=>({card:rect(row),open:rect(row.querySelector('[data-action="open-investor"]'))}));})()`);
 for(const width of [320,360,412]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:true});
  // Display-only long text fixture: no stored business record is changed.
  const normal=await geometry();
  await tap('[data-action="remove-investor-from-list"]');await until('document.querySelectorAll("[data-investor-delete-id]").length===3','selection mode');
  assert.deepEqual(await geometry(),normal,'0 selected: cards/Open unchanged '+width);
  const layout=await evaluate(`(()=>{const a=document.querySelector('[data-action="create-investor"]').getBoundingClientRect(),b=document.querySelector('[data-action="remove-investor-from-list"]').getBoundingClientRect();return {paired:Math.abs(a.top-b.top)<1&&b.left>=a.right,compact:a.height<44&&b.height<44,overflow:document.documentElement.scrollWidth>innerWidth,rows:[...document.querySelectorAll('#invItems .item')].map(row=>{const o=row.querySelector('button').getBoundingClientRect(),c=row.querySelector('label').getBoundingClientRect(),t=row.querySelector('.investor-list-row-text').getBoundingClientRect(),i=row.querySelector('input');return {left:c.right<=o.left,text:c.left>=t.right,hit:c.width>=32&&c.height>=36,red:getComputedStyle(i).accentColor};})};})()`);
  assert.equal(layout.paired,true);assert.equal(layout.compact,true);assert.equal(layout.overflow,false);
  for(const row of layout.rows)assert.deepEqual(row,{left:true,text:true,hit:true,red:'rgb(220, 38, 38)'});
  await tap('[data-investor-delete-id="'+ids[0]+'"]');assert.equal(await evaluate('window.FC.investorUI.state.deleteIds.length'),1);assert.deepEqual(await geometry(),normal,'1 selected '+width);
  await tap('[data-investor-delete-id="'+ids[1]+'"]');assert.equal(await evaluate('window.FC.investorUI.state.deleteIds.length'),2);assert.deepEqual(await geometry(),normal,'multi selected '+width);
  await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector(".confirm-box")','batch confirmation');
  assert.match(await evaluate('document.querySelector(".confirm-message").textContent'),/Inwestorzy: 2/);
  await tap('.confirm-box .is-neutral');await until('!document.querySelector(".confirm-box")','Cancel');
  assert.equal(await evaluate('window.FC.investorUI.state.deleteIds.length'),2);assert.deepEqual(await geometry(),normal,'Cancel '+width);
  assert.equal(await evaluate('JSON.stringify([...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).sort().map(k=>[k,localStorage.getItem(k)]))'),raw);
  for(const id of ids.slice(0,2))await tap('[data-investor-delete-id="'+id+'"]');
  await tap('[data-action="remove-investor-from-list"]');await until('!document.querySelector("[data-investor-delete-id]")','empty selection exits');assert.deepEqual(await geometry(),normal);
 }
 await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate('window.FC.investorDeletion.pending()'),false);
 console.log('PASS native compact investor list 320/360/412: fixed cards/Open, left checkboxes, 0/1/multi, Cancel, no overlaps/overflow, unchanged RAW');
}
module.exports={exerciseListDeletion};
