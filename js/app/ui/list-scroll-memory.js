(function(){
  'use strict';

  window.FC = window.FC || {};

  let pending = null;

  function getScrollY(){
    try{
      if(typeof window.scrollY === 'number') return window.scrollY;
      const doc = document.documentElement || document.body;
      return Number(doc && doc.scrollTop) || 0;
    }catch(_){
      return 0;
    }
  }

  function selectorFor(tab, cabId){
    const id = String(cabId || '').trim();
    if(!id) return '';
    return String(tab) === 'material' ? `mat-${id}` : `cab-${id}`;
  }

  function resolveAnchor(tab, cabId){
    const domId = selectorFor(tab, cabId);
    if(!domId) return null;
    return document.getElementById(domId) || null;
  }

  function rememberForCabinet(tab, cabId){
    const safeTab = String(tab || '');
    if(safeTab !== 'wywiad' && safeTab !== 'material'){
      pending = null;
      return null;
    }

    const safeId = String(cabId || '').trim();
    if(!safeId){
      pending = null;
      return null;
    }

    const scrollY = getScrollY();
    const anchor = resolveAnchor(safeTab, safeId);
    let offset = 0;
    if(anchor){
      try{
        const rect = anchor.getBoundingClientRect();
        const absoluteTop = scrollY + rect.top;
        offset = scrollY - absoluteTop;
      }catch(_){
        offset = 0;
      }
    }

    pending = {
      tab: safeTab,
      cabId: safeId,
      scrollY,
      offset,
      ts: Date.now()
    };
    return pending;
  }

  function clear(){
    pending = null;
  }

  function getPending(){
    return pending ? Object.assign({}, pending) : null;
  }

  function restorePending(){
    if(!pending) return false;

    const snapshot = pending;
    pending = null;

    const apply = function(){
      try{
        const anchor = resolveAnchor(snapshot.tab, snapshot.cabId);
        const baseTop = anchor
          ? (getScrollY() + anchor.getBoundingClientRect().top)
          : Number(snapshot.scrollY) || 0;
        const targetTop = Math.max(0, Math.round(baseTop + (Number(snapshot.offset) || 0)));
        window.scrollTo(0, targetTop);
      }catch(_){
        try{ window.scrollTo(0, Math.max(0, Math.round(Number(snapshot.scrollY) || 0))); }catch(__){ }
      }
    };

    try{
      requestAnimationFrame(() => requestAnimationFrame(apply));
    }catch(_){
      setTimeout(apply, 0);
    }
    return true;
  }

  window.FC.listScrollMemory = {
    rememberForCabinet,
    restorePending,
    getPending,
    clear
  };
})();
