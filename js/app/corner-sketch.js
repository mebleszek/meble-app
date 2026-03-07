// js/app/corner-sketch.js
// Samodzielny helper canvas dla szkicu narożnych szafek w modalu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const ns = window.FC.cornerSketch = window.FC.cornerSketch || {};

  function drawCornerSketch(opts){
  const c = document.getElementById('cornerPreview');
  if(!c) return;
  const ctx = c.getContext('2d');

  const GL = Number(opts?.GL) || 0;
  const GP = Number(opts?.GP) || 0;
  const ST = Number(opts?.ST) || 0;
  const SP = Number(opts?.SP) || 0;
  const t  = Number(opts?.t ?? 1.8) || 1.8; // cm
  const flip = !!opts?.flip;

  // computed fronts (Twoje zasady)
  const FL = Math.abs(GL - GP);
  const FP = Math.abs(ST - SP - t);

  // pomocniczo dla podpisów / strzałek
  // Po FLIP chcemy, żeby "lewa strona rysunku" pokazywała dawną prawą głębokość (GP)
  // i odwrotnie – bez lustrzanego odwracania tekstu.
  const yLeftSide  = flip ? GP : GL;
  const yRightSide = flip ? GL : GP;
  const yFrontLine = Math.max(GL, GP);

  const W = c.width, H = c.height;
  ctx.clearRect(0,0,W,H);

  // marginesy
  const m = 55;
  const drawW = W - 2*m;
  const drawH = H - 2*m;

  const maxDepth = Math.max(GL, GP, 1);
  const sx = drawW / Math.max(1, ST);
  const sy = drawH / maxDepth;
  const s = Math.min(sx, sy);

  const ox = m, oy = m;
  const X = (v) => ox + v*s;
  const Y = (v) => oy + v*s;

  // Geometria poglądowa (top‑down) zgodna z Twoimi parametrami.
  // Kluczowe: przy flip rysunek jest LUSTROWANY, a nie tylko "przestawiany" punkt schodka.
  // Dzięki temu odcinek czerwony odpowiada zawsze FP = |ST − SP − t|.

  const notchX0 = Math.max(0, Math.min(ST, SP + t)); // oś "schodka" w bazowej orientacji
  const tx = (x) => (flip ? (ST - x) : x);

  // Punkty obrysu w bazie (bez flip), potem ewentualne lustrzane odbicie w osi pionowej.
  const ptsBase = [
    {x:0,    y:0},
    {x:ST,   y:0},
    {x:ST,   y:GP},
    {x:notchX0, y:GP},
    {x:notchX0, y:GL},
    {x:0,    y:GL}
  ];
  const pts = ptsBase.map(p => ({ x: tx(p.x), y: p.y }));

  // obrys korpusu (czarny)
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(X(pts[0].x), Y(pts[0].y));
  for(let i=1;i<pts.length;i++) ctx.lineTo(X(pts[i].x), Y(pts[i].y));
  ctx.closePath();
  ctx.stroke();

  // fronty (czerwony):
  // FL = |GL−GP| to pion schodka (pomiędzy y=GP i y=GL),
  // FP = |ST−SP−t| to poziom schodka (pomiędzy x=notch a skrajem).
  const pNotchTop = { x: tx(notchX0), y: GP };
  const pNotchBot = { x: tx(notchX0), y: GL };
  const pEdgeTop  = { x: tx(ST),      y: GP }; // po flip to będzie x=0

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#d11";
  ctx.beginPath();
  // pion (FL)
  ctx.moveTo(X(pNotchTop.x), Y(pNotchTop.y));
  ctx.lineTo(X(pNotchBot.x), Y(pNotchBot.y));
  // poziom (FP)
  ctx.moveTo(X(pNotchTop.x), Y(pNotchTop.y));
  ctx.lineTo(X(pEdgeTop.x),  Y(pEdgeTop.y));
  ctx.stroke();

  // plecy/HDF (zielony) – poglądowo przy tylnej krawędzi
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0a7";
  ctx.beginPath();
  // przy flip tx(0)=ST, tx(ST)=0, więc bierzemy min/max żeby nie wyjść poza rysunek
  const hdfX1 = Math.min(tx(0), tx(ST)) + 1;
  const hdfX2 = Math.max(tx(0), tx(ST)) - 1;
  ctx.moveTo(X(hdfX1), Y(1));
  ctx.lineTo(X(Math.max(hdfX1, hdfX2)), Y(1));
  ctx.stroke();

  function arrow(x1,y1,x2,y2,label){
    const head = 9;
    const ang = Math.atan2(y2-y1, x2-x1);
    ctx.strokeStyle = "#1e4b8f";
    ctx.fillStyle = "#1e4b8f";
    ctx.lineWidth = 2;

    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

    const hx1 = x2 - head*Math.cos(ang) + head*0.6*Math.cos(ang+Math.PI/2);
    const hy1 = y2 - head*Math.sin(ang) + head*0.6*Math.sin(ang+Math.PI/2);
    const hx2 = x2 - head*Math.cos(ang) + head*0.6*Math.cos(ang-Math.PI/2);
    const hy2 = y2 - head*Math.sin(ang) + head*0.6*Math.sin(ang-Math.PI/2);

    ctx.beginPath();
    ctx.moveTo(x2,y2); ctx.lineTo(hx1,hy1); ctx.lineTo(hx2,hy2); ctx.closePath();
    ctx.fill();

    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, (x1+x2)/2, (y1+y2)/2 - 14);
  }

  // opisy wymiarów (cm)
  // SP rysujemy jako odcinek na "dole" (front dolny). Przy flip ląduje po prawej.
  const spClamped = Math.max(0, Math.min(ST, SP));
  const spA1 = flip ? (ST - spClamped) : 0;
  const spA2 = flip ? ST : spClamped;
  arrow(X(0), Y(-1.4), X(ST), Y(-1.4), `ST = ${ST} cm`);
  arrow(X(spA1), Y(yFrontLine+1.6), X(spA2), Y(yFrontLine+1.6), `SP = ${SP} cm`);

  // Etykiety GL/GP przechodzą na strony zgodnie z FLIP.
  // (Wartości wejściowe GL/GP nie muszą się zamieniać – liczymy fronty z |...|.)
  const leftLabel  = flip ? `GP = ${GP} cm` : `GL = ${GL} cm`;
  const rightLabel = flip ? `GL = ${GL} cm` : `GP = ${GP} cm`;
  arrow(X(-1.4), Y(0), X(-1.4), Y(yLeftSide), leftLabel);
  arrow(X(ST+1.4), Y(0), X(ST+1.4), Y(yRightSide), rightLabel);

  const legend = document.getElementById('cornerPreviewLegend');
  if(legend){
    legend.textContent = `Fronty: FL=|GL−GP|=${Math.round(FL*10)/10} cm, FP=|ST−SP−1,8|=${Math.round(FP*10)/10} cm`;
  }
  }

  ns.drawCornerSketch = drawCornerSketch;
})();
