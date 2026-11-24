(function(){
  'use strict';
  const FC=(window.FC=window.FC||{});
  const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
  // Owner's construction rule, 23.11.2026. Manufacturer installation space
  // remains distinct from the front height and nominal side height.
  const FRONT_ALLOWANCE_MM=40;
  function select({family,usage='frontowa',availableDepthMm,heightLimitMm,minLoadKg=0,candidates=[]}={}){
    if(!family||!positive(availableDepthMm)||!positive(heightLimitMm)||typeof minLoadKg!=='number'||!Number.isFinite(minLoadKg)||minLoadKg<0)return {ok:false,code:'DRAWER_SPACE_UNCONFIRMED'};
    const eligible=candidates.filter(row=>row&&row.family===family&&row.usage===usage&&row.complete===true
      &&positive(row.lengthMm)&&positive(row.installDepthMm)&&row.installDepthMm>=row.lengthMm
      &&positive(row.installHeightMm)&&positive(row.loadKg)&&row.loadKg>=minLoadKg
      &&row.installDepthMm<=availableDepthMm&&row.installHeightMm<=heightLimitMm);
    if(!eligible.length)return {ok:false,code:'DRAWER_VARIANT_NOT_CONFIRMED'};
    const colorRank=row=>row.color==='white'?0:row.color==='grey'?1:2;
    const vendorRank=row=>row.supplierId==='bivert'?0:1;
    const sorted=eligible.slice().sort((a,b)=>b.lengthMm-a.lengthMm||b.installHeightMm-a.installHeightMm
      ||a.loadKg-b.loadKg||vendorRank(a)-vendorRank(b)||colorRank(a)-colorRank(b)
      ||Number(a.standard!==true)-Number(b.standard!==true)||String(a.id).localeCompare(String(b.id)));
    const selected=sorted[0];
    if(!selected.id||!selected.sku||!selected.sourceUrl||!selected.technicalSourceUrl)return {ok:false,code:'DRAWER_SOURCE_UNCONFIRMED'};
    return {ok:true,selected:{...selected},availableDepthMm,heightLimitMm};
  }
  function forFront(options){
    if(!positive(options?.frontHeightMm))return {ok:false,code:'DRAWER_FRONT_HEIGHT_UNCONFIRMED'};
    return select({...options,heightLimitMm:options.frontHeightMm-FRONT_ALLOWANCE_MM});
  }
  // Owner-approved workshop section, 23.11.2026. This is deliberately NOT
  // certified as Blum560F conformity (its specified recess is12–15 mm).
  // The owner retained20 mm shorter crosspieces with a10 mm screwed bottom.
  function woodenSection({insideHeightMm,frontHeightMm,inner=true}={}){
    const extension=inner?30:FRONT_ALLOWANCE_MM;
    let clear=insideHeightMm,runnerType;
    if(positive(clear))runnerType=clear<80?'ball':'undermount';
    else if(positive(frontHeightMm)){
      // A ball section is allowed only if its actual clear height is <80.
      // At the transition, retain undermount rather than invent a taller ball drawer.
      runnerType=frontHeightMm-extension<80?'ball':'undermount';
      clear=frontHeightMm-extension-(runnerType==='undermount'?20:0);
    }
    if(!positive(clear))return {ok:false,code:'DRAWER_HEIGHT_UNCONFIRMED'};
    const under=runnerType==='undermount',sideHeightMm=clear+(under?20:0),bottomThicknessMm=under?10:3;
    return {ok:true,runnerType,insideHeightMm:clear,sideHeightMm,crosspieceHeightMm:clear,
      bottomThicknessMm,bottomRecessMm:under?10:0,frontHeightMm:sideHeightMm+extension,
      boxOverallHeightMm:sideHeightMm+(under?0:bottomThicknessMm)};
  }
  function frontsForRequirement(room,cab,req,offset=0){
    if(req.technical?.usage==='wewnętrzna'){
      const layout=FC.cabinetInnerDrawers.layout(room,cab);
      return layout.ok?{ok:true,fronts:layout.fronts.slice(offset,offset+req.qty)}:layout;
    }
    if(req.source==='front_drawers'){
      const result=FC.cabinetCutlist.resolveDrawerFrontGeometry(cab,room);
      return result.ok?{ok:true,fronts:result.panels}:result;
    }
    const data=typeof room==='object'?room:(window.projectData||FC.projectData||{})[room];
    const fronts=FC.cabinetFronts?.previewFrontsForCabinet(data||{settings:{}},cab)||[];
    if(fronts.length!==req.qty)return {ok:false,code:'DRAWER_FRONT_HEIGHT_UNCONFIRMED'};
    return {ok:true,fronts:fronts.map(f=>({heightMm:Math.round(Number(f.height)*10),frontWidthMm:Math.round(Number(f.width)*10)}))};
  }
  // Shared manufacturer dimensions, not prices. Never use exterior cabinet depth.
  // The inner front consumes its actual18 mm thickness in the cabinet opening.
  function woodenGeometry({section,insideWidthMm,availableDepthMm,inner=false,manufacturer='Blum',series='TANDEM BLUMOTION',motion='soft',minLoadKg=0}={}){
    const fail=code=>({ok:false,code});
    if(!section?.ok||!positive(insideWidthMm)||!positive(availableDepthMm))return fail('DRAWER_SPACE_UNCONFIRMED');
    const ball=section.runnerType==='ball',gtv=!ball&&String(manufacturer).toLowerCase()==='gtv';
    if(!ball&&!gtv&&(String(manufacturer).toLowerCase()!=='blum'||!/^tandem(?:\s|$)/i.test(series)))return fail('DRAWER_RUNNER_UNCONFIRMED');
    if(gtv&&!/^modern\s*slide(?:\s*(?:3d|p2o))?$/i.test(series))return fail('DRAWER_RUNNER_UNCONFIRMED');
    if(/tip.on|p2o|\bpush\b/i.test(series))motion='push';
    const family=ball?(motion==='push'?'gtv_gx_h45':'gtv_prestige_h45'):gtv?(motion==='push'?'gtv_modern_slide_p2o':'gtv_modern_slide_3d'):'blum_tandem';
    const deduction=ball?25.4:13,outerWidthMm=insideWidthMm-deduction,innerWidthMm=outerWidthMm-36;
    const allowance=(gtv&&motion!=='push'?5:3)+(inner?18:0);
    const book=FC.hardwareDrawerCatalog,lengths=book?.nominalLengths(family)||[];
    const lengthMm=lengths.filter(n=>n+allowance<=availableDepthMm).at(-1);
    if(!lengthMm||innerWidthMm<=0)return fail('DRAWER_VARIANT_NOT_CONFIRMED');
    const loadKg=book.physicalLoads({family,lengthMm,motion}).find(n=>n>=minLoadKg);
    if(!Number.isFinite(minLoadKg)||minLoadKg<0||!loadKg)return fail('DRAWER_LOAD_UNAVAILABLE');
    if(!book.allSpecs().some(row=>row.productKind==='runner'&&row.family===family&&row.motion===motion&&row.complete&&row.lengthMm===lengthMm&&row.loadKg===loadKg))return fail('DRAWER_VARIANT_NOT_CONFIRMED');
    if((gtv&&motion!=='push'||ball)&&outerWidthMm>lengthMm)return fail('DRAWER_WIDTH_EXCEEDS_RUNNER_LIMIT');
    if(ball&&section.insideHeightMm>=80)return fail('BALL_RUNNER_HEIGHT_NOT_ALLOWED');
    if(ball&&section.sideHeightMm<45)return fail('DRAWER_RUNNER_TOO_HIGH');
    const sideLengthMm=lengthMm-(ball?0:10);
    return {ok:true,...section,lengthMm,installDepthMm:lengthMm+allowance,sideLengthMm,outerWidthMm,innerWidthMm,
      bottomWidthMm:ball?outerWidthMm:innerWidthMm,bottomLengthMm:sideLengthMm,
      manufacturer:ball?'GTV':gtv?'GTV':'Blum',series:ball?(motion==='push'?'GX H45 PUSH':'PRESTIGE H45'):gtv?(motion==='push'?'MODERN SLIDE P2O':'MODERN SLIDE 3D'):(motion==='push'?'TANDEM TIP-ON':'TANDEM BLUMOTION'),
      family,motion,loadKg,
      technicalSourceUrl:ball?'https://assets.gtv.com.pl/assets/attachments/karta_techniczna/Karta_techniczna_2020_144-145.pdf':gtv?(motion==='push'?'https://assets.gtv.com.pl/assets/attachments/instrukcja/PB-0FPO_18_prowadnica_instrukcja_1.pdf':'https://assets.gtv.com.pl/assets/attachments/karta_techniczna/PB-3D0SHX18-...-H_karta_techniczna.pdf'):'https://d2.blum.com/services/BEC003/me17513937_ep_dok_bau_%24sen-gb_%24aof_%24v4.pdf',
      ownerConstructionException:!ball&&!gtv?'BLUM_560F_RECESS_10_MM_OWNER_APPROVED':null};
  }
  function systemForFront({family,usage,availableDepthMm,frontHeightMm,insideWidthMm,motion='soft',minLoadKg=0,forceMaxLoad=false}={}){
    const book=FC.hardwareDrawerCatalog;
    if(!book)return {ok:false,code:'DRAWER_SOURCE_UNCONFIRMED'};
    const target=book.physicalTarget({family,usage,availableDepthMm,heightLimitMm:frontHeightMm-FRONT_ALLOWANCE_MM});
    if(!target)return {ok:false,code:'DRAWER_VARIANT_NOT_CONFIRMED'};
    const loads=book.physicalLoads({family,lengthMm:target.lengthMm,motion});
    const loadKg=forceMaxLoad?loads.at(-1):loads.find(n=>n>=minLoadKg);
    if(!Number.isFinite(minLoadKg)||minLoadKg<0||!loadKg||loadKg<minLoadKg)return {ok:false,code:'DRAWER_LOAD_UNAVAILABLE'};
    const addOn=motion==='push'&&(family==='blum_merivobox'||family==='blum_legrabox'||forceMaxLoad&&family==='blum_tandembox_antaro');
    const motionAddon=addOn?book.motionSpec({family,lengthMm:target.lengthMm,loadKg}):null;
    if(addOn&&!motionAddon)return {ok:false,code:'DRAWER_MOTION_UNCONFIRMED'};
    const result=forFront({family,usage,availableDepthMm,frontHeightMm,minLoadKg,
      candidates:book.allSpecs().filter(row=>row.productKind==='system'&&row.motion===(addOn?'soft':motion)&&(!addOn||family!=='blum_legrabox'||row.blumotionS===true)&&row.lengthMm===target.lengthMm&&row.profile===target.profile&&row.loadKg===loadKg&&(!row.doubleGallery||forceMaxLoad)&&(!forceMaxLoad||family!=='blum_tandembox_antaro'||row.doubleGallery)&&(!forceMaxLoad||family!=='blum_merivobox'||target.profile!=='E'||row.sideDesign==='solid')&&(!row.maxDrawerWidthMm||insideWidthMm<=row.maxDrawerWidthMm))});
    if(!result.ok)return result;
    const panels=book.panelGeometry(result.selected,insideWidthMm);
    return panels.ok?{...result,panels,motionAddon}:{ok:false,code:panels.code};
  }
  function requestedLoad(cab,inner=false){
    const value=cab.details?.[inner?'innerDrawerLoadKg':'drawerLoadKg'];
    if(value===undefined)return 0;
    const n=Number(value);if(!positive(n))throw Object.assign(Error('DRAWER_LOAD_INVALID'),{code:'DRAWER_LOAD_INVALID'});
    return n;
  }
  function isFullHeightSingle(room,cab){
    if(!['stojąca','moduł'].includes(cab?.type)||cab.subType!=='szuflady')return false;
    const front=FC.cabinetCutlist?.resolveDrawerFrontGeometry(cab,room);
    return !!front?.ok&&front.panels.length===1&&front.bodyHeightMm>=720;
  }
  function capacityGroups(room,cab){
    const book=FC.hardwareDrawerCatalog,back=FC.cabinetCutlist?.backGeometry(cab,room),groups=new Map();
    if(!book||!back?.ok)return [];
    let offset=0;
    for(const req of FC.cabinetDrawerRequirements?.getDrawerRequirements(room,cab)||[]){
      if(req.explicit)continue;
      const inner=req.technical?.usage==='wewnętrzna',fronts=frontsForRequirement(room,cab,req,inner?offset:0);if(inner)offset+=req.qty;
      if(!fronts.ok)continue;
      for(const front of fronts.fronts){
        const tech=req.technical,motion=!inner&&String(cab.openingSystem).toLowerCase()==='tip-on'?'push':'soft';let family=tech.drawerSystemKey,lengthMm;
        if(tech.drawerKind==='system')lengthMm=book.physicalTarget({family,usage:tech.usage,availableDepthMm:back.usableDepthMm,heightLimitMm:front.heightMm-FRONT_ALLOWANCE_MM})?.lengthMm;
        else{
          const fit=woodenGeometry({section:front.section||woodenSection({frontHeightMm:front.heightMm,inner}),insideWidthMm:Math.round(Number(cab.width)*10)-36,availableDepthMm:back.usableDepthMm,inner,manufacturer:tech.manufacturer||'Blum',series:tech.runnerSeries||'TANDEM BLUMOTION',motion});
          if(!fit.ok)continue;family=fit.family;lengthMm=fit.lengthMm;
        }
        const classes=book.physicalLoads({family,lengthMm,motion});if(!classes.length)continue;
        const key=inner?'innerDrawerLoadKg':'drawerLoadKg';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(classes);
      }
    }
    return [...groups].map(([key,lists])=>{
      const options=[...new Set(lists.flat())].sort((a,b)=>a-b).filter(n=>lists.every(list=>list.some(v=>v>=n)));
      return key==='drawerLoadKg'&&isFullHeightSingle(room,cab)?{key,options:options.slice(-1),forced:true}:{key,options};
    });
  }
  FC.cabinetDrawerSelection={select,forFront,woodenSection,woodenGeometry,frontsForRequirement,systemForFront,requestedLoad,isFullHeightSingle,capacityGroups,FRONT_ALLOWANCE_MM};
})();
