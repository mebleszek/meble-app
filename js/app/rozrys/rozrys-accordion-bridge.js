(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function fallbackH(tag, attrs, children){
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

  function createApi(deps){
    deps = deps || {};
    const apiFC = deps.FC || FC;
    const h = typeof deps.h === 'function' ? deps.h : fallbackH;
    const out = deps.out || null;
    const scheduleSheetCanvasRefresh = typeof deps.scheduleSheetCanvasRefresh === 'function' ? deps.scheduleSheetCanvasRefresh : (()=> undefined);
    const getAccordionPref = typeof deps.getAccordionPref === 'function' ? deps.getAccordionPref : (()=> ({ material:'', open:false }));
    const materialHasGrain = typeof deps.materialHasGrain === 'function' ? deps.materialHasGrain : (()=> false);
    const getMaterialGrainEnabled = typeof deps.getMaterialGrainEnabled === 'function' ? deps.getMaterialGrainEnabled : (()=> false);
    const setAccordionPref = typeof deps.setAccordionPref === 'function' ? deps.setAccordionPref : (()=> undefined);
    const setMaterialGrainEnabled = typeof deps.setMaterialGrainEnabled === 'function' ? deps.setMaterialGrainEnabled : (()=> undefined);
    const tryAutoRenderFromCache = typeof deps.tryAutoRenderFromCache === 'function' ? deps.tryAutoRenderFromCache : (()=> false);
    const openMaterialGrainExceptions = typeof deps.openMaterialGrainExceptions === 'function' ? deps.openMaterialGrainExceptions : (()=> undefined);
    const renderOutput = typeof deps.renderOutput === 'function' ? deps.renderOutput : (()=> undefined);
    const formatHeurLabel = typeof deps.formatHeurLabel === 'function' ? deps.formatHeurLabel : (()=> '');

    function splitMaterialAccordionTitle(material){
      if(apiFC.rozrysAccordion && typeof apiFC.rozrysAccordion.splitMaterialAccordionTitle === 'function'){
        return apiFC.rozrysAccordion.splitMaterialAccordionTitle(material);
      }
      return { line1:String(material || 'Materiał'), line2:'' };
    }

    function createMaterialAccordionSection(material, options){
      if(apiFC.rozrysAccordion && typeof apiFC.rozrysAccordion.createMaterialAccordionSection === 'function'){
        return apiFC.rozrysAccordion.createMaterialAccordionSection(material, options, { scheduleSheetCanvasRefresh });
      }
      const wrap = h('div');
      const body = h('div');
      wrap.appendChild(body);
      return { wrap, body, trigger:null, setOpenState:()=>{} };
    }

    function renderMaterialAccordionPlans(scopeKey, scopeMode, entries){
      if(apiFC.rozrysAccordion && typeof apiFC.rozrysAccordion.renderMaterialAccordionPlans === 'function'){
        return apiFC.rozrysAccordion.renderMaterialAccordionPlans(scopeKey, scopeMode, entries, {
          out,
          getAccordionPref,
          materialHasGrain,
          getMaterialGrainEnabled,
          setAccordionPref,
          setMaterialGrainEnabled,
          tryAutoRenderFromCache,
          openMaterialGrainExceptions,
          renderOutput,
          formatHeurLabel,
          scheduleSheetCanvasRefresh,
        });
      }
      if(out) out.innerHTML = '';
      return false;
    }

    return {
      splitMaterialAccordionTitle,
      createMaterialAccordionSection,
      renderMaterialAccordionPlans,
    };
  }

  FC.rozrysAccordionBridge = { createApi };
})();
