import '../styles/base.css';
import '../styles/map.css';
import '../styles/adventures.css';
import { api } from '../lib/api.js';
import { t, formatRange, formatDay } from '../lib/i18n.js';
import { esc, mountMasthead, startPage, toast } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { daysBetween, itemsOf, dayTab, miniMap } from '../lib/trip.js';
import { openAdventureForm } from '../lib/adventure-form.js';
import { downloadIcs } from '../lib/ics.js';
import { forecast, hourlyForecast, hourlyStrip, weatherMini, weatherLine, weatherCredit } from '../lib/weather.js';

startPage();
mountMasthead('adventures');

const id = new URLSearchParams(location.search).get('id');
const root = document.querySelector('[data-trip]');
const dialog = document.querySelector('[data-dialog]');
let adventure;
let days = [];
let current = null; // selected day, or '' for ideas
let updateMap;
let editing = null; // id of the step whose editor is open
let shareOpen = false;
let weather = new Map(); // date -> forecast, filled in when it arrives
let hourly = new Map(); // date -> hour-by-hour forecast

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
  if (!adventure.share_token || !shareOpen) return '';
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

/** One step of the day: a box to tick, the text, and a small editor that opens on demand. */
function itemHtml(item, index, total) {
  const title = item.place_id
    ? `<a href="/#${esc(item.place_id)}">${esc(item.title)}</a>`
    : item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title);
  const open = editing === item.id;
  return `<li class="todo ${item.done ? 'is-done' : ''} ${open ? 'is-editing' : ''}" data-item="${esc(item.id)}">
    <label class="todo__check"><input type="checkbox" data-field="done" ${item.done ? 'checked' : ''} /><span class="visually-hidden">${esc(item.title)}</span></label>
    <div class="todo__text">
      <p>${title}${item.start_time ? ` <span class="todo__time">(${esc(item.start_time)})</span>` : ''}${item.added_by ? ` <span class="suggested">★ ${esc(t('share.suggestedBy', { name: item.added_by }))}</span>` : ''}</p>
      ${item.day && !days.includes(item.day) ? `<p><span class="tag tag--off">${esc(t('adventure.outside', { date: formatDay(item.day) }))}</span></p>` : ''}
      ${item.note ? `<p class="todo__note">${esc(item.note)}</p>` : ''}
    </div>
    <button class="icon-button todo__edit" type="button" data-toggle-edit aria-expanded="${open}" aria-label="${esc(t('adventure.edit'))}">${icon('edit', { size: 15 })}</button>
    ${open ? `<div class="todo__editor">
      <label>${esc(t('adventure.time'))}<input type="time" value="${esc(item.start_time || '')}" data-field="start_time" /></label>
      <label class="todo__editor-note">${esc(t('adventure.note'))}<input value="${esc(item.note)}" maxlength="1000" data-field="note" /></label>
      <label>${esc(t('adventure.moveTo'))}<select data-field="day">
          <option value="">${esc(t('adventure.ideas'))}</option>
          ${days.map((d, i) => `<option value="${d}" ${d === item.day ? 'selected' : ''}>${esc(t('adventure.day', { n: i + 1 }))}</option>`).join('')}
        </select></label>
      <div class="todo__editor-tools">
        <button class="icon-button" type="button" data-move="-1" ${index === 0 ? 'disabled' : ''} aria-label="${esc(t('adventure.moveUp'))}">${icon('arrowUp', { size: 16 })}</button>
        <button class="icon-button" type="button" data-move="1" ${index === total - 1 ? 'disabled' : ''} aria-label="${esc(t('adventure.moveDown'))}">${icon('arrowDown', { size: 16 })}</button>
        <button class="icon-button" type="button" data-remove aria-label="${esc(t('adventure.remove'))}">${icon('trash', { size: 16 })}</button>
      </div>
    </div>` : ''}
  </li>`;
}

function dayPanel() {
  const isIdeas = current === '';
  const items = itemsOf(adventure, isIdeas ? null : current);
  const n = days.indexOf(current) + 1;
  const photo = items.find((i) => i.photo)?.photo;
  const heading = isIdeas
    ? `<h3 class="day__title">${esc(t('adventure.ideasTitle'))}</h3>`
    : `<h3 class="day__title">${esc(t('adventure.day', { n }))} — <input class="day__theme" value="${esc(adventure.days?.[current] || '')}" maxlength="120" placeholder="${esc(t('adventure.themePlaceholder'))}" aria-label="${esc(t('adventure.themePlaceholder'))}" data-theme /></h3>
       <p class="day__date mono">${esc(formatDay(current))}</p>
       ${weatherLine(weather.get(current))}`;
  return `<div class="day">
    <div class="day__list">
      ${heading}
      ${items.length
        ? `<ul class="todos">${items.map((it, i) => itemHtml(it, i, items.length)).join('')}</ul>`
        : `<p class="day__empty">${esc(isIdeas ? t('adventure.emptyIdeas') : t('adventure.emptyDay'))}</p>`}
      <form class="day__add" data-add>
        <input name="title" maxlength="200" placeholder="${esc(t('adventure.addPlaceholder'))}" aria-label="${esc(t('adventure.addLabel'))}" />
        <button class="btn btn--line" type="submit">${icon('plus', { size: 16 })} ${esc(t('adventure.add'))}</button>
      </form>
      <a class="day__map-link" href="/">${icon('pin', { size: 16 })} ${esc(t('adventure.openMap'))}</a>
    </div>
    <aside class="day__aside">
      ${photo ? `<figure class="print taped day__photo"><img src="${esc(photo.src)}" alt="" /></figure>` : ''}
    </aside>
  </div>`;
}

/** The whole adventure at a glance: every day in a row, below the selected day. */
function overview() {
  const ideas = itemsOf(adventure, null);
  const line = (item) => `<li class="glance__item ${item.done ? 'is-done' : ''}">
      <span class="glance__time">${esc(item.start_time || '')}</span><span>${esc(item.title)}${item.added_by ? ' <span class="star" title="' + esc(t('share.suggestedBy', { name: item.added_by })) + '">★</span>' : ''}</span></li>`;
  const block = (key, badge, date, theme, items) => `<article class="glance__day ${key === current ? 'is-current' : ''}">
      <button class="glance__badge" type="button" data-pick="${key}" aria-label="${esc(t('adventure.openDay', { day: badge }))}">
        <b>${esc(badge)}</b>${date ? `<span>${esc(date)}</span>` : ''}${key ? weatherMini(weather.get(key)) : ''}</button>
      <div class="glance__body">
        ${theme ? `<h3 class="glance__theme">${esc(theme)}</h3>` : ''}
        ${items.length ? `<ul class="glance__items">${items.map(line).join('')}</ul>` : `<p class="glance__empty">${esc(t('adventure.nothingYet'))}</p>`}
      </div>
    </article>`;
  const credit = days.some((d) => weather.has(d)) ? weatherCredit() : '';
  return `<section class="glance" aria-labelledby="glance-title">
      <h2 id="glance-title" class="glance__title">${esc(t('adventure.overview'))}</h2>
      <div class="glance__days">
        ${days.map((d, i) => block(d, t('adventure.day', { n: i + 1 }), dayTab(d), adventure.days?.[d], itemsOf(adventure, d))).join('')}
        ${ideas.length ? block('', t('adventure.ideas'), '', '', ideas) : ''}
      </div>
      ${credit}
    </section>`;
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
          <button class="btn btn--line btn--small" type="button" data-share aria-expanded="${shareOpen}">${icon('share', { size: 16 })} ${esc(t('adventure.share'))}</button>
          <div class="menu">
            <button class="btn btn--line btn--small btn--square" type="button" data-menu aria-expanded="false" aria-label="${esc(t('adventure.more'))}">${icon('more')}</button>
            <div class="menu__list" hidden>
              <button type="button" data-edit>${icon('edit', { size: 16 })} ${esc(t('adventure.editDetails'))}</button>
              <button type="button" data-ics>${icon('calendarAdd', { size: 16 })} ${esc(t('adventure.calendar'))}</button>
            </div>
          </div>
        </div>
        ${shareBox()}
      </div>
    </section>
    <section class="itinerary" aria-labelledby="itinerary-title">
      <div class="itinerary__bar">
        <h2 id="itinerary-title" class="itinerary__title">${esc(t('adventure.itinerary'))}</h2>
        <div class="day-tabs" role="tablist">
          ${days.map((d, i) => `<button class="day-tab" role="tab" type="button" data-day="${d}" aria-selected="${d === current}">
              <b>${esc(t('adventure.day', { n: i + 1 }))}</b><span>${esc(dayTab(d))}</span>${weatherMini(weather.get(d))}</button>`).join('')}
          <button class="day-tab day-tab--ideas" role="tab" type="button" data-day="" aria-selected="${current === ''}">
            <b>${esc(t('adventure.ideas'))}</b><span>${itemsOf(a, null).length}</span></button>
        </div>
      </div>
      <div class="itinerary__panel" role="tabpanel">${dayPanel()}</div>
    </section>
    ${overview()}
    <section class="trip__map" aria-labelledby="map-title">
      <h2 id="map-title" class="trip__map-title">${esc(t('adventure.mapTitle'))}</h2>
      <div class="mini-map" data-mini-map></div>
      ${current ? hourlyStrip(hourly.get(current), t('weather.hourly', { day: formatDay(current) })) : ''}
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
    if (el.matches('[data-menu]')) {
      const list = el.nextElementSibling;
      list.hidden = !list.hidden;
      el.setAttribute('aria-expanded', String(!list.hidden));
      return;
    }
    root.querySelectorAll('.menu__list').forEach((m) => (m.hidden = true));
    if (el.matches('[data-pick]')) {
      current = el.dataset.pick;
      editing = null;
      render();
      root.querySelector('.itinerary').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      root.querySelector(`[data-day="${current}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (el.matches('[data-toggle-edit]')) {
      const id = el.closest('[data-item]').dataset.item;
      editing = editing === id ? null : id;
      render();
      root.querySelector(`[data-item="${id}"] [data-toggle-edit]`)?.focus();
    } else if (el.matches('[data-day]')) {
      current = el.dataset.day;
      editing = null;
      render();
      root.querySelector(`[data-day="${current}"]`)?.focus();
    } else if (el.matches('[data-edit]')) {
      openAdventureForm(dialog, { adventure, onSaved: reload, onDeleted: () => (location.href = '/adventures') });
    } else if (el.matches('[data-share]') && adventure.share_token) {
      shareOpen = !shareOpen; // the link already exists: just show or hide it
      render();
    } else if (el.matches('[data-share], [data-unshare]')) {
      const { share_token } = await api(`/api/adventures/${adventure.id}/share`, {
        method: 'POST', body: { enabled: el.matches('[data-share]') },
      });
      adventure.share_token = share_token;
      shareOpen = Boolean(share_token);
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
      const ids = [...root.querySelectorAll('.todos [data-item]')].map((li) => li.dataset.item);
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
    const value = field === 'done' ? e.target.checked : e.target.value || (field === 'note' ? '' : null);
    await api(`/api/adventures/${adventure.id}/items/${itemEl.dataset.item}`, { method: 'PATCH', body: { [field]: value } });
    if (field === 'done') itemEl.classList.toggle('is-done', value);
    else await reload(); // time, note and day change the text or the order shown
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

// The forecast arrives after the page: redraw once, keeping the scroll position.
Promise.all([forecast(), hourlyForecast()]).then(([w, h]) => {
  weather = w;
  hourly = h;
  if (adventure && days.some((d) => w.has(d))) {
    const y = scrollY;
    render();
    scrollTo(0, y);
  }
});

load().catch((err) => {
  root.innerHTML = `<p class="trip__missing">${esc(err.message || t('error.generic'))}</p>`;
});
