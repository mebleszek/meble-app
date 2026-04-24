// js/tabs/material.js
// Zakładka MATERIAŁ — rozpiska elementów.

(function(){
  'use strict';
  window.FC = window.FC || {};
  window.FC.tabsMaterial = window.FC.tabsMaterial || {};

  function fallbackFmtCm(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '0';
    const s = (Math.round(n * 10) / 10).toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  function getMaterialModel(room){
    const dataApi = window.FC && window.FC.materialTabData;
    const edgeApi = window.FC && window.FC.materialEdgeStore && typeof window.FC.materialEdgeStore.createEdgeStore === 'function'
      ? window.FC.materialEdgeStore.createEdgeStore()
      : null;
    if(dataApi && typeof dataApi.collectRoomMaterials === 'function'){
      return dataApi.collectRoomMaterials(room, { edgeApi });
    }
    const common = (window.FC && window.FC.materialCommon) || {};
    const hw = (window.FC && window.FC.frontHardware) || {};
    const cabinets = ((typeof projectData !== 'undefined') && projectData && projectData[room] && Array.isArray(projectData[room].cabinets)) ? projectData[room].cabinets : [];
    const getCabinetCutListFn = (typeof getCabinetCutList === 'function') ? getCabinetCutList : function(){ return []; };
    const totalsFromPartsFn = (typeof totalsFromParts === 'function') ? totalsFromParts : ((typeof common.totalsFromParts === 'function') ? common.totalsFromParts : function(){ return {}; });
    const mergeTotalsFn = (typeof mergeTotals === 'function') ? mergeTotals : ((typeof common.mergeTotals === 'function') ? common.mergeTotals : function(dst, src){ Object.keys(src || {}).forEach((k)=>{ dst[k] = (Number(dst[k]) || 0) + (Number(src[k]) || 0); }); return dst; });
    const renderTotalsFn = (typeof renderTotals === 'function') ? renderTotals : ((typeof common.renderTotals === 'function') ? common.renderTotals : function(container){ if(container) container.innerHTML = ''; });
    const getAssemblyRuleTextFn = (typeof getCabinetAssemblyRuleText === 'function') ? getCabinetAssemblyRuleText : ((typeof common.getCabinetAssemblyRuleText === 'function') ? common.getCabinetAssemblyRuleText : function(){ return 'Skręcanie: —'; });
    const projectTotals = {};
    const cabinetRows = cabinets.map((cabinet, index)=>{
      const parts = getCabinetCutListFn(cabinet, room) || [];
      const totals = totalsFromPartsFn(parts);
      mergeTotalsFn(projectTotals, totals);
      return { cabinet, index, badge: cabinet && cabinet.setId && typeof cabinet.setNumber === 'number' ? `<span class="badge">Zestaw ${cabinet.setNumber}</span>` : '', parts, totals, edgeMeters:0 };
    });
    return {
      room,
      cabinets,
      cabinetRows,
      projectTotals,
      projectEdgeMeters:0,
      edgeApi,
      fmtCm:fallbackFmtCm,
      deps:{
        renderTotalsFn,
        totalsFromPartsFn,
        getAssemblyRuleTextFn,
        handleWeightKg: (typeof window.FC_HANDLE_WEIGHT_KG !== 'undefined') ? window.FC_HANDLE_WEIGHT_KG : (Number(hw.FC_HANDLE_WEIGHT_KG) || 0),
        frontWeights: (window.FC_FRONT_WEIGHT_KG_M2 && typeof window.FC_FRONT_WEIGHT_KG_M2 === 'object') ? window.FC_FRONT_WEIGHT_KG_M2 : (hw.FC_FRONT_WEIGHT_KG_M2 || { laminat:0, akryl:0, lakier:0 }),
      },
    };
  }

  function renderMaterialsTab(listEl, room){
    const model = getMaterialModel(room);
    const cabinets = model.cabinets || [];
    const cabinetRows = model.cabinetRows || [];
    const deps = model.deps || {};
    const fmtCm = typeof model.fmtCm === 'function' ? model.fmtCm : fallbackFmtCm;
    const edgeApi = model.edgeApi || null;
    const renderTotalsFn = typeof deps.renderTotalsFn === 'function' ? deps.renderTotalsFn : function(container){ if(container) container.innerHTML = ''; };
    const totalsFromPartsFn = typeof deps.totalsFromPartsFn === 'function' ? deps.totalsFromPartsFn : function(){ return {}; };
    const getAssemblyRuleTextFn = typeof deps.getAssemblyRuleTextFn === 'function' ? deps.getAssemblyRuleTextFn : function(){ return 'Skręcanie: —'; };
    const handleWeightKg = Number(deps.handleWeightKg) || 0;
    const frontWeights = deps.frontWeights || { laminat:0, akryl:0, lakier:0 };

    const top = document.createElement('div');
    top.className = 'card';
    top.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h3 style="margin:0">Materiały — rozpiska mebli</h3>
  </div>
      <p class="muted" style="margin:6px 0 0">
        Poniżej jest rozpisany każdy dodany mebel (korpus). Wymiary są liczone "na czysto" z założeniem płyty 18&nbsp;mm.
        Nie uwzględnia to oklein, wpustów pod plecy ani luzów technologicznych.
      </p>

      <div class="hr"></div>
      <div class="muted xs" style="line-height:1.55">
        <div><strong>Zasady skręcania:</strong></div>
        <div>• Wiszące: wieniec górny i dolny między boki.</div>
        <div>• Modułowe: jak wiszące.</div>
        <div>• Stojące: wieniec dolny pod boki (boki niższe o ${FC_BOARD_THICKNESS_CM} cm); trawersy górne: głębokość ${FC_TOP_TRAVERSE_DEPTH_CM} cm.</div>
      </div>

      <div class="hr"></div>
      <div>
        <div class="muted xs" style="font-weight:900; margin-bottom:6px">Suma m² materiałów — cały projekt</div>
        <div id="projectMatTotals"></div>
        <div class="hr"></div>
        <div class="muted xs" style="font-weight:900; margin-bottom:6px">Okleiny — suma mb</div>
        <div id="projectEdgeTotals" class="muted xs"></div>
        <div class="muted xs" style="margin-top:8px;line-height:1.45">
          <div><strong>Założenia do obliczeń zawiasów/podnośników (waga frontów):</strong></div>
          <div>• Laminat 18&nbsp;mm: <span id="wLam"></span> kg/m²</div>
          <div>• Akryl (MDF 18&nbsp;mm): <span id="wAkr"></span> kg/m²</div>
          <div>• Lakier (MDF 18&nbsp;mm): <span id="wLak"></span> kg/m²</div>
          <div>• Uchwyt (zawiasy): ${handleWeightKg} kg / front; (podnośniki klap): ${handleWeightKg*2} kg / klapa</div>
          <div style="font-size:12px;color:#5b6b7c;margin-top:6px">Uchwyty doliczane tylko gdy wybrany system z uchwytem (TIP-ON/podchwyt = 0 kg).</div>
        </div>
      </div>
    `;
    listEl.appendChild(top);

    const projTotalsEl = top.querySelector('#projectMatTotals');
    if(projTotalsEl) renderTotalsFn(projTotalsEl, model.projectTotals || {});

    const projEdgeEl = top.querySelector('#projectEdgeTotals');
    if(projEdgeEl){
      projEdgeEl.textContent = `${(Number(model.projectEdgeMeters)||0).toFixed(2)} mb`;
    }

    const wLamEl = top.querySelector('#wLam');
    const wAkrEl = top.querySelector('#wAkr');
    const wLakEl = top.querySelector('#wLak');
    if(wLamEl) wLamEl.textContent = String(frontWeights.laminat);
    if(wAkrEl) wAkrEl.textContent = String(frontWeights.akryl);
    if(wLakEl) wLakEl.textContent = String(frontWeights.lakier);

    if(!cabinets.length){
      const empty = document.createElement('div');
      empty.className = 'build-card';
      empty.innerHTML = '<h3>Brak mebli</h3><p class="muted">Dodaj szafki, żeby pojawiła się rozpiska materiałów.</p>';
      listEl.appendChild(empty);
      return;
    }

    cabinetRows.forEach((entry) => {
      const cab = entry.cabinet || {};
      const idx = Number(entry.index) || 0;
      const card = document.createElement('div');
      card.className = 'card';
      card.id = `mat-${cab.id}`;

      const head = document.createElement('div');
      head.className = 'mat-cab-head';
      head.style.display = 'flex';
      head.style.justifyContent = 'space-between';
      head.style.alignItems = 'baseline';
      head.style.gap = '12px';
      head.style.flexWrap = 'wrap';
      head.innerHTML = `
        <div>
          <div style="font-weight:900">#${idx+1} • ${cab.type || ''} • ${cab.subType || ''} ${entry.badge || ''}</div>
          <div class="muted xs">${cab.width} × ${cab.height} × ${cab.depth} • korpus: ${cab.bodyColor || ''} • plecy: ${cab.backMaterial || ''}</div>
        </div>
        <div class="mat-head-right" style="display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;min-width:0;max-width:100%">
          <div class="muted xs mat-assembly" style="white-space:normal;max-width:100%;flex:1 1 260px;min-width:180px">${getAssemblyRuleTextFn(cab)}</div>
          <button class="btn" type="button" data-act="editCab" data-cab="${cab.id}">Edytuj</button>
          <button class="btn" type="button" data-act="jumpCab" data-cab="${cab.id}">← Szafka</button>
        </div>
      `;
      card.appendChild(head);

      const isOpen = String(uiState.matExpandedId || '') === String(cab.id);
      if(isOpen) card.classList.add('selected');

      head.style.cursor = 'pointer';
      head.addEventListener('click', (e) => {
        if(e && e.target && e.target.closest && e.target.closest('button')) return;
        const nowOpen = String(uiState.matExpandedId || '') === String(cab.id);
        uiState.matExpandedId = nowOpen ? null : String(cab.id);
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        renderCabinets();
      });

      const editCabBtn = head.querySelector('[data-act="editCab"]');
      if(editCabBtn){
        editCabBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          openCabinetModalForEdit(editCabBtn.getAttribute('data-cab'));
        });
      }

      const jumpCabBtn = head.querySelector('[data-act="jumpCab"]');
      if(jumpCabBtn){
        jumpCabBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          jumpToCabinetFromMaterials(jumpCabBtn.getAttribute('data-cab'));
        });
      }

      if(!isOpen){
        const collapsedHint = document.createElement('div');
        collapsedHint.className = 'muted xs';
        collapsedHint.style.marginTop = '10px';
        collapsedHint.textContent = 'Kliknij nagłówek, aby rozwinąć rozpis materiałów tej szafki.';
        card.appendChild(collapsedHint);
        listEl.appendChild(card);
        return;
      }

      const parts = entry.parts || [];
      const cabEdgeMeters = Number(entry.edgeMeters) || 0;

      const cabTotalsBox = document.createElement('div');
      cabTotalsBox.style.marginTop = '10px';
      cabTotalsBox.style.paddingTop = '10px';
      cabTotalsBox.style.borderTop = '1px solid #eef6fb';
      cabTotalsBox.innerHTML = `<div class="muted xs" style="font-weight:900; margin-bottom:6px">Suma m² materiałów — ta szafka</div>`;
      const cabTotalsEl = document.createElement('div');
      cabTotalsBox.appendChild(cabTotalsEl);
      card.appendChild(cabTotalsBox);
      renderTotalsFn(cabTotalsEl, entry.totals || totalsFromPartsFn(parts));

      const cabEdgeBox = document.createElement('div');
      cabEdgeBox.className = 'muted xs';
      cabEdgeBox.style.marginTop = '6px';
      cabEdgeBox.textContent = `Okleina: ${cabEdgeMeters.toFixed(2)} mb`;
      cabTotalsBox.appendChild(cabEdgeBox);

      const table = document.createElement('div');
      table.style.marginTop = '12px';
      table.style.border = '1px solid #eef6fb';
      table.style.borderRadius = '12px';
      table.style.overflow = 'hidden';

      const tHead = document.createElement('div');
      tHead.className = 'front-row';
      tHead.style.background = '#f8fbff';
      tHead.innerHTML = `
        <div style="font-weight:900">Element</div>
        <div class="front-meta">Ilość</div>
        <div class="front-meta">Wymiar (cm)</div>
        <div class="front-meta">Materiał</div>
        <div class="front-meta">Okleina / opcje</div>
      `;
      tHead.style.display = 'grid';
      tHead.style.gridTemplateColumns = '1.15fr 0.35fr 0.70fr 0.90fr 1.30fr';
      tHead.style.gap = '10px';
      table.appendChild(tHead);

      parts.forEach(p => {
        const row = document.createElement('div');
        row.className = 'front-row';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1.15fr 0.35fr 0.70fr 0.90fr 1.30fr';
        row.style.gap = '10px';

        if(p.tone === 'red'){
          row.style.background = '#ffe1e1';
          row.style.borderLeft = '6px solid #d33';
        }else if(p.tone === 'orange'){
          row.style.background = '#fff0d6';
          row.style.borderLeft = '6px solid #f0a000';
        }

        const isBoard = (Number(p.a)>0 && Number(p.b)>0);
        const sig = isBoard && edgeApi && typeof edgeApi.signatureFromPart === 'function'
          ? edgeApi.signatureFromPart(p)
          : (isBoard && window.FC && FC.materialEdgeStore && typeof FC.materialEdgeStore.signatureFromPart === 'function' ? FC.materialEdgeStore.signatureFromPart(p) : null);
        const e = (sig && edgeApi && typeof edgeApi.getEdges === 'function') ? edgeApi.getEdges(sig, p, cab) : {w1:false,w2:false,h1:false,h2:false};
        const dirLabel = sig && edgeApi && typeof edgeApi.labelForDirection === 'function' ? edgeApi.labelForDirection(sig) : 'Domyślny z materiału';

        row.innerHTML = `
          <div style="font-weight:900">${p.name}</div>
          <div style="font-weight:900">${p.qty}</div>
          <div style="font-weight:900;text-align:center;line-height:1.05">
            <div>${fmtCm(p.a)}</div>
            <div style="font-weight:900">×</div>
            <div>${fmtCm(p.b)}</div>
          </div>
          <div class="front-meta">${p.material || ''}</div>
          <div class="front-meta" style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
            ${isBoard ? `
              <div class="material-row-tools">
                <div class="material-row-tools__edges">
                  <label style="display:flex;align-items:flex-start;gap:6px;margin:0;font-weight:800;font-size:12px;color:#334155">
                    <input type="checkbox" data-edge="w1" ${e.w1?'checked':''} data-sig="${sig}" />
                    <span style="display:flex;flex-direction:column;line-height:1.05">
                      <span style="white-space:nowrap">${fmtCm(p.a)} cm</span>
                      <span class="muted" style="font-size:11px;font-weight:900">1A</span>
                    </span>
                  </label>
                  <label style="display:flex;align-items:flex-start;gap:6px;margin:0;font-weight:800;font-size:12px;color:#334155">
                    <input type="checkbox" data-edge="w2" ${e.w2?'checked':''} data-sig="${sig}" />
                    <span style="display:flex;flex-direction:column;line-height:1.05">
                      <span style="white-space:nowrap">${fmtCm(p.a)} cm</span>
                      <span class="muted" style="font-size:11px;font-weight:900">1B</span>
                    </span>
                  </label>
                  <label style="display:flex;align-items:flex-start;gap:6px;margin:0;font-weight:800;font-size:12px;color:#334155">
                    <input type="checkbox" data-edge="h1" ${e.h1?'checked':''} data-sig="${sig}" />
                    <span style="display:flex;flex-direction:column;line-height:1.05">
                      <span style="white-space:nowrap">${fmtCm(p.b)} cm</span>
                      <span class="muted" style="font-size:11px;font-weight:900">2A</span>
                    </span>
                  </label>
                  <label style="display:flex;align-items:flex-start;gap:6px;margin:0;font-weight:800;font-size:12px;color:#334155">
                    <input type="checkbox" data-edge="h2" ${e.h2?'checked':''} data-sig="${sig}" />
                    <span style="display:flex;flex-direction:column;line-height:1.05">
                      <span style="white-space:nowrap">${fmtCm(p.b)} cm</span>
                      <span class="muted" style="font-size:11px;font-weight:900">2B</span>
                    </span>
                  </label>
                </div>
                <div class="material-row-tools__opts">
                  <button class="btn material-row-tools__opts-btn" type="button" data-part-options="${sig}">Opcje</button>
                  <div class="muted xs material-row-tools__opts-meta">Słój: ${dirLabel}</div>
                </div>
              </div>
            ` : `<span class="muted xs">—</span>`}
          </div>
        `;
        table.appendChild(row);

        if(isBoard && edgeApi){
          row.querySelectorAll('input[type="checkbox"][data-edge]').forEach(ch => {
            ch.addEventListener('change', ()=>{
              const sig2 = ch.getAttribute('data-sig');
              const edge = ch.getAttribute('data-edge');
              if(!sig2 || !edge || !(typeof edgeApi.setEdges === 'function')) return;
              edgeApi.setEdges(sig2, { [edge]: !!ch.checked });
              renderCabinets();
            });
          });
          const optsBtn = row.querySelector('[data-part-options]');
          if(optsBtn){
            optsBtn.addEventListener('click', ()=> {
              if(edgeApi && typeof edgeApi.openPartOptions === 'function'){
                edgeApi.openPartOptions(p, sig, {
                  cabinetId:cab.id,
                  selectedCabinetId:(typeof uiState !== 'undefined' && uiState ? uiState.selectedCabinetId : ''),
                  fmtCm,
                  onSave:()=> renderCabinets(),
                });
              }
            });
          }
        }
      });

      card.appendChild(table);
      listEl.appendChild(card);
    });
  }

  function render(ctx){
    const list = ctx && ctx.listEl;
    const room = ctx && ctx.room;
    if(!list || !room) return;

    try{
      renderMaterialsTab(list, room);
      return;
    }catch(e){
      try{ console.error('[material] render error', e); }catch(_){ }
      try{
        list.innerHTML = '<div class="build-card"><h3>Materiał</h3><p class="muted">Błąd renderu zakładki. Sprawdź konsolę.</p></div>';
      }catch(_){ }
    }

    try{
      if(typeof window.renderMaterialsTab === 'function') window.renderMaterialsTab(list, room);
    }catch(_){ }
  }

  function registerWithRetry(tries){
    tries = tries || 0;
    const reg = (window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.register === 'function')
      ? window.FC.tabsRouter.register
      : ((window.FC.tabs && typeof window.FC.tabs.register === 'function') ? window.FC.tabs.register : null);

    if(typeof reg === 'function'){
      reg('material', { mount(){}, render, unmount(){} });
      return;
    }

    if(tries < 30){
      setTimeout(()=>registerWithRetry(tries+1), 25);
    }
  }

  window.FC.tabsMaterial.renderMaterialsTab = renderMaterialsTab;
  registerWithRetry(0);
})();
