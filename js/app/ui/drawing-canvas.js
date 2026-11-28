(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const doc = root.document;
  const svgNS = 'http://www.w3.org/2000/svg';
  const labels = root.ResizeObserver ? new root.ResizeObserver(entries=>{
    for(const {target} of entries){
      if(!target.isConnected){labels.unobserve(target);continue;}
      const scale = target.getScreenCTM()?.a;
      if(scale>0) target.style.setProperty('--drawing2d-label-size',12/scale+'px');
    }
  }) : null;
  function svg(name, attrs, parent, text){
    const node = doc.createElementNS(svgNS,name);
    for(const [attr,value] of Object.entries(attrs)) node.setAttribute(attr,value);
    if(text) node.textContent = text;
    if(parent) parent.appendChild(node);
    return node;
  }
  function line(parent,x1,y1,x2,y2,kind){
    return svg('line',{x1,y1,x2,y2,class:kind},parent);
  }
  function label(parent,x,y,text,kind='drawing2d-label'){
    return svg('text',{x,y,class:kind,'text-anchor':'middle'},parent,text);
  }

  function planWall(canvas,wall){
    const G = FC.drawingGeometry;
    const start = G.toPlan(wall,0,0), end = G.toPlan(wall,wall.length,0);
    line(canvas,start.x,start.y,end.x,end.y,'drawing2d-wall');
    const midpoint = G.toPlan(wall,wall.length/2,-115);
    const caption = label(canvas,midpoint.x,midpoint.y,`${G.wallName(wall.id)} · ${wall.length} mm`);
    if(!wall.dx) caption.setAttribute('transform',`rotate(-90 ${midpoint.x} ${midpoint.y})`);
  }

  function elevationWall(canvas,wall){
    svg('rect',{x:0,y:0,width:wall.length,height:wall.height,class:'drawing2d-elevation-wall'},canvas);
    line(canvas,0,wall.height+80,wall.length,wall.height+80,'drawing2d-dimension');
    line(canvas,0,wall.height+42,0,wall.height+115,'drawing2d-dimension');
    line(canvas,wall.length,wall.height+42,wall.length,wall.height+115,'drawing2d-dimension');
    label(canvas,wall.length/2,wall.height+142,`${wall.length} mm`);
    label(canvas,wall.length/2,-65,`${FC.drawingGeometry.wallName(wall.id)} · wysokość ${wall.height} mm`);
  }

  function itemBox(item,wall){
    if(!wall) return item.box;
    const {p,dimensions:d} = item, floor = wall.height-p.elevation;
    return {left:p.along,right:p.along+d.span,top:floor-d.height,bottom:floor};
  }

  function obstacleBox(item,elevation){
    const {o,wall} = item;
    if(elevation){
      const bottom = wall.height-o.elevation;
      return {left:o.along,right:o.along+o.width,top:bottom-o.height,bottom};
    }
    if(o.kind==='radiator') return item.box;
    // Opening marker in the plan. Its display width does not enter collision checks.
    return FC.drawingGeometry.planBox(wall,{along:o.along,inset:-32},{span:o.width,depth:64});
  }

  function obstacle(canvas,item,elevation,{selectedObstacle,warnings}){
    const {o,wall,label:name} = item, box = obstacleBox(item,elevation);
    const {left,right,top,bottom} = box;
    const alert = warnings.get(o.id)||[];
    const group = svg('g',{class:`drawing2d-obstacle drawing2d-obstacle-${o.kind}${alert.length?' has-warning':''}${selectedObstacle===o.id?' is-selected':''}`,
      'data-obstacle':o.id,role:'button',tabindex:0,'aria-pressed':selectedObstacle===o.id,
      'aria-label':`${name} · ${FC.drawingGeometry.wallName(wall.id)}`},canvas);
    svg('rect',{x:left,y:top,width:right-left,height:bottom-top,class:'drawing2d-obstacle-face'},group);
    if(o.kind==='window'){
      if(elevation || !wall.dx) line(group,(left+right)/2,top,(left+right)/2,bottom,'drawing2d-obstacle-detail');
      else line(group,left,(top+bottom)/2,right,(top+bottom)/2,'drawing2d-obstacle-detail');
    }
    if(o.kind==='radiator' && elevation){
      for(const fraction of [.2,.4,.6,.8]){
        const x = left+(right-left)*fraction;
        line(group,x,top,x,bottom,'drawing2d-obstacle-detail');
      }
    }
    if(elevation && o.width>=300 && o.height>=160){
      label(group,(left+right)/2,(top+bottom)/2+16,name,'drawing2d-label');
    }
    svg('title',{},group,[name,`${o.width} × ${o.height} mm`,...alert].join(' · '));
  }

  function surface(cabinet){
    const name = String(cabinet.frontColor||cabinet.bodyColor||'');
    const wood = /dąb|dęb|orzech|sosn|jesion|buk|olcha|brzoz|oak|walnut/i.test(name);
    if(root.CSS?.supports('color',name) && name!=='transparent') return {color:name,wood};
    const palette = [
      [/bia[łl]|alabast|white/i,'#fbfaf5'],[/czarn|antracyt|grafit|black/i,'#495255'],
      [/szar|beton|gr[ae]y/i,'#bcc3c3'],[/sza[łl]wi|ziel|oliwk|green/i,'#a4b694'],
      [/be[żz]|piask|krem/i,'#e2d0b3'],[/dąb|dęb|oak|jesion|sosn|buk|brzoz/i,'#d9b589'],
      [/orzech|walnut/i,'#ae8865']
    ];
    return {color:palette.find(([pattern])=>pattern.test(name))?.[1],wood};
  }

  function cabinet(canvas,item,wall,{selected,warnings,mode}){
    const {p,cabinet:c,dimensions,wall:ownWall} = item;
    const {left,right,top,bottom} = itemBox(item,wall);
    const classes = ['drawing2d-cabinet','drawing2d-cabinet-'+(c.type==='wisząca'?'upper':c.type==='moduł'?'middle':'lower')];
    if(warnings.has(p.cabinetId)) classes.push('has-warning');
    if(selected === p.cabinetId) classes.push('is-selected');
    const group = svg('g',{class:classes.join(' '),'data-cabinet':p.cabinetId,role:'button',tabindex:0,
      'aria-label':item.label,'aria-pressed':selected===p.cabinetId},canvas);
    const {color,wood} = surface(c);
    if(mode!=='outline' && color) group.style.setProperty('--drawing2d-fill',color);
    svg('rect',{x:left,y:top,width:right-left,height:bottom-top,class:'drawing2d-cabinet-face'},group);
    if(mode==='texture' && wood){
      svg('rect',{x:left,y:top,width:right-left,height:bottom-top,fill:'url(#drawing2d-grain)','pointer-events':'none'},group);
    }
    if(!wall){
      const [a,b] = FC.drawingGeometry.frontLine(ownWall,p,dimensions);
      line(group,a.x,a.y,b.x,b.y,'drawing2d-front');
    }else if(p.rotation===0){
      const fronts = Number(c.frontCount)||0;
      if(fronts===2 && c.subType!=='szuflady') line(group,(left+right)/2,top,(left+right)/2,bottom,'drawing2d-front');
    }
    if(right-left>=350 && bottom-top>=180){
      label(group,(left+right)/2,(top+bottom)/2+16,`${dimensions.span} mm`,'drawing2d-cabinet-label');
    }
    svg('title',{},group,[item.label,...(warnings.get(p.cabinetId)||[])].join(' '));
  }

  function surfaceBoxes({walls,wall,surfaces=[]}){
    const G = FC.drawingGeometry, byWall = new Map(walls.map(row=>[row.id,row]));
    return surfaces.flatMap(surface=>surface.sections.flatMap(section=>{
      const support = byWall.get(section.wallId);
      if(!support || (wall && wall.id!==section.wallId)) return [];
      const box = wall ? {left:section.along,right:section.along+section.length,
        top:wall.height-section.elevation-section.height,bottom:wall.height-section.elevation}
        : G.planBox(support,section,{span:section.length,depth:section.depth});
      return [{surface,section,box}];
    }));
  }

  function paintSurfaces(canvas,options){
    const M = FC.drawingSurfaces;
    const rows = surfaceBoxes(options);
    for(const {surface,section,box} of rows){
      const {left,right,top,bottom} = box;
      const name = M.names[surface.kind], width = right-left, height = bottom-top;
      const nameAndWall = name+' · '+FC.drawingGeometry.wallName(section.wallId);
      const attributes = {class:`drawing2d-surface drawing2d-surface-${surface.kind}${surface.id===options.selectedSurface?' is-selected':''}`};
      if(surface.preview) attributes.class += ' is-preview';
      else Object.assign(attributes,{'data-surface':surface.id,role:'button',tabindex:0,
        'aria-label':nameAndWall,'aria-pressed':surface.id===options.selectedSurface});
      const group = svg('g',attributes,canvas);
      svg('rect',{x:left,y:top,width,height,class:'drawing2d-surface-face'},group);
      if(options.wall && width>=350 && height>=150) label(group,(left+right)/2,(top+bottom)/2,name);
      svg('title',{},group,`${nameAndWall} · ${section.length} × ${M.horizontal(surface)?section.depth:section.height} mm`);
    }
    if(options.wall) return;
    for(const [index,a] of rows.entries()){
      if(a.surface.kind!=='countertop') continue;
      for(const b of rows.slice(index+1)){
        if(a.surface!==b.surface || a.section.elevation!==b.section.elevation) continue;
        const p=a.box,q=b.box;
        const left=Math.max(p.left,q.left), right=Math.min(p.right,q.right);
        const top=Math.max(p.top,q.top), bottom=Math.min(p.bottom,q.bottom);
        if(left===right && bottom>top) line(canvas,left,top,right,bottom,'drawing2d-surface-seam');
        if(top===bottom && right>left) line(canvas,left,top,right,bottom,'drawing2d-surface-seam');
      }
    }
  }

  function frame({walls,items,obstacles,wall,preview,surfaces}){
    const corners = [
      ...items.filter(item=>!wall || item.p.wallId===wall.id).map(item=>itemBox(item,wall)),
      ...obstacles.filter(item=>!wall || item.o.wallId===wall.id).map(item=>obstacleBox(item,wall)),
      ...surfaceBoxes({walls,wall,surfaces}).map(row=>row.box)
    ];
    if(wall){
      corners.push({left:0,top:0,right:wall.length,bottom:wall.height+120});
    }else{
      for(const row of preview ? [...walls,preview.wall] : walls){
        const end = FC.drawingGeometry.toPlan(row,row.length,0);
        corners.push({left:Math.min(row.x,end.x),top:Math.min(row.y,end.y),right:Math.max(row.x,end.x),bottom:Math.max(row.y,end.y)});
      }
    }
    const left = Math.min(...corners.map(box=>box.left))-250;
    const top = Math.min(...corners.map(box=>box.top))-250;
    const width = Math.max(850,Math.max(...corners.map(box=>box.right))-left+250);
    const height = Math.max(750,Math.max(...corners.map(box=>box.bottom))-top+250);
    return [left,top,width,height];
  }

  function paintPreview(canvas,preview){
    canvas.querySelector('.drawing2d-wall-preview')?.remove();
    if(!preview) return;
    const {wall,hasLength,side} = preview;
    const G = FC.drawingGeometry;
    const start = G.toPlan(wall,0,0), end = G.toPlan(wall,wall.length,0);
    const group = svg('g',{class:'drawing2d-wall-preview','aria-hidden':'true'},canvas);
    line(group,start.x,start.y,end.x,end.y,'drawing2d-preview-line');
    const anchor = side==='left' ? end : start;
    if(side!=='first') svg('rect',{x:anchor.x-32,y:anchor.y-32,width:64,height:64,class:'drawing2d-join'},group);
    const tip = side==='left' ? start : end;
    const sign = side==='left' ? -1 : 1, dx = wall.dx*sign, dy = wall.dy*sign;
    svg('polygon',{points:`${tip.x},${tip.y} ${tip.x-95*dx-45*dy},${tip.y-95*dy+45*dx} ${tip.x-95*dx+45*dy},${tip.y-95*dy-45*dx}`,
      class:'drawing2d-preview-arrow'},group);
    const mid = G.toPlan(wall,wall.length/2,-115);
    const caption = label(group,mid.x,mid.y,hasLength?`${G.wallName(wall.id)} · ${wall.length} mm`:'Wpisz długość');
    if(!wall.dx) caption.setAttribute('transform',`rotate(-90 ${mid.x} ${mid.y})`);
  }

  function paint(stage,options){
    const {walls,wall,items,obstacles,mode,zoom,preview} = options;
    if(!walls.length && !preview) return null;
    const visible = wall ? items.filter(item=>item.p.wallId===wall.id) : items;
    const visibleObstacles = wall ? obstacles.filter(item=>item.o.wallId===wall.id) : obstacles;
    const canvas = svg('svg',{class:`drawing2d-canvas drawing2d-${mode}`,viewBox:frame(options).join(' '),
      'aria-label':wall?'Widok · '+FC.drawingGeometry.wallName(wall.id):'Rzut pomieszczenia z góry'},stage);
    canvas.style.width = zoom+'%';
    canvas.style.height = Math.round(470*zoom/100)+'px';
    if(mode==='texture'){
      const pattern = svg('pattern',{id:'drawing2d-grain',width:42,height:145,patternUnits:'userSpaceOnUse'},svg('defs',{},canvas));
      svg('path',{d:'M 7,-5 Q 18,24 8,66 T 7,150 M 26,-5 Q 16,33 32,77 T 26,150',fill:'none',stroke:'#654928','stroke-width':3,opacity:.25},pattern);
    }
    if(wall) elevationWall(canvas,wall);
    else walls.forEach(row=>planWall(canvas,row));
    for(const item of visible) cabinet(canvas,item,wall,options);
    paintSurfaces(canvas,options);
    for(const item of visibleObstacles) obstacle(canvas,item,wall,options);
    paintPreview(canvas,preview);
    labels?.observe(canvas);
    return canvas;
  }

  FC.drawingCanvas = {paint,frame,paintPreview};
})(window);
