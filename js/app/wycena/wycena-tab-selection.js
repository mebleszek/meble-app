(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function defaultVersionName(preliminary, options){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.defaultVersionName === 'function') return FC.quoteOfferStore.defaultVersionName(!!preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function getCurrentProjectId(deps){
    try{ return deps && typeof deps.getCurrentProjectId === 'function' ? String(deps.getCurrentProjectId() || '') : ''; }
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

  function normalizeDraftSelection(draft){
    try{
      if(FC.wycenaCore && typeof FC.wycenaCore.normalizeQuoteSelection === 'function') return FC.wycenaCore.normalizeQuoteSelection(draft && draft.selection);
    }catch(_){ }
    return {
      selectedRooms:[],
      materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true },
    };
  }

  function buildSelectionScopeSummary(selection){
    const selectedRooms = normalizeRoomIds(selection && selection.selectedRooms);
    if(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.getScopeSummary === 'function'){
      try{ return FC.quoteScopeEntry.getScopeSummary(selectedRooms); }catch(_){ }
    }
    const labels = selectedRooms.slice();
    return {
      roomIds:selectedRooms,
      roomLabels:labels,
      scopeLabel:labels.join(', ') || 'wybrany zakres',
      isMultiRoom:selectedRooms.length > 1,
    };
  }

  function getRoomLabel(roomId){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(roomId) : String(roomId || ''); }
    catch(_){ return String(roomId || ''); }
  }

  function getActiveRoomIds(){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? FC.roomRegistry.getActiveRoomIds() : []; }
    catch(_){ return []; }
  }

  function getRoomLabelsFromSelection(selection){
    const rows = Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms : [];
    return rows.map((roomId)=> getRoomLabel(roomId)).filter(Boolean);
  }

  function getRoomsPickerMeta(selection){
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.getRoomsSummary === 'function'){
        return FC.rozrysScope.getRoomsSummary(selection && selection.selectedRooms, { getRooms:getActiveRoomIds }) || { title:'Brak pomieszczeń', subtitle:'' };
      }
    }catch(_){ }
    const roomLabels = getRoomLabelsFromSelection(selection);
    return {
      title: roomLabels.length ? roomLabels.join(', ') : 'Brak pomieszczeń',
      subtitle: roomLabels.length ? `${roomLabels.length} wybrane` : '',
    };
  }

  function getScopePickerMeta(selection, deps){
    const getMaterialScopeLabel = deps && typeof deps.getMaterialScopeLabel === 'function'
      ? deps.getMaterialScopeLabel
      : (()=> 'Fronty + korpusy');
    return {
      title:'Zakres wyceny',
      subtitle:getMaterialScopeLabel(selection),
      detail:'Wybór jak w ROZRYS',
    };
  }

  function buildSelectionSummary(selection, deps){
    const roomLabels = getRoomLabelsFromSelection(selection);
    const roomsMeta = getRoomsPickerMeta(selection);
    const scopeMeta = getScopePickerMeta(selection, deps);
    const getMaterialScopeLabel = deps && typeof deps.getMaterialScopeLabel === 'function'
      ? deps.getMaterialScopeLabel
      : (()=> 'Fronty + korpusy');
    return {
      roomLabels,
      roomsMeta,
      scopeMeta,
      roomsText: roomLabels.length ? roomLabels.join(', ') : 'Brak pomieszczeń',
      scopeText: getMaterialScopeLabel(selection),
    };
  }

  function shouldPromptForVersionNameOnGenerate(selection, draft, deps){
    const projectId = getCurrentProjectId(deps);
    const selectedRooms = normalizeRoomIds(selection && selection.selectedRooms);
    const commercial = draft && draft.commercial && typeof draft.commercial === 'object' ? draft.commercial : {};
    if(!projectId || !selectedRooms.length) return false;
    if(!(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.listExactScopeSnapshots === 'function')) return false;
    try{
      const rows = FC.quoteScopeEntry.listExactScopeSnapshots(projectId, selectedRooms, { preliminary:!!commercial.preliminary, includeRejected:false }) || [];
      return rows.length > 0;
    }catch(_){ return false; }
  }

  function isVersionNameTakenForScope(projectId, roomIds, preliminary, versionName){
    if(!projectId || !Array.isArray(roomIds) || !roomIds.length) return false;
    if(!(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.isVersionNameTaken === 'function')) return false;
    try{ return FC.quoteScopeEntry.isVersionNameTaken(projectId, roomIds, !!preliminary, versionName); }
    catch(_){ return false; }
  }


  function normalizeComparableVersionName(value){
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function sameRoomScope(leftRooms, rightRooms){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.sameRoomScope === 'function') return FC.quoteSnapshotStore.sameRoomScope(leftRooms, rightRooms);
    }catch(_){ }
    const left = normalizeRoomIds(leftRooms);
    const right = normalizeRoomIds(rightRooms);
    if(left.length != right.length) return false;
    return left.every((roomId, idx)=> roomId === right[idx]);
  }

  function isRejectedSnapshot(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isRejectedSnapshot === 'function') return !!FC.quoteSnapshotStore.isRejectedSnapshot(snapshot);
    }catch(_){ }
    return !!(snapshot && snapshot.meta && (Number(snapshot.meta.rejectedAt) > 0 || String(snapshot.meta.rejectedReason || '').trim()));
  }

  function isPreliminarySnapshot(snapshot){
    return !!(snapshot && ((snapshot.meta && snapshot.meta.preliminary) || (snapshot.commercial && snapshot.commercial.preliminary)));
  }

  function listProjectSnapshots(projectId){
    const pid = String(projectId || '').trim();
    if(!pid) return [];
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function') return FC.quoteSnapshotStore.listForProject(pid) || [];
    }catch(_){ }
    return [];
  }

  function versionNameExistsForDifferentExactScope(projectId, roomIds, preliminary, versionName){
    const pid = String(projectId || '').trim();
    const targetRooms = normalizeRoomIds(roomIds);
    const targetName = normalizeComparableVersionName(versionName);
    if(!pid || !targetRooms.length || !targetName) return false;
    const rows = listProjectSnapshots(pid);
    return rows.some((row)=> {
      if(!row || isRejectedSnapshot(row)) return false;
      if(isPreliminarySnapshot(row) !== !!preliminary) return false;
      const rowName = normalizeComparableVersionName(row && row.commercial && row.commercial.versionName || row && row.meta && row.meta.versionName || '');
      if(!rowName || rowName !== targetName) return false;
      const rowRooms = normalizeRoomIds(row && row.scope && row.scope.selectedRooms);
      if(!rowRooms.length) return false;
      return !sameRoomScope(rowRooms, targetRooms);
    });
  }

  function coerceVersionNameForSelection(selection, draft, deps){
    const normalizedSelection = selection && typeof selection === 'object' ? selection : { selectedRooms:[] };
    const selectedRooms = normalizeRoomIds(normalizedSelection && normalizedSelection.selectedRooms);
    const commercial = draft && draft.commercial && typeof draft.commercial === 'object' ? draft.commercial : {};
    const preliminary = !!commercial.preliminary;
    const defaultName = defaultVersionName(preliminary, { selection:normalizedSelection });
    const currentVersionName = String(commercial.versionName || '').trim();
    if(!currentVersionName) return defaultName;
    if(currentVersionName === defaultName) return currentVersionName;
    const projectId = getCurrentProjectId(deps);
    if(projectId && selectedRooms.length && versionNameExistsForDifferentExactScope(projectId, selectedRooms, preliminary, currentVersionName)) return defaultName;
    if(projectId && selectedRooms.length && isVersionNameTakenForScope(projectId, selectedRooms, preliminary, currentVersionName)) return currentVersionName;
    return currentVersionName;
  }

  function resolveVersionNameAfterRoomChange(selection, nextRooms, draft, deps){
    const previousSelection = selection && typeof selection === 'object' ? selection : { selectedRooms:[] };
    const previousRooms = normalizeRoomIds(previousSelection && previousSelection.selectedRooms);
    const nextSelectedRooms = normalizeRoomIds(nextRooms);
    const commercial = draft && draft.commercial && typeof draft.commercial === 'object' ? draft.commercial : {};
    const preliminary = !!commercial.preliminary;
    const currentVersionName = String(commercial.versionName || '').trim();
    const previousDefault = defaultVersionName(preliminary, { selection:previousSelection });
    const nextSelection = Object.assign({}, previousSelection, { selectedRooms:nextSelectedRooms });
    const nextDefault = defaultVersionName(preliminary, { selection:nextSelection });
    if(!currentVersionName) return nextDefault;
    if(previousRooms.join('|') === nextSelectedRooms.join('|')) return coerceVersionNameForSelection(nextSelection, draft, deps);
    if(currentVersionName === previousDefault) return nextDefault;
    const projectId = getCurrentProjectId(deps);
    if(projectId && previousRooms.length && isVersionNameTakenForScope(projectId, previousRooms, preliminary, currentVersionName)){
      return nextDefault;
    }
    return coerceVersionNameForSelection(nextSelection, Object.assign({}, draft || {}, { commercial:Object.assign({}, commercial, { versionName:currentVersionName }) }), deps);
  }

  function buildPromptScopeLead(scope){
    const labels = Array.isArray(scope && scope.roomLabels) ? scope.roomLabels.map((item)=> String(item || '').trim()).filter(Boolean) : [];
    const scopeLabel = String(scope && scope.scopeLabel || labels.join(', ') || 'wybrany zakres').trim() || 'wybrany zakres';
    if(labels.length <= 1) return `Dla pomieszczenia „${scopeLabel}”`;
    return `Dla pomieszczeń „${scopeLabel}”`;
  }

  async function ensureVersionNameBeforeGenerate(selection, deps){
    const getOfferDraft = deps && typeof deps.getOfferDraft === 'function' ? deps.getOfferDraft : ()=> ({});
    const patchOfferDraft = deps && typeof deps.patchOfferDraft === 'function' ? deps.patchOfferDraft : ()=>{};
    const draft = getOfferDraft() || {};
    const commercial = draft && draft.commercial && typeof draft.commercial === 'object' ? draft.commercial : {};
    const selectedRooms = normalizeRoomIds(selection && selection.selectedRooms);
    const preliminary = !!commercial.preliminary;
    const coercedVersionName = String(coerceVersionNameForSelection(selection, draft, deps) || '').trim() || defaultVersionName(preliminary, { selection });
    if(coercedVersionName && coercedVersionName !== String(commercial.versionName || '').trim()){
      patchOfferDraft({ commercial:{ versionName:coercedVersionName } });
    }
    if(!shouldPromptForVersionNameOnGenerate(selection, draft, deps)) return { cancelled:false, versionName:coercedVersionName };
    if(!(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.promptNewVersionName === 'function')) return { cancelled:false, versionName:coercedVersionName };
    const scope = buildSelectionScopeSummary(selection);
    const snapshotLabel = preliminary ? 'wycena wstępna' : 'wycena';
    const naming = await FC.quoteScopeEntry.promptNewVersionName({
      projectId:getCurrentProjectId(deps),
      roomIds:selectedRooms,
      preliminary,
      title: preliminary ? 'NAZWA NOWEJ WYCENY WSTĘPNEJ' : 'NAZWA NOWEJ WYCENY',
      message:`${buildPromptScopeLead(scope)} istnieje już ${snapshotLabel}. Nadaj unikatową nazwę kolejnemu wariantowi.`,
      hint:false,
      submitLabel:'OK',
      cancelLabel:'Anuluj',
    });
    if(!naming || naming.cancelled) return { cancelled:true };
    const nextVersionName = String(naming.versionName || '').trim() || coercedVersionName;
    patchOfferDraft({ commercial:{ versionName:nextVersionName } });
    return { cancelled:false, versionName:nextVersionName };
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
          const nextRooms = Array.isArray(rooms) ? rooms.slice() : [];
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
          try{ return FC.rozrysScope && typeof FC.rozrysScope.normalizeRoomSelection === 'function' ? FC.rozrysScope.normalizeRoomSelection(rooms, { getRooms:getActiveRoomIds }) : (Array.isArray(rooms) ? rooms : []); }
          catch(_){ return Array.isArray(rooms) ? rooms : []; }
        },
        roomLabel: (roomId)=> getRoomLabel(roomId),
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

  function renderQuoteSelectionSection(card, ctx, deps){
    const h = deps && typeof deps.h === 'function' ? deps.h : null;
    const labelWithInfo = deps && typeof deps.labelWithInfo === 'function' ? deps.labelWithInfo : null;
    const openRooms = deps && typeof deps.openQuoteRoomsPicker === 'function' ? deps.openQuoteRoomsPicker : null;
    const openScope = deps && typeof deps.openQuoteScopePicker === 'function' ? deps.openQuoteScopePicker : null;
    const getOfferDraft = deps && typeof deps.getOfferDraft === 'function' ? deps.getOfferDraft : ()=> ({});
    const getMaterialScopeLabel = deps && typeof deps.getMaterialScopeLabel === 'function' ? deps.getMaterialScopeLabel : (()=> 'Fronty + korpusy');
    if(typeof h !== 'function' || typeof labelWithInfo !== 'function') return;
    const selection = normalizeDraftSelection(getOfferDraft());
    const summary = buildSelectionSummary(selection, { getMaterialScopeLabel });
    const section = h('section', { class:'card quote-selection-card panel-box--rozrys', style:'margin-top:12px;padding:14px;' });
    const grid = h('div', { class:'quote-selection-grid rozrys-selection-grid' });

    const roomsField = h('div', { class:'quote-selection-field rozrys-field rozrys-selection-grid__rooms' });
    roomsField.appendChild(labelWithInfo('Pomieszczenia do wyceny', 'Pomieszczenia do wyceny', 'Wybierz pomieszczenia bez wchodzenia do ROZRYS. Kliknięcie „Wyceń” uruchomi rozkrój w tle dokładnie dla tego zakresu.'));
    const roomsBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--rooms quote-selection-launch--rooms' });
    const roomsValue = h('div', { class:'rozrys-picker-launch__value' });
    roomsValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:String(summary.roomsMeta && summary.roomsMeta.title || summary.roomsText) }));
    if(summary.roomsMeta && summary.roomsMeta.subtitle) roomsValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:String(summary.roomsMeta.subtitle || '') }));
    roomsBtn.appendChild(roomsValue);
    roomsBtn.addEventListener('click', ()=> { if(typeof openRooms === 'function') openRooms(ctx); });
    roomsField.appendChild(roomsBtn);
    grid.appendChild(roomsField);

    const scopeField = h('div', { class:'quote-selection-field rozrys-field rozrys-selection-grid__material' });
    scopeField.appendChild(labelWithInfo('Zakres elementów do wyceny', 'Zakres elementów do wyceny', 'Zakres działa jak w ROZRYS: możesz liczyć korpusy i fronty razem albo tylko jedną z tych grup.'));
    const scopeBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--material quote-selection-launch--scope' });
    const scopeValue = h('div', { class:'rozrys-picker-launch__value' });
    scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:String(summary.scopeMeta && summary.scopeMeta.title || summary.scopeText) }));
    if(summary.scopeMeta && summary.scopeMeta.subtitle) scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:String(summary.scopeMeta.subtitle || '') }));
    if(summary.scopeMeta && summary.scopeMeta.detail) scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__detail', text:String(summary.scopeMeta.detail || '') }));
    scopeBtn.appendChild(scopeValue);
    scopeBtn.addEventListener('click', ()=> { if(typeof openScope === 'function') openScope(ctx); });
    scopeField.appendChild(scopeBtn);
    grid.appendChild(scopeField);
    section.appendChild(grid);

    const info = h('div', { class:'quote-scope-info' });
    info.appendChild(h('div', { class:'quote-scope-info__title', text:'Zakres bieżącej wyceny' }));
    info.appendChild(h('div', { class:'quote-scope-info__body', text:`Pomieszczenia: ${summary.roomsText}
Zakres: ${getMaterialScopeLabel(selection)}
Kliknięcie „Wyceń” użyje logiki ROZRYS w tle dla tego wyboru.` }));
    section.appendChild(info);
    card.appendChild(section);
  }

  FC.wycenaTabSelection = {
    defaultVersionName,
    buildSelectionScopeSummary,
    shouldPromptForVersionNameOnGenerate,
    ensureVersionNameBeforeGenerate,
    normalizeDraftSelection,
    getRoomLabelsFromSelection,
    getRoomsPickerMeta,
    getScopePickerMeta,
    buildSelectionSummary,
    coerceVersionNameForSelection,
    resolveVersionNameAfterRoomChange,
    openQuoteRoomsPicker,
    openQuoteScopePicker,
    renderQuoteSelectionSection,
  };
})();
