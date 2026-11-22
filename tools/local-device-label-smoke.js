'use strict';
const assert=require('node:assert/strict');
async function main(){
 const {defaultDeviceLabel,createLocalDeviceLabel}=await import('../sync/local-device-label.mjs');
 const cases=[
  [{userAgent:'Mozilla Android 10 Mobile Chrome/120.0'},'Telefon Android – Chrome'],
  [{userAgent:'Mozilla Android 10 Mobile Chrome/120.0',brave:{isBrave(){}}},'Telefon Android – Brave'],
  [{userAgent:'Windows NT Chrome/120.0 Edg/120.0'},'Komputer Windows – Edge'],
  [{userAgent:'iPhone Version/17.0 Mobile Safari/605'},'iPhone – Safari'],
  [{platform:'MacIntel',maxTouchPoints:5,userAgent:'Version/17 Safari/605'},'iPad – Safari'],
  [{userAgentData:{platform:'Android',mobile:false,brands:[{brand:'Chromium'}]}},'Tablet Android – Chromium'],
  [{platform:'Linux',userAgent:'Firefox/120.0'},'Komputer Linux – Firefox'],[{},'Urządzenie – Przeglądarka']];
 for(const [n,label]of cases)assert.equal(defaultDeviceLabel(n),label);
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 let allowed=true;const options={storage,deviceId:'stable-installation',navigator:cases[0][0],assertAccess(){if(!allowed)throw Error('AUTH_ACCESS_REVOKED');}};
 const label=createLocalDeviceLabel(options);assert.equal(label.display(),cases[0][1]);assert.equal(label.read(),'');assert.equal(values.size,0,'Default must not write or change device identity');
 label.write('  Telefon Leszka  ');assert.equal(label.display(),'Telefon Leszka');assert.equal(createLocalDeviceLabel({...options,navigator:{}}).display(),'Telefon Leszka','Custom label survives restart/browser detection changes');
 assert.equal(createLocalDeviceLabel({...options,deviceId:'other'}).read(),'');assert.throws(()=>label.write('bad\nlabel'),/INVALID/);label.write('');assert.equal(label.display(),cases[0][1]);
 allowed=false;assert.throws(()=>label.display(),/AUTH_ACCESS_REVOKED/);
 console.log('PASS default device names: OS/browser fallbacks, Brave/Edge, custom labels and identity/access preserved without writes');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
