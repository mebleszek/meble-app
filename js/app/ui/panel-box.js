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
    const title = String(opts.title || 'Podgląd');
    const width = String(opts.width || '920px');
    const dismissOnOverlay = opts.dismissOnOverlay !== false;
    const dismissOnEsc = opts.dismissOnEsc !== false;
    const beforeClose = (typeof opts.beforeClose === 'function') ? opts.beforeClose : null;
    let closePending = false;

    const overlay = el('div', { class:'panel-box-backdrop' });
    const box = el('div', { class:'panel-box', role:'dialog', 'aria-modal':'true', style:`max-width:${width}` });
    const head = el('div', { class:'panel-box__head' });
    const titleEl = el('div', { class:'panel-box__title', text:title });
    const closeBtn = el('button', { type:'button', class:'panel-box__close', 'aria-label':'Zamknij', text:'×' });
    const body = el('div', { class:'panel-box__body' });

    const applyClasses = (node, value)=>{
      if(!node || value == null) return;
      String(value).split(/\s+/).map((token)=> token.trim()).filter(Boolean).forEach((token)=> node.classList.add(token));
    };
    applyClasses(overlay, opts.overlayClass);
    applyClasses(box, opts.boxClass);
    applyClasses(head, opts.headClass);
    applyClasses(body, opts.bodyClass);

    if(opts.contentNode instanceof Node){
      try{
        if(opts.contentNode.classList && opts.contentNode.classList.contains('panel-box-form')){
          body.classList.add('panel-box__body--form');
        }
      }catch(_){ }
      body.appendChild(opts.contentNode);
    }
    else if(typeof opts.html === 'string') body.innerHTML = opts.html;
    else if(typeof opts.message === 'string') body.textContent = opts.message;

    const explicitPosition = String(opts.position || '').toLowerCase();
    const shouldTopAlign = explicitPosition === 'top' || (!explicitPosition && (opts.contentNode instanceof Node));
    overlay.classList.add(shouldTopAlign ? 'panel-box-backdrop--top' : 'panel-box-backdrop--center');

    head.appendChild(titleEl);
    head.appendChild(closeBtn);
    box.appendChild(head);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    try{ document.documentElement.classList.add('modal-lock'); document.body.classList.add('modal-lock'); }catch(_){ }

    const requestClose = async (reason)=>{
      if(closePending) return;
      closePending = true;
      try{
        if(beforeClose){
          const verdict = await beforeClose({ reason: String(reason || 'close') });
          if(verdict === false) return;
        }
        close();
      }finally{
        closePending = false;
      }
    };

    const onKey = (e)=>{
      if(e.key === 'Escape' && dismissOnEsc){
        e.preventDefault();
        void requestClose('escape');
      }
    };
    document.addEventListener('keydown', onKey, true);

    closeBtn.addEventListener('click', ()=>{ void requestClose('button'); });
    overlay.addEventListener('pointerdown', (e)=>{
      if(e.target !== overlay) return;
      if(!dismissOnOverlay) return;
      void requestClose('overlay');
    });
    box.addEventListener('pointerdown', (e)=> e.stopPropagation());

    active = { root:overlay, onKey, requestClose };
    requestAnimationFrame(()=>{
      try{ overlay.scrollTop = 0; }catch(_){ }
      try{ body.scrollTop = 0; }catch(_){ }
      try{
        const innerScroll = body.querySelector('.panel-box-form__scroll');
        if(innerScroll) innerScroll.scrollTop = 0;
      }catch(_){ }
      try{ closeBtn.focus(); }catch(_){ }
    });
  }

  root.FC.panelBox = { open, close };
})();
