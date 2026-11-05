// Who is suggesting things through a share link. Guests pick their name once;
// it is remembered in this browser only (a convenience, not an account).
import { t } from './i18n.js';
import { esc } from './ui.js';

const key = (adventureId) => `citybook.guest.${adventureId}`;

/** Names a guest can choose from: the people of the trip, minus the owner. */
export function guestChoices(adventure, owner) {
  const others = (adventure.guests || []).filter((g) => g.trim().toLowerCase() !== (owner || '').trim().toLowerCase());
  return others.length ? others : [t('guest.someone')];
}

export function guestName(adventure, owner) {
  const choices = guestChoices(adventure, owner);
  try {
    const saved = localStorage.getItem(key(adventure.id));
    if (saved && choices.includes(saved)) return saved;
  } catch { /* private browsing: fall back to the first name */ }
  return choices[0];
}

export function setGuestName(adventure, name) {
  try {
    localStorage.setItem(key(adventure.id), name);
  } catch { /* not remembered, still used for this page */ }
}

/** "You are Chilly" line, with a picker when several friends share the link. */
export function guestPicker(adventure, owner, current) {
  const choices = guestChoices(adventure, owner);
  if (choices.length < 2) return `<p class="guest-id">${esc(t('guest.youAre', { name: current }))}</p>`;
  return `<label class="guest-id">${esc(t('guest.youArePicker'))}
    <select data-guest>${choices.map((c) => `<option ${c === current ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`;
}
