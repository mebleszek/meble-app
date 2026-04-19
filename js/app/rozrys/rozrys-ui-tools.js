(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k==='class') el.className = attrs[k];
        else if(k==='html') el.innerHTML = attrs[k];
        else if(k==='text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children||[]).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function openRozrysInfo(title, message){
    const boxTitle = String(title || 'Informacja');
    const boxMessage = String(message || '');
    if(FC.infoBox && typeof FC.infoBox.open === 'function'){
      FC.infoBox.open({ title: boxTitle, message: boxMessage });
      return;
    }
    if(FC.panelBox && typeof FC.panelBox.open === 'function'){
      FC.panelBox.open({ title: boxTitle, message: boxMessage, width:'560px', boxClass:'panel-box--rozrys' });
      return;
    }
    console.warn('[ROZRYS]', boxTitle, boxMessage);
  }

  function labelWithInfo(title, infoTitle, infoMessage){
    const row = h('div', { class:'label-help' });
    row.appendChild(h('span', { class:'label-help__text', text:title }));
    if(infoMessage){
      const btn = h('button', { type:'button', class:'info-trigger', 'aria-label':`Pokaż informację: ${title}` });
      btn.addEventListener('click', ()=>{ openRozrysInfo(infoTitle || title, infoMessage); });
      row.appendChild(btn);
    }
    return row;
  }

  function getSelectOptionLabel(selectEl){
    return FC.rozrysChoice && typeof FC.rozrysChoice.getSelectOptionLabel === 'function'
      ? FC.rozrysChoice.getSelectOptionLabel(selectEl)
      : '';
  }

  function setChoiceLaunchValue(btn, label, meta){
    if(FC.rozrysChoice && typeof FC.rozrysChoice.setChoiceLaunchValue === 'function'){
      FC.rozrysChoice.setChoiceLaunchValue(btn, label, meta);
      return;
    }
  }

  function createChoiceLauncher(label, meta){
    if(FC.rozrysChoice && typeof FC.rozrysChoice.createChoiceLauncher === 'function'){
      return FC.rozrysChoice.createChoiceLauncher(label, meta);
    }
    return h('button', { type:'button', class:'rozrys-choice-launch', text:String(label || '') });
  }

  function openRozrysChoiceOverlay(opts){
    if(FC.rozrysChoice && typeof FC.rozrysChoice.openRozrysChoiceOverlay === 'function'){
      return FC.rozrysChoice.openRozrysChoiceOverlay(opts);
    }
    return Promise.resolve(null);
  }

  function askRozrysConfirm(opts){
    const cfg = Object.assign({
      title:'POTWIERDZENIE',
      message:'Czy kontynuować?',
      confirmText:'✓ TAK',
      cancelText:'WRÓĆ',
      confirmTone:'success',
      cancelTone:'neutral'
    }, opts || {});
    if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
      return FC.confirmBox.ask(cfg);
    }
    return new Promise((resolve)=>{
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')){
        resolve(false);
        return;
      }
      const body = h('div');
      body.appendChild(h('div', { class:'muted', style:'white-space:pre-wrap;line-height:1.5', text:String(cfg.message || '') }));
      const actions = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap' });
      const cancelBtn = h('button', { type:'button', class: cfg.cancelTone === 'danger' ? 'btn-danger' : 'btn-primary', text:String(cfg.cancelText || 'WRÓĆ') });
      const confirmBtn = h('button', { type:'button', class: cfg.confirmTone === 'danger' ? 'btn-danger' : 'btn-success', text:String(cfg.confirmText || '✓ TAK') });
      const done = (result)=>{
        try{ FC.panelBox.close(); }catch(_){ }
        resolve(!!result);
      };
      cancelBtn.addEventListener('click', ()=> done(false));
      confirmBtn.addEventListener('click', ()=> done(true));
      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      body.appendChild(actions);
      FC.panelBox.open({ title:String(cfg.title || 'POTWIERDZENIE'), contentNode: body, width:'560px', boxClass:'panel-box--rozrys', dismissOnOverlay:false, dismissOnEsc:true });
    });
  }

  FC.rozrysUiTools = {
    createApi(){
      return {
        h,
        labelWithInfo,
        openRozrysInfo,
        getSelectOptionLabel,
        setChoiceLaunchValue,
        createChoiceLauncher,
        openRozrysChoiceOverlay,
        askRozrysConfirm,
      };
    }
  };
})();
