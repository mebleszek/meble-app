/* core/modals.js — safe modal open/close with overlay + ESC and stack */
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const stack = [];
  const closeFns = Object.create(null);

  function _el(id){
    return (typeof id === 'string') ? document.getElementById(id) : id;
  }

  function register(id, closeFn){
    if(!id) return;
    closeFns[id] = closeFn;
  }

  function isOpen(id){
    const el = _el(id);
    return !!(el && el.style.display && el.style.display !== 'none');
  }

  function open(id){
    const el = _el(id);
    if(!el) throw new Error('Modal not found: ' + id);
    if(!stack.includes(el.id)) stack.push(el.id);
    el.style.display = 'flex';
    if(typeof window.lockModalScroll === 'function') window.lockModalScroll();
  }

  function close(id){
    const el = _el(id);
    if(!el) return;
    el.style.display = 'none';
    const idx = stack.lastIndexOf(el.id);
    if(idx >= 0) stack.splice(idx, 1);
    if(stack.length === 0 && typeof window.unlockModalScroll === 'function') window.unlockModalScroll();
  }

  function closeTop(){
    const topId = stack.length ? stack[stack.length-1] : null;
    if(!topId) return false;
    const fn = closeFns[topId];
    if(typeof fn === 'function'){
      fn();
    }else{
      close(topId);
    }
    return true;
  }

  // One-time global wiring
  if(!window.__FC_MODAL_WIRING__){
    window.__FC_MODAL_WIRING__ = true;

    // Overlay click: close only if click hits the backdrop itself
    document.addEventListener('pointerdown', (e)=>{
      const t = e.target;
      if(!t) return;
      if(t.classList && t.classList.contains('modal-back')){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // close the exact modal
        const id = t.id;
        const fn = closeFns[id];
        if(typeof fn === 'function') fn();
        else close(id);
      }
    }, {capture:true, passive:false});

    // ESC closes top-most modal
    document.addEventListener('keydown', (e)=>{
      if(e.key !== 'Escape') return;
      const did = closeTop();
      if(did){
        e.preventDefault();
        e.stopPropagation();
      }
    }, {capture:true});
  }

  FC.modal = { register, open, close, isOpen, closeTop, _stack: stack };
})();
