(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function getValidationApi(){ return (window.FC && window.FC.cabinetModalValidation) || {}; }
  function getDraftApi(){ return (window.FC && window.FC.cabinetModalDraft) || {}; }
  function getFieldsApi(){ return (window.FC && window.FC.cabinetModalFields) || {}; }
  function getModalApi(){ return (window.FC && window.FC.cabinetModal) || {}; }

  function calcTopForSetSafe(room, blende, sumLowerHeights){
    const api = getValidationApi();
    if(api && typeof api.calcTopForSetSafe === 'function') return api.calcTopForSetSafe(room, blende, sumLowerHeights);
    return 0;
  }

  function addFrontSafe(room, front){
    const api = getValidationApi();
    if(api && typeof api.addFrontSafe === 'function') return api.addFrontSafe(room, front);
    projectData[room].fronts = projectData[room].fronts || [];
    projectData[room].fronts.push(front);
    return front;
  }

  function removeFrontsForSetSafe(room, setId){
    const api = getValidationApi();
    if(api && typeof api.removeFrontsForSetSafe === 'function') return api.removeFrontsForSetSafe(room, setId);
    projectData[room].fronts = (projectData[room].fronts || []).filter(function(front){ return String(front && front.setId) !== String(setId); });
  }

  function populateFrontColorsTo(selectEl, typeVal, selected){
    const api = getFieldsApi();
    if(api && typeof api.populateFrontColorsTo === 'function') return api.populateFrontColorsTo(selectEl, typeVal, selected);
    return null;
  }

  function makeDefaultCabinetDraftForRoom(room){
    const api = getDraftApi();
    if(api && typeof api.makeDefaultCabinetDraftForRoom === 'function') return api.makeDefaultCabinetDraftForRoom(room);
    return null;
  }

  function cloneSafe(value){
    try{
      if(ns.utils && typeof ns.utils.clone === 'function') return ns.utils.clone(value);
    }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function uidSafe(){
    try{
      if(ns.utils && typeof ns.utils.uid === 'function') return ns.utils.uid();
    }catch(_){ }
    return String(Date.now()) + Math.random();
  }

  function showCabinetInfo(title, message){
    try{
      if(ns.infoBox && typeof ns.infoBox.open === 'function'){
        ns.infoBox.open({ title:String(title || 'Informacja'), message:String(message || '') });
        return;
      }
    }catch(_){ }
    try{ console.warn('[cabinetSetWizard]', title, message); }catch(_){ }
  }

  function renderCabinetModalSafe(){
    try{
      const api = getModalApi();
      if(api && typeof api.renderCabinetModal === 'function') return api.renderCabinetModal();
    }catch(_){ }
    try{ if(typeof renderCabinetModal === 'function') return renderCabinetModal(); }catch(_){ }
    return null;
  }

  function closeCabinetModalSafe(){
    try{
      const api = getModalApi();
      if(api && typeof api.closeCabinetModal === 'function') return api.closeCabinetModal();
    }catch(_){ }
    try{ if(typeof closeCabinetModal === 'function') return closeCabinetModal(); }catch(_){ }
    try{ const modal = document.getElementById('cabinetModal'); if(modal) modal.style.display = 'none'; }catch(_){ }
    try{
      document.documentElement.classList.remove('modal-lock');
      document.body.classList.remove('modal-lock');
    }catch(_){ }
    return null;
  }

  function renderCabinetsSafe(){
    try{ if(typeof renderCabinets === 'function') return renderCabinets(); }catch(_){ }
    try{
      if(ns.views && typeof ns.views.renderCabinets === 'function') return ns.views.renderCabinets();
    }catch(_){ }
    return null;
  }

  function openCabinetModalSurface(){
    const modal = document.getElementById('cabinetModal');
    if(modal){
      modal.style.display = 'flex';
      try{
        modal.classList.add('modal-open-guard');
        requestAnimationFrame(function(){
          setTimeout(function(){
            try{ modal.classList.remove('modal-open-guard'); }catch(_){ }
          }, 260);
        });
      }catch(_){ }
    }
    try{
      document.documentElement.classList.add('modal-lock');
      document.body.classList.add('modal-lock');
    }catch(_){ }
  }

  function refreshSetLaunchers(){
    try{
      const launcherApi = window.FC && window.FC.cabinetChoiceLaunchers;
      if(launcherApi && typeof launcherApi.refreshCabinetChoices === 'function') launcherApi.refreshCabinetChoices(document.getElementById('setWizardArea'));
      else {
        if(launcherApi && typeof launcherApi.mountDynamicSelectLaunchers === 'function') launcherApi.mountDynamicSelectLaunchers(document.getElementById('setFrontBlock'));
        if(launcherApi && typeof launcherApi.mountVisibleFallbackLaunchers === 'function') launcherApi.mountVisibleFallbackLaunchers(document.getElementById('setWizardArea'));
      }
    }catch(_){ }
  }

  function renderSetTiles(){
    const wrap = document.getElementById('setTiles');
    if(!wrap) return;
    wrap.innerHTML = '';

    const presets = [
      {
        id:'A',
        title:'Dół + Dół + Moduł',
        desc:'Dwie dolne szafki obok siebie i moduł na górze.',
        svg:`
          <svg viewBox="0 0 82 40" class="mini-svg" aria-hidden="true">
            <rect x="2" y="18" width="28" height="20" rx="3" fill="#ffffff" stroke="#0ea5e9" />
            <rect x="31" y="18" width="28" height="20" rx="3" fill="#ffffff" stroke="#0ea5e9" />
            <rect x="16" y="2" width="44" height="14" rx="3" fill="#ffffff" stroke="#0ea5e9" />
            <line x1="16" y1="9" x2="60" y2="9" stroke="#0ea5e9" stroke-width="2" />
            <line x1="16" y1="18" x2="60" y2="18" stroke="#0ea5e9" stroke-width="2" />
          </svg>
        `
      },
      {
        id:'C',
        title:'Dół + Moduł',
        desc:'Dolna szafka i moduł na całej szerokości.',
        svg:`
          <svg viewBox="0 0 82 40" class="mini-svg" aria-hidden="true">
            <rect x="8" y="18" width="34" height="20" rx="3" fill="#ffffff" stroke="#0ea5e9" />
            <rect x="44" y="2" width="30" height="36" rx="3" fill="#ffffff" stroke="#0ea5e9" />
            <line x1="44" y1="15" x2="74" y2="15" stroke="#0ea5e9" stroke-width="2" />
            <line x1="44" y1="26" x2="74" y2="26" stroke="#0ea5e9" stroke-width="2" />
          </svg>
        `
      },
      {
        id:'D',
        title:'Dół + Moduł + Moduł',
        desc:'Dolna szafka, moduł środkowy i górny.',
        svg:`
          <svg viewBox="0 0 82 40" class="mini-svg" aria-hidden="true">
            <rect x="2" y="18" width="14" height="20" rx="3" fill="#ffffff" stroke="#0ea5e9" />
            <rect x="18" y="2" width="20" height="36" rx="3" fill="#ffffff" stroke="#0ea5e9" />
            <line x1="18" y1="15" x2="38" y2="15" stroke="#0ea5e9" stroke-width="2"/>
            <line x1="18" y1="26" x2="38" y2="26" stroke="#0ea5e9" stroke-width="2"/>
            <rect x="18" y="26" width="20" height="12" rx="0" fill="#eaf6ff" opacity="0.65" />
          </svg>
        `
      }
    ];

    presets.forEach(function(p){
      const tile = document.createElement('div');
      tile.className = 'mini-tile' + (cabinetModalState.setPreset === p.id ? ' selected' : '');
      tile.setAttribute('data-preset', p.id);
      tile.innerHTML = `
        <div class="mini-head">
          ${p.svg}
          <div>
            <div class="mini-title">${p.title}</div>
            <div class="muted-tag xs">Zestaw standardowy</div>
          </div>
        </div>
        <div class="mini-desc">${p.desc}</div>
      `;
      tile.addEventListener('click', function(){
        cabinetModalState.setPreset = p.id;
        renderCabinetModalSafe();
      });
      wrap.appendChild(tile);
    });
  }

  function renderSetParamsUI(presetId){
    const room = uiState.roomType;
    const s = projectData[room].settings;
    const paramsWrap = document.getElementById('setParams');
    if(!paramsWrap) return;
    paramsWrap.innerHTML = '';
    if(!presetId){ paramsWrap.style.display='none'; return; }

    paramsWrap.style.display='grid';
    try{ paramsWrap.classList.add('set-param-grid'); }catch(_){ }

    function addInput(id,label,value,extra){
      const d = document.createElement('div');
      d.className = 'set-param-field';
      d.innerHTML = `<label class="set-param-field__label">${label}</label><input class="set-param-field__control" id="${id}" type="number" value="${value}" ${extra || ''}/>`;
      paramsWrap.appendChild(d);
    }
    function addReadonly(id,label,value){
      const d = document.createElement('div');
      d.className = 'set-param-field set-param-field--readonly';
      d.innerHTML = `<label class="set-param-field__label">${label}</label><input class="set-param-field__control" id="${id}" type="number" value="${value}" disabled />`;
      paramsWrap.appendChild(d);
    }

    const defaultBlende = Number(s.ceilingBlende) || 0;

    if(presetId === 'A'){
      addInput('setW1','Szer. lewa (cm)', 60);
      addInput('setW2','Szer. prawa (cm)', 60);
      addInput('setHBottom','Wys. dolnych (cm)', Number(s.bottomHeight)||82);
      addInput('setDBottom','Głębokość dolnych (cm)', 51);
      addInput('setBlende','Blenda (cm)', defaultBlende);
      addReadonly('setHTopResult','Wys. górnego (wynikowa)', calcTopForSetSafe(room, defaultBlende, Number(s.bottomHeight)||82));
      addReadonly('setDTopResult','Głęb. górnego (dół-1)', Math.max(0, 51-1));
    }

    if(presetId === 'C'){
      addInput('setW','Szerokość (cm)', 60);
      addInput('setHBottom','Wys. dolnego z nogami (cm)', Number(s.bottomHeight)||82);
      addInput('setDBottom','Głębokość dolnego (cm)', 51);
      addInput('setBlende','Blenda (cm)', defaultBlende);
      addReadonly('setHTopResult','Wys. górnego (wynikowa)', calcTopForSetSafe(room, defaultBlende, Number(s.bottomHeight)||82));
      addReadonly('setDTopResult','Głęb. górnego (dół-1)', Math.max(0, 51-1));
    }

    if(presetId === 'D'){
      addInput('setW','Szerokość (cm)', 60);
      addInput('setHBottom','Wys. dolnego z nogami (cm)', Number(s.bottomHeight)||82);
      addInput('setHMiddle','Wys. środkowego (cm)', 100);
      addInput('setDBottom','Głębokość dolnego (cm)', 51);
      addInput('setBlende','Blenda (cm)', defaultBlende);
      addReadonly('setHTopResult','Wys. górnego (wynikowa)', calcTopForSetSafe(room, defaultBlende, (Number(s.bottomHeight)||82) + 100));
      addReadonly('setDTopResult','Głęb. modułów (dół-1)', Math.max(0, 51-1));
    }

    wireSetParamsLiveUpdate(presetId);
  }

  function wireSetParamsLiveUpdate(presetId){
    const room = uiState.roomType;
    const s = projectData[room].settings;

    function val(id, fallback){
      const el = document.getElementById(id);
      if(!el) return fallback || 0;
      return Number(el.value || fallback || 0);
    }

    function update(){
      const bl = val('setBlende', Number(s.ceilingBlende)||0);

      if(presetId === 'A'){
        const db = val('setDBottom', 51);
        const hB = val('setHBottom', Number(s.bottomHeight)||82);
        const ht = calcTopForSetSafe(room, bl, hB);
        const dt = Math.max(0, Math.round((db - 1) * 10)/10);
        const htEl = document.getElementById('setHTopResult');
        const dtEl = document.getElementById('setDTopResult');
        if(htEl) htEl.value = ht;
        if(dtEl) dtEl.value = dt;
      }

      if(presetId === 'C'){
        const db = val('setDBottom', 51);
        const hB = val('setHBottom', Number(s.bottomHeight)||82);
        const ht = calcTopForSetSafe(room, bl, hB);
        const dt = Math.max(0, Math.round((db - 1) * 10)/10);
        const htEl = document.getElementById('setHTopResult');
        const dtEl = document.getElementById('setDTopResult');
        if(htEl) htEl.value = ht;
        if(dtEl) dtEl.value = dt;
      }

      if(presetId === 'D'){
        const db = val('setDBottom', 51);
        const hb = val('setHBottom', Number(s.bottomHeight)||82);
        const hm = val('setHMiddle', 100);
        const ht = calcTopForSetSafe(room, bl, (hb + hm));
        const dt = Math.max(0, Math.round((db - 1) * 10)/10);
        const htEl = document.getElementById('setHTopResult');
        const dtEl = document.getElementById('setDTopResult');
        if(htEl) htEl.value = ht;
        if(dtEl) dtEl.value = dt;
      }
    }

    ['setDBottom','setBlende','setHBottom','setHMiddle'].forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.addEventListener('input', update);
    });

    update();
  }

  function renderSetWizardMode(opts){
    const isSetEdit = !!(opts && opts.isSetEdit);
    const saveTopBtn = opts && opts.saveTopBtn;
    const setArea = document.getElementById('setWizardArea');
    if(!setArea) return false;

    if(!cabinetModalState.setPreset){
      cabinetModalState.setPreset = 'A';
    }

    setArea.style.display = 'block';
    renderSetTiles();

    if(saveTopBtn){
      saveTopBtn.style.display = 'inline-flex';
      saveTopBtn.disabled = false;
      saveTopBtn.textContent = isSetEdit ? 'Zapisz zmiany' : 'Dodaj';
    }

    if(isSetEdit){
      document.querySelectorAll('#setTiles .mini-tile').forEach(function(tile){
        tile.style.pointerEvents = 'none';
        tile.style.opacity = '0.8';
      });
      if(document.getElementById('setWizardCreate')) document.getElementById('setWizardCreate').textContent = 'Zapisz zmiany';
      if(document.getElementById('setWizardTitle')) document.getElementById('setWizardTitle').textContent = 'Zestaw (edycja)';
      if(document.getElementById('setWizardDesc')) document.getElementById('setWizardDesc').textContent = 'Zmieniasz parametry zestawu. Program przeliczy korpusy i fronty.';
    } else {
      if(document.getElementById('setWizardCreate')) document.getElementById('setWizardCreate').textContent = 'Dodaj';
      if(document.getElementById('setWizardTitle')) document.getElementById('setWizardTitle').textContent = 'Zestaw';
      if(document.getElementById('setWizardDesc')) document.getElementById('setWizardDesc').textContent = 'Wybierz standardowy układ. Program doda kilka korpusów oraz fronty.';
    }

    const hasPreset = !!cabinetModalState.setPreset;
    renderSetParamsUI(cabinetModalState.setPreset);
    if(document.getElementById('setParams')) document.getElementById('setParams').style.display = hasPreset ? 'grid' : 'none';

    const frontBlock = document.getElementById('setFrontBlock');
    if(frontBlock) frontBlock.style.display = hasPreset ? 'block' : 'none';

    if(hasPreset){
      const cntSel = document.getElementById('setFrontCount');
      const matSel = document.getElementById('setFrontMaterial');
      const colSel = document.getElementById('setFrontColor');

      if(cntSel && !cntSel.value) cntSel.value = '2';
      if(matSel && !matSel.value) matSel.value = 'laminat';
      populateFrontColorsTo(colSel, matSel ? matSel.value : 'laminat', (colSel && colSel.value) || '');

      if(matSel){
        matSel.onchange = function(){ populateFrontColorsTo(colSel, matSel.value, ''); };
      }

      const hint = document.getElementById('setFrontHint');
      const updateHint = function(){
        if(!hint || !cntSel) return;
        const c = Number(cntSel.value || 1);
        if(c === 1) hint.textContent = 'Powstanie 1 front (na całą szerokość zestawu) o wysokości sumy segmentów.';
        else hint.textContent = 'Powstaną 2 fronty. Dla zestawu A: lewy/prawy. Dla pionów: po 1/2 szerokości każdy.';
      };
      if(cntSel) cntSel.onchange = updateHint;
      updateHint();
    }

    refreshSetLaunchers();
    return true;
  }

  function isSetModeActive(){
    const setArea = document.getElementById('setWizardArea');
    return !!((cabinetModalState && cabinetModalState.chosen === 'zestaw') ||
      (cabinetModalState && cabinetModalState.setEditId) ||
      (setArea && setArea.style.display === 'block'));
  }

  function handleTopSaveClick(e){
    try{
      if(window.FC && FC.actions && typeof FC.actions.dispatch === 'function'){
        FC.actions.dispatch('create-set', { event: e, element: document.getElementById('setWizardCreate') || null, target: e && e.target });
      } else {
        createOrUpdateSetFromWizard();
      }
    } catch(err){
      try{ console.error(err); }catch(_){ }
      showCabinetInfo('Błąd zapisu zestawu', String(err && (err.message || err) ? (err.message || err) : 'nieznany błąd'));
    } finally {
      try { if(e && e.target && e.target.blur) e.target.blur(); } catch(_){ }
    }
    return true;
  }

  function createFrontsForSet(room, presetId, frontCount, frontMaterial, frontColor, dims, setId, setNumber){
    frontCount = Number(frontCount || 1);

    if(presetId === 'A'){
      const w1 = Number(dims && dims.w1 || 0);
      const w2 = Number(dims && dims.w2 || 0);
      const totalH = Number(dims && dims.hB || 0) + Number(dims && dims.hTop || 0);
      if(frontCount === 1){
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: w1 + w2, height: totalH, note: `Zestaw ${setNumber}: 1 front` });
      } else {
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: w1, height: totalH, note: `Zestaw ${setNumber}: front lewy` });
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: w2, height: totalH, note: `Zestaw ${setNumber}: front prawy` });
      }
      return;
    }

    if(presetId === 'C'){
      const w = Number(dims && dims.w || 0);
      const totalH = Number(dims && dims.hB || 0) + Number(dims && dims.hTop || 0);
      if(frontCount === 1){
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: w, height: totalH, note: `Zestaw ${setNumber}: 1 front` });
      } else {
        const half = Math.round((w / 2) * 10) / 10;
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: half, height: totalH, note: `Zestaw ${setNumber}: front 1/2` });
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: w - half, height: totalH, note: `Zestaw ${setNumber}: front 2/2` });
      }
      return;
    }

    if(presetId === 'D'){
      const w = Number(dims && dims.w || 0);
      const totalH = Number(dims && dims.hB || 0) + Number(dims && dims.hM || 0) + Number(dims && dims.hTop || 0);
      if(frontCount === 1){
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: w, height: totalH, note: `Zestaw ${setNumber}: 1 front` });
      } else {
        const half = Math.round((w / 2) * 10) / 10;
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: half, height: totalH, note: `Zestaw ${setNumber}: front 1/2` });
        addFrontSafe(room, { setId:setId, setNumber:setNumber, material: frontMaterial, color: frontColor, width: w - half, height: totalH, note: `Zestaw ${setNumber}: front 2/2` });
      }
    }
  }

  function getSetParamsFromUI(presetId){
    const room = uiState.roomType;
    const s = projectData[room].settings;

    function num(id, fallback){
      const el = document.getElementById(id);
      if(!el) return fallback || 0;
      return Number(el.value || fallback || 0);
    }

    const blende = num('setBlende', Number(s.ceilingBlende)||0);
    const dBottom = num('setDBottom', 51);
    const dModule = Math.max(0, Math.round((dBottom - 1)*10)/10);

    if(presetId === 'A'){
      const w1 = num('setW1', 60);
      const w2 = num('setW2', 60);
      const hB = num('setHBottom', Number(s.bottomHeight)||82);
      const hTop = calcTopForSetSafe(room, blende, hB);
      return { presetId:presetId, w1:w1, w2:w2, hB:hB, hTop:hTop, dBottom:dBottom, dModule:dModule, blende:blende };
    }
    if(presetId === 'C'){
      const w = num('setW', 60);
      const hB = num('setHBottom', Number(s.bottomHeight)||82);
      const hTop = calcTopForSetSafe(room, blende, hB);
      return { presetId:presetId, w:w, hB:hB, hTop:hTop, dBottom:dBottom, dModule:dModule, blende:blende };
    }
    if(presetId === 'D'){
      const w = num('setW', 60);
      const hB = num('setHBottom', Number(s.bottomHeight)||82);
      const hM = num('setHMiddle', 100);
      const hTop = calcTopForSetSafe(room, blende, (hB + hM));
      return { presetId:presetId, w:w, hB:hB, hM:hM, hTop:hTop, dBottom:dBottom, dModule:dModule, blende:blende };
    }
    return null;
  }

  function fillSetParamsUIFromSet(set){
    if(!set) return;
    renderSetParamsUI(set.presetId);

    const p = set.params || {};
    function setVal(id,v){
      const el = document.getElementById(id);
      if(el && v != null && !el.disabled) el.value = v;
    }

    if(set.presetId === 'A'){
      setVal('setW1', p.w1);
      setVal('setW2', p.w2);
      setVal('setHBottom', p.hB);
      setVal('setDBottom', p.dBottom);
      setVal('setBlende', p.blende);
    }
    if(set.presetId === 'C'){
      setVal('setW', p.w);
      setVal('setHBottom', p.hB);
      setVal('setDBottom', p.dBottom);
      setVal('setBlende', p.blende);
    }
    if(set.presetId === 'D'){
      setVal('setW', p.w);
      setVal('setHBottom', p.hB);
      setVal('setHMiddle', p.hM);
      setVal('setDBottom', p.dBottom);
      setVal('setBlende', p.blende);
    }

    const cntSel = document.getElementById('setFrontCount');
    const matSel = document.getElementById('setFrontMaterial');
    const colSel = document.getElementById('setFrontColor');

    if(cntSel && set.frontCount) cntSel.value = String(set.frontCount);
    if(matSel && set.frontMaterial) matSel.value = set.frontMaterial;
    if(colSel){
      populateFrontColorsTo(colSel, (matSel ? matSel.value : 'laminat'), set.frontColor || '');
      colSel.value = set.frontColor || colSel.value;
    }

    wireSetParamsLiveUpdate(set.presetId);
  }

  function getNextSetNumber(room){
    const arr = projectData[room].sets || [];
    let max = 0;
    arr.forEach(function(set){ if(typeof set.number === 'number') max = Math.max(max, set.number); });
    return max + 1;
  }

  function openSetWizardForEdit(setId){
    setId = String(setId);
    const room = uiState.roomType;
    if(!room) return;
    const list = Array.isArray(projectData[room] && projectData[room].sets) ? projectData[room].sets : [];
    const set = list.find(function(item){ return String(item && item.id) === setId; });
    if(!set){ showCabinetInfo('Brak zestawu', 'Nie znaleziono zestawu do edycji.'); return; }

    const draftApi = getDraftApi();
    if(draftApi && typeof draftApi.beginSetEditState === 'function') draftApi.beginSetEditState(setId, set);
    else {
      cabinetModalState.mode = 'add';
      cabinetModalState.editingId = null;
      cabinetModalState.setEditId = setId;
      cabinetModalState.chosen = 'zestaw';
      cabinetModalState.setPreset = set.presetId;
      cabinetModalState.draft = null;
    }

    renderCabinetModalSafe();
    fillSetParamsUIFromSet(set);
    openCabinetModalSurface();
  }

  function createOrUpdateSetFromWizard(){
    try{
      const state = (window.FC && FC.uiState && typeof FC.uiState.get === 'function') ? FC.uiState.get() : (typeof uiState !== 'undefined' ? uiState : {});
      const room = state.roomType || (uiState && uiState.roomType);
      if(!room){ showCabinetInfo('Brak pomieszczenia', 'Wybierz pomieszczenie.'); return; }

      const presetId =
        ((typeof cabinetModalState !== 'undefined' && cabinetModalState && cabinetModalState.setPreset) ? cabinetModalState.setPreset : null)
        || (document.querySelector('#setTiles .mini-tile.selected') && document.querySelector('#setTiles .mini-tile.selected').getAttribute('data-preset'))
        || (document.querySelector('#setTiles .mini-tile') && document.querySelector('#setTiles .mini-tile').getAttribute('data-preset'))
        || null;

      if(!presetId){
        showCabinetInfo('Brak zestawu', 'Wybierz zestaw.');
        return;
      }

      if(typeof cabinetModalState !== 'undefined' && cabinetModalState){
        cabinetModalState.setPreset = presetId;
      }

      const params = getSetParamsFromUI(presetId);
      if(!params){ showCabinetInfo('Brak parametrów', 'Brak parametrów zestawu.'); return; }

      projectData[room] = projectData[room] || { cabinets:[], settings:{} };
      projectData[room].cabinets = Array.isArray(projectData[room].cabinets) ? projectData[room].cabinets : [];
      projectData[room].sets = Array.isArray(projectData[room].sets) ? projectData[room].sets : [];

      const cntEl = document.getElementById('setFrontCount');
      const matEl = document.getElementById('setFrontMaterial');
      const colEl = document.getElementById('setFrontColor');
      if(!cntEl || !matEl || !colEl){
        showCabinetInfo('Brak pól zestawu', 'Brak pól zestawu (fronty / materiał / kolor). Wybierz preset i spróbuj ponownie.');
        return;
      }

      const frontCount = Number(cntEl.value || 1);
      const frontMaterial = matEl.value || 'laminat';
      const frontColor = colEl.value || '';

      const isEdit = !!(cabinetModalState && cabinetModalState.setEditId);
      const setId = isEdit ? cabinetModalState.setEditId : uidSafe();

      let setNumber;
      if(isEdit){
        const old = (projectData[room].sets || []).find(function(set){ return set && set.id === setId; });
        setNumber = old && typeof old.number === 'number' ? old.number : getNextSetNumber(room);
      } else {
        setNumber = getNextSetNumber(room);
      }

      const base = makeDefaultCabinetDraftForRoom(room) || {};

      function finalizeCab(cab){
        const out = cab || {};
        out.id = out.id || uidSafe();
        if(!out.details) out.details = cloneSafe(base.details || {});
        if(!out.bodyColor) out.bodyColor = base.bodyColor;
        if(!out.frontMaterial) out.frontMaterial = base.frontMaterial || 'laminat';
        if(!out.frontColor){
          const first = (typeof materials !== 'undefined' && Array.isArray(materials)) ? materials.find(function(m){ return m && m.materialType === out.frontMaterial; }) : null;
          out.frontColor = first ? first.name : '';
        }
        if(!out.openingSystem) out.openingSystem = base.openingSystem || 'uchwyt klienta';
        if(!out.backMaterial) out.backMaterial = base.backMaterial || 'HDF 3mm biała';
        out.setId = setId;
        out.setPreset = presetId;
        out.setNumber = setNumber;
        out.setName = `Zestaw ${setNumber}`;
        return out;
      }

      if(isEdit){
        projectData[room].cabinets = projectData[room].cabinets.filter(function(cab){ return cab && cab.setId !== setId; });
        removeFrontsForSetSafe(room, setId);
      }

      const created = [];

      if(presetId === 'A'){
        const cab1 = finalizeCab(Object.assign({}, cloneSafe(base), { type:'stojąca', subType:'standardowa', width:params.w1, height:params.hB, depth:params.dBottom, setRole:'dolny_lewy', frontCount:2 }));
        const cab2 = finalizeCab(Object.assign({}, cloneSafe(base), { type:'stojąca', subType:'standardowa', width:params.w2, height:params.hB, depth:params.dBottom, setRole:'dolny_prawy', frontCount:2 }));
        const top = finalizeCab(Object.assign({}, cloneSafe(base), { type:'moduł', subType:'standardowa', width:(params.w1+params.w2), height:params.hTop, depth:params.dModule, setRole:'gorny_modul', frontCount:0 }));
        created.push(cab1, cab2, top);
        createFrontsForSet(room, 'A', frontCount, frontMaterial, frontColor, {w1:params.w1, w2:params.w2, hB:params.hB, hTop:params.hTop}, setId, setNumber);
      }

      if(presetId === 'C'){
        const bottom = finalizeCab(Object.assign({}, cloneSafe(base), { type:'stojąca', subType:'standardowa', width:params.w, height:params.hB, depth:params.dBottom, setRole:'dolny', frontCount:2 }));
        const top = finalizeCab(Object.assign({}, cloneSafe(base), { type:'moduł', subType:'standardowa', width:params.w, height:params.hTop, depth:params.dModule, setRole:'gorny_modul', frontCount:0 }));
        created.push(bottom, top);
        createFrontsForSet(room, 'C', frontCount, frontMaterial, frontColor, {w:params.w, hB:params.hB, hTop:params.hTop}, setId, setNumber);
      }

      if(presetId === 'D'){
        const bottom = finalizeCab(Object.assign({}, cloneSafe(base), { type:'stojąca', subType:'standardowa', width:params.w, height:params.hB, depth:params.dBottom, setRole:'dolny', frontCount:2 }));
        const middle = finalizeCab(Object.assign({}, cloneSafe(base), { type:'moduł', subType:'standardowa', width:params.w, height:params.hM, depth:params.dModule, setRole:'srodkowy_modul', frontCount:0 }));
        const top = finalizeCab(Object.assign({}, cloneSafe(base), { type:'moduł', subType:'standardowa', width:params.w, height:params.hTop, depth:params.dModule, setRole:'gorny_modul', frontCount:0 }));
        created.push(bottom, middle, top);
        createFrontsForSet(room, 'D', frontCount, frontMaterial, frontColor, {w:params.w, hB:params.hB, hM:params.hM, hTop:params.hTop}, setId, setNumber);
      }

      created.forEach(function(cab){ projectData[room].cabinets.push(cab); });

      const setRecord = { id:setId, presetId:presetId, number:setNumber, params:params, frontCount:frontCount, frontMaterial:frontMaterial, frontColor:frontColor };
      if(isEdit){
        projectData[room].sets = projectData[room].sets.map(function(set){ return set && set.id === setId ? setRecord : set; });
      } else {
        projectData[room].sets.push(setRecord);
      }

      projectData = FC.project.save(projectData);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

      closeCabinetModalSafe();
      renderCabinetsSafe();
    }catch(e){
      showCabinetInfo('Błąd przy dodawaniu zestawu', String(e && e.message ? e.message : e));
      throw e;
    }
  }

  ns.cabinetModalSetWizard = {
    openSetWizardForEdit,
    renderSetTiles,
    renderSetParamsUI,
    wireSetParamsLiveUpdate,
    renderSetWizardMode,
    isSetModeActive,
    handleTopSaveClick,
    getSetParamsFromUI,
    fillSetParamsUIFromSet,
    getNextSetNumber,
    createOrUpdateSetFromWizard,
  };
})();
