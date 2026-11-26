(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};

  function renderDrawingTab(list,room){
    if(list && room) FC.drawingEditor.render(list,room);
  }

  FC.tabsRysunek = {renderDrawingTab};
  root.renderDrawingTab = renderDrawingTab;
  FC.tabsRouter.register('rysunek',{
    mount(){},
    render({listEl,room}){renderDrawingTab(listEl,room);},
    unmount(){}
  });
})(window);
