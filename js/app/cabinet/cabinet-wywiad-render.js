(function(){
  'use strict';
  window.FC = window.FC || {};
  const ns = window.FC.cabinetWywiadRender = window.FC.cabinetWywiadRender || {};

  function getUiState(ctx){
    try{
      if(ctx && typeof ctx.getUiState === 'function') return ctx.getUiState() || {};
    }catch(_){ }
    return {};
  }

  function persistUiState(ctx, nextState){
    try{
      if(ctx && typeof ctx.persistUiState === 'function') return ctx.persistUiState(nextState) || nextState;
    }catch(_){ }
    return nextState;
  }

  function renderSingleCabinetCard(ctx, cab, displayIndex){
    const list = ctx && ctx.listEl;
    const room = ctx && ctx.room;
    if(!list || !cab) return;
    const uiState = getUiState(ctx);
    const doc = (ctx && ctx.document) || (list && list.ownerDocument) || document;

    const cabEl = doc.createElement('div');
    cabEl.className = 'cabinet cabinet-card-shell';
    cabEl.id = `cab-${cab.id}`;
    if(uiState.selectedCabinetId === cab.id) cabEl.classList.add('selected');

    const header = doc.createElement('div');
    header.className = 'cabinet-header cabinet-header--stacked cabinet-card-shell__header';

    const badge = cab.setId && typeof cab.setNumber === 'number'
      ? `<span class="badge">Zestaw ${cab.setNumber}</span>`
      : '';
    const bodyMeta = [cab.bodyColor || '', cab.backMaterial || ''].filter(Boolean).join(' • ') || '—';
    const frontMeta = [cab.frontMaterial || '', cab.frontColor || ''].filter(Boolean).join(' • ') || '—';
    const copy = doc.createElement('div');
    copy.className = 'cabinet-header__copy cabinet-card-shell__copy';
    copy.innerHTML = `
      <div class="cabinet-header__title">#${displayIndex} • ${cab.type} • ${cab.subType||''}${badge}</div>
      <div class="cabinet-header__meta">Korpus: ${bodyMeta}</div>
      <div class="cabinet-header__meta">Front: ${frontMeta}</div>
      <div class="cabinet-header__meta">${cab.width} × ${cab.height} × ${cab.depth}</div>
    `;

    const actions = doc.createElement('div');
    actions.className = 'cab-actions cabinet-header__actions cabinet-card-shell__actions';
    actions.innerHTML = '<button class="btn" data-act="edit" type="button">Edytuj</button> <button class="btn" data-act="mat" type="button">Materiały</button> <button class="btn btn-danger" data-act="del" type="button">Usuń</button>';

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
        if(ctx && typeof ctx.openCabinetModalForEdit === 'function') ctx.openCabinetModalForEdit(cab.id);
        return;
      }
      if(act === 'mat'){
        if(ctx && typeof ctx.jumpToMaterialsForCabinet === 'function') ctx.jumpToMaterialsForCabinet(cab.id);
        return;
      }
      if(act === 'del'){
        if(ctx && typeof ctx.deleteCabinetById === 'function') ctx.deleteCabinetById(cab.id);
        return;
      }
    });

    if(uiState.expanded && uiState.expanded[cab.id]){
      const body = doc.createElement('div');
      body.className = 'cabinet-body';

      const summary = ctx && typeof ctx.getCabinetExtraSummary === 'function' ? ctx.getCabinetExtraSummary(room, cab) : '';

      const ro = doc.createElement('div');
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

      const frontsForThis = cab.setId
        ? (ctx && typeof ctx.getFrontsForSet === 'function' ? ctx.getFrontsForSet(room, cab.setId) : [])
        : (ctx && typeof ctx.getFrontsForCab === 'function' ? ctx.getFrontsForCab(room, cab.id) : []);
      if(frontsForThis && frontsForThis.length){
        const fb = doc.createElement('div');
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
          const row = doc.createElement('div');
          row.className = 'front-row';
          row.innerHTML = `
            <div>
              <div style="font-weight:900">Front: ${f.width} × ${f.height}</div>
              <div class="front-meta">${(f.material||'')}${(f.color ? ' • ' + f.color : '')}${(f.note ? ' • ' + f.note : '')}</div>
            </div>
            <div style="font-weight:900">${Number(f.width)||0}×${Number(f.height)||0}</div>
          `;
          fb.appendChild(row);
        });
        body.appendChild(fb);
      }

      const hint = doc.createElement('div');
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
      const nextState = getUiState(ctx);
      if(nextState && String(nextState.activeTab || '') === 'wywiad'){
        nextState.selectedCabinetId = (nextState.selectedCabinetId === cab.id) ? null : cab.id;
        persistUiState(ctx, nextState);
      }
      if(ctx && typeof ctx.toggleExpandAll === 'function') ctx.toggleExpandAll(cab.id);
      else if(ctx && typeof ctx.renderCabinets === 'function') ctx.renderCabinets();
    });

    list.appendChild(cabEl);
  }

  function renderWywiadTab(ctx){
    const list = ctx && ctx.listEl;
    const room = ctx && ctx.room;
    const projectData = (ctx && ctx.projectData) || window.projectData || {};
    if(!list || !room || !projectData[room]) return;

    const cabinets = projectData[room].cabinets || [];
    const renderedSets = new Set();
    list.innerHTML = '';

    cabinets.forEach((cab, idx) => {
      if(cab.setId && !renderedSets.has(cab.setId)){
        const setId = cab.setId;
        renderedSets.add(setId);
        const setCabs = cabinets.filter((c) => c.setId === setId);
        setCabs.forEach((sc, jdx) => {
          renderSingleCabinetCard(ctx, sc, idx + jdx + 1);
        });
        return;
      }
      if(cab.setId && renderedSets.has(cab.setId)) return;
      renderSingleCabinetCard(ctx, cab, idx + 1);
    });
  }

  ns.renderWywiadTab = renderWywiadTab;
})();
