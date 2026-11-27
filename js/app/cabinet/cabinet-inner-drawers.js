(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const rows=(room,cab)=>(FC.cabinetDrawerRequirements?.getDrawerRequirements(room,cab)||[]).filter(r=>r.qty>0&&r.technical?.usage==='wewnętrzna');
  function options(cab){
    const d=cab.details||{};
    return {distribution:d.innerDrawerDistribution||'equal',space:d.innerDrawerSpace||'cabinet',spaceHeightCm:d.innerDrawerSpaceHeightCm,
      heightType:d.innerDrawerHeightType||'front',heightsCm:d.innerDrawerHeightsCm};
  }
  function layout(room,cab){
    const inner=rows(room,cab),count=inner.reduce((n,r)=>n+r.qty,0);
    if(!count)return {ok:true,fronts:[]};
    const opts=options(cab);
    if(opts.distribution==='declared'&&opts.heightType==='inside'&&inner.some(r=>r.technical?.drawerKind!=='box'))return {ok:false,code:'INNER_SYSTEM_INSIDE_HEIGHT_UNCONFIRMED',fronts:[]};
    return FC.cabinetCutlist.resolveInnerDrawerLayout(cab,room,count,opts);
  }
  const messages={INNER_DRAWER_HEIGHTS_REQUIRED:'Podaj wysokość każdej szuflady.',INNER_DRAWER_SPACE_REQUIRED:'Podaj wysokość przeznaczoną na szuflady.',
    INNER_DRAWER_SPACE_EXCEEDED:'Podana przestrzeń przekracza wnętrze mebla.',INNER_DRAWERS_DO_NOT_FIT:'Szuflady z wymaganymi odstępami nie mieszczą się w podanej przestrzeni.',
    INNER_DRAWER_HEIGHT_INVALID:'Front musi być wyższy od 3 cm, aby powstał korpus szuflady.',
    INNER_SYSTEM_INSIDE_HEIGHT_UNCONFIRMED:'Dla szuflady systemowej podaj wysokość frontu. Wysokość wnętrza zależy od konkretnego zestawu producenta.'};
  function validate(room,cab,show){
    const result=layout(room,cab);
    if(!result.ok&&typeof show==='function')show('Sprawdź wysokości szuflad',messages[result.code]||result.code);
    return result.ok;
  }
  function editHeights(ctx,rollbackDistribution){
    const {draft,room,rerender,state}=ctx,count=rows(room,draft).reduce((n,r)=>n+r.qty,0),before=options(draft);
    if(!count||state.draft!==draft)return;
    const unit=FC.cabinetModalFields?.dimensions?.();
    const mm=unit?.name==='mm';
    const overlay=document.createElement('div');overlay.className='confirm-backdrop';overlay.dataset.innerDrawerHeights='';
    const box=document.createElement('div');box.className='confirm-box';box.style.maxHeight='calc(100dvh - 32px)';box.style.overflowY='auto';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    const head=document.createElement('div');head.className='confirm-title';head.textContent='Wysokości szuflad wewnętrznych';
    const body=document.createElement('div');body.className='confirm-message';
    const type=document.createElement('select');type.className='cabinet-extra-field__control';type.id='innerDrawerHeightType';
    for(const [value,label]of [['front','Wysokość frontu'],['inside','Wysokość wnętrza szuflady']]){const opt=document.createElement('option');opt.value=value;opt.textContent=label;type.append(opt);}
    type.value=before.heightType;body.append(type);
    const inputs=[];
    for(let i=0;i<count;i++){
      const label=document.createElement('label');label.className='cabinet-extra-field';label.textContent='Szuflada '+(i+1)+' — wysokość ('+(unit?.name??'cm')+')';
      const input=document.createElement('input');input.type='number';input.min=mm?'1':'.1';input.step=input.min;input.inputMode='decimal';input.className='cabinet-extra-field__control';input.dataset.drawerIndex=String(i);
      const height=before.heightsCm?.[i]??'';
      input.value=unit?.display(height)??height;label.append(input);body.append(label);inputs.push(input);
    }
    const error=document.createElement('div');error.setAttribute('role','alert');body.append(error);
    const actions=document.createElement('div');actions.className='confirm-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='confirm-btn is-danger';cancel.textContent='Anuluj';
    const save=document.createElement('button');save.type='button';save.className='confirm-btn is-success';save.textContent='Zatwierdź';actions.append(cancel,save);
    box.append(head,body,actions);overlay.append(box);document.body.append(overlay);
    let closed=false;
    function close(accepted){
      if(closed)return;closed=true;overlay.remove();document.removeEventListener('keydown',onKey,true);
      if(state.draft===draft){if(!accepted&&rollbackDistribution!==undefined)draft.details.innerDrawerDistribution=rollbackDistribution;rerender();}
    }
    function onKey(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(false);}}
    document.addEventListener('keydown',onKey,true);cancel.onclick=()=>close(false);
    save.onclick=()=>{
      if(state.draft!==draft){close(false);return;}
      const next={...draft,details:{...draft.details,innerDrawerDistribution:'declared',innerDrawerHeightType:type.value,innerDrawerHeightsCm:inputs.map(el=>unit?.read(el.value)??Number(el.value))}};
      const result=layout(room,next);
      if(!result.ok){error.textContent=messages[result.code]||result.code;return;}
      draft.details=next.details;close(true);
    };
    inputs[0]?.focus();
  }
  function render({room,draft,container,addSelect,addNumber,rerender,state}){
    if(!rows(room,draft).length)return;
    const ctx={room,draft,container,rerender,state},previous=draft.details.innerDrawerDistribution||'equal';
    addSelect('Podział szuflad wewnętrznych','innerDrawerDistribution',[{v:'equal',t:'Dziel równo'},{v:'declared',t:'Deklarowane wysokości'}],value=>{
      if(value==='declared')setTimeout(()=>editHeights(ctx,previous),0);
    });
    addSelect('Przestrzeń szuflad wewnętrznych','innerDrawerSpace',[{v:'cabinet',t:'Cały mebel'},{v:'custom',t:'Podana wysokość'}]);
    if(draft.details.innerDrawerSpace==='custom')FC.cabinetModalFields.appendExtraNumberField(container,{draft,labelText:'Wysokość przestrzeni szuflad (cm)',key:'innerDrawerSpaceHeightCm',fallback:'',inputId:'cmInnerDrawerSpaceHeight'});
    if(draft.details.innerDrawerDistribution==='declared'){
      const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.action='inner-drawer-heights';button.textContent='Wysokości szuflad';
      button.onclick=()=>editHeights(ctx);container.append(button);
    }
  }
  FC.cabinetInnerDrawers={rows,options,layout,validate,render};
})();
