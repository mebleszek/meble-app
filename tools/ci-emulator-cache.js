'use strict';
// Read-only verification against checksum metadata from the npm-locked CLI.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function verify(details){
 const {downloadPath,opts}=details||{},hasSha=opts&&Object.hasOwn(opts,'expectedChecksumSHA256');
 const algorithm=hasSha?'sha256':'md5',expected=hasSha?opts.expectedChecksumSHA256:opts?.expectedChecksum;
 if(typeof downloadPath!=='string'||!/^cloud-firestore-emulator-v[\d.]+\.jar$/.test(path.basename(downloadPath))
   ||!Number.isSafeInteger(opts?.expectedSize)||opts.expectedSize<1
   ||!(algorithm==='sha256'?/^[a-f0-9]{64}$/:/^[a-f0-9]{32}$/).test(expected||''))throw Error('CI_EMULATOR_CACHE_METADATA_INVALID');
 let stat;try{stat=fs.lstatSync(downloadPath);}catch(error){if(error.code==='ENOENT')return {status:'MISS',algorithm};throw error;}
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==opts.expectedSize)throw Error('CI_EMULATOR_CACHE_INTEGRITY');
 const hash=crypto.createHash(algorithm);for await(const bytes of fs.createReadStream(downloadPath))hash.update(bytes);
 if(hash.digest('hex')!==expected)throw Error('CI_EMULATOR_CACHE_INTEGRITY');
 return {status:'VERIFIED',algorithm};
}
async function main(sdkRoot){
 const root=path.resolve(sdkRoot),cli=require(path.join(root,'node_modules/firebase-tools/lib/emulator/downloadableEmulators.js'));
 const result=await verify(cli.getDownloadDetails('firestore'));console.log('CI_EMULATOR_CACHE '+JSON.stringify(result));
}
if(require.main===module)main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={verify};
