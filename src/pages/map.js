import L from 'leaflet';
import '../styles/base.css';
import '../styles/map.css';
import { api } from '../lib/api.js';
import { t, tr, formatShort } from '../lib/i18n.js';
import { cutout, esc, mountNav, startPage, toast } from '../lib/ui.js';
import { stickerSvg } from '../lib/stickers.js';
import { openStatus, parisClock, hoursForDay } from '../lib/hours.js';

startPage();
mountNav('map');

const statusEl = document.querySelector('[data-status]');
const card = document.querySelector('[data-card]');
const canHover = matchMedia('(hover: hover) and (min-width: 701px)').matches;

const state = {
  layers: [],
  places: [],
  visible: new Set(),
  favouritesOnly: false,
  pinned: null,
  adventures: null,
  objects: new Map(), // place id -> { marker, lines }
};

const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([48.8625, 2.3425], 14);
L.control.zoom({ position: 'bottomright' }).addTo(map);
// OpenStreetMap's own tiles: open data, free, no API key. Fine for a personal site
// (usage policy: https://operations.osmfoundation.org/policies/tiles/).
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

load().catch((err) => {
  console.error(err);
  statusEl.textContent = t('map.error');
});

async function load() {
  const data = await api('/api/map/paris');
  statusEl.hidden = true;
  state.layers = data.layers;
  state.places = data.places;
  state.visible = new Set(data.layers.filter((l) => l.visible_by_default).map((l) => l.id));
  map.setView([data.city.lat, data.city.lng], data.city.zoom);
  document.querySelector('[data-title]').append(cutout(tr(data.city, 'name')));
  renderLegend();
  drawPlaces();
  openFromHash();
}

const layerOf = (place) => state.layers.find((l) => l.id === place.layer_id);

function renderLegend() {
  const box = document.querySelector('[data-layers]');
  box.innerHTML = state.layers
    .map((l) => {
      const count = state.places.filter((p) => p.layer_id === l.id).length;
      return `<label class="toggle">
        <input type="checkbox" value="${esc(l.id)}" ${state.visible.has(l.id) ? 'checked' : ''} />
        ${stickerSvg(l.icon, l.color, { size: 26 })}
        <span>${esc(tr(l, 'name'))}</span>
        <span class="toggle__count">${count}</span>
      </label>`;
    })
    .join('');
  box.addEventListener('change', (e) => {
    const id = e.target.value;
    if (e.target.checked) state.visible.add(id);
    else state.visible.delete(id);
    applyFilters();
  });
  document.querySelector('[data-favourites]').addEventListener('change', (e) => {
    state.favouritesOnly = e.target.checked;
    applyFilters();
  });
}

function drawPlaces() {
  for (const place of state.places) {
    const layer = layerOf(place);
    const icon = L.divIcon({
      className: 'marker',
      html: stickerSvg(layer.icon, layer.color, { favourite: place.favourite }) + (place.favourite ? '<span class="marker__fav">♥</span>' : ''),
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const marker = L.marker([place.lat, place.lng], { icon, title: tr(place, 'name'), keyboard: true, riseOnHover: true });
    const lines = (place.path || []).map((coords) =>
      L.layerGroup([
        // white casing under the coloured line: a strip of paper tape on the map
        L.polyline(coords, { color: '#fff', weight: 10, opacity: 0.9, lineCap: 'round', interactive: false }),
        L.polyline(coords, {
          color: layer.color,
          weight: 6,
          lineCap: 'round',
          dashArray: layer.id === 'streets' ? '1 10' : null,
        }),
      ]),
    );
    const show = () => showCard(place, marker, false);
    marker.on('click', () => pin(place, marker));
    if (canHover) {
      marker.on('mouseover', show);
      marker.on('mouseout', hideUnpinned);
    }
    for (const group of lines) {
      group.eachLayer((pl) => {
        pl.on('click', () => pin(place, marker));
        if (canHover) {
          pl.on('mouseover', show);
          pl.on('mouseout', hideUnpinned);
        }
      });
    }
    state.objects.set(place.id, { marker, lines });
  }
  applyFilters();
}

function applyFilters() {
  for (const place of state.places) {
    const { marker, lines } = state.objects.get(place.id);
    const on = state.visible.has(place.layer_id) && (!state.favouritesOnly || place.favourite);
    for (const obj of [marker, ...lines]) {
      if (on && !map.hasLayer(obj)) obj.addTo(map);
      if (!on && map.hasLayer(obj)) obj.remove();
    }
    if (!on && state.pinned === place.id) closeCard();
  }
}

// ---------- The polaroid ----------

function statusFacts(place) {
  const facts = [];
  const clock = parisClock();
  const status = openStatus(place.hours, clock);
  if (status.state === 'open') facts.push(['open', t('place.open', { time: status.until })]);
  else if (status.state === 'closed') {
    const today = hoursForDay(place.hours, clock.weekday);
    facts.push(['closed', today.length ? `${t('place.closed')} · ${t('place.today', { hours: today.join(', ') })}` : t('place.closedToday')]);
  }
  if (place.booking_required) facts.push(['warn', t('place.booking')]);
  if (place.price) facts.push(['', place.price]);
  return facts;
}

function cardHtml(place) {
  const photo = place.photos[0];
  const layer = layerOf(place);
  const facts = statusFacts(place)
    .map(([kind, label]) => `<li class="fact ${kind ? `fact--${kind}` : ''}">${esc(label)}</li>`)
    .join('');
  const events = place.events.length
    ? `<div class="place-card__events"><h3>${esc(t('place.onNow'))}</h3><ul>${place.events
        .map((e) => `<li>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}${e.ends_on ? ` <span class="muted">${esc(t('place.until', { date: formatShort(e.ends_on) }))}</span>` : ''}</li>`)
        .join('')}</ul></div>`
    : '';
  const media = photo
    ? `<img class="place-card__photo" src="${esc(photo.src)}" alt="" loading="lazy" />
       <p class="place-card__credit">${photo.source_url ? `<a href="${esc(photo.source_url)}" target="_blank" rel="noopener">` : ''}${esc(t('place.photoCredit', { author: photo.author || '?', license: photo.license || '' }))}${photo.source_url ? '</a>' : ''}</p>`
    : `<div class="place-card__nophoto">${stickerSvg(layer.icon, layer.color, { size: 64 })}</div>`;
  const hoursNote = [tr(place, 'hours_note'), place.hours.length && !place.hours_verified ? t('place.hoursUnchecked') : '']
    .filter(Boolean)
    .join(' ');
  return `
    <button class="place-card__close" type="button" aria-label="${esc(t('place.close'))}">×</button>
    <div class="place-card__body">
      <div class="place-card__media taped">${media}</div>
      <h2 class="place-card__name">${esc(tr(place, 'name'))}</h2>
      <div>
        <p class="place-card__summary">${esc(tr(place, 'summary'))}</p>
        ${facts ? `<ul class="place-card__facts">${facts}</ul>` : ''}
        ${hoursNote ? `<p class="place-card__hours-note">${esc(hoursNote)}</p>` : ''}
        ${place.tip ? `<p class="place-card__tip">${esc(tr(place, 'tip'))}</p>` : ''}
        ${events}
        <div class="place-card__actions" data-actions></div>
        <div class="place-card__links">
          ${place.website ? `<a href="${esc(place.website)}" target="_blank" rel="noopener">${esc(t('place.website'))}</a>` : ''}
        </div>
      </div>
    </div>`;
}

function showCard(place, marker, pinned) {
  if (state.pinned && !pinned) return; // a pinned card stays until closed
  card.innerHTML = cardHtml(place);
  card.hidden = false;
  card.classList.toggle('is-pinned', pinned);
  card.style.setProperty('--tilt', `${((place.id.length % 5) - 2) * 0.8}deg`);
  position(marker);
  card.querySelector('.place-card__close').addEventListener('click', closeCard);
  if (pinned) renderActions(place);
}

function position(marker) {
  if (!canHover) return; // the phone layout docks the card at the bottom
  const pt = map.latLngToContainerPoint(marker.getLatLng());
  const size = map.getSize();
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  let x = pt.x + 26;
  let y = pt.y - h / 2;
  if (x + w > size.x - 12) x = pt.x - w - 26;
  y = Math.max(12, Math.min(y, size.y - h - 12));
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}

function hideUnpinned() {
  if (!state.pinned) card.hidden = true;
}

function pin(place, marker) {
  state.pinned = place.id;
  for (const { marker: m } of state.objects.values()) m.getElement()?.classList.remove('is-active');
  marker.getElement()?.classList.add('is-active');
  showCard(place, marker, true);
  history.replaceState(null, '', `#${place.id}`);
}

function closeCard() {
  const id = state.pinned;
  state.pinned = null;
  card.hidden = true;
  if (id) state.objects.get(id)?.marker.getElement()?.classList.remove('is-active');
  history.replaceState(null, '', location.pathname);
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const place = state.places.find((p) => p.id === id);
  if (!place) return;
  const { marker } = state.objects.get(id);
  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16));
  pin(place, marker);
}

window.addEventListener('hashchange', openFromHash);
map.on('click', closeCard);
map.on('move', () => {
  if (state.pinned) position(state.objects.get(state.pinned).marker);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCard();
});

// ---------- Add to an adventure ----------

async function renderActions(place) {
  const box = card.querySelector('[data-actions]');
  state.adventures ??= await api('/api/adventures').catch(() => []);
  if (!state.adventures.length || state.pinned !== place.id) return;
  box.innerHTML = `
    <label class="visually-hidden" for="adv-select">${esc(t('place.addTo'))}</label>
    <select id="adv-select">${state.adventures.map((a) => `<option value="${esc(a.id)}">${esc(a.title)}</option>`).join('')}</select>
    <button class="btn" type="button">${esc(t('place.addTo'))}</button>`;
  box.querySelector('button').addEventListener('click', async (e) => {
    const select = box.querySelector('select');
    const adventure = state.adventures.find((a) => a.id === select.value);
    e.target.disabled = true;
    try {
      await api(`/api/adventures/${adventure.id}/items`, { method: 'POST', body: { place_id: place.id } });
      toast(t('place.added', { title: adventure.title }));
    } catch {
      toast(t('error.generic'));
    } finally {
      e.target.disabled = false;
    }
  });
}
