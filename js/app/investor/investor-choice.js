(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function mountChoice(opts){
    const cfg = Object.assign({ mount:null, selectEl:null, title:'Wybierz', buttonClass:'', disabled:false, onChange:null }, opts || {});
    const choiceApi = window.FC && window.FC.rozrysChoice;
    if(!cfg.mount || !cfg.selectEl || !(choiceApi && typeof choiceApi.createChoiceLauncher === 'function' && typeof choiceApi.openRozrysChoiceOverlay === 'function')) return null;
    const label = choiceApi.getSelectOptionLabel(cfg.selectEl) || '';
    const btn = choiceApi.createChoiceLauncher(label, '');
    if(cfg.buttonClass) String(cfg.buttonClass).split(/\s+/).filter(Boolean).forEach((cls)=> btn.classList.add(cls));
    const arrow = btn.querySelector('.rozrys-choice-launch__arrow');
    if(arrow) arrow.remove();
    if(cfg.disabled) btn.disabled = true;
    btn.addEventListener('click', async ()=>{
      if(btn.disabled) return;
      const picked = await choiceApi.openRozrysChoiceOverlay({
        title: cfg.title,
        value: String(cfg.selectEl.value || ''),
        options: Array.from(cfg.selectEl.options || []).map((opt)=> ({ value:String(opt.value || ''), label:String(opt.textContent || opt.label || opt.value || '') }))
      });
      if(picked == null || String(picked) === String(cfg.selectEl.value || '')) return;
      cfg.selectEl.value = String(picked || '');
      choiceApi.setChoiceLaunchValue(btn, choiceApi.getSelectOptionLabel(cfg.selectEl) || '', '');
      if(typeof cfg.onChange === 'function') cfg.onChange(String(cfg.selectEl.value || ''), btn);
      cfg.selectEl.dispatchEvent(new Event('change', { bubbles:true }));
    });
    cfg.mount.innerHTML = '';
    cfg.mount.appendChild(btn);
    return btn;
  }

  FC.investorChoice = { mountChoice };
})();
