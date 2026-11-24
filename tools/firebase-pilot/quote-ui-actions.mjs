// Existing regression cases explicitly accept the newly approved historical-data
// warning. Dedicated quote-lock cases exercise all three choices themselves.
export function applicationIdle(){
 const state=window.FC.applicationStartup.inspect();
 return state.transactionPending===false&&state.incomingPending===false;
}
export async function confirmQuoteSources(page){
 await page.waitForFunction(()=>{
  const visible=selector=>!!document.querySelector(selector)?.getClientRects().length;
  const button=document.querySelector('[data-action="wycena-generate"]');
  // The gesture is disabled before async settings/access preparation starts.
  // An idle source inspector alone cannot prove that no warning will appear.
  return visible('.quote-lock-warning')||visible('.info-box')||window.FC.wycenaTabShell._generateRuntime.inFlight===true
   ||button?.disabled===false&&!window.FC.roomQuoteAccess?.busy();
 });
 const panel=page.locator('.quote-lock-warning');if(await panel.isVisible())await panel.getByRole('button',{name:'Tak',exact:true}).click();
}
