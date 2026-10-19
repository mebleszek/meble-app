'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const collect=require('./diagnostics/pixel-session-readonly');
function build(){
  const source=collect.toString().split('\n').filter(line=>!line.trim().startsWith('//')).map(line=>line.trim()).join('');
  const body='void async function(){try{const report=('+source+')(window);await navigator.clipboard.writeText(JSON.stringify(report));}catch(_){}}()';
  new vm.Script(body);
  return 'javascript:'+body;
}
if(require.main===module){
  const file=path.join(__dirname,'diagnostics/pixel-session-bookmarklet.txt');
  fs.writeFileSync(file,build()+'\n');console.log('Built '+path.relative(process.cwd(),file)+' ('+build().length+' characters)');
}
module.exports={build};
