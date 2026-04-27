// js/app/rysunek/rysunek-dialogs.js
// Adapter własnych modali dla zakładki RYSUNEK. Bez fallbacków do alert/confirm/prompt.
(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function hasDocument(){
    return !!(host.document && typeof host.document.createElement === 'function');
  }

  function openInfo(opts){
    opts = opts || {};
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({
          title:String(opts.title || 'Rysunek'),
          message:String(opts.message || ''),
          okOnly: !!opts.okOnly,
          dismissOnOverlay: opts.dismissOnOverlay,
          dismissOnEsc: opts.dismissOnEsc
        });
      }
    }catch(_){ }
  }

  function askConfirm(opts){
    opts = opts || {};
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        const result = FC.confirmBox.ask({
          title:String(opts.title || 'Potwierdzenie'),
          message:String(opts.message || 'Czy kontynuować?'),
          confirmText:String(opts.confirmText || 'Zatwierdź'),
          cancelText:String(opts.cancelText || 'Wróć'),
          confirmTone:String(opts.confirmTone || 'success'),
          cancelTone:String(opts.cancelTone || 'neutral'),
          dismissOnOverlay: opts.dismissOnOverlay,
          dismissOnEsc: opts.dismissOnEsc
        });
        return Promise.resolve(result).then(Boolean).catch(()=> false);
      }
    }catch(_){ }
    return Promise.resolve(false);
  }

  function makeNode(tag, attrs, children){
    const node = host.document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key, value])=>{
        if(value == null) return;
        if(key === 'class') node.className = String(value);
        else if(key === 'text') node.textContent = String(value);
        else if(key === 'style') node.setAttribute('style', String(value));
        else node.setAttribute(key, String(value));
      });
    }
    (children || []).forEach((child)=>{ if(child) node.appendChild(child); });
    return node;
  }

  function askNumber(opts){
    opts = opts || {};
    if(!hasDocument()) return Promise.resolve(null);
    try{
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return Promise.resolve(null);
      return new Promise((resolve)=>{
        const defaultValue = opts.defaultValue == null ? '' : String(opts.defaultValue);
        const body = makeNode('div', { class:'panel-box-form rysunek-number-dialog' });
        const scroll = makeNode('div', { class:'panel-box-form__scroll' });
        const label = makeNode('label', { class:'field' });
        const labelText = makeNode('span', { class:'muted xs', text:String(opts.label || 'Wartość (cm):') });
        const input = makeNode('input', { type:'number', step:'0.1', inputmode:'decimal', value:defaultValue, 'aria-label':String(opts.label || 'Wartość') });
        label.appendChild(labelText);
        label.appendChild(input);
        scroll.appendChild(label);

        const actions = makeNode('div', { class:'panel-box-form__actions', style:'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;' });
        const cancelBtn = makeNode('button', { type:'button', class:'btn', text:String(opts.cancelText || 'Wróć') });
        const confirmBtn = makeNode('button', { type:'button', class:'btn-success', text:String(opts.confirmText || 'Zatwierdź') });
        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        body.appendChild(scroll);
        body.appendChild(actions);

        let done = false;
        const finish = (value)=>{
          if(done) return;
          done = true;
          try{ FC.panelBox.close(); }catch(_){ }
          resolve(value);
        };
        cancelBtn.addEventListener('click', ()=> finish(null));
        confirmBtn.addEventListener('click', ()=>{
          const value = parseFloat(String(input.value || '').replace(',', '.'));
          finish(Number.isFinite(value) ? value : null);
        });
        input.addEventListener('keydown', (ev)=>{
          if(ev.key === 'Enter'){
            ev.preventDefault();
            confirmBtn.click();
          }
        });

        FC.panelBox.open({
          title:String(opts.title || 'Podaj wartość'),
          contentNode:body,
          width:String(opts.width || '420px'),
          boxClass:'panel-box--rozrys',
          dismissOnOverlay:false,
          dismissOnEsc:true,
          beforeClose:()=>{ finish(null); return false; }
        });
        setTimeout(()=>{ try{ input.focus(); input.select(); }catch(_){ } }, 0);
      });
    }catch(_){
      return Promise.resolve(null);
    }
  }

  FC.rysunekDialogs = {
    info: openInfo,
    askConfirm,
    askNumber,
    confirmRebuildLayout: ()=> askConfirm({
      title:'Odbudować układ?',
      message:'Odbudować układ segmentu z aktualnej listy szafek? Uwaga: usuwa PRZERWY w układzie, NIE usuwa wykończeń.',
      confirmText:'Odbuduj',
      cancelText:'Wróć',
      confirmTone:'success',
      cancelTone:'neutral',
      dismissOnOverlay:false
    }),
    confirmDeleteGap: ()=> askConfirm({
      title:'Usunąć przerwę?',
      message:'Przerwa zostanie usunięta z układu segmentu.',
      confirmText:'Usuń',
      cancelText:'Wróć',
      confirmTone:'danger',
      cancelTone:'neutral',
      dismissOnOverlay:false
    })
  };
})(typeof window !== 'undefined' ? window : globalThis);
