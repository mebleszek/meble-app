// js/app/ui/accordion-behavior.js
// Wspólne zachowanie akordeonów: jeden aktywny w grupie + scroll spod górnego menu.
(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const DETAILS_SELECTOR = [
    'details.wywiad-room-accordion',
    'details.czynnosci-cabinet',
    'details.investor-transport-accordion',
    'details.investor-carrying-accordion',
    'details.data-settings-accordion'
  ].join(',');

  function topOffset(){
    let offset = 12;
    try{
      const header = document.querySelector('header');
      if(header){
        const rect = header.getBoundingClientRect();
        offset += Math.max(0, Math.ceil(rect.height || 0));
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
    const delay = Number.isFinite(Number(cfg.delay)) ? Number(cfg.delay) : 55;
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
      || element.closest('#roomSettingsCard')
      || element.closest('.czynnosci-cabinet-section')
      || element.closest('#investorRoot')
      || element.closest('#rozrysRoot')
      || element.closest('#appView')
      || element.parentElement
      || document;
  }

  function closeOtherDetails(opened){
    const root = groupRoot(opened);
    if(!root || !root.querySelectorAll) return;
    root.querySelectorAll(DETAILS_SELECTOR).forEach((node)=>{
      if(node === opened) return;
      if(node.open){
        node.open = false;
        node.classList.remove('is-open');
      }
    });
  }

  function syncDetails(details){
    if(!details || !details.matches || !details.matches(DETAILS_SELECTOR)) return;
    const opened = !!details.open;
    details.classList.toggle('is-open', opened);
    if(opened){
      closeOtherDetails(details);
      scrollIntoView(details);
    }
  }

  function closeInGroup(element){
    const root = groupRoot(element);
    if(!root || !root.querySelectorAll) return;
    root.querySelectorAll(DETAILS_SELECTOR).forEach((node)=>{
      if(node.open){ node.open = false; node.classList.remove('is-open'); }
    });
    root.querySelectorAll('.rozrys-material-accordion.is-open,.quote-manual-labor-accordion.is-open').forEach((node)=>{
      if(node === element) return;
      node.classList.remove('is-open');
      const body = node.querySelector('.rozrys-material-accordion__body');
      if(body) body.hidden = true;
      const trigger = node.querySelector('.rozrys-material-accordion__trigger');
      if(trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function initDetails(root){
    const scope = root && root.querySelectorAll ? root : document;
    const seen = new WeakSet();
    scope.querySelectorAll(DETAILS_SELECTOR).forEach((details)=>{
      details.classList.toggle('is-open', !!details.open);
      details.addEventListener('toggle', ()=> syncDetails(details));
      const group = groupRoot(details);
      if(details.open && group && !seen.has(group)){
        seen.add(group);
      }else if(details.open && group && seen.has(group)){
        details.open = false;
        details.classList.remove('is-open');
      }
    });
  }

  function bind(){
    syncCssOffset();
    try{ window.addEventListener('resize', syncCssOffset, { passive:true }); }catch(_){ }
    document.addEventListener('toggle', (event)=>{
      const target = event && event.target;
      if(target && target.matches && target.matches(DETAILS_SELECTOR)) syncDetails(target);
    }, true);
    initDetails(document);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();

  ns.accordionBehavior = Object.assign({}, ns.accordionBehavior || {}, {
    scrollIntoView,
    closeInGroup,
    initDetails,
    topOffset
  });
})();
