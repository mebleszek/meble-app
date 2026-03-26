(function(){
  const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
  let activeField = null;
  let activeHost = null;
  let pendingClear = 0;

  function findScrollHost(field){
    if(!field || !field.closest) return null;
    return field.closest('.body, .panel-box__body, .rozrys-choice-modal__body');
  }

  function getKeyboardInset(){
    if(!window.visualViewport) return 0;
    const vv = window.visualViewport;
    return Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
  }

  function setHostInset(host, inset){
    if(!host) return;
    if(!host.dataset.kbBasePaddingBottom){
      host.dataset.kbBasePaddingBottom = String(parseFloat(getComputedStyle(host).paddingBottom) || 0);
    }
    const base = parseFloat(host.dataset.kbBasePaddingBottom) || 0;
    const extra = inset > 0 ? inset + 24 : 0;
    host.style.paddingBottom = `${base + extra}px`;
    host.style.scrollPaddingBottom = `${extra + 72}px`;
  }

  function clearHostInset(host){
    if(!host) return;
    if(host.dataset.kbBasePaddingBottom){
      host.style.paddingBottom = `${parseFloat(host.dataset.kbBasePaddingBottom) || 0}px`;
    }else{
      host.style.removeProperty('padding-bottom');
    }
    host.style.removeProperty('scroll-padding-bottom');
  }

  function ensureFieldVisible(field){
    if(!field || !document.body.contains(field)) return;
    const host = findScrollHost(field);
    if(!host) return;
    activeField = field;
    activeHost = host;

    const inset = getKeyboardInset();
    setHostInset(host, inset);

    const vv = window.visualViewport;
    const visibleTop = vv ? vv.offsetTop : 0;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const rect = field.getBoundingClientRect();
    const topSafe = visibleTop + 16;
    const bottomSafe = visibleBottom - 16;

    if(rect.bottom > bottomSafe || rect.top < topSafe){
      try{
        field.scrollIntoView({ block:'center', inline:'nearest', behavior:'smooth' });
      }catch(_){
        try{ field.scrollIntoView(); }catch(__){ }
      }
    }
  }

  function scheduleEnsure(field){
    [40, 140, 320].forEach(delay => {
      window.setTimeout(() => ensureFieldVisible(field), delay);
    });
  }

  document.addEventListener('focusin', (ev) => {
    const field = ev.target && ev.target.closest ? ev.target.closest(FIELD_SELECTOR) : null;
    if(!field) return;
    const host = findScrollHost(field);
    if(!host) return;
    window.clearTimeout(pendingClear);
    scheduleEnsure(field);
  }, true);

  document.addEventListener('focusout', () => {
    window.clearTimeout(pendingClear);
    pendingClear = window.setTimeout(() => {
      const el = document.activeElement;
      if(el && el.matches && el.matches(FIELD_SELECTOR) && findScrollHost(el)) return;
      clearHostInset(activeHost);
      activeField = null;
      activeHost = null;
    }, 120);
  }, true);

  function handleViewportChange(){
    if(!activeField) return;
    ensureFieldVisible(activeField);
  }

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', handleViewportChange, { passive:true });
    window.visualViewport.addEventListener('scroll', handleViewportChange, { passive:true });
  }
})();
