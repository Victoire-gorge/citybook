// Renders an adventure day by day. Used by the editable page and the read-only share page.
import { t, formatDay, formatRange } from './i18n.js';
import { cutout, esc } from './ui.js';

export function daysBetween(start, end) {
  const days = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && days.length < 60) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function itemHtml(item, days, editable) {
  const title = item.place_id
    ? `<a href="/#${esc(item.place_id)}">${esc(item.title)}</a>`
    : item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title);
  if (!editable) {
    return `<li class="item">
      <span class="item__time">${esc(item.start_time || '')}</span>
      <div><p class="item__title">${title}</p>${item.note ? `<p class="item__note">${esc(item.note)}</p>` : ''}</div>
    </li>`;
  }
  return `<li class="item" data-item="${esc(item.id)}">
    <label class="item__time"><span class="visually-hidden">${esc(t('adventure.time'))}</span>
      <input type="time" value="${esc(item.start_time || '')}" data-field="start_time" /></label>
    <div>
      <p class="item__title">${title}</p>
      <input class="item__note-input" value="${esc(item.note)}" maxlength="1000" data-field="note" aria-label="Note" placeholder="…" />
    </div>
    <div class="item__tools">
      <label><span class="visually-hidden">${esc(t('adventure.moveTo'))}</span>
        <select data-field="day">
          <option value="">${esc(t('adventure.ideas'))}</option>
          ${days.map((d) => `<option value="${d}" ${d === item.day ? 'selected' : ''}>${esc(formatDay(d))}</option>`).join('')}
        </select></label>
      <button class="link-button" type="button" data-remove>${esc(t('adventure.remove'))}</button>
    </div>
  </li>`;
}

function dayHtml(day, items, days, editable) {
  const label = day ? formatDay(day) : t('adventure.ideas');
  const body = items.length
    ? `<ol class="day__items">${items.map((i) => itemHtml(i, days, editable)).join('')}</ol>`
    : editable && day ? `<p class="day__empty muted">${esc(t('adventure.emptyDay'))}</p>` : '';
  const add = editable
    ? `<form class="day__add" data-add="${esc(day || '')}">
        <input name="title" maxlength="200" placeholder="${esc(t('adventure.addPlaceholder'))}" aria-label="${esc(t('adventure.addNote'))}" />
        <button class="btn btn--quiet" type="submit">${esc(t('adventure.add'))}</button>
      </form>`
    : '';
  return `<section class="day card ${day ? '' : 'day--ideas'}"><h2 class="day__title hand">${esc(label)}</h2>${body}${add}</section>`;
}

export function renderTrip(root, adventure, { editable = false, toolbar = '' } = {}) {
  document.body.dataset.palette = adventure.palette;
  document.title = `${adventure.title} · citybook`;
  const days = daysBetween(adventure.starts_on, adventure.ends_on);
  const ideas = adventure.items.filter((i) => !i.day || !days.includes(i.day));
  const guests = adventure.guests.join(' & ');
  root.innerHTML = `
    <header class="trip__head gingham torn">
      <figure class="trip__cover polaroid taped">
        ${adventure.cover ? `<img class="polaroid__photo" src="${esc(adventure.cover)}" alt="${esc(guests)}" />` : '<div class="polaroid__photo trip__cover-blank"></div>'}
        ${guests ? `<figcaption class="polaroid__caption">${esc(guests)}</figcaption>` : ''}
      </figure>
      <div class="trip__intro">
        <h1 data-title></h1>
        ${adventure.subtitle ? `<p class="trip__subtitle hand">${esc(adventure.subtitle)}</p>` : ''}
        <p class="trip__dates">${esc(formatRange(adventure.starts_on, adventure.ends_on))} · ${esc(adventure.party_size === 1 ? t('adventures.person') : t('adventures.people', { n: adventure.party_size }))}</p>
        <div class="trip__toolbar">${toolbar}</div>
      </div>
    </header>
    <div class="trip__days">
      ${editable || ideas.length ? dayHtml(null, ideas, days, editable) : ''}
      ${days.map((d) => dayHtml(d, adventure.items.filter((i) => i.day === d), days, editable)).join('')}
    </div>`;
  root.querySelector('[data-title]').append(cutout(adventure.title, { size: 'l' }));
}
