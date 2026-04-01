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
    if(!(rv && typeof rv.aggregateRows === 'function' && typeof rv.summarizePlan === 'function' && typeof rv.validate === 'function')) return null;
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
    const lists = FC.rozrysLists;
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function') || !diag || typeof cfg.mmToUnitStr !== 'function' || !lists) return;
    const body = h('div');
    const summary = validationSummaryLabel(diag);
    const metaRow = h('div', { class:'rozrys-validation-summary' });
    metaRow.appendChild(h('span', { class:`rozrys-pill ${summary.tone}`, text:summary.text }));
    metaRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Raw 1:1: ${diag.rawCount} pozycji` }));
    metaRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Lista do rozkroju: ${diag.resolvedRows.length} pozycji` }));
    body.appendChild(metaRow);
    body.appendChild(h('div', { class:'muted xs', style:'margin:10px 0 0', text:'RAW SNAPSHOT 1:1 z Materiałów dla tego rozkroju.' }));
    body.appendChild(lists.buildRawTable(diag.rawRows, unit, cfg.mmToUnitStr));
    body.appendChild(h('div', { class:'rozrys-subsection-title', text:'Lista do rozkroju (po scaleniu)' }));
    body.appendChild(lists.buildListTable((diag.resolvedRows || []).map((row)=>({
      name: row.name, w: row.w, h: row.h, expectedQty: row.qty, actualQty: row.qty, diff: 0, status: 'ok', room: row.room, source: row.source, cabinet: row.cabinet
    })), unit, 'resolved', cfg.mmToUnitStr));
    body.appendChild(h('div', { class:'rozrys-subsection-title', text:'Walidacja rozrysu' }));
    body.appendChild(lists.buildListTable(diag.validation.rows, unit, 'validation', cfg.mmToUnitStr));
    FC.panelBox.open({ title:`Lista formatek — ${material}`, contentNode: body, width:'960px', boxClass:'panel-box--rozrys' });
  }

  function openSheetListModal(material, sheetTitle, rows, unit, deps){
    const cfg = Object.assign({ mmToUnitStr:null }, deps || {});
    const lists = FC.rozrysLists;
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function') || typeof cfg.mmToUnitStr !== 'function' || !lists) return;
    const body = h('div');
    body.appendChild(h('div', { class:'muted xs', style:'margin-bottom:12px', text:'Formatki pogrupowane dla tego arkusza.' }));
    body.appendChild(lists.buildListTable(rows || [], unit, 'sheet', cfg.mmToUnitStr));
    FC.panelBox.open({ title:`${sheetTitle} — ${material}`, contentNode: body, width:'820px', boxClass:'panel-box--rozrys' });
  }

  FC.rozrysSummary = {
    buildRozrysDiagnostics,
    validationSummaryLabel,
    openValidationListModal,
    openSheetListModal,
  };
})();
