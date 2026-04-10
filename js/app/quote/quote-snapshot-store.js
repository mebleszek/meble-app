(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){}
  };

  const SNAPSHOT_KEY = keys.quoteSnapshots || 'fc_quote_snapshots_v1';
  const FINAL_STATUSES = new Set(['zaakceptowany','umowa','produkcja','montaz','zakonczone']);

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('qs_' + Date.now()); }
    catch(_){ return 'qs_' + Date.now(); }
  }

  function normalizeStatus(value){
    return String(value || '').trim().toLowerCase();
  }

  function isPreliminarySnapshot(snapshot){
    return !!(snapshot && ((snapshot.meta && snapshot.meta.preliminary) || (snapshot.commercial && snapshot.commercial.preliminary)));
  }

  function normalizeSnapshot(snapshot){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const preliminary = isPreliminarySnapshot(src);
    const acceptedStage = String(src.meta && src.meta.acceptedStage || (src.meta && src.meta.selectedByClient ? (preliminary ? 'pomiar' : 'zaakceptowany') : '') || '');
    return {
      id: String(src.id || uid()),
      generatedAt: Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now(),
      investor: src.investor ? clone(src.investor) : null,
      project: src.project ? clone(src.project) : null,
      scope: clone(src.scope || {}),
      catalogs: clone(src.catalogs || null),
      lines: clone(src.lines || {}),
      commercial: clone(src.commercial || {}),
      totals: clone(src.totals || {}),
      meta: {
        source:String(src.meta && src.meta.source || 'quote-snapshot-store'),
        selectedByClient: !!(src.meta && src.meta.selectedByClient),
        acceptedAt: Number(src.meta && src.meta.acceptedAt) > 0 ? Number(src.meta.acceptedAt) : 0,
        acceptedStage,
        preliminary,
      }
    };
  }

  function readAll(){
    const rows = storage.getJSON(SNAPSHOT_KEY, []);
    return Array.isArray(rows)
      ? rows.map((row)=> normalizeSnapshot(row)).sort((a,b)=> Number(b.generatedAt || 0) - Number(a.generatedAt || 0))
      : [];
  }

  function writeAll(list){
    const rows = Array.isArray(list) ? list.map((row)=> normalizeSnapshot(row)) : [];
    storage.setJSON(SNAPSHOT_KEY, rows);
    return rows;
  }

  function getById(id){
    const key = String(id || '');
    if(!key) return null;
    return readAll().find((row)=> String(row && row.id || '') === key) || null;
  }

  function save(snapshot){
    const normalized = normalizeSnapshot(snapshot);
    const list = readAll().filter((row)=> String(row.id || '') !== String(normalized.id || ''));
    list.unshift(normalized);
    writeAll(list.slice(0, 120));
    return normalized;
  }

  function remove(id){
    const key = String(id || '');
    if(!key) return false;
    const list = readAll();
    const next = list.filter((row)=> String(row && row.id || '') !== key);
    if(next.length === list.length) return false;
    writeAll(next);
    return true;
  }

  function listForProject(projectId){
    const key = String(projectId || '');
    if(!key) return [];
    return readAll().filter((row)=> String(row && row.project && row.project.id || '') === key);
  }

  function listForInvestor(investorId){
    const key = String(investorId || '');
    if(!key) return [];
    return readAll().filter((row)=> String(row && row.investor && row.investor.id || '') === key);
  }

  function getLatestForProject(projectId){
    return listForProject(projectId)[0] || null;
  }

  function getSelectedForProject(projectId){
    const pid = String(projectId || '');
    if(!pid) return null;
    return listForProject(pid).find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
  }

  function hasFinalQuote(projectId){
    return listForProject(projectId).some((row)=> !isPreliminarySnapshot(row));
  }

  function pickCandidate(projectRows, predicate){
    const rows = Array.isArray(projectRows) ? projectRows : [];
    return rows.find((row)=> !!(row && row.meta && row.meta.selectedByClient) && predicate(row))
      || rows.find((row)=> predicate(row))
      || null;
  }

  function updateSelectionForProject(projectId, chooser, projectStatus, acceptedStage){
    const pid = String(projectId || '');
    if(!pid) return null;
    const list = readAll();
    const projectRows = list.filter((row)=> String(row && row.project && row.project.id || '') === pid);
    const candidate = chooser(projectRows);
    const normalizedProjectStatus = normalizeStatus(projectStatus || (candidate ? (isPreliminarySnapshot(candidate) ? 'pomiar' : 'zaakceptowany') : ''));
    const normalizedAcceptedStage = normalizeStatus(acceptedStage || (candidate ? (isPreliminarySnapshot(candidate) ? 'pomiar' : 'zaakceptowany') : ''));
    const stamp = Date.now();
    list.forEach((row)=> {
      if(String(row && row.project && row.project.id || '') !== pid) return;
      const isTarget = !!(candidate && String(row && row.id || '') === String(candidate.id || ''));
      row.meta = Object.assign({}, row && row.meta || {}, {
        preliminary: isPreliminarySnapshot(row),
        selectedByClient: isTarget,
        acceptedAt: isTarget ? (Number(row && row.meta && row.meta.acceptedAt) > 0 ? Number(row.meta.acceptedAt) : stamp) : 0,
        acceptedStage: isTarget ? normalizedAcceptedStage : '',
      });
      row.project = Object.assign({}, row && row.project || {}, {
        status: normalizedProjectStatus || String(row && row.project && row.project.status || '')
      });
    });
    writeAll(list);
    return candidate ? getById(candidate.id) : null;
  }

  function markSelectedForProject(projectId, snapshotId, options){
    const pid = String(projectId || '');
    const sid = String(snapshotId || '');
    const explicit = normalizeStatus(options && options.status || '');
    return updateSelectionForProject(pid, (rows)=> rows.find((row)=> String(row && row.id || '') === sid) || null, explicit, explicit || 'zaakceptowany');
  }

  function syncSelectionForProjectStatus(projectId, status){
    const pid = String(projectId || '');
    const normalizedStatus = normalizeStatus(status);
    if(!pid) return null;
    if(normalizedStatus === 'pomiar'){
      return updateSelectionForProject(pid, (rows)=> pickCandidate(rows, (row)=> isPreliminarySnapshot(row)), 'pomiar', 'pomiar');
    }
    if(FINAL_STATUSES.has(normalizedStatus)){
      return updateSelectionForProject(pid, (rows)=> pickCandidate(rows, (row)=> !isPreliminarySnapshot(row)), normalizedStatus, 'zaakceptowany');
    }
    return updateSelectionForProject(pid, ()=> null, normalizedStatus, '');
  }

  FC.quoteSnapshotStore = {
    SNAPSHOT_KEY,
    normalizeSnapshot,
    readAll,
    writeAll,
    getById,
    save,
    remove,
    markSelectedForProject,
    syncSelectionForProjectStatus,
    listForProject,
    listForInvestor,
    getLatestForProject,
    getSelectedForProject,
    hasFinalQuote,
    isPreliminarySnapshot,
  };
})();
