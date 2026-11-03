import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t, formatRange, formatDay } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { icon, picto } from '../lib/icons.js';
import { daysBetween, itemsOf, dayTab, miniMap } from '../lib/trip.js';
import { openAdventureForm } from '../lib/adventure-form.js';
import { downloadIcs } from '../lib/ics.js';

startPage();
mountMasthead('adventures');

const id = new URLSearchParams(location.search).get('id');
const root = document.querySelector('[data-trip]');
const dialog = document.querySelector('[data-dialog]');
let adventure;
let days = [];
let current = null; // selected day, or '' for ideas
let updateMap;

async function load() {
  adventure = await api(`/api/adventures/${encodeURIComponent(id)}`);
  days = daysBetween(adventure.starts_on, adventure.ends_on);
  if (current === null || (current && !days.includes(current))) {
    const today = new Date().toISOString().slice(0, 10);
    current = days.includes(today) ? today : days[0];
  }
  render();
}

const count = (n, one, many) => (n === 1 ? t(one) : t(many, { n }));

function shareBox() {
  if (!adventure.share_token) return '';
  const link = `${location.origin}/share?t=${adventure.share_token}`;
  return `<div class="share-box">
    <p>${icon('lock', { size: 16 })} ${esc(t('adventure.shareOn'))}</p>
    <div class="share-box__row">
      <input readonly value="${esc(link)}" aria-label="${esc(t('adventure.share'))}" />
      <button class="btn" type="button" data-copy>${icon('link', { size: 16 })} ${esc(t('adventure.shareCopy'))}</button>
    </div>
    <button class="link-button" type="button" data-unshare>${esc(t('adventure.shareStop'))}</button>
  </div>`;
}

function itemHtml(item, index, total) {
  const title = item.place_id
    ? `<a href="/#${esc(item.place_id)}">${esc(item.title)}</a>`
    : item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title);
  return `<li class="stop" data-item="${esc(item.id)}">
    <label class="stop__time"><span class="visually-hidden">${esc(t('adventure.time'))}</span>
      <input type="time" value="${esc(item.start_time || '')}" data-field="start_time" /></label>
    <div class="stop__main">
      <p class="stop__title">${item.layer_id ? `${picto(layerIcon(item.layer_id), layerColor(item.layer_id), 14)} ` : ''}${title}</p>
      ${item.summary ? `<p class="stop__summary">${esc(item.summary)}</p>` : ''}
      <input class="stop__note" value="${esc(item.note)}" maxlength="1000" data-field="note" placeholder="${esc(t('adventure.note'))}…" aria-label="${esc(t('adventure.note'))}" />
    </div>
    <div class="stop__tools">
      <button class="icon-button" type="button" data-move="-1" ${index === 0 ? 'disabled' : ''} aria-label="${esc(t('adventure.moveUp'))}">${icon('arrowUp', { size: 16 })}</button>
      <button class="icon-button" type="button" data-move="1" ${index === total - 1 ? 'disabled' : ''} aria-label="${esc(t('adventure.moveDown'))}">${icon('arrowDown', { size: 16 })}</button>
      <label class="stop__day"><span class="visually-hidden">${esc(t('adventure.moveTo'))}</span>
        <select data-field="day">
          <option value="">${esc(t('adventure.ideas'))}</option>
          ${days.map((d, i) => `<option value="${d}" ${d === item.day ? 'selected' : ''}>${esc(t('adventure.day', { n: i + 1 }))}</option>`).join('')}
        </select></label>
      <button class="icon-button" type="button" data-remove aria-label="${esc(t('adventure.remove'))}">${icon('trash', { size: 16 })}</button>
    </div>
  </li>`;
}

// Layer look-up for the small pictograms next to places (same values as the map).
const LAYERS = { passages: ['arch', '#365748'], museums: ['museum', '#C67B51'], buildings: ['facade', '#202521'], streets: ['wave', '#A58AA6'], squares: ['tree', '#5E8C4A'] };
const layerIcon = (l) => LAYERS[l]?.[0] || 'dot';
const layerColor = (l) => LAYERS[l]?.[1] || '#202521';

function dayPanel() {
  const isIdeas = current === '';
  const items = itemsOf(adventure, isIdeas ? null : current);
  const n = days.indexOf(current) + 1;
  const photo = items.find((i) => i.photo)?.photo;
  const heading = isIdeas
    ? `<h3 class="day__title">${esc(t('adventure.ideasTitle'))}</h3>`
    : `<h3 class="day__title">${esc(t('adventure.day', { n }))} — <input class="day__theme" value="${esc(adventure.days?.[current] || '')}" maxlength="120" placeholder="${esc(t('adventure.themePlaceholder'))}" aria-label="${esc(t('adventure.themePlaceholder'))}" data-theme /></h3>
       <p class="day__date mono">${esc(formatDay(current))}</p>`;
  return `<div class="day">
    <div class="day__list">
      ${heading}
      ${items.length
        ? `<ol class="stops">${items.map((it, i) => itemHtml(it, i, items.length)).join('')}</ol>`
        : `<p class="day__empty">${esc(isIdeas ? t('adventure.emptyIdeas') : t('adventure.emptyDay'))}</p>`}
      <form class="day__add" data-add>
        <input name="title" maxlength="200" placeholder="${esc(t('adventure.addPlaceholder'))}" aria-label="${esc(t('adventure.addLabel'))}" />
        <button class="btn btn--line" type="submit">${icon('plus', { size: 16 })} ${esc(t('adventure.add'))}</button>
      </form>
      <a class="day__map-link" href="/">${icon('pin', { size: 16 })} ${esc(t('adventure.openMap'))}</a>
    </div>
    <aside class="day__aside">
      ${photo ? `<figure class="print day__photo"><img src="${esc(photo.src)}" alt="" /></figure>` : ''}
      <div class="mini-map" data-mini-map aria-label="${esc(t('adventure.mapTitle'))}"></div>
    </aside>
  </div>`;
}

function render() {
  const a = adventure;
  document.title = `${a.title} · citybook`;
  root.innerHTML = `
    <a class="back" href="/adventures">${icon('arrowLeft', { size: 16 })} ${esc(t('adventure.back'))}</a>
    <section class="trip__head">
      <figure class="trip__cover print taped">
        ${a.cover ? `<img src="${esc(a.cover)}" alt="${esc(a.guests.join(' & '))}" />` : '<span class="trip__cover-blank"></span>'}
      </figure>
      <div class="trip__intro">
        <h1 class="trip__title">${esc(a.title)}</h1>
        <ul class="facts facts--inline">
          <li>${icon('calendar')}<span>${esc(formatRange(a.starts_on, a.ends_on))}</span></li>
          <li>${icon('people')}<span>${esc(count(a.party_size, 'adventures.person', 'adventures.people'))}</span></li>
        </ul>
        ${a.notes ? `<p class="trip__notes">${esc(a.notes)}</p>` : ''}
        <div class="trip__actions">
          ${a.share_token ? '' : `<button class="btn btn--line" type="button" data-share>${icon('share', { size: 16 })} ${esc(t('adventure.share'))}</button>`}
          <button class="btn btn--line" type="button" data-ics>${icon('calendarAdd', { size: 16 })} ${esc(t('adventure.calendar'))}</button>
          <button class="btn btn--line btn--square" type="button" data-edit aria-label="${esc(t('adventure.edit'))}" title="${esc(t('adventure.edit'))}">${icon('more')}</button>
        </div>
        ${shareBox()}
      </div>
    </section>
    <section class="itinerary" aria-labelledby="itinerary-title">
      <div class="itinerary__bar">
        <h2 id="itinerary-title" class="itinerary__title">${esc(t('adventure.itinerary'))}</h2>
        <div class="day-tabs" role="tablist">
          ${days.map((d, i) => `<button class="day-tab" role="tab" type="button" data-day="${d}" aria-selected="${d === current}">
              <b>${esc(t('adventure.day', { n: i + 1 }))}</b><span>${esc(dayTab(d))}</span></button>`).join('')}
          <button class="day-tab day-tab--ideas" role="tab" type="button" data-day="" aria-selected="${current === ''}">
            <b>${esc(t('adventure.ideas'))}</b><span>${itemsOf(a, null).length}</span></button>
        </div>
      </div>
      <div class="itinerary__panel" role="tabpanel">${dayPanel()}</div>
    </section>`;
  updateMap = miniMap(root.querySelector('[data-mini-map]'));
  updateMap(itemsOf(adventure, current === '' ? null : current));
}

const reload = async () => {
  try {
    await load();
  } catch (err) {
    toast(err.message || t('error.generic'));
  }
};

root.addEventListener('click', async (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  try {
    if (el.matches('[data-day]')) {
      current = el.dataset.day;
      render();
      root.querySelector(`[data-day="${current}"]`)?.focus();
    } else if (el.matches('[data-edit]')) {
      openAdventureForm(dialog, { adventure, onSaved: reload, onDeleted: () => (location.href = '/adventures') });
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
      await api(`/api/adventures/${adventure.id}/items/${el.closest('[data-item]').dataset.item}`, { method: 'DELETE' });
      await reload();
    } else if (el.matches('[data-move]')) {
      const ids = [...root.querySelectorAll('.stops [data-item]')].map((li) => li.dataset.item);
      const from = ids.indexOf(el.closest('[data-item]').dataset.item);
      const to = from + Number(el.dataset.move);
      [ids[from], ids[to]] = [ids[to], ids[from]];
      await api(`/api/adventures/${adventure.id}/order`, { method: 'PUT', body: { ids } });
      await reload();
    }
  } catch (err) {
    toast(err.message || t('error.generic'));
  }
});

root.addEventListener('keydown', (e) => {
  // Arrow keys move between day tabs.
  if (!e.target.matches('.day-tab') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = [...root.querySelectorAll('.day-tab')];
  const next = tabs[(tabs.indexOf(e.target) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  next.click();
});

root.addEventListener('change', async (e) => {
  try {
    if (e.target.matches('[data-theme]')) {
      await api(`/api/adventures/${adventure.id}/days/${current}`, { method: 'PUT', body: { theme: e.target.value } });
      adventure.days = { ...adventure.days, [current]: e.target.value.trim() };
      toast(t('form.saved'));
      return;
    }
    const field = e.target.dataset.field;
    const itemEl = e.target.closest('[data-item]');
    if (!field || !itemEl) return;
    const value = e.target.value || (field === 'note' ? '' : null);
    await api(`/api/adventures/${adventure.id}/items/${itemEl.dataset.item}`, { method: 'PATCH', body: { [field]: value } });
    if (field === 'day') await reload();
  } catch (err) {
    toast(err.message || t('error.generic'));
  }
});

root.addEventListener('submit', async (e) => {
  if (!e.target.matches('[data-add]')) return;
  e.preventDefault();
  const title = e.target.elements.title.value.trim();
  if (!title) return;
  try {
    await api(`/api/adventures/${adventure.id}/items`, { method: 'POST', body: { title, day: current || null } });
    await reload();
  } catch (err) {
    toast(err.message || t('error.generic'));
  }
});

load().catch((err) => {
  root.innerHTML = `<p class="trip__missing">${esc(err.message || t('error.generic'))}</p>`;
});
