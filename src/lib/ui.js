// DOM helpers and the parts shared by every page.
import { t, translatePage } from './i18n.js';
import { api } from './api.js';
import { icon } from './icons.js';

/** Escape text for innerHTML templates. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Masthead: wordmark, sections, sign out, and the issue line. `current` is 'map' or 'adventures'. */
export function mountMasthead(current, { issue = t('issue.paris'), signedIn = true, readOnly = false, shareToken = null } = {}) {
  const tok = shareToken ? encodeURIComponent(shareToken) : '';
  const el = document.querySelector('[data-masthead]');
  if (!el) return;
  el.className = 'masthead';
  el.innerHTML = `
    <div class="masthead__bar">
      <a class="wordmark" href="/">${esc(t('site.name'))}</a>
      ${signedIn ? `<nav class="sections" aria-label="${esc(t('nav.label'))}">
        <a href="/" ${current === 'map' ? 'aria-current="page"' : ''}>${esc(t('nav.map'))}</a>
        <a href="/activities" ${current === 'activities' ? 'aria-current="page"' : ''}>${esc(t('nav.activities'))}</a>
        <a href="/adventures" ${current === 'adventures' ? 'aria-current="page"' : ''}>${esc(t('nav.adventures'))}</a>
        <span class="sections__trips" data-trips></span>
      </nav>` : ''}
      ${shareToken ? `<nav class="sections" aria-label="${esc(t('nav.label'))}">
        <a href="/share?t=${tok}" ${current === 'plan' ? 'aria-current="page"' : ''}>${esc(t('nav.plan'))}</a>
        <a href="/?share=${tok}" ${current === 'map' ? 'aria-current="page"' : ''}>${esc(t('nav.map'))}</a>
        <a href="/activities?share=${tok}" ${current === 'activities' ? 'aria-current="page"' : ''}>${esc(t('nav.activities'))}</a>
      </nav>` : ''}
      <div class="masthead__tools" data-tools>
        ${signedIn ? `<button class="icon-button" type="button" data-signout title="${esc(t('nav.signout'))}" aria-label="${esc(t('nav.signout'))}">${icon('user', { size: 22 })}</button>` : ''}
        ${readOnly ? `<span class="pill">${icon('lock', { size: 14 })} ${esc(t('share.readOnly'))}</span>` : ''}
      </div>
    </div>
    ${issue ? `<div class="issue">${esc(issue)}</div>` : ''}`;
  el.querySelector('[data-signout]')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    location.href = '/login';
  });
  // Other sticky bars sit under the masthead.
  const measure = () => document.documentElement.style.setProperty('--mast-h', `${el.offsetHeight}px`);
  measure();
  new ResizeObserver(measure).observe(el);
  if (signedIn) mountTrips(el.querySelector('[data-trips]'));
}

/** Current and upcoming adventures, next to the sections, as rounded tickets with their cover. */
async function mountTrips(slot) {
  if (!slot) return;
  let adventures;
  try {
    const res = await fetch('/api/adventures', { credentials: 'same-origin' });
    if (!res.ok) return;
    adventures = await res.json();
  } catch {
    return; // signed out or offline: the sections are enough
  }
  const open = new URLSearchParams(location.search).get('id');
  const trips = adventures
    .filter((a) => adventureStatus(a) !== 'past')
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  slot.innerHTML = trips
    .map((a) => {
      const now = adventureStatus(a) === 'now';
      const here = location.pathname.startsWith('/adventure') && !location.pathname.startsWith('/adventures') && open === a.id;
      return `<a class="trip-link ${now ? 'is-now' : ''}" href="/adventure?id=${encodeURIComponent(a.id)}" ${here ? 'aria-current="page"' : ''}
        title="${esc(t(now ? 'nav.tripNow' : 'nav.tripNext', { title: a.title }))}">
        ${a.cover ? `<img class="trip-link__cover" src="${esc(a.cover)}" alt="" />` : `<span class="trip-link__cover trip-link__cover--blank">${icon('sparkle', { size: 12 })}</span>`}
        <span>${esc(a.title)}</span>
      </a>`;
    })
    .join('');
}

let toastTimer;
export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { className: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('toast--on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--on'), 2600);
}

export function startPage() {
  translatePage();
}

/** "Upcoming", "Now" or "Past" for an adventure, from today's date in Paris. */
export function adventureStatus(a, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())) {
  if (today < a.starts_on) return 'upcoming';
  if (today > a.ends_on) return 'past';
  return 'now';
}
