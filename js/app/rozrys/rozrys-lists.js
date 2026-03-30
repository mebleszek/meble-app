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
    return h('span', { class:'table-dim table-dim--stacked' }, [
      h('span', { class:'table-dim__top', text:mmToUnitStr(wMm, unit) }),
      h('span', { class:'table-dim__x', text:'X' }),
      h('span', { class:'table-dim__bottom', text:mmToUnitStr(hMm, unit) }),
    ]);
  }

  function buildRotatedHead(label, cls){
    const th = h('th', { class:cls || '' });
    th.appendChild(h('span', { class:'table-head-rot', text:String(label || '') }));
    return th;
  }

  function buildStatusChip(status){
    const map = {
      ok: { cls:'is-ok', text:'OK' },
      missing: { cls:'is-missing', text:'BRAK' },
      extra: { cls:'is-extra', text:'NADMIAR' },
    };
    const cfg = map[status] || map.ok;
    return h('span', { class:`rozrys-status-chip ${cfg.cls}`, text:cfg.text });
  }

  function buildListTable(rows, unit, mode, mmToUnitStr){
    const wrap = h('div', { class:'rozrys-list-table-wrap' });
    const table = h('table', { class:`table-list ${mode === 'sheet' ? 'table-list--parts' : 'table-list--summary'}`.trim() });
    const colgroup = h('colgroup');
    if(mode === 'sheet'){
      colgroup.appendChild(h('col', { class:'col-name' }));
      colgroup.appendChild(h('col', { class:'col-dim' }));
      colgroup.appendChild(h('col', { class:'col-qty' }));
    }else{
      colgroup.appendChild(h('col', { class:'col-name' }));
      colgroup.appendChild(h('col', { class:'col-dim' }));
      colgroup.appendChild(h('col', { class:'col-num' }));
      colgroup.appendChild(h('col', { class:'col-num' }));
      colgroup.appendChild(h('col', { class:'col-num' }));
      colgroup.appendChild(h('col', { class:'col-status' }));
    }
    table.appendChild(colgroup);
    const thead = h('thead');
    const headRow = h('tr');
    if(mode === 'sheet'){
      headRow.appendChild(buildRotatedHead('Nazwa', 'col-name is-rotated'));
      headRow.appendChild(buildRotatedHead(`Wymiar (${unit})`, 'col-dim is-rotated'));
      headRow.appendChild(buildRotatedHead('Ilość', 'col-qty is-rotated'));
    } else {
      headRow.appendChild(buildRotatedHead('Formatka', 'col-name is-rotated'));
      headRow.appendChild(buildRotatedHead(`Wymiar (${unit})`, 'col-dim is-rotated'));
      headRow.appendChild(buildRotatedHead('Potrzebne', 'col-num is-rotated'));
      headRow.appendChild(buildRotatedHead('Rozrysowane', 'col-num is-rotated'));
      headRow.appendChild(buildRotatedHead('Różnica', 'col-num is-rotated'));
      headRow.appendChild(buildRotatedHead('Status', 'col-status is-rotated'));
    }
    thead.appendChild(headRow);
    const tbody = h('tbody');
    (rows || []).forEach((row)=>{
      const tr = h('tr');
      if(mode === 'sheet'){
        tr.appendChild(h('td', { class:'col-name', text: row.name || 'Element' }));
        const dimTd = h('td', { class:'col-dim' });
        dimTd.appendChild(buildDimNode(row.w, row.h, unit, mmToUnitStr));
        tr.appendChild(dimTd);
        tr.appendChild(h('td', { class:'col-qty', text:String(Math.max(0, Number(row.qty) || 0)) }));
      } else {
        tr.appendChild(h('td', { text: row.name || 'Element' }));
        const dimTd = h('td');
        dimTd.appendChild(buildDimNode(row.w, row.h, unit, mmToUnitStr));
        tr.appendChild(dimTd);
        tr.appendChild(h('td', { text:String(Math.max(0, Number(row.expectedQty) || 0)) }));
        tr.appendChild(h('td', { text:String(Math.max(0, Number(row.actualQty) || 0)) }));
        tr.appendChild(h('td', { text:String(Number(row.diff) > 0 ? `+${row.diff}` : row.diff || 0) }));
        const td = h('td');
        td.appendChild(buildStatusChip(row.status));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function buildRawTable(rows, unit, mmToUnitStr){
    const wrap = h('div', { class:'rozrys-list-table-wrap' });
    const table = h('table', { class:'table-list table-list--raw' });
    const colgroup = h('colgroup');
    colgroup.appendChild(h('col', { class:'col-name' }));
    colgroup.appendChild(h('col', { class:'col-dim' }));
    colgroup.appendChild(h('col', { class:'col-num' }));
    colgroup.appendChild(h('col', { class:'col-room' }));
    colgroup.appendChild(h('col', { class:'col-source' }));
    table.appendChild(colgroup);
    const thead = h('thead');
    const headRow = h('tr');
    headRow.appendChild(buildRotatedHead('Formatka', 'col-name is-rotated'));
    headRow.appendChild(buildRotatedHead(`Wymiar (${unit})`, 'col-dim is-rotated'));
    headRow.appendChild(buildRotatedHead('Ilość', 'col-num is-rotated'));
    headRow.appendChild(buildRotatedHead('Pomieszczenie', 'col-room is-rotated'));
    headRow.appendChild(buildRotatedHead('Źródło', 'col-source is-rotated'));
    thead.appendChild(headRow);
    const tbody = h('tbody');
    (rows || []).forEach((row)=>{
      const tr = h('tr');
      tr.appendChild(h('td', { class:'col-name', text: row.name || 'Element' }));
      const dimTd = h('td', { class:'col-dim' });
      dimTd.appendChild(buildDimNode(row.w, row.h, unit, mmToUnitStr));
      tr.appendChild(dimTd);
      tr.appendChild(h('td', { class:'col-num', text:String(Math.max(0, Number(row.qty) || 0)) }));
      tr.appendChild(h('td', { class:'col-room', text:String(row.room || '—') }));
      tr.appendChild(h('td', { class:'col-source', text:String(row.source || '—') }));
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderSummaryCard(ctx){
    const meta = ctx && ctx.meta || {};
    const diagnostics = ctx && ctx.diagnostics || null;
    const validationLabel = ctx && ctx.validationLabel || { tone:'is-muted', text:'Brak walidacji' };
    const summary = ctx && ctx.summary || { count:0, hasRealHalf:false, hasVirtualHalf:false };
    const pct = Number(ctx && ctx.wastePct) || 0;
    const cancelledNote = meta && meta.cancelled ? '<div class="muted xs" style="margin-top:6px;font-weight:700">Generowanie przerwane — pokazuję najlepszy wynik do tej pory.</div>' : '';
    const realHalfNote = summary.hasRealHalf ? '<div class="muted xs" style="margin-top:6px">Końcówka policzona na realnej połówce z magazynu, ale rysowana na pełnym arkuszu.</div>' : '';
    const virtualNote = summary.hasVirtualHalf ? '<div class="muted xs" style="margin-top:6px">Ostatnia końcówka liczona wirtualnie jako 0,5 płyty, ale rysowana na pełnym arkuszu.</div>' : '';
    const card = h('div', { class:'card', style:'margin:0' });
    card.appendChild(h('div', { html:`
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><strong>Materiał:</strong> ${meta.material}</div>
        <div><strong>Płyty:</strong> ${summary.sheetCountText || String(summary.count || 0)} szt.</div>
        <div><strong>Odpad:</strong> ${pct.toFixed(1)}%</div>
      </div>
      ${cancelledNote}
      ${realHalfNote}
      ${virtualNote}
    ` }));
    const validationRow = h('div', { class:'rozrys-validation-summary' });
    validationRow.appendChild(h('span', { class:`rozrys-pill ${validationLabel.tone}`, text:validationLabel.text }));
    if(diagnostics){
      validationRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Snapshot: ${diagnostics.resolvedRows.length} pozycji` }));
    }
    card.appendChild(validationRow);
    return card;
  }

  function renderExportRow(ctx, deps){
    const cfg = Object.assign({ openValidationListModal:null, buildCsv:null, downloadText:null, openPrintView:null, printLayout:null }, deps || {});
    const meta = ctx && ctx.meta || {};
    const sheets = Array.isArray(ctx && ctx.sheets) ? ctx.sheets : [];
    const diagnostics = ctx && ctx.diagnostics || null;
    const unit = String(ctx && ctx.unit || 'mm');
    const summary = ctx && ctx.summary || { count:0 };
    const edgeSubMm = Math.max(0, Number(ctx && ctx.edgeSubMm) || 0);
    const row = h('div', { class:'rozrys-list-actions', style:'justify-content:flex-end' });
    if(diagnostics && typeof cfg.openValidationListModal === 'function'){
      const listBtn = h('button', { class:'btn-primary', type:'button', text:'Lista formatek' });
      listBtn.addEventListener('click', ()=> cfg.openValidationListModal(meta.material, diagnostics, unit));
      row.appendChild(listBtn);
    }
    if(typeof cfg.buildCsv === 'function' && typeof cfg.downloadText === 'function'){
      const csvBtn = h('button', { class:'btn-primary', type:'button', text:'Eksport CSV' });
      csvBtn.addEventListener('click', ()=>{
        const csv = cfg.buildCsv(sheets, meta);
        cfg.downloadText('rozrys.csv', csv, 'text/csv;charset=utf-8');
      });
      row.appendChild(csvBtn);
    }
    if(typeof cfg.openPrintView === 'function' && cfg.printLayout && typeof cfg.printLayout.openPrint === 'function'){
      const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'Eksport PDF (drukuj)' });
      pdfBtn.addEventListener('click', ()=> cfg.printLayout.openPrint({ sheets, meta, unit, summary, edgeSubMm }));
      row.appendChild(pdfBtn);
    }
    return row;
  }

  function renderSheetCards(ctx, deps){
    const cfg = Object.assign({ drawSheet:null, openSheetListModal:null, mmToUnitStr:null, getSupplyMeta:null, getBoardMeta:null, calcDisplayWaste:null }, deps || {});
    const meta = ctx && ctx.meta || {};
    const diagnostics = ctx && ctx.diagnostics || null;
    const unit = String(ctx && ctx.unit || 'mm');
    const edgeSubMm = Math.max(0, Number(ctx && ctx.edgeSubMm) || 0);
    return (Array.isArray(ctx && ctx.sheets) ? ctx.sheets : []).map((sheet, index)=>{
      const box = h('div', { class:'card', style:'margin-top:12px' });
      const boardMeta = typeof cfg.getBoardMeta === 'function' ? cfg.getBoardMeta(sheet) : { boardW:0, boardH:0 };
      const waste = typeof cfg.calcDisplayWaste === 'function' ? cfg.calcDisplayWaste(sheet) : { total:0, waste:0, realHalf:false, virtualHalf:false };
      const wastePct = waste.total > 0 ? ((waste.waste / waste.total) * 100) : 0;
      const head = h('div', { style:'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start' });
      head.appendChild(h('div', { style:'font-weight:900', text:`Arkusz ${index + 1} • odpad ${wastePct.toFixed(1)}%${waste.realHalf ? ' • real 0,5 z magazynu' : (waste.virtualHalf ? ' • virtual 0,5 płyty' : '')}` }));
      const tools = h('div', { class:'rozrys-sheet-tools' });
      const supplyMeta = typeof cfg.getSupplyMeta === 'function' ? cfg.getSupplyMeta(sheet) : null;
      if(supplyMeta){
        tools.appendChild(h('span', { class:`rozrys-stock-chip ${supplyMeta.cls}`, text:supplyMeta.text }));
      }
      if(diagnostics && diagnostics.sheets && diagnostics.sheets[index] && typeof cfg.openSheetListModal === 'function'){
        const sheetBtn = h('button', { class:'btn', type:'button', text:'Formatki arkusza' });
        sheetBtn.addEventListener('click', ()=> cfg.openSheetListModal(meta.material, `Arkusz ${index + 1}`, diagnostics.sheets[index].rows, unit));
        tools.appendChild(sheetBtn);
      }
      if(typeof cfg.mmToUnitStr === 'function'){
        tools.appendChild(h('div', { class:'muted xs', text:`${cfg.mmToUnitStr(boardMeta.boardW, unit)}×${cfg.mmToUnitStr(boardMeta.boardH, unit)} ${unit}` }));
      }
      head.appendChild(tools);
      box.appendChild(head);
      const canvas = document.createElement('canvas');
      canvas.style.marginTop = '10px';
      canvas.style.display = 'block';
      canvas.style.maxWidth = '100%';
      box.appendChild(canvas);
      canvas.dataset.rozrysSheet = '1';
      canvas.__rozrysDrawPayload = { sheet, displayUnit: unit, edgeSubMm, boardMeta };
      if(typeof cfg.drawSheet === 'function') cfg.drawSheet(canvas, sheet, unit, edgeSubMm, boardMeta);
      return box;
    });
  }

  FC.rozrysLists = {
    buildDimNode,
    buildListTable,
    buildRawTable,
    renderSummaryCard,
    renderExportRow,
    renderSheetCards,
  };
})();
