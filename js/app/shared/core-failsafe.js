(function(){
  'use strict';
  try{
    window.FC = window.FC || {};

    if(!window.FC.actions){
      const registry = Object.create(null);
      const locks = Object.create(null);
      function register(map){ Object.keys(map||{}).forEach(k=>registry[k]=map[k]); }
      function has(a){ return typeof registry[a]==='function'; }
      function lock(a,ms){ locks[a]=Date.now()+(ms||800); }
      function isLocked(a){ return (locks[a]||0) > Date.now(); }
      function dispatch(action, ctx){
        const fn = registry[action];
        if(typeof fn!=='function') return false;
        return !!fn(ctx||{});
      }
      function validateDOMActions(){ return true; }
      window.FC.actions = { register, dispatch, has, validateDOMActions, lock, isLocked };
    }

    if(!window.FC.modal){
      const stack = [];
      const closeMap = Object.create(null);
      function register(id, closeFn){ if(id) closeMap[id]=closeFn; }
      function open(id){ if(id) stack.push(id); }
      function close(id){
        const key = id || stack.pop();
        const fn = closeMap[key];
        try{ if(typeof fn==='function') fn(); }catch(_){ }
      }
      function top(){ return stack.length ? stack[stack.length-1] : null; }
      function closeTop(){ close(); }
      window.FC.modal = { register, open, close, top, closeTop };
    }
  }catch(_){ }
})();
