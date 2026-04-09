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

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('qs_' + Date.now()); }
    catch(_){ return 'qs_' + Date.now(); }
  }

  function normalizeSnapshot(snapshot){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const now = Date.now();
    const generatedAt = Number(src.generatedAt) > 0 ? Number(src.generatedAt) : now;
    const investor = src.investor && typeof src.investor === 'object' ? clone(src.investor) : null;
    const project = src.project && typeof src.project === 'object' ? clone(src.project) : null;
    return Object.assign({}, clone(src), {
      id: String(src.id || uid()),
      generatedAt,
      generatedDate: (()=>{ try{ return new Date(generatedAt).toISOString(); }catch(_){ return ''; } })(),
      investor,
      project,
      meta: Object.assign({}, src.meta || {}, {
        source:String(src.meta && src.meta.source || 'quote-snapshot-store'),
        selectedByClient: !!(src.meta && src.meta.selectedByClient),
        acceptedAt: Number(src.meta && src.meta.acceptedAt) > 0 ? Number(src.meta.acceptedAt) : 0,
      }),
    });
  }

  function readAll(){
    const rows = storage.getJSON(SNAPSHOT_KEY, []);
    return Array.isArray(rows) ? rows.map(normalizeSnapshot) : [];
  }

  function writeAll(list){
    const rows = Array.isArray(list) ? list.map(normalizeSnapshot) : [];
    storage.setJSON(SNAPSHOT_KEY, rows);
    return rows;
  }

  function save(snapshot){
    const normalized = normalizeSnapshot(snapshot);
    const list = readAll();
    list.unshift(normalized);
    const trimmed = list.slice(0, 50);
    writeAll(trimmed);
    return normalized;
  }


  function getById(id){
    const key = String(id || '');
    if(!key) return null;
    return readAll().find((row)=> String(row && row.id || '') === key) || null;
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

  function markSelectedForProject(projectId, snapshotId){
    const pid = String(projectId || '');
    const sid = String(snapshotId || '');
    if(!pid || !sid) return null;
    const list = readAll();
    let selected = null;
    const acceptedAt = Date.now();
    list.forEach((row)=> {
      if(String(row && row.project && row.project.id || '') !== pid) return;
      const isTarget = String(row && row.id || '') === sid;
      row.meta = Object.assign({}, row && row.meta || {}, {
        selectedByClient: isTarget,
        acceptedAt: isTarget ? acceptedAt : 0,
      });
      if(isTarget){
        row.project = Object.assign({}, row && row.project || {}, { status:'zaakceptowany' });
        selected = normalizeSnapshot(row);
      }
    });
    writeAll(list);
    return selected ? getById(selected.id) : null;
  }

  function getSelectedForProject(projectId){
    const pid = String(projectId || '');
    if(!pid) return null;
    return listForProject(pid).find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
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

  FC.quoteSnapshotStore = {
    SNAPSHOT_KEY,
    normalizeSnapshot,
    readAll,
    writeAll,
    getById,
    save,
    remove,
    markSelectedForProject,
    listForProject,
    listForInvestor,
    getLatestForProject,
    getSelectedForProject,
  };
})();
