/*
 * Oink! — card model & deck.
 * Plain-script module (no build step) exposing global.OINK.cards.
 */
(function (global) {
  'use strict';

  var COLORS = ['red', 'orange', 'green', 'blue'];

  var EFFECTS = {
    skip:    { name: 'Snore Pig' },
    reverse: { name: 'Piggy Turn' },
    draw3:   { name: 'Grab Pig' },
    hush:    { name: 'Hush Pig' },
    slap:    { name: 'Hoof Slap' }
  };

  var WILDS = {
    wild:  { name: 'Color Hog' }
  };

  var uid = 0;

  function num(color, value)  { return { id: 'c' + (uid++), kind: 'number', color: color, value: value }; }
  function act(color, effect) { return { id: 'c' + (uid++), kind: 'action', color: color, effect: effect }; }
  function wild(effect)       { return { id: 'c' + (uid++), kind: 'wild', color: null, effect: effect }; }

  /* 112 cards: 64 numbers, five colored effects x 8, eight color choosers. */
  function buildDeck() {
    var deck = [];
    for (var ci = 0; ci < COLORS.length; ci++) {
      var color = COLORS[ci];
      for (var v = 0; v <= 7; v++) { deck.push(num(color, v)); deck.push(num(color, v)); }
      for (var e in EFFECTS) { deck.push(act(color, e)); deck.push(act(color, e)); }
    }
    for (var i = 0; i < 8; i++) deck.push(wild('wild'));
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

  global.OINK = global.OINK || {};
  global.OINK.cards = {
    COLORS: COLORS, EFFECTS: EFFECTS, WILDS: WILDS,
    buildDeck: buildDeck, shuffle: shuffle, label: label,
    canPlay: canPlay
  };
})(typeof window !== 'undefined' ? window : globalThis);
