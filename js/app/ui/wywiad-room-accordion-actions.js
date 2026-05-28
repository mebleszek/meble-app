// js/app/ui/wywiad-room-accordion-actions.js
// Wspólny footer zapisu dla akordeonów WYWIADU pomieszczenia.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function text(value){ return String(value == null ? '' : value).trim(); }

  function h(tag, attrs){
    const el = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key,value])=>{
        if(value == null || value === false) return;
        if(key === 'class') el.className = value;
        else if(key === 'text') el.textContent = String(value);
        else if(value === true) el.setAttribute(key, key);
        else el.setAttribute(key, String(value));
      });
    }
    return el;
  }

  function createSaveFooter(options){
    const cfg = options && typeof options === 'object' ? options : {};
    const footer = h('div', {
      class:'wywiad-room-inline-form__footer' + (cfg.split ? ' wywiad-room-inline-form__footer--split' : '')
    });
    (Array.isArray(cfg.beforeButtons) ? cfg.beforeButtons : []).forEach((btn)=>{
      if(btn) footer.appendChild(btn);
    });

    const label = text(cfg.buttonText) || 'Zapisz zmiany';
    const saveBtn = h('button', {
      type:'button',
      class:'btn btn-success wywiad-room-inline-form__save',
      text:label
    });
    const sectionTitle = text(cfg.sectionTitle);
    if(sectionTitle) saveBtn.setAttribute('aria-label', label + ' — ' + sectionTitle);
    saveBtn.addEventListener('click', (event)=>{
      try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
      if(typeof cfg.onSave === 'function') cfg.onSave(event);
    });
    footer.appendChild(saveBtn);
    return { footer, saveBtn };
  }

  ns.wywiadRoomAccordionActions = Object.assign({}, ns.wywiadRoomAccordionActions || {}, {
    createSaveFooter
  });
})();
