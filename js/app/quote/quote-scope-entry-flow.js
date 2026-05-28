(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const U = FC.quoteScopeEntryUtils || {};
  const Scope = FC.quoteScopeEntryScope || {};
  const Modal = FC.quoteScopeEntryModal || {};

  function clone(value){
    return typeof U.clone === 'function' ? U.clone(value) : JSON.parse(JSON.stringify(value || null));
  }

  function normalizeRoomIds(roomIds){
    return typeof Scope.normalizeRoomIds === 'function' ? Scope.normalizeRoomIds(roomIds) : [];
  }

  function normalizeType(options){
    return typeof Scope.normalizeType === 'function' ? Scope.normalizeType(options) : true;
  }

  function getCurrentProjectId(){
    return typeof U.getCurrentProjectId === 'function' ? U.getCurrentProjectId() : '';
  }

  function getCurrentInvestorId(){
    return typeof U.getCurrentInvestorId === 'function' ? U.getCurrentInvestorId() : '';
  }

  function getScopeRoomIds(options){
    return typeof Scope.getScopeRoomIds === 'function' ? Scope.getScopeRoomIds(options) : [];
  }

  function getScopeSummary(roomIds){
    return typeof Scope.getScopeSummary === 'function' ? Scope.getScopeSummary(roomIds) : { roomIds:[], roomLabels:[], scopeLabel:'wybrany zakres', isMultiRoom:false };
  }

  function findExactScopeSnapshot(projectId, roomIds, options){
    return typeof Scope.findExactScopeSnapshot === 'function' ? Scope.findExactScopeSnapshot(projectId, roomIds, options) : null;
  }

  function buildSuggestedVersionName(projectId, roomIds, preliminary){
    return typeof Scope.buildSuggestedVersionName === 'function' ? Scope.buildSuggestedVersionName(projectId, roomIds, preliminary) : (preliminary ? 'Wstępna oferta' : 'Oferta');
  }

  function getEffectiveVersionName(snapshot){
    return typeof Scope.getEffectiveVersionName === 'function' ? Scope.getEffectiveVersionName(snapshot) : '';
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

  async function notifyCreatedPreliminary(scope, options){
    const opts = options && typeof options === 'object' ? options : {};
    const summary = scope && typeof scope === 'object' ? scope : getScopeSummary([]);
    if(opts.notifyCreated === false) return;
    if(typeof opts.notifyCreated === 'function'){
      await opts.notifyCreated(clone(summary || {}));
      return;
    }
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({
          title:'NOWA WYCENA WSTĘPNA',
          message: summary && summary.scopeLabel
            ? `Powstała nowa wycena wstępna.\nPomieszczenia: ${summary.scopeLabel}`
            : 'Powstała nowa wycena wstępna.',
          okOnly:true,
          dismissOnOverlay:false,
          dismissOnEsc:false,
        });
        return;
      }
    }catch(_){ }
    if(typeof document === 'undefined' || !document || !document.body) return;
    if(Modal && typeof Modal.openCreatedPreliminaryInfo === 'function') await Modal.openCreatedPreliminaryInfo(summary);
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
    const versionName = getEffectiveVersionName(snap);
    patchDraftForScope(roomIds, preliminary, versionName, { versionName:true });
    previewSnapshot(String(snap && snap.id || ''));
    if(status) syncScopeStatus(snap, status);
    openWycenaTab();
    return { action:'opened-existing', cancelled:false, snapshot:snap, roomIds, preliminary };
  }

  async function createNewSnapshot(projectId, investorId, roomIds, preliminary, versionName, options){
    const ids = normalizeRoomIds(roomIds);
    if(!ids.length) throw new Error('Brak wybranego zakresu pomieszczeń');
    const opts = options && typeof options === 'object' ? options : {};
    const scopeSummary = getScopeSummary(ids);
    if(FC.investors && typeof FC.investors.setCurrentId === 'function' && investorId) FC.investors.setCurrentId(String(investorId || ''));
    if(FC.projectStore && typeof FC.projectStore.setCurrentProjectId === 'function' && projectId) FC.projectStore.setCurrentProjectId(String(projectId || ''));
    patchDraftForScope(ids, preliminary, versionName, { versionName:true });
    if(!(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function')) throw new Error('Brak wycenaCore.buildQuoteSnapshot');
    const snapshot = await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms: ids } });
    if(!snapshot || snapshot.error) throw new Error(String(snapshot && snapshot.error || 'Nie udało się utworzyć wyceny.'));
    if(opts.status) syncScopeStatus(snapshot, opts.status);
    previewSnapshot(String(snapshot && snapshot.id || ''));
    if(!(opts.openTab === false)) openWycenaTab();
    if(preliminary) await notifyCreatedPreliminary(scopeSummary, opts);
    return { action:'created-new', cancelled:false, snapshot, roomIds:ids, preliminary:!!preliminary, scope:scopeSummary };
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
        : await Modal.openExistingOrCreateModal(scope, preliminary, existing);
      if(!decision || decision.cancelled) return { cancelled:true, action:'cancelled', roomIds:scope.roomIds, preliminary };
      if(decision.action === 'open-existing') return openExistingSnapshot(existing, status);
      const naming = typeof opts.chooseName === 'function'
        ? await opts.chooseName({ projectId, investorId, scope:clone(scope), preliminary, suggestedVersionName:buildSuggestedVersionName(projectId, scope.roomIds, preliminary) })
        : await Modal.openNameModal(projectId, scope, preliminary);
      if(!naming || naming.cancelled) return { cancelled:true, action:'cancelled', roomIds:scope.roomIds, preliminary };
      return createNewSnapshot(projectId, investorId, scope.roomIds, preliminary, naming.versionName, { status, openTab: opts.openTab !== false, notifyCreated: opts.notifyCreated });
    }
    const initialName = buildSuggestedVersionName(projectId, scope.roomIds, preliminary);
    return createNewSnapshot(projectId, investorId, scope.roomIds, preliminary, initialName, { status, openTab: opts.openTab !== false, notifyCreated: opts.notifyCreated });
  }

  function promptNewVersionName(options){
    const opts = options && typeof options === 'object' ? options : {};
    const projectId = String(opts.projectId || getCurrentProjectId() || '');
    const preliminary = normalizeType(opts);
    const scope = getScopeSummary(getScopeRoomIds(opts));
    if(!projectId) throw new Error('Brak projektu dla wybranego inwestora');
    if(!scope.roomIds.length) throw new Error('Brak wybranego pomieszczenia lub zakresu');
    return Modal.openNameModal(projectId, scope, preliminary, opts);
  }

  FC.quoteScopeEntryFlow = {
    patchDraftForScope,
    openWycenaTab,
    notifyCreatedPreliminary,
    syncScopeStatus,
    previewSnapshot,
    openExistingSnapshot,
    createNewSnapshot,
    ensureScopedQuoteEntry,
    promptNewVersionName,
  };
})();
