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


  function getResolvedWidthMap(){
    return {
      name: '8.2ch',
      dim: '5.2ch',
      qty: '3ch',
      diff: '3.1ch',
      status: '3.1ch',
      room: '10.4ch',
      cabMax: '23ch',
    };
  }

  function getReferenceColumnDefs(mode){
    const resolved = getResolvedWidthMap();
    const shared = {
      name: { cls:'col-name', width:resolved.name },
      dim: { cls:'col-dim', width:resolved.dim },
      qty: { cls:'col-qty', width:resolved.qty },
      diff: { cls:'col-diff', width:resolved.diff },
      status: { cls:'col-status', width:resolved.status },
      cab: { cls:'col-cab', width:null, maxWidth:resolved.cabMax },
      room: { cls:'col-room', width:resolved.room },
    };
    if(mode === 'raw' || mode === 'sheet') return [shared.name, shared.dim, shared.qty, shared.cab, shared.room];
    if(mode === 'resolved' || mode === 'merged') return [shared.name, shared.dim, shared.qty, shared.qty, shared.diff, shared.status, shared.cab, shared.room];
    return [shared.name, shared.dim, shared.qty, shared.qty, shared.diff, shared.status];
  }

  function tableWidthForMode(mode){
    return getReferenceColumnDefs(mode).map((col)=> String(col.width || '0px')).join(' + ');
  }

  function buildListTable(rows, unit, mode, mmToUnitStr){
    const wrap = h('div', { class:'rozrys-list-table-wrap' });
    const table = h('table', { class:`table-list table-list--${mode} ${mode === 'sheet' ? 'table-list--parts' : ''}`.trim() });
    table.style.width = 'max-content';
    if(mode === 'raw' || mode === 'sheet'){
      table.style.minWidth = `calc(${tableWidthForMode(mode)})`;
    } else {
      table.style.minWidth = `calc(${tableWidthForMode(mode)})`;
    }
    const colgroup = h('colgroup');
    const cols = getReferenceColumnDefs(mode);
    cols.forEach((col)=> {
      const attrs = { class:col.cls };
      const styles = [];
      if(col.width) styles.push(`width:${col.width}`);
      if(col.maxWidth) styles.push(`max-width:${col.maxWidth}`);
      if(styles.length) attrs.style = styles.join(';');
      colgroup.appendChild(h('col', attrs));
    });
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
    } else if(mode === 'merged'){
      headRow.appendChild(buildVerticalHead('Formatka', 'col-name'));
      headRow.appendChild(buildVerticalHead(`Wymiar (${unit})`, 'col-dim'));
      headRow.appendChild(buildVerticalHead('RAW', 'col-qty'));
      headRow.appendChild(buildVerticalHead('Po scaleniu', 'col-qty'));
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
    const validationLabel = ctx && ctx.validationLabel || { tone:'is-muted', text:'Brak walidacji' };
    const summary = ctx && ctx.summary || { count:0 };
    const pct = Number(ctx && ctx.wastePct) || 0;

    const card = h('div', { class:'build-card plan-card', style:'margin-top:10px;' });
    const summaryRow = h('div', { class:'rozrys-validation-summary' });
    summaryRow.appendChild(h('span', { class:`rozrys-pill ${validationLabel.tone || 'is-muted'}`, text: validationLabel.text || 'Brak walidacji' }));
    summaryRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Arkusze: ${summary.count || 0}` }));
    summaryRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Odpad: ${pct.toFixed(1)}%` }));
    card.appendChild(summaryRow);
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
      listBtn.addEventListener('click', ()=> cfg.openValidationListModal(meta.material, diagnostics, unit, { openPrintView:cfg.openPrintView, mmToUnitStr: FC.mmToUnitStr }));
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
      const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
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
      const box = h('div', { class:'card rozrys-sheet-card', style:'margin-top:12px', 'data-rozrys-sheet-card':'1', 'data-sheet-index':String(index) });
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
        sheetBtn.addEventListener('click', ()=> cfg.openSheetListModal(meta.material, `Arkusz ${index + 1}`, diagnostics.sheets[index].rows, unit, { openPrintView: FC.openPrintView, mmToUnitStr: FC.mmToUnitStr }));
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
      canvas.dataset.sheetIndex = String(index);
      canvas.__rozrysDrawPayload = { sheet, displayUnit: unit, edgeSubMm, boardMeta };
      if(typeof cfg.drawSheet === 'function') cfg.drawSheet(canvas, sheet, unit, edgeSubMm, boardMeta);
      return box;
    });
  }


  function renderSummarySection(ctx){
    const shell = h('div', { class:'rozrys-render-section rozrys-render-section--summary', 'data-rozrys-section':'summary' });
    const summaryCard = renderSummaryCard(ctx || {});
    if(summaryCard) shell.appendChild(summaryCard);
    return shell;
  }

  FC.rozrysLists = {
    buildDimNode,
    buildListTable,
    buildRawTable,
    renderSummaryCard,
    renderExportRow,
    renderSheetCards,
    renderSummarySection,
    buildStatusChip,
    parseCabinetNumbers,
  };
})();
