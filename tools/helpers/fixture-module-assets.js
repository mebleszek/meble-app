'use strict';
// Serve the literal relative import closure of declared fixture entry points.
// A changed module dependency must not become an opaque browser import error.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
function moduleAssets(entries=['sync/local-first-idb.mjs','sync/application-installation.mjs']){
 const assets=new Map(),seen=new Set();
 function visit(name){
  const file=path.resolve(ROOT,name);
  if(!file.startsWith(ROOT+path.sep)||!/\.m?js$/.test(file))throw Error('FIXTURE_MODULE_OUTSIDE_ROOT');
  const relative=path.relative(ROOT,file).split(path.sep).join('/');
  if(seen.has(relative))return;seen.add(relative);
  const source=fs.readFileSync(file,'utf8');assets.set('/'+relative,relative);
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)){
   if(match[1].startsWith('.'))visit(path.relative(ROOT,path.resolve(path.dirname(file),match[1])));
  }
 }
 for(const entry of entries)visit(entry);
 return assets;
}
module.exports={moduleAssets,ROOT};
