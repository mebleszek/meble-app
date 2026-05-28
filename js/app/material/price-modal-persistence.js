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
    return true;
  }
  function validateServiceForm(data){
    if(!String(data && data.name || '').trim()){ ctx.info('Brak nazwy', 'Wprowadź nazwę usługi, zanim ją zapiszesz.'); return false; }
    if(!String(data && data.category || '').trim()){ ctx.info('Brak kategorii', 'Wybierz kategorię usługi.'); return false; }
    return true;
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
    upsertCurrentList(Object.assign({}, data, { price:Number(data.price) || 0, hasGrain:!!data.hasGrain }));
    ctx.doClosePriceItemModal(); ctx.renderPriceModal(); try{ renderCabinetModal(); }catch(_){ } return true;
  }
  function saveAccessoryFromForm(){
    const data = ctx.getCurrentAccessoryDraft(); if(!validateAccessoryForm(data)) return false;
    upsertCurrentList(Object.assign({}, data, { price:Number(data.price) || 0 }));
    ctx.doClosePriceItemModal(); ctx.renderPriceModal(); return true;
  }
  function saveServiceFromForm(){
    try{ if(ctx.currentListKind() === 'quoteRates' && FC.wycenaCore && typeof FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const data = ctx.getCurrentServiceDraft(); if(!validateServiceForm(data)) return false;
    upsertCurrentList(Object.assign({}, data, { price:Number(data.price) || 0 }));
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
