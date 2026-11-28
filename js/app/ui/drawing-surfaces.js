(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const names = Object.freeze({countertop:'Blat',led:'Panel LED',wall:'Panel ścienny'});
  const keys = ['along','inset','elevation','length','depth','height'];
  const geometry = section=>[section.wallId,...keys.map(key=>section[key])];
  const footprint = surface=>surface?.sections.map(section=>JSON.stringify(geometry(section))).sort();
  const alike = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const mm = (value,fallback)=>Math.round(Number(value)*10)||fallback;
  const horizontal = surface=>surface.kind!=='wall' && surface.plane!=='vertical';

  function onWall(kind,wallId,room,plane){
    const bottom = mm(room.settings?.bottomHeight,820);
    const across = horizontal({kind,plane});
    return {wallId,cabinetIds:[],along:0,inset:0,elevation:kind==='led'?bottom+550:bottom,
      length:600,depth:across?(kind==='led'?300:600):18,
      height:across?(kind==='led'?18:mm(room.settings?.counterThickness,38)):(kind==='led'?300:500)};
  }

  function supports(room,ids){
    const G = FC.drawingGeometry, wanted = new Set(ids);
    const cabinets = new Map(room.cabinets.filter(cab=>wanted.has(cab.id)).map(cab=>[cab.id,cab]));
    const groups = new Map();
    for(const p of room.drawing2d.placements){
      const cab = cabinets.get(p.cabinetId), dim = cab && G.size(cab,p.rotation);
      if(!dim) continue;
      if(!groups.has(p.wallId)) groups.set(p.wallId,[]);
      groups.get(p.wallId).push({p,dim});
    }
    return room.drawing2d.walls.flatMap(wall=>groups.has(wall.id)?[[wall.id,groups.get(wall.id)]]:[]);
  }

  function fit(kind,room,ids,plane){
    const sections = supports(room,ids).map(([wallId,rows])=>{
      const section = onWall(kind,wallId,room,plane);
      const along = Math.min(...rows.map(({p})=>p.along));
      const length = Math.max(...rows.map(({p,dim})=>p.along+dim.span))-along;
      const inset = Math.min(...rows.map(({p})=>p.inset));
      const depth = Math.max(...rows.map(({p,dim})=>p.inset+dim.depth))-inset;
      const bottom = Math.min(...rows.map(({p})=>p.elevation));
      const top = Math.max(...rows.map(({p,dim})=>p.elevation+dim.height));
      if(!horizontal({kind,plane})) return {...section,cabinetIds:rows.map(({p})=>p.cabinetId),along,length,elevation:kind==='led'?bottom:top};
      return {...section,cabinetIds:rows.map(({p})=>p.cabinetId),along,length,inset,depth,
        elevation:kind==='led'?bottom-section.height:top};
    });
    // A perpendicular run starting at the same corner meets the face of the first run.
    if(kind==='countertop'){
      const walls = room.drawing2d.walls, byWall = new Map(sections.map(section=>[section.wallId,section]));
      for(let i=1;i<walls.length;i++){
        const back = byWall.get(walls[i-1].id), side = byWall.get(walls[i].id);
        if(!back || !side || back.elevation!==side.elevation || back.inset!==0 || side.inset!==0) continue;
        if(back.along+back.length!==walls[i-1].length || back.length<side.depth || side.along!==0 || side.length<=back.depth) continue;
        side.along = back.depth;
        side.length -= back.depth;
      }
    }
    return sections;
  }

  function anchors(surface){
    return [...new Set(surface.sections.flatMap(section=>section.cabinetIds))];
  }

  function keepCorner(room,sections,before){
    const walls = room.drawing2d.walls;
    const adjusted = sections.map(section=>({...section}));
    for(let i=1;i<walls.length;i++){
      const a = walls[i-1], b = walls[i];
      const left = before.find(row=>row.wallId===a.id), right = before.find(row=>row.wallId===b.id);
      const nextLeft = adjusted.find(row=>row.wallId===a.id), nextRight = adjusted.find(row=>row.wallId===b.id);
      if(!left || !right || !nextLeft || !nextRight || right.along!==left.depth) continue;
      if(left.inset || right.inset || nextLeft.inset || nextRight.inset) continue;
      if(left.elevation!==right.elevation || nextLeft.elevation!==nextRight.elevation
        || left.along+left.length!==a.length || nextLeft.along+nextLeft.length!==a.length || nextLeft.length<nextRight.depth) continue;
      const growth = nextLeft.depth-left.depth;
      if(nextRight.along!==right.along || nextRight.length!==right.length || nextRight.length<=growth) continue;
      nextRight.along += growth;
      nextRight.length -= growth;
    }
    return adjusted;
  }

  function withOffsets(kind,room,sections,plane,before){
    const neutral = fit(kind,room,anchors({sections}),plane);
    const fitted = kind==='countertop' ? keepCorner(room,sections,before || neutral) : sections;
    return fitted.map(section=>{
      const previous = neutral.find(row=>row.wallId===section.wallId);
      if(!previous || !section.cabinetIds.length) return section;
      const offsets = Object.fromEntries(keys.map(key=>[key,section[key]-previous[key]]));
      return {...section,offsets};
    });
  }

  function refit(surface,room){
    const ids = anchors(surface);
    const sections = fit(surface.kind,room,ids,surface.plane);
    if(!sections.length) return null;
    const supported = new Set(sections.flatMap(section=>section.cabinetIds));
    for(const section of sections){
      const previous = surface.sections.find(row=>row.wallId===section.wallId && row.cabinetIds.some(id=>section.cabinetIds.includes(id)))
        || surface.sections.find(row=>row.cabinetIds.some(id=>section.cabinetIds.includes(id)));
      if(previous?.offsets){
        section.offsets = previous.offsets;
        for(const key of keys) section[key] += section.offsets[key];
      }
      if(!keys.every(key=>Number.isSafeInteger(section[key])) || [section.length,section.depth,section.height].some(value=>value<=0)) return null;
    }
    // An unplaced support is still linked so placing it again can pick up the panel.
    for(const id of ids) if(!supported.has(id)) sections[0].cabinetIds.push(id);
    return {...surface,sections:[...sections,...surface.sections.filter(section=>!section.cabinetIds.length)]};
  }

  function changes(before,after,changed){
    if(!before.drawing2d?.surfaces?.length) return [];
    const ids = new Set(changed);
    return before.drawing2d.surfaces.flatMap(surface=>{
      if(!anchors(surface).some(id=>ids.has(id))) return [];
      const a = refit(surface,before), b = refit(surface,after);
      if(!b || alike(footprint(a),footprint(b)) || alike(footprint(surface),footprint(b))) return [];
      return [{before:surface,after:b}];
    });
  }

  function moved(before,next){
    if(!before.drawing2d?.surfaces?.length || !next) return [];
    const a = new Map(before.drawing2d.placements.map(p=>[p.cabinetId,p]));
    const b = new Map(next.placements.map(p=>[p.cabinetId,p]));
    const ids = [...new Set([...a.keys(),...b.keys()])].filter(id=>!alike(a.get(id),b.get(id)));
    return changes(before,{...before,drawing2d:next},ids);
  }

  function differences({before,after}){
    const wallName = FC.drawingGeometry.wallName, flat = horizontal(after);
    const labels = {length:'długość',depth:flat?'głębokość':'grubość',height:flat?'grubość':'wysokość',
      along:'początek',inset:'odsunięcie',elevation:'od podłogi'};
    const remaining = [...before.sections], lines = [];
    for(const section of after.sections){
      const index = remaining.findIndex(row=>row.wallId===section.wallId);
      const original = index<0 ? null : remaining.splice(index,1)[0];
      const changes = original ? Object.keys(labels).filter(key=>section[key]!==original[key])
        .map(key=>`${labels[key]} ${original[key]} → ${section[key]} mm`).join(', ')
        : `nowy odcinek ${section.length} × ${flat?section.depth:section.height} mm`;
      if(changes) lines.push(`${names[before.kind]} · ${wallName(section.wallId)} — ${changes}`);
    }
    for(const section of remaining) lines.push(`${names[before.kind]} · ${wallName(section.wallId)} — odcinek znika po dopasowaniu`);
    return lines;
  }

  function ask(proposals){
    if(!proposals.length) return false;
    return FC.confirmBox.ask({title:'Dostosować blaty i panele?',
      messageLines:proposals.flatMap(differences),
      confirmText:'Tak, dostosuj',cancelText:'Nie, zachowaj',cancelTone:'neutral',dismissOnOverlay:false,dismissOnEsc:false});
  }

  function apply(drawing,proposals){
    const changed = new Map(proposals.map(({after})=>[after.id,after]));
    return {...drawing,surfaces:drawing.surfaces.map(surface=>changed.get(surface.id) || surface)};
  }

  function prune(drawing,ids){
    const surfaces = (drawing.surfaces||[]).map(surface=>{
      const sections = surface.sections.map(section=>{
        const cabinetIds = section.cabinetIds.filter(id=>ids.has(id));
        if(cabinetIds.length===section.cabinetIds.length) return section;
        const {offsets,...geometry} = section;
        return cabinetIds.length ? {...section,cabinetIds} : {...geometry,cabinetIds};
      });
      return sections.some((section,i)=>section!==surface.sections[i]) ? {...surface,sections} : surface;
    });
    return surfaces.some((surface,i)=>surface!==drawing.surfaces[i]) ? {...drawing,surfaces} : drawing;
  }

  FC.drawingSurfaces = {names,keys,horizontal,anchors,onWall,fit,refit,withOffsets,changes,moved,ask,apply,prune};
})(window);
