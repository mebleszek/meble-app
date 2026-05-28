// js/app/cabinet/cabinet-modal-set-materials.js
// Unified material fields for cabinet set wizard: body, backs, opening.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function getFieldsApi(){ return (window.FC && window.FC.cabinetModalFields) || {}; }

  function text(value){ return String(value == null ? '' : value).trim(); }

  function populateBodyColorsTo(selectEl, selected){
    const api = getFieldsApi();
    if(api && typeof api.populateBodyColorsTo === 'function') return api.populateBodyColorsTo(selectEl, selected);
    return null;
  }

  function populateOpeningOptionsTo(selectEl, typeVal, selected){
    const api = getFieldsApi();
    if(api && typeof api.populateOpeningOptionsTo === 'function') return api.populateOpeningOptionsTo(selectEl, typeVal, selected);
    return null;
  }

  function populateBackOptionsTo(selectEl, selected){
    if(!selectEl) return;
    const options = ['HDF 3mm biała', '18 mm pod kolor korpusu', 'Brak'];
    selectEl.innerHTML = '';
    options.forEach(function(value){
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value === '18 mm pod kolor korpusu' ? '18 mm pod kolor' : (value === 'Brak' ? 'Brak pleców' : value);
      if(text(selected) === value) opt.selected = true;
      selectEl.appendChild(opt);
    });
    if(selected && String(selectEl.value || '') !== String(selected)){
      const opt = document.createElement('option');
      opt.value = text(selected);
      opt.textContent = text(selected);
      opt.selected = true;
      selectEl.appendChild(opt);
    }
  }

  function populateSelectors(defaults){
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const bodySel = document.getElementById('setBodyColor');
    const backSel = document.getElementById('setBackMaterial');
    const openingSel = document.getElementById('setOpeningSystem');

    populateBodyColorsTo(bodySel, base.bodyColor || '');
    if(bodySel && base.bodyColor) bodySel.value = base.bodyColor;
    if(bodySel && !bodySel.value && bodySel.options && bodySel.options.length) bodySel.value = String(bodySel.options[0].value || '');

    populateBackOptionsTo(backSel, base.backMaterial || 'HDF 3mm biała');
    if(backSel && base.backMaterial) backSel.value = base.backMaterial;

    populateOpeningOptionsTo(openingSel, 'stojąca', base.openingSystem || 'uchwyt klienta');
    if(openingSel && base.openingSystem) openingSel.value = base.openingSystem;
  }

  function getSpec(defaults){
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const bodySel = document.getElementById('setBodyColor');
    const backSel = document.getElementById('setBackMaterial');
    const openingSel = document.getElementById('setOpeningSystem');
    return {
      bodyColor: text((bodySel && bodySel.value) || base.bodyColor || ''),
      backMaterial: text((backSel && backSel.value) || base.backMaterial || 'HDF 3mm biała'),
      openingSystem: text((openingSel && openingSel.value) || base.openingSystem || 'uchwyt klienta')
    };
  }

  ns.cabinetModalSetMaterials = {
    populateSelectors,
    getSpec,
    populateBackOptionsTo
  };
})();
