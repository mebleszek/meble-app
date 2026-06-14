// js/app/ui/accordion-behavior.js
// Wspólne zachowanie akordeonów: animacja, jeden aktywny w grupie i scroll spod górnego menu.
(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});
  const EXPAND_MS = 420;

  const DETAILS_SELECTOR = [
    'details.wywiad-room-accordion',
    'details.czynnosci-cabinet',
    'details.investor-transport-accordion',
    'details.investor-carrying-accordion',
    'details.data-settings-accordion'
  ].join(',');

  const CUSTOM_SELECTOR = [
    '.rozrys-material-accordion',
    '.quote-manual-labor-accordion',
    '.cabinet-card-shell',
    '.material-cabinet-accordion'
  ].join(',');

  function prefersReducedMotion(){
    try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; }
  }

  function frame(fn){
    if(window.requestAnimationFrame) window.requestAnimationFrame(()=> window.requestAnimationFrame(fn));
    else setTimeout(fn, 0);
  }

  function topOffset(){
    let offset = 14;
    try{
      const header = document.querySelector('header');
      if(header){
        const rect = header.getBoundingClientRect();
        const visible = rect && rect.bottom > 0 && rect.height > 0;
        if(visible) offset += Math.max(0, Math.ceil(rect.height || 0));
      }
    }catch(_){ }
    return offset;
  }

  function syncCssOffset(){
    try{ document.documentElement.style.setProperty('--fc-sticky-offset', topOffset() + 'px'); }catch(_){ }
  }

  function scrollIntoView(element, options){
    if(!element) return;
    const cfg = options && typeof options === 'object' ? options : {};
    const delay = Number.isFinite(Number(cfg.delay)) ? Number(cfg.delay) : 70;
    window.setTimeout(()=>{
      try{
        const rect = element.getBoundingClientRect();
        const top = Math.max(0, window.pageYOffset + rect.top - topOffset());
        window.scrollTo({ top, behavior: cfg.instant ? 'auto' : 'smooth' });
      }catch(_){
        try{ element.scrollIntoView({ block:'start', behavior: cfg.instant ? 'auto' : 'smooth' }); }catch(__){ }
      }
    }, delay);
  }

  function groupRoot(element){
    if(!element || !element.closest) return document;
    return element.closest('[data-accordion-group]')
      || element.closest('#appView')
      || element.closest('#investorRoot')
      || element.closest('#rozrysRoot')
      || element.closest('#quoteSummaryDetailsModal')
      || element.closest('.panel-box')
      || element.closest('.container')
      || document;
  }

  function directBody(root){
    if(!root || !root.querySelector) return null;
    return root.querySelector(':scope > .wywiad-room-accordion__body')
      || root.querySelector(':scope > .quote-labor-cabinet__body')
      || root.querySelector(':scope > .investor-transport-accordion__body')
      || root.querySelector(':scope > .investor-carrying-accordion__body')
      || root.querySelector(':scope > .rozrys-material-accordion__body')
      || root.querySelector(':scope > .quote-offer-accordion__body');
  }

  function directTrigger(root){
    if(!root || !root.querySelector) return null;
    return root.querySelector(':scope > summary')
      || root.querySelector(':scope .rozrys-material-accordion__trigger')
      || root.querySelector(':scope .quote-offer-accordion__trigger')
      || root.querySelector(':scope .cabinet-header');
  }

  function resetAnimation(root){
    const body = directBody(root);
    if(root && root._fcAccordionTimer){ clearTimeout(root._fcAccordionTimer); root._fcAccordionTimer = null; }
    if(root) root.classList.remove('is-ui-pattern-animating');
    if(body){
      body.style.maxHeight = '';
      body.style.opacity = '';
      body.style.transform = '';
      body.style.overflow = '';
    }
  }

  function setOpenState(root, open){
    if(!root) return;
    const body = directBody(root);
    const trigger = directTrigger(root);
    root.classList.toggle('is-open', !!open);
    if(root.tagName && root.tagName.toLowerCase() === 'details'){
      root.open = !!open;
    }
    if(trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(body && !open) body.hidden = true;
    if(body && open) body.hidden = false;
  }

  function animateOpen(root, options){
    if(!root) return;
    const body = directBody(root);
    resetAnimation(root);
    setOpenState(root, true);
    if(!body || prefersReducedMotion()){
      resetAnimation(root);
      setOpenState(root, true);
      return;
    }
    root.classList.add('is-ui-pattern-animating');
    body.hidden = false;
    body.style.overflow = 'hidden';
    body.style.maxHeight = '0px';
    body.style.opacity = '0';
    body.style.transform = 'translateY(-4px)';
    try{ void body.offsetHeight; }catch(_){ }
    const targetHeight = Math.max(1, body.scrollHeight || 1);
    frame(()=>{
      body.style.maxHeight = targetHeight + 'px';
      body.style.opacity = '1';
      body.style.transform = 'translateY(0)';
    });
    root._fcAccordionTimer = setTimeout(()=>{
      resetAnimation(root);
      setOpenState(root, true);
    }, EXPAND_MS + 40);
    if(!(options && options.noScroll)) scrollIntoView(root);
  }

  function animateClose(root, options){
    if(!root) return;
    const body = directBody(root);
    resetAnimation(root);
    if(!body || prefersReducedMotion()){
      setOpenState(root, false);
      return;
    }
    root.classList.add('is-ui-pattern-animating');
    body.hidden = false;
    body.style.overflow = 'hidden';
    body.style.maxHeight = Math.max(1, body.scrollHeight || 1) + 'px';
    body.style.opacity = '1';
    body.style.transform = 'translateY(0)';
    try{ void body.offsetHeight; }catch(_){ }
    frame(()=>{
      body.style.maxHeight = '0px';
      body.style.opacity = '0';
      body.style.transform = 'translateY(-4px)';
    });
    root._fcAccordionTimer = setTimeout(()=>{
      resetAnimation(root);
      setOpenState(root, false);
      if(options && typeof options.after === 'function'){
        try{ options.after(root); }catch(_){ }
      }
    }, EXPAND_MS + 40);
  }

  function clearUiStateForClosedGroup(root, keep){
    try{
      if(!window.uiState) return;
      const inApp = root && root.closest && root.closest('#appView');
      if(!inApp) return;
      if(!(keep && keep.classList && keep.classList.contains('cabinet-card-shell'))){
        if(uiState.expanded && typeof uiState.expanded === 'object'){
          Object.keys(uiState.expanded).forEach((key)=>{ uiState.expanded[key] = false; });
        }
        uiState.selectedCabinetId = null;
      }
      if(!(keep && keep.classList && keep.classList.contains('material-cabinet-accordion'))){
        uiState.matExpandedId = null;
      }
      if(!(keep && keep.classList && keep.classList.contains('czynnosci-cabinet'))){
        uiState.czynnosciExpandedCabId = null;
      }
      if(window.FC && window.FC.storage && typeof window.FC.storage.setJSON === 'function' && window.STORAGE_KEYS){
        window.FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      }
    }catch(_){ }
  }

  function closeNode(node, keep){
    if(!node || node === keep) return;
    if(node.tagName && node.tagName.toLowerCase() === 'details'){
      if(node.open || node.classList.contains('is-open')) animateClose(node);
      return;
    }
    if(node.classList && (node.classList.contains('is-open') || node.classList.contains('selected'))){
      if(node.classList.contains('rozrys-material-accordion') || node.classList.contains('quote-manual-labor-accordion')){
        animateClose(node);
      }else{
        node.classList.remove('is-open', 'selected');
      }
    }
  }

  function closeInGroup(keep){
    const root = groupRoot(keep);
    if(!root || !root.querySelectorAll) return;
    root.querySelectorAll(DETAILS_SELECTOR).forEach((node)=> closeNode(node, keep));
    root.querySelectorAll(CUSTOM_SELECTOR).forEach((node)=> closeNode(node, keep));
    clearUiStateForClosedGroup(root, keep);
  }

  function toggleDetails(details){
    if(!details || !details.matches || !details.matches(DETAILS_SELECTOR)) return;
    const willOpen = !details.open;
    if(willOpen){
      closeInGroup(details);
      animateOpen(details);
    }else{
      animateClose(details);
    }
  }

  function initDetails(root){
    const scope = root && root.querySelectorAll ? root : document;
    const openedByRoot = new WeakMap();
    scope.querySelectorAll(DETAILS_SELECTOR).forEach((details)=>{
      const group = groupRoot(details);
      if(details.open){
        if(openedByRoot.get(group)){
          details.open = false;
          details.classList.remove('is-open');
        }else{
          openedByRoot.set(group, details);
          details.classList.add('is-open');
        }
      }else{
        details.classList.remove('is-open');
      }
      const trigger = directTrigger(details);
      if(trigger) trigger.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    });
  }

  function bind(){
    syncCssOffset();
    try{ window.addEventListener('resize', syncCssOffset, { passive:true }); }catch(_){ }
    document.addEventListener('click', (event)=>{
      const summary = event.target && event.target.closest ? event.target.closest('summary') : null;
      if(!summary) return;
      const details = summary.closest ? summary.closest(DETAILS_SELECTOR) : null;
      if(!details) return;
      event.preventDefault();
      event.stopPropagation();
      toggleDetails(details);
    }, true);
    initDetails(document);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();

  ns.accordionBehavior = Object.assign({}, ns.accordionBehavior || {}, {
    topOffset,
    scrollIntoView,
    closeInGroup,
    animateOpen,
    animateClose,
    initDetails,
    syncCssOffset,
    toggleDetails
  });
})();
