(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  async function ask(cfg){
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') return !!(await FC.confirmBox.ask(cfg));
    }catch(_){ }
    return true;
  }

  function info(title, message){
    try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title, message }); }catch(_){ }
  }

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach((k)=>{
        if(k === 'class') el.className = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function confirmDiscardInvestorChanges(){
    return ask({ title:'ANULOWAĆ ZMIANY?', message:'Niezapisane zmiany inwestora zostaną utracone.', confirmText:'✕ ANULUJ ZMIANY', cancelText:'WRÓĆ', confirmTone:'danger', cancelTone:'neutral' });
  }

  function confirmSaveInvestorChanges(){
    return ask({ title:'ZAPISAĆ ZMIANY?', message:'Zapisać zmiany w danych inwestora?', confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
  }

  function confirmDeleteInvestor(){
    return ask({ title:'Usunąć inwestora?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
  }

  function confirmStatusChange(prevLabel, nextLabel){
    return ask({ title:'ZMIENIĆ STATUS?', message:`Status zmieni się z "${prevLabel}" na "${nextLabel}".`, confirmText:'Zmień', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
  }

  function resolveDuplicateInvestor(opts){
    const cfg = Object.assign({ investor:null, mode:'exact' }, opts || {});
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return Promise.resolve('back');
    return new Promise((resolve)=>{
      const inv = cfg.investor || {};
      const name = String(inv.kind === 'company' ? (inv.companyName || '(Firma bez nazwy)') : (inv.name || '(Bez nazwy)'));
      const titleText = cfg.mode === 'exact' ? 'Inwestor już istnieje' : 'Ten adres już istnieje';
      const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock investor-duplicate-modal' });
      const scroll = h('div', { class:'panel-box-form__scroll' });
      scroll.appendChild(h('div', { class:'muted', text: cfg.mode === 'exact'
        ? 'W bazie jest już inwestor o takich samych danych.'
        : 'W bazie jest już inwestor pod tym samym adresem.' }));
      const card = h('div', { class:'investor-duplicate-card' });
      card.appendChild(h('div', { class:'investor-duplicate-card__title', text:name }));
      card.appendChild(h('div', { class:'investor-duplicate-card__sub', text:[inv.address, inv.phone].filter(Boolean).join(' • ') || 'Istniejący wpis' }));
      scroll.appendChild(card);
      body.appendChild(scroll);
      const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = h('div', { class:'rozrys-panel-footer__actions investor-duplicate-actions' });
      const backBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wróć do edycji' });
      const openBtn = h('button', { type:'button', class:'btn', text:'Przejdź do istniejącego' });
      const addBtn = h('button', { type:'button', class:'btn btn-success', text:'Dodaj mimo to' });
      [backBtn, openBtn, addBtn].forEach((btn)=> actions.appendChild(btn));
      footer.appendChild(actions);
      body.appendChild(footer);
      const done = (result)=>{ try{ FC.panelBox.close(); }catch(_){ } resolve(result || 'back'); };
      backBtn.addEventListener('click', ()=> done('back'));
      openBtn.addEventListener('click', ()=> done('open-existing'));
      addBtn.addEventListener('click', ()=> done('add-anyway'));
      FC.panelBox.open({ title:titleText, contentNode: body, width:'620px', boxClass:'panel-box--rozrys', dismissOnOverlay:false, dismissOnEsc:true });
    });
  }

  FC.investorModals = {
    ask,
    info,
    confirmDiscardInvestorChanges,
    confirmSaveInvestorChanges,
    confirmDeleteInvestor,
    confirmStatusChange,
    resolveDuplicateInvestor,
  };
})();
