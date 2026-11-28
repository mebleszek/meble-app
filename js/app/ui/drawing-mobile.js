(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const doc = root.document;
  const clamp = (value,min,max)=>Math.max(min,Math.min(max,value));

  function mountChrome(media,onChange){
    const navigation = doc.getElementById('drawingNavigation');
    const contents = doc.getElementById('drawingNavigationContents');
    const viewport = root.visualViewport;
    const listeners = new AbortController();
    const {signal} = listeners;
    let relocated = [];
    let viewportFrame;

    function resize(){
      if(!media.matches) return;
      // Use the visual height for the keyboard, independently of browser page zoom.
      const normalScale = !viewport || Math.abs(viewport.scale-1)<.01;
      const height = normalScale ? viewport?.height ?? root.innerHeight : root.innerHeight;
      const top = normalScale ? viewport?.offsetTop ?? 0 : 0;
      doc.body.style.setProperty('--drawing-viewport-height',height+'px');
      doc.body.style.setProperty('--drawing-viewport-top',top+'px');
      const editing = doc.activeElement?.matches('.drawing2d input, .drawing2d select, #cabinetModal input, #cabinetModal select, [data-inner-drawer-heights] input');
      const keyboardWasOpen = doc.body.classList.contains('drawing2d-keyboard');
      doc.body.classList.toggle('drawing2d-keyboard',(editing || keyboardWasOpen) && normalScale && root.innerHeight-height>110);
      root.cancelAnimationFrame(viewportFrame);
      viewportFrame = root.requestAnimationFrame(revealField);
    }
    function restore(){
      for(const {element,anchor} of relocated) anchor.replaceWith(element);
      relocated = [];
      if(navigation) navigation.open = false;
      doc.body.classList.remove('drawing2d-mobile','drawing2d-keyboard');
      doc.body.style.removeProperty('--drawing-viewport-height');
      doc.body.style.removeProperty('--drawing-viewport-top');
    }
    function update(){
      if(!media.matches){restore();return;}
      doc.body.classList.add('drawing2d-mobile');
      if(contents && !relocated.length){
        relocated = ['topTabs','sessionCancel','main-auth-bar','main-trust-status'].flatMap(id=>{
          const element = doc.getElementById(id);
          if(!element) return [];
          const anchor = doc.createComment(id);
          element.before(anchor);
          contents.append(element);
          return [{element,anchor}];
        });
      }
      resize();
    }
    media.addEventListener('change',()=>{update();onChange();},{signal});
    viewport?.addEventListener('resize',resize,{signal});
    viewport?.addEventListener('scroll',resize,{signal});
    root.addEventListener('resize',resize,{signal});
    doc.addEventListener('focusin',resize,{signal});
    doc.addEventListener('focusout',()=>root.requestAnimationFrame(()=>{if(!signal.aborted) resize();}),{signal});
    doc.addEventListener('pointerdown',event=>{
      if(doc.body.classList.contains('drawing2d-keyboard') && doc.activeElement?.matches('input,select')
        && event.target.closest('.drawing2d-form-footer button, #cabinetModalSave, [data-inner-drawer-heights] .confirm-actions button')){
        // Keep the keyboard and footer in place until the button receives its click.
        event.preventDefault();
      }
    },{signal});
    doc.addEventListener('click',event=>{
      if(navigation?.open && (!navigation.contains(event.target) || event.target.closest('.tab-btn'))) navigation.open = false;
    },{signal});
    update();
    return ()=>{listeners.abort();root.cancelAnimationFrame(viewportFrame);restore();};
  }

  function revealField(){
    const field = doc.activeElement;
    if(!field?.matches('input,select')) return;
    const scroll = field.closest('.drawing2d-form-fields, #cabinetModal .body, [data-inner-drawer-heights] .confirm-message');
    if(!scroll) return;
    const box = scroll.getBoundingClientRect(), rect = field.getBoundingClientRect();
    if(rect.bottom>box.bottom-10) scroll.scrollTop += rect.bottom-box.bottom+10;
    else if(rect.top<box.top+10) scroll.scrollTop += rect.top-box.top-10;
  }

  function camera(stage,canvas,frame,state,showZoom){
    function update(){
      if(!stage.clientWidth || !stage.clientHeight) return;
      const [x,y,width,height] = frame;
      const unit = Math.max(width/stage.clientWidth,height/stage.clientHeight)*100/state.mobileZoom;
      const w = stage.clientWidth*unit, h = stage.clientHeight*unit;
      const center = state.camera ?? {x:x+width/2,y:y+height/2};
      canvas.setAttribute('viewBox',[center.x-w/2,center.y-h/2,w,h].join(' '));
      canvas.style.setProperty('--drawing2d-label-size',12*unit+'px');
      showZoom(Math.round(state.mobileZoom)+'%');
    }

    function project(point){
      return new DOMPoint(point.x,point.y).matrixTransform(canvas.getScreenCTM().inverse());
    }

    function pan(anchor,point){
      const rect = stage.getBoundingClientRect();
      const center = project({x:rect.x+rect.width/2,y:rect.y+rect.height/2});
      const now = project(point);
      state.camera = {x:center.x+anchor.x-now.x,y:center.y+anchor.y-now.y};
      update();
    }

    function zoom(zoom,point,anchor){
      state.mobileZoom = clamp(zoom,75,350);
      update();
      if(point && anchor) pan(anchor,point);
    }

    function keepSelectionVisible(){
      if(!state.mobilePanel || !stage.clientWidth || !stage.clientHeight) return;
      const selected = canvas.querySelector('.drawing2d-cabinet.is-selected, .drawing2d-obstacle.is-selected, .drawing2d-surface.is-selected');
      if(!selected) return;
      const box = selected.getBBox(), view = canvas.viewBox.baseVal;
      const left = view.x+view.width*.05, top = view.y+view.height*.05;
      const right = view.x+view.width*.95, bottom = view.y+view.height*.95;
      if(box.x>=left && box.y>=top && box.x+box.width<=right && box.y+box.height<=bottom) return;
      const overflow = Math.max(box.width/(view.width*.9),box.height/(view.height*.9));
      if(overflow>1) state.mobileZoom = Math.max(75,state.mobileZoom/overflow);
      state.camera = {x:box.x+box.width/2,y:box.y+box.height/2};
      update();
    }

    return {update,project,pan,zoom,keepSelectionVisible,refit(next){frame=next;state.camera=null;update();}};
  }

  function setPanelRatio(work,state,ratio){
    state.panelRatio = clamp(ratio,.33,.72);
    work.style.setProperty('--drawing-panel-height',state.panelRatio*100+'%');
    const handle = work.querySelector('.drawing2d-panel-handle');
    if(handle) handle.textContent = state.panelRatio>.5?'Zmniejsz panel':'Rozwiń panel';
  }

  function wirePanelHandle(handle,state){
    let start, moved;
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0) return;
      const work = handle.closest('.drawing2d-work');
      start = {work,y:event.clientY,ratio:handle.parentElement.offsetHeight/work.offsetHeight};
      moved = false;
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove',event=>{
      if(!start) return;
      const offset = start.y-event.clientY;
      if(moved || Math.abs(offset)>5){
        moved = true;
        setPanelRatio(start.work,state,start.ratio+offset/start.work.offsetHeight);
      }
    });
    handle.addEventListener('lostpointercapture',()=>{start=null;});
    handle.addEventListener('click',event=>{
      if(moved && event.detail) event.stopPropagation();
      moved = false;
    });
  }

  function wirePointers(surface,state,view,handlers){
    const pointers = new Map();
    let gesture;
    function pair(){
      const [a,b] = pointers.values();
      return {point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
    }
    function startPinch(){
      const {point,distance} = pair();
      gesture = {distance,zoom:state.mobileZoom,anchor:view.project(point)};
    }
    surface.addEventListener('pointerdown',event=>{
      if(event.button!==0 || handlers.busy()) return;
      const point = {x:event.clientX,y:event.clientY};
      pointers.set(event.pointerId,point);
      surface.setPointerCapture(event.pointerId);
      if(pointers.size===2){
        handlers.cancel();
        startPinch();
      }else if(pointers.size===1){
        const target = state.wallForm ? null : event.target.closest('[data-cabinet], [data-obstacle], [data-surface]');
        const movingCabinet = !!target?.dataset.cabinet && target.dataset.cabinet===state.selected;
        gesture = {point,target,movingCabinet,anchor:view.project(point)};
        if(movingCabinet) handlers.begin(event,target);
      }
    });
    surface.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId)) return;
      const point = {x:event.clientX,y:event.clientY};
      pointers.set(event.pointerId,point);
      if(pointers.size>=2){
        const next = pair();
        view.zoom(gesture.zoom*next.distance/gesture.distance,next.point,gesture.anchor);
      }else if(gesture.movingCabinet) handlers.move(event);
      else if(gesture.moved || Math.hypot(point.x-gesture.point.x,point.y-gesture.point.y)>5){
        gesture.moved = true;
        view.pan(gesture.anchor,point);
      }
    });
    function end(event){
      if(!pointers.delete(event.pointerId)) return;
      if(pointers.size>=2){startPinch();return;}
      if(pointers.size===1){
        const [point] = pointers.values();
        gesture = {point,moved:true,anchor:view.project(point)};
      }else if(event.type!=='pointerup') handlers.cancel();
      else if(gesture.movingCabinet) handlers.finish(event);
      else if(!gesture.moved && gesture.target) handlers.select(gesture.target);
    }
    for(const type of ['pointerup','pointercancel','lostpointercapture']) surface.addEventListener(type,end);
  }

  FC.drawingMobile = {mountChrome,revealField,camera,wirePointers,setPanelRatio,wirePanelHandle};
})(window);
