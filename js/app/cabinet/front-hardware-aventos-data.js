(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const INLB_TO_MMKg = 25.4 * 0.45359237; // ≈ 11.521

  const FC_BLUM_FLAP_KIND_LABEL = {
    'HKI':'HKI',
    'HF_top':'HF top (składany)',
    'HS_top':'HS top (uchylno‑nachodzący)',
    'HL_top':'HL top (ponad korpus)',
    'HK_top':'HK top',
    'HK-S':'HK‑S',
    'HK-XS':'HK‑XS'
  };

  const HKXS_RANGES = [
    { model:'20K1101', min:200, max:1000, strength:'słaby' },
    { model:'20K1301', min:500, max:1500, strength:'średni' },
    { model:'20K1501', min:800, max:1800, strength:'mocny' }
  ];

  const HKTOP_RANGES = [
    { model:'22K2300', min:Math.round(36*INLB_TO_MMKg),  max:Math.round(139*INLB_TO_MMKg), strength:'słaby' },
    { model:'22K2500', min:Math.round(80*INLB_TO_MMKg),  max:Math.round(240*INLB_TO_MMKg), strength:'średni' },
    { model:'22K2700', min:Math.round(150*INLB_TO_MMKg), max:Math.round(450*INLB_TO_MMKg), strength:'mocny' },
    { model:'22K2900', min:Math.round(270*INLB_TO_MMKg), max:Math.round(781*INLB_TO_MMKg), strength:'bardzo mocny' }
  ];

  const HKS_RANGES = [
    { model:'20K2A00', min:220, max:500, strength:'słaby' },
    { model:'20K2C00', min:400, max:1000, strength:'średni' },
    { model:'20K2E00', min:960, max:2215, strength:'mocny' }
  ];

  const HFTOP_RANGES = [
    { model:'22F2500', min:2700, max:13500, strength:'słaby/średni' },
    { model:'22F2800', min:10000, max:19300, strength:'mocny' }
  ];

  const HKI_RANGES = [
    { model:'24K2300', min:Math.round(37*INLB_TO_MMKg),  max:Math.round(142*INLB_TO_MMKg), strength:'słaby' },
    { model:'24K2500', min:Math.round(82*INLB_TO_MMKg),  max:Math.round(246*INLB_TO_MMKg), strength:'średni' },
    { model:'24K2700', min:Math.round(152*INLB_TO_MMKg), max:Math.round(458*INLB_TO_MMKg), strength:'mocny' },
    { model:'24K2800', min:Math.round(229*INLB_TO_MMKg), max:Math.round(686*INLB_TO_MMKg), strength:'bardzo mocny' }
  ];

  const HSTOP_TABLE = [
    { model:'22S2200', khMin:350, khMax:540, wMin0:2.0,   wMin1:3.0,  wMax0:10.25, wMax1:12.5, strength:'słaby' },
    { model:'22S2500', khMin:480, khMax:660, wMin0:2.75,  wMin1:3.0,  wMax0:12.75, wMax1:15.25, strength:'średni' },
    { model:'22S2800', khMin:650, khMax:800, wMin0:3.5,   wMin1:4.0,  wMax0:16.5,  wMax1:18.5,  strength:'mocny' }
  ];

  const HLTOP_TABLE = [
    { model:'22L2200', khMin:300, khMax:340, wMin:0.8, wMax:5.6,  strength:'słaby' },
    { model:'22L2500', khMin:340, khMax:390, wMin:1.1, wMax:7.5,  strength:'średni' },
    { model:'22L2800', khMin:390, khMax:580, wMin:1.3, wMax:10.3, strength:'mocny' }
  ];

  const MAX_FRONT_HEIGHT_BY_KIND_MM = {
    'HK-XS': 0,
    'HK_top': 600,
    'HK-S': 600,
    'HKI': 610,
    'HL_top': 580,
    'HS_top': 800,
    'HF_top': 1200
  };

  const MIN_FRONT_HEIGHT_BY_KIND_MM = {
    'HK-XS': 240,
    'HK_top': 205,
    'HK-S': 180,
    'HKI': 162,
    'HL_top': 300,
    'HS_top': 350,
    'HF_top': 480
  };

  const MAX_FRONT_WIDTH_BY_KIND_MM = {
    'HK-XS': 0,
    'HK_top': 1800,
    'HK-S': 1800,
    'HKI': 1800,
    'HL_top': 1800,
    'HS_top': 1800,
    'HF_top': 1800
  };

  const MIN_FRONT_WIDTH_BY_KIND_MM = {
    'HK-XS': 0,
    'HK_top': 0,
    'HK-S': 0,
    'HKI': 0,
    'HL_top': 0,
    'HS_top': 0,
    'HF_top': 0
  };

  const MIN_INTERNAL_DEPTH_BY_KIND_MM = {
    'HK-XS': 100,
    'HK-S': 163,
    'HK_top': 187,
    'HL_top': 264,
    'HS_top': 264,
    'HF_top': 264,
    'HKI': 270
  };

  const REC_INTERNAL_DEPTH_BY_KIND_MM = {
    'HK-XS': 125
  };

  const KIND_ORDER = ['HK-XS','HK_top','HK-S','HKI','HL_top','HS_top','HF_top'];
  const SINGLE_HANDLE_KINDS = ['HF_top','HS_top','HL_top'];

  ns.frontHardwareAventosData = {
    INLB_TO_MMKg,
    FC_BLUM_FLAP_KIND_LABEL,
    HKXS_RANGES,
    HKTOP_RANGES,
    HKS_RANGES,
    HFTOP_RANGES,
    HKI_RANGES,
    HSTOP_TABLE,
    HLTOP_TABLE,
    MAX_FRONT_HEIGHT_BY_KIND_MM,
    MIN_FRONT_HEIGHT_BY_KIND_MM,
    MAX_FRONT_WIDTH_BY_KIND_MM,
    MIN_FRONT_WIDTH_BY_KIND_MM,
    MIN_INTERNAL_DEPTH_BY_KIND_MM,
    REC_INTERNAL_DEPTH_BY_KIND_MM,
    KIND_ORDER,
    SINGLE_HANDLE_KINDS
  };
})();
