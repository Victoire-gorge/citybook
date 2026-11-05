import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t, tr, formatTab } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { icon, picto } from '../lib/icons.js';
import { daysBetween, miniMap } from '../lib/trip.js';
import { starsHtml, GLYPH } from '../lib/stars.js';
import { guestName } from '../lib/guest.js';
import { eventDates, overlapDays, isOnDuring } from '../lib/events.js';
import { arrondissementOf, loadArrondissements } from '../lib/arrondissements.js';

// The same places as the map, filed in the right place:
// - Anytime: every place except Home, theatres and seasonal markets, by neighbourhood (default) or by type;
// - Limited time: dated events (Christmas markets, exhibitions...);
// - Theatres: the theatres of the map, by arrondissement.
// Guests arrive with ?share=<token>: no rating, but they can star places for the shared trip.
startPage();
const shareToken = new URLSearchParams(location.search).get('share');
const shareQs = shareToken ? `?share=${encodeURIComponent(shareToken)}` : '';
mountMasthead('activities', shareToken ? { signedIn: false, readOnly: true, issue: '', shareToken } : {});
let shared = null; // the shared adventure, for guests
let me = '';
let saved = []; // items of the shared adventure that point to a place or an event

const HIDDEN_LAYERS = new Set(['home', 'seasonal', 'theatres']);
const SHOWN_PER_HOOD = 6; // cards shown before "Show more" in a neighbourhood
const list = document.querySelector('[data-list]');
const chips = document.querySelector('[data-chips]');
const views = document.querySelector('[data-views]');
const jump = document.querySelector('[data-jump]');
let pool = []; // places listed in Anytime
let theatres = [];
let layers = [];
let adventures = [];
let events = [];
let places = new Map();
let areas = []; // neighbourhoods, with a suggested walk
let tab = 'anytime';
let view = 'area'; // 'area' or 'type'
let typeFilter = 'all'; // 'all' or a layer id
let eventFilter = 'all'; // 'all', 'trip' or a category
let theatreQuery = '';
const opened = new Set(); // neighbourhoods / types whose full list is shown

try { view = localStorage.getItem('citybook.activities.view') === 'type' ? 'type' : 'area'; } catch { /* default */ }

const layerOf = (p) => layers.find((l) => l.id === p.layer_id);
const byRating = (a, b) => (b.rating || 0) - (a.rating || 0) || Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name);
const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

// ---------- Cards ----------

function card(p, { showArea = false } = {}) {
  const photo = p.photos[0];
  const layer = layerOf(p);
  const facts = [
    p.duration && ['clock', p.duration],
    p.best_time && ['calendar', p.best_time],
    p.price && ['ticket', p.price],
  ].filter(Boolean);
  const evs = (p.events || []).map((e) => `<li>${esc(e.title)} <span class="muted">${esc(eventDates(e))}</span></li>`).join('');
  return `<li class="activity" data-id="${esc(p.id)}">
    <figure class="activity__photo ${photo ? '' : 'activity__photo--blank'}">
      ${photo ? `<img src="${esc(photo.src)}" alt="" loading="lazy" />` : picto(layer?.icon, layer?.color, 44)}
      ${photo ? `<figcaption>${photo.source_url ? `<a href="${esc(photo.source_url)}" target="_blank" rel="noopener">` : ''}${esc(t('place.photoCredit', { author: photo.author || '?', license: photo.license || '' }))}${photo.source_url ? '</a>' : ''}</figcaption>` : ''}
      ${p.favourite ? `<span class="activity__fav" title="${esc(t('map.favourites'))}">♥</span>` : ''}
    </figure>
    <div class="activity__body">
      <div class="activity__tags">
        <span class="tag tag--type">${picto(layer?.icon, layer?.color, 13)} ${esc(tr(layer || {}, 'name'))}</span>
        ${p.category ? `<span class="tag">${esc(t(`cat.${p.category}`))}</span>` : ''}
        ${showArea && p.area ? `<span class="tag tag--area">${icon('pin', { size: 12 })} ${esc(p.area)}</span>` : ''}
      </div>
      <h2 class="activity__title">${esc(tr(p, 'name'))}</h2>
      ${starsHtml(p.rating, { editable: !shareToken, name: tr(p, 'name') })}
      <p class="activity__summary">${esc(tr(p, 'summary'))}</p>
      ${p.tip ? `<p class="activity__tip">${esc(tr(p, 'tip'))}</p>` : ''}
      ${facts.length ? `<ul class="facts activity__facts">${facts.map(([ic, label]) => `<li>${icon(ic, { size: 16 })}<span>${esc(label)}</span></li>`).join('')}</ul>` : ''}
      ${p.hours_note ? `<p class="activity__note">${esc(tr(p, 'hours_note'))}${p.booking_required ? ` · ${esc(t('place.booking'))}` : ''}</p>` : p.booking_required ? `<p class="activity__note">${esc(t('place.booking'))}</p>` : ''}
      ${evs ? `<div class="place-card__events"><h3>${esc(t('place.onNow'))}</h3><ul>${evs}</ul></div>` : ''}
      <div class="activity__links">
        <a href="/${shareQs}#${esc(p.id)}">${icon('pin', { size: 15 })} ${esc(t('activities.onMap'))}</a>
        ${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(t(p.layer_id === 'theatres' ? 'place.programme' : 'place.website'))}</a>` : ''}
      </div>
      ${shareToken ? guestStar({ place_id: p.id }) : adventures.length ? addForm(p) : ''}
    </div>
  </li>`;
}

// ---------- Guests: ★ = in the shared trip ----------

const savedFor = ({ place_id, event_id }) =>
  saved.filter((i) => (event_id ? i.event_id === event_id : i.place_id === place_id && !i.event_id));

function guestStar(target) {
  const items = savedFor(target);
  const mine = items.filter((i) => i.added_by === me);
  const key = target.event_id ? `data-star-event="${esc(target.event_id)}"` : `data-star-place="${esc(target.place_id)}"`;
  if (items.length && !mine.length) {
    const by = [...new Set(items.map((i) => i.added_by).filter(Boolean))];
    return `<p class="activity__saved"><span class="star" aria-hidden="true">★</span> ${esc(t('activities.inPlan', { title: shared.title }))}${by.length ? ` · ${esc(t('share.suggestedBy', { name: by.join(', ') }))}` : ''}</p>`;
  }
  const on = mine.length > 0;
  return `<button class="btn btn--small ${on ? 'btn--line' : ''} activity__star" type="button" ${key} aria-pressed="${on}">
    <span class="star" aria-hidden="true">★</span> ${esc(t(on ? 'map.unstar' : 'map.star'))}</button>`;
}

async function toggleGuestStar(target, button) {
  const base = `/api/share/${encodeURIComponent(shareToken)}/items`;
  const mine = savedFor(target).filter((i) => i.added_by === me);
  button.disabled = true;
  try {
    if (mine.length) {
      for (const item of mine) {
        const res = await fetch(`${base}/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
      }
      saved = saved.filter((i) => !mine.includes(i));
      toast(t('map.unstarred'));
    } else {
      const res = await fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, by: me }),
      });
      if (!res.ok) throw new Error();
      const item = await res.json();
      if (!item.existed) saved.push({ id: item.id, place_id: target.place_id ?? null, event_id: target.event_id ?? null, day: null, added_by: item.added_by });
      toast(t('map.starred'));
    }
    const y = scrollY;
    render();
    scrollTo(0, y);
    list.querySelector(target.event_id ? `[data-star-event="${target.event_id}"]` : `[data-star-place="${target.place_id}"]`)?.focus({ preventScroll: true });
  } catch {
    toast(t('error.generic'));
    button.disabled = false;
  }
}

// ---------- Adding to an adventure ----------

function addForm(p, ev = null) {
  const first = adventures[0];
  const id = ev ? ev.id : p.id;
  return `<form class="activity__add" data-add ${ev ? `data-event="${esc(ev.id)}"` : ''}>
    <label class="visually-hidden" for="adv-${esc(id)}">${esc(t('place.chooseAdventure'))}</label>
    <select id="adv-${esc(id)}" name="adventure" ${adventures.length === 1 ? 'hidden' : ''}>
      ${adventures.map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}
    </select>
    <label class="visually-hidden" for="day-${esc(id)}">${esc(t('place.chooseDay'))}</label>
    <select id="day-${esc(id)}" name="day">${dayOptions(first, ev)}</select>
    <button class="btn btn--small" type="submit">${icon('plus', { size: 15 })} ${esc(t('activities.addTo'))}</button>
  </form>`;
}

/** Days to offer: for a dated event, only the days when it is on (first one preselected). */
function dayOptions(adv, ev = null, { ideas = true } = {}) {
  const all = daysBetween(adv.starts_on, adv.ends_on);
  const open = ev ? overlapDays(ev, all) : all;
  const offered = open.length ? open : all;
  return (ideas ? `<option value="" ${ev && open.length ? '' : 'selected'}>${esc(t('adventure.ideas'))} · ${esc(adv.title)}</option>` : '') +
    offered
      .map((d, i) => {
        const hood = adv.day_areas?.[d];
        return `<option value="${d}" ${ev && open.length && i === 0 ? 'selected' : ''}>${esc(t('adventure.day', { n: all.indexOf(d) + 1 }))} · ${esc(formatTab(d))}${hood ? ` · ${esc(hood)}` : ''}</option>`;
      })
      .join('');
}

// ---------- Neighbourhoods ----------

const membersOf = (z) => pool.filter((p) => p.area === z.name);
const walkOf = (z) => z.route.map((id) => places.get(id)).filter(Boolean);
const passType = (p) => typeFilter === 'all' || p.layer_id === typeFilter;

function hoodHead(z, members) {
  const walk = walkOf(z);
  const cover = places.get(z.cover_place_id)?.photos[0] || members.find((a) => a.photos[0])?.photos[0];
  return `<div class="area-card">
    <div class="area-card__main">
      <figure class="area-card__photo">${cover ? `<img src="${esc(cover.src)}" alt="" loading="lazy" />
        <figcaption>${esc(t('place.photoCredit', { author: cover.author || '?', license: cover.license || '' }))}</figcaption>` : ''}</figure>
      <div class="area-card__body">
        <span class="tag tag--area">${icon('pin', { size: 12 })} ${esc(t('activities.neighbourhood'))}</span>
        <h2 class="area-card__title">${esc(tr(z, 'name'))}</h2>
        <p class="activity__summary">${esc(tr(z, 'summary'))}</p>
        <ul class="facts activity__facts">
          ${z.duration ? `<li>${icon('clock', { size: 16 })}<span>${esc(z.duration)}</span></li>` : ''}
          ${z.best_time ? `<li>${icon('calendar', { size: 16 })}<span>${esc(z.best_time)}</span></li>` : ''}
          <li>${icon('sparkle', { size: 16 })}<span>${esc(t('activities.thingsToDo', { n: members.length }))}</span></li>
        </ul>
        <div class="area-card__actions">
          <a class="btn btn--line btn--small" href="/${shareQs}${shareQs ? '&' : '?'}area=${encodeURIComponent(z.name)}">${icon('pin', { size: 15 })} ${esc(t('activities.areaOnMap'))}</a>
          ${!shareToken && adventures.length ? planForm(z) : ''}
        </div>
      </div>
    </div>
    ${walk.length ? `<div class="area-card__walk">
      <div>
        <h3 class="area-card__subtitle">${esc(t('activities.walk'))}</h3>
        <ol class="area-walk">${walk.map((p) => `<li><a href="#${esc(p.id)}" data-jump-to="${esc(p.id)}">${esc(tr(p, 'name'))}</a>${starsHtml(p.rating)}</li>`).join('')}</ol>
      </div>
      <div class="mini-map area-card__map" data-area-map="${esc(z.name)}"></div>
    </div>` : ''}
  </div>`;
}

/** Owner: give a day of an adventure to this neighbourhood, and optionally add its walk to that day. */
function planForm(z) {
  const first = adventures[0];
  return `<form class="activity__add area-plan" data-plan-area="${esc(z.name)}">
    <select name="adventure" aria-label="${esc(t('place.chooseAdventure'))}" ${adventures.length === 1 ? 'hidden' : ''}>
      ${adventures.map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}
    </select>
    <select name="day" aria-label="${esc(t('place.chooseDay'))}">${dayOptions(first, null, { ideas: false })}</select>
    <button class="btn btn--small" type="submit">${icon('calendarAdd', { size: 15 })} ${esc(t('activities.planDay'))}</button>
    ${walkOf(z).length ? `<label class="area-plan__walk"><input type="checkbox" name="walk" /> ${esc(t('activities.withWalk'))}</label>` : ''}
  </form>`;
}

function section({ key, head, items, title, count }) {
  const open = opened.has(key);
  const shown = open ? items : items.slice(0, SHOWN_PER_HOOD);
  const more = items.length - shown.length;
  return `<section class="hood" id="${esc(key)}">
    ${head || `<h2 class="hood__title">${title}<span class="hood__count mono">${esc(count)}</span></h2>`}
    <ul class="activity-grid">${shown.map((p) => card(p, { showArea: view === 'type' })).join('')}</ul>
    ${more > 0 ? `<button class="btn btn--line hood__more" type="button" data-more="${esc(key)}">${esc(t('activities.showMore', { n: more }))} ${icon('arrowDown', { size: 15 })}</button>` : ''}
    ${open && items.length > SHOWN_PER_HOOD ? `<button class="link-button hood__less" type="button" data-less="${esc(key)}">${esc(t('activities.showLess'))}</button>` : ''}
  </section>`;
}

function renderByArea() {
  const groups = areas
    .map((z) => ({ z, items: membersOf(z).filter(passType).sort(byRating), all: membersOf(z) }))
    .filter((g) => g.items.length);
  const rest = pool.filter((p) => !p.area || !areas.some((z) => z.name === p.area)).filter(passType).sort(byRating);
  jump.innerHTML = groups.map((g) => `<a href="#hood-${esc(g.z.id)}">${esc(tr(g.z, 'name'))}</a>`).join('') +
    (rest.length ? `<a href="#hood-elsewhere">${esc(t('activities.elsewhere'))}</a>` : '');
  jump.hidden = false;
  return groups.map((g) => section({ key: `hood-${g.z.id}`, head: hoodHead(g.z, g.all), items: g.items })).join('') +
    (rest.length ? section({ key: 'hood-elsewhere', title: esc(t('activities.elsewhere')), count: t('activities.count', { n: rest.length }), items: rest }) : '');
}

function renderByType() {
  jump.hidden = true;
  return layers
    .filter((l) => !HIDDEN_LAYERS.has(l.id) && (typeFilter === 'all' || l.id === typeFilter))
    .map((l) => ({ l, items: pool.filter((p) => p.layer_id === l.id).sort(byRating) }))
    .filter((g) => g.items.length)
    .map((g) => section({ key: `type-${g.l.id}`, title: `${picto(g.l.icon, g.l.color, 26)} ${esc(tr(g.l, 'name'))}`, count: t('activities.count', { n: g.items.length }), items: g.items }))
    .join('');
}

function drawAreaMaps() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const z = areas.find((x) => x.name === e.target.dataset.areaMap);
      miniMap(e.target)(walkOf(z).map((p) => ({ lat: p.lat, lng: p.lng, title: tr(p, 'name') })));
    }
  }, { rootMargin: '300px' });
  list.querySelectorAll('[data-area-map]').forEach((el) => io.observe(el));
}

// ---------- Limited time ----------

const nextTrip = () => shared || adventures.find((a) => a.ends_on >= new Date().toISOString().slice(0, 10));

function eventCard(e) {
  const place = e.place_id ? places.get(e.place_id) : null;
  const photo = place?.photos[0];
  const trip = nextTrip();
  const on = trip && isOnDuring(e, trip);
  const id = e.place_id || e.id;
  return `<li class="activity activity--event" data-id="${esc(id)}" data-event-id="${esc(e.id)}">
    <figure class="activity__photo ${photo ? '' : 'activity__photo--blank'}">
      ${photo ? `<img src="${esc(photo.src)}" alt="" loading="lazy" />` : `<span class="activity__date-big">${esc(eventDates(e) || t('activities.noDates'))}</span>`}
      ${photo ? `<figcaption>${esc(t('place.photoCredit', { author: photo.author || '?', license: photo.license || '' }))}</figcaption>` : ''}
    </figure>
    <div class="activity__body">
      <div class="activity__tags"><span class="tag">${esc(t(`cat.${e.category || 'festival'}`))}</span>
        ${on ? `<span class="tag tag--now">★ ${esc(t('activities.onDuring', { title: trip.title }))}</span>` : ''}</div>
      <h2 class="activity__title">${esc(tr(e, 'title'))}</h2>
      <p class="activity__when">${icon('calendar', { size: 16 })} ${esc(eventDates(e) || t('activities.noDates'))}</p>
      ${e.date_note && (e.starts_on || e.ends_on) ? `<p class="activity__note">${esc(e.date_note)}</p>` : ''}
      ${e.summary ? `<p class="activity__summary">${esc(tr(e, 'summary'))}</p>` : ''}
      ${place ? `<p class="activity__note">${icon('pin', { size: 14 })} ${esc(tr(place, 'name'))}</p>` : ''}
      <div class="activity__links">
        ${place ? `<a href="/${shareQs}#${esc(place.id)}">${icon('pin', { size: 15 })} ${esc(t('activities.onMap'))}</a>` : ''}
        ${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(t('place.website'))}</a>` : ''}
      </div>
      ${shareToken ? guestStar({ event_id: e.id }) : adventures.length ? addForm({ id: e.id }, e) : ''}
    </div>
  </li>`;
}

function renderLimited() {
  const trip = nextTrip();
  const cats = [...new Set(events.map((e) => e.category).filter(Boolean))];
  const shown = events.filter((e) => eventFilter === 'all' || (eventFilter === 'trip' ? trip && isOnDuring(e, trip) : e.category === eventFilter));
  chips.innerHTML = ['all', ...(trip ? ['trip'] : []), ...cats]
    .map((c) => `<button class="chip" type="button" data-ecat="${c}" aria-pressed="${c === eventFilter}">${esc(c === 'all' ? t('activities.all') : c === 'trip' ? `★ ${t('activities.during', { title: trip.title })}` : t(`cat.${c}`))}</button>`)
    .join('');
  list.innerHTML = `<ul class="activity-grid">${shown.map(eventCard).join('')}</ul>`;
  document.querySelector('[data-empty]').hidden = shown.length > 0;
  document.querySelector('[data-count]').textContent = t('activities.countLimited', { n: shown.length });
}

// ---------- Theatres, by arrondissement ----------

function theatreRow(p) {
  const photo = p.photos[0];
  return `<li class="theatre" data-id="${esc(p.id)}">
    ${photo ? `<img class="theatre__photo" src="${esc(photo.src)}" alt="" loading="lazy" />` : `<span class="theatre__photo theatre__photo--blank">${picto('curtain', layerOf(p)?.color || '#7d4a63', 22)}</span>`}
    <div class="theatre__body">
      <h3 class="theatre__name">${esc(tr(p, 'name'))}</h3>
      ${p.address ? `<p class="theatre__address">${esc(p.address)}</p>` : ''}
      ${starsHtml(p.rating, { editable: !shareToken, name: tr(p, 'name') })}
    </div>
    <div class="theatre__links">
      ${p.website ? `<a class="btn btn--small" href="${esc(p.website)}" target="_blank" rel="noopener">${icon('ticket', { size: 15 })} ${esc(t('place.programme'))}</a>` : ''}
      <a href="/${shareQs}#${esc(p.id)}">${icon('pin', { size: 15 })} ${esc(t('activities.onMap'))}</a>
    </div>
    <div class="theatre__add">${shareToken ? guestStar({ place_id: p.id }) : adventures.length ? addForm(p) : ''}</div>
  </li>`;
}

function renderTheatres() {
  const q = theatreQuery.trim().toLowerCase();
  const shown = theatres.filter((p) => !q || `${p.name} ${p.address || ''}`.toLowerCase().includes(q));
  const groups = new Map();
  for (const p of shown) {
    const n = p.arrondissement || 99;
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push(p);
  }
  chips.innerHTML = `<label class="theatre-search"><span class="visually-hidden">${esc(t('activities.searchTheatres'))}</span>
    <input type="search" data-theatre-search value="${esc(theatreQuery)}" placeholder="${esc(t('activities.searchTheatres'))}" /></label>`;
  list.innerHTML = [...groups.entries()].sort((a, b) => a[0] - b[0])
    .map(([n, items]) => `<section class="hood" id="arr-${n}">
      <h2 class="hood__title">${n === 99 ? esc(t('activities.outsideParis')) : esc(t('activities.arrondissement', { n: ordinal(n) }))}<span class="hood__count mono">${esc(t('activities.theatresCount', { n: items.length }))}</span></h2>
      <ul class="theatre-list">${items.sort(byRating).map(theatreRow).join('')}</ul>
    </section>`).join('');
  document.querySelector('[data-empty]').hidden = shown.length > 0;
  document.querySelector('[data-count]').textContent = t('activities.theatresCount', { n: shown.length });
}

// ---------- Page ----------

function render() {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelector('[data-subtitle]').textContent = t(`activities.${tab}Subtitle`);
  views.hidden = tab !== 'anytime';
  jump.hidden = true;
  if (tab === 'limited') return renderLimited();
  if (tab === 'theatres') return renderTheatres();
  views.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  const types = layers.filter((l) => !HIDDEN_LAYERS.has(l.id) && pool.some((p) => p.layer_id === l.id));
  chips.innerHTML = [{ id: 'all' }, ...types]
    .map((l) => `<button class="chip" type="button" data-type="${esc(l.id)}" aria-pressed="${l.id === typeFilter}">${l.id === 'all' ? esc(t('activities.all')) : `${picto(l.icon, typeFilter === l.id ? '#fff' : l.color, 14)} ${esc(tr(l, 'name'))}`}</button>`)
    .join('');
  list.innerHTML = view === 'area' ? renderByArea() : renderByType();
  drawAreaMaps();
  const n = pool.filter(passType).length;
  document.querySelector('[data-empty]').hidden = n > 0;
  document.querySelector('[data-count]').textContent = t('activities.count', { n });
}

function setTab(next) {
  tab = next;
  history.replaceState(null, '', location.pathname + location.search + (tab === 'anytime' ? '' : `#${tab}`));
  render();
}

document.querySelector('[data-tabs]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});

views.addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  view = b.dataset.view;
  try { localStorage.setItem('citybook.activities.view', view); } catch { /* not remembered */ }
  render();
});

chips.addEventListener('click', (e) => {
  const ec = e.target.closest('[data-ecat]');
  if (ec) {
    eventFilter = ec.dataset.ecat;
    return render();
  }
  const chip = e.target.closest('[data-type]');
  if (!chip) return;
  typeFilter = chip.dataset.type;
  render();
});

chips.addEventListener('input', (e) => {
  if (!e.target.matches('[data-theatre-search]')) return;
  theatreQuery = e.target.value;
  const pos = e.target.selectionStart;
  renderTheatres();
  const input = chips.querySelector('[data-theatre-search]');
  input.focus();
  input.setSelectionRange(pos, pos);
});

/** Show a place wherever it is filed (tab, neighbourhood, collapsed list), then flash it. */
function reveal(id) {
  const p = places.get(id);
  if (!p) return;
  if (p.layer_id === 'theatres') {
    tab = 'theatres';
    theatreQuery = '';
  } else if (pool.includes(p)) {
    tab = 'anytime';
    typeFilter = 'all';
    const z = areas.find((x) => x.name === p.area);
    opened.add(view === 'area' ? (z ? `hood-${z.id}` : 'hood-elsewhere') : `type-${p.layer_id}`);
  } else return;
  render();
  const el = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.classList.add('is-flash');
}

list.addEventListener('click', async (e) => {
  const more = e.target.closest('[data-more]');
  if (more) {
    opened.add(more.dataset.more);
    const y = scrollY;
    render();
    return scrollTo(0, y);
  }
  const less = e.target.closest('[data-less]');
  if (less) {
    opened.delete(less.dataset.less);
    render();
    return document.getElementById(less.dataset.less)?.scrollIntoView({ block: 'start' });
  }
  const to = e.target.closest('[data-jump-to]');
  if (to) {
    e.preventDefault();
    return reveal(to.dataset.jumpTo);
  }
  const guest = e.target.closest('[data-star-place], [data-star-event]');
  if (guest) {
    return toggleGuestStar(guest.dataset.starEvent ? { event_id: guest.dataset.starEvent } : { place_id: guest.dataset.starPlace }, guest);
  }
  // Rate a place: clicking the current rating again clears it.
  const star = e.target.closest('[data-rate]');
  if (!star) return;
  const item = star.closest('[data-id]');
  const p = places.get(item.dataset.id);
  const n = Number(star.dataset.rate);
  const rating = p.rating === n ? 0 : n;
  try {
    await api(`/api/places/${encodeURIComponent(p.id)}`, { method: 'PATCH', body: { rating } });
    p.rating = rating;
    item.querySelector('.stars').outerHTML = starsHtml(rating, { editable: true, name: tr(p, 'name') });
    item.querySelector(`[data-rate="${rating || n}"]`)?.focus();
    toast(t('rating.saved'));
  } catch {
    toast(t('error.generic'));
  }
});

list.addEventListener('change', (e) => {
  if (e.target.name !== 'adventure') return;
  const adv = adventures.find((x) => x.id === e.target.value);
  const form = e.target.form;
  const ev = events.find((x) => x.id === form.dataset.event);
  form.elements.day.innerHTML = dayOptions(adv, ev, { ideas: !form.dataset.planArea });
});

list.addEventListener('submit', async (e) => {
  const form = e.target.closest('form');
  if (!form) return;
  e.preventDefault();
  const adv = adventures.find((x) => x.id === form.elements.adventure.value);
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    if (form.dataset.planArea) {
      // A day in this neighbourhood: its places show on that day's map; the walk can be added too.
      const z = areas.find((x) => x.name === form.dataset.planArea);
      const day = form.elements.day.value;
      await api(`/api/adventures/${adv.id}/days/${day}`, { method: 'PUT', body: { area: z.name } });
      adv.day_areas = { ...adv.day_areas, [day]: z.name };
      if (form.elements.walk?.checked) {
        for (const p of walkOf(z)) await api(`/api/adventures/${adv.id}/items`, { method: 'POST', body: { day, place_id: p.id } });
      }
      toast(t('activities.dayPlanned', { area: z.name, day: formatTab(day) }));
    } else {
      const ev = events.find((x) => x.id === form.dataset.event);
      const placeId = ev ? ev.place_id : form.closest('[data-id]').dataset.id;
      const body = { day: form.elements.day.value || null };
      if (placeId) body.place_id = placeId;
      if (ev) Object.assign(body, { event_id: ev.id, title: ev.title });
      await api(`/api/adventures/${adv.id}/items`, { method: 'POST', body });
      toast(t('place.added', { title: adv.title }));
    }
  } catch {
    toast(t('error.generic'));
  } finally {
    button.disabled = false;
  }
});

async function load() {
  let map;
  let advs = [];
  if (shareToken) {
    const res = await fetch(`/api/share/${encodeURIComponent(shareToken)}/map`);
    if (!res.ok) throw new Error('Unknown link');
    map = await res.json();
    shared = map.adventure;
    me = guestName(shared, shared.owner);
    saved = map.saved;
    const help = document.querySelector('[data-guest-help]');
    help.textContent = t('activities.guestHelp', { title: shared.title });
    help.hidden = false;
  } else {
    [map, advs] = await Promise.all([api('/api/map/paris'), api('/api/adventures').catch(() => [])]);
  }
  places = new Map(map.places.map((p) => [p.id, p]));
  layers = map.layers;
  events = map.events || [];
  areas = map.areas || [];
  pool = map.places.filter((p) => !HIDDEN_LAYERS.has(p.layer_id));
  theatres = map.places.filter((p) => p.layer_id === 'theatres');
  // Upcoming adventures first; past ones are still offered after them.
  const today = new Date().toISOString().slice(0, 10);
  const full = await Promise.all(advs.map((a) => (a.ends_on >= today ? api(`/api/adventures/${a.id}`).catch(() => a) : a)));
  adventures = full.sort((a, b) => (a.ends_on < today) - (b.ends_on < today) || a.starts_on.localeCompare(b.starts_on));
  await loadArrondissements();
  for (const p of theatres) p.arrondissement = arrondissementOf(p.lat, p.lng);
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash === 'limited' || hash === 'theatres') tab = hash;
  render();
  if (hash && places.has(hash)) reveal(hash);
}

window.addEventListener('hashchange', () => {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash === 'limited' || hash === 'theatres') {
    tab = hash;
    render();
  } else if (places.has(hash)) reveal(hash);
});

load().catch(() => {
  list.innerHTML = `<p class="shelf__empty">${esc(t('map.error'))}</p>`;
});
