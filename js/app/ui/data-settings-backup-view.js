(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function render(ctx){
    const store = ctx.store;
    const allBackups = store.listBackups();
    const grouped = store.listBackupGroups ? store.listBackupGroups() : {
      app:allBackups.filter((backup)=> !(store.isTestBackup && store.isTestBackup(backup))),
      test:allBackups.filter((backup)=> store.isTestBackup && store.isTestBackup(backup)),
    };
    ctx.scroll.innerHTML = '';
    ctx.scroll.appendChild(buildHeader());
    ctx.scroll.appendChild(buildActions(ctx));
    ctx.scroll.appendChild(buildBackupGroups(Object.assign({}, ctx, { allBackups, grouped })));
  }

  function buildHeader(){
    const headerCard = h('section', { class:'data-settings-card' });
    const titleRow = h('div', { class:'data-settings-card-title-row' }, [h('h3', { text:'Backup i dane' })]);
    const infoBtn = h('button', { type:'button', class:'info-trigger data-settings-card-info', 'aria-label':'Pokaż informację: Backup i dane' });
    infoBtn.addEventListener('click', ()=> dom.info('Backup i dane', 'Backup obejmuje pełny stan programu: inwestorów, pomieszczenia, projekty, szafki, materiał, wyceny, ustawienia i dane pomocnicze.'));
    titleRow.appendChild(infoBtn);
    headerCard.appendChild(titleRow);
    return headerCard;
  }

  function buildActions(ctx){
    const card = h('section', { class:'data-settings-card' });
    card.appendChild(dom.makeAccordion('Backup i przenoszenie danych', [FC.dataSettingsBackupActions.build(ctx)], { open:true }));
    return card;
  }

  function buildBackupGroups(ctx){
    const listCard = h('section', { class:'data-settings-card' });
    const policyText = `Automatyczne sprzątanie działa osobno dla backupów programu i testowych: zostawia ${ctx.store.MIN_KEEP || 10} najnowszych w każdej grupie, a nadmiar starszy niż ${ctx.store.RETENTION_DAYS || 7} dni usuwa tylko wtedy, gdy nie jest przypięty. ${ctx.store.AUTO_PROTECT_LATEST || 3} najnowsze w każdej grupie mają zablokowany przycisk usuwania.`;
    listCard.appendChild(groupAccordion(ctx, 'Backupy zapisane w programie', ctx.grouped.app, 'Nie ma jeszcze backupów programu.', policyText, true));
    listCard.appendChild(groupAccordion(ctx, 'Backupy testowe', ctx.grouped.test, 'Nie ma jeszcze backupów testowych.', policyText, false));
    return listCard;
  }

  function groupAccordion(ctx, title, backups, emptyText, policyText, open){
    const list = FC.dataSettingsBackupList.buildList(Object.assign({}, ctx, { backups, emptyText }));
    return dom.makeAccordion(title, [list], { open, sub:String((backups || []).length || 0), infoMessage:policyText });
  }

  FC.dataSettingsBackupView = { render };
})();
