// Pieces shared by the adventure editor and the read-only share page.
import L from 'leaflet';
import { formatTab } from './i18n.js';
import { esc } from './ui.js';

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
