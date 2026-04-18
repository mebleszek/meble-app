(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const SAFE_FIELD_CONFIG = [
    { id:'cmSubType', title:'Wybierz wariant', placeholder:'Wybierz wariant' },
    { id:'cmFrontMaterial', title:'Wybierz materiał frontu', placeholder:'Wybierz materiał frontu' },
    { id:'cmBackMaterial', title:'Wybierz plecy', placeholder:'Wybierz plecy' },
    { id:'cmBodyColor', title:'Wybierz korpus', placeholder:'Wybierz korpus' },
    { id:'cmOpeningSystem', title:'Wybierz system otwierania', placeholder:'Wybierz system otwierania' }
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

  function mountSelectLauncher(selectEl, cfg){
    if(!selectEl) return null;
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

  FC.cabinetChoiceLaunchers = {
    SAFE_FIELD_CONFIG,
    buildOptions,
    cleanupLauncher,
    mountSelectLauncher,
    mountSafeFieldLaunchers
  };
})();
