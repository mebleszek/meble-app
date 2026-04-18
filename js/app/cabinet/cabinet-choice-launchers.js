(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const SAFE_FIELD_CONFIG = [
    { id:'cmSubType', title:'Wybierz wariant', placeholder:'Wybierz wariant' },
    { id:'cmFrontMaterial', title:'Wybierz materiał frontu', placeholder:'Wybierz materiał frontu' },
    { id:'cmFrontColor', title:'Wybierz kolor frontu', placeholder:'Wybierz kolor frontu' },
    { id:'cmBackMaterial', title:'Wybierz plecy', placeholder:'Wybierz plecy' },
    { id:'cmBodyColor', title:'Wybierz korpus', placeholder:'Wybierz korpus' },
    { id:'cmOpeningSystem', title:'Wybierz system otwierania', placeholder:'Wybierz system otwierania' },
    {
      id:'cmFrontCount',
      title:'Wybierz ilość frontów',
      placeholder:'Wybierz ilość frontów',
      shouldMount(){
        const selectEl = document.getElementById('cmFrontCount');
        const staticEl = document.getElementById('cmFrontCountStatic');
        if(!selectEl) return false;
        if(staticEl && getComputedStyle(staticEl).display !== 'none') return false;
        return getComputedStyle(selectEl).display !== 'none';
      }
    },
    {
      id:'cmFlapVendor',
      title:'Wybierz producenta podnośnika',
      placeholder:'Wybierz producenta podnośnika',
      shouldMount(){
        const wrap = document.getElementById('cmFlapWrap');
        const selectEl = document.getElementById('cmFlapVendor');
        if(!wrap || !selectEl) return false;
        return getComputedStyle(wrap).display !== 'none' && getComputedStyle(selectEl).display !== 'none';
      }
    },
    {
      id:'cmFlapKind',
      title:'Wybierz rodzaj podnośnika',
      placeholder:'Wybierz rodzaj podnośnika',
      shouldMount(){
        const wrap = document.getElementById('cmFlapKindWrap');
        const selectEl = document.getElementById('cmFlapKind');
        if(!wrap || !selectEl) return false;
        return getComputedStyle(wrap).display !== 'none' && getComputedStyle(selectEl).display !== 'none';
      }
    },
    {
      id:'setFrontCount',
      title:'Wybierz ilość frontów zestawu',
      placeholder:'Wybierz ilość frontów zestawu',
      shouldMount(){
        const wrap = document.getElementById('setFrontBlock');
        const selectEl = document.getElementById('setFrontCount');
        if(!wrap || !selectEl) return false;
        return getComputedStyle(wrap).display !== 'none' && getComputedStyle(selectEl).display !== 'none';
      }
    },
    {
      id:'setFrontMaterial',
      title:'Wybierz materiał frontów zestawu',
      placeholder:'Wybierz materiał frontów zestawu',
      shouldMount(){
        const wrap = document.getElementById('setFrontBlock');
        const selectEl = document.getElementById('setFrontMaterial');
        if(!wrap || !selectEl) return false;
        return getComputedStyle(wrap).display !== 'none' && getComputedStyle(selectEl).display !== 'none';
      }
    },
    {
      id:'setFrontColor',
      title:'Wybierz kolor frontów zestawu',
      placeholder:'Wybierz kolor frontów zestawu',
      shouldMount(){
        const wrap = document.getElementById('setFrontBlock');
        const selectEl = document.getElementById('setFrontColor');
        if(!wrap || !selectEl) return false;
        return getComputedStyle(wrap).display !== 'none' && getComputedStyle(selectEl).display !== 'none';
      }
    }
  ];

  function getChoiceApi(){
    const api = FC && FC.rozrysChoice;
    if(!api) return null;
    if(typeof api.createChoiceLauncher !== 'function') return null;
    if(typeof api.openRozrysChoiceOverlay !== 'function') return null;
    if(typeof api.getSelectOptionLabel !== 'function') return null;
    if(typeof api.setChoiceLaunchValue !== 'function') return null;
    return api;
  }


  function isElementVisible(el){
    if(!el) return false;
    try{
      let cur = el;
      while(cur && cur !== document.body){
        const style = getComputedStyle(cur);
        if(style.display === 'none' || style.visibility === 'hidden') return false;
        cur = cur.parentElement;
      }
      return true;
    }catch(_){ return true; }
  }

  function findSafeConfigById(id){
    return SAFE_FIELD_CONFIG.find((cfg)=> String(cfg && cfg.id || '') === String(id || '')) || null;
  }

  function resolveConfigForSelect(selectEl){
    if(!selectEl) return null;
    const safeCfg = findSafeConfigById(selectEl.id);
    if(safeCfg) return safeCfg;
    if(selectEl.classList.contains('cabinet-extra-field__control') || selectEl.classList.contains('set-front-choice-source') || selectEl.classList.contains('cabinet-dynamic-choice-source') || selectEl.getAttribute('data-launcher-label')){
      return buildDynamicConfigForSelect(selectEl);
    }
    return null;
  }

  function ensureSlot(selectEl){
    if(!selectEl || !selectEl.parentNode) return null;
    let slot = selectEl.parentNode.querySelector('.cabinet-choice-launch-slot[data-launch-for="' + selectEl.id + '"]');
    if(slot) return slot;
    slot = document.createElement('div');
    slot.className = 'cabinet-choice-launch-slot';
    slot.setAttribute('data-launch-for', String(selectEl.id || ''));
    selectEl.insertAdjacentElement('afterend', slot);
    return slot;
  }

  function cleanupLauncher(selectEl){
    if(!selectEl) return;
    selectEl.classList.remove('cabinet-choice-source--enhanced');
    selectEl.removeAttribute('aria-hidden');
    const slot = selectEl.parentNode && selectEl.parentNode.querySelector('.cabinet-choice-launch-slot[data-launch-for="' + selectEl.id + '"]');
    if(slot) slot.innerHTML = '';
  }

  function buildOptions(selectEl){
    return Array.from(selectEl && selectEl.options || []).map((opt)=> ({
      value:String(opt && opt.value != null ? opt.value : ''),
      label:String(opt && (opt.textContent || opt.label || opt.value) || ''),
      disabled: !!(opt && opt.disabled),
      description:String(opt && opt.getAttribute && opt.getAttribute('data-description') || '').trim()
    }));
  }

  function shouldMountField(selectEl, cfg){
    try{
      if(cfg && typeof cfg.shouldMount === 'function') return !!cfg.shouldMount(selectEl);
    }catch(_){ return false; }
    return !!selectEl;
  }

  function mountSelectLauncher(selectEl, cfg){
    if(!selectEl) return null;
    if(!shouldMountField(selectEl, cfg)){
      cleanupLauncher(selectEl);
      return null;
    }
    const api = getChoiceApi();
    if(!api){
      cleanupLauncher(selectEl);
      return null;
    }
    const slot = ensureSlot(selectEl);
    if(!slot) return null;
    const label = api.getSelectOptionLabel(selectEl) || String(cfg && cfg.placeholder || '');
    const btn = api.createChoiceLauncher(label, '');
    btn.classList.add('investor-choice-launch', 'cabinet-choice-launch');
    const arrow = btn.querySelector('.rozrys-choice-launch__arrow');
    if(arrow) arrow.remove();
    if(selectEl.disabled) btn.disabled = true;
    btn.addEventListener('click', async ()=>{
      if(btn.disabled) return;
      const picked = await api.openRozrysChoiceOverlay({
        title:String(cfg && cfg.title || 'Wybierz opcję'),
        value:String(selectEl.value || ''),
        options:buildOptions(selectEl)
      });
      if(picked == null || String(picked) === String(selectEl.value || '')) return;
      selectEl.value = String(picked || '');
      api.setChoiceLaunchValue(btn, api.getSelectOptionLabel(selectEl) || String(cfg && cfg.placeholder || ''), '');
      selectEl.dispatchEvent(new Event('change', { bubbles:true }));
    });
    slot.innerHTML = '';
    slot.appendChild(btn);
    selectEl.classList.add('cabinet-choice-source--enhanced');
    selectEl.setAttribute('aria-hidden', 'true');
    return btn;
  }

  function mountSafeFieldLaunchers(customConfigs){
    const configs = Array.isArray(customConfigs) && customConfigs.length ? customConfigs : SAFE_FIELD_CONFIG;
    return configs.map((cfg)=> {
      const selectEl = document.getElementById(cfg.id);
      return { id:cfg.id, button:mountSelectLauncher(selectEl, cfg) };
    });
  }


  function buildDynamicConfigForSelect(selectEl){
    if(!selectEl || !selectEl.id) return null;
    let labelText = '';
    try{
      const field = selectEl.closest('.cabinet-extra-field');
      const labelEl = field && field.querySelector('.cabinet-extra-field__label');
      if(labelEl) labelText = String(labelEl.textContent || '').trim();
    }catch(_){ }
    if(!labelText){
      try{
        const prev = selectEl.previousElementSibling;
        if(prev && /label/i.test(String(prev.tagName||''))) labelText = String(prev.textContent || '').trim();
      }catch(_){ }
    }
    if(!labelText){
      try{ labelText = String(selectEl.getAttribute('data-launcher-label') || '').trim(); }catch(_){ }
    }
    if(!labelText) labelText = 'Wybierz opcję';
    return {
      id:String(selectEl.id || ''),
      title:'Wybierz: ' + labelText,
      placeholder:labelText,
      shouldMount(currentEl){
        if(!currentEl) return false;
        try{ return getComputedStyle(currentEl).display !== 'none'; }catch(_){ return true; }
      }
    };
  }

  function mountDynamicSelectLaunchers(rootEl){
    const root = rootEl || document;
    const selects = Array.from(root && root.querySelectorAll ? root.querySelectorAll('select.cabinet-extra-field__control, select.set-front-choice-source, select.cabinet-dynamic-choice-source') : []);
    return selects.map((selectEl)=>{
      const cfg = buildDynamicConfigForSelect(selectEl);
      return { id:selectEl.id, button:mountSelectLauncher(selectEl, cfg) };
    });
  }


  function mountVisibleFallbackLaunchers(rootEl){
    const root = rootEl || document;
    const selects = Array.from(root && root.querySelectorAll ? root.querySelectorAll('select') : []);
    return selects.map((selectEl)=>{
      const cfg = resolveConfigForSelect(selectEl);
      if(!cfg) return { id: selectEl && selectEl.id || '', button:null };
      if(!isElementVisible(selectEl)){
        cleanupLauncher(selectEl);
        return { id: cfg.id || selectEl.id, button:null };
      }
      const slot = selectEl.parentNode && selectEl.parentNode.querySelector('.cabinet-choice-launch-slot[data-launch-for="' + selectEl.id + '"]');
      const existingBtn = slot && slot.querySelector('.cabinet-choice-launch');
      if(existingBtn && selectEl.classList.contains('cabinet-choice-source--enhanced')){
        return { id: cfg.id || selectEl.id, button: existingBtn };
      }
      return { id: cfg.id || selectEl.id, button: mountSelectLauncher(selectEl, cfg) };
    });
  }

  FC.cabinetChoiceLaunchers = {
    SAFE_FIELD_CONFIG,
    buildOptions,
    cleanupLauncher,
    mountSelectLauncher,
    mountSafeFieldLaunchers,
    mountDynamicSelectLaunchers,
    mountVisibleFallbackLaunchers,
    shouldMountField
  };
})();
