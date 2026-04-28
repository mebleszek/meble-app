(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getResolver(){
    return FC.roomScopeResolver || null;
  }

  function getActiveRooms(){
    try{
      const roomScopeResolver = getResolver();
      if(roomScopeResolver && typeof roomScopeResolver.getActiveRoomIds === 'function') return roomScopeResolver.getActiveRoomIds();
      return (FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function') ? FC.roomRegistry.getActiveRoomIds() : [];
    }catch(_){ return []; }
  }

  function normalizeMaterialScope(value){
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.normalizeMaterialScope === 'function') return FC.quoteSnapshot.normalizeMaterialScope(value);
    }catch(_){ }
    const src = value && typeof value === 'object' ? value : {};
    const includeFronts = src.includeFronts !== false;
    const includeCorpus = src.includeCorpus !== false;
    return {
      kind:(src.kind === 'material' && String(src.material || '').trim()) ? 'material' : 'all',
      material:(src.kind === 'material' && String(src.material || '').trim()) ? String(src.material || '').trim() : '',
      includeFronts: includeFronts || (!includeFronts && !includeCorpus),
      includeCorpus: includeCorpus || (!includeFronts && !includeCorpus),
    };
  }

  function normalizeQuoteSelection(selection){
    const src = selection && typeof selection === 'object' ? selection : {};
    const roomScopeResolver = getResolver();
    const resolved = roomScopeResolver && typeof roomScopeResolver.resolveSelection === 'function'
      ? roomScopeResolver.resolveSelection(src, { getActiveRooms:getActiveRooms })
      : { selectedRooms:getActiveRooms() };
    return {
      selectedRooms: Array.isArray(resolved && resolved.selectedRooms) ? resolved.selectedRooms : getActiveRooms(),
      materialScope: normalizeMaterialScope(src.materialScope),
    };
  }

  function decodeSelectedRooms(selectionOverride){
    const normalizedOverride = normalizeQuoteSelection(selectionOverride);
    if(Array.isArray(normalizedOverride.selectedRooms) && normalizedOverride.selectedRooms.length) return normalizedOverride.selectedRooms;
    try{
      const roomScopeResolver = getResolver();
      const prefs = FC.rozrysPrefs && typeof FC.rozrysPrefs.loadPanelPrefs === 'function' ? (FC.rozrysPrefs.loadPanelPrefs() || {}) : {};
      if(roomScopeResolver && typeof roomScopeResolver.decodeSelectionFromPrefs === 'function'){
        return roomScopeResolver.decodeSelectionFromPrefs(prefs.selectedRooms, { getActiveRooms:getActiveRooms });
      }
      const decoded = FC.rozrysScope && typeof FC.rozrysScope.decodeRoomsSelection === 'function'
        ? FC.rozrysScope.decodeRoomsSelection(prefs.selectedRooms, { getRooms:getActiveRooms })
        : [];
      return Array.isArray(decoded) && decoded.length ? decoded : getActiveRooms();
    }catch(_){
      return getActiveRooms();
    }
  }

  function createQuoteValidationError(code, title, message, details){
    const error = new Error(String(message || title || 'Nie można utworzyć wyceny.'));
    error.code = String(code || 'quote_validation');
    error.title = String(title || 'Nie można utworzyć wyceny');
    error.quoteValidation = true;
    error.details = details && typeof details === 'object' ? details : {};
    return error;
  }

  function validateQuoteSelection(normalizedSelection){
    const selection = normalizedSelection && typeof normalizedSelection === 'object' ? normalizedSelection : normalizeQuoteSelection({});
    const roomScopeResolver = getResolver();
    const resolved = roomScopeResolver && typeof roomScopeResolver.resolveSelection === 'function'
      ? roomScopeResolver.resolveSelection(selection, { getActiveRooms:getActiveRooms })
      : { activeRooms:getActiveRooms().map((roomId)=> String(roomId || '').trim()).filter(Boolean), selectedRooms:Array.isArray(selection.selectedRooms) ? selection.selectedRooms.map((roomId)=> String(roomId || '').trim()).filter(Boolean) : [] };
    const activeRooms = Array.isArray(resolved.activeRooms) ? resolved.activeRooms : [];
    const activeSet = new Set(activeRooms);
    const selectedRooms = Array.isArray(resolved.selectedRooms) ? resolved.selectedRooms : [];
    if(!activeRooms.length){
      throw createQuoteValidationError(
        'no_rooms',
        'Brak pomieszczeń',
        'Nie istnieje żadne pomieszczenie. Najpierw dodaj pomieszczenie, aby utworzyć wycenę.',
        { selectedRooms, activeRooms }
      );
    }
    if(!selectedRooms.length){
      throw createQuoteValidationError(
        'no_selected_rooms',
        'Brak wybranego pomieszczenia',
        'Nie istnieje wybrane pomieszczenie. Wybierz istniejące pomieszczenie, aby utworzyć wycenę.',
        { selectedRooms, activeRooms }
      );
    }
    const validSelected = selectedRooms.filter((roomId)=> activeSet.has(roomId));
    if(!validSelected.length){
      throw createQuoteValidationError(
        'selected_room_missing',
        'Brak wybranego pomieszczenia',
        selectedRooms.length > 1
          ? 'Nie istnieją wybrane pomieszczenia. Wybierz istniejące pomieszczenia, aby utworzyć wycenę.'
          : 'Nie istnieje wybrane pomieszczenie. Wybierz istniejące pomieszczenie, aby utworzyć wycenę.',
        { selectedRooms, activeRooms }
      );
    }
    return Object.assign({}, selection, { selectedRooms: validSelected });
  }

  function validateQuoteContent(data){
    const selectedRooms = Array.isArray(data && data.selectedRooms) ? data.selectedRooms.map((roomId)=> String(roomId || '').trim()).filter(Boolean) : [];
    const materialLines = Array.isArray(data && data.materialLines) ? data.materialLines : [];
    const accessoryLines = Array.isArray(data && data.accessoryLines) ? data.accessoryLines : [];
    const agdLines = Array.isArray(data && data.agdLines) ? data.agdLines : [];
    const quoteRateLines = Array.isArray(data && data.quoteRateLines) ? data.quoteRateLines : [];
    if(materialLines.length || accessoryLines.length || agdLines.length || quoteRateLines.length) return;
    throw createQuoteValidationError(
      'empty_quote_scope',
      selectedRooms.length > 1 ? 'Brak danych w pomieszczeniach' : 'Brak danych w pomieszczeniu',
      selectedRooms.length > 1
        ? 'Wybrane pomieszczenia nie posiadają jeszcze żadnych danych do wyceny.'
        : 'To pomieszczenie nie posiada jeszcze żadnych danych do wyceny.',
      { selectedRooms }
    );
  }

  function decodeMaterialScope(selectionOverride){
    const normalizedOverride = normalizeQuoteSelection(selectionOverride);
    if(normalizedOverride && normalizedOverride.materialScope) return normalizedOverride.materialScope;
    try{
      const prefs = FC.rozrysPrefs && typeof FC.rozrysPrefs.loadPanelPrefs === 'function' ? (FC.rozrysPrefs.loadPanelPrefs() || {}) : {};
      if(FC.rozrysScope && typeof FC.rozrysScope.decodeMaterialScope === 'function') return FC.rozrysScope.decodeMaterialScope(prefs.materialScope);
    }catch(_){ }
    return { kind:'all', includeFronts:true, includeCorpus:true };
  }

  FC.wycenaCoreSelection = {
    getActiveRooms,
    normalizeMaterialScope,
    normalizeQuoteSelection,
    decodeSelectedRooms,
    decodeMaterialScope,
    validateQuoteSelection,
    validateQuoteContent,
    createQuoteValidationError,
  };
})();
