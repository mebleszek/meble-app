(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const STORAGE_KEY = 'fc_material_part_options_v1';
  const DIRECTIONS = ['default','horizontal','vertical','none'];
  const EDGE_KEYS = ['w1','w2','h1','h2'];

  function copyEdges(value){
    return Object.fromEntries(EDGE_KEYS.map((key)=> [key, !!(value && value[key])]));
  }

  function sameEdges(a, b){
    return EDGE_KEYS.every((key)=> !!(a && a[key]) === !!(b && b[key]));
  }

  function normalizeFrontLaminatMaterialKey(materialKey){
    const raw = String(materialKey || '').trim();
    const m = raw.match(/^\s*Front\s*:\s*[^•]+?\s*•\s*(.+)$/i);
    return m ? String(m[1] || '').trim() : raw;
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

  function sessionOptionsBaseline(){
    const session = root.FC && root.FC.session;
    if(!(session && session.active && session.snapshot && Object.prototype.hasOwnProperty.call(session.snapshot, STORAGE_KEY))) return null;
    try{
      const raw = session.snapshot[STORAGE_KEY];
      const store = raw === null ? {} : JSON.parse(raw);
      if(!(store && typeof store === 'object' && !Array.isArray(store))) return null;
      return { raw, store };
    }catch(_){ return null; }
  }

  function desiredOptionsRaw(store, baseline){
    const keys = Object.keys(store);
    if(baseline && keys.length === Object.keys(baseline.store).length && keys.every((key)=>
      Object.prototype.hasOwnProperty.call(baseline.store, key)
      && JSON.stringify(store[key]) === JSON.stringify(baseline.store[key]))){
      // A complete revert preserves missing keys, whitespace, ordering and legacy records.
      return baseline.raw;
    }
    return JSON.stringify(store);
  }

  function prepareDirection(sig, dir){
    const key = String(sig || '').trim();
    if(!key) return null;
    const prevRaw = localStorage.getItem(STORAGE_KEY);
    const all = loadAll();
    const value = normalizeDirection(dir);
    if(value === normalizeDirection(all[key])) return { key:STORAGE_KEY, changed:false, prevRaw, nextRaw:prevRaw, nextStore:all };
    const baseline = sessionOptionsBaseline();
    if(baseline && Object.prototype.hasOwnProperty.call(baseline.store, key)
      && value === normalizeDirection(baseline.store[key])) all[key] = baseline.store[key];
    else if(value === 'default') delete all[key];
    else all[key] = value;
    const nextRaw = desiredOptionsRaw(all, baseline);
    return { key:STORAGE_KEY, changed:prevRaw !== nextRaw, prevRaw, nextRaw, nextStore:all };
  }

  function writeRaw(key, raw){
    if(raw === null) return localStorage.removeItem(key);
    return localStorage.setItem(key, raw);
  }

  function refreshSessionButtons(){
    try{ root.FC && root.FC.views && typeof root.FC.views.refreshSessionButtons === 'function' && root.FC.views.refreshSessionButtons(); }catch(_){ }
  }

  function setDirection(sig, dir){
    try{
      const plan = prepareDirection(sig, dir);
      if(!plan) return false;
      if(!plan.changed) return true;
      const session = root.FC && root.FC.session;
      if(!(session && typeof session.begin === 'function' && session.begin() === true)) return false;
      writeRaw(plan.key, plan.nextRaw);
    }catch(_){ return false; }
    refreshSessionButtons();
    return true;
  }

  function notifySaveFailure(rollbackFailed){
    try{
      if(root.FC.infoBox && typeof root.FC.infoBox.open === 'function') root.FC.infoBox.open({
        title:'Nie udało się zapisać opcji formatki',
        message:rollbackFailed
          ? 'Zapis częściowo się nie powiódł i nie udało się przywrócić poprzednich ustawień. Sesja edycji została zachowana. Ponów zapis lub użyj globalnego Anuluj, aby cofnąć zmiany sesji.'
          : 'Opcje formatki nie zostały zapisane. Wprowadzone zmiany pozostały w formularzu. Spróbuj ponownie.',
        okOnly:true,
      });
    }catch(_){ }
  }

  // Only this modal coordinates these two stores; their planners own semantic revert.
  function saveDraft(sig, initial, draft, edgeEditor){
    const written = [];
    let edgePlan = null;
    try{
      const plans = [];
      if(normalizeDirection(draft.direction) !== normalizeDirection(initial.direction)){
        const plan = prepareDirection(sig, draft.direction);
        if(!plan) return false;
        plans.push(plan);
      }
      if(!sameEdges(draft.edges, initial.edges)){
        if(root.FC.projectPcvGuard){const policy=root.FC.projectPcvGuard.read({legacyWrite:true});if(!policy.ok || policy.mode==='project'){root.FC.projectPcvGuard.notify({code:policy.code || 'PROJECT_PCV_EDITOR_REQUIRED'});return false;}}
        if(!(edgeEditor && typeof edgeEditor.prepare === 'function' && typeof edgeEditor.apply === 'function')) return false;
        edgePlan = edgeEditor.prepare(draft.edges);
        if(!edgePlan) return false;
        plans.push(edgePlan);
      }
      const changed = plans.filter((plan)=> plan.changed);
      if(changed.length){
        const session = root.FC && root.FC.session;
        if(!(session && typeof session.begin === 'function' && session.begin() === true)) return false;
        for(const plan of changed){
          writeRaw(plan.key, plan.nextRaw);
          written.push(plan);
        }
      }
    }catch(_){
      let rollbackFailed = false;
      for(const plan of written.reverse()){
        try{ writeRaw(plan.key, plan.prevRaw); }catch(_){ rollbackFailed = true; }
      }
      notifySaveFailure(rollbackFailed);
      return false;
    }
    if(edgePlan) edgeEditor.apply(edgePlan);
    refreshSessionButtons();
    return true;
  }

  // Grain first, then confirmed project PCV. Only our witnessed grain RAW may
  // be compensated; project/session uncertainty is latched, never Cancelled here.
  function saveProjectDraft(sig, initial, draft, editor, restoreDefaults, openedRaw){
    const FC=root.FC,session=FC.session;
    const fail=code=>({ok:false,code});
    let plan,grainAttempted=false,projectAttempted=false,projectSaved=false,result;
    function checkedRaw(raw,expected){
      if(localStorage.getItem(STORAGE_KEY)!==expected)throw fail('GRAIN_WRITE_CONFLICT');
      if(writeRaw(STORAGE_KEY,raw)===false || localStorage.getItem(STORAGE_KEY)!==raw)throw fail('GRAIN_WRITE_UNCONFIRMED');
    }
    try{
      const owner=editor.validate();if(!owner || !owner.ok)throw owner || fail('EDIT_CONTEXT_MISMATCH');
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw!==openedRaw)throw fail('GRAIN_WRITE_CONFLICT');
      const store=raw===null?{}:JSON.parse(raw);
      if(!store || typeof store!=='object' || Array.isArray(store))throw fail('INVALID_GRAIN_DATA');
      plan=prepareDirection(sig,draft.direction);
      if(!plan)throw fail('INVALID_GRAIN_DATA');
      const changeEdges=!sameEdges(initial.edges,draft.edges) || restoreDefaults && owner.source==='override';
      if(!plan.changed && !changeEdges)return {ok:true,changed:false};
      if(!session || session.begin(editor.roomId)!==true)throw fail('BEGIN_FAILED');
      if(!session.inspectNavigationState || !session.inspectNavigationState())throw fail('SESSION_UNCONFIRMED');
      const fresh=editor.validate();if(!fresh || !fresh.ok)throw fresh || fail('EDIT_CONTEXT_MISMATCH');
      if(localStorage.getItem(STORAGE_KEY)!==openedRaw)throw fail('GRAIN_WRITE_CONFLICT');
      // Replan after begin so semantic revert can use its durable baseline.
      plan=prepareDirection(sig,draft.direction);
      if(plan.prevRaw!==openedRaw)throw fail('GRAIN_WRITE_CONFLICT');
      if(plan.changed){grainAttempted=true;checkedRaw(plan.nextRaw,plan.prevRaw);}
      if(changeEdges){
        // The global write may expose a competing project/context change.
        const beforeProject=editor.validate();if(!beforeProject || !beforeProject.ok)throw beforeProject || fail('EDIT_CONTEXT_MISMATCH');
        if(localStorage.getItem(STORAGE_KEY)!==plan.nextRaw)throw fail('GRAIN_WRITE_CONFLICT');
        projectAttempted=true;result=editor.saveEdges(copyEdges(draft.edges),restoreDefaults);
        if(!result || result.ok!==true)throw result || fail('SAVE_FAILED');
        projectSaved=result.changed===true;
      }
      const after=editor.validate(true);
      if(!after || !after.ok)throw after || fail('EDIT_CONTEXT_MISMATCH');
      const desired=restoreDefaults?after.defaults:draft.edges;
      if(!sameEdges(after.edges,desired) || localStorage.getItem(STORAGE_KEY)!==plan.nextRaw
        || !session.inspectNavigationState())throw fail('SAVE_UNCONFIRMED');
      refreshSessionButtons();return {ok:true,changed:plan.changed || projectSaved};
    }catch(error){
      let unconfirmed=!!(error && error.projectSaved) || projectSaved;
      if(projectAttempted){
        try{if(editor.recordFingerprint()!==editor.openedRecord)unconfirmed=true;}catch(_){unconfirmed=true;}
      }
      if(grainAttempted){
        try{
          const current=localStorage.getItem(STORAGE_KEY);
          if(current!==plan.prevRaw){
            // Never restore an old global store over a concurrent writer.
            if(current!==plan.nextRaw)throw fail('GRAIN_ROLLBACK_CONFLICT');
            checkedRaw(plan.prevRaw,plan.nextRaw);
          }
        }catch(_){unconfirmed=true;}
      }
      if(unconfirmed && session && session.markUnconfirmedProjectWrite)session.markUnconfirmedProjectWrite();
      return {ok:false,code:error && error.code || 'WRITE_FAILED',unconfirmed,projectSaved:projectSaved || !!(error && error.projectSaved)};
    }
  }

  function notifyProjectSaveFailure(result){
    if(result.projectSaved){root.FC.projectPcvGuard.notify(result);return;}
    if(result.unconfirmed){
      root.FC.infoBox && root.FC.infoBox.open({title:'Nie udało się zapisać opcji formatki',okOnly:true,
        message:'Zapis jest częściowy lub niepotwierdzony. Dalszy zapis został wstrzymany, aby chronić dane. Zachowano formularz i snapshot sesji.'});
    }else notifySaveFailure(false);
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
      ...(root.FC.partProvenance ? root.FC.partProvenance.copy(part) : {}),
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
    let openedRaw,openedDirection;
    if(cfg.projectEditor){
      try{openedRaw=localStorage.getItem(STORAGE_KEY);openedDirection=normalizeDirection((openedRaw===null?{}:JSON.parse(openedRaw))[sig]);}catch(_){ }
    }
    const initial = {
      direction:cfg.projectEditor?normalizeDirection(openedDirection):normalizeDirection((cfg && cfg.initialDirection) || getDirection(sig)),
      edges:copyEdges(cfg && cfg.edges),
    };
    const draft = { direction:initial.direction, edges:copyEdges(initial.edges) };
    const pcvOnly=cfg.editorMode==='pcv',grainOnly=cfg.editorMode==='grain';
    let restoreDefaults=false;

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

    const aCm = Number(cfg.aCm);
    const bCm = Number(cfg.bCm);
    const ratio = Number.isFinite(aCm) && aCm > 0 && Number.isFinite(bCm) && bCm > 0
      ? Math.min(2.6, Math.max(0.45, aCm / bCm)) : 1;
    const mapWidth = Math.min(300, 216 * ratio);
    const fmtCm = typeof cfg.fmtCm === 'function' ? cfg.fmtCm
      : (value)=> Number.isFinite(value) ? String(value).replace('.', ',') : '—';
    const preview = h('div', { class:'material-part-options__preview' });
    const map = h('div', {
      class:'material-part-options__map',
      style:`--part-map-width:${mapWidth}px;--part-map-ratio:${ratio};`,
    });
    const surfaceClass = 'material-part-options__preview-rect material-part-options__surface';
    const edgeControls = [];
    const previewRect = h('div', { class:surfaceClass, 'aria-label':'Powierzchnia formatki — kierunek słojów' });
    map.appendChild(previewRect);
    [
      ['1A', 'w1', aCm], ['1B', 'w2', aCm],
      ['2A', 'h1', bCm], ['2B', 'h2', bCm],
    ].forEach(([code, key, dimension])=>{
      const on = draft.edges[key];
      const label = `${code} · ${fmtCm(dimension)} cm`;
      const edge = h('label', {
        class:`material-part-options__edge material-part-options__edge--${code.toLowerCase()}${on ? ' is-on' : ''}`,
      });
      const input = h('input', {
        type:'checkbox', checked:on ? 'checked' : null,
        'aria-label':`PCV ${code}`,disabled:grainOnly?'disabled':null,
      });
      input.addEventListener('change', ()=>{
        if(grainOnly)return;
        restoreDefaults=false;draft.edges[key] = !!input.checked;
        updateState();
      });
      edgeControls.push({ key, edge, input });
      edge.appendChild(input);
      edge.appendChild(h('span', { class:'material-part-options__edge-label', text:label }));
      map.appendChild(edge);
    });
    preview.appendChild(map);
    preview.appendChild(h('div', {
      class:'material-part-options__map-note', text:'Widok poglądowy — proporcje orientacyjne.',
    }));
    scroll.appendChild(preview);

    const optionsWrap = h('div', { class:'material-part-options__choices' });
    const optionDefs = [
      { key:'default', label:'Domyślny z materiału', hint:'Bez dodatkowego wymuszenia dla tej formatki.' },
      { key:'horizontal', label:'Poziom', hint:'Słój idzie w osi 1 / poziomej.' },
      { key:'vertical', label:'Pion', hint:'Słój idzie w osi 2 / pionowej.' },
      { key:'none', label:'Bez znaczenia', hint:'Ta formatka może być obracana jak bez słojów.' },
    ];
    const cards = [];
    (pcvOnly ? [] : optionDefs).forEach((opt)=>{
      const btn = h('button', { type:'button', class:'material-part-options__choice' });
      btn.appendChild(h('div', { class:'material-part-options__choice-label', text:opt.label }));
      btn.appendChild(h('div', { class:'material-part-options__choice-hint', text:opt.hint }));
      btn.addEventListener('click', ()=>{
        draft.direction = opt.key;
        updateState();
      });
      cards.push({ key:opt.key, btn });
      optionsWrap.appendChild(btn);
    });
    if(!pcvOnly)scroll.appendChild(optionsWrap);
    if(pcvOnly || cfg.projectEditor){
      const reset=h('button',{type:'button',class:'btn-primary',text:'Przywróć domyślne PCV'});
      reset.addEventListener('click',()=>{draft.edges=copyEdges(cfg.defaults);restoreDefaults=true;updateState();});scroll.appendChild(reset);
    }

    const footer = h('div', { class:'material-part-options__footer' });
    const footerActions = h('div', { class:'material-part-options__footer-actions' });
    const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' });
    const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' });
    const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zapisz' });

    function isDirty(){ return restoreDefaults || draft.direction !== initial.direction || !sameEdges(draft.edges, initial.edges); }
    function updatePreview(){
      previewRect.className = surfaceClass;
      previewRect.classList.add(`is-${normalizeDirection(draft.direction)}`);
      edgeControls.forEach(({ key, edge, input })=>{
        input.checked = draft.edges[key];
        edge.classList.toggle('is-on', draft.edges[key]);
        previewRect.classList.toggle(`has-${key}`, draft.edges[key]);
      });
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
      cards.forEach((item)=> item.btn.classList.toggle('is-selected', item.key === normalizeDirection(draft.direction)));
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
      if(cfg.projectEditor){
        const result=saveProjectDraft(sig,initial,draft,cfg.projectEditor,restoreDefaults,openedRaw);
        if(!result.ok){notifyProjectSaveFailure(result);return false;}
      }else if(pcvOnly){
        let result;try{result=cfg.saveEdges(copyEdges(draft.edges),restoreDefaults);}catch(_){result={ok:false,code:'WRITE_FAILED'};}
        if(!result || result.ok!==true){if(FC.projectPcvGuard)FC.projectPcvGuard.notify(result);return false;}
      }else if(saveDraft(sig, initial, draft, cfg.edgeEditor) !== true) return false;
      try{ if(typeof cfg.onSave === 'function') cfg.onSave(normalizeDirection(draft.direction)); }catch(_){ }
      try{ FC.panelBox.close(); }catch(_){ } finally{ notifyClose(); }
      return true;
    });

    FC.panelBox.open({
      title:pcvOnly?'PCV formatki':grainOnly?'Kierunek słojów — ustawienie globalne':'Opcje formatki',
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
    prepareDirection,
    saveDraft,
    saveProjectDraft,
    resolveDimsMm,
    resolvePartForRozrys,
    openOptionsModal,
  };
})();
