// js/app/material/price-modal-context.js
// Wspólny kontekst i cienkie helpery dla modala cenników/katalogów.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const catalogDomain = FC.catalogDomain || {};
  const runtimeState = {
    itemModalOpen:false,
    itemInitialSignature:'',
    filters:{ materialType:'', manufacturer:'', category:'' },
  };

  function byId(id){ return document.getElementById(id); }
  function appUiState(){ return (typeof uiState !== 'undefined' && uiState) ? uiState : ((FC.uiState && FC.uiState.get) ? FC.uiState.get() : {}); }
  function catalogStore(){ return FC.catalogStore || null; }
  function currentListKind(){
    const kind = String((appUiState() && appUiState().showPriceList) || 'materials');
    return ['materials','accessories','quoteRates','workshopServices'].includes(kind) ? kind : 'materials';
  }
  function currentConfig(){
    if(catalogStore() && catalogStore().getPriceConfig) return catalogStore().getPriceConfig(currentListKind());
    if(catalogDomain && typeof catalogDomain.getCatalogConfig === 'function') return catalogDomain.getCatalogConfig(currentListKind());
    return { key:'materials', title:'Materiały', subtitle:'', addLabel:'Dodaj', icon:'🧩', formKind:'material' };
  }
  function currentList(){ return catalogStore() && catalogStore().getPriceList ? catalogStore().getPriceList(currentListKind()) : []; }
  function persistUi(){ try{ FC.storage.setJSON(STORAGE_KEYS.ui, appUiState()); }catch(_){ } }
  function saveCurrentList(next){ if(catalogStore() && typeof catalogStore().savePriceList === 'function') catalogStore().savePriceList(currentListKind(), next); }
  function normalizeKey(value){ return String(value == null ? '' : value).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
  function info(title, message){ try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title, message }); }catch(_){ } }
  function askConfirm(opts){ try{ return FC.confirmBox && FC.confirmBox.ask ? FC.confirmBox.ask(opts || {}) : Promise.resolve(true); }catch(_){ return Promise.resolve(true); } }
  function confirmDelete(){ return askConfirm({ title:'Usunąć pozycję?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' }).then(Boolean); }
  function confirmDiscard(){ return askConfirm({ title:'ANULOWAĆ ZMIANY?', message:'Niezapisane zmiany w tej pozycji zostaną utracone.', confirmText:'✕ ANULUJ ZMIANY', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' }).then(Boolean); }
  function confirmSave(){
    const isEdit = !!(appUiState() && appUiState().editingId);
    const cfg = currentConfig();
    return askConfirm({ title:'ZAPISAĆ ZMIANY?', message:isEdit ? 'Zapisać zmiany w tej pozycji katalogu?' : ('Dodać nową pozycję do: ' + cfg.title + '?'), confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' }).then(Boolean);
  }
  function setModalShellOpen(modal, wasOpen){
    if(modal && !wasOpen){
      try{ lockModalScroll(); }catch(_){ }
      try{ modal.classList.add('modal-open-guard'); requestAnimationFrame(()=> setTimeout(()=>{ try{ modal.classList.remove('modal-open-guard'); }catch(_){ } }, 260)); }catch(_){ }
    }
  }

  FC.priceModal = FC.priceModal || {};
  FC.priceModalContext = Object.assign(FC.priceModalContext || {}, {
    MATERIAL_TYPES:Array.isArray(catalogDomain.SHEET_MATERIAL_TYPES) ? catalogDomain.SHEET_MATERIAL_TYPES.slice() : ['laminat','akryl','lakier','blat'],
    QUOTE_RATE_CATEGORIES:Array.isArray(catalogDomain.QUOTE_RATE_CATEGORIES) ? catalogDomain.QUOTE_RATE_CATEGORIES.slice() : ['Montaż','AGD','Pomiar','Transport','Projekt','Inne'],
    WORKSHOP_SERVICE_CATEGORIES:Array.isArray(catalogDomain.WORKSHOP_SERVICE_CATEGORIES) ? catalogDomain.WORKSHOP_SERVICE_CATEGORIES.slice() : ['Cięcie','Oklejanie','Montaż','Naprawa','Transport','Inne'],
    runtimeState, byId, appUiState, catalogStore, currentListKind, currentConfig, currentList,
    persistUi, saveCurrentList, normalizeKey, info, confirmDelete, confirmDiscard, confirmSave,
    setModalShellOpen,
  });
})();
