// js/tabs/wywiad.js
// Zakładka WYWIAD (lista szafek + szczegóły).

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    try{
      renderWywiadTab(ctx && ctx.listEl, ctx && ctx.room);
    }catch(_){ }
  }

  function renderWywiadTab(list, room){
    if(!list || !room || typeof projectData === 'undefined' || !projectData || !projectData[room]) return;
    const cabinets = projectData[room].cabinets || [];
    const renderedSets = new Set();

    list.innerHTML = '';

    cabinets.forEach((cab, idx) => {
      if(cab.setId && !renderedSets.has(cab.setId)){
        const setId = cab.setId;
        renderedSets.add(setId);
        const setCabs = cabinets.filter(c => c.setId === setId);
        setCabs.forEach((sc, jdx) => {
          renderSingleCabinetCard(list, room, sc, idx + jdx + 1);
        });
        return;
      }

      if(cab.setId && renderedSets.has(cab.setId)) return;

      renderSingleCabinetCard(list, room, cab, idx + 1);
    });
  }

  function callLegacy(fnName, args){
    try{
      const fn = window && window[fnName];
      if(typeof fn === 'function') return fn.apply(null, args || []);
    }catch(_){ }
  }

  function getFrontsForSetSafe(room, setId){
    const out = callLegacy('getFrontsForSet', [room, setId]);
    return Array.isArray(out) ? out : [];
  }

  function getFrontsForCabSafe(room, cabId){
    const out = callLegacy('getFrontsForCab', [room, cabId]);
    return Array.isArray(out) ? out : [];
  }

  function getCabinetExtraSummarySafe(room, cab){
    const out = callLegacy('getCabinetExtraSummary', [room, cab]);
    return out == null ? '' : String(out);
  }

  function renderSingleCabinetCard(list, room, cab, displayIndex){
    const cabEl = document.createElement('div');
    cabEl.className = 'cabinet cabinet-card-shell';
    cabEl.id = `cab-${cab.id}`;
    if(typeof uiState !== 'undefined' && uiState && uiState.selectedCabinetId === cab.id) cabEl.classList.add('selected');

    const header = document.createElement('div');
    header.className = 'cabinet-header cabinet-header--stacked cabinet-card-shell__header';

    const badge = cab.setId && typeof cab.setNumber === 'number'
      ? `<span class="badge">Zestaw ${cab.setNumber}</span>`
      : '';
    const bodyMeta = [cab.bodyColor || '', cab.backMaterial || ''].filter(Boolean).join(' • ') || '—';
    const frontMeta = [cab.frontMaterial || '', cab.frontColor || ''].filter(Boolean).join(' • ') || '—';
    const copy = document.createElement('div');
    copy.className = 'cabinet-header__copy cabinet-card-shell__copy';
    copy.innerHTML = `
      <div class="cabinet-header__title">#${displayIndex} • ${cab.type} • ${cab.subType || ''}${badge}</div>
      <div class="cabinet-header__meta">Korpus: ${bodyMeta}</div>
      <div class="cabinet-header__meta">Front: ${frontMeta}</div>
      <div class="cabinet-header__meta">${cab.width} × ${cab.height} × ${cab.depth}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'cab-actions cabinet-header__actions cabinet-card-shell__actions';
    actions.innerHTML = `<button class="btn" data-act="edit" type="button">Edytuj</button> <button class="btn" data-act="mat" type="button">Materiały</button> <button class="btn btn-danger" data-act="del" type="button">Usuń</button>`;

    header.appendChild(copy);
    header.appendChild(actions);
    cabEl.appendChild(header);
    cabEl.setAttribute('data-cabinet-kind', String(cab.type || ''));

    actions.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if(!btn) return;
      const act = btn.getAttribute('data-act');
      if(act === 'edit'){
        callLegacy('openCabinetModalForEdit', [cab.id]);
        return;
      }
      if(act === 'mat'){
        callLegacy('jumpToMaterialsForCabinet', [cab.id]);
        return;
      }
      if(act === 'del'){
        callLegacy('deleteCabinetById', [cab.id]);
        return;
      }
    });

    if(typeof uiState !== 'undefined' && uiState && uiState.expanded && uiState.expanded[cab.id]){
      const body = document.createElement('div');
      body.className = 'cabinet-body';

      const summary = getCabinetExtraSummarySafe(room, cab);

      const ro = document.createElement('div');
      ro.className = 'ro-grid';
      ro.innerHTML = `
        <div class="ro-box"><div class="muted xs">Rodzaj</div><div class="ro-val">${cab.type || ''}</div></div>
        <div class="ro-box"><div class="muted xs">Wariant</div><div class="ro-val">${cab.subType || ''}</div></div>
        <div class="ro-box"><div class="muted xs">Szczegóły</div><div class="ro-val">${summary || '—'}</div></div>

        <div class="ro-box"><div class="muted xs">Wymiary</div><div class="ro-val">${cab.width} × ${cab.height} × ${cab.depth}</div></div>
        <div class="ro-box"><div class="muted xs">Front</div><div class="ro-val">${cab.frontMaterial || ''}</div><div class="muted xs">${cab.frontColor || ''}</div></div>
        <div class="ro-box"><div class="muted xs">Korpus / Plecy</div><div class="ro-val">${cab.bodyColor || ''}</div><div class="muted xs">${cab.backMaterial || ''}</div></div>

        <div class="ro-box"><div class="muted xs">Otwieranie</div><div class="ro-val">${cab.openingSystem || ''}</div></div>
      `;
      body.appendChild(ro);

      const frontsForThis = cab.setId ? getFrontsForSetSafe(room, cab.setId) : getFrontsForCabSafe(room, cab.id);
      if(frontsForThis && frontsForThis.length){
        const fb = document.createElement('div');
        fb.className = 'front-block';
        const title = cab.setId
          ? `Fronty zestawu <span class="badge">Zestaw ${cab.setNumber}</span>`
          : 'Fronty szafki';
        fb.innerHTML = `
          <div class="head">
            <div>${title}</div>
            <div class="front-meta">${frontsForThis.length} szt.</div>
          </div>
        `;
        frontsForThis.forEach((f) => {
          const row = document.createElement('div');
          row.className = 'front-row';
          row.innerHTML = `
            <div>
              <div style="font-weight:900">Front: ${f.width} × ${f.height}</div>
              <div class="front-meta">${(f.material || '')}${(f.color ? ' • ' + f.color : '')}${(f.note ? ' • ' + f.note : '')}</div>
            </div>
            <div style="font-weight:900">${Number(f.width) || 0}×${Number(f.height) || 0}</div>
          `;
          fb.appendChild(row);
        });
        body.appendChild(fb);
      }

      const hint = document.createElement('div');
      hint.className = 'muted xs';
      hint.style.marginTop = '10px';
      hint.style.padding = '10px';
      hint.style.border = '1px solid #eef6fb';
      hint.style.borderRadius = '10px';
      hint.style.background = '#fbfdff';
      hint.textContent = 'Edycja tylko przez przycisk „Edytuj”.';
      body.appendChild(hint);

      cabEl.appendChild(body);
    }

    header.addEventListener('click', (e) => {
      if(e.target && e.target.closest && e.target.closest('button')) return;

      if(typeof uiState !== 'undefined' && uiState && uiState.activeTab === 'wywiad'){
        uiState.selectedCabinetId = (uiState.selectedCabinetId === cab.id) ? null : cab.id;
      }
      callLegacy('toggleExpandAll', [cab.id]);
      try{
        if(window.FC && window.FC.storage && typeof window.FC.storage.setJSON === 'function'){
          window.FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        }
      }catch(_){ }
      callLegacy('renderCabinets', []);
    });

    list.appendChild(cabEl);
  }

  window.FC.tabsWywiad = {
    renderWywiadTab,
    renderSingleCabinetCard,
  };

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('wywiad', { mount(){}, render, unmount(){} });
})();
