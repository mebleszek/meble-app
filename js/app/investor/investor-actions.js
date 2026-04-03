(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function editor(){ return FC.investorEditorState || null; }
  function modals(){ return FC.investorModals || null; }
  function persistence(){ return FC.investorPersistence || null; }
  function guard(){ return FC.investorNavigationGuard || null; }

  function buildActionBarHtml(currentState){
    const state = currentState || { isEditing:false, dirty:false };
    if(!state.isEditing){
      return '<button class="btn-danger" type="button" data-investor-action="delete">Usuń</button><button class="btn" type="button" data-investor-action="edit">Edytuj</button>';
    }
    if(state.dirty){
      return '<button class="btn-danger" type="button" data-investor-action="cancel">Anuluj</button><button class="btn-success" type="button" data-investor-action="save">Zapisz</button>';
    }
    return '<button class="btn-primary" type="button" data-investor-action="exit">Wyjdź</button>';
  }

  async function handleTopAction(action, currentInvestor, deps){
    const cfg = Object.assign({ onRender:null, onDeleted:null }, deps || {});
    const editorApi = editor();
    const investor = currentInvestor && currentInvestor();
    if(!investor) return;

    if(action === 'edit'){
      editorApi && editorApi.enter(investor);
      cfg.onRender && cfg.onRender();
      return;
    }
    if(action === 'exit'){
      editorApi && editorApi.exit(investor);
      cfg.onRender && cfg.onRender();
      return;
    }
    if(action === 'cancel'){
      const ok = !(modals() && modals().confirmDiscardInvestorChanges) || await modals().confirmDiscardInvestorChanges();
      if(!ok) return;
      editorApi && editorApi.exit(investor);
      cfg.onRender && cfg.onRender();
      return;
    }
    if(action === 'save'){
      const ok = !(modals() && modals().confirmSaveInvestorChanges) || await modals().confirmSaveInvestorChanges();
      if(!ok) return;
      const patch = editorApi ? editorApi.commit(investor) : null;
      if(patch && persistence()) persistence().saveInvestorPatch(investor.id, patch);
      cfg.onRender && cfg.onRender();
      return;
    }
    if(action === 'delete'){
      const ok = !(modals() && modals().confirmDeleteInvestor) || await modals().confirmDeleteInvestor();
      if(!ok) return;
      persistence() && persistence().removeInvestor(investor.id);
      cfg.onDeleted && cfg.onDeleted(investor.id);
      return;
    }
  }

  function bindTopActions(container, deps){
    if(!container) return;
    container.querySelectorAll('[data-investor-action]').forEach((btn)=>{
      btn.addEventListener('click', async ()=>{
        const action = btn.getAttribute('data-investor-action');
        await handleTopAction(action, deps && deps.getCurrentInvestor, deps);
        try{ guard() && guard().apply(!!(editor() && editor().state.isEditing)); }catch(_){ }
      });
    });
  }

  FC.investorActions = {
    buildActionBarHtml,
    bindTopActions,
    handleTopAction,
  };
})();
