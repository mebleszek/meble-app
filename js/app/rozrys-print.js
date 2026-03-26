(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function buildCsv(sheets, meta){
    const lines = [];
    lines.push(['material','sheet_no','board_w_mm','board_h_mm','item','w_mm','h_mm','x_mm','y_mm','rotated'].join(';'));
    const sub = Math.max(0, Number(meta && meta.edgeSubMm) || 0);
    const cutDims = (p)=>{
      if(!(sub > 0)) return { w:p.w, h:p.h };
      const cW = (p.edgeH1 ? 1 : 0) + (p.edgeH2 ? 1 : 0);
      const cH = (p.edgeW1 ? 1 : 0) + (p.edgeW2 ? 1 : 0);
      return {
        w: Math.max(0, Math.round((p.w || 0) - sub * cW)),
        h: Math.max(0, Math.round((p.h || 0) - sub * cH)),
      };
    };
    (Array.isArray(sheets) ? sheets : []).forEach((s, i)=>{
      (Array.isArray(s && s.placements) ? s.placements : []).filter((p)=> !p.unplaced).forEach((p)=>{
        const d = cutDims(p);
        lines.push([
          meta && meta.material || '',
          String(i + 1),
          String(s.boardW),
          String(s.boardH),
          (p.name || p.key || p.id || ''),
          String(d.w),
          String(d.h),
          String(p.x),
          String(p.y),
          p.rotated ? '1' : '0'
        ].join(';'));
      });
    });
    return lines.join('\n');
  }

  function downloadText(filename, content, mime, deps){
    const cfg = Object.assign({ openInfo:null }, deps || {});
    try{
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }catch(_){
      if(typeof cfg.openInfo === 'function') cfg.openInfo('Nie udało się pobrać pliku', 'Przeglądarka nie pozwoliła pobrać przygotowanego pliku.');
    }
  }

  function openPrintView(html, deps){
    const cfg = Object.assign({ openInfo:null }, deps || {});
    try{
      const w = window.open('', '_blank');
      if(!w){
        if(typeof cfg.openInfo === 'function') cfg.openInfo('Pop-up zablokowany', 'Przeglądarka zablokowała nowe okno potrzebne do podglądu wydruku.');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      const triggerPrint = ()=>{
        try{
          const imgs = Array.from(w.document.images || []);
          if(!imgs.length){
            w.focus();
            setTimeout(()=>{ try{ w.print(); }catch(_){ } }, 120);
            return;
          }
          let pending = 0;
          let fired = false;
          const fire = ()=>{
            if(fired) return;
            fired = true;
            w.focus();
            setTimeout(()=>{ try{ w.print(); }catch(_){ } }, 120);
          };
          const done = ()=>{
            pending = Math.max(0, pending - 1);
            if(pending === 0) fire();
          };
          imgs.forEach((img)=>{
            if(img.complete && img.naturalWidth > 0) return;
            pending += 1;
            img.addEventListener('load', done, { once:true });
            img.addEventListener('error', done, { once:true });
          });
          if(pending === 0){
            fire();
            return;
          }
          setTimeout(fire, 1800);
        }catch(_){
          try{ w.focus(); w.print(); }catch(__){ }
        }
      };
      if(w.document.readyState === 'complete') triggerPrint();
      else w.addEventListener('load', triggerPrint, { once:true });
    }catch(_){
      if(typeof cfg.openInfo === 'function') cfg.openInfo('Nie udało się otworzyć podglądu', 'Nie udało się otworzyć okna do wydruku / PDF.');
    }
  }

  function pxToMm(px){
    const n = Number(px);
    if(!Number.isFinite(n)) return 0;
    return n * 25.4 / 96;
  }

  function measurePrintHeaderMm(titleText, metaText){
    try{
      const sandbox = document.createElement('div');
      sandbox.style.position = 'absolute';
      sandbox.style.left = '-99999px';
      sandbox.style.top = '0';
      sandbox.style.width = '194mm';
      sandbox.style.visibility = 'hidden';
      sandbox.style.pointerEvents = 'none';
      sandbox.style.boxSizing = 'border-box';
      sandbox.innerHTML = `
        <div style="box-sizing:border-box;width:194mm;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
          <div style="margin:0 0 4mm;overflow-wrap:anywhere;word-break:break-word;">
            <div style="font-size:18px;line-height:1.2;font-weight:800;margin:0 0 2mm;overflow-wrap:anywhere;word-break:break-word;">${String(titleText || '')}</div>
            <div style="font-size:12px;line-height:1.35;color:#374151;margin:0;overflow-wrap:anywhere;word-break:break-word;">${String(metaText || '')}</div>
          </div>
        </div>`;
      document.body.appendChild(sandbox);
      const measured = sandbox.firstElementChild ? sandbox.firstElementChild.getBoundingClientRect().height : sandbox.getBoundingClientRect().height;
      sandbox.remove();
      return Math.max(14, Math.ceil(pxToMm(measured) * 10) / 10 + 1);
    }catch(_){
      return 14;
    }
  }

  FC.rozrysPrint = {
    buildCsv,
    downloadText,
    openPrintView,
    pxToMm,
    measurePrintHeaderMm,
  };
})();
