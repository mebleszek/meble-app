import {copy,equal,fail} from './local-first-values.mjs';

// Owner23.11.2026: append missing approved pricing entries after updating.
// Existing rows (including zero/private prices and inactive rows) always win.
const labor=new Set(['labor_channel_install','labor_channel_workshop','labor_handle_layout','labor_handle_install','pdf_tipon_drill','pdf_tipon_insert','pdf_tipon_plate',
 'pdf_lift_other_prepare','pdf_lift_other_mount','pdf_lift_hki_prepare','pdf_lift_hki_mill_partial','pdf_lift_hki_mill_full','pdf_lift_arms',
 'pdf_lift_stabilizer_cut','pdf_lift_stabilizer_mount','pdf_lift_other_pack','pdf_lift_other_rehang','pdf_lift_other_gap_adjust',
 'pdf_cargo_auto_runner','pdf_cargo_auto_catch','pdf_cargo_auto_fit','pdf_cargo_auto_tall_prepare','pdf_cargo_auto_tall_mount']);
const hardware=id=>/^hw_(?:intago|gral)_runner_\d+$/.test(id)||/^hw_(?:intar|gral|wior)_drawer_\d+$/.test(id)||/^hw_gral_drawer_\d+_[nhkm]\d+$/.test(id)||/^hw_bivert_(?:drawer|runner)_\d+$/.test(id)||/^hw_bimeb_pb_3d0shx18_\d+_h$/.test(id)
 ||/^hw_rik_pb_axispro_(?:p2o_)?kpl\d+[abcd][12]?$/.test(id)
 ||/^hw_rik_pb_0fpo18_\d+$/.test(id)
 ||/^hw_(?:bimeb|mf)_rejs_th03_\d{4}_(?:01|05)_\d{3}$/.test(id)
 ||/^hw_(?:wip_drawer_320[mkhn]\d+(?:c15)?_(?:white|grey)|bimeb_pk_p_h45_\d+_gx)$/.test(id)
 ||['hw_seed_gtv_hexa_96_black','hw_seed_blum_tipon_long_956a1004','hw_belmeb_double_450_65_white','hw_belmeb_double_500_65_white','hw_belmeb_double_550_65_white'].includes(id);
const material=id=>/^m_drawer_bottom_(?:10|16)_(?:white|grey)$/.test(id);
const support=id=>/^hw_bivert_axilo_(?:60|80|100|125|150|180|200)$/.test(id)||/^hw_bivert_camar806_(?:left|right|cover_left|cover_right)$/.test(id)||/^hw_schach_camar816_(?:left|right|cover_white)$/.test(id)||['hw_bivert_cargo_51262','hw_bivert_cargo_51264'].includes(id);
const hinge=id=>/^hw_bivert_blum_(?:71t3550_173l6100|70t3550|71t3750|70t3750|71t7550|70t7550|173l6100)$/.test(id);
const lift=new Set(["hw_gral_lift_duo_37366612","hw_stolmet_lift_duo_37366632","hw_bivert_lift_12528","hw_bivert_lift_12637","hw_bivert_lift_12699","hw_bivert_lift_13076","hw_bivert_lift_13121","hw_bivert_lift_13123","hw_bivert_lift_13125","hw_bivert_lift_13127","hw_bivert_lift_13130","hw_bivert_lift_13132","hw_bivert_lift_121426","hw_bivert_lift_121427","hw_bivert_lift_121428","hw_bivert_lift_121430","hw_bivert_lift_121431","hw_bivert_lift_121432","hw_bivert_lift_121433","hw_bivert_lift_121861","hw_bivert_lift_121862","hw_bivert_lift_125548","hw_bivert_lift_131593","hw_bivert_lift_132821","hw_bivert_lift_140167","hw_bivert_lift_140170","hw_bivert_lift_140506","hw_bivert_lift_148022","hw_bivert_lift_148023","hw_bivert_lift_148024","hw_bivert_lift_148025","hw_bivert_lift_148026","hw_bivert_lift_148027","hw_bivert_lift_148028","hw_bivert_lift_148035","hw_bivert_lift_148036","hw_bivert_lift_148040","hw_bivert_lift_148041","hw_bivert_lift_148042","hw_bivert_lift_148043","hw_bivert_lift_148044","hw_bivert_lift_148045","hw_bivert_lift_148046","hw_bivert_lift_148047","hw_bivert_lift_148049","hw_bivert_lift_148136","hw_bivert_lift_156400","hw_bivert_lift_156401","hw_bivert_lift_156402","hw_bivert_lift_156403","hw_bivert_lift_156404","hw_bivert_lift_156405","hw_bivert_lift_156406","hw_bivert_lift_156407","hw_bivert_lift_156408","hw_bivert_lift_156410","hw_bivert_lift_156918","hw_bivert_lift_156935"]);
// Read-only proof for two installations starting across the same approved
// upgrade. The remote must equal the exact additive plan from this code;
// changed private prices, unrelated rows or an arbitrary remote seed refuse.
export function matchesApprovedPricingAdditions({current,remote,candidate,contract}){
 contract.validateBundle(remote);
 const plan=planPricingFactoryAdditions({current,candidate,contract});
 return !!plan&&equal(plan.model,remote);
}
export function planPricingFactoryAdditions({current,candidate,contract:c}){
 c.validateBundle(current);c.validateBundle(candidate);
 const model=copy(current),added={};
 function append(domain,rows,key=row=>row.id){
  const seen=new Set(model[domain].map(key));
  for(const row of rows){const id=key(row);if(seen.has(id))continue;seen.add(id);model[domain].push(copy(row));(added[domain]??=[]).push(id);}
 }
 const approvedHardware=candidate.hardware.filter(row=>hardware(row.id)||support(row.id)||hinge(row.id)||lift.has(row.id));
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
