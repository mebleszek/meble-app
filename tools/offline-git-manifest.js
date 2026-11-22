'use strict';
// Reads immutable Git/index blobs in one batch. No working-tree normalization,
// browser profile, network, credentials or application data are involved.
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const {isPublicPath}=require('./offline-assets');
function verify(root,revision='HEAD'){
 if(revision!=='HEAD'&&revision!=='INDEX'&&!/^[a-f0-9]{40}$/.test(revision))throw Error('OFFLINE_GIT_REVISION_INVALID');
 const git=(args,input)=>execFileSync('git',['-C',root,...args],{input,maxBuffer:64*1024*1024});
 const indexed=revision==='INDEX',raw=git(indexed?['ls-files','--stage','-z']:['ls-tree','-rz',revision]).toString('utf8');
 const entries=raw.split('\0').filter(Boolean).map(line=>{
  const split=line.indexOf('\t'),meta=line.slice(0,split).split(' '),name=line.slice(split+1);
  if(split<0||/[\r\n]/.test(name))throw Error('OFFLINE_GIT_PATH_INVALID');
  return {path:name,mode:meta[0],type:indexed?'blob':meta[1],stage:indexed?meta[2]:'0'};
 }).filter(row=>isPublicPath(row.path)||row.path==='offline-assets.js').sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 if(entries.some(row=>row.stage!=='0'||row.mode!=='100644'||row.type!=='blob')||!entries.some(row=>row.path==='offline-assets.js'))throw Error('OFFLINE_GIT_SOURCE_INVALID');
 const refs=entries.map(row=>(indexed?'':revision)+':'+row.path),batch=git(['cat-file','--batch'],refs.join('\n')+'\n');
 let cursor=0,manifest;const files=[];
 for(const row of entries){
  const end=batch.indexOf(10,cursor),header=batch.subarray(cursor,end).toString('ascii'),match=/^[a-f0-9]+ blob (\d+)$/.exec(header);
  if(end<0||!match)throw Error('OFFLINE_GIT_BLOB_UNCONFIRMED');
  const size=Number(match[1]),start=end+1,bytes=batch.subarray(start,start+size);cursor=start+size+1;
  if(bytes.length!==size||batch[cursor-1]!==10)throw Error('OFFLINE_GIT_BLOB_UNCONFIRMED');
  if(row.path==='offline-assets.js')manifest=bytes.toString('utf8');
  else files.push({path:row.path,bytes:size,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 if(cursor!==batch.length)throw Error('OFFLINE_GIT_BLOB_UNCONFIRMED');
 const version=crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
 const expected='self.MEBLE_OFFLINE_ASSETS='+JSON.stringify({version,files})+';\n';
 if(manifest!==expected)throw Error('OFFLINE_GIT_MANIFEST_STALE');
 return {version,count:files.length,revision};
}
if(require.main===module){try{console.log('PASS exact Git public manifest',verify(process.cwd(),process.argv[2]||'HEAD'));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={verify};
