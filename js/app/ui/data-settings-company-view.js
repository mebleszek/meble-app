// js/app/ui/data-settings-company-view.js
// Widok danych firmy i transportu w trybiku.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function text(value){ return String(value == null ? '' : value).trim(); }

  function makeInputField(label, value, onInput, opts){
    const options = opts || {};
    const wrap = h('label', { class:'data-settings-form-field' });
    wrap.appendChild(h('span', { class:'data-settings-form-label', text:label }));
    const tag = options.multiline ? 'textarea' : 'input';
    const input = h(tag, { class:'data-settings-form-control', value:value == null ? '' : value });
    if(options.type) input.setAttribute('type', options.type);
    if(options.placeholder) input.setAttribute('placeholder', options.placeholder);
    if(options.inputmode) input.setAttribute('inputmode', options.inputmode);
    if(options.autocomplete) input.setAttribute('autocomplete', options.autocomplete);
    if(tag === 'textarea') input.textContent = value == null ? '' : String(value);
    input.addEventListener('input', ()=> onInput(tag === 'textarea' ? input.value : input.value));
    wrap.appendChild(input);
    if(options.hint) wrap.appendChild(h('small', { class:'muted data-settings-form-hint', text:options.hint }));
    return wrap;
  }

  function getChoiceApi(){
    const api = FC.rozrysChoice;
    if(api && typeof api.createChoiceLauncher === 'function' && typeof api.openRozrysChoiceOverlay === 'function' && typeof api.setChoiceLaunchValue === 'function') return api;
    return null;
  }

  function makeChoiceButton(label){
    const api = getChoiceApi();
    if(api){
      const btn = api.createChoiceLauncher(label, '');
      btn.classList.add('data-settings-default-choice', 'rozrys-choice-launch--options-clean');
      return btn;
    }
    const btn = h('button', { type:'button', class:'rozrys-choice-launch rozrys-choice-launch--options-clean data-settings-default-choice' });
    btn.innerHTML = '<span class="rozrys-choice-launch__value"><span class="rozrys-choice-launch__label"></span><span class="rozrys-choice-launch__meta"></span></span><span class="rozrys-choice-launch__arrow">▾</span>';
    const labelEl = btn.querySelector('.rozrys-choice-launch__label');
    if(labelEl) labelEl.textContent = String(label || '');
    return btn;
  }

  function setChoiceButtonLabel(btn, label){
    const api = getChoiceApi();
    if(api) return api.setChoiceLaunchValue(btn, label, '');
    const labelEl = btn && btn.querySelector && btn.querySelector('.rozrys-choice-launch__label');
    if(labelEl) labelEl.textContent = String(label || '');
  }

  function makeChoiceField(label, options, value, onChange){
    const wrap = h('div', { class:'data-settings-default-field' });
    wrap.appendChild(h('div', { class:'data-settings-default-label', text:label }));
    const labelOf = (val)=> (options || []).find((row)=> String(row.value) === String(val || ''))?.label || String(val || '—');
    const btn = makeChoiceButton(labelOf(value));
    btn.addEventListener('click', async ()=>{
      const api = getChoiceApi();
      if(!api) return;
      const picked = await api.openRozrysChoiceOverlay({ title:'Wybierz: ' + label, value:String(value || ''), options });
      if(picked == null || String(picked) === String(value || '')) return;
      value = picked;
      setChoiceButtonLabel(btn, labelOf(value));
      if(typeof onChange === 'function') onChange(value);
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function render(scroll){
    if(!(scroll && h && FC.companyProfile)) return;
    let draft = FC.companyProfile.normalizeProfile(FC.companyProfile.read());
    scroll.innerHTML = '';

    const card = h('section', { class:'data-settings-card data-settings-company-card' });
    const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Dane firmy i transport' })]);
    const infoMessage = 'Tu trzymasz dane firmy, adres startowy trasy i konfigurację darmowego OpenRouteService/OpenStreetMap. Wpisujesz własny darmowy klucz użytkownika ORS; działa w limitach darmowego planu zewnętrznego dostawcy. Google Maps API nie jest używane.';
    if(FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function') titleRow.appendChild(FC.helpRegistry.createTrigger({ key:'dataSettings.company.card', title:'Dane firmy i transport', message:infoMessage, scope:'dataSettings', className:'info-trigger data-settings-card-info', stop:false }));
    card.appendChild(titleRow);

    const summary = h('div', { class:'data-settings-defaults-summary muted', text:FC.companyProfile.buildSummary(draft) });
    card.appendChild(summary);
    function refreshSummary(){ summary.textContent = FC.companyProfile.buildSummary(draft); }

    const companyGrid = h('div', { class:'data-settings-form-grid' });
    [
      ['Nazwa robocza', 'displayName'],
      ['Nazwa na dokumentach', 'legalName'],
      ['Właściciel', 'ownerName'],
      ['NIP', 'nip'],
      ['REGON', 'regon'],
      ['Adres firmy', 'addressLine'],
      ['Kod pocztowy', 'postalCode'],
      ['Miasto', 'city'],
      ['Kraj', 'country'],
      ['Telefon kontaktowy', 'phone'],
      ['E-mail', 'email'],
      ['Strona www', 'website']
    ].forEach(([label, key])=>{
      companyGrid.appendChild(makeInputField(label, draft.company[key], (val)=>{ draft.company[key] = text(val); refreshSummary(); }, { type:key === 'email' ? 'email' : 'text' }));
    });
    companyGrid.appendChild(makeInputField('Notatka', draft.company.notes, (val)=>{ draft.company.notes = text(val); refreshSummary(); }, { multiline:true }));

    const transportGrid = h('div', { class:'data-settings-form-grid' });
    transportGrid.appendChild(makeChoiceField('Kilometry do wyceny', [
      { value:'one_way', label:'W jedną stronę' },
      { value:'round_trip', label:'Tam i z powrotem' }
    ], draft.transport.billingMode, (val)=>{ draft.transport.billingMode = val; refreshSummary(); }));
    transportGrid.appendChild(makeChoiceField('Profil trasy', [
      { value:'driving-car', label:'Samochód osobowy / dostawczy lekki' },
      { value:'driving-hgv', label:'Ciężarowy / większy transport' }
    ], draft.transport.profile, (val)=>{ draft.transport.profile = val; refreshSummary(); }));
    transportGrid.appendChild(makeInputField('Zaokrąglaj km do', draft.transport.roundingKm, (val)=>{ draft.transport.roundingKm = val; refreshSummary(); }, { inputmode:'decimal', hint:'0 = bez zaokrąglania, 1 = do pełnego kilometra.' }));
    transportGrid.appendChild(makeInputField('Minimalna liczba km do wyceny', draft.transport.minimumBillableKm, (val)=>{ draft.transport.minimumBillableKm = val; refreshSummary(); }, { inputmode:'decimal' }));
    transportGrid.appendChild(makeInputField('Klucz API OpenRouteService', draft.transport.apiKey, (val)=>{ draft.transport.apiKey = text(val); refreshSummary(); }, { type:'password', autocomplete:'off', hint:'Własny darmowy klucz użytkownika OpenRouteService. Darmowy plan ma limity zapytań; bez klucza zostaje ręczne wpisywanie km i przycisk otwierania map.' }));
    transportGrid.appendChild(makeInputField('Atrybucja map', draft.transport.attribution, (val)=>{ draft.transport.attribution = text(val); refreshSummary(); }, { multiline:true }));

    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Dane firmy', [companyGrid], { open:true }) : companyGrid);
    card.appendChild(dom.makeAccordion ? dom.makeAccordion('Transport i trasy', [transportGrid], { open:false, infoMessage:'Adres klienta zostaje przy inwestorze. Tutaj ustawiasz adres startowy firmy, własny klucz ORS oraz zasady przeliczania kilometrów do kosztu transportu. Integracja jest darmowa tylko w limitach OpenRouteService i nie korzysta z Google Maps API.' }) : transportGrid);

    const actions = h('div', { class:'data-settings-actions data-settings-defaults-actions' });
    const resetBtn = h('button', { type:'button', class:'btn btn-danger', text:'Przywróć firmę' });
    const cancelBtn = h('button', { type:'button', class:'btn btn-primary', text:'Anuluj zmiany' });
    const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    resetBtn.addEventListener('click', ()=>{ draft = FC.companyProfile.normalizeProfile(FC.companyProfile.DEFAULT_COMPANY_PROFILE); render(scroll); });
    cancelBtn.addEventListener('click', ()=> render(scroll));
    saveBtn.addEventListener('click', ()=>{
      draft = FC.companyProfile.write(draft);
      refreshSummary();
      if(dom.info) dom.info('Zapisano', 'Dane firmy i ustawienia transportu zostały zapisane.');
    });
    actions.appendChild(resetBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    card.appendChild(actions);
    scroll.appendChild(card);
  }

  FC.dataSettingsCompanyView = { render };
})();
