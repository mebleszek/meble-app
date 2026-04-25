(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function buildList(ctx){
    const list = h('div', { class:'data-settings-backup-list' });
    const backups = ctx.backups || [];
    if(!backups.length){
      list.appendChild(h('div', { class:'muted', text:ctx.emptyText || 'Nie ma jeszcze backupów.' }));
      return list;
    }
    backups.forEach((backup)=> list.appendChild(buildRow(Object.assign({}, ctx, { backup }))));
    return list;
  }

  function buildRow(ctx){
    const backup = ctx.backup || {};
    const row = h('div', { class:'data-settings-backup-row' });
    const rowStats = ctx.snapshot.readStatsFromSnapshot(backup.snapshot);
    const protection = ctx.store.getBackupProtection ? ctx.store.getBackupProtection(backup, ctx.allBackups) : { protected:false };
    row.appendChild(h('div', { class:'data-settings-backup-title' }, [
      h('strong', { text:backup.label || 'Backup danych' }),
      h('span', { class:'muted xs', text:`${dom.formatDate(backup.createdAt)} • ${backup.reason || 'backup'} • ${rowStats.keys || 0} kluczy` }),
      (backup.pinned || backup.safeState) ? h('span', { class:'data-settings-pin', text: backup.safeState ? 'ostatni dobry stan' : 'przypięty' }) : null,
    ]));
    row.appendChild(buildRowActions(ctx, protection));
    return row;
  }

  function buildRowActions(ctx, protection){
    const rowActions = h('div', { class:'data-settings-row-actions' });
    const restoreBtn = h('button', { type:'button', class:'btn btn-success', text:'Przywróć ten backup' });
    const exportOneBtn = h('button', { type:'button', class:'btn', text:'Eksportuj' });
    const pinBtn = h('button', { type:'button', class:'btn', text: ctx.backup.pinned ? 'Odepnij' : 'Przypnij' });
    const deleteBtn = h('button', { type:'button', class:'btn btn-danger' + (protection.protected ? ' data-settings-delete-btn--protected' : ''), text:'Usuń' });
    restoreBtn.addEventListener('click', ()=> restoreBackup(ctx));
    exportOneBtn.addEventListener('click', ()=> ctx.store.exportBackup(ctx.backup.id));
    pinBtn.addEventListener('click', ()=>{ ctx.store.updateBackup(ctx.backup.id, { pinned:!ctx.backup.pinned }); ctx.render(); });
    configureDeleteButton(ctx, deleteBtn, protection);
    [restoreBtn, exportOneBtn, pinBtn, deleteBtn].forEach((btn)=> rowActions.appendChild(btn));
    return rowActions;
  }

  async function restoreBackup(ctx){
    const ok = await dom.ask({
      title:'PRZYWRÓCIĆ BACKUP?',
      message:'Przywrócenie nadpisze aktualne dane programu. Przed przywróceniem program zabezpieczy obecny stan backupem, jeśli nie jest już zapisany.',
      confirmText:'Przywróć',
      cancelText:'Wróć',
      confirmTone:'success',
      cancelTone:'neutral',
      dismissOnOverlay:false,
    });
    if(!ok) return;
    try{
      const result = ctx.store.restoreBackup(ctx.backup.id);
      dom.info('Backup przywrócony', `Przywrócono ${result.restoredKeys || 0} kluczy danych. Strona zostanie odświeżona.`);
      setTimeout(()=>{ try{ location.reload(); }catch(_){ } }, 700);
    }catch(err){ dom.info('Błąd przywracania', String(err && err.message || err || 'Nie udało się przywrócić backupu.')); }
  }

  function configureDeleteButton(ctx, deleteBtn, protection){
    if(protection.protected){
      deleteBtn.disabled = true;
      deleteBtn.setAttribute('aria-disabled', 'true');
      deleteBtn.title = protection.latestProtected ? 'Chroniony — jeden z 3 najnowszych backupów w tej grupie.' : 'Chroniony — backup przypięty albo bezpieczny stan.';
      return;
    }
    deleteBtn.addEventListener('click', async ()=>{
      const ok = await dom.ask({ title:'USUNĄĆ BACKUP?', message:'Tej operacji nie cofniemy.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
      if(!ok) return;
      try{ ctx.store.deleteBackup(ctx.backup.id); ctx.render(); }
      catch(err){ dom.info('Nie można usunąć backupu', String(err && err.message || err)); }
    });
  }

  FC.dataSettingsBackupList = { buildList };
})();
