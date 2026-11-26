// Detached technical definitions for one synchronous catalogue/comparison pass.
// No storage, prices, authorization, or state shared between calculations.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function create(api,definitions){
    const snapshot=api.clone(definitions),byCategory=new Map();
    const fields=category=>{
      const key=api.text(category);
      if(!byCategory.has(key))byCategory.set(key,api.fieldsForCategory(snapshot,key));
      return byCategory.get(key);
    };
    return {
      definitions:()=>api.clone(snapshot),
      fields:category=>api.clone(fields(category)),
      normalize:(values,category)=>api.normalizeValuesForFields(values,fields(category),category),
      describe:(src,category)=>api.describeLegacyFields(src,fields(category),api.text(category)),
      status:item=>{
        const row=item&&typeof item==='object'?item:{},category=api.text(row.hardwareCategory||row.category||row.kategoria||'');
        return api.statusWithFields(row,category,api.requiredFromFields(fields(category),category));
      }
    };
  }
  FC.hardwareTechnicalReadSnapshot={create};
})();
