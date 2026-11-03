import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { t, setLanguage, formatRange, formatTab } from '../lib/i18n.js';
import { esc, mountMasthead, startPage } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { daysBetween, itemsOf, miniMap } from '../lib/trip.js';

// Read-only page for guests: no sign-in, no editing controls.
startPage();
const root = document.querySelector('[data-trip]');
const token = new URLSearchParams(location.search).get('t') || '';

function stopHtml(item) {
  const name = item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title);
  const practical = [item.price, item.website ? `<a href="${esc(item.website)}" target="_blank" rel="noopener">${esc(t('place.website'))}</a>` : '']
    .filter(Boolean).join(' · ');
  return `<li class="todo todo--read ${item.done ? 'is-done' : ''}">
    <span class="todo__box" aria-hidden="true"></span>
    <div class="todo__text">
      <p>${name}${item.start_time ? ` <span class="todo__time">(${esc(item.start_time)})</span>` : ''}</p>
      ${item.summary ? `<p class="todo__summary">${esc(item.summary)}</p>` : ''}
      ${item.note ? `<p class="todo__note">${esc(item.note)}</p>` : ''}
      ${practical ? `<p class="todo__practical">${practical}</p>` : ''}
    </div>
  </li>`;
}

function render(a) {
  setLanguage(a.language);
  document.title = `${a.title} · citybook`;
  mountMasthead(null, { signedIn: false, readOnly: true, issue: '' });
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
    <nav class="day-jump" aria-label="${esc(t('adventure.itinerary'))}">
      ${days.map((d, i) => `<a href="#d-${d}">${esc(t('adventure.day', { n: i + 1 }))}</a>`).join('')}
    </nav>
    <div class="shared__days">
      ${days.map((d, i) => {
        const items = itemsOf(a, d);
        if (!items.length && !a.days?.[d]) return ''; // guests only see days with a plan
        const photo = items.find((x) => x.photo)?.photo;
        return `<section class="shared-day" id="d-${d}">
          <div class="shared-day__badge"><b>${esc(t('adventure.day', { n: i + 1 }))}</b><span>${esc(formatTab(d))}</span></div>
          <div class="shared-day__body">
            ${a.days?.[d] ? `<h2 class="shared-day__theme">${esc(a.days[d])}</h2>` : ''}
            ${items.length ? `<ul class="todos">${items.map(stopHtml).join('')}</ul>` : '<p class="muted">—</p>'}
          </div>
          ${photo ? `<figure class="print taped shared-day__photo"><img src="${esc(photo.src)}" alt="" loading="lazy" /></figure>` : '<span></span>'}
        </section>`;
      }).join('')}
      ${ideas.length ? `<section class="shared-day"><div class="shared-day__badge shared-day__badge--ideas"><b>${esc(t('adventure.ideas'))}</b></div>
        <div class="shared-day__body"><ul class="todos">${ideas.map(stopHtml).join('')}</ul></div><span></span></section>` : ''}
    </div>
    <section class="shared__map">
      <h2>${esc(t('adventure.mapTitle'))}</h2>
      <div class="mini-map mini-map--wide" data-mini-map></div>
    </section>`;
  miniMap(root.querySelector('[data-mini-map]'))(a.items.filter((x) => x.day));
}

fetch(`/api/share/${encodeURIComponent(token)}`)
  .then((r) => (r.ok ? r.json() : Promise.reject(r)))
  .then(render)
  .catch(() => {
    mountMasthead(null, { signedIn: false, issue: '' });
    root.innerHTML = `<p class="trip__missing">${esc(t('share.missing'))}</p>`;
  });
