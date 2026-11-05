// Daily forecast from Open-Meteo: free, open data, no API key (credit: Open-Meteo.com, CC BY 4.0).
// Forecasts reach about 16 days ahead; later days simply have no weather yet.
import { t } from './i18n.js';
import { esc } from './ui.js';
import { icon } from './icons.js';

const PARIS = { lat: 48.8566, lng: 2.3522 };
let cache = null;

/** Map of 'YYYY-MM-DD' -> { code, max, min, rain } for the next 16 days in Paris. */
export async function forecast({ lat, lng } = PARIS) {
  if (cache) return cache;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=Europe%2FParis&forecast_days=16';
  cache = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(r)))
    .then(({ daily }) => new Map(daily.time.map((day, i) => [day, {
      code: daily.weather_code[i],
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
      rain: daily.precipitation_probability_max[i],
    }])))
    .catch(() => new Map()); // no forecast is not an error worth showing
  return cache;
}

/** WMO weather code -> icon and label key. */
export function describe(code) {
  if (code === 0) return ['sun', 'weather.clear'];
  if (code <= 2) return ['partly', 'weather.partly'];
  if (code === 3) return ['cloud', 'weather.cloudy'];
  if (code === 45 || code === 48) return ['fog', 'weather.fog'];
  if (code >= 51 && code <= 57) return ['rain', 'weather.drizzle'];
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ['rain', 'weather.rain'];
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['snow', 'weather.snow'];
  if (code >= 95) return ['storm', 'weather.storm'];
  return ['cloud', 'weather.cloudy'];
}

/** Small "☀ 12°" for tabs and badges. */
export function weatherMini(w) {
  if (!w) return '';
  const [ic, label] = describe(w.code);
  return `<span class="wx wx--mini" title="${esc(t(label))}, ${w.min}–${w.max}°C">${icon(ic, { size: 15 })}${w.max}°</span>`;
}

/** Full line for a day: icon, label, min–max, chance of rain. */
export function weatherLine(w) {
  if (!w) return '';
  const [ic, label] = describe(w.code);
  return `<p class="wx">${icon(ic, { size: 20 })}<span>${esc(t(label))}</span>
    <span class="wx__temp">${w.min}° / ${w.max}°C</span>
    ${w.rain != null ? `<span class="wx__rain">${esc(t('weather.rainChance', { n: w.rain }))}</span>` : ''}</p>`;
}

export const weatherCredit = () =>
  `<p class="wx-credit">${esc(t('weather.credit'))} <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>`;

let hourlyCache = null;

/** Map of 'YYYY-MM-DD' -> [{ hour: 'HH:00', temp, code, rain }] for the next 16 days in Paris. */
export async function hourlyForecast({ lat, lng } = PARIS) {
  if (hourlyCache) return hourlyCache;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
    + '&hourly=temperature_2m,weather_code,precipitation_probability'
    + '&timezone=Europe%2FParis&forecast_days=16';
  hourlyCache = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(r)))
    .then(({ hourly }) => {
      const byDay = new Map();
      hourly.time.forEach((stamp, i) => {
        const [day, time] = stamp.split('T');
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push({
          hour: time.slice(0, 5),
          temp: Math.round(hourly.temperature_2m[i]),
          code: hourly.weather_code[i],
          rain: hourly.precipitation_probability[i],
        });
      });
      return byDay;
    })
    .catch(() => new Map());
  return hourlyCache;
}

/** Hour-by-hour strip for one day, from 7:00 to 23:00. */
export function hourlyStrip(hours, title) {
  if (!hours?.length) return '';
  const shown = hours.filter((h) => h.hour >= '07:00');
  return `<section class="hourly" aria-label="${esc(title)}">
    <h2 class="hourly__title">${esc(title)}</h2>
    <ol class="hourly__hours">${shown.map((h) => {
      const [ic, label] = describe(h.code);
      return `<li class="hourly__hour ${h.rain >= 50 ? 'is-wet' : ''}" title="${esc(t(label))}">
        <span class="hourly__time">${esc(h.hour)}</span>${icon(ic, { size: 22 })}
        <span class="hourly__temp">${h.temp}°</span>
        <span class="hourly__rain">${h.rain != null ? `${h.rain}%` : ''}</span></li>`;
    }).join('')}</ol>
    ${weatherCredit()}
  </section>`;
}
