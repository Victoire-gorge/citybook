import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t, tr, formatTab, formatShort } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { daysBetween } from '../lib/trip.js';
import { starsHtml, GLYPH } from '../lib/stars.js';
import { guestName } from '../lib/guest.js';
import { eventDates, overlapDays, isOnDuring } from '../lib/events.js';

// Two tabs:
// - Anytime: places of the 'activities' layer, also shown on the map;
// - Limited time: dated events (Christmas markets, exhibitions...), most linked to a place.
// Guests arrive with ?share=<token>: no rating, but they can star activities for the shared trip.
startPage();
const shareToken = new URLSearchParams(location.search).get('share');
const shareQs = shareToken ? `?share=${encodeURIComponent(shareToken)}` : '';
mountMasthead('activities', shareToken ? { signedIn: false, readOnly: true, issue: '', shareToken } : {});
let shared = null; // the shared adventure, for guests
let me = '';
let saved = []; // items of the shared adventure that point to a place or an event

const CATEGORIES = ['classic', 'offbeat', 'outdoors', 'food', 'evening', 'daytrip'];
const list = document.querySelector('[data-list]');
const chips = document.querySelector('[data-chips]');
let activities = [];
let adventures = [];
let filter = 'all';
let bestFirst = true; // best rated first by default
let tab = location.hash === '#limited' ? 'limited' : 'anytime';
let events = [];
let places = new Map();
let eventFilter = 'all'; // 'all', 'trip' or a category

function card(a) {
  const photo = a.photos[0];
  const facts = [
    a.duration && ['clock', a.duration],
    a.best_time && ['calendar', a.best_time],
    a.price && ['ticket', a.price],
  ].filter(Boolean);
  const events = (a.events || []).map((e) => `<li>${esc(e.title)} <span class="muted">${esc(eventDates(e))}</span></li>`).join('');
  return `<li class="activity" data-id="${esc(a.id)}">
    <figure class="activity__photo">
      ${photo ? `<img src="${esc(photo.src)}" alt="" loading="lazy" />` : ''}
      ${photo ? `<figcaption>${photo.source_url ? `<a href="${esc(photo.source_url)}" target="_blank" rel="noopener">` : ''}${esc(t('place.photoCredit', { author: photo.author || '?', license: photo.license || '' }))}${photo.source_url ? '</a>' : ''}</figcaption>` : ''}
    </figure>
    <div class="activity__body">
      <div class="activity__tags"><span class="tag">${esc(t(`cat.${a.category}`))}</span>
        ${a.area ? `<span class="tag tag--area">${icon('pin', { size: 12 })} ${esc(a.area)}</span>` : ''}</div>
      <h2 class="activity__title">${esc(tr(a, 'name'))}</h2>
      ${starsHtml(a.rating, { editable: !shareToken, name: tr(a, 'name') })}
      <p class="activity__summary">${esc(tr(a, 'summary'))}</p>
      ${facts.length ? `<ul class="facts activity__facts">${facts.map(([ic, label]) => `<li>${icon(ic, { size: 16 })}<span>${esc(label)}</span></li>`).join('')}</ul>` : ''}
      ${a.hours_note ? `<p class="activity__note">${esc(tr(a, 'hours_note'))}${a.booking_required ? ` · ${esc(t('place.booking'))}` : ''}</p>` : a.booking_required ? `<p class="activity__note">${esc(t('place.booking'))}</p>` : ''}
      ${events ? `<div class="place-card__events"><h3>${esc(t('place.onNow'))}</h3><ul>${events}</ul></div>` : ''}
      <div class="activity__links">
        <a href="/${shareQs}#${esc(a.id)}">${icon('pin', { size: 15 })} ${esc(t('activities.onMap'))}</a>
        ${a.website ? `<a href="${esc(a.website)}" target="_blank" rel="noopener">${esc(t('place.website'))}</a>` : ''}
      </div>
      ${shareToken ? guestStar({ place_id: a.id }) : adventures.length ? addForm(a) : ''}
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
    render();
    list.querySelector(target.event_id ? `[data-star-event="${target.event_id}"]` : `[data-star-place="${target.place_id}"]`)?.focus();
  } catch {
    toast(t('error.generic'));
    button.disabled = false;
  }
}

function addForm(a, ev = null) {
  const first = adventures[0];
  return `<form class="activity__add" data-add ${ev ? `data-event="${esc(ev.id)}"` : ''}>
    <label class="visually-hidden" for="adv-${esc(a.id)}">${esc(t('place.chooseAdventure'))}</label>
    <select id="adv-${esc(a.id)}" name="adventure" ${adventures.length === 1 ? 'hidden' : ''}>
      ${adventures.map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}
    </select>
    <label class="visually-hidden" for="day-${esc(a.id)}">${esc(t('place.chooseDay'))}</label>
    <select id="day-${esc(a.id)}" name="day">${dayOptions(first, ev)}</select>
    <button class="btn btn--small" type="submit">${icon('plus', { size: 15 })} ${esc(t('activities.addTo'))}</button>
  </form>`;
}

/** Days to offer: for a dated event, only the days when it is on (first one preselected). */
function dayOptions(adv, ev = null) {
  const all = daysBetween(adv.starts_on, adv.ends_on);
  const open = ev ? overlapDays(ev, all) : all;
  const offered = open.length ? open : all;
  return `<option value="" ${ev && open.length ? '' : 'selected'}>${esc(t('adventure.ideas'))} · ${esc(adv.title)}</option>` +
    offered
      .map((d, i) => `<option value="${d}" ${ev && open.length && i === 0 ? 'selected' : ''}>${esc(t('adventure.day', { n: all.indexOf(d) + 1 }))} · ${esc(formatTab(d))}</option>`)
      .join('');
}

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
  list.innerHTML = shown.map(eventCard).join('');
  document.querySelector('[data-empty]').hidden = shown.length > 0;
  document.querySelector('[data-count]').textContent = t('activities.countLimited', { n: shown.length });
}

function render() {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelector('[data-subtitle]').textContent = t(tab === 'limited' ? 'activities.limitedSubtitle' : 'activities.subtitle');
  if (tab === 'limited') return renderLimited();
  const areas = [...new Set(activities.map((a) => a.area).filter(Boolean))].sort();
  const shown = filter === 'all' ? [...activities]
    : filter.startsWith('area:') ? activities.filter((a) => a.area === filter.slice(5))
    : activities.filter((a) => a.category === filter);
  if (bestFirst) shown.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  chips.innerHTML = ['all', ...CATEGORIES]
    .map((c) => `<button class="chip" type="button" data-cat="${c}" aria-pressed="${c === filter}">${esc(c === 'all' ? t('activities.all') : t(`cat.${c}`))}</button>`)
    .join('') + areas
    .map((z) => `<button class="chip chip--area" type="button" data-cat="area:${esc(z)}" aria-pressed="${filter === `area:${z}`}">${icon('pin', { size: 13 })} ${esc(z)}</button>`)
    .join('') + `<button class="chip chip--sort" type="button" data-sort aria-pressed="${bestFirst}">${GLYPH} ${esc(t('activities.sortBest'))}</button>`;
  list.innerHTML = shown.map(card).join('');
  document.querySelector('[data-empty]').hidden = shown.length > 0;
  document.querySelector('[data-count]').textContent = t('activities.count', { n: shown.length });
}

document.querySelector('[data-tabs]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  history.replaceState(null, '', tab === 'limited' ? '#limited' : location.pathname);
  render();
});

chips.addEventListener('click', (e) => {
  const ec = e.target.closest('[data-ecat]');
  if (ec) {
    eventFilter = ec.dataset.ecat;
    return render();
  }
  if (e.target.closest('[data-sort]')) {
    bestFirst = !bestFirst;
    return render();
  }
  const chip = e.target.closest('[data-cat]');
  if (!chip) return;
  filter = chip.dataset.cat;
  render();
});

// Rate an activity: clicking the current rating again clears it.
list.addEventListener('click', async (e) => {
  const guest = e.target.closest('[data-star-place], [data-star-event]');
  if (guest) {
    return toggleGuestStar(guest.dataset.starEvent ? { event_id: guest.dataset.starEvent } : { place_id: guest.dataset.starPlace }, guest);
  }
  const star = e.target.closest('[data-rate]');
  if (!star) return;
  const item = star.closest('[data-id]');
  const a = activities.find((x) => x.id === item.dataset.id);
  const n = Number(star.dataset.rate);
  const rating = a.rating === n ? 0 : n;
  try {
    await api(`/api/places/${encodeURIComponent(a.id)}`, { method: 'PATCH', body: { rating } });
    a.rating = rating;
    item.querySelector('.stars').outerHTML = starsHtml(rating, { editable: true, name: tr(a, 'name') });
    item.querySelector(`[data-rate="${rating || n}"]`)?.focus();
    toast(t('rating.saved'));
  } catch {
    toast(t('error.generic'));
  }
});

list.addEventListener('change', (e) => {
  if (e.target.name !== 'adventure') return;
  const adv = adventures.find((x) => x.id === e.target.value);
  const ev = events.find((x) => x.id === e.target.form.dataset.event);
  e.target.form.elements.day.innerHTML = dayOptions(adv, ev);
});

list.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-add]');
  if (!form) return;
  e.preventDefault();
  const ev = events.find((x) => x.id === form.dataset.event);
  const placeId = ev ? ev.place_id : form.closest('[data-id]').dataset.id;
  const adv = adventures.find((x) => x.id === form.elements.adventure.value);
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const body = { day: form.elements.day.value || null };
    if (placeId) body.place_id = placeId;
    if (ev) Object.assign(body, { event_id: ev.id, title: ev.title });
    await api(`/api/adventures/${adv.id}/items`, { method: 'POST', body });
    toast(t('place.added', { title: adv.title }));
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
  const order = Object.fromEntries(CATEGORIES.map((c, i) => [c, i]));
  places = new Map(map.places.map((p) => [p.id, p]));
  events = map.events || [];
  activities = map.places
    .filter((p) => p.layer_id === 'activities')
    .sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9) || a.name.localeCompare(b.name));
  // Upcoming adventures first; past ones are still offered after them.
  const today = new Date().toISOString().slice(0, 10);
  adventures = advs.sort((a, b) => (a.ends_on < today) - (b.ends_on < today) || a.starts_on.localeCompare(b.starts_on));
  render();
}

load().catch(() => {
  list.innerHTML = `<p class="shelf__empty">${esc(t('map.error'))}</p>`;
});
