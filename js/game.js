/*
 * Oink! — game engine.
 * Pure state machine, no DOM. Emits events through opts.onEvent so the UI,
 * the bot driver and the headless self-test can all drive the same rules.
 *
 * Flow for one turn: playCard / drawCard (+playDrawn|keepDrawn) -> engine
 * advances the turn itself and emits {t:'turn'}.
 *
 * Special rules implemented here:
 *  - A digital OINK call, a short no-tap hush challenge, and a secret-choice clash.
 *  - Identical-card interception and transferable +3 attacks.
 */
(function (global) {
  'use strict';
  var C = global.OINK.cards;

  var OINK_WINDOW_MS = 3000;
  var HUSH_MS = 4000;
  var SLAP_CHOICES = ['slap', 'dodge', 'grab'];
  var SLAP_BEATS = { slap: 'grab', grab: 'dodge', dodge: 'slap' };

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
    this.phase = 'playing';      // 'playing' | 'hush' | 'slap' | 'over'
    this.oink = null;            // { player, until, }
    this.oinkDeclared = null;   // a call made before playing the penultimate card
    this._oinkPending = null;    // seat whose oink window starts after a challenge
    this._socialPlayer = null;
    this.pendingDraw = 0;       // transferable Grab Pig penalty
    this.interceptOpen = false;
    this.drawn = null;           // card id awaiting play/keep decision
    this.winner = null;

    this._deal();
  }

  /* ---------------- setup ---------------- */

  OinkGame.prototype._deal = function () {
    for (var r = 0; r < 8; r++) {
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
    if (!this.canPlayCard(card)) throw new Error('Card does not match');
    if (card.kind === 'wild' && (!chosenColor || C.COLORS.indexOf(chosenColor) < 0)) {
      throw new Error('Wild cards need a chosen color');
    }

    this.interceptOpen = false;
    player.hand.splice(cardIdx, 1);
    this.discard.push(card);
    this.activeColor = card.kind === 'wild' ? chosenColor : card.color;
    this._emit({ t: 'play', player: playerIdx, card: card, chosenColor: this.activeColor });

    if (player.hand.length === 0) return this._win(playerIdx);

    var isSocial = card.effect === 'hush' || card.effect === 'slap';
    if (player.hand.length === 1) {
      if (this.oinkDeclared !== playerIdx) {
        if (isSocial) this._oinkPending = playerIdx;
        else this._startOink(playerIdx);
      }
    }
    this.oinkDeclared = null;

    this._applyEffect(playerIdx, card);
  };

  OinkGame.prototype.canPlayCard = function (card) {
    if (this.pendingDraw) return card.kind === 'action' && card.effect === 'draw3';
    return C.canPlay(card, this.discard[this.discard.length - 1], this.activeColor);
  };

  OinkGame.prototype.canIntercept = function (playerIdx, card) {
    if (!this.interceptOpen || this.phase !== 'playing' || this.pendingDraw || this.drawn || playerIdx === this.turn) return false;
    var top = this.discard[this.discard.length - 1];
    return card.color === top.color && card.kind === top.kind &&
      (card.kind === 'number' ? card.value === top.value : card.effect === top.effect);
  };

  OinkGame.prototype.interceptCard = function (playerIdx, cardId, chosenColor) {
    var card = this.players[playerIdx].hand.find(function (c) { return c.id === cardId; });
    if (!card || !this.canIntercept(playerIdx, card)) throw new Error('No matching card to intercept');
    if (card.kind === 'wild' && C.COLORS.indexOf(chosenColor) < 0) throw new Error('Choose a color');
    this.turn = playerIdx;
    this._emit({ t: 'intercept', player: playerIdx });
    this.playCard(playerIdx, cardId, chosenColor);
  };

  OinkGame.prototype.drawCard = function (playerIdx) {
    this._oinkTick();
    this._guard(playerIdx, true);
    this.interceptOpen = false;
    this.oinkDeclared = null;
    if (this.pendingDraw) {
      var penalty = this.pendingDraw;
      this.pendingDraw = 0;
      this._drawCards(playerIdx, penalty, 'attack');
      this._emit({ t: 'skip', player: playerIdx });
      return this._advance(1);
    }
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
    this.oinkDeclared = null;
    this._emit({ t: 'keep', player: playerIdx });
    this._advance(1);
  };

  OinkGame.prototype.callOink = function (playerIdx) {
    this._oinkTick();
    if (this.oink && this.oink.player === playerIdx) {
      this.oink = null;
      this._emit({ t: 'oinkOk', player: playerIdx });
      return true;
    }
    if (this.phase === 'playing' && this.turn === playerIdx && this.players[playerIdx].hand.length === 2) {
      this.oinkDeclared = playerIdx;
      this._emit({ t: 'oinkOk', player: playerIdx });
      return true;
    }
    return false;
  };

  /* Force-check a running oink window (UI timeout / self-test clock). */
  OinkGame.prototype.oinkTick = function () { this._oinkTick(); };

  /* Hush resolution: offender is a player index, or false when all stayed quiet. */
  OinkGame.prototype.resolveHush = function (offender) {
    if (this.phase !== 'hush') throw new Error('Not in hush phase');
    this.phase = 'playing';
    var loser = offender === true ? 0 : (Number.isInteger(offender) ? offender : null);
    if (loser != null && (loser < 0 || loser >= this.players.length)) throw new Error('Invalid hush offender');
    this._emit({ t: 'hushEnd', failed: loser != null });
    if (loser != null) {
      this._drawCards(loser, 2, 'hush');
      this._emit({ t: 'hushFail', player: loser });
    }
    this._finishSocial();
  };

  OinkGame.prototype.resolveSlap = function (choices) {
    if (this.phase !== 'slap') throw new Error('Not in slap phase');
    if (!Array.isArray(choices) || choices.length !== this.players.length ||
        choices.some(function (choice) { return SLAP_CHOICES.indexOf(choice) < 0; })) {
      throw new Error('One valid choice is required for every player');
    }
    var present = SLAP_CHOICES.filter(function (choice) { return choices.indexOf(choice) >= 0; });
    var losingChoice = present.length === 2 && SLAP_BEATS[present[0]] === present[1]
      ? present[1]
      : present.length === 2 && SLAP_BEATS[present[1]] === present[0] ? present[0] : null;
    var losers = [];
    this.phase = 'playing';
    for (var i = 0; i < choices.length; i++) {
      if (choices[i] === losingChoice) {
        losers.push(i);
        this._drawCards(i, 2, 'slap');
      }
    }
    var result = { choices: choices.slice(), losers: losers };
    this._emit({ t: 'slapEnd', choices: result.choices, losers: result.losers });
    this._finishSocial();
    return result;
  };

  OinkGame.prototype._finishSocial = function () {
    var player = this._socialPlayer;
    this._socialPlayer = null;
    if (this._oinkPending != null) {
      var p = this._oinkPending;
      this._oinkPending = null;
      if (this.players[p].hand.length === 1) this._startOink(p);
    }
    this._advanceFrom(player, 1);
  };

  OinkGame.prototype.getState = function () {
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
      pendingDraw: this.pendingDraw,
      interceptOpen: this.interceptOpen,
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
        this.interceptOpen = true;
        this._advance(2);
        break;
      case 'reverse':
        this.direction *= -1;
        this._emit({ t: 'reverse', direction: this.direction });
        this.interceptOpen = true;
        this._advance(1);
        break;
      case 'draw3':
        this.pendingDraw += 3;
        this._emit({ t: 'attack', count: this.pendingDraw });
        this._advance(1);
        break;
      case 'hush':
        this.interceptOpen = false;
        this._socialPlayer = playerIdx;
        this.phase = 'hush';
        this._emit({ t: 'hush', duration: HUSH_MS });
        break;
      case 'slap':
        this.interceptOpen = false;
        this._socialPlayer = playerIdx;
        this.phase = 'slap';
        this._emit({ t: 'slap' });
        break;
      default: // number or plain wild
        this.interceptOpen = true;
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
      this._drawCards(p, 3, 'oink');
      this._emit({ t: 'oinkFail', player: p });
    }
  };

  OinkGame.prototype._win = function (playerIdx) {
    this.phase = 'over';
    this.winner = playerIdx;
    this.players[playerIdx].wins++;
    this.oink = null;
    this.drawn = null;
    var remaining = this.players.map(function (p) { return p.hand.length; });
    this._emit({
      t: 'win',
      winner: playerIdx,
      hands: remaining,
      roundScore: remaining.reduce(function (s, n) { return s + n; }, 0)
    });
  };

  global.OINK = global.OINK || {};
  global.OINK.OinkGame = OinkGame;
  global.OINK.RULES = { OINK_WINDOW_MS: OINK_WINDOW_MS, HUSH_MS: HUSH_MS, SLAP_CHOICES: SLAP_CHOICES };
})(typeof window !== 'undefined' ? window : globalThis);
