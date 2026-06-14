// js/app/investor/investor-carrying.js
// Panel danych wnoszenia przy inwestorze: piętro + winda. Bez natywnych selectów.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0); }
  function esc(value){ return text(value).replace(/[&<>"']/g, (ch)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch)); }
  function normalizeCarrying(input){
    try{ if(FC.carryingLogistics && typeof FC.carryingLogistics.normalizeCarrying === 'function') return FC.carryingLogistics.normalizeCarrying(input); }catch(_){ }
    const src = input && typeof input === 'object' ? input : {};
    const elevator = src.elevator && typeof src.elevator === 'object' ? src.elevator : {};
    return {
      floorNumber:text(src.floorNumber || ''),
      elevatorStatus:['yes','no'].includes(text(src.elevatorStatus)) ? text(src.elevatorStatus) : '',
      elevator:{
        doorWidthCm:text(elevator.doorWidthCm || ''), doorHeightCm:text(elevator.doorHeightCm || ''), cabinDepthCm:text(elevator.cabinDepthCm || ''), cabinHeightCm:text(elevator.cabinHeightCm || '')
      },
      note:text(src.note || '')
    };
  }
  function elevatorLabel(status){ return status === 'yes' ? 'Jest winda' : (status === 'no' ? 'Brak windy' : 'Nie ustawiono'); }
  function field(id, label, value, disabled){
    return `<label><span>${esc(label)}</span><input id="${esc(id)}" inputmode="decimal" value="${esc(value)}" ${disabled ? 'disabled aria-disabled="true"' : ''}/></label>`;
  }
  function renderPanel(inv, draft, isEditing){
    const source = isEditing ? (draft || {}) : (inv || {});
    const carrying = normalizeCarrying(source.carrying || {});
    const e = carrying.elevator || {};
    const hasElevator = carrying.elevatorStatus === 'yes';
    const disabled = !isEditing || !hasElevator;
    const floorLabel = carrying.floorNumber === '' ? '—' : `${Math.max(0, Math.floor(num(carrying.floorNumber, 0)))} piętro`;
    return `
      <details class="investor-carrying-accordion" open>
        <summary class="investor-carrying-accordion__summary">
          <span class="investor-carrying-accordion__title">Dostawa / wnoszenie</span>
          <span class="investor-carrying-accordion__sub">${esc(floorLabel)} • ${esc(elevatorLabel(carrying.elevatorStatus))}</span>
          <span class="investor-carrying-accordion__toggle" aria-hidden="true"></span>
        </summary>
        <div class="investor-carrying-accordion__body">
          <div class="investor-carrying-grid">
            <div><span>Piętro</span><strong>${esc(floorLabel)}</strong><small>parter = 0, do wyceny parter liczy się jako 1 poziom</small></div>
            <div><span>Winda</span><strong>${esc(elevatorLabel(carrying.elevatorStatus))}</strong><small>${hasElevator ? 'program sprawdzi drzwi i długość/głębokość windy' : 'korpusy liczone jak schody'}</small></div>
          </div>
          ${isEditing ? `
            <div class="investor-carrying-edit-grid">
              <label><span>Piętro / kondygnacja</span><input id="invCarryingFloorNumber" inputmode="numeric" value="${esc(carrying.floorNumber)}" /></label>
              <div class="investor-carrying-elevator-choice" role="group" aria-label="Winda">
                <span>Winda</span>
                <div class="investor-carrying-choice-buttons">
                  <button class="btn ${hasElevator ? 'btn-success is-active' : ''}" type="button" data-investor-carrying-elevator="yes">Jest winda</button>
                  <button class="btn ${carrying.elevatorStatus === 'no' ? 'btn-danger is-active' : ''}" type="button" data-investor-carrying-elevator="no">Brak windy</button>
                </div>
              </div>
              ${field('invCarryingDoorWidthCm', 'Drzwi windy — szerokość cm', e.doorWidthCm, disabled)}
              ${field('invCarryingDoorHeightCm', 'Drzwi windy — wysokość cm', e.doorHeightCm, disabled)}
              ${field('invCarryingCabinDepthCm', 'Winda — głębokość cm', e.cabinDepthCm, disabled)}
              ${field('invCarryingCabinHeightCm', 'Winda — wysokość cm', e.cabinHeightCm, disabled)}
              <label class="investor-carrying-note-field"><span>Notatka wnoszenia</span><textarea id="invCarryingNote">${esc(carrying.note)}</textarea></label>
            </div>` : `
            <div class="investor-carrying-meta">
              <div><strong>Drzwi windy:</strong> ${hasElevator ? `${esc(e.doorWidthCm || '—')} × ${esc(e.doorHeightCm || '—')} cm` : '—'}</div>
              <div><strong>Winda:</strong> ${hasElevator ? `głębokość ${esc(e.cabinDepthCm || '—')} cm • wysokość ${esc(e.cabinHeightCm || '—')} cm` : '—'}</div>
              ${carrying.note ? `<div><strong>Notatka:</strong> ${esc(carrying.note)}</div>` : ''}
            </div>`}
          <div class="investor-carrying-hint">WYCENA używa tych danych do automatu wnoszenia: korpus w całości albo — po rozkręceniu — tylko duże elementy, które nie weszły do windy.</div>
        </div>
      </details>`;
  }
  function bindPanel(rootEl, ctx){
    const rootNode = rootEl || document;
    const editorApi = ctx && ctx.editorApi;
    function setField(key, value){
      if(!(editorApi && editorApi.state && editorApi.state.isEditing && typeof editorApi.setCarryingField === 'function')) return;
      editorApi.setCarryingField(key, value);
      if(typeof ctx.onDirty === 'function') ctx.onDirty();
    }
    const ids = {
      invCarryingFloorNumber:'floorNumber', invCarryingDoorWidthCm:'doorWidthCm', invCarryingDoorHeightCm:'doorHeightCm', invCarryingCabinDepthCm:'cabinDepthCm', invCarryingCabinHeightCm:'cabinHeightCm', invCarryingNote:'note'
    };
    Object.keys(ids).forEach((id)=>{
      const node = rootNode.querySelector('#' + id);
      if(!node) return;
      node.addEventListener('input', ()=> setField(ids[id], node.value || ''));
      node.addEventListener('change', ()=> setField(ids[id], node.value || ''));
    });
    rootNode.querySelectorAll('[data-investor-carrying-elevator]').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const value = text(btn.getAttribute('data-investor-carrying-elevator')) === 'yes' ? 'yes' : 'no';
        setField('elevatorStatus', value);
        if(typeof ctx.render === 'function') ctx.render();
      });
    });
  }
  function getCurrentCarryingContext(){
    let investor = null;
    try{
      const api = FC.investorPersistence || {};
      const id = typeof api.getCurrentInvestorId === 'function' ? api.getCurrentInvestorId() : '';
      investor = id && typeof api.getInvestorById === 'function' ? api.getInvestorById(id) : null;
    }catch(_){ }
    return { investor, carrying:normalizeCarrying(investor && investor.carrying) };
  }
  FC.investorCarrying = { normalizeCarrying, renderPanel, bindPanel, getCurrentCarryingContext };
})();
