// Explicit project-mode calculation only. Legacy UI continues using its original stores.
(function(){
  'use strict';
  window.FC=window.FC||{};
  const FC=window.FC,clone=value=>JSON.parse(JSON.stringify(value));
  const validEdges=edges=>edges && Object.keys(edges).length===4 && ['w1','w2','h1','h2'].every(key=>typeof edges[key]==='boolean');
  const bits=edges=>['w1','w2','h1','h2'].map(key=>edges[key]?'1':'0').join('');
  function error(code,details){
    const result=new Error('Nie można potwierdzić projektowego PCV: '+code);
    result.code='PROJECT_PCV_'+code;result.projectPcv=true;result.details=details||{};return result;
  }
  const fail=(code,details)=>{throw error(code,details);};
  function address(source,group){
    const out=clone(source);if(group)delete out.qty;return out;
  }
  function collect(rooms,options){
    try{return FC.projectPcvOverrides.withCalculationRead(()=>collectCurrent(rooms,options));}
    catch(reason){return {ok:false,code:reason.code||'PROJECT_PCV_READ_FAILED',details:reason.details||{}};}
  }
  function collectCurrent(rooms,options){
    try{
      const opts=options||{},projectId=opts.projectId,api=FC.projectPcvOverrides;
      if(!api || !FC.cabinetCutlist || !FC.materialTabData)fail('DEPENDENCIES_UNAVAILABLE');
      if(!Array.isArray(rooms)||!rooms.length)fail('ROOM_SCOPE_REQUIRED');
      const ids=Array.from(new Set(rooms));
      for(const room of ids){const proof=api.inspectRoom(projectId,room);if(proof.ok!==true)fail(proof.code,{roomId:room});}
      const project=window.projectData,record=FC.projectStore.getById(projectId),revision=JSON.stringify(record);
      const scope=FC.materialTabData.normalizeMaterialScope(opts.materialScope);
      const details=[],individuals=new Set(),memo=new Map(),split={body:0,front:0,total:0};
      for(const roomId of ids){
        const cabinets=project[roomId].cabinets;
        if(!Array.isArray(cabinets) || new Set(cabinets.map(c=>c&&c.id)).size!==cabinets.length)fail('CABINET_OWNER_AMBIGUOUS',{roomId});
        for(const [index,cabinet] of cabinets.entries()){
          const generated=FC.cabinetCutlist.getCabinetCutList(cabinet,roomId,{projectId});
          const parts=[],cabSplit={body:0,front:0,total:0,mode:FC.materialEdgeStore.getCabinetPcvMode(cabinet)};
          for(const original of generated){
            if(!FC.materialTabData.partMatchesScope(original,scope,FC.materialEdgeStore))continue;
            if((original.sourceGroups||[]).some(g=>g.ownerType==='set')){
              const modes=new Set(cabinets.filter(c=>c.setId===cabinet.setId).map(c=>FC.materialEdgeStore.getCabinetPcvMode(c)));
              if(modes.size>1)fail('SET_PCV_MODE_AMBIGUOUS',{roomId,setId:cabinet.setId});
            }
            const a=Number(original.a),b=Number(original.b),qty=Number(original.qty);
            // Hardware annotations have no rectangular geometry and carry no PCV.
            if(a===0 && b===0){parts.push(clone(original));continue;}
            if(![a,b,qty].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(qty))fail('INVALID_GEOMETRY',{roomId,cabinetId:cabinet.id});
            const refs=original.sourceRefs,groups=original.sourceGroups,issues=original.sourceIssues;
            if(!Array.isArray(refs)||!Array.isArray(groups)||!Array.isArray(issues))fail('SOURCE_METADATA_REQUIRED');
            if(issues.length)fail('SOURCE_UNRESOLVED',{roomId,cabinetId:cabinet.id,issues:clone(issues)});
            if(groups.some(g=>!Number.isInteger(g.qty)||g.qty<=0)||refs.length+groups.reduce((n,g)=>n+g.qty,0)!==qty)fail('QUANTITY_MISMATCH');
            const buckets=new Map();
            for(const [source,count,isGroup] of refs.map(ref=>[ref,1,false]).concat(groups.map(group=>[group,group.qty,true]))){
              const target=address(source,isGroup);
              if(target.projectId!==projectId || target.roomId!==roomId)fail('SOURCE_CONTEXT_MISMATCH');
              if(isGroup && target.ownerType==='set'){
                if(target.setId!==String(cabinet.setId||''))fail('SOURCE_CONTEXT_MISMATCH');
              }else if(target.cabinetId!==String(cabinet.id||''))fail('SOURCE_CONTEXT_MISMATCH');
              const key=JSON.stringify(target);
              if(!isGroup){if(individuals.has(key))fail('DUPLICATE_INDIVIDUAL');individuals.add(key);}
              if(!memo.has(key))memo.set(key,api.getForCalculation(target));
              const resolved=memo.get(key);
              if(resolved.ok!==true)fail(resolved.code,{address:target});
              const mode=cabSplit.mode,edges=resolved.edges;
              const meters=FC.materialEdgeStore.edgingMetersForPart({a,b,qty:count},edges);
              const contribution={address:target,qty:count,aCm:a,bCm:b,edges:clone(edges),mode,meters,source:resolved.source};
              const bucketKey=mode+':'+bits(edges);
              let row=buckets.get(bucketKey);
              if(!row){
                row=Object.assign({},clone(original),{qty:0,sourceRefs:[],sourceGroups:[],sourceIssues:[],
                  effectivePcv:{projectId,key:bucketKey,edges:clone(edges),body:0,front:0,total:0,contributions:[]}});
                delete row.partRoleIds;delete row.sourceGroupRoles;
                buckets.set(bucketKey,row);
              }
              row.qty+=count;
              row[isGroup?'sourceGroups':'sourceRefs'].push(clone(source));
              row.effectivePcv.contributions.push(contribution);row.effectivePcv[mode]+=meters;row.effectivePcv.total+=meters;
              cabSplit[mode]+=meters;cabSplit.total+=meters;
            }
            parts.push(...buckets.values());
          }
          split.body+=cabSplit.body;split.front+=cabSplit.front;split.total+=cabSplit.total;
          details.push({room:roomId,cabinet:clone(cabinet),index,parts,edgeMeters:cabSplit.total,edgeMetersByMode:cabSplit});
        }
      }
      for(const room of ids){const proof=api.inspectRoom(projectId,room);if(proof.ok!==true)fail(proof.code,{roomId:room});}
      if(window.projectData!==project || JSON.stringify(FC.projectStore.getById(projectId))!==revision)fail('READ_CONFLICT');
      return {ok:true,pcvMode:'project',projectId,revision,rooms:ids,materialScope:scope,details,edgeMeters:split.total,edgeMetersByMode:split};
    }catch(reason){return {ok:false,code:reason.code||'PROJECT_PCV_READ_FAILED',details:reason.details||{}};}
  }
  function requireCollection(rooms,options){
    const result=collect(rooms,options);
    if(result.ok!==true)throw Object.assign(new Error('Nie można potwierdzić projektowego PCV.'),{code:result.code,projectPcv:true,details:result.details});
    return result;
  }
  function copy(part){return part&&part.effectivePcv?{effectivePcv:clone(part.effectivePcv)}:{};}
  function merge(target,part){
    if(!part.effectivePcv)return;
    if(!target.effectivePcv){target.effectivePcv=clone(part.effectivePcv);return;}
    for(const key of ['body','front','total'])target.effectivePcv[key]+=part.effectivePcv[key];
    target.effectivePcv.contributions.push(...clone(part.effectivePcv.contributions));
  }
  function ledger(parts){
    return (parts||[]).flatMap(p=>p.effectivePcv?p.effectivePcv.contributions:[]).map(c=>JSON.stringify(c)).sort();
  }
  function planKey(part){
    return part.sourceSig+'||'+part.grainMode+'||'+part.w+'x'+part.h+'||pcv:'+part.effectivePcv.projectId+':'+part.effectivePcv.key;
  }
  function withQuantity(part, offset){
    const row=clone(part),pcv=row.effectivePcv;
    if(!pcv || !Array.isArray(pcv.contributions))fail('PLAN_CONTEXT_MISMATCH');
    const total=pcv.contributions.reduce((n,c)=>n+c.qty,0);
    let skip=offset && typeof offset === 'object' ? offset.skip : total-row.qty;
    if(!Number.isInteger(row.qty)||row.qty<=0||!Number.isInteger(skip)||skip<0||skip+row.qty>total)fail('QUANTITY_MISMATCH');
    if(skip===0 && row.qty===total)return row;
    let remaining=row.qty;
    const kept=[];
    for(const c of pcv.contributions){
      const drop=Math.min(skip,c.qty);skip-=drop;c.qty=Math.min(c.qty-drop,remaining);remaining-=c.qty;
      if(c.qty){c.meters=FC.materialEdgeStore.edgingMetersForPart({a:c.aCm,b:c.bCm,qty:c.qty},c.edges);kept.push(c);}
    }
    pcv.contributions=kept;pcv.body=0;pcv.front=0;pcv.total=0;row.sourceRefs=[];row.sourceGroups=[];
    for(const c of kept){
      pcv[c.mode]+=c.meters;pcv.total+=c.meters;
      if(c.address.partRoleId)row.sourceRefs.push(clone(c.address));
      else row.sourceGroups.push(Object.assign({},clone(c.address),{qty:c.qty}));
    }
    return row;
  }
  function validatePlanParts(parts,options){
    return FC.projectPcvOverrides.withCalculationRead(()=>validateCurrentParts(parts,options));
  }
  function validateCurrentParts(parts,options){
    const memo=new Map(),used=new Map();
    const ram=window.projectData,revision=JSON.stringify(FC.projectStore.getById(options.projectId));
    if(!Array.isArray(parts)||!parts.length)fail('PART_SCOPE_REQUIRED');
    for(const part of parts){
      const pcv=part.effectivePcv;
      if(!pcv||pcv.projectId!==options.projectId||!Array.isArray(pcv.contributions)||!pcv.contributions.length)fail('PLAN_CONTEXT_MISMATCH');
      if(!validEdges(pcv.edges))fail('INVALID_EDGES');
      if((part.sourceIssues||[]).length)fail('SOURCE_UNRESOLVED');
      if(pcv.contributions.reduce((n,c)=>n+c.qty,0)!==part.qty || (part.sourceRefs||[]).length+(part.sourceGroups||[]).reduce((n,g)=>n+g.qty,0)!==part.qty)fail('QUANTITY_MISMATCH');
      const ownership=list=>list.map(item=>JSON.stringify([item.address.projectId,item.address.roomId,item.address.ownerType||'part',item.address.cabinetId||item.address.setId,item.address.partRoleId||item.address.groupRoleId,item.qty])).sort();
      const declared=(part.sourceRefs||[]).map(ref=>({address:ref,qty:1})).concat((part.sourceGroups||[]).map(g=>({address:address(g,true),qty:g.qty})));
      if(JSON.stringify(ownership(declared))!==JSON.stringify(ownership(pcv.contributions)))fail('SOURCE_CONTEXT_MISMATCH');
      for(const c of pcv.contributions){
        if(!Number.isInteger(c.qty)||c.qty<=0||c.address.projectId!==options.projectId)fail('PLAN_CONTEXT_MISMATCH');
        if(!validEdges(c.edges))fail('INVALID_EDGES');
        const key=JSON.stringify(c.address);
        if(!memo.has(key))memo.set(key,FC.projectPcvOverrides.getForCalculation(c.address));
        const resolved=memo.get(key);
        if(resolved.ok!==true)fail(resolved.code,{address:c.address});
        const geometry=resolved.geometries.filter(g=>g.aCm===c.aCm&&g.bCm===c.bCm&&g.material===part.material&&g.mode===c.mode);
        if(!geometry.length)fail('STALE_GEOMETRY');
        const quantityKey=key+'|'+c.aCm+'|'+c.bCm+'|'+c.mode;
        used.set(quantityKey,(used.get(quantityKey)||0)+c.qty);
        if(used.get(quantityKey)>geometry.reduce((n,g)=>n+g.qty,0))fail('QUANTITY_MISMATCH');
        const meters=FC.materialEdgeStore.edgingMetersForPart({a:c.aCm,b:c.bCm,qty:c.qty},resolved.edges);
        if(!Number.isFinite(c.meters)||Math.abs(meters-c.meters)>1e-9)fail('METERS_MISMATCH');
        if(bits(resolved.edges)!==bits(c.edges)||bits(pcv.edges)!==bits(c.edges)||pcv.key!==c.mode+':'+bits(c.edges))fail('STALE_EDGES');
        const w=Math.round(c.aCm*10),h=Math.round(c.bCm*10),vertical=part.grainMode==='vertical';
        if(part.w!==(vertical?h:w)||part.h!==(vertical?w:h))fail('GEOMETRY_MISMATCH');
      }
    }
    if(window.projectData!==ram || JSON.stringify(FC.projectStore.getById(options.projectId))!==revision)fail('READ_CONFLICT');
    return true;
  }
  function validateAggregate(aggregate,options){
    if(!aggregate || aggregate.pcvMode!=='project' || aggregate.projectId!==options.projectId)fail('AGGREGATE_CONTEXT_MISMATCH');
    const current=requireCollection(aggregate.selectedRooms,options);
    if(current.revision!==aggregate.projectPcvRevision)fail('STALE_AGGREGATE');
    const expected=ledger(current.details.flatMap(d=>d.parts));
    const selected=[];
    for(const material of FC.wycenaCoreSource.getScopedMaterials(aggregate,{materialScope:current.materialScope})){
      selected.push(...FC.rozrysScope.getGroupPartsForScope(aggregate.groups[material],current.materialScope));
    }
    if(selected.length)validatePlanParts(selected,options);
    if(JSON.stringify(ledger(selected))!==JSON.stringify(expected))fail('AGGREGATE_QUANTITY_MISMATCH');
    return current;
  }

  // Attach source metadata after packing; never change placement geometry or rotation.
  function attachPlanProvenance(plan,parts,options){
    validatePlanParts(parts,options);
    const rows=new Map(),used=new Map(),out=clone(plan || {sheets:[]});
    for(const row of parts){
      const key=planKey(row),existing=rows.get(key);
      if(existing){existing.qty+=row.qty;FC.partProvenance.merge(existing,row);}
      else rows.set(key,clone(row));
    }
    for(const sheet of out.sheets || [])for(const placement of sheet.placements || []){
      if(placement.unplaced)continue;
      const row=rows.get(placement.key),index=used.get(placement.key)||0;
      if(!row || index>=row.qty)fail('PLACEMENT_QUANTITY_MISMATCH');
      used.set(placement.key,index+1);
      // Repacking after stock starts item numbering again; identifiers must be unique in the combined plan.
      placement.id=placement.key+'#'+(index+1);
      const piece=withQuantity(Object.assign({},row,{qty:1}),{skip:index});
      const original=row.effectivePcv.edges;
      const swap=edges=>({w1:edges.h1,w2:edges.h2,h1:edges.w1,h2:edges.w2});
      const displayed=row.grainMode==='vertical' ? swap(original) : original;
      const edges=placement.rotated ? swap(displayed) : displayed;
      if(['w1','w2','h1','h2'].some(key=>placement['edge'+key.toUpperCase()]!==edges[key]))fail('PLACEMENT_EDGES_MISMATCH');
      Object.assign(placement,{sourceRefs:clone(piece.sourceRefs),sourceGroups:clone(piece.sourceGroups),sourceIssues:[],effectivePcv:clone(piece.effectivePcv)});
    }
    if(options.complete && (out.cancelled || out.workerFailed || Array.from(rows.entries()).some(([key,row])=>(used.get(key)||0)!==row.qty)))fail('INCOMPLETE_PLAN');
    return out;
  }

  // Proofs live only for new candidates in this process; history never needs them.
  const quoteProofs=new Map();let quoteProofSequence=0;
  const candidateMode=value=>!!value && (value.pcvMode==='project' || value.__projectPcvCandidate!==undefined);
  const roomSet=rooms=>JSON.stringify((rooms||[]).slice().sort());
  const candidateScope=value=>({rooms:value.selectedRooms || value.scope && value.scope.selectedRooms,
    materialScope:FC.materialTabData.normalizeMaterialScope(value.materialScope || value.scope && value.scope.materialScope)});
  function materialSignature(value){
    const rows=value.materialLines || value.lines && value.lines.materials || [];
    return JSON.stringify(rows.map(row=>[String(row.key||''),String(row.name||''),Number(row.qty)||0,String(row.unit||''),Number(row.unitPrice)||0,Number(row.total)||0]));
  }
  function draftSelection(){
    const api=FC.wycenaCoreOffer,selection=FC.wycenaCoreSelection;
    const draft=api && api.getOfferDraft && api.getOfferDraft();
    return draft && draft.selection && selection ? JSON.stringify(selection.normalizeQuoteSelection(draft.selection)) : null;
  }
  function registerQuoteCalculation(value,aggregate,options,initialDraft){
    const current=validateAggregate(aggregate,options),record=FC.projectStore.getById(options.projectId);
    const token=String(Date.now())+':'+(++quoteProofSequence);
    quoteProofs.set(token,{projectId:options.projectId,investorId:String(record.investorId),revision:current.revision,
      rooms:roomSet(aggregate.selectedRooms),materialScope:JSON.stringify(current.materialScope),draft:initialDraft,
      materials:materialSignature(value)});
    while(quoteProofs.size>64)quoteProofs.delete(quoteProofs.keys().next().value);
    value.pcvMode='project';value.projectId=options.projectId;value.__projectPcvCandidate=token;
    validateQuoteCandidate(value);return value;
  }
  function validateQuoteCandidate(value,selection){
    if(!candidateMode(value))return true;
    const proof=quoteProofs.get(value.__projectPcvCandidate);
    if(!proof)fail('QUOTE_PROOF_REQUIRED');
    if((FC.session && FC.session.active) || (FC.sessionNavigation && !FC.sessionNavigation.canCalculate()))fail('ACTIVE_EDIT');
    const scope=candidateScope(value),id=value.project && value.project.id || value.projectId;
    if(id!==proof.projectId || (value.project && String(value.project.investorId)!==proof.investorId)
      || (value.investor && String(value.investor.id)!==proof.investorId)
      || roomSet(scope.rooms)!==proof.rooms || JSON.stringify(scope.materialScope)!==proof.materialScope
      || materialSignature(value)!==proof.materials || draftSelection()!==proof.draft)fail('QUOTE_CONTEXT_CHANGED');
    if(selection){const selected=FC.wycenaCoreSelection.normalizeQuoteSelection(selection);
      if(roomSet(selected.selectedRooms)!==proof.rooms || JSON.stringify(FC.materialTabData.normalizeMaterialScope(selected.materialScope))!==proof.materialScope)fail('QUOTE_CONTEXT_CHANGED');}
    const current=requireCollection(scope.rooms,{pcvMode:'project',projectId:proof.projectId,materialScope:scope.materialScope});
    if(current.revision!==proof.revision)fail('STALE_QUOTE');
    return true;
  }
  function carryQuoteProof(source,target){
    if(!candidateMode(source))return target;
    target.pcvMode='project';target.projectId=source.projectId;target.__projectPcvCandidate=source.__projectPcvCandidate;
    return target;
  }
  function stripQuoteProof(value){
    const out=clone(value);delete out.pcvMode;delete out.projectId;delete out.__projectPcvCandidate;return out;
  }

  FC.projectPcvResolver={collect,requireCollection,copy,merge,validateAggregate,validatePlanParts,planKey,withQuantity,error,attachPlanProvenance,registerQuoteCalculation,validateQuoteCandidate,carryQuoteProof,stripQuoteProof,draftSelection};
})();
