import {copy,equal,fail} from './local-first-values.mjs';

// Owner23.11.2026: append missing approved pricing entries after updating.
// Existing rows (including zero/private prices and inactive rows) always win.
const labor=new Set(['labor_channel_install','labor_channel_workshop','labor_handle_layout','labor_handle_install','pdf_tipon_drill','pdf_tipon_insert','pdf_tipon_plate']);
const hardware=id=>/^hw_(?:intago|gral)_runner_\d+$/.test(id)||/^hw_(?:intar|gral|wior)_drawer_\d+$/.test(id)||/^hw_gral_drawer_\d+_[nhkm]\d+$/.test(id)||/^hw_bivert_(?:drawer|runner)_\d+$/.test(id)||/^hw_bimeb_pb_3d0shx18_\d+_h$/.test(id)
 ||/^hw_rik_pb_axispro_(?:p2o_)?kpl\d+[abcd][12]?$/.test(id)
 ||/^hw_rik_pb_0fpo18_\d+$/.test(id)
 ||/^hw_(?:bimeb|mf)_rejs_th03_\d{4}_(?:01|05)_\d{3}$/.test(id)
 ||/^hw_(?:wip_drawer_320[mkhn]\d+(?:c15)?_(?:white|grey)|bimeb_pk_p_h45_\d+_gx)$/.test(id)
 ||['hw_seed_gtv_hexa_96_black','hw_seed_blum_tipon_long_956a1004','hw_belmeb_double_450_65_white','hw_belmeb_double_500_65_white','hw_belmeb_double_550_65_white'].includes(id);
const material=id=>/^m_drawer_bottom_(?:10|16)_(?:white|grey)$/.test(id);
export function planPricingFactoryAdditions({current,candidate,contract:c}){
 c.validateBundle(current);c.validateBundle(candidate);
 const model=copy(current),added={};
 function append(domain,rows,key=row=>row.id){
  const seen=new Set(model[domain].map(key));
  for(const row of rows){const id=key(row);if(seen.has(id))continue;seen.add(id);model[domain].push(copy(row));(added[domain]??=[]).push(id);}
 }
 const approvedHardware=candidate.hardware.filter(row=>hardware(row.id));
 append('materials',candidate.materials.filter(row=>material(row.id)));
 const approvedLabor=candidate.labor.filter(row=>labor.has(row.id));
 const hourly=row=>row.isHourlyRate||row.systemRate||row.category==='Stawki godzinowe';
 const rateCode=row=>row.rateKey||row.rateCode||row.rateType;
 const existingRates=new Set(model.labor.filter(hourly).map(rateCode));
 const requiredRates=new Set(approvedLabor.filter(row=>row.pricingMode!=='fixed'&&row.rateType).map(row=>row.rateType));
 // References use the rate code, not the factory row ID: a private rate with
 // that code (including an explicit zero) already satisfies the dependency.
 append('labor',candidate.labor.filter(row=>hourly(row)&&requiredRates.has(rateCode(row))&&!existingRates.has(rateCode(row))));
 append('labor',approvedLabor);
 append('hardware',approvedHardware);
 const suppliers=new Set(approvedHardware.map(row=>row.supplierId));
 append('suppliers',candidate.suppliers.filter(row=>suppliers.has(row.id)));
 const manufacturers=new Set(approvedHardware.map(row=>row.manufacturer));
 append('manufacturers',candidate.manufacturers.filter(name=>manufacturers.has(name)),name=>name);
 const categories=new Set(approvedHardware.map(row=>row.hardwareCategory));
 append('categories',candidate.categories.filter(name=>categories.has(name)),name=>name);
 const required=new Set(approvedHardware.flatMap(row=>Object.keys(row.technicalParams||{}).map(key=>row.hardwareCategory+'\0'+key)));
 append('technicalParams',candidate.technicalParams.filter(row=>required.has(row.category+'\0'+row.key)),row=>row.category+'\0'+row.key);
 // A pre-update enum may lack a new approved profile/colour. Append only the
 // values actually used by these hardware entries; never reset a private
 // definition, remove choices, or reinterpret its field type.
 const extended=new Set();
 for(const item of approvedHardware)for(const [key,value]of Object.entries(item.technicalParams||{})){
  const row=model.technicalParams.find(row=>row.category===item.hardwareCategory&&row.key===key);
  if(row?.fieldType!=='text'||!row.options?.length||!value.value||row.options.includes(value.value))continue;
  row.options.push(value.value);extended.add(row.id);
  const id=row.category+'\0'+row.key;
  if(!added.technicalParams?.includes(id))(added.technicalParams??=[]).push(id);
 }
 c.validateBundle(model);
 // Verify the additive promise independently of the ID matching above.
 for(const domain of Object.keys(current)){
  if(!Array.isArray(current[domain])){if(!equal(model[domain],current[domain]))fail('LF_FACTORY_EXISTING_CHANGED');continue;}
  const prefix=model[domain].slice(0,current[domain].length);
  if(domain==='technicalParams')for(const [index,row]of current[domain].entries()){
   if(!extended.has(row.id))continue;
   if(!equal(prefix[index].options.slice(0,row.options.length),row.options))fail('LF_FACTORY_EXISTING_CHANGED');
   prefix[index]={...prefix[index],options:row.options};
  }
  if(!equal(prefix,current[domain]))fail('LF_FACTORY_EXISTING_CHANGED');
 }
 return Object.keys(added).length?{model,added}:null;
}
