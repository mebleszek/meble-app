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
    const okOnly = !!opts.okOnly;
    // Explicit session-dialog opt-in; ordinary information boxes stay unchanged.
    const secondary = opts.sessionDiagnostic === true && root.FC.sessionDiagnostics
      ? { text:'Diagnostyka sesji', run:()=>root.FC.sessionDiagnostics.open() }
      : opts.secondaryAction;
    const hasSecondary = !!(secondary && typeof secondary.run === 'function');
    const dismissOnOverlay = Object.prototype.hasOwnProperty.call(opts, 'dismissOnOverlay') ? opts.dismissOnOverlay !== false : !okOnly;
    const dismissOnEsc = Object.prototype.hasOwnProperty.call(opts, 'dismissOnEsc') ? opts.dismissOnEsc !== false : !okOnly;

    const overlay = el('div', { class:'info-backdrop' });
    const box = el('div', { class:`info-box${okOnly ? ' info-box--ok-only' : ''}`, role:'dialog', 'aria-modal':'true' });
    const head = el('div', { class:'info-box__head' });
    const titleEl = el('div', { class:'info-box__title', text:title });
    const closeBtn = okOnly ? null : el('button', { type:'button', class:'info-box__close', 'aria-label':'Zamknij informację', text:'×' });
    const body = el('div', { class:'info-box__body', text:message });
    const actions = okOnly || hasSecondary ? el('div', { class:'info-box__actions' + (okOnly && !hasSecondary ? ' info-box__actions--single' : '') }) : null;
    const okBtn = okOnly ? el('button', { type:'button', class:'confirm-btn is-success info-box__action', text:'OK' }) : null;

    head.appendChild(titleEl);
    if(closeBtn) head.appendChild(closeBtn);
    box.appendChild(head);
    box.appendChild(body);
    if(actions){
      if(hasSecondary){
        const button = el('button', { type:'button', class:'confirm-btn info-box__action', text:String(secondary.text || '') });
        button.addEventListener('click', ()=>{
          try{ Promise.resolve(secondary.run({button,body})).catch(()=>{}); }catch(_){ }
        });
        actions.appendChild(button);
      }
      if(okBtn) actions.appendChild(okBtn);
      box.appendChild(actions);
    }
    if(opts.sessionDiagnosticReport === true){
      // A phone screenshot must not reveal customer data behind the report.
      overlay.style.background = '#f8fafc';
      box.style.maxHeight = 'calc(100dvh - 32px)';
      box.style.overflowY = 'auto';
      body.style.fontSize = '12px';
      body.style.lineHeight = '1.35';
    }
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

    if(closeBtn) closeBtn.addEventListener('click', close);
    if(okBtn) okBtn.addEventListener('click', close);
    overlay.addEventListener('pointerdown', (e)=>{
      if(e.target !== overlay) return;
      if(!dismissOnOverlay) return;
      close();
    });
    box.addEventListener('pointerdown', (e)=> e.stopPropagation());

    active = { root:overlay, onKey };
    setTimeout(()=>{
      try{ (okBtn || closeBtn).focus(); }catch(_){ }
    }, 0);
  }

  root.FC.infoBox = { open, close };
})();
