/* Node test for js/store.js logic. Run: node test/store.test.js */
'use strict';
const { createStore } = require('../js/store');

function mockStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}

// Fixed "now": 2026-10-06 20:00 local.
const NOW = new Date(2026, 9, 6, 20, 0, 0).getTime();
const DAY = 86400000;
const at = (dayOffset, h, m) => {
  const d = new Date(NOW + dayOffset * DAY);
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
};

const store = createStore(mockStorage());

// 1. Cat management
check('rejects empty cat name', store.addCat('   ').ok === false);
const r1 = store.addCat('Mochi');
check('adds a cat', r1.ok && r1.cat.name === 'Mochi');
check('new cat becomes active', store.getActiveCat().id === r1.cat.id);
const r2 = store.addCat('Sesame');
check('adds second cat', r2.ok);
check('switches active cat', store.setActiveCat(r1.cat.id) === true);
check('rejects unknown cat id', store.setActiveCat('nope') === false);

// 2. Logging
const m = r1.cat.id, s = r2.cat.id;
store.setActiveCat(m);
check('logs feeding with fields', store.log('feeding', { ts: at(0, 8), amount: 60, foodType: 'wet', note: 'inhaled it' }).ok);
store.log('feeding', { ts: at(0, 18), amount: 50, foodType: 'dry' });
store.log('water', { ts: at(0, 9) });
store.log('weight', { ts: at(-2, 10), value: 4.2 });
store.log('weight', { ts: at(0, 10), value: 4.35 });
store.log('feeding', { ts: at(-1, 8), amount: 55, foodType: 'dry' });
store.log('feeding', { ts: at(-2, 8), amount: 55, foodType: 'dry' });
store.log('litter', { ts: at(-1, 12) });
check('rejects bad entry type', store.log('nap', {}).ok === false);
check('entriesFor filters by cat', store.entriesFor(m).length === 8);
store.setActiveCat(s);
store.log('feeding', { ts: at(0, 8), amount: 40, foodType: 'dry' });
check('entries are per-cat', store.entriesFor(s).length === 1 && store.entriesFor(m).length === 8);
store.setActiveCat(m);

// 3. Streak: Mochi has entries on day -2, -1, 0 -> streak 3
check('streak counts consecutive days', store.streakDays(m, NOW) === 3);
// Sesame only today -> streak 1
check('single-day streak is 1', store.streakDays(s, NOW) === 1);
// Gap case: separate store, entries day -3 and day -1 (missing -2) -> streak 1
const store2 = createStore(mockStorage());
const c3 = store2.addCat('Gap').cat;
store2.log('feeding', { ts: at(-3, 8), amount: 10, foodType: 'dry' });
store2.log('feeding', { ts: at(-1, 8), amount: 10, foodType: 'dry' });
check('gap breaks streak (today empty, yesterday logged)', store2.streakDays(c3.id, NOW) === 1);
// Nothing logged at all -> 0
const store3 = createStore(mockStorage());
const c4 = store3.addCat('Ghost').cat;
check('no entries means streak 0', store3.streakDays(c4.id, NOW) === 0);

// 4. Feedings per day (last 3 days): day-2:1, day-1:1, day0:2
const fb = store.feedingsByDay(m, 3, NOW);
check('feedingsByDay length', fb.length === 3);
check('feedingsByDay counts', fb[0].count === 1 && fb[1].count === 1 && fb[2].count === 2);

// 5. Weight points sorted oldest first, unit conversion
const pts = store.weightPoints(m);
check('weight points sorted', pts.length === 2 && pts[0].kg === 4.2 && pts[1].kg === 4.35);
check('default unit is kg', store.getUnit() === 'kg');
store.setUnit('lb');
const disp = store.toDisplayWeight(4.2);
check('kg->lb conversion', Math.abs(disp - 9.259) < 0.01);
check('lb->kg conversion', Math.abs(store.toKg(disp) - 4.2) < 0.001);
check('rejects bad unit', store.setUnit('stone') === false && store.getUnit() === 'lb');
store.setUnit('kg');

// 6. Export / import round-trip
const json = store.exportData();
const store4 = createStore(mockStorage());
const imp = store4.importData(json);
check('import round-trip ok', imp.ok && imp.cats === 2 && imp.entries === 9);
check('imported streak matches', store4.streakDays(m, NOW) === 3);
check('imported photo/name intact', store4.getCat(m).name === 'Mochi');

// 7. Import rejects garbage
['not json', '{"cats":[]}', '{"cats":[],"entries":[{"id":1}]}', '[]', 'null'].forEach((bad, i) => {
  check('import rejects garbage #' + i, store4.importData(bad).ok === false);
});
check('state untouched after failed import', store4.entryCount() === 9);

// 8. removeEntry / removeCat
const one = store.entriesFor(m)[0];
check('removeEntry works', store.removeEntry(one.id) === true && store.entryCount() === 8);
store.removeCat(s);
check('removeCat removes cat and its entries', store.listCats().length === 1 && store.entryCount() === 7);

// 9. wipe
store.wipe();
check('wipe clears everything', store.listCats().length === 0 && store.entryCount() === 0 && store.getActiveCat() === null);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
