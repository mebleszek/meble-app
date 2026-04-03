// js/app/investor/investor-ui.js
// UI zakładki/ekranu INWESTOR (lista + karta inwestora).
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
  function persistence(){ return FC.investorPersistence || null; }
  function guard(){ return FC.investorNavigationGuard || null; }
  function fieldRender(){ return FC.investorFieldRender || null; }
  function actions(){ return FC.investorActions || null; }

  function escapeHtml(s){
    const api = fieldRender();
    return api && typeof api.escapeHtml === 'function' ? api.escapeHtml(s) : String(s ?? '');
  }
  function escapeAttr(s){
    const api = fieldRender();
    return api && typeof api.escapeAttr === 'function' ? api.escapeAttr(s) : String(s ?? '');
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

  function renderListOnly(targetEl){
    const el = targetEl;
    if(!el) return;
    if(!persistence()){
      el.innerHTML = '<div class="muted">Brak modułu bazy inwestorów.</div>';
      return;
    }
    const list = persistence().searchInvestors(state.query);
    el.innerHTML = buildList(list);
    bindList(targetEl);
  }

  function render(){
    const root = getRoot();
    if(!root) return;

    if(!persistence()){
      root.innerHTML = '<div class="card"><h3>Inwestor</h3><div class="muted">Brak modułu bazy inwestorów.</div></div>';
      return;
    }

    const currentId = persistence().getCurrentInvestorId() || readUIInvestorId();
    if(state.selectedId == null && currentId) state.selectedId = currentId;
    if(!state.allowListAccess && state.selectedId) state.mode = 'detail';
    if(state.mode === 'detail' && !state.selectedId) state.mode = 'list';

    if(state.mode === 'detail'){
      const inv = persistence().getInvestorById(state.selectedId);
      if(!inv){ state.mode = 'list'; return render(); }
      root.innerHTML = buildDetail(inv);
      bindDetail(inv);
      return;
    }

    try{ guard() && guard().apply(false); }catch(_){ }
    const list = persistence().searchInvestors(state.query);
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

  function buildDetail(inv){
    const editorApi = editor();
    const fields = fieldRender();
    const actionsApi = actions();
    const draft = editorApi ? editorApi.getDraft(inv) : (editorApi && editorApi.buildDraft ? editorApi.buildDraft(inv) : {});
    const isEditing = !!(editorApi && editorApi.ensureInvestor(inv).isEditing);
    const dirty = !!(editorApi && editorApi.ensureInvestor(inv).dirty);
    const isCompany = String(draft.kind || inv.kind || 'person') === 'company';
    const linksApi = links();
    const phoneLabel = (!isEditing && linksApi && typeof linksApi.buildLabelWithAction === 'function')
      ? linksApi.buildLabelWithAction('Telefon', 'phone', draft.phone || inv.phone || '')
      : fields.buildStaticLabel('Telefon');
    const emailLabel = (!isEditing && linksApi && typeof linksApi.buildLabelWithAction === 'function')
      ? linksApi.buildLabelWithAction('Email', 'email', draft.email || inv.email || '')
      : fields.buildStaticLabel('Email');
    const bottomButtons = actionsApi ? actionsApi.buildActionBarHtml({ isEditing, dirty }) : '';

    const typeOptions = [
      { value:'person', label:'Osoba prywatna' },
      { value:'company', label:'Firma' },
    ];
    const statusOptions = STATUS_OPTIONS.map((o)=> ({ value:o.v, label:o.label }));
    const roomButtons = roomUi() && typeof roomUi().buildRoomButtons === 'function'
      ? roomUi().buildRoomButtons(isEditing)
      : '<div class="muted">Brak pomieszczeń.</div>';

    const rows = [];
    rows.push(fields.buildPairRow(
      fields.buildInputField('invName', fields.buildStaticLabel(isCompany ? 'Nazwa firmy' : 'Imię i nazwisko'), isCompany ? draft.companyName : draft.name, { readonly:!isEditing, compact:true }),
      fields.buildInputField('invPhone', phoneLabel, draft.phone, { readonly:!isEditing, compact:true })
    ));
    rows.push(fields.buildPairRow(
      fields.buildInputField('invCity', fields.buildStaticLabel('Miejscowość'), draft.city, { readonly:!isEditing, compact:true }),
      fields.buildInputField('invEmail', emailLabel, draft.email, { readonly:!isEditing, compact:true })
    ));
    rows.push(fields.buildPairRow(
      fields.buildInputField('invAddress', fields.buildStaticLabel('Adres'), draft.address, { readonly:!isEditing, full:true, compact:true }),
      '',
      { full:true }
    ));
    if(isCompany){
      rows.push(fields.buildPairRow(
        fields.buildInputField('invSource', fields.buildStaticLabel('Źródło'), draft.source, { readonly:!isEditing, compact:true }),
        fields.buildInputField('invNip', fields.buildStaticLabel('NIP'), draft.nip, { readonly:!isEditing, compact:true })
      ));
    }else{
      rows.push(fields.buildPairRow(
        fields.buildInputField('invSource', fields.buildStaticLabel('Źródło'), draft.source, { readonly:!isEditing, full:true, compact:true }),
        '',
        { full:true }
      ));
    }
    rows.push(fields.buildPairRow(
      fields.buildInputField('invNotes', fields.buildStaticLabel('Notatki'), draft.notes, { readonly:!isEditing, full:true, textarea:true, rows:3 }),
      '',
      { full:true }
    ));

    return `
      <div class="card investor-card-sync" data-investor-editing="${isEditing ? '1' : '0'}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Inwestor</h3>
          ${state.allowListAccess ? `<button class="btn${isEditing ? ' is-disabled' : ''}" data-action="back-investors" ${isEditing ? 'disabled' : ''}>Lista</button>` : ''}
        </div>

        <div class="investor-choice-grid">
          ${fields.buildChoiceField('invKind', 'Typ', typeOptions, draft.kind || 'person', 'investor-choice-field--kind', { readonlyPreview:!isEditing })}
          ${fields.buildChoiceField('invStatus', 'Status', statusOptions, draft.status || 'nowy', 'investor-choice-field--status')}
        </div>

        <div class="investor-details-rows">
          ${rows.join('')}
        </div>

        <div class="investor-bottom-actions" id="investorActionBar">${bottomButtons}</div>

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
    const actionsApi = actions();
    const choiceApi = choice();
    const persistenceApi = persistence();
    if(editorApi) editorApi.ensureInvestor(inv);

    try{ guard() && guard().apply(!!(editorApi && editorApi.state.isEditing)); }catch(_){ }

    const topActions = document.getElementById('investorActionBar');
    const kindSelect = document.getElementById('invKind');
    const statusSelect = document.getElementById('invStatus');
    const fieldIds = ['invName','invPhone','invCity','invEmail','invAddress','invSource','invNip','invNotes'];
    const fields = fieldIds.reduce((acc, id)=> { acc[id] = document.getElementById(id); return acc; }, {});

    function currentInvestor(){ return (persistenceApi && persistenceApi.getInvestorById(inv.id)) || inv; }

    function refreshActionBar(){
      const currentState = editorApi ? editorApi.ensureInvestor(currentInvestor()) : { isEditing:false, dirty:false };
      if(!topActions) return;
      topActions.innerHTML = actionsApi ? actionsApi.buildActionBarHtml(currentState) : '';
      bindTopActions();
      try{ guard() && guard().apply(!!currentState.isEditing); }catch(_){ }
    }

    function patchFieldFromDom(id, key){
      if(!(editorApi && editorApi.state.isEditing)) return;
      const node = fields[id];
      if(!node) return;
      editorApi.setField(key, node.value || '');
      refreshActionBar();
    }

    function bindTopActions(){
      if(!(topActions && actionsApi)) return;
      actionsApi.bindTopActions(topActions, {
        getCurrentInvestor: currentInvestor,
        onRender: render,
        onDeleted: ()=> {
          state.selectedId = null;
          state.mode = 'list';
          persistUIInvestorId(null);
          try{ guard() && guard().apply(false); }catch(_){ }
          render();
        }
      });
    }

    bindTopActions();

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
          persistenceApi && persistenceApi.setInvestorStatus(current.id, value);
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
        if(editorApi && editorApi.state.isEditing) return;
        state.mode = 'list';
        try{ guard() && guard().apply(false); }catch(_){ }
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

  FC.investorUI = {
    render,
    renderListOnly,
    state,
    applyInvestorUiLocks: (inv)=> { try{ guard() && guard().apply(!!(editor() && editor().state.isEditing && inv && editor().state.investorId === inv.id)); }catch(_){ } },
  };
})();
