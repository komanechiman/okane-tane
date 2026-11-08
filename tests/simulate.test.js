// 計算のテスト（tests.html から読み込む）
(function (root) {
  'use strict';

  const OT = root.OT;
  const Sim = OT.Sim;
  const Rand = OT.Rand;
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name: name, ok: true });
    } catch (e) {
      results.push({ name: name, ok: false, msg: e && e.message ? e.message : String(e) });
    }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }
  function near(a, b, tol, msg) {
    if (!(Math.abs(a - b) <= tol)) throw new Error((msg || 'near') + ': ' + a + ' vs ' + b + ' (tol ' + tol + ')');
  }

  test('乱数はシードで再現できる', function () {
    const a = Rand.mulberry32(42), b = Rand.mulberry32(42);
    for (let i = 0; i < 10; i++) assert(a() === b(), 'same seed same sequence');
  });

  test('正規乱数の平均0・標準偏差1', function () {
    const r = Rand.mulberry32(7);
    let s = 0, s2 = 0;
    const n = 50000;
    for (let i = 0; i < n; i++) { const z = Rand.normal(r); s += z; s2 += z * z; }
    near(s / n, 0, 0.02, 'mean');
    near(Math.sqrt(s2 / n - (s / n) * (s / n)), 1, 0.02, 'sd');
  });

  test('入れ方はこどもNISAの決まりにそろえる', function () {
    const p = Sim.normalizePlan({ startAge: 25, first: 100, yearly: 99 });
    assert(p.startAge === 17, 'age capped at 17');
    assert(p.first === 60, 'first capped at 60');
    assert(p.yearly === 60, 'yearly capped at 60');
    const q = Sim.normalizePlan({ startAge: -3, first: 0, yearly: -5 });
    assert(q.startAge === 0 && q.first === 1 && q.yearly === 0, 'lower bounds');
  });

  test('入れたお金は17さいまで毎年ふえて、そのあとは止まる', function () {
    const plan = { startAge: 6, first: 60, yearly: 3 };
    assert(Sim.investedAt(plan, 6) === 60, 'at start');
    assert(Sim.investedAt(plan, 7) === 63, 'one add');
    assert(Sim.investedAt(plan, 17) === 60 + 3 * 11, 'last add at 17');
    assert(Sim.investedAt(plan, 18) === 60 + 3 * 11, 'no add at 18');
    assert(Sim.investedAt(plan, 60) === 60 + 3 * 11, 'no add later');
  });

  test('道のりの入れたお金と investedAt が一致する', function () {
    const plan = { startAge: 3, first: 30, yearly: 5 };
    const shocks = Sim.drawShocks(Rand.mulberry32(1), 57);
    const pts = Sim.simulatePath(plan, OT.BASKETS[0], shocks, 60, null);
    assert(pts.length === 58, 'points from 3 to 60');
    pts.forEach(function (p) { assert(p.invested === Sim.investedAt(plan, p.age), 'age ' + p.age); });
  });

  test('ちょきん箱は毎年0.2%で、へらない', function () {
    const plan = { startAge: 0, first: 60, yearly: 0 };
    const shocks = Sim.drawShocks(Rand.mulberry32(2), 18);
    const pts = Sim.simulatePath(plan, OT.BANK, shocks, 18, null);
    near(pts[18].value, 60 * Math.pow(1.002, 18), 1e-9, 'bank');
  });

  test('売ったあとは ちょきん箱と同じ増え方になる', function () {
    const plan = { startAge: 5, first: 60, yearly: 0 };
    const shocks = Sim.drawShocks(Rand.mulberry32(3), 13);
    const pts = Sim.simulatePath(plan, OT.BASKETS[0], shocks, 18, 10);
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].age - 1 >= 10) near(pts[i].ret, OT.BANK.grow, 1e-12, 'after sell age ' + pts[i].age);
    }
    const held = Sim.simulatePath(plan, OT.BASKETS[0], shocks, 18, null);
    for (let i = 1; i <= 5; i++) near(pts[i].value, held[i].value, 1e-9, 'same before selling');
  });

  test('長い目で見ると、まんなかの人は1年に grow ずつ増える', function () {
    OT.BASKETS.forEach(function (b) {
      const rand = Rand.mulberry32(11);
      const vals = [];
      for (let k = 0; k < 3000; k++) {
        const shocks = Sim.drawShocks(rand, 40);
        const pts = Sim.simulatePath({ startAge: 0, first: 60, yearly: 0 }, b, shocks, 40, null);
        vals.push(pts[pts.length - 1].value);
      }
      vals.sort(function (a, c) { return a - c; });
      const med = Sim.quantile(vals, 0.5);
      const g = Math.pow(med / 60, 1 / 40) - 1;
      near(g, b.grow, 0.005, b.id + ' median growth');
    });
  });

  test('1年のゆれは アメリカ > 世界 > バランス', function () {
    function sd(b) {
      const rand = Rand.mulberry32(5);
      let s = 0, s2 = 0;
      const n = 40000;
      for (let i = 0; i < n; i++) { const r = Sim.yearReturn(b, Sim.drawShock(rand)); s += r; s2 += r * r; }
      return Math.sqrt(s2 / n - (s / n) * (s / n));
    }
    const w = sd(OT.basketById('world')), u = sd(OT.basketById('usa')), bl = sd(OT.basketById('balance'));
    assert(u > w && w > bl, 'order ' + [u, w, bl].join(','));
    near(w, 0.18, 0.03, 'world sd');
    near(bl, 0.09, 0.03, 'balance sd');
  });

  test('100回くらべるは、同じシードなら同じけっか', function () {
    const plan = { startAge: 6, first: 60, yearly: 0 };
    const a = Sim.runMany(plan, 18, 100, 99);
    const b = Sim.runMany(plan, 18, 100, 99);
    assert(a.results.world.join() === b.results.world.join(), 'deterministic');
    assert(a.results.world.length === 100, '100 runs');
    assert(a.invested === 60, 'invested');
    const s = Sim.summarize(a.results.bank, a.invested);
    assert(s.losses === 0, 'bank never loses');
  });

  test('72のルール', function () {
    near(Sim.rule72(5), 14.4, 1e-9, '72/5');
    near(Sim.doublingYears(5), 14.2, 0.05, 'exact');
  });

  test('summarize の まんなか・へった回数', function () {
    const s = Sim.summarize([50, 60, 70, 80, 90], 65);
    assert(s.median === 70, 'median');
    assert(s.losses === 2, 'losses');
  });

  root.TEST_RESULTS = results;
})(globalThis);
