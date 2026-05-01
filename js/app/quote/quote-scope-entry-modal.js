(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const U = FC.quoteScopeEntryUtils || {};
  const Scope = FC.quoteScopeEntryScope || {};
  let activeModal = null;

  function h(tag, attrs, children){
    if(typeof U.h === 'function') return U.h(tag, attrs, children);
    const el = document.createElement(tag);
    if(attrs) Object.entries(attrs).forEach(([key, value])=>{ if(value != null) el.setAttribute(key, String(value)); });
    (children || []).forEach((child)=>{ if(child) el.appendChild(child); });
    return el;
  }

  function lockModal(){
    try{ document.documentElement.classList.add('modal-lock'); document.body.classList.add('modal-lock'); }catch(_){ }
  }

  function unlockModal(){
    try{ document.documentElement.classList.remove('modal-lock'); document.body.classList.remove('modal-lock'); }catch(_){ }
  }

  function closeActiveModal(result){
    const current = activeModal;
    activeModal = null;
    if(!current) return;
    try{ document.removeEventListener('keydown', current.onKey, true); }catch(_){ }
    try{ current.root.remove(); }catch(_){ }
    unlockModal();
    try{ current.resolve(result); }catch(_){ }
  }

  function openModal(build){
    if(activeModal) closeActiveModal({ cancelled:true });
    return new Promise((resolve)=>{
      const overlay = h('div', { class:'quote-scope-entry-backdrop' });
      const dialog = h('div', { class:'quote-scope-entry-modal', role:'dialog', 'aria-modal':'true' });
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      lockModal();
      const onKey = (event)=>{
        if(event.key === 'Escape'){
          event.preventDefault();
          closeActiveModal({ cancelled:true });
        }
      };
      document.addEventListener('keydown', onKey, true);
      activeModal = { root:overlay, resolve, onKey };
      build(dialog, overlay);
    });
  }

  function getScopeSummary(roomIds){
    return typeof Scope.getScopeSummary === 'function' ? Scope.getScopeSummary(roomIds) : { roomIds:[], roomLabels:[], scopeLabel:'wybrany zakres', isMultiRoom:false };
  }

  function getEffectiveVersionName(snapshot){
    return typeof Scope.getEffectiveVersionName === 'function' ? Scope.getEffectiveVersionName(snapshot) : '';
  }

  function buildSuggestedVersionName(projectId, roomIds, preliminary){
    return typeof Scope.buildSuggestedVersionName === 'function' ? Scope.buildSuggestedVersionName(projectId, roomIds, preliminary) : (preliminary ? 'Wstępna oferta' : 'Oferta');
  }

  function isVersionNameTaken(projectId, roomIds, preliminary, name){
    return typeof Scope.isVersionNameTaken === 'function' ? Scope.isVersionNameTaken(projectId, roomIds, preliminary, name) : false;
  }

  function openCreatedPreliminaryInfo(scope){
    const summary = scope && typeof scope === 'object' ? scope : getScopeSummary([]);
    return openModal((dialog)=>{
      const title = h('div', { class:'quote-scope-entry-modal__title', text:'NOWA WYCENA WSTĘPNA' });
      const head = h('div', { class:'quote-scope-entry-modal__head quote-scope-entry-modal__head--single' }, [title]);
      const body = h('div', { class:'quote-scope-entry-modal__body' });
      body.appendChild(h('div', { class:'quote-scope-entry-modal__message', text:'Powstała nowa wycena wstępna.' }));
      if(summary && summary.scopeLabel){
        body.appendChild(h('div', { class:'quote-scope-entry-modal__scope', text:`Pomieszczenia: ${summary.scopeLabel}` }));
      }
      const actions = h('div', { class:'quote-scope-entry-modal__actions quote-scope-entry-modal__actions--single' });
      const okBtn = h('button', { type:'button', class:'btn-success quote-scope-entry-modal__action', text:'OK' });
      actions.appendChild(okBtn);
      dialog.appendChild(head);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      okBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:false, action:'acknowledged' }));
      setTimeout(()=>{ try{ okBtn.focus(); }catch(_){ } }, 0);
    });
  }

  function openExistingOrCreateModal(scope, preliminary, existingSnapshot){
    return openModal((dialog, overlay)=>{
      const title = h('div', { class:'quote-scope-entry-modal__title', text: preliminary ? 'ISTNIEJE JUŻ WYCENA WSTĘPNA' : 'ISTNIEJE JUŻ WYCENA' });
      const closeBtn = h('button', { type:'button', class:'quote-scope-entry-modal__close', 'aria-label':'Zamknij okno', text:'×' });
      const head = h('div', { class:'quote-scope-entry-modal__head' }, [title, closeBtn]);
      const body = h('div', { class:'quote-scope-entry-modal__body' });
      const name = getEffectiveVersionName(existingSnapshot);
      body.appendChild(h('div', { class:'quote-scope-entry-modal__message', text:`Dla zakresu „${scope.scopeLabel}” istnieje już ${preliminary ? 'wycena wstępna' : 'wycena'}${name ? ` o nazwie „${name}”` : ''}.` }));
      body.appendChild(h('div', { class:'quote-scope-entry-modal__scope', text:`Pomieszczenia: ${scope.scopeLabel}` }));
      const actions = h('div', { class:'quote-scope-entry-modal__actions quote-scope-entry-modal__actions--stacked' });
      const backBtn = h('button', { type:'button', class:'btn-primary quote-scope-entry-modal__action', text:'Wróć' });
      const openBtn = h('button', { type:'button', class:'btn quote-scope-entry-modal__action', text:'Otwórz istniejącą' });
      const createBtn = h('button', { type:'button', class:'btn-success quote-scope-entry-modal__action', text:'Utwórz nową' });
      actions.appendChild(backBtn);
      actions.appendChild(openBtn);
      actions.appendChild(createBtn);
      dialog.appendChild(head);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      overlay.addEventListener('pointerdown', (event)=>{ if(event.target === overlay) closeActiveModal({ cancelled:true }); });
      closeBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:true }));
      backBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:true }));
      openBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:false, action:'open-existing' }));
      createBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:false, action:'create-new' }));
      setTimeout(()=>{ try{ openBtn.focus(); }catch(_){ } }, 0);
    });
  }

  function openNameModal(projectId, scope, preliminary, options){
    const opts = options && typeof options === 'object' ? options : {};
    return openModal((dialog, overlay)=>{
      const suggestedName = String(opts.suggestedName || buildSuggestedVersionName(projectId, scope.roomIds, preliminary) || '').trim();
      const submitLabel = String(opts.submitLabel || 'OK').trim() || 'OK';
      const cancelLabel = String(opts.cancelLabel || 'Anuluj').trim() || 'Anuluj';
      dialog.classList.add('panel-box', 'panel-box--rozrys', 'quote-scope-entry-modal--name');
      const title = h('div', { class:'panel-box__title quote-scope-entry-name__title', text: String(opts.title || (preliminary ? 'NAZWA NOWEJ WYCENY WSTĘPNEJ' : 'NAZWA NOWEJ WYCENY')).trim() || (preliminary ? 'NAZWA NOWEJ WYCENY WSTĘPNEJ' : 'NAZWA NOWEJ WYCENY') });
      const closeBtn = h('button', { type:'button', class:'panel-box__close quote-scope-entry-name__close', 'aria-label':'Zamknij okno', text:'×' });
      const head = h('div', { class:'panel-box__head quote-scope-entry-name__head' }, [title, closeBtn]);
      const body = h('div', { class:'panel-box__body panel-box__body--form quote-scope-entry-name__body' });
      const form = h('div', { class:'panel-box-form quote-scope-entry-name__form' });
      const scroll = h('div', { class:'panel-box-form__scroll quote-scope-entry-name__scroll' });
      scroll.appendChild(h('div', { class:'quote-scope-entry-name__message', text:String(opts.message || `Podaj nazwę dla nowej ${preliminary ? 'wyceny wstępnej' : 'wyceny'} dla zakresu „${scope.scopeLabel}”.`).trim() || `Podaj nazwę dla nowej ${preliminary ? 'wyceny wstępnej' : 'wyceny'} dla zakresu „${scope.scopeLabel}”.` }));
      const field = h('label', { class:'quote-scope-entry-name__field' });
      field.appendChild(h('span', { class:'quote-scope-entry-name__field-label', text:'Nazwa wyceny' }));
      const input = h('input', { type:'text', class:'investor-form-input quote-scope-entry-name__input', value:suggestedName, maxlength:'120', placeholder:suggestedName });
      field.appendChild(input);
      scroll.appendChild(field);
      const rawHint = Object.prototype.hasOwnProperty.call(opts, 'hint') ? opts.hint : undefined;
      const hintText = rawHint === false
        ? ''
        : String(rawHint == null ? 'Proponowana nazwa jest już przygotowana jako kolejny wariant dla tego samego zakresu. Możesz ją zmienić, ale nie możesz zapisać duplikatu.' : rawHint).trim();
      if(hintText) scroll.appendChild(h('div', { class:'quote-scope-entry-name__hint', text:hintText }));
      const footer = h('div', { class:'panel-box-form__footer quote-scope-entry-name__footer rozrys-picker-footer rozrys-picker-footer--material' });
      const actions = h('div', { class:'quote-scope-entry-name__actions rozrys-picker-footer-actions' });
      const cancelBtn = h('button', { type:'button', class:'btn-danger quote-scope-entry-name__action', text:cancelLabel });
      const submitBtn = h('button', { type:'button', class:'btn-success quote-scope-entry-name__action', text:submitLabel });
      actions.appendChild(cancelBtn);
      actions.appendChild(submitBtn);
      footer.appendChild(actions);
      form.appendChild(scroll);
      form.appendChild(footer);
      body.appendChild(form);
      dialog.appendChild(head);
      dialog.appendChild(body);

      const submit = ()=> {
        const value = String(input.value || '').trim();
        if(!value){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak nazwy wyceny', message:'Nadaj nazwę nowej wycenie, zanim ją utworzysz.', okOnly:true }); }catch(_){ }
          try{ input.focus(); }catch(_){ }
          return;
        }
        if(isVersionNameTaken(projectId, scope.roomIds, preliminary, value)){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Ta nazwa już istnieje', message:'Dla tego typu wyceny i dokładnie tego samego zakresu pomieszczeń istnieje już wersja o takiej nazwie. Nadaj inną nazwę.', okOnly:true }); }catch(_){ }
          try{ input.focus(); input.select(); }catch(_){ }
          return;
        }
        closeActiveModal({ cancelled:false, action:'create-new', versionName:value });
      };

      overlay.addEventListener('pointerdown', (event)=>{ if(event.target === overlay) closeActiveModal({ cancelled:true }); });
      closeBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:true }));
      cancelBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:true }));
      submitBtn.addEventListener('click', submit);
      input.addEventListener('keydown', (event)=>{
        if(event.key === 'Enter'){
          event.preventDefault();
          submit();
        }
      });
      setTimeout(()=>{
        try{ input.focus(); input.select(); }catch(_){ }
      }, 0);
    });
  }

  FC.quoteScopeEntryModal = {
    openModal,
    closeActiveModal,
    openCreatedPreliminaryInfo,
    openExistingOrCreateModal,
    openNameModal,
  };
})();
