(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};

  function create(room,wallId,kind,selected){
    const M = FC.drawingSurfaces;
    const byCabinet = kind!=='wall' && room.drawing2d.placements.length>0;
    const ids = byCabinet && selected ? [selected] : [];
    const plane = kind==='led' ? (byCabinet?'horizontal':'vertical') : undefined;
    return {kind,plane,wallId,source:byCabinet?'cabinet':'wall',ids,
      sections:byCabinet?M.fit(kind,room,ids,plane):[M.onWall(kind,wallId,room,plane)]};
  }

  function edit(surface){
    const ids = FC.drawingSurfaces.anchors(surface);
    return {...structuredClone(surface),ids,wallId:surface.sections[0].wallId,source:ids.length?'cabinet':'wall'};
  }

  function list(drawing,hasWall){
    const {node,button} = FC.drawingEditorControls, M = FC.drawingSurfaces;
    const list = node('div',{class:'drawing2d-cabinet-list'});
    list.append(node('h3',{},'Blaty i panele'));
    for(const [kind,label] of Object.entries(M.names)){
      const action = button('Dodaj: '+label,'add-surface',kind);
      action.disabled = !hasWall;
      list.append(action);
    }
    for(const surface of drawing.surfaces||[]){
      const count = surface.sections.length;
      const action = button(M.names[surface.kind],'edit-surface',surface.id);
      action.append(node('small',{},count===1 ? FC.drawingGeometry.wallName(surface.sections[0].wallId) : count+' odcinki'));
      list.append(action);
    }
    return list;
  }

  function form(draft,{items,walls}){
    const {node,field,button,wallField,submitBar} = FC.drawingEditorControls;
    const M = FC.drawingSurfaces, G = FC.drawingGeometry;
    const form = node('form',{'data-drawing-form':'surface'});
    const fields = node('div',{class:'drawing2d-form-fields'});
    fields.append(node('h3',{},M.names[draft.kind]));
    const label = node('label',{},'Mocowanie'), select = node('select',{name:'source'});
    select.append(node('option',{value:'cabinet'},'Do szafek'),node('option',{value:'wall'},'Do ściany'));
    select.value = draft.source;
    label.append(select);
    fields.append(label);
    if(draft.kind==='led'){
      const orientation = node('label',{},'Płaszczyzna'), plane = node('select',{name:'plane'});
      plane.append(node('option',{value:'horizontal'},'Pozioma'),node('option',{value:'vertical'},'Pionowa'));
      plane.value = draft.plane || 'horizontal';
      orientation.append(plane);
      fields.append(orientation);
    }
    if(draft.source==='cabinet'){
      const supports = node('fieldset',{class:'drawing2d-surface-cabinets'});
      supports.append(node('legend',{},'Wybierz szafki na rysunku'));
      if(!items.length) supports.append(node('p',{},'Najpierw umieść szafkę na rysunku albo wybierz mocowanie do ściany.'));
      for(const item of items){
        const option = node('label',{},`${G.wallName(item.p.wallId)} · ${item.label}`);
        const checkbox = node('input',{name:'support',type:'checkbox',value:item.p.cabinetId});
        checkbox.checked = draft.ids.includes(item.p.cabinetId);
        option.prepend(checkbox);
        supports.append(option);
      }
      fields.append(supports);
      if(draft.id && draft.ids.length) fields.append(button('Dopasuj do szafek','fit-surface'));
    }else wallField(fields,draft.wallId,walls);

    for(const [index,section] of draft.sections.entries()){
      const horizontal = M.horizontal(draft);
      const group = node('fieldset',{class:'drawing2d-surface-size'});
      group.append(node('legend',{},G.wallName(section.wallId)));
      field(group,'Od początku ściany','along'+index,section.along);
      field(group,'Długość','length'+index,section.length,1);
      field(group,'Odsunięcie od ściany','inset'+index,section.inset);
      field(group,'Od podłogi','elevation'+index,section.elevation);
      field(group,horizontal?'Głębokość':'Grubość','depth'+index,section.depth,1);
      field(group,horizontal?'Grubość':'Wysokość','height'+index,section.height,1);
      fields.append(group);
    }
    if(draft.id) fields.append(button('Usuń z rysunku','remove-surface',draft.id));
    const footer = submitBar(draft.id?'Zastosuj':'Dodaj do rysunku');
    footer.querySelector('button').disabled = !draft.sections.length;
    form.append(fields,footer);
    return form;
  }

  function setSupports(draft,room,data){
    const M = FC.drawingSurfaces;
    draft.source = data.get('source');
    const plane = data.get('plane') || undefined, keepPlane = draft.plane===plane;
    draft.plane = plane;
    if(draft.source==='cabinet'){
      draft.ids = data.getAll('support');
      draft.sections = M.fit(draft.kind,room,draft.ids,draft.plane);
    }else{
      draft.wallId = Number(data.get('wallId')) || draft.wallId;
      draft.ids = [];
      const previous = draft.sections[0];
      draft.sections = previous && !previous.cabinetIds.length && keepPlane
        ? [{...previous,wallId:draft.wallId}] : [M.onWall(draft.kind,draft.wallId,room,draft.plane)];
    }
  }

  function read(draft,room,data){
    const M = FC.drawingSurfaces;
    const sections = draft.sections.map((section,index)=>{
      const fields = Object.fromEntries(M.keys.map(key=>[key,Number(data.get(key+index))]));
      return {...section,...fields};
    });
    return {id:draft.id || 'surface_'+FC.utils.uid(),kind:draft.kind,...(draft.plane?{plane:draft.plane}:{}),
      sections:M.withOffsets(draft.kind,room,sections,draft.plane,draft.sections)};
  }

  FC.drawingSurfaceControls = {create,edit,list,form,setSupports,read};
})(window);
