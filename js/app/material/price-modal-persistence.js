// js/app/material/price-modal-persistence.js
// Walidacja, zapis i usuwanie pozycji katalogów/cenników.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function validateMaterialForm(data){
    if(!String(data && data.name || '').trim()){ ctx.info('Brak nazwy', 'Wprowadź nazwę materiału, zanim go zapiszesz.'); return false; }
    if(!String(data && data.materialType || '').trim()){ ctx.info('Brak typu', 'Wybierz typ materiału.'); return false; }
    if(!String(data && data.manufacturer || '').trim()){ ctx.info('Brak producenta', 'Wybierz producenta dla materiału.'); return false; }
    return true;
  }
  function validateAccessoryForm(data){
    if(!String(data && data.name || '').trim()){ ctx.info('Brak nazwy', 'Wprowadź nazwę akcesorium, zanim je zapiszesz.'); return false; }
    if(!String(data && data.manufacturer || '').trim()){ ctx.info('Brak producenta', 'Wybierz producenta akcesorium.'); return false; }
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.uniqueTypeConflict === 'function'){
      const conflict = FC.hardwareCatalog.uniqueTypeConflict(ctx.currentList(), data, ctx.appUiState() && ctx.appUiState().editingId);
      if(conflict){
        ctx.info('Duplikat wymagań technicznych u producenta', 'Dla tego producenta, kategorii i tych samych cech technicznych używanych do porównania istnieje już pozycja: ' + String(conflict.name || conflict.symbol || conflict.id || '—') + '. Nazwa techniczna jest tylko podglądem; blokada duplikatu opiera się na parametrach oznaczonych „Użyj do porównania”.');
        return false;
      }
    }
    return true;
  }
  function validateServiceForm(data){
    if(!String(data && data.name || '').trim()){ ctx.info('Brak nazwy', 'Wprowadź nazwę usługi, zanim ją zapiszesz.'); return false; }
    if(!String(data && data.category || '').trim()){ ctx.info('Brak kategorii', 'Wybierz kategorię usługi.'); return false; }
    if(ctx.currentListKind && ctx.currentListKind() === 'quoteRates'){
      const labor = FC.laborCatalog || {};
      const isHourly = data && (data.isHourlyRate === true || (labor.isHourlyRateDefinition && labor.isHourlyRateDefinition(data)));
      if(!isHourly) return true;
      const existing = ctx.currentList ? ctx.currentList() : [];
      const editing = ctx.currentEditedItem ? ctx.currentEditedItem() : null;
      const oldCode = editing && labor.isHourlyRateDefinition && labor.isHourlyRateDefinition(editing)
        ? (editing.rateKey || editing.rateCode || editing.rateType)
        : '';
      try{
        if(labor.validateRateProfile){
          const result = labor.validateRateProfile(data, existing.filter((row)=> !editing || String(row.id) !== String(editing.id)), { oldCode });
          if(!result || !result.ok){ ctx.info('Nie można zapisać stawki godzinowej', String((result && result.message) || 'Sprawdź kod techniczny, nazwę i kwotę.')); return false; }
        }
      }catch(err){ ctx.info('Nie można zapisać stawki godzinowej', String(err && err.message ? err.message : 'Sprawdź dane stawki.')); return false; }
    }
    return true;
  }
  function editedTimestamp(){ try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); } }
  function markPriceAsUserEdited(payload){
    return Object.assign({}, payload || {}, { starterPrice:false, priceUserEditedAt:editedTimestamp() });
  }

  function upsertCurrentList(payload){
    const next = ctx.currentList();
    if(ctx.appUiState().editingId){
      const idx = next.findIndex((item)=> item.id === ctx.appUiState().editingId);
      if(idx >= 0) next[idx] = Object.assign({}, next[idx], payload);
    }else next.push(Object.assign({ id:FC.utils.uid() }, payload));
    ctx.saveCurrentList(next);
  }

  function saveMaterialFromForm(){
    const data = ctx.getCurrentMaterialDraft(); if(!validateMaterialForm(data)) return false;
    upsertCurrentList(markPriceAsUserEdited(Object.assign({}, data, { price:Number(data.price) || 0, hasGrain:!!data.hasGrain })));
    ctx.doClosePriceItemModal(); ctx.renderPriceModal(); try{ renderCabinetModal(); }catch(_){ } return true;
  }
  function saveAccessoryFromForm(){
    const data = ctx.getCurrentAccessoryDraft(); if(!validateAccessoryForm(data)) return false;
    let payload = Object.assign({}, data, { price:Number(data.price) || 0 });
    try{
      if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeAccessory === 'function') payload = FC.hardwareCatalog.normalizeAccessory(payload, FC.utils && FC.utils.uid);
    }catch(_){ }
    upsertCurrentList(markPriceAsUserEdited(payload));
    ctx.doClosePriceItemModal(); ctx.renderPriceModal(); return true;
  }
  function saveServiceFromForm(){
    try{ if(ctx.currentListKind() === 'quoteRates' && FC.wycenaCore && typeof FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const data = ctx.getCurrentServiceDraft(); if(!validateServiceForm(data)) return false;
    const payload = markPriceAsUserEdited(Object.assign({}, data, { price:Number(data.price) || 0 }));
    try{
      if(ctx.currentListKind() === 'quoteRates' && FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function'){
        upsertCurrentList(FC.laborCatalog.normalizeDefinition(payload));
      }else upsertCurrentList(payload);
    }catch(_){ upsertCurrentList(payload); }
    ctx.doClosePriceItemModal(); ctx.renderPriceModal(); return true;
  }
  async function saveActivePriceItem(){
    if(!ctx.runtimeState.itemModalOpen) return false;
    if(!ctx.isItemDirty()) return ctx.requestClosePriceItemModal('exit');
    const ok = await ctx.confirmSave(); if(!ok) return false;
    const formKind = ctx.currentConfig().formKind;
    if(formKind === 'material') return saveMaterialFromForm();
    if(formKind === 'accessory') return saveAccessoryFromForm();
    return saveServiceFromForm();
  }
  async function deletePriceItem(item){
    if(ctx.currentListKind && ctx.currentListKind() === 'quoteRates' && item && item.nonDeletable === true){
      ctx.info('Nie można usunąć stawki', 'Ta stawka jest systemowa albo już używana jako profil godzinowy. Możesz zmienić jej nazwę, kwotę albo odznaczyć „Aktywna”.');
      return false;
    }
    const ok = await ctx.confirmDelete(); if(!ok) return false;
    const next = ctx.currentList().filter((row)=> String(row.id) !== String(item && item.id));
    ctx.saveCurrentList(next);
    if(String(ctx.appUiState().editingId || '') === String(item && item.id || '')) ctx.doClosePriceItemModal();
    ctx.renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
    return true;
  }
  function deleteActivePriceItem(){ const item = ctx.currentEditedItem(); if(!item) return false; return deletePriceItem(item); }

  Object.assign(ctx, { saveMaterialFromForm, saveAccessoryFromForm, saveServiceFromForm, saveActivePriceItem, deletePriceItem, deleteActivePriceItem });
})();
