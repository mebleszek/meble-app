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
      ['Okucia w pliku', s.accessoryRows != null ? s.accessoryRows : (s.imported || 0)],
      ['Nowe okucia', s.added || 0],
      ['Okucia zmienione', s.updated || 0],
      ['Okucia bez zmian', s.unchanged || 0],
      ['Ceny w pliku', s.supplierPrices || 0],
      ['Nowe ceny', s.supplierPricesAdded || 0],
      ['Ceny zmienione', s.supplierPricesUpdated || 0],
      ['Ceny bez zmian', s.supplierPricesUnchanged || 0],
      ['Ceny pominięte', s.supplierPricesSkipped || 0],
      ['Usuwane przy zastąpieniu', s.removed || 0],
      ['Dostawcy po imporcie', s.suppliers || 0],
      ['Producenci po imporcie', s.manufacturers || 0]
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

  function renderModeChoices(mode, onSelect){
    const box = makeSection('Tryb importu', 'Wybierz jeden tryb, a dopiero potem zatwierdź import.');
    const grid = h('div', { style:'display:grid;gap:8px;margin-top:10px' });
    const choice = (value, title, desc)=>{
      const selected = mode === value;
      const btn = h('button', {
        type:'button',
        class:'rozrys-scope-chip' + (selected ? ' is-checked' : ''),
        style:'width:100%;justify-content:flex-start;text-align:left;border-radius:18px;padding:10px 12px;align-items:flex-start',
        'aria-pressed':selected ? 'true' : 'false'
      });
      btn.appendChild(h('span', { style:'font-weight:900;min-width:20px', text:selected ? '✓' : '□' }));
      const content = h('span', { style:'display:grid;gap:3px' });
      content.appendChild(h('span', { style:'font-weight:900', text:title }));
      content.appendChild(h('span', { class:'muted-tag xs', text:desc }));
      btn.appendChild(content);
      btn.addEventListener('click', ()=> onSelect(value));
      return btn;
    };
    grid.appendChild(choice('merge', 'Scal / aktualizuj', 'Dodaje nowe pozycje i aktualizuje istniejące. Niczego nie usuwa z katalogu.'));
    grid.appendChild(choice('replace', 'Zastąp katalog', 'Traktuje plik jako pełny katalog. Pozycje, których nie ma w pliku, mogą zostać usunięte.'));
    box.appendChild(grid);
    if(mode === 'replace'){
      box.appendChild(h('div', { style:'margin-top:10px;color:#a40000;font-weight:800', text:'Uwaga: tryb zastąpienia jest do świadomego przywracania pełnego katalogu z pliku.' }));
    }
    return box;
  }

  function decodeBuffer(buffer){
    try{ return new TextDecoder('utf-8').decode(buffer); }
    catch(_){
      const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
      let out = '';
      for(let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      try{ return decodeURIComponent(escape(out)); }catch(__){ return out; }
    }
  }

  function readWithFileReader(file){
    return new Promise((resolve, reject)=>{
      try{
        const reader = new FileReader();
        reader.onerror = ()=> reject(reader.error || new Error('FileReader nie odczytał pliku.'));
        reader.onload = ()=> resolve(reader.result);
        reader.readAsArrayBuffer(file);
      }catch(error){ reject(error); }
    });
  }
  function fileReadHint(error, file){
    const name = file && file.name ? String(file.name) : 'wybrany plik';
    const size = file && Number.isFinite(Number(file.size)) ? Number(file.size) : 0;
    const type = file && file.type ? String(file.type) : 'brak typu';
    const details = String(error && error.message || error || '');
    return `Nie udało się odczytać pliku ${name}. Najpewniej plik jest otwarty z Dysku Google/Arkuszy Google albo nie jest lokalną kopią na urządzeniu. Zrób kopię jako .xlsx na urządzeniu, najlepiej w Pobrane/Downloads, i wybierz ją ponownie. Szczegóły: rozmiar ${size} B, typ ${type}${details ? ', błąd: ' + details : ''}.`;
  }

  async function makeFileSnapshot(file){
    const name = file && file.name ? String(file.name) : '';
    const type = file && file.type ? String(file.type) : '';
    const size = file && Number.isFinite(Number(file.size)) ? Number(file.size) : 0;
    let buffer;
    try{
      if(file && typeof file.arrayBuffer === 'function') buffer = await file.arrayBuffer();
      else if(file && typeof file.text === 'function') buffer = new TextEncoder().encode(await file.text()).buffer;
    }catch(error){
      try{ buffer = await readWithFileReader(file); }
      catch(readerError){ throw new Error(fileReadHint(readerError || error, file)); }
    }
    if(!(buffer instanceof ArrayBuffer)) throw new Error(fileReadHint('Nie udało się pobrać danych wybranego pliku.', file));
    if(size <= 0) throw new Error(fileReadHint('Plik ma rozmiar 0 B albo nie został realnie pobrany lokalnie.', file));
    return {
      name, type, size,
      arrayBuffer: async ()=> buffer.slice(0),
      text: async ()=> decodeBuffer(buffer.slice(0)),
      __fcFileSnapshot:true
    };
  }
  function fileInput(accept, onFile){
    const input = h('input', { type:'file', accept, style:'display:none' });
    input.addEventListener('change', async ()=>{
      const file = input.files && input.files[0];
      if(!file){ input.value = ''; return; }
      let snapshot;
      try{
        // Android/Chrome potrafi odebrać uprawnienia do pliku po wyczyszczeniu inputa
        // albo po otwarciu kolejnego modala. Dlatego czytamy bajty natychmiast
        // po wyborze i dalszy import pracuje już na snapshocie w pamięci.
        snapshot = await makeFileSnapshot(file);
      }catch(error){
        input.value = '';
        info('Nie udało się odczytać pliku', String(error && error.message || error || 'Plik nie został odczytany.'));
        return;
      }
      input.value = '';
      await onFile(snapshot);
    });
    return input;
  }
  async function handleImportFile(file, mount){
    const api = FC.hardwareCatalogImportExport;
    if(!(api && typeof api.parseFile === 'function')){ info('Brak modułu importu', 'Moduł importu katalogu okuć nie jest załadowany.'); return; }
    let data;
    try{ data = await api.parseFile(file); }
    catch(error){ info('Nie udało się odczytać pliku', String(error && error.message || error || 'Plik nie został odczytany. Zapisz lokalną kopię .xlsx na urządzeniu i spróbuj ponownie.')); return; }
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
      mount.appendChild(renderModeChoices(mode, (nextMode)=>{ mode = nextMode === 'replace' ? 'replace' : 'merge'; renderPlan(); }));
      const actions = h('div', { style:'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px' });
      const applyBtn = h('button', { type:'button', class:'btn-primary', text:mode === 'replace' ? 'Zatwierdź zastąpienie' : 'Zatwierdź import' });
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
          info('Import zakończony', `Nowe okucia: ${summary.added || 0}, okucia zmienione: ${summary.updated || 0}, nowe ceny: ${summary.supplierPricesAdded || 0}, ceny zmienione: ${summary.supplierPricesUpdated || 0}, ceny bez zmian: ${summary.supplierPricesUnchanged || 0}, usunięto: ${summary.removed || 0}.`);
          refreshPriceModal();
          try{ FC.panelBox.close(); }catch(_){ }
        }catch(error){ info('Błąd importu', String(error && error.message || error || 'Import nie został zapisany.')); }
      });
      actions.appendChild(applyBtn);
      mount.appendChild(actions);
    };
    renderPlan();
  }
  function openHardwareImportExportModal(){
    const api = FC.hardwareCatalogImportExport;
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const body = h('div', { class:'hardware-import-export-panel' });
    body.appendChild(makeSection('Import / Eksport katalogu okuć', 'JSON służy jako pełny backup techniczny. XLSX jest szablonem roboczym: najważniejsze kolumny są na początku, ID jest na końcu, skład zestawów ma czytelne kolumny. Na telefonie najpewniej importuj lokalną kopię .xlsx zapisaną na urządzeniu, np. w Pobrane/Downloads; plik otwarty prosto z Dysku Google/Arkuszy może nie dać się odczytać w Chrome.'));
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
