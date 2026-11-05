// Line icons (24×24, 1.6 stroke) and the five layer pictograms.

const svg = (body, { size = 18, cls = 'icon' } = {}) =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M15.8 14.2c2.3.2 4 1.8 4.6 4.6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sparkle: '<path d="M12 2.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5z"/><path d="M18.5 15.5c.3 2 1.2 2.9 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.3 2.9-1.2 3.2-3.2z"/>',
  ticket: '<path d="M4 7.5h16v3a2 2 0 0 0 0 3v3H4v-3a2 2 0 0 0 0-3z"/><path d="M14 7.5v9" stroke-dasharray="1.5 2"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7h14v-7"/>',
  more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
  user: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2.2 3.2-3.2 5.5-3.2s4.2 1 5.5 3.2"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="1"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  calendarAdd: '<rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  partly: '<path d="M8.5 3.5v1.6M3.6 8.4h1.6M5.1 5l1.1 1.1M12.4 5l-1.1 1.1"/><path d="M5.8 11a3.3 3.3 0 0 1 5.9-2.6"/><path d="M8 19.5h9.5a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8.3 11 4.3 4.3 0 0 0 8 19.5z"/>',
  cloud: '<path d="M7 19h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 7 19z"/>',
  fog: '<path d="M7 13h10.5a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 5.8 3.7 3.7 0 0 0 7 13z"/><path d="M4 16.5h16M6 20h12"/>',
  rain: '<path d="M7 14h10.5a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 6.8 3.7 3.7 0 0 0 7 14z"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>',
  snow: '<path d="M7 14h10.5a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 6.8 3.7 3.7 0 0 0 7 14z"/><path d="M8.5 18v.01M12 20v.01M15.5 18v.01M10 21.5v.01M14 21.5v.01" stroke-width="2.4"/>',
  storm: '<path d="M7 14h10.5a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 6.8 3.7 3.7 0 0 0 7 14z"/><path d="M12.5 14.5l-2 3.5h3l-2 3.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
};

export const icon = (name, opts) => svg(ICONS[name] || '', opts);

// Layer pictograms: solid silhouettes so layers differ by shape, not only colour.
const PICTOS = {
  arch: '<path d="M5 21V11a7 7 0 0 1 14 0v10h-3.6V11a3.4 3.4 0 0 0-6.8 0v10z"/>',
  museum: '<path d="M12 2.8 3 7.2v2h18v-2z"/><rect x="4" y="18" width="16" height="2.4"/><rect x="5.4" y="10.4" width="2.4" height="6.6"/><rect x="10.8" y="10.4" width="2.4" height="6.6"/><rect x="16.2" y="10.4" width="2.4" height="6.6"/>',
  facade: '<path d="M6 21V8.5L12 4l6 4.5V21h-4v-4h-4v4z"/><rect x="2.5" y="11" width="3.5" height="10"/><rect x="18" y="11" width="3.5" height="10"/>',
  wave: '<path d="M2.5 15c2.4-5 4.8-5 7.1 0s4.8 5 7.2 0 3.9-4.2 4.7-2.2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  note: '<path d="M8 5.6 20.4 2.6v3.6L8 9.2z"/><rect x="8" y="5.8" width="2.4" height="12.6"/><rect x="18" y="3" width="2.4" height="12.8"/><ellipse cx="6.6" cy="18.6" rx="3.6" ry="2.8"/><ellipse cx="16.6" cy="16" rx="3.6" ry="2.8"/>',
  sparkle: '<path d="M12 2.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5z"/><path d="M18.5 15.5c.3 2 1.2 2.9 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.3 2.9-1.2 3.2-3.2z"/>',
  ticket: '<path d="M2.5 7h19v3.4a1.9 1.9 0 0 0 0 3.2V17h-19v-3.4a1.9 1.9 0 0 0 0-3.2z"/>',
  curtain: '<rect x="2.5" y="3" width="19" height="3" rx="0.5"/><path d="M3 6h7.6c-.9 4.6-.4 10 1.2 15H3z"/><path d="M21 6h-7.6c.9 4.6.4 10-1.2 15H21z"/>',
  house: '<path d="M12 2.8 2.2 11h2.6v10h5.4v-6h3.6v6h5.4V11h2.6z"/>',
  tree: '<path d="M12 2.5a6.2 6.2 0 0 0-4.6 10.4A4.6 4.6 0 0 0 10.5 18h.3v3.5h2.4V18h.3a4.6 4.6 0 0 0 3.1-5.1A6.2 6.2 0 0 0 12 2.5z"/>',
};

/** Layer pictogram filled with the layer colour. */
export function picto(name, color, size = 20) {
  return `<svg class="picto" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" style="color:${color}" aria-hidden="true">${PICTOS[name] || '<circle cx="12" cy="12" r="7"/>'}</svg>`;
}
