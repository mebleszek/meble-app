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

  function createLocalChoiceApi(){
    function getSelectOptionLabel(selectEl){
      if(!selectEl) return '';
      const idx = Number(selectEl.selectedIndex);
      const opt = idx >= 0 ? selectEl.options[idx] : selectEl.options[0];
      return opt ? String(opt.textContent || opt.label || opt.value || '') : '';
    }
    function setChoiceLaunchValue(btn, label, meta){
      if(!btn) return;
      const labelEl = btn.querySelector('.rozrys-choice-launch__label');
      const metaEl = btn.querySelector('.rozrys-choice-launch__meta');
      if(labelEl) labelEl.textContent = String(label || '');
      if(metaEl){
        const metaText = String(meta || '');
        metaEl.textContent = metaText;
        metaEl.style.display = metaText ? '' : 'none';
      }
    }
    function createChoiceLauncher(label, meta){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rozrys-choice-launch';
      btn.innerHTML = '<span class="rozrys-choice-launch__value"><span class="rozrys-choice-launch__label"></span><span class="rozrys-choice-launch__meta"></span></span><span class="rozrys-choice-launch__arrow">▾</span>';
      setChoiceLaunchValue(btn, label, meta);
      return btn;
    }
    function openRozrysChoiceOverlay(opts){
      const cfg = Object.assign({ title:'Wybierz opcję', options:[], value:'' }, opts || {});
      return new Promise((resolve)=>{
        const backdrop = document.createElement('div');
        backdrop.className = 'rozrys-choice-backdrop';
        const modal = document.createElement('div');
        modal.className = 'rozrys-choice-modal';
        modal.setAttribute('role','dialog');
        modal.setAttribute('aria-modal','true');
        modal.setAttribute('aria-label', String(cfg.title || 'Wybierz opcję'));
        modal.innerHTML = '<div class="rozrys-choice-modal__header"><div class="rozrys-choice-modal__title"></div><button type="button" class="rozrys-choice-modal__close" aria-label="Zamknij">×</button></div><div class="rozrys-choice-modal__body"></div>';
        modal.querySelector('.rozrys-choice-modal__title').textContent = String(cfg.title || 'Wybierz opcję');
        const body = modal.querySelector('.rozrys-choice-modal__body');
        (Array.isArray(cfg.options) ? cfg.options : []).forEach((entry)=>{
          const opt = entry || {};
          const value = String(opt.value == null ? '' : opt.value);
          const disabled = !!opt.disabled;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'rozrys-choice-option' + (String(cfg.value || '') === value ? ' is-selected' : '') + (disabled ? ' is-disabled' : '');
          btn.disabled = disabled;
          btn.innerHTML = '<div class="rozrys-choice-option__title"></div>' + (opt.description ? '<div class="rozrys-choice-option__subtitle"></div>' : '');
          btn.querySelector('.rozrys-choice-option__title').textContent = String(opt.label || value);
          const sub = btn.querySelector('.rozrys-choice-option__subtitle');
          if(sub) sub.textContent = String(opt.description || '');
          if(!disabled) btn.addEventListener('click', ()=> done(value));
          body.appendChild(btn);
        });
        backdrop.appendChild(modal);
        let closed = false;
        const onKey = (ev)=>{ if(ev.key === 'Escape'){ ev.preventDefault(); done(null); } };
        const cleanup = ()=>{
          if(closed) return;
          closed = true;
          document.removeEventListener('keydown', onKey, true);
          if(backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        };
        const done = (result)=>{ cleanup(); resolve(result); };
        modal.querySelector('.rozrys-choice-modal__close').addEventListener('click', ()=> done(null));
        backdrop.addEventListener('click', (ev)=>{ if(ev.target === backdrop) done(null); });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(backdrop);
      });
    }
    return { createChoiceLauncher, openRozrysChoiceOverlay, getSelectOptionLabel, setChoiceLaunchValue };
  }

  function getChoiceApi(){
    const api = FC && FC.rozrysChoice;
    if(api && typeof api.createChoiceLauncher === 'function' && typeof api.openRozrysChoiceOverlay === 'function' && typeof api.getSelectOptionLabel === 'function' && typeof api.setChoiceLaunchValue === 'function'){
      return api;
    }
    return createLocalChoiceApi();
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
