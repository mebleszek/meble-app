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

  function validationSummaryLabel(diag){
    const validation = diag && diag.validation;
    if(!validation) return { text:'Walidacja: brak danych', tone:'is-warn' };
    if(validation.ok) return { text:'Walidacja: OK — wszystkie formatki rozpisane', tone:'is-ok' };
    const parts = [];
    if(validation.missingQty > 0) parts.push(`braki ${validation.missingQty} szt.`);
    if(validation.extraQty > 0) parts.push(`nadmiary ${validation.extraQty} szt.`);
    return { text:`Walidacja: ${parts.join(' • ')}`, tone:'is-warn' };
  }

  function buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms, deps){
    const cfg = Object.assign({
      buildRawSnapshotForMaterial:null,
      buildResolvedSnapshotFromParts:null,
    }, deps || {});
    const rv = FC.rozrysValidation;
    if(!(rv && typeof rv.aggregateRows === 'function' && typeof rv.summarizePlan === 'function' && typeof rv.validate === 'function' && typeof rv.validateResolution === 'function')) return null;
    const rawRows = typeof cfg.buildRawSnapshotForMaterial === 'function'
      ? (cfg.buildRawSnapshotForMaterial(targetMaterial, mode, selectedRooms) || [])
      : [];
    const resolvedRows = rawRows.length
      ? rv.aggregateRows(rawRows)
      : (typeof cfg.buildResolvedSnapshotFromParts === 'function' ? cfg.buildResolvedSnapshotFromParts(parts) : []);
    const actual = rv.summarizePlan(plan, targetMaterial);
    const sourceByKey = new Map();
    rawRows.forEach((row)=>{
      const cur = sourceByKey.get(row.key) || { room:'', source:'', cabinet:'' };
      if(row.room && !String(cur.room || '').includes(row.room)) cur.room = [cur.room, row.room].filter(Boolean).join(' • ');
      if(row.source && !String(cur.source || '').includes(row.source)) cur.source = [cur.source, row.source].filter(Boolean).join(' • ');
      if(row.cabinet && !String(cur.cabinet || '').includes(row.cabinet)) cur.cabinet = [cur.cabinet, row.cabinet].filter(Boolean).join(' • ');
      sourceByKey.set(row.key, cur);
    });
    actual.rows = (actual.rows || []).map((row)=> Object.assign({}, row, sourceByKey.get(row.key) || {}));
    actual.sheets = (actual.sheets || []).map((sheet)=> Object.assign({}, sheet, { rows:(sheet.rows || []).map((row)=> Object.assign({}, row, sourceByKey.get(row.key) || {})) }));
    const mergeValidation = rv.validateResolution(rawRows, resolvedRows);
    const validation = rv.validate(resolvedRows, actual.rows);
    return {
      rawRows,
      rawCount: rawRows.length,
      resolvedRows,
      mergeValidation,
      actualRows: actual.rows,
      sheets: actual.sheets,
      validation,
    };
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>\"]/g, (ch)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch] || ch));
  }

  function buildTablePrintHtml(title, subtitle, tableNode){
    const tableHtml = tableNode && tableNode.outerHTML ? tableNode.outerHTML : '';
    return `<!doctype html><html><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(title || 'Lista formatek')}</title>
      <style>
        @page{ size:A4 portrait; margin:10mm; }
        html, body{ margin:0; padding:0; }
        body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; }
        .print-wrap{ width:100%; }
        .print-title{ font-size:20px; line-height:1.2; font-weight:900; margin:0 0 2mm; }
        .print-subtitle{ font-size:12px; line-height:1.35; color:#475569; margin:0 0 5mm; }
        .rozrys-list-table-wrap{ overflow:visible; border:1px solid #dbe3ec; border-radius:14px; background:#fff; }
        .table-list{ width:100%; border-collapse:collapse; table-layout:fixed; }
        .table-list th,.table-list td{ padding:8px 6px; border-right:1px solid rgba(203,213,225,.55); border-bottom:1px solid rgba(75,85,99,.60); font-size:11px; line-height:1.15; font-weight:700; color:#0f172a; text-align:left; vertical-align:top; font-family:inherit; }
        .table-list th:last-child,.table-list td:last-child{ border-right:none; }
        .table-list thead th{ background:#f8fafc; font-size:11px; line-height:1.1; font-weight:800; color:#334155; }
        .table-list thead th.table-th-vertical{ height:102px; padding:0 2px; text-align:center; vertical-align:bottom; }
        .table-list thead th.table-th-vertical > span{ display:inline-flex; align-items:flex-end; justify-content:center; min-height:92px; writing-mode:vertical-rl; transform:rotate(180deg); white-space:nowrap; line-height:1; font-size:10px; padding:7px 0 4px; margin-inline:auto; }
        .table-list tbody tr:last-child td{ border-bottom:none; }
        .table-list .col-name{ width:15%; }
        .table-list .col-dim{ width:5.2ch; }
        .table-list .col-qty,.table-list .col-diff,.table-list .col-status{ text-align:center; white-space:nowrap; }
        .table-list .col-qty{ width:3ch; }
        .table-list .col-diff,.table-list .col-status{ width:3.1ch; }
        .table-list .col-cab{ width:18ch; }
        .table-list .col-room{ width:10.4ch; }
        .table-dim{ display:grid; grid-template-columns:1fr; justify-items:center; row-gap:1px; width:100%; }
        .table-dim__left,.table-dim__right,.table-dim__x{ text-align:center; }
        .table-dim__x{ font-weight:500; font-size:.9em; padding:0; text-transform:none; }
        .table-cabcell{ display:block; min-width:0; }
        .table-cabcell__nums{ min-width:0; display:flex; flex-direction:column; gap:2px; line-height:1.2; font-weight:800; max-height:calc(1.3em * 3 + 8px); overflow:hidden; }
        .table-cabcell__nums span{ display:block; white-space:nowrap; min-height:1.2em; }
        .rozrys-status-chip{ display:inline-flex; align-items:center; justify-content:center; min-width:2.6ch; border-radius:999px; padding:3px 4px; font-size:10px; font-weight:800; }
        .rozrys-status-chip.is-ok{ background:#ecfdf3; color:#166534; }
        .rozrys-status-chip.is-missing{ background:#fef2f2; color:#b91c1c; }
        .rozrys-status-chip.is-extra{ background:#fff7ed; color:#b45309; }
      </style></head><body>
      <div class="print-wrap">
        <div class="print-title">${escapeHtml(title || 'Lista formatek')}</div>
        <div class="print-subtitle">${escapeHtml(subtitle || '')}</div>
        ${tableHtml}
      </div>
    </body></html>`;
  }

  function createPdfAction(label, title, subtitle, tableNode, openPrintView){
    if(typeof openPrintView !== 'function') return null;
    const btn = h('button', { class:'btn-primary', type:'button', text:label || 'PDF' });
    btn.addEventListener('click', ()=> openPrintView(buildTablePrintHtml(title, subtitle, tableNode)));
    return btn;
  }

  function buildTabContent(tableNode){
    const wrap = h('div', { class:'rozrys-list-panel' });
    wrap.appendChild(tableNode);
    return wrap;
  }

  function buildTabs(specs){
    const shell = h('div', { class:'rozrys-list-tabs' });
    const header = h('div', { class:'rozrys-list-tabs__header' });
    const heads = h('div', { class:'rozrys-list-tabs__heads', role:'tablist', 'aria-label':'Widoki list formatek' });
    const actionsHost = h('div', { class:'rozrys-list-tabs__actions' });
    const panels = h('div', { class:'rozrys-list-tabs__panels' });
    const items = [];

    function activate(idx){
      items.forEach((item, itemIdx)=>{
        const active = itemIdx === idx;
        item.btn.classList.toggle('is-active', active);
        item.btn.setAttribute('aria-selected', active ? 'true' : 'false');
        item.panel.classList.toggle('is-active', active);
      });
      actionsHost.innerHTML = '';
      const action = items[idx] && items[idx].action;
      if(action) actionsHost.appendChild(action);
    }

    specs.forEach((spec, idx)=>{
      const tabId = `rozrys-list-tab-${idx}`;
      const panelId = `rozrys-list-panel-${idx}`;
      const btn = h('button', {
        class:`btn rozrys-list-tabs__tab${idx === 0 ? ' is-active' : ''}`,
        type:'button',
        role:'tab',
        id:tabId,
        'aria-controls':panelId,
        'aria-selected':idx === 0 ? 'true' : 'false',
        text:spec.label
      });
      const panel = h('div', {
        class:`rozrys-list-tabs__panel${idx === 0 ? ' is-active' : ''}`,
        role:'tabpanel',
        id:panelId,
        'aria-labelledby':tabId
      }, [spec.content]);
      btn.addEventListener('click', ()=> activate(idx));
      items.push({ btn, panel, action:spec.action || null });
      heads.appendChild(btn);
      panels.appendChild(panel);
    });

    header.appendChild(heads);
    header.appendChild(actionsHost);
    shell.appendChild(header);
    shell.appendChild(panels);
    if(items.length) activate(0);
    return shell;
  }

  function openValidationListModal(material, diag, unit, deps){
    const cfg = Object.assign({ mmToUnitStr:null, openPrintView:null }, deps || {});
    const lists = FC.rozrysLists;
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function') || !diag || typeof cfg.mmToUnitStr !== 'function' || !lists) return;
    const body = h('div');
    const summary = validationSummaryLabel(diag);
    const metaRow = h('div', { class:'rozrys-validation-summary' });
    metaRow.appendChild(h('span', { class:`rozrys-pill ${summary.tone}`, text:summary.text }));
    metaRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Raw 1:1: ${diag.rawCount} pozycji` }));
    const mergeSummary = diag.mergeValidation && diag.mergeValidation.ok
      ? `Scalanie: OK • ${diag.resolvedRows.length} pozycji`
      : `Scalanie: ${((diag.mergeValidation && diag.mergeValidation.missingQty) || 0)} brak / ${((diag.mergeValidation && diag.mergeValidation.extraQty) || 0)} nad`;
    metaRow.appendChild(h('span', { class:`rozrys-pill ${diag.mergeValidation && diag.mergeValidation.ok ? 'is-ok' : 'is-warn'}`, text:mergeSummary }));
    body.appendChild(metaRow);

    const rawTable = lists.buildRawTable(diag.rawRows, unit, cfg.mmToUnitStr);
    const resolvedTable = lists.buildListTable((diag.mergeValidation && diag.mergeValidation.rows) || [], unit, 'merged', cfg.mmToUnitStr);
    const validationTable = lists.buildListTable((diag.validation && diag.validation.rows) || [], unit, 'validation', cfg.mmToUnitStr);

    const tabs = buildTabs([
      {
        label:'RAW',
        action:createPdfAction('PDF', `Lista RAW — ${material}`, `Raw 1:1 • ${diag.rawCount} pozycji`, rawTable, cfg.openPrintView),
        content: buildTabContent(rawTable)
      },
      {
        label:'Skomasowana',
        action:createPdfAction('PDF', `Lista skomasowana — ${material}`, `Kontrola scalania • ${(diag.resolvedRows || []).length} pozycji`, resolvedTable, cfg.openPrintView),
        content: buildTabContent(resolvedTable)
      },
      {
        label:'Walidacja',
        action:null,
        content: buildTabContent(validationTable)
      }
    ]);
    body.appendChild(tabs);
    FC.panelBox.open({ title:`Lista formatek — ${material}`, contentNode: body, width:'960px', boxClass:'panel-box--rozrys' });
  }

  function openSheetListModal(material, sheetTitle, rows, unit, deps){
    const cfg = Object.assign({ mmToUnitStr:null, openPrintView:null }, deps || {});
    const lists = FC.rozrysLists;
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function') || typeof cfg.mmToUnitStr !== 'function' || !lists) return;
    const body = h('div');
    const head = h('div', { class:'rozrys-list-tabs__header', style:'margin-bottom:10px;' });
    head.appendChild(h('div', { class:'muted xs', text:'Formatki pogrupowane dla tego arkusza.' }));
    const actionsHost = h('div', { class:'rozrys-list-tabs__actions' });
    const sheetTable = lists.buildListTable(rows || [], unit, 'sheet', cfg.mmToUnitStr);
    const pdfBtn = createPdfAction('PDF', `${sheetTitle} — ${material}`, 'Lista formatek arkusza', sheetTable, cfg.openPrintView);
    if(pdfBtn) actionsHost.appendChild(pdfBtn);
    head.appendChild(actionsHost);
    body.appendChild(head);
    body.appendChild(sheetTable);
    FC.panelBox.open({ title:`${sheetTitle} — ${material}`, contentNode: body, width:'820px', boxClass:'panel-box--rozrys' });
  }

  FC.rozrysSummary = {
    buildRozrysDiagnostics,
    validationSummaryLabel,
    openValidationListModal,
    openSheetListModal,
  };
})();
