// CLOUD-3 internal boundary. Not registered in application startup; no storage side effects.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const fail=(code,path='')=>{const e=Error(code);e.code=code;e.path=path;throw e;};
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.prototype.toString.call(v)==='[object Object]';
  const string=(v,p)=>{if(typeof v!=='string'||v.length>65536||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))fail('GLOBAL_VALUE_INVALID',p);
    if(/AIza[\w-]{30,}|ya29\.|-----BEGIN [\w ]*PRIVATE KEY-----/.test(v))fail('GLOBAL_SECRET_FORBIDDEN',p);};
  const number=(v,p)=>{if(typeof v!=='number'||!Number.isFinite(v))fail('GLOBAL_VALUE_INVALID',p);};
  const boolean=(v,p)=>{if(typeof v!=='boolean')fail('GLOBAL_VALUE_INVALID',p);};
  const positive=(v,p)=>{number(v,p);if(v<=0)fail('GLOBAL_VALUE_INVALID',p);};
  const nonnegative=(v,p)=>{number(v,p);if(v<0)fail('GLOBAL_VALUE_INVALID',p);};
  const integer=(v,p)=>{nonnegative(v,p);if(!Number.isSafeInteger(v))fail('GLOBAL_VALUE_INVALID',p);};
  const id=(v,p)=>{string(v,p);if(!v.trim()||v.length>256||/[\u0000-\u001f]/.test(v)||['__proto__','constructor','prototype'].includes(v))fail('GLOBAL_ID_INVALID',p);};
  const date=(v,p)=>{string(v,p);if(v!==''&&!Number.isFinite(Date.parse(v)))fail('GLOBAL_DATE_INVALID',p);};
  const choice=(...values)=>(v,p)=>{if(!values.includes(v))fail('GLOBAL_VALUE_INVALID',p);};
  const nullable=fn=>(v,p)=>{if(v!==null)fn(v,p);};
  const list=fn=>(v,p)=>{if(!Array.isArray(v)||v.length>4096)fail('GLOBAL_VALUE_INVALID',p);v.forEach((x,i)=>fn(x,p+'['+i+']'));};
  function shape(fields,required=[]){return (v,p)=>{
    if(!object(v))fail('GLOBAL_VALUE_INVALID',p);
    for(const k of Object.keys(v))if(!Object.hasOwn(fields,k))fail('GLOBAL_UNKNOWN_FIELD',p);
    for(const k of required)if(!Object.hasOwn(v,k))fail('GLOBAL_REQUIRED_FIELD',p+'.'+k);
    for(const [k,fn]of Object.entries(fields))if(Object.hasOwn(v,k))fn(v[k],p+'.'+k);
  };}
  const fields=(names,fn)=>Object.fromEntries(names.split(' ').filter(Boolean).map(k=>[k,fn]));
  const common={...fields('id',id),...fields('name note',string),price:nonnegative,starterPrice:boolean,priceUserEditedAt:date};
  const material=shape({...common,...fields('materialType manufacturer symbol',string),priceUnit:choice('sheet','m2','mb','piece'),hasGrain:boolean},['id','name','materialType','price','priceUnit']);
  const supplierPrice=shape({supplierId:id,...fields('catalogPriceNet catalogPriceGross',nonnegative),enteredPriceType:choice('net','gross',''),priceDate:date,priceStatus:string,useForQuote:boolean},['supplierId']);
  const paramValue=shape({value:(v,p)=>{if(typeof v==='boolean')return;string(v,p);},from:(v,p)=>{if(v!=='')number(v,p);},to:(v,p)=>{if(v!=='')number(v,p);}});
  const hardware=shape({...common,...fields('manufacturer symbol hardwareCategory hardwareType hardwareUnit hardwareSystem series drawerProfile hardwareColor hardwareUsage technicalNote supplierId priceSource quoteBase pricingMode priceStatus status bundleCostMode',string),
    ...fields('vatRate catalogPriceNet catalogPriceGross purchasePriceNet purchasePriceGross purchasePrice quotePriceNet quotePriceGross bundleComponentsCatalogGross bundleComponentsPurchaseGross manualBaseGross',nonnegative),
    ...fields('supplierDiscountPercent markupPercent marginGross effectiveMarkupPercent',number),...fields('drawerLengthMm drawerLoadKg',(v,p)=>{if(v!=='')nonnegative(v,p);}),...fields('drawerReinforced hardwareTypeAuto',boolean),priceUpdatedAt:date,
    supplierPrices:list(supplierPrice),bundleItems:list(shape({itemId:id,qty:positive},['itemId','qty'])),
    technicalParams:(v,p)=>{if(!object(v))fail('GLOBAL_VALUE_INVALID',p);Object.values(v).forEach(x=>paramValue(x,p));}
  },['id','name','hardwareCategory','hardwareUnit','price']);
  const tier=shape({min:nullable(number),max:nullable(number),hours:nonnegative,price:nonnegative},['min','max','hours','price']);
  const labor=shape({...common,...fields('category label usage rateKey rateCode rateType pricingMode quantityMode quantitySource volumeTimeMode',string),
    ...fields('isHourlyRate systemRate nonDeletable active internalOnly',boolean),
    ...fields('startPrice includedQty timeBlockHours defaultMultiplier startHours startQty stepEveryQty stepHours volumePricePerM3 volumeTimePerM3 fixedPrice',nonnegative),
    conditions:list(shape({source:string,operator:choice('range'),min:nullable(number),max:nullable(number)},['source','operator','min','max'])),quantityTiers:list(tier),volumeTimeTiers:list(tier)
  },['id','name','price']);
  const definition=shape({...fields('id',id),...fields('category key label unit legacyField',string),fieldType:choice('text','boolean','numberRange'),options:list(string),...fields('keyFeature typePart active',boolean),compareMode:string,order:number},['id','category','key','fieldType']);
  const zone=shape(fields('bodyColor frontMaterial frontColor backMaterial openingSystem bodyPcvMode bodyPcvCustomColor',string));
  const preference=(v,p)=>{if(v===null)return;const s=v?.kind==='system'?{kind:choice('system'),systemKey:id}:{kind:choice('box'),runnerType:id,manufacturer:id,runnerSeries:id};shape(s,Object.keys(s))(v,p);};
  const updated=shape({updatedAt:date});
  const schemas={
    materials:material,hardware,
    manufacturers:string,categories:string,
    suppliers:shape({id,name:string,defaultDiscountPercent:number,active:boolean},['id','name']),
    types:shape({id,name:string,allowedCategories:list(string),active:boolean},['id','name','allowedCategories']),
    technicalParams:definition,
    hardwareSettings:shape({defaultSupplierId:id,...fields('defaultVatRate defaultMarkupPercent',number),...fields('defaultQuoteBase defaultPricingMode',string)}),
    labor,workshopServices:labor,
    stock:shape({id,material:id,width:positive,height:positive,qty:integer},['id','material','width','height','qty']),
    programDefaults:(v,p)=>{if(v?.version===1){shape({version:choice(1),materials:shape(fields('bodyColor frontMaterial frontColor backMaterial',string)),hardware:shape(fields('hingesManufacturer drawerSystemManufacturer drawerSystemKey liftManufacturer slidingSystemManufacturer cargoManufacturer accessoriesManufacturer',string))},['version','materials','hardware'])(v,p);return;}shape({version:choice(2),general:shape(fields('finishStandard blendStandard',string)),zones:shape({lower:zone,middle:zone,upper:zone},['lower','middle','upper']),hardware:shape({...fields('hingesManufacturer drawerSystemManufacturer drawerSystemKey liftManufacturer slidingSystemManufacturer cargoManufacturer accessoriesManufacturer',string),drawerPreference:preference})},['version','general','zones','hardware'])(v,p);},
    company:shape({company:shape(fields('displayName legalName ownerName nip regon addressLine postalCode city country phone email website notes',string)),transport:shape({provider:string,profile:string,billingMode:choice('one_way','round_trip'),roundingKm:nonnegative,minimumBillableKm:nonnegative,attribution:string}),meta:updated},['company','transport']),
    businessCosts:shape({rows:list(shape({id,...fields('category name amountNet paymentDay note',string),vatRate:nonnegative,billingPeriod:choice('monthly'),active:boolean},['id','name'])),meta:updated},['rows'])
  };
  const single=new Set(['hardwareSettings','programDefaults','company','businessCosts']);
  const dictionary=new Set(['manufacturers','categories']);
  const sources={materials:['fc_sheet_materials_v1','fc_materials_v1'],hardware:['fc_accessories_v1'],manufacturers:['fc_hardware_manufacturers_v1'],suppliers:['fc_hardware_suppliers_v1','hardwareSuppliers'],categories:['fc_hardware_categories_v1','hardwareCategories'],types:['fc_hardware_types_v1','hardwareTypes'],technicalParams:['fc_hardware_technical_params_v1','hardwareTechnicalParams'],hardwareSettings:['fc_hardware_settings_v1','hardwareSettings'],labor:['fc_quote_rates_v1','fc_services_v1'],workshopServices:['fc_workshop_services_v1'],stock:['fc_sheets_v1'],programDefaults:['fc_program_defaults_v1'],company:['fc_company_profile_v1'],businessCosts:['fc_business_costs_v1']};
  const validateBundle=model=>{if(!object(model)||Object.keys(schemas).some(d=>!Object.hasOwn(model,d)))fail('GLOBAL_BUNDLE_INCOMPLETE');return validate(model);};
  const canonical=v=>{if(!FC.projectExportContract?.canonical)fail('GLOBAL_DEPENDENCY_UNAVAILABLE');return FC.projectExportContract.canonical(v);};
  const clone=v=>JSON.parse(canonical(v));
  const sha=async bytes=>{if(!globalThis.crypto?.subtle)fail('GLOBAL_HASH_UNAVAILABLE');const x=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,'0')).join('');};
  const encode=v=>new TextEncoder().encode(canonical(v));
  function validate(model){
    if(!object(model)||!Object.keys(model).length)fail('GLOBAL_SCOPE_INVALID');
    for(const d of Object.keys(model)){
      if(!Object.hasOwn(schemas,d))fail('GLOBAL_DOMAIN_UNSUPPORTED');
      const rows=single.has(d)?[model[d]]:model[d];if(!Array.isArray(rows))fail('GLOBAL_VALUE_INVALID',d);
      const ids=new Set();for(const row of rows){schemas[d](row,d);const key=single.has(d)?'singleton':dictionary.has(d)?row:row.id;id(key,d);if(ids.has(key))fail('GLOBAL_DUPLICATE_ID',d);ids.add(key);}
    }
    const requireDomain=d=>{if(!Object.hasOwn(model,d))fail('GLOBAL_DEPENDENCY_MISSING',d);return model[d];};
    const reference=(d,key,field='id')=>{if(key&&!requireDomain(d).some(r=>(typeof r==='string'?r:r[field])===key))fail('GLOBAL_REFERENCE_MISSING',d);};
    for(const row of model.hardware||[]){
      if(row.manufacturer)reference('manufacturers',row.manufacturer);reference('categories',row.hardwareCategory);
      if(row.supplierId)reference('suppliers',row.supplierId);
      for(const p of row.supplierPrices||[])reference('suppliers',p.supplierId);
      if((row.supplierPrices||[]).filter(p=>p.useForQuote).length>1)fail('GLOBAL_REFERENCE_CONFLICT','hardware.supplierPrices');
      for(const part of row.bundleItems||[]){if(part.itemId===row.id)fail('GLOBAL_REFERENCE_CONFLICT','hardware.bundleItems');reference('hardware',part.itemId);}
      for(const [key,val]of Object.entries(row.technicalParams||{})){
        const def=requireDomain('technicalParams').find(d=>d.key===key&&d.category===row.hardwareCategory);if(!def)fail('GLOBAL_REFERENCE_MISSING','hardware.technicalParams');
        if(def.fieldType==='numberRange'){shape({from:(v,p)=>{if(v!=='')number(v,p);},to:(v,p)=>{if(v!=='')number(v,p);}},['from','to'])(val,'hardware.technicalParams');if(val.from!==''&&val.to!==''&&val.from>val.to)fail('GLOBAL_VALUE_INVALID');}
        else {shape({value:def.fieldType==='boolean'?(v,p)=>{if(v!=='')boolean(v,p);}:string},['value'])(val,'hardware.technicalParams');if(def.fieldType==='text'&&val.value!==''&&def.options?.length&&!def.options.includes(val.value))fail('GLOBAL_VALUE_INVALID');}
      }
    }
    for(const r of model.hardware||[]){
      for(const [field,values]of Object.entries({hardwareUnit:['szt.','kpl.','mb','m²','zestaw'],quoteBase:['catalogGross','purchaseGross','manualGross'],pricingMode:['markup','manualPrice'],bundleCostMode:['ownPrice','components'],status:['active','hidden','archived'],priceStatus:['current','review','old','archived']}))if(Object.hasOwn(r,field))choice(...values)(r[field],'hardware.'+field);
      for(const p of r.supplierPrices||[])if(Object.hasOwn(p,'priceStatus'))choice('current','review','old','archived')(p.priceStatus,'hardware.supplierPrices.priceStatus');
    }
    for(const r of model.technicalParams||[])if(Object.hasOwn(r,'compareMode'))choice('equal','withinRange','rangeOverlap','minGte','ignore')(r.compareMode,'technicalParams.compareMode');
    for(const r of [...(model.labor||[]),...(model.workshopServices||[])]){
      if(Object.hasOwn(r,'pricingMode'))choice('fixed','perUnit','startPlusUnit','time','timeTiers','timeStartStep','advanced')(r.pricingMode,'labor.pricingMode');
      if(Object.hasOwn(r,'quantityMode'))choice('none','linear','tiers','startStep')(r.quantityMode,'labor.quantityMode');
    }
    // A recursive bundle would change pricing semantics; refuse instead of repairing.
    const visit=(key,stack)=>{if(stack.has(key))fail('GLOBAL_REFERENCE_CONFLICT','hardware.bundleItems');const row=model.hardware?.find(r=>r.id===key);for(const part of row?.bundleItems||[])visit(part.itemId,new Set([...stack,key]));};
    (model.hardware||[]).forEach(r=>visit(r.id,new Set()));
    for(const r of model.types||[])for(const category of r.allowedCategories)reference('categories',category);
    const defKeys=new Set();for(const d of model.technicalParams||[]){const k=canonical([d.category,d.key]);if(defKeys.has(k))fail('GLOBAL_DUPLICATE_ID','technicalParams');defKeys.add(k);}
    if(model.hardwareSettings?.defaultSupplierId)reference('suppliers',model.hardwareSettings.defaultSupplierId);
    const hourly=(model.labor||[]).filter(r=>r.isHourlyRate||r.systemRate||r.category==='Stawki godzinowe'),codes=new Set();
    for(const r of hourly){const key=r.rateKey||r.rateCode||r.rateType;if(!key||codes.has(key))fail('GLOBAL_REFERENCE_CONFLICT','labor.rateCode');codes.add(key);}
    for(const r of model.labor||[])if(!hourly.includes(r)&&r.rateType&&r.pricingMode!=='fixed'&&!codes.has(r.rateType))fail('GLOBAL_REFERENCE_MISSING','labor.rateType');
    const dependencies=[];
    for(const d of model.technicalParams||[])if(!requireDomain('categories').includes(d.category))dependencies.push({kind:'unusedParameterCategory',value:d.category,requirement:'dictionary entry required before using this category'});
    for(const row of model.stock||[])dependencies.push({kind:'productionMaterialKey',value:row.material,requirement:'bind using project material resolver before calculation'});
    if(model.programDefaults)dependencies.push({kind:'programDefaults',requirement:'resolve material names and built-in drawer systems against destination runtime'});
    return {dependencies,warnings:['Restored data is not proof of identical WYCENA; global grain/rotation Issue #47 and project/quote coverage remain separate.']};
  }
  // Strict RAW capture is explicit; never enumerate storage or invoke normalizers/setters.
  function capture(storage,domains){
    if(!storage||typeof storage.getItem!=='function'||!Array.isArray(domains)||new Set(domains).size!==domains.length)fail('GLOBAL_SCOPE_INVALID');
    const evidence=new Map(),model={};
    const read=key=>{try{const raw=storage.getItem(key);evidence.set(key,raw);return raw;}catch(_){fail('GLOBAL_STORAGE_UNAVAILABLE');}};
    const parse=raw=>{try{return JSON.parse(raw);}catch(_){fail('GLOBAL_STORAGE_INVALID');}};
    if(read('fc_edit_session_v1')!==null)fail('GLOBAL_EDIT_SESSION_ACTIVE');
    for(const d of domains){
      if(!Object.hasOwn(sources,d))fail('GLOBAL_DOMAIN_UNSUPPORTED');
      const [primary,alias]=sources[d],raw=read(primary),old=alias?read(alias):null;
      if(raw===null&&old===null)fail('GLOBAL_SOURCE_MISSING',d);
      const value=parse(raw===null?old:raw);
      if(raw!==null&&old!==null&&canonical(value)!==canonical(parse(old)))fail('GLOBAL_ALIAS_CONFLICT',d);
      if(d==='company'){
        // This single known non-business credential is intentionally local-only.
        if(!object(value.transport))fail('GLOBAL_VALUE_INVALID','company.transport');
        if(Object.hasOwn(value.transport,'apiKey')&&typeof value.transport.apiKey!=='string')fail('GLOBAL_VALUE_INVALID','company.transport');
        delete value.transport.apiKey;
      }
      model[d]=d==='stock'?(shape({sheets:list(schemas.stock)},['sheets'])(value,'stock'),value.sheets):value;
    }
    const diagnostic=validate(model);
    return {model:clone(model),...diagnostic,assertUnchanged(){for(const [key,raw]of evidence){let now;try{now=storage.getItem(key);}catch(_){fail('GLOBAL_STORAGE_UNAVAILABLE');}if(now!==raw)fail('GLOBAL_SOURCE_CHANGED');}}};
  }
  const MAX_RECORD_BYTES=131072,MAX_DIRECTORY_BYTES=131072,MAX_RECORDS=1024,MAX_TOTAL_BYTES=33554432;
  async function pack(ownerUid,model){
    id(ownerUid);const diagnostic=validate(model),directory={},records=[];let total=0;
    for(const d of Object.keys(model).sort()){
      directory[d]=[];
      for(const value of single.has(d)?[model[d]]:model[d]){
        const recordId=single.has(d)?'singleton':dictionary.has(d)?value:value.id;
        const envelope={version:1,ownerUid,domain:d,recordId,value},bytes=encode(envelope);
        if(bytes.length>MAX_RECORD_BYTES)fail('GLOBAL_RECORD_TOO_LARGE',d);total+=bytes.length;
        const hash=await sha(bytes);records.push({ownerUid,version:1,domain:d,recordId,hash,json:canonical(envelope),byteLength:bytes.length});directory[d].push({id:recordId,hash});
      }
    }
    if(records.length>MAX_RECORDS||total>MAX_TOTAL_BYTES||encode(directory).length>MAX_DIRECTORY_BYTES)fail('GLOBAL_SIZE_LIMIT');
    return {ownerUid,directory:clone(directory),directoryJson:canonical(directory),directoryHash:await sha(encode(directory)),records,...diagnostic};
  }
  async function unpack(ownerUid,directory,records){
    if(!object(directory)||!Array.isArray(records)||records.length>MAX_RECORDS||encode(directory).length>MAX_DIRECTORY_BYTES)fail('GLOBAL_DIRECTORY_INVALID');
    const model={},byHash=new Map();for(const r of records){if(byHash.has(r.hash))fail('GLOBAL_DUPLICATE_ID');byHash.set(r.hash,r);}
    let count=0,total=0;
    for(const [d,entries]of Object.entries(directory)){
      if(!Object.hasOwn(schemas,d)||!Array.isArray(entries)||(single.has(d)&&entries.length!==1))fail('GLOBAL_DIRECTORY_INVALID');
      const values=[];for(const ref of entries){shape({id,hash:hashValue},['id','hash'])(ref,'directory');const r=byHash.get(ref.hash);if(!r)fail('GLOBAL_RECORD_MISSING');
        shape({ownerUid:id,version:choice(1),domain:string,recordId:id,hash:hashValue,json:(v,p)=>{if(typeof v!=='string')fail('GLOBAL_VALUE_INVALID',p);},byteLength:integer},['ownerUid','version','domain','recordId','hash','json','byteLength'])(r,'record');
        if(r.ownerUid!==ownerUid||r.domain!==d||r.recordId!==ref.id)fail('GLOBAL_OWNER_INVALID');
        // Record JSON can exceed the normal business string length.
        const bytes=new TextEncoder().encode(r.json);total+=bytes.length;
        if(bytes.length>MAX_RECORD_BYTES||bytes.length!==r.byteLength||await sha(bytes)!==ref.hash)fail('GLOBAL_INTEGRITY_INVALID');
        let e;try{e=JSON.parse(r.json);}catch(_){fail('GLOBAL_RECORD_INVALID');}
        shape({version:choice(1),ownerUid:id,domain:string,recordId:id,value:()=>{}},['version','ownerUid','domain','recordId','value'])(e,'record');
        if(canonical(e)!==r.json||e.ownerUid!==ownerUid||e.domain!==d||e.recordId!==ref.id)fail('GLOBAL_OWNER_INVALID');values.push(e.value);count++;
      }model[d]=single.has(d)?values[0]:values;
    }
    if(count!==records.length||total>MAX_TOTAL_BYTES)fail('GLOBAL_DIRECTORY_INVALID');const diagnostic=validate(model);
    const packed=await pack(ownerUid,model);if(packed.directoryJson!==canonical(directory))fail('GLOBAL_DIRECTORY_INVALID');return {model:clone(model),...diagnostic};
  }
  function hashValue(v,p){if(typeof v!=='string'||! /^[a-f0-9]{64}$/.test(v))fail('GLOBAL_HASH_INVALID',p);}
  FC.globalDataContract={validate,validateBundle,capture,pack,unpack,canonical,sha,encode,fail,clone,id,hashValue,shape,integer,schemas,sources,single,dictionary,MAX_RECORD_BYTES,MAX_DIRECTORY_BYTES,MAX_RECORDS,MAX_TOTAL_BYTES};
})();
