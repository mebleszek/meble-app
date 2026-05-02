// js/app/investor/investor-ui.js
// UI shell zakładki/ekranu INWESTOR (lista + karta inwestora).
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

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
  function persistence(){ return FC.investorPersistence || null; }
  function guard(){ return FC.investorNavigationGuard || null; }
  function actions(){ return FC.investorActions || null; }
  function renderer(){ return FC.investorUiRender || null; }
  function statusFlow(){ return FC.investorUiStatus || null; }

  function buildList(list){
    const api = renderer();
    return api && typeof api.buildList === 'function'
      ? api.buildList(list, state)
      : '<div class="muted">Brak modułu renderu inwestora.</div>';
  }

  function buildDetail(inv){
    const api = renderer();
    return api && typeof api.buildDetail === 'function'
      ? api.buildDetail(inv)
      : '<div class="muted">Brak modułu renderu inwestora.</div>';
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

  function renderList(root){
    const list = persistence().searchInvestors(state.query);
    root.innerHTML = buildList(list);
    bindList(root);
  }

  function renderListOnly(targetEl){
    const el = targetEl;
    if(!el) return;
    if(!persistence()){
      el.innerHTML = '<div class="muted">Brak modułu bazy inwestorów.</div>';
      return;
    }
    renderList(el);
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

  function resetToList(root){
    state.mode = 'list';
    state.allowListAccess = true;
    state.selectedId = null;
    state.newlyCreatedId = null;
    clearTransientInvestor();
    try{ persistence() && typeof persistence().setCurrentInvestorId === 'function' && persistence().setCurrentInvestorId(null); }catch(_){ }
    persistUIInvestorId(null);
    try{ guard() && guard().apply(false); }catch(_){ }
    renderList(root);
  }

  function normalizeRenderState(currentId){
    const transient = getTransientInvestor();
    if(state.selectedId == null && currentId) state.selectedId = currentId;
    if(state.selectedId == null && transient && transient.id) state.selectedId = String(transient.id);
    ensureInvestorContext(currentId);
    if(!state.allowListAccess && state.selectedId) state.mode = 'detail';
    if(state.mode === 'detail' && !state.selectedId && currentId) state.selectedId = currentId;
    if(state.mode === 'detail' && !state.selectedId && transient && transient.id) state.selectedId = String(transient.id);
    if(state.mode === 'detail' && !state.selectedId) state.mode = 'list';
  }

  function render(){
    const root = getRoot();
    if(!root) return;

    if(!persistence()){
      root.innerHTML = '<div class="card"><h3>Inwestor</h3><div class="muted">Brak modułu bazy inwestorów.</div></div>';
      return;
    }

    const currentId = persistence().getCurrentInvestorId() || readUIInvestorId();
    normalizeRenderState(currentId);

    if(state.mode === 'detail'){
      const inv = resolveInvestorForDetail(state.selectedId, currentId);
      if(!inv){
        resetToList(root);
        return;
      }
      persistUIInvestorId((persistence().getInvestorById(inv.id) ? inv.id : null));
      root.innerHTML = buildDetail(inv);
      bindDetail(inv);
      return;
    }

    try{ guard() && guard().apply(false); }catch(_){ }
    renderList(root);
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

    let lastActionBarSignature = '';
    let lastGuardEditing = null;
    let statusChoicesMountedFor = '';

    function mountProjectStatusChoices(currentState, actionSignature){
      if(currentState.isEditing) return;
      const statusMountSignature = String(currentInvestor() && currentInvestor().id || '') + ':' + actionSignature;
      if(statusChoicesMountedFor === statusMountSignature) return;
      statusChoicesMountedFor = statusMountSignature;
      try{
        const statusApi = statusFlow();
        const renderApi = renderer();
        if(statusApi && typeof statusApi.mountProjectStatusChoices === 'function'){
          statusApi.mountProjectStatusChoices({
            roomUi: roomUi(),
            currentInvestor,
            currentState,
            persistenceApi,
            render,
            projectStatusOptions: renderApi && renderApi.PROJECT_STATUS_OPTIONS || [],
          });
        }
      }catch(_){ }
    }

    function refreshActionBar(){
      const currentState = editorApi ? editorApi.ensureInvestor(currentInvestor()) : { isEditing:false, dirty:false };
      const actionSignature = `${currentState.isEditing ? 1 : 0}:${currentState.dirty ? 1 : 0}`;
      if(topActions && actionSignature !== lastActionBarSignature){
        topActions.innerHTML = actionsApi ? actionsApi.buildActionBarHtml(currentState) : '';
        bindTopActions();
        lastActionBarSignature = actionSignature;
      }
      const editingNow = !!currentState.isEditing;
      if(lastGuardEditing !== editingNow){
        try{ guard() && guard().apply(editingNow); }catch(_){ }
        lastGuardEditing = editingNow;
      }
      mountProjectStatusChoices(currentState, actionSignature);
    }

    function patchFieldFromDom(id, key){
      if(!(editorApi && editorApi.state.isEditing)) return;
      const node = fields[id];
      if(!node) return;
      editorApi.setField(key, node.value || '');
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
