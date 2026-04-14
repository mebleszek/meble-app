(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k === 'class') el.className = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

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

  function buildChoiceOptionClass(currentValue, optionValue, disabled){
    return 'rozrys-choice-option'
      + (String(currentValue || '') === String(optionValue || '') ? ' is-selected' : '')
      + (disabled ? ' is-disabled' : '');
  }

  function createChoiceLauncher(label, meta){
    const btn = h('button', { type:'button', class:'rozrys-choice-launch' });
    const value = h('span', { class:'rozrys-choice-launch__value' });
    value.appendChild(h('span', { class:'rozrys-choice-launch__label', text:String(label || '') }));
    value.appendChild(h('span', { class:'rozrys-choice-launch__meta', text:String(meta || '') }));
    btn.appendChild(value);
    btn.appendChild(h('span', { class:'rozrys-choice-launch__arrow', text:'▾' }));
    setChoiceLaunchValue(btn, label, meta);
    return btn;
  }

  function openRozrysChoiceOverlay(opts){
    const cfg = Object.assign({
      title:'Wybierz opcję',
      options:[],
      value:'',
      closeText:'Zamknij'
    }, opts || {});
    return new Promise((resolve)=>{
      const backdrop = h('div', { class:'rozrys-choice-backdrop' });
      const modal = h('div', { class:'rozrys-choice-modal', role:'dialog', 'aria-modal':'true', 'aria-label':String(cfg.title || 'Wybierz opcję') });
      const header = h('div', { class:'rozrys-choice-modal__header' });
      header.appendChild(h('div', { class:'rozrys-choice-modal__title', text:String(cfg.title || 'Wybierz opcję') }));
      const closeBtn = h('button', { type:'button', class:'rozrys-choice-modal__close', 'aria-label':'Zamknij', text:'×' });
      header.appendChild(closeBtn);
      modal.appendChild(header);
      const body = h('div', { class:'rozrys-choice-modal__body' });
      (Array.isArray(cfg.options) ? cfg.options : []).forEach((entry)=>{
        const opt = entry || {};
        const value = String(opt.value == null ? '' : opt.value);
        const disabled = !!opt.disabled;
        const optionBtn = h('button', { type:'button', class:buildChoiceOptionClass(cfg.value, value, disabled), disabled: disabled ? 'disabled' : null });
        optionBtn.appendChild(h('div', { class:'rozrys-choice-option__title', text:String(opt.label || value) }));
        if(opt.description) optionBtn.appendChild(h('div', { class:'rozrys-choice-option__subtitle', text:String(opt.description) }));
        if(!disabled) optionBtn.addEventListener('click', ()=> done(value));
        body.appendChild(optionBtn);
      });
      modal.appendChild(body);
      backdrop.appendChild(modal);

      let closed = false;
      const onKey = (ev)=>{
        if(ev.key === 'Escape'){
          ev.preventDefault();
          done(null);
        }
      };
      const cleanup = ()=>{
        if(closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        if(backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      };
      const done = (result)=>{
        cleanup();
        resolve(result);
      };
      closeBtn.addEventListener('click', ()=> done(null));
      backdrop.addEventListener('click', (ev)=>{ if(ev.target === backdrop) done(null); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(backdrop);
    });
  }

  FC.rozrysChoice = {
    getSelectOptionLabel,
    setChoiceLaunchValue,
    buildChoiceOptionClass,
    createChoiceLauncher,
    openRozrysChoiceOverlay,
  };
})();
