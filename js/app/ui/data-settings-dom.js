(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function h(tag, attrs, children){
    const node = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key,value])=>{
        if(value == null) return;
        if(key === 'class') node.className = value;
        else if(key === 'text') node.textContent = value;
        else if(key === 'html') node.innerHTML = value;
        else node.setAttribute(key, String(value));
      });
    }
    (children || []).forEach((child)=>{ if(child) node.appendChild(child); });
    return node;
  }

  function formatDate(value){
    try{
      const date = new Date(value);
      if(!Number.isFinite(date.getTime())) return String(value || '—');
      return date.toLocaleString('pl-PL');
    }catch(_){ return String(value || '—'); }
  }

  function ask(opts){
    if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') return FC.confirmBox.ask(opts || {});
    return Promise.resolve(confirm(String((opts && opts.message) || (opts && opts.title) || 'Kontynuować?')));
  }

  function info(title, message){
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function') return FC.infoBox.open({ title, message });
      if(FC.infoBox && typeof FC.infoBox.show === 'function') return FC.infoBox.show(title, message);
    }catch(_){ }
    try{ alert(String(message || title || '')); }catch(_){ }
  }

  async function copyText(text, btn){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      if(btn){
        const old = btn.textContent;
        btn.textContent = 'Skopiowano';
        setTimeout(()=>{ btn.textContent = old; }, 1400);
      }
    }catch(_){ if(btn) btn.textContent = 'Błąd kopiowania'; }
  }

  function makeStat(label, value){
    return h('div', { class:'data-settings-stat' }, [h('span', { text:label }), h('strong', { text:String(value || 0) })]);
  }

  function makeAccordion(title, contentNodes, options){
    const opts = Object.assign({ open:false, sub:'', infoMessage:'' }, options || {});
    const details = h('details', { class:'data-settings-accordion' + (opts.open ? ' is-open' : '') });
    if(opts.open) details.setAttribute('open', 'open');
    const titleWrap = h('span', { class:'data-settings-accordion__title-wrap' }, [h('span', { class:'data-settings-accordion__title', text:title })]);
    const actions = h('span', { class:'data-settings-accordion__actions' });
    if(opts.infoMessage){
      const infoBtn = h('button', { type:'button', class:'info-trigger data-settings-info-trigger', 'aria-label':`Pokaż informację: ${title}` });
      infoBtn.addEventListener('click', (event)=>{
        try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
        info(title, opts.infoMessage);
      });
      actions.appendChild(infoBtn);
    }else{
      actions.appendChild(h('span', { class:'data-settings-accordion__info-slot', 'aria-hidden':'true' }));
    }
    actions.appendChild(opts.sub ? h('span', { class:'data-settings-accordion__sub', text:opts.sub }) : h('span', { class:'data-settings-accordion__sub data-settings-accordion__sub--empty', 'aria-hidden':'true' }));
    actions.appendChild(h('span', { class:'data-settings-accordion__toggle', 'aria-hidden':'true' }));
    const summary = h('summary', { class:'data-settings-accordion__summary' }, [titleWrap, actions]);
    const body = h('div', { class:'data-settings-accordion__body' });
    (contentNodes || []).forEach((node)=>{ if(node) body.appendChild(node); });
    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  FC.dataSettingsDom = { h, formatDate, ask, info, copyText, makeStat, makeAccordion };
})();
