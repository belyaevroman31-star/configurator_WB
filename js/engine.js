/* =========================================================================
   WBCONF — расчётное ядро: резолвер артикулов, классификация устройств,
   проверки совместимости и автоподбор.
   Работает и в браузере (window.WBEngine), и в Node (module.exports).
   Не зависит от DOM.
   ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WBEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------ артикулы */

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }

  // Ключ для нечувствительного к разделителям сравнения: 'WB-MR6C v.3' -> 'wbmr6cv3'
  function skuKey(s) { return norm(s).replace(/[\s._\-–—/\\,()]+/g, '').replace(/ё/g, 'е'); }

  // Ручные соответствия там, где артикул и название каталога не совпадают
  var ALIAS = {
    wbmr6lv: 'wbmr6',
    wbdali3: 'wbmdali3',
    wbmap3ev: 'wbmap3ev',
    wbupsv3: 'wbupsv3',
    wbmz4battery: 'wbmz4battery',
  };

  // Найти товар по артикулу, названию или синониму. Возвращает продукт каталога.
  function findProduct(BY_SKU, query) {
    if (!query) return null;
    var direct = BY_SKU[norm(query)];
    if (direct) return direct;

    var keys = Object.keys(BY_SKU);
    var k = skuKey(query);
    var target = ALIAS[k] || k;
    var i, p;

    for (i = 0; i < keys.length; i++) {
      p = BY_SKU[keys[i]];
      if (skuKey(p.sku) === target) return p;
    }
    for (i = 0; i < keys.length; i++) {
      p = BY_SKU[keys[i]];
      if (skuKey(p.name) === target) return p;
    }
    // мягкое совпадение по началу названия
    for (i = 0; i < keys.length; i++) {
      p = BY_SKU[keys[i]];
      if (skuKey(p.name).indexOf(target) === 0) return p;
    }
    return null;
  }

  /* -------------------------------------------- инженерные характеристики
     Данные с сайта неполны, поэтому для устройств, важных для расчёта,
     характеристики заданы явно. Ключ — skuKey(артикул).
       role      — назначение: ctrl | relay | dim | amp | psu | in | meter | sensor | hmi | net | misc
       volts     — ac | low | dali | analog | general
       slot      — занимает слот MOD1..MOD4 контроллера
       solo      — работает автономно (свой БП, без контроллера)
       ch        — число каналов
       amps      — ток на канал, А
       w         — выходная мощность, Вт (для БП)
  */
  var CAPS = {
    /* контроллеры */
    wirenboard8: { role: 'ctrl', slots: 4, ports: 2 },
    wirenboard8m: { role: 'ctrl', slots: 4, ports: 2 },
    wirenboard7: { role: 'ctrl', slots: 4, ports: 2 },

    /* реле 220 В */
    wbmr6cv3: { role: 'relay', volts: 'ac', ch: 6, amps: 10, solo: true },
    wbmr6cv2: { role: 'relay', volts: 'ac', ch: 6, amps: 10, slot: true },
    wbmr6cu: { role: 'relay', volts: 'ac', ch: 6, amps: 10, solo: true },
    wbmr6lvl: { role: 'relay', volts: 'low', ch: 6, amps: 7, solo: true },
    wbmr6: { role: 'relay', volts: 'ac', ch: 6, amps: 10, solo: true },
    wbmr3: { role: 'relay', volts: 'ac', ch: 3, amps: 10, slot: true },
    wbe2dorr6c1: { role: 'relay', volts: 'ac', ch: 6, amps: 10, slot: true },
    wbe2dorr3a1: { role: 'relay', volts: 'ac', ch: 3, amps: 3, slot: true },
    wbiodorr10a8: { role: 'relay', volts: 'ac', ch: 8, amps: 10, bus: true, solo: true },
    wbiodorr1g16: { role: 'relay', volts: 'general', ch: 16, amps: 1, bus: true, solo: true },
    wbiodossr8: { role: 'relay', volts: 'low', ch: 8, amps: 10, bus: true, solo: true },
    wbmrm2mini: { role: 'relay', volts: 'ac', ch: 2, amps: 10, solo: true },
    wbmrm2miniv3: { role: 'relay', volts: 'ac', ch: 2, amps: 16, solo: true },
    wbprocurel6: { role: 'relay', volts: 'ac', ch: 6, amps: 10, solo: true },
    wbmrps6: { role: 'relay', volts: 'ac', ch: 6, amps: 16, solo: true },
    wbmrwl3: { role: 'relay', volts: 'ac', ch: 3, amps: 10, solo: true },
    wbmrwm2: { role: 'relay', volts: 'low', ch: 2, amps: 10, solo: true },

    /* диммеры 220 В */
    wbmdm3: { role: 'dim', volts: 'ac', ch: 3, localIn: 6, slot: true },
    wbprofetdim: { role: 'dim', volts: 'ac', ch: 1, slot: true },

    /* ленты 12/24 В */
    wbled: { role: 'dim', volts: 'low', ch: 4, amps: 5, localIn: 4, solo: true },
    wbampled: { role: 'amp', volts: 'low', ch: 4, amps: 10, solo: true },
    wbproleddim: { role: 'dim', volts: 'low', ch: 4, amps: 5, localIn: 4, solo: true },
    wbproamp: { role: 'amp', volts: 'low', ch: 4, amps: 10, solo: true },
    wbproledrel6: { role: 'relay', volts: 'low', ch: 6, amps: 10, solo: true },
    wbprocledrel6: { role: 'relay', volts: 'low', ch: 6, solo: true },
    wbvdiv: { role: 'dim', volts: 'ac', ch: 4, solo: true },

    /* питание 24 В */
    li1520b24pr2: { role: 'psu', volts: 'psu', w: 15 },
    li3020b24pr2: { role: 'psu', volts: 'psu', w: 30 },
    li6020b24pr2: { role: 'psu', volts: 'psu', w: 60 },
    li10020b24pr2: { role: 'psu', volts: 'psu', w: 100 },
    li15020b24pr2: { role: 'psu', volts: 'psu', w: 150 },
    powersupply24v: { role: 'psu', volts: 'psu', w: 100 },

    /* резервное питание */
    wbmz6battery: { role: 'psu', slot: true, ups: true },
    wbmz4battery: { role: 'psu', slot: true, ups: true },
    wbmz6supercap: { role: 'psu', slot: true, ups: true },
    wbmz4supercap: { role: 'psu', slot: true, ups: true },
    wbupsv3: { role: 'psu', solo: true, ups: true },

    /* входы */
    wbmcm8: { role: 'in', ch: 8, slot: true },
    wbmcm8hv: { role: 'in', ch: 8, slot: true },
    wbe2didr3: { role: 'in', ch: 3, slot: true },
    wbiodihvd8: { role: 'in', ch: 8, bus: true, solo: true },
    wbiodihvd16: { role: 'in', ch: 16, bus: true, solo: true },
    wbiodiwd14: { role: 'in', ch: 14, slot: true },
    wbmdio8: { role: 'in', ch: 8, slot: true },
    wbm1w2: { role: 'in', ch: 2, bus: true, solo: true },
    wbmao4: { role: 'out', volts: 'analog', ch: 4, bus: true, solo: true },
    wbmao420ma: { role: 'out', volts: 'analog', ch: 4, bus: true, solo: true },

    /* интерфейсные модули (слоты) */
    wbe2irs485iso: { role: 'net', slot: true, bus: true },
    wbe2irs232: { role: 'net', slot: true },
    wbe2irs232iso: { role: 'net', slot: true },
    wbe2i1wire: { role: 'net', slot: true, bus: true },
    wbe2iebus: { role: 'net', slot: true, bus: true },
    wbe2iknx: { role: 'net', slot: true, bus: true },
    wbe2iopentherm: { role: 'net', slot: true, bus: true },
    wbe2rrzigbeev2: { role: 'net', slot: true },
    wbe2rrzigbeesm: { role: 'net', slot: true },
    wbe2rrzigbeesh: { role: 'net', slot: true },
    wbe2rggps: { role: 'net', slot: true },
    wbe2rrzwavezway: { role: 'net', slot: true },
    wbc24g: { role: 'net', slot: true },
    wbc24gm: { role: 'net', slot: true },
    wbc4gv2: { role: 'net', slot: true },
    wbproplc84g64g: { role: 'net', slot: true },

    /* DALI */
    wbmdali3: { role: 'dim', volts: 'dali', ch: 3, slot: true },
    wbprodali: { role: 'dim', volts: 'dali', ch: 3, slot: true },

    /* учёт */
    wbmap3e: { role: 'meter', ch: 3, bus: true, solo: true },
    wbmap3et: { role: 'meter', ch: 3, bus: true, solo: true },
    wbmap3ev: { role: 'meter', ch: 3, bus: true, solo: true },
    wbmap6s: { role: 'meter', ch: 6, bus: true, solo: true },
    wbmap12e: { role: 'meter', ch: 12, bus: true, solo: true },

    /* датчики */
    wbmswv4: { role: 'sensor', bus: true, solo: true },
    wbmsw4th: { role: 'sensor', bus: true, solo: true },
    wbmsw4zigbee: { role: 'sensor', slot: true },
    wbprowallsens2: { role: 'sensor', bus: true, solo: true },
    wbprowallsenszb: { role: 'sensor', slot: true },

    /* панели */
    ycsm41p: { role: 'hmi', bus: true, solo: true },
    ycsm08pmarkeddown: { role: 'hmi', bus: true, solo: true },
  };
  delete CAPS['wbio dihvd8'];

  function capOf(p) {
    if (!p) return {};
    var c = CAPS[skuKey(p.sku)] || CAPS[skuKey(p.name)];
    return c || {};
  }

  /* ------------------------------------------------------ классификация */

  var VOLTAGE_LABEL = {
    ac: '220 В', low: '12/24 В', dali: 'DALI', analog: 'аналоговый', general: 'универсальный', psu: 'питание',
  };

  function catOf(p) {
    var c = (p.categories && p.categories[0]) || '';
    if (/прочее/i.test(c)) return 'Прочее';
    return c;
  }

  function roleOf(p) {
    var c = capOf(p);
    if (c.role) return c.role;
    var cat = catOf(p);
    if (/контроллер/i.test(cat)) return 'ctrl';
    if (/модули для контроллеров/i.test(cat)) return 'ext';
    if (/реле|диммер/i.test(cat)) return 'relay';
    if (/WIRENBOARD PRO/i.test(cat)) return 'pro';
    if (/hmi/i.test(cat)) return 'hmi';
    if (/сч[её]тчик/i.test(cat)) return 'meter';
    if (/датчик/i.test(cat)) return 'sensor';
    return 'misc';
  }

  function voltageClass(p) {
    var c = capOf(p);
    if (c.volts) return c.volts;
    if (roleOf(p) === 'ctrl') return 'ac';
    var v = norm(p.voltage);
    var txt = norm(p.name + ' ' + p.title + ' ' + p.description);
    if (/230|220/.test(v)) return 'ac';
    if (/(^|\D)(12|24|48)\s*в/.test(v)) return 'low';
    if (/дн\s*\(dali\)|dali/.test(norm(p.interface))) return 'dali';
    if (/0-10|4-20|0\.\.20/.test(norm(p.interface))) return 'analog';
    if (/лент|светодиодн|led/.test(txt) && !/диммер|диммир/.test(txt)) return 'low';
    if (/диммер|диммир/.test(txt)) return 'ac';
    return 'general';
  }

  // Прокручивается ли по Modbus RTU (RS-485)
  function onBus(p) {
    var c = capOf(p);
    if (c.bus !== undefined) return !!c.bus;
    if (voltageClass(p) === 'dali') return false;
    if (/rs-?485|modbus/i.test(norm(p.interface))) return true;
    if (roleOf(p) === 'meter' || roleOf(p) === 'sensor' || roleOf(p) === 'hmi') return true;
    return false;
  }

  // Занимает ли слот расширения MOD1..MOD4
  function usesSlot(p) {
    var c = capOf(p);
    if (c.slot !== undefined) return !!c.slot;
    return /^(WBE2|WBC2|WBC-|WBMZ)/.test(p.sku);
  }

  // Может работать без контроллера (собственное питание или шина)
  function isStandalone(p) {
    var c = capOf(p);
    if (c.solo !== undefined) return !!c.solo;
    if (roleOf(p) === 'ctrl') return true;
    return !usesSlot(p);
  }

  function channelsOf(p) {
    var c = capOf(p);
    if (c.ch) return c.ch;
    var n = parseInt(p.channels, 10);
    return isFinite(n) ? n : 0;
  }

  function parseAmps(p) {
    var c = capOf(p);
    if (c.amps) return c.amps;
    var m = /(\d+(?:[.,]\d+)?)\s*а/i.exec(p.current || '');
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }

  function parseWatts(p) {
    var c = capOf(p);
    if (c.w) return c.w;
    var m = /(\d+(?:[.,]\d+)?)\s*вт/i.exec(p.power || '');
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }

  // Номинальное напряжение БП: 12, 24, 48 или null
  function psuVolts(p) {
    var c = capOf(p);
    if (c.volts && c.volts !== 'psu') return c.volts;
    var t = norm(p.name + ' ' + p.title + ' ' + (p.voltage || '') + ' ' + p.description);
    var m = /(^|[^0-9])(12|24|48)\s*в([^0-9]|$)/.exec(t);
    return m ? Number(m[2]) : null;
  }

  // Ёмкость диммирования/усиления по току, Вт — не нужно, считаем по току
  function lowAmpCap(p, stripA) {
    var a = parseAmps(p);
    if (a == null) a = roleOf(p) === 'amp' ? 10 : 5;
    return a;
  }

  /* ------------------------------------------------- работа с составом */

  function cfgAdd(state, sku, qty, note) {
    qty = qty || 1;
    var k = norm(sku);
    for (var i = 0; i < state.config.length; i++) {
      if (norm(state.config[i].sku) === k) {
        state.config[i].qty += qty;
        if (note) state.config[i].note = note;
        return state.config[i];
      }
    }
    var item = { sku: sku, qty: qty, note: note || '' };
    state.config.push(item);
    return item;
  }
  function cfgRemove(state, sku) {
    var k = norm(sku);
    state.config = state.config.filter(function (i) { return norm(i.sku) !== k; });
  }
  function cfgClear(state) { state.config = []; }
  function cfgGet(state, sku) {
    var k = norm(sku);
    for (var i = 0; i < state.config.length; i++) if (norm(state.config[i].sku) === k) return state.config[i];
    return null;
  }
  function priceOf(BY_SKU, sku) {
    var p = findProduct(BY_SKU, sku);
    return p && typeof p.price === 'number' ? p.price : null;
  }
  function sumOf(BY_SKU, list) {
    return list.reduce(function (s, i) {
      var pr = priceOf(BY_SKU, i.sku);
      return s + (pr ? pr * i.qty : 0);
    }, 0);
  }

  /* ------------------------------------------------------------ формат */

  function fmtA(a) {
    if (a == null) return '—';
    if (a < 1) return Math.round(a * 1000) + ' мА';
    return (Math.round(a * 10) / 10).toString().replace('.', ',') + ' А';
  }
  function fmtW(w) {
    if (w == null) return '—';
    if (w >= 1000) return (Math.round(w / 10) / 100).toString().replace('.', ',') + ' кВт';
    return Math.round(w) + ' Вт';
  }
  function int(v) { var x = Number(v); return isFinite(x) && x > 0 ? Math.round(x) : 0; }

  /* ================================================================ РАСЧЁТ */

  // Типовые нагрузки для оценки, если пользователь не задал мощности вручную
  var TYPICAL = {
    wPerLightGroup220: 150,   // Вт на группу света 220 В
    wPerDimGroup220: 120,     // Вт на диммируемую группу
    wPerSocketGroup: 2000,    // Вт на розеточную группу
    wPerBlind: 60,            // Вт на привод шторы (один канал)
    mainBreakerA: 63,         // типовой ввод в квартиру/щит
    psuReserve: 1.25,         // запас блока питания лент
    ampThresholdWm: 12,       // выше 12 Вт/м диммеру нужен усилитель тока
    channelsPerDimmer: 4,     // один диммер лент ведёт 4 ленты
  };

  function analyze(state, BY_SKU) {
    var s = state.scenario;
    var res = {
      counts: {},
      channels220: 0, amps220cap: 0,
      lowChCap: 0, lowACap: 0,     // ёмкость установленных диммеров/усилителей лент
      psuWatts: 0, foreignPsuWatts: 0, ups: 0,
      busDevices: 0, slotDevices: 0, controllers: 0,
      demand: {
        w220: 0, wLow: 0, aLow: 0, l220: 0, l12: 0, dim220: 0, keys: 0,
        keysLocal: 0, keysShort: 0,
      },
      errors: [], warns: [], notes: [],
      ok: true,
    };

    var stripV = int(s.stripV) || 24;
    var stripA = Number(s.stripA) || 5;        // нагрузка на один канал ленты
    var stripWm = Number(s.stripWm) || 0;      // Вт на метр ленты
    // усилитель тока: по мощности ленты (>12 Вт/м), а если она не задана — по току канала
    var ampNeeded = stripWm > TYPICAL.ampThresholdWm
      || (stripWm === 0 && stripA > 5);
    var lowInputs = 0;   // локальные входы диммеров (клавиши)
    var keyIn = 0;       // выходы входных модулей (клавиши)
    var sensorIn = 0;
    var zigbee = 0;
    var dimsAc = 0;

    /* ---- ёмкости установленного оборудования ---- */
    state.config.forEach(function (it) {
      var p = findProduct(BY_SKU, it.sku);
      if (!p) { res.errors.push('Позиция «' + it.sku + '» не найдена в каталоге.'); return; }
      var n = it.qty;
      var role = roleOf(p);
      var cls = voltageClass(p);

      res.counts[p.sku] = (res.counts[p.sku] || 0) + n;
      if (role === 'ctrl') res.controllers += n;
      if (onBus(p) && role !== 'ctrl') res.busDevices += n;
      if (usesSlot(p)) res.slotDevices += n;
      if (role === 'psu') {
        if (capOf(p).ups) res.ups += n;
        else if (psuVolts(p) === stripV) res.psuWatts += (parseWatts(p) || 0) * n;
        else res.foreignPsuWatts += (parseWatts(p) || 0) * n;
      }
      if (/zigbee/i.test(p.sku)) zigbee += n;

      var ch = channelsOf(p);
      var cap = capOf(p);

      // ёмкость лент: диммеры дают каналы, усилители — только ток
      if (role === 'dim' && cls === 'low') {
        res.lowChCap += ch * n;
        res.lowACap += (parseAmps(p) || 5) * ch * n;
      }
      if (role === 'amp' && cls === 'low') {
        res.lowACap += (parseAmps(p) || 10) * ch * n;
      }

      // локальные входы клавиш на диммерах
      if (cap.localIn) { res.demand.keysLocal += cap.localIn * n; lowInputs += cap.localIn * n; }
      if (role === 'in') { keyIn += ch * n; sensorIn += ch * n; }
      if (role === 'sensor' && ch) sensorIn += ch * n;

      // диммеры 220 В
      if (role === 'dim' && cls === 'ac') dimsAc += ch * n;

      // ток реле 220 В
      if (role === 'relay' && cls === 'ac') {
        var a = parseAmps(p);
        res.channels220 += ch * n;
        if (a != null) res.amps220cap += a * ch * n;
      }
    });

    /* ---- фактическая потребность по сценарию ---- */
    var D = res.demand;
    var l220 = int(s.l220);
    var dim220 = Math.min(int(s.dim220), l220);
    var l12 = int(s.l12);
    var rgb12 = Math.min(int(s.rgb12), l12);
    var sockets = int(s.sockets);
    var blinds = int(s.blinds);
    var sensors = int(s.sensors);
    var keys = int(s.keys);

    D.l220 = l220; D.l12 = l12; D.dim220 = dim220; D.keys = keys;
    D.w220 = Math.max(0, l220 - dim220) * TYPICAL.wPerLightGroup220
      + dim220 * TYPICAL.wPerDimGroup220
      + sockets * TYPICAL.wPerSocketGroup
      + blinds * TYPICAL.wPerBlind;
    D.aLow = l12 * stripA;
    D.wLow = D.aLow * stripV;

    /* =================== проверки =================== */

    // --- контроллер ---
    var needsCtrl = dimsAc > 0 || l12 > 0 || keyIn > 0 || sensors > 0 || res.slotDevices > 0;
    if (needsCtrl && res.controllers === 0) {
      var soloEnough = state.config.every(function (i) {
        var p = findProduct(BY_SKU, i.sku);
        return p && isStandalone(p);
      });
      if (!soloEnough) {
        res.errors.push('В выбранной конфигурации есть модули, которым нужен контроллер (диммеры, входные модули, датчики). Добавьте Wiren Board.');
      } else {
        res.notes.push('Контроллер не обязателен: все выбранные устройства имеют собственное питание и работают автономно.');
      }
    }

    // --- слоты расширения: 4 слота MOD на каждый контроллер ---
    if (res.controllers > 0) {
      var maxSlots = res.controllers * 4;
      if (res.slotDevices > maxSlots) {
        res.errors.push('Модулей расширения ' + res.slotDevices + ', а слотов MOD на '
          + res.controllers + ' контроллер(ах) — ' + maxSlots + '. Один объект — один контроллер: разбейте объект на зоны или выберите модули со встроенным БП.');
      } else if (res.slotDevices === maxSlots) {
        res.warns.push('Заняты все ' + maxSlots + ' слотов MOD — резерв под расширение отсутствует.');
      }
    }

    // --- шина RS-485 ---
    if (res.controllers > 0) {
      var maxDev = 62;
      if (res.busDevices > maxDev) {
        res.errors.push('На шине RS-485 ' + res.busDevices + ' устройств — предел около ' + maxDev + '. Нужны изолированные преобразователи/разветвители.');
      } else if (res.busDevices > 30) {
        res.warns.push(res.busDevices + ' устройств на RS-485 — добавьте WBE2-I-RS485-ISO: длинная шина требует изоляции и разгрузки.');
      } else if (res.busDevices > 12) {
        res.notes.push('Шина RS-485: ' + res.busDevices + ' устройств. Базовые порты контроллера справятся, но изоляция лишней не будет.');
      }
    } else if (res.busDevices > 0) {
      res.notes.push('Устройства на RS-485 без контроллера: сценарии работают локально, централизованного управления нет.');
    }

    // --- 220 В ---
    var a220 = D.w220 / 230;
    if (res.channels220 > 0 && res.channels220 * 1.6 < (l220 - dim220) + sockets + blinds * 2) {
      res.warns.push('Реле 220 В: ' + res.channels220 + ' каналов, а требуется групп '
        + ((l220 - dim220) + sockets + blinds * 2) + '. Разбейте нагрузку на несколько модулей или добавьте релейные блоки.');
    }
    if (res.amps220cap > 0 && res.amps220cap < a220) {
      res.warns.push('Суммарный номинал реле ' + fmtA(res.amps220cap) + ' меньше расчётного тока '
        + fmtA(a220) + ' — часть групп не будет включаться одновременно.');
    }
    if (a220 > TYPICAL.mainBreakerA) {
      res.warns.push('Расчётная нагрузка 220 В: ' + fmtW(D.w220) + ' (' + fmtA(a220) + ') — больше типового однофазного ввода '
        + TYPICAL.mainBreakerA + ' А. Нужен трёхфазный ввод или разделение на два щита.');
    } else if (a220 > TYPICAL.mainBreakerA * 0.8) {
      res.warns.push('Нагрузка 220 В близка к пределу ввода: ' + fmtW(D.w220) + ' (' + fmtA(a220) + ').');
    }
    if (dimsAc > 0 && dimsAc < dim220) {
      res.errors.push('Каналов диммирования 220 В: ' + dimsAc + ', а диммируемых групп: ' + dim220 + '.');
    }

    // --- ленты 12/24 В ---
    if (l12 > 0) {
      if (res.lowChCap === 0) {
        res.errors.push('Для ' + l12 + ' каналов лент нужен диммер или усилитель (WB-LED, WB-AMPLED) — в конфигурации их нет.');
      } else if (res.lowChCap < l12) {
        res.errors.push('Каналов диммирования лент: ' + res.lowChCap + ', требуется ' + l12 + '. Добавьте диммер или усилитель.');
      }
      if (res.lowACap < D.aLow) {
        res.errors.push('Ёмкость лент по току: ' + fmtA(res.lowACap) + ' при потребности ' + fmtA(D.aLow)
          + '. Добавьте усилители по 10 А на канал.');
      }
      var needW = D.wLow * TYPICAL.psuReserve;
      if (res.psuWatts === 0) {
        res.errors.push('Для лент ' + stripV + ' В нужен блок питания ~' + fmtW(needW) + ' (с запасом 25 %) — в конфигурации его нет.');
      } else if (res.psuWatts < needW) {
        res.errors.push('Блоки питания на ' + fmtW(res.psuWatts) + ' не покрывают ' + fmtW(needW) + ' с запасом. Добавьте БП ' + stripV + ' В.');
      } else if (res.psuWatts < D.wLow * 1.4) {
        res.warns.push('Ёмкость блока питания близка к пределу: ' + fmtW(res.psuWatts) + ' при потребности ' + fmtW(D.wLow) + '.');
      }
      if (stripV === 12) {
        res.notes.push('Ленты 12 В: при той же мощности ток вдвое выше, чем у 24 В. Блока питания 12 В в каталоге нет — нужен внешний.');
        if (res.foreignPsuWatts > 0) {
          res.errors.push('Блоки питания на ' + fmtW(res.foreignPsuWatts)
            + ' в конфигурации рассчитаны на другое напряжение — для лент 12 В нужен БП 12 В.');
        }
      }
      if (stripWm > 0 && stripWm <= TYPICAL.ampThresholdWm) {
        res.notes.push('Лента ' + stripWm + ' Вт/м — до ' + TYPICAL.ampThresholdWm
          + ' Вт/м, усилитель тока не требуется.');
      }
      if (ampNeeded) {
        res.notes.push(stripWm > TYPICAL.ampThresholdWm
          ? 'Лента ' + stripWm + ' Вт/м (выше ' + TYPICAL.ampThresholdWm + ' Вт/м) — диммеру нужен усилитель тока.'
          : 'Ток ' + stripA + ' А на канал (выше 5 А) — диммеру нужен усилитель тока.');
      }
      if (rgb12 > 0) res.notes.push(rgb12 + ' RGB/RGBW-группы учтены как обычные каналы диммера и ленты.');
    } else if (res.lowChCap > 0) {
      res.notes.push('В конфигурации есть диммеры лент, но в сценарии указано 0 групп — проверьте настройки.');
    }

    // --- клавиши ---
    var needKeys = Math.max(0, keys - res.demand.keysLocal);
    if (needKeys > 0 && keyIn === 0) {
      res.warns.push(needKeys + ' клавиш не подключены: добавьте входные модули (WB-MCM8, WBE2-DI-DR-3) или переведите выключатели на Zigbee/1-Wire.');
    } else if (needKeys > keyIn) {
      res.warns.push('Клавиш нужно ' + needKeys + ', входов в модулях: ' + keyIn + '. Добавьте модуль входов.');
    }

    // --- прочее ---
    if (int(s.area) >= 100 && res.controllers > 0 && zigbee === 0) {
      res.notes.push('Для площади от 100 м² обычно добавляют WBE2R-R-ZIGBEE-v2: беспроводные выключатели и датчики без проводов.');
    }
    if (res.counts['wb-mdali-3'] || res.counts['WBPRO-DALI']) {
      res.notes.push('DALI-устройства работают на отдельной шине DALI и не занимают порты RS-485.');
    }
    if (res.ups > 0) res.notes.push('Резервное питание: при пропадании 220 В система переходит на автономные сценарии.');

    res.ok = res.errors.length === 0;
    return res;
  }

  /* ============================================================ АВТОПОДБОР */

  function createEngine(BY_SKU) {
    var notes = [];

    function note(t) { notes.push(t); }
    function resetNotes() { notes = []; }
    function takeNotes() { var n = notes; notes = []; return n; }

    // Первый подходящий артикул из списка предпочтений
    function pick(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var p = findProduct(BY_SKU, candidates[i]);
        if (p) return p;
      }
      return null;
    }
    function pickBy(pred) {
      var keys = Object.keys(BY_SKU).sort();
      for (var i = 0; i < keys.length; i++) {
        var p = BY_SKU[keys[i]];
        if (pred(p)) return p;
      }
      return null;
    }
    // Все БП из каталога указанного напряжения
    function psus(volts) {
      return Object.keys(BY_SKU)
        .map(function (k) { return BY_SKU[k]; })
        .filter(function (p) {
          if (roleOf(p) !== 'psu' || capOf(p).ups) return false;
          if (!parseWatts(p)) return false;
          return volts == null || psuVolts(p) === volts;
        });
    }
    // Подобрать блок питания на требуемую мощность: минимум штук, затем минимум денег
    function fitPsu(needW, volts) {
      var best = null;
      psus(volts).forEach(function (p) {
        var w = parseWatts(p);
        var qty = Math.max(1, Math.ceil(needW / w));
        var cost = (p.price || 0) * qty;
        if (!best || qty < best.qty || (qty === best.qty && cost < best.cost)) {
          best = { p: p, qty: qty, cost: cost, unit: w };
        }
      });
      return best;
    }

    function autoConfigure(state) {
      resetNotes();
      var s = state.scenario;
      var area = int(s.area);
      var l220 = int(s.l220);
      var dim220 = Math.min(int(s.dim220), l220);
      var l12 = int(s.l12);
      var rgb12 = Math.min(int(s.rgb12), l12);
      var sockets = int(s.sockets);
      var blinds = int(s.blinds);
      var sensors = int(s.sensors);
      var keys = int(s.keys);
      var stripA = Number(s.stripA) || 5;
      var stripV = int(s.stripV) || 24;
      var stripWm = Number(s.stripWm) || 0;
      var dimStrips = !!s.dimStrips;   // диммирование лент — только если явно указано

      state.config = [];

      function add(p, qty, why) {
        if (!p || !(qty > 0)) return 0;
        cfgAdd(state, p.sku, qty, why);
        return qty;
      }

      /* 1. Реле 220 В: недиммируемый свет + розетки + шторы (2 канала на штору) */
      var plain = Math.max(0, l220 - dim220);
      var ch220 = plain + sockets + blinds * 2;
      var relayMod = null;
      if (ch220 > 0) {
        relayMod = pick(['WB-MR6C v.3', 'WB-MR6C v.2', 'WB-MR6CU', 'WB-MR6LV', 'WB-MR3']);
        if (relayMod) {
          var chPer = channelsOf(relayMod);
          add(relayMod, Math.ceil(ch220 / chPer),
            'Коммутация 220 В: свет ' + plain + ' + розетки ' + sockets + ' + шторы ' + blinds + '×2 = '
            + ch220 + ' каналов, по ' + chPer + ' на ' + relayMod.name);
        } else {
          relayMod = pickBy(function (p) { return roleOf(p) === 'relay' && voltageClass(p) === 'ac' && isStandalone(p); });
          if (relayMod) add(relayMod, Math.ceil(ch220 / Math.max(1, channelsOf(relayMod))), 'Коммутация 220 В: ' + ch220 + ' каналов');
          else note('Реле 220 В в каталоге не найдено — подберите модуль вручную на ' + ch220 + ' каналов.');
        }
      }

      /* 2. Диммеры 220 В */
      var acDim = null;
      if (dim220 > 0) {
        acDim = pick(['WB-MDM3', 'WBPRO-FETDIM']);
        if (acDim) {
          var acCh = channelsOf(acDim);
          add(acDim, Math.ceil(dim220 / acCh),
            'Диммирование ' + dim220 + ' групп 220 В, ' + acCh + ' каналов на модуль');
        } else {
          note('Диммер 220 В не найден в каталоге — подберите вручную на ' + dim220 + ' каналов.');
        }
      }

      /* 3. Ленты 12/24 В */
      var ledDims = 0, amps = 0, localIn = 0;
      if (l12 > 0) {
        var perDimmer = TYPICAL.channelsPerDimmer;   // один диммер ведёт 4 ленты
        if (dimStrips) {
          var led = pick(['WB-LED', 'WBPRO-LEDDIM']);
          if (led) {
            ledDims = Math.ceil(l12 / perDimmer);
            add(led, ledDims, l12 + ' лент, по ' + perDimmer + ' на диммер — нужно ' + ledDims
              + ' шт. (' + stripV + ' В, ' + fmtA(stripA) + ' А на канал)');
            localIn += (capOf(led).localIn || 4) * ledDims;
          } else {
            note('Диммер лент не найден в каталоге.');
          }
        } else {
          note('Ленты ' + l12 + ' шт. подключены напрямую — диммеры не добавлялись. '
            + 'Включите «диммирование лент», если нужна регулировка яркости.');
        }

        // усилитель тока нужен, когда мощность ленты выше 12 Вт/м
        // (если Вт/м не задано — по току канала, как раньше)
        var ampNeeded = stripWm > TYPICAL.ampThresholdWm || (stripWm === 0 && stripA > 5);
        if (ampNeeded) {
          var ampMod = pick(['WB-AMPLED', 'WBPRO-AMP']);
          if (ampMod) {
            var ampCh = channelsOf(ampMod) || 4;
            var perAmp = (parseAmps(ampMod) || 10) * ampCh;
            // усилителей нужно столько, чтобы хватило тока; каналы лент при этом не добавляются
            amps = Math.max(1, Math.ceil((l12 * stripA) / perAmp));
            add(ampMod, amps, stripWm > TYPICAL.ampThresholdWm
              ? 'Лента ' + stripWm + ' Вт/м (выше ' + TYPICAL.ampThresholdWm + ' Вт/м) — усиление тока по '
                + (parseAmps(ampMod) || 10) + ' А на канал, ' + ampCh + ' кан. на модуль'
              : 'Ток ' + stripA + ' А на канал — усиление тока по ' + (parseAmps(ampMod) || 10)
                + ' А на канал усилителя, ' + ampCh + ' кан. на модуль');
            note('Усилителей добавлено ' + amps + ' шт. по ' + ampCh + ' канала — каналы лент они не добавляют, только ток.');
          } else {
            note('Усилитель тока для лент не найден: ' + (stripWm > TYPICAL.ampThresholdWm
              ? stripWm + ' Вт/м' : stripA + ' А на канал') + ' — диммер 5 А не справится.');
          }
        }
        if (rgb12 > 0) note('RGB/RGBW-групп (' + rgb12 + ') занимают отдельные каналы — всего каналов лент: ' + l12 + '.');
      }

      /* 4. Блок питания лент, запас 25 % */
      if (l12 > 0) {
        var needW = l12 * stripA * stripV * TYPICAL.psuReserve;
        var fit = fitPsu(needW, stripV);
        if (fit) {
          add(fit.p, fit.qty, stripV + ' В DC: ' + l12 * stripA + ' А ≈ ' + Math.round(l12 * stripA * stripV)
            + ' Вт, с запасом 25 % — ' + fit.p.name + ' × ' + fit.qty);
        } else if (stripV === 12) {
          note('Блок питания 12 В в каталоге отсутствует — нужен внешний БП ~' + Math.round(needW)
            + ' Вт на ' + l12 * stripA + ' А. Все БП Wiren Board рассчитаны на 24 В.');
        } else {
          note('Блок питания ' + stripV + ' В не найден в каталоге: нужен ~' + Math.round(needW)
            + ' Вт, ' + l12 * stripA + ' А, ' + stripV + ' В.');
        }
      }

      /* 5. Клавиши: локальные входы диммеров уже заняты */
      if (acDim && capOf(acDim).localIn) localIn += (capOf(acDim).localIn || 0) * state.config.filter(function (i) { return norm(i.sku) === norm(acDim.sku); }).reduce(function (a, i) { return a + i.qty; }, 0);
      var needKeys = Math.max(0, keys - localIn);
      if (needKeys > 0) {
        var keyMod = pick(['WB-MCM8', 'WBE2-DI-DR-3', 'WBIO-DI-WD-14']);
        if (keyMod) {
          add(keyMod, Math.ceil(needKeys / channelsOf(keyMod)), needKeys + ' клавиш, ' + channelsOf(keyMod) + ' входов на модуль');
        } else {
          note('Входные модули не найдены: ' + needKeys + ' клавиш остаются без подключения.');
        }
        if (localIn > 0) note(Math.min(keys, localIn) + ' из ' + keys + ' клавиш работают на локальных входах диммеров — отдельный модуль для них не нужен.');
      }

      /* 6. Датчики */
      if (sensors > 0) {
        var sens = pick(['WB-MSW v.4', 'WB-MSW4-TH', 'WB-MSW4-Zigbee']);
        if (sens) add(sens, sensors, 'Комбинированный датчик: освещённость, присутствие, температура');
        if (s.hvd) {
          var sw = pick(['WBIO-DI-HVD-8', 'WBIO-DI-HVD-16']);
          if (sw) add(sw, Math.max(1, Math.ceil(sensors / channelsOf(sw))), 'Опрос состояния автоматических и проходных выключателей');
          else note('Для автоматических выключателей нужен входной модуль (WBIO-DI-HVD-8).');
        }
      }

      /* 7. Контроллер и его модули */
      var busDevices = 0, slotDevices = 0, dimsLow = 0;
      state.config.forEach(function (it) {
        var p = findProduct(BY_SKU, it.sku);
        if (!p) return;
        if (onBus(p) && roleOf(p) !== 'ctrl') busDevices += it.qty;
        if (usesSlot(p)) slotDevices += it.qty;
        if ((roleOf(p) === 'dim' || roleOf(p) === 'amp') && voltageClass(p) === 'low') dimsLow += it.qty;
      });

      var needCtrl = dimsLow > 0 || keys > 0 || sensors > 0 || slotDevices > 0;
      var standaloneOnly = !needCtrl;
      if (needCtrl) {
        var ctrl = pick(['Wiren Board 8', 'Wiren Board 8M', 'Wiren Board 7']);
        if (ctrl) {
          // один объект — один контроллер, в нём 4 слота MOD.
          add(ctrl, 1, 'Ядро системы: сценарии, MQTT, веб-интерфейс, резервное питание' + (area ? ', ' + area + ' м²' : ''));
          // Дополнительные модули добавляются только по отметкам пользователя в форме.
          // Ничего «про запас» не ставим: пустой список — значит ничего не выбрано.
          var slotsLeft = 4 - slotDevices;
          var optional = [];
          if (s.ups) {
            var ups = pick(['WBMZ6-BATTERY', 'WBMZ4-BATTERY', 'WBMZ6-SUPERCAP']);
            if (ups) optional.push({ p: ups, why: 'Резервное питание контроллера и модулей — сценарии продолжают работать при пропадании 220 В' });
          }
          if (s.zigbee) {
            var zb = pick(['WBE2R-R-ZIGBEE-v2', 'WBE2R-R-ZIGBEE-SH']);
            if (zb) optional.push({ p: zb, why: 'Беспроводные выключатели и датчики Zigbee' });
          }
          if (s.iso) {
            var iso = pick(['WBE2-I-RS485-ISO']);
            if (iso) optional.push({ p: iso, why: 'Дополнительный изолированный RS-485 для ' + busDevices + ' устройств' });
          }
          optional.forEach(function (o) {
            if (slotsLeft >= 1) { add(o.p, 1, o.why); slotsLeft--; }
          });
          optional.forEach(function (o) {
            if (state.config.every(function (i) { return i.sku !== o.p.sku; })) {
              note('Отмеченный вами модуль не поместился — в контроллере нет свободных слотов MOD: ' + o.p.name
                + '. Один объект — один контроллер: вынесите часть устройств в отдельную зону.');
            }
          });
          if (slotDevices > 4) {
            note('Модулей расширения ' + slotDevices + ', а в контроллере 4 слота MOD. '
              + 'Один объект — один контроллер: разбейте объект на зоны или оставьте часть модулей со встроенным БП.');
          }
        } else {
          note('Контроллер не найден в каталоге — добавьте Wiren Board вручную.');
        }
      } else if (standaloneOnly) {
        note('Контроллер не обязателен: устройства работают автономно по локальным сценариям входов.');
      }

      /* 8. Учёт электроэнергии — только по отметке пользователя */
      var metered = plain + dim220 + sockets;
      if (s.meter) {
        var meter = pick(['WB-MAP3EV', 'WB-MAP3E', 'WB-MAP6S']);
        if (meter) {
          var perMeter = channelsOf(meter) * 2;
          add(meter, Math.max(1, Math.ceil(Math.min(metered || 1, perMeter) / channelsOf(meter))),
            'Учёт электроэнергии и мониторинг качества питания');
        }
      } else if (metered >= 8) {
        note('Групп для учёта ' + metered + '. Счётчик WB-MAP3EV не добавлялся — '
          + 'поставьте галочку «счётчик электроэнергии», если он нужен.');
      }

      /* 9. Панель управления — только по отметке пользователя */
      if (s.hmi) {
        var panel = pick(['YC-SM41P']);
        if (panel) add(panel, 1, 'Настенная панель: сцены, диммирование, термостат');
        else note('Панель YC-SM41P не найдена в каталоге.');
      }

      if (!state.config.length) note('Укажите площадь и количество групп — иначе подбирать нечего.');

      var res = analyze(state, BY_SKU);
      // подсказки самого подбора: analyze() их не повторяет, поэтому отдаём отдельно,
      // иначе интерфейс (он зовёт analyze() сам) их потеряет
      var autoNotes = takeNotes();
      res.notes = res.notes.concat(autoNotes);
      res.autoNotes = autoNotes;
      return res;
    }

    return {
      analyze: function (state) { return analyze(state, BY_SKU); },
      autoConfigure: autoConfigure,
      find: function (q) { return findProduct(BY_SKU, q); },
      psus: psus,
      cfgAdd: function (s, sku, qty, nt) { return cfgAdd(s, sku, qty, nt); },
      cfgRemove: cfgRemove,
      cfgClear: cfgClear,
      cfgGet: cfgGet,
      priceOf: function (sku) { return priceOf(BY_SKU, sku); },
      sumOf: function (list) { return sumOf(BY_SKU, list); },
    };
  }

  return {
    createEngine: createEngine,
    norm: norm, skuKey: skuKey, findProduct: findProduct,
    roleOf: roleOf, catOf: catOf, voltageClass: voltageClass, VOLTAGE_LABEL: VOLTAGE_LABEL,
    onBus: onBus, usesSlot: usesSlot, isStandalone: isStandalone,
    channelsOf: channelsOf, parseAmps: parseAmps, parseWatts: parseWatts, capOf: capOf,
    int: int, fmtA: fmtA, fmtW: fmtW,
    cfgAdd: cfgAdd, cfgRemove: cfgRemove, cfgClear: cfgClear, cfgGet: cfgGet,
    priceOf: priceOf, sumOf: sumOf,
    TYPICAL: TYPICAL,
  };
});
