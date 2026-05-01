(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key, value])=>{
        if(value == null) return;
        if(key === 'class') el.className = String(value);
        else if(key === 'text') el.textContent = String(value);
        else if(key === 'html') el.innerHTML = String(value);
        else if(key === 'value') el.value = String(value);
        else if(key === 'checked') el.checked = !!value;
        else el.setAttribute(key, String(value));
      });
    }
    (children || []).forEach((child)=>{ if(child) el.appendChild(child); });
    return el;
  }

  function getCurrentProjectId(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? String(FC.projectStore.getCurrentProjectId() || '') : ''; }
    catch(_){ return ''; }
  }

  function getCurrentInvestorId(){
    try{ return FC.investors && typeof FC.investors.getCurrentId === 'function' ? String(FC.investors.getCurrentId() || '') : ''; }
    catch(_){ return ''; }
  }

  function normalizeRoomIds(roomIds){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function') return FC.quoteSnapshotStore.normalizeRoomIds(roomIds);
    }catch(_){ }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getCurrentDraft(){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function') return FC.quoteOfferStore.getCurrentDraft() || {};
    }catch(_){ }
    return {};
  }

  function defaultVersionName(preliminary, options){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.defaultVersionName === 'function') return FC.quoteOfferStore.defaultVersionName(!!preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function normalizeType(options){
    const opts = options && typeof options === 'object' ? options : {};
    if(Object.prototype.hasOwnProperty.call(opts, 'preliminary')) return !!opts.preliminary;
    const kind = String(opts.kind || '').trim().toLowerCase();
    return kind !== 'final';
  }

  FC.quoteScopeEntryUtils = {
    clone,
    h,
    getCurrentProjectId,
    getCurrentInvestorId,
    normalizeRoomIds,
    getCurrentDraft,
    defaultVersionName,
    normalizeType,
  };
})();
