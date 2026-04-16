(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getQuoteHistoryItemDomId(snapshotId){
    const key = String(snapshotId || '').trim();
    return key ? `quoteHistoryItem-${key}` : '';
  }

  function getQuoteHistoryNeighborDomId(snapshotId){
    try{
      const currentId = getQuoteHistoryItemDomId(snapshotId);
      const current = currentId ? document.getElementById(currentId) : null;
      if(!current) return 'quoteHistorySection';
      let next = current.nextElementSibling;
      while(next){
        if(next.matches && next.matches('[data-quote-history-id]') && next.id) return next.id;
        next = next.nextElementSibling;
      }
      let prev = current.previousElementSibling;
      while(prev){
        if(prev.matches && prev.matches('[data-quote-history-id]') && prev.id) return prev.id;
        prev = prev.previousElementSibling;
      }
    }catch(_){ }
    return 'quoteHistorySection';
  }

  function getScrollY(){
    try{
      if(typeof window.scrollY === 'number') return Math.max(0, Math.round(window.scrollY));
      const doc = document.documentElement || document.body;
      return Math.max(0, Math.round(Number(doc && doc.scrollTop) || 0));
    }catch(_){ return 0; }
  }

  function rememberQuoteScroll(anchorId, fallbackAnchorId, deps){
    const setState = deps && typeof deps.setState === 'function' ? deps.setState : ()=>{};
    const scrollY = getScrollY();
    let domId = String(anchorId || '').trim();
    let fallbackDomId = String(fallbackAnchorId || '').trim();
    let anchor = domId ? document.getElementById(domId) : null;
    if(!anchor && fallbackDomId) anchor = document.getElementById(fallbackDomId);
    if(!anchor){
      try{
        const focused = document.activeElement;
        anchor = focused && typeof focused.closest === 'function'
          ? focused.closest('[data-quote-history-id], #quotePreviewStart, #quoteActivePreview, #quoteHistorySection')
          : null;
        if(anchor && !domId) domId = String(anchor.id || '').trim();
      }catch(_){ anchor = null; }
    }
    let offset = 0;
    if(anchor){
      try{
        const rect = anchor.getBoundingClientRect();
        const absoluteTop = scrollY + rect.top;
        offset = scrollY - absoluteTop;
      }catch(_){ offset = 0; }
    }
    try{
      const active = document.activeElement;
      if(active && typeof active.blur === 'function') active.blur();
    }catch(_){ }
    setState({
      pendingScrollRestore: {
        scrollY: Math.max(0, Math.round(scrollY)),
        domId,
        fallbackDomId,
        offset: Number.isFinite(offset) ? offset : 0,
        ts: Date.now(),
      },
      shouldRestoreScroll: true,
    });
  }

  function clearRememberedQuoteScroll(deps){
    const setState = deps && typeof deps.setState === 'function' ? deps.setState : ()=>{};
    setState({ pendingScrollRestore:null, shouldRestoreScroll:false });
  }

  function restoreRememberedQuoteScroll(deps){
    const getState = deps && typeof deps.getState === 'function' ? deps.getState : ()=> ({});
    const state = getState() || {};
    const snapshot = state.pendingScrollRestore && typeof state.pendingScrollRestore === 'object'
      ? Object.assign({}, state.pendingScrollRestore)
      : null;
    clearRememberedQuoteScroll(deps);
    if(!snapshot) return;

    const resolveTargetTop = ()=>{
      try{
        const anchor = (snapshot.domId && document.getElementById(snapshot.domId))
          || (snapshot.fallbackDomId && document.getElementById(snapshot.fallbackDomId));
        const baseTop = anchor
          ? (getScrollY() + anchor.getBoundingClientRect().top)
          : (Number(snapshot.scrollY) || 0);
        return Math.max(0, Math.round(baseTop + (Number(snapshot.offset) || 0)));
      }catch(_){
        return Math.max(0, Math.round(Number(snapshot.scrollY) || 0));
      }
    };

    const applyOnce = ()=>{
      try{
        const targetTop = resolveTargetTop();
        if(Math.abs(getScrollY() - targetTop) > 1) window.scrollTo(0, targetTop);
      }catch(_){ }
    };

    const delayed = [0, 16, 48, 120, 240, 420];
    delayed.forEach((delay)=>{
      try{
        if(delay === 0) requestAnimationFrame(()=> requestAnimationFrame(applyOnce));
        else setTimeout(applyOnce, delay);
      }catch(_){
        try{ setTimeout(applyOnce, delay); }catch(__){ }
      }
    });
  }

  FC.wycenaTabScroll = Object.assign({}, FC.wycenaTabScroll || {}, {
    getQuoteHistoryItemDomId,
    getQuoteHistoryNeighborDomId,
    getScrollY,
    rememberQuoteScroll,
    clearRememberedQuoteScroll,
    restoreRememberedQuoteScroll,
  });
})();
