// js/app/inwestor.js
// UI dla zakładki INWESTOR + lista inwestorów (widok z Home).
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function $(id){ return document.getElementById(id); }
  function esc(s){ return (FC.utils && FC.utils.escapeHTML) ? FC.utils.escapeHTML(String(s||'')) : String(s||''); }

  const STATUS_OPTIONS = [
    { value:'nowy', label:'Nowy (lead)' },
    { value:'wstepna', label:'Wstępna wycena (orientacyjnie)' },
    { value:'wycena', label:'Wycena (szczegółowa)' },
    { value:'umowa', label:'Umowa' },
    { value:'produkcja', label:'Produkcja' },
    { value:'montaz', label:'Montaż' },
    { value:'zakonczone', label:'Zakończone' },
    { value:'odrzucone', label:'Odrzucone' },
  ];

  const ROOM_LABELS = {
    kuchnia: 'Kuchnia',
    szafa: 'Szafa',
    pokoj: 'Pokój',
    lazienka: 'Łazienka',
    inne: 'Inne'
  };

  function getProjectSafe(){
    try{
      return (typeof project !== 'undefined' && project) ? project : null;
    }catch(_){ return null; }
  }

  function ensureProjectMeta(){
    const p = getProjectSafe();
    if(!p) return;
    if(!p.meta) p.meta = {};
    if(!('assignedInvestorId' in p.meta)) p.meta.assignedInvestorId = null;
  }

  function setCurrentInvestorId(id){
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ currentInvestorId: id });
    }else{
      // fallback
      try{ window.uiState.currentInvestorId = id; }catch(_){}
    }
  }

  function getCurrentInvestorId(){
    try{
      if(typeof uiState !== 'undefined' && uiState && uiState.currentInvestorId) return uiState.currentInvestorId;
    }catch(_){}
    if(FC.uiState && FC.uiState.get){
      const st = FC.uiState.get();
      return st && st.currentInvestorId ? st.currentInvestorId : null;
    }
    return null;
  }

  function buildInput(label, id, value, placeholder){
    return `
      <div>
        <label>${esc(label)}</label>
        <input id="${esc(id)}" value="${esc(value||'')}" placeholder="${esc(placeholder||'')}" />
      </div>
    `;
  }

  function renderInvestorForm(inv){
    const kindOsoba = inv.kind !== 'firma';
    const statusOptions = STATUS_OPTIONS.map(o => `<option value="${o.value}" ${inv.status===o.value?'selected':''}>${esc(o.label)}</option>`).join('');
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">Inwestor</h2>
            <p class="muted" style="margin:4px 0 0">Dane zapisują się lokalnie w przeglądarce</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn" data-action="open-investors-list">Lista inwestorów</button>
            <button class="btn" data-action="new-investor">+ Nowy</button>
          </div>
        </div>

        <div class="hr"></div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer">
            <input type="radio" name="invKind" value="osoba" ${kindOsoba?'checked':''} data-action="inv-kind" />
            <span>Osoba</span>
          </label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer">
            <input type="radio" name="invKind" value="firma" ${!kindOsoba?'checked':''} data-action="inv-kind" />
            <span>Firma</span>
          </label>
        </div>

        <div class="grid-3" style="margin-top:12px">
          ${buildInput('Nazwa / Imię i nazwisko','invName',inv.name,'np. Jan Kowalski / Kowalski Sp. z o.o.')}
          ${buildInput('Telefon','invPhone',inv.phone,'np. 600 000 000')}
          ${buildInput('E-mail','invEmail',inv.email,'')}
        </div>

        <div class="grid-3" style="margin-top:12px">
          ${buildInput('Adres / miejscowość','invAddress',inv.address,'')}
          ${buildInput('Źródło','invSource',inv.source,'polecenie / OLX / FB / inne')}
          <div>
            <label>Status</label>
            <select id="invStatus">${statusOptions}</select>
          </div>
        </div>

        <div style="margin-top:12px">
          <label>Notatki</label>
          <textarea id="invNotes" rows="4" placeholder="Ustalenia, preferencje, terminy...">${esc(inv.notes||'')}</textarea>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn-primary" data-action="assign-investor">Przypisz inwestora do projektu</button>
          <button class="btn" data-action="delete-investor" data-id="${esc(inv.id)}">Usuń</button>
        </div>
      </div>
    `;
  }

  function roomHasData(room){
    if(!room) return false;
    const c = Array.isArray(room.cabinets) ? room.cabinets.length : 0;
    const f = Array.isArray(room.fronts) ? room.fronts.length : 0;
    const s = Array.isArray(room.sets) ? room.sets.length : 0;
    return (c+f+s) > 0;
  }

  function renderInvestorRooms(inv){
    const p = getProjectSafe();
    const assignedId = (p && p.meta && p.meta.assignedInvestorId) ? p.meta.assignedInvestorId : null;
    const isAssigned = assignedId && inv && inv.id && assignedId === inv.id;

    const rooms = ['kuchnia','szafa','pokoj','lazienka','inne'].map(rt => {
      const room = p ? p[rt] : null;
      const has = roomHasData(room);
      const badge = has ? '<span class="muted xs" style="margin-left:8px">ma dane</span>' : '<span class="muted xs" style="margin-left:8px">pusto</span>';
      return `
        <div class="room-btn" data-room="${esc(rt)}" data-action="open-room" style="cursor:pointer">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:22px">🏠</div>
            <div style="display:flex;flex-direction:column;align-items:flex-start">
              <span>${esc(ROOM_LABELS[rt] || rt)}</span>
              ${badge}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">Szybki dostęp do pomieszczeń</h3>
            <p class="muted" style="margin:4px 0 0">Kliknij, aby przejść do pomieszczenia i pracować dalej (WYWIAD/RYSUNEK/MATERIAŁ...)</p>
          </div>
          <div class="muted xs">${isAssigned ? 'Ten inwestor jest przypisany do projektu ✅' : 'Ten inwestor nie jest przypisany do projektu'}</div>
        </div>
        <div class="rooms" style="margin-top:12px">
          ${rooms}
        </div>
      </div>
    `;
  }

  function renderInvestor(){
    const root = $('investorRoot');
    if(!root) return;

    ensureProjectMeta();

    const id = getCurrentInvestorId();
    let inv = id ? (FC.investors ? FC.investors.getById(id) : null) : null;
    if(!inv){
      // if project has assigned investor, use it
      const p = getProjectSafe();
      const assigned = (p && p.meta && p.meta.assignedInvestorId) ? p.meta.assignedInvestorId : null;
      if(assigned && FC.investors) inv = FC.investors.getById(assigned);
      if(inv){
        setCurrentInvestorId(inv.id);
      }else{
        // create a new blank investor for convenience
        inv = FC.investors ? FC.investors.upsert({ name:'', status:'nowy', kind:'osoba' }) : { id:'', kind:'osoba', status:'nowy' };
        setCurrentInvestorId(inv.id);
      }
    }

    root.innerHTML = renderInvestorForm(inv) + renderInvestorRooms(inv);
  }

  function renderInvestorsList(){
    const listEl = $('investorsList');
    const q = $('investorsSearch') ? $('investorsSearch').value : '';
    if(!listEl || !FC.investors) return;

    const items = FC.investors.search(q);
    if(!items.length){
      listEl.innerHTML = '<div class="muted">Brak inwestorów. Kliknij “+ Nowy”.</div>';
      return;
    }

    listEl.innerHTML = items.map(inv => {
      const meta = [
        inv.phone ? esc(inv.phone) : '',
        inv.email ? esc(inv.email) : '',
        inv.status ? esc(inv.status) : ''
      ].filter(Boolean).join(' • ');

      return `
        <div class="card" style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <div style="font-weight:700">${esc(inv.name||'(bez nazwy)')}</div>
              <div class="muted xs" style="margin-top:4px">${meta || '&nbsp;'}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button class="btn-primary" data-action="open-investor" data-id="${esc(inv.id)}">Otwórz</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Actions
  function onAction(action, el){
    try{
      if(!FC.investors) return;
      if(action === 'new-investor'){
        const inv = FC.investors.upsert({ name:'', status:'nowy', kind:'osoba' });
        setCurrentInvestorId(inv.id);
        // go to investor view
        if(FC.views && FC.views.openInvestor) FC.views.openInvestor();
        renderInvestor();
        return true;
      }

      if(action === 'open-investors-list'){
        if(FC.views && FC.views.openInvestorsList) FC.views.openInvestorsList();
        renderInvestorsList();
        return true;
      }

      if(action === 'open-investor'){
        const id = el && el.getAttribute ? el.getAttribute('data-id') : null;
        if(!id) return true;
        setCurrentInvestorId(id);
        if(FC.views && FC.views.openInvestor) FC.views.openInvestor();
        renderInvestor();
        return true;
      }

      if(action === 'inv-kind'){
        const val = el && el.value ? el.value : null;
        const id = getCurrentInvestorId();
        const inv = id ? FC.investors.getById(id) : null;
        if(inv && val){
          FC.investors.upsert(Object.assign({}, inv, { kind: val }));
          renderInvestor();
        }
        return true;
      }

      if(action === 'assign-investor'){
        const id = getCurrentInvestorId();
        const inv = id ? FC.investors.getById(id) : null;
        const p = getProjectSafe();
        if(inv && p){
          ensureProjectMeta();
          p.meta.assignedInvestorId = inv.id;
          // persist project using existing saver (if available)
          if(typeof saveProject === 'function') saveProject();
          renderInvestor();
        }
        return true;
      }

      if(action === 'delete-investor'){
        const id = el && el.getAttribute ? el.getAttribute('data-id') : null;
        if(!id) return true;
        FC.investors.removeById(id);
        // clear selection if needed
        const cur = getCurrentInvestorId();
        if(cur === id) setCurrentInvestorId(null);
        if(FC.views && FC.views.openInvestorsList) FC.views.openInvestorsList();
        renderInvestorsList();
        return true;
      }

      if(action === 'inv-field-change'){
        // handled via bindings (input events)
        return true;
      }
    }catch(_){ /* fail-soft */ }
    return false;
  }

  function attachListSearch(){
    const inp = $('investorsSearch');
    if(!inp) return;
    inp.addEventListener('input', () => renderInvestorsList());
  }

  function attachInvestorAutosave(){
    // autosave on input change inside investorRoot
    const root = $('investorRoot');
    if(!root) return;

    const handler = () => {
      const id = getCurrentInvestorId();
      if(!id || !FC.investors) return;
      const inv = FC.investors.getById(id);
      if(!inv) return;

      const next = Object.assign({}, inv, {
        name: $('invName') ? $('invName').value : inv.name,
        phone: $('invPhone') ? $('invPhone').value : inv.phone,
        email: $('invEmail') ? $('invEmail').value : inv.email,
        address: $('invAddress') ? $('invAddress').value : inv.address,
        source: $('invSource') ? $('invSource').value : inv.source,
        notes: $('invNotes') ? $('invNotes').value : inv.notes,
        status: $('invStatus') ? $('invStatus').value : inv.status,
      });

      FC.investors.upsert(next);
    };

    root.addEventListener('input', handler);
    root.addEventListener('change', handler);
  }

  function init(){
    // attach once, fail-soft
    try{
      attachListSearch();
      attachInvestorAutosave();
    }catch(_){}
  }

  // Expose
  FC.inwestor = {
    render: renderInvestor,
    renderList: renderInvestorsList,
    onAction,
    init
  };

  // init on DOM ready (boot.js triggers after DOM, but fail-soft)
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
