(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;
  const catalog = FC.wycenaCoreCatalog;
  const source = FC.wycenaCoreSource;
  const offer = FC.wycenaCoreOffer;
  const selectionApi = FC.wycenaCoreSelection;
  if(!(utils && catalog && source && offer && selectionApi)){
    throw new Error('Brak zależności FC.wycenaCoreLines — sprawdź kolejność ładowania Wyceny.');
  }

  function collectAccessories(selectedRooms){
    const rows = new Map();
    const cabs = source.selectedCabinets(selectedRooms);
    cabs.forEach(({ roomId, roomLabel:rl, cabinet })=>{
      const parts = FC.cabinetCutlist && typeof FC.cabinetCutlist.getCabinetCutList === 'function' ? (FC.cabinetCutlist.getCabinetCutList(cabinet, roomId) || []) : [];
      parts.forEach((part)=>{
        const a = Number(part && part.a) || 0;
        const b = Number(part && part.b) || 0;
        const mat = String(part && (part.material || part.name) || '').trim();
        if(a > 0 && b > 0) return;
        if(!mat) return;
        const name = mat.replace(/^Okucia:\s*/i, '').trim() || mat;
        const key = utils.slug(name);
        const qty = Math.max(0, Number(part && part.qty) || 0) || 1;
        const prev = rows.get(key) || { key, type:'accessory', name, qty:0, unitPrice:0, total:0, rooms:new Set() };
        prev.qty += qty;
        prev.rooms.add(rl);
        const priceItem = catalog.accessoryPriceLookup(mat) || catalog.accessoryPriceLookup(name) || catalog.materialPriceLookup(mat) || catalog.materialPriceLookup(name);
        prev.unitPrice = Number(priceItem && priceItem.price) || prev.unitPrice || 0;
        prev.total = prev.qty * prev.unitPrice;
        rows.set(key, prev);
      });
    });
    return Array.from(rows.values()).map((row)=> Object.assign({}, row, { rooms:Array.from(row.rooms).join(', ') }));
  }

  function collectBuiltInAppliances(selectedRooms){
    const rows = new Map();
    const add = (name, roomLabel)=>{
      const key = utils.slug(name);
      const prev = rows.get(key) || { key, type:'service', category:'AGD', name, qty:0, unitPrice:0, total:0, rooms:new Set() };
      prev.qty += 1;
      prev.rooms.add(roomLabel);
      const svc = catalog.servicePriceLookup(name);
      prev.unitPrice = Number(svc && svc.price) || prev.unitPrice || 0;
      prev.total = prev.qty * prev.unitPrice;
      rows.set(key, prev);
    };
    source.selectedCabinets(selectedRooms).forEach(({ roomLabel:rl, cabinet })=>{
      const cab = cabinet || {};
      const sub = String(cab.subType || '');
      const details = cab.details || {};
      if(sub === 'zmywarkowa') add('Zmywarka do zabudowy', rl);
      if(sub === 'lodowkowa' && String(details.fridgeOption || 'zabudowa') === 'zabudowa') add('Lodówka do zabudowy', rl);
      if(sub === 'piekarnikowa') add('Piekarnik do zabudowy', rl);
      if(sub === 'okap') add('Okap podszafkowy / teleskopowy', rl);
    });
    return Array.from(rows.values()).map((row)=> Object.assign({}, row, { rooms:Array.from(row.rooms).join(', ') }));
  }

  function collectElementLines(selectionOverride){
    const normalizedSelection = selectionApi.normalizeQuoteSelection(selectionOverride);
    const aggregate = source.getSelectedAggregate(normalizedSelection);
    const scope = normalizedSelection.materialScope;
    const materialsOrdered = source.getScopedMaterials(aggregate, normalizedSelection);
    const rows = new Map();
    materialsOrdered.forEach((material)=>{
      const group = aggregate && aggregate.groups ? aggregate.groups[material] : null;
      const selectedParts = FC.rozrysScope && typeof FC.rozrysScope.getGroupPartsForScope === 'function'
        ? FC.rozrysScope.getGroupPartsForScope(group, scope)
        : ((group && group.parts) || []);
      (Array.isArray(selectedParts) ? selectedParts : []).forEach((part)=>{
        const qty = Math.max(0, Number(part && part.qty) || 0);
        if(!(qty > 0)) return;
        const width = Math.max(0, Math.round(Number(part && part.w) || 0));
        const height = Math.max(0, Math.round(Number(part && part.h) || 0));
        const name = String(part && part.name || 'Element').trim() || 'Element';
        const key = `${material}||${name}||${width}||${height}`;
        const prev = rows.get(key) || {
          key: utils.slug(key),
          type:'element',
          category:'Element',
          name,
          qty:0,
          unit:'szt.',
          unitPrice:0,
          total:0,
          materialLabel:String(material || '').trim(),
          width,
          height,
          rooms:(aggregate && Array.isArray(aggregate.selectedRooms) ? aggregate.selectedRooms : []).map(source.roomLabel).join(', '),
          note:'',
        };
        prev.qty += qty;
        rows.set(key, prev);
      });
    });
    return Array.from(rows.values()).sort((a,b)=>{
      const an = String(a && a.name || '');
      const bn = String(b && b.name || '');
      const cmp = an.localeCompare(bn, 'pl');
      if(cmp !== 0) return cmp;
      if((Number(b && b.width) || 0) !== (Number(a && a.width) || 0)) return (Number(b && b.width) || 0) - (Number(a && a.width) || 0);
      return (Number(b && b.height) || 0) - (Number(a && a.height) || 0);
    });
  }

  function collectClientPdfDetails(selectionOverride){
    const normalizedSelection = selectionApi.normalizeQuoteSelection(selectionOverride);
    return {
      elements: collectElementLines(normalizedSelection),
      materials: (function(){
        const aggregate = source.getSelectedAggregate(normalizedSelection);
        return source.getScopedMaterials(aggregate, normalizedSelection).map((material)=> ({
          key: utils.slug(material),
          type:'material-summary',
          name:String(material || '').trim(),
        })).filter((row)=> row.name);
      })(),
      accessories: collectAccessories(selectionApi.decodeSelectedRooms(normalizedSelection)),
      services: offer.collectQuoteRateLines(),
      agd: collectBuiltInAppliances(selectionApi.decodeSelectedRooms(normalizedSelection)),
    };
  }

  FC.wycenaCoreLines = {
    collectAccessories,
    collectBuiltInAppliances,
    collectElementLines,
    collectClientPdfDetails,
  };
})();
