/*
 * Oink! — card model & deck.
 * Plain-script module (no build step) exposing global.OINK.cards.
 */
(function (global) {
  'use strict';

  var COLORS = ['red', 'yellow', 'green', 'blue'];

  var EFFECTS = {
    skip:    { name: 'Snooze',    points: 20 },
    reverse: { name: 'U-Turn',    points: 20 },
    draw2:   { name: 'Mud Sling', points: 20 },
    swap:    { name: 'Hand Swap', points: 20 }
  };

  var WILDS = {
    wild:  { name: 'Any Color', points: 50 },
    wild4: { name: 'Stampede',  points: 50 },
    shhh:  { name: 'Shhh!',     points: 50 }
  };

  var uid = 0;

  function num(color, value)  { return { id: 'c' + (uid++), kind: 'number', color: color, value: value }; }
  function act(color, effect) { return { id: 'c' + (uid++), kind: 'action', color: color, effect: effect }; }
  function wild(effect)       { return { id: 'c' + (uid++), kind: 'wild', color: null, effect: effect }; }

  /* 120 cards: 4 colors x (0 + 1..9 x2 + 4 actions x2) + 4 x (wild, wild4, shhh) */
  function buildDeck() {
    var deck = [];
    for (var ci = 0; ci < COLORS.length; ci++) {
      var color = COLORS[ci];
      deck.push(num(color, 0));
      for (var v = 1; v <= 9; v++) { deck.push(num(color, v)); deck.push(num(color, v)); }
      for (var e in EFFECTS) { deck.push(act(color, e)); deck.push(act(color, e)); }
    }
    for (var i = 0; i < 4; i++) {
      deck.push(wild('wild')); deck.push(wild('wild4')); deck.push(wild('shhh'));
    }
    return deck;
  }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function label(card) {
    if (card.kind === 'number') return String(card.value);
    if (card.kind === 'action') return EFFECTS[card.effect].name;
    return WILDS[card.effect].name;
  }

  /* Match by color, number, or symbol. Wilds always playable. */
  function canPlay(card, top, activeColor) {
    if (card.kind === 'wild') return true;
    if (card.color === activeColor) return true;
    if (top && card.kind === 'number' && top.kind === 'number' && card.value === top.value) return true;
    if (top && card.kind === 'action' && top.kind === 'action' && card.effect === top.effect) return true;
    return false;
  }

  function cardPoints(card) {
    if (card.kind === 'number') return card.value;
    if (card.kind === 'action') return EFFECTS[card.effect].points;
    return WILDS[card.effect].points;
  }

  global.OINK = global.OINK || {};
  global.OINK.cards = {
    COLORS: COLORS, EFFECTS: EFFECTS, WILDS: WILDS,
    buildDeck: buildDeck, shuffle: shuffle, label: label,
    canPlay: canPlay, cardPoints: cardPoints
  };
})(typeof window !== 'undefined' ? window : globalThis);
