/*
 * Oink! — bot AI. Medium difficulty: plays legally, hunts the leader a bit,
 * hoards wilds, dumps big numbers, picks its dominant color.
 */
(function (global) {
  'use strict';
  var C = global.OINK.cards;

  function peekNext(turn, dir, n) { return ((turn + dir) % n + n) % n; }

  function countColors(hand) {
    var counts = {};
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i].color;
      if (c) counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  }

  function pickColor(colorCount, rng) {
    var best = C.COLORS[0], bestV = -1;
    for (var i = 0; i < C.COLORS.length; i++) {
      var col = C.COLORS[i];
      var v = (colorCount[col] || 0) + rng() * 0.9;
      if (v > bestV) { bestV = v; best = col; }
    }
    return best;
  }

  /* Decide the main action for seat `idx`. */
  function decide(game, idx) {
    var st = game.getState();
    var me = st.players[idx];
    if (st.pendingDraw) {
      var transfer = me.hand.find(function (c) { return c.kind === 'action' && c.effect === 'draw3'; });
      return transfer ? { type: 'play', cardId: transfer.id } : { type: 'draw' };
    }
    var playable = me.hand.filter(function (c) { return game.canPlayCard(c); });
    if (!playable.length) return { type: 'draw' };

    var n = st.players.length;
    var nextIdx = peekNext(st.turn, st.direction, n);
    var nextCount = st.players[nextIdx].hand.length;
    var threat = nextCount <= 2;

    var colorCount = countColors(me.hand);
    var dominant = null, domN = -1;
    for (var col in colorCount) {
      if (colorCount[col] > domN) { domN = colorCount[col]; dominant = col; }
    }

    var nonWild = playable.filter(function (c) { return c.kind !== 'wild'; });
    var best = null, bestScore = -Infinity;

    for (var i = 0; i < playable.length; i++) {
      var c = playable[i];
      var s = game.rng() * 4; // a little humanity
      if (c.kind === 'number') {
        s += 10 + c.value + (c.color === dominant ? 3 : 0);
      } else if (c.kind === 'action') {
        if (c.effect === 'draw3') s += threat ? 40 : 18;
        else if (c.effect === 'skip') s += threat ? 38 : 13;
        else if (c.effect === 'reverse') s += 12;
        else if (c.effect === 'slap') s += 16;
        else if (c.effect === 'hush') s += 13;
        if (c.color === dominant) s += 3;
      } else { // wilds
        s += nonWild.length ? -25 : 6;
      }
      if (s > bestScore) { bestScore = s; best = c; }
    }

    return {
      type: 'play',
      cardId: best.id,
      color: best.kind === 'wild' ? pickColor(colorCount, game.rng) : undefined
    };
  }

  /* Decide what to do with a freshly drawn playable card. */
  function decideDrawn(game, idx) {
    var st = game.getState();
    var card = null;
    for (var i = 0; i < st.players[idx].hand.length; i++) {
      if (st.players[idx].hand[i].id === st.drawn) { card = st.players[idx].hand[i]; break; }
    }
    if (!card || !C.canPlay(card, st.discardTop, st.activeColor)) return { type: 'keep' };
    return {
      type: 'play',
      color: card.kind === 'wild' ? pickColor(countColors(st.players[idx].hand), game.rng) : undefined
    };
  }

  global.OINK = global.OINK || {};
  global.OINK.bots = { decide: decide, decideDrawn: decideDrawn, pickColor: pickColor };
})(typeof window !== 'undefined' ? window : globalThis);
