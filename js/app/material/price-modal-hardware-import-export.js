// js/app/material/price-modal-hardware-import-export.js
// Panel importu/eksportu katalogu okuć: JSON backup + edytowalny XLSX.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function h(tag, props, children){
    const el = document.createElement(tag);
    Object.keys(props || {}).forEach((key)=>{
      const value = props[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(key === 'style') el.setAttribute('style', value);
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function info(title, message){
    try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title, message }); }
    catch(_){ }
  }
  async function ask(opts){
    try{ return !!(await (FC.confirmBox && FC.confirmBox.ask ? FC.confirmBox.ask(opts || {}) : true)); }
    catch(_){ return false; }
  }
  function refreshPriceModal(){
    try{ if(ctx.renderPriceModal) ctx.renderPriceModal(); }
    catch(_){ try{ if(FC.priceModal && FC.priceModal.renderPriceModal) FC.priceModal.renderPriceModal(); }catch(__){ } }
  }
  function makeSection(title, text){
    const wrap = h('div', { class:'card', style:'padding:12px;margin-bottom:10px' });
    wrap.appendChild(h('div', { style:'font-weight:900;margin-bottom:4px', text:title }));
    if(text) wrap.appendChild(h('div', { class:'muted-tag xs', text }));
    return wrap;
  }
  function renderSummary(plan){
    const s = plan && plan.summary || {};
    const box = makeSection('Podgląd importu', 'Import zapisze dane przez catalogStore do lokalnego katalogu. Później ten sam boundary można przepiąć na chmurę.');
    const grid = h('div', { class:'grid-2', style:'margin-top:10px;gap:8px' });
    [
      ['Pozycji w pliku', s.imported || 0], ['Nowe', s.added || 0], ['Aktualizowane', s.updated || 0], ['Usuwane przy zastąpieniu', s.removed || 0],
      ['Dostawcy po imporcie', s.suppliers || 0], ['Producenci po imporcie', s.manufacturers || 0]
    ].forEach((row)=>{
      const tile = h('div', { class:'list-item', style:'display:block;padding:10px' });
      tile.appendChild(h('div', { class:'muted-tag xs', text:row[0] }));
      tile.appendChild(h('div', { style:'font-weight:900;font-size:18px', text:String(row[1]) }));
      grid.appendChild(tile);
    });
    box.appendChild(grid);
    if(plan && plan.warnings && plan.warnings.length){
      const warn = h('div', { class:'muted-tag xs', style:'margin-top:10px;white-space:pre-wrap', text:'Ostrzeżenia:\n' + plan.warnings.slice(0, 8).join('\n') + (plan.warnings.length > 8 ? '\n…' : '') });
      box.appendChild(warn);
    }
    if(plan && plan.errors && plan.errors.length){
      const shown = plan.errors.slice(0, 10).join('\n') + (plan.errors.length > 10 ? '\n…' : '');
      const err = h('div', { style:'margin-top:10px;color:#a40000;font-weight:800;white-space:pre-wrap', text:'Błędy:\n' + shown });
      box.appendChild(err);
    }
    return box;
  }
  function fileInput(accept, onFile){
    const input = h('input', { type:'file', accept, style:'display:none' });
    input.addEventListener('change', async ()=>{
      const file = input.files && input.files[0];
      input.value = '';
      if(file) await onFile(file);
    });
    return input;
  }
  async function handleImportFile(file, mount){
    const api = FC.hardwareCatalogImportExport;
    if(!(api && typeof api.parseFile === 'function')){ info('Brak modułu importu', 'Moduł importu katalogu okuć nie jest załadowany.'); return; }
    let data;
    try{ data = await api.parseFile(file); }
    catch(error){ info('Nie udało się odczytać pliku', String(error && error.message || error || 'Plik nie został odczytany.')); return; }
    if(FC.priceModalHardwareImportResolver && typeof FC.priceModalHardwareImportResolver.resolveMissingRequired === 'function'){
      data = await FC.priceModalHardwareImportResolver.resolveMissingRequired(data, mount);
    }
    let mode = 'merge';
    const renderPlan = ()=>{
      let plan;
      try{ plan = api.buildImportPlan(data, { mode }); }
      catch(error){ info('Błąd przygotowania importu', String(error && error.message || error)); return; }
      mount.innerHTML = '';
      mount.appendChild(renderSummary(plan));
      const actions = h('div', { style:'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px' });
      const mergeBtn = h('button', { type:'button', class:mode === 'merge' ? 'btn btn-success' : 'btn', text:'Scal / aktualizuj' });
      const replaceBtn = h('button', { type:'button', class:mode === 'replace' ? 'btn btn-danger' : 'btn', text:'Zastąp katalog' });
      const applyBtn = h('button', { type:'button', class:'btn-primary', text:mode === 'replace' ? 'Zatwierdź zastąpienie' : 'Zatwierdź import' });
      mergeBtn.addEventListener('click', ()=>{ mode = 'merge'; renderPlan(); });
      replaceBtn.addEventListener('click', ()=>{ mode = 'replace'; renderPlan(); });
      applyBtn.disabled = !!(plan.errors && plan.errors.length);
      applyBtn.addEventListener('click', async ()=>{
        const ok = await ask({
          title:mode === 'replace' ? 'ZASTĄPIĆ KATALOG OKUĆ?' : 'IMPORTOWAĆ KATALOG OKUĆ?',
          message:mode === 'replace' ? 'Aktualny katalog okuć zostanie zastąpiony pozycjami z pliku. Producenci, dostawcy i ustawienia też zostaną zapisane z importu.' : 'Pozycje z pliku zostaną dodane albo zaktualizowane. Brakujące pozycje w pliku nie zostaną usunięte.',
          confirmText:mode === 'replace' ? 'Zastąp' : 'Importuj',
          cancelText:'Wróć',
          confirmTone:mode === 'replace' ? 'danger' : 'success',
          cancelTone:'neutral'
        });
        if(!ok) return;
        try{
          const summary = api.applyImportPlan(plan);
          info('Import zakończony', `Dodano: ${summary.added || 0}, zaktualizowano: ${summary.updated || 0}, usunięto: ${summary.removed || 0}.`);
          refreshPriceModal();
          try{ FC.panelBox.close(); }catch(_){ }
        }catch(error){ info('Błąd importu', String(error && error.message || error || 'Import nie został zapisany.')); }
      });
      actions.appendChild(mergeBtn); actions.appendChild(replaceBtn); actions.appendChild(applyBtn);
      mount.appendChild(actions);
    };
    renderPlan();
  }
  function openHardwareImportExportModal(){
    const api = FC.hardwareCatalogImportExport;
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const body = h('div', { class:'hardware-import-export-panel' });
    body.appendChild(makeSection('Import / Eksport katalogu okuć', 'JSON służy jako pełny backup techniczny. XLSX jest szablonem roboczym: najważniejsze kolumny są na początku, ID jest na końcu, puste wiersze są ignorowane, a braki obowiązkowe aplikacja każe uzupełnić pozycja po pozycji.'));
    const actions = h('div', { class:'grid-2', style:'gap:10px;margin-bottom:10px' });
    const exportJsonBtn = h('button', { type:'button', class:'btn', text:'Eksport JSON' });
    const importJsonBtn = h('button', { type:'button', class:'btn', text:'Import JSON' });
    const exportXlsxBtn = h('button', { type:'button', class:'btn', text:'Eksport Excel / XLSX' });
    const importXlsxBtn = h('button', { type:'button', class:'btn', text:'Import Excel / XLSX' });
    const preview = h('div', {});
    const jsonInput = fileInput('application/json,.json', (file)=> handleImportFile(file, preview));
    const xlsxInput = fileInput('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', (file)=> handleImportFile(file, preview));
    exportJsonBtn.addEventListener('click', ()=>{ try{ api.exportJson(); }catch(error){ info('Eksport JSON nieudany', String(error && error.message || error)); } });
    exportXlsxBtn.addEventListener('click', ()=>{ try{ api.exportXlsx(); }catch(error){ info('Eksport XLSX nieudany', String(error && error.message || error)); } });
    importJsonBtn.addEventListener('click', ()=> jsonInput.click());
    importXlsxBtn.addEventListener('click', ()=> xlsxInput.click());
    [exportJsonBtn, importJsonBtn, exportXlsxBtn, importXlsxBtn].forEach((node)=> actions.appendChild(node));
    body.appendChild(actions);
    body.appendChild(jsonInput); body.appendChild(xlsxInput); body.appendChild(preview);
    const footer = h('div', { style:'display:flex;justify-content:flex-end;margin-top:12px' });
    footer.appendChild(h('button', { type:'button', class:'btn', text:'Wyjdź', onclick:()=>{ try{ FC.panelBox.close(); }catch(_){ } } }));
    body.appendChild(footer);
    FC.panelBox.open({ title:'Import / Eksport okuć', contentNode:body, width:'860px', boxClass:'panel-box--rozrys hardware-import-export-panelbox', dismissOnOverlay:false, dismissOnEsc:true });
  }

  Object.assign(ctx, { openHardwareImportExportModal });
  FC.priceModalHardwareImportExport = { openHardwareImportExportModal };
})();
