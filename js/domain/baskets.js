// カゴ（投資信託の種類）と、こどもNISAの決まり。数字はすべてここにまとめる。
//
// 値動きのモデル（学習用のおおまかな仮定。将来の約束ではない）
//   - 毎年、すべてのカゴに共通の「世界のできごと」が1つ起きる（同じ z を使う）。
//   - CRASH_P の確率で「大きく下がる年」になる。その年の値動きは crash 前後。
//   - ふつうの年は、長い目で見た伸び（grow）がちょうど出るように中心を決める。
//     → 何十年も続けると、まんなかの人は「1年に grow ずつ」増えたのと同じになる。
//   - 為替・信託報酬・税金は分けて入れていない（NISA なので税金はかからない）。
(function (root) {
  'use strict';

  const OT = root.OT = root.OT || {};

  // こどもNISA（2027年1月スタート。2026年11月時点の情報）
  OT.NISA = {
    yearlyMax: 60,    // 1年に入れられるのは60万円まで
    totalMax: 600,    // ぜんぶで600万円まで
    lastAge: 17,      // 0〜17さいのあいだ入れられる
    unlockAge: 12,    // 12さいから、子どものための学費・生活費なら（本人の同意つきで）出せる
    adultAge: 18      // 18さいで大人のNISAに自動でうつる
  };

  // 大きく下がる年が来る確率（1年あたり）。20年に1回くらい。
  OT.CRASH_P = 0.05;

  // 「へっちゃった！どうする？」を聞く下がり方
  OT.DROP_ASK = -0.15;

  OT.BASKETS = [
    {
      id: 'world', name: '世界ぜんぶの株', short: '世界', emoji: '🌍', color: '#15805F',
      grow: 0.05, sd: 0.14, crash: -0.35, crashSd: 0.08,
      growStars: 3, swingStars: 3,
      desc: '世界じゅうの何千もの会社に、少しずつ分けて入れる。',
      point: 'いちばん広く分けている。1つの国がころんでも、ぜんぶはころびにくい。'
    },
    {
      id: 'usa', name: 'アメリカの株', short: 'アメリカ', emoji: '🗽', color: '#3567C9',
      grow: 0.05, sd: 0.17, crash: -0.38, crashSd: 0.10,
      growStars: 3, swingStars: 4,
      desc: 'アメリカの大きな会社500こに入れる。',
      point: 'ここ15年くらいは世界ぜんぶより大きくのびた。でも国は1つだけ。これからも同じかは、だれにもわからない。'
    },
    {
      id: 'balance', name: 'バランス', short: 'バランス', emoji: '⚖️', color: '#B86E00',
      grow: 0.03, sd: 0.07, crash: -0.18, crashSd: 0.05,
      growStars: 2, swingStars: 2,
      desc: '株と「さいけん」を半分ずつ。さいけんは、国や会社にお金をかして、お礼（利子）をもらうもの。',
      point: 'ゆれは小さい。そのかわり、のびも小さい。'
    }
  ];

  // くらべる用。こどもNISAでは選べない。
  OT.BANK = {
    id: 'bank', name: 'ちょきん箱（銀行）', short: 'ちょきん', emoji: '🐷', color: '#7C838D',
    grow: 0.002, fixed: true,
    desc: '銀行にあずけておく。ほとんど増えないけど、へらない。'
  };

  OT.basketById = function (id) {
    if (id === OT.BANK.id) return OT.BANK;
    return OT.BASKETS.find(function (b) { return b.id === id; }) || OT.BASKETS[0];
  };
})(globalThis);
