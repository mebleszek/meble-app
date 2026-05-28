(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children, doc){
    const resolvedDoc = doc && typeof doc.createElement === 'function' ? doc : document;
    const el = resolvedDoc.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k === 'class') el.className = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function releaseChipFocus(target){
    try{
      if(target && typeof target.blur === 'function') target.blur();
    }catch(_error){}
  }

  function openRoomsPicker(deps){
    const cfg = Object.assign({
      getSelectedRooms:null,
      setSelectedRooms:null,
      getRooms:null,
      normalizeRoomSelection:null,
      roomLabel:null,
      askConfirm:null,
      refreshSelectionState:null,
      isRoomDisabled:null,
      roomDisabledReason:null,
      doc:null,
    }, deps || {});
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const currentRooms = typeof cfg.getSelectedRooms === 'function' ? cfg.getSelectedRooms() : [];
    const body = h('div', { class:'rozrys-picker-modal' }, null, cfg.doc);
    const list = h('div', { class:'rozrys-picker-list' }, null, cfg.doc);
    const checkboxes = [];
    const normalizeRoomSelection = typeof cfg.normalizeRoomSelection === 'function'
      ? cfg.normalizeRoomSelection
      : (rooms)=> Array.isArray(rooms) ? rooms.slice() : [];
    const getRooms = typeof cfg.getRooms === 'function' ? cfg.getRooms : ()=> [];
    const roomLabel = typeof cfg.roomLabel === 'function' ? cfg.roomLabel : (room)=> String(room || '');
    const isRoomDisabled = typeof cfg.isRoomDisabled === 'function' ? cfg.isRoomDisabled : (()=> false);
    const roomDisabledReason = typeof cfg.roomDisabledReason === 'function' ? cfg.roomDisabledReason : (()=> '');
    const allRooms = getRooms();
    const selectableRooms = allRooms.filter((room)=> !isRoomDisabled(room));
    const draft = new Set(normalizeRoomSelection(currentRooms).filter((room)=> selectableRooms.includes(room)));
    const initialSignature = JSON.stringify(normalizeRoomSelection(currentRooms).filter((room)=> selectableRooms.includes(room)));
    const nextRooms = ()=> normalizeRoomSelection(Array.from(draft)).filter((room)=> selectableRooms.includes(room));
    const hasSelection = ()=> nextRooms().length > 0;
    const isDirty = ()=> JSON.stringify(nextRooms()) !== initialSignature;

    allRooms.forEach((room)=>{
      const disabledRoom = !!isRoomDisabled(room);
      const cardNode = h('label', { class:'rozrys-scope-chip rozrys-scope-chip--room-match rozrys-scope-chip--room-option' + (disabledRoom ? ' is-disabled' : '') }, null, cfg.doc);
      const top = h('div', { class:'rozrys-room-chip__top' }, null, cfg.doc);
      const cb = h('input', { type:'checkbox' }, null, cfg.doc);
      const titleWrap = h('div', { class:'rozrys-room-chip__text' }, null, cfg.doc);
      const titleNode = h('div', { class:'rozrys-room-chip__label', text:roomLabel(room) }, null, cfg.doc);
      titleWrap.appendChild(titleNode);
      if(disabledRoom){
        cb.disabled = true;
        cb.checked = false;
        const reason = String(roomDisabledReason(room) || 'Niedostępne').trim();
        titleWrap.appendChild(h('div', { class:'rozrys-room-chip__note', text:reason }, null, cfg.doc));
        draft.delete(room);
      }
      const syncCardState = ()=> cardNode.classList.toggle('is-checked', !disabledRoom && !!cb.checked);
      cb.checked = !disabledRoom && draft.has(room);
      syncCardState();
      checkboxes.push({ room, cb, syncCardState, disabledRoom });
      cb.addEventListener('change', ()=>{
        if(disabledRoom){
          cb.checked = false;
          draft.delete(room);
          syncCardState();
          updateFooterState();
          return;
        }
        if(cb.checked) draft.add(room);
        else draft.delete(room);
        syncCardState();
        updateFooterState();
        releaseChipFocus(cb);
        releaseChipFocus(cardNode);
      });
      top.appendChild(cb);
      top.appendChild(titleWrap);
      cardNode.appendChild(top);
      list.appendChild(cardNode);
    });
    body.appendChild(list);

    const footer = h('div', { class:'rozrys-picker-footer' }, null, cfg.doc);
    const allBtn = h('button', { type:'button', class:'btn', text:'Wszystkie' }, null, cfg.doc);
    const actionWrap = h('div', { class:'rozrys-picker-footer-actions' }, null, cfg.doc);
    const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' }, null, cfg.doc);
    const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' }, null, cfg.doc);
    const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zatwierdź' }, null, cfg.doc);

    function renderFooterActions(){
      actionWrap.innerHTML = '';
      if(isDirty()){
        actionWrap.appendChild(cancelBtn);
        actionWrap.appendChild(saveBtn);
      }else{
        actionWrap.appendChild(exitBtn);
      }
    }

    function updateFooterState(){
      saveBtn.disabled = !isDirty() || !hasSelection();
      renderFooterActions();
    }

    allBtn.disabled = selectableRooms.length === 0;
    allBtn.addEventListener('click', ()=>{
      draft.clear();
      selectableRooms.forEach((room)=> draft.add(room));
      checkboxes.forEach(({ room, cb, syncCardState, disabledRoom })=>{
        cb.checked = !disabledRoom && draft.has(room);
        if(typeof syncCardState === 'function') syncCardState();
      });
      updateFooterState();
    });
    exitBtn.addEventListener('click', ()=> FC.panelBox.close());
    cancelBtn.addEventListener('click', async ()=>{
      const ok = typeof cfg.askConfirm === 'function' ? await cfg.askConfirm({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w wyborze pomieszczeń zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      }) : true;
      if(!ok) return;
      FC.panelBox.close();
    });
    saveBtn.addEventListener('click', ()=>{
      const pickedRooms = nextRooms();
      if(!pickedRooms.length || !isDirty()) return;
      if(typeof cfg.setSelectedRooms === 'function') cfg.setSelectedRooms(pickedRooms);
      FC.panelBox.close();
      if(typeof cfg.refreshSelectionState === 'function') cfg.refreshSelectionState();
    });
    updateFooterState();
    footer.appendChild(allBtn);
    footer.appendChild(actionWrap);
    body.appendChild(footer);
    FC.panelBox.open({
      title:'Wybierz pomieszczenia',
      contentNode: body,
      width:'820px',
      boxClass:'panel-box--rozrys',
      dismissOnOverlay:false,
      beforeClose: ()=> isDirty() ? (typeof cfg.askConfirm === 'function' ? cfg.askConfirm({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w wyborze pomieszczeń zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      }) : true) : true
    });
  }

  function openMaterialPicker(deps){
    const cfg = Object.assign({
      getMaterialScope:null,
      setMaterialScope:null,
      makeMaterialScope:null,
      aggregate:null,
      splitMaterialAccordionTitle:null,
      buildScopeDraftControls:null,
      normalizeMaterialScopeForAggregate:null,
      askConfirm:null,
      refreshSelectionState:null,
    }, deps || {});
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const agg = cfg.aggregate || { materials:[], groups:{} };
    const body = h('div', { class:'rozrys-picker-modal' }, null, cfg.doc);
    const list = h('div', { class:'rozrys-picker-list' }, null, cfg.doc);
    const makeMaterialScope = typeof cfg.makeMaterialScope === 'function'
      ? cfg.makeMaterialScope
      : (scope)=> Object.assign({ kind:'all', material:'', includeFronts:false, includeCorpus:false }, scope || {});
    const currentScope = typeof cfg.getMaterialScope === 'function' ? cfg.getMaterialScope() : null;
    const initialScope = makeMaterialScope(currentScope, { allowEmpty:true });
    const draftScope = makeMaterialScope(initialScope, { allowEmpty:true });
    const cards = [];
    const getCardKey = (config)=> `${config.kind}:${config.kind === 'material' ? String(config.material || '') : 'all'}`;
    const splitMaterialAccordionTitle = typeof cfg.splitMaterialAccordionTitle === 'function'
      ? cfg.splitMaterialAccordionTitle
      : (material)=> ({ line1:String(material || 'Materiał'), line2:'' });
    const buildScopeDraftControls = typeof cfg.buildScopeDraftControls === 'function'
      ? cfg.buildScopeDraftControls
      : ()=>{};
    const normalizeMaterialScopeForAggregate = typeof cfg.normalizeMaterialScopeForAggregate === 'function'
      ? cfg.normalizeMaterialScopeForAggregate
      : (scope)=> scope;

    const scopeSignature = (scope)=>{
      const normalized = makeMaterialScope(scope, { allowEmpty:true });
      return JSON.stringify({
        kind: normalized.kind,
        material: normalized.material || '',
        includeFronts: !!normalized.includeFronts,
        includeCorpus: !!normalized.includeCorpus
      });
    };
    const initialSignature = scopeSignature(initialScope);
    const hasDraftSelection = ()=> !!(draftScope.includeFronts || draftScope.includeCorpus);
    const isDirty = ()=> scopeSignature(draftScope) !== initialSignature;
    const setDraftScope = (config, localScope)=>{
      draftScope.kind = config.kind;
      draftScope.material = config.kind === 'material' ? String(config.material || '') : '';
      draftScope.includeFronts = !!localScope.includeFronts;
      draftScope.includeCorpus = !!localScope.includeCorpus;
    };

    function renderFooterActions(){
      actionWrap.innerHTML = '';
      if(isDirty()){
        actionWrap.appendChild(cancelBtn);
        actionWrap.appendChild(saveBtn);
      }else{
        actionWrap.appendChild(exitBtn);
      }
    }

    function updateFooterState(){
      saveBtn.disabled = !isDirty() || !hasDraftSelection();
      renderFooterActions();
    }

    const entryHasSelection = (entry)=> !!(entry && entry.localScope && (entry.localScope.includeFronts || entry.localScope.includeCorpus));

    function syncDraftFromCards(preferredKey){
      const preferred = preferredKey ? cards.find((entry)=> entry.key === preferredKey && entryHasSelection(entry)) : null;
      const activeEntry = preferred || cards.find((entry)=> entryHasSelection(entry)) || null;
      if(activeEntry){
        setDraftScope(activeEntry.config, activeEntry.localScope);
      }else{
        draftScope.kind = 'all';
        draftScope.material = '';
        draftScope.includeFronts = false;
        draftScope.includeCorpus = false;
      }
      cards.forEach((entry)=> {
        entry.node.classList.toggle('has-selection', entryHasSelection(entry));
        entry.node.classList.toggle('is-selected', !!activeEntry && entry.key === activeEntry.key);
      });
      updateFooterState();
    }

    function markSelected(preferredKey){
      syncDraftFromCards(preferredKey);
    }

    const clearOtherSelections = (exceptKey)=>{
      cards.forEach((entry)=>{
        if(entry.key === exceptKey) return;
        entry.localScope.includeFronts = false;
        entry.localScope.includeCorpus = false;
        entry.scopeHolder.innerHTML = '';
        buildScopeDraftControls(entry.scopeHolder, entry.localScope, !!entry.config.hasFronts, !!entry.config.hasCorpus, {
          allowEmpty:true,
          onChange: ()=>{
            if(entry.localScope.includeFronts || entry.localScope.includeCorpus){
              clearOtherSelections(entry.key);
              setDraftScope(entry.config, entry.localScope);
            }else if(draftScope.kind === entry.config.kind && (entry.config.kind !== 'material' || draftScope.material === entry.config.material)){
              draftScope.kind = 'all';
              draftScope.material = '';
              draftScope.includeFronts = false;
              draftScope.includeCorpus = false;
            }
            markSelected();
          }
        });
      });
    };

    const renderCard = (config)=>{
      const cardNode = h('div', { class:'rozrys-picker-option rozrys-picker-card' });
      const titleWrap = h('div', { class:'rozrys-picker-option__title-wrap' });
      titleWrap.appendChild(h('div', { class:'rozrys-picker-option__title', text:config.title }));
      if(config.subtitle) titleWrap.appendChild(h('div', { class:'rozrys-picker-option__subtitle', text:config.subtitle }));
      cardNode.appendChild(titleWrap);
      const scopeHolder = h('div');
      const localScope = makeMaterialScope({
        kind:config.kind,
        material:config.material || '',
        includeFronts:false,
        includeCorpus:false,
      }, { allowEmpty:true });
      if(initialScope.kind === config.kind && (config.kind !== 'material' || initialScope.material === config.material)){
        localScope.includeFronts = !!initialScope.includeFronts;
        localScope.includeCorpus = !!initialScope.includeCorpus;
      }
      const key = getCardKey(config);
      buildScopeDraftControls(scopeHolder, localScope, !!config.hasFronts, !!config.hasCorpus, {
        allowEmpty:true,
        onChange: ()=>{
          if(localScope.includeFronts || localScope.includeCorpus){
            clearOtherSelections(key);
            syncDraftFromCards(key);
          }else{
            syncDraftFromCards();
          }
        }
      });
      scopeHolder.addEventListener('click', (e)=> e.stopPropagation());
      cardNode.addEventListener('click', ()=>{
        if(!localScope.includeFronts && !localScope.includeCorpus) return;
        clearOtherSelections(key);
        syncDraftFromCards(key);
      });
      cardNode.appendChild(scopeHolder);
      cards.push({ key, node: cardNode, config, localScope, scopeHolder });
      return cardNode;
    };

    const anyFronts = (Array.isArray(agg.materials) ? agg.materials : []).some((material)=> !!(agg.groups && agg.groups[material] && agg.groups[material].hasFronts));
    const anyCorpus = (Array.isArray(agg.materials) ? agg.materials : []).some((material)=> !!(agg.groups && agg.groups[material] && agg.groups[material].hasCorpus));
    list.appendChild(renderCard({
      kind:'all',
      title:'Wszystkie materiały',
      subtitle:'Zaznaczone pomieszczenia',
      hasFronts:anyFronts,
      hasCorpus:anyCorpus,
    }));

    (Array.isArray(agg.materials) ? agg.materials : []).forEach((material)=>{
      const group = agg.groups && agg.groups[material] ? agg.groups[material] : null;
      if(!group) return;
      const split = splitMaterialAccordionTitle(material);
      list.appendChild(renderCard({
        kind:'material',
        material,
        title:split.line1 || material,
        subtitle:split.line2 || '',
        hasFronts:!!group.hasFronts,
        hasCorpus:!!group.hasCorpus,
      }));
    });
    body.appendChild(list);

    const footer = h('div', { class:'rozrys-picker-footer rozrys-picker-footer--material' });
    const actionWrap = h('div', { class:'rozrys-picker-footer-actions' });
    const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' });
    const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' });
    const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zatwierdź' });
    saveBtn.disabled = true;
    exitBtn.addEventListener('click', ()=> FC.panelBox.close());
    cancelBtn.addEventListener('click', async ()=>{
      const ok = typeof cfg.askConfirm === 'function' ? await cfg.askConfirm({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w wyborze materiału / grupy zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      }) : true;
      if(!ok) return;
      FC.panelBox.close();
    });
    saveBtn.addEventListener('click', ()=>{
      if(!hasDraftSelection() || !isDirty()) return;
      const normalized = normalizeMaterialScopeForAggregate(draftScope, agg);
      if(typeof cfg.setMaterialScope === 'function') cfg.setMaterialScope(normalized);
      FC.panelBox.close();
      if(typeof cfg.refreshSelectionState === 'function') cfg.refreshSelectionState();
    });
    footer.appendChild(actionWrap);
    body.appendChild(footer);
    markSelected();
    FC.panelBox.open({
      title:'Wybierz materiał / grupę',
      contentNode: body,
      width:'980px',
      boxClass:'panel-box--rozrys',
      dismissOnOverlay:false,
      beforeClose: ()=> isDirty() ? (typeof cfg.askConfirm === 'function' ? cfg.askConfirm({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w wyborze materiału / grupy zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      }) : true) : true
    });
  }

  FC.rozrysPickers = {
    openRoomsPicker,
    openMaterialPicker,
  };
})();
