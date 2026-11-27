(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const doc = root.document;
  const screens = new WeakMap();
  const blank = () => ({version:1,walls:[],placements:[],obstacles:[]});
  const title = cab => cab.name || [cab.type,cab.subType,Math.round(Number(cab.width)*10)+' mm'].filter(Boolean).join(' · ');
  const clamp = (value,min,max)=>Math.max(min,Math.min(max,value));
  let releaseEditor;

  function unmount(){
    releaseEditor?.();
    releaseEditor = null;
  }

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

  function render(host,roomId){
    unmount();
    const storage = FC.drawingStorage, G = FC.drawingGeometry, owner = storage.scope(roomId);
    const renderer = FC.drawingCanvas, mobile = FC.drawingMobile, media = root.matchMedia('(max-width: 760px)');
    const fingerprint = JSON.stringify([owner.investor,owner.project,owner.room]);
    let state = screens.get(host);
    if(state?.fingerprint!==fingerprint){
      state = {fingerprint,view:0,wall:1,snap:'edge',mode:'outline',zoom:100,mobileZoom:100,panel:'cabinet-list',panelRatio:.36,history:[]};
      screens.set(host,state);
    }
    const shell = node('section',{class:'drawing2d','aria-label':'Rysunek 2D'});
    host.replaceChildren(shell);
    let room, drawing, walls, wall, visibleWall, items, obstacles, warnings, stage, canvas, drag, paintOptions;
    let busy = false, message = '', work, observer, camera;
    const restoreChrome = mobile.mountChrome(media,draw);
    releaseEditor = ()=>{
      observer?.disconnect();
      restoreChrome();
    };
    const roomName = doc.getElementById('drawingRoomName');
    if(roomName) roomName.textContent = doc.getElementById('roomTitle')?.textContent || 'Pomieszczenie';
    FC.views?.refreshSessionButtons?.();

    function draw(){
      room = root.projectData?.[roomId];
      if(!room || !host.contains(shell)) return;
      const scroll = [stage?.scrollLeft||0,stage?.scrollTop||0];
      drawing = room.drawing2d ?? blank();
      if(state.history.length && state.history.at(-1).after!==JSON.stringify(room.drawing2d)) state.history.length = 0;
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
      obstacles = G.obstacles(drawing,walls);
      if(!wall || (state.obstacle?.id && !obstacles.some(item=>item.o.id===state.obstacle.id))) state.obstacle = null;
      warnings = G.warnings(items,obstacles);
      observer?.disconnect();
      shell.replaceChildren(toolbar(),views());
      work = node('div',{class:'drawing2d-work'});
      stage = node('div',{class:'drawing2d-stage'});
      paintOptions = {walls,wall:visibleWall,items,obstacles,selected:state.selected,selectedObstacle:state.obstacle?.id,
        warnings,mode:state.mode,zoom:state.zoom,preview:wallPreview()};
      canvas = renderer.paint(stage,paintOptions);
      const frame = canvas?.getAttribute('viewBox').split(' ').map(Number);
      camera = canvas && media.matches ? mobile.camera(stage,canvas,frame,state,label=>{
        const value = shell.querySelector('.drawing2d-zoom');
        if(value.textContent!==label) value.textContent = label;
      }) : null;
      if(canvas) wirePointer();
      else{
        const empty = node('div',{class:'drawing2d-empty'});
        empty.append(button('Dodaj pierwszą ścianę','wall-form','first'));
        stage.append(empty);
      }
      work.append(stage,panel());
      shell.append(work,node('p',{class:'drawing2d-status',role:'status'},message));
      if(media.matches){
        mobile.setPanelRatio(work,state,state.panelRatio);
        camera?.update();
        camera?.keepSelectionVisible();
        observer = new ResizeObserver(()=>{
          camera?.update();
          camera?.keepSelectionVisible();
          mobile.revealField();
        });
        observer.observe(stage);
      }
      stage.scrollLeft = scroll[0]; stage.scrollTop = scroll[1];
      const activeView = shell.querySelector('.drawing2d-views [aria-pressed="true"]');
      if(activeView && media.matches){
        const nav = activeView.parentElement;
        nav.scrollLeft = clamp(activeView.offsetLeft-nav.offsetLeft-nav.clientWidth+activeView.offsetWidth+6,0,nav.scrollWidth);
      }
    }

    function toolbar(){
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
          node('strong',{},'Zaznaczona szafka'),...selectedActions,node('strong',{},'Przyciąganie'),...snap
        ]);
        more.classList.add('drawing2d-more');
        bar.append(more);
      }else if(hasSelection){
        bar.append(menu('Szafka','▤',[button('Edytuj szafkę','edit'),button('Edytuj położenie','properties')]),
          menu('Obrót','↻',[button('90° w lewo','rotate',-1),button('90° w prawo','rotate',1)]));
      }
      if(!media.matches) bar.append(menu('Przyciąganie','⊣',snap));
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

    function views(){
      const nav = node('nav',{class:'drawing2d-views','aria-label':'Widoki rysunku'});
      nav.append(button('Rzut z góry','view',0,!state.view));
      for(const row of walls) nav.append(button(G.wallName(row.id),'view',row.id,state.view===row.id));
      return nav;
    }

    function wallForm(){
      const form = node('form',{'data-drawing-form':'wall'});
      const fields = node('div',{class:'drawing2d-form-fields'});
      const side = state.wallForm;
      const edit = side==='edit';
      const name = G.wallName(edit?wall.id:G.nextWallId(walls));
      const heading = edit ? name+' — wymiary' : 'Dodaj ścianę '+name.slice(7);
      fields.append(node('h3',{},heading));
      if(side==='left' || side==='right'){
        const end = side==='left' ? 'początku' : 'końca';
        fields.append(node('p',{class:'drawing2d-form-note'},`Od ${end} ściany ${G.wallName(wall.id).slice(7)} · ${side==='left'?'z lewej strony':'z prawej strony'}`));
      }
      field(fields,'Długość','length',state.wallDraft?.length ?? (edit?wall.length:undefined),1);
      field(fields,'Wysokość','height',state.wallDraft?.height ?? wall?.height ?? Math.round((Number(room.settings?.roomHeight)||260)*10),1);
      form.append(fields,submitBar(edit?'Zastosuj':'Dodaj ścianę'));
      return form;
    }

    function submitBar(label){
      const footer = node('div',{class:'drawing2d-form-footer'});
      footer.append(node('button',{type:'submit',class:'drawing2d-primary'},label));
      return footer;
    }

    function wallField(form,wallId){
      const wallLabel = node('label',{},'Ściana'), select = node('select',{name:'wallId'});
      for(const row of walls) select.append(node('option',{value:row.id},G.wallName(row.id)));
      select.value = String(wallId);
      wallLabel.append(select); form.append(wallLabel);
    }

    function positionForm(item){
      const form = node('form',{'data-drawing-form':'position'});
      const fields = node('div',{class:'drawing2d-form-fields'});
      fields.append(node('h3',{},item.label));
      wallField(fields,item.p.wallId);
      field(fields,'Od początku ściany','along',item.p.along);
      field(fields,'Od ściany','inset',item.p.inset);
      field(fields,'Od podłogi','elevation',item.p.elevation);
      const extras = node('div',{class:'drawing2d-form-extras'});
      extras.append(button('Edytuj szafkę','edit'),button('Zdejmij z rysunku','unplace'));
      for(const warning of warnings.get(item.p.cabinetId)||[]) extras.append(node('p',{class:'drawing2d-warning'},warning));
      fields.append(extras);
      form.append(fields,submitBar('Zastosuj położenie'));
      return form;
    }

    function obstacleForm(){
      const {id,kind,draft} = state.obstacle;
      const obstacle = draft || obstacles.find(item=>item.o.id===id)?.o || {};
      const form = node('form',{'data-drawing-form':'obstacle'});
      const fields = node('div',{class:'drawing2d-form-fields'});
      fields.append(node('h3',{},G.obstacleNames[kind]));
      wallField(fields,obstacle.wallId ?? wall.id);
      field(fields,'Od początku ściany','along',obstacle.along,0);
      field(fields,'Szerokość','width',obstacle.width,1);
      field(fields,'Wysokość','height',obstacle.height,1);
      if(kind!=='door') field(fields,'Od podłogi do dolnej krawędzi','elevation',obstacle.elevation,0);
      if(kind==='radiator') field(fields,'Wystaje od ściany','depth',obstacle.depth,1);
      const extras = node('div',{class:'drawing2d-form-extras'});
      if(id) extras.append(button('Usuń przeszkodę','remove-obstacle',id));
      for(const warning of warnings.get(id)||[]) extras.append(node('p',{class:'drawing2d-warning'},warning));
      if(extras.childNodes.length) fields.append(extras);
      form.append(fields,submitBar(id?'Zastosuj zmiany':'Dodaj przeszkodę'));
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
      if(media.matches && state.mobilePanel){
        const handle = button(state.panelRatio>.5?'Zmniejsz panel':'Rozwiń panel','panel-size');
        handle.className = 'drawing2d-panel-handle';
        mobile.wirePanelHandle(handle,state);
        aside.append(handle);
      }
      const tabs = node('div',{class:'drawing2d-panel-tabs'});
      tabs.append(button('Szafki z projektu','panel','cabinet-list',state.panel==='cabinet-list'),
        button('Właściwości','panel','properties',state.panel==='properties'),
        button('Zwiń','panel-close'));
      aside.append(tabs);
      const content = node('div',{class:'drawing2d-panel-content'});
      if(state.panel==='cabinet-list') content.append(cabinetList());
      else if(state.obstacle) content.append(obstacleForm());
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
      const after = JSON.stringify(next);
      if(busy || JSON.stringify(room.drawing2d)===after) return;
      const before = structuredClone(room.drawing2d);
      busy = true;
      shell.setAttribute('aria-busy','true');
      try{
        const saved = await storage.save(owner,next);
        if(!saved) message = 'Zmiana układu nie została potwierdzona.';
        else{
          if(complete!==finishUndo){
            state.history.push({before,after:JSON.stringify(root.projectData[roomId].drawing2d)});
            if(state.history.length>30) state.history.shift();
          }
          complete?.();
          FC.views?.refreshSessionButtons?.();
          message = '';
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

    function finishUndo(){
      state.history.pop();
      if(state.history.length) state.history.at(-1).after = JSON.stringify(root.projectData[roomId].drawing2d);
      state.wallForm = null;
      state.obstacle = null;
      if(!root.projectData[roomId].drawing2d?.placements.some(p=>p.cabinetId===state.selected)) state.selected = null;
      state.camera = null;
    }

    function wallPreview(){
      return G.previewWall(drawing.walls,state.wallForm,Number(state.wallDraft?.length));
    }

    function updatePreview(){
      if(!canvas || !paintOptions.preview) return;
      paintOptions.preview = wallPreview();
      renderer.paintPreview(canvas,paintOptions.preview);
      const frame = renderer.frame(paintOptions);
      if(camera) camera.refit(frame);
      else canvas.setAttribute('viewBox',frame.join(' '));
    }

    function replacePlacement(p){
      const next = structuredClone(drawing);
      next.placements = next.placements.map(row=>row.cabinetId===p.cabinetId?p:row);
      return next;
    }

    function select(item,showPanel){
      state.selected = item.p.cabinetId;
      state.obstacle = null;
      state.wallForm = null;
      state.wallDraft = null;
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
      view(value){state.view=Number(value);if(state.view)state.wall=state.view;state.selected=null;state.wallForm=null;state.wallDraft=null;state.obstacle=null;state.camera=null;},
      mode(value){state.mode=value;},snap(value){state.snap=value;},
      zoom(value){
        if(media.matches){camera?.zoom(state.mobileZoom+Number(value));return false;}
        state.zoom=clamp(state.zoom+Number(value),75,225);
      },
      fit(){
        state.camera = null;
        if(media.matches){camera?.zoom(100);return false;}
        state.zoom = 100;
        stage.scrollTo(0,0);
      },
      undo(){
        if(state.history.length) void commit(state.history.at(-1).before,finishUndo);
        return false;
      },
      'wall-form'(value){
        state.wallForm=value;
        state.wallDraft=null;
        state.obstacle=null;
        state.panel='properties';
        state.mobilePanel=true;
        if(value!=='edit'){
          state.view=0;
          if(value==='left' || value==='right') state.wall=(value==='left'?walls[0]:walls.at(-1)).id;
          state.selected=null;
          state.mobileZoom=100;
          state.camera=null;
        }
      },
      'add-obstacle'(kind){selectObstacle({kind});},
      'edit-obstacle'(id){
        const item = obstacles.find(item=>item.o.id===id);
        if(item) selectObstacle(item.o);
      },
      'remove-obstacle'(id){
        const remaining = drawing.obstacles.filter(o=>o.id!==id);
        void commit({...drawing,obstacles:remaining},()=>{state.obstacle=null;});
        return false;
      },
      panel(value){state.panel=value;state.mobilePanel=true;},
      'panel-close'(){state.mobilePanel=false;},
      'panel-size'(){mobile.setPanelRatio(work,state,state.panelRatio>.5?.36:.70);return false;},
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
    function selectObstacle({id,kind,wallId}){
      state.selected = null;
      state.wallForm = null;
      state.wallDraft = null;
      state.obstacle = {id,kind};
      if(wallId){
        state.wall = wallId;
        if(state.view) state.view = wallId;
      }
      state.panel = 'properties';
      state.mobilePanel = true;
    }
    shell.addEventListener('click',event=>{
      const el = event.target.closest('[data-drawing-action]');
      if(!el || busy) return;
      el.closest('details')?.removeAttribute('open');
      if(actions[el.dataset.drawingAction](el.dataset.value)!==false) draw();
    });
    shell.addEventListener('toggle',event=>{
      if(event.target.tagName==='DETAILS' && event.target.open){
        for(const menu of shell.querySelectorAll('details[open]')){
          if(menu!==event.target) menu.open=false;
        }
      }
    },true);
    shell.addEventListener('input',event=>{
      if(!event.target.closest('[data-drawing-form="wall"]')) return;
      state.wallDraft ??= {};
      state.wallDraft[event.target.name] = event.target.value;
      if(event.target.name==='length') updatePreview();
    });
    shell.addEventListener('submit',event=>{
      event.preventDefault();
      if(busy) return;
      const form = event.target, data = new FormData(form);
      const read = name=>Number(data.get(name));
      if(form.dataset.drawingForm==='wall'){
        const side = state.wallForm, id = side==='edit'?wall.id:G.nextWallId(walls);
        const next = {id,length:read('length'),height:read('height')};
        void commit({...drawing,walls:G.wallRows(drawing.walls,side,next)},()=>{
          state.wall=id;
          state.wallForm=null;
          state.wallDraft=null;
          if(side!=='edit') state.mobilePanel=false;
        });
      }else if(form.dataset.drawingForm==='obstacle'){
        const current = state.obstacle;
        const {kind} = current;
        const id = current.id || current.draft?.id || 'obs_'+FC.utils.uid();
        const next = {id,kind,wallId:read('wallId'),along:read('along'),width:read('width'),height:read('height'),
          elevation:kind==='door'?0:read('elevation')};
        if(kind==='radiator') next.depth = read('depth');
        current.draft = next;
        const records = drawing.obstacles||[];
        const obstacles = current.id ? records.map(o=>o.id===id?next:o) : [...records,next];
        void commit({...drawing,obstacles},()=>selectObstacle(next));
      }else{
        const p = items.find(row=>row.p.cabinetId===state.selected)?.p;
        if(!p) return;
        const next = {...p,wallId:read('wallId'),along:read('along'),inset:read('inset'),elevation:read('elevation')};
        void commit(replacePlacement(next),()=>select({p:next},false));
      }
    });

    function wirePointer(){
      const surface = canvas;
      const point = (event,inverse)=>new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse);
      function cancelDrag(release=true){
        const {group,id} = drag;
        drag = null;
        group.removeAttribute('transform');
        group.classList.remove('is-snapped');
        if(release && surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
      }
      function beginDrag(event,group){
        const item = items.find(row=>row.p.cabinetId===group.dataset.cabinet);
        const inverse = surface.getScreenCTM()?.inverse();
        if(item && inverse) drag = {group,inverse,start:point(event,inverse),item,id:event.pointerId,
          pointerType:event.pointerType,p:item.p,moved:false};
      }
      function moveDrag(event){
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
      }
      function finishDrag(event){
        if(drag?.id!==event.pointerId) return;
        const {item,p,moved} = drag;
        cancelDrag(false);
        const next = replacePlacement(p);
        if(moved && JSON.stringify(next)!==JSON.stringify(drawing)){
          void commit(next,()=>select({p},false));
        }else if(!moved){select(item,true);draw();}
      }
      const discardCapturedDrag = event=>{if(drag?.id===event.pointerId) cancelDrag();};
      if(media.matches) mobile.wirePointers(surface,state,camera,{busy:()=>busy,begin:beginDrag,move:moveDrag,
        finish:finishDrag,cancel:()=>{if(drag) cancelDrag(false);},select(target){
          if(target.dataset.cabinet) select(items.find(item=>item.p.cabinetId===target.dataset.cabinet),true);
          else actions['edit-obstacle'](target.dataset.obstacle);
          draw();
        }});
      else{
        surface.addEventListener('touchstart',event=>{
          if(drag?.pointerType==='touch' && event.touches.length>1) cancelDrag();
        },{passive:true});
        surface.addEventListener('touchmove',event=>{
          if(drag?.pointerType!=='touch') return;
          if(event.touches.length>1){cancelDrag();return;}
          if(event.cancelable) event.preventDefault();
        },{passive:false});
        surface.addEventListener('pointerdown',event=>{
          const group = event.target.closest('[data-cabinet]');
          if(!group || event.button!==0 || !event.isPrimary || busy || drag) return;
          beginDrag(event,group);
          if(drag) surface.setPointerCapture(event.pointerId);
        });
        surface.addEventListener('pointermove',moveDrag);
        surface.addEventListener('pointerup',finishDrag);
        surface.addEventListener('pointercancel',discardCapturedDrag);
        surface.addEventListener('lostpointercapture',discardCapturedDrag);
        surface.addEventListener('click',event=>{
          const id = event.target.closest('[data-obstacle]')?.dataset.obstacle;
          if(!busy && id){actions['edit-obstacle'](id);draw();}
        });
      }
      surface.addEventListener('keydown',event=>{
        if(busy || !['Enter',' '].includes(event.key)) return;
        const obstacle = event.target.closest('[data-obstacle]')?.dataset.obstacle;
        if(obstacle){event.preventDefault();actions['edit-obstacle'](obstacle);draw();return;}
        const id = event.target.closest('[data-cabinet]')?.dataset.cabinet;
        if(id){event.preventDefault();select(items.find(row=>row.p.cabinetId===id),true);draw();}
      });
    }
    draw();
  }
  FC.drawingEditor = {render,unmount};
})(window);
