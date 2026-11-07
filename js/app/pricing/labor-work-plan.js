// One read-only work plan for room activities, quote costs and sequential workdays.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const n=v=>Math.max(0,Number(v)||0);
  const scope=d=>['room','quote','day'].includes(d?.billingScope)?d.billingScope:'standard';
  const stage=d=>d.rateType==='assembly'?'assembly':'workshop';
  function fail(code){const e=Error(code);e.code=code;throw e;}
  function rowFor(def,quantity,volumeM3,rates,rooms,key){
    const calc=FC.laborCatalog.calculateDefinition(def,{quantity,volumeM3,hourlyRates:rates});
    return {...clone(def),key,laborDefinitionId:def.id,billingScope:scope(def),dailyStages:def.dailyStages||'both',qty:quantity,quantity,volumeM3,
      hours:n(calc.pricedHours),baseHours:n(calc.quantityHours),volumeHours:n(calc.volumeHours),
      multiplier:n(calc.multiplier)||1,hourlyRate:n(calc.hourlyRate),total:n(calc.total),
      unit:'x',unitPrice:quantity>0?n(calc.total)/quantity:0,rooms:rooms.join(', '),contributingRooms:rooms,
      sourceId:def.id,sourceType:'scoped-labor',sourceKind:'automatic',sourceRole:'scoped-labor',
      quantitySourceValue:quantity,quantitySourceUsed:!!def.quantitySource,
      note:'Zakres: '+scope(def)+'. Pomieszczenia: '+rooms.join(', ')};
  }
  function flatten(collections){
    return Object.values(collections).flatMap(rows=>(rows||[]).flatMap(parent=>
      (Array.isArray(parent.details)?parent.details:[parent]).map(row=>({row,parent,roomId:parent.roomId||row.roomId||''}))));
  }
  function trim(collections,defs){
    for(const rows of Object.values(collections))for(let i=rows.length-1;i>=0;i--){
      const parent=rows[i],keep=row=>['automatic-blocked','automatic-suppressed'].includes(row.sourceKind)||scope(defs.get(row.laborDefinitionId||row.laborCode))==='standard';
      if(Array.isArray(parent.details)){
        parent.details=parent.details.filter(keep);
        parent.total=parent.details.reduce((s,r)=>s+n(r.total),0);parent.unitPrice=parent.total;
        parent.hours=parent.details.reduce((s,r)=>s+n(r.hours),0);
        if(!parent.details.length)rows.splice(i,1);
      }else if(!keep(parent))rows.splice(i,1);
    }
  }
  function groupsFor(rooms,leaves,definitions,rates){
    const groups=new Map(),entries=FC.wycenaCoreLabor?.enumerateSelectedCabinets?.(rooms)||[];
    const add=(def,roomId,quantity,volume,conditions=[])=>{
      const key=def.id+':'+(scope(def)==='room'?roomId:'shared');
      if(!groups.has(key))groups.set(key,{def,quantity:0,volume:0,rooms:new Set(),conditions:[]});
      const g=groups.get(key);g.quantity+=quantity;g.volume+=volume;g.rooms.add(roomId);g.conditions.push(...conditions);
    };
    for(const {row,roomId} of leaves.slice().sort((a,b)=>String(a.row.key||a.roomId).localeCompare(String(b.row.key||b.roomId),'en'))){
      const def=definitions.get(row.laborDefinitionId||row.laborCode);
      if(!def||scope(def)==='standard'||['automatic-suppressed','automatic-blocked'].includes(row.sourceKind))continue;
      // Shared offer-level selections are already scoped to the selected quote, not an arbitrary first room.
      const targets=roomId?[roomId]:rooms.filter(room=>!def.conditions?.length||entries.some(e=>e.roomId===room&&FC.wycenaCoreLabor.evaluateConditions(def,e).matched));
      for(const room of targets)add(def,room,n(row.quantity??row.qty)/(roomId?1:Math.max(1,targets.length)),n(row.volumeM3)/(roomId?1:Math.max(1,targets.length)),row.matchedConditions||[]);
    }
    // Fixed/elapsed definitions without a quantity source are one event per scope.
    for(const def of definitions.values())if(scope(def)!=='standard'&&!def.quantitySource&&def.active!==false&&!def.isHourlyRate){
      for(const room of rooms){
        const candidates=entries.filter(e=>e.roomId===room);
        const matches=!def.conditions?.length||candidates.some(e=>FC.wycenaCoreLabor.evaluateConditions(def,e).matched);
        const key=def.id+':'+(scope(def)==='room'?room:'shared');
        if(matches&&!groups.get(key)?.rooms.has(room))add(def,room,1,0);
      }
    }
    return [...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,g])=>{
      const contributing=[...g.rooms].sort(),qty=g.def.quantitySource?g.quantity:1;
      const row=rowFor(g.def,qty,g.volume,rates,contributing,'scope:'+key);
      row.matchedConditions=clone(g.conditions);return row;
    });
  }
  function solve(time,daily,travel){
    if(![time,daily,travel].every(v=>Number.isFinite(v)&&v>=0))fail('SCHEDULE_INVALID_TIME');
    if(!(time>0))return {minutes:0,dailyMinutes:daily,travelMinutes:travel,availableMinutes:Math.max(0,480-daily-travel),days:0,totalMinutes:0};
    const available=480-daily-travel;
    if(!(available>0))fail('SCHEDULE_NONPOSITIVE_CAPACITY');
    const quotient=time/available,days=Math.ceil(quotient-Math.min(1e-10,quotient/2));
    if(!Number.isSafeInteger(days))fail('SCHEDULE_INVALID_TIME');
    return {minutes:time,dailyMinutes:daily,travelMinutes:travel,availableMinutes:available,days,totalMinutes:time+days*(daily+travel)};
  }
  function build({selectedRooms,collections,catalog,transport,helperHours=0}){
    const rooms=[...new Set(selectedRooms||[])].sort(),defs=new Map((catalog||[]).map(d=>[d.id,FC.laborCatalog.normalizeDefinition(d)]));
    const rates=FC.laborCatalog.buildHourlyRates([...defs.values()]),leaves=flatten(collections);
    for(const d of defs.values())if(scope(d)==='day'&&d.active!==false&&[d.quantitySource,...(d.conditions||[]).map(c=>c.source)].some(code=>/^(schedule|workday|work_plan|harmonogram)\./.test(code||'')))fail('SCHEDULE_CIRCULAR_SOURCE');
    const grouped=groupsFor(rooms,leaves,defs,rates),once=grouped.filter(r=>scope(r)!=='day'),daily=grouped.filter(r=>scope(r)==='day');
    if(daily.some(r=>r.quantitySource==='transport.duration_hours'))fail('SCHEDULE_TRAVEL_SCOPE_CONFLICT');
    // No day-dependent source may participate in the daily denominator.
    for(const row of daily)if([row.quantitySource,...(row.conditions||[]).map(c=>c.source)].some(code=>/^(schedule|workday|work_plan|harmonogram)\./.test(code||'')))fail('SCHEDULE_CIRCULAR_SOURCE');
    trim(collections,defs);
    const base=flatten(collections).map(x=>x.row).concat(once).filter(row=>!String(row.sourceType).startsWith('transport')&&!String(row.sourceRole).startsWith('transport-')&&!String(row.quantitySource).startsWith('transport.')&&row.rateType!=='helper');
    const minutes=kind=>base.filter(r=>stage(r)===kind).reduce((s,r)=>s+n(r.hours)*60,0);
    const applicable=(row,kind)=>row.dailyStages==='both'||row.dailyStages===kind;
    const perDay=kind=>daily.filter(r=>applicable(r,kind)).reduce((s,r)=>s+n(r.hours)*60,0);
    const schedule={version:1,status:'READY',order:['workshop','assembly'],dayMinutes:480,helperHours:n(helperHours),rates:clone(rates),dailyRules:daily.map(r=>({id:r.id,dailyStages:r.dailyStages,quantity:r.quantity,minutes:r.hours*60,cost:r.total,hourlyRate:r.hourlyRate,rateType:r.rateType,quantitySource:r.quantitySource,contributingRooms:r.contributingRooms})),warnings:[]};
    schedule.workshop=solve(minutes('workshop'),perDay('workshop'),0);
    const travel=transport?.transport,known=travel&&travel.durationMin!==''&&travel.durationMin!=null&&!transport.isStale;
    const travelMinutes=known?2*n(transport.durationMin):0;
    if(minutes('assembly')>0&&!known){schedule.status='BLOCKED';schedule.warnings.push('SCHEDULE_ROUTE_REQUIRED');schedule.assembly=null;}
    else schedule.assembly=solve(minutes('assembly'),perDay('assembly'),travelMinutes);
    const extras=once.slice();
    for(const kind of schedule.order){
      const days=schedule[kind]?.days||0;
      if(!days)continue;
      for(const row of daily.filter(r=>applicable(r,kind))){
        extras.push({...row,key:row.key+':'+kind,workStage:kind,occurrences:days,hours:row.hours*days,baseHours:row.baseHours*days,multiplier:row.multiplier*days,total:row.total*days,unitPrice:row.unitPrice*days,note:row.note+' • dni: '+days});
      }
    }
    const trips=schedule.assembly?.days||0;schedule.trips=trips;
    const quoteRates=collections.quoteRates||[];
    for(let i=quoteRates.length-1;i>=0;i--){const r=quoteRates[i];
      if(r.sourceType==='transport'||String(r.quantitySource).startsWith('transport.')){
        // Reuse existing per-trip price/start/included-km rules, but make time round-trip too.
        if(!trips){quoteRates.splice(i,1);continue;}
        const travelTime=r.sourceRole==='transport-travel-time'||r.quantitySource==='transport.duration_hours'||r.sourceId==='transport_travel_time';
        const factor=trips*(travelTime?2:1);
        r.total*=factor;r.hours=n(r.hours)*factor;r.baseHours=n(r.baseHours)*factor;
        if(!travelTime){r.startPrice=n(r.startPrice)*trips;r.includedQty=n(r.includedQty)*trips;r.billableQty=n(r.billableQty)*trips;}
        r.qty=n(r.qty)*factor;r.quantity=n(r.quantity)*factor;r.quantitySourceValue=n(r.quantitySourceValue)*factor;
        r.trips=trips;r.note=(r.note||'')+' • wyjazdy: '+trips+(r.sourceRole==='transport-travel-time'?' • tam i z powrotem':'');
        r.calculation='Cena = '+r.total+' zł; wyjazdy: '+trips;
      }
    }
    if(n(helperHours)>0)extras.push({key:'additional-third-person',name:'Dodatkowa trzecia osoba',category:'Pomocnik',qty:n(helperHours),quantity:n(helperHours),unit:'h',hours:0,helperHours:n(helperHours),rateType:'helper',hourlyRate:n(rates.helper),unitPrice:n(rates.helper),total:n(helperHours)*n(rates.helper),sourceType:'manual',sourceRole:'additional-helper',note:'Ręcznie wskazane godziny; bez zwiększania czasu ekipy.'});
    if(schedule.warnings.length)extras.push({key:'schedule-warning',name:'Harmonogram niekompletny',qty:0,total:0,hours:0,sourceKind:'automatic-blocked',warnings:schedule.warnings,note:'Brak aktualnego czasu trasy: nie naliczono niepotwierdzonych dni i kosztów montażowych.'});
    quoteRates.push(...extras);
    return {schedule,scoped:grouped};
  }
  function collect(selectedRooms,helperHours=0){
    const core=FC.wycenaCoreLabor,offer=FC.wycenaCoreOffer;
    const collections={labor:core.collectCabinetLabor(selectedRooms),project:core.collectProjectPreparationLines(selectedRooms),carrying:core.collectCarryingLines(selectedRooms),agdServices:FC.wycenaCoreLines?.collectBuiltInAppliances?.(selectedRooms)||[],quoteRates:offer.collectQuoteRateLines()};
    return {...build({selectedRooms,collections,catalog:FC.catalogSelectors.getQuoteRates(),transport:FC.investorTransport?.getCurrentTransportContext?.(),helperHours}),collections};
  }
  FC.laborWorkPlan={build,collect,solve,scope};
})();
