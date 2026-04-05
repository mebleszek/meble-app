(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function editor(){ return FC.investorEditorState || null; }
  function modals(){ return FC.investorModals || null; }
  function persistence(){ return FC.investorPersistence || null; }
  function guard(){ return FC.investorNavigationGuard || null; }

  function infoBox(){ return FC.infoBox || null; }
  function ui(){ return FC.investorUI || null; }

  function normalizeComparable(value){
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .replace(/\s+/g, ' ');
  }

  function isNewInvestor(investor){
    try{ return !!(ui() && ui().state && ui().state.newlyCreatedId && investor && String(ui().state.newlyCreatedId) === String(investor.id || '')); }catch(_){ return false; }
  }


  function isTransientInvestor(investor){
    try{
      const transient = ui() && typeof ui().getTransientInvestor === 'function' ? ui().getTransientInvestor() : (ui() && ui().state ? ui().state.transientInvestor : null);
      return !!(transient && investor && String(transient.id || '') === String(investor.id || ''));
    }catch(_){ return false; }
  }

  function clearNewInvestorFlag(id){
    try{
      if(ui() && ui().state && (!id || String(ui().state.newlyCreatedId || '') === String(id || ''))){
        ui().state.newlyCreatedId = null;
      }
    }catch(_){ }
  }

  function cleanupUnsavedNewInvestor(investor){
    if(!(investor && isNewInvestor(investor))) return;
    if(isTransientInvestor(investor)){
      try{ ui() && typeof ui().clearTransientInvestor === 'function' && ui().clearTransientInvestor(investor.id); }catch(_){ }
      clearNewInvestorFlag(investor.id);
      return;
    }
    try{ persistence() && persistence().removeInvestor && persistence().removeInvestor(investor.id); }catch(_){ }
    clearNewInvestorFlag(investor.id);
  }

  function requiredFieldErrors(draft){
    const d = draft || {};
    const isCompany = String(d.kind || 'person') === 'company';
    const checks = isCompany
      ? [
          ['companyName', 'Nazwa firmy'],
          ['ownerName', 'Właściciel — imię i nazwisko'],
          ['phone', 'Telefon'],
          ['email', 'Email'],
          ['city', 'Miejscowość'],
          ['address', 'Adres'],
          ['nip', 'NIP'],
          ['source', 'Źródło'],
          ['notes', 'Dodatkowe informacje'],
          ['addedDate', 'Data dodania'],
        ]
      : [
          ['name', 'Imię i nazwisko'],
          ['phone', 'Telefon'],
          ['email', 'Email'],
          ['city', 'Miejscowość'],
          ['address', 'Adres'],
          ['source', 'Źródło'],
          ['notes', 'Dodatkowe informacje'],
          ['addedDate', 'Data dodania'],
        ];
    return checks.filter(([key])=> !String(d[key] || '').trim()).map(([,label])=> label);
  }

  function findInvestorConflicts(investor, draft){
    const d = draft || {};
    const currentId = String(investor && investor.id || '');
    const list = persistence() && typeof persistence().searchInvestors === 'function' ? (persistence().searchInvestors('') || []) : [];
    const normalizedAddress = normalizeComparable(d.address);
    const normalizedName = normalizeComparable(d.name);
    const normalizedCompany = normalizeComparable(d.companyName);
    const normalizedOwner = normalizeComparable(d.ownerName);
    const exact = list.find((item)=> {
      if(!item || String(item.id || '') === currentId) return false;
      if(String(d.kind || 'person') === 'company') return normalizeComparable(item.companyName) === normalizedCompany && !!normalizedCompany;
      return normalizeComparable(item.name) === normalizedName && normalizeComparable(item.address) === normalizedAddress && !!normalizedName && !!normalizedAddress;
    }) || null;
    const ownerPerson = String(d.kind || 'person') === 'company'
      ? (list.find((item)=> {
          if(!item || String(item.id || '') === currentId) return false;
          if(String(item.kind || 'person') !== 'person') return false;
          if(!normalizedOwner) return false;
          return normalizeComparable(item.name) === normalizedOwner;
        }) || null)
      : null;
    const sameAddress = list.find((item)=> {
      if(!item || String(item.id || '') === currentId) return false;
      if(!normalizedAddress) return false;
      if(normalizeComparable(item.address) !== normalizedAddress) return false;
      if(exact && String(exact.id || '') === String(item.id || '')) return false;
      return true;
    }) || null;
    return { exact, ownerPerson, sameAddress };
  }

  async function validateBeforeSave(investor, draft, deps){
    const cfg = Object.assign({ onOpenExisting:null }, deps || {});
    const missing = requiredFieldErrors(draft);
    if(missing.length){
      try{ infoBox() && infoBox().open && infoBox().open({ title:'Uzupełnij wszystkie pola', message:`Brakuje: ${missing.join(', ')}.` }); }catch(_){ }
      return false;
    }
    const conflicts = findInvestorConflicts(investor, draft);
    const modalApi = modals();
    if(conflicts.exact && modalApi && typeof modalApi.resolveDuplicateInvestor === 'function'){
      const action = await modalApi.resolveDuplicateInvestor({ investor: conflicts.exact, mode:'exact', draft });
      if(action === 'open-existing'){
        cleanupUnsavedNewInvestor(investor);
        cfg.onOpenExisting && cfg.onOpenExisting(conflicts.exact.id);
        return false;
      }
      if(action !== 'add-anyway') return false;
    } else if(conflicts.ownerPerson && modalApi && typeof modalApi.resolveDuplicateInvestor === 'function'){
      const action = await modalApi.resolveDuplicateInvestor({ investor: conflicts.ownerPerson, mode:'owner-person', draft });
      if(action === 'open-existing'){
        cleanupUnsavedNewInvestor(investor);
        cfg.onOpenExisting && cfg.onOpenExisting(conflicts.ownerPerson.id);
        return false;
      }
      if(action !== 'add-anyway') return false;
    } else if(conflicts.sameAddress && modalApi && typeof modalApi.resolveDuplicateInvestor === 'function'){
      const action = await modalApi.resolveDuplicateInvestor({ investor: conflicts.sameAddress, mode:'address', draft });
      if(action === 'open-existing'){
        cleanupUnsavedNewInvestor(investor);
        cfg.onOpenExisting && cfg.onOpenExisting(conflicts.sameAddress.id);
        return false;
      }
      if(action !== 'add-anyway') return false;
    }
    return true;
  }


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
      cleanupUnsavedNewInvestor(investor);
      editorApi && editorApi.exit(investor);
      cfg.onRender && cfg.onRender();
      return;
    }
    if(action === 'cancel'){
      const ok = !(modals() && modals().confirmDiscardInvestorChanges) || await modals().confirmDiscardInvestorChanges();
      if(!ok) return;
      cleanupUnsavedNewInvestor(investor);
      editorApi && editorApi.exit(investor);
      cfg.onRender && cfg.onRender();
      return;
    }
    if(action === 'save'){
      const draft = editorApi ? editorApi.getDraft(investor) : null;
      const canContinue = await validateBeforeSave(investor, draft, { onOpenExisting: cfg.onOpenExisting });
      if(!canContinue) return;
      const ok = !(modals() && modals().confirmSaveInvestorChanges) || await modals().confirmSaveInvestorChanges();
      if(!ok) return;
      const patch = editorApi ? editorApi.commit(investor) : null;
      let savedInvestor = null;
      if(patch && persistence()){
        if(isTransientInvestor(investor) && typeof persistence().createInvestor === 'function'){
          savedInvestor = persistence().createInvestor(patch || {});
          try{ ui() && typeof ui().clearTransientInvestor === 'function' && ui().clearTransientInvestor(investor.id); }catch(_){ }
          try{
            if(ui() && ui().state){
              ui().state.selectedId = savedInvestor && savedInvestor.id ? savedInvestor.id : null;
              ui().state.mode = 'detail';
              ui().state.allowListAccess = false;
            }
          }catch(_){ }
        }else{
          savedInvestor = persistence().saveInvestorPatch(investor.id, patch);
        }
      }
      clearNewInvestorFlag(investor.id);
      if(savedInvestor && persistence() && typeof persistence().setCurrentInvestorId === 'function') persistence().setCurrentInvestorId(savedInvestor.id);
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
    _debug: {
      findInvestorConflicts,
      requiredFieldErrors,
    },
  };
})();
