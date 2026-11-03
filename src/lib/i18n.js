import en from '../i18n/en.js';

// Add a language: import its dictionary and list it here.
const dictionaries = { en };
export const languages = Object.keys(dictionaries);

let current = 'en';
export function setLanguage(lang) {
  if (dictionaries[lang]) {
    current = lang;
    document.documentElement.lang = lang;
  }
}
export const language = () => current;

/** Interface text: t('place.open', { time: '18:00' }). Falls back to English, then to the key. */
export function t(key, vars = {}) {
  const s = dictionaries[current][key] ?? en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

/** Content from the database: base column (English) or its translation if there is one. */
export function tr(record, field) {
  return record?.translations?.[current]?.[field] || record?.[field] || '';
}

/** Fills elements marked data-i18n="key" (text) and data-i18n-placeholder / -label. */
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  root.querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
}

const fmt = (opts) => new Intl.DateTimeFormat(current === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', ...opts });
const asDate = (iso) => new Date(`${iso}T00:00:00Z`);
export const formatDay = (iso) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(asDate(iso));
export const formatShort = (iso) => fmt({ day: 'numeric', month: 'short' }).format(asDate(iso));
export const formatTab = (iso) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(asDate(iso));
/** "15 – 22 Nov", or "28 Nov – 3 Dec" across months. */
export function formatRange(a, b) {
  if (a === b) return formatShort(a);
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  const start = sameMonth ? fmt({ day: 'numeric' }).format(asDate(a)) : formatShort(a);
  return `${start} – ${formatShort(b)}`;
}
