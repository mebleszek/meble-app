(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    backup: [
      'M5 3.5h11.2L19 6.3v14.2H5z',
      'M8 3.5v6h7.5v-6',
      'M8 20.5v-7h8v7',
      'M10.2 16.2h3.6',
    ],
    settings: [
      'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z',
      'M19.2 13.2c.1-.4.1-.8.1-1.2s0-.8-.1-1.2l2-1.5-2-3.5-2.4 1a8.5 8.5 0 0 0-2.1-1.2L14.4 3h-4.8l-.4 2.6a8.5 8.5 0 0 0-2.1 1.2l-2.4-1-2 3.5 2 1.5c-.1.4-.1.8-.1 1.2s0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a8.5 8.5 0 0 0 2.1 1.2l.4 2.6h4.8l.4-2.6a8.5 8.5 0 0 0 2.1-1.2l2.4 1 2-3.5z',
    ],
    tests: [
      'M8 4.5h8',
      'M9.5 4.5v5.2l-4.8 7.4c-.9 1.4.1 3.4 1.8 3.4h11c1.7 0 2.7-2 1.8-3.4l-4.8-7.4V4.5',
      'M7.2 15.2h9.6',
      'M10 18.2l1.4 1.4 3.1-3.3',
    ],
  };

  function create(name, className){
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', className || 'app-ui-icon');
    (ICONS[name] || []).forEach((pathData)=>{
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', pathData);
      svg.appendChild(path);
    });
    return svg;
  }

  root.FC.appIcons = { create, names:Object.freeze(Object.keys(ICONS)) };
})();
