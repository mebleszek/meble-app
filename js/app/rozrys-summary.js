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

  function makeStatusChip(status){
    const map = {
      ok: { cls:'is-ok', text:'OK' },
      missing: { cls:'is-missing', text:'BRAK' },
      extra: { cls:'is-extra', text:'NADMIAR' },
    };
    const cfg = map[status] || map.ok;
    return h('span', { class:`rozrys-status-chip ${cfg.cls}`, text:cfg.text });
  }

  function buildDimNode(wMm, hMm, unit, mmToUnitStr){
    return h('span', { class:'table-dim' }, [
      h('span', { class:'table-dim__left', text:mmToUnitStr(wMm, unit) }),
      h('span', { class:'table-dim__x', text:'x' }),
      h('span', { class:'table-dim__right', text:mmToUnitStr(hMm, unit) }),
    ]);
  }

  function buildListTable(rows, unit, mode, mmToUnitStr){
    const wrap = h('div', { class:'rozrys-list-table-wrap' });
    const table = h('table', { class:`table-list ${mode === 'sheet' ? 'table-list--parts' : ''}`.trim() });
    if(mode === 'sheet'){
      const colgroup = h('colgroup');
      colgroup.appendChild(h('col', { class:'col-name' }));
      colgroup.appendChild(h('col', { class:'col-dim' }));
      colgroup.appendChild(h('col', { class:'col-qty' }));
      table.appendChild(colgroup);
    }
    const thead = h('thead');
    const headRow = h('tr');
    if(mode === 'sheet'){
      headRow.appendChild(h('th', { class:'col-name', text:'Nazwa' }));
      headRow.appendChild(h('th', { class:'col-dim', text:`Wymiar (${unit})` }));
      headRow.appendChild(h('th', { class:'col-qty', text:'Ilość' }));
    } else {
      ['Formatka', `Wymiar (${unit})`, 'Potrzebne', 'Rozrysowane', 'Różnica', 'Status'].forEach((label)=> headRow.appendChild(h('th', { text:label })));
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
        td.appendChild(makeStatusChip(row.status));
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
    const table = h('table', { class:'table-list' });
    const thead = h('thead');
    const headRow = h('tr');
    ['Formatka', `Wymiar (${unit})`, 'Ilość', 'Pomieszczenie', 'Źródło'].forEach((label)=> headRow.appendChild(h('th', { text:label })));
    thead.appendChild(headRow);
    const tbody = h('tbody');
    (rows || []).forEach((row)=>{
      const tr = h('tr');
      tr.appendChild(h('td', { text: row.name || 'Element' }));
      tr.appendChild(h('td', { text: `${mmToUnitStr(row.w, unit)} × ${mmToUnitStr(row.h, unit)}` }));
      tr.appendChild(h('td', { text:String(Math.max(0, Number(row.qty) || 0)) }));
      tr.appendChild(h('td', { text:String(row.room || '—') }));
      tr.appendChild(h('td', { text:String(row.source || '—') }));
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms, deps){
    const cfg = Object.assign({
      buildRawSnapshotForMaterial:null,
      buildResolvedSnapshotFromParts:null,
    }, deps || {});
    const rv = FC.rozrysValidation;
    if(!(rv && typeof rv.aggregateRows === 'function' && typeof rv.summarizePlan === 'function' && typeof rv.validate === 'function')) return null;
    const rawRows = typeof cfg.buildRawSnapshotForMaterial === 'function'
      ? (cfg.buildRawSnapshotForMaterial(targetMaterial, mode, selectedRooms) || [])
      : [];
    const resolvedRows = rawRows.length
      ? rv.aggregateRows(rawRows)
      : (typeof cfg.buildResolvedSnapshotFromParts === 'function' ? cfg.buildResolvedSnapshotFromParts(parts) : []);
    const actual = rv.summarizePlan(plan, targetMaterial);
    const validation = rv.validate(resolvedRows, actual.rows);
    return {
      rawRows,
      rawCount: rawRows.length,
      resolvedRows,
      actualRows: actual.rows,
      sheets: actual.sheets,
      validation,
    };
  }

  function openValidationListModal(material, diag, unit, deps){
    const cfg = Object.assign({ mmToUnitStr:null }, deps || {});
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function') || !diag || typeof cfg.mmToUnitStr !== 'function') return;
    const body = h('div');
    const summary = validationSummaryLabel(diag);
    const metaRow = h('div', { class:'rozrys-validation-summary' });
    metaRow.appendChild(h('span', { class:`rozrys-pill ${summary.tone}`, text:summary.text }));
    metaRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Raw 1:1: ${diag.rawCount} pozycji` }));
    metaRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Lista do rozkroju: ${diag.resolvedRows.length} pozycji` }));
    body.appendChild(metaRow);
    body.appendChild(h('div', { class:'muted xs', style:'margin:10px 0 0', text:'RAW SNAPSHOT 1:1 z Materiałów dla tego rozkroju.' }));
    body.appendChild(buildRawTable(diag.rawRows, unit, cfg.mmToUnitStr));
    body.appendChild(h('div', { class:'rozrys-subsection-title', text:'Lista do rozkroju (po scaleniu)' }));
    body.appendChild(buildListTable((diag.resolvedRows || []).map((row)=>({
      name: row.name, w: row.w, h: row.h, expectedQty: row.qty, actualQty: row.qty, diff: 0, status: 'ok'
    })), unit, 'validation', cfg.mmToUnitStr));
    body.appendChild(h('div', { class:'rozrys-subsection-title', text:'Walidacja rozrysu' }));
    body.appendChild(buildListTable(diag.validation.rows, unit, 'validation', cfg.mmToUnitStr));
    FC.panelBox.open({ title:`Lista formatek — ${material}`, contentNode: body, width:'960px' });
  }

  function openSheetListModal(material, sheetTitle, rows, unit, deps){
    const cfg = Object.assign({ mmToUnitStr:null }, deps || {});
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function') || typeof cfg.mmToUnitStr !== 'function') return;
    const body = h('div');
    body.appendChild(h('div', { class:'muted xs', style:'margin-bottom:12px', text:'Formatki pogrupowane dla tego arkusza.' }));
    body.appendChild(buildListTable(rows || [], unit, 'sheet', cfg.mmToUnitStr));
    FC.panelBox.open({ title:`${sheetTitle} — ${material}`, contentNode: body, width:'820px' });
  }

  FC.rozrysSummary = {
    buildRozrysDiagnostics,
    validationSummaryLabel,
    openValidationListModal,
    openSheetListModal,
  };
})();
