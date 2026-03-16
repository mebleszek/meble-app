// js/app/confirm-box.js
(function(){
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  let active = null;

  function el(tag, attrs, children){
    const node = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([k, v])=>{
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

  function toneClass(tone, fallback){
    const value = String(tone || fallback || 'neutral').toLowerCase();
    if(value === 'success' || value === 'green') return 'is-success';
    if(value === 'danger' || value === 'red') return 'is-danger';
    return 'is-neutral';
  }

  function closeActive(result){
    const cur = active;
    active = null;
    if(!cur) return;
    try{ cur.root.remove(); }catch(_){ }
    try{
      document.documentElement.classList.remove('modal-lock');
      document.body.classList.remove('modal-lock');
    }catch(_){ }
    try{ document.removeEventListener('keydown', cur.onKey, true); }catch(_){ }
    try{ cur.resolve(!!result); }catch(_){ }
  }

  function normalizeOptions(opts){
    const o = Object.assign({}, opts || {});
    return {
      title: String(o.title || 'POTWIERDZENIE'),
      message: String(o.message || o.description || 'Czy kontynuować?'),
      confirmLabel: String(o.confirmLabel || o.confirmText || 'TAK'),
      cancelLabel: String(o.cancelLabel || o.cancelText || 'NIE'),
      confirmTone: String(o.confirmTone || o.confirmVariant || 'success'),
      cancelTone: String(o.cancelTone || o.cancelVariant || 'neutral'),
      dismissOnOverlay: o.dismissOnOverlay !== false,
      dismissOnEsc: o.dismissOnEsc !== false,
      focus: String(o.focus || 'confirm').toLowerCase(),
      dialogClass: String(o.dialogClass || ''),
      bodyHtml: o.bodyHtml == null ? null : String(o.bodyHtml),
    };
  }

  function ask(opts){
    if(active) closeActive(false);
    const o = normalizeOptions(opts);

    return new Promise((resolve)=>{
      const overlay = el('div', { class:'confirm-backdrop' });
      const dialog = el('div', {
        class:`confirm-box${o.dialogClass ? ' ' + o.dialogClass : ''}`,
        role:'dialog',
        'aria-modal':'true',
        'aria-labelledby':'fc-confirm-title',
        'aria-describedby':'fc-confirm-message'
      });
      const head = el('div', { class:'confirm-title', id:'fc-confirm-title', text:o.title });
      const body = o.bodyHtml != null
        ? el('div', { class:'confirm-message', id:'fc-confirm-message', html:o.bodyHtml })
        : el('div', { class:'confirm-message', id:'fc-confirm-message', text:o.message });
      const actions = el('div', { class:'confirm-actions' });
      const cancelBtn = el('button', {
        type:'button',
        class:`confirm-btn ${toneClass(o.cancelTone, 'neutral')}`,
        text:o.cancelLabel
      });
      const confirmBtn = el('button', {
        type:'button',
        class:`confirm-btn ${toneClass(o.confirmTone, 'success')}`,
        text:o.confirmLabel
      });

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      dialog.appendChild(head);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      try{
        document.documentElement.classList.add('modal-lock');
        document.body.classList.add('modal-lock');
      }catch(_){ }

      cancelBtn.addEventListener('click', ()=> closeActive(false));
      confirmBtn.addEventListener('click', ()=> closeActive(true));
      overlay.addEventListener('pointerdown', (e)=>{
        if(e.target !== overlay) return;
        if(!o.dismissOnOverlay) return;
        closeActive(false);
      });

      const onKey = (e)=>{
        if(e.key === 'Escape' && o.dismissOnEsc){
          e.preventDefault();
          closeActive(false);
          return;
        }
        if(e.key === 'Enter'){
          const target = document.activeElement;
          if(target === cancelBtn || target === confirmBtn) return;
          e.preventDefault();
          closeActive(true);
        }
      };
      document.addEventListener('keydown', onKey, true);

      active = { root:overlay, resolve, onKey };
      setTimeout(()=>{
        try{
          (o.focus === 'cancel' ? cancelBtn : confirmBtn).focus();
        }catch(_){ }
      }, 0);
    });
  }

  root.FC.confirmBox = {
    ask,
    open: ask,
    confirm: ask,
    close: closeActive,
  };
})();
