// js/app/investor/investor-transport.js
// Panel dojazdu/transportu przy inwestorze + opcjonalne przeliczenie OpenRouteService.

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
    return text(value).replace(/[&<>"]/g, (ch)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch] || ch));
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
    return {
      distanceKm:src.distanceKm === '' || src.distanceKm == null ? '' : String(src.distanceKm),
      durationMin:src.durationMin === '' || src.durationMin == null ? '' : String(src.durationMin),
      source:text(src.source || ''),
      provider:text(src.provider || ''),
      calculatedAt:text(src.calculatedAt || ''),
      origin:text(src.origin || ''),
      destination:text(src.destination || ''),
      note:text(src.note || ''),
      lastError:text(src.lastError || '')
    };
  }
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

  function renderPanel(inv, draft, isEditing){
    const source = isEditing ? (draft || {}) : (inv || {});
    const t = normalizeTransport((isEditing ? source.transport : (inv && inv.transport)) || {});
    const company = companyProfile();
    const apiConfigured = !!(company && company.transport && text(company.transport.apiKey));
    const distance = num(t.distanceKm, 0);
    const billable = distance > 0 ? billableKm(distance) : 0;
    const modeLabel = FC.companyProfile && typeof FC.companyProfile.billingModeLabel === 'function'
      ? FC.companyProfile.billingModeLabel(company && company.transport && company.transport.billingMode)
      : 'tam i z powrotem';
    const disabledCalc = isEditing || !apiConfigured ? ' disabled' : '';
    const calcTitle = isEditing ? 'Zapisz dane inwestora przed przeliczeniem trasy.' : (!apiConfigured ? 'Wpisz klucz API OpenRouteService w trybiku.' : 'Przelicz trasę OpenRouteService');
    const attribution = company && company.transport ? text(company.transport.attribution) : '';
    return `
      <details class="investor-transport-accordion" open>
        <summary class="investor-transport-accordion__summary">
          <span class="investor-transport-accordion__title">Dojazd / transport</span>
          <span class="investor-transport-accordion__sub">${esc(formatKm(billable))} do wyceny</span>
          <span class="investor-transport-accordion__toggle" aria-hidden="true"></span>
        </summary>
        <div class="investor-transport-accordion__body">
          <div class="investor-transport-grid">
            <div><span>Trasa w jedną stronę</span><strong>${esc(formatKm(distance))}</strong></div>
            <div><span>Kilometry do wyceny</span><strong>${esc(formatKm(billable))}</strong><small>${esc(modeLabel)}</small></div>
            <div><span>Czas dojazdu</span><strong>${esc(formatMin(t.durationMin))}</strong></div>
            <div><span>Źródło</span><strong>${esc(t.source || 'ręcznie')}</strong><small>${esc(t.provider || '')}</small></div>
          </div>
          ${isEditing ? `
            <div class="investor-transport-edit-grid">
              <label><span>Km w jedną stronę</span><input id="invTransportDistanceKm" inputmode="decimal" value="${esc(t.distanceKm)}" /></label>
              <label><span>Czas w minutach</span><input id="invTransportDurationMin" inputmode="decimal" value="${esc(t.durationMin)}" /></label>
              <label class="investor-transport-note-field"><span>Notatka transportu</span><textarea id="invTransportNote">${esc(t.note)}</textarea></label>
            </div>` : ''}
          <div class="investor-transport-meta">
            <div><strong>Adres firmy:</strong> ${esc(companyAddress() || 'brak w trybiku')}</div>
            <div><strong>Adres klienta:</strong> ${esc(investorAddress(source) || 'brak adresu inwestora')}</div>
            <div><strong>Ostatnie przeliczenie:</strong> ${esc(dateLabel(t.calculatedAt))}</div>
            ${t.note ? `<div><strong>Notatka:</strong> ${esc(t.note)}</div>` : ''}
            ${t.lastError ? `<div class="investor-transport-error"><strong>Błąd:</strong> ${esc(t.lastError)}</div>` : ''}
            ${attribution ? `<div class="investor-transport-attribution">${esc(attribution)}</div>` : ''}
          </div>
          <div class="investor-transport-actions">
            <button class="btn btn-primary" type="button" data-investor-transport-action="open-maps">Otwórz trasę w mapach</button>
            <button class="btn btn-success" type="button" data-investor-transport-action="calculate-ors" title="${esc(calcTitle)}"${disabledCalc}>Przelicz trasę</button>
          </div>
        </div>
      </details>
    `;
  }

  async function geocode(query, apiKey){
    const url = 'https://api.openrouteservice.org/geocode/search?' + new URLSearchParams({ text:query, size:'1' }).toString();
    const res = await fetch(url, { headers:{ Authorization:apiKey } });
    if(!res.ok) throw new Error('Nie udało się odczytać adresu: ' + res.status);
    const json = await res.json();
    const coords = json && json.features && json.features[0] && json.features[0].geometry && json.features[0].geometry.coordinates;
    if(!Array.isArray(coords) || coords.length < 2) throw new Error('Nie znaleziono adresu: ' + query);
    return coords;
  }

  async function route(originCoords, destCoords, apiKey, profile){
    const res = await fetch('https://api.openrouteservice.org/v2/directions/' + encodeURIComponent(profile || 'driving-car'), {
      method:'POST',
      headers:{ Authorization:apiKey, 'Content-Type':'application/json' },
      body:JSON.stringify({ coordinates:[originCoords, destCoords] })
    });
    if(!res.ok) throw new Error('Nie udało się przeliczyć trasy: ' + res.status);
    const json = await res.json();
    const summary = json && json.routes && json.routes[0] && json.routes[0].summary;
    if(!summary) throw new Error('OpenRouteService nie zwrócił podsumowania trasy.');
    return { distanceKm:Math.round(num(summary.distance, 0) / 100) / 10, durationMin:Math.round(num(summary.duration, 0) / 60) };
  }

  function saveTransport(investor, transport){
    const patch = { transport:normalizeTransport(transport) };
    try{
      if(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function') return FC.investorPersistence.saveInvestorPatch(investor.id, patch);
    }catch(_){ }
    return false;
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
        const profile = companyProfile();
        const apiKey = profile && profile.transport && text(profile.transport.apiKey);
        const origin = companyAddress();
        const dest = investorAddress(investor);
        if(!apiKey || !origin || !dest) return;
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Liczenie...';
        try{
          const originCoords = await geocode(origin, apiKey);
          const destCoords = await geocode(dest, apiKey);
          const result = await route(originCoords, destCoords, apiKey, profile.transport.profile);
          const next = normalizeTransport(Object.assign({}, investor.transport || {}, {
            distanceKm:String(result.distanceKm),
            durationMin:String(result.durationMin),
            source:'OpenRouteService',
            provider:'openrouteservice',
            calculatedAt:new Date().toISOString(),
            origin,
            destination:dest,
            lastError:''
          }));
          saveTransport(investor, next);
          if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Trasa przeliczona', message:'Zapisano ' + formatKm(result.distanceKm) + ' w jedną stronę.' });
          if(typeof ctx.render === 'function') ctx.render();
        }catch(err){
          const next = normalizeTransport(Object.assign({}, investor.transport || {}, { lastError:text(err && err.message || err) }));
          saveTransport(investor, next);
          if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Nie udało się przeliczyć trasy', message:next.lastError });
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
    return { investor, transport:t, oneWayKm:oneWay, billableKm:billable, displayValue:formatKm(billable) };
  }

  FC.investorTransport = { normalizeTransport, renderPanel, bindPanel, getCurrentTransportContext, billableKm, formatKm };
})();
