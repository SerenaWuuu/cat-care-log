/* Cat Care Log: data layer.
 * Local-first. All state lives in localStorage under one key.
 * Written to run in the browser AND in Node (pass a storage shim),
 * so the logic can be unit tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CatCareStore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'cat-care-log/v1';
  var ENTRY_TYPES = ['feeding', 'water', 'weight', 'litter', 'vet', 'med'];
  var FOOD_TYPES = ['dry', 'wet', 'treat', 'raw', 'other'];
  var KG_TO_LB = 2.20462;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Local calendar day key, YYYY-MM-DD. Local time on purpose: the cat
  // lives in your timezone, not UTC.
  function dayKey(ts) {
    var d = new Date(ts);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function blankState() {
    return { version: 1, unit: 'kg', cats: [], activeCatId: null, entries: [] };
  }

  function isValidEntryType(t) {
    return ENTRY_TYPES.indexOf(t) !== -1;
  }

  function createStore(storage) {
    var state = blankState();

    function save() {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // Quota exceeded (giant photo, etc). Caller surfaces a friendly error.
        throw new Error('storage_full');
      }
    }

    function load() {
      var raw = null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch (e) {
        raw = null;
      }
      if (!raw) {
        state = blankState();
        return;
      }
      try {
        var parsed = JSON.parse(raw);
        var checked = validateState(parsed);
        state = checked.ok ? checked.state : blankState();
      } catch (e) {
        state = blankState();
      }
    }

    // Normalize + validate an imported or loaded blob. Never throws.
    function validateState(s) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        return { ok: false, error: 'not_an_object' };
      }
      if (!Array.isArray(s.cats) || !Array.isArray(s.entries)) {
        return { ok: false, error: 'missing_arrays' };
      }
      var cats = [];
      for (var i = 0; i < s.cats.length; i++) {
        var c = s.cats[i];
        if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || !c.name.trim()) {
          return { ok: false, error: 'bad_cat' };
        }
        cats.push({
          id: c.id,
          name: c.name.trim().slice(0, 40),
          photo: typeof c.photo === 'string' ? c.photo : null,
          birthday: typeof c.birthday === 'string' ? c.birthday : null,
          createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now()
        });
      }
      var entries = [];
      for (var j = 0; j < s.entries.length; j++) {
        var e = s.entries[j];
        if (!e || typeof e.id !== 'string' || typeof e.catId !== 'string' ||
            !isValidEntryType(e.type) || typeof e.ts !== 'number') {
          return { ok: false, error: 'bad_entry' };
        }
        entries.push({
          id: e.id,
          catId: e.catId,
          type: e.type,
          ts: e.ts,
          amount: typeof e.amount === 'number' ? e.amount : null,
          foodType: typeof e.foodType === 'string' ? e.foodType : null,
          value: typeof e.value === 'number' ? e.value : null,
          note: typeof e.note === 'string' ? e.note.slice(0, 280) : null
        });
      }
      var unit = s.unit === 'lb' ? 'lb' : 'kg';
      var activeCatId = typeof s.activeCatId === 'string' ? s.activeCatId : null;
      var ids = {};
      cats.forEach(function (c) { ids[c.id] = true; });
      if (activeCatId && !ids[activeCatId]) activeCatId = cats.length ? cats[0].id : null;
      entries.sort(function (a, b) { return b.ts - a.ts; });
      return { ok: true, state: { version: 1, unit: unit, cats: cats, activeCatId: activeCatId, entries: entries } };
    }

    function getCat(id) {
      for (var i = 0; i < state.cats.length; i++) {
        if (state.cats[i].id === id) return state.cats[i];
      }
      return null;
    }

    function ensureActive() {
      if (!getCat(state.activeCatId) && state.cats.length) {
        state.activeCatId = state.cats[0].id;
      }
    }

    var api = {
      ENTRY_TYPES: ENTRY_TYPES,
      FOOD_TYPES: FOOD_TYPES,

      load: load,
      save: save,

      listCats: function () {
        return state.cats.slice();
      },

      getCat: getCat,

      getActiveCat: function () {
        ensureActive();
        return getCat(state.activeCatId);
      },

      getActiveCatId: function () {
        ensureActive();
        return state.activeCatId;
      },

      addCat: function (name) {
        var clean = String(name || '').trim().slice(0, 40);
        if (!clean) return { ok: false, error: 'name_required' };
        var cat = { id: uid(), name: clean, photo: null, birthday: null, createdAt: Date.now() };
        state.cats.push(cat);
        state.activeCatId = cat.id;
        save();
        return { ok: true, cat: cat };
      },

      setActiveCat: function (id) {
        if (!getCat(id)) return false;
        state.activeCatId = id;
        save();
        return true;
      },

      updateCat: function (id, patch) {
        var cat = getCat(id);
        if (!cat) return false;
        if (patch.name !== undefined) {
          var clean = String(patch.name).trim().slice(0, 40);
          if (!clean) return false;
          cat.name = clean;
        }
        if (patch.photo !== undefined) cat.photo = patch.photo || null;
        if (patch.birthday !== undefined) cat.birthday = patch.birthday || null;
        save();
        return true;
      },

      removeCat: function (id) {
        var before = state.cats.length;
        state.cats = state.cats.filter(function (c) { return c.id !== id; });
        state.entries = state.entries.filter(function (e) { return e.catId !== id; });
        if (state.activeCatId === id) {
          state.activeCatId = state.cats.length ? state.cats[0].id : null;
        }
        save();
        return state.cats.length < before;
      },

      log: function (type, fields) {
        if (!isValidEntryType(type)) return { ok: false, error: 'bad_type' };
        ensureActive();
        if (!state.activeCatId) return { ok: false, error: 'no_cat' };
        fields = fields || {};
        var entry = {
          id: uid(),
          catId: state.activeCatId,
          type: type,
          ts: typeof fields.ts === 'number' ? fields.ts : Date.now(),
          amount: typeof fields.amount === 'number' ? fields.amount : null,
          foodType: typeof fields.foodType === 'string' ? fields.foodType : null,
          value: typeof fields.value === 'number' ? fields.value : null,
          note: typeof fields.note === 'string' && fields.note.trim() ? fields.note.trim().slice(0, 280) : null
        };
        state.entries.unshift(entry);
        save();
        return { ok: true, entry: entry };
      },

      removeEntry: function (id) {
        var before = state.entries.length;
        state.entries = state.entries.filter(function (e) { return e.id !== id; });
        if (state.entries.length < before) {
          save();
          return true;
        }
        return false;
      },

      entriesFor: function (catId, opts) {
        opts = opts || {};
        return state.entries.filter(function (e) {
          if (e.catId !== catId) return false;
          if (opts.type && e.type !== opts.type) return false;
          if (opts.from && e.ts < opts.from) return false;
          if (opts.to && e.ts > opts.to) return false;
          return true;
        });
      },

      entriesOnDay: function (catId, ts) {
        var start = startOfDay(ts);
        return api.entriesFor(catId, { from: start, to: start + 86400000 - 1 });
      },

      // Consecutive days with at least one entry, counting back from today.
      // If today is still empty, yesterday counts as the current end.
      streakDays: function (catId, nowTs) {
        var now = typeof nowTs === 'number' ? nowTs : Date.now();
        var daysWithLogs = {};
        state.entries.forEach(function (e) {
          if (e.catId === catId) daysWithLogs[dayKey(e.ts)] = true;
        });
        var cursor = startOfDay(now);
        if (!daysWithLogs[dayKey(cursor)]) cursor -= 86400000;
        var streak = 0;
        while (daysWithLogs[dayKey(cursor)]) {
          streak++;
          cursor -= 86400000;
        }
        return streak;
      },

      // Last `days` days of feeding counts, oldest first.
      feedingsByDay: function (catId, days, nowTs) {
        var now = typeof nowTs === 'number' ? nowTs : Date.now();
        var out = [];
        for (var i = days - 1; i >= 0; i--) {
          var ts = startOfDay(now) - i * 86400000;
          var count = 0;
          state.entries.forEach(function (e) {
            if (e.catId === catId && e.type === 'feeding' &&
                e.ts >= ts && e.ts < ts + 86400000) {
              count++;
            }
          });
          out.push({ key: dayKey(ts), ts: ts, count: count });
        }
        return out;
      },

      // Weight points in kg, oldest first.
      weightPoints: function (catId) {
        return state.entries
          .filter(function (e) {
            return e.catId === catId && e.type === 'weight' && typeof e.value === 'number';
          })
          .map(function (e) { return { ts: e.ts, kg: e.value }; })
          .sort(function (a, b) { return a.ts - b.ts; });
      },

      getUnit: function () { return state.unit; },

      setUnit: function (unit) {
        if (unit !== 'kg' && unit !== 'lb') return false;
        state.unit = unit;
        save();
        return true;
      },

      toDisplayWeight: function (kg) {
        if (typeof kg !== 'number') return null;
        return state.unit === 'lb' ? kg * KG_TO_LB : kg;
      },

      toKg: function (value) {
        if (typeof value !== 'number') return null;
        return state.unit === 'lb' ? value / KG_TO_LB : value;
      },

      exportData: function () {
        return JSON.stringify(state, null, 2);
      },

      importData: function (jsonStr) {
        var parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          return { ok: false, error: 'not_json' };
        }
        var checked = validateState(parsed);
        if (!checked.ok) return { ok: false, error: checked.error };
        state = checked.state;
        save();
        return { ok: true, cats: state.cats.length, entries: state.entries.length };
      },

      wipe: function () {
        state = blankState();
        save();
      },

      entryCount: function () {
        return state.entries.length;
      }
    };

    load();
    return api;
  }

  return {
    createStore: createStore,
    STORAGE_KEY: STORAGE_KEY,
    ENTRY_TYPES: ENTRY_TYPES,
    FOOD_TYPES: FOOD_TYPES
  };
});
