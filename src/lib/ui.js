// DOM helpers and the parts shared by every page.
import { t, translatePage } from './i18n.js';
import { api } from './api.js';
import { icon } from './icons.js';

/** Escape text for innerHTML templates. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Masthead: wordmark, sections, sign out, and the issue line. `current` is 'map' or 'adventures'. */
export function mountMasthead(current, { issue = t('issue.paris'), signedIn = true } = {}) {
  const el = document.querySelector('[data-masthead]');
  if (!el) return;
  el.className = 'masthead';
  el.innerHTML = `
    <div class="masthead__bar">
      <a class="wordmark" href="/">${esc(t('site.name'))}</a>
      ${signedIn ? `<nav class="sections" aria-label="${esc(t('nav.label'))}">
        <a href="/" ${current === 'map' ? 'aria-current="page"' : ''}>${esc(t('nav.map'))}</a>
        <a href="/adventures" ${current === 'adventures' ? 'aria-current="page"' : ''}>${esc(t('nav.adventures'))}</a>
      </nav>` : ''}
      <div class="masthead__tools" data-tools>
        ${signedIn ? `<button class="icon-button" type="button" data-signout title="${esc(t('nav.signout'))}" aria-label="${esc(t('nav.signout'))}">${icon('user', { size: 22 })}</button>` : ''}
      </div>
    </div>
    <div class="issue">${esc(issue)}</div>`;
  el.querySelector('[data-signout]')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    location.href = '/login';
  });
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
