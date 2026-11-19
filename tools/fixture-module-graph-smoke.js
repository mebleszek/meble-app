'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {moduleAssets,ROOT}=require('./helpers/fixture-module-assets');
async function main(){
 const assets=moduleAssets();
 for(const name of ['local-first-idb','local-first-quote-store','local-first-quote-status','local-first-room-batch','application-p0b-domain','application-p0b-binding'])assert.ok(assets.has('/sync/'+name+'.mjs'),name);
 assert.throws(()=>moduleAssets(['../outside.mjs']),/FIXTURE_MODULE_OUTSIDE_ROOT/);
 assert.throws(()=>moduleAssets(['sync/missing-fixture.mjs']),/ENOENT/);
 const {startLocalFirstServer}=await import('./helpers/local-first-browser.mjs');
 const server=await startLocalFirstServer();
 try{
  for(const [url,file]of assets){const response=await fetch(server.base+url);assert.equal(response.status,200,url);assert.match(response.headers.get('content-type'),/javascript/);assert.equal(await response.text(),fs.readFileSync(path.join(ROOT,file),'utf8'),url);}
  for(const url of ['/package.json','/sync/local-first-does-not-exist.mjs'])assert.equal((await fetch(server.base+url)).status,404,url);
 }finally{await server.close();}
 console.log('PASS actual HTTP 200 and exact source for '+assets.size+' module dependencies; invalid roots and missing resources refuse');
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={main};
