'use strict';
// Deterministic public-shell manifest. Never scans runtime/profile/user stores.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function manifest(){
  const names=['index.html'];
  function walk(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    const name=dir+'/'+entry.name;if(entry.isDirectory())walk(name);else if(/\.(js|css|jpg|jpeg|png|svg|webp|woff2?)$/i.test(name))names.push(name);
  }}
  for(const dir of ['js','css','assets'])walk(dir);
  const files=names.sort().map(name=>{const bytes=fs.readFileSync(path.join(root,name));return {path:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
  return {version:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
function source(){return 'self.MEBLE_OFFLINE_ASSETS='+JSON.stringify(manifest())+';\n';}
if(require.main===module){if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'offline-assets.js'),source());else if(fs.readFileSync(path.join(root,'offline-assets.js'),'utf8')!==source())throw Error('OFFLINE_MANIFEST_STALE');}
module.exports={manifest,source};
