// js/app/ui/info-box.js
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

  function close(){
    const cur = active;
    active = null;
    if(!cur) return;
    try{ cur.root.remove(); }catch(_){ }
    try{ document.documentElement.classList.remove('modal-lock'); document.body.classList.remove('modal-lock'); }catch(_){ }
    try{ document.removeEventListener('keydown', cur.onKey, true); }catch(_){ }
  }

  function open(opts){
    opts = opts || {};
    close();
    const title = String(opts.title || 'Informacja');
    const message = String(opts.message || '');
    const dismissOnOverlay = opts.dismissOnOverlay !== false;
    const dismissOnEsc = opts.dismissOnEsc !== false;

    const overlay = el('div', { class:'info-backdrop' });
    const box = el('div', { class:'info-box', role:'dialog', 'aria-modal':'true' });
    const head = el('div', { class:'info-box__head' });
    const titleEl = el('div', { class:'info-box__title', text:title });
    const closeBtn = el('button', { type:'button', class:'info-box__close', 'aria-label':'Zamknij informację', text:'×' });
    const body = el('div', { class:'info-box__body', text:message });

    head.appendChild(titleEl);
    head.appendChild(closeBtn);
    box.appendChild(head);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    try{ document.documentElement.classList.add('modal-lock'); document.body.classList.add('modal-lock'); }catch(_){ }

    const onKey = (e)=>{
      if(e.key === 'Escape' && dismissOnEsc){
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('pointerdown', (e)=>{
      if(e.target !== overlay) return;
      if(!dismissOnOverlay) return;
      close();
    });
    box.addEventListener('pointerdown', (e)=> e.stopPropagation());

    active = { root:overlay, onKey };
    setTimeout(()=>{ try{ closeBtn.focus(); }catch(_){ } }, 0);
  }

  root.FC.infoBox = { open, close };
})();
