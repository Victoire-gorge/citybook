import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t, tr, formatTab, formatShort } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { daysBetween } from '../lib/trip.js';
import { starsHtml } from '../lib/stars.js';

// Activities are places of the 'activities' layer: shown here as a catalogue,
// and on the map like any other place.
startPage();
mountMasthead('activities');

const CATEGORIES = ['classic', 'offbeat', 'outdoors', 'food', 'evening', 'daytrip'];
const list = document.querySelector('[data-list]');
const chips = document.querySelector('[data-chips]');
let activities = [];
let adventures = [];
let filter = 'all';
let bestFirst = false;

function card(a) {
  const photo = a.photos[0];
  const facts = [
    a.duration && ['clock', a.duration],
    a.best_time && ['calendar', a.best_time],
    a.price && ['ticket', a.price],
  ].filter(Boolean);
  const events = (a.events || []).map((e) => `<li>${esc(e.title)}${e.ends_on ? ` <span class="muted">${esc(t('place.until', { date: formatShort(e.ends_on) }))}</span>` : ''}</li>`).join('');
  return `<li class="activity" data-id="${esc(a.id)}">
    <figure class="activity__photo">
      ${photo ? `<img src="${esc(photo.src)}" alt="" loading="lazy" />` : ''}
      ${photo ? `<figcaption>${photo.source_url ? `<a href="${esc(photo.source_url)}" target="_blank" rel="noopener">` : ''}${esc(t('place.photoCredit', { author: photo.author || '?', license: photo.license || '' }))}${photo.source_url ? '</a>' : ''}</figcaption>` : ''}
    </figure>
    <div class="activity__body">
      <span class="tag">${esc(t(`cat.${a.category}`))}</span>
      <h2 class="activity__title">${esc(tr(a, 'name'))}</h2>
      ${starsHtml(a.rating, { editable: true, name: tr(a, 'name') })}
      <p class="activity__summary">${esc(tr(a, 'summary'))}</p>
      ${facts.length ? `<ul class="facts activity__facts">${facts.map(([ic, label]) => `<li>${icon(ic, { size: 16 })}<span>${esc(label)}</span></li>`).join('')}</ul>` : ''}
      ${a.hours_note ? `<p class="activity__note">${esc(tr(a, 'hours_note'))}${a.booking_required ? ` · ${esc(t('place.booking'))}` : ''}</p>` : a.booking_required ? `<p class="activity__note">${esc(t('place.booking'))}</p>` : ''}
      ${events ? `<div class="place-card__events"><h3>${esc(t('place.onNow'))}</h3><ul>${events}</ul></div>` : ''}
      <div class="activity__links">
        <a href="/#${esc(a.id)}">${icon('pin', { size: 15 })} ${esc(t('activities.onMap'))}</a>
        ${a.website ? `<a href="${esc(a.website)}" target="_blank" rel="noopener">${esc(t('place.website'))}</a>` : ''}
      </div>
      ${adventures.length ? addForm(a) : ''}
    </div>
  </li>`;
}

function addForm(a) {
  const first = adventures[0];
  return `<form class="activity__add" data-add>
    <label class="visually-hidden" for="adv-${esc(a.id)}">${esc(t('place.chooseAdventure'))}</label>
    <select id="adv-${esc(a.id)}" name="adventure" ${adventures.length === 1 ? 'hidden' : ''}>
      ${adventures.map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}
    </select>
    <label class="visually-hidden" for="day-${esc(a.id)}">${esc(t('place.chooseDay'))}</label>
    <select id="day-${esc(a.id)}" name="day">${dayOptions(first)}</select>
    <button class="btn btn--small" type="submit">${icon('plus', { size: 15 })} ${esc(t('activities.addTo'))}</button>
  </form>`;
}

function dayOptions(adv) {
  return `<option value="">${esc(t('adventure.ideas'))} · ${esc(adv.title)}</option>` +
    daysBetween(adv.starts_on, adv.ends_on)
      .map((d, i) => `<option value="${d}">${esc(t('adventure.day', { n: i + 1 }))} · ${esc(formatTab(d))}</option>`)
      .join('');
}

function render() {
  const shown = (filter === 'all' ? [...activities] : activities.filter((a) => a.category === filter));
  if (bestFirst) shown.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  chips.innerHTML = ['all', ...CATEGORIES]
    .map((c) => `<button class="chip" type="button" data-cat="${c}" aria-pressed="${c === filter}">${esc(c === 'all' ? t('activities.all') : t(`cat.${c}`))}</button>`)
    .join('') + `<button class="chip chip--sort" type="button" data-sort aria-pressed="${bestFirst}">★ ${esc(t('activities.sortBest'))}</button>`;
  list.innerHTML = shown.map(card).join('');
  document.querySelector('[data-empty]').hidden = shown.length > 0;
  document.querySelector('[data-count]').textContent = t('activities.count', { n: shown.length });
}

chips.addEventListener('click', (e) => {
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
  e.target.form.elements.day.innerHTML = dayOptions(adv);
});

list.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-add]');
  if (!form) return;
  e.preventDefault();
  const placeId = form.closest('[data-id]').dataset.id;
  const adv = adventures.find((x) => x.id === form.elements.adventure.value);
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await api(`/api/adventures/${adv.id}/items`, { method: 'POST', body: { place_id: placeId, day: form.elements.day.value || null } });
    toast(t('place.added', { title: adv.title }));
  } catch {
    toast(t('error.generic'));
  } finally {
    button.disabled = false;
  }
});

async function load() {
  const [map, advs] = await Promise.all([api('/api/map/paris'), api('/api/adventures').catch(() => [])]);
  const order = Object.fromEntries(CATEGORIES.map((c, i) => [c, i]));
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
