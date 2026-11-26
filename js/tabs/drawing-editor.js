(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const doc = root.document;
  const screens = new WeakMap();
  const blank = () => ({version:1,walls:[],placements:[]});
  const title = cab => cab.name || [cab.type,cab.subType,Math.round(Number(cab.width)*10)+' mm'].filter(Boolean).join(' · ');

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
    const attrs = {type:'number',name,step:1,required:''};
    if(min!==undefined) attrs.min = min;
    const input = node('input',attrs);
    input.value = value ?? '';
    wrapper.append(input);
    form.append(wrapper);
  }

  function render(host,roomId){
    const storage = FC.drawingStorage, G = FC.drawingGeometry, owner = storage.scope(roomId);
    const fingerprint = JSON.stringify([owner.investor,owner.project,owner.room]);
    let state = screens.get(host);
    if(state?.fingerprint!==fingerprint){
      state = {fingerprint,view:0,wall:1,snap:'edge',mode:'outline',zoom:100,panel:'cabinet-list'};
      screens.set(host,state);
    }
    const shell = node('section',{class:'drawing2d','aria-label':'Rysunek 2D'});
    host.replaceChildren(shell);
    let room, drawing, walls, wall, visibleWall, items, warnings, stage, canvas, drag;
    let busy = false, message = '';

    function draw(){
      room = root.projectData?.[roomId];
      if(!room || !host.contains(shell)) return;
      const scroll = [stage?.scrollLeft||0,stage?.scrollTop||0];
      drawing = room.drawing2d ?? blank();
      walls = G.walls(drawing);
      if(state.view && !walls.some(row=>row.id===state.view)) state.view = 0;
      wall = walls.find(row=>row.id===(state.view||state.wall)) || walls[0];
      visibleWall = state.view ? wall : null;
      const byId = new Map((room.cabinets||[]).map(cab=>[cab.id,cab]));
      const byWall = new Map(walls.map(row=>[row.id,row]));
      items = drawing.placements.flatMap(p=>{
        const cabinet = byId.get(p.cabinetId), wall = byWall.get(p.wallId);
        if(!cabinet || !wall) return [];
        const dimensions = G.size(cabinet,p.rotation);
        if(!dimensions) return [];
        return [{p,cabinet,wall,dimensions,box:G.planBox(wall,p,dimensions),label:title(cabinet)}];
      });
      warnings = G.warnings(items);
      shell.replaceChildren(toolbar(),views());
      const work = node('div',{class:'drawing2d-work'});
      stage = node('div',{class:'drawing2d-stage'});
      const join = wall && ['left','right'].includes(state.wallForm) ? [wall,state.wallForm==='left'?0:wall.length] : null;
      canvas = FC.drawingCanvas.paint(stage,{walls,wall:visibleWall,items,selected:state.selected,warnings,mode:state.mode,zoom:state.zoom,join});
      if(canvas) wirePointer();
      else{
        const empty = node('div',{class:'drawing2d-empty'});
        empty.append(button('Dodaj pierwszą ścianę','wall-form','first'));
        stage.append(empty);
      }
      work.append(stage,panel());
      shell.append(work,node('p',{class:'drawing2d-status',role:'status'},message));
      stage.scrollLeft = scroll[0]; stage.scrollTop = scroll[1];
    }

    function toolbar(){
      const bar = node('div',{class:'drawing2d-tools','aria-label':'Narzędzia rysunku'});
      const wallActions = walls.length ? [
        button('Zmień wymiary','wall-form','edit'),
        ...(wall===walls[0] ? [button('Dodaj z lewej','wall-form','left')] : []),
        ...(wall===walls.at(-1) ? [button('Dodaj z prawej','wall-form','right')] : [])
      ] : [button('Dodaj pierwszą ścianę','wall-form','first')];
      bar.append(menu('Widok','◉',[['outline','Bez kolorów'],['color','Kolory'],['texture','Tekstury']]
        .map(([value,label])=>button(label,'mode',value,state.mode===value))),
        menu('Ściany','▱',wallActions));
      if(items.some(item=>item.p.cabinetId===state.selected)){
        bar.append(menu('Szafka','▤',[button('Edytuj szafkę','edit'),button('Edytuj położenie','properties')]),
          menu('Obrót','↻',[button('90° w lewo','rotate',-1),button('90° w prawo','rotate',1)]));
      }
      bar.append(menu('Przyciąganie','⊣',[['edge','Do krawędzi'],['corner','Do narożnika'],['off','Wyłącz']]
        .map(([value,label])=>button(label,'snap',value,state.snap===value))));
      const zoomOut = button('−','zoom',-25), zoomIn = button('+','zoom',25);
      zoomOut.setAttribute('aria-label','Pomniejsz'); zoomIn.setAttribute('aria-label','Powiększ');
      bar.append(zoomOut,node('span',{class:'drawing2d-zoom'},state.zoom+'%'),zoomIn);
      return bar;
    }

    function views(){
      const nav = node('nav',{class:'drawing2d-views','aria-label':'Widoki rysunku'});
      nav.append(button('Rzut z góry','view',0,!state.view));
      for(const row of walls) nav.append(button(G.wallName(row.id),'view',row.id,state.view===row.id));
      return nav;
    }

    function wallForm(){
      const form = node('form',{'data-drawing-form':'wall'});
      const side = state.wallForm;
      const edit = side==='edit';
      const heading = edit ? G.wallName(wall.id)+' — wymiary' : side==='first' ? 'Pierwsza ściana' : side==='left' ? 'Ściana z lewej' : 'Ściana z prawej';
      form.append(node('h3',{},heading));
      field(form,'Długość','length',edit?wall.length:undefined,1);
      field(form,'Wysokość','height',wall?.height ?? Math.round((Number(room.settings?.roomHeight)||260)*10),1);
      form.append(node('button',{type:'submit',class:'drawing2d-primary'},edit?'Zastosuj':'Dodaj ścianę'));
      return form;
    }

    function positionForm(item){
      const form = node('form',{'data-drawing-form':'position'});
      form.append(node('h3',{},item.label));
      const wallLabel = node('label',{},'Ściana'), select = node('select',{name:'wallId'});
      for(const row of walls) select.append(node('option',{value:row.id},G.wallName(row.id)));
      select.value = String(item.p.wallId);
      wallLabel.append(select); form.append(wallLabel);
      field(form,'Od początku ściany','along',item.p.along);
      field(form,'Od ściany','inset',item.p.inset);
      field(form,'Od podłogi','elevation',item.p.elevation);
      form.append(node('button',{type:'submit',class:'drawing2d-primary'},'Zastosuj położenie'),
        button('Edytuj szafkę','edit'),button('Zdejmij z rysunku','unplace'));
      for(const warning of warnings.get(item.p.cabinetId)||[]) form.append(node('p',{class:'drawing2d-warning'},warning));
      return form;
    }

    function cabinetList(){
      const list = node('div',{class:'drawing2d-cabinet-list'});
      if(!room.cabinets?.length) list.append(node('p',{},'W tym pomieszczeniu nie ma jeszcze szafek.'));
      for(const cab of room.cabinets||[]){
        const item = items.find(entry=>entry.p.cabinetId===cab.id);
        const el = button(title(cab),'cabinet',cab.id,state.selected===cab.id);
        const valid = G.size(cab,0);
        el.append(node('small',{},item?G.wallName(item.p.wallId):valid?'Na rysunek':'Brak wymiarów'));
        if(!item && (!wall || !valid)) el.disabled = true;
        list.append(el);
      }
      return list;
    }

    function panel(){
      const aside = node('aside',{class:'drawing2d-panel'+(state.mobilePanel?' is-open':''),'aria-label':'Panel rysunku'});
      const tabs = node('div',{class:'drawing2d-panel-tabs'});
      tabs.append(button('Szafki z projektu','panel','cabinet-list',state.panel==='cabinet-list'),
        button('Właściwości','panel','properties',state.panel==='properties'),
        button('Zwiń','panel-close'));
      aside.append(tabs);
      const content = node('div',{class:'drawing2d-panel-content'});
      if(state.panel==='cabinet-list') content.append(cabinetList());
      else if(state.wallForm) content.append(wallForm());
      else {
        const selected = items.find(item=>item.p.cabinetId===state.selected);
        if(selected) content.append(positionForm(selected));
        else if(wall) content.append(button(G.wallName(wall.id)+' — wymiary','wall-form','edit'));
        else content.append(button('Dodaj pierwszą ścianę','wall-form','first'));
      }
      aside.append(content);
      return aside;
    }

    async function commit(next,complete){
      if(busy || JSON.stringify(drawing)===JSON.stringify(next)) return;
      busy = true;
      shell.setAttribute('aria-busy','true');
      try{
        const saved = await storage.save(owner,next);
        if(!saved) message = 'Zmiana układu nie została potwierdzona.';
        else{
          complete?.();
          FC.views?.refreshSessionButtons?.();
          message = 'Układ zapisany w sesji. Aby zakończyć edycję pomieszczenia, użyj przycisku Zapisz.';
        }
      }catch(error){
        message = 'Zmiana układu nie została zapisana.';
        FC.infoBox?.open({title:'Zapis rysunku wstrzymany',message:error.code||message,okOnly:true});
      }finally{
        busy = false;
        shell.removeAttribute('aria-busy');
        draw();
      }
    }

    function replacePlacement(p){
      const next = structuredClone(drawing);
      next.placements = next.placements.map(row=>row.cabinetId===p.cabinetId?p:row);
      return next;
    }

    function select(item,showPanel){
      state.selected = item.p.cabinetId;
      state.wallForm = null;
      state.wall = item.p.wallId;
      if(state.view) state.view = item.p.wallId;
      state.panel = 'properties';
      if(showPanel) state.mobilePanel = true;
    }

    function place(id){
      const item = items.find(row=>row.p.cabinetId===id);
      if(item){select(item,true);draw();return;}
      const cab = room.cabinets.find(row=>row.id===id);
      if(!wall || !cab) return;
      const elevation = G.elevation(room,cab), dimensions = G.size(cab,0);
      if(!dimensions) return;
      const along = Math.max(0,...items.filter(row=>row.p.wallId===wall.id && row.p.elevation<elevation+dimensions.height
        && row.p.elevation+row.dimensions.height>elevation).map(row=>row.p.along+row.dimensions.span));
      const p = {cabinetId:id,wallId:wall.id,along,inset:0,elevation,rotation:0};
      void commit({...drawing,placements:[...drawing.placements,p]},()=>select({p},true));
    }

    const actions = {
      view(value){state.view=Number(value);if(state.view)state.wall=state.view;state.selected=null;state.wallForm=null;},
      mode(value){state.mode=value;},snap(value){state.snap=value;},
      zoom(value){state.zoom=Math.max(75,Math.min(225,state.zoom+Number(value)));},
      'wall-form'(value){state.wallForm=value;state.panel='properties';state.mobilePanel=true;},
      panel(value){state.panel=value;state.mobilePanel=true;},
      'panel-close'(){state.mobilePanel=false;},
      properties(){state.wallForm=null;state.panel='properties';state.mobilePanel=true;},
      cabinet(value){place(value);return false;},
      edit(){if(state.selected && storage.current(owner))FC.cabinetModal.openCabinetModalForEdit(state.selected);return false;},
      rotate(value){
        const p = items.find(row=>row.p.cabinetId===state.selected)?.p;
        if(p) void commit(replacePlacement({...p,rotation:(p.rotation+Number(value)+4)%4}));
        return false;
      },
      unplace(){
        const placements = drawing.placements.filter(p=>p.cabinetId!==state.selected);
        void commit({...drawing,placements},()=>{state.selected=null;state.panel='cabinet-list';});
        return false;
      }
    };
    shell.addEventListener('click',event=>{
      const el = event.target.closest('[data-drawing-action]');
      if(!el || busy) return;
      el.closest('details')?.removeAttribute('open');
      if(actions[el.dataset.drawingAction](el.dataset.value)!==false) draw();
    });
    shell.addEventListener('submit',event=>{
      event.preventDefault();
      if(busy) return;
      const form = event.target, data = new FormData(form);
      const read = name=>Number(data.get(name));
      if(form.dataset.drawingForm==='wall'){
        const side = state.wallForm, id = side==='edit'?wall.id:Math.max(0,...walls.map(row=>row.id))+1;
        const next = {id,length:read('length'),height:read('height')};
        const rows = side==='edit'?drawing.walls.map(row=>row.id===id?next:row)
          : side==='left'?[next,...drawing.walls]:[...drawing.walls,next];
        void commit({...drawing,walls:rows},()=>{state.wall=id;state.wallForm=null;if(state.view)state.view=id;});
      }else{
        const p = items.find(row=>row.p.cabinetId===state.selected)?.p;
        if(!p) return;
        const next = {...p,wallId:read('wallId'),along:read('along'),inset:read('inset'),elevation:read('elevation')};
        void commit(replacePlacement(next),()=>select({p:next},false));
      }
    });

    function wirePointer(){
      const point = (event,inverse)=>new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse);
      canvas.addEventListener('pointerdown',event=>{
        const group = event.target.closest('[data-cabinet]');
        if(!group || event.button!==0 || busy || drag) return;
        const item = items.find(row=>row.p.cabinetId===group.dataset.cabinet);
        const inverse = canvas.getScreenCTM()?.inverse();
        if(!inverse) return;
        const start = point(event,inverse);
        drag = {group,inverse,start,item,id:event.pointerId,p:item.p,moved:false};
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointermove',event=>{
        if(drag?.id!==event.pointerId) return;
        const {item,start,inverse,group} = drag;
        const now = point(event,inverse), dx = now.x-start.x, dy = now.y-start.y;
        if(!drag.moved && Math.hypot(dx,dy)<Math.abs(inverse.a)*5) return;
        drag.moved = true;
        const p = item.p;
        const delta = G.fromPlan(item.wall,{x:item.wall.x+dx,y:item.wall.y+dy});
        const next = {...p,along:Math.round(p.along+(visibleWall?dx:delta.along)),
          inset:visibleWall?p.inset:Math.round(p.inset+delta.inset),
          elevation:visibleWall?Math.round(p.elevation-dy):p.elevation};
        const neighbors = items.filter(row=>row!==item && row.p.wallId===p.wallId
          && row.p.elevation<next.elevation+item.dimensions.height && row.p.elevation+row.dimensions.height>next.elevation)
          .map(row=>({...row.p,span:row.dimensions.span}));
        drag.p = G.snap(next,item.wall,item.dimensions,neighbors,state.snap,Math.abs(inverse.a)*12);
        if(visibleWall) drag.p.inset = p.inset;
        group.classList.toggle('is-snapped',drag.p.along!==next.along || drag.p.inset!==next.inset);
        const previous = G.toPlan(item.wall,p.along,p.inset), target = G.toPlan(item.wall,drag.p.along,drag.p.inset);
        group.setAttribute('transform',visibleWall?`translate(${drag.p.along-p.along} ${p.elevation-drag.p.elevation})`
          :`translate(${target.x-previous.x} ${target.y-previous.y})`);
      });
      canvas.addEventListener('pointerup',event=>{
        if(drag?.id!==event.pointerId) return;
        const {item,p,moved,group} = drag; drag = null;
        const next = replacePlacement(p);
        if(moved && JSON.stringify(next)!==JSON.stringify(drawing)){
          group.removeAttribute('transform');
          void commit(next,()=>select({p},false));
        }else{select(item,true);draw();}
      });
      canvas.addEventListener('pointercancel',event=>{if(drag?.id===event.pointerId){drag=null;draw();}});
      canvas.addEventListener('keydown',event=>{
        const id = event.target.closest('[data-cabinet]')?.dataset.cabinet;
        if(!busy && id && ['Enter',' '].includes(event.key)){event.preventDefault();select(items.find(row=>row.p.cabinetId===id),true);draw();}
      });
    }
    draw();
  }
  FC.drawingEditor = {render};
})(window);
