// js/app/investor/investor-ui.js
// UI zakładki/ekranu INWESTOR (lista + karta inwestora). Lokalny zapis.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const STATUS_OPTIONS = [
    { v: 'nowy', label: 'Nowy (lead)' },
    { v: 'wstepna_wycena', label: 'Wstępna wycena' },
    { v: 'po_pomiarze', label: 'Po pomiarze' },
    { v: 'wycena', label: 'Wycena' },
    { v: 'umowa', label: 'Umowa' },
    { v: 'produkcja', label: 'Produkcja' },
    { v: 'montaz', label: 'Montaż' },
    { v: 'zakonczone', label: 'Zakończone' },
    { v: 'odrzucone', label: 'Odrzucone' },
  ];

  const state = {
    mode: 'list', // list|detail
    query: '',
    selectedId: null,
    allowListAccess: true,
  };

  function $(id){ return document.getElementById(id); }

  function getRoot(){
    return $('investorRoot') || $('investorView');
  }

  // Render only list UI into a given container (used by separate Investors List screen).
  function renderListOnly(targetEl){
    const el = targetEl;
    if(!el) return;

    if(!FC.investors){
      el.innerHTML = '<div class="muted">Brak modułu bazy inwestorów.</div>';
      return;
    }

    const list = FC.investors.search(state.query);
    el.innerHTML = buildList(list);
    bindList(targetEl);
  }

  function persistUIInvestorId(id){
    try{
      if(typeof uiState !== 'undefined' && uiState){
        uiState.currentInvestorId = id || null;
        if(FC.storage && typeof FC.storage.setJSON === 'function' && typeof STORAGE_KEYS !== 'undefined'){
          FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        }
      }
    }catch(_){ }
  }

  function readUIInvestorId(){
    try{ return (typeof uiState !== 'undefined' && uiState) ? (uiState.currentInvestorId || null) : null; }catch(_){ return null; }
  }

  function render(){
    const root = getRoot();
    if(!root) return;

    // Ensure investor store exists
    if(!FC.investors){
      root.innerHTML = '<div class="card"><h3>Inwestor</h3><div class="muted">Brak modułu bazy inwestorów.</div></div>';
      return;
    }

    // Decide mode
    const currentId = FC.investors.getCurrentId() || readUIInvestorId();
    if(state.selectedId == null && currentId) state.selectedId = currentId;
    if(!state.allowListAccess && state.selectedId) state.mode = 'detail';
    if(state.mode === 'detail' && !state.selectedId) state.mode = 'list';

    if(state.mode === 'detail'){
      const inv = FC.investors.getById(state.selectedId);
      if(!inv){ state.mode = 'list'; return render(); }
      root.innerHTML = buildDetail(inv);
      bindDetail(inv);
      return;
    }

    // list
    const list = FC.investors.search(state.query);
    root.innerHTML = buildList(list);
    bindList();
  }

  function buildList(list){
    const items = (list || []).map(inv => {
      const title = (inv.kind === 'company' ? (inv.companyName || '(Firma bez nazwy)') : (inv.name || '(Bez nazwy)'));
      const sub = [inv.phone, inv.city].filter(Boolean).join(' • ');
      return `
        <div class="item" data-inv-id="${inv.id}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:12px;margin:8px 0;">
          <div style="min-width:0">
            <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
            <div class="muted xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(sub || '')}</div>
          </div>
          <button class="btn" data-action="open-investor" data-inv-id="${inv.id}">Otwórz</button>
        </div>
      `;
    }).join('');

    return `
      <div class="card">
        <h3>Lista inwestorów</h3>
        <div style="display:flex;gap:10px;align-items:center;margin-top:10px">
          <input id="invSearch" placeholder="Szukaj po nazwie/telefonie..." value="${escapeAttr(state.query)}" />
          <button class="btn-primary" data-action="create-investor">+ Dodaj</button>
        </div>
        <div id="invItems" style="margin-top:12px">${items || '<div class="muted">Brak inwestorów.</div>'}</div>
      </div>
    `;
  }

  function buildDetail(inv){
    const isCompany = inv.kind === 'company';
    const statusOptions = STATUS_OPTIONS.map(o => `<option value="${o.v}" ${inv.status===o.v?'selected':''}>${o.label}</option>`).join('');
    const activeRooms = (window.FC && window.FC.roomRegistry && typeof window.FC.roomRegistry.getActiveRoomDefs === 'function')
      ? window.FC.roomRegistry.getActiveRoomDefs()
      : [];
    const roomButtons = activeRooms.map((room)=> `<button class="btn" data-action="open-room" data-room="${escapeAttr(room.id)}">${escapeHtml(room.label || room.name || room.id)}</button>`).join('');

    return `
      <div class="card investor-card-sync">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Inwestor</h3>
          ${state.allowListAccess ? '<button class="btn" data-action="back-investors">Lista</button>' : ''}
        </div>

        <div class="investor-choice-grid" style="margin-top:12px">
          <div class="investor-choice-field">
            <label class="muted xs" style="margin:0">Typ:</label>
            <select id="invKind" hidden>
              <option value="person" ${!isCompany?'selected':''}>Osoba</option>
              <option value="company" ${isCompany?'selected':''}>Firma</option>
            </select>
            <div id="invKindLaunch"></div>
          </div>
          <div class="investor-choice-field">
            <label class="muted xs" style="margin:0">Status:</label>
            <select id="invStatus" hidden>${statusOptions}</select>
            <div id="invStatusLaunch"></div>
          </div>
        </div>

        <div class="grid-2 investor-form-grid" style="margin-top:12px">
          <div>
            <label>${isCompany?'Nazwa firmy':'Imię i nazwisko'}</label>
            <input class="investor-form-input" id="invName" value="${escapeAttr(isCompany ? (inv.companyName||'') : (inv.name||''))}" />
          </div>
          <div>
            <label>Telefon</label>
            <input class="investor-form-input" id="invPhone" value="${escapeAttr(inv.phone||'')}" />
          </div>
          <div>
            <label>Email</label>
            <input class="investor-form-input" id="invEmail" value="${escapeAttr(inv.email||'')}" />
          </div>
          <div>
            <label>Miejscowość</label>
            <input class="investor-form-input" id="invCity" value="${escapeAttr(inv.city||'')}" />
          </div>
          <div style="grid-column:1/-1">
            <label>Adres</label>
            <input class="investor-form-input" id="invAddress" value="${escapeAttr(inv.address||'')}" />
          </div>
          <div>
            <label>Źródło</label>
            <input class="investor-form-input" id="invSource" value="${escapeAttr(inv.source||'')}" placeholder="polecenie / OLX / FB..." />
          </div>
          <div style="grid-column:1/-1">
            <label>Notatki</label>
            <textarea class="investor-form-input investor-form-textarea" id="invNotes" rows="3">${escapeHtml(inv.notes||'')}</textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
          <button class="btn" data-action="delete-investor" data-inv-id="${inv.id}">Usuń</button>
          <button class="btn-primary" data-action="add-room">Dodaj pomieszczenie</button>
        </div>

        <div class="hr"></div>
        <h4 style="margin:0 0 8px">Szybki skok do pomieszczeń</h4>
        <div class="muted xs" style="margin-bottom:10px">Wyświetlam tylko pomieszczenia dodane do tego inwestora.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">${roomButtons || '<div class="muted">Brak dodanych pomieszczeń.</div>'}</div>
      </div>
    `;
  }
  function bindDetail(inv){
    const root = getRoot();
    if(!root) return;

    function savePatch(p){
      FC.investors.update(inv.id, p);
    }

    const kind = $('invKind');
    const status = $('invStatus');

    const name = $('invName');
    const phone = $('invPhone');
    const email = $('invEmail');
    const city = $('invCity');
    const address = $('invAddress');
    const source = $('invSource');
    const notes = $('invNotes');

    function debounce(fn, ms){
      let t = null;
      return () => {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    }

    const saveAll = debounce(() => {
      const isCompany = (kind && kind.value) === 'company';
      savePatch({
        kind: isCompany ? 'company' : 'person',
        name: isCompany ? '' : (name?.value || ''),
        companyName: isCompany ? (name?.value || '') : '',
        phone: phone?.value || '',
        email: email?.value || '',
        city: city?.value || '',
        address: address?.value || '',
        source: source?.value || '',
        notes: notes?.value || '',
        status: status?.value || 'nowy',
      });
    }, 200);

    [kind,status,name,phone,email,city,address,source,notes].forEach(el => {
      if(!el) return;
      el.addEventListener('input', saveAll, { passive: true });
      el.addEventListener('change', () => {
        saveAll();
        if(el === kind){
          const updated = FC.investors.getById(inv.id);
          if(updated){
            state.selectedId = updated.id;
            state.mode = 'detail';
            render();
          }
        }
      });
    });

    const choiceApi = window.FC && window.FC.rozrysChoice;
    function wireChoice(selectEl, mountId, title){
      const mount = document.getElementById(mountId);
      if(!mount || !selectEl || !choiceApi || typeof choiceApi.createChoiceLauncher !== 'function' || typeof choiceApi.openRozrysChoiceOverlay !== 'function') return;
      const label = choiceApi.getSelectOptionLabel(selectEl) || '';
      const btn = choiceApi.createChoiceLauncher(label, '');
      btn.classList.add('investor-choice-launch','app-choice-launch');
      const arrow = btn.querySelector('.rozrys-choice-launch__arrow');
      if(arrow) arrow.remove();
      btn.addEventListener('click', async ()=>{
        const picked = await choiceApi.openRozrysChoiceOverlay({
          title,
          value:String(selectEl.value || ''),
          options:Array.from(selectEl.options || []).map((opt)=> ({ value:String(opt.value || ''), label:String(opt.textContent || opt.label || opt.value || '') }))
        });
        if(picked == null) return;
        selectEl.value = String(picked || '');
        choiceApi.setChoiceLaunchValue(btn, choiceApi.getSelectOptionLabel(selectEl) || '', '');
        selectEl.dispatchEvent(new Event('change', { bubbles:true }));
      });
      mount.innerHTML = '';
      mount.appendChild(btn);
    }
    wireChoice(kind, 'invKindLaunch', 'Wybierz typ');
    wireChoice(status, 'invStatusLaunch', 'Wybierz status');

    root.querySelectorAll('[data-action="back-investors"]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mode = 'list';
        render();
      });
    });

    root.querySelectorAll('[data-action="assign-investor"]').forEach(btn => {
      btn.addEventListener('click', () => {
        FC.investors.setCurrentId(inv.id);
        persistUIInvestorId(inv.id);
        try{ if(window.FC && window.FC.roomRegistry && typeof window.FC.roomRegistry.renderRoomsView === 'function') window.FC.roomRegistry.renderRoomsView(); }catch(_){ }
      });
    });

    root.querySelectorAll('[data-action="delete-investor"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        let ok = true;
        try{
          if(window.FC && window.FC.confirmBox && typeof window.FC.confirmBox.ask === 'function'){
            ok = await window.FC.confirmBox.ask({ title:'Usunąć inwestora?', message:'Tej operacji nie cofnięsz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
          }
        }catch(_){ }
        if(!ok) return;
        FC.investors.remove(inv.id);
        state.selectedId = null;
        state.mode = 'list';
        render();
      });
    });

    root.querySelectorAll('[data-action="add-room"]').forEach(btn => {
      btn.addEventListener('click', async ()=>{
        try{
          if(window.FC && window.FC.roomRegistry && typeof window.FC.roomRegistry.openAddRoomModal === 'function'){
            const room = await window.FC.roomRegistry.openAddRoomModal();
            if(room){
              try{ if(window.FC.roomRegistry.renderRoomsView) window.FC.roomRegistry.renderRoomsView(); }catch(_){ }
              render();
            }
          }
        }catch(_){ }
      });
    });
  }
  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s){
    return escapeHtml(s).replace(/\n/g,' ');
  }

  FC.investorUI = {
    render,
    renderListOnly,
    state,
  };
})();
