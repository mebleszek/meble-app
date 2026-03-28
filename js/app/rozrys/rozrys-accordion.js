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

  function splitMaterialAccordionTitle(material){
    const raw = String(material || 'Materiał').trim();
    if(!raw) return { line1:'Materiał', line2:'' };
    if(raw.includes('•')){
      const parts = raw.split('•').map((s)=> String(s || '').trim()).filter(Boolean);
      if(parts.length >= 2) return { line1:parts[0], line2:parts.slice(1).join(' • ') };
    }
    const tokens = raw.split(/\s+/).filter(Boolean);
    if(tokens.length <= 2) return { line1:raw, line2:'' };
    const third = tokens[2] || '';
    const line1Count = /^[A-Z0-9-]{2,}$/i.test(third) && /\d/.test(third) ? 3 : 2;
    return {
      line1: tokens.slice(0, line1Count).join(' '),
      line2: tokens.slice(line1Count).join(' ')
    };
  }

  function createMaterialAccordionSection(material, options, deps){
    const cfg = Object.assign({ scheduleSheetCanvasRefresh:null }, deps || {});
    const opts = Object.assign({ open:false, onToggle:null, grain:false, grainEnabled:false, grainDisabled:false, onGrainToggle:null, onExceptionsClick:null }, options || {});
    const wrap = h('div', { class:'rozrys-material-accordion' });
    const head = h('div', { class:'rozrys-material-accordion__head' });
    const trigger = h('button', { class:'rozrys-material-accordion__trigger', type:'button' });
    const titleBits = splitMaterialAccordionTitle(material);
    const title = h('div', { class:'rozrys-material-accordion__title' });
    title.appendChild(h('div', { class:'rozrys-material-accordion__title-line1', text:titleBits.line1 || 'Materiał' }));
    if(titleBits.line2) title.appendChild(h('div', { class:'rozrys-material-accordion__title-line2', text:titleBits.line2 }));
    const chevron = h('span', { class:'rozrys-material-accordion__chevron', html:'&#9662;', 'aria-hidden':'true' });
    trigger.appendChild(title);
    trigger.appendChild(chevron);

    const grainRow = h('div', { class:'rozrys-material-accordion__grain-row' });
    const grainToggle = h('label', { class:'rozrys-material-accordion__grain-toggle' });
    const grainCb = h('input', { type:'checkbox' });
    grainCb.checked = !!opts.grainEnabled;
    grainCb.disabled = !!opts.grainDisabled;
    const grainText = h('span', { text:'Pilnuj kierunku słojów' });
    if(opts.grainDisabled) grainText.classList.add('is-disabled');
    grainToggle.appendChild(grainCb);
    grainToggle.appendChild(grainText);

    const exceptionsBtn = h('button', { type:'button', class:'btn rozrys-inline-exceptions-btn', text:'Wyjątki' });
    exceptionsBtn.disabled = !!opts.grainDisabled || !opts.grainEnabled;
    exceptionsBtn.classList.toggle('is-disabled', !!opts.grainDisabled || !opts.grainEnabled);
    grainCb.addEventListener('click', (ev)=> ev.stopPropagation());
    grainCb.addEventListener('change', (ev)=>{
      ev.stopPropagation();
      exceptionsBtn.disabled = !!opts.grainDisabled || !grainCb.checked;
      exceptionsBtn.classList.toggle('is-disabled', !!opts.grainDisabled || !grainCb.checked);
      try{ if(typeof opts.onGrainToggle === 'function') opts.onGrainToggle(!!grainCb.checked, material, wrap); }catch(_){ }
    });
    grainToggle.addEventListener('click', (ev)=> ev.stopPropagation());
    exceptionsBtn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      if(exceptionsBtn.disabled) return;
      try{ if(typeof opts.onExceptionsClick === 'function') opts.onExceptionsClick(material, wrap); }catch(_){ }
    });
    grainRow.appendChild(grainToggle);
    grainRow.appendChild(exceptionsBtn);

    const body = h('div', { class:'rozrys-material-accordion__body' });
    function setOpenState(open, notify){
      const isOpen = !!open;
      wrap.classList.toggle('is-open', isOpen);
      body.hidden = !isOpen;
      body.style.display = isOpen ? '' : 'none';
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if(isOpen && typeof cfg.scheduleSheetCanvasRefresh === 'function') cfg.scheduleSheetCanvasRefresh(body);
      if(notify !== false && typeof opts.onToggle === 'function'){
        try{ opts.onToggle(isOpen, material, wrap); }catch(_){ }
      }
    }
    trigger.addEventListener('click', ()=>{
      setOpenState(!wrap.classList.contains('is-open'), true);
    });
    setOpenState(!!opts.open, false);
    head.appendChild(trigger);
    head.appendChild(grainRow);
    wrap.appendChild(head);
    wrap.appendChild(body);
    return { wrap, body, trigger, setOpenState };
  }

  function renderMaterialAccordionPlans(scopeKey, scopeMode, entries, deps){
    const cfg = Object.assign({
      out:null,
      getAccordionPref:null,
      materialHasGrain:null,
      getMaterialGrainEnabled:null,
      setAccordionPref:null,
      setMaterialGrainEnabled:null,
      tryAutoRenderFromCache:null,
      openMaterialGrainExceptions:null,
      renderOutput:null,
      formatHeurLabel:null,
      scheduleSheetCanvasRefresh:null,
    }, deps || {});
    const out = cfg.out;
    if(!out) return false;
    out.innerHTML = '';
    const list = Array.isArray(entries) ? entries.filter((e)=> e && e.material && e.plan) : [];
    if(!list.length) return false;
    const accordionPref = typeof cfg.getAccordionPref === 'function' ? cfg.getAccordionPref(scopeKey) : null;
    let anyRendered = false;
    for(const entry of list){
      const hasGrain = typeof cfg.materialHasGrain === 'function' ? !!cfg.materialHasGrain(entry.material) : false;
      const grainEnabled = hasGrain && typeof cfg.getMaterialGrainEnabled === 'function'
        ? !!cfg.getMaterialGrainEnabled(entry.material, hasGrain)
        : false;
      const section = createMaterialAccordionSection(entry.material, {
        open: !!(accordionPref && accordionPref.open && accordionPref.material === entry.material),
        grain: hasGrain,
        grainEnabled,
        grainDisabled: !hasGrain,
        onToggle: (isOpen, materialName)=>{
          if(typeof cfg.setAccordionPref === 'function') cfg.setAccordionPref(scopeKey, materialName, isOpen);
        },
        onGrainToggle: (checked)=>{
          if(typeof cfg.setMaterialGrainEnabled === 'function') cfg.setMaterialGrainEnabled(entry.material, checked, hasGrain);
          if(typeof cfg.tryAutoRenderFromCache === 'function') cfg.tryAutoRenderFromCache();
        },
        onExceptionsClick: ()=>{
          if(typeof cfg.openMaterialGrainExceptions === 'function') cfg.openMaterialGrainExceptions(entry.material, entry.parts || []);
        }
      }, { scheduleSheetCanvasRefresh: cfg.scheduleSheetCanvasRefresh });
      out.appendChild(section.wrap);
      if(typeof cfg.renderOutput === 'function'){
        cfg.renderOutput(entry.plan, {
          material: entry.material,
          kerf: entry.st && entry.st.kerf,
          heur: entry.st && typeof cfg.formatHeurLabel === 'function' ? cfg.formatHeurLabel(entry.st) : '',
          unit: entry.st && entry.st.unit,
          edgeSubMm: entry.st && entry.st.edgeSubMm,
          meta: entry.plan && entry.plan.meta,
          parts: entry.parts || [],
          scopeMode,
          selectedRooms: (entry.st && entry.st.selectedRooms) || (entry.selectedRooms || []),
        }, section.body);
      }
      anyRendered = true;
    }
    return anyRendered;
  }

  FC.rozrysAccordion = {
    splitMaterialAccordionTitle,
    createMaterialAccordionSection,
    renderMaterialAccordionPlans,
  };
})();
