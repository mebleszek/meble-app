(function(root){
  'use strict';
  const FC = root.FC = root.FC || {}, doc = root.document;
  function node(tag,attrs={},text){
    const element = doc.createElement(tag);
    for(const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    if(text) element.textContent = text;
    return element;
  }

  function button(text,action,value,pressed){
    const attrs = {type:'button','data-drawing-action':action};
    if(value!==undefined) attrs['data-value'] = String(value);
    if(pressed!==undefined) attrs['aria-pressed'] = pressed;
    return node('button',attrs,text);
  }

  function menu(name,icon,buttons){
    const group = node('details',{class:'drawing2d-menu'});
    group.append(node('summary',{'aria-label':name},icon+' '+name));
    const body = node('div');
    body.append(...buttons);
    group.append(body);
    return group;
  }

  function field(form,label,name,value,min){
    const wrapper = node('label',{},label+' (mm)');
    const attrs = {type:'number',inputmode:min===undefined?'decimal':'numeric',name,step:1,required:''};
    if(min!==undefined) attrs.min = min;
    const input = node('input',attrs);
    input.value = value ?? '';
    wrapper.append(input);
    form.append(wrapper);
  }

  function submitBar(label){
    const footer = node('div',{class:'drawing2d-form-footer'});
    footer.append(node('button',{type:'submit',class:'drawing2d-primary'},label));
    return footer;
  }

  function wallField(form,wallId,walls){
    const wallLabel = node('label',{},'Ściana'), select = node('select',{name:'wallId'});
    for(const row of walls) select.append(node('option',{value:row.id},FC.drawingGeometry.wallName(row.id)));
    select.value = String(wallId);
    wallLabel.append(select); form.append(wallLabel);
  }

  function toolbar({walls,wall,obstacles,items,media,state,G}){
    const bar = node('div',{class:'drawing2d-tools','aria-label':'Narzędzia rysunku'});
    const wallActions = walls.length ? [
      button('Zmień wymiary','wall-form','edit'),
      ...(media.matches || wall===walls[0] ? [button('Dodaj z lewej','wall-form','left')] : []),
      ...(media.matches || wall===walls.at(-1) ? [button('Dodaj z prawej','wall-form','right')] : [])
    ] : [button('Dodaj pierwszą ścianę','wall-form','first')];
    bar.append(menu('Widok','◉',[['outline','Bez kolorów'],['color','Kolory'],['texture','Tekstury']]
      .map(([value,label])=>button(label,'mode',value,state.mode===value))),
      menu('Ściany','▱',wallActions));
    const addObstacles = Object.entries({window:'Dodaj okno',door:'Dodaj futrynę',radiator:'Dodaj kaloryfer'}).map(([kind,label])=>{
      const el = button(label,'add-obstacle',kind);
      el.disabled = !wall;
      return el;
    });
    const obstacleMenu = menu('Przeszkody','▣',[...addObstacles,...obstacles.map(({o,label})=>
      button(`Edytuj · ${label} · ${G.wallName(o.wallId)} · ${o.along} mm`,'edit-obstacle',o.id))]);
    obstacleMenu.classList.add('drawing2d-obstacle-menu');
    bar.append(obstacleMenu);
    const hasSelection = items.some(item=>item.p.cabinetId===state.selected);
    const snap = [['edge','Do krawędzi'],['corner','Do narożnika'],['off','Wyłącz']]
      .map(([value,label])=>button(label,'snap',value,state.snap===value));
    if(media.matches){
      const selectedActions = [button('Edytuj szafkę','edit'),button('Edytuj położenie','properties'),
        button('Obróć 90° w lewo','rotate',-1),button('Obróć 90° w prawo','rotate',1)];
      for(const control of selectedActions) control.disabled = !hasSelection;
      const more = menu('Więcej','⋯',[
        button('Blaty i panele','surface-list'),
        node('strong',{},'Zaznaczona szafka'),...selectedActions,node('strong',{},'Przyciąganie'),...snap
      ]);
      more.classList.add('drawing2d-more');
      bar.append(more);
    }else if(hasSelection){
      bar.append(menu('Szafka','▤',[button('Edytuj szafkę','edit'),button('Edytuj położenie','properties')]),
        menu('Obrót','↻',[button('90° w lewo','rotate',-1),button('90° w prawo','rotate',1)]));
    }
    if(!media.matches) bar.append(button('Blaty i panele','surface-list'),menu('Przyciąganie','⊣',snap));
    const zoomOut = button('−','zoom',-25), zoomIn = button('+','zoom',25);
    zoomOut.setAttribute('aria-label','Pomniejsz'); zoomIn.setAttribute('aria-label','Powiększ');
    const controls = node('div',{class:'drawing2d-view-tools','aria-label':'Skala i historia'});
    const undo = button('Cofnij','undo');
    undo.disabled = !state.history.length;
    controls.append(zoomOut,node('span',{class:'drawing2d-zoom'},(media.matches?state.mobileZoom:state.zoom)+'%'),zoomIn,
      button('Dopasuj','fit'),undo);
    bar.append(controls);
    return bar;
  }

  FC.drawingEditorControls = {node,button,field,submitBar,wallField,toolbar};
})(window);
