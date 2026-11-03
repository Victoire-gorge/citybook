import '../styles/base.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { esc, mountNav, startPage, toast } from '../lib/ui.js';
import { renderTrip } from '../lib/trip.js';
import { openAdventureForm } from '../lib/adventure-form.js';
import { downloadIcs } from '../lib/ics.js';

startPage();
mountNav('adventures');

const id = new URLSearchParams(location.search).get('id');
const root = document.querySelector('[data-trip]');
const dialog = document.querySelector('[data-dialog]');
let adventure;

async function load() {
  adventure = await api(`/api/adventures/${encodeURIComponent(id)}`);
  render();
}

function shareBox() {
  if (!adventure.share_token) return '';
  const link = `${location.origin}/share?t=${adventure.share_token}`;
  return `<div class="share-box card">
    <p>${esc(t('adventure.shareOn'))}</p>
    <input readonly value="${esc(link)}" aria-label="${esc(t('adventure.share'))}" />
    <div class="share-box__actions">
      <button class="btn" type="button" data-copy>${esc(t('adventure.shareCopy'))}</button>
      <button class="link-button" type="button" data-unshare>${esc(t('adventure.shareStop'))}</button>
    </div>
  </div>`;
}

function render() {
  const toolbar = `
    <button class="btn btn--quiet" type="button" data-edit>${esc(t('adventure.edit'))}</button>
    ${adventure.share_token ? '' : `<button class="btn btn--quiet" type="button" data-share>${esc(t('adventure.share'))}</button>`}
    <button class="btn btn--quiet" type="button" data-ics>${esc(t('adventure.calendar'))}</button>
    <a class="btn" href="/">${esc(t('adventure.openMap'))}</a>
    ${shareBox()}`;
  renderTrip(root, adventure, { editable: true, toolbar });
}

const patchItem = (itemId, body) =>
  api(`/api/adventures/${adventure.id}/items/${itemId}`, { method: 'PATCH', body });

root.addEventListener('click', async (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.matches('[data-edit]')) {
    openAdventureForm(dialog, {
      adventure,
      onSaved: () => load(),
      onDeleted: () => (location.href = '/adventures'),
    });
  } else if (el.matches('[data-share], [data-unshare]')) {
    const { share_token } = await api(`/api/adventures/${adventure.id}/share`, {
      method: 'POST', body: { enabled: el.matches('[data-share]') },
    });
    adventure.share_token = share_token;
    render();
  } else if (el.matches('[data-copy]')) {
    await navigator.clipboard.writeText(root.querySelector('.share-box input').value);
    toast(t('adventure.shareCopied'));
  } else if (el.matches('[data-ics]')) {
    downloadIcs(adventure);
  } else if (el.matches('[data-remove]')) {
    const itemId = el.closest('[data-item]').dataset.item;
    await api(`/api/adventures/${adventure.id}/items/${itemId}`, { method: 'DELETE' });
    await load();
  }
});

root.addEventListener('change', async (e) => {
  const field = e.target.dataset.field;
  const itemEl = e.target.closest('[data-item]');
  if (!field || !itemEl) return;
  const value = e.target.value || (field === 'note' ? '' : null);
  try {
    await patchItem(itemEl.dataset.item, { [field]: value });
    if (field === 'day' || field === 'start_time') await load();
  } catch (err) {
    toast(err.message || t('error.generic'));
  }
});

root.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-add]');
  if (!form) return;
  e.preventDefault();
  const title = form.elements.title.value.trim();
  if (!title) return;
  await api(`/api/adventures/${adventure.id}/items`, {
    method: 'POST', body: { title, day: form.dataset.add || null },
  });
  await load();
});

load();
