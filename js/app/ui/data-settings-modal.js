(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function open(){
    const store = FC.dataBackupStore;
    const snapshot = FC.dataBackupSnapshot;
    if(!(store && snapshot && h && FC.panelBox && typeof FC.panelBox.open === 'function')){
      if(dom.info) dom.info('Brak modułu backupu', 'Moduł backupu danych nie został załadowany.');
      return false;
    }

    let view = 'menu';
    const body = h('div', { class:'panel-box-form data-settings-modal' });
    const scroll = h('div', { class:'panel-box-form__scroll data-settings-scroll' });
    const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
    const footerActions = h('div', { class:'rozrys-panel-footer__actions' });
    const backBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wróć' });
    const closeBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wyjdź' });

    footerActions.appendChild(backBtn);
    footerActions.appendChild(closeBtn);
    footer.appendChild(footerActions);
    body.appendChild(scroll);
    body.appendChild(footer);

    function renderFooter(){ backBtn.style.display = view === 'backup' ? '' : 'none'; }
    function setView(next){ view = next === 'backup' ? 'backup' : 'menu'; render(); }
    function render(){
      renderFooter();
      if(view === 'backup') FC.dataSettingsBackupView.render({ scroll, store, snapshot, render });
      else FC.dataSettingsMenuView.render(scroll, setView);
    }

    backBtn.addEventListener('click', ()=> setView('menu'));
    closeBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    render();
    FC.panelBox.open({ title:'Ustawienia', contentNode:body, width:'920px', boxClass:'panel-box--rozrys data-settings-panel', dismissOnOverlay:false, dismissOnEsc:true });
    return true;
  }

  FC.dataSettingsModal = { open };
})();
