/* =========================================================================
   Мобильный PWA — конфигуратор WirenBoard
   ========================================================================= */
(function () {
  'use strict';

  var STORE_KEY = 'wbconf.project.v1';
  var APP_ID = 'wbconf';
  var APP_VERSION = 1;
  var SPLASH_DURATION = 7000;

  /* ------------------------------------------------------------- утилиты */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(v) { return v == null ? '—' : Number(v).toLocaleString('ru-RU') + ' ₽'; }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* ---------------------------------------------------------------- state */
  var PRODUCTS = [];
  var BY_SKU = {};

  var state = {
    name: 'Новый проект',
    scenario: {
      object: '', area: null, l220: null, dim220: null, rgb12: null, l12: null,
      sockets: null, blinds: null, sensors: null, keys: null, stripV: 24, stripA: 5, stripWm: 0,
      dimStrips: false, hmi: false, ups: false, zigbee: false, meter: false, iso: false, hvd: false,
    },
    config: [], spec: [], schematic: { rails: [] },
    ui: { tab: 'catalog', search: '', category: '' },
  };

  /* ------------------------------------------- мост к расчётному ядру */
  var engine = WBEngine.createEngine(BY_SKU);
  function norm(sku) { return WBEngine.norm(sku); }
  function roleOf(p) { return WBEngine.roleOf(p); }
  function catOf(p) { return WBEngine.catOf(p); }
  function priceOf(sku) { return engine.priceOf(sku); }
  function sumOf(list) { return engine.sumOf(list); }
  function analyze() { return engine.analyze(state); }
  function autoConfigure() { return engine.autoConfigure(state); }
  function cfgAdd(sku, qty, note) { return engine.cfgAdd(state, sku, qty, note); }
  function cfgRemove(sku) { return engine.cfgRemove(state, sku); }
  function cfgClear() { return engine.cfgClear(state); }
  function cfgGet(sku) { return engine.cfgGet(state, sku); }

  /* ============================================================ КАТАЛОГ */

  function initCatalog() {
    var raw = window.WB_CATALOG;
    PRODUCTS = (raw && raw.products ? raw.products : []).map(function (p) {
      BY_SKU[norm(p.sku)] = p;
      return p;
    });
    var cats = {};
    PRODUCTS.forEach(function (p) {
      (p.categories || []).forEach(function (c) { cats[c] = (cats[c] || 0) + 1; });
    });
    var sel = $('#filter-category');
    sel.innerHTML = '<option value="">Все категории</option>';
    Object.keys(cats).sort().forEach(function (c) {
      sel.innerHTML += '<option value="' + esc(c) + '">' + esc(c) + ' (' + cats[c] + ')</option>';
    });
  }

  function renderCatalog() {
    var q = (state.ui.search || '').toLowerCase();
    var cat = state.ui.category || '';
    var grid = $('#catalog-grid');
    grid.innerHTML = '';
    PRODUCTS.forEach(function (p) {
      if (cat && !(p.categories || []).some(function (c) { return c === cat; })) return;
      if (q) {
        var hay = ((p.sku || '') + ' ' + (p.name || '') + ' ' + (p.categories || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) === -1) return;
      }
      var img = p.localImage || p.image || '';
      var card = el('article', 'card');
      card.innerHTML =
        '<div class="card__img"><img alt="" src="' + esc(img) + '"></div>' +
        '<div class="card__body">' +
        '<div class="card__meta"><span class="badge">' + esc(p.sku) + '</span></div>' +
        '<div class="card__title">' + esc(p.title || p.name) + '</div>' +
        '<div class="card__footer">' +
        '<span class="price">' + money(p.price) + '</span>' +
        '<div class="btns">' +
        '<button class="btn small btn-info">ТТХ</button>' +
        '<button class="btn small btn-add">+</button>' +
        '</div></div></div>';
      card.querySelector('.btn-info').onclick = function (e) { e.stopPropagation(); showModal(p); };
      card.querySelector('.btn-add').onclick = function (e) { e.stopPropagation(); addFromCatalog(p); };
      card.addEventListener('click', function () { showModal(p); });
      grid.appendChild(card);
    });
  }

  function addFromCatalog(p) {
    cfgAdd(p.sku, 1, 'Добавлено из каталога');
    refreshConfig();
  }

  /* ============================================================ МОДАЛКА ТТХ */

  function showModal(p) {
    var body = $('#modal-body');
    var img = p.localImage || p.image || '';
    var rows = [
      ['Артикул', p.sku],
      ['Категория', (p.categories || []).join(', ') || '—'],
      ['Напряжение', p.voltage || '—'],
      ['Каналы', p.channels != null ? String(p.channels) : '—'],
      ['Ток', p.current || '—'],
      ['Мощность', p.power || '—'],
      ['Интерфейс', p.interface || '—'],
      ['Монтаж', p.mount || '—'],
      ['Наличие', p.stock > 0 ? 'в наличии ' + p.stock + ' шт.' : p.stock === 0 ? 'под заказ' : (p.status || '—')],
      ['Цена', p.price != null ? money(p.price) + (p.priceMax > p.price ? ' — ' + money(p.priceMax) : '') : '—'],
    ];
    body.innerHTML =
      (img ? '<img src="' + esc(img) + '" alt="" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.05);margin-bottom:10px">' : '') +
      '<h3>' + esc(p.title || p.name) + '</h3>' +
      '<p style="color:#93a9c9;font-size:12px;margin:6px 0 10px">' + esc(p.description || '') + '</p>' +
      '<table style="width:100%;font-size:12px;border-collapse:collapse">' +
      rows.map(function (r) {
        return '<tr><td style="padding:4px 6px;color:#5a6e8a;border-bottom:1px solid rgba(126,166,255,.06);white-space:nowrap">' +
          esc(r[0]) + '</td><td style="padding:4px 6px;border-bottom:1px solid rgba(126,166,255,.06)">' +
          esc(r[1]) + '</td></tr>';
      }).join('') + '</table>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button class="btn" data-act="add">В конфигурацию</button>' +
      '<button class="btn ghost" data-act="spec">В спецификацию</button>' +
      (p.url ? '<a class="btn ghost" href="' + esc(p.url) + '" target="_blank" rel="noopener" style="text-decoration:none">Сайт</a>' : '') +
      '</div>';
    body.querySelector('[data-act="add"]').onclick = function () { addFromCatalog(p); $('#modal').classList.add('hidden'); };
    body.querySelector('[data-act="spec"]').onclick = function () { cfgAdd(p.sku, 1, 'Из спецификации'); refreshConfig(); $('#modal').classList.add('hidden'); };
    $('#modal').classList.remove('hidden');
  }

  /* ============================================================ КОНФИГУРАТОР */

  function readScenario() {
    var s = state.scenario;
    s.object = $('#cfg-object').value;
    s.area = Number($('#cfg-area').value) || null;
    s.l220 = Number($('#cfg-l220').value) || null;
    s.dim220 = Number($('#cfg-dim220').value) || null;
    s.l12 = Number($('#cfg-l12').value) || null;
    s.rgb12 = Number($('#cfg-rgb12').value) || null;
    s.stripV = Number($('#cfg-stripV').value) || 24;
    s.stripA = Number($('#cfg-stripA').value) || 5;
    s.stripWm = Number($('#cfg-stripWm').value) || 0;
    s.dimStrips = !!$('#cfg-dimStrips').checked;
    s.sockets = Number($('#cfg-sockets').value) || null;
    s.blinds = Number($('#cfg-blinds').value) || null;
    s.sensors = Number($('#cfg-sensors').value) || null;
    s.keys = Number($('#cfg-keys').value) || null;
    s.hmi = !!$('#cfg-hmi').checked;
    s.ups = !!$('#cfg-ups').checked;
    s.zigbee = !!$('#cfg-zigbee').checked;
    s.meter = !!$('#cfg-meter').checked;
    s.iso = !!$('#cfg-iso').checked;
    s.hvd = !!$('#cfg-hvd').checked;
    state.name = $('#cfg-name').value || 'Новый проект';
    $('#project-name').textContent = state.name;
  }

  function fillScenario() {
    var s = state.scenario;
    $('#cfg-object').value = s.object || '';
    $('#cfg-area').value = s.area || '';
    $('#cfg-l220').value = s.l220 || '';
    $('#cfg-dim220').value = s.dim220 || '';
    $('#cfg-l12').value = s.l12 || '';
    $('#cfg-rgb12').value = s.rgb12 || '';
    $('#cfg-stripV').value = s.stripV || 24;
    $('#cfg-stripA').value = s.stripA || 5;
    $('#cfg-stripWm').value = s.stripWm || '';
    $('#cfg-dimStrips').checked = !!s.dimStrips;
    $('#cfg-sockets').value = s.sockets || '';
    $('#cfg-blinds').value = s.blinds || '';
    $('#cfg-sensors').value = s.sensors || '';
    $('#cfg-keys').value = s.keys || '';
    $('#cfg-hmi').checked = !!s.hmi;
    $('#cfg-ups').checked = !!s.ups;
    $('#cfg-zigbee').checked = !!s.zigbee;
    $('#cfg-meter').checked = !!s.meter;
    $('#cfg-iso').checked = !!s.iso;
    $('#cfg-hvd').checked = !!s.hvd;
    $('#cfg-name').value = state.name || '';
    $('#project-name').textContent = state.name || 'Без названия';
  }

  function refreshConfig() {
    readScenario();
    var res = analyze();
    renderConfigList(res);
    renderWarnings(res);
    saveProject();
  }

  function renderConfigList(res) {
    var list = $('#cfg-list');
    list.innerHTML = '';
    state.config.forEach(function (it) {
      var p = WBEngine.findProduct(BY_SKU, it.sku);
      var row = el('div', 'cfg-item');
      row.innerHTML =
        '<span class="cfg-item__name">' + esc(p ? (p.title || p.name) : it.sku) + '</span>' +
        '<span class="cfg-item__qty">×' + it.qty + '</span>' +
        '<span class="cfg-item__price">' + money((p ? p.price : 0) * it.qty) + '</span>' +
        '<button class="cfg-item__del" data-sku="' + esc(it.sku) + '">✕</button>';
      row.querySelector('.cfg-item__del').onclick = function () {
        cfgRemove(it.sku);
        refreshConfig();
      };
      list.appendChild(row);
    });
    $('#t-count').textContent = state.config.reduce(function (a, i) { return a + i.qty; }, 0);
    $('#t-sum').textContent = money(sumOf(state.config));
    renderSpec();
  }

  function renderWarnings(res) {
    var box = $('#cfg-warnings');
    box.innerHTML = '';
    (res.errors || []).forEach(function (t) { box.innerHTML += '<div style="color:#ff6b6b">✕ ' + esc(t) + '</div>'; });
    (res.warns || []).forEach(function (t) { box.innerHTML += '<div style="color:#ff9d6b">⚠ ' + esc(t) + '</div>'; });
    (res.notes || []).forEach(function (t) { box.innerHTML += '<div style="color:#7ea6ff">ℹ ' + esc(t) + '</div>'; });
  }

  /* ============================================================ СПЕЦИФИКАЦИЯ */

  function renderSpec() {
    var tbody = $('#spec-table tbody');
    tbody.innerHTML = '';
    var n = 0, total = 0;
    state.config.forEach(function (it) {
      var p = WBEngine.findProduct(BY_SKU, it.sku);
      if (!p) return;
      n++;
      var sum = (p.price || 0) * it.qty;
      total += sum;
      var tr = el('tr');
      tr.innerHTML = '<td>' + n + '</td><td>' + esc(p.sku) + '</td><td>' + esc(p.title || p.name) +
        '</td><td>' + it.qty + '</td><td>' + money(p.price) + '</td><td>' + money(sum) + '</td>';
      tbody.appendChild(tr);
    });
    $('#spec-total').textContent = money(total);
  }

  /* ============================================================ НАВИГАЦИЯ */

  function switchTab(tab) {
    state.ui.tab = tab;
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.dataset.panel === tab); });
    $$('.bottombar__btn').forEach(function (b) { b.classList.toggle('active', b.dataset.panel === tab); });
    if (tab === 'spec') renderSpec();
  }

  /* ============================================================ СОХРАНЕНИЕ */

  function saveProject() {
    try {
      var data = { app: APP_ID, version: APP_VERSION, name: state.name, savedAt: new Date().toISOString(),
        scenario: state.scenario, config: state.config, spec: state.spec, schematic: state.schematic, ui: state.ui };
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* quota */ }
  }

  function loadProject() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || data.app !== APP_ID) return;
      state.name = data.name || 'Новый проект';
      state.scenario = Object.assign(state.scenario, data.scenario || {});
      state.config = data.config || [];
      state.spec = data.spec || [];
      state.schematic = data.schematic || { rails: [] };
      state.ui = Object.assign(state.ui, data.ui || {});
    } catch (e) { /* corrupt */ }
  }

  /* ============================================================ ЗАСТАВКА */

  function runSplash() {
    var splash = $('#splash');
    var canvas = $('#splash-canvas');
    WBEmblem.draw(canvas, { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 });

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      splash.classList.add('dissolve');
      setTimeout(function () { splash.style.display = 'none'; }, 1400);
      $('#app').classList.remove('hidden');
      init();
    }

    splash.addEventListener('click', dismiss);
    setTimeout(dismiss, SPLASH_DURATION);
  }

  /* ============================================================ INIT */

  function init() {
    initCatalog();
    loadProject();
    fillScenario();
    renderCatalog();
    refreshConfig();
    switchTab(state.ui.tab || 'catalog');

    /* навигация */
    $$('.bottombar__btn').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.panel); });
    });

    /* поиск */
    $('#search').addEventListener('input', function () {
      state.ui.search = this.value;
      renderCatalog();
    });
    $('#filter-category').addEventListener('change', function () {
      state.ui.category = this.value;
      renderCatalog();
    });

    /* автоподбор */
    $('#cfg-auto').addEventListener('click', function () {
      readScenario();
      autoConfigure();
      refreshConfig();
    });

    /* инпуты конфигуратора */
    $$('#cfg-object,#cfg-name,#cfg-area,#cfg-l220,#cfg-dim220,#cfg-l12,#cfg-rgb12,#cfg-stripV,#cfg-stripA,#cfg-stripWm,#cfg-sockets,#cfg-blinds,#cfg-sensors,#cfg-keys').forEach(function (inp) {
      inp.addEventListener('input', refreshConfig);
    });
    $$('#cfg-dimStrips,#cfg-hmi,#cfg-ups,#cfg-zigbee,#cfg-meter,#cfg-iso,#cfg-hvd').forEach(function (inp) {
      inp.addEventListener('change', refreshConfig);
    });

    /* модалка */
    $('#modal-close').addEventListener('click', function () { $('#modal').classList.add('hidden'); });
    $('.modal__backdrop') && $('.modal__backdrop').addEventListener('click', function () { $('#modal').classList.add('hidden'); });

    /* меню */
    $('#btn-menu').addEventListener('click', function (e) {
      e.stopPropagation();
      $('#menu-dropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', function () { $('#menu-dropdown').classList.add('hidden'); });

    $('#menu-new').addEventListener('click', function () {
      if (!confirm('Создать новый проект? Текущие данные будут потеряны.')) return;
      state.name = 'Новый проект';
      state.config = []; state.spec = [];
      state.scenario = { object:'', area:null, l220:null, dim220:null, rgb12:null, l12:null,
        sockets:null, blinds:null, sensors:null, keys:null, stripV:24, stripA:5, stripWm:0,
        dimStrips:false, hmi:false, ups:false, zigbee:false, meter:false, iso:false, hvd:false };
      fillScenario(); renderCatalog(); refreshConfig();
      $('#menu-dropdown').classList.add('hidden');
    });

    $('#menu-import').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || data.app !== APP_ID) { alert('Неверный формат файла'); return; }
          state.name = data.name || 'Новый проект';
          state.scenario = Object.assign(state.scenario, data.scenario || {});
          state.config = data.config || []; state.spec = data.spec || [];
          state.schematic = data.schematic || { rails: [] };
          fillScenario(); renderCatalog(); refreshConfig();
          $('#menu-dropdown').classList.add('hidden');
        } catch (err) { alert('Ошибка чтения файла: ' + err.message); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('#menu-export').addEventListener('click', function () {
      readScenario();
      var data = { app: APP_ID, version: APP_VERSION, name: state.name, savedAt: new Date().toISOString(),
        scenario: state.scenario, config: state.config, spec: state.spec, schematic: state.schematic, ui: state.ui };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (state.name || 'проект').replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_') + '.wbconf';
      a.click(); URL.revokeObjectURL(a.href);
      $('#menu-dropdown').classList.add('hidden');
    });

    $('#menu-clear-spec').addEventListener('click', function () {
      state.spec = []; refreshConfig();
      $('#menu-dropdown').classList.add('hidden');
    });
    $('#menu-clear-cfg').addEventListener('click', function () {
      cfgClear(); refreshConfig();
      $('#menu-dropdown').classList.add('hidden');
    });
  }

  /* ============================================================ СТАРТ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSplash);
  } else {
    runSplash();
  }

  /* Service Worker — только на HTTP/HTTPS, не на file:// */
  if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* ============================================================ УСТАНОВКА PWA */
  var deferredInstall = null;
  var INSTALL_DISMISSED = 'wbconf.install.dismissed';

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    if (!localStorage.getItem(INSTALL_DISMISSED)) {
      $('#install-banner').classList.remove('hidden');
    }
  });

  window.addEventListener('appinstalled', function () {
    deferredInstall = null;
    $('#install-banner').classList.add('hidden');
  });

  document.addEventListener('DOMContentLoaded', function () {
    var btnInstall = $('#btn-install');
    var btnClose = $('#btn-install-close');
    if (btnInstall) {
      btnInstall.addEventListener('click', function () {
        if (!deferredInstall) return;
        deferredInstall.prompt();
        deferredInstall.userChoice.then(function (choice) {
          deferredInstall = null;
          $('#install-banner').classList.add('hidden');
        });
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', function () {
        $('#install-banner').classList.add('hidden');
        localStorage.setItem(INSTALL_DISMISSED, '1');
      });
    }
  });

})();
