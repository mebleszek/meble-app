(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const dom = root.FC.dataSettingsDom || {};
  const h = dom.h;

  function render(scroll, setView){
    if(!(scroll && h)) return;
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
    grid.appendChild(h('div', { class:'data-settings-menu-tile data-settings-menu-tile--disabled' }, [
      h('span', { class:'data-settings-menu-tile__icon', text:'⚙' }),
      h('span', { class:'data-settings-menu-tile__title', text:'Kolejne ustawienia' }),
      h('span', { class:'data-settings-menu-tile__sub', text:'Tu później mogą dojść dane firmy, wygląd albo domyślne ustawienia wywiadu.' }),
    ]));
    card.appendChild(grid);
    scroll.appendChild(card);
  }

  root.FC.dataSettingsMenuView = { render };
})();
