// A 1-to-5 star rating. Editable for the owner (clicking the current rating clears it),
// read-only for guests.
import { t } from './i18n.js';
import { esc } from './ui.js';

export function starsHtml(rating, { editable = false, name = '' } = {}) {
  const r = rating || 0;
  if (!editable) {
    if (!r) return '';
    return `<span class="stars stars--read" role="img" aria-label="${esc(t('rating.label', { n: r }))}">${'★'.repeat(r)}<span class="stars__off">${'★'.repeat(5 - r)}</span></span>`;
  }
  return `<span class="stars" role="group" aria-label="${esc(t('rating.rate', { name }))}">${[1, 2, 3, 4, 5]
    .map((n) => `<button class="stars__star ${n <= r ? 'is-on' : ''}" type="button" data-rate="${n}" aria-pressed="${n === r}"
        aria-label="${esc(t(n === r ? 'rating.clear' : 'rating.set', { n }))}">★</button>`)
    .join('')}</span>`;
}
