// Pieces shared by the adventure editor and the read-only share page.
import L from 'leaflet';
import { formatTab } from './i18n.js';
import { esc } from './ui.js';
import { picto } from './icons.js';

export function daysBetween(start, end) {
  const days = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && days.length < 60) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** Items of one day (or the unscheduled ideas when day is null), in their saved order. */
export function itemsOf(adventure, day) {
  const days = daysBetween(adventure.starts_on, adventure.ends_on);
  return adventure.items.filter((i) => (day ? i.day === day : !i.day || !days.includes(i.day)));
}


export const dayTab = (iso) => formatTab(iso);

/**
 * Small map of an adventure's places, numbered in visiting order.
 * Returns an update(items) function to redraw it.
 */
export function miniMap(el) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([48.8625, 2.3425], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const group = L.layerGroup().addTo(map);
  return (items) => {
    group.clearLayers();
    const located = items.filter((i) => i.lat != null);
    const points = located.map((i) => [i.lat, i.lng]);
    located.forEach((item, n) => {
      L.marker([item.lat, item.lng], {
        icon: L.divIcon({ className: 'num-marker', html: `<span>${n + 1}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
        title: item.title,
      }).bindTooltip(esc(item.title)).addTo(group);
    });
    if (points.length > 1) L.polyline(points, { color: '#365748', weight: 2, dashArray: '4 6' }).addTo(group);
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
    setTimeout(() => map.invalidateSize(), 0);
  };
}

/**
 * Map of one day: its steps numbered in order, every place of the day's neighbourhood
 * as small pictograms (a popup offers to add them), and Home.
 * Returns update({ items, extras, home, layers, addLabel }).
 */
export function dayMap(el) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([48.8625, 2.3425], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const group = L.layerGroup().addTo(map);
  return ({ items = [], extras = [], home = null, layers = [], addLabel = '' }) => {
    group.clearLayers();
    const located = items.filter((i) => i.lat != null);
    const points = located.map((i) => [i.lat, i.lng]);
    const layerOf = (p) => layers.find((l) => l.id === p.layer_id) || {};
    for (const p of extras) {
      const l = layerOf(p);
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: 'extra-marker', html: `<span>${picto(l.icon, l.color, 16)}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        title: p.name,
        zIndexOffset: -100,
      }).bindPopup(`<div class="extra-pop"><b>${esc(p.name)}</b>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
        ${addLabel ? `<button class="btn btn--small" type="button" data-add-place="${esc(p.id)}">+ ${esc(addLabel)}</button>` : ''}</div>`, { maxWidth: 240 })
        .addTo(group);
    }
    if (home) {
      L.marker([home.lat, home.lng], {
        icon: L.divIcon({ className: 'home-marker', html: `<span>${picto('house', '#c67b51', 16)}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
        title: home.name,
      }).bindTooltip(esc(home.name)).addTo(group);
    }
    located.forEach((item, n) => {
      L.marker([item.lat, item.lng], {
        icon: L.divIcon({ className: 'num-marker', html: `<span>${n + 1}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
        title: item.title,
        zIndexOffset: 500,
      }).bindTooltip(esc(item.title)).addTo(group);
    });
    if (points.length > 1) L.polyline(points, { color: '#365748', weight: 2, dashArray: '4 6' }).addTo(group);
    // Frame the day's steps and its neighbourhood; Home only if nothing else.
    const frame = [...points, ...extras.map((p) => [p.lat, p.lng])];
    if (frame.length === 1) map.setView(frame[0], 15);
    else if (frame.length > 1) map.fitBounds(frame, { padding: [28, 28], maxZoom: 16 });
    else if (home) map.setView([home.lat, home.lng], 12);
    setTimeout(() => map.invalidateSize(), 0);
  };
}
