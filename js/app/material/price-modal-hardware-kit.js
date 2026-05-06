// js/app/material/price-modal-hardware-kit.js
// Skład zestawu/kompletu okuć z istniejących pozycji katalogu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  const FIELD_IDS = ['hardwareKitPriceMode','hardwareKitComponentsJson'];
  const KIT_UNITS = new Set(['zestaw','kpl.']);
  let components = [];
  let wired = false;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function money(value){ return (Number(value) || 0).toFixed(2) + ' PLN'; }
  function byId(id){ return ctx.byId ? ctx.byId(id) : document.getElementById(id); }
  function currentList(){ try{ return Array.isArray(ctx.currentList()) ? ctx.currentList() : []; }catch(_){ return []; } }
  function editingId(){ try{ return ctx.appUiState() && ctx.appUiState().editingId || ''; }catch(_){ return ''; } }
  function isKitUnit(unit){ return KIT_UNITS.has(text(unit)); }
  function isVisible(){ return isKitUnit(byId('hardwareUnit') && byId('hardwareUnit').value); }
  function getPriceMode(){ return text(byId('hardwareKitPriceMode') && byId('hardwareKitPriceMode').value) || 'own'; }
  function isComponentsMode(){ return isVisible() && getPriceMode() === 'components'; }
  function setValue(id, value){ const el = byId(id); if(el) el.value = value == null ? '' : String(value); }
  function dispatchDirty(){ try{ if(ctx.updateItemActionState) ctx.updateItemActionState(); }catch(_){ } }

  function normalizeComponent(row){
    const src = row && typeof row === 'object' ? row : {};
    return {
      itemId:text(src.itemId || src.id),
      nameSnapshot:text(src.nameSnapshot || src.name),
      manufacturerSnapshot:text(src.manufacturerSnapshot || src.manufacturer),
      unitSnapshot:text(src.unitSnapshot || src.hardwareUnit || src.unit || 'szt.'),
      qty:Math.max(0, num(src.qty || src.quantity || 1) || 1),
      purchasePriceGrossSnapshot:round2(num(src.purchasePriceGrossSnapshot != null ? src.purchasePriceGrossSnapshot : (src.purchasePriceGross != null ? src.purchasePriceGross : src.price))),
      quotePriceGrossSnapshot:round2(num(src.quotePriceGrossSnapshot != null ? src.quotePriceGrossSnapshot : src.price)),
    };
  }

  function normalizeComponents(list){
    return (Array.isArray(list) ? list : []).map(normalizeComponent).filter((row)=> row.itemId || row.nameSnapshot);
  }

  function findCurrentItem(id){
    const key = text(id);
    return currentList().find((row)=> text(row && row.id) === key) || null;
  }

  function resolveComponent(row){
    const item = findCurrentItem(row && row.itemId);
    return Object.assign({}, normalizeComponent(row), item ? {
      nameSnapshot:text(item.name) || row.nameSnapshot,
      manufacturerSnapshot:text(item.manufacturer) || row.manufacturerSnapshot,
      unitSnapshot:text(item.hardwareUnit || item.unit) || row.unitSnapshot,
      purchasePriceGrossSnapshot:round2(num(item.purchasePriceGross != null ? item.purchasePriceGross : item.price)),
      quotePriceGrossSnapshot:round2(num(item.price)),
    } : {});
  }

  function componentsTotalGross(){
    return round2(components.reduce((sum, row)=>{
      const resolved = resolveComponent(row);
      return sum + (num(resolved.purchasePriceGrossSnapshot) * Math.max(0, num(row.qty)));
    }, 0));
  }

  function componentsReferenceTotalGross(){
    return round2(components.reduce((sum, row)=>{
      const resolved = resolveComponent(row);
      return sum + (num(resolved.quotePriceGrossSnapshot) * Math.max(0, num(row.qty)));
    }, 0));
  }

  function syncHidden(){ setValue('hardwareKitComponentsJson', JSON.stringify(components)); }

  function renderList(){
    const list = byId('hardwareKitComponentsList');
    const preview = byId('hardwareKitPreview');
    if(!list) return;
    list.innerHTML = '';
    if(!components.length){
      const empty = document.createElement('div');
      empty.className = 'muted xs hardware-kit-empty';
      empty.textContent = 'Brak składników zestawu.';
      list.appendChild(empty);
    }else{
      components.forEach((row, index)=>{
        const resolved = resolveComponent(row);
        const card = document.createElement('div');
        card.className = 'hardware-kit-row';
        const main = document.createElement('div');
        main.className = 'hardware-kit-row__main';
        const title = document.createElement('div');
        title.className = 'hardware-kit-row__title';
        title.textContent = (resolved.nameSnapshot || 'Składnik') + (resolved.manufacturerSnapshot ? ' • ' + resolved.manufacturerSnapshot : '');
        const meta = document.createElement('div');
        meta.className = 'muted xs';
        const itemTotal = round2(num(resolved.purchasePriceGrossSnapshot) * num(row.qty));
        meta.textContent = money(resolved.purchasePriceGrossSnapshot) + '/' + (resolved.unitSnapshot || 'szt.') + ' × ilość = ' + money(itemTotal);
        main.appendChild(title);
        main.appendChild(meta);
        const qty = document.createElement('input');
        qty.className = 'investor-form-input hardware-kit-row__qty';
        qty.type = 'number';
        qty.min = '0';
        qty.step = '0.01';
        qty.value = String(row.qty || 1);
        qty.addEventListener('input', ()=>{
          components[index].qty = Math.max(0, num(qty.value));
          syncHidden();
          renderList();
          try{ if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing({ sourceId:'hardwareKitComponentsJson' }); }catch(_){ }
          dispatchDirty();
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-danger hardware-kit-row__remove';
        remove.textContent = 'Usuń';
        remove.addEventListener('click', ()=>{
          components.splice(index, 1);
          syncHidden();
          renderList();
          try{ if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing({ sourceId:'hardwareKitComponentsJson' }); }catch(_){ }
          dispatchDirty();
        });
        card.appendChild(main);
        card.appendChild(qty);
        card.appendChild(remove);
        list.appendChild(card);
      });
    }
    if(preview){
      const sum = componentsTotalGross();
      const ref = componentsReferenceTotalGross();
      const diff = round2(ref - sum);
      preview.textContent = 'Suma zakupu składników: ' + money(sum) + (ref > 0 ? ' • suma cen do wyceny osobno: ' + money(ref) + (Math.abs(diff) > 0.001 ? ' • różnica: ' + money(diff) : '') : '');
    }
  }

  function selectableRows(){
    const ownId = text(editingId());
    const selected = new Set(components.map((row)=> text(row.itemId)).filter(Boolean));
    return currentList().filter((row)=>{
      const id = text(row && row.id);
      if(!id || id === ownId || selected.has(id)) return false;
      if(String(row && row.status || 'active') === 'archived') return false;
      return !!text(row && row.name);
    });
  }

  function openComponentPicker(){
    const rows = selectableRows();
    const body = document.createElement('div');
    body.className = 'hardware-kit-picker';
    if(!rows.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Brak dostępnych pozycji. Najpierw dodaj pojedyncze okucia, a potem zbuduj z nich zestaw.';
      body.appendChild(empty);
    }else{
      rows.forEach((item)=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rozrys-choice-option hardware-kit-picker__option';
        btn.innerHTML = '<div class="rozrys-choice-option__title"></div><div class="rozrys-choice-option__subtitle"></div>';
        const title = btn.querySelector('.rozrys-choice-option__title');
        const sub = btn.querySelector('.rozrys-choice-option__subtitle');
        if(title) title.textContent = String(item.name || 'Okucie');
        if(sub) sub.textContent = [item.manufacturer, item.hardwareCategory, item.hardwareUnit, money(item.purchasePriceGross != null ? item.purchasePriceGross : item.price)].filter(Boolean).join(' • ');
        btn.addEventListener('click', ()=>{
          components.push(normalizeComponent(item));
          syncHidden();
          renderList();
          try{ if(FC.panelBox && typeof FC.panelBox.close === 'function') FC.panelBox.close(); }catch(_){ }
          try{ if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing({ sourceId:'hardwareKitComponentsJson' }); }catch(_){ }
          dispatchDirty();
        });
        body.appendChild(btn);
      });
    }
    if(FC.panelBox && typeof FC.panelBox.open === 'function'){
      FC.panelBox.open({ title:'Dodaj składnik zestawu', contentNode:body, width:'640px', boxClass:'panel-box--rozrys', dismissOnEsc:true });
    }
  }

  function wire(){
    if(wired) return;
    wired = true;
    const add = byId('hardwareAddKitComponentBtn');
    if(add) add.addEventListener('click', openComponentPicker);
    const mode = byId('hardwareKitPriceMode');
    if(mode) mode.addEventListener('change', ()=>{
      syncVisibility();
      try{ if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing({ sourceId:'hardwareKitPriceMode' }); }catch(_){ }
      dispatchDirty();
    });
  }

  function syncVisibility(){
    wire();
    const wrap = byId('hardwareKitFields');
    const visible = isVisible();
    if(wrap) wrap.style.display = visible ? '' : 'none';
    const componentsMode = isComponentsMode();
    ['hardwareCatalogPriceNet','hardwareCatalogPriceGross'].forEach((id)=>{
      const el = byId(id);
      if(!el) return;
      el.disabled = componentsMode;
      if(componentsMode) el.setAttribute('aria-disabled', 'true');
      else el.removeAttribute('aria-disabled');
    });
    renderList();
  }

  function applyAccessoryFormState(item){
    components = normalizeComponents(item && item.kitComponents);
    setValue('hardwareKitPriceMode', text(item && item.kitPriceMode) || 'own');
    syncHidden();
    syncVisibility();
  }

  function getDraft(){
    return {
      kitPriceMode:getPriceMode(),
      kitComponents:normalizeComponents(components),
      kitComponentsTotalGross:componentsTotalGross(),
      kitReferenceTotalGross:componentsReferenceTotalGross(),
    };
  }

  ctx.priceModalHardwareKit = {
    FIELD_IDS,
    applyAccessoryFormState,
    getDraft,
    syncVisibility,
    isComponentsMode,
    getComponentsTotalGross:componentsTotalGross,
    getComponentsReferenceTotalGross:componentsReferenceTotalGross,
    normalizeComponents,
  };
})();
