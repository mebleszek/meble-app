(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createApi(deps){
    deps = deps || {};
    const apiFC = deps.FC || FC;
    const safeGetProject = typeof deps.safeGetProject === 'function' ? deps.safeGetProject : (()=> null);
    const getRooms = typeof deps.getRooms === 'function' ? deps.getRooms : (()=> []);
    const normalizeRoomSelection = typeof deps.normalizeRoomSelection === 'function' ? deps.normalizeRoomSelection : ((rooms)=> Array.isArray(rooms) ? rooms.slice() : []);
    const resolveCabinetCutListFn = typeof deps.resolveCabinetCutListFn === 'function' ? deps.resolveCabinetCutListFn : (()=> null);
    const resolveRozrysPartFromSource = typeof deps.resolveRozrysPartFromSource === 'function' ? deps.resolveRozrysPartFromSource : ((part)=> ({
      materialKey: String((part && part.material) || '').trim(),
      name: String((part && part.name) || 'Element'),
      sourceSig: '',
      direction: 'default',
      ignoreGrain: false,
      w: 0,
      h: 0,
      qty: 0,
    }));
    const isFrontMaterialKey = typeof deps.isFrontMaterialKey === 'function' ? deps.isFrontMaterialKey : (()=> false);
    const partSignature = typeof deps.partSignature === 'function' ? deps.partSignature : ((part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`);
    const mmToUnitStr = typeof deps.mmToUnitStr === 'function' ? deps.mmToUnitStr : ((mm)=> String(Math.round(Number(mm) || 0)));
    const openRozrysInfo = typeof deps.openRozrysInfo === 'function' ? deps.openRozrysInfo : (()=> {});

    function buildResolvedSnapshotFromParts(parts){
      const rv = apiFC.rozrysValidation;
      if(!(rv && typeof rv.rowsFromParts === 'function')) return [];
      return rv.rowsFromParts((parts || []).map((part)=>({
        key: partSignature({ material: part.material, name: part.name, w: part.w, h: part.h, sourceSig: part.sourceSig, grainMode: part.grainMode || part.direction }),
        material: part.material,
        name: part.name,
        w: part.w,
        h: part.h,
        qty: part.qty,
      })));
    }

    function buildRawSnapshotForMaterial(targetMaterial, mode, selectedRooms){
      const project = safeGetProject();
      if(!project || !targetMaterial) return [];
      const rooms = normalizeRoomSelection(Array.isArray(selectedRooms) ? selectedRooms : getRooms());
      const scopeMode = (mode === 'fronts' || mode === 'corpus' || mode === 'both') ? mode : 'both';
      const cutListFn = resolveCabinetCutListFn();
      if(typeof cutListFn !== 'function') return [];
      const rows = [];
      for(const room of rooms){
        const cabinets = (project[room] && Array.isArray(project[room].cabinets)) ? project[room].cabinets : [];
        for(let cabIndex = 0; cabIndex < cabinets.length; cabIndex += 1){
          const cabinet = cabinets[cabIndex];
          const parts = cutListFn(cabinet, room) || [];
          for(const part of parts){
            const sourceMaterial = String(part.material || '').trim();
            if(!sourceMaterial) continue;
            const isFront = (String(part.name || '').trim() === 'Front') || isFrontMaterialKey(sourceMaterial);
            if(scopeMode === 'fronts' && !isFront) continue;
            if(scopeMode === 'corpus' && isFront) continue;
            const resolved = resolveRozrysPartFromSource(part);
            const materialKey = resolved.materialKey;
            if(materialKey !== targetMaterial) continue;
            const w = resolved.w;
            const h = resolved.h;
            const qty = resolved.qty;
            if(!(w > 0 && h > 0 && qty > 0)) continue;
            rows.push({
              key: partSignature({ material: materialKey, name: resolved.name, w, h, sourceSig: resolved.sourceSig, grainMode: resolved.direction }),
              material: materialKey,
              name: resolved.name,
              sourceSig: resolved.sourceSig,
              grainMode: resolved.direction,
              ignoreGrain: !!resolved.ignoreGrain,
              w,
              h,
              qty,
              room,
              source: String((cabinet && (cabinet.name || cabinet.label || cabinet.type || cabinet.kind)) || 'Szafka'),
              cabinet: `#${cabIndex + 1}`,
              sourceRows: 1,
            });
          }
        }
      }
      return rows;
    }

    function buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms){
      if(apiFC.rozrysSummary && typeof apiFC.rozrysSummary.buildRozrysDiagnostics === 'function'){
        return apiFC.rozrysSummary.buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms, {
          buildRawSnapshotForMaterial,
          buildResolvedSnapshotFromParts,
        });
      }
      return null;
    }

    function validationSummaryLabel(diag){
      if(apiFC.rozrysSummary && typeof apiFC.rozrysSummary.validationSummaryLabel === 'function') return apiFC.rozrysSummary.validationSummaryLabel(diag);
      return { text:'Walidacja: brak danych', tone:'is-warn' };
    }

    function openValidationListModal(material, diag, unit){
      if(apiFC.rozrysSummary && typeof apiFC.rozrysSummary.openValidationListModal === 'function'){
        return apiFC.rozrysSummary.openValidationListModal(material, diag, unit, { mmToUnitStr, openPrintView });
      }
    }

    function openSheetListModal(material, sheetTitle, rows, unit){
      if(apiFC.rozrysSummary && typeof apiFC.rozrysSummary.openSheetListModal === 'function'){
        return apiFC.rozrysSummary.openSheetListModal(material, sheetTitle, rows, unit, { mmToUnitStr, openPrintView });
      }
    }

    function buildCsv(sheets, meta){
      if(apiFC.rozrysPrint && typeof apiFC.rozrysPrint.buildCsv === 'function'){
        return apiFC.rozrysPrint.buildCsv(sheets, meta);
      }
      return '';
    }

    function downloadText(filename, content, mime){
      if(apiFC.rozrysPrint && typeof apiFC.rozrysPrint.downloadText === 'function'){
        return apiFC.rozrysPrint.downloadText(filename, content, mime, { openInfo: openRozrysInfo });
      }
    }

    function openPrintView(html){
      if(apiFC.rozrysPrint && typeof apiFC.rozrysPrint.openPrintView === 'function'){
        return apiFC.rozrysPrint.openPrintView(html, { openInfo: openRozrysInfo });
      }
    }

    function pxToMm(px){
      if(apiFC.rozrysPrint && typeof apiFC.rozrysPrint.pxToMm === 'function'){
        return apiFC.rozrysPrint.pxToMm(px);
      }
      const n = Number(px);
      return Number.isFinite(n) ? n * 25.4 / 96 : 0;
    }

    function measurePrintHeaderMm(titleText, metaText){
      if(apiFC.rozrysPrint && typeof apiFC.rozrysPrint.measurePrintHeaderMm === 'function'){
        return apiFC.rozrysPrint.measurePrintHeaderMm(titleText, metaText);
      }
      return 14;
    }

    return {
      buildResolvedSnapshotFromParts,
      buildRawSnapshotForMaterial,
      buildRozrysDiagnostics,
      validationSummaryLabel,
      openValidationListModal,
      openSheetListModal,
      buildCsv,
      downloadText,
      openPrintView,
      pxToMm,
      measurePrintHeaderMm,
    };
  }

  FC.rozrysRuntimeUtils = { createApi };
})();
