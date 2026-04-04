(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k === 'class') el.className = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function buildDimNode(wMm, hMm, unit, mmToUnitStr){
    return h('span', { class:'table-dim' }, [
      h('span', { class:'table-dim__left', text:mmToUnitStr(wMm, unit) }),
      h('span', { class:'table-dim__x', text:'x' }),
      h('span', { class:'table-dim__right', text:mmToUnitStr(hMm, unit) }),
    ]);
  }

  function buildVerticalHead(label, cls, options){
    const cfg = options && typeof options === 'object' ? options : {};
    const attrs = { class:`table-th-vertical ${cls || ''}`.trim() };
    if(cfg.colspan && Number(cfg.colspan) > 1) attrs.colspan = String(Math.round(Number(cfg.colspan)));
    const th = h('th', attrs);
    th.appendChild(h('span', { text:String(label || '') }));
    return th;
  }

  function buildStatusChip(status){
    const map = {
      ok: { cls:'is-ok', text:'OK' },
      missing: { cls:'is-missing', text:'BRK' },
      extra: { cls:'is-extra', text:'NAD' },
    };
    const cfg = map[status] || map.ok;
    return h('span', { class:`rozrys-status-chip ${cfg.cls}`, text:cfg.text });
  }

  function getRoomLabel(room){
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function') return FC.roomRegistry.getRoomLabel(room);
    }catch(_){ }
    return String(room || '—');
  }

  function parseCabinetNumbers(raw){
    const text = String(raw || '').trim();
    const matched = text.match(/#\s*\d+/g);
    const nums = (matched && matched.length ? matched : text.split('•')).map((part)=> String(part || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
    return Array.from(new Set(nums));
  }

  function chunkCabinetNumbers(nums, size){
    const out = [];
    for(let i = 0; i < nums.length; i += size) out.push(nums.slice(i, i + size));
    return out;
  }

  function buildCabinetCell(row){
    const wrap = h('div', { class:'table-cabcell' });
    const numsWrap = h('div', { class:'table-cabcell__nums' });
    const nums = parseCabinetNumbers(row && row.cabinet);
    const lines = chunkCabinetNumbers(nums.length ? nums : ['—'], 5);
    lines.forEach((line)=> numsWrap.appendChild(h('span', { text:line.join(', ') })));
    wrap.appendChild(numsWrap);
    return wrap;
  }

  function buildListTable(rows, unit, mode, mmToUnitStr){
    const wrap = h('div', { class:'rozrys-list-table-wrap' });
    const table = h('table', { class:`table-list table-list--${mode} ${mode === 'sheet' ? 'table-list--parts' : ''}`.trim() });
    const colgroup = h('colgroup');
    let cols = [];
    if(mode === 'sheet' || mode === 'raw') cols = ['col-name','col-dim','col-qty','col-cab','col-room'];
    else if(mode === 'resolved') cols = ['col-name','col-dim','col-qty','col-qty','col-diff','col-status','col-cab','col-room'];
    else cols = ['col-name','col-dim','col-qty','col-qty','col-diff','col-status'];
    cols.forEach((cls)=> colgroup.appendChild(h('col', { class:cls })));
    table.appendChild(colgroup);
    const thead = h('thead');
    const headRow = h('tr');
    if(mode === 'sheet'){
      headRow.appendChild(buildVerticalHead('Nazwa', 'col-name'));
      headRow.appendChild(buildVerticalHead(`Wymiar (${unit})`, 'col-dim'));
      headRow.appendChild(buildVerticalHead('Ilość', 'col-qty'));
      headRow.appendChild(buildVerticalHead('Szafka', 'col-cab'));
      headRow.appendChild(buildVerticalHead('Pomieszczenie', 'col-room'));
    } else if(mode === 'raw'){
      headRow.appendChild(buildVerticalHead('Formatka', 'col-name'));
      headRow.appendChild(buildVerticalHead(`Wymiar (${unit})`, 'col-dim'));
      headRow.appendChild(buildVerticalHead('Ilość', 'col-qty'));
      headRow.appendChild(buildVerticalHead('Szafka', 'col-cab'));
      headRow.appendChild(buildVerticalHead('Pomieszczenie', 'col-room'));
    } else if(mode === 'resolved'){
      headRow.appendChild(buildVerticalHead('Formatka', 'col-name'));
      headRow.appendChild(buildVerticalHead(`Wymiar (${unit})`, 'col-dim'));
      headRow.appendChild(buildVerticalHead('Potrzebne', 'col-qty'));
      headRow.appendChild(buildVerticalHead('Rozrysowane', 'col-qty'));
      headRow.appendChild(buildVerticalHead('Różnica', 'col-diff'));
      headRow.appendChild(buildVerticalHead('Status', 'col-status'));
      headRow.appendChild(buildVerticalHead('Szafka', 'col-cab'));
      headRow.appendChild(buildVerticalHead('Pomieszczenie', 'col-room'));
    } else {
      headRow.appendChild(buildVerticalHead('Formatka', 'col-name'));
      headRow.appendChild(buildVerticalHead(`Wymiar (${unit})`, 'col-dim'));
      headRow.appendChild(buildVerticalHead('Potrzebne', 'col-qty'));
      headRow.appendChild(buildVerticalHead('Rozrysowane', 'col-qty'));
      headRow.appendChild(buildVerticalHead('Różnica', 'col-diff'));
      headRow.appendChild(buildVerticalHead('Status', 'col-status'));
    }
    thead.appendChild(headRow);
    const tbody = h('tbody');
    (rows || []).forEach((row)=>{
      const tr = h('tr');
      if(mode === 'sheet' || mode === 'raw'){
        tr.appendChild(h('td', { class:'col-name', text: row.name || 'Element' }));
        const dimTd = h('td', { class:'col-dim' });
        dimTd.appendChild(buildDimNode(row.w, row.h, unit, mmToUnitStr));
        tr.appendChild(dimTd);
        tr.appendChild(h('td', { class:'col-qty', text:String(Math.max(0, Number(row.qty) || 0)) }));
        const cabTd = h('td', { class:'col-cab' });
        cabTd.appendChild(buildCabinetCell(row));
        tr.appendChild(cabTd);
        tr.appendChild(h('td', { class:'col-room', text:getRoomLabel(row.room || '—') }));
      } else if(mode === 'resolved') {
        tr.appendChild(h('td', { class:'col-name', text: row.name || 'Element' }));
        const dimTd = h('td', { class:'col-dim' });
        dimTd.appendChild(buildDimNode(row.w, row.h, unit, mmToUnitStr));
        tr.appendChild(dimTd);
        tr.appendChild(h('td', { class:'col-qty', text:String(Math.max(0, Number(row.expectedQty) || 0)) }));
        tr.appendChild(h('td', { class:'col-qty', text:String(Math.max(0, Number(row.actualQty) || 0)) }));
        tr.appendChild(h('td', { class:'col-diff', text:String(Number(row.diff) > 0 ? `+${row.diff}` : row.diff || 0) }));
        const statusTd = h('td', { class:'col-status' });
        statusTd.appendChild(buildStatusChip(row.status));
        tr.appendChild(statusTd);
        const cabTd = h('td', { class:'col-cab' });
        cabTd.appendChild(buildCabinetCell(row));
        tr.appendChild(cabTd);
        tr.appendChild(h('td', { class:'col-room', text:getRoomLabel(row.room || '—') }));
      } else {
        tr.appendChild(h('td', { class:'col-name', text: row.name || 'Element' }));
        const dimTd = h('td', { class:'col-dim' });
        dimTd.appendChild(buildDimNode(row.w, row.h, unit, mmToUnitStr));
        tr.appendChild(dimTd);
        tr.appendChild(h('td', { class:'col-qty', text:String(Math.max(0, Number(row.expectedQty) || 0)) }));
        tr.appendChild(h('td', { class:'col-qty', text:String(Math.max(0, Number(row.actualQty) || 0)) }));
        tr.appendChild(h('td', { class:'col-diff', text:String(Number(row.diff) > 0 ? `+${row.diff}` : row.diff || 0) }));
        const statusTd = h('td', { class:'col-status' });
        statusTd.appendChild(buildStatusChip(row.status));
        tr.appendChild(statusTd);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function buildRawTable(rows, unit, mmToUnitStr){
    return buildListTable(rows, unit, 'raw', mmToUnitStr);
  }

  function renderSummaryCard(ctx){
    const meta = ctx && ctx.meta || {};
    const diagnostics = ctx && ctx.diagnostics || null;
    const validationLabel = ctx && ctx.validationLabel || { tone:'is-muted', text:'Brak walidacji' };
    const summary = ctx && ctx.summary || { count:0, hasRealHalf:false, hasVirtualHalf:false };
    const pct = Number(ctx && ctx.wastePct) || 0;
    const cancelledNote = meta && meta.cancelled ? '<div class="muted xs" style="margin-top:6px;font-weight:700">Generowanie przerwane — pokazuję ostatni spójny wynik.</div>' : '';
    const realHalfNote = summary.hasRealHalf ? '<div class="muted xs" style="margin-top:6px">Końcówka policzona na realnej połówce z magazynu, ale rysowana na pełnym arkuszu.</div>' : '';
    const virtualNote = summary.hasVirtualHalf ? '<div class="muted xs" style="margin-top:6px">Ostatnia końcówka liczona wirtualnie jako 0,5 płyty, ale rysowana na pełnym arkuszu.</div>' : '';
    return `
      <div class="build-card plan-card" style="margin-top:10px;">
        <div class="head">${meta.title || 'Rozpiska'}</div>
        <div class="muted" style="margin-bottom:8px">${meta.subtitle || ''}</div>
        <div class="rozrys-validation-summary">
          <span class="rozrys-pill ${validationLabel.tone}">${validationLabel.text}</span>
          <span class="rozrys-pill is-raw">Arkusze: ${summary.count || 0}</span>
          <span class="rozrys-pill is-raw">Odpad: ${pct.toFixed(1)}%</span>
          ${diagnostics ? `<span class="rozrys-pill is-raw">Snapshot: ${diagnostics.resolvedRows.length} pozycji</span>` : ''}
        </div>
        ${cancelledNote}
        ${realHalfNote}
        ${virtualNote}
      </div>
    `;
  }

  function renderPlanActions(ctx){
    const row = h('div', { class:'rozrys-list-actions', style:'justify-content:flex-end' });
    const cfg = ctx || {};
    if(typeof cfg.onList === 'function'){
      const listBtn = h('button', { class:'btn-primary', type:'button', text:'Lista formatek' });
      listBtn.addEventListener('click', cfg.onList);
      row.appendChild(listBtn);
    }
    if(typeof cfg.onCsv === 'function'){
      const csvBtn = h('button', { class:'btn-primary', type:'button', text:'Eksport CSV' });
      csvBtn.addEventListener('click', cfg.onCsv);
      row.appendChild(csvBtn);
    }
    if(typeof cfg.onPdf === 'function'){
      const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
      pdfBtn.addEventListener('click', cfg.onPdf);
      row.appendChild(pdfBtn);
    }
    return row;
  }

  FC.rozrysLists = {
    buildDimNode,
    buildListTable,
    buildRawTable,
    renderSummaryCard,
    renderPlanActions,
    buildStatusChip,
    parseCabinetNumbers,
  };
})();
