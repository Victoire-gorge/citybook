import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { t, setLanguage, formatRange, formatTab } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { guestName, setGuestName, guestPicker } from '../lib/guest.js';
import { forecast, hourlyForecast, hourlyStrip, weatherLine, weatherCredit } from '../lib/weather.js';
let weather = new Map();
let hourly = new Map();
let focusDay = null; // the day shown in "Day by day": its plan, map and hour-by-hour weather move together
let city = { places: [], layers: [], areas: [] };
const HIDDEN = new Set(['home', 'seasonal', 'theatres']);
import { icon } from '../lib/icons.js';
import { daysBetween, itemsOf, dayMap } from '../lib/trip.js';
import { picto } from '../lib/icons.js';

// Page for guests: no sign-in. They read the plan and can add suggestions,
// and remove only the suggestions made through the link.
startPage();
const root = document.querySelector('[data-trip]');
const token = new URLSearchParams(location.search).get('t') || '';
const shareApi = `/api/share/${encodeURIComponent(token)}`;
let adventure;
let me = '';

function stopHtml(item) {
  const name = item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title);
  const practical = [item.price, item.website ? `<a href="${esc(item.website)}" target="_blank" rel="noopener">${esc(t('place.website'))}</a>` : '']
    .filter(Boolean).join(' · ');
  const mine = item.added_by && item.added_by === me;
  return `<li class="todo todo--read ${item.done ? 'is-done' : ''} ${item.added_by ? 'is-suggestion' : ''}">
    <span class="todo__box" aria-hidden="true"></span>
    <div class="todo__text">
      <p>${name}${item.start_time ? ` <span class="todo__time">(${esc(item.start_time)})</span>` : ''}
        ${item.added_by ? `<span class="suggested">★ ${esc(t('share.suggestedBy', { name: item.added_by }))}</span>` : ''}
        ${mine ? `<button class="link-button todo__unsuggest" type="button" data-unsuggest="${esc(item.id)}">${esc(t('share.removeSuggestion'))}</button>` : ''}</p>
      ${item.summary ? `<p class="todo__summary">${esc(item.summary)}</p>` : ''}
      ${item.day && !daysBetween(adventure.starts_on, adventure.ends_on).includes(item.day) ? `<p><span class="tag tag--off">${esc(t('adventure.outside', { date: formatTab(item.day) }))}</span></p>` : ''}
      ${item.note ? `<p class="todo__note">${esc(item.note)}</p>` : ''}
      ${practical ? `<p class="todo__practical">${practical}</p>` : ''}
    </div>
  </li>`;
}

const suggestForm = (day) => `<form class="suggest" data-suggest="${day}">
    <input name="title" maxlength="200" placeholder="${esc(t('share.suggestPlaceholder'))}" aria-label="${esc(t('share.suggest'))}" />
    <button class="btn btn--line btn--small" type="submit">${icon('plus', { size: 15 })} ${esc(t('share.suggest'))}</button>
  </form>`;

function render(a) {
  adventure = a;
  me = guestName(a, a.owner);
  setLanguage(a.language);
  document.title = `${a.title} · citybook`;
  mountMasthead('plan', { signedIn: false, readOnly: true, issue: '', shareToken: token });
  const days = daysBetween(a.starts_on, a.ends_on);
  const nights = days.length - 1;
  const ideas = itemsOf(a, null);
  root.innerHTML = `
    <section class="banner">
      ${a.cover ? `<img class="banner__img" src="${esc(a.cover)}" alt="${esc(a.guests.join(' & '))}" />` : '<div class="banner__img banner__img--blank"></div>'}
      <div class="banner__label">
        <h1>${esc(a.title)}</h1>
        <p class="banner__dates">${esc(formatRange(a.starts_on, a.ends_on))}</p>
      </div>
    </section>
    ${a.notes || a.subtitle ? `<p class="shared__intro">${esc(a.notes || a.subtitle)}</p>` : ''}
    <ul class="stats">
      <li>${icon('bed', { size: 22 })}<span>${esc(nights === 1 ? t('share.night') : t('share.nights', { n: nights }))}</span></li>
      <li>${icon('people', { size: 22 })}<span>${esc(t('share.people', { n: a.party_size }))}</span></li>
      <li>${icon('pin', { size: 22 })}<span>Paris</span></li>
    </ul>
    <div class="shared__guest">
      <a class="btn shared__map-link" href="/?share=${encodeURIComponent(token)}">${icon('pin', { size: 16 })} ${esc(t('share.openMap'))}</a>
      <div><p class="shared__help">${esc(t('share.suggestHelp'))}</p>${guestPicker(a, a.owner, me)}</div>
    </div>
    <nav class="day-jump" aria-label="${esc(t('adventure.itinerary'))}">
      ${days.map((d, i) => `<a href="#d-${d}">${esc(t('adventure.day', { n: i + 1 }))}</a>`).join('')}
      <a href="#d-ideas">${esc(t('adventure.ideas'))}</a>
    </nav>
    <div class="shared__days">
      ${days.map((d, i) => {
        const items = itemsOf(a, d);
        const photo = items.find((x) => x.photo)?.photo;
        return `<section class="shared-day" id="d-${d}">
          <div class="shared-day__badge"><b>${esc(t('adventure.day', { n: i + 1 }))}</b><span>${esc(formatTab(d))}</span></div>
          <div class="shared-day__body">
            ${a.days?.[d] ? `<h2 class="shared-day__theme">${esc(a.days[d])}</h2>` : ''}
            ${weatherLine(weather.get(d))}
            ${items.length ? `<ul class="todos">${items.map(stopHtml).join('')}</ul>` : ''}
            ${suggestForm(d)}
          </div>
          ${photo ? `<figure class="print taped shared-day__photo"><img src="${esc(photo.src)}" alt="" loading="lazy" /></figure>` : '<span></span>'}
        </section>`;
      }).join('')}
      <section class="shared-day" id="d-ideas"><div class="shared-day__badge shared-day__badge--ideas"><b>${esc(t('adventure.ideas'))}</b></div>
        <div class="shared-day__body">${ideas.length ? `<ul class="todos">${ideas.map(stopHtml).join('')}</ul>` : ''}${suggestForm('')}</div><span></span></section>
    </div>
    ${days.some((d) => weather.has(d)) ? weatherCredit() : ''}
    ${focusHtml(days)}`;
  dayMap(root.querySelector('[data-mini-map]'))({
    items: itemsOf(a, focusDay),
    extras: hoodPlaces(focusDay),
    home: city.places.find((p) => p.layer_id === 'home'),
    layers: city.layers,
    addLabel: t('share.suggestForDay'),
  });
}

const dayHoods = (day) => adventure.day_areas?.[day] || [];
const areaOf = (day) => dayHoods(day).map((h) => h.area).join(' · ');
/** Places of the day's neighbourhoods that Vic kept for that day, not already a step. */
function hoodPlaces(day) {
  const planned = new Set(itemsOf(adventure, day).map((i) => i.place_id));
  const seen = new Set();
  return dayHoods(day)
    .flatMap((h) => city.places.filter((p) => p.area === h.area && !HIDDEN.has(p.layer_id) && !h.hidden.includes(p.id)))
    .filter((p) => !planned.has(p.id) && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
}

/** One day at a time: pick a day and its plan, map and hour-by-hour weather all change together. */
function focusHtml(days) {
  if (!days.includes(focusDay)) {
    const today = new Date().toISOString().slice(0, 10);
    focusDay = days.includes(today) ? today : days[0];
  }
  const items = itemsOf(adventure, focusDay);
  const n = days.indexOf(focusDay) + 1;
  const picks = hoodPlaces(focusDay);
  const layerOf = (p) => city.layers.find((l) => l.id === p.layer_id) || {};
  return `<section class="shared__map" id="day-by-day">
    <h2>${esc(t('share.dayByDay'))} <a class="shared__map-more" href="/?share=${encodeURIComponent(token)}${dayHoods(focusDay).length ? `&area=${encodeURIComponent(dayHoods(focusDay)[0].area)}` : ''}">${esc(t('share.openMap'))}</a></h2>
    <div class="focus-days" role="tablist">${days.map((d, i) => `<button class="day-tab" role="tab" type="button" data-focus-day="${d}" aria-selected="${d === focusDay}">
      <b>${esc(t('adventure.day', { n: i + 1 }))}</b><span>${esc(formatTab(d))}</span>${areaOf(d) ? `<i class="day-tab__area">${esc(areaOf(d))}</i>` : ''}</button>`).join('')}</div>
    <div class="focus">
      <div class="focus__plan">
        <h3 class="focus__title">${esc(t('adventure.day', { n }))}${adventure.days?.[focusDay] ? ` — ${esc(adventure.days[focusDay])}` : ''}</h3>
        ${areaOf(focusDay) ? `<p class="glance__area">${icon('pin', { size: 12 })} ${esc(areaOf(focusDay))}</p>` : ''}
        ${weatherLine(weather.get(focusDay))}
        ${items.length ? `<ol class="focus__items">${items.map((it) => `<li class="${it.done ? 'is-done' : ''}">${it.start_time ? `<span class="todo__time">${esc(it.start_time)}</span> ` : ''}${esc(it.title)}</li>`).join('')}</ol>`
          : `<p class="glance__empty">${esc(t('adventure.nothingYet'))}</p>`}
      </div>
      <div class="mini-map focus__map" data-mini-map></div>
    </div>
    ${picks.length ? `<div class="hood-picks"><h3>${esc(t('share.suggestFromArea', { area: areaOf(focusDay) }))}</h3>
      <ul>${picks.map((p) => `<li><button class="hood-pick" type="button" data-add-place="${esc(p.id)}">${picto(layerOf(p).icon, layerOf(p).color, 14)} ${esc(p.name)} <span class="star" aria-hidden="true">★</span></button></li>`).join('')}</ul></div>` : ''}
    ${hourlyStrip(hourly.get(focusDay), t('weather.hourly', { day: formatTab(focusDay) })) || `<p class="hourly__later">${esc(t('weather.later'))}</p>`}
  </section>`;
}

async function reload(focusDay) {
  const scroll = scrollY;
  render(await fetch(shareApi).then((r) => (r.ok ? r.json() : Promise.reject(r))));
  scrollTo(0, scroll);
  if (focusDay !== undefined) root.querySelector(`[data-suggest="${focusDay}"] input`)?.focus({ preventScroll: true });
}

root.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-suggest]');
  if (!form) return;
  e.preventDefault();
  const title = form.elements.title.value.trim();
  if (!title) return;
  const res = await fetch(`${shareApi}/items`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, day: form.dataset.suggest || null, by: me }),
  });
  if (!res.ok) return toast(t('error.generic'));
  toast(t('share.added'));
  await reload(form.dataset.suggest);
});

root.addEventListener('click', async (e) => {
  const fd = e.target.closest('[data-focus-day]');
  if (fd) {
    focusDay = fd.dataset.focusDay;
    const y = scrollY;
    render(adventure);
    scrollTo(0, y);
    return root.querySelector(`[data-focus-day="${focusDay}"]`)?.focus();
  }
  const add = e.target.closest('[data-add-place]');
  if (add) {
    const res = await fetch(`${shareApi}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: add.dataset.addPlace, day: focusDay, by: me }),
    });
    if (!res.ok) return toast(t('error.generic'));
    toast(t('share.added'));
    return reload();
  }
  // The day list: jumping to a day also shows it in "Day by day".
  const jumpTo = e.target.closest('.day-jump a[href^="#d-2"]');
  if (jumpTo) focusDay = jumpTo.getAttribute('href').slice(3);
  const el = e.target.closest('[data-unsuggest]');
  if (!el) return;
  const res = await fetch(`${shareApi}/items/${encodeURIComponent(el.dataset.unsuggest)}`, { method: 'DELETE' });
  if (!res.ok) return toast(t('error.generic'));
  await reload();
});

root.addEventListener('change', (e) => {
  if (!e.target.matches('[data-guest]')) return;
  setGuestName(adventure, e.target.value);
  render(adventure);
});

Promise.all([forecast(), hourlyForecast()]).then(([w, h]) => {
  weather = w;
  hourly = h;
  if (adventure) {
    const y = scrollY;
    render(adventure);
    scrollTo(0, y);
  }
});

Promise.all([
  fetch(shareApi).then((r) => (r.ok ? r.json() : Promise.reject(r))),
  fetch(`${shareApi}/map`).then((r) => (r.ok ? r.json() : city)).catch(() => city),
])
  .then(([a, m]) => {
    city = m;
    render(a);
  })
  .catch(() => {
    mountMasthead(null, { signedIn: false, issue: '' });
    root.innerHTML = `<p class="trip__missing">${esc(t('share.missing'))}</p>`;
  });
