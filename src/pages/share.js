import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { t, setLanguage, formatRange, formatTab } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { guestName, setGuestName, guestPicker } from '../lib/guest.js';
import { forecast, weatherLine, weatherCredit } from '../lib/weather.js';
let weather = new Map();
import { icon } from '../lib/icons.js';
import { daysBetween, itemsOf, miniMap } from '../lib/trip.js';

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
    <section class="shared__map">
      <h2>${esc(t('adventure.mapTitle'))} <a class="shared__map-more" href="/?share=${encodeURIComponent(token)}">${esc(t('share.openMap'))}</a></h2>
      <div class="mini-map mini-map--wide" data-mini-map></div>
    </section>`;
  miniMap(root.querySelector('[data-mini-map]'))(a.items.filter((x) => x.day));
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

forecast().then((w) => {
  weather = w;
  if (adventure) {
    const y = scrollY;
    render(adventure);
    scrollTo(0, y);
  }
});

fetch(shareApi)
  .then((r) => (r.ok ? r.json() : Promise.reject(r)))
  .then(render)
  .catch(() => {
    mountMasthead(null, { signedIn: false, issue: '' });
    root.innerHTML = `<p class="trip__missing">${esc(t('share.missing'))}</p>`;
  });
