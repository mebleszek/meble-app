// CLOUD-1B: closed, read-only pilot projection. No normalization or storage access.
(function(){
  'use strict';
  const FC = window.FC = window.FC || {};
  const own = (v,k)=>Object.prototype.hasOwnProperty.call(v,k);
  const obj = v=>v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = (code,path)=>{ throw {exportFailure:true,code,path}; };
  const bad = p=>fail('EXPORT_INVALID_FIELD',p);
  const id = v=>typeof v === 'string' && v.length>0 && v.trim()===v
    && !['__proto__','constructor','prototype','schemaVersion','meta'].includes(v);
  const text = (v,p)=>{ if(typeof v!=='string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))bad(p);return v; };
  const ident = (v,p)=>{ if(!id(v))fail('EXPORT_INVALID_ID',p);return v; };
  const boolean = (v,p)=>{if(typeof v!=='boolean')bad(p);return v;};
  const number = (v,p)=>{if(typeof v!=='number'||!Number.isFinite(v))bad(p);return v;};
  const numeric = (v,p)=>{if(!((typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v))))bad(p);return v;};
  const positive = (v,p)=>{numeric(v,p);if(Number(v)<=0)fail('EXPORT_INVALID_GEOMETRY',p);return v;};
  const count = (v,p)=>{numeric(v,p);if(!Number.isSafeInteger(Number(v))||Number(v)<0)bad(p);return v;};
  const stamp = (v,p)=>{number(v,p);if(!Number.isSafeInteger(v)||v<=0||!Number.isFinite(new Date(v).getTime()))fail('EXPORT_INVALID_DATE',p);return v;};
  const empty = (v,p)=>{if(v!=='')fail('EXPORT_UNSUPPORTED_NOTE',p);return v;};
  const excluded = Symbol('known technical exclusion');
  const oneOf = choices=>(v,p)=>{if(!choices.includes(v))bad(p);return v;};
  const nullable = rule=>(v,p)=>v===null?null:rule(v,p);
  const array = rule=>(v,p)=>{if(!Array.isArray(v))bad(p);return v.map((x,i)=>rule(x,p+'['+i+']'));};
  function shape(fields,required=[]){return (v,p)=>{
    if(!obj(v))bad(p);
    const out={};
    for(const k of Object.keys(v)){
      if(!own(fields,k))fail('EXPORT_UNSUPPORTED_FIELD',p); // Never echo an unknown, possibly secret key.
      const value=fields[k](v[k],p+'.'+k);
      if(value!==excluded)out[k]=value;
    }
    for(const k of required)if(!own(v,k))fail('EXPORT_REQUIRED_FIELD',p+'.'+k);
    return out;
  };}
  const dict = rule=>(v,p)=>{if(!obj(v))bad(p);const out={};for(const k of Object.keys(v)){ident(k,p);out[k]=rule(v[k],p+'[]');}return out;};
  const fields = (names,rule)=>Object.fromEntries(names.split(' ').filter(Boolean).map(k=>[k,rule]));
  const dateInput=(v,p)=>{text(v,p);const time=Date.parse(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==v)fail('EXPORT_INVALID_DATE',p);return v;};
  const technicalMeta=shape({...fields('testData __test',boolean),...fields('testOwner testRunId __testRunId createdBy source',text)});
  const mirror=shape({...fields('id',ident),...fields('baseType name label projectStatus lastManualProjectStatus',text)},['id']);
  const investor=shape({id:ident,kind:oneOf(['person','company']),
    ...fields('name companyName ownerName phone email city address source nip',text),notes:empty,
    createdAt:stamp,updatedAt:stamp,addedDate:dateInput,rooms:array(mirror),meta:technicalMeta,__test:boolean,__testRunId:text,
    carrying:shape({floorNumber:text,elevatorStatus:oneOf(['','yes','no']),elevator:shape(fields('doorWidthCm doorHeightCm cabinDepthCm cabinHeightCm',text)),note:empty}),
    transport:shape({...fields('distanceKm durationMin source provider status calculatedAt origin destination routeProfile originHash destinationHash addressHash routeDistanceMeters routeDurationSeconds orsMapsUrl',text),note:empty,lastError:empty,
      // Geocoder responses have no closed business schema in this pilot.
      originGeocode:shape({}),destinationGeocode:shape({})})
  },['id','kind','createdAt','updatedAt']);
  const zone=shape({...fields('bodyColor frontMaterial frontColor backMaterial openingSystem bodyPcvCustomColor',text),bodyPcvMode:oneOf(['','body','front'])});
  const drawer=(v,p)=>{
    if(v===null)return null;
    if(!obj(v))bad(p);
    const out=v.kind==='system'?shape({kind:oneOf(['system']),systemKey:text},['kind','systemKey'])(v,p)
      :shape({kind:oneOf(['box']),runnerType:oneOf(['ball','undermount','roller']),manufacturer:text,runnerSeries:text},['kind','runnerType','manufacturer','runnerSeries'])(v,p);
    if(out.kind==='system'){
      const options=FC.roomPreferences&&FC.roomPreferences.DRAWER_SYSTEM_OPTIONS;
      if(!Array.isArray(options))fail('EXPORT_DEPENDENCY_UNAVAILABLE',p);
      if(!options.some(option=>option.key===out.systemKey&&option.system==='systemowe'))bad(p+'.systemKey');
    }else if(!out.manufacturer.trim()||!out.runnerSeries.trim())bad(p);
    return out;
  };
  const preferences=shape({...fields('finishStandard blendStandard hardwareManufacturer',text),zones:shape({lower:zone,middle:zone,upper:zone}),
    hardwareProducers:shape(fields('hinges drawers lifts sliding cargo accessories',text)),hardwareDrawerSystems:shape({drawers:text}),drawerPreference:drawer});
  const materialSource=shape({...fields('source material color',text)});
  const serializedSource=shape({...fields('source label part',text)});
  const details=shape({...fields('insideMode heightIncludesLegs projectUnusual subTypeOption cornerOption cornerFlip dishWasherWidth ovenOption sinkOption sinkFront sinkExtra sinkDoorCount fridgeOption fridgeFreeOption fridgeRequiresFurnitureHinges needsFurnitureHinges requiresFurnitureHinges drawerLayout drawerSystem drawerBrand drawerModel drawerRunnerType drawerRunnerSeries innerDrawerType innerDrawerBrand innerDrawerModel sinkInnerDrawerType sinkInnerDrawerBrand sinkInnerDrawerModel podFrontMode podInsideMode flapVendor flapKind hoodFrontMode hasBack hasHandle applianceMounting applianceMountingMode drawerPreferenceApplied',text),
    ...fields('shelves sinkExtraCount fridgeFrontCount techDividerCount techShelfCount innerDrawerCount podInnerDrawerCount',count),
    ...fields('legHeightCm blindPart gl gp st sp ovenHeight fridgeWidth fridgeNicheHeight',numeric),
    fridgeFrontSources:shape({single:materialSource,lower:materialSource,upper:materialSource}),
    ...fields('fridgeFrontSourceSingle fridgeFrontSourceLower fridgeFrontSourceUpper fridgeFrontCustomMaterialSingle fridgeFrontCustomMaterialLower fridgeFrontCustomMaterialUpper fridgeFrontCustomColorSingle fridgeFrontCustomColorLower fridgeFrontCustomColorUpper',text)});
  const cabinet=shape({id:ident,type:oneOf(['stojąca','wisząca','moduł']),subType:text,width:positive,height:positive,depth:positive,frontCount:count,
    ...fields('bodyColor frontMaterial frontColor backMaterial openingSystem bodyPcvCustomColor',text),bodyPcvMode:oneOf(['body','front']),details,
    setId:nullable(ident),...fields('setPreset setRole setName',text),setNumber:nullable(count),
    laborItems:array(shape({rateId:ident,qty:numeric},['rateId','qty'])),
    // Explicit technical exclusion: any contents remain local and are never projected.
    derivedFacts:()=>excluded,_derivedFacts:()=>excluded
  },['id','type','subType','width','height','depth','details']);
  const set=shape({id:ident,presetId:oneOf(['A','C','D']),number:count,
    ...fields('bodyColor backMaterial openingSystem frontMaterial frontColor',text),frontCount:oneOf([1,2]),frontSource:serializedSource,
    params:shape({presetId:oneOf(['A','C','D']),...fields('w1 w2 w hB hM hTop dBottom dModule blende',numeric)})},['id','presetId','frontCount','params']);
  const front=shape({id:ident,cabId:nullable(ident),setId:nullable(ident),setNumber:nullable(count),...fields('material color',text),width:positive,height:positive,note:text,frontMaterialSource:serializedSource},['id','width','height']);
  const edges=shape(fields('w1 w2 h1 h2',boolean),['w1','w2','h1','h2']);
  const overrides=dict(dict(shape({edges},['edges'])));
  const production=shape({partOverrides:overrides,cabinetGroupOverrides:overrides,setGroupOverrides:overrides});
  const rowItem=(v,p)=>obj(v)&&v.kind==='cabinet'?shape({kind:oneOf(['cabinet']),id:ident},['kind','id'])(v,p)
    :shape({kind:oneOf(['gap']),id:ident,width:positive,label:text},['kind','id','width'])(v,p);
  const layout=shape({segments:array(shape({id:ident,name:text,anchor:text,offsets:shape(fields('base module wall',numeric)),rows:shape({base:array(rowItem),module:array(rowItem),wall:array(rowItem)})},['id','rows'])),activeSegmentId:()=>excluded});
  const room=shape({cabinets:array(cabinet),fronts:array(front),sets:array(set),settings:shape(fields('roomHeight bottomHeight legHeight counterThickness gapHeight ceilingBlende',numeric)),preferences,production,layout},['cabinets','fronts','sets','settings','preferences']);
  const roomDef=shape({id:ident,...fields('baseType name label projectStatus lastManualProjectStatus',text),legacy:boolean},['id','baseType','name','label']);
  const meta=shape({assignedInvestorId:ident,productionPcvMode:oneOf(['project']),roomOrder:array(ident),roomDefs:dict(roomDef),projectStatus:text},['assignedInvestorId','productionPcvMode','roomOrder','roomDefs']);
  const projectData=(v,p)=>{
    if(!obj(v))bad(p);
    if(v.schemaVersion!==12)fail('EXPORT_SCHEMA_UNSUPPORTED',p+'.schemaVersion');
    const out={schemaVersion:12,meta:meta(v.meta,p+'.meta')};
    for(const key of Object.keys(v))if(key!=='meta'&&key!=='schemaVersion'){ident(key,p);out[key]=room(v[key],p+'.rooms[]');}
    return out;
  };
  const project=shape({id:ident,investorId:ident,title:text,status:text,createdAt:stamp,updatedAt:stamp,roomKeys:array(ident),roomCount:count,cabinetCount:count,projectData,
    meta:shape({source:text,...fields('testData __test',boolean),...fields('testOwner testRunId __testRunId createdBy',text)}),__test:boolean,__testRunId:text
  },['id','investorId','title','status','createdAt','updatedAt','roomKeys','roomCount','cabinetCount','projectData']);
  function unique(values,p){if(new Set(values).size!==values.length)fail('EXPORT_DUPLICATE_ID',p);}
  function sameKeys(a,b){return a.length===b.length&&a.every(k=>b.includes(k));}
  function chronological(v,p){if(v.updatedAt<v.createdAt)fail('EXPORT_INVALID_DATE',p+'.updatedAt');}
  // This pilot validates only roles whose existence follows directly from supported
  // native template fields. Unknown/custom roles are refused, never guessed.
  function roleAllowed(space,role,owner,roomValue){
    if(space==='setGroupOverrides')return owner.presetId==='A'?(Number(owner.frontCount)===1?role==='front.A.single':['front.A.left','front.A.right'].includes(role)):role==='front.'+owner.presetId+'.panels';
    const standing=owner.type==='stojąca',drawers=owner.subType==='szuflady',setMember=!!owner.setId;
    if(space==='partOverrides'){
      const roles=['body.side.left','body.side.right','body.bottom'];
      if(!standing)roles.push('body.top');else roles.push('body.top-traverse.a','body.top-traverse.b');
      if(owner.backMaterial && !['brak','— brak —'].includes(owner.backMaterial))roles.push('body.back');
      if(!drawers&&!setMember){const fc=Number(owner.frontCount||0);if(fc===1)roles.push('front.door.single');if(fc===2)roles.push('front.door.left','front.door.right');}
      return roles.includes(role);
    }
    if(role==='body.shelves')return !drawers&&Number(owner.details.shelves)>0;
    if(drawers){
      const layout=owner.details.drawerLayout||'3_1_2_2';
      if(layout==='3_1_2_2'&&['front.drawer.small','front.drawer.large'].includes(role))return true;
      if(layout!=='3_1_2_2'&&role==='front.drawer.standard')return true;
      if(owner.details.drawerSystem==='skrzynkowe'&&['drawer.front_drawers.sides','drawer.front_drawers.back','drawer.front_drawers.bottom'].includes(role))return true;
    }
    return false;
  }
  function validateRoom(value,p){
    unique(value.cabinets.map(c=>c.id),p+'.cabinets');unique(value.sets.map(s=>s.id),p+'.sets');unique(value.fronts.map(f=>f.id),p+'.fronts');
    const cabinets=new Map(value.cabinets.map(c=>[c.id,c])),sets=new Map(value.sets.map(s=>[s.id,s]));
    for(const cab of value.cabinets){
      if(!['standardowa','szuflady'].includes(cab.subType))fail('EXPORT_UNSUPPORTED_STRUCTURE',p+'.cabinets[].subType');
      if(cab.subType==='szuflady'&&cab.type==='wisząca')fail('EXPORT_UNSUPPORTED_STRUCTURE',p+'.cabinets[]');
      if(cab.subType==='standardowa'&&Number(cab.frontCount||0)>2)fail('EXPORT_UNSUPPORTED_STRUCTURE',p+'.cabinets[].frontCount');
      if(cab.setId&&!sets.has(cab.setId))fail('EXPORT_INVALID_REFERENCE',p+'.cabinets[].setId');
      if(cab.setId){
        const parent=sets.get(cab.setId);
        if((cab.setPreset&&cab.setPreset!==parent.presetId)||(cab.setNumber!=null&&cab.setNumber!==parent.number))fail('EXPORT_INVALID_REFERENCE',p+'.cabinets[].setId');
      }else if(cab.setPreset||cab.setRole||cab.setName||cab.setNumber!=null)fail('EXPORT_INVALID_REFERENCE',p+'.cabinets[].setId');
      if(cab.subType==='szuflady'){
        if(!FC.cabinetCutlist||typeof FC.cabinetCutlist.resolveDrawerFrontGeometry!=='function')fail('EXPORT_DEPENDENCY_UNAVAILABLE',p);
        const geometry=FC.cabinetCutlist.resolveDrawerFrontGeometry(cab,value);
        if(!geometry||geometry.ok!==true)fail('EXPORT_INVALID_GEOMETRY',p+'.cabinets[]');
      }
    }
    for(const s of value.sets){
      if(!value.cabinets.some(c=>c.setId===s.id))fail('EXPORT_INVALID_REFERENCE',p+'.sets[]');
      if(s.params.presetId&&s.params.presetId!==s.presetId)fail('EXPORT_INVALID_REFERENCE',p+'.sets[].params');
      const required=s.presetId==='A'?['w1','w2','hB','hTop']:s.presetId==='D'?['w','hB','hM','hTop']:['w','hB','hTop'];
      for(const key of required)positive(s.params[key],p+'.sets[].params.'+key);
      // A params map cannot quietly carry another template's construction.
      const allowed=s.presetId==='A'?['presetId','w1','w2','hB','hTop','dBottom','dModule','blende']:s.presetId==='D'?['presetId','w','hB','hM','hTop','dBottom','dModule','blende']:['presetId','w','hB','hTop','dBottom','dModule','blende'];
      if(Object.keys(s.params).some(k=>!allowed.includes(k)))fail('EXPORT_UNSUPPORTED_FIELD',p+'.sets[].params');
    }
    for(const f of value.fronts){
      if((!f.cabId&&!f.setId)||(f.cabId&&!cabinets.has(f.cabId))||(f.setId&&!sets.has(f.setId))||(f.setId&&f.cabId&&cabinets.get(f.cabId).setId!==f.setId))fail('EXPORT_INVALID_REFERENCE',p+'.fronts[]');
      if(f.setNumber!=null&&(!f.setId||f.setNumber!==sets.get(f.setId).number))fail('EXPORT_INVALID_REFERENCE',p+'.fronts[].setNumber');
      // Persisted front.note has no provenance tag; matching a caption alone does
      // not prove origin. For this first pilot nonempty notes must be refused.
      if(f.note)fail('EXPORT_UNSUPPORTED_NOTE',p+'.fronts[].note');
    }
    for(const space of Object.keys(value.production||{}))for(const ownerId of Object.keys(value.production[space])){
      const owner=(space==='setGroupOverrides'?sets:cabinets).get(ownerId);
      if(!owner)fail('EXPORT_PCV_OWNER_INVALID',p+'.production.'+space);
      for(const role of Object.keys(value.production[space][ownerId]))if(!roleAllowed(space,role,owner,value))fail('EXPORT_PCV_ROLE_INVALID',p+'.production.'+space+'[][]');
    }
    if(value.layout){
      unique(value.layout.segments.map(s=>s.id),p+'.layout.segments');const used=[];
      for(const seg of value.layout.segments)for(const row of Object.values(seg.rows))for(const item of row){
        if(item.kind==='cabinet'){if(!cabinets.has(item.id))fail('EXPORT_INVALID_REFERENCE',p+'.layout');used.push(item.id);}
      }
      unique(used,p+'.layout');
    }
  }
  function validate(rawInvestor,rawProject){
    try{
      const i=investor(rawInvestor,'investor'),p=project(rawProject,'project');
      // Existing test flags are an eligibility fence, not proof that arbitrary
      // text is non-sensitive. The caller must still supply synthetic fixtures.
      if(!(i.__test===true||i.meta&&i.meta.testData===true)||!(p.__test===true||p.meta&&p.meta.testData===true))fail('EXPORT_PILOT_DATA_REQUIRED','payload');
      chronological(i,'investor');chronological(p,'project');
      if(!(i.kind==='company'?i.companyName:i.name)||!p.title.trim())fail('EXPORT_REQUIRED_FIELD','payload.identity');
      if(p.investorId!==i.id||p.projectData.meta.assignedInvestorId!==i.id)fail('EXPORT_INVESTOR_MISMATCH','project.investorId');
      const data=p.projectData,keys=Object.keys(data).filter(k=>!['meta','schemaVersion'].includes(k));
      unique(p.roomKeys,'project.roomKeys');unique(data.meta.roomOrder,'project.projectData.meta.roomOrder');
      const defined=Object.keys(data.meta.roomDefs);
      if(!sameKeys(keys,p.roomKeys)||!sameKeys(defined,data.meta.roomOrder)||defined.some(k=>!keys.includes(k)))fail('EXPORT_ROOM_SCOPE_MISMATCH','project.projectData.meta');
      if(Number(p.roomCount)!==keys.length||Number(p.cabinetCount)!==keys.reduce((n,k)=>n+data[k].cabinets.length,0))fail('EXPORT_COUNT_MISMATCH','project');
      for(const k of keys){
        const def=data.meta.roomDefs[k],r=data[k];
        // The native schema persists four empty base templates even when only
        // named functional rooms are registered. Preserve them without inventing
        // room definitions or silently losing their stored settings/preferences.
        if(!def&&(!['kuchnia','szafa','pokoj','lazienka'].includes(k)||r.cabinets.length||r.fronts.length||r.sets.length||r.production||r.layout))fail('EXPORT_ROOM_SCOPE_MISMATCH','project.projectData.meta.roomDefs');
        if(def&&def.id!==k)fail('EXPORT_INVALID_REFERENCE','project.projectData.meta.roomDefs');
        validateRoom(r,'project.projectData.rooms[]');
      }
      if(i.rooms){unique(i.rooms.map(r=>r.id),'investor.rooms');for(const r of i.rooms){if(!own(data.meta.roomDefs,r.id))continue;const def=data.meta.roomDefs[r.id];for(const k of Object.keys(r))if(k!=='id'&&r[k]!==def[k]&&!(r[k]===''&&def[k]===undefined))fail('EXPORT_ROOM_SCOPE_MISMATCH','investor.rooms');}}
      // Project is canonical for rooms; investor.rooms is a compatibility mirror.
      delete i.rooms;delete i.meta;delete i.__test;delete i.__testRunId;
      delete p.meta;delete p.__test;delete p.__testRunId;
      return {ok:true,payload:{investor:i,project:p}};
    }catch(e){return e&&e.exportFailure?{ok:false,code:e.code,path:e.path}:{ok:false,code:'EXPORT_INVALID_FIELD',path:'payload'};}
  }
  function canonical(value){
    if(value===null||typeof value==='boolean')return JSON.stringify(value);
    if(typeof value==='number'){if(!Number.isFinite(value))throw Error('nonfinite');return JSON.stringify(value);}
    if(typeof value==='string'){if(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value))throw Error('unicode');return JSON.stringify(value);}
    if(Array.isArray(value)){if(Object.keys(value).length!==value.length)throw Error('array');return '['+value.map(canonical).join(',')+']';}
    if(obj(value))return '{'+Object.keys(value).sort().map(k=>canonical(k)+':'+canonical(value[k])).join(',')+'}';
    throw Error('not JSON');
  }
  function dependencies(payload){
    const out=[],seen=new Set();
    const add=(domain,reference)=>{const key=domain+'|'+reference;if(reference&&!seen.has(key)){seen.add(key);out.push({domain,reference});}};
    const materials=value=>{for(const k of ['bodyColor','frontMaterial','frontColor','backMaterial','material','color'])if(value&&value[k])add('material',value[k]);};
    for(const [roomId,r] of Object.entries(payload.project.projectData)){
      if(roomId==='meta'||roomId==='schemaVersion')continue;
      for(const c of r.cabinets){materials(c);for(const k of ['drawerBrand','drawerModel','drawerRunnerType','drawerRunnerSeries'])add('hardware',c.details[k]);for(const labor of c.laborItems||[])add('rate',labor.rateId);}
      for(const f of r.fronts)materials(f);
      for(const set of r.sets)materials(set);
      const prefs=r.preferences;
      for(const zone of Object.values(prefs.zones||{}))materials(zone);
      for(const value of Object.values(prefs.hardwareProducers||{}))add('hardware',value);
      add('hardware',prefs.hardwareManufacturer);
      for(const value of Object.values(prefs.hardwareDrawerSystems||{}))add('hardware',value);
      const drawer=prefs.drawerPreference;if(drawer){add('hardware',drawer.systemKey);add('hardware',drawer.manufacturer);add('hardware',drawer.runnerSeries);}
      add('inherited-defaults',roomId); // Empty overrides retain native inheritance.
    }
    return out.sort((a,b)=>(a.domain+'|'+a.reference)<(b.domain+'|'+b.reference)?-1:1);
  }
  FC.projectExportContract={validate,canonical,dependencies,isId:id,MAX_BYTES:819200};
})();
