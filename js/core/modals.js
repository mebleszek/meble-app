// js/core/modals.js
// Minimal modal stack manager (ESC + overlay close). No dependencies.

(function(){
  'use strict';
  const root = (typeof window !== 'undefined') ? window : globalThis;
  root.FC = root.FC || {};

  const stack = [];
  const closeMap = Object.create(null);

  function register(id, closeFn){
    if(!id) return;
    if(typeof closeFn === 'function') closeMap[id] = closeFn;
  }

  function open(id){
    if(!id) return;
    stack.push(id);
  }

  function close(id){
    const key = id || stack.pop();
    if(!key) return;
    const fn = closeMap[key];
    if(typeof fn === 'function') fn();
  }

  function top(){
    return stack.length ? stack[stack.length - 1] : null;
  }

  function closeTop(){
    close();
  }

  // ESC closes top modal.
  if(root.document){
    root.document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        const t = top();
        if(t){
          e.preventDefault();
          try{ closeTop(); }catch(_){}
        }
      }
    });

    // Overlay click closes if element has data-modal-close="<id>".
    root.document.addEventListener('pointerdown', (e) => {
      const target = e.target;
      if(!target || !target.getAttribute) return;
      const id = target.getAttribute('data-modal-close');
      if(id){
        e.preventDefault();
        e.stopPropagation();
        try{ close(id); }catch(_){}
      }
    });
  }

  root.FC.modal = { register, open, close, top, closeTop };
})();
