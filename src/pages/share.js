import '../styles/base.css';
import '../styles/adventures.css';
import { t, setLanguage } from '../lib/i18n.js';
import { startPage } from '../lib/ui.js';
import { renderTrip } from '../lib/trip.js';

// Read-only page for guests: no sign-in, no editing.
startPage();
const root = document.querySelector('[data-trip]');
const token = new URLSearchParams(location.search).get('t') || '';

fetch(`/api/share/${encodeURIComponent(token)}`)
  .then((r) => (r.ok ? r.json() : Promise.reject(r)))
  .then((adventure) => {
    setLanguage(adventure.language);
    renderTrip(root, adventure, { editable: false });
  })
  .catch(() => {
    root.innerHTML = `<p class="trip__missing hand">${t('share.missing')}</p>`;
  });
