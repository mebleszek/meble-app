// js/app/investor/investor-transport.js
// Panel dojazdu/transportu przy inwestorze. Ręczne km + przeliczenie ORS po kliknięciu.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0);
  }
  function esc(value){
    return text(value).replace(/[&<>"']/g, (ch)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch));
  }
  function formatKm(value){
    const n = num(value, 0);
    return n > 0 ? n.toLocaleString('pl-PL', { maximumFractionDigits:1 }) + ' km' : '—';
  }
  function formatMin(value){
    const n = Math.round(num(value, 0));
    return n > 0 ? n + ' min' : '—';
  }
  function normalizeTransport(input){
    const src = input && typeof input === 'object' ? input : {};
    const status = text(src.status || '') || (text(src.source || '') ? (text(src.source || '').toLowerCase().includes('openroute') ? 'success' : 'manual') : '');
    return {
      distanceKm:src.distanceKm === '' || src.distanceKm == null ? '' : String(src.distanceKm),
      durationMin:src.durationMin === '' || src.durationMin == null ? '' : String(src.durationMin),
      source:text(src.source || ''),
      provider:text(src.provider || ''),
      status,
      calculatedAt:text(src.calculatedAt || ''),
      origin:text(src.origin || ''),
      destination:text(src.destination || ''),
      routeProfile:text(src.routeProfile || ''),
      originHash:text(src.originHash || ''),
      destinationHash:text(src.destinationHash || ''),
      addressHash:text(src.addressHash || src.routeAddressHash || ''),
      note:text(src.note || ''),
      lastError:text(src.lastError || '')
    };
  }
  function ors(){ return FC.openRouteServiceTransport || null; }
  function companyProfile(){
    try{ return FC.companyProfile && typeof FC.companyProfile.read === 'function' ? FC.companyProfile.read() : null; }catch(_){ return null; }
  }
  function companyAddress(){
    try{ return FC.companyProfile && typeof FC.companyProfile.companyAddress === 'function' ? FC.companyProfile.companyAddress(companyProfile()) : ''; }catch(_){ return ''; }
  }
  function investorAddress(inv){
    const parts = [];
    if(text(inv && inv.address)) parts.push(text(inv.address));
    if(text(inv && inv.city)) parts.push(text(inv.city));
    return parts.join(', ');
  }
  function billableKm(distanceKm){
    try{ return FC.companyProfile && typeof FC.companyProfile.billableDistanceKm === 'function' ? FC.companyProfile.billableDistanceKm(distanceKm, companyProfile()) : num(distanceKm, 0); }catch(_){ return num(distanceKm, 0); }
  }
  function dateLabel(value){
    if(!value) return '—';
    try{
      const d = new Date(value);
      if(Number.isFinite(d.getTime())) return d.toLocaleString('pl-PL');
    }catch(_){ }
    return value;
  }
  function mapsUrl(inv){
    const origin = companyAddress();
    const dest = investorAddress(inv);
    const params = new URLSearchParams({ api:'1', origin, destination:dest, travelmode:'driving' });
    return 'https://www.google.com/maps/dir/?' + params.toString();
  }
  function statusLabel(transport, origin, destination){
    const service = ors();
    const stale = service && typeof service.isResultStale === 'function' ? service.isResultStale(transport, origin, destination) : false;
    if(service && typeof service.resultStatusLabel === 'function') return service.resultStatusLabel(transport && transport.status, stale);
    if(stale) return 'wynik może być nieaktualny';
    return text(transport && transport.status) || 'ręcznie';
  }
  function isStale(transport, origin, destination){
    const service = ors();
    return !!(service && typeof service.isResultStale === 'function' && service.isResultStale(transport, origin, destination));
  }
  function showInfo(title, message){
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function') return FC.infoBox.open({ title, message });
    }catch(_){ }
    try{ console.info(title + ': ' + message); }catch(_){ }
    return null;
  }
  function saveTransport(investor, transport){
    const patch = { transport:normalizeTransport(transport) };
    try{
      if(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function') return FC.investorPersistence.saveInvestorPatch(investor.id, patch);
    }catch(_){ }
    return false;
  }
  function updateTransportError(investor, status, message){
    const prev = normalizeTransport(investor && investor.transport);
    const next = normalizeTransport(Object.assign({}, prev, { status:text(status || 'error') || 'error', lastError:text(message) }));
    saveTransport(investor, next);
    return next;
  }

  function renderPanel(inv, draft, isEditing){
    const source = isEditing ? (draft || {}) : (inv || {});
    const t = normalizeTransport((isEditing ? source.transport : (inv && inv.transport)) || {});
    const company = companyProfile();
    const distance = num(t.distanceKm, 0);
    const billable = distance > 0 ? billableKm(distance) : 0;
    const companyAddr = companyAddress();
    const clientAddr = investorAddress(source);
    const stale = isStale(t, companyAddr, clientAddr);
    const modeLabel = FC.companyProfile && typeof FC.companyProfile.billingModeLabel === 'function'
      ? FC.companyProfile.billingModeLabel(company && company.transport && company.transport.billingMode)
      : 'tam i z powrotem';
    const calcTitle = isEditing ? 'Zapisz dane inwestora przed przeliczeniem trasy.' : 'Przelicz trasę OpenRouteService';
    const attribution = company && company.transport ? text(company.transport.attribution) : '';
    const savedRoute = t.origin || t.destination ? `${t.origin || '—'} → ${t.destination || '—'}` : '';
    const status = statusLabel(t, companyAddr, clientAddr);
    return `
      <details class="investor-transport-accordion" open>
        <summary class="investor-transport-accordion__summary">
          <span class="investor-transport-accordion__title">Dojazd / transport</span>
          <span class="investor-transport-accordion__sub${stale ? ' investor-transport-accordion__sub--warning' : ''}">${esc(formatKm(billable))} do wyceny</span>
          <span class="investor-transport-accordion__toggle" aria-hidden="true"></span>
        </summary>
        <div class="investor-transport-accordion__body">
          <div class="investor-transport-grid">
            <div><span>Trasa w jedną stronę</span><strong>${esc(formatKm(distance))}</strong></div>
            <div><span>Kilometry do wyceny</span><strong>${esc(formatKm(billable))}</strong><small>${esc(modeLabel)}</small></div>
            <div><span>Czas dojazdu</span><strong>${esc(formatMin(t.durationMin))}</strong></div>
            <div><span>Źródło</span><strong>${esc(t.source || 'ręcznie')}</strong><small>${esc(t.provider || '')}</small></div>
            <div><span>Status</span><strong>${esc(status)}</strong><small>${esc(t.routeProfile || '')}</small></div>
          </div>
          ${isEditing ? `
            <div class="investor-transport-edit-grid">
              <label><span>Km w jedną stronę</span><input id="invTransportDistanceKm" inputmode="decimal" value="${esc(t.distanceKm)}" /></label>
              <label><span>Czas w minutach</span><input id="invTransportDurationMin" inputmode="decimal" value="${esc(t.durationMin)}" /></label>
              <label class="investor-transport-note-field"><span>Notatka transportu</span><textarea id="invTransportNote">${esc(t.note)}</textarea></label>
            </div>` : ''}
          <div class="investor-transport-meta">
            <div><strong>Adres firmy:</strong> ${esc(companyAddr || 'brak w trybiku')}</div>
            <div><strong>Adres klienta:</strong> ${esc(clientAddr || 'brak adresu inwestora')}</div>
            <div><strong>Ostatnie przeliczenie:</strong> ${esc(dateLabel(t.calculatedAt))}</div>
            ${savedRoute ? `<div><strong>Wynik liczony dla:</strong> ${esc(savedRoute)}</div>` : ''}
            ${stale ? `<div class="investor-transport-warning"><strong>Uwaga:</strong> adres firmy albo klienta zmienił się po ostatnim przeliczeniu. Kliknij „Przelicz trasę”, żeby odświeżyć km.</div>` : ''}
            ${t.note ? `<div><strong>Notatka:</strong> ${esc(t.note)}</div>` : ''}
            ${t.lastError ? `<div class="investor-transport-error"><strong>Błąd:</strong> ${esc(t.lastError)}</div>` : ''}
            ${attribution ? `<div class="investor-transport-attribution">${esc(attribution)}</div>` : ''}
          </div>
          <div class="investor-transport-actions">
            <button class="btn btn-primary" type="button" data-investor-transport-action="open-maps">Otwórz trasę w mapach</button>
            <button class="btn btn-success" type="button" data-investor-transport-action="calculate-ors" title="${esc(calcTitle)}">Przelicz trasę</button>
          </div>
        </div>
      </details>
    `;
  }

  function bindPanel(rootEl, ctx){
    const rootNode = rootEl || document;
    const investor = ctx && typeof ctx.getCurrentInvestor === 'function' ? ctx.getCurrentInvestor() : null;
    const editorApi = ctx && ctx.editorApi;
    if(!investor) return;

    ['invTransportDistanceKm','invTransportDurationMin','invTransportNote'].forEach((id)=>{
      const node = rootNode.querySelector('#' + id);
      if(!node) return;
      const key = id === 'invTransportDistanceKm' ? 'distanceKm' : (id === 'invTransportDurationMin' ? 'durationMin' : 'note');
      node.addEventListener('input', ()=>{
        if(!(editorApi && editorApi.state && editorApi.state.isEditing && typeof editorApi.setTransportField === 'function')) return;
        editorApi.setTransportField(key, node.value || '');
        if(typeof ctx.onDirty === 'function') ctx.onDirty();
      });
    });

    rootNode.querySelectorAll('[data-investor-transport-action="open-maps"]').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const url = mapsUrl(investor);
        try{ window.open(url, '_blank', 'noopener'); }catch(_){ window.location.href = url; }
      });
    });

    rootNode.querySelectorAll('[data-investor-transport-action="calculate-ors"]').forEach((btn)=>{
      btn.addEventListener('click', async ()=>{
        if(btn.disabled) return;
        if(editorApi && editorApi.state && editorApi.state.isEditing){
          showInfo('Najpierw zapisz inwestora', 'Przeliczenie trasy zapisuje wynik przy inwestorze. Zapisz zmiany adresu, a potem kliknij „Przelicz trasę”.');
          return;
        }
        const profile = companyProfile();
        const apiKey = profile && profile.transport && text(profile.transport.apiKey);
        const origin = companyAddress();
        const destination = investorAddress(investor);
        const service = ors();
        if(!(service && typeof service.calculateRoute === 'function')){
          showInfo('Nie udało się przeliczyć trasy', 'Brakuje modułu OpenRouteService. Wpisz kilometry ręcznie i zgłoś ten błąd.');
          return;
        }
        const validation = typeof service.validateRouteInput === 'function' ? service.validateRouteInput({ apiKey, origin, destination }) : { ok:true };
        if(!validation.ok){
          updateTransportError(investor, validation.status, validation.message);
          showInfo('Nie udało się przeliczyć trasy', validation.message);
          if(typeof ctx.render === 'function') ctx.render();
          return;
        }
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Liczenie...';
        try{
          const result = await service.calculateRoute({
            apiKey,
            origin,
            destination,
            profile:profile && profile.transport && profile.transport.profile
          });
          const next = normalizeTransport(Object.assign({}, investor.transport || {}, result, {
            distanceKm:String(result.distanceKm),
            durationMin:String(result.durationMin)
          }));
          saveTransport(investor, next);
          showInfo('Trasa przeliczona', 'Zapisano ' + formatKm(result.distanceKm) + ' w jedną stronę. Do wyceny trafi ' + formatKm(billableKm(result.distanceKm)) + '.');
          if(typeof ctx.render === 'function') ctx.render();
        }catch(err){
          const message = text(err && err.message || err) || 'Nieznany błąd OpenRouteService.';
          updateTransportError(investor, text(err && err.status) || 'error', message);
          showInfo('Nie udało się przeliczyć trasy', message);
          if(typeof ctx.render === 'function') ctx.render();
        }finally{
          btn.disabled = false;
          btn.textContent = oldText;
        }
      });
    });
  }

  function getCurrentTransportContext(){
    let investor = null;
    try{ investor = FC.investorPersistence && FC.investorPersistence.getCurrentInvestor && FC.investorPersistence.getCurrentInvestor(); }catch(_){ }
    if(!investor){
      try{
        const id = FC.investorPersistence && FC.investorPersistence.getCurrentInvestorId && FC.investorPersistence.getCurrentInvestorId();
        if(id && FC.investorPersistence.getInvestorById) investor = FC.investorPersistence.getInvestorById(id);
      }catch(_){ }
    }
    const t = normalizeTransport(investor && investor.transport);
    const oneWay = num(t.distanceKm, 0);
    const billable = oneWay > 0 ? billableKm(oneWay) : 0;
    const companyAddr = companyAddress();
    const clientAddr = investorAddress(investor || {});
    return {
      investor,
      transport:t,
      oneWayKm:oneWay,
      billableKm:billable,
      isStale:isStale(t, companyAddr, clientAddr),
      status:statusLabel(t, companyAddr, clientAddr),
      displayValue:formatKm(billable)
    };
  }

  FC.investorTransport = { normalizeTransport, renderPanel, bindPanel, getCurrentTransportContext, billableKm, formatKm, investorAddress, companyAddress };
})();
