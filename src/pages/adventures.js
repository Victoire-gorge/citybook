import '../styles/base.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t, formatRange } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, adventureStatus } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { openAdventureForm } from '../lib/adventure-form.js';

startPage();
mountMasthead('adventures');

const list = document.querySelector('[data-list]');
const dialog = document.querySelector('[data-dialog]');
const newButton = document.querySelector('[data-new]');
newButton.innerHTML = `${esc(t('adventures.new'))} ${icon('plus')}`;
newButton.addEventListener('click', () =>
  openAdventureForm(dialog, { onSaved: (a) => (location.href = `/adventure?id=${encodeURIComponent(a.id)}`) }),
);

const count = (n, one, many) => (n === 1 ? t(one) : t(many, { n }));

async function load() {
  const adventures = await api('/api/adventures');
  // Upcoming and current first (soonest first), then past ones (most recent first).
  const order = { now: 0, upcoming: 1, past: 2 };
  adventures.sort((a, b) => {
    const sa = adventureStatus(a);
    const sb = adventureStatus(b);
    if (sa !== sb) return order[sa] - order[sb];
    return sa === 'past' ? b.starts_on.localeCompare(a.starts_on) : a.starts_on.localeCompare(b.starts_on);
  });
  document.querySelector('[data-empty]').hidden = adventures.length > 0;
  list.innerHTML = adventures
    .map((a, i) => {
      const status = adventureStatus(a);
      const href = `/adventure?id=${encodeURIComponent(a.id)}`;
      return `<li class="edition-card">
        <a class="edition-card__photo print taped" href="${href}" tabindex="-1" aria-hidden="true" style="--tilt:${i % 2 ? 1.2 : -1.6}deg">
          ${a.cover ? `<img src="${esc(a.cover)}" alt="" loading="lazy" />` : `<span class="edition-card__blank">${esc(a.title.slice(0, 1))}</span>`}
        </a>
        <div class="edition-card__text">
          <span class="tag ${status !== 'past' ? 'tag--now' : ''}">${esc(t(`status.${status}`))}</span>
          <h2 class="edition-card__title"><a href="${href}">${esc(a.title)}</a></h2>
          <ul class="facts">
            <li>${icon('calendar')}<span>${esc(formatRange(a.starts_on, a.ends_on))}</span></li>
            <li>${icon('people')}<span>${esc(count(a.party_size, 'adventures.person', 'adventures.people'))}</span></li>
            <li>${icon('pin')}<span>${esc(count(a.place_count, 'adventures.place', 'adventures.places'))}</span></li>
          </ul>
          <a class="btn btn--line btn--square edition-card__go" href="${href}" aria-label="${esc(t('adventures.open', { title: a.title }))}">${icon('arrowRight')}</a>
        </div>
      </li>`;
    })
    .join('');
}

load();
