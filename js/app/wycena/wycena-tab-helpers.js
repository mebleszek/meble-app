(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const STATUS_RANK = {
    nowy:0,
    wstepna_wycena:1,
    pomiar:2,
    wycena:3,
    zaakceptowany:4,
    umowa:5,
    produkcja:6,
    montaz:7,
    zakonczone:8,
    odrzucone:-1,
  };

  function money(v){ return `${(Number(v)||0).toFixed(2)} PLN`; }

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function buildRowMeta(row){
    const parts = [];
    const category = String(row && row.category || '').trim();
    const note = String(row && row.note || '').trim();
    const rooms = String(row && row.rooms || '').trim();
    if(category) parts.push(category);
    if(note && (!category || note !== category)) parts.push(note);
    if(rooms && (!note || rooms !== note)) parts.push(`Pomieszczenia: ${rooms}`);
    return parts.join(' • ');
  }

  function formatDateTime(value){
    const ts = Number(value) > 0 ? Number(value) : Date.parse(String(value || ''));
    if(!Number.isFinite(ts) || ts <= 0) return '—';
    try{
      const d = new Date(ts);
      const pad = (n)=> String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(_){ return '—'; }
  }

  function getSnapshotId(snapshot){
    try{ return String(snapshot && snapshot.id || ''); }catch(_){ return ''; }
  }

  function normalizeStatusKey(value){
    return String(value || '').trim().toLowerCase();
  }

  function statusRank(value){
    const key = normalizeStatusKey(value);
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, key) ? STATUS_RANK[key] : -99;
  }

  function isFinalStatus(value){
    const key = normalizeStatusKey(value);
    return key === 'zaakceptowany' || key === 'umowa' || key === 'produkcja' || key === 'montaz' || key === 'zakonczone';
  }

  function isSelectedSnapshot(snapshot){
    try{ return !!(snapshot && snapshot.meta && snapshot.meta.selectedByClient); }catch(_){ return false; }
  }

  function isRejectedSnapshot(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isRejectedSnapshot === 'function') return !!FC.quoteSnapshotStore.isRejectedSnapshot(snapshot);
    }catch(_){ }
    return !!(snapshot && snapshot.meta && (Number(snapshot.meta.rejectedAt) > 0 || String(snapshot.meta.rejectedReason || '').trim()));
  }

  function getRejectedReason(snapshot){
    try{ return String(snapshot && snapshot.meta && snapshot.meta.rejectedReason || '').trim().toLowerCase(); }catch(_){ return ''; }
  }

  function isPreliminarySnapshot(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isPreliminarySnapshot === 'function') return !!FC.quoteSnapshotStore.isPreliminarySnapshot(snapshot);
    }catch(_){ }
    return !!(snapshot && ((snapshot.meta && snapshot.meta.preliminary) || (snapshot.commercial && snapshot.commercial.preliminary)));
  }

  function normalizeRoomIds(roomIds){
    if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function'){
      try{ return FC.quoteSnapshotStore.normalizeRoomIds(roomIds); }catch(_){ }
    }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getSnapshotRoomIds(snapshot){
    if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSnapshotRoomIds === 'function'){
      try{ return FC.quoteSnapshotStore.getSnapshotRoomIds(snapshot); }catch(_){ }
    }
    return normalizeRoomIds(snapshot && snapshot.scope && snapshot.scope.selectedRooms);
  }

  function getMaterialScopeMode(snapshotOrScope){
    const source = snapshotOrScope && snapshotOrScope.scope ? snapshotOrScope.scope : snapshotOrScope;
    const explicit = String(source && source.materialScopeMode || '').trim();
    if(explicit) return explicit;
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.materialScopeMode === 'function') return FC.quoteSnapshot.materialScopeMode(source && source.materialScope);
    }catch(_){ }
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.getRozrysScopeMode === 'function') return FC.rozrysScope.getRozrysScopeMode(source && source.materialScope);
    }catch(_){ }
    return 'both';
  }

  function getMaterialScopeLabel(snapshotOrScope){
    const mode = getMaterialScopeMode(snapshotOrScope);
    if(mode === 'corpus') return 'Same korpusy';
    if(mode === 'fronts') return 'Same fronty';
    return 'Korpusy + fronty';
  }

  function snapshotById(id, history){
    const key = String(id || '');
    if(!key) return null;
    const list = Array.isArray(history) ? history : [];
    return list.find((row)=> getSnapshotId(row) === key) || null;
  }

  FC.wycenaTabHelpers = Object.assign({}, FC.wycenaTabHelpers || {}, {
    money,
    num,
    buildRowMeta,
    formatDateTime,
    getSnapshotId,
    normalizeStatusKey,
    statusRank,
    isFinalStatus,
    isSelectedSnapshot,
    isRejectedSnapshot,
    getRejectedReason,
    isPreliminarySnapshot,
    normalizeRoomIds,
    getSnapshotRoomIds,
    getMaterialScopeMode,
    getMaterialScopeLabel,
    snapshotById,
  });
})();
