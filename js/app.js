/* Cat Care Log: UI wiring. Browser only. */
(function () {
  'use strict';

  var store = CatCareStore.createStore(window.localStorage);

  var TYPE_META = {
    feeding: { icon: '🍽️', title: 'Meal' },
    water: { icon: '💧', title: 'Water' },
    weight: { icon: '⚖️', title: 'Weigh-in' },
    litter: { icon: '💩', title: 'Litter' },
    vet: { icon: '🏥', title: 'Vet visit' },
    med: { icon: '💊', title: 'Meds' }
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtTime(ts) {
    var d = new Date(ts);
    var h = d.getHours(), m = pad(d.getMinutes());
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ap;
  }

  function dayLabel(ts) {
    var now = Date.now();
    var d = new Date(ts), t = new Date(now);
    var dk = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    var tk = t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate();
    var y = new Date(now - 86400000);
    var yk = y.getFullYear() + '-' + y.getMonth() + '-' + y.getDate();
    if (dk === tk) return 'Today';
    if (dk === yk) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function toLocalInputValue(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function parseLocalInputValue(v) {
    var d = new Date(v);
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
  }

  function catAge(birthday) {
    if (!birthday) return null;
    var b = new Date(birthday + 'T00:00:00');
    if (isNaN(b.getTime())) return null;
    var now = new Date();
    var months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (months < 0) return null;
    if (months < 1) return 'just a baby';
    if (months < 12) return months + (months === 1 ? ' month old' : ' months old');
    var yrs = Math.floor(months / 12), rem = months % 12;
    var s = yrs + (yrs === 1 ? ' yr' : ' yrs');
    if (rem) s += ' ' + rem + ' mo';
    return s + ' old';
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg, undoFn) {
    var el = $('#toast');
    el.innerHTML = esc(msg) + (undoFn ? ' <button type="button" id="toastUndo">Undo</button>' : '');
    el.classList.add('show');
    if (undoFn) {
      $('#toastUndo').addEventListener('click', function () {
        undoFn();
        el.classList.remove('show');
      });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ---------- Bottom sheet ---------- */
  function openSheet(title, sub, bodyHTML) {
    $('#sheetTitle').textContent = title;
    $('#sheetSub').textContent = sub || '';
    $('#sheetBody').innerHTML = bodyHTML;
    $('#sheetBackdrop').classList.add('open');
    $('#sheet').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheetBackdrop').classList.remove('open');
    $('#sheet').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ---------- Entry text ---------- */
  function entryMeta(e) {
    var meta = TYPE_META[e.type] || { icon: '🐾', title: 'Log' };
    var unit = store.getUnit();
    var detail = '';
    if (e.type === 'feeding') {
      var parts = [];
      if (typeof e.amount === 'number') parts.push(e.amount + 'g');
      if (e.foodType) parts.push(e.foodType);
      detail = parts.join(' · ');
    } else if (e.type === 'weight') {
      var w = store.toDisplayWeight(e.value);
      detail = (Math.round(w * 10) / 10) + ' ' + unit;
    }
    if (e.note) detail = detail ? detail + ', ' + e.note : e.note;
    return { icon: meta.icon, title: meta.title, detail: detail };
  }

  function entryHTML(e) {
    var m = entryMeta(e);
    return '<div class="entry" data-id="' + e.id + '">' +
      '<span class="e">' + m.icon + '</span>' +
      '<div class="body"><div class="title">' + esc(m.title) + '</div>' +
      (m.detail ? '<div class="meta">' + esc(m.detail) + ' · ' + fmtTime(e.ts) + '</div>'
                : '<div class="meta">' + fmtTime(e.ts) + '</div>') +
      '</div><button class="del" aria-label="Delete entry">×</button></div>';
  }

  function bindEntryDeletes(container) {
    container.querySelectorAll('.entry .del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.closest('.entry').getAttribute('data-id');
        store.removeEntry(id);
        refresh();
        toast('Entry deleted. No take-backs from the cat.');
      });
    });
  }

  /* ---------- Rendering ---------- */
  function currentCat() { return store.getActiveCat(); }

  function renderHeader() {
    var cat = currentCat();
    var avatar = $('#avatar');
    var nameEl = $('#catName');
    if (!cat) {
      avatar.innerHTML = '🐱';
      nameEl.textContent = 'Cat Care Log';
    } else {
      avatar.innerHTML = cat.photo ? '<img src="' + cat.photo + '" alt="">' : '🐱';
      nameEl.textContent = cat.name;
    }
    var d = new Date();
    $('#dateLine').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var streak = cat ? store.streakDays(cat.id) : 0;
    $('#streakPill').innerHTML = streak > 0 ? '🔥 ' + streak + (streak === 1 ? ' day' : ' days') : '🐾 start today';
  }

  function streakCopy(n) {
    if (n <= 0) return 'No streak yet. Log something today and the counter starts purring.';
    if (n === 1) return 'One day logged. Every legend starts somewhere.';
    return n + ' day logging streak. The cat has noticed your devotion.';
  }

  function renderToday() {
    var cat = currentCat();
    var list = $('#todayList');
    if (!cat) { list.innerHTML = ''; return; }
    var entries = store.entriesOnDay(cat.id, Date.now());
    if (!entries.length) {
      list.innerHTML = '<div class="empty"><div class="big">🐱</div>' +
        '<p><strong>Nothing logged today.</strong></p>' +
        '<p>Tap a button above. It takes three taps and the cat will respect you.</p></div>';
      return;
    }
    list.innerHTML = '<div class="day-group"><div class="day-label">Today</div>' +
      entries.map(entryHTML).join('') + '</div>';
    bindEntryDeletes(list);
  }

  function renderTrends() {
    var cat = currentCat();
    var banner = $('#streakBanner');
    if (!cat) { banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    var n = store.streakDays(cat.id);
    $('#streakText').textContent = streakCopy(n);
    $('#streakNum').textContent = n > 0 ? n : '–';

    var pts = store.weightPoints(cat.id);
    CatCharts.renderWeight($('#weightChart'), pts, store.getUnit(), function (kg) { return store.toDisplayWeight(kg); });

    var days = store.feedingsByDay(cat.id, 7);
    CatCharts.renderFeedings($('#feedingChart'), days);

    var box = $('#weekTimeline');
    var from = Date.now() - 6 * 86400000;
    var entries = store.entriesFor(cat.id, { from: new Date(new Date().setHours(0,0,0,0)).getTime() - 6 * 86400000 });
    if (!entries.length) {
      box.innerHTML = '<div class="empty"><div class="big">📓</div>' +
        '<p><strong>A blank week.</strong></p><p>The journal is empty and the cat is judging you.</p></div>';
      return;
    }
    var groups = {};
    entries.forEach(function (e) {
      var k = dayLabel(e.ts);
      (groups[k] = groups[k] || []).push(e);
    });
    var order = [];
    var seen = {};
    entries.forEach(function (e) {
      var k = dayLabel(e.ts);
      if (!seen[k]) { seen[k] = true; order.push(k); }
    });
    box.innerHTML = order.map(function (k) {
      return '<div class="day-group"><div class="day-label">' + esc(k) + '</div>' +
        groups[k].map(entryHTML).join('') + '</div>';
    }).join('');
    bindEntryDeletes(box);
  }

  function renderCatsTab() {
    var cats = store.listCats();
    var activeId = store.getActiveCatId();
    var chips = cats.map(function (c) {
      var pic = c.photo ? '<img src="' + c.photo + '" alt="">' : '🐱';
      return '<button class="cat-chip' + (c.id === activeId ? ' sel' : '') + '" data-id="' + c.id + '">' +
        '<span class="mini">' + pic + '</span>' + esc(c.name) + '</button>';
    }).join('');
    chips += '<button class="cat-chip add" id="addCatChip">＋ Add cat</button>';
    $('#catChips').innerHTML = chips;
    $$('#catChips .cat-chip[data-id]').forEach(function (b) {
      b.addEventListener('click', function () {
        store.setActiveCat(b.getAttribute('data-id'));
        refresh();
        toast('Now tracking ' + store.getActiveCat().name + '.');
      });
    });
    $('#addCatChip').addEventListener('click', openAddCat);

    var cat = currentCat();
    var prof = $('#profileCard');
    if (!cat) {
      prof.innerHTML = '<div class="empty"><div class="big">🐈</div><p><strong>No cats yet.</strong></p><p>Add your first cat to start the journal.</p></div>';
      return;
    }
    var total = store.entriesFor(cat.id).length;
    var streak = store.streakDays(cat.id);
    var age = catAge(cat.birthday);
    prof.innerHTML =
      '<div class="profile-top">' +
        '<div class="profile-photo" id="profilePhoto">' +
          (cat.photo ? '<img src="' + cat.photo + '" alt="">' : '🐱') +
          '<span class="cam">📷</span></div>' +
        '<div style="flex:1"><h2 style="margin-bottom:0.15rem">' + esc(cat.name) + '</h2>' +
        '<p class="hint" style="margin:0">' + (age ? esc(age) : 'Age unknown, mysterious like all cats') + '</p></div>' +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="stat"><div class="v">' + total + '</div><div class="k">logs</div></div>' +
        '<div class="stat"><div class="v">' + streak + '</div><div class="k">day streak</div></div>' +
        '<div class="stat"><div class="v">' + store.feedingsByDay(cat.id, 1)[0].count + '</div><div class="k">meals today</div></div>' +
      '</div>' +
      '<div class="btn-row"><button class="btn btn-ghost" id="editProfile">Edit profile</button>' +
      '<button class="btn btn-ghost" id="removeCat">Remove cat</button></div>' +
      '<input type="file" id="photoInput" accept="image/*" style="display:none">';
    $('#editProfile').addEventListener('click', openEditProfile);
    $('#removeCat').addEventListener('click', function () {
      openSheet('Remove ' + cat.name + '?',
        'This deletes the cat and every log attached to it.',
        '<div class="btn-row"><button class="btn btn-ghost" id="cancelRemove">Keep ' + esc(cat.name) + '</button>' +
        '<button class="btn btn-danger" id="confirmRemove">Remove</button></div>');
      $('#cancelRemove').addEventListener('click', closeSheet);
      $('#confirmRemove').addEventListener('click', function () {
        store.removeCat(cat.id);
        closeSheet();
        refresh();
        toast('Cat removed. The remaining cats send their regards.');
      });
    });
    $('#profilePhoto').addEventListener('click', function () { $('#photoInput').click(); });
    $('#photoInput').addEventListener('change', handlePhotoUpload);
  }

  function refresh() {
    renderHeader();
    renderToday();
    renderCatsTab();
    if ($('#tab-trends').classList.contains('active')) renderTrends();
  }

  /* ---------- Quick log actions ---------- */
  function instantLog(type, successMsg) {
    var res = store.log(type, {});
    if (!res.ok) { toast('Could not log. The cat is unimpressed.'); return; }
    var id = res.entry.id;
    refresh();
    toast(successMsg, function () {
      store.removeEntry(id);
      refresh();
      toast('Undone. Like it never happened.');
    });
  }

  function timeField() {
    return '<div class="field"><label>When</label>' +
      '<input type="datetime-local" id="fTime" value="' + toLocalInputValue(Date.now()) + '"></div>';
  }

  function noteField(ph) {
    return '<div class="field"><label>Note (optional)</label>' +
      '<input type="text" id="fNote" maxlength="120" placeholder="' + esc(ph) + '"></div>';
  }

  function lastFeedingPrefs() {
    var cat = currentCat();
    var past = cat ? store.entriesFor(cat.id, { type: 'feeding' }) : [];
    return {
      amount: past.length && typeof past[0].amount === 'number' ? past[0].amount : 50,
      foodType: past.length && past[0].foodType ? past[0].foodType : 'dry'
    };
  }

  function openFeeding() {
    var prefs = lastFeedingPrefs();
    var chips = CatCareStore.FOOD_TYPES.map(function (f) {
      return '<button type="button" class="chip' + (f === prefs.foodType ? ' sel' : '') + '" data-v="' + f + '">' + f + '</button>';
    }).join('');
    openSheet('Log a meal', 'Three taps and dinner is documented.',
      '<div class="field"><label>Amount (grams)</label><div class="stepper">' +
      '<button type="button" id="amtDown">−</button>' +
      '<input type="number" id="fAmount" value="' + prefs.amount + '" min="0" max="2000" inputmode="numeric">' +
      '<button type="button" id="amtUp">＋</button></div></div>' +
      '<div class="field"><label>Food type</label><div class="chips" id="foodChips">' + chips + '</div></div>' +
      timeField() + noteField('e.g. inhaled it in 30 seconds') +
      '<button class="btn btn-primary btn-block" id="saveFeeding">Log meal 🍽️</button>');
    var amt = $('#fAmount');
    $('#amtDown').addEventListener('click', function () { amt.value = Math.max(0, (parseInt(amt.value, 10) || 0) - 10); });
    $('#amtUp').addEventListener('click', function () { amt.value = Math.min(2000, (parseInt(amt.value, 10) || 0) + 10); });
    var foodType = prefs.foodType;
    $$('#foodChips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        $$('#foodChips .chip').forEach(function (x) { x.classList.remove('sel'); });
        c.classList.add('sel');
        foodType = c.getAttribute('data-v');
      });
    });
    $('#saveFeeding').addEventListener('click', function () {
      var res = store.log('feeding', {
        amount: Math.max(0, parseInt(amt.value, 10) || 0),
        foodType: foodType,
        ts: parseLocalInputValue($('#fTime').value),
        note: $('#fNote').value
      });
      closeSheet();
      if (res.ok) { refresh(); toast('Meal logged. The bowl is empty, the cat is smug.'); }
    });
  }

  function lastWeight() {
    var cat = currentCat();
    var pts = cat ? store.weightPoints(cat.id) : [];
    if (!pts.length) return null;
    return store.toDisplayWeight(pts[pts.length - 1].kg);
  }

  function openWeight() {
    var unit = store.getUnit();
    var last = lastWeight();
    openSheet('Log weight', 'The scale never lies. The cat disagrees.',
      '<div class="field"><label>Unit</label><div class="chips" id="unitChips">' +
      '<button type="button" class="chip' + (unit === 'kg' ? ' sel' : '') + '" data-v="kg">kg</button>' +
      '<button type="button" class="chip' + (unit === 'lb' ? ' sel' : '') + '" data-v="lb">lb</button></div></div>' +
      '<div class="field"><label>Weight' + (last != null ? ' (last: ' + (Math.round(last * 10) / 10) + ' ' + unit + ')' : '') + '</label>' +
      '<input type="number" id="fWeight" step="0.1" min="0" max="60" inputmode="decimal" placeholder="e.g. 4.2"></div>' +
      timeField() + noteField('e.g. after breakfast, very round') +
      '<button class="btn btn-primary btn-block" id="saveWeight">Log weight ⚖️</button>');
    var curUnit = unit;
    $$('#unitChips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        $$('#unitChips .chip').forEach(function (x) { x.classList.remove('sel'); });
        c.classList.add('sel');
        curUnit = c.getAttribute('data-v');
        store.setUnit(curUnit);
      });
    });
    $('#saveWeight').addEventListener('click', function () {
      var v = parseFloat($('#fWeight').value);
      if (!(v > 0)) { toast('Enter a weight first. Any number, the cat will dispute it.'); return; }
      var kg = curUnit === 'lb' ? v / 2.20462 : v;
      var res = store.log('weight', { value: Math.round(kg * 100) / 100, ts: parseLocalInputValue($('#fTime').value), note: $('#fNote').value });
      closeSheet();
      if (res.ok) { refresh(); toast('Weight logged. Brave of you.'); }
    });
  }

  function openVet() {
    openSheet('Log vet visit', 'For the record books and the insurance forms.',
      timeField() + noteField('e.g. annual checkup, vaccines') +
      '<button class="btn btn-primary btn-block" id="saveVet">Log vet visit 🏥</button>');
    $('#saveVet').addEventListener('click', function () {
      var res = store.log('vet', { ts: parseLocalInputValue($('#fTime').value), note: $('#fNote').value });
      closeSheet();
      if (res.ok) { refresh(); toast('Vet visit logged. The cat has already forgiven you. Probably.'); }
    });
  }

  function openMed() {
    openSheet('Log medication', 'Pills, drops, or mysterious vet ointments.',
      timeField() + noteField('e.g. flea treatment, half pill') +
      '<button class="btn btn-primary btn-block" id="saveMed">Log medication 💊</button>');
    $('#saveMed').addEventListener('click', function () {
      var res = store.log('med', { ts: parseLocalInputValue($('#fTime').value), note: $('#fNote').value });
      closeSheet();
      if (res.ok) { refresh(); toast('Medication logged. Administered with minimal drama, hopefully.'); }
    });
  }

  /* ---------- Cats: add / edit / photo ---------- */
  function openAddCat() {
    openSheet('Add a cat', 'Every journal needs a protagonist.',
      '<div class="field"><label>Name</label>' +
      '<input type="text" id="newCatName" maxlength="40" placeholder="e.g. Mochi" autocomplete="off"></div>' +
      '<button class="btn btn-primary btn-block" id="saveCat">Add cat 🐱</button>');
    $('#newCatName').focus();
    var save = function () {
      var res = store.addCat($('#newCatName').value);
      if (!res.ok) { toast('Give the cat a name first.'); return; }
      closeSheet();
      refresh();
      toast('Welcome, ' + res.cat.name + '. The journal begins.');
    };
    $('#saveCat').addEventListener('click', save);
    $('#newCatName').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') save(); });
  }

  function openEditProfile() {
    var cat = currentCat();
    if (!cat) return;
    openSheet('Edit profile', 'Keep the records worthy of the cat.',
      '<div class="field"><label>Name</label>' +
      '<input type="text" id="editName" maxlength="40" value="' + esc(cat.name) + '"></div>' +
      '<div class="field"><label>Birthday</label>' +
      '<input type="date" id="editBday" value="' + esc(cat.birthday || '') + '"></div>' +
      '<button class="btn btn-primary btn-block" id="saveProfile">Save profile</button>');
    $('#saveProfile').addEventListener('click', function () {
      var ok = store.updateCat(cat.id, { name: $('#editName').value, birthday: $('#editBday').value || null });
      if (!ok) { toast('The name cannot be empty. The cat insists.'); return; }
      closeSheet();
      refresh();
      toast('Profile updated.');
    });
  }

  function handlePhotoUpload(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    var cat = currentCat();
    if (!file || !cat) return;
    if (!file.type.match(/^image\//)) { toast('That is not a photo. The cat is confused.'); return; }
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var max = 256;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      try {
        store.updateCat(cat.id, { photo: dataUrl });
        refresh();
        toast('Photo updated. Photogenic as ever.');
      } catch (e) {
        toast('Photo is too large to store. Try a smaller one.');
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('Could not read that photo.');
    };
    img.src = url;
  }

  /* ---------- Data: export / import / wipe ---------- */
  function exportData() {
    var blob = new Blob([store.exportData()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cat-care-log-backup.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Backup downloaded. Guard it with your life.');
  }

  function importDataFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var res = store.importData(String(reader.result || ''));
      if (!res.ok) {
        var why = {
          not_json: 'That file is not valid JSON.',
          not_an_object: 'That file does not look like a Cat Care Log backup.',
          missing_arrays: 'That file is missing its cats or entries.',
          bad_cat: 'That file has a damaged cat record.',
          bad_entry: 'That file has a damaged log entry.'
        }[res.error] || 'Could not import that file.';
        toast(why + ' Nothing was changed.');
        return;
      }
      refresh();
      toast('Imported ' + res.cats + (res.cats === 1 ? ' cat' : ' cats') + ' and ' +
        res.entries + (res.entries === 1 ? ' entry' : ' entries') + '. Welcome back.');
    };
    reader.onerror = function () { toast('Could not read that file.'); };
    reader.readAsText(file);
  }

  function openWipeConfirm() {
    openSheet('Erase everything?',
      'This will erase every crumb of data. The cat will never forgive you. Proceed?',
      '<div class="btn-row"><button class="btn btn-ghost" id="keepData">Keep my data</button>' +
      '<button class="btn btn-danger" id="confirmWipe">Erase everything</button></div>');
    $('#keepData').addEventListener('click', closeSheet);
    $('#confirmWipe').addEventListener('click', function () {
      store.wipe();
      closeSheet();
      refresh();
      maybeWelcome();
      toast('All data erased. The cat saw nothing.');
    });
  }

  /* ---------- Welcome (first run) ---------- */
  function maybeWelcome() {
    if (store.listCats().length) return;
    openSheet('Welcome to the log 🐱', 'A tiny journal for the tiny ruler of your house.',
      '<div class="welcome-art">🐈</div>' +
      '<div class="field"><label>What is your cat called?</label>' +
      '<input type="text" id="welcomeName" maxlength="40" placeholder="e.g. Mochi" autocomplete="off"></div>' +
      '<button class="btn btn-primary btn-block" id="welcomeSave">Start logging</button>' +
      '<p class="hint" style="text-align:center;margin-top:0.8rem">Everything stays on this device. No accounts, no cloud, no nonsense.</p>');
    $('#welcomeName').focus();
    var save = function () {
      var res = store.addCat($('#welcomeName').value);
      if (!res.ok) { toast('The cat needs a name to begin.'); return; }
      closeSheet();
      refresh();
      toast('Welcome, ' + res.cat.name + '. Tap a button to log the first entry.');
    };
    $('#welcomeSave').addEventListener('click', save);
    $('#welcomeName').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') save(); });
  }

  /* ---------- Easter egg: purr mode ---------- */
  var avatarTaps = 0, avatarTapTimer = null;
  function armPurrMode() {
    $('#avatar').addEventListener('click', function () {
      avatarTaps++;
      clearTimeout(avatarTapTimer);
      avatarTapTimer = setTimeout(function () { avatarTaps = 0; }, 1600);
      if (avatarTaps >= 7) {
        avatarTaps = 0;
        purrMode();
      }
    });
  }

  function purrMode() {
    var overlay = $('#purrOverlay');
    overlay.innerHTML = '<div class="purr-msg">Purr mode activated. The cat is pleased.</div>';
    for (var i = 0; i < 26; i++) {
      var paw = document.createElement('span');
      paw.className = 'purr-paw';
      paw.textContent = '🐾';
      paw.style.left = (Math.random() * 96) + 'vw';
      paw.style.animationDelay = (Math.random() * 1.4) + 's';
      paw.style.fontSize = (1.1 + Math.random() * 1.4) + 'rem';
      overlay.appendChild(paw);
    }
    overlay.classList.add('on');
    if (navigator.vibrate) { try { navigator.vibrate([60, 40, 60, 40, 120]); } catch (e) {} }
    setTimeout(function () {
      overlay.classList.remove('on');
      setTimeout(function () { overlay.innerHTML = ''; }, 500);
    }, 3400);
  }

  /* ---------- Tabs ---------- */
  function switchTab(name) {
    $$('.tab-bar button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    $$('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
    if (name === 'trends') renderTrends();
    window.scrollTo(0, 0);
  }

  /* ---------- Boot ---------- */
  function boot() {
    $$('.tab-bar button').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    $('#sheetBackdrop').addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeSheet(); });

    var actions = {
      logFeeding: openFeeding,
      logWater: function () { instantLog('water', '💧 Water logged. Hydration is handled.'); },
      logWeight: openWeight,
      logLitter: function () { instantLog('litter', '💩 Litter logged. A thankless but noble duty.'); },
      logVet: openVet,
      logMed: openMed
    };
    Object.keys(actions).forEach(function (id) {
      $('#' + id).addEventListener('click', actions[id]);
    });

    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', function () { $('#importInput').click(); });
    $('#importInput').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (f) importDataFile(f);
    });
    $('#wipeBtn').addEventListener('click', openWipeConfirm);

    window.addEventListener('resize', function () {
      if ($('#tab-trends').classList.contains('active')) renderTrends();
    });

    armPurrMode();
    refresh();
    maybeWelcome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
