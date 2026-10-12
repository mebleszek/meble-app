// C2.0b: recoverable room-management and offer-status writes, inside the canonical record.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const FIELD = 'pendingDomainOperation';
  const clone = value=>JSON.parse(JSON.stringify(value));
  const same = (a,b)=>JSON.stringify(a) === JSON.stringify(b);
  const own = (value,key)=>Object.prototype.hasOwnProperty.call(value || {},key);
  let running = false;

  function problem(reason, partial){
    try{ if(FC.infoBox && FC.infoBox.open) FC.infoBox.open({ title:'Operacja projektu wymaga dokończenia',
      message:partial ? 'Nie potwierdzono zakończenia operacji. Zapisano jej trwałą intencję; część danych mogła już zostać utrwalona. Ponów operację lub odśwież aplikację. Nowsze dane nie zostaną nadpisane.'
        : 'Nie zapisano zmian. Zakończ edycję lub usuń przyczynę błędu i spróbuj ponownie. Formularz pozostaje otwarty.', okOnly:true }); }catch(_){ }
    return { ok:false, partial:!!partial, reason };
  }
  function readRows(key){
    const raw = localStorage.getItem(key);
    const rows = raw === null ? [] : JSON.parse(raw);
    if(!Array.isArray(rows) || rows.some(row=>!row || !row.id) || new Set(rows.map(row=>String(row.id))).size !== rows.length) throw Error('Invalid records: '+key);
    return { raw, rows };
  }
  function writeRows(key, rows, observed){
    if(localStorage.getItem(key) !== observed) return false;
    if(!(FC.storage && FC.storage.setJSON) || FC.storage.setJSON(key,rows) === false) return false;
    return localStorage.getItem(key) === JSON.stringify(rows);
  }
  function rowChanges(before,after){
    const changes = [];
    for(const id of new Set([...before,...after].map(row=>String(row.id)))){
      const a = before.find(row=>String(row.id) === id) || null;
      const b = after.find(row=>String(row.id) === id) || null;
      if(!same(a,b)) changes.push({ id, before:clone(a), after:clone(b) });
    }
    return changes;
  }
  function mergeRows(rows, changes){
    const next = clone(rows);
    for(const change of changes){
      const index = next.findIndex(row=>String(row.id) === change.id);
      const current = index < 0 ? null : next[index];
      if(same(current,change.after)) continue;
      if(!same(current,change.before)) throw Error('Conflicting record '+change.id);
      if(change.after === null){ if(index >= 0) next.splice(index,1); }
      else if(index < 0) next.push(clone(change.after));
      else next[index] = clone(change.after);
    }
    return next;
  }
  function publish(record){
    if(FC.projectStore.getCurrentProjectId() !== record.id || (FC.session && FC.session.active)) return;
    const data = FC.project.normalize ? FC.project.normalize(record.projectData) : clone(record.projectData);
    if(typeof projectData !== 'undefined') projectData = data;
    window.projectData = data;
    try{ if(FC.roomRegistryDefinitions) FC.roomRegistryDefinitions.invalidateCache(); }catch(_){ }
  }
  function hasPending(id){
    try{ const record = FC.projectStore.getById(id); return !!(record && record.meta && record.meta[FIELD]); }
    catch(_){ return true; }
  }
  function validate(record, op){
    if(!op || op.version !== 1 || !['rooms','offerStatus'].includes(op.kind)
      || op.projectId !== record.id || op.investorId !== record.investorId
      || !Array.isArray(op.mirrorChanges) || !Array.isArray(op.historyChanges)) throw Error('Invalid pending operation');
    const changes = op.historyChanges.concat(op.mirrorChanges);
    if(changes.some(change=>!change || !String(change.id || '')
      || (change.before && String(change.before.id) !== change.id) || (change.after && String(change.after.id) !== change.id))) throw Error('Invalid change identity');
    if(new Set(op.mirrorChanges.map(change=>change.id)).size !== op.mirrorChanges.length
      || new Set(op.historyChanges.map(change=>change.id)).size !== op.historyChanges.length) throw Error('Duplicate changes');
    if(op.kind === 'rooms' && op.historyChanges.length) throw Error('Room operation cannot alter history');
    if(op.kind === 'offerStatus' && (!Array.isArray(op.statusChanges) || !op.statusChanges.length)) throw Error('Missing status scope');
    if(op.historyChanges.some(change=>!change.before || !change.after
      || String(change.before.project && change.before.project.id) !== record.id
      || String(change.after.project && change.after.project.id) !== record.id)) throw Error('Invalid offer owner');
    // Acceptance may update selection/stage metadata, never archived calculation or scope.
    const immutable = row=>{
      const value = clone(row);
      if(value.project) delete value.project.status;
      if(value.meta) for(const field of ['versionName','preliminary','selectedByClient','acceptedAt','acceptedStage','rejectedAt','rejectedReason']) delete value.meta[field];
      if(op.result && op.result.promoted && value.commercial){delete value.commercial.preliminary;delete value.commercial.versionName;}
      return value;
    };
    if(op.historyChanges.some(change=>!same(immutable(change.before),immutable(change.after)))) throw Error('Archived offer content changed');
  }
  function roomShape(data){
    const roomIds = FC.projectModel.summarizeProjectData(data).roomKeys.slice().sort();
    return {roomIds,roomDefs:data.meta && data.meta.roomDefs || {},roomOrder:data.meta && data.meta.roomOrder || []};
  }
  function applyStatus(record, op){
    const next = clone(record);
    const data = next.projectData, meta = data.meta || (data.meta = {});
    const defs = meta.roomDefs || (meta.roomDefs = {});
    for(const change of op.statusChanges || []){
      if(!own(data,change.id)) throw Error('Status room no longer exists');
      if(!defs[change.id]) defs[change.id] = {id:change.id};
      const current = { projectStatus:defs[change.id].projectStatus || '', lastManualProjectStatus:defs[change.id].lastManualProjectStatus || '' };
      if(!same(current,change.before) && !same(current,change.after)) throw Error('Conflicting room status');
      Object.assign(defs[change.id],change.after);
    }
    if(next.status !== op.beforeStatus && next.status !== op.afterStatus) throw Error('Conflicting aggregate status');
    if((meta.projectStatus || '') !== op.beforeMetaStatus && (meta.projectStatus || '') !== op.afterStatus) throw Error('Conflicting aggregate metadata');
    next.status = op.afterStatus; meta.projectStatus = op.afterStatus;
    return next;
  }
  function recoverProject(id){
    if(running) return problem('operation-busy',true);
    const record = FC.projectStore && FC.projectStore.getById(id);
    if(!record) return problem('missing-project',false);
    const op = record.meta && record.meta[FIELD];
    if(!op) return { ok:true, project:record.projectData, projectRecord:record };
    if(FC.session && FC.session.active) return problem('active-session',true);
    running = true;
    try{
      validate(record,op);
      // Preflight all remaining targets before performing a write. No destructive compensation.
      const history = readRows('fc_quote_snapshots_v1');
      const desiredHistory = mergeRows(history.rows,op.historyChanges);
      const investors = readRows('fc_investors_v1');
      const investorIndex = investors.rows.findIndex(row=>String(row.id) === op.investorId);
      if(investorIndex < 0) throw Error('Missing investor');
      const rooms = investors.rows[investorIndex].rooms || [];
      mergeRows(rooms,op.mirrorChanges);
      let fresh = record;
      if(op.kind === 'offerStatus') applyStatus(fresh,op);
      else if(!same(roomShape(fresh.projectData),op.roomShape)) throw Error('Room structure changed after partial save');
      if(!same(history.rows,desiredHistory) && !writeRows('fc_quote_snapshots_v1',desiredHistory,history.raw)) return problem('history-write',true);
      if(op.kind === 'offerStatus'){
        const latest = FC.projectStore.getById(id);
        if(!same(latest, fresh)) throw Error('Project changed during status write');
        const next = applyStatus(fresh,op);
        if(!same(next,fresh)){
          fresh = FC.projectStore.updateRecordConfirmed(next,fresh);
          if(!fresh) return problem('status-write',true);
        }
      }
      // Reread investor data and merge only changed room entries; contacts and other projects survive.
      const latestInvestors = readRows('fc_investors_v1');
      const index = latestInvestors.rows.findIndex(row=>String(row.id) === op.investorId);
      if(index < 0) throw Error('Investor removed');
      const nextRooms = mergeRows(latestInvestors.rows[index].rooms || [],op.mirrorChanges);
      if(!same(latestInvestors.rows[index].rooms || [],nextRooms)){
        latestInvestors.rows[index].rooms = nextRooms;
        if(!writeRows('fc_investors_v1',latestInvestors.rows,latestInvestors.raw)) return problem('investor-mirror-write',true);
      }
      const latest = FC.projectStore.getById(id);
      if(!same(latest,fresh)) throw Error('Project changed before completion');
      const completed = clone(latest); delete completed.meta[FIELD];
      const saved = FC.projectStore.updateRecordConfirmed(completed,latest);
      if(!saved) return problem('intent-cleanup-write',true);
      publish(saved);
      const result = Object.assign({},op.result || {},{ ok:true, project:saved.projectData, projectRecord:saved, recovered:true });
      if(op.kind === 'offerStatus'){
        const snapshot = op.result && op.result.snapshotId && FC.quoteSnapshotStore.getById(op.result.snapshotId);
        if(snapshot){ result.snapshot = snapshot; result.selectedSnapshot = snapshot; if(op.result.promoted) result.convertedSnapshot = snapshot; }
        result.investor = FC.investors.getById(op.investorId);
      }
      return result;
    }catch(_){ return problem('conflict-or-invalid-data',true); }
    finally{ running = false; }
  }
  function start(record, spec){
    if(FC.session && FC.session.active) return problem('active-session',false);
    if(record.meta && record.meta[FIELD]) return problem('pending-operation',true);
    if(FC.projectStore.getCurrentProjectId() === record.id && FC.sessionNavigation && FC.sessionNavigation.needsClosure()) return problem('untracked-ram-edit',false);
    try{
      const op = Object.assign({ version:1, id:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),
        projectId:record.id, investorId:record.investorId, historyChanges:[], mirrorChanges:[] },clone(spec));
      const next = clone(record); next.meta = Object.assign({},next.meta,{ [FIELD]:op });
      if(op.kind === 'rooms'){
        next.projectData = clone(op.afterData);
        op.roomShape = roomShape(next.projectData);
        delete op.afterData;
        Object.assign(next,FC.projectModel.summarizeProjectData(next.projectData));
      }
      validate(next,op);
      const saved = FC.projectStore.updateRecordConfirmed(next,record);
      if(!saved) return problem('intent-or-project-write',hasPending(record.id));
      return recoverProject(record.id);
    }catch(_){ return problem('invalid-operation',false); }
  }
  function recoverAll(){
    try{ return FC.projectStore.readAll().filter(record=>record.meta && record.meta[FIELD]).map(record=>recoverProject(record.id)); }
    catch(_){ return [problem('recovery-read',true)]; }
  }
  FC.projectDomainOperations = { start, recoverProject, recoverAll, hasPending, rowChanges, readHistory:()=>readRows('fc_quote_snapshots_v1').rows };
  if(typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded',()=>recoverAll());
})();
