(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  let active = null;

  function el(tag, attrs, children){
    const node = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key, value])=>{
        if(value == null) return;
        if(key === 'class') node.className = value;
        else if(key === 'text') node.textContent = value;
        else if(key === 'html') node.innerHTML = value;
        else node.setAttribute(key, String(value));
      });
    }
    (children || []).forEach((child)=>{ if(child) node.appendChild(child); });
    return node;
  }

  function toneClass(tone){
    const t = String(tone || 'neutral');
    if(t === 'success') return 'is-success';
    if(t === 'danger') return 'is-danger';
    return 'is-neutral';
  }

  function cleanup(result){
    const cur = active;
    active = null;
    if(!cur) return;
    try{ cur.root.remove(); }catch(_){ }
    try{ document.documentElement.classList.remove('modal-lock'); document.body.classList.remove('modal-lock'); }catch(_){ }
    try{ document.removeEventListener('keydown', cur.onKey, true); }catch(_){ }
    try{ cur.resolve(result); }catch(_){ }
  }

  function ask(opts){
    const cfg = opts || {};
    if(active) cleanup(null);
    return new Promise((resolve)=>{
      const title = String(cfg.title || 'WYBÓR');
      const message = String(cfg.message || 'Wybierz działanie.');
      const actions = Array.isArray(cfg.actions) && cfg.actions.length ? cfg.actions : [{ value:'ok', text:'OK', tone:'success' }];
      const dismissValue = Object.prototype.hasOwnProperty.call(cfg, 'dismissValue') ? cfg.dismissValue : null;
      const dismissOnOverlay = cfg.dismissOnOverlay !== false;
      const dismissOnEsc = cfg.dismissOnEsc !== false;
      const overlay = el('div', { class:'confirm-backdrop' });
      const dialog = el('div', { class:'confirm-box', role:'dialog', 'aria-modal':'true' });
      const head = el('div', { class:'confirm-title', text:title });
      const body = el('div', { class:'confirm-message', text:message });
      const buttons = el('div', { class:'confirm-actions' });
      actions.forEach((action)=>{
        const btn = el('button', { type:'button', class:`confirm-btn ${toneClass(action.tone)}`, text:String(action.text || action.value || 'OK') });
        btn.addEventListener('click', ()=> cleanup(action.value));
        buttons.appendChild(btn);
      });
      dialog.appendChild(head);
      dialog.appendChild(body);
      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      try{ document.documentElement.classList.add('modal-lock'); document.body.classList.add('modal-lock'); }catch(_){ }
      overlay.addEventListener('pointerdown', (event)=>{
        if(event.target !== overlay) return;
        if(!dismissOnOverlay) return;
        cleanup(dismissValue);
      });
      const onKey = (event)=>{
        if(event.key === 'Escape' && dismissOnEsc){
          event.preventDefault();
          cleanup(dismissValue);
        }
      };
      document.addEventListener('keydown', onKey, true);
      active = { root:overlay, resolve, onKey };
      setTimeout(()=>{
        try{ buttons.querySelector('button').focus(); }catch(_){ }
      }, 0);
    });
  }

  root.FC.choiceBox = { ask };
})();
