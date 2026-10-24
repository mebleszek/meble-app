#!/usr/bin/env node
'use strict';
// Read-only advisory for the declared CLOUD manifests, not a release gate or authority.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {HISTORICAL_SHA}=require('./cloud-ci-context');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const prefix='tools/firebase-pilot/';
const specs=Object.freeze([
  {file:prefix+'cloud42-source-pins.json',base:'',code:'CLOUD42_SOURCE_CHANGED',test:'cloud42-live-preparation-smoke.js'},
  {file:prefix+'cloud44-integrity.json',base:'',code:'CLOUD46C_DEPENDENCY_CHANGED',test:'cloud44-gate2-smoke.js'},
  {file:prefix+'cloud46c-integrity.json',base:prefix,code:'CLOUD46C_PACKAGE_CHANGED',test:'cloud46c-proof-smoke.js'},
  {file:prefix+'cloud46d-integrity.json',base:prefix,code:'CLOUD46D_REVIEWED_SOURCE_CHANGED',test:'cloud46d-preparation-smoke.js'},
  {file:prefix+'cloud46e-integrity.json',base:prefix,code:'CLOUD46E_PACKAGE_CHANGED',test:'cloud46e-connection-smoke.js'},
]);
function git(root,args){
  const r=cp.spawnSync('git',['-C',root,...args],{encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1'},maxBuffer:8*1024*1024});
  if(r.status!==0)throw Error('CLOUD_IMPACT_GIT_FAILED');return r.stdout;
}
function protection(root,history){
  // Read immutable reference bytes, never a possibly edited working manifest.
  const read=file=>history?fs.readFileSync(path.join(history,file)):Buffer.from(git(root,['show',HISTORICAL_SHA+':'+file]));
  return specs.map(spec=>{
    const bytes=read(spec.file),manifest=JSON.parse(bytes),entries=Object.entries(manifest.sha256||{}).map(([name,digest])=>{
      const file=path.posix.normalize(spec.base+name);
      if(file.startsWith('/')||file.startsWith('../')||! /^[a-f0-9]{64}$/.test(digest))throw Error('CLOUD_IMPACT_REFERENCE_INVALID');
      return {file,digest};
    });
    if(!entries.length)throw Error('CLOUD_IMPACT_REFERENCE_INVALID');
    return {...spec,bytes,manifest,entries,digest:sha(bytes)};
  });
}
function actualHash(root,file){
  try{return sha(fs.readFileSync(path.join(root,file)));}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function edges(reference){
  const bindings=reference.flatMap(spec=>spec.entries.map(entry=>({...entry,manifest:spec.file,code:spec.code,test:spec.test})));
  // Additional manifest links enforced by C's hard byte pin and D/E upstream fields.
  for(const [parent,child,field]of [[1,2,null],[2,3,'upstream46cManifestSha256'],[3,4,'upstream46dManifestSha256']]){
    const a=reference[parent],b=reference[child];
    if(field&&b.manifest[field]!==a.digest)throw Error('CLOUD_IMPACT_REFERENCE_INVALID');
    bindings.push({file:a.file,digest:a.digest,manifest:b.file,code:parent===1?'CLOUD46C_DEPENDENCY_CHANGED':b.code,test:b.test});
  }
  return bindings;
}
function analyze(root,changed,reference=protection(root)){
  const bindings=edges(reference),results=[];
  for(const file of [...new Set(changed)].sort()){
    const direct=bindings.filter(edge=>edge.file===file).map(edge=>({...edge,matchesHistorical:actualHash(root,file)===edge.digest}));
    const owner=reference.find(spec=>spec.file===file);
    if(owner)direct.push({file,manifest:file,code:owner.file.endsWith('cloud42-source-pins.json')?'CLOUD42_SOURCE_CHANGED / CLOUD43_REVIEW_CHANGED':owner.code,test:owner.test,matchesHistorical:actualHash(root,file)===owner.digest});
    if(/^js\/.*\.js$/.test(file)&&!reference[0].entries.some(entry=>entry.file===file))direct.push({file,manifest:reference[0].file,code:'CLOUD42_SOURCE_CHANGED',test:reference[0].test,matchesHistorical:false,reason:'SOURCE_SET_CHANGED'});
    if(!direct.length)continue;
    const indirect=[],queue=direct.map(edge=>({manifest:edge.manifest,code:edge.code})),seen=new Set(queue.map(x=>x.manifest));
    while(queue.length){
      const current=queue.shift();
      for(const edge of bindings.filter(edge=>edge.file===current.manifest))if(!seen.has(edge.manifest)){
        // A downstream inventory propagates its upstream refusal; it does not
        // imply that the unchanged enclosing manifest's bytes also changed.
        seen.add(edge.manifest);indirect.push({via:current.manifest,manifest:edge.manifest,code:current.code,guardCode:edge.code,test:edge.test});queue.push({manifest:edge.manifest,code:current.code});
      }
    }
    results.push({file,direct,indirect,tests:[...new Set(['cloud-ci-current-boundary-smoke.js',...direct.map(x=>x.test),...indirect.map(x=>x.test)])]});
  }
  return {historicalSha:HISTORICAL_SHA,advisoryOnly:true,protectedChanges:results,unprotectedChanges:[...new Set(changed)].filter(file=>!results.some(row=>row.file===file)).sort()};
}
function changedFiles(root,base){
  if(!/^[a-f0-9]{40}$/.test(base||'')||git(root,['rev-parse','--verify',base+'^{commit}']).trim()!==base)throw Error('CLOUD_IMPACT_EXACT_BASE_REQUIRED');
  return [...new Set((git(root,['diff','--no-ext-diff','--no-textconv','--no-renames','--name-only','-z',base,'--'])+git(root,['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean))];
}
function main(args=process.argv.slice(2)){
  if(![2,3].includes(args.length)||args[0]!=='--base'||(args[2]&&args[2]!=='--json'))throw Error('Usage: node tools/cloud-ci-impact.js --base <40-char-SHA> [--json]');
  const root=path.resolve(__dirname,'..'),base=args[1],report=analyze(root,changedFiles(root,base));
  report.base=base;report.head=git(root,['rev-parse','HEAD']).trim();
  if(args[2])console.log(JSON.stringify(report,null,2));
  else{
    console.log('CLOUD impact (advisory only): BASE '+base+'; HEAD '+report.head+'; immutable evidence '+HISTORICAL_SHA);
    for(const row of report.protectedChanges){
      console.log(row.file);
      for(const edge of row.direct)console.log('  direct: '+edge.manifest+' → '+edge.code+'; historical bytes '+(edge.matchesHistorical?'MATCH':'DIFFER'));
      for(const edge of row.indirect)console.log('  via '+edge.via+': '+edge.manifest+' → '+edge.code);
      console.log('  tests: '+row.tests.join(', '));
    }
    console.log('Protected changes: '+report.protectedChanges.length+'; outside declared manifest graph: '+report.unprotectedChanges.length+'.');
    console.log('Run the targeted current boundary with a verified isolated historical tree. Historical tests/SDK belong to that tree; no pin updates, LIVE or release approval granted.');
  }
  return report;
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={specs,protection,actualHash,analyze,changedFiles,main};
