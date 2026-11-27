(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const turns = [[1,0],[0,1],[-1,0],[0,-1]];
  const quarter = value => (value % 4 + 4) % 4;
  const mm = value => Math.round(Number(value) * 10);
  const wallName = id => 'Ściana '+(id<=26 ? String.fromCharCode(64+id) : id);
  const obstacleNames = Object.freeze({window:'Okno',door:'Futryna',radiator:'Kaloryfer'});
  const bounds = points => ({
    left:Math.min(...points.map(p=>p.x)), right:Math.max(...points.map(p=>p.x)),
    top:Math.min(...points.map(p=>p.y)), bottom:Math.max(...points.map(p=>p.y))
  });

  function walls(drawing){
    const origin = drawing.walls.findIndex(wall=>wall.id === 1);
    const result = drawing.walls.map((wall,index)=>{
      const [dx,dy] = turns[quarter(index-origin)];
      return {...wall, dx, dy, x:0, y:0};
    });
    for(let i=origin+1;i<result.length;i++){
      const previous = result[i-1];
      result[i].x = previous.x + previous.dx * previous.length;
      result[i].y = previous.y + previous.dy * previous.length;
    }
    for(let i=origin-1;i>=0;i--){
      const wall = result[i], next = result[i+1];
      wall.x = next.x - wall.dx * wall.length;
      wall.y = next.y - wall.dy * wall.length;
    }
    return result;
  }

  function toPlan(wall, along, inset){
    return {x:wall.x + along * wall.dx - inset * wall.dy, y:wall.y + along * wall.dy + inset * wall.dx};
  }

  const nextWallId = rows=>Math.max(0,...rows.map(row=>row.id))+1;

  function wallRows(rows,side,next){
    if(side==='edit') return rows.map(row=>row.id===next.id?next:row);
    return side==='left' ? [next,...rows] : [...rows,next];
  }

  function previewWall(rows,side,length){
    if(!side || side==='edit') return null;
    const hasLength = Number.isSafeInteger(length) && length>0;
    const id = nextWallId(rows);
    const candidate = wallRows(rows,side,{id,length:hasLength?length:1000});
    return {side,hasLength,wall:walls({walls:candidate}).find(row=>row.id===id)};
  }

  function fromPlan(wall, {x,y}){
    return {along:(x-wall.x)*wall.dx + (y-wall.y)*wall.dy, inset:-(x-wall.x)*wall.dy + (y-wall.y)*wall.dx};
  }

  function size(cabinet, rotation){
    const width = mm(cabinet.width), depth = mm(cabinet.depth), height = mm(cabinet.height);
    if(![width,depth,height].every(value=>Number.isSafeInteger(value) && value>0)) return null;
    return rotation % 2 ? {span:depth,depth:width,height} : {span:width,depth,height};
  }

  function planBox(wall, placement, dimensions){
    const {along,inset} = placement, {span,depth} = dimensions;
    return bounds([toPlan(wall,along,inset),toPlan(wall,along+span,inset+depth)]);
  }

  function frontLine(wall, p, {span,depth}){
    const {along:a,inset:b,rotation} = p;
    const corners = [[a,b],[a+span,b],[a+span,b+depth],[a,b+depth]];
    const start = quarter(rotation+2);
    return [corners[start],corners[quarter(start+1)]].map(([x,y])=>toPlan(wall,x,y));
  }

  function elevation(room,cabinet){
    const settings = room.settings || {};
    if(cabinet.type === 'wisząca') return mm((Number(settings.bottomHeight)||90)+(Number(settings.gapHeight)||55));
    if(cabinet.type === 'moduł') return mm(Number(settings.bottomHeight)||90);
    return cabinet.details?.heightIncludesLegs === 'yes' ? 0 : mm(settings.legHeight ?? 10);
  }

  function closest(value,candidates,tolerance){
    return candidates.reduce((best,candidate)=>Math.abs(candidate-value) < Math.abs(best-value) ? candidate : best,
      candidates.find(candidate=>Math.abs(candidate-value)<=tolerance) ?? value);
  }

  function snap(p, wall, dimensions, neighbors, mode, tolerance){
    if(mode === 'off') return p;
    const corners = [0,wall.length-dimensions.span].filter(value=>value>=0);
    if(mode === 'corner'){
      const target = closest(p.along,corners,tolerance);
      return Math.abs(p.inset)<=tolerance && corners.some(value=>value===target && Math.abs(p.along-value)<=tolerance)
        ? {...p,along:target,inset:0} : p;
    }
    const edges = [...corners];
    for(const neighbor of neighbors){
      edges.push(neighbor.along-dimensions.span,neighbor.along+neighbor.span);
    }
    return {...p,along:closest(p.along,edges.filter(value=>value>=0),tolerance),inset:closest(p.inset,[0],tolerance)};
  }

  function obstacles(drawing,walls){
    const byId = new Map(walls.map(wall=>[wall.id,wall]));
    return (drawing.obstacles||[]).flatMap(o=>{
      const wall = byId.get(o.wallId);
      if(!wall) return [];
      const box = planBox(wall,{along:o.along,inset:0},{span:o.width,depth:o.depth||0});
      return [{o,wall,box,label:obstacleNames[o.kind]}];
    });
  }

  const overlaps = (a,b,c,d)=>Math.min(b,d)>Math.max(a,c);
  function overlapBox(a,b){
    return overlaps(a.left,a.right,b.left,b.right) && overlaps(a.top,a.bottom,b.top,b.bottom);
  }

  function overlapsObstacle(item,obstacle){
    const {p,dimensions,box} = item, {o,wall} = obstacle;
    if(!overlaps(p.elevation,p.elevation+dimensions.height,o.elevation,o.elevation+o.height)) return false;
    if(o.kind==='radiator') return overlapBox(box,obstacle.box);
    const a = fromPlan(wall,{x:box.left,y:box.top}), b = fromPlan(wall,{x:box.right,y:box.bottom});
    if(!overlaps(Math.min(a.along,b.along),Math.max(a.along,b.along),o.along,o.along+o.width)) return false;
    const reachesWall = Math.min(a.inset,b.inset)<=0 && Math.max(a.inset,b.inset)>0;
    return reachesWall || (o.kind==='window' && p.wallId===o.wallId && Math.max(a.inset,b.inset)>0);
  }

  function warnings(items,obstacles=[]){
    const messages = new Map();
    const add = (id,message)=>{
      if(!messages.has(id)) messages.set(id,[]);
      messages.get(id).push(message);
    };
    items.forEach((item,index)=>{
      const {p,wall,dimensions:d,box} = item;
      const excess = Math.max(-p.along,p.along+d.span-wall.length,-p.elevation,p.elevation+d.height-wall.height);
      if(excess>0) add(p.cabinetId,`Poza obrysem ściany o ${excess} mm.`);
      if(p.inset<0) add(p.cabinetId,`Za ścianą o ${-p.inset} mm.`);
      for(const other of items.slice(index+1)){
        if(overlapBox(box,other.box) && overlaps(p.elevation,p.elevation+d.height,other.p.elevation,other.p.elevation+other.dimensions.height)){
          add(p.cabinetId,`Kolizja z: ${other.label}.`);
          add(other.p.cabinetId,`Kolizja z: ${item.label}.`);
        }
      }
    });
    for(const obstacle of obstacles){
      const {o,wall,label} = obstacle;
      const excess = Math.max(o.along+o.width-wall.length,o.elevation+o.height-wall.height);
      if(excess>0) add(o.id,`Poza obrysem ściany o ${excess} mm.`);
      for(const item of items){
        if(!overlapsObstacle(item,obstacle)) continue;
        const blocked = {window:'Zasłonięte okno',door:'Szafka w otworze drzwiowym',radiator:'Kolizja z kaloryferem'}[o.kind];
        add(item.p.cabinetId,`${blocked} · ${wallName(wall.id)}.`);
        add(o.id,`${label} · kolizja z: ${item.label}.`);
      }
    }
    return messages;
  }

  FC.drawingGeometry = {walls,wallName,nextWallId,wallRows,previewWall,toPlan,fromPlan,size,planBox,frontLine,elevation,snap,warnings,obstacles,obstacleNames};
})(window);
