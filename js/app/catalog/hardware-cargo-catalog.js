// Complete Cargo sets: verified manufacturer installation dimensions, not
// basket dimensions. Existing catalog IDs/prices remain the commercial source.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const models=[
  {id:'peka_snello_white',name:'Peka SNELLO Libell — biały',manufacturer:'Peka'},
  {id:'peka_snello_fioro',name:'Peka SNELLO Fioro — antracyt',manufacturer:'Peka'},
  {id:'nomet_standard_pro_left',name:'Nomet STANDARD PRO —3 poziomy, lewy, srebrny',manufacturer:'Nomet'},
  {id:'nomet_prestige_maxi',name:'Nomet PRESTIGE MAXI —6 półek, chrom',manufacturer:'Nomet'}
 ];
 const specs=[
  {id:'hw_seed_peka_snello_150_white',model:'peka_snello_white',symbol:'04.801.B',width:150,minWidth:112,maxWidth:118,minHeight:521,depth:475,load:15},
  {id:'hw_bivert_cargo_51262',model:'peka_snello_white',symbol:'04.802.B',width:200,minWidth:162,maxWidth:168,minHeight:521,depth:475,load:15,price:449,url:'https://bivert.pl/snello-200-bialy,3,1672,51262'},
  {id:'hw_bivert_cargo_51264',model:'peka_snello_white',symbol:'04.803.B',width:300,minWidth:262,maxWidth:268,minHeight:521,depth:475,load:20,price:717.66,url:'https://bivert.pl/cargo-snello-300-bialy-04-803-b,3,1672,51264'},
  {id:'hw_seed_peka_snello_fioro_200_anthracite',model:'peka_snello_fioro',symbol:'04.2802.KPL',width:200,minWidth:162,maxWidth:168,minHeight:521,depth:475,load:15},
  // Nomet's June2025 instructions require115mm inside, even though a150mm
  // cabinet with18mm sides only has114mm. Never round up or change its sides.
  {id:'hw_seed_nomet_w2334m_150l_p22',model:'nomet_standard_pro_left',symbol:'W-2334M-150L.P22',width:150,minWidth:115,maxWidth:null,minHeight:540,depth:485,load:20},
  {id:'hw_seed_nomet_w5600_500_g2',model:'nomet_prestige_maxi',symbol:'W-5600-500.G2',width:500,minWidth:464,maxWidth:null,minHeight:1910,maxHeight:2110,depth:510,load:120,tall:true}
 ];
 const seeds=specs.filter(s=>s.price!=null).map(s=>({id:s.id,manufacturer:'Peka',symbol:s.symbol,
  name:'Peka SNELLO Libell '+s.width+' biały — kompletny zestaw z prowadnicami i mocowaniami',series:'SNELLO',supplierId:'bivert',
  hardwareCategory:'Cargo / organizery',hardwareUnit:'kpl.',catalogPriceGross:s.price,purchasePriceGross:s.price,
  priceSource:'Bivert',priceUpdatedAt:'2026-11-25',technicalParams:{szerokosc_modulu_mm:{from:s.width,to:s.width},
   wysokosc_min_mm:{from:s.minHeight,to:''},glebokosc_min_mm:{from:s.depth,to:''},strona:{value:'prawa'},nosnosc_kg:{from:s.load,to:''}},
  note:'Cena całego zestawu brutto;1 dolna prowadnica +1 górne prowadzenie, rama i2 kosze. Nie doliczać drugi raz prowadnic jako materiału. Źródło: '+s.url}));
 const isCargo=cab=>cab?.subType==='cargo';
 const requiresFullTop=cab=>isCargo(cab)&&cab.type==='stojąca'&&specs.some(s=>s.tall&&s.model===cab.details?.cargoModel);
 function select(room,cab){
  let spec,inside;const fail=code=>({ok:false,code,spec,inside,model:models.find(m=>m.id===spec?.model)});
  if(!isCargo(cab)||!['stojąca','moduł'].includes(cab.type))return fail('CARGO_TYPE_UNCONFIRMED');
  spec=specs.find(s=>s.model===cab.details?.cargoModel&&Math.abs(s.width-Number(cab.width)*10)<0.01);
  if(!spec)return fail('CARGO_MODEL_WIDTH_UNCONFIRMED');
  inside=FC.cabinetCutlist?.interiorDimensions?.(cab,room);
  if(!inside?.ok)return fail(inside?.code||'CARGO_INTERIOR_UNCONFIRMED');
  if(inside.widthMm<spec.minWidth||spec.maxWidth!=null&&inside.widthMm>spec.maxWidth)return fail('CARGO_INTERIOR_WIDTH_UNCONFIRMED');
  if(inside.heightMm<spec.minHeight||spec.maxHeight!=null&&inside.heightMm>spec.maxHeight)return fail('CARGO_HEIGHT_UNCONFIRMED');
  if(inside.depthMm<spec.depth)return fail('CARGO_DEPTH_UNCONFIRMED');
  if(cab.setId)return fail('CARGO_SET_FRONT_UNCONFIRMED');
  if(Number(cab.details?.shelves)>0||Number(cab.details?.innerDrawerCount)>0)return fail('CARGO_INTERIOR_OCCUPIED');
  if(String(cab.openingSystem||'').toLowerCase()==='tip-on')return fail('CARGO_PUSH_SYSTEM_UNCONFIRMED');
  return {ok:true,spec,inside,model:models.find(m=>m.id===spec.model)};
 }
 function requirements(room,cab){
  if(!isCargo(cab))return [];
  const result=select(room,cab),s=result.spec;
  return [{kind:'cargo',hardwareGroup:'cargo',category:'Cargo / organizery',catalogItemId:s?.id||'hw_cargo_unconfirmed',
   expectedManufacturer:result.model?.manufacturer||'UNCONFIRMED',expectedSymbol:s?.symbol||'UNCONFIRMED',expectedUnit:'kpl.',
   label:s?result.model.name+' '+s.width+' mm · '+s.symbol:'Niepotwierdzony komplet Cargo',qty:1,...(!result.ok?{sourceIssue:result.code}:{})}];
 }
 function parts(room,cab){return requirements(room,cab).map(req=>({name:req.label,qty:req.qty,a:0,b:0,dims:'Kompletny zestaw',material:'Okucia: '+req.label,hardwareRequirement:req}));}
 function laborFacts(room,cab){
  const values=value=>Object.fromEntries(['mini_runners','mini_catches','mini_set','tall_set'].map(key=>[key,value]));
  if(!isCargo(cab))return values(0);const selected=select(room,cab);if(!selected.ok)return values(null);
  const out=values(0);if(selected.spec.tall)out.tall_set=1;else{out.mini_runners=out.mini_catches=2;out.mini_set=1;}return out;
 }
 function validate(room,cab){
  const r=select(room,cab);if(r.ok)return {ok:true};
  const spec=r.spec,inside=r.inside;
  const messages={CARGO_MODEL_WIDTH_UNCONFIRMED:'Wybierz system Cargo pasujący do szerokości szafki.',
   CARGO_INTERIOR_WIDTH_UNCONFIRMED:spec&&inside?'Cargo wymaga szerokości wnętrza od '+spec.minWidth+(spec.maxWidth!=null?' do '+spec.maxWidth:'')+' mm. Dostępne: '+inside.widthMm+' mm.':null,
   CARGO_HEIGHT_UNCONFIRMED:spec&&inside?'Cargo wymaga wysokości wnętrza od '+spec.minHeight+(spec.maxHeight?' do '+spec.maxHeight:'')+' mm. Dostępne: '+inside.heightMm+' mm.':null,
   CARGO_DEPTH_UNCONFIRMED:spec&&inside?'Cargo wymaga głębokości wnętrza co najmniej '+spec.depth+' mm. Dostępne: '+inside.depthMm+' mm.':null,
   CARGO_PUSH_SYSTEM_UNCONFIRMED:'Wybrane Cargo nie ma potwierdzonego zestawu do otwierania TIP-ON.',CARGO_SET_FRONT_UNCONFIRMED:'Cargo wymaga własnego frontu, poza zestawem szafek.'};
  return {ok:false,msg:messages[r.code]||'Nie potwierdzono doboru Cargo: '+r.code+'.',code:r.code};
 }
 FC.hardwareCargoCatalog={models,specs,seeds,isCargo,requiresFullTop,select,requirements,parts,laborFacts,validate};
})();
