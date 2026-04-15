(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  let activeModal = null;

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key, value])=>{
        if(value == null) return;
        if(key === 'class') el.className = String(value);
        else if(key === 'text') el.textContent = String(value);
        else if(key === 'html') el.innerHTML = String(value);
        else if(key === 'value') el.value = String(value);
        else if(key === 'checked') el.checked = !!value;
        else el.setAttribute(key, String(value));
      });
    }
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

  function getCurrentProjectId(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? String(FC.projectStore.getCurrentProjectId() || '') : ''; }
    catch(_){ return ''; }
  }

  function getCurrentInvestorId(){
    try{ return FC.investors && typeof FC.investors.getCurrentId === 'function' ? String(FC.investors.getCurrentId() || '') : ''; }
    catch(_){ return ''; }
  }

  function normalizeRoomIds(roomIds){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function') return FC.quoteSnapshotStore.normalizeRoomIds(roomIds);
    }catch(_){ }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getCurrentDraft(){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function') return FC.quoteOfferStore.getCurrentDraft() || {};
    }catch(_){ }
    return {};
  }

  function defaultVersionName(preliminary, options){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.defaultVersionName === 'function') return FC.quoteOfferStore.defaultVersionName(!!preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function normalizeType(options){
    const opts = options && typeof options === 'object' ? options : {};
    if(Object.prototype.hasOwnProperty.call(opts, 'preliminary')) return !!opts.preliminary;
    const kind = String(opts.kind || '').trim().toLowerCase();
    return kind !== 'final';
  }

  function getRoomLabel(roomId){
    const key = String(roomId || '');
    if(!key) return '';
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function'){
        const label = String(FC.roomRegistry.getRoomLabel(key) || '').trim();
        if(label) return label;
      }
    }catch(_){ }
    const investorId = getCurrentInvestorId();
    try{
      if(investorId && FC.investors && typeof FC.investors.getById === 'function'){
        const investor = FC.investors.getById(investorId);
        const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
        const room = rooms.find((item)=> String(item && item.id || '') === key) || null;
        const label = String(room && (room.label || room.name || room.id) || '').trim();
        if(label) return label;
      }
    }catch(_){ }
    return key;
  }

  function getScopeRoomIds(options){
    const opts = options && typeof options === 'object' ? options : {};
    const explicit = normalizeRoomIds(opts.roomIds);
    if(explicit.length) return explicit;
    const fallbackRoomId = String(opts.fallbackRoomId || opts.roomId || '').trim();
    const draft = getCurrentDraft();
    const draftRooms = normalizeRoomIds(draft && draft.selection && draft.selection.selectedRooms);
    if(draftRooms.length){
      if(!fallbackRoomId || draftRooms.includes(fallbackRoomId)) return draftRooms;
    }
    return fallbackRoomId ? [fallbackRoomId] : [];
  }

  function getScopeSummary(roomIds){
    const ids = normalizeRoomIds(roomIds);
    const labels = ids.map((roomId)=> getRoomLabel(roomId)).filter(Boolean);
    return {
      roomIds: ids,
      roomLabels: labels,
      scopeLabel: labels.join(', ') || 'wybrany zakres',
      isMultiRoom: ids.length > 1,
    };
  }

  function listExactScopeSnapshots(projectId, roomIds, options){
    const pid = String(projectId || getCurrentProjectId() || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listExactScopeSnapshots === 'function')) return [];
      return FC.quoteSnapshotStore.listExactScopeSnapshots(pid, ids, opts) || [];
    }catch(_){ return []; }
  }

  function findExactScopeSnapshot(projectId, roomIds, options){
    const pid = String(projectId || getCurrentProjectId() || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return null;
    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.findExactScopeSnapshot === 'function')) return null;
      return FC.quoteSnapshotStore.findExactScopeSnapshot(pid, ids, opts) || null;
    }catch(_){ return null; }
  }

  function nameExists(projectId, roomIds, preliminary, name, options){
    const target = String(name || '').trim().toLowerCase();
    if(!target) return false;
    const rows = listExactScopeSnapshots(projectId, roomIds, Object.assign({}, options || {}, { preliminary, includeRejected:false }));
    return rows.some((row)=> {
      const rowName = String(row && row.commercial && row.commercial.versionName || row && row.meta && row.meta.versionName || '').trim().toLowerCase();
      return rowName === target;
    });
  }

  function buildSuggestedVersionName(projectId, roomIds, preliminary){
    const base = String(defaultVersionName(preliminary, { roomIds }) || '').trim() || (preliminary ? 'Wstępna oferta' : 'Oferta');
    if(!nameExists(projectId, roomIds, preliminary, base)) return base;
    let index = 2;
    let candidate = `${base} — wariant ${index}`;
    while(nameExists(projectId, roomIds, preliminary, candidate)){
      index += 1;
      candidate = `${base} — wariant ${index}`;
    }
    return candidate;
  }

  function patchDraftForScope(roomIds, preliminary, versionName, options){
    const opts = options && typeof options === 'object' ? options : {};
    if(!(FC.quoteOfferStore && typeof FC.quoteOfferStore.patchCurrentDraft === 'function')) throw new Error('Brak quoteOfferStore.patchCurrentDraft');
    const patch = {
      selection:{ selectedRooms: normalizeRoomIds(roomIds) },
      commercial:{ preliminary: !!preliminary }
    };
    if(Object.prototype.hasOwnProperty.call(opts, 'versionName')) patch.commercial.versionName = String(versionName || '').trim();
    return FC.quoteOfferStore.patchCurrentDraft(patch);
  }

  function openWycenaTab(){
    try{
      if(typeof window.setActiveTab === 'function') window.setActiveTab('wycena');
      else if(FC.tabNavigation && typeof FC.tabNavigation.setActiveTab === 'function') FC.tabNavigation.setActiveTab('wycena');
    }catch(_){ }
  }

  function syncScopeStatus(snapshot, status){
    try{
      if(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function') FC.wycenaTabDebug.setProjectStatusFromSnapshot(snapshot, status, { syncSelection:true });
    }catch(_){ }
  }

  function previewSnapshot(snapshotId){
    const key = String(snapshotId || '').trim();
    if(!key) return;
    try{
      if(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.showSnapshotPreview === 'function') FC.wycenaTabDebug.showSnapshotPreview(key);
    }catch(_){ }
  }

  function openExistingSnapshot(snapshot, status){
    const snap = snapshot && typeof snapshot === 'object' ? clone(snapshot) : null;
    if(!snap) throw new Error('Brak istniejącej wyceny do otwarcia');
    const roomIds = normalizeRoomIds(snap && snap.scope && snap.scope.selectedRooms);
    const preliminary = !!(snap && ((snap.meta && snap.meta.preliminary) || (snap.commercial && snap.commercial.preliminary)));
    const versionName = String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim();
    patchDraftForScope(roomIds, preliminary, versionName, { versionName:true });
    previewSnapshot(String(snap && snap.id || ''));
    if(status) syncScopeStatus(snap, status);
    openWycenaTab();
    return { action:'opened-existing', cancelled:false, snapshot:snap, roomIds, preliminary };
  }

  async function createNewSnapshot(projectId, investorId, roomIds, preliminary, versionName, options){
    const ids = normalizeRoomIds(roomIds);
    if(!ids.length) throw new Error('Brak wybranego zakresu pomieszczeń');
    if(FC.investors && typeof FC.investors.setCurrentId === 'function' && investorId) FC.investors.setCurrentId(String(investorId || ''));
    if(FC.projectStore && typeof FC.projectStore.setCurrentProjectId === 'function' && projectId) FC.projectStore.setCurrentProjectId(String(projectId || ''));
    patchDraftForScope(ids, preliminary, versionName, { versionName:true });
    if(!(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function')) throw new Error('Brak wycenaCore.buildQuoteSnapshot');
    const snapshot = await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms: ids } });
    if(!snapshot || snapshot.error) throw new Error(String(snapshot && snapshot.error || 'Nie udało się utworzyć wyceny.'));
    if(options && options.status) syncScopeStatus(snapshot, options.status);
    previewSnapshot(String(snapshot && snapshot.id || ''));
    if(!(options && options.openTab === false)) openWycenaTab();
    return { action:'created-new', cancelled:false, snapshot, roomIds:ids, preliminary:!!preliminary };
  }

  function openExistingOrCreateModal(scope, preliminary, existingSnapshot){
    return openModal((dialog, overlay)=>{
      const title = h('div', { class:'quote-scope-entry-modal__title', text: preliminary ? 'ISTNIEJE JUŻ WYCENA WSTĘPNA' : 'ISTNIEJE JUŻ WYCENA' });
      const closeBtn = h('button', { type:'button', class:'quote-scope-entry-modal__close', 'aria-label':'Zamknij okno', text:'×' });
      const head = h('div', { class:'quote-scope-entry-modal__head' }, [title, closeBtn]);
      const body = h('div', { class:'quote-scope-entry-modal__body' });
      const name = String(existingSnapshot && existingSnapshot.commercial && existingSnapshot.commercial.versionName || existingSnapshot && existingSnapshot.meta && existingSnapshot.meta.versionName || '').trim();
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

  function openNameModal(projectId, scope, preliminary){
    return openModal((dialog, overlay)=>{
      const suggestedName = buildSuggestedVersionName(projectId, scope.roomIds, preliminary);
      const title = h('div', { class:'quote-scope-entry-modal__title', text: preliminary ? 'NAZWA NOWEJ WYCENY WSTĘPNEJ' : 'NAZWA NOWEJ WYCENY' });
      const closeBtn = h('button', { type:'button', class:'quote-scope-entry-modal__close', 'aria-label':'Zamknij okno', text:'×' });
      const head = h('div', { class:'quote-scope-entry-modal__head' }, [title, closeBtn]);
      const body = h('div', { class:'quote-scope-entry-modal__body' });
      body.appendChild(h('div', { class:'quote-scope-entry-modal__message', text:`Podaj nazwę dla nowej ${preliminary ? 'wyceny wstępnej' : 'wyceny'} dla zakresu „${scope.scopeLabel}”.` }));
      body.appendChild(h('div', { class:'quote-scope-entry-modal__scope', text:`Pomieszczenia: ${scope.scopeLabel}` }));
      const field = h('label', { class:'quote-scope-entry-modal__field' });
      field.appendChild(h('span', { class:'quote-scope-entry-modal__field-label', text:'Nazwa wyceny' }));
      const input = h('input', { type:'text', class:'investor-form-input quote-scope-entry-modal__input', value:suggestedName, maxlength:'120', placeholder:suggestedName });
      field.appendChild(input);
      body.appendChild(field);
      const hint = h('div', { class:'quote-scope-entry-modal__hint', text:'Domyślna nazwa jest już podpowiedziana jako kolejny wariant dla tego samego zakresu.' });
      body.appendChild(hint);
      const actions = h('div', { class:'quote-scope-entry-modal__actions' });
      const backBtn = h('button', { type:'button', class:'btn-primary quote-scope-entry-modal__action', text:'Wróć' });
      const createBtn = h('button', { type:'button', class:'btn-success quote-scope-entry-modal__action', text:'Utwórz nową' });
      actions.appendChild(backBtn);
      actions.appendChild(createBtn);
      dialog.appendChild(head);
      dialog.appendChild(body);
      dialog.appendChild(actions);

      const submit = ()=> {
        const value = String(input.value || '').trim();
        if(!value){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak nazwy wyceny', message:'Nadaj nazwę nowej wycenie, zanim ją utworzysz.' }); }catch(_){ }
          try{ input.focus(); }catch(_){ }
          return;
        }
        if(nameExists(projectId, scope.roomIds, preliminary, value)){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Ta nazwa już istnieje', message:'Dla tego typu wyceny i dokładnie tego samego zakresu pomieszczeń istnieje już wersja o takiej nazwie. Nadaj inną nazwę.' }); }catch(_){ }
          try{ input.focus(); input.select(); }catch(_){ }
          return;
        }
        closeActiveModal({ cancelled:false, action:'create-new', versionName:value });
      };

      overlay.addEventListener('pointerdown', (event)=>{ if(event.target === overlay) closeActiveModal({ cancelled:true }); });
      closeBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:true }));
      backBtn.addEventListener('click', ()=> closeActiveModal({ cancelled:true }));
      createBtn.addEventListener('click', submit);
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

  async function ensureScopedQuoteEntry(options){
    const opts = options && typeof options === 'object' ? options : {};
    const preliminary = normalizeType(opts);
    const projectId = String(opts.projectId || getCurrentProjectId() || '');
    const investorId = String(opts.investorId || getCurrentInvestorId() || '');
    const scope = getScopeSummary(getScopeRoomIds(opts));
    if(!projectId) throw new Error('Brak projektu dla wybranego inwestora');
    if(!scope.roomIds.length) throw new Error('Brak wybranego pomieszczenia lub zakresu');
    const status = String(opts.status || (preliminary ? 'wstepna_wycena' : 'wycena') || '').trim().toLowerCase();
    const existing = findExactScopeSnapshot(projectId, scope.roomIds, { preliminary, includeRejected:false });
    if(existing){
      const decision = typeof opts.chooseAction === 'function'
        ? await opts.chooseAction({ projectId, investorId, scope:clone(scope), preliminary, existingSnapshot:clone(existing) })
        : await openExistingOrCreateModal(scope, preliminary, existing);
      if(!decision || decision.cancelled) return { cancelled:true, action:'cancelled', roomIds:scope.roomIds, preliminary };
      if(decision.action === 'open-existing') return openExistingSnapshot(existing, status);
      const naming = typeof opts.chooseName === 'function'
        ? await opts.chooseName({ projectId, investorId, scope:clone(scope), preliminary, suggestedVersionName:buildSuggestedVersionName(projectId, scope.roomIds, preliminary) })
        : await openNameModal(projectId, scope, preliminary);
      if(!naming || naming.cancelled) return { cancelled:true, action:'cancelled', roomIds:scope.roomIds, preliminary };
      return createNewSnapshot(projectId, investorId, scope.roomIds, preliminary, naming.versionName, { status, openTab: opts.openTab !== false });
    }
    const initialName = buildSuggestedVersionName(projectId, scope.roomIds, preliminary);
    return createNewSnapshot(projectId, investorId, scope.roomIds, preliminary, initialName, { status, openTab: opts.openTab !== false });
  }

  function describeScopeMatch(projectId, roomIds, options){
    const preliminary = normalizeType(options);
    const scope = getScopeSummary(roomIds);
    const existing = findExactScopeSnapshot(projectId, scope.roomIds, { preliminary, includeRejected:false });
    return {
      projectId:String(projectId || getCurrentProjectId() || ''),
      preliminary,
      scope,
      existingSnapshot: existing,
      existingSnapshotId: String(existing && existing.id || ''),
      suggestedVersionName: buildSuggestedVersionName(projectId, scope.roomIds, preliminary),
      hasExistingExactScope: !!existing,
    };
  }

  FC.quoteScopeEntry = {
    normalizeRoomIds,
    getScopeRoomIds,
    getScopeSummary,
    listExactScopeSnapshots,
    findExactScopeSnapshot,
    buildSuggestedVersionName,
    describeScopeMatch,
    ensureScopedQuoteEntry,
    openExistingSnapshot,
  };
})();
