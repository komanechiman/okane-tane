// 乱数：シードつきで同じ未来を再現できるようにする（Math.random は使わない）
(function (root) {
  'use strict';

  // mulberry32: 32bit のシードから [0,1) の一様乱数を返す関数を作る
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 標準正規分布（Box-Muller）
  function normal(rand) {
    let u = 0;
    while (u === 0) u = rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function newSeed() {
    return (Math.random() * 4294967296) >>> 0;
  }

  root.OT = root.OT || {};
  root.OT.Rand = { mulberry32, normal, newSeed };
})(globalThis);
