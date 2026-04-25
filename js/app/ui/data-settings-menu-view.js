(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const dom = root.FC.dataSettingsDom || {};
  const icons = root.FC.appIcons || {};
  const h = dom.h;

  const INFO = {
    backup:'Kopie danych służą do zabezpieczenia aktualnego stanu programu oraz przenoszenia danych między urządzeniami. Backup obejmuje dane programu i raport pamięci.',
    tests:'Testy aplikacji sprawdzają regresje i mogą tworzyć tymczasowe dane testowe. Dane testowe powinny być oznaczone markerami i sprzątane automatycznie po przebiegu.',
  };

  function addTileActivation(tile, onClick){
    if(typeof onClick !== 'function') return;
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.addEventListener('click', onClick);
    tile.addEventListener('keydown', (event)=>{
      const key = event && (event.key || event.code);
      if(key === 'Enter' || key === ' ' || key === 'Spacebar'){
        event.preventDefault();
        onClick(event);
      }
    });
  }

  function buildIcon(name){
    const wrap = h('span', { class:'data-settings-menu-tile__icon' });
    if(icons && typeof icons.create === 'function') wrap.appendChild(icons.create(name, 'app-ui-icon data-settings-menu-tile__svg'));
    else wrap.textContent = name === 'backup' ? 'B' : (name === 'tests' ? 'T' : 'U');
    return wrap;
  }

  function buildTitle(title, infoKey){
    const row = h('span', { class:'data-settings-menu-tile__title-row' }, [
      h('span', { class:'data-settings-menu-tile__title', text:title }),
    ]);
    const message = INFO[infoKey];
    if(message){
      const infoBtn = h('button', { type:'button', class:'info-trigger data-settings-menu-tile__info', 'aria-label':`Pokaż informację: ${title}` });
      infoBtn.addEventListener('click', (event)=>{
        try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
        if(dom && typeof dom.info === 'function') dom.info(title, message);
      });
      row.appendChild(infoBtn);
    }
    return row;
  }

  function buildTile(opts){
    const tile = h('div', { class:'data-settings-menu-tile' + (opts.disabled ? ' data-settings-menu-tile--disabled' : ''), 'data-settings-section':opts.section || '' }, [
      buildIcon(opts.icon),
      buildTitle(opts.title, opts.infoKey),
      h('span', { class:'data-settings-menu-tile__sub', text:opts.sub }),
    ]);
    if(opts.disabled) tile.setAttribute('aria-disabled', 'true');
    else addTileActivation(tile, opts.onClick);
    return tile;
  }

  function render(scroll, setView){
    if(!(scroll && h)) return;
    scroll.innerHTML = '';
    const card = h('section', { class:'data-settings-card data-settings-menu-card' });
    card.appendChild(h('h3', { text:'Ustawienia' }));
    card.appendChild(h('p', { class:'muted', text:'Wybierz obszar ustawień. Backup jest głębiej, żeby ekran startowy ustawień nie był przeładowany.' }));

    const grid = h('div', { class:'data-settings-menu-grid' });
    grid.appendChild(buildTile({
      icon:'backup',
      title:'Backup i dane',
      sub:'Kopie danych, eksport, import i raport pamięci programu.',
      section:'backup',
      infoKey:'backup',
      onClick:()=> setView('backup'),
    }));
    grid.appendChild(buildTile({
      icon:'tests',
      title:'Testy aplikacji',
      sub:'Diagnostyka, smoke testy i sprawdzanie regresji.',
      section:'tests',
      infoKey:'tests',
      onClick:()=> { root.location.href = 'dev_tests.html'; },
    }));
    grid.appendChild(buildTile({
      icon:'settings',
      title:'Kolejne ustawienia',
      sub:'Tu później mogą dojść dane firmy, wygląd albo domyślne ustawienia wywiadu.',
      disabled:true,
    }));
    card.appendChild(grid);
    scroll.appendChild(card);
  }

  root.FC.dataSettingsMenuView = { render };
})();
