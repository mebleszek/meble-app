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
  function clone(value){ try{ return JSON.parse(JSON.stringify(value || {})); }catch(_){ return Object.assign({}, value || {}); } }
  function formatKm(value){
    const n = num(value, 0);
    return n > 0 ? n.toLocaleString('pl-PL', { maximumFractionDigits:1 }) + ' km' : '—';
  }
  function formatMeters(value){
    const n = Math.round(num(value, 0));
    if(n <= 0) return '—';
    if(n < 1000) return n + ' m';
    return formatKm(n / 1000);
  }
  function formatMin(value){
    const n = Math.round(num(value, 0));
    return n > 0 ? n + ' min' : '—';
  }
  function normalizeGeocode(input){
    const src = input && typeof input === 'object' ? input : {};
    const coords = Array.isArray(src.coordinates) ? src.coordinates : [];
    return {
      input:text(src.input || ''),
      query:text(src.query || ''),
      label:text(src.label || ''),
      name:text(src.name || ''),
      layer:text(src.layer || ''),
      source:text(src.source || ''),
      confidence:text(src.confidence || ''),
      accuracy:text(src.accuracy || ''),
      country:text(src.country || ''),
      region:text(src.region || ''),
      county:text(src.county || ''),
      locality:text(src.locality || ''),
      localadmin:text(src.localadmin || ''),
      borough:text(src.borough || ''),
      postalcode:text(src.postalcode || ''),
      street:text(src.street || ''),
      housenumber:text(src.housenumber || ''),
      expectedLocality:text(src.expectedLocality || ''),
      expectedPostalCode:text(src.expectedPostalCode || ''),
      localityMatch:text(src.localityMatch || ''),
      postalCodeMatch:text(src.postalCodeMatch || ''),
      candidateCount:text(src.candidateCount || ''),
      coordinates:coords.length >= 2 ? [num(coords[0], 0), num(coords[1], 0)] : [],
      lon:text(src.lon || (coords.length >= 2 ? coords[0] : '')),
      lat:text(src.lat || (coords.length >= 2 ? coords[1] : ''))
    };
  }
  function hasGeocode(meta){
    const m = normalizeGeocode(meta);
    return !!(m.label || m.query || (Array.isArray(m.coordinates) && m.coordinates.length >= 2));
  }
  function normalizeTransport(input){
    const src = input && typeof input === 'object' ? input : {};
    const status = text(src.status || '') || (text(src.source || '') ? (text(src.source || '').toLowerCase().includes('openroute') ? 'success' : 'manual') : '');
    return {
      distanceKm:src.distanceKm === '' || src.distanceKm == null ? '' : String(src.distanceKm),
      durationMin:src.durationMin === '' || src.durationMin == null ? '' : String(src.durationMin),
      routeDistanceMeters:src.routeDistanceMeters === '' || src.routeDistanceMeters == null ? '' : String(src.routeDistanceMeters),
      routeDurationSeconds:src.routeDurationSeconds === '' || src.routeDurationSeconds == null ? '' : String(src.routeDurationSeconds),
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
      originGeocode:normalizeGeocode(src.originGeocode),
      destinationGeocode:normalizeGeocode(src.destinationGeocode),
      orsMapsUrl:text(src.orsMapsUrl || ''),
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
  function billableBreakdown(distanceKm){
    const profile = companyProfile() || {};
    const transport = profile.transport || {};
    const oneWay = Math.max(0, num(distanceKm, 0));
    const isRoundTrip = text(transport.billingMode || 'round_trip') !== 'one_way';
    const multiplier = isRoundTrip ? 2 : 1;
    const multiplied = Math.round(oneWay * multiplier * 100) / 100;
    const step = Math.max(0, num(transport.roundingKm, 0));
    const rounded = step > 0 ? Math.ceil((multiplied - 1e-9) / step) * step : multiplied;
    const minimum = Math.max(0, num(transport.minimumBillableKm, 0));
    const finalKm = minimum > 0 ? Math.max(rounded, minimum) : rounded;
    const rounded2 = Math.round(rounded * 100) / 100;
    const final2 = Math.round(finalKm * 100) / 100;
    const pieces = [];
    if(oneWay > 0){
      pieces.push(`${formatKm(oneWay)}${isRoundTrip ? ' × 2' : ''} = ${formatKm(multiplied)}`);
      if(step > 0 && Math.abs(rounded2 - multiplied) > 1e-9) pieces.push(`zaokrąglenie do ${formatKm(step)} → ${formatKm(rounded2)}`);
      else if(step > 0) pieces.push(`zaokrąglenie do ${formatKm(step)} bez zmiany`);
      if(minimum > 0 && final2 > rounded2) pieces.push(`minimum ${formatKm(minimum)} podniosło wynik → ${formatKm(final2)}`);
      else if(minimum > 0) pieces.push(`minimum ${formatKm(minimum)} nie zadziałało`);
    }
    return {
      oneWayKm:oneWay,
      multiplier,
      multipliedKm:multiplied,
      roundingKm:step,
      roundedKm:rounded2,
      minimumBillableKm:minimum,
      finalKm:final2,
      label:pieces.join(' • ')
    };
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
  function orsMapsUrl(transport){
    const t = normalizeTransport(transport);
    const service = ors();
    if(t.orsMapsUrl) return t.orsMapsUrl;
    if(service && typeof service.mapsClientUrl === 'function') return service.mapsClientUrl(t);
    return 'https://maps.openrouteservice.org';
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
  function geocodeLabel(meta){
    const m = normalizeGeocode(meta);
    const coord = m.coordinates.length >= 2 ? `${Number(m.coordinates[1]).toFixed(6)}, ${Number(m.coordinates[0]).toFixed(6)}` : '';
    const city = m.locality || m.localadmin || m.borough || '';
    const expected = m.expectedLocality ? `oczekiwana miejscowość: ${m.expectedLocality}` : '';
    const cityPart = city ? `miejscowość ORS: ${city}` : '';
    const post = m.postalcode ? `kod: ${m.postalcode}` : '';
    const candidates = m.candidateCount ? `sprawdzono wyników: ${m.candidateCount}` : '';
    const small = [m.layer ? `warstwa: ${m.layer}` : '', m.confidence ? `pewność: ${m.confidence}` : '', cityPart, post, expected, candidates, coord ? `współrzędne: ${coord}` : ''].filter(Boolean).join(' • ');
    return { title:m.label || m.name || 'brak etykiety ORS', query:m.query || '', details:small };
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
    const breakdown = billableBreakdown(distance);
    const billable = distance > 0 ? breakdown.finalKm : 0;
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
    const originGeo = geocodeLabel(t.originGeocode);
    const destGeo = geocodeLabel(t.destinationGeocode);
    const hasOriginGeo = hasGeocode(t.originGeocode);
    const hasDestGeo = hasGeocode(t.destinationGeocode);
    const rawDistance = num(t.routeDistanceMeters, 0);
    return `
      <details class="investor-transport-accordion" open>
        <summary class="investor-transport-accordion__summary">
          <span class="investor-transport-accordion__title">Dojazd / transport</span>
          <span class="investor-transport-accordion__sub${stale ? ' investor-transport-accordion__sub--warning' : ''}">${esc(formatKm(billable))} do wyceny</span>
          <span class="investor-transport-accordion__toggle" aria-hidden="true"></span>
        </summary>
        <div class="investor-transport-accordion__body">
          <div class="investor-transport-grid">
            <div><span>Trasa z ORS w jedną stronę</span><strong>${esc(formatKm(distance))}</strong><small>${rawDistance > 0 ? esc(formatMeters(rawDistance)) + ' surowo z API' : 'bez minimum cennika'}</small></div>
            <div><span>Kilometry do wyceny</span><strong>${esc(formatKm(billable))}</strong><small>${esc(modeLabel)}</small></div>
            <div><span>Czas dojazdu</span><strong>${esc(formatMin(t.durationMin))}</strong></div>
            <div><span>Źródło</span><strong>${esc(t.source || 'ręcznie')}</strong><small>${esc(t.provider || '')}</small></div>
            <div><span>Status</span><strong>${esc(status)}</strong><small>${esc(t.routeProfile || '')}</small></div>
          </div>
          ${breakdown.label ? `<div class="investor-transport-formula"><strong>Jak liczono km do wyceny:</strong> ${esc(breakdown.label)}</div>` : ''}
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
            ${hasOriginGeo || hasDestGeo ? `
              <div class="investor-transport-diagnostics">
                <strong>Diagnostyka ORS:</strong>
                ${hasOriginGeo ? `<div><span>Start rozpoznany jako:</span> ${esc(originGeo.title)}${originGeo.query ? `<small>Zapytanie do geokodowania: ${esc(originGeo.query)}</small>` : ''}${originGeo.details ? `<small>${esc(originGeo.details)}</small>` : ''}</div>` : ''}
                ${hasDestGeo ? `<div><span>Cel rozpoznany jako:</span> ${esc(destGeo.title)}${destGeo.query ? `<small>Zapytanie do geokodowania: ${esc(destGeo.query)}</small>` : ''}${destGeo.details ? `<small>${esc(destGeo.details)}</small>` : ''}</div>` : ''}
              </div>` : ''}
            ${stale ? `<div class="investor-transport-warning"><strong>Uwaga:</strong> adres firmy albo klienta zmienił się po ostatnim przeliczeniu. Kliknij „Przelicz trasę”, żeby odświeżyć km.</div>` : ''}
            ${t.note ? `<div><strong>Notatka:</strong> ${esc(t.note)}</div>` : ''}
            ${t.lastError ? `<div class="investor-transport-error"><strong>Błąd:</strong> ${esc(t.lastError)}</div>` : ''}
            ${attribution ? `<div class="investor-transport-attribution">${esc(attribution)}</div>` : ''}
          </div>
          <div class="investor-transport-actions">
            <button class="btn btn-primary" type="button" data-investor-transport-action="open-maps">Otwórz trasę w mapach</button>
            <button class="btn btn-primary" type="button" data-investor-transport-action="open-ors-maps">Sprawdź w ORS</button>
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

    rootNode.querySelectorAll('[data-investor-transport-action="open-ors-maps"]').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const url = orsMapsUrl(investor && investor.transport);
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
          const next = normalizeTransport(Object.assign({}, investor.transport || {}, clone(result), {
            distanceKm:String(result.distanceKm),
            durationMin:String(result.durationMin),
            routeDistanceMeters:String(result.routeDistanceMeters || ''),
            routeDurationSeconds:String(result.routeDurationSeconds || '')
          }));
          saveTransport(investor, next);
          const saved = geocodeLabel(next.destinationGeocode).title;
          showInfo('Trasa przeliczona', 'Zapisano ' + formatKm(result.distanceKm) + ' w jedną stronę. Do wyceny trafi ' + formatKm(billableKm(result.distanceKm)) + '. ORS rozpoznał cel jako: ' + saved + '.');
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
    const breakdown = billableBreakdown(oneWay);
    const billable = oneWay > 0 ? breakdown.finalKm : 0;
    const companyAddr = companyAddress();
    const clientAddr = investorAddress(investor || {});
    return {
      investor,
      transport:t,
      oneWayKm:oneWay,
      billableKm:billable,
      billableBreakdown:breakdown,
      isStale:isStale(t, companyAddr, clientAddr),
      status:statusLabel(t, companyAddr, clientAddr),
      displayValue:formatKm(billable)
    };
  }

  FC.investorTransport = {
    normalizeTransport,
    normalizeGeocode,
    renderPanel,
    bindPanel,
    getCurrentTransportContext,
    billableKm,
    billableBreakdown,
    formatKm,
    investorAddress,
    companyAddress,
    mapsUrl,
    orsMapsUrl
  };
})();
