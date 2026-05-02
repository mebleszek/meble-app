(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const model = FC.wycenaTabSelectionModel || {};
  const normalizeDraftSelection = typeof model.normalizeDraftSelection === 'function'
    ? model.normalizeDraftSelection
    : (()=> ({ selectedRooms:[], materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } }));
  const resolveVersionNameAfterRoomChange = typeof model.resolveVersionNameAfterRoomChange === 'function'
    ? model.resolveVersionNameAfterRoomChange
    : (()=> '');
  const getActiveRoomIds = typeof model.getActiveRoomIds === 'function'
    ? model.getActiveRoomIds
    : (()=> []);
  const getRoomLabel = typeof model.getRoomLabel === 'function'
    ? model.getRoomLabel
    : ((roomId)=> String(roomId || ''));

  function isRoomDisabledForQuote(roomId){
    try{ return !!(FC.wycenaRoomAvailability && typeof FC.wycenaRoomAvailability.isQuoteableRoom === 'function' && !FC.wycenaRoomAvailability.isQuoteableRoom(roomId)); }
    catch(_){ return false; }
  }

  function roomDisabledReason(roomId){
    try{ return FC.wycenaRoomAvailability && typeof FC.wycenaRoomAvailability.getQuoteBlockReason === 'function' ? FC.wycenaRoomAvailability.getQuoteBlockReason(roomId) : ''; }
    catch(_){ return ''; }
  }

  function filterQuoteableRoomIds(roomIds){
    try{ return FC.wycenaRoomAvailability && typeof FC.wycenaRoomAvailability.filterQuoteableRoomIds === 'function' ? FC.wycenaRoomAvailability.filterQuoteableRoomIds(roomIds) : (Array.isArray(roomIds) ? roomIds : []); }
    catch(_){ return Array.isArray(roomIds) ? roomIds : []; }
  }

  function openQuoteRoomsPicker(ctx, deps){
    const getOfferDraft = deps && typeof deps.getOfferDraft === 'function' ? deps.getOfferDraft : ()=> ({});
    const patchOfferDraft = deps && typeof deps.patchOfferDraft === 'function' ? deps.patchOfferDraft : ()=>{};
    const render = deps && typeof deps.render === 'function' ? deps.render : ()=>{};
    const askConfirm = deps && typeof deps.askConfirm === 'function' ? deps.askConfirm : null;
    const selection = normalizeDraftSelection(getOfferDraft());
    try{
      if(!(FC.rozrysPickers && typeof FC.rozrysPickers.openRoomsPicker === 'function')) return;
      FC.rozrysPickers.openRoomsPicker({
        getSelectedRooms: ()=> selection.selectedRooms,
        setSelectedRooms: (rooms)=>{
          const nextRooms = filterQuoteableRoomIds(Array.isArray(rooms) ? rooms.slice() : []);
          const draft = getOfferDraft();
          const commercial = draft && draft.commercial || {};
          const nextVersionName = resolveVersionNameAfterRoomChange(selection, nextRooms, draft, deps);
          const patch = { selection:{ selectedRooms:nextRooms } };
          if(String(nextVersionName || '').trim()){
            patch.commercial = Object.assign({}, commercial, { versionName:String(nextVersionName || '').trim() });
          }
          patchOfferDraft(patch);
          render(ctx);
        },
        getRooms: getActiveRoomIds,
        normalizeRoomSelection: (rooms)=>{
          let normalized = [];
          try{ normalized = FC.rozrysScope && typeof FC.rozrysScope.normalizeRoomSelection === 'function' ? FC.rozrysScope.normalizeRoomSelection(rooms, { getRooms:getActiveRoomIds }) : (Array.isArray(rooms) ? rooms : []); }
          catch(_){ normalized = Array.isArray(rooms) ? rooms : []; }
          return filterQuoteableRoomIds(normalized);
        },
        roomLabel: (roomId)=> getRoomLabel(roomId),
        isRoomDisabled: isRoomDisabledForQuote,
        roomDisabledReason,
        askConfirm,
        refreshSelectionState: ()=> render(ctx),
      });
    }catch(_){ }
  }

  function openQuoteScopePicker(ctx, deps){
    const getOfferDraft = deps && typeof deps.getOfferDraft === 'function' ? deps.getOfferDraft : ()=> ({});
    const patchOfferDraft = deps && typeof deps.patchOfferDraft === 'function' ? deps.patchOfferDraft : ()=>{};
    const render = deps && typeof deps.render === 'function' ? deps.render : ()=>{};
    const askConfirm = deps && typeof deps.askConfirm === 'function' ? deps.askConfirm : (()=> Promise.resolve(true));
    const h = deps && typeof deps.h === 'function' ? deps.h : null;
    if(typeof h !== 'function') return;
    const draft = getOfferDraft();
    const selection = normalizeDraftSelection(draft);
    const currentScope = Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection && selection.materialScope || {});
    try{
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
      const body = h('div', { class:'rozrys-picker-modal' });
      const list = h('div', { class:'rozrys-picker-list' });
      const cardNode = h('div', { class:'rozrys-picker-option rozrys-picker-card is-selected' });
      const titleWrap = h('div', { class:'rozrys-picker-option__title-wrap' });
      titleWrap.appendChild(h('div', { class:'rozrys-picker-option__title', text:'Zakres elementów do wyceny' }));
      titleWrap.appendChild(h('div', { class:'rozrys-picker-option__subtitle', text:'Wybierz dokładnie tak samo jak w ROZRYS, co ma wejść do tej wyceny.' }));
      cardNode.appendChild(titleWrap);
      const chips = h('div', { class:'rozrys-scope-chips quote-scope-picker-chips' });
      const draftScope = Object.assign({}, currentScope);
      const bindChip = (label, key)=>{
        const chip = h('label', { class:`rozrys-scope-chip rozrys-scope-chip--room-match${draftScope[key] ? ' is-checked' : ''}` });
        const cb = h('input', { type:'checkbox' });
        cb.checked = !!draftScope[key];
        cb.addEventListener('change', ()=>{
          draftScope[key] = !!cb.checked;
          if(!draftScope.includeFronts && !draftScope.includeCorpus){
            draftScope[key] = true;
            cb.checked = true;
          }
          chip.classList.toggle('is-checked', !!cb.checked);
          updateFooterState();
        });
        chip.appendChild(cb);
        chip.appendChild(h('span', { text:label }));
        chips.appendChild(chip);
      };
      bindChip('Fronty', 'includeFronts');
      bindChip('Korpusy', 'includeCorpus');
      cardNode.appendChild(chips);
      list.appendChild(cardNode);
      body.appendChild(list);

      const footer = h('div', { class:'rozrys-picker-footer rozrys-picker-footer--material' });
      const actionWrap = h('div', { class:'rozrys-picker-footer-actions' });
      const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' });
      const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' });
      const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zatwierdź' });
      const isDirty = ()=> (!!draftScope.includeFronts !== !!currentScope.includeFronts) || (!!draftScope.includeCorpus !== !!currentScope.includeCorpus);
      const updateFooterState = ()=>{
        actionWrap.innerHTML = '';
        if(isDirty()){
          saveBtn.disabled = !(draftScope.includeFronts || draftScope.includeCorpus);
          actionWrap.appendChild(cancelBtn);
          actionWrap.appendChild(saveBtn);
        }else{
          actionWrap.appendChild(exitBtn);
        }
      };
      exitBtn.addEventListener('click', ()=> FC.panelBox.close());
      cancelBtn.addEventListener('click', async ()=>{
        const ok = await askConfirm({
          title:'ANULOWAĆ ZMIANY?',
          message:'Niezapisane zmiany w wyborze zakresu wyceny zostaną utracone.',
          confirmText:'✕ ANULUJ ZMIANY',
          cancelText:'WRÓĆ',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
        if(!ok) return;
        FC.panelBox.close();
      });
      saveBtn.addEventListener('click', ()=>{
        if(!(draftScope.includeFronts || draftScope.includeCorpus)) return;
        patchOfferDraft({ selection:{ materialScope:Object.assign({}, draftScope) } });
        FC.panelBox.close();
        render(ctx);
      });
      updateFooterState();
      footer.appendChild(actionWrap);
      body.appendChild(footer);
      FC.panelBox.open({
        title:'Wybierz zakres wyceny',
        contentNode: body,
        width:'820px',
        boxClass:'panel-box--rozrys',
        dismissOnOverlay:false,
        beforeClose: ()=> isDirty() ? askConfirm({
          title:'ANULOWAĆ ZMIANY?',
          message:'Niezapisane zmiany w wyborze zakresu wyceny zostaną utracone.',
          confirmText:'✕ ANULUJ ZMIANY',
          cancelText:'WRÓĆ',
          confirmTone:'danger',
          cancelTone:'neutral'
        }) : true
      });
    }catch(_){ }
  }

  FC.wycenaTabSelectionPickers = {
    openQuoteRoomsPicker,
    openQuoteScopePicker,
  };
})();
