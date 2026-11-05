import L from 'leaflet';
import '../styles/base.css';
import '../styles/map.css';
import { api } from '../lib/api.js';
import { t, tr, formatShort, formatTab, setLanguage } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { icon, picto } from '../lib/icons.js';
import { openStatus, parisClock, hoursForDay } from '../lib/hours.js';
import { daysBetween } from '../lib/trip.js';

// Guests arrive with ?share=<token> from a shared adventure: read-only map, no sign-in.
const shareToken = new URLSearchParams(location.search).get('share');

startPage();
mountMasthead('map', shareToken ? { signedIn: false, readOnly: true, issue: '', shareToken } : {});

const statusEl = document.querySelector('[data-status]');
const card = document.querySelector('[data-card]');
const layersPanel = document.querySelector('#layers');
const canHover = matchMedia('(hover: hover) and (min-width: 901px)').matches;

const state = {
  layers: [],
  places: [],
  visible: new Set(),
  favouritesOnly: false,
  savedOnly: false,
  saved: new Map(), // place id -> days ('' for ideas) in the shared adventure
  adventure: null,
  pinned: null,
  adventures: null,
  objects: new Map(), // place id -> { marker, lines }
};

const map = L.map('map', { zoomControl: false }).setView([48.8625, 2.3425], 14);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
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

async function fetchMap() {
  if (!shareToken) return api('/api/map/paris');
  const res = await fetch(`/api/share/${encodeURIComponent(shareToken)}/map`);
  if (!res.ok) throw new Error('Unknown link');
  return res.json();
}

async function load() {
  const data = await fetchMap();
  statusEl.hidden = true;
  if (data.adventure) setupGuest(data);
  state.layers = data.layers;
  state.places = data.places;
  state.visible = new Set(data.layers.filter((l) => l.visible_by_default).map((l) => l.id));
  map.setView([data.city.lat, data.city.lng], data.city.zoom);
  document.querySelector('[data-count]').textContent = t('map.places', { n: data.places.length });
  renderEditionPhoto();
  renderLayers();
  drawPlaces();
  openFromHash();
}

const layerOf = (place) => state.layers.find((l) => l.id === place.layer_id);
const isSaved = (place) => state.saved.has(place.id);

/** Guest view: stars on the places of the shared adventure, and a key that explains them. */
function setupGuest(data) {
  const a = data.adventure;
  setLanguage(a.language);
  state.adventure = a;
  for (const { place_id, day } of data.saved) {
    if (!state.saved.has(place_id)) state.saved.set(place_id, []);
    state.saved.get(place_id).push(day || '');
  }
  document.title = `${a.title} · Map · citybook`;
  document.querySelector('[data-favourites-label]').textContent = t('map.ownerFavourites', { name: a.owner });
  document.querySelector('[data-saved-help]').textContent = `${t('map.saved', { title: a.title })}. ${t('map.savedHelp')}`;
  document.querySelector('[data-saved-key]').hidden = false;
  document.querySelector('[data-only-saved]').addEventListener('change', (e) => {
    state.savedOnly = e.target.checked;
    applyFilters();
  });
  const back = document.querySelector('[data-back-to-plan]');
  back.href = `/share?t=${encodeURIComponent(shareToken)}`;
  back.innerHTML = `${icon('arrowLeft', { size: 16 })} ${esc(t('map.backToPlan'))}`;
  back.hidden = false;
}

/** "Day 2, Mon 16 Nov" or "Ideas" for a saved place. */
function savedWhen(place) {
  const days = daysBetween(state.adventure.starts_on, state.adventure.ends_on);
  return state.saved.get(place.id)
    .map((d) => (days.includes(d) ? `${t('adventure.day', { n: days.indexOf(d) + 1 })}, ${formatTab(d)}` : t('adventure.ideas')))
    .filter((v, i, all) => all.indexOf(v) === i)
    .join(' · ');
}

/** A black-and-white photo of one of my favourite places, like a magazine cover. */
function renderEditionPhoto() {
  // Street scenes read best as an etching on the cover.
  const candidates = state.places.filter((p) => p.photos.length && ['streets', 'buildings'].includes(p.layer_id));
  const place = candidates[new Date().getDate() % Math.max(candidates.length, 1)];
  if (!place) return;
  const photo = place.photos[0];
  const fig = document.querySelector('[data-edition-photo]');
  fig.innerHTML = `<img src="${esc(photo.src)}" alt="${esc(tr(place, 'name'))}" />
    <figcaption><a href="#${esc(place.id)}">${esc(tr(place, 'name'))}</a> — ${esc(t('place.photoCredit', { author: photo.author || '?', license: photo.license || '' }))}</figcaption>`;
  fig.hidden = false;
}

function renderLayers() {
  const box = document.querySelector('[data-layers]');
  box.innerHTML = state.layers
    .map((l) => {
      const count = state.places.filter((p) => p.layer_id === l.id).length;
      return `<label class="layer-row">
        <input type="checkbox" value="${esc(l.id)}" ${state.visible.has(l.id) ? 'checked' : ''} />
        <span class="check" aria-hidden="true"></span>
        ${picto(l.icon, l.color, 20)}
        <span>${esc(tr(l, 'name'))}</span>
        <span class="layer-row__count">${count}</span>
      </label>`;
    })
    .join('');
  box.addEventListener('change', (e) => {
    if (e.target.checked) state.visible.add(e.target.value);
    else state.visible.delete(e.target.value);
    applyFilters();
  });
  document.querySelector('[data-favourites]').addEventListener('change', (e) => {
    state.favouritesOnly = e.target.checked;
    applyFilters();
  });
  const toggle = document.querySelector('[data-layers-toggle]');
  toggle.addEventListener('click', () => {
    const open = layersPanel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

function drawPlaces() {
  for (const place of state.places) {
    const layer = layerOf(place);
    const marker = L.marker([place.lat, place.lng], {
      icon: L.divIcon({
        className: 'marker',
        html: picto(layer.icon, layer.color, 26)
          + (place.favourite ? '<span class="marker__fav"></span>' : '')
          + (isSaved(place) ? '<span class="marker__star" aria-hidden="true">★</span>' : ''),
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
      title: tr(place, 'name') + (isSaved(place) ? ` — ${t('map.saved', { title: state.adventure.title })}` : ''),
      alt: tr(place, 'name'),
      zIndexOffset: isSaved(place) ? 500 : 0,
      keyboard: true,
      riseOnHover: true,
    });
    const lines = (place.path || []).map((coords) =>
      L.polyline(coords, { color: layer.color, weight: layer.id === 'streets' ? 4 : 5, opacity: 0.9, lineCap: 'round' }),
    );
    marker.on('click', () => pin(place));
    marker.on('keypress', (e) => e.originalEvent.key === 'Enter' && pin(place));
    for (const obj of [marker, ...lines]) {
      if (obj !== marker) obj.on('click', () => pin(place));
      if (canHover) {
        obj.on('mouseover', () => preview(place));
        obj.on('mouseout', hidePreview);
      }
    }
    state.objects.set(place.id, { marker, lines });
  }
  applyFilters();
}

function applyFilters() {
  for (const place of state.places) {
    const { marker, lines } = state.objects.get(place.id);
    const on = state.visible.has(place.layer_id)
      && (!state.favouritesOnly || place.favourite)
      && (!state.savedOnly || isSaved(place));
    for (const obj of [marker, ...lines]) {
      if (on && !map.hasLayer(obj)) obj.addTo(map);
      if (!on && map.hasLayer(obj)) obj.remove();
    }
    if (!on && state.pinned === place.id) closeCard();
  }
}

// ---------- Place card ----------

function hoursFacts(place) {
  const clock = parisClock();
  const status = openStatus(place.hours, clock);
  if (status.state === 'open') return [['clock', t('place.open', { time: status.until }), 'is-open']];
  if (status.state === 'closed') {
    const today = hoursForDay(place.hours, clock.weekday);
    return [['clock', today.length ? t('place.opensToday', { hours: today.join(', ') }) : t('place.closedToday')]];
  }
  return [['clock', place.hours_note ? tr(place, 'hours_note') : t('place.hoursUnknown')]];
}

function cardHtml(place) {
  const layer = layerOf(place);
  const photo = place.photos[0];
  const facts = [
    ...hoursFacts(place),
    ...(place.price ? [['ticket', place.price]] : []),
    ...(place.booking_required ? [['calendar', t('place.booking')]] : []),
  ];
  const note = [
    place.hours.length && place.hours_note ? tr(place, 'hours_note') : '',
    place.hours.length && !place.hours_verified ? t('place.hoursUnchecked') : '',
  ].filter(Boolean).join(' ');
  const events = place.events.length
    ? `<div class="place-card__events"><h3>${esc(t('place.onNow'))}</h3><ul>${place.events
        .map((e) => `<li>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}${e.ends_on ? ` <span class="muted">${esc(t('place.until', { date: formatShort(e.ends_on) }))}</span>` : ''}</li>`)
        .join('')}</ul></div>`
    : '';
  return `
    <button class="place-card__close" type="button" data-close aria-label="${esc(t('place.close'))}">${icon('close', { size: 18 })}</button>
    <div class="place-card__inner">
      <div class="place-card__media">
        ${photo
          ? `<div class="place-card__photo"><img src="${esc(photo.src)}" alt="" /></div>
             <p class="place-card__credit">${photo.source_url ? `<a href="${esc(photo.source_url)}" target="_blank" rel="noopener">` : ''}${esc(t('place.photoCredit', { author: photo.author || '?', license: photo.license || '' }))}${photo.source_url ? '</a>' : ''}</p>`
          : `<div class="place-card__photo place-card__photo--empty">${picto(layer.icon, layer.color, 56)}</div>`}
      </div>
      <div class="place-card__body">
        <p class="place-card__layer">${picto(layer.icon, layer.color, 14)} ${esc(tr(layer, 'name'))}</p>
        ${isSaved(place) ? `<p class="place-card__saved"><span class="star" aria-hidden="true">★</span> ${esc(t('place.savedOn', { when: savedWhen(place) }))}</p>` : ''}
        <h2 class="place-card__name">${esc(tr(place, 'name'))}</h2>
        <p class="place-card__summary">${esc(tr(place, 'summary'))}</p>
        <ul class="facts">${facts.map(([ic, label, cls]) => `<li class="${cls || ''}">${icon(ic)}<span>${esc(label)}</span></li>`).join('')}</ul>
        ${note ? `<p class="place-card__note">${esc(note)}</p>` : ''}
        ${place.tip ? `<p class="place-card__tip">${esc(tr(place, 'tip'))}</p>` : ''}
        ${events}
      </div>
      <div class="place-card__actions">
        ${shareToken ? '' : `<button class="btn btn--cta" type="button" data-add-open>${esc(t('place.addTo'))} ${icon('plus')}</button>
        <form class="place-card__add" data-add-form hidden></form>`}
        ${place.website ? `<a class="place-card__website" href="${esc(place.website)}" target="_blank" rel="noopener">${esc(t('place.website'))}</a>` : ''}
      </div>
    </div>`;
}

function render(place, pinned) {
  card.innerHTML = cardHtml(place);
  card.hidden = false;
  card.classList.toggle('is-pinned', pinned);
  card.querySelector('[data-close]').addEventListener('click', closeCard);
  card.querySelector('[data-add-open]')?.addEventListener('click', () => openAddForm(place));
}

function preview(place) {
  if (state.pinned) return; // a selected place stays until it is closed
  render(place, false);
}

function hidePreview() {
  if (!state.pinned) card.hidden = true;
}

function pin(place) {
  state.pinned = place.id;
  for (const { marker } of state.objects.values()) marker.getElement()?.classList.remove('is-active');
  state.objects.get(place.id).marker.getElement()?.classList.add('is-active');
  render(place, true);
  history.replaceState(null, '', `${location.search}#${place.id}`);
}

function closeCard() {
  const id = state.pinned;
  state.pinned = null;
  card.hidden = true;
  if (id) state.objects.get(id)?.marker.getElement()?.classList.remove('is-active');
  history.replaceState(null, '', location.pathname + location.search);
}

function openFromHash() {
  const place = state.places.find((p) => p.id === decodeURIComponent(location.hash.slice(1)));
  if (!place) return;
  map.setView([place.lat, place.lng], Math.max(map.getZoom(), 16));
  pin(place);
}

window.addEventListener('hashchange', openFromHash);
map.on('click', closeCard);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeCard());

// ---------- Add to a day of an adventure ----------

async function openAddForm(place) {
  const form = card.querySelector('[data-add-form]');
  state.adventures ??= await api('/api/adventures').catch(() => []);
  if (!state.adventures.length) {
    form.innerHTML = `<p>${esc(t('place.noAdventure'))} <a href="/adventures">${esc(t('nav.adventures'))}</a></p>`;
    form.hidden = false;
    return;
  }
  const upcoming = state.adventures.filter((a) => a.ends_on >= new Date().toISOString().slice(0, 10));
  const list = upcoming.length ? upcoming : state.adventures;
  form.innerHTML = `
    <div class="row">
      <label>${esc(t('place.chooseAdventure'))}<select name="adventure">${list.map((a) => `<option value="${esc(a.id)}">${esc(a.title)}</option>`).join('')}</select></label>
      <label>${esc(t('place.chooseDay'))}<select name="day"></select></label>
    </div>
    <button class="btn" type="submit">${esc(t('place.add'))}</button>`;
  const fillDays = () => {
    const a = list.find((x) => x.id === form.elements.adventure.value);
    form.elements.day.innerHTML = `<option value="">${esc(t('adventure.ideas'))}</option>` +
      daysBetween(a.starts_on, a.ends_on).map((d, i) => `<option value="${d}">${esc(t('adventure.day', { n: i + 1 }))} · ${esc(formatTab(d))}</option>`).join('');
  };
  form.elements.adventure.addEventListener('change', fillDays);
  fillDays();
  form.hidden = false;
  card.querySelector('[data-add-open]').hidden = true;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const a = list.find((x) => x.id === form.elements.adventure.value);
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api(`/api/adventures/${a.id}/items`, { method: 'POST', body: { place_id: place.id, day: form.elements.day.value || null } });
      toast(t('place.added', { title: a.title }));
      form.hidden = true;
      card.querySelector('[data-add-open]').hidden = false;
    } catch {
      toast(t('error.generic'));
    } finally {
      button.disabled = false;
    }
  };
}
