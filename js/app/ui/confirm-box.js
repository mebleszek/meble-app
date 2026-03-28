// js/app/ui/confirm-box.js
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  let active = null;

  function el(tag, attrs, children){
    const node = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([k,v])=>{
        if(v == null) return;
        if(k === 'class') node.className = v;
        else if(k === 'text') node.textContent = v;
        else if(k === 'html') node.innerHTML = v;
        else node.setAttribute(k, String(v));
      });
    }
    (children || []).forEach((child)=>{ if(child) node.appendChild(child); });
    return node;
  }

  function cleanup(result){
    const cur = active;
    active = null;
    if(!cur) return;
    try{ cur.root.remove(); }catch(_){ }
    try{ document.documentElement.classList.remove('modal-lock'); document.body.classList.remove('modal-lock'); }catch(_){ }
    try{ document.removeEventListener('keydown', cur.onKey, true); }catch(_){ }
    try{ cur.resolve(!!result); }catch(_){ }
  }

  function ask(opts){
    opts = opts || {};
    if(active) cleanup(false);
    return new Promise((resolve)=>{
      const title = String(opts.title || 'POTWIERDZENIE');
      const message = String(opts.message || 'Czy kontynuować?');
      const confirmText = String(opts.confirmText || '✓ TAK');
      const cancelText = String(opts.cancelText || '✕ NIE');
      const confirmTone = String(opts.confirmTone || 'success');
      const cancelTone = String(opts.cancelTone || 'danger');
      const dismissOnOverlay = opts.dismissOnOverlay !== false;
      const dismissOnEsc = opts.dismissOnEsc !== false;

      const overlay = el('div', { class:'confirm-backdrop' });
      const dialog = el('div', { class:'confirm-box', role:'dialog', 'aria-modal':'true' });
      const head = el('div', { class:'confirm-title', text:title });
      const body = el('div', { class:'confirm-message', text:message });
      const actions = el('div', { class:'confirm-actions' });
      const cancelBtn = el('button', { type:'button', class:`confirm-btn ${cancelTone === 'danger' ? 'is-danger' : 'is-neutral'}`, text:cancelText });
      const confirmBtn = el('button', { type:'button', class:`confirm-btn ${confirmTone === 'success' ? 'is-success' : confirmTone === 'danger' ? 'is-danger' : 'is-neutral'}`, text:confirmText });
      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      dialog.appendChild(head);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      try{ document.documentElement.classList.add('modal-lock'); document.body.classList.add('modal-lock'); }catch(_){ }

      cancelBtn.addEventListener('click', ()=> cleanup(false));
      confirmBtn.addEventListener('click', ()=> cleanup(true));
      overlay.addEventListener('pointerdown', (e)=>{
        if(e.target !== overlay) return;
        if(!dismissOnOverlay) return;
        cleanup(false);
      });
      const onKey = (e)=>{
        if(e.key === 'Escape' && dismissOnEsc){
          e.preventDefault();
          cleanup(false);
        }
      };
      document.addEventListener('keydown', onKey, true);
      active = { root:overlay, resolve, onKey };
      setTimeout(()=>{ try{ confirmBtn.focus(); }catch(_){ } }, 0);
    });
  }

  root.FC.confirmBox = { ask };
})();
