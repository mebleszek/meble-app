'use strict';
// Exact anonymous Android statuses on synthetic native + IDB authority data.
const {rescueFixture}=require('./local-first-rescue-fixture'),{buildCodeCatalogs}=require('./code-global-catalogs');
async function codeRebuildFixture(){
 const {readRescueSnapshot}=await import('../../sync/local-first-rescue-snapshot.mjs'),{codeGlobalRows}=await import('../../sync/global-code-rebuild-plan.mjs'),{digest,json}=await import('../../sync/local-first-values.mjs');
 const r=await rescueFixture(),snapshot=await readRescueSnapshot(r.context),candidate=buildCodeCatalogs(),c=candidate.context.FC.globalDataContract,d=candidate.context.FC.globalDataDiagnostics;
 const native=new Map(snapshot.local.rows.map(row=>[row.key,row.raw])),code=codeGlobalRows(candidate.model,c);
 for(const keys of Object.values(c.sources))for(const key of keys)native.delete(key);for(const [key,raw]of Object.entries(code))native.set(key,raw);
 const materials=JSON.parse(code.fc_sheet_materials_v1);delete materials[0].priceUnit;native.set('fc_sheet_materials_v1',JSON.stringify(materials));native.set('fc_materials_v1',JSON.stringify(materials));
 const labor=JSON.parse(code.fc_quote_rates_v1);labor[0].price+=12.125;native.set('fc_services_v1',JSON.stringify(labor));
 for(const domain of ['stock','programDefaults','company','businessCosts'])native.delete(c.sources[domain][0]);
 async function rehash(){
  const tables=snapshot.databases.authority,source=tables.control.find(r=>r.key==='source'),image=tables.control.find(r=>r.key==='application');
  for(const key of Object.keys(source.rows))source.rows[key]=native.get(key)??null;
  image.rows=structuredClone(source.rows);source.hash=await digest(source.rows);image.hash=await digest(json(image.rows));
  snapshot.identity.receipt.sourceHash=source.hash;native.set('meble_application_authority_v1',JSON.stringify(snapshot.identity.receipt));snapshot.local.rows=[...native].sort(([a],[b])=>a.localeCompare(b)).map(([key,raw])=>({key,raw}));
 }
 await rehash();return {snapshot,candidate,c,d,native,rehash};
}
module.exports={codeRebuildFixture};
