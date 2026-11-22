// Existing regression cases explicitly accept the newly approved historical-data
// warning. Dedicated quote-lock cases exercise all three choices themselves.
export async function confirmQuoteSources(page){
 await page.waitForFunction(()=>document.querySelector('.quote-lock-warning')||document.querySelector('.info-box')||window.FC.wycenaTabShell._generateRuntime.inFlight||!window.FC.roomQuoteAccess?.busy());
 const panel=page.locator('.quote-lock-warning');if(await panel.isVisible())await panel.getByRole('button',{name:'Tak',exact:true}).click();
}
