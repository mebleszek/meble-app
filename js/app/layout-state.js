// layout-state.js
// Źródło prawdy dla layoutu/wykończeń RYSUNKU i helperów stanu projektu.
// Cel: trzymać pomocniczą logikę layoutu poza app.js, bez zmiany UI.
(function(){
  window.FC = window.FC || {};
  window.FC.layoutState = window.FC.layoutState || {};

/* =========================================================
   RYSUNEK: Layout + interaktywne dodawanie wykończeń
   Model danych (w projekcie):
   projectData[room].layout = { segments:[ {id,name,anchor,offsets, rows:{base:[],wall:[],tall:[]} } ] }
   - element w rows: { kind:'cabinet', id:'<cabId>' } lub { kind:'gap', id:'gap_x', width:<cm>, label:'PRZERWA' }
   projectData[room].finishes = [ {id,type,segmentId,row, ... } ]
========================================================= */
function ensureLayout(room){
  const pd = projectData[room];
  if(!pd.layout || !Array.isArray(pd.layout.segments) || pd.layout.segments.length === 0){
    const segId = 'segA';
    const seg = {
      id: segId,
      name: 'Segment A',
      anchor: 'left',
      offsets: { base: 0, module: 0, wall: 0 },
      rows: { base: [], module: [], wall: [] }
    };
    const cabs = pd.cabinets || [];
    cabs.forEach(c=>{
      const row = (c.type === 'wisząca') ? 'wall' : (c.type === 'moduł' ? 'module' : 'base');
      seg.rows[row].push({ kind:'cabinet', id:c.id });
    });
    pd.layout = { segments:[seg], activeSegmentId: segId, zOrderRows: ['base','module','wall'] };
  } else {
    // migracja starych układów: zapewnij base/module/wall
    if(!pd.layout.zOrderRows || !Array.isArray(pd.layout.zOrderRows)) pd.layout.zOrderRows = ['base','module','wall'];
    pd.layout.segments.forEach(seg=>{
      if(seg.rows && seg.rows.tall){ delete seg.rows.tall; }
      if(!seg.rows) seg.rows = { base:[], module:[], wall:[] };
      if(!seg.rows.base) seg.rows.base = [];
      if(!seg.rows.module) seg.rows.module = [];
      if(!seg.rows.wall) seg.rows.wall = [];
      if(seg.offsets && seg.offsets.tall !== undefined){ delete seg.offsets.tall; }
      if(!seg.offsets) seg.offsets = { base:0, module:0, wall:0 };
      if(seg.offsets.base === undefined) seg.offsets.base = 0;
      if(seg.offsets.module === undefined) seg.offsets.module = 0;
      if(seg.offsets.wall === undefined) seg.offsets.wall = 0;
    });
  }
  if(!Array.isArray(pd.finishes)) pd.finishes = [];
  const act = pd.layout.activeSegmentId;
  if(act && !pd.layout.segments.find(s=>s.id===act)){
    pd.layout.activeSegmentId = pd.layout.segments[0].id;
  }
}

function getActiveSegment(room){
  ensureLayout(room);
  const pd = projectData[room];
  const segId = pd.layout.activeSegmentId || (pd.layout.segments[0] && pd.layout.segments[0].id);
  return pd.layout.segments.find(s=>s.id===segId) || pd.layout.segments[0];
}

function saveProject(){
  projectData = FC.project.save(projectData);
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
}

function humanRow(row){
  if(row==='base') return 'DOLNE';
  if(row==='module') return 'MODUŁY';
  if(row==='wall') return 'GÓRNE';
  return row;
}

function getCabById(room, id){
  return (projectData[room].cabinets || []).find(c=>c.id===id);
}

function layoutRowTotalWidthCm(room, seg, row){
  const arr = (seg.rows[row] || []);
  let sum = 0;
  arr.forEach(el=>{
    if(el.kind==='gap') sum += Number(el.width)||0;
    else if(el.kind==='cabinet'){
      const c = getCabById(room, el.id);
      sum += (c ? Number(c.width)||0 : 0);
    }
  });
  return sum;
}

function computeXPositionsCm(room, seg, row){
  const arr = (seg.rows[row] || []);
  let x = Number(seg.offsets?.[row] || 0);
  const out = [];
  for(let i=0;i<arr.length;i++){
    const el = arr[i];
    const w = (el.kind==='gap') ? (Number(el.width)||0) : (getCabById(room, el.id)?.width || 0);
    out.push({ i, el, x0:x, x1:x + (Number(w)||0), w:Number(w)||0 });
    x += (Number(w)||0);
  }
  return out;
}

function cmToPx(cm, scale){ return cm*scale; }

function defaultFinishDims(room, finish){
  const s = projectData[room].settings || {};
  if(finish.type === 'cokol'){
    return { h: Number(s.legHeight)||10 };
  }
  if(finish.type === 'blenda_gorna'){
    return { h: Number(s.ceilingBlende)||0 };
  }
  return {};
}

function addFinish(room, finish){
  finish.id = finish.id || FC.utils.uid();
  projectData[room].finishes.push(finish);
  saveProject();
}

function removeFinish(room, finishId){
  projectData[room].finishes = (projectData[room].finishes||[]).filter(f=>f.id!==finishId);
  saveProject();
}

function insertGapAfter(room, seg, row, index, widthCm){
  const arr = seg.rows[row];
  const gap = { kind:'gap', id:'gap_'+FC.utils.uid(), width: Number(widthCm)||0, label:'PRZERWA' };
  arr.splice(index+1, 0, gap);
  saveProject();
}

function finishLabel(f){
  if(f.type==='panel') return `Panel ${f.side==='L'?'lewy':'prawy'}`;
  if(f.type==='blenda_pion') return `Blenda pion ${f.side==='L'?'lewa':'prawa'}`;
  if(f.type==='blenda_pion_full') return `Blenda pion pełna ${f.side==='L'?'lewa':'prawa'}`;
  if(f.type==='panel_pion_full') return `Panel pełny ${f.side==='L'?'lewy':'prawy'}`;
  if(f.type==='cokol') return `Cokół (${humanRow(f.row)})`;
  if(f.type==='blenda_gorna') return `Blenda górna (${humanRow(f.row)})`;
  return f.type;
}

  window.FC.layoutState.ensureLayout = ensureLayout;
  window.FC.layoutState.getActiveSegment = getActiveSegment;
  window.FC.layoutState.saveProject = saveProject;
  window.FC.layoutState.humanRow = humanRow;
  window.FC.layoutState.getCabById = getCabById;
  window.FC.layoutState.layoutRowTotalWidthCm = layoutRowTotalWidthCm;
  window.FC.layoutState.computeXPositionsCm = computeXPositionsCm;
  window.FC.layoutState.cmToPx = cmToPx;
  window.FC.layoutState.defaultFinishDims = defaultFinishDims;
  window.FC.layoutState.addFinish = addFinish;
  window.FC.layoutState.removeFinish = removeFinish;
  window.FC.layoutState.insertGapAfter = insertGapAfter;
  window.FC.layoutState.finishLabel = finishLabel;

  // Legacy/global bridge: RYSUNEK i starsze pliki odwołują się do tych helperów po nazwie globalnej.
  window.ensureLayout = ensureLayout;
  window.getActiveSegment = getActiveSegment;
  window.saveProject = saveProject;
  window.humanRow = humanRow;
  window.getCabById = getCabById;
  window.layoutRowTotalWidthCm = layoutRowTotalWidthCm;
  window.computeXPositionsCm = computeXPositionsCm;
  window.cmToPx = cmToPx;
  window.defaultFinishDims = defaultFinishDims;
  window.addFinish = addFinish;
  window.removeFinish = removeFinish;
  window.insertGapAfter = insertGapAfter;
  window.finishLabel = finishLabel;
})();
