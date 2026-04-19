(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const STATUS_OPTIONS = [
    { value:'nowe', label:'Nowe' },
    { value:'w_trakcie', label:'W trakcie' },
    { value:'zakonczone', label:'Zakończone' },
  ];

  function byId(id){ return document.getElementById(id); }
  function escapeHtml(value){ return String(value == null ? '' : value).replace(/[&<>"']/g, (ch)=> ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch)); }
  function store(){ return FC.serviceOrderStore || FC.catalogStore || null; }
  function info(title, message){ try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title, message }); }catch(_){ } }
  async function ask(cfg){ try{ return !!(await (FC.confirmBox && FC.confirmBox.ask ? FC.confirmBox.ask(cfg) : true)); }catch(_){ return true; } }

  function getOrders(){
    if(store() && typeof store().readAll === 'function') return store().readAll();
    return store() && typeof store().getServiceOrders === 'function' ? store().getServiceOrders() : [];
  }

  function renderList(){
    const root = byId('serviceOrdersListRoot');
    if(!root) return;
    const rows = getOrders();
    root.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div>
            <h3 style="margin:0">Lista zleceń usługowych</h3>
            <div class="muted" style="margin-top:4px">Drobne usługi stolarskie mają własną listę niezależną od inwestorów.</div>
          </div>
          <button class="window-close-btn" type="button" aria-label="Zamknij listę zleceń" data-action="close-service-orders-list">×</button>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button class="btn-primary" type="button" data-action="new-service-order">Nowe zlecenie usługowe</button>
        </div>
        <div style="margin-top:12px">
          ${rows.length ? rows.map((row)=> `
            <div class="item" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:12px;margin:8px 0;">
              <div style="min-width:0">
                <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(row.title || 'Nowe zlecenie')}</div>
                <div class="muted xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml([row.customerName, row.phone, row.city].filter(Boolean).join(' • '))}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="muted xs" style="font-weight:800">${escapeHtml((STATUS_OPTIONS.find((opt)=> opt.value === row.status) || {}).label || row.status || 'Nowe')}</span>
                <button class="btn-primary" type="button" data-service-order-open="${escapeHtml(row.id)}">Otwórz</button>
                <button class="btn" type="button" data-service-order-edit="${escapeHtml(row.id)}">Edytuj</button>
              </div>
            </div>
          `).join('') : '<div class="muted" style="padding:12px 0">Brak zleceń usługowych.</div>'}
        </div>
      </div>
    `;
    root.querySelectorAll('[data-service-order-open]').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        try{ FC.serviceOrderDetail && typeof FC.serviceOrderDetail.open === 'function' && FC.serviceOrderDetail.open(btn.getAttribute('data-service-order-open')); }catch(_){ }
      });
    });
    root.querySelectorAll('[data-service-order-edit]').forEach((btn)=>{
      btn.addEventListener('click', ()=> openEditor(btn.getAttribute('data-service-order-edit')));
    });
  }

  function buildField(labelText, inputNode, full){
    const wrap = document.createElement('div');
    wrap.className = 'investor-choice-field';
    if(full) wrap.style.gridColumn = '1 / -1';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(inputNode);
    return wrap;
  }

  function fillStatusSelect(select, value){
    select.innerHTML = STATUS_OPTIONS.map((opt)=> `<option value="${escapeHtml(opt.value)}"${String(opt.value) === String(value || 'nowe') ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`).join('');
  }

  function openEditor(id){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const current = id ? (getOrders().find((row)=> String(row.id) === String(id)) || null) : null;
    const draft = Object.assign({ id:'', title:'', customerName:'', phone:'', city:'', description:'', status:'nowe' }, current || {});
    let dirty = false;
    const body = document.createElement('div');
    body.className = 'panel-box-form rozrys-panel-form rozrys-panel-form--stock';
    const scroll = document.createElement('div');
    scroll.className = 'panel-box-form__scroll';
    const grid = document.createElement('div');
    grid.className = 'grid-2';

    const titleInput = document.createElement('input'); titleInput.className = 'investor-form-input'; titleInput.type = 'text'; titleInput.value = draft.title || '';
    const customerInput = document.createElement('input'); customerInput.className = 'investor-form-input'; customerInput.type = 'text'; customerInput.value = draft.customerName || '';
    const phoneInput = document.createElement('input'); phoneInput.className = 'investor-form-input'; phoneInput.type = 'text'; phoneInput.value = draft.phone || '';
    const cityInput = document.createElement('input'); cityInput.className = 'investor-form-input'; cityInput.type = 'text'; cityInput.value = draft.city || '';
    const statusSelect = document.createElement('select'); statusSelect.className = 'investor-form-input'; fillStatusSelect(statusSelect, draft.status);
    const description = document.createElement('textarea'); description.className = 'investor-form-input investor-form-textarea'; description.value = draft.description || '';

    grid.appendChild(buildField('Nazwa zlecenia', titleInput, true));
    grid.appendChild(buildField('Klient', customerInput));
    grid.appendChild(buildField('Telefon', phoneInput));
    grid.appendChild(buildField('Miejscowość', cityInput));
    grid.appendChild(buildField('Status', statusSelect));
    grid.appendChild(buildField('Opis', description, true));
    scroll.appendChild(grid);
    body.appendChild(scroll);

    const footer = document.createElement('div'); footer.className = 'panel-box-form__footer rozrys-panel-footer';
    const actions = document.createElement('div'); actions.className = 'rozrys-panel-footer__actions';
    const deleteBtn = document.createElement('button'); deleteBtn.type = 'button'; deleteBtn.className = 'btn btn-danger'; deleteBtn.textContent = 'Usuń';
    const exitBtn = document.createElement('button'); exitBtn.type = 'button'; exitBtn.className = 'btn btn-primary'; exitBtn.textContent = 'Wyjdź';
    const cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.className = 'btn btn-danger'; cancelBtn.textContent = 'Anuluj'; cancelBtn.style.display = 'none';
    const saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'btn btn-success'; saveBtn.textContent = current ? 'Zapisz' : 'Dodaj'; saveBtn.style.display = 'none';
    if(current) actions.appendChild(deleteBtn);
    actions.appendChild(exitBtn); actions.appendChild(cancelBtn); actions.appendChild(saveBtn); footer.appendChild(actions); body.appendChild(footer);

    const signature = ()=> JSON.stringify({ title:titleInput.value, customerName:customerInput.value, phone:phoneInput.value, city:cityInput.value, status:statusSelect.value, description:description.value });
    const initial = signature();
    const refresh = ()=>{ dirty = signature() !== initial; exitBtn.style.display = dirty ? 'none' : ''; cancelBtn.style.display = dirty ? '' : 'none'; saveBtn.style.display = dirty ? '' : 'none'; };
    [titleInput, customerInput, phoneInput, cityInput, statusSelect, description].forEach((field)=>{ field.addEventListener('input', refresh); field.addEventListener('change', refresh); });

    const close = ()=>{ try{ FC.panelBox.close(); }catch(_){ } };
    const askDiscard = async ()=> !dirty || ask({ title:'ANULOWAĆ ZMIANY?', message:'Niezapisane zmiany w zleceniu zostaną utracone.', confirmText:'✕ ANULUJ ZMIANY', cancelText:'WRÓĆ', confirmTone:'danger', cancelTone:'neutral' });
    exitBtn.addEventListener('click', ()=> close());
    cancelBtn.addEventListener('click', async ()=>{ if(await askDiscard()) close(); });
    saveBtn.addEventListener('click', async ()=>{
      if(!String(titleInput.value || '').trim()){
        info('Brak nazwy', 'Wprowadź nazwę zlecenia, zanim je zapiszesz.');
        try{ titleInput.focus(); }catch(_){ }
        return;
      }
      const ok = await ask({ title: current ? 'ZAPISAĆ ZMIANY?' : 'DODAĆ ZLECENIE?', message: current ? 'Zapisać zmiany w zleceniu usługowym?' : 'Dodać nowe zlecenie usługowe?', confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
      if(!ok) return;
      const payload = {
        id: current ? current.id : undefined,
        title:titleInput.value,
        customerName:customerInput.value,
        phone:phoneInput.value,
        city:cityInput.value,
        status:statusSelect.value,
        description:description.value,
      };
      if(store() && typeof store().upsert === 'function') store().upsert(payload);
      else store() && store().upsertServiceOrder && store().upsertServiceOrder(payload);
      close();
      renderList();
    });
    deleteBtn.addEventListener('click', async ()=>{
      const ok = await ask({ title:'Usunąć zlecenie?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
      if(!ok) return;
      if(store() && typeof store().remove === 'function') store().remove(current.id);
      else store() && store().removeServiceOrder && store().removeServiceOrder(current.id);
      close();
      renderList();
    });

    FC.panelBox.open({ title: current ? 'Edytuj zlecenie usługowe' : 'Nowe zlecenie usługowe', contentNode: body, width:'780px', boxClass:'panel-box--rozrys', dismissOnOverlay:false, dismissOnEsc:true, beforeClose: async ()=> await askDiscard() });
    setTimeout(()=>{ try{ titleInput.focus(); }catch(_){ } }, 20);
  }

  FC.serviceOrders = {
    renderList,
    openEditor,
    getOrders,
    STATUS_OPTIONS,
  };
})();
