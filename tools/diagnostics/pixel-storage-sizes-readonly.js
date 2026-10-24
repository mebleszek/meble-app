// Run this complete expression only in the existing, authorized Meble-App
// document via a reviewed Chrome DevTools Snippet. The result is a safe JSON
// string. No globals, UI, clipboard, network, timers or application methods.
(function pixelStorageSizesReadonly(w){
  'use strict';
  const kind='meble-app-storage-sizes';
  const refuse=status=>({v:1,kind,status,complete:false});
  const failures={auth:{},limit:{},changed:{}};
  let gate;
  const authorized=()=>{try{return gate?.isValid()===true;}catch(_){return false;}};
  const run=()=>{
    try{
      if(w.location.origin!=='https://mebleszek.github.io'||!['/meble-app/','/meble-app/index.html'].includes(w.location.pathname))return refuse('WRONG_PAGE');
      const descriptor=Object.getOwnPropertyDescriptor(w,'__FC_MAIN_ACCESS__');
      gate=descriptor?.value;
      if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||typeof gate?.isValid!=='function'||!authorized())return refuse('AUTH_DENIED');

      // Static names only, derived from CLOUD_DATA_REGISTER/data-storage-keys.
      // Never infer that an arbitrary fc_* name is safe to disclose.
      const groups={
        projects:['fc_projects_v1','fc_project_v1'],
        investors:['fc_investors_v1','fc_investor_removed_ids_v1'],
        catalogs:['fc_accessories_v1','fc_sheet_materials_v1','fc_materials_v1','fc_hardware_manufacturers_v1','fc_hardware_suppliers_v1','fc_hardware_settings_v1','fc_hardware_categories_v1','fc_hardware_types_v1','fc_hardware_technical_params_v1','hardwareSuppliers','hardwareSettings','hardwareCategories','hardwareTypes','hardwareTechnicalParams','fc_quote_rates_v1','fc_services_v1','fc_workshop_services_v1'],
        stock:['fc_sheets_v1'],
        settings:['fc_program_defaults_v1','fc_company_profile_v1','fc_business_costs_v1'],
        quote_history:['fc_quote_snapshots_v1'],
        quote_drafts:['fc_quote_offer_drafts_v1'],
        service_orders:['fc_service_orders_v1'],
        backups:['fc_data_backups_v1','fc_project_backup_v1','fc_project_backup_meta_v1','fc_investors_backup_v1','fc_investors_backup_meta_v1'],
        cutting_cache:['fc_rozrys_plan_cache_v1','fc_rozrys_plan_cache_v2'],
        production_decisions:['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_rozrys_overrides_v1'],
        preferences:['fc_rozrys_panel_prefs_v1','fc_rozrys_material_accordion_v1'],
        context:['fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_reload_restore_v1'],
        edit_session:['fc_edit_session_v1'],
      };
      const known=new Map(Object.entries(groups).flatMap(([category,keys])=>keys.map(key=>[key,category])));
      const category=key=>known.get(key)||(/^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(key)?'legacy_project_backup':/^fc_project_inv_.+_v1$/.test(key)?'legacy_project_slot':'unknown');
      const storage=w.localStorage;
      // Same text-footprint limits and exact second-read comparison as the
      // existing session collector; no quota probe and no JSON parsing of RAW.
      const maxKeys=2000,maxUnits=8*1024*1024;
      const names=()=>{
        if(!authorized())throw failures.auth;
        const count=storage.length;
        if(!Number.isInteger(count)||count<0||count>maxKeys)throw failures.limit;
        const list=[];
        let units=0;
        for(let i=0;i<count;i++){
          if(!authorized())throw failures.auth;
          const key=storage.key(i);
          if(typeof key!=='string')throw failures.changed;
          units+=key.length;
          if(units>maxUnits)throw failures.limit;
          list.push(key);
        }
        if(new Set(list).size!==count)throw failures.changed;
        return list.sort();
      };
      const initial=names(),observed=[];
      let totalKeyUnits=0,totalValueUnits=0;
      for(const key of initial){
        if(!authorized())return refuse('AUTH_DENIED');
        const value=storage.getItem(key);
        if(typeof value!=='string')return refuse('DIAGNOSTIC_STATE_CHANGED');
        totalKeyUnits+=key.length;totalValueUnits+=value.length;
        if(totalKeyUnits+totalValueUnits>maxUnits)return refuse('DIAGNOSTIC_LIMIT_EXCEEDED');
        observed.push([key,value]);
      }
      const unchangedNames=()=>JSON.stringify(names())===JSON.stringify(initial);
      if(!unchangedNames())return refuse('DIAGNOSTIC_STATE_CHANGED');
      for(const [key,value]of observed){
        if(!authorized())return refuse('AUTH_DENIED');
        if(storage.getItem(key)!==value)return refuse('DIAGNOSTIC_STATE_CHANGED');
      }
      if(!unchangedNames())return refuse('DIAGNOSTIC_STATE_CHANGED');
      if(!authorized())return refuse('AUTH_DENIED');
      const top=observed.map(([key,value])=>({key,category:category(key),recognized:known.has(key),valueUnits:value.length})).sort((a,b)=>b.valueUnits-a.valueUnits).slice(0,10).map((row,index)=>({
        rank:index+1,
        key:row.recognized?row.key:'ANON_'+String(index+1).padStart(2,'0'),
        category:row.category,
        recognized:row.recognized,
        valueUnits:row.valueUnits,
      }));
      if(!authorized())return refuse('AUTH_DENIED');
      return {v:1,kind,status:'READ_ONLY',complete:true,consistency:'TWO_PASS_MATCH',unit:'UTF16_CODE_UNITS',keyCount:initial.length,totalKeyUnits,totalValueUnits,totalUnits:totalKeyUnits+totalValueUnits,largest:top[0]||null,top,quotaLimitKnown:false,transientWriteCostKnown:false};
    }catch(error){return refuse(!authorized()||error===failures.auth?'AUTH_DENIED':error===failures.limit?'DIAGNOSTIC_LIMIT_EXCEEDED':error===failures.changed?'DIAGNOSTIC_STATE_CHANGED':'STORAGE_READ_FAILED');}
  };
  // Fixed refusal codes only; no exception text, values or dynamic key names.
  // Expected limit/enumeration failures are handled without exporting errors.
  return JSON.stringify(run());
})(window);
