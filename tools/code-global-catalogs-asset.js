'use strict';
const fs=require('node:fs'),{buildCodeCatalogs}=require('./helpers/code-global-catalogs');
function source(){const {model,rules,provenance}=buildCodeCatalogs();
 // The shipped artifact is code-only. Do not couple its bytes to a runner's
 // Node patch/ICU version; tests verify source/model/rule hashes independently.
 const proof={...provenance,runtime:{kind:'CODE_BUILD_V1'}};
 return '// Generated from approved program definitions; no owner data.\nexport const codeCandidate='+JSON.stringify({model,rules,provenance:proof})+';\n';
}
if(require.main===module){const target='sync/code-global-catalogs.generated.mjs';if(process.argv.includes('--write'))fs.writeFileSync(target,source());else if(fs.readFileSync(target,'utf8')!==source())throw Error('CODE_FACTORY_ASSET_STALE');}
module.exports={source};
