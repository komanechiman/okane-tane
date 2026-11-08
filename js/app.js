// 画面（ホーム・じゅんび・そだてる・けっか・100回くらべる・ルール）
(function (root) {
  'use strict';

  const OT = root.OT;
  const Sim = OT.Sim;
  const Store = OT.Store;
  const Chart = OT.Chart;
  const Rand = OT.Rand;
  const NISA = OT.NISA;

  const FIRST_OPTIONS = [10, 30, 60];
  const YEARLY_OPTIONS = [0, 1, 3, 5];
  const HORIZONS = [18, 30, 60];
  const KEEP_UNTIL = 60;
  const HISTORY_MAX = 30;
  const SCREENS = ['home', 'setup', 'grow', 'result', 'compare', 'rules'];

  const $ = function (id) { return document.getElementById(id); };

  function loadPlan() {
    const p = Sim.normalizePlan(Store.load('plan', { startAge: 6, first: 60, yearly: 0 }));
    if (FIRST_OPTIONS.indexOf(p.first) < 0) p.first = 60;
    if (YEARLY_OPTIONS.indexOf(p.yearly) < 0) p.yearly = 0;
    return p;
  }

  const state = {
    screen: null,
    plan: loadPlan(),
    basketId: OT.basketById(Store.load('basket', 'world')).id,
    setupMode: 'grow',
    game: null,
    compare: { endAge: 18, seed: Rand.newSeed() },
    timer: null
  };

  // ---------- 表示の小物 ----------
  function yen(v) {
    const r = Math.round(v);
    if (r >= 10000) {
      const oku = Math.floor(r / 10000);
      const man = r % 10000;
      return oku + '億' + (man ? man.toLocaleString('ja-JP') + '万円' : '円');
    }
    return r.toLocaleString('ja-JP') + '万円';
  }
  function pct(r) {
    if (Math.abs(r) < 0.01) {
      const q = Math.round(r * 1000) / 10;
      return (q > 0 ? '+' : q < 0 ? '−' : '±') + Math.abs(q) + '%';
    }
    const p = Math.round(r * 100);
    return (p > 0 ? '+' : '−') + Math.abs(p) + '%';
  }
  // せまい箱に入れる用（数字は大きく、単位は小さく）
  function yenBox(v) {
    const r = Math.round(v);
    if (r >= 10000) return (Math.round(r / 1000) / 10) + '<small>億円</small>';
    return r.toLocaleString('ja-JP') + '<small>万円</small>';
  }
  function weather(r) {
    if (r >= 0.15) return '🌞';
    if (r >= 0.03) return '☀️';
    if (r >= 0) return '🌤️';
    if (r > OT.DROP_ASK) return '🌧️';
    return '⛈️';
  }
  function stars(n) {
    return '<span class="stars">' + '★'.repeat(n) + '<i>' + '★'.repeat(4 - n) + '</i></span>';
  }
  function times(a, b) {
    return (Math.round(a / b * 10) / 10) + '倍';
  }

  // ---------- 画面の切りかえ（#home など。戻るボタンで戻れる） ----------
  const render = {};

  function show(name) {
    SCREENS.forEach(function (s) { $('s-' + s).classList.toggle('active', s === name); });
    $('btn-home').hidden = name === 'home';
    $('btn-rules').hidden = name === 'rules';
    if (state.screen !== name) root.scrollTo(0, 0);
    state.screen = name;
  }

  function go(name) {
    if (location.hash === '#' + name) route();
    else location.hash = name;
  }

  function route() {
    let name = location.hash.replace('#', '') || 'home';
    if (SCREENS.indexOf(name) < 0) name = 'home';
    if ((name === 'grow' || name === 'result') && !state.game) name = 'home';
    if (name === 'grow' && state.game.phase === 'done') name = 'result';
    if (name !== 'grow') {
      stopTimer();
      closeDrop();
    }
    render[name]();
    show(name);
  }

  // ---------- ホーム ----------
  render.home = function () {
    const list = Store.load('history', []);
    if (!Array.isArray(list) || !list.length) {
      $('history').innerHTML = '<div class="empty">まだないよ。「そだててみる」であそんでみよう。</div>';
      return;
    }
    $('history').innerHTML = list.slice(0, 10).map(function (h) {
      const b = OT.basketById(h.b);
      const d = new Date(Number(h.t) || 0);
      const inv = Number(h.inv) || 0;
      const v18 = Number(h.v18) || 0;
      const v60 = h.v60 == null ? null : Number(h.v60) || 0;
      const age = Number(h.a) || 0;
      return '<div class="hist-item"><span class="he">' + b.emoji + '</span><span class="hm">' +
        '<b>' + yen(inv) + ' → ' + yen(v18) + '</b>' +
        (v18 < inv ? '<span class="tag">へった</span>' : '') +
        (h.sold ? '<span class="tag">🐷 売った</span>' : '') +
        '<span class="hs">' + (d.getMonth() + 1) + '/' + d.getDate() + '・' + b.short + '・' + age + 'さい→18さい' +
        (v60 != null ? '・60さいで ' + yen(v60) : '') + '</span></span></div>';
    }).join('');
  };

  // ---------- じゅんび ----------
  function openSetup(mode) {
    state.setupMode = mode;
    go('setup');
  }

  render.setup = function () {
    const grow = state.setupMode === 'grow';
    $('setup-title').textContent = grow ? '🌱 じゅんび' : '🎲 じゅんび';
    $('basket-pick').hidden = !grow;
    $('setup-go').textContent = grow ? 'スタート！' : '100回ためす 🎲';
    renderSetupInputs();
  };

  function basketCard(b, on) {
    return '<button type="button" class="basket-card' + (on ? ' on' : '') + '" style="--bc:var(--c-' + b.id + ')" data-basket="' + b.id + '" aria-pressed="' + on + '">' +
      '<span class="bk-top"><span class="bk-emoji">' + b.emoji + '</span><span class="bk-name">' + b.name + '</span><span class="bk-check">✓</span></span>' +
      '<span class="bk-desc">' + b.desc + '</span>' +
      '<span class="bk-stars"><span>のびる ' + stars(b.growStars) + '</span><span>ゆれ ' + stars(b.swingStars) + '</span></span>' +
      '<span class="bk-point">' + b.point + '</span>' +
      '</button>';
  }

  function renderSetupInputs() {
    const p = state.plan;
    $('age-val').textContent = p.startAge + 'さい';
    $('age-minus').disabled = p.startAge <= 0;
    $('age-plus').disabled = p.startAge >= NISA.lastAge;
    $('first-chips').innerHTML = FIRST_OPTIONS.map(function (v) {
      return '<button type="button" class="chip' + (p.first === v ? ' on' : '') + '" data-first="' + v + '">' + v + '万円</button>';
    }).join('');
    $('yearly-chips').innerHTML = YEARLY_OPTIONS.map(function (v) {
      return '<button type="button" class="chip' + (p.yearly === v ? ' on' : '') + '" data-yearly="' + v + '">' + (v ? v + '万円' : 'たさない') + '</button>';
    }).join('');
    $('basket-cards').innerHTML = OT.BASKETS.map(function (b) { return basketCard(b, b.id === state.basketId); }).join('');
  }

  function setPlan(patch) {
    state.plan = Sim.normalizePlan(Object.assign({}, state.plan, patch));
    Store.save('plan', state.plan);
    renderSetupInputs();
  }

  // ---------- そだてる ----------
  function startGame() {
    const plan = Object.assign({}, state.plan);
    const seed = Rand.newSeed();
    state.game = {
      plan: plan,
      basketId: state.basketId,
      seed: seed,
      shocks: Sim.drawShocks(Rand.mulberry32(seed), KEEP_UNTIL - plan.startAge),
      age: plan.startAge,
      soldAge: null,
      drops: 0,
      endAge: null,
      phase: 'kid',
      saved: false
    };
    go('grow');
  }

  function gamePath(g, upto, soldAge) {
    return Sim.simulatePath(g.plan, OT.basketById(g.basketId), g.shocks, upto, soldAge);
  }

  render.grow = function () {
    const g = state.game;
    const b = OT.basketById(g.basketId);
    const pts = gamePath(g, g.age, g.soldAge);
    const held = g.soldAge != null ? gamePath(g, g.age, null) : null;
    const now = pts[pts.length - 1];
    const sold = g.soldAge != null;

    $('g-basket').textContent = sold ? '🐷 ちょきん箱（もとは ' + b.short + '）' : b.emoji + ' ' + b.name;
    $('g-age').textContent = now.age + 'さい';
    const v = $('g-value');
    v.textContent = yen(now.value);
    v.className = 'mc-value ' + (now.value >= now.invested ? 'up' : 'down');
    $('g-sub').textContent = '入れたお金 ' + yen(now.invested);

    let msg;
    if (pts.length === 1) {
      msg = 'ボタンをおすと、1年すすむよ。';
    } else {
      const r = now.ret;
      msg = (now.age - 1) + 'さい→' + now.age + 'さい：<span class="' + (r < 0 ? 'down' : 'up') + '">' + pct(r) + '</span> ' + weather(r);
    }
    if (sold && now.age > g.soldAge) msg += '<span class="tag">🐷 ちょきん中</span>';
    $('g-msg').innerHTML = msg;

    const maxAge = now.age > NISA.adultAge || g.phase === 'after' ? KEEP_UNTIL : NISA.adultAge;
    $('g-chart').innerHTML = Chart.growth({ actual: pts, held: held, basketId: b.id, minAge: g.plan.startAge, maxAge: maxAge });
    $('g-legend').innerHTML =
      '<span><i style="border-color:var(--c-' + b.id + ')"></i>いまのお金</span>' +
      '<span><i class="dash" style="border-color:var(--soft)"></i>入れたお金</span>' +
      (held ? '<span><i class="dash" style="border-color:var(--gold)"></i>もし売らずに もっていたら</span>' : '') +
      '<span><b style="color:var(--ok)">●</b> ふえた年 <b style="color:var(--ng)">●</b> へった年</span>';
    $('g-weather').innerHTML = pts.slice(1).filter(function (p) { return p.age <= NISA.adultAge; }).map(function (p) {
      const piggy = sold && p.age - 1 >= g.soldAge;
      return '<span title="' + (p.age - 1) + 'さい→' + p.age + 'さい ' + pct(p.ret) + '">' + (piggy ? '🐷' : weather(p.ret)) + '</span>';
    }).join('');

    const kid = now.age < NISA.adultAge;
    const card18 = $('g-18');
    const was18Hidden = card18.hidden;
    $('g-controls').hidden = !(g.phase === 'kid' && kid);
    card18.hidden = !(g.phase === 'kid' && !kid);
    if (!card18.hidden) {
      $('g-18-text').innerHTML = '入れたお金 <b>' + yen(now.invested) + '</b> が、<b>' + yen(now.value) + '</b> になった。';
      if (was18Hidden) card18.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    $('g-step').disabled = !!state.timer;
    $('g-fast').disabled = !!state.timer;
  };

  // 1年すすめる。'ok' / 'drop'（へっちゃった）/ 'end'（18さい）を返す
  function stepYear() {
    const g = state.game;
    if (!g || g.phase !== 'kid' || g.age >= NISA.adultAge || !$('drop-modal').hidden) return 'end';
    g.age++;
    const pts = gamePath(g, g.age, g.soldAge);
    const now = pts[pts.length - 1];
    render.grow();
    if (g.soldAge == null && now.ret <= OT.DROP_ASK) {
      g.drops++;
      openDrop(pts[pts.length - 2], now);
      return 'drop';
    }
    return g.age >= NISA.adultAge ? 'end' : 'ok';
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  // タイマーは1つだけ。古いタイマーが動き続けて新しいほうを止めないように、自分の番か確かめる
  function startTimer(fn, ms) {
    stopTimer();
    const id = setInterval(function () {
      if (state.timer !== id) {
        clearInterval(id);
        return;
      }
      fn();
    }, ms);
    state.timer = id;
  }

  function fastForward() {
    const g = state.game;
    if (state.timer || !g || g.phase !== 'kid' || g.age >= NISA.adultAge) return;
    startTimer(function () {
      const r = stepYear();
      if (r !== 'ok') {
        stopTimer();
        render.grow();
      }
    }, 260);
    render.grow();
  }

  function keepUntil60() {
    const g = state.game;
    if (!g || g.phase !== 'kid' || g.age < NISA.adultAge) return;
    g.phase = 'after';
    render.grow();
    startTimer(function () {
      g.age++;
      render.grow();
      if (g.age >= KEEP_UNTIL) {
        stopTimer();
        finishGame(KEEP_UNTIL);
      }
    }, 45);
  }

  function finishGame(endAge) {
    const g = state.game;
    g.endAge = endAge;
    g.age = endAge;
    g.phase = 'done';
    saveHistory(g);
    go('result');
  }

  function saveHistory(g) {
    if (g.saved) return;
    g.saved = true;
    const pts = gamePath(g, g.endAge, g.soldAge);
    const p18 = pts.find(function (p) { return p.age === NISA.adultAge; });
    const last = pts[pts.length - 1];
    const list = Store.load('history', []);
    const arr = Array.isArray(list) ? list : [];
    arr.unshift({
      t: Date.now(), b: g.basketId, a: g.plan.startAge,
      inv: Math.round(p18.invested), v18: Math.round(p18.value),
      v60: g.endAge === KEEP_UNTIL ? Math.round(last.value) : null,
      sold: g.soldAge != null
    });
    Store.save('history', arr.slice(0, HISTORY_MAX));
  }

  // ---------- へっちゃった！ ----------
  function openDrop(prev, now) {
    const before = prev.value;
    const after = prev.value * (1 + now.ret);
    $('drop-text').innerHTML = 'ことしは <b class="red">' + pct(now.ret) + '</b>。<br>' +
      yen(before) + ' が <b class="red">' + yen(after) + '</b> になっちゃった。';
    $('drop-modal').hidden = false;
    $('drop-keep').focus();
  }

  function closeDrop() {
    $('drop-modal').hidden = true;
  }

  // ---------- けっか ----------
  render.result = function () {
    const g = state.game;
    const pts = gamePath(g, g.endAge, g.soldAge);
    const at = function (age) { return pts.find(function (p) { return p.age === age; }); };
    const p18 = at(NISA.adultAge);
    const last = pts[pts.length - 1];
    const inv = p18.invested;
    const heldPts = g.soldAge != null ? gamePath(g, g.endAge, null) : null;
    const heldLast = heldPts ? heldPts[heldPts.length - 1] : null;
    const kept = g.endAge === KEEP_UNTIL;

    $('r-emoji').textContent = last.value >= inv * 1.5 ? '🌳' : last.value >= inv ? '🌱' : '🥀';
    $('r-title').textContent = yen(last.value) + (last.value >= inv ? ' になったよ！' : ' にへっちゃった…');

    const stats = [['入れたお金', inv, false], ['18さい', p18.value, p18.value < inv]];
    if (kept) {
      stats.push(['30さい', at(30).value, at(30).value < inv]);
      stats.push(['60さい', last.value, last.value < inv]);
    }
    $('r-stats').innerHTML = stats.map(function (s) {
      return '<div><b' + (s[2] ? ' class="down"' : '') + '>' + yenBox(s[1]) + '</b><span>' + s[0] + '</span></div>';
    }).join('');

    const learn = [];
    learn.push(['🌱', '入れたお金 ' + yen(inv) + ' が、18さいで ' + yen(p18.value) + '（' + times(p18.value, inv) + '）になった。']);
    if (heldLast) {
      if (heldLast.value > last.value) {
        learn.push(['💡', 'もし売らずにもっていたら ' + yen(heldLast.value) + ' だった。あわてて売ると、そのあと もどったぶんを もらえないんだ。']);
      } else {
        learn.push(['🤔', 'こんかいは、売ってたすかったね。でも「いつ売ればいいか」は、おとなでもだれにもわからないよ。']);
      }
    } else if (g.drops > 0) {
      learn.push(['💪', '大きくへった年が ' + g.drops + '回あったけど、売らずにもちつづけたね。']);
    } else {
      learn.push(['🍀', 'こんかいは、大きくへる年がなかった。でも、いつもそうとはかぎらないよ。「100回くらべる」でためしてみてね。']);
    }
    if (kept) {
      if (heldLast) {
        learn.push(['🐷', 'ちょきん箱のまま おいておいても、ほとんどふえなかった。']);
      } else if (last.value >= p18.value * 3) {
        learn.push(['⏳', '18さいから 60さいまで おいておいたら、' + times(last.value, p18.value) + 'になった。時間が いちばんのみかた。']);
      } else {
        learn.push(['⏳', '18さいから 60さいまで おいておいたら、' + times(last.value, p18.value) + '。こんかいは あまりのびなかった。長くおいても、いつも大きくふえるとはかぎらないよ。']);
      }
    } else {
      learn.push(['🎁', '18さいで つかうことにしたね。60さいまで おいておくと どうなるかも、つぎにためしてみてね。']);
    }
    $('r-learn').innerHTML = learn.map(function (l) { return '<li data-e="' + l[0] + '">' + l[1] + '</li>'; }).join('');
  };

  // ---------- 100回くらべる ----------
  render.compare = function () {
    const plan = state.plan;
    const c = state.compare;
    const res = Sim.runMany(plan, c.endAge, 100, c.seed);
    $('c-plan').textContent = plan.startAge + 'さいから・はじめ' + plan.first + '万円・毎年' +
      (plan.yearly ? plan.yearly + '万円' : 'なし') + '（入れたお金 ' + yen(res.invested) + '）';
    $('c-horizon').innerHTML = HORIZONS.map(function (a) {
      return '<button type="button" class="chip' + (c.endAge === a ? ' on' : '') + '" data-horizon="' + a + '">' + a + 'さい</button>';
    }).join('');

    const rows = OT.BASKETS.concat([OT.BANK]).map(function (b) {
      const s = Sim.summarize(res.results[b.id], res.invested);
      return { b: b, s: s, id: b.id, label: b.emoji + ' ' + b.short, values: res.results[b.id], median: s.median };
    });
    $('c-chart').innerHTML = Chart.dots({ rows: rows, invested: res.invested });
    $('c-cards').innerHTML = rows.map(function (r) {
      return '<div class="cmp-card" style="--bc:var(--c-' + r.id + ')">' +
        '<div class="cmp-top">' + r.b.emoji + ' ' + r.b.name + '</div>' +
        '<div class="cmp-nums">' +
        '<div><b>' + yenBox(r.s.median) + '</b><span>まんなか</span></div>' +
        '<div><b>' + yenBox(r.s.low) + '</b><span>わるいとき</span></div>' +
        '<div><b' + (r.s.losses ? ' class="loss"' : '') + '>' + r.s.losses + '<small>回</small></b><span>へった未来</span></div>' +
        '</div></div>';
    }).join('');
  };

  // ---------- ルール ----------
  function update72() {
    const p = Number($('r72').value) || 5;
    $('r72-pct').textContent = p + '%';
    const y = Math.round(Sim.rule72(p));
    $('r72-out').innerHTML = '<span class="big">だいたい ' + y + '年</span> で 2倍になる<br>' +
      '60万円 → ' + y + '年で 120万円 → ' + (y * 2) + '年で 240万円<br>' +
      '<span class="small">ちょきん箱（1年に0.2%）だと、2倍になるのに 360年かかるよ。</span>';
  }

  // 1年の増え方のゆれ（標準偏差）を、モデルからその場で数える
  function yearlySpread(b) {
    const rand = Rand.mulberry32(20261107);
    const n = 20000;
    let s = 0, s2 = 0;
    for (let i = 0; i < n; i++) {
      const r = Sim.yearReturn(b, Sim.drawShock(rand));
      s += r;
      s2 += r * r;
    }
    const mean = s / n;
    return Math.sqrt(Math.max(0, s2 / n - mean * mean));
  }

  function renderParents() {
    const el = $('parents-body');
    if (el.dataset.done) return;
    const spread = OT.BASKETS.map(function (b) {
      return b.short + ' 約' + Math.round(yearlySpread(b) * 100) + '%';
    }).join('・');
    el.innerHTML =
      '<p>このアプリの値動きは、学習用のおおまかな仮定です。将来の運用成果を示すものではなく、投資の助言でもありません。</p>' +
      '<ul>' +
      '<li>長い目で見た伸び（まんなかの人の年率）：世界 5%・アメリカ 5%・バランス 3%・ちょきん箱 0.2%。</li>' +
      '<li>1年のゆれ（標準偏差の目安）：' + spread + '。</li>' +
      '<li>20年に1回くらい、すべてのカゴに共通の「大きく下がる年」を入れています（世界の株で−35%前後）。「100回くらべる」は、同じ100とおりの値動きでカゴどうしを比べています。</li>' +
      '<li>アメリカの株は、ここ15年ほどは世界の株を上回りました。このアプリでは長期の伸びを同じにして、1つの国に集中するぶん ゆれを大きくしています（分散の考え方を見せるための置き方です）。</li>' +
      '<li>為替・信託報酬は分けて入れていません。NISAの中なので税金はかかりません。</li>' +
      '<li>こどもNISAの決まりは2026年11月時点の公表内容です：2027年1月開始、つみたてのみ、年60万円・合計600万円、12歳になるまでは災害のときだけ非課税で払い出し、12歳からは子どものための教育費・生活費に本人の同意つきで払い出し、18歳で大人のNISA（つみたて投資枠）へ移行。実際の手続きは証券会社で確認してください。</li>' +
      '<li>入力やけっかは、この端末のブラウザの中だけに保存され、どこにも送られません。</li>' +
      '</ul>';
    el.dataset.done = '1';
  }

  render.rules = function () {
    update72();
  };

  // ---------- イベント ----------
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-go],[data-first],[data-yearly],[data-basket],[data-horizon]');
    if (!t) return;
    const d = t.dataset;
    if (d.go) {
      if (d.go === 'setup-grow') openSetup('grow');
      else if (d.go === 'setup-compare') openSetup('compare');
      else go(d.go);
    } else if (d.first) {
      setPlan({ first: Number(d.first) });
    } else if (d.yearly) {
      setPlan({ yearly: Number(d.yearly) });
    } else if (d.basket) {
      state.basketId = OT.basketById(d.basket).id;
      Store.save('basket', state.basketId);
      renderSetupInputs();
    } else if (d.horizon) {
      state.compare.endAge = Number(d.horizon);
      render.compare();
    }
  });

  $('btn-home').addEventListener('click', function () { go('home'); });
  $('btn-rules').addEventListener('click', function () { go('rules'); });
  $('age-minus').addEventListener('click', function () { setPlan({ startAge: state.plan.startAge - 1 }); });
  $('age-plus').addEventListener('click', function () { setPlan({ startAge: state.plan.startAge + 1 }); });
  $('setup-go').addEventListener('click', function () {
    if (state.setupMode === 'grow') {
      startGame();
    } else {
      state.compare.seed = Rand.newSeed();
      go('compare');
    }
  });

  $('g-step').addEventListener('click', function () { if (!state.timer) stepYear(); });
  $('g-fast').addEventListener('click', fastForward);
  $('g-use').addEventListener('click', function () {
    const g = state.game;
    if (!g || g.phase !== 'kid' || g.age < NISA.adultAge) return;
    stopTimer();
    finishGame(NISA.adultAge);
  });
  $('g-keep').addEventListener('click', keepUntil60);
  $('drop-keep').addEventListener('click', function () {
    closeDrop();
    render.grow();
  });
  $('drop-sell').addEventListener('click', function () {
    state.game.soldAge = state.game.age;
    closeDrop();
    render.grow();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('drop-modal').hidden) {
      closeDrop();
      render.grow();
    }
  });

  $('r-again').addEventListener('click', function () {
    state.basketId = state.game.basketId;
    state.plan = Sim.normalizePlan(state.game.plan);
    startGame();
  });
  $('r-other').addEventListener('click', function () { openSetup('grow'); });
  $('r-compare').addEventListener('click', function () {
    state.plan = Sim.normalizePlan(state.game.plan);
    state.compare.seed = Rand.newSeed();
    state.compare.endAge = state.game.endAge === KEEP_UNTIL ? KEEP_UNTIL : 18;
    go('compare');
  });

  $('c-edit').addEventListener('click', function () { openSetup('compare'); });
  $('c-reroll').addEventListener('click', function () {
    state.compare.seed = Rand.newSeed();
    render.compare();
  });

  $('r72').addEventListener('input', update72);
  document.querySelector('.parents').addEventListener('toggle', renderParents);

  root.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})(globalThis);
