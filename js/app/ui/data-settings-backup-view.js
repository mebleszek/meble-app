(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function render(ctx){
    const store = ctx.store;
    const snapshot = ctx.snapshot;
    const stats = store.getStats();
    const allBackups = store.listBackups();
    const grouped = store.listBackupGroups ? store.listBackupGroups() : {
      app:allBackups.filter((backup)=> !(store.isTestBackup && store.isTestBackup(backup))),
      test:allBackups.filter((backup)=> store.isTestBackup && store.isTestBackup(backup)),
    };
    ctx.scroll.innerHTML = '';
    ctx.scroll.appendChild(buildHeader());
    ctx.scroll.appendChild(buildOverview({ snapshot, store, stats }));
    ctx.scroll.appendChild(buildActions(ctx));
    ctx.scroll.appendChild(buildBackupGroups(Object.assign({}, ctx, { allBackups, grouped })));
  }

  function buildHeader(){
    const headerCard = h('section', { class:'data-settings-card' });
    headerCard.appendChild(h('h3', { text:'Backup i dane' }));
    headerCard.appendChild(h('p', { class:'muted', text:'Backup obejmuje pełny stan programu: inwestorów, pomieszczenia, projekty, szafki, materiał, wyceny, ustawienia i dane pomocnicze.' }));
    return headerCard;
  }

  function buildOverview(ctx){
    if(FC.dataSettingsReportView && typeof FC.dataSettingsReportView.buildOverview === 'function'){
      return FC.dataSettingsReportView.buildOverview({ h, makeAccordion:dom.makeAccordion, makeStat:dom.makeStat, snapshot:ctx.snapshot, store:ctx.store, stats:ctx.stats });
    }
    return h('section', { class:'data-settings-card' }, [
      dom.makeAccordion('Dane użytkownika', [h('div', { class:'data-settings-stats' }, [
        dom.makeStat('Inwestorzy', ctx.stats.investors),
        dom.makeStat('Projekty', ctx.stats.projects),
        dom.makeStat('Backupy', ctx.stats.backups),
      ])], { open:true }),
    ]);
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
    return dom.makeAccordion(title, [h('p', { class:'muted', text:policyText }), list], { open, sub:String((backups || []).length || 0) });
  }

  FC.dataSettingsBackupView = { render };
})();
