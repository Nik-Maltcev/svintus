/*
 * Oink! — game engine.
 * Pure state machine, no DOM. Emits events through opts.onEvent so the UI,
 * the bot driver and the headless self-test can all drive the same rules.
 *
 * Flow for one turn: playCard / drawCard (+playDrawn|keepDrawn) -> engine
 * advances the turn itself and emits {t:'turn'}.
 *
 * Special rules implemented here:
 *  - OINK: when someone plays down to their last card they get a 3s window to
 *    "call oink"; missing it costs 2 penalty cards (checked lazily on every
 *    action via the injectable clock, plus explicit oinkTick() from the UI).
 *  - Shhh!: wild card that freezes the table for a few seconds. Whoever taps
 *    the screen during the hush draws 2 (only the human can tap, seat 0).
 */
(function (global) {
  'use strict';
  var C = global.OINK.cards;

  var OINK_WINDOW_MS = 3000;
  var HUSH_MS = 4000;

  function OinkGame(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this._now = opts.now || Date.now;
    this._emit = opts.onEvent || function () {};

    this.players = (opts.players || []).map(function (p) {
      return { name: p.name, isBot: !!p.isBot, hand: [], wins: p.wins | 0 };
    });
    if (this.players.length < 2 || this.players.length > 4) {
      throw new Error('OinkGame needs 2-4 players');
    }

    this.draw = C.shuffle(C.buildDeck(), this.rng);
    this.discard = [];
    this.activeColor = null;
    this.direction = 1;          // 1 = clockwise, -1 = counter-clockwise
    this.turn = 0;
    this.phase = 'playing';      // 'playing' | 'hush' | 'over'
    this.oink = null;            // { player, until, }
    this._oinkPending = null;    // seat whose oink window starts after a hush
    this._hushPlayer = null;     // seat that played Shhh!
    this.drawn = null;           // card id awaiting play/keep decision
    this.winner = null;

    this._deal();
  }

  /* ---------------- setup ---------------- */

  OinkGame.prototype._deal = function () {
    for (var r = 0; r < 7; r++) {
      for (var p = 0; p < this.players.length; p++) {
        this.players[p].hand.push(this.draw.pop());
      }
    }
    // First discard must be a plain number card.
    while (this.draw.length && this.draw[this.draw.length - 1].kind !== 'number') {
      this.draw.unshift(this.draw.pop());
    }
    var top = this.draw.pop();
    this.discard.push(top);
    this.activeColor = top.color;
    this._emit({
      t: 'start',
      players: this.players.map(function (pl) { return { name: pl.name, count: pl.hand.length }; }),
      top: top
    });
    this._emit({ t: 'turn', player: this.turn });
  };

  /* ---------------- public actions ---------------- */

  OinkGame.prototype.playCard = function (playerIdx, cardId, chosenColor) {
    this._oinkTick();
    this._guard(playerIdx, true);
    var player = this.players[playerIdx];
    var cardIdx = -1;
    for (var i = 0; i < player.hand.length; i++) {
      if (player.hand[i].id === cardId) { cardIdx = i; break; }
    }
    if (cardIdx < 0) throw new Error('Card not in hand');
    var card = player.hand[cardIdx];
    var top = this.discard[this.discard.length - 1];
    if (!C.canPlay(card, top, this.activeColor)) throw new Error('Card does not match');
    if (card.kind === 'wild' && (!chosenColor || C.COLORS.indexOf(chosenColor) < 0)) {
      throw new Error('Wild cards need a chosen color');
    }

    player.hand.splice(cardIdx, 1);
    this.discard.push(card);
    this.activeColor = card.kind === 'wild' ? chosenColor : card.color;
    this._emit({ t: 'play', player: playerIdx, card: card, chosenColor: this.activeColor });

    if (player.hand.length === 0) return this._win(playerIdx);

    var isShhh = card.kind === 'wild' && card.effect === 'shhh';
    if (player.hand.length === 1) {
      if (isShhh) this._oinkPending = playerIdx; // window opens after the hush
      else this._startOink(playerIdx);
    }

    if (isShhh) {
      this._hushPlayer = playerIdx;
      this.phase = 'hush';
      this._emit({ t: 'hush', duration: HUSH_MS });
      return;
    }
    this._applyEffect(playerIdx, card);
  };

  OinkGame.prototype.drawCard = function (playerIdx) {
    this._oinkTick();
    this._guard(playerIdx, true);
    var cards = this._drawCards(playerIdx, 1, 'voluntary');
    if (!cards.length) {
      this._emit({ t: 'noPlay', player: playerIdx });
      return this._advance(1);
    }
    var card = cards[0];
    var top = this.discard[this.discard.length - 1];
    if (C.canPlay(card, top, this.activeColor)) {
      this.drawn = card.id;
      this._emit({ t: 'drawnPlayable', player: playerIdx, card: card });
    } else {
      this._emit({ t: 'noPlay', player: playerIdx });
      this._advance(1);
    }
  };

  OinkGame.prototype.playDrawn = function (playerIdx, chosenColor) {
    this._oinkTick();
    if (!this.drawn) throw new Error('No drawn card pending');
    this._guard(playerIdx, false);
    var id = this.drawn;
    this.drawn = null;
    this.playCard(playerIdx, id, chosenColor);
  };

  OinkGame.prototype.keepDrawn = function (playerIdx) {
    this._oinkTick();
    if (!this.drawn) throw new Error('No drawn card pending');
    this._guard(playerIdx, false);
    this.drawn = null;
    this._emit({ t: 'keep', player: playerIdx });
    this._advance(1);
  };

  OinkGame.prototype.callOink = function (playerIdx) {
    this._oinkTick();
    if (!this.oink || this.oink.player !== playerIdx) return false;
    this.oink = null;
    this._emit({ t: 'oinkOk', player: playerIdx });
    return true;
  };

  /* Force-check a running oink window (UI timeout / self-test clock). */
  OinkGame.prototype.oinkTick = function () { this._oinkTick(); };

  /* Hush resolution. `failed` = the human touched the screen. */
  OinkGame.prototype.resolveHush = function (failed) {
    if (this.phase !== 'hush') throw new Error('Not in hush phase');
    this.phase = 'playing';
    this._emit({ t: 'hushEnd', failed: !!failed });
    if (failed) {
      this._drawCards(0, 2, 'hush'); // only the human can touch the screen
      this._emit({ t: 'hushFail', player: 0 });
    }
    var shhhPlayer = this._hushPlayer;
    this._hushPlayer = null;
    if (this._oinkPending != null) {
      var p = this._oinkPending;
      this._oinkPending = null;
      this._startOink(p);
    }
    this._advanceFrom(shhhPlayer, 1);
  };

  OinkGame.prototype.getState = function () {
    var self = this;
    return {
      players: this.players.map(function (p) {
        return { name: p.name, isBot: p.isBot, hand: p.hand.slice(), wins: p.wins };
      }),
      discardTop: this.discard[this.discard.length - 1],
      discardCount: this.discard.length,
      drawCount: this.draw.length,
      activeColor: this.activeColor,
      direction: this.direction,
      turn: this.turn,
      phase: this.phase,
      drawn: this.drawn,
      winner: this.winner
    };
  };

  OinkGame.prototype.nextIndex = function (from, steps) {
    var n = this.players.length;
    var i = from;
    for (var k = 0; k < steps; k++) i = ((i + this.direction) % n + n) % n;
    return i;
  };

  /* ---------------- internals ---------------- */

  OinkGame.prototype._guard = function (playerIdx, needDrawnClear) {
    if (this.phase !== 'playing') throw new Error('Game is not in playing phase');
    if (this.turn !== playerIdx) throw new Error('Not this player\'s turn');
    if (needDrawnClear && this.drawn) throw new Error('Decide on the drawn card first');
  };

  OinkGame.prototype._applyEffect = function (playerIdx, card) {
    var victim;
    switch (card.kind === 'wild' ? card.effect : card.effect || 'number') {
      case 'skip':
        victim = this.nextIndex(this.turn, 1);
        this._emit({ t: 'skip', player: victim });
        this._advance(2);
        break;
      case 'reverse':
        this.direction *= -1;
        this._emit({ t: 'reverse', direction: this.direction });
        this._advance(this.players.length === 2 ? 0 : 1); // in 2p it acts as a skip
        break;
      case 'draw2':
        victim = this.nextIndex(this.turn, 1);
        this._drawCards(victim, 2, 'attack');
        this._emit({ t: 'skip', player: victim });
        this._advance(2);
        break;
      case 'swap':
        victim = this.nextIndex(this.turn, 1);
        var a = this.players[playerIdx].hand;
        this.players[playerIdx].hand = this.players[victim].hand;
        this.players[victim].hand = a;
        this._emit({ t: 'swap', a: playerIdx, b: victim });
        this._advance(1);
        break;
      case 'wild4':
        victim = this.nextIndex(this.turn, 1);
        this._drawCards(victim, 4, 'attack');
        this._emit({ t: 'skip', player: victim });
        this._advance(2);
        break;
      default: // number or plain wild
        this._advance(1);
    }
  };

  OinkGame.prototype._drawCards = function (playerIdx, count, reason) {
    var out = [];
    for (var i = 0; i < count; i++) {
      if (!this.draw.length && !this._refill()) break;
      out.push(this.draw.pop());
    }
    for (var j = 0; j < out.length; j++) this.players[playerIdx].hand.push(out[j]);
    if (out.length) {
      this._emit({ t: 'draw', player: playerIdx, count: out.length, reason: reason });
    }
    return out;
  };

  OinkGame.prototype._refill = function () {
    if (this.discard.length <= 1) return false;
    var top = this.discard.pop();
    this.draw = C.shuffle(this.discard, this.rng);
    this.discard = [top];
    this._emit({ t: 'reshuffle', count: this.draw.length });
    return true;
  };

  OinkGame.prototype._advance = function (steps) { this._advanceFrom(this.turn, steps); };

  OinkGame.prototype._advanceFrom = function (from, steps) {
    this.turn = this.nextIndex(from, steps);
    if (this.phase !== 'over') this._emit({ t: 'turn', player: this.turn });
  };

  OinkGame.prototype._startOink = function (playerIdx) {
    this.oink = { player: playerIdx, until: this._now() + OINK_WINDOW_MS };
    this._emit({ t: 'oinkWindow', player: playerIdx, duration: OINK_WINDOW_MS });
  };

  OinkGame.prototype._oinkTick = function () {
    if (this.oink && this._now() > this.oink.until) {
      var p = this.oink.player;
      this.oink = null;
      this._drawCards(p, 2, 'oink');
      this._emit({ t: 'oinkFail', player: p });
    }
  };

  OinkGame.prototype._win = function (playerIdx) {
    this.phase = 'over';
    this.winner = playerIdx;
    this.players[playerIdx].wins++;
    this.oink = null;
    this.drawn = null;
    var self = this;
    this._emit({
      t: 'win',
      winner: playerIdx,
      hands: this.players.map(function (p) { return p.hand.length; }),
      points: this.players.map(function (p) {
        return p.hand.reduce(function (s, c) { return s + C.cardPoints(c); }, 0);
      })
    });
  };

  global.OINK = global.OINK || {};
  global.OINK.OinkGame = OinkGame;
  global.OINK.RULES = { OINK_WINDOW_MS: OINK_WINDOW_MS, HUSH_MS: HUSH_MS };
})(typeof window !== 'undefined' ? window : globalThis);
