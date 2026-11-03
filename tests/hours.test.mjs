import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHours, openStatus, parisClock, hoursForDay } from '../src/lib/hours.js';

test('parses day lists and ranges', () => {
  const rows = parseHours('Mo,Th 09:00-18:00; We-Fr 10:00-21:00');
  assert.deepEqual(
    rows.map((r) => r.weekday),
    [1, 4, 3, 4, 5],
  );
  assert.equal(rows[2].closes, '21:00');
});

test('wrapping range Sa-Mo', () => {
  assert.deepEqual(
    parseHours('Sa-Mo 10:00-12:00').map((r) => r.weekday),
    [6, 7, 1],
  );
});

test('rejects nonsense', () => {
  assert.throws(() => parseHours('every day'));
  assert.throws(() => parseHours('Xx 10:00-12:00'));
});

test('open and closed', () => {
  const rows = parseHours('Tu-Su 10:00-18:00');
  assert.deepEqual(openStatus(rows, { weekday: 2, minutes: 11 * 60 }), { state: 'open', until: '18:00' });
  assert.equal(openStatus(rows, { weekday: 2, minutes: 18 * 60 }).state, 'closed');
  assert.equal(openStatus(rows, { weekday: 1, minutes: 11 * 60 }).state, 'closed');
  assert.equal(openStatus([], { weekday: 1, minutes: 0 }).state, 'unknown');
});

test('slot after midnight', () => {
  const rows = parseHours('Fr 20:00-02:00');
  assert.equal(openStatus(rows, { weekday: 5, minutes: 23 * 60 }).state, 'open');
  assert.equal(openStatus(rows, { weekday: 6, minutes: 60 }).state, 'open');
  assert.equal(openStatus(rows, { weekday: 6, minutes: 3 * 60 }).state, 'closed');
});

test('Paris clock follows daylight saving', () => {
  // 2026-11-03 is a Tuesday; 11:00 UTC is 12:00 in Paris (winter time).
  assert.deepEqual(parisClock(new Date('2026-11-03T11:00:00Z')), { weekday: 2, minutes: 12 * 60 });
  // In July Paris is UTC+2.
  assert.deepEqual(parisClock(new Date('2026-07-01T22:30:00Z')), { weekday: 4, minutes: 30 });
});

test('hours for a day', () => {
  const rows = parseHours('We 14:00-18:00; We 09:00-12:00');
  assert.deepEqual(hoursForDay(rows, 3), ['09:00–12:00', '14:00–18:00']);
});
