(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const fail = code=>{throw Object.assign(Error(code),{code});};

  function scope(room){
    return {
      room, investor:FC.investors?.getCurrentId(),
      project:FC.projectStore?.getCurrentProjectId(), writer:FC.applicationWrite
    };
  }

  function current(expected){
    const live = scope(expected.room);
    return !!expected.project && !!expected.investor && live.project === expected.project
      && live.investor === expected.investor && live.writer === expected.writer
      && root.uiState?.roomType === expected.room && root.uiState?.activeTab === 'rysunek';
  }

  async function save(expected, drawing){
    const room = expected.room;
    const before = JSON.stringify(root.projectData[room]);
    const write = ()=>{
      if(!current(expected) || JSON.stringify(root.projectData[room]) !== before) fail('LF_DRAWING_CONTEXT_CHANGED');
      const record = FC.projectStore.getById(expected.project);
      if(record?.investorId !== expected.investor || !record.projectData?.[room]) fail('LF_DRAWING_CONTEXT_CHANGED');
      const session = FC.session;
      if(!session || (session.active && (session.projectId !== expected.project || session.roomId && session.roomId !== room))) fail('LF_DRAWING_CONTEXT_CHANGED');
      const next = structuredClone(root.projectData);
      if(drawing===undefined) delete next[room].drawing2d;
      else{
        FC.projectExportContract.validateDrawing(drawing,next[room].cabinets);
        next[room].drawing2d = structuredClone(drawing);
      }
      if(session.begin(room) !== true) fail(session.lastError?.code || 'LF_DRAWING_BEGIN_FAILED');
      const result = FC.project.saveConfirmed(next,{expectedRecord:record,draft:!!expected.writer});
      if(!result.ok) fail(result.code || 'LF_DRAWING_SAVE_FAILED');
      if(expected.writer) expected.writer.afterCommit(()=>{if(current(expected)) root.projectData = result.project;});
      else root.projectData = result.project;
      return true;
    };
    return expected.writer ? expected.writer.draftHandler(write)() : write();
  }

  FC.drawingStorage = {scope,current,save};
})(window);
