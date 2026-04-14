// js/app/investor/investor-ui.js
// UI zakładki/ekranu INWESTOR (lista + karta inwestora).
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const PROJECT_STATUS_OPTIONS = [
    { value: 'nowy', label: 'Nowy' },
    { value: 'wstepna_wycena', label: 'Wstępna wycena' },
    { value: 'pomiar', label: 'Pomiar' },
    { value: 'wycena', label: 'Wycena' },
    { value: 'zaakceptowany', label: 'Zaakceptowany' },
    { value: 'umowa', label: 'Umowa' },
    { value: 'produkcja', label: 'Produkcja' },
    { value: 'montaz', label: 'Montaż' },
    { value: 'zakonczone', label: 'Zakończone' },
    { value: 'odrzucone', label: 'Odrzucone' },
  ];

  const INVESTOR_SOURCE_OPTIONS = [
    { value:'Ulotka', label:'Ulotka' },
    { value:'Wizytówka', label:'Wizytówka' },
    { value:'Reklama na aucie', label:'Reklama na aucie' },
    { value:'OLX', label:'OLX' },
    { value:'Internet', label:'Internet' },
    { value:'Facebook', label:'Facebook' },
    { value:'Instagram', label:'Instagram' },
    { value:'YouTube', label:'YouTube' },
    { value:'Google', label:'Google' },
    { value:'Polecenie', label:'Polecenie' },
    { value:'Baner / szyld', label:'Baner / szyld' },
    { value:'Przechodzień', label:'Przechodzień' },
    { value:'Inne', label:'Inne' },
  ];

  const state = {
    mode: 'list',
    query: '',
    selectedId: null,
    allowListAccess: true,
    newlyCreatedId: null,
    transientInvestor: null,
  };

  function $(id){ return document.getElementById(id); }
  function getRoot(){ return $('investorRoot') || $('investorView'); }
  function editor(){ return FC.investorEditorState || null; }
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

  function todayInput(){
    try{ return new Date().toISOString().slice(0, 10); }catch(_){ return ''; }
  }

  function normalizeDateInput(value){
    const text = String(value || '').trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if(Number.isFinite(Number(value)) && Number(value) > 0){
      try{ return new Date(Number(value)).toISOString().slice(0, 10); }catch(_){ }
    }
    return todayInput();
  }

  function formatDateDisplay(value){
    const raw = normalizeDateInput(value);
    if(!raw) return '—';
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
  }

  function persistUIInvestorId(id){
    try{
      if(window.FC && FC.uiState && typeof FC.uiState.set === 'function'){
        uiState = FC.uiState.set({ currentInvestorId: id || null });
        return;
      }
      if(typeof uiState !== 'undefined' && uiState){
        uiState.currentInvestorId = id || null;
        if(FC.storage && typeof FC.storage.setJSON === 'function' && typeof STORAGE_KEYS !== 'undefined'){
          FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        }
      }
    }catch(_){ }
  }

  function readUIInvestorId(){
    try{ return (FC.uiState && typeof FC.uiState.get === 'function') ? (FC.uiState.get().currentInvestorId || null) : null; }catch(_){ }
    try{ return (typeof uiState !== 'undefined' && uiState) ? (uiState.currentInvestorId || null) : null; }catch(_){ return null; }
  }


  function getTransientInvestor(){
    return state.transientInvestor && typeof state.transientInvestor === 'object' ? state.transientInvestor : null;
  }

  function setTransientInvestor(investor){
    state.transientInvestor = investor && typeof investor === 'object' ? investor : null;
    if(state.transientInvestor && state.transientInvestor.id) state.selectedId = String(state.transientInvestor.id);
    return state.transientInvestor;
  }

  function clearTransientInvestor(id){
    const current = getTransientInvestor();
    if(!current) return;
    if(id && String(current.id || '') != String(id || '')) return;
    state.transientInvestor = null;
    if(state.selectedId && String(state.selectedId || '') === String(current.id || '')) state.selectedId = null;
  }

  function resolveInvestorForDetail(id, fallbackId){
    const investorId = String(id || fallbackId || '').trim();
    const persisted = investorId && persistence() && typeof persistence().getInvestorById === 'function'
      ? persistence().getInvestorById(investorId)
      : null;
    if(persisted) return persisted;
    const transient = getTransientInvestor();
    if(transient && (!investorId || String(transient.id || '') === investorId)) return transient;
    return null;
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

  function ensureInvestorContext(currentId){
    const ui = (typeof uiState !== 'undefined' && uiState) ? uiState : ((FC.uiState && typeof FC.uiState.get === 'function') ? FC.uiState.get() : null);
    const transient = getTransientInvestor();
    const detailId = currentId || (transient && transient.id) || null;
    if(ui && String(ui.activeTab || '') === 'inwestor' && detailId){
      state.selectedId = detailId;
      state.mode = 'detail';
      state.allowListAccess = false;
    }
  }

  function render(){
    const root = getRoot();
    if(!root) return;

    if(!persistence()){
      root.innerHTML = '<div class="card"><h3>Inwestor</h3><div class="muted">Brak modułu bazy inwestorów.</div></div>';
      return;
    }

    const currentId = persistence().getCurrentInvestorId() || readUIInvestorId();
    const transient = getTransientInvestor();
    if(state.selectedId == null && currentId) state.selectedId = currentId;
    if(state.selectedId == null && transient && transient.id) state.selectedId = String(transient.id);
    ensureInvestorContext(currentId);
    if(!state.allowListAccess && state.selectedId) state.mode = 'detail';
    if(state.mode === 'detail' && !state.selectedId && currentId) state.selectedId = currentId;
    if(state.mode === 'detail' && !state.selectedId && transient && transient.id) state.selectedId = String(transient.id);
    if(state.mode === 'detail' && !state.selectedId) state.mode = 'list';

    if(state.mode === 'detail'){
      const inv = resolveInvestorForDetail(state.selectedId, currentId);
      if(!inv){
        state.mode = 'list';
        state.allowListAccess = true;
        state.selectedId = null;
        state.newlyCreatedId = null;
        clearTransientInvestor();
        try{ persistence() && typeof persistence().setCurrentInvestorId === 'function' && persistence().setCurrentInvestorId(null); }catch(_){ }
        persistUIInvestorId(null);
        try{ guard() && guard().apply(false); }catch(_){ }
        const list = persistence().searchInvestors(state.query);
        root.innerHTML = buildList(list);
        bindList();
        return;
      }
      persistUIInvestorId((persistence().getInvestorById(inv.id) ? inv.id : null));
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
      const sub = [inv.phone, inv.city, formatDateDisplay(inv.addedDate || inv.createdAt)].filter(Boolean).join(' • ');
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
    const draft = editorApi ? editorApi.getDraft(inv) : {};
    const currentState = editorApi ? editorApi.ensureInvestor(inv) : { isEditing:false, dirty:false };
    const isEditing = !!currentState.isEditing;
    const dirty = !!currentState.dirty;
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
    const projectCards = roomUi() && typeof roomUi().buildProjectCards === 'function'
      ? roomUi().buildProjectCards(inv, isEditing, PROJECT_STATUS_OPTIONS)
      : '<div class="muted">Brak dodanych pomieszczeń.</div>';

    const rows = [];
    if(isCompany){
      rows.push(fields.buildPairRow(
        fields.buildInputField('invName', fields.buildStaticLabel('Nazwa firmy'), draft.companyName, { readonly:!isEditing, compact:true }),
        fields.buildInputField('invPhone', phoneLabel, draft.phone, { readonly:!isEditing, compact:true })
      ));
      rows.push(fields.buildPairRow(
        fields.buildInputField('invOwnerName', fields.buildStaticLabel('Właściciel — imię i nazwisko'), draft.ownerName, { readonly:!isEditing, compact:true }),
        fields.buildInputField('invEmail', emailLabel, draft.email, { readonly:!isEditing, compact:true })
      ));
      rows.push(fields.buildPairRow(
        fields.buildInputField('invCity', fields.buildStaticLabel('Miejscowość'), draft.city, { readonly:!isEditing, compact:true }),
        fields.buildInputField('invNip', fields.buildStaticLabel('NIP'), draft.nip, { readonly:!isEditing, compact:true })
      ));
      rows.push(fields.buildPairRow(
        fields.buildInputField('invAddress', fields.buildStaticLabel('Adres'), draft.address, { readonly:!isEditing, compact:true }),
        fields.buildChoiceField('invSource', 'Źródło', INVESTOR_SOURCE_OPTIONS, draft.source, '', { readonlyPreview:!isEditing, allowEmpty:true })
      ));
    } else {
      rows.push(fields.buildPairRow(
        fields.buildInputField('invName', fields.buildStaticLabel('Imię i nazwisko'), draft.name, { readonly:!isEditing, compact:true }),
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
      rows.push(fields.buildPairRow(
        fields.buildChoiceField('invSource', 'Źródło', INVESTOR_SOURCE_OPTIONS, draft.source, '', { readonlyPreview:!isEditing, allowEmpty:true }),
        '',
        { full:true }
      ));
    }
    rows.push(fields.buildPairRow(
      fields.buildInputField('invNotes', fields.buildStaticLabel('Dodatkowe informacje'), draft.notes, { readonly:!isEditing, full:true, textarea:true, rows:3 }),
      '',
      { full:true }
    ));

    return `
      <div class="card investor-card-sync" data-investor-editing="${isEditing ? '1' : '0'}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Inwestor</h3>
        </div>

        <div class="investor-choice-grid">
          ${fields.buildChoiceField('invKind', 'Typ', typeOptions, draft.kind || 'person', 'investor-choice-field--kind', { readonlyPreview:!isEditing })}
          ${fields.buildInputField('invAddedDate', fields.buildStaticLabel('Data dodania'), normalizeDateInput(draft.addedDate || inv.addedDate || inv.createdAt), { readonly:!isEditing, compact:true, inputType:'date', displayValue:formatDateDisplay(draft.addedDate || inv.addedDate || inv.createdAt) })}
        </div>

        <div class="investor-details-rows">
          ${rows.join('')}
        </div>

        <div class="investor-bottom-actions" id="investorActionBar">${bottomButtons}</div>
        <div class="investor-action-divider" aria-hidden="true"></div>

        <div class="investor-rooms-head">
          <h4 style="margin:0">Pomieszczenia</h4>
          <div class="investor-room-head-actions">
            <button class="btn-primary investor-add-room-btn${isEditing ? ' is-disabled' : ''}" type="button" data-investor-action="add-room" ${isEditing ? 'disabled' : ''}>Dodaj</button>
            <button class="btn investor-manage-rooms-btn${isEditing ? ' is-disabled' : ''}" type="button" data-investor-action="manage-rooms" ${isEditing ? 'disabled' : ''}>Edytuj</button>
          </div>
        </div>
        <div class="muted xs" style="margin-bottom:10px">Wyświetlam tylko pomieszczenia dodane do tego inwestora.</div>
        <div class="investor-room-quick-list">${projectCards}</div>
        ${isEditing ? '<div class="investor-disabled-note">W trybie edycji pomieszczenia, statusy projektów i górna nawigacja są zablokowane.</div>' : ''}
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
    const editorApi = editor();
    const choiceApi = choice();
    const persistenceApi = persistence();
    const actionsApi = actions();
    if(!(root && editorApi && persistenceApi)) return;

    persistUIInvestorId(inv.id);
    try{ guard() && guard().apply(!!editorApi.state.isEditing); }catch(_){ }

    const topActions = document.getElementById('investorActionBar');
    const kindSelect = document.getElementById('invKind');
    const fieldIds = ['invName','invPhone','invCity','invEmail','invAddress','invOwnerName','invSource','invNip','invNotes','invAddedDate'];
    const fields = fieldIds.reduce((acc, id)=> { acc[id] = document.getElementById(id); return acc; }, {});

    function currentInvestor(){
      return (persistenceApi && persistenceApi.getInvestorById(inv.id)) || (state.transientInvestor && String(state.transientInvestor.id || '') === String(inv.id || '') ? state.transientInvestor : null) || inv;
    }

    function refreshActionBar(){
      const currentState = editorApi ? editorApi.ensureInvestor(currentInvestor()) : { isEditing:false, dirty:false };
      if(!topActions) return;
      topActions.innerHTML = actionsApi ? actionsApi.buildActionBarHtml(currentState) : '';
      bindTopActions();
      try{ guard() && guard().apply(!!currentState.isEditing); }catch(_){ }
      try{
        if(roomUi() && typeof roomUi().mountProjectStatusChoices === 'function'){
          roomUi().mountProjectStatusChoices(currentInvestor(), PROJECT_STATUS_OPTIONS, {
            disabled: !!currentState.isEditing,
            onChange: async (roomId, value)=> {
              if(currentState.isEditing) return;
              const investorId = String(currentInvestor() && currentInvestor().id || '');
              try{
                if(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function'){
                  const validation = FC.projectStatusManualGuard.validateManualStatusChange(investorId, roomId, value);
                  if(validation && validation.blocked){
                    if(validation.requiresGeneration){
                      let confirmed = false;
                      try{
                        if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
                          confirmed = await FC.confirmBox.ask({
                            title:String(validation.title || 'Brak wyceny'),
                            message:String(validation.message || ''),
                            confirmText: validation.generationKind === 'final' ? 'Generuj końcową' : 'Generuj wstępną',
                            cancelText:'Wróć',
                            confirmTone:'success',
                            cancelTone:'neutral'
                          });
                        }
                      }catch(_){ confirmed = false; }
                      if(confirmed){
                        try{
                          const generated = await FC.projectStatusManualGuard.generateScopedQuoteForRoom(investorId, roomId, validation.generationKind, { openTab:true });
                          try{
                            if(FC.infoBox && typeof FC.infoBox.open === 'function'){
                              FC.infoBox.open({
                                title: validation.generationKind === 'final' ? 'Wycena końcowa wygenerowana' : 'Wycena wstępna wygenerowana',
                                message: `${validation.generationKind === 'final' ? 'Wygenerowano wycenę końcową' : 'Wygenerowano wycenę wstępną'} dla pomieszczenia „${generated && generated.roomLabel ? generated.roomLabel : (validation.roomLabel || roomId)}”. Zaakceptuj ją w dziale Wycena, aby przejść na status „${validation.targetLabel || value}”.`
                              });
                            }
                          }catch(_){ }
                          try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
                          return;
                        }catch(err){
                          try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Nie udało się wygenerować wyceny', message:String(err && err.message || err || 'Błąd generowania wyceny.') }); }catch(_){ }
                        }
                      }
                      render();
                      return;
                    }
                    try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:String(validation.title || 'Zmiana statusu zablokowana'), message:String(validation.message || '') }); }catch(_){ }
                    render();
                    return;
                  }
                }
              }catch(_){ }
              if(String(value || '') === 'wstepna_wycena' && FC.quoteScopeEntry && typeof FC.quoteScopeEntry.ensureScopedQuoteEntry === 'function'){
                try{
                  const scopeEntry = await FC.quoteScopeEntry.ensureScopedQuoteEntry({
                    investorId,
                    projectId: (function(){ try{ return FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' ? String((FC.projectStore.getByInvestorId(investorId) || {}).id || '') : ''; }catch(_){ return ''; } })(),
                    fallbackRoomId: roomId,
                    preliminary:true,
                    status:'wstepna_wycena',
                    openTab:true,
                  });
                  if(scopeEntry && scopeEntry.cancelled){
                    render();
                    return;
                  }
                  try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
                  render();
                  return;
                }catch(err){
                  try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Nie udało się otworzyć wyceny wstępnej', message:String(err && err.message || err || 'Błąd wejścia do wyceny wstępnej.') }); }catch(_){ }
                  render();
                  return;
                }
              }
              persistenceApi.setInvestorProjectStatus(investorId, roomId, value, { skipGuard:true });
              try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
              render();
            }
          });
        }
      }catch(_){ }
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
          state.newlyCreatedId = null;
          clearTransientInvestor();
          state.mode = 'list';
          persistUIInvestorId(null);
          try{ guard() && guard().apply(false); }catch(_){ }
          render();
        },
        onOpenExisting: (existingId)=> {
          if(!existingId) return;
          try{ persistenceApi && persistenceApi.setCurrentInvestorId && persistenceApi.setCurrentInvestorId(existingId); }catch(_){ }
          state.selectedId = existingId;
          state.newlyCreatedId = null;
          clearTransientInvestor();
          state.mode = 'detail';
          state.allowListAccess = false;
          persistUIInvestorId(existingId);
          render();
        }
      });
    }

    bindTopActions();

    if(choiceApi && typeof choiceApi.mountChoice === 'function' && kindSelect){
      choiceApi.mountChoice({
        mount: document.getElementById('invKindLaunch'),
        selectEl: kindSelect,
        title:'Wybierz typ',
        buttonClass:'investor-choice-launch',
        disabled: !(editorApi && editorApi.state.isEditing),
        placeholder:'Wybierz typ',
        onChange: (value)=>{
          if(!(editorApi && editorApi.state.isEditing)) return;
          editorApi.setField('kind', value);
          render();
        }
      });
    }

    const sourceSelect = document.getElementById('invSource');
    if(choiceApi && typeof choiceApi.mountChoice === 'function' && sourceSelect){
      choiceApi.mountChoice({
        mount: document.getElementById('invSourceLaunch'),
        selectEl: sourceSelect,
        title:'Wybierz źródło',
        buttonClass:'investor-choice-launch',
        disabled: !(editorApi && editorApi.state.isEditing),
        placeholder:'Wybierz typ',
        onChange: (value)=>{
          if(!(editorApi && editorApi.state.isEditing)) return;
          editorApi.setField('source', value);
          refreshActionBar();
        }
      });
    }

    Object.entries({
      invName: () => editorApi.setField((kindSelect && kindSelect.value) === 'company' ? 'companyName' : 'name', fields.invName && fields.invName.value),
      invPhone: () => patchFieldFromDom('invPhone', 'phone'),
      invCity: () => patchFieldFromDom('invCity', 'city'),
      invEmail: () => patchFieldFromDom('invEmail', 'email'),
      invAddress: () => patchFieldFromDom('invAddress', 'address'),
      invOwnerName: () => patchFieldFromDom('invOwnerName', 'ownerName'),
      invSource: () => patchFieldFromDom('invSource', 'source'),
      invNip: () => patchFieldFromDom('invNip', 'nip'),
      invNotes: () => patchFieldFromDom('invNotes', 'notes'),
      invAddedDate: () => patchFieldFromDom('invAddedDate', 'addedDate'),
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

    try{
      if(FC.investorRoomActions && typeof FC.investorRoomActions.bindRoomActions === 'function'){
        FC.investorRoomActions.bindRoomActions(root, inv, {
          isInvestorEditing: ()=> !!(editorApi && editorApi.state.isEditing),
          onUpdated: ()=>{
            try{ if(FC.roomRegistry && FC.roomRegistry.renderRoomsView) FC.roomRegistry.renderRoomsView(); }catch(_){ }
            render();
            try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
          }
        });
      }
    }catch(_){ }

    refreshActionBar();
  }

  FC.investorUI = {
    render,
    renderListOnly,
    state,
    getTransientInvestor,
    setTransientInvestor,
    clearTransientInvestor,
    resolveInvestorForDetail,
    applyInvestorUiLocks: (inv)=> { try{ guard() && guard().apply(!!(editor() && editor().state.isEditing && inv && editor().state.investorId === inv.id)); }catch(_){ } },
  };
})();
