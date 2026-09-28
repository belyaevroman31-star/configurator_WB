/* =========================================================================
   Эмблема BELYAEV_PROJECT — общая для заставки, иконок приложения и maskable.
   Одна функция рисования, поэтому заставка и иконка не могут разойтись.
   Использование: WBEmblem.draw(canvas, { scale, compact })
   ========================================================================= */
(function (root) {
  'use strict';

  var FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  var C = {
    bgTop: '#0d1830',
    bgBot: '#060b16',
    glow: 'rgba(77,124,255,0.55)',
    title: '#ffffff',
    sub: '#7ea6ff',
    sub2: '#93a9c9',
  };

  // пропорции отведены под реальные пропорции экранов, чтобы текст не обрезался
  function draw(canvas, opts) {
    opts = opts || {};
    var dpr = opts.dpr || (root.devicePixelRatio || 1);
    var w = opts.w || canvas.clientWidth || root.innerWidth;
    var h = opts.h || canvas.clientHeight || root.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ---------- фон ----------
    var bg = ctx.createLinearGradient(0, 0, w * 0.35, h);
    bg.addColorStop(0, C.bgTop);
    bg.addColorStop(1, C.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // мягкое свечение по центру
    var r = Math.min(w, h) * 0.62;
    var gl = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, r);
    gl.addColorStop(0, 'rgba(77,124,255,0.28)');
    gl.addColorStop(0.55, 'rgba(77,124,255,0.07)');
    gl.addColorStop(1, 'rgba(77,124,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, w, h);

    // ---------- декоративная сетка ----------
    var step = Math.max(26, Math.min(w, h) / 14);
    ctx.save();
    ctx.strokeStyle = 'rgba(126,166,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = step / 2; x < w; x += step) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (var y = step / 2; y < h; y += step) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();
    ctx.restore();

    // ---------- размеры текста ----------
    // подстраиваем к ширине, чтобы «BELYAEV_PROJECT» всегда влезал
    var unit = Math.min(w, h * 0.62);
    var t1 = Math.min(unit * 0.135, w / 10.4);
    var t2 = t1 * 0.60;
    var t3 = t1 * 0.40;
    if (opts.compact) { t1 *= 0.92; t2 *= 0.92; t3 *= 0.92; }

    var cy = h * (opts.compact ? 0.47 : 0.46);
    var gap1 = t1 * 0.52;   // BELYAEV_PROJECT -> WirenBoard
    var gap2 = t2 * 0.92;   // WirenBoard -> КОНФИГУРАТОР

    function line(text, size, y, color, spacing, weight) {
      ctx.font = (weight || 700) + ' ' + size + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      var sp = (spacing || 0) * size;
      var chars = text.split('');
      var total = 0, i, cw;
      for (i = 0; i < chars.length; i++) { cw = ctx.measureText(chars[i]).width; total += cw + (i < chars.length - 1 ? sp : 0); }
      // если текст шире полосы набора — ужимаем разрядку, потом сам шрифт
      var maxW = w * (opts.compact ? 0.84 : 0.90);
      if (total > maxW) { sp = Math.max(0, sp - (total - maxW) / Math.max(1, chars.length - 1)); }
      var k = 1;
      if (total > maxW) k = maxW / total;
      ctx.save();
      ctx.translate(w / 2, y);
      ctx.scale(k, 1);
      ctx.fillStyle = color;
      var cx = -total / 2;
      for (i = 0; i < chars.length; i++) {
        cw = ctx.measureText(chars[i]).width * k;
        ctx.fillText(chars[i], cx + cw / 2, 0);
        cx += cw + sp * k;
      }
      ctx.restore();
      return total * k;
    }

    // ---------- линии эмблемы ----------
    var ruleW = Math.min(w * 0.42, t1 * 3.2);
    var y1 = cy - gap1 * 0.25;
    var y3 = cy + gap1 + gap2 * 0.45;

    ctx.save();
    var rg = ctx.createLinearGradient(w / 2 - ruleW / 2, 0, w / 2 + ruleW / 2, 0);
    rg.addColorStop(0, 'rgba(126,166,255,0)');
    rg.addColorStop(0.5, 'rgba(126,166,255,0.65)');
    rg.addColorStop(1, 'rgba(126,166,255,0)');
    ctx.strokeStyle = rg;
    ctx.lineWidth = Math.max(1, t3 * 0.14);
    [y1, y3].forEach(function (yy) {
      ctx.beginPath();
      ctx.moveTo(w / 2 - ruleW / 2, yy);
      ctx.lineTo(w / 2 + ruleW / 2, yy);
      ctx.stroke();
    });
    ctx.restore();

    // ---------- текст ----------
    // 1. по центру — BELYAEV_PROJECT
    line('BELYAEV_PROJECT', t1, cy, C.title, 0.075, 800);
    // 2. ниже, шрифтом поменьше — WirenBoard
    line('WirenBoard', t2, cy + gap1, C.sub, 0.03, 600);
    // 3. ещё ниже, на строчку — КОНФИГУРАТОР
    line('КОНФИГУРАТОР', t3, cy + gap1 + gap2, C.sub2, 0.30, 500);

    return { title: t1, sub: t2, sub2: t3, cy: cy };
  }

  root.WBEmblem = { draw: draw, COLORS: C };
})(typeof globalThis !== 'undefined' ? globalThis : this);
