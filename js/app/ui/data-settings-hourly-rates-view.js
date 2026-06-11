// js/app/ui/data-settings-hourly-rates-view.js
// Widok stawek godzinowych firmy w trybiku.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function codeOf(row){
    const l = FC.laborCatalog || {};
    const raw = row && (row.rateCode || row.rateKey || row.rateType || row.code);
    try{ return l.normalizeRateCode ? l.normalizeRateCode(raw) : text(raw); }catch(_){ return text(raw); }
  }
  function priceOf(row){ return Number(String(row && row.price != null ? row.price : '').replace(',', '.')) || 0; }

  function makeInput(label, value, onInput, opts){
    const options = opts || {};
    const wrap = h('label', { class:'data-settings-form-field' });
    wrap.appendChild(h('span', { class:'data-settings-form-label', text:label }));
    const input = h(options.multiline ? 'textarea' : 'input', { class:'data-settings-form-control' });
    if(options.type) input.setAttribute('type', options.type);
    if(options.inputmode) input.setAttribute('inputmode', options.inputmode);
    if(options.readonly){ input.setAttribute('readonly', 'readonly'); input.setAttribute('aria-readonly', 'true'); }
    if(options.placeholder) input.setAttribute('placeholder', options.placeholder);
    input.value = value == null ? '' : String(value);
    input.addEventListener('input', ()=> onInput(input.value));
    wrap.appendChild(input);
    if(options.hint) wrap.appendChild(h('small', { class:'muted data-settings-form-hint', text:options.hint }));
    return wrap;
  }

  function rateTitle(row){
    const code = codeOf(row);
    const price = priceOf(row);
    return `${row.name || 'Stawka godzinowa'}${code ? ' • ' + code : ''}${price > 0 ? ' • ' + price.toFixed(2) + ' zł/h' : ''}`;
  }

  function splitRows(rows){
    const system = [];
    const own = [];
    (rows || []).forEach((row)=> (row.systemRate ? system : own).push(row));
    return { system, own };
  }

  function renderRow(row, draft, actions){
    const card = h('div', { class:'data-settings-cost-row data-settings-hourly-rate-row' });
    const head = h('div', { class:'data-settings-cost-row__head' });
    const title = h('strong', { text:rateTitle(row) });
    head.appendChild(title);

    const active = h('button', { type:'button', class:'btn btn-sm ' + (row.active !== false ? 'btn-success' : 'btn-primary'), text:row.active !== false ? 'Aktywna' : 'Wyłączona' });
    function syncHeader(){
      title.textContent = rateTitle(row);
      active.className = 'btn btn-sm ' + (row.active !== false ? 'btn-success' : 'btn-primary');
      active.textContent = row.active !== false ? 'Aktywna' : 'Wyłączona';
      if(actions && actions.summary) actions.summary();
    }
    active.addEventListener('click', ()=>{ row.active = row.active === false; syncHeader(); });
    const rowActions = h('div', { class:'data-settings-cost-row__actions' }, [active]);
    if(row._new){
      const remove = h('button', { type:'button', class:'btn btn-sm btn-danger', text:'Usuń' });
      remove.addEventListener('click', ()=>{ draft.rows = draft.rows.filter((item)=> item.id !== row.id); if(actions && actions.redraw) actions.redraw(); });
      rowActions.appendChild(remove);
    }
    head.appendChild(rowActions);
    card.appendChild(head);

    const grid = h('div', { class:'data-settings-cost-grid' });
    const existing = !row._new;
    grid.appendChild(makeInput('Nazwa przyjazna', row.name, (val)=>{ row.name = text(val); row.label = row.name; syncHeader(); }));
    grid.appendChild(makeInput('Kod techniczny', row.rateCode || row.rateKey || row.rateType, (val)=>{
      const clean = FC.laborCatalog && FC.laborCatalog.normalizeRateCode ? FC.laborCatalog.normalizeRateCode(val) : text(val);
      row.rateCode = clean;
      row.rateKey = clean;
      row.rateType = clean;
      syncHeader();
    }, { readonly:existing, placeholder:'np. workshop albo painter', hint:existing ? 'Kod już istniejącej stawki jest zablokowany, żeby nie rozpiąć czynności w cenniku.' : 'Małe litery, cyfry i podkreślenia. Po zapisaniu kod zostanie zablokowany.' }));
    grid.appendChild(makeInput('Kwota PLN/h', row.price, (val)=>{ row.price = val; syncHeader(); }, { inputmode:'decimal' }));
    grid.appendChild(makeInput('Notatka', row.note, (val)=>{ row.note = text(val); if(actions && actions.summary) actions.summary(); }, { multiline:true }));
    card.appendChild(grid);
    return card;
  }

  function render(scroll){
    if(!(scroll && h && FC.hourlyRatesSettings)) return;
    let draft = { rows:FC.hourlyRatesSettings.read() };

    function draw(){
      const currentScroll = scroll.scrollTop;
      scroll.innerHTML = '';

      const card = h('section', { class:'data-settings-card data-settings-costs-card data-settings-hourly-rates-card' });
      const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Stawki godzinowe firmy' })]);
      const msg = 'Tu ustawiasz profile stawek godzinowych firmy. Czynność w cenniku nadal wybiera konkretną stawkę, np. warsztatową, montażową, specjalistyczną albo pomocnika. Kod techniczny po zapisaniu jest stały.';
      if(FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function') titleRow.appendChild(FC.helpRegistry.createTrigger({ key:'dataSettings.hourlyRates.card', title:'Stawki godzinowe firmy', message:msg, scope:'dataSettings', className:'info-trigger data-settings-card-info', stop:false }));
      card.appendChild(titleRow);

      const summary = h('div', { class:'data-settings-defaults-summary muted', text:FC.hourlyRatesSettings.buildSummary(draft.rows) });
      card.appendChild(summary);
      const actionsApi = {
        summary:()=>{ summary.textContent = FC.hourlyRatesSettings.buildSummary(draft.rows); },
        redraw:draw,
      };

      const addBtn = h('button', { type:'button', class:'btn btn-primary', text:'Dodaj stawkę godzinową' });
      addBtn.addEventListener('click', ()=>{ draft.rows.push(FC.hourlyRatesSettings.createBlankRate()); draw(); });
      card.appendChild(addBtn);

      const groups = splitRows(draft.rows);
      const systemBody = h('div', { class:'data-settings-cost-group' });
      groups.system.forEach((row)=> systemBody.appendChild(renderRow(row, draft, actionsApi)));
      card.appendChild(dom.makeAccordion ? dom.makeAccordion('Stawki systemowe', [systemBody], { open:true, sub:String(groups.system.length), infoMessage:'Systemowe stawki można edytować kwotą i nazwą przyjazną. Kodu technicznego nie zmieniamy.' }) : systemBody);

      const ownBody = h('div', { class:'data-settings-cost-group' });
      groups.own.forEach((row)=> ownBody.appendChild(renderRow(row, draft, actionsApi)));
      if(!groups.own.length) ownBody.appendChild(h('div', { class:'muted', text:'Brak własnych stawek. Dodaj własną, jeśli potrzebujesz np. lakiernika albo programisty CNC.' }));
      card.appendChild(dom.makeAccordion ? dom.makeAccordion('Własne stawki', [ownBody], { open:!!groups.own.length, sub:String(groups.own.length), infoMessage:'Własna stawka po zapisie dostaje stały kod techniczny. Żeby przestała pojawiać się przy nowych czynnościach, ustaw ją jako wyłączoną.' }) : ownBody);

      const bottomActions = h('div', { class:'data-settings-actions data-settings-defaults-actions' });
      const cancelBtn = h('button', { type:'button', class:'btn btn-danger', text:'Anuluj zmiany' });
      const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
      cancelBtn.addEventListener('click', ()=>{ draft = { rows:FC.hourlyRatesSettings.read() }; draw(); });
      saveBtn.addEventListener('click', ()=>{
        const result = FC.hourlyRatesSettings.write(draft.rows);
        if(!result || !result.ok){ if(dom.info) dom.info('Nie można zapisać stawek', String((result && result.message) || 'Sprawdź dane stawek godzinowych.')); return; }
        draft.rows = result.rows || FC.hourlyRatesSettings.read();
        if(dom.info) dom.info('Zapisano', 'Stawki godzinowe firmy zostały zapisane. Czynności czasowe w cenniku korzystają z tych profili.');
        draw();
      });
      bottomActions.appendChild(cancelBtn);
      bottomActions.appendChild(saveBtn);
      card.appendChild(bottomActions);
      scroll.appendChild(card);
      try{ scroll.scrollTop = currentScroll || 0; }catch(_){ }
    }

    draw();
  }

  FC.dataSettingsHourlyRatesView = { render };
})();
