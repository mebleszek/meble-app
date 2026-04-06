(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const STORAGE_KEY = 'fc_material_part_options_v1';
  const DIRECTIONS = ['default','horizontal','vertical','none'];

  function normalizeFrontLaminatMaterialKey(materialKey){
    const m = String(materialKey||'').match(/^\s*Front\s*:\s*laminat\s*•\s*(.+)$/i);
    return m ? String(m[1]||'').trim() : String(materialKey||'').trim();
  }

  function normalizeMaterialKey(materialKey){
    return normalizeFrontLaminatMaterialKey(materialKey);
  }

  function cmToMm(v){
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 10) : 0;
  }

  function normalizeDirection(dir){
    const key = String(dir || 'default').trim().toLowerCase();
    return DIRECTIONS.includes(key) ? key : 'default';
  }

  function labelForDirection(dir){
    const key = normalizeDirection(dir);
    if(key === 'horizontal') return 'Poziom';
    if(key === 'vertical') return 'Pion';
    if(key === 'none') return 'Bez znaczenia';
    return 'Domyślny z materiału';
  }

  function loadAll(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){ return {}; }
  }

  function saveAll(state){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {})); }catch(_){ }
  }

  function signature(materialKey, name, aMm, bMm){
    return `${normalizeMaterialKey(materialKey)}||${String(name || 'Element').trim()}||${Math.round(Number(aMm)||0)}x${Math.round(Number(bMm)||0)}`;
  }

  function signatureFromPart(part){
    const materialKey = normalizeMaterialKey(part && part.material);
    const name = String((part && part.name) || 'Element');
    const aMm = cmToMm(part && part.a);
    const bMm = cmToMm(part && part.b);
    return signature(materialKey, name, aMm, bMm);
  }

  function getDirection(sig){
    const all = loadAll();
    return normalizeDirection(all[String(sig || '')]);
  }

  function setDirection(sig, dir){
    const key = String(sig || '').trim();
    if(!key) return;
    const all = loadAll();
    const value = normalizeDirection(dir);
    if(value === 'default') delete all[key];
    else all[key] = value;
    try{
      const prevRaw = localStorage.getItem(STORAGE_KEY);
      const nextRaw = JSON.stringify(all || {});
      if(prevRaw !== nextRaw){
        try{ if(root.FC && root.FC.session && typeof root.FC.session.begin === 'function' && !(root.FC.session.active)) root.FC.session.begin(); }catch(_){ }
      }
      localStorage.setItem(STORAGE_KEY, nextRaw);
    }catch(_){ saveAll(all); }
    try{ root.FC && root.FC.views && typeof root.FC.views.refreshSessionButtons === 'function' && root.FC.views.refreshSessionButtons(); }catch(_){ }
  }

  function resolveDimsMm(aMm, bMm, dir){
    const w = Math.max(0, Math.round(Number(aMm) || 0));
    const h = Math.max(0, Math.round(Number(bMm) || 0));
    const mode = normalizeDirection(dir);
    if(mode === 'vertical') return { w:h, h:w };
    return { w, h };
  }

  function resolvePartForRozrys(part){
    const materialKey = normalizeMaterialKey(part && part.material);
    const name = String((part && part.name) || 'Element');
    const aMm = cmToMm(part && part.a);
    const bMm = cmToMm(part && part.b);
    const sourceSig = signature(materialKey, name, aMm, bMm);
    const direction = getDirection(sourceSig);
    const dims = resolveDimsMm(aMm, bMm, direction);
    return {
      materialKey,
      name,
      sourceSig,
      direction,
      ignoreGrain: direction === 'none',
      w: dims.w,
      h: dims.h,
      qty: Math.max(1, Math.round(Number(part && part.qty) || 0))
    };
  }

  function askDiscard(){
    if(root.FC && root.FC.confirmBox && typeof root.FC.confirmBox.ask === 'function'){
      return root.FC.confirmBox.ask({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w opcjach formatki zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      });
    }
    return Promise.resolve(true);
  }

  function openOptionsModal(cfg){
    const FC = root.FC || {};
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const sig = String(cfg && cfg.sig || '').trim();
    if(!sig) return;
    const onClose = (cfg && typeof cfg.onClose === 'function') ? cfg.onClose : null;
    const name = String((cfg && cfg.name) || 'Formatka');
    const material = String((cfg && cfg.material) || 'Materiał');
    const sizeText = String((cfg && cfg.sizeText) || '');
    const initial = normalizeDirection((cfg && cfg.initialDirection) || getDirection(sig));
    let draft = initial;

    function h(tag, attrs, children){
      const node = document.createElement(tag);
      Object.entries(attrs || {}).forEach(([k,v])=>{
        if(v == null) return;
        if(k === 'class') node.className = String(v);
        else if(k === 'text') node.textContent = String(v);
        else if(k === 'html') node.innerHTML = String(v);
        else node.setAttribute(k, String(v));
      });
      (children || []).forEach((child)=>{ if(child) node.appendChild(child); });
      return node;
    }

    const body = h('div', { class:'material-part-options panel-box-form' });
    const scroll = h('div', { class:'panel-box-form__scroll' });
    const footerShell = h('div', { class:'panel-box-form__footer' });
    const meta = h('div', { class:'material-part-options__meta' });
    meta.appendChild(h('div', { class:'material-part-options__name', text:name }));
    meta.appendChild(h('div', { class:'material-part-options__sub', text:material }));
    if(sizeText) meta.appendChild(h('div', { class:'material-part-options__sub', text:sizeText }));
    scroll.appendChild(meta);

    const preview = h('div', { class:'material-part-options__preview' });
    const previewRect = h('div', { class:'material-part-options__preview-rect' });
    preview.appendChild(previewRect);
    scroll.appendChild(preview);

    const optionsWrap = h('div', { class:'material-part-options__choices' });
    const optionDefs = [
      { key:'default', label:'Domyślny z materiału', hint:'Bez dodatkowego wymuszenia dla tej formatki.' },
      { key:'horizontal', label:'Poziom', hint:'Słój idzie w osi 1 / poziomej.' },
      { key:'vertical', label:'Pion', hint:'Słój idzie w osi 2 / pionowej.' },
      { key:'none', label:'Bez znaczenia', hint:'Ta formatka może być obracana jak bez słojów.' },
    ];
    const cards = [];
    optionDefs.forEach((opt)=>{
      const btn = h('button', { type:'button', class:'material-part-options__choice' });
      btn.appendChild(h('div', { class:'material-part-options__choice-label', text:opt.label }));
      btn.appendChild(h('div', { class:'material-part-options__choice-hint', text:opt.hint }));
      btn.addEventListener('click', ()=>{
        draft = opt.key;
        updateState();
      });
      cards.push({ key:opt.key, btn });
      optionsWrap.appendChild(btn);
    });
    scroll.appendChild(optionsWrap);

    const footer = h('div', { class:'material-part-options__footer' });
    const footerActions = h('div', { class:'material-part-options__footer-actions' });
    const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' });
    const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' });
    const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zapisz' });

    function isDirty(){ return normalizeDirection(draft) !== normalizeDirection(initial); }
    function updatePreview(){
      previewRect.className = 'material-part-options__preview-rect';
      previewRect.classList.add(`is-${normalizeDirection(draft)}`);
    }
    function renderFooter(){
      footerActions.innerHTML = '';
      if(isDirty()){
        footerActions.appendChild(cancelBtn);
        footerActions.appendChild(saveBtn);
      }else{
        footerActions.appendChild(exitBtn);
      }
    }
    function updateState(){
      cards.forEach((item)=> item.btn.classList.toggle('is-selected', item.key === normalizeDirection(draft)));
      updatePreview();
      renderFooter();
    }
    updateState();
    footer.appendChild(footerActions);
    footerShell.appendChild(footer);
    body.appendChild(scroll);
    body.appendChild(footerShell);

    async function confirmDiscardIfDirty(){
      if(!isDirty()) return true;
      return !!(await askDiscard());
    }

    function notifyClose(){
      try{ if(typeof onClose === 'function') onClose(); }catch(_){ }
    }

    exitBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } finally{ notifyClose(); } });
    cancelBtn.addEventListener('click', async ()=>{
      const ok = await confirmDiscardIfDirty();
      if(!ok) return;
      try{ FC.panelBox.close(); }catch(_){ } finally{ notifyClose(); }
    });
    saveBtn.addEventListener('click', ()=>{
      setDirection(sig, draft);
      try{ if(typeof cfg.onSave === 'function') cfg.onSave(normalizeDirection(draft)); }catch(_){ }
      try{ FC.panelBox.close(); }catch(_){ } finally{ notifyClose(); }
    });

    FC.panelBox.open({
      title:'Opcje formatki',
      contentNode: body,
      width:'720px',
      dismissOnOverlay:false,
      beforeClose: async ()=> {
        const ok = await confirmDiscardIfDirty();
        if(ok) notifyClose();
        return ok;
      }
    });
  }

  root.FC.materialPartOptions = {
    STORAGE_KEY,
    DIRECTIONS,
    normalizeDirection,
    labelForDirection,
    normalizeMaterialKey,
    signature,
    signatureFromPart,
    getDirection,
    setDirection,
    resolveDimsMm,
    resolvePartForRozrys,
    openOptionsModal,
  };
})();
