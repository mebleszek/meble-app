// js/app/investor-ui.js
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

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Inwestor</h3>
          ${state.allowListAccess ? '<button class="btn" data-action="back-investors">Lista</button>' : ''}
        </div>

        <div style="display:flex;gap:10px;align-items:center;margin-top:12px">
          <label class="muted xs" style="margin:0">Typ:</label>
          <select id="invKind">
            <option value="person" ${!isCompany?'selected':''}>Osoba</option>
            <option value="company" ${isCompany?'selected':''}>Firma</option>
          </select>
          <label class="muted xs" style="margin:0">Status:</label>
          <select id="invStatus">${statusOptions}</select>
        </div>

        <div class="grid-2" style="margin-top:12px">
          <div>
            <label>${isCompany?'Nazwa firmy':'Imię i nazwisko'}</label>
            <input id="invName" value="${escapeAttr(isCompany ? (inv.companyName||'') : (inv.name||''))}" />
          </div>
          <div>
            <label>Telefon</label>
            <input id="invPhone" value="${escapeAttr(inv.phone||'')}" />
          </div>
          <div>
            <label>Email</label>
            <input id="invEmail" value="${escapeAttr(inv.email||'')}" />
          </div>
          <div>
            <label>Miejscowość</label>
            <input id="invCity" value="${escapeAttr(inv.city||'')}" />
          </div>
          <div style="grid-column:1/-1">
            <label>Adres</label>
            <input id="invAddress" value="${escapeAttr(inv.address||'')}" />
          </div>
          <div>
            <label>Źródło</label>
            <input id="invSource" value="${escapeAttr(inv.source||'')}" placeholder="polecenie / OLX / FB..." />
          </div>
          <div style="grid-column:1/-1">
            <label>Notatki</label>
            <textarea id="invNotes" rows="3">${escapeHtml(inv.notes||'')}</textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
          <button class="btn-primary" data-action="assign-investor" data-inv-id="${inv.id}">Przypisz do bieżącego projektu</button>
          <button class="btn" data-action="delete-investor" data-inv-id="${inv.id}">Usuń</button>
        </div>

        <div class="hr"></div>
        <h4 style="margin:0 0 8px">Szybki skok do pomieszczeń</h4>
        <div class="muted xs" style="margin-bottom:10px">Kliknij, aby przejść do edycji (WYWIAD/RYSUNEK/MATERIAŁ...)</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" data-action="open-room" data-room="kuchnia">Kuchnia</button>
          <button class="btn" data-action="open-room" data-room="szafa">Szafa</button>
          <button class="btn" data-action="open-room" data-room="pokoj">Pokój</button>
          <button class="btn" data-action="open-room" data-room="lazienka">Łazienka</button>
        </div>
      </div>
    `;
  }

  function bindList(scopeEl){
    // IMPORTANT: do not re-render the whole card on each keypress.
    // Replacing the <input> element causes mobile keyboards to hide after 1 char.
    const root = scopeEl || getRoot();
    if(!root) return;
    const search = root.querySelector('#invSearch');
    const itemsEl = root.querySelector('#invItems');
    if(search && itemsEl){
      search.addEventListener('input', () => {
        state.query = search.value || '';
        const list = (FC.investors && typeof FC.investors.search === 'function') ? FC.investors.search(state.query) : [];
        itemsEl.innerHTML = (list || []).map(inv => {
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
        }).join('') || '<div class="muted">Brak inwestorów.</div>';
      }, { passive: true });
    }
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
        // If kind changes, rerender labels
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
        alert('Przypisano inwestora do bieżącej pracy (lokalnie).');
      });
    });

    root.querySelectorAll('[data-action="delete-investor"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if(!confirm('Usunąć inwestora?')) return;
        FC.investors.remove(inv.id);
        state.selectedId = null;
        state.mode = 'list';
        render();
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
