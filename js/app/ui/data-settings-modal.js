(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function h(tag, attrs, children){
    const node = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key,value])=>{
        if(value == null) return;
        if(key === 'class') node.className = value;
        else if(key === 'text') node.textContent = value;
        else if(key === 'html') node.innerHTML = value;
        else node.setAttribute(key, String(value));
      });
    }
    (children || []).forEach((child)=>{ if(child) node.appendChild(child); });
    return node;
  }

  function formatDate(value){
    try{
      const date = new Date(value);
      if(!Number.isFinite(date.getTime())) return String(value || '—');
      return date.toLocaleString('pl-PL');
    }catch(_){ return String(value || '—'); }
  }

  function ask(opts){
    if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') return FC.confirmBox.ask(opts || {});
    return Promise.resolve(confirm(String((opts && opts.message) || (opts && opts.title) || 'Kontynuować?')));
  }

  function info(title, message){
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function') return FC.infoBox.open({ title, message });
      if(FC.infoBox && typeof FC.infoBox.show === 'function') return FC.infoBox.show(title, message);
    }catch(_){ }
    try{ alert(String(message || title || '')); }catch(_){ }
  }

  async function copyText(text, btn){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      if(btn){ const old = btn.textContent; btn.textContent = 'Skopiowano'; setTimeout(()=>{ btn.textContent = old; }, 1400); }
    }catch(_){ if(btn) btn.textContent = 'Błąd kopiowania'; }
  }

  function makeStat(label, value){
    return h('div', { class:'data-settings-stat' }, [
      h('span', { text:label }),
      h('strong', { text:String(value || 0) })
    ]);
  }

  function makeAccordion(title, contentNodes, options){
    const opts = Object.assign({ open:false, sub:'' }, options || {});
    const details = h('details', { class:'data-settings-accordion' + (opts.open ? ' is-open' : '') });
    if(opts.open) details.setAttribute('open', 'open');
    const summary = h('summary', { class:'data-settings-accordion__summary' }, [
      h('span', { class:'data-settings-accordion__title', text:title }),
      opts.sub ? h('span', { class:'data-settings-accordion__sub', text:opts.sub }) : null,
    ]);
    const body = h('div', { class:'data-settings-accordion__body' });
    (contentNodes || []).forEach((node)=>{ if(node) body.appendChild(node); });
    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  function open(){
    const store = FC.dataBackupStore;
    const snapshot = FC.dataBackupSnapshot;
    if(!(store && snapshot && FC.panelBox && typeof FC.panelBox.open === 'function')){
      info('Brak modułu backupu', 'Moduł backupu danych nie został załadowany.');
      return false;
    }

    let view = 'menu';
    const body = h('div', { class:'panel-box-form data-settings-modal' });
    const scroll = h('div', { class:'panel-box-form__scroll data-settings-scroll' });
    const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
    const footerActions = h('div', { class:'rozrys-panel-footer__actions' });
    const backBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wróć' });
    const closeBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wyjdź' });
    footerActions.appendChild(backBtn);
    footerActions.appendChild(closeBtn);
    footer.appendChild(footerActions);

    body.appendChild(scroll);
    body.appendChild(footer);

    function renderFooter(){
      backBtn.style.display = view === 'backup' ? '' : 'none';
    }

    function setView(next){
      view = next === 'backup' ? 'backup' : 'menu';
      render();
    }

    function renderMenu(){
      scroll.innerHTML = '';
      const card = h('section', { class:'data-settings-card data-settings-menu-card' });
      card.appendChild(h('h3', { text:'Ustawienia' }));
      card.appendChild(h('p', { class:'muted', text:'Wybierz obszar ustawień. Backup jest głębiej, żeby ekran startowy ustawień nie był przeładowany.' }));

      const grid = h('div', { class:'data-settings-menu-grid' });
      const backupTile = h('button', { type:'button', class:'data-settings-menu-tile', 'data-settings-section':'backup' }, [
        h('span', { class:'data-settings-menu-tile__icon', text:'💾' }),
        h('span', { class:'data-settings-menu-tile__title', text:'Backup i dane' }),
        h('span', { class:'data-settings-menu-tile__sub', text:'Kopie danych, eksport, import i raport pamięci programu.' }),
      ]);
      backupTile.addEventListener('click', ()=> setView('backup'));
      grid.appendChild(backupTile);

      const placeholder = h('div', { class:'data-settings-menu-tile data-settings-menu-tile--disabled' }, [
        h('span', { class:'data-settings-menu-tile__icon', text:'⚙' }),
        h('span', { class:'data-settings-menu-tile__title', text:'Kolejne ustawienia' }),
        h('span', { class:'data-settings-menu-tile__sub', text:'Tu później mogą dojść dane firmy, wygląd albo domyślne ustawienia wywiadu.' }),
      ]);
      grid.appendChild(placeholder);

      card.appendChild(grid);
      scroll.appendChild(card);
    }

    function renderBackup(){
      const stats = store.getStats();
      const backups = store.listBackups();
      scroll.innerHTML = '';

      const headerCard = h('section', { class:'data-settings-card' });
      headerCard.appendChild(h('h3', { text:'Backup i dane' }));
      headerCard.appendChild(h('p', { class:'muted', text:'Backup obejmuje pełny stan programu: inwestorów, pomieszczenia, projekty, szafki, materiał, wyceny, ustawienia i dane pomocnicze.' }));
      scroll.appendChild(headerCard);

      const userStats = h('div', { class:'data-settings-stats' }, [
        makeStat('Inwestorzy', stats.investors),
        makeStat('Projekty', stats.projects),
        makeStat('Snapshoty wycen', stats.quoteSnapshots),
        makeStat('Drafty ofert', stats.quoteDrafts),
        makeStat('Zlecenia usługowe', stats.serviceOrders),
        makeStat('Backupy', stats.backups),
      ]);

      const technicalStats = h('div', { class:'data-settings-stats' }, [
        makeStat('Klucze danych', stats.keys),
        makeStat('Chronione backupy', stats.protectedBackups),
      ]);
      technicalStats.appendChild(h('p', { class:'muted xs data-settings-help', text:'Klucze danych to techniczne „szufladki” w pamięci przeglądarki. Nie oznaczają liczby inwestorów ani projektów.' }));

      const statsCard = h('section', { class:'data-settings-card' }, [
        makeAccordion('Dane użytkownika', [userStats], { open:true }),
        makeAccordion('Dane techniczne', [technicalStats], { open:false }),
      ]);
      scroll.appendChild(statsCard);

      const actionsCard = h('section', { class:'data-settings-card' });
      actionsCard.appendChild(makeAccordion('Backup i przenoszenie danych', [buildActions()], { open:true }));
      scroll.appendChild(actionsCard);

      const listCard = h('section', { class:'data-settings-card' });
      const listIntro = h('p', { class:'muted', text:`Automatyczne sprzątanie usuwa stare backupy dopiero, gdy zostaje minimum ${store.MIN_KEEP || 5} najnowszych. Backup przypięty i „ostatni dobry stan” nie są usuwane automatycznie.` });
      const list = h('div', { class:'data-settings-backup-list' });
      if(!backups.length){
        list.appendChild(h('div', { class:'muted', text:'Nie ma jeszcze backupów.' }));
      }
      backups.forEach((backup)=> list.appendChild(buildBackupRow(backup)));
      listCard.appendChild(makeAccordion('Backupy zapisane w programie', [listIntro, list], { open:true, sub:String(backups.length || 0) }));
      scroll.appendChild(listCard);
    }

    function buildActions(){
      const actionsWrap = h('div', { class:'data-settings-actions' });
      const makeBackupBtn = h('button', { type:'button', class:'btn btn-success', text:'Utwórz zwykły backup' });
      const safeStateBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz jako bezpieczny stan' });
      const exportBtn = h('button', { type:'button', class:'btn', text:'Eksportuj wszystkie dane' });
      const importBtn = h('button', { type:'button', class:'btn', text:'Importuj dane z pliku' });
      const reportBtn = h('button', { type:'button', class:'btn', text:'Kopiuj raport danych' });
      const fileInput = h('input', { type:'file', accept:'application/json,.json', style:'display:none' });

      makeBackupBtn.addEventListener('click', ()=>{
        const result = store.createBackup({ reason:'manual', label:'Ręczny backup' });
        info(result.duplicate ? 'Backup już istnieje' : 'Backup utworzony', result.duplicate ? 'Dane są identyczne jak w ostatnim backupie, więc program nie utworzył duplikatu.' : 'Aktualny stan programu został zapisany w backupie.');
        render();
      });
      safeStateBtn.addEventListener('click', ()=>{
        store.createBackup({ reason:'safe-state', label:'Ostatni dobry stan', safeState:true, pinned:true, dedupe:false });
        info('Bezpieczny stan zapisany', 'Ten backup jest przypięty i automatyczne sprzątanie go nie usunie.');
        render();
      });
      exportBtn.addEventListener('click', ()=> store.exportCurrent());
      importBtn.addEventListener('click', ()=> fileInput.click());
      reportBtn.addEventListener('click', ()=> copyText(snapshot.buildDiagnosticsReport(), reportBtn));
      fileInput.addEventListener('change', async ()=>{
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if(!file) return;
        const text = await file.text();
        const snap = snapshot.parseImportPayload(text);
        if(!snap){ info('Nieprawidłowy plik', 'Ten plik nie wygląda jak eksport danych programu.'); return; }
        const ok = await ask({
          title:'IMPORTOWAĆ DANE?',
          message:'Import nadpisze aktualne dane programu. Przed importem program automatycznie utworzy backup obecnego stanu.',
          confirmText:'Importuj',
          cancelText:'Wróć',
          confirmTone:'success',
          cancelTone:'neutral',
          dismissOnOverlay:false,
        });
        if(!ok) return;
        try{
          const result = store.importSnapshot(snap);
          info('Dane zaimportowane', `Przywrócono ${result.restoredKeys || 0} kluczy danych. Strona zostanie odświeżona.`);
          setTimeout(()=>{ try{ location.reload(); }catch(_){ } }, 700);
        }catch(err){ info('Błąd importu', String(err && err.message || err || 'Nie udało się zaimportować danych.')); }
      });

      [makeBackupBtn, safeStateBtn, exportBtn, importBtn, reportBtn, fileInput].forEach((node)=> actionsWrap.appendChild(node));
      return actionsWrap;
    }

    function buildBackupRow(backup){
      const row = h('div', { class:'data-settings-backup-row' });
      const rowStats = snapshot.readStatsFromSnapshot(backup.snapshot);
      const title = h('div', { class:'data-settings-backup-title' }, [
        h('strong', { text:backup.label || 'Backup danych' }),
        h('span', { class:'muted xs', text:`${formatDate(backup.createdAt)} • ${backup.reason || 'backup'} • ${rowStats.keys || 0} kluczy` }),
        (backup.pinned || backup.safeState) ? h('span', { class:'data-settings-pin', text: backup.safeState ? 'ostatni dobry stan' : 'przypięty' }) : null,
      ]);
      const rowActions = h('div', { class:'data-settings-row-actions' });
      const restoreBtn = h('button', { type:'button', class:'btn btn-success', text:'Przywróć ten backup' });
      const exportOneBtn = h('button', { type:'button', class:'btn', text:'Eksportuj' });
      const pinBtn = h('button', { type:'button', class:'btn', text: backup.pinned ? 'Odepnij' : 'Przypnij' });
      const deleteBtn = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
      restoreBtn.addEventListener('click', async ()=>{
        const ok = await ask({
          title:'PRZYWRÓCIĆ BACKUP?',
          message:'Przywrócenie nadpisze aktualne dane programu. Przed przywróceniem program utworzy backup obecnego stanu.',
          confirmText:'Przywróć',
          cancelText:'Wróć',
          confirmTone:'success',
          cancelTone:'neutral',
          dismissOnOverlay:false,
        });
        if(!ok) return;
        try{
          const result = store.restoreBackup(backup.id);
          info('Backup przywrócony', `Przywrócono ${result.restoredKeys || 0} kluczy danych. Strona zostanie odświeżona.`);
          setTimeout(()=>{ try{ location.reload(); }catch(_){ } }, 700);
        }catch(err){ info('Błąd przywracania', String(err && err.message || err || 'Nie udało się przywrócić backupu.')); }
      });
      exportOneBtn.addEventListener('click', ()=> store.exportBackup(backup.id));
      pinBtn.addEventListener('click', ()=>{ store.updateBackup(backup.id, { pinned:!backup.pinned }); render(); });
      deleteBtn.addEventListener('click', async ()=>{
        const ok = await ask({ title:'USUNĄĆ BACKUP?', message:'Tej operacji nie cofniemy.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
        if(!ok) return;
        try{ store.deleteBackup(backup.id); render(); }catch(err){ info('Nie można usunąć backupu', String(err && err.message || err)); }
      });
      [restoreBtn, exportOneBtn, pinBtn, deleteBtn].forEach((btn)=> rowActions.appendChild(btn));
      row.appendChild(title);
      row.appendChild(rowActions);
      return row;
    }

    function render(){
      renderFooter();
      if(view === 'backup') renderBackup();
      else renderMenu();
    }

    backBtn.addEventListener('click', ()=> setView('menu'));
    closeBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    render();
    FC.panelBox.open({ title:'Ustawienia', contentNode:body, width:'920px', boxClass:'panel-box--rozrys data-settings-panel', dismissOnOverlay:false, dismissOnEsc:true });
    return true;
  }

  FC.dataSettingsModal = { open };
})();
