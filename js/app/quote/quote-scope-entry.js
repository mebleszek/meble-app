(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const Scope = FC.quoteScopeEntryScope || {};
  const Flow = FC.quoteScopeEntryFlow || {};
  const U = FC.quoteScopeEntryUtils || {};

  function getCurrentProjectId(){
    return typeof U.getCurrentProjectId === 'function' ? U.getCurrentProjectId() : '';
  }

  function normalizeType(options){
    return typeof Scope.normalizeType === 'function' ? Scope.normalizeType(options) : true;
  }

  function getScopeRoomIds(options){
    return typeof Scope.getScopeRoomIds === 'function' ? Scope.getScopeRoomIds(options) : [];
  }

  function getScopeSummary(roomIds){
    return typeof Scope.getScopeSummary === 'function' ? Scope.getScopeSummary(roomIds) : { roomIds:[], roomLabels:[], scopeLabel:'wybrany zakres', isMultiRoom:false };
  }

  FC.quoteScopeEntry = {
    normalizeRoomIds: Scope.normalizeRoomIds,
    getScopeRoomIds,
    getScopeSummary,
    listExactScopeSnapshots: Scope.listExactScopeSnapshots,
    findExactScopeSnapshot: Scope.findExactScopeSnapshot,
    isVersionNameTaken(projectId, roomIds, preliminary, name, options){
      return typeof Scope.isVersionNameTaken === 'function' ? Scope.isVersionNameTaken(projectId, roomIds, !!preliminary, name, options) : false;
    },
    buildSuggestedVersionName: Scope.buildSuggestedVersionName,
    describeScopeMatch: Scope.describeScopeMatch,
    ensureScopedQuoteEntry: Flow.ensureScopedQuoteEntry,
    openExistingSnapshot: Flow.openExistingSnapshot,
    promptNewVersionName(options){
      const opts = options && typeof options === 'object' ? options : {};
      const projectId = String(opts.projectId || getCurrentProjectId() || '');
      const preliminary = normalizeType(opts);
      const scope = getScopeSummary(getScopeRoomIds(opts));
      if(!projectId) throw new Error('Brak projektu dla wybranego inwestora');
      if(!scope.roomIds.length) throw new Error('Brak wybranego pomieszczenia lub zakresu');
      return Flow.promptNewVersionName(Object.assign({}, opts, { projectId, preliminary, roomIds:scope.roomIds }));
    },
  };
})();
