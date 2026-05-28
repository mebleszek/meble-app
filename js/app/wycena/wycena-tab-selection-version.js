(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const scope = FC.wycenaTabSelectionScope || {};
  const normalizeRoomIds = typeof scope.normalizeRoomIds === 'function'
    ? scope.normalizeRoomIds
    : ((roomIds)=> Array.isArray(roomIds) ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean))) : []);
  const buildSelectionScopeSummary = typeof scope.buildSelectionScopeSummary === 'function'
    ? scope.buildSelectionScopeSummary
    : ((selection)=> {
      const selectedRooms = normalizeRoomIds(selection && selection.selectedRooms);
      return { roomIds:selectedRooms, roomLabels:selectedRooms.slice(), scopeLabel:selectedRooms.join(', ') || 'wybrany zakres', isMultiRoom:selectedRooms.length > 1 };
    });

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

  FC.wycenaTabSelectionVersion = {
    defaultVersionName,
    getCurrentProjectId,
    shouldPromptForVersionNameOnGenerate,
    isVersionNameTakenForScope,
    normalizeComparableVersionName,
    sameRoomScope,
    isRejectedSnapshot,
    isPreliminarySnapshot,
    listProjectSnapshots,
    versionNameExistsForDifferentExactScope,
    coerceVersionNameForSelection,
    resolveVersionNameAfterRoomChange,
    buildPromptScopeLead,
    ensureVersionNameBeforeGenerate,
  };
})();
