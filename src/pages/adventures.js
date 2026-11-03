import '../styles/base.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t, formatRange } from '../lib/i18n.js';
import { cutout, esc, mountNav, startPage } from '../lib/ui.js';
import { openAdventureForm } from '../lib/adventure-form.js';

startPage();
mountNav('adventures');
document.querySelector('[data-title]').append(cutout(t('adventures.title'), { size: 'l' }));

const list = document.querySelector('[data-list]');
const dialog = document.querySelector('[data-dialog]');

document.querySelector('[data-new]').addEventListener('click', () =>
  openAdventureForm(dialog, { onSaved: (a) => (location.href = `/adventure?id=${encodeURIComponent(a.id)}`) }),
);

const count = (n, one, many) => (n === 1 ? t(one) : t(many, { n }));

async function load() {
  const adventures = await api('/api/adventures');
  document.querySelector('[data-empty]').hidden = adventures.length > 0;
  list.innerHTML = adventures
    .map((a, i) => {
      const initials = a.title.split(/\s+/).map((w) => w[0]).join('').slice(0, 3);
      return `<li class="polaroid adventure-card taped" data-palette="${esc(a.palette)}" style="--tilt:${(i % 2 ? 1.6 : -1.4)}deg">
        <a href="/adventure?id=${encodeURIComponent(a.id)}">
          ${a.cover
            ? `<img class="polaroid__photo" src="${esc(a.cover)}" alt="" loading="lazy" />`
            : `<div class="polaroid__photo adventure-card__blank gingham" data-initials="${esc(initials)}"></div>`}
          <span class="polaroid__caption">${esc(a.title)}</span>
        </a>
        <p class="adventure-card__meta">
          <span>${esc(formatRange(a.starts_on, a.ends_on))}</span>
          <span>${esc(count(a.party_size, 'adventures.person', 'adventures.people'))}</span>
          <span>${esc(count(a.item_count, 'adventures.item', 'adventures.items'))}</span>
        </p>
      </li>`;
    })
    .join('');
  list.querySelectorAll('[data-initials]').forEach((el) => el.append(cutout(el.dataset.initials, { size: 'm' })));
}

load();
