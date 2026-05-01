(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;
  const groupOpenState = { app:true, test:false };

  function captureOpenState(scroll){
    try{
      Array.from((scroll || document).querySelectorAll('[data-backup-group]')).forEach((node)=>{
        const key = String(node.getAttribute('data-backup-group') || '');
        if(key) groupOpenState[key] = !!node.open;
      });
    }catch(_){ }
  }

  function restoreScroll(scroll, top){
    if(!scroll) return;
    const value = Math.max(0, Number(top || 0));
    try{ scroll.scrollTop = value; }catch(_){ }
    try{ requestAnimationFrame(()=>{ scroll.scrollTop = value; }); }catch(_){ }
  }

  function render(ctx){
    const store = ctx.store;
    const scrollTop = Number(ctx.scroll && ctx.scroll.scrollTop || 0);
    captureOpenState(ctx.scroll);
    const allBackups = store.listBackups();
    const grouped = store.listBackupGroups ? store.listBackupGroups() : {
      app:allBackups.filter((backup)=> !(store.isTestBackup && store.isTestBackup(backup))),
      test:allBackups.filter((backup)=> store.isTestBackup && store.isTestBackup(backup)),
    };
    ctx.scroll.innerHTML = '';
    ctx.scroll.appendChild(buildHeader());
    ctx.scroll.appendChild(buildActions(ctx));
    ctx.scroll.appendChild(buildBackupGroups(Object.assign({}, ctx, { allBackups, grouped })));
    restoreScroll(ctx.scroll, scrollTop);
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
    const appPolicyText = `Automatyczne sprzątanie backupów programu działa jak dotychczas: zostawia minimum ${ctx.store.MIN_KEEP || 10} najnowszych, a nadmiar starszy niż ${ctx.store.RETENTION_DAYS || 7} dni usuwa tylko wtedy, gdy nie jest przypięty.`;
    const testPolicyText = `Backupy testowe są ograniczone do maksymalnie ${ctx.store.TEST_MAX_KEEP || 10} najnowszych sztuk. Przy tworzeniu kolejnych backupów testowych najstarsze są usuwane automatycznie.`;
    listCard.appendChild(groupAccordion(ctx, 'app', 'Backupy zapisane w programie', ctx.grouped.app, 'Nie ma jeszcze backupów programu.', appPolicyText));
    listCard.appendChild(groupAccordion(ctx, 'test', 'Backupy testowe', ctx.grouped.test, 'Nie ma jeszcze backupów testowych.', testPolicyText));
    return listCard;
  }

  function groupAccordion(ctx, groupKey, title, backups, emptyText, policyText){
    const list = FC.dataSettingsBackupList.buildList(Object.assign({}, ctx, { backups, emptyText }));
    const accordion = dom.makeAccordion(title, [list], { open:groupOpenState[groupKey] !== false, sub:String((backups || []).length || 0), infoMessage:policyText });
    accordion.setAttribute('data-backup-group', groupKey);
    accordion.addEventListener('toggle', ()=>{ groupOpenState[groupKey] = !!accordion.open; });
    return accordion;
  }

  FC.dataSettingsBackupView = { render };
})();
