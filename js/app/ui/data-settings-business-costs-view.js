// js/app/ui/data-settings-business-costs-view.js
// Widok kosztów firmy w trybiku.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function text(value){ return String(value == null ? '' : value).trim(); }

  function makeInput(label, value, onInput, opts){
    const options = opts || {};
    const wrap = h('label', { class:'data-settings-form-field' });
    wrap.appendChild(h('span', { class:'data-settings-form-label', text:label }));
    const input = h(options.multiline ? 'textarea' : 'input', { class:'data-settings-form-control', value:value == null ? '' : value });
    if(options.type) input.setAttribute('type', options.type);
    if(options.inputmode) input.setAttribute('inputmode', options.inputmode);
    if(options.multiline) input.textContent = value == null ? '' : String(value);
    input.addEventListener('input', ()=> onInput(input.value));
    wrap.appendChild(input);
    return wrap;
  }

  function rowTitle(row){
    const amount = row.amountNet ? (' • ' + row.amountNet + ' zł netto') : '';
    return (row.name || 'Koszt firmy') + amount;
  }

  function renderRow(row, draft, refresh){
    const card = h('div', { class:'data-settings-cost-row' });
    const head = h('div', { class:'data-settings-cost-row__head' });
    const active = h('button', { type:'button', class:'btn btn-sm ' + (row.active ? 'btn-success' : 'btn-primary'), text:row.active ? 'Aktywny' : 'Wyłączony' });
    active.addEventListener('click', ()=>{ row.active = !row.active; refresh(); });
    const remove = h('button', { type:'button', class:'btn btn-sm btn-danger', text:'Usuń' });
    remove.addEventListener('click', ()=>{ draft.rows = draft.rows.filter((item)=> item.id !== row.id); refresh(true); });
    head.appendChild(h('strong', { text:rowTitle(row) }));
    const actions = h('div', { class:'data-settings-cost-row__actions' }, [active, remove]);
    head.appendChild(actions);
    card.appendChild(head);

    const grid = h('div', { class:'data-settings-cost-grid' });
    grid.appendChild(makeInput('Nazwa kosztu', row.name, (val)=>{ row.name = text(val); refresh(); }));
    grid.appendChild(makeInput('Kategoria', row.category, (val)=>{ row.category = text(val); refresh(); }));
    grid.appendChild(makeInput('Kwota netto miesięcznie', row.amountNet, (val)=>{ row.amountNet = val; refresh(); }, { inputmode:'decimal' }));
    grid.appendChild(makeInput('VAT %', row.vatRate, (val)=>{ row.vatRate = val; refresh(); }, { inputmode:'decimal' }));
    grid.appendChild(makeInput('Dzień płatności', row.paymentDay, (val)=>{ row.paymentDay = text(val); refresh(); }, { inputmode:'numeric' }));
    grid.appendChild(makeInput('Notatka', row.note, (val)=>{ row.note = text(val); refresh(); }, { multiline:true }));
    card.appendChild(grid);
    return card;
  }

  function groupRows(rows){
    const map = new Map();
    (rows || []).forEach((row)=>{
      const key = text(row.category) || 'Inne';
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return Array.from(map.entries());
  }

  function render(scroll){
    if(!(scroll && h && FC.businessCosts)) return;
    let draft = FC.businessCosts.normalizeCosts(FC.businessCosts.read());
    scroll.innerHTML = '';

    const card = h('section', { class:'data-settings-card data-settings-costs-card' });
    const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Koszty firmy' })]);
    const msg = 'Tu wpisujesz koszty stałe i pomocnicze firmy: lokal, media, księgowa, ochrona, samochód, narzędzia, programy i inne. Na tym etapie program zapisuje i sumuje koszty; automatyczny narzut do WYCENY powinien być osobnym krokiem.';
    if(FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function') titleRow.appendChild(FC.helpRegistry.createTrigger({ key:'dataSettings.businessCosts.card', title:'Koszty firmy', message:msg, scope:'dataSettings', className:'info-trigger data-settings-card-info', stop:false }));
    card.appendChild(titleRow);

    const summary = h('div', { class:'data-settings-defaults-summary muted', text:FC.businessCosts.buildSummary(draft) });
    card.appendChild(summary);

    const stack = h('div', { class:'data-settings-cost-stack' });
    function refresh(full){
      draft = FC.businessCosts.normalizeCosts(draft);
      summary.textContent = FC.businessCosts.buildSummary(draft);
      if(full) render(scroll);
    }

    const addRow = h('button', { type:'button', class:'btn btn-primary', text:'Dodaj koszt' });
    addRow.addEventListener('click', ()=>{ draft.rows.push(FC.businessCosts.createBlankRow()); render(scroll); });
    card.appendChild(addRow);

    groupRows(draft.rows).forEach(([category, rows])=>{
      const body = h('div', { class:'data-settings-cost-group' });
      rows.forEach((row)=> body.appendChild(renderRow(row, draft, refresh)));
      card.appendChild(dom.makeAccordion ? dom.makeAccordion(category, [body], { open:false, sub:String(rows.length) }) : body);
    });

    const actions = h('div', { class:'data-settings-actions data-settings-defaults-actions' });
    const resetBtn = h('button', { type:'button', class:'btn btn-danger', text:'Przywróć listę' });
    const cancelBtn = h('button', { type:'button', class:'btn btn-primary', text:'Anuluj zmiany' });
    const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    resetBtn.addEventListener('click', ()=>{ draft = FC.businessCosts.normalizeCosts(FC.businessCosts.DEFAULT_BUSINESS_COSTS); render(scroll); });
    cancelBtn.addEventListener('click', ()=> render(scroll));
    saveBtn.addEventListener('click', ()=>{
      draft = FC.businessCosts.write(draft);
      summary.textContent = FC.businessCosts.buildSummary(draft);
      if(dom.info) dom.info('Zapisano', 'Koszty firmy zostały zapisane.');
    });
    actions.appendChild(resetBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    card.appendChild(actions);
    scroll.appendChild(card);
  }

  FC.dataSettingsBusinessCostsView = { render };
})();
