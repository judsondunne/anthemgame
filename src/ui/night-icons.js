// Shared word-free glyphs for the new toolbar, tutorials and night alerts.
const svg = (p) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${p}</svg>`;
const stroke = 'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
export const NIGHT_ICONS = {
  eye: svg(`<path d="M4 24S11 12 24 12s20 12 20 12-7 12-20 12S4 24 4 24Z" fill="#e7eddc" ${stroke}/><circle cx="24" cy="24" r="7" fill="#789687" ${stroke}/><circle cx="26" cy="22" r="2" fill="#fff9e9"/>`),
  god: svg(`<path d="m5 22 19-12 19 12-19 12Z" fill="#a2bc8b" ${stroke}/><path d="m5 29 19 12 19-12M24 34v7" ${stroke}/><path d="m20 21 4-5 4 5v7h-8Z" fill="#fff3d9" ${stroke}/>`),
  bag: svg(`<path d="M11 18a8 8 0 0 1 8-8h10a8 8 0 0 1 8 8v23H11Z" fill="#c4ac86" ${stroke}/><path d="M18 10V8a6 6 0 0 1 12 0v2M11 24h26" ${stroke}/><rect x="16" y="28" width="16" height="10" rx="3" fill="#f3dfb6" ${stroke}/><path d="M24 26v5" ${stroke}/>`),
  flashlight: svg(`<path d="m15 24 10 10-10 10L5 34Z" fill="#82988a" ${stroke}/><path d="m15 24 4-9 15 15-9 4Z" fill="#c6b185" ${stroke}/><path d="m19 15 5-5 15 15-5 5Z" fill="#fff1bc" ${stroke}/><path d="m30 7 2-4m7 12 5-2m-5-4 3-3" stroke="#dfb965" stroke-width="3" stroke-linecap="round"/>`),
  fence: svg(`<path d="M8 12 12 7l4 5v31H8Zm24 0 4-5 4 5v31h-8Z" fill="#c4a078" ${stroke}/><path d="M4 18h40v6H4Zm0 13h40v6H4Z" fill="#e4c79c" ${stroke}/>`),
  gate: svg(`<path d="M6 9h6v34H6Zm30 0h6v34h-6Z" fill="#b99470" ${stroke}/><path d="M14 15h20v25H14Z" fill="#dac09a" ${stroke}/><path d="m15 37 18-19M14 24h20" ${stroke}/><circle cx="29" cy="29" r="2" fill="#6b5b45"/>`),
  erase: svg(`<path d="m9 27 18-18 14 14-18 18H17L7 31Z" fill="#dea59a" ${stroke}/><path d="m16 20 14 14M20 41h22" ${stroke}/>`),
  rotate: svg(`<path d="M36 15a16 16 0 1 0 3 20M36 6v11H25" ${stroke}/>`),
  help: svg(`<circle cx="24" cy="24" r="18" fill="#fff3d9" ${stroke}/><path d="M18 18a6 6 0 1 1 10 5c-3 2-4 3-4 6m0 6h.01" ${stroke}/>`),
  wolf: svg(`<path d="m6 7 13 8h10L42 7l-4 22-9 13H19L10 29Z" fill="#8a9b9e" ${stroke}/><path d="m6 7 8 17m28-17-8 17M17 27l7 8 7-8" ${stroke}/><path d="m13 23 7 2m8 0 7-2" stroke="#ffdf8d" stroke-width="3"/><path d="m21 33 3 3 3-3" fill="#3c4a4e" ${stroke}/>`),
  bear: svg(`<circle cx="11" cy="12" r="7" fill="#a67f5c" ${stroke}/><circle cx="37" cy="12" r="7" fill="#a67f5c" ${stroke}/><path d="M7 26a17 17 0 0 1 34 0c0 12-7 17-17 17S7 38 7 26Z" fill="#ad8967" ${stroke}/><ellipse cx="24" cy="32" rx="9" ry="7" fill="#dac09a"/><path d="M15 24h2m14 0h2m-12 6 3 3 3-3" ${stroke}/>`),
  alert: svg(`<path d="m24 5 21 37H3Z" fill="#e5b178" ${stroke}/><path d="M24 18v11m0 6h.01" ${stroke}/>`),
  arrow: svg(`<path d="M10 24h28m-10-9 10 9-10 9" ${stroke}/>`),
  brokenLink: svg(`<path d="m15 28-3 3a7 7 0 0 1-10-10l8-8a7 7 0 0 1 10 0m8 7 3-3a7 7 0 1 1 10 10l-8 8a7 7 0 0 1-10 0M18 22l12 12M17 6l3 7m16 21 7 3" ${stroke}/>`),
  claw: svg(`<path d="m13 9-6 28M25 7l-6 32M37 11l-6 28" stroke="#e9a097" stroke-width="5" stroke-linecap="round"/>`),
  bandage: svg(`<g transform="rotate(-35 24 24)"><rect x="4" y="15" width="40" height="18" rx="7" fill="#f0d4ad" ${stroke}/><path d="M19 15v18m10-18v18M11 21v6m26-6v6" stroke="#aa8062" stroke-width="2"/></g>`),
};
