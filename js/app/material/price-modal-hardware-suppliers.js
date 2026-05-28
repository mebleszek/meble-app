// js/app/material/price-modal-hardware-suppliers.js
// Dostawcy okuć oraz globalne ustawienia cen katalogu okuć.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach((key)=>{
        if(key === 'class') el.className = attrs[key];
        else if(key === 'text') el.textContent = attrs[key];
        else if(key === 'html') el.innerHTML = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach((child)=> el.appendChild(child));
    return el;
  }
  function getStore(){ return ctx.catalogStore && ctx.catalogStore(); }
  function getSuppliers(){ const store = getStore(); return store && typeof store.getHardwareSuppliers === 'function' ? store.getHardwareSuppliers() : []; }
  function saveSuppliers(list){ const store = getStore(); return store && typeof store.saveHardwareSuppliers === 'function' ? store.saveHardwareSuppliers(list) : []; }
  function getSettings(){ const store = getStore(); return store && typeof store.getHardwareSettings === 'function' ? store.getHardwareSettings() : {}; }
  function saveSettings(settings){ const store = getStore(); return store && typeof store.saveHardwareSettings === 'function' ? store.saveHardwareSettings(settings) : settings; }
  function normalize(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function uid(name){ return normalize(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ('supplier_' + Date.now()); }

  function openHardwareSuppliersModal(){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    let list = getSuppliers();
    const body = h('div', { class:'panel-box-form hardware-supplier-form' });
    const listBox = h('div', { class:'hardware-supplier-list' });
    const input = h('input', { class:'investor-form-input', type:'text', placeholder:'Nowy dostawca, np. Bivert' });
    const addBtn = h('button', { class:'btn-primary', type:'button', text:'Dodaj dostawcę' });
    const footer = h('div', { class:'panel-box-form__footer' });
    const backBtn = h('button', { class:'btn-primary', type:'button', text:'Wróć' });
    const saveBtn = h('button', { class:'btn-success', type:'button', text:'Zapisz' });

    function renderList(){
      listBox.innerHTML = '';
      if(!list.length){ listBox.appendChild(h('div', { class:'muted', text:'Brak dostawców.' })); return; }
      list.forEach((row)=>{
        const supplier = row || {};
        const item = h('div', { class:'hardware-supplier-row' });
        const name = h('input', { class:'investor-form-input', type:'text', value:supplier.name || '' });
        const discount = h('input', { class:'investor-form-input', type:'number', step:'0.01', value:String(supplier.defaultDiscountPercent || 0) });
        const vat = h('input', { class:'investor-form-input', type:'number', step:'0.01', value:String(supplier.defaultVatRate || 23) });
        const active = h('label', { class:'rozrys-scope-chip price-labor-toggle hardware-supplier-active' }, [
          h('input', { type:'checkbox' }), h('span', { text:'Aktywny' })
        ]);
        active.querySelector('input').checked = supplier.active !== false;
        const remove = h('button', { class:'btn-danger', type:'button', text:'Usuń' });
        name.addEventListener('input', ()=>{ supplier.name = name.value; if(!supplier.id) supplier.id = uid(name.value); });
        discount.addEventListener('input', ()=>{ supplier.defaultDiscountPercent = number(discount.value); });
        vat.addEventListener('input', ()=>{ supplier.defaultVatRate = number(vat.value) || 23; });
        active.querySelector('input').addEventListener('change', ()=>{ supplier.active = !!active.querySelector('input').checked; });
        remove.addEventListener('click', ()=>{ list = list.filter((item)=> String(item.id) !== String(supplier.id)); renderList(); });
        item.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Nazwa' }), name]));
        item.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Rabat %' }), discount]));
        item.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'VAT %' }), vat]));
        item.appendChild(active);
        item.appendChild(remove);
        listBox.appendChild(item);
      });
    }
    function addCurrent(){
      const value = normalize(input.value);
      if(!value) return;
      const id = uid(value);
      if(!list.some((item)=> String(item.id).toLowerCase() === id.toLowerCase())) list.push({ id, name:value, defaultDiscountPercent:0, defaultVatRate:23, active:true });
      input.value = '';
      renderList();
    }
    addBtn.addEventListener('click', addCurrent);
    input.addEventListener('keydown', (event)=>{ if(event && event.key === 'Enter'){ event.preventDefault(); addCurrent(); } });
    backBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    saveBtn.addEventListener('click', ()=>{
      saveSuppliers(list);
      try{ ctx.syncFilterSelects && ctx.syncFilterSelects(); ctx.mountFilterChoices && ctx.mountFilterChoices(); ctx.renderPriceList && ctx.renderPriceList(); }catch(_){ }
      try{ FC.panelBox.close(); }catch(_){ }
    });
    body.appendChild(h('div', { class:'hardware-manufacturer-add' }, [input, addBtn]));
    body.appendChild(listBox);
    footer.appendChild(backBtn); footer.appendChild(saveBtn); body.appendChild(footer);
    renderList();
    FC.panelBox.open({ title:'Dostawcy okuć', contentNode:body, width:'720px', boxClass:'panel-box--rozrys hardware-supplier-panel', dismissOnOverlay:false, dismissOnEsc:true });
  }

  function openHardwareSettingsModal(){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const settings = getSettings();
    const body = h('div', { class:'panel-box-form hardware-settings-form' });
    const supplierSelect = h('select', { id:'hardwareSettingsDefaultSupplier' });
    const supplierLaunch = h('div', { id:'hardwareSettingsDefaultSupplierLaunch' });
    const vat = h('input', { class:'investor-form-input', type:'number', step:'0.01', value:String(settings.defaultVatRate || 23) });
    const markup = h('input', { class:'investor-form-input', type:'number', step:'0.01', value:String(settings.defaultMarkupPercent || 20) });
    const quoteBase = h('select', { id:'hardwareSettingsQuoteBase' });
    const quoteBaseLaunch = h('div', { id:'hardwareSettingsQuoteBaseLaunch' });
    const pricingMode = h('select', { id:'hardwareSettingsPricingMode' });
    const pricingModeLaunch = h('div', { id:'hardwareSettingsPricingModeLaunch' });
    const footer = h('div', { class:'panel-box-form__footer' });
    const backBtn = h('button', { class:'btn-primary', type:'button', text:'Wróć' });
    const saveBtn = h('button', { class:'btn-success', type:'button', text:'Zapisz' });

    function fillSelect(select, options, value){
      select.innerHTML = '';
      (options || []).forEach((opt)=>{
        const option = document.createElement('option'); option.value = String(opt.value || ''); option.textContent = String(opt.label || opt.value || ''); select.appendChild(option);
      });
      select.value = String(value || '');
    }
    fillSelect(supplierSelect, ctx.buildHardwareSupplierOptions ? ctx.buildHardwareSupplierOptions(settings.defaultSupplierId, { includeAll:false }) : [], settings.defaultSupplierId);
    fillSelect(quoteBase, ctx.buildHardwareQuoteBaseOptions ? ctx.buildHardwareQuoteBaseOptions() : [], settings.defaultQuoteBase || 'catalogGross');
    fillSelect(pricingMode, ctx.buildHardwarePricingModeOptions ? ctx.buildHardwarePricingModeOptions() : [], settings.defaultPricingMode || 'markup');
    body.appendChild(h('div', { class:'grid-2' }, [
      h('div', {}, [h('label', { text:'Domyślny dostawca' }), supplierSelect, supplierLaunch]),
      h('div', {}, [h('label', { text:'Domyślny VAT %' }), vat]),
    ]));
    body.appendChild(h('div', { class:'grid-2', style:'margin-top:10px' }, [
      h('div', {}, [h('label', { text:'Cena bazowa do wyceny' }), quoteBase, quoteBaseLaunch]),
      h('div', {}, [h('label', { text:'Sposób liczenia ceny' }), pricingMode, pricingModeLaunch]),
    ]));
    body.appendChild(h('div', { style:'margin-top:10px' }, [h('label', { text:'Domyślny narzut %' }), markup]));
    body.appendChild(h('div', { class:'muted', style:'margin-top:10px;line-height:1.35', text:'Te ustawienia są domyślne dla nowych okuć. Pojedynczą pozycję będzie można zmienić niezależnie.' }));
    backBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    saveBtn.addEventListener('click', ()=>{
      saveSettings({ defaultSupplierId:supplierSelect.value, defaultVatRate:number(vat.value) || 23, defaultMarkupPercent:number(markup.value), defaultQuoteBase:quoteBase.value || 'catalogGross', defaultPricingMode:pricingMode.value || 'markup' });
      try{ FC.panelBox.close(); }catch(_){ }
    });
    footer.appendChild(backBtn); footer.appendChild(saveBtn); body.appendChild(footer);
    FC.panelBox.open({ title:'Ustawienia cen okuć', contentNode:body, width:'620px', boxClass:'panel-box--rozrys hardware-settings-panel', dismissOnOverlay:false, dismissOnEsc:true });
    try{
      if(ctx.mountChoice){
        ctx.mountChoice({ selectEl:supplierSelect, mountId:'hardwareSettingsDefaultSupplierLaunch', title:'Wybierz domyślnego dostawcę', buttonClass:'investor-choice-launch', placeholder:'Dostawca' });
        ctx.mountChoice({ selectEl:quoteBase, mountId:'hardwareSettingsQuoteBaseLaunch', title:'Wybierz cenę bazową', buttonClass:'investor-choice-launch', placeholder:'Cena bazowa' });
        ctx.mountChoice({ selectEl:pricingMode, mountId:'hardwareSettingsPricingModeLaunch', title:'Wybierz sposób liczenia ceny', buttonClass:'investor-choice-launch', placeholder:'Sposób liczenia' });
      }
      supplierSelect.hidden = true; quoteBase.hidden = true; pricingMode.hidden = true;
    }catch(_){ }
  }

  ctx.openHardwareSuppliersModal = openHardwareSuppliersModal;
  ctx.openHardwareSettingsModal = openHardwareSettingsModal;
  FC.priceModalHardwareSuppliers = { open:openHardwareSuppliersModal, openSettings:openHardwareSettingsModal };
})();
