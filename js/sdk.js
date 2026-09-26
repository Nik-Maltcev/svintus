/*
 * Oink! — CrazyGames SDK wrapper.
 * Every call degrades to a no-op when the SDK is missing (local dev) so the
 * game is fully playable outside the CrazyGames iframe.
 * Verify method names against https://docs.crazygames.com before submitting.
 */
(function (global) {
  'use strict';

  var sdk = null;
  var available = false;

  function init() {
    try {
      if (global.CrazyGames && global.CrazyGames.SDK) {
        var maybe = global.CrazyGames.SDK.init();
        if (maybe && typeof maybe.then === 'function') {
          return maybe.then(function () { sdk = global.CrazyGames.SDK; available = true; })
                       .catch(function (e) { console.info('[oink] SDK init failed', e); });
        }
        sdk = global.CrazyGames.SDK;
        available = true;
      }
    } catch (e) {
      console.info('[oink] SDK not available', e);
    }
    return Promise.resolve();
  }

  function safe(fn) {
    try { if (available) fn(sdk); } catch (e) { console.info('[oink] SDK call failed', e); }
  }

  global.OINK = global.OINK || {};
  global.OINK.sdk = {
    init: init,
    loadingStart: function () { safe(function (s) { s.game.loadingStart(); }); },
    loadingStop:  function () { safe(function (s) { s.game.loadingStop(); }); },
    gameplayStart: function () { safe(function (s) { s.game.gameplayStart(); }); },
    gameplayStop:  function () { safe(function (s) { s.game.gameplayStop(); }); },
    happytime:     function () { safe(function (s) { s.game.happytime(); }); },
  /* Natural break ad (between rounds). Always calls back exactly once. */
  midgameAd: function (done) {
    var fired = false;
    function once() { if (!fired) { fired = true; done(); } }
    if (!available) { once(); return; }
    try {
      sdk.ad.requestAd('midgame', {
        adFinished: once,
        adError: function (err) { console.info('[oink] ad error', err); once(); }
      });
    } catch (e) { once(); }
    /* Outside the CrazyGames environment requestAd may never resolve; don't
       hold the game hostage. */
    setTimeout(once, 3000);
  }
  };
})(typeof window !== 'undefined' ? window : globalThis);
