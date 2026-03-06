// js/app/material-common.js
// Wspólne helpery materiałowe i formatowanie używane przez app.js oraz zakładkę MATERIAŁ.

(function(){
  'use strict';
  window.FC = window.FC || {};
  const api = window.FC.materialCommon = window.FC.materialCommon || {};

  api.FC_BOARD_THICKNESS_CM = 1.8;
  api.FC_TOP_TRAVERSE_DEPTH_CM = 9;

  api.fmtCm = function fmtCm(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return String(v ?? '');
    return (Math.round(n * 10) / 10).toString();
  };

  api.formatM2 = function formatM2(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return '0.000';
    return (Math.round(n * 1000) / 1000).toFixed(3);
  };

  api.escapeHtml = function escapeHtml(str){
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch] || ch));
  };

  api.calcPartAreaM2 = function calcPartAreaM2(p){
    const a = Number(p.a) || 0;
    const b = Number(p.b) || 0;
    const qty = Number(p.qty) || 0;
    return qty * (a * b) / 10000;
  };

  api.addArea = function addArea(map, material, area){
    const key = String(material || '');
    if(!key) return;
    map[key] = (map[key] || 0) + (Number(area) || 0);
  };

  api.totalsFromParts = function totalsFromParts(parts){
    const totals = {};
    (parts || []).forEach(p => api.addArea(totals, p.material, api.calcPartAreaM2(p)));
    return totals;
  };

  api.mergeTotals = function mergeTotals(target, src){
    for(const k in (src || {})){
      target[k] = (target[k] || 0) + (src[k] || 0);
    }
    return target;
  };

  api.totalsToRows = function totalsToRows(totals){
    return Object.entries(totals || {})
      .map(([material, m2]) => ({ material, m2 }))
      .filter(r => r.m2 > 0)
      .sort((a,b) => b.m2 - a.m2);
  };

  api.renderTotals = function renderTotals(container, totals){
    container.innerHTML = '';
    const rows = api.totalsToRows(totals);
    if(!rows.length){
      const em = document.createElement('div');
      em.className = 'muted xs';
      em.textContent = '—';
      container.appendChild(em);
      return;
    }
    rows.forEach(r => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.gap = '10px';
      row.style.padding = '2px 0';

      const left = document.createElement('div');
      left.className = 'muted xs';
      left.style.fontWeight = '900';
      left.textContent = r.material;

      const right = document.createElement('div');
      right.className = 'muted xs';
      right.style.fontWeight = '900';
      right.textContent = `${api.formatM2(r.m2)} m²`;

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });
  };

  api.getCabinetAssemblyRuleText = function getCabinetAssemblyRuleText(cab){
    if(cab.type === 'wisząca' || cab.type === 'moduł'){
      return 'Skręcanie: wieniec górny i dolny między bokami.';
    }
    if(cab.type === 'stojąca'){
      return `Skręcanie: wieniec dolny pod bokami (boki niższe o ${api.FC_BOARD_THICKNESS_CM} cm); góra na trawersach 2×${api.FC_TOP_TRAVERSE_DEPTH_CM} cm (przód+tył).`;
    }
    return 'Skręcanie: —';
  };
})();
