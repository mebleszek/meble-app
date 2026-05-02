// js/app/investor/investor-ui-render.js
// Pure-ish HTML builders for INWESTOR screen; keeps investor-ui.js as a shell/binder.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const PROJECT_STATUS_OPTIONS = [
    { value: 'nowy', label: 'Nowy' },
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

  const TYPE_OPTIONS = [
    { value:'person', label:'Osoba prywatna' },
    { value:'company', label:'Firma' },
  ];

  function editor(){ return FC.investorEditorState || null; }
  function roomUi(){ return FC.investorRooms || null; }
  function links(){ return FC.investorLinks || null; }
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

  function buildList(list, state){
    const query = state && typeof state.query !== 'undefined' ? state.query : '';
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
          <input id="invSearch" placeholder="Szukaj po nazwie/telefonie..." value="${escapeAttr(query)}" />
          <button class="btn-primary" data-action="create-investor">+ Dodaj</button>
        </div>
        <div id="invItems" style="margin-top:12px">${items || '<div class="muted">Brak inwestorów.</div>'}</div>
      </div>
    `;
  }

  function buildInvestorRows({ fields, draft, inv, isEditing, isCompany, phoneLabel, emailLabel }){
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
    return rows;
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

    const projectCards = roomUi() && typeof roomUi().buildProjectCards === 'function'
      ? roomUi().buildProjectCards(inv, isEditing, PROJECT_STATUS_OPTIONS)
      : '<div class="muted">Brak dodanych pomieszczeń.</div>';

    const rows = buildInvestorRows({ fields, draft, inv, isEditing, isCompany, phoneLabel, emailLabel });

    return `
      <div class="card investor-card-sync" data-investor-editing="${isEditing ? '1' : '0'}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Inwestor</h3>
        </div>

        <div class="investor-choice-grid">
          ${fields.buildChoiceField('invKind', 'Typ', TYPE_OPTIONS, draft.kind || 'person', 'investor-choice-field--kind', { readonlyPreview:!isEditing })}
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

  FC.investorUiRender = {
    PROJECT_STATUS_OPTIONS,
    INVESTOR_SOURCE_OPTIONS,
    TYPE_OPTIONS,
    escapeHtml,
    escapeAttr,
    normalizeDateInput,
    formatDateDisplay,
    buildList,
    buildDetail,
  };
})();
