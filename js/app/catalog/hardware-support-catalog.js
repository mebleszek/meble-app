// Verified support assemblies. Convert the shop pack to one complete foot;
// the foot price includes its mounting head and never represents a bare stem.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const legs=[
  {height:60,min:53,max:70,stem:'351',pack:477.24,url:'nozka-meblowa-pod-klucz-hafele-axilo-h-60-mm-100,3,2435,155877'},
  {height:80,min:70,max:100,stem:'352',pack:473.55,url:'nozka-regulowana-axilo-czarna-80mm-stopka-glowk,3,2435,155878'},
  {height:100,min:90,max:120,stem:'353',pack:450.18,url:'nozka-meblowa-pod-klucz-hafele-axilo-h-100-mm-100,3,2435,155876'},
  {height:125,min:115,max:145,stem:'354',pack:455.10,url:'nozka-regulowana-axilo-czarna-125mm-stopka-glow,3,2435,155880'},
  {height:150,min:140,max:170,stem:'355',pack:471.09,url:'nozka-regulowana-axilo-czarna-150mm-stopka-glow,3,2435,155879'},
  {height:180,min:170,max:200,stem:'356',pack:587.94,url:'nozka-regulowana-axilo-czarna-180mm-stopka-glow,3,2435,155881'},
  {height:200,min:190,max:220,stem:'357',pack:601.47,url:'nozka-regulowana-axilo-czarna-200mm-stopka-glow,3,2435,155882'}
 ].map(row=>({...row,id:'hw_bivert_axilo_'+row.height,symbol:'637.76.'+row.stem+' + 637.76.333'}));
 const footSeeds=legs.map(row=>({id:row.id,manufacturer:'Häfele',symbol:row.symbol,
  name:'Nóżka AXILO '+row.height+' mm czarna — stopka i główka',series:'AXILO 78',hardwareCategory:'Nóżki / cokoły',hardwareUnit:'szt.',
  catalogPriceGross:Number((row.pack/100).toFixed(2)),purchasePriceGross:Number((row.pack/100).toFixed(2)),priceSource:'Bivert',priceUpdatedAt:'2026-11-25',
  note:'Komplet jednej stopki z główką. Zakres '+row.min+'–'+row.max+' mm. Cena brutto opakowania100 szt.: '+row.pack.toFixed(2)+' PLN; cena jednostkowa = opakowanie/100, zaokrąglona do groszy jak w cenniku. Źródło: https://bivert.pl/'+row.url}));
 const hangers=[
  {key:'left',side:'lewa',symbol:'290.05.961',price:2.79,url:'zawieszka-do-szafek-lewa-biala-camar-806,3,2635,151127'},
  {key:'right',side:'prawa',symbol:'290.05.960',price:2.79,url:'zawieszka-do-szafek-prawa-biala-camar-806,3,2635,151126'},
  {key:'cover_left',side:'lewa',symbol:'290.05.683',price:0.66,cover:true,url:'zaslepka-do-zawieszki-camar-806-biala-lewa-hafel,3,2635,152047'},
  {key:'cover_right',side:'prawa',symbol:'290.05.682',price:0.66,cover:true,url:'zaslepka-do-zawieszki-camar-806-biala-prawa-hafe,3,2635,152046'}
 ].map(row=>({...row,id:'hw_bivert_camar806_'+row.key,name:(row.cover?'Zaślepka':'Zawieszka')+' CAMAR806 '+row.side+' biała'}));
 const concealed=[
  {key:'left',symbol:'103343188',name:'Zawieszka CAMAR816 prosta lewa',net:8.43,sideQty:0.5,url:'camar-zawieszka-meblowa-816-lewa-wewn-trzna-prosta-stal-ocynkowana/103343188'},
  {key:'right',symbol:'103343189',name:'Zawieszka CAMAR816 prosta prawa',net:8.43,sideQty:0.5,url:'camar-zawieszka-meblowa-816-prawa-wewn-trzna-prosta-stal-ocynkowana/103343189'},
  {key:'cover_white',symbol:'103343193',name:'Zaślepka CAMAR816 Ø35 mm biała',net:0.44,sideQty:1,cover:true,url:'camar-za-lepka-zawieszki-816-35-tworzywo-sztuczne-bia-e/103343193'}
 ].map(row=>({...row,id:'hw_schach_camar816_'+row.key,price:Number((row.net*1.23).toFixed(2))}));
 const seeds=footSeeds.concat(hangers.map(row=>({id:row.id,manufacturer:'Häfele',symbol:row.symbol,name:row.name,
  series:'CAMAR 806',hardwareCategory:'Inne',hardwareUnit:'szt.',catalogPriceGross:row.price,purchasePriceGross:row.price,
  priceSource:'Bivert',priceUpdatedAt:'2026-11-25',note:'CAMAR806 na wkręty. Domyślnie biały komplet; mechanizm i pasująca zaślepka liczone oddzielnie, po jednej na stronę. Źródło: https://bivert.pl/'+row.url})),
  concealed.map(row=>({id:row.id,manufacturer:'Camar',symbol:row.symbol,name:row.name+' — '+row.symbol,series:'CAMAR816',
   hardwareCategory:'Inne',hardwareUnit:'szt.',supplierId:'schachermayer',catalogPriceGross:row.price,purchasePriceGross:row.price,
   priceSource:'Schachermayer',priceUpdatedAt:'2026-11-25',
   note:'Ukryty montaż za plecami, min.15 mm wolnego miejsca; dostęp regulacji przez Ø35 mm. Szyna CAMAR875 wspólna z806. Mechanizm i zaślepka osobno. '+
    'Dokładny numer dystrybutora:'+row.symbol+'. Cena netto '+row.net.toFixed(2)+' PLN/szt. +23% VAT = '+row.price.toFixed(2)+' PLN brutto/szt. '+
    'Źródło: https://webshop.schachermayer.com/cat/pl-PL/product/'+row.url+'; dokumentacja: https://www.aetnabuild.com/wp-content/uploads/2024/09/PMI-Hanging-System-V1.4-HD.pdf, str.16/22 (806/816 i szyna875).'})));
 function forHki(cab){return cab?.subType==='uchylne'&&(cab.details?.flapVendor||'blum')==='blum'&&cab.details?.flapKind==='HKI';}
 function concealedFit(room,cab){
  const back=FC.cabinetCutlist?.backGeometry?.(cab,room);
  return !!(back?.ok&&back.kind==='hdf'&&back.position==='grooved'&&back.sideDepthMm-back.usableDepthMm-back.materialThicknessMm>=15);
 }
 function requirements({legs:count,hangers:hangerCount,heightCm,concealedHki=false,concealedFits=false}){
  const out=[];
  if(count>0){
   const mm=Number(heightCm)*10;
   const row=Number.isFinite(mm)&&mm>0 ? legs.filter(row=>mm>=row.min&&mm<=row.max).sort((a,b)=>Math.abs(a.height-mm)-Math.abs(b.height-mm)||a.height-b.height)[0] : null;
   // Geometry/PCV remain readable even when no priced foot fits. The exact
   // catalog-item guard refuses this unresolved ID when generating a quote.
   out.push({kind:'leg',hardwareGroup:'accessories',category:'Nóżki / cokoły',typeId:'cabinet_leg',
    catalogItemId:row?.id||'hw_axilo_unconfirmed',expectedManufacturer:'Häfele',expectedSymbol:row?.symbol||'UNCONFIRMED',expectedUnit:'szt.',
    label:row?'Nóżka AXILO '+row.height+' mm — stopka i główka':'Nóżka AXILO — niepotwierdzona wysokość',qty:count,...(row?{}:{sourceIssue:'CABINET_LEG_VARIANT_UNCONFIRMED'})});
  }
  if(hangerCount>0){
   if(!Number.isSafeInteger(hangerCount)||hangerCount%2||concealedHki&&!concealedFits)out.push({kind:'hanger',hardwareGroup:'accessories',category:'Inne',
    catalogItemId:'hw_camar806_unconfirmed',expectedManufacturer:'Häfele',expectedSymbol:'UNCONFIRMED',expectedUnit:'szt.',
    sourceIssue:concealedHki&&!concealedFits?'CABINET_CONCEALED_HANGER_CLEARANCE_UNCONFIRMED':'CABINET_HANGER_SIDES_UNCONFIRMED',label:'Zawieszki CAMAR — niepotwierdzony montaż lub strony',qty:hangerCount});
   else for(const row of concealedHki?concealed:hangers)out.push({kind:row.cover?'hanger-cover':'hanger',hardwareGroup:'accessories',category:'Inne',
    catalogItemId:row.id,expectedManufacturer:concealedHki?'Camar':'Häfele',expectedSymbol:row.symbol,expectedUnit:'szt.',label:row.name,qty:hangerCount*(concealedHki?row.sideQty:0.5)});
  }
  return out;
 }
 FC.hardwareSupportCatalog={seeds,requirements,forHki,concealedFit};
})();
