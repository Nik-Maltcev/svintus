/*
 * Oink! — bootstrap: menu wiring, sound pref, self-test mode (?selftest=1).
 * The self-test drives bot-vs-bot games through the real engine to verify
 * termination, rule invariants and card conservation (no Node needed).
 */
(function (global) {
  'use strict';
  var OINK = global.OINK;

  function runSelfTest(n) {
    n = n || 300;
    var out = [];
    var t0 = performance.now();
    var totalTurns = 0, maxTurns = 0, hushCount = 0, slapCount = 0, oinkFails = 0, transfers = 0, reshuffles = 0;
    var wins = [0, 0, 0, 0];
    var failures = 0;

    for (var g = 0; g < n; g++) {
      var fake = 0;
      var game = new OINK.OinkGame({
        players: [
          { name: 'A', isBot: true }, { name: 'B', isBot: true },
          { name: 'C', isBot: true }, { name: 'D', isBot: true }
        ],
        rng: Math.random,
        now: function () { return fake; },
        onEvent: function (e) {
          if (e.t === 'hush') hushCount++;
          if (e.t === 'oinkFail') oinkFails++;
          if (e.t === 'slap') slapCount++;
          if (e.t === 'attack' && e.count > 3) transfers++;
          if (e.t === 'reshuffle') reshuffles++;
        }
      });

      var turns = 0, guard = 0;
      while (game.phase !== 'over' && guard++ < 20000) {
        fake += 3500; // expire any pending oink window -> exercises the penalty path
        game.oinkTick();
        var idx = game.turn;
        var a = OINK.bots.decide(game, idx);
        try {
          if (a.type === 'play' && game.players[idx].hand.length === 2) game.callOink(idx);
          if (a.type === 'play') game.playCard(idx, a.cardId, a.color);
          else game.drawCard(idx);
        } catch (err) {
          out.push('FAIL g' + g + ' t' + turns + ': ' + err.message);
          failures++;
          break;
        }
        while (game.phase === 'playing' && game.drawn) {
          var d = OINK.bots.decideDrawn(game, idx);
          try {
            if (d.type === 'play') game.playDrawn(idx, d.color);
            else game.keepDrawn(idx);
          } catch (err) {
            out.push('FAIL g' + g + ' t' + turns + ' (drawn): ' + err.message);
            failures++;
            break;
          }
        }
        if (game.phase === 'hush') game.resolveHush(false);
        if (game.phase === 'slap') game.resolveSlap(game.players.map(function () {
          return OINK.RULES.SLAP_CHOICES[Math.floor(game.rng() * OINK.RULES.SLAP_CHOICES.length)];
        }));
        turns++;
      }

      if (game.phase !== 'over') {
        out.push('FAIL g' + g + ': did not terminate in ' + turns + ' turns');
        failures++;
        break;
      }
      totalTurns += turns;
      maxTurns = Math.max(maxTurns, turns);
      wins[game.winner]++;

      var st = game.getState();
      var total = st.discardCount + st.drawCount;
      for (var p = 0; p < st.players.length; p++) total += st.players[p].hand.length;
      if (total !== 112) {
        out.push('FAIL g' + g + ': card conservation broken (' + total + '/112)');
        failures++;
        break;
      }
    }

    var ms = Math.round(performance.now() - t0);
    var html =
      '<h1>Self-test ' + (failures ? 'FAILED' : 'PASSED') + '</h1>' +
      '<ul>' +
      '<li>Games: ' + g + ' / ' + n + '</li>' +
      '<li>Avg turns: ' + (g ? (totalTurns / g).toFixed(1) : '-') + ' \u00B7 max ' + maxTurns + '</li>' +
      '<li>Wins A/B/C/D: ' + wins.join(' / ') + '</li>' +
      '<li>Hushes: ' + hushCount + ' \u00B7 hoof slaps: ' + slapCount + ' \u00B7 transfers: ' + transfers + ' \u00B7 reshuffles: ' + reshuffles + '</li>' +
      '<li>Time: ' + ms + ' ms</li>' +
      '</ul>' +
      (out.length ? '<pre>' + out.join('\n') + '</pre>' : '<p>All games terminated, all 112 cards conserved.</p>');
    return { html: html, failures: failures, games: g };
  }

  function boot() {
    var splash = document.getElementById('boot-screen');
    var started = performance.now();
    try {
      document.getElementById('crazygames-sdk').addEventListener('load', function () { OINK.sdk.init(); });
      // sound preference
      var on = localStorage.getItem('oink.sound') !== 'off';
      OINK.audio.setEnabled(on);

      OINK.sdk.init();
      OINK.sdk.loadingStart();
      OINK.ui.init();

      if (global.location.search.indexOf('selftest') >= 0) {
        document.body.classList.add('selftest');
        var res = runSelfTest(300);
        var d = global.document.createElement('div');
        d.id = 'selftest-report';
        d.innerHTML = res.html;
        global.document.body.appendChild(d);
        console.log('[oink] self-test', res.failures ? 'FAILED' : 'PASSED', res);
      }
      setTimeout(function () {
        OINK.sdk.loadingStop();
        splash.classList.add('leaving');
        setTimeout(function () { splash.hidden = true; }, 350);
      }, Math.max(0, 650 - (performance.now() - started)));
    } catch (err) {
      console.error('[oink] startup failed', err);
      splash.querySelector('p').textContent = 'Could not load the game. Please refresh.';
      splash.querySelector('.boot-track').hidden = true;
    }
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
