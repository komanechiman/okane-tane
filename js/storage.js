// localStorage（使えない環境でも落ちないように try/catch でつつむ）
(function (root) {
  'use strict';

  const PREFIX = 'okane-tane:';

  function load(key, fallback) {
    try {
      const raw = root.localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      root.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  root.OT = root.OT || {};
  root.OT.Store = { load: load, save: save };
})(globalThis);
