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
    mode: 'list',
    query: '',
    selectedId: null,
    allowListAccess: true,
  };

  function $(id){ return document.getElementById(id); }
  function getRoot(){ return $('investorRoot') || $('investorView'); }
  function editor(){ return FC.investorEditorState || null; }
  function modals(){ return FC.investorModals || null; }
  function choice(){ return FC.investorChoice || null; }
  function roomUi(){ return FC.investorRooms || null; }
  function links(){ return FC.investorLinks || null; }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/\n/g,' '); }

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

  function render(){
    const root = getRoot();
    if(!root) return;

    if(!FC.investors){
      root.innerHTML = '<div class="card"><h3>Inwestor</h3><div class="muted">Brak modułu bazy inwestorów.</div></div>';
      return;
    }

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

    applyInvestorUiLocks(null);
    const list = FC.investors.search(state.query);
    root.innerHTML = buildList(list);
    bindList();
  }

  function buildList(list){
    const items = (list || []).map((inv) => {
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

  function buildChoiceField(id, label, options, value, title, disabled, extraClass){
    const opts = (options || []).map((opt)=> `<option value="${escapeAttr(opt.value)}" ${String(opt.value) === String(value) ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('');
    return `
      <div class="investor-choice-field ${extraClass || ''}">
        <label>${escapeHtml(label)}</label>
        <select id="${escapeAttr(id)}" hidden>${opts}</select>
        <div id="${escapeAttr(id)}Launch"></div>
      </div>
    `;
  }

  function buildInputField(id, labelHtml, value, opts){
    const cfg = Object.assign({ full:false, readonly:false, textarea:false, rows:3 }, opts || {});
    const cls = `investor-field-shell${cfg.full ? ' investor-field--full' : ''}`;
    const textValue = String(value == null ? '' : value);
    if(cfg.readonly){
      const display = textValue.trim() ? escapeHtml(textValue) : '<span class="investor-form-value__empty">—</span>';
      return `
        <div class="${cls}">
          ${labelHtml}
          <div class="investor-form-value${cfg.textarea ? ' investor-form-value--textarea' : ''}" id="${escapeAttr(id)}">${display}</div>
        </div>
      `;
    }
    if(cfg.textarea){
      return `
        <div class="${cls}">
          ${labelHtml}
          <textarea class="investor-form-input" id="${escapeAttr(id)}" rows="${cfg.rows}">${escapeHtml(textValue)}</textarea>
        </div>
      `;
    }
    return `
      <div class="${cls}">
        ${labelHtml}
        <input class="investor-form-input" id="${escapeAttr(id)}" value="${escapeAttr(textValue)}" />
      </div>
    `;
  }

  function buildDetail(inv){
    const editorApi = editor();
    const draft = editorApi ? editorApi.getDraft(inv) : (editorApi && editorApi.buildDraft ? editorApi.buildDraft(inv) : {});
    const isEditing = !!(editorApi && editorApi.ensureInvestor(inv).isEditing);
    const dirty = !!(editorApi && editorApi.ensureInvestor(inv).dirty);
    const isCompany = String(draft.kind || inv.kind || 'person') === 'company';
    const linksApi = links();
    const phoneLabel = (!isEditing && linksApi && typeof linksApi.buildLabelWithAction === 'function')
      ? linksApi.buildLabelWithAction('Telefon', 'phone', draft.phone || inv.phone || '')
      : '<label>Telefon</label>';
    const emailLabel = (!isEditing && linksApi && typeof linksApi.buildLabelWithAction === 'function')
      ? linksApi.buildLabelWithAction('Email', 'email', draft.email || inv.email || '')
      : '<label>Email</label>';
    const topButtons = !isEditing
      ? `<button class="btn-danger" type="button" data-investor-action="delete">Usuń</button><button class="btn" type="button" data-investor-action="edit">Edytuj</button>`
      : (dirty
          ? `<button class="btn-danger" type="button" data-investor-action="cancel">Anuluj</button><button class="btn-success" type="button" data-investor-action="save">Zapisz</button>`
          : `<button class="btn-primary" type="button" data-investor-action="exit">Wyjdź</button>`);

    const typeOptions = [
      { value:'person', label:'Osoba' },
      { value:'company', label:'Firma' },
    ];
    const statusOptions = STATUS_OPTIONS.map((o)=> ({ value:o.v, label:o.label }));
    const roomButtons = roomUi() && typeof roomUi().buildRoomButtons === 'function'
      ? roomUi().buildRoomButtons(isEditing)
      : '<div class="muted">Brak pomieszczeń.</div>';

    return `
      <div class="card investor-card-sync" data-investor-editing="${isEditing ? '1' : '0'}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Inwestor</h3>
          ${state.allowListAccess ? '<button class="btn" data-action="back-investors">Lista</button>' : ''}
        </div>

        <div class="investor-top-actions" id="investorTopActions">${topButtons}</div>

        <div class="investor-choice-grid">
          ${buildChoiceField('invKind', 'Typ', typeOptions, draft.kind || 'person', 'Wybierz typ', !isEditing, 'investor-choice-field--kind')}
          ${buildChoiceField('invStatus', 'Status', statusOptions, draft.status || 'nowy', 'Wybierz status', false, 'investor-choice-field--status')}
        </div>

        <div class="investor-form-grid">
          ${buildInputField('invName', `<label>${isCompany ? 'Nazwa firmy' : 'Imię i nazwisko'}</label>`, isCompany ? draft.companyName : draft.name, { readonly:!isEditing })}
          ${buildInputField('invPhone', phoneLabel, draft.phone, { readonly:!isEditing })}
          ${buildInputField('invCity', '<label>Miejscowość</label>', draft.city, { readonly:!isEditing })}
          ${buildInputField('invEmail', emailLabel, draft.email, { readonly:!isEditing })}
          ${buildInputField('invAddress', '<label>Adres</label>', draft.address, { readonly:!isEditing, full:true })}
          ${buildInputField('invSource', '<label>Źródło</label>', draft.source, { readonly:!isEditing, full:!isCompany })}
          ${isCompany ? buildInputField('invNip', '<label>NIP</label>', draft.nip, { readonly:!isEditing }) : ''}
          ${buildInputField('invNotes', '<label>Notatki</label>', draft.notes, { readonly:!isEditing, full:true, textarea:true, rows:3 })}
        </div>

        <div class="hr"></div>
        <div class="investor-rooms-head">
          <h4 style="margin:0">Pomieszczenia inwestora</h4>
          <button class="btn-primary investor-add-room-btn${isEditing ? ' is-disabled' : ''}" type="button" data-investor-action="add-room" ${isEditing ? 'disabled' : ''}>Dodaj pomieszczenie</button>
        </div>
        <div class="muted xs" style="margin-bottom:10px">Wyświetlam tylko pomieszczenia dodane do tego inwestora.</div>
        <div class="investor-room-quick-list">${roomButtons}</div>
        ${isEditing ? '<div class="investor-disabled-note">W trybie edycji pomieszczenia i górna nawigacja są zablokowane.</div>' : ''}
      </div>
    `;
  }

  function bindList(targetEl){
    const root = targetEl || getRoot();
    if(!root) return;
    const input = root.querySelector('#invSearch');
    if(input){
      input.addEventListener('input', ()=>{ state.query = input.value || ''; renderListOnly(targetEl || getRoot()); });
    }
  }

  function bindDetail(inv){
    const root = getRoot();
    if(!root) return;
    const editorApi = editor();
    if(editorApi) editorApi.ensureInvestor(inv);

    applyInvestorUiLocks(inv);

    const topActions = document.getElementById('investorTopActions');
    const kindSelect = document.getElementById('invKind');
    const statusSelect = document.getElementById('invStatus');
    const fieldIds = ['invName','invPhone','invCity','invEmail','invAddress','invSource','invNip','invNotes'];
    const fields = fieldIds.reduce((acc, id)=> { acc[id] = document.getElementById(id); return acc; }, {});

    function currentInvestor(){ return FC.investors.getById(inv.id) || inv; }

    function refreshActionBar(){
      const currentState = editorApi ? editorApi.ensureInvestor(currentInvestor()) : { isEditing:false, dirty:false };
      if(!topActions) return;
      if(!currentState.isEditing){
        topActions.innerHTML = '<button class="btn-danger" type="button" data-investor-action="delete">Usuń</button><button class="btn" type="button" data-investor-action="edit">Edytuj</button>';
      }else if(currentState.dirty){
        topActions.innerHTML = '<button class="btn-danger" type="button" data-investor-action="cancel">Anuluj</button><button class="btn-success" type="button" data-investor-action="save">Zapisz</button>';
      }else{
        topActions.innerHTML = '<button class="btn-primary" type="button" data-investor-action="exit">Wyjdź</button>';
      }
      bindTopActions();
      applyInvestorUiLocks(currentInvestor());
    }

    function patchFieldFromDom(id, key){
      if(!(editorApi && editorApi.state.isEditing)) return;
      const node = fields[id];
      if(!node) return;
      editorApi.setField(key, node.value || '');
      refreshActionBar();
    }

    function bindTopActions(){
      if(!topActions) return;
      topActions.querySelectorAll('[data-investor-action]').forEach((btn)=>{
        btn.addEventListener('click', async ()=>{
          const action = btn.getAttribute('data-investor-action');
          if(action === 'edit'){
            editorApi && editorApi.enter(currentInvestor());
            render();
            return;
          }
          if(action === 'exit'){
            editorApi && editorApi.exit(currentInvestor());
            render();
            return;
          }
          if(action === 'cancel'){
            const ok = !(modals() && modals().confirmDiscardInvestorChanges) || await modals().confirmDiscardInvestorChanges();
            if(!ok) return;
            editorApi && editorApi.exit(currentInvestor());
            render();
            return;
          }
          if(action === 'save'){
            const ok = !(modals() && modals().confirmSaveInvestorChanges) || await modals().confirmSaveInvestorChanges();
            if(!ok) return;
            const patch = editorApi ? editorApi.commit(currentInvestor()) : null;
            if(patch) FC.investors.update(inv.id, patch);
            render();
            return;
          }
          if(action === 'delete'){
            const ok = !(modals() && modals().confirmDeleteInvestor) || await modals().confirmDeleteInvestor();
            if(!ok) return;
            FC.investors.remove(inv.id);
            state.selectedId = null;
            state.mode = 'list';
            applyInvestorUiLocks(null);
            render();
            return;
          }
        });
      });
    }

    bindTopActions();

    const choiceApi = choice();
    if(choiceApi && typeof choiceApi.mountChoice === 'function'){
      choiceApi.mountChoice({
        mount: document.getElementById('invKindLaunch'),
        selectEl: kindSelect,
        title:'Wybierz typ',
        buttonClass:'investor-choice-launch',
        disabled: !(editorApi && editorApi.state.isEditing),
        onChange: (value)=>{
          if(!(editorApi && editorApi.state.isEditing)) return;
          editorApi.setField('kind', value);
          render();
        }
      });
      choiceApi.mountChoice({
        mount: document.getElementById('invStatusLaunch'),
        selectEl: statusSelect,
        title:'Wybierz status',
        buttonClass:'investor-choice-launch',
        disabled: false,
        onChange: async (value)=>{
          const current = currentInvestor();
          const prevValue = String(current.status || 'nowy');
          if(editorApi && editorApi.state.isEditing){
            editorApi.setField('status', value);
            refreshActionBar();
            return;
          }
          if(value === prevValue) return;
          const prevLabel = STATUS_OPTIONS.find((opt)=> opt.v === prevValue)?.label || prevValue;
          const nextLabel = STATUS_OPTIONS.find((opt)=> opt.v === value)?.label || value;
          const ok = !(modals() && modals().confirmStatusChange) || await modals().confirmStatusChange(prevLabel, nextLabel);
          if(!ok){ render(); return; }
          FC.investors.update(inv.id, { status:value });
          render();
        }
      });
    }

    Object.entries({
      invName: () => editorApi.setField((kindSelect && kindSelect.value) === 'company' ? 'companyName' : 'name', fields.invName && fields.invName.value),
      invPhone: () => patchFieldFromDom('invPhone', 'phone'),
      invCity: () => patchFieldFromDom('invCity', 'city'),
      invEmail: () => patchFieldFromDom('invEmail', 'email'),
      invAddress: () => patchFieldFromDom('invAddress', 'address'),
      invSource: () => patchFieldFromDom('invSource', 'source'),
      invNip: () => patchFieldFromDom('invNip', 'nip'),
      invNotes: () => patchFieldFromDom('invNotes', 'notes'),
    }).forEach(([id, handler])=>{
      const node = fields[id];
      if(!node) return;
      node.addEventListener('input', ()=>{ if(!(editorApi && editorApi.state.isEditing)) return; handler(); refreshActionBar(); });
      node.addEventListener('change', ()=>{ if(!(editorApi && editorApi.state.isEditing)) return; handler(); refreshActionBar(); });
    });

    root.querySelectorAll('[data-action="back-investors"]').forEach((btn)=> {
      btn.addEventListener('click', ()=>{
        state.mode = 'list';
        applyInvestorUiLocks(null);
        render();
      });
    });

    root.querySelectorAll('[data-investor-action="add-room"]').forEach((btn)=> {
      btn.addEventListener('click', async ()=>{
        if(editorApi && editorApi.state.isEditing) return;
        try{
          if(FC.roomRegistry && typeof FC.roomRegistry.openAddRoomModal === 'function'){
            const room = await FC.roomRegistry.openAddRoomModal();
            if(room){
              try{ if(FC.roomRegistry.renderRoomsView) FC.roomRegistry.renderRoomsView(); }catch(_){ }
              render();
            }
          }
        }catch(_){ }
      });
    });
  }

  function applyInvestorUiLocks(inv){
    const editing = !!(editor() && editor().state.isEditing && inv && editor().state.investorId === inv.id);
    try{
      const topTabs = document.getElementById('topTabs');
      if(topTabs) topTabs.classList.toggle('is-disabled', editing);
    }catch(_){ }
    try{
      document.querySelectorAll('.investor-room-quick-btn, .investor-add-room-btn').forEach((btn)=>{
        btn.classList.toggle('is-disabled', editing);
        btn.toggleAttribute('disabled', editing);
      });
    }catch(_){ }
  }

  FC.investorUI = {
    render,
    renderListOnly,
    state,
    applyInvestorUiLocks,
  };
})();
