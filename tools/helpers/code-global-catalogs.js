'use strict';
// Build-time, code-only generator. Never evaluates catalog-store's migration,
// reads owner storage or accepts a historical catalog as an input.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),clone=value=>JSON.parse(JSON.stringify(value));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const files=[
 'js/app/project/project-export-contract.js','js/app/cloud/global-data-contract.js','js/app/cloud/global-data-diagnostics.js',
 'js/app/catalog/hardware-technical-params.js','js/app/catalog/hardware-catalog.js','js/app/catalog/hardware-catalog-seed-data.js',
 'js/app/pricing/labor-catalog-definitions.js','js/app/pricing/labor-catalog.js','js/app/pricing/work-quantity-sources.js',
 'js/app/settings/program-defaults-store.js','js/app/settings/company-profile-store.js','js/app/settings/business-costs-store.js',
 'js/app/catalog/hardware-replacement-engine.js'
];
function buildCodeCatalogs(){
 const sources=[],attempts=[];const deny=kind=>{attempts.push(kind);throw Error('CODE_FACTORY_IO_FORBIDDEN');};
 const s={TextEncoder,crypto:{subtle:crypto.webcrypto.subtle}};s.window=s;s.FC={};
 for(const key of ['localStorage','sessionStorage','indexedDB','fetch','XMLHttpRequest','WebSocket'])Object.defineProperty(s,key,{get:()=>deny(key)});
 for(const key of ['storage','catalogStore','catalogMigration','catalogStoragePolicy'])Object.defineProperty(s.FC,key,{get:()=>deny(key)});
 vm.createContext(s);
 vm.runInContext(`Date=class extends Date{constructor(...args){if(!args.length)throw Error('CODE_FACTORY_CLOCK_FORBIDDEN');super(...args);}static now(){throw Error('CODE_FACTORY_CLOCK_FORBIDDEN');}};Math.random=()=>{throw Error('CODE_FACTORY_RANDOM_FORBIDDEN');};`,s);
 const read=file=>{const source=fs.readFileSync(path.join(root,file),'utf8');sources.push({path:file,sha256:sha(source)});return source;};
 for(const file of files)vm.runInContext(read(file),s,{filename:file,timeout:1000});
 // Only these two closed literal declarations reside in a module with an
 // unconditional migrateLegacy(). A changed declaration layout fails closed.
 const store=read('js/app/catalog/catalog-store.js');
 for(const name of ['DEFAULT_SHEET_MATERIALS','DEFAULT_WORKSHOP_SERVICES']){
  const pattern=new RegExp('^  const '+name+' = (\\[[\\s\\S]*?^  \\]);$','gm'),matches=[...store.matchAll(pattern)];
  if(matches.length!==1)throw Error('CODE_FACTORY_DECLARATION_CHANGED');
  vm.runInContext('window.'+name+'='+matches[0][1]+';',s,{timeout:1000});
 }
 vm.runInContext(`(()=>{
  const f=FC,h=f.hardwareCatalog,t=f.hardwareTechnicalParams,l=f.laborCatalog;
  const categories=h.normalizeCategoryList(h.DEFAULT_CATEGORIES.concat(t.DEFAULT_DEFINITIONS.map(row=>row.category))),technicalParams=t.normalizeDefinitions(t.DEFAULT_DEFINITIONS,categories),suppliers=h.normalizeSupplierList(h.DEFAULT_SUPPLIERS);
  const settings=h.normalizeSettings(h.DEFAULT_SETTINGS),context={...settings,hardwareSuppliers:suppliers,hardwareCategories:categories,hardwareTechnicalParams:technicalParams};
  const seeds=f.hardwareCatalogSeedData.ACCESSORY_SEEDS;
  const hardware=seeds.map(row=>h.normalizeAccessory(row,()=>{throw Error('CODE_FACTORY_ID_REQUIRED');},context));
  const transport=JSON.parse(JSON.stringify(f.companyProfile.DEFAULT_COMPANY_PROFILE.transport));delete transport.apiKey;
  const company={company:Object.fromEntries(Object.keys(f.companyProfile.DEFAULT_COMPANY_PROFILE.company).map(k=>[k,''])),transport,meta:{updatedAt:''}};
  const labor=f.laborCatalogDefinitions.DEFAULT_HOURLY_RATES.concat(f.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS).map(row=>l.normalizeDefinition(row));
  window.codeModel={materials:DEFAULT_SHEET_MATERIALS,hardware,manufacturers:h.normalizeManufacturerList(h.DEFAULT_MANUFACTURERS.concat(hardware.map(r=>r.manufacturer))),
   suppliers,categories,types:h.normalizeTypeList(h.DEFAULT_TYPES),technicalParams,hardwareSettings:settings,labor,
   workshopServices:DEFAULT_WORKSHOP_SERVICES.map(row=>l.normalizeDefinition(row)),stock:[],programDefaults:f.programDefaults.normalizeProgramDefaults(f.programDefaults.DEFAULT_PROGRAM_DEFAULTS),
   company,businessCosts:f.businessCosts.normalizeCosts(f.businessCosts.DEFAULT_BUSINESS_COSTS)};
  window.codeRawDefinitions={materials:DEFAULT_SHEET_MATERIALS,hardware:seeds,labor:f.laborCatalogDefinitions.DEFAULT_HOURLY_RATES.concat(f.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS),
   workshopServices:DEFAULT_WORKSHOP_SERVICES,technicalParams:t.DEFAULT_DEFINITIONS};
  window.codeRules={laborReplacements:f.laborCatalogDefinitions.LABOR_REPLACEMENTS,technicalParams};
 })()`,s,{timeout:2000});
 if(attempts.length)throw Error('CODE_FACTORY_IO_FORBIDDEN');
 const c=s.FC.globalDataContract,model=clone(s.codeModel);
 // Validation uses the same realm as the program's contracts.
 const validation=c.validateBundle(s.codeModel);
 const runtime=validateCodeRuntime(s,s.codeModel);
 if(attempts.length)throw Error('CODE_FACTORY_IO_FORBIDDEN');
 sources.push({path:'tools/helpers/code-global-catalogs.js',sha256:sha(fs.readFileSync(__filename))});
 sources.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const provenance={version:1,sources,sourceHash:sha(JSON.stringify(sources)),modelHash:sha(c.canonical(s.codeModel)),rulesHash:sha(c.canonical(s.codeRules)),
  runtime:{node:process.version,icu:process.versions.icu},noStorage:true,noMigration:true,noCache:true,randomIds:false,technicalIds:'EXISTING_NORMALIZER',writeApproved:false};
 return {model,rules:clone(s.codeRules),rawDefinitions:clone(s.codeRawDefinitions),provenance,validation:clone(validation),runtime,context:s};
}
function validateCodeRuntime(s,model){
 const f=s.FC,l=f.laborCatalog,c=f.globalDataContract,equal=(a,b)=>c.canonical(a)===c.canonical(b);
 if(!equal(f.programDefaults.normalizeProgramDefaults(model.programDefaults),model.programDefaults))throw Error('CODE_FACTORY_DEFAULTS_UNSTABLE');
 const profile=f.companyProfile.normalizeProfile(model.company);delete profile.transport.apiKey;
 if(!equal(profile,model.company)||Object.values(profile.company).some(Boolean))throw Error('CODE_FACTORY_COMPANY_NOT_NEUTRAL');
 if(!equal(f.businessCosts.normalizeCosts(model.businessCosts),model.businessCosts)||f.businessCosts.monthlyTotals(model.businessCosts).filled!==0)throw Error('CODE_FACTORY_COSTS_NOT_NEUTRAL');
 const hourly=model.labor.filter(row=>l.isHourlyRateDefinition(row));
 for(const row of hourly)if(!l.validateRateProfile(row,hourly,{oldCode:row.rateCode}).ok)throw Error('CODE_FACTORY_RATE_INVALID');
 for(const row of [...model.labor,...model.workshopServices])if(!equal(l.normalizeDefinition(row),row))throw Error('CODE_FACTORY_LABOR_UNSTABLE');
 const ids=new Set(model.labor.map(r=>r.id));for(const [old,replacements]of Object.entries(f.laborCatalogDefinitions.LABOR_REPLACEMENTS))if(!ids.has(old)||replacements.some(id=>!ids.has(id)))throw Error('CODE_FACTORY_REPLACEMENT_MISSING');
 const quantity=f.workQuantitySources;
 for(const row of model.labor){
  if(row.quantitySource&&!quantity.find(row.quantitySource))throw Error('CODE_FACTORY_QUANTITY_SOURCE_MISSING');
  for(const condition of row.conditions||[])if(!quantity.find(condition.source))throw Error('CODE_FACTORY_CONDITION_SOURCE_MISSING');
 }
 if(c.validateBundle(model).dependencies.some(d=>d.kind==='unusedParameterCategory'))throw Error('CODE_FACTORY_CATEGORY_MISSING');
 for(const item of model.hardware)if(!Number.isFinite(f.hardwareCatalog.resolveQuotePrice(item)))throw Error('CODE_FACTORY_HARDWARE_PRICE_INVALID');
 return {status:'VALIDATED',domains:14,hourlyRates:hourly.length,ownerDataPresent:false,stockReferences:0,defaultMaterialReferences:0,
  quoteScope:'CODE_DEFINITIONS_ONLY',existingProjectsChecked:false};
}
module.exports={buildCodeCatalogs,validateCodeRuntime};
