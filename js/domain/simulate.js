// 計算（画面に依存しない純粋関数）。金額の単位はすべて万円。
(function (root) {
  'use strict';

  const OT = root.OT;
  const Rand = OT.Rand;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // 入れ方の決まりを、こどもNISAのルールに合わせて整える
  function normalizePlan(p) {
    const N = OT.NISA;
    const startAge = clamp(Math.round(Number(p && p.startAge) || 0), 0, N.lastAge);
    const first = clamp(Number(p && p.first) || 0, 1, N.yearlyMax);
    const yearly = clamp(Number(p && p.yearly) || 0, 0, N.yearlyMax);
    return { startAge: startAge, first: first, yearly: yearly };
  }

  // 対数リターンの中心とばらつき（ふつうの年／大きく下がる年）
  function lnParams(b) {
    const p = OT.CRASH_P;
    const muC = Math.log(1 + b.crash);
    const muN = (Math.log(1 + b.grow) - p * muC) / (1 - p);
    return { muN: muN, sdN: b.sd, muC: muC, sdC: b.crashSd };
  }

  // 1年ぶんの「世界のできごと」。すべてのカゴで同じものを使う。
  function drawShock(rand) {
    return { crash: rand() < OT.CRASH_P, z: Rand.normal(rand) };
  }

  function drawShocks(rand, years) {
    const out = [];
    for (let i = 0; i < years; i++) out.push(drawShock(rand));
    return out;
  }

  // そのカゴの、その年の増え方（0.05 なら +5%）
  function yearReturn(b, shock) {
    if (b.fixed) return b.grow;
    const q = lnParams(b);
    const lr = shock.crash ? q.muC + q.sdC * shock.z : q.muN + q.sdN * shock.z;
    return Math.exp(lr) - 1;
  }

  // ある年齢での「入れたお金」の合計（その年齢のはじめに入れたぶんまで）
  function investedAt(plan, age) {
    const pl = normalizePlan(plan);
    if (age < pl.startAge) return 0;
    const lastAdd = Math.min(age, OT.NISA.lastAge);
    const adds = Math.max(0, lastAdd - pl.startAge);
    return pl.first + pl.yearly * adds;
  }

  // 1本の未来をたどる。
  //   shocks[i] は、(startAge + i) さいから1年間のできごと。
  //   soldAge が数字なら、その年齢からあとは ちょきん箱 として増える。
  //   返り値 points[k] = { age, value, invested, ret }（ret はその直前の1年の増え方）
  function simulatePath(plan, basket, shocks, endAge, soldAge) {
    const pl = normalizePlan(plan);
    const N = OT.NISA;
    let value = pl.first;
    let invested = pl.first;
    const points = [{ age: pl.startAge, value: value, invested: invested, ret: null }];
    const years = Math.max(0, Math.min(endAge - pl.startAge, shocks.length));
    for (let i = 0; i < years; i++) {
      const ageFrom = pl.startAge + i;
      const sold = soldAge != null && ageFrom >= soldAge;
      const b = sold ? OT.BANK : basket;
      const r = yearReturn(b, shocks[i]);
      value = value * (1 + r);
      const age = ageFrom + 1;
      if (age <= N.lastAge && pl.yearly > 0) {
        value += pl.yearly;
        invested += pl.yearly;
      }
      points.push({ age: age, value: value, invested: invested, ret: r });
    }
    return points;
  }

  // 同じ100とおりの未来で、ぜんぶのカゴをくらべる
  function runMany(plan, endAge, n, seed) {
    const pl = normalizePlan(plan);
    const rand = Rand.mulberry32(seed);
    const years = Math.max(0, endAge - pl.startAge);
    const all = OT.BASKETS.concat([OT.BANK]);
    const results = {};
    all.forEach(function (b) { results[b.id] = []; });
    for (let k = 0; k < n; k++) {
      const shocks = drawShocks(rand, years);
      all.forEach(function (b) {
        const pts = simulatePath(pl, b, shocks, endAge, null);
        results[b.id].push(pts[pts.length - 1].value);
      });
    }
    return { invested: investedAt(pl, endAge), results: results, n: n, endAge: endAge };
  }

  // 並べたときの位置（q=0.5 で まんなか）
  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function summarize(values, invested) {
    const s = values.slice().sort(function (a, b) { return a - b; });
    let losses = 0;
    s.forEach(function (v) { if (v < invested) losses++; });
    return {
      low: quantile(s, 0.1),     // わるいほうから10ばんめくらい
      median: quantile(s, 0.5),  // まんなか
      high: quantile(s, 0.9),    // いいほうから10ばんめくらい
      min: s[0],
      max: s[s.length - 1],
      losses: losses,            // 入れたお金よりへった回数
      n: s.length
    };
  }

  // 72のルール：72 ÷ (1年に増える%) ＝ 2倍になるまでのおよその年数
  function rule72(pct) { return 72 / pct; }
  function doublingYears(pct) { return Math.log(2) / Math.log(1 + pct / 100); }

  OT.Sim = {
    normalizePlan: normalizePlan,
    lnParams: lnParams,
    drawShock: drawShock,
    drawShocks: drawShocks,
    yearReturn: yearReturn,
    investedAt: investedAt,
    simulatePath: simulatePath,
    runMany: runMany,
    quantile: quantile,
    summarize: summarize,
    rule72: rule72,
    doublingYears: doublingYears
  };
})(globalThis);
