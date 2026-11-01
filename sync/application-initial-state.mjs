// Missing keys use existing application factories; existing RAW is never repaired.
import {fail} from './local-first-values.mjs';
export function completeMissingApplicationGlobals(rows,fc,c){
 const factories={materials:()=>fc.catalogStore.getSheetMaterials(),hardware:()=>fc.catalogStore.getAccessories(),
  manufacturers:()=>fc.catalogStore.getHardwareManufacturers(),suppliers:()=>fc.catalogStore.getHardwareSuppliers(),
  categories:()=>fc.catalogStore.getHardwareCategories(),types:()=>fc.catalogStore.getHardwareTypes(),
  technicalParams:()=>fc.catalogStore.getHardwareTechnicalParams(),hardwareSettings:()=>fc.catalogStore.getHardwareSettings(),
  labor:()=>fc.catalogStore.getQuoteRates(),workshopServices:()=>fc.catalogStore.getWorkshopServices(),
  stock:()=>({sheets:[]}),programDefaults:()=>fc.programDefaults.read(),company:()=>fc.companyProfile.read(),businessCosts:()=>fc.businessCosts.read()};
 const next=structuredClone(rows);
 for(const [domain,keys]of Object.entries(c.sources))if(keys.every(k=>next[k]===null||next[k]===undefined)){
  const value=factories[domain]?.();if(value===undefined)fail('LF_FACTORY_SOURCE_REQUIRED');for(const k of keys)next[k]=JSON.stringify(value);
 }
 c.validateBundle(c.capture({getItem:k=>k==='fc_edit_session_v1'?null:next[k]??null},Object.keys(c.schemas)).model);return next;
}
export function emptyInstallationRows(rows){
 const next=structuredClone(rows);for(const k of ['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1'])next[k]='[]';
 for(const k of ['fc_project_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1'])next[k]=null;
 return next;
}
