// グラフ（SVG を文字列で作る。ライブラリなし）。色は style.css の変数を使う。
(function (root) {
  'use strict';

  const OT = root.OT;

  function niceMax(v) {
    if (!(v > 0)) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] * p >= v) return steps[i] * p;
    }
    return 10 * p;
  }

  // 目もりの間かく（だいたい4本になるように）
  function niceStep(max) {
    const raw = max / 4;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const c = [1, 2, 2.5, 5, 10];
    for (let i = 0; i < c.length; i++) {
      if (c[i] * p >= raw) return c[i] * p;
    }
    return 10 * p;
  }

  function manLabel(v) {
    if (v >= 10000) {
      const oku = v / 10000;
      return (Math.round(oku * 10) / 10) + '億';
    }
    return Math.round(v).toLocaleString('ja-JP') + '万';
  }

  function f(n) { return Math.round(n * 10) / 10; }

  // そだてる画面：お金の変化（線）と、入れたお金（点線）
  //   o = { actual: points, held: points|null, basketId, minAge, maxAge }
  function growth(o) {
    const W = 460, H = 236, L = 46, R = 14, T = 14, B = 30;
    const pw = W - L - R, ph = H - T - B;
    const all = o.actual.concat(o.held || []);
    let top = 0;
    all.forEach(function (p) { top = Math.max(top, p.value, p.invested); });
    const ymax = niceMax(top * 1.08);
    const step = niceStep(ymax);
    const span = Math.max(1, o.maxAge - o.minAge);
    const x = function (age) { return L + (age - o.minAge) / span * pw; };
    const y = function (v) { return T + ph - (v / ymax) * ph; };
    const out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg" role="img" aria-label="お金の変化のグラフ">');

    // よこの目もり
    for (let v = 0; v <= ymax + 1e-9; v += step) {
      out.push('<line class="ch-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + f(y(v)) + '" y2="' + f(y(v)) + '"/>');
      out.push('<text class="ch-ylab" x="' + (L - 6) + '" y="' + f(y(v) + 4) + '" text-anchor="end">' + manLabel(v) + '</text>');
    }

    // たての目じるし（12さい・18さい・30さい）
    const marks = [];
    if (o.minAge < OT.NISA.unlockAge) marks.push({ age: OT.NISA.unlockAge, label: '12' });
    marks.push({ age: OT.NISA.adultAge, label: '18さい' });
    if (o.maxAge >= 30) marks.push({ age: 30, label: '30' });
    marks.forEach(function (m) {
      if (m.age > o.maxAge) return;
      out.push('<line class="ch-mark" x1="' + f(x(m.age)) + '" x2="' + f(x(m.age)) + '" y1="' + T + '" y2="' + (T + ph) + '"/>');
    });

    // よこじくの文字
    const ticks = [{ age: o.minAge, label: o.minAge + 'さい' }].concat(marks.filter(function (m) { return m.age <= o.maxAge; }));
    if (o.maxAge > OT.NISA.adultAge) ticks.push({ age: o.maxAge, label: o.maxAge + 'さい' });
    let lastX = -999;
    ticks.forEach(function (t) {
      const tx = x(t.age);
      if (tx - lastX < 26) return;
      lastX = tx;
      const anchor = t.age === o.minAge ? 'start' : (t.age === o.maxAge ? 'end' : 'middle');
      out.push('<text class="ch-xlab" x="' + f(tx) + '" y="' + (H - 9) + '" text-anchor="' + anchor + '">' + t.label + '</text>');
    });

    // 入れたお金（階だん）
    if (o.actual.length) {
      let d = 'M' + f(x(o.actual[0].age)) + ' ' + f(y(o.actual[0].invested));
      for (let i = 1; i < o.actual.length; i++) {
        d += ' H' + f(x(o.actual[i].age)) + ' V' + f(y(o.actual[i].invested));
      }
      out.push('<path class="ch-invested" d="' + d + '"/>');
    }

    // もし もっていたら
    if (o.held && o.held.length > 1) {
      const hd = o.held.map(function (p, i) { return (i ? 'L' : 'M') + f(x(p.age)) + ' ' + f(y(p.value)); }).join(' ');
      out.push('<path class="ch-held" d="' + hd + '"/>');
    }

    // いまのお金
    const color = 'var(--c-' + o.basketId + ')';
    if (o.actual.length > 1) {
      const line = o.actual.map(function (p, i) { return (i ? 'L' : 'M') + f(x(p.age)) + ' ' + f(y(p.value)); }).join(' ');
      const last = o.actual[o.actual.length - 1];
      const area = line + ' L' + f(x(last.age)) + ' ' + f(y(0)) + ' L' + f(x(o.actual[0].age)) + ' ' + f(y(0)) + ' Z';
      out.push('<path class="ch-area" style="fill:' + color + '" d="' + area + '"/>');
      out.push('<path class="ch-line" style="stroke:' + color + '" d="' + line + '"/>');
    }
    const r = span > 30 ? 2.2 : 3.4;
    o.actual.forEach(function (p, i) {
      if (i === 0) return;
      const cls = p.ret < 0 ? 'ch-dot down' : 'ch-dot up';
      out.push('<circle class="' + cls + '" cx="' + f(x(p.age)) + '" cy="' + f(y(p.value)) + '" r="' + r + '"/>');
    });
    const now = o.actual[o.actual.length - 1];
    out.push('<circle class="ch-now" style="stroke:' + color + '" cx="' + f(x(now.age)) + '" cy="' + f(y(now.value)) + '" r="6"/>');

    out.push('</svg>');
    return out.join('');
  }

  // 100回くらべる：点1つが未来1つ
  //   o = { rows: [{ id, label, values, median }], invested }
  function dots(o) {
    const W = 460, L = 14, R = 30, rowH = 62, T = 22, B = 30;
    const H = T + rowH * o.rows.length + B;
    const pw = W - L - R;
    // 右はしは、どのカゴも85%の点がおさまるくらいにする（長いしっぽは はしにまとめて「+数」で見せる）
    let cap = o.invested * 1.5;
    o.rows.forEach(function (row) {
      const s = row.values.slice().sort(function (a, b) { return a - b; });
      cap = Math.max(cap, OT.Sim.quantile(s, 0.85));
    });
    const xmax = niceMax(cap);
    const x = function (v) { return L + Math.min(v, xmax) / xmax * pw; };
    const out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg" role="img" aria-label="100とおりの未来の点のグラフ">');

    // 入れたお金の線
    const xi = f(x(o.invested));
    out.push('<line class="ch-loss-line" x1="' + xi + '" x2="' + xi + '" y1="' + (T - 4) + '" y2="' + (H - B + 4) + '"/>');
    const labAnchor = xi < L + 40 ? 'start' : 'middle';
    const labX = xi < L + 40 ? Math.max(2, xi - 4) : xi;
    out.push('<text class="ch-loss-lab" x="' + labX + '" y="' + (T - 9) + '" text-anchor="' + labAnchor + '">入れたお金</text>');

    o.rows.forEach(function (row, ri) {
      const y0 = T + ri * rowH;
      const color = 'var(--c-' + row.id + ')';
      if (ri > 0) out.push('<line class="ch-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y0 + '" y2="' + y0 + '"/>');
      out.push('<text class="ch-rowlab" x="' + L + '" y="' + (y0 + 15) + '">' + row.label + '</text>');
      const cy = y0 + 39;
      let over = 0;
      row.values.forEach(function (v, i) {
        if (v > xmax) over++;
        const jitter = ((i * 0.6180339887) % 1) * 26 - 13;
        const cls = v < o.invested ? 'ch-pt loss' : 'ch-pt';
        const st = v < o.invested ? '' : ' style="fill:' + color + '"';
        out.push('<circle class="' + cls + '"' + st + ' cx="' + f(x(v)) + '" cy="' + f(cy + jitter) + '" r="3.3"/>');
      });
      // まんなか
      const xm = f(x(row.median));
      out.push('<rect class="ch-median" x="' + (xm - 2) + '" y="' + (cy - 17) + '" width="4" height="34" rx="2" style="fill:' + color + '"/>');
      if (over > 0) {
        out.push('<text class="ch-over" x="' + (W - R + 4) + '" y="' + (cy + 4) + '">+' + over + '</text>');
      }
    });

    // よこじく
    const ay = H - B + 4;
    out.push('<line class="ch-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + ay + '" y2="' + ay + '"/>');
    const step = niceStep(xmax);
    for (let v = 0; v <= xmax + 1e-9; v += step) {
      const anchor = v === 0 ? 'start' : 'middle';
      out.push('<text class="ch-xlab" x="' + f(x(v)) + '" y="' + (ay + 16) + '" text-anchor="' + anchor + '">' + manLabel(v) + '</text>');
    }
    out.push('</svg>');
    return out.join('');
  }

  OT.Chart = { growth: growth, dots: dots, niceMax: niceMax, niceStep: niceStep };
})(globalThis);
