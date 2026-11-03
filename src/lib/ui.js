// Small DOM helpers and the scrapbook pieces shared by every page.
import { t, translatePage } from './i18n.js';
import { api } from './api.js';

/** Escape text for innerHTML templates. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Ransom-note title: every letter cut from a different scrap of paper.
 * Styles are picked from the letter and its position, so a title always looks the same.
 */
export function cutout(text, { size = 'l' } = {}) {
  const el = document.createElement('span');
  el.className = `cutout cutout--${size}`;
  el.setAttribute('aria-label', text);
  [...text].forEach((ch, i) => {
    if (ch === ' ') {
      el.append(Object.assign(document.createElement('span'), { className: 'cutout__space' }));
      return;
    }
    const n = (ch.toUpperCase().charCodeAt(0) * 7 + i * 13) % 6;
    const tilt = (((ch.charCodeAt(0) + i * 5) % 7) - 3) * 1.6;
    const letter = document.createElement('span');
    letter.className = `cutout__letter cutout__letter--${n}`;
    letter.style.setProperty('--tilt', `${tilt}deg`);
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = ch.toUpperCase();
    el.append(letter);
  });
  return el;
}

/** Top bar with the notebook index tabs. `current` is 'map' or 'adventures'. */
export function mountNav(current) {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  nav.innerHTML = `
    <a class="brand" href="/">${esc(t('site.name'))}</a>
    <div class="tabs">
      <a class="tab tab--map" href="/" ${current === 'map' ? 'aria-current="page"' : ''}>${esc(t('nav.map'))}</a>
      <a class="tab tab--adventures" href="/adventures" ${current === 'adventures' ? 'aria-current="page"' : ''}>${esc(t('nav.adventures'))}</a>
    </div>
    <button class="link-button signout" type="button">${esc(t('nav.signout'))}</button>`;
  nav.querySelector('.signout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    location.href = '/login';
  });
}

let toastTimer;
/** Short confirmation written on a paper strip. */
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
