(function(root){
  'use strict';

  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function baseState(overrides){
    return Object.assign({
      material: 'MDF 18 biały',
      unit: 'mm',
      edgeSubMm: 0,
      boardW: 2800,
      boardH: 2070,
      kerf: 4,
      edgeTrim: 20,
      minScrapW: 100,
      minScrapH: 100,
      grain: false,
      heur: 'simple',
      direction: 'auto',
      optimaxProfile: 'max',
      realHalfQty: 0,
      realHalfBoardW: 0,
      realHalfBoardH: 0,
      stockExactQty: 0,
      stockFullBoardW: 2800,
      stockFullBoardH: 2070,
      stockPolicy: 'stock_limit_v4',
      stockSignature: '',
      grainExceptions: {},
    }, overrides || {});
  }

  function basicParts(){
    return [
      { key:'MDF 18 biały||Bok||720x560', name:'Bok', material:'MDF 18 biały', w:720, h:560, qty:2 },
      { key:'MDF 18 biały||Półka||560x300', name:'Półka', material:'MDF 18 biały', w:560, h:300, qty:4 },
      { key:'MDF 18 biały||Wieniec||764x560', name:'Wieniec', material:'MDF 18 biały', w:764, h:560, qty:2 },
    ];
  }

  function grainParts(){
    return [
      { key:'grain||front||600x350', name:'Front', material:'Dąb dziki', w:600, h:350, qty:2 },
      { key:'grain||listwa||2000x80', name:'Listwa', material:'Dąb dziki', w:2000, h:80, qty:1 },
    ];
  }

  function mixedPlanSheets(){
    return [
      {
        boardW: 2800,
        boardH: 2070,
        placements: [
          { key:'MDF 18 biały||Bok||720x560', name:'Bok', w:720, h:560 },
          { key:'MDF 18 biały||Bok||720x560', name:'Bok', w:720, h:560 },
        ],
        supplySource: 'stock',
      },
      {
        boardW: 2800,
        boardH: 2070,
        placements: [
          { key:'MDF 18 biały||Półka||560x300', name:'Półka', w:560, h:300 },
          { key:'MDF 18 biały||Półka||560x300', name:'Półka', w:560, h:300 },
          { key:'MDF 18 biały||Półka||560x300', name:'Półka', w:560, h:300 },
          { key:'MDF 18 biały||Półka||560x300', name:'Półka', w:560, h:300 },
          { key:'MDF 18 biały||Wieniec||764x560', name:'Wieniec', w:764, h:560 },
          { key:'MDF 18 biały||Wieniec||764x560', name:'Wieniec', w:764, h:560 },
        ],
        supplySource: 'order',
      }
    ];
  }

  function overproducedPlanSheets(){
    const sheets = mixedPlanSheets();
    sheets[1].placements.push({ key:'MDF 18 biały||Półka||560x300', name:'Półka', w:560, h:300 });
    return sheets;
  }

  function rotationOnlyPart(){
    return { key:'grain||panel||700x300', name:'Panel', material:'Dąb dziki', w:700, h:300, qty:1 };
  }

  function stockRows(){
    return [
      { width:2800, height:2070, qty:1 },
      { width:2800, height:2070, qty:2 },
      { width:2500, height:1250, qty:1 },
    ];
  }

  function printPayload(){
    return {
      meta: { boardW:2800, boardH:2070 },
      unit: 'mm',
      rotatePdfSheets: true,
      printTitle: 'Test rozrysu',
      printMetaLine: 'MDF 18 biały • 2 arkusze',
      imgs: [
        { src:'data:image/png;base64,AAA', width:1000, height:700 },
        { src:'data:image/png;base64,BBB', width:1000, height:700 },
      ],
      sheets: [
        { boardW:2800, boardH:2070, placements:[{ w:500, h:500 }], supplySource:'stock' },
        { boardW:2800, boardH:2070, placements:[{ w:600, h:400 }], supplySource:'order' },
      ],
    };
  }

  function pairPrintPayload(){
    return {
      meta: { boardW:300, boardH:100 },
      unit: 'mm',
      rotatePdfSheets: false,
      printTitle: 'Małe arkusze',
      printMetaLine: '2 arkusze testowe',
      imgs: [
        { src:'data:image/png;base64,CCC', width:300, height:100 },
        { src:'data:image/png;base64,DDD', width:300, height:100 },
      ],
      sheets: [
        { boardW:300, boardH:100, placements:[{ w:120, h:80 }], supplySource:'stock' },
        { boardW:300, boardH:100, placements:[{ w:90, h:100 }], supplySource:'order' },
      ],
    };
  }

  function cacheState(stockSignature, overrides){
    return baseState(Object.assign({ stockSignature: String(stockSignature || '') }, overrides || {}));
  }

  host.FC.rozrysDevFixtures = {
    clone,
    baseState,
    basicParts,
    grainParts,
    mixedPlanSheets,
    overproducedPlanSheets,
    rotationOnlyPart,
    stockRows,
    printPayload,
    pairPrintPayload,
    cacheState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
