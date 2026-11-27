(function(root){
  'use strict';
  const FC = root.FC, H = FC.testHarness;
  const walls = [{id:1,length:3200,height:2600},{id:2,length:2400,height:2500}];
  const placements = [{cabinetId:'cab1',wallId:2,along:650,inset:0,elevation:100,rotation:1}];
  const drawing = {version:1,walls,placements};

  function runAll(){
    return H.runSuite('Rysunek 2D',[
      H.makeTest('Rysunek','Zakładka zarejestrowana','Publiczne wejście używa nowego edytora.',()=>{
        H.assert(typeof FC.tabsRysunek?.renderDrawingTab === 'function','Brak renderera');
        H.assert(typeof FC.tabsRouter.get('rysunek')?.render === 'function','Brak zakładki');
      }),
      H.makeTest('Rysunek','Rzut i widok ściany bez zapisu','Odczyt starszego projektu i przełączanie widoków nie modyfikuje danych.',()=>{
        const previous = root.projectData;
        root.projectData = {kuchnia:{layout:{segments:[]},finishes:[],drawing2d:drawing,
          cabinets:[{id:'cab1',type:'stojąca',width:80,height:72,depth:56}]}};
        try{
          const before = JSON.stringify(root.projectData);
          const list = root.document.createElement('div');
          FC.tabsRysunek.renderDrawingTab(list,'kuchnia');
          H.assert(list.querySelector('svg[aria-label="Rzut pomieszczenia z góry"]'),'Brak rzutu');
          list.querySelector('button[data-drawing-action="view"][data-value="2"]').click();
          H.assert(list.querySelector('svg[aria-label="Widok · Ściana B"]'),'Brak widoku ściany');
          H.assert(list.querySelector('svg [data-cabinet="cab1"]'),'Brak tej samej szafki');
          H.assert(JSON.stringify(root.projectData)===before,'Render zmienił dane');
        }finally{root.projectData=previous;}
      }),
      H.makeTest('Rysunek','Kuchnia w L','Wspólny narożnik, osie ściany, kierunek frontu i przyciąganie.',()=>{
        const G = FC.drawingGeometry, [a,b] = G.walls(drawing);
        const end = G.toPlan(a,a.length,0);
        H.assert(b.x===end.x && b.y===end.y && b.dx===0 && b.dy===1,'Ściany nie tworzą narożnika');
        const p=placements[0],d=G.size({width:80,depth:56,height:72},p.rotation);
        H.assert(d.span===560 && d.depth===800,'Obrót nie zamienił osi');
        const box=G.planBox(b,p,d), back=G.fromPlan(b,G.toPlan(b,p.along,p.inset));
        H.assert(box.right-box.left===800 && box.bottom-box.top===560 && back.along===650,'Niespójna geometria');
        const near={...p,along:1832,inset:9};
        const corner=G.snap(near,b,d,[],'corner',20);
        H.assert(corner.along===1840 && corner.inset===0,'Brak przyciągania do narożnika');
        H.assert(G.snap(near,b,d,[],'off',20)===near,'Tryb wyłączony zmienia położenie');
      }),
      H.makeTest('Rysunek','Walidacja zapisu','Powiązanie z pomieszczeniem i odmowa nieznanej szafki lub ściany.',()=>{
        FC.projectExportContract.validateDrawing(drawing,[{id:'cab1'}]);
        for(const patch of [{cabinetId:'other'},{wallId:999},{rotation:4}]){
          let refused = false;
          try{FC.projectExportContract.validateDrawing({...drawing,placements:[{...placements[0],...patch}]},[{id:'cab1'}]);}
          catch(error){refused = error.exportFailure===true;}
          H.assert(refused,'Nieprawidłowy rysunek został przyjęty');
        }
      }),
      H.makeTest('Rysunek','Przeszkody w kuchni w L','Rzut i wysokość odróżniają kolizję od styku i wolnego miejsca.',()=>{
        const G = FC.drawingGeometry, [a,b] = G.walls(drawing);
        const entries = [
          {id:'window-1',kind:'window',wallId:1,along:500,width:600,elevation:1000,height:600},
          {id:'door-1',kind:'door',wallId:1,along:1500,width:800,elevation:0,height:2100},
          {id:'radiator-1',kind:'radiator',wallId:2,along:200,width:600,elevation:100,height:500,depth:200}
        ];
        const obstacles = G.obstacles({...drawing,obstacles:entries},[a,b]);
        const item = (cabinetId,wall,along,inset,elevation,span=500)=>{
          const p={cabinetId,wallId:wall.id,along,inset,elevation};
          const dimensions={span,depth:430,height:700};
          return {p,wall,dimensions,label:cabinetId,box:G.planBox(wall,p,dimensions)};
        };
        const risks = G.warnings([
          item('upper',a,600,0,1000),item('doorway',a,1700,0,100),item('corner',a,2900,210,100,300)
        ],obstacles);
        H.assert(risks.get('upper')?.some(s=>s.includes('okno')) && risks.has('window-1'),'Brak ostrzeżenia o oknie');
        H.assert(risks.has('doorway') && risks.has('door-1'),'Brak ostrzeżenia o futrynie');
        H.assert(risks.has('corner') && risks.has('radiator-1'),'Brak kolizji z kaloryferem przez narożnik');
        for(const clear of [item('below',a,600,0,300),item('away',a,1700,1,100),
          item('edge',b,200,200,100),item('above',b,210,0,600)]){
          H.assert(!G.warnings([clear],obstacles).has(clear.p.cabinetId),'Fałszywa kolizja dla '+clear.label);
        }
      }),
    ]);
  }
  FC.rysunekDevTests = {runAll};
})(window);
