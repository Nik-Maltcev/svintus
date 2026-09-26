/*
 * Oink! — UI layer. Renders engine events with animations, owns all input.
 * All art is inline SVG/CSS: zero external assets.
 */
(function (global) {
  'use strict';
  var C = global.OINK.cards;
  var RULES = global.OINK.RULES;
  var audio = global.OINK.audio;
  var sdk = global.OINK.sdk;

  function $(s, root) { return (root || document).querySelector(s); }
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- SVG art ---------------- */

  var ICONS = {
    skip: '<svg class="ic" viewBox="0 0 40 40"><text x="5" y="17" font-size="13" font-weight="900" fill="currentColor" font-family="inherit">z</text><text x="16" y="27" font-size="18" font-weight="900" fill="currentColor" font-family="inherit">z</text><text x="29" y="15" font-size="10" font-weight="900" fill="currentColor" font-family="inherit">z</text></svg>',
    reverse: '<svg class="ic" viewBox="0 0 40 40"><path d="M8 14 H28 M24 8 L30 14 L24 20" stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 27 H12 M16 21 L10 27 L16 33" stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    draw2: '<svg class="ic" viewBox="0 0 40 40"><g fill="currentColor"><circle cx="20" cy="23" r="10"/><circle cx="10" cy="16" r="3.4"/><circle cx="30" cy="14" r="4"/><circle cx="32" cy="26" r="2.6"/><circle cx="8" cy="26" r="2.2"/></g><text x="20" y="27" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="inherit">+2</text></svg>',
    swap: '<svg class="ic" viewBox="0 0 40 40"><path d="M8 15 H30 M26 9 L32 15 L26 21" stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 26 H10 M14 20 L8 26 L14 32" stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wild: '<svg class="ic" viewBox="0 0 40 40"><path d="M20 20 L20 5 A15 15 0 0 1 35 20 Z" fill="#e74c3c"/><path d="M20 20 L35 20 A15 15 0 0 1 20 35 Z" fill="#4a90d9"/><path d="M20 20 L20 35 A15 15 0 0 1 5 20 Z" fill="#f0b429"/><path d="M20 20 L5 20 A15 15 0 0 1 20 5 Z" fill="#3aa76d"/></svg>',
    wild4: '<svg class="ic" viewBox="0 0 40 40"><path d="M20 20 L20 5 A15 15 0 0 1 35 20 Z" fill="#e74c3c"/><path d="M20 20 L35 20 A15 15 0 0 1 20 35 Z" fill="#4a90d9"/><path d="M20 20 L20 35 A15 15 0 0 1 5 20 Z" fill="#f0b429"/><path d="M20 20 L5 20 A15 15 0 0 1 20 5 Z" fill="#3aa76d"/><circle cx="20" cy="20" r="8.5" fill="#fff"/><text x="20" y="24" text-anchor="middle" font-size="10" font-weight="900" fill="#444" font-family="inherit">+4</text></svg>',
    shhh: '<svg class="ic" viewBox="0 0 40 40"><circle cx="20" cy="21" r="13" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="15" cy="17" r="1.9" fill="currentColor"/><circle cx="25" cy="17" r="1.9" fill="currentColor"/><rect x="18" y="21" width="4" height="13" rx="2" fill="currentColor"/></svg>'
  };

  var SNOUT = '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="52" rx="34" ry="26" fill="currentColor"/><ellipse cx="37" cy="50" rx="6.5" ry="9" fill="rgba(0,0,0,.35)"/><ellipse cx="63" cy="50" rx="6.5" ry="9" fill="rgba(0,0,0,.35)"/></svg>';

  function pigAvatar(accent, accessory) {
    var acc = '';
    if (accessory === 'leaf') {
      acc = '<path d="M50 16 C60 4 74 6 76 8 C74 18 62 24 52 20 Z" fill="' + accent + '"/><path d="M50 18 C56 12 66 10 72 10" stroke="rgba(0,0,0,.2)" stroke-width="2" fill="none"/>';
    } else if (accessory === 'bow') {
      acc = '<g transform="translate(74,22)"><path d="M0 0 L-12 -7 L-12 7 Z" fill="' + accent + '"/><path d="M0 0 L12 -7 L12 7 Z" fill="' + accent + '"/><circle cx="0" cy="0" r="4" fill="' + accent + '"/></g>';
    } else if (accessory === 'flower') {
      acc = '<g transform="translate(27,20)">' +
        '<circle cx="0" cy="-7" r="4.6" fill="' + accent + '"/><circle cx="6.7" cy="-2" r="4.6" fill="' + accent + '"/><circle cx="4" cy="6" r="4.6" fill="' + accent + '"/><circle cx="-4" cy="6" r="4.6" fill="' + accent + '"/><circle cx="-6.7" cy="-2" r="4.6" fill="' + accent + '"/>' +
        '<circle cx="0" cy="0" r="4" fill="#ffd76e"/></g>';
    } else if (accessory === 'crown') {
      acc = '<path d="M32 18 L38 4 L46 14 L52 2 L58 14 L66 4 L72 18 Z" fill="' + accent + '"/>';
    }
    return '<svg viewBox="0 0 100 100">' +
      '<path d="M18 30 L14 8 L38 18 Z" fill="#f9a8c5"/><path d="M82 30 L86 8 L62 18 Z" fill="#f9a8c5"/>' +
      '<circle cx="50" cy="55" r="34" fill="#f9a8c5"/>' + acc +
      '<circle cx="37" cy="46" r="4" fill="#3a2b30"/><circle cx="63" cy="46" r="4" fill="#3a2b30"/>' +
      '<ellipse cx="50" cy="62" rx="15" ry="11" fill="#f48fb1"/>' +
      '<ellipse cx="44.5" cy="61" rx="2.8" ry="4" fill="#8d4b62"/><ellipse cx="55.5" cy="61" rx="2.8" ry="4" fill="#8d4b62"/>' +
      '<path d="M42 76 Q50 82 58 76" stroke="#3a2b30" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  var BOT_PROFILES = [
    { name: 'Truffle', accent: '#6fbf63', acc: 'leaf' },
    { name: 'Hamlet',  accent: '#5da7e0', acc: 'bow' },
    { name: 'Petunia', accent: '#ef86b8', acc: 'flower' }
  ];
  var HUMAN_ACCENT = '#ffcf5e';

  /* ---------------- helpers ---------------- */

  var COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3 };
  function sortHand(hand) {
    return hand.slice().sort(function (a, b) {
      var ca = a.color ? COLOR_ORDER[a.color] : 9;
      var cb = b.color ? COLOR_ORDER[b.color] : 9;
      if (ca !== cb) return ca - cb;
      if (a.kind === 'number' && b.kind === 'number') return a.value - b.value;
      if (a.kind !== b.kind) return a.kind === 'number' ? -1 : 1;
      return (a.effect || '').localeCompare(b.effect || '');
    });
  }

  function cardEl(card, back) {
    var d = el('div', 'card');
    if (back || !card) { d.classList.add('back'); d.innerHTML = '<div class="back-snout">' + SNOUT + '</div><div class="back-word">OINK!</div>'; return d; }
    d.classList.add('face', card.color || 'wild');
    var idx = card.kind === 'number' ? String(card.value)
      : card.kind === 'action' ? ICONS[card.effect]
      : '';
    var center;
    if (card.kind === 'number') {
      center = '<div class="oval"><span class="big">' + card.value + '</span></div>';
    } else if (card.kind === 'action') {
      center = '<div class="oval oval-icon">' + ICONS[card.effect] + '<span class="card-name">' + C.EFFECTS[card.effect].name + '</span></div>';
    } else if (card.effect === 'shhh') {
      center = '<div class="oval oval-icon">' + ICONS.shhh + '<span class="card-name">Shhh!</span></div>';
    } else {
      center = '<div class="oval oval-icon">' + ICONS[card.effect] + '<span class="card-name">' + C.WILDS[card.effect].name + '</span></div>';
    }
    d.innerHTML = '<div class="idx tl">' + idx + '</div>' + center + '<div class="idx br">' + idx + '</div>';
    return d;
  }

  function flyClone(fromRect, toRect, node, dur) {
    dur = dur || 320;
    var fly = el('div', 'fly');
    fly.appendChild(node);
    fly.style.left = fromRect.left + 'px';
    fly.style.top = fromRect.top + 'px';
    document.body.appendChild(fly);
    var dx = toRect.left + (toRect.width - fromRect.width) / 2 - fromRect.left;
    var dy = toRect.top + (toRect.height - fromRect.height) / 2 - fromRect.top;
    var sx = toRect.width / fromRect.width, sy = toRect.height / fromRect.height;
    requestAnimationFrame(function () {
      fly.style.transition = 'transform ' + dur + 'ms cubic-bezier(.5,.1,.3,1), opacity ' + dur + 'ms';
      fly.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + ((sx + sy) / 2) + ') rotate(' + ((Math.random() * 14) - 7) + 'deg)';
      fly.style.opacity = '0.95';
    });
    setTimeout(function () { fly.remove(); }, dur + 60);
  }

  /* ---------------- UI class ---------------- */

  function OinkUI() {
    this.q = [];
    this._busy = false;
    this._token = 0;
    this._game = null;
    this._cfg = null;
    this._humanTurn = false;
    this._pile = [];       // discard pile card elements (visual)
    this._rot = {};        // per-card discard rotation angles
    this._opponents = 2;
    this._oinkTimer = null;
    this._hushDone = false;
  }

  OinkUI.prototype.init = function () {
    var self = this;

    // static SVG art
    $('#deck .back-snout').innerHTML = SNOUT;
    $('#logo-pig').innerHTML = pigAvatar('#f9a8c5', 'crown');
    $('#you-avatar').innerHTML = pigAvatar(HUMAN_ACCENT, 'crown');

    // menu setup
    var oppWrap = $('#opp-picker');
    [1, 2, 3].forEach(function (n) {
      var b = el('button', 'seg' + (n === self._opponents ? ' on' : ''), String(n));
      b.addEventListener('click', function () {
        self._opponents = n;
        oppWrap.querySelectorAll('.seg').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        audio.play('click');
      });
      oppWrap.appendChild(b);
    });

    $('#btn-play').addEventListener('click', function () {
      audio.unlock();
      audio.play('click');
      self.startGame({ opponents: self._opponents });
    });
    $('#btn-how').addEventListener('click', function () { audio.play('click'); self.showHowTo(); });
    $('#btn-sound').addEventListener('click', function () { self.toggleSound(this); });
    this._applySoundLabel($('#btn-sound'));

    // game topbar
    $('#btn-quit').addEventListener('click', function () { audio.play('click'); self.stopToMenu(); });
    $('#btn-help').addEventListener('click', function () { audio.play('click'); self.showHowTo(); });
    $('#btn-sound2').addEventListener('click', function () { self.toggleSound(this); self._applySoundLabel($('#btn-sound')); });

    // deck draw
    $('#deck').addEventListener('click', function () {
      if (!self._game || !self._humanTurn || self._game.drawn) return;
      try { self._game.drawCard(0); } catch (e) { /* ignore */ }
    });

    // hand plays
    $('#hand').addEventListener('click', function (ev) {
      var cardDiv = ev.target.closest('.card');
      if (!cardDiv || !cardDiv.dataset.id) return;
      self._tryPlay(cardDiv.dataset.id, cardDiv);
    });

    // oink call
    $('#btn-oink').addEventListener('click', function () {
      if (self._game) { try { self._game.callOink(0); } catch (e) { /* ignore */ } }
    });

    this._updateStatsLine();
  };

  OinkUI.prototype.toggleSound = function (btn) {
    var on = localStorage.getItem('oink.sound') !== 'off';
    localStorage.setItem('oink.sound', on ? 'off' : 'on');
    this._applySoundLabel($('#btn-sound'));
    this._applySoundLabel(btn);
    audio.play('click');
  };
  OinkUI.prototype._applySoundLabel = function (btn) {
    if (!btn) return;
    var on = localStorage.getItem('oink.sound') !== 'off';
    audio.setEnabled(on);
    btn.textContent = 'Sound: ' + (on ? 'On' : 'Off');
  };

  /* ---------- game lifecycle ---------- */

  OinkUI.prototype.startGame = function (cfg) {
    this._token++;
    this.q.length = 0;
    this._busy = false;
    this._cfg = cfg;
    this._pile = [];
    this._rot = {};
    this._humanTurn = false;

    var self = this;
    var bots = BOT_PROFILES.slice(0, cfg.opponents);
    var players = [{ name: 'You', isBot: false }].concat(bots.map(function (b) {
      return { name: b.name, isBot: true };
    }));

    $('#menu').hidden = true;
    $('#game').hidden = false;
    $('#seats').innerHTML = '';
    $('#discard').innerHTML = '';
    $('#hand').innerHTML = '';
    $('#btn-oink').hidden = true;
    $('#overlay-root').hidden = true;
    $('#overlay-root').innerHTML = '';
    this._buildSeats(bots);
    this._updateCenter();

    this._game = new OINK.OinkGame({
      players: players,
      onEvent: function (e) { self._enqueue(e); }
    });
    this._drain(); // game events queued during the constructor start flowing now
  };

  OinkUI.prototype.stopToMenu = function () {
    this._token++;
    this.q.length = 0;
    this._busy = false;
    this._game = null;
    sdk.gameplayStop();
    $('#game').hidden = true;
    $('#menu').hidden = false;
    this._updateStatsLine();
  };

  OinkUI.prototype._updateStatsLine = function () {
    var stats = this._readStats();
    $('#stats-line').textContent = stats.played > 0
      ? 'Rounds played: ' + stats.played + ' \u00B7 You won ' + stats.won
      : 'Grab a trough \u2014 first to run out of cards wins!';
  };
  OinkUI.prototype._readStats = function () {
    try { return JSON.parse(localStorage.getItem('oink.stats')) || { played: 0, won: 0 }; }
    catch (e) { return { played: 0, won: 0 }; }
  };

  /* ---------- event queue ---------- */

  OinkUI.prototype._enqueue = function (e) {
    e._token = this._token;
    this.q.push(e);
    // During construction the engine emits start/turn before this._game is
    // assigned; startGame drains the queue explicitly once it is.
    if (this._game && !this._busy) this._drain();
  };

  OinkUI.prototype._drain = async function () {
    if (this._busy) return;
    this._busy = true;
    while (this.q.length) {
      var e = this.q.shift();
      try { await this._handle(e); } catch (err) { console.error('[oink] event error', e.t, err); }
    }
    this._busy = false;
  };

  OinkUI.prototype._handle = async function (e) {
    if (e._token !== this._token) return; // stale game
    switch (e.t) {
      case 'start':
        sdk.gameplayStart();
        this._pushDiscard(e.top); // the initial discard card
        this._renderHand();
        this._updateSeats();
        this._updateCenter();
        this._dealAnimation();
        await sleep(600);
        break;

      case 'turn': {
        if (!this._game || this._game.phase !== 'playing') break;
        var st = this._game.getState();
        this._updateSeats();
        if (st.players[e.player].isBot) {
          this._humanTurn = false;
          this._renderHand();
          this._scheduleBot(e.player, 750 + Math.random() * 750);
        } else {
          this._humanTurn = true;
          this._renderHand();
          audio.play('turn');
          this._banner('Your turn!');
        }
        break;
      }

      case 'play': {
        audio.play('play');
        this._hideDrawnPrompt();
        var fromRect = this._sourceRectFor(e.player, e.card);
        this._pushDiscard(e.card);
        this._renderHand();
        this._updateSeats();
        this._updateCenter();
        if (fromRect) {
          var toRect = $('#discard').getBoundingClientRect();
          var face = cardEl(e.card);
          face.style.width = fromRect.width + 'px';
          face.style.height = fromRect.height + 'px';
          flyClone(fromRect, toRect, face, 320);
          await sleep(260);
        }
        if (e.card.kind === 'action' && (e.card.effect === 'draw2' || e.card.effect === 'wild4')) {
          this._bubble(e.player, e.card.effect === 'wild4' ? 'Stampede! +4' : 'Mud Sling! +2');
        }
        break;
      }

      case 'draw': {
        audio.play('draw');
        var deckRect = $('#deck').getBoundingClientRect();
        var target = e.player === 0 ? $('#hand') : this._seatEl(e.player);
        if (deckRect && target) flyClone(deckRect, target.getBoundingClientRect(), cardEl(null, true), 300);
        await sleep(240);
        this._renderHand();
        this._updateSeats();
        this._updateCenter();
        if (e.reason === 'attack' && e.player === 0) this._toast('You draw ' + e.count + '!', 'bad');
        if (e.reason === 'oink' && e.player === 0) this._toast('Forgot to OINK! +2', 'bad');
        if (e.reason === 'hush') this._toast('You spoke! +2 cards', 'bad');
        break;
      }

      case 'skip':
        this._bubble(e.player, 'Snoozed!');
        audio.play('click');
        await sleep(450);
        break;

      case 'reverse':
        audio.play('swap');
        $('#direction').classList.toggle('ccw', e.direction === -1);
        $('#direction').classList.add('spin');
        setTimeout(function () { $('#direction').classList.remove('spin'); }, 500);
        this._toast(e.direction === 1 ? 'Direction: clockwise' : 'Direction: counter-clockwise');
        await sleep(300);
        break;

      case 'swap':
        audio.play('swap');
        this._bubble(e.a, 'Swap!');
        this._bubble(e.b, 'Swap!');
        await sleep(350);
        this._renderHand();
        this._updateSeats();
        if (e.a === 0 || e.b === 0) this._toast('Hands swapped!');
        await sleep(250);
        break;

      case 'hush':
        audio.play('shush');
        await this._showHush(e.duration);
        break;

      case 'hushEnd':
        if (e.failed) audio.play('penalty');
        break;

      case 'hushFail':
        this._renderHand();
        break;

      case 'drawnPlayable': {
        var gst = this._game.getState();
        if (gst.players[e.player].isBot) {
          var d = OINK.bots.decideDrawn(this._game, e.player);
          await sleep(450);
          try {
            if (d.type === 'play') this._game.playDrawn(e.player, d.color);
            else this._game.keepDrawn(e.player);
          } catch (err) { console.error(err); }
        } else {
          this._showDrawnPrompt(e.card);
        }
        break;
      }

      case 'noPlay':
        if (e.player === 0) { this._toast('No luck \u2014 turn passes'); this._renderHand(); }
        await sleep(350);
        break;

      case 'keep':
        this._hideDrawnPrompt();
        this._renderHand();
        break;

      case 'reshuffle':
        this._toast('Discards shuffled back in');
        break;

      case 'oinkWindow': {
        if (e.player === 0) this._showOinkButton(e.duration);
        else {
          var tok = this._token;
          await sleep(650);
          if (tok !== this._token || !this._game) break;
          this._bubble(e.player, 'Oink!');
          audio.play('oink');
          try { this._game.callOink(e.player); } catch (err) { /* ignore */ }
        }
        break;
      }

      case 'oinkOk':
        if (e.player === 0) { this._hideOinkButton(); this._toast('OINK! Safe.', 'good'); }
        break;

      case 'oinkFail':
        this._hideOinkButton();
        if (e.player === 0) { audio.play('penalty'); this._toast('You forgot to OINK! +2 cards', 'bad'); }
        break;

      case 'win':
        this._humanTurn = false;
        this._hideOinkButton();
        this._hideDrawnPrompt();
        sdk.gameplayStop();
        await sleep(500);
        this._showRoundEnd(e);
        break;
    }
  };

  /* ---------- bot driver ---------- */

  OinkUI.prototype._scheduleBot = function (idx, delay) {
    var self = this, token = this._token;
    setTimeout(function () {
      if (token !== self._token || !self._game || self._game.phase !== 'playing') return;
      var a = OINK.bots.decide(self._game, idx);
      try {
        if (a.type === 'play') self._game.playCard(idx, a.cardId, a.color);
        else self._game.drawCard(idx);
      } catch (err) { console.error('[oink] bot error', err); }
    }, delay);
  };

  /* ---------- input ---------- */

  OinkUI.prototype._tryPlay = function (cardId, cardDiv) {
    if (!this._game || !this._humanTurn || this._game.drawn) return;
    var st = this._game.getState();
    var card = null;
    for (var i = 0; i < st.players[0].hand.length; i++) {
      if (st.players[0].hand[i].id === cardId) { card = st.players[0].hand[i]; break; }
    }
    if (!card) return;
    if (!C.canPlay(card, st.discardTop, st.activeColor)) {
      cardDiv.classList.add('shake');
      setTimeout(function () { cardDiv.classList.remove('shake'); }, 400);
      return;
    }
    var self = this;
    if (card.kind === 'wild') {
      this._showColorPicker().then(function (color) {
        if (!color) return;
        try { self._game.playCard(0, cardId, color); } catch (e) { console.error(e); }
      });
    } else {
      try { this._game.playCard(0, cardId); } catch (e) { console.error(e); }
    }
  };

  /* ---------- rendering ---------- */

  OinkUI.prototype._buildSeats = function (bots) {
    var wrap = $('#seats');
    wrap.innerHTML = '';
    for (var i = 0; i < bots.length; i++) {
      var seat = el('div', 'seat');
      seat.dataset.idx = String(i + 1);
      seat.innerHTML =
        '<div class="bubble" hidden></div>' +
        '<div class="avatar">' + pigAvatar(bots[i].accent, bots[i].acc) + '</div>' +
        '<div class="seat-name">' + bots[i].name + '</div>' +
        '<div class="fan"></div>' +
        '<div class="count">7</div>';
      wrap.appendChild(seat);
    }
  };

  OinkUI.prototype._seatEl = function (idx) {
    return $('#seats .seat[data-idx="' + idx + '"]');
  };

  OinkUI.prototype._updateSeats = function () {
    if (!this._game) return;
    var st = this._game.getState();
    for (var i = 1; i < st.players.length; i++) {
      var seat = this._seatEl(i);
      if (!seat) continue;
      var n = st.players[i].hand.length;
      seat.querySelector('.count').textContent = n;
      var fan = seat.querySelector('.fan');
      var shown = Math.min(n, 7);
      while (fan.children.length < shown) fan.appendChild(cardEl(null, true));
      while (fan.children.length > shown) fan.removeChild(fan.lastChild);
      seat.classList.toggle('active', st.turn === i && st.phase === 'playing');
    }
    $('#you-chip .count').textContent = st.players[0].hand.length;
  };

  OinkUI.prototype._pushDiscard = function (card) {
    this._pile.push(card);
    if (this._pile.length > 5) this._pile.shift();
    var disc = $('#discard');
    disc.innerHTML = '';
    for (var i = 0; i < this._pile.length; i++) {
      var c = this._pile[i];
      if (!this._rot[c.id]) this._rot[c.id] = (Math.random() * 16) - 8;
      var d = cardEl(c);
      d.style.transform = 'rotate(' + this._rot[c.id] + 'deg)';
      disc.appendChild(d);
    }
  };

  OinkUI.prototype._updateCenter = function () {
    if (!this._game) return;
    var st = this._game.getState();
    $('#deck-count').textContent = st.drawCount;
    var chip = $('#color-chip');
    chip.className = 'chip ' + st.activeColor;
    $('#direction').classList.toggle('ccw', st.direction === -1);
  };

  OinkUI.prototype._renderHand = function () {
    if (!this._game) return;
    var st = this._game.getState();
    var hand = $('#hand');
    hand.innerHTML = '';
    var sorted = sortHand(st.players[0].hand);
    var playableIds = {};
    for (var i = 0; i < sorted.length; i++) {
      if (C.canPlay(sorted[i], st.discardTop, st.activeColor)) playableIds[sorted[i].id] = true;
    }
    hand.classList.toggle('many', sorted.length > 8);
    for (var j = 0; j < sorted.length; j++) {
      var d = cardEl(sorted[j]);
      d.dataset.id = sorted[j].id;
      if (this._humanTurn && playableIds[sorted[j].id]) d.classList.add('playable');
      if (st.drawn === sorted[j].id) d.classList.add('picked');
      hand.appendChild(d);
    }
  };

  OinkUI.prototype._dealAnimation = function () {
    var cards = $('#hand').querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.animationDelay = (i * 45) + 'ms';
      cards[i].classList.add('deal');
    }
  };

  OinkUI.prototype._sourceRectFor = function (playerIdx, card) {
    if (playerIdx === 0) {
      var d = $('#hand .card[data-id="' + card.id + '"]');
      return d ? d.getBoundingClientRect() : $('#hand').getBoundingClientRect();
    }
    var seat = this._seatEl(playerIdx);
    return seat ? seat.querySelector('.fan').getBoundingClientRect() : null;
  };

  /* ---------- overlays ---------- */

  OinkUI.prototype._overlay = function () {
    var root = $('#overlay-root');
    root.hidden = false;
    root.innerHTML = '';
    return root;
  };

  OinkUI.prototype._closeOverlay = function () {
    var root = $('#overlay-root');
    root.hidden = true;
    root.innerHTML = '';
  };

  OinkUI.prototype._showColorPicker = function () {
    var self = this;
    return new Promise(function (resolve) {
      var root = self._overlay();
      var box = el('div', 'modal picker');
      box.innerHTML = '<h2>Pick a color</h2><div class="quad"></div>';
      var quad = box.querySelector('.quad');
      C.COLORS.forEach(function (col) {
        var b = el('button', 'quad-btn ' + col);
        b.innerHTML = SNOUT;
        b.addEventListener('click', function () {
          audio.play('click');
          self._closeOverlay();
          resolve(col);
        });
        quad.appendChild(b);
      });
      var cancel = el('button', 'btn ghost small', 'Cancel');
      cancel.addEventListener('click', function () { self._closeOverlay(); resolve(null); });
      box.appendChild(cancel);
      root.appendChild(box);
    });
  };

  OinkUI.prototype._showHush = function (duration) {
    var self = this;
    return new Promise(function (resolve) {
      var root = self._overlay();
      var box = el('div', 'hush');
      box.innerHTML =
        '<div class="hush-inner">' +
        '<div class="hush-icon">' + ICONS.shhh + '</div>' +
        '<h2>SHHH&hellip;</h2>' +
        '<p>Don\u2019t touch anything!</p>' +
        '<div class="ring"><div class="ring-fill"></div></div>' +
        '</div>';
      root.appendChild(box);

      var done = false;
      function finish(failed) {
        if (done) return;
        done = true;
        clearInterval(iv);
        box.classList.add('gone');
        setTimeout(function () { self._closeOverlay(); }, 200);
        try { self._game.resolveHush(failed); } catch (e) { console.error(e); }
        resolve();
      }
      var iv = setInterval(function () {
        var pct = Math.max(0, 100 - ((Date.now() - t0) / duration) * 100);
        box.querySelector('.ring-fill').style.height = pct + '%';
        if (Date.now() - t0 >= duration) finish(false);
      }, 50);
      var t0 = Date.now();
      box.addEventListener('pointerdown', function () { finish(true); });

      // bots lean in and twitch — pure theater, they never fail
      for (var i = 1; i <= BOT_PROFILES.length; i++) {
        var seat = self._seatEl(i);
        if (seat) setTimeout(function (s) { return function () { s.classList.add('twitch'); }; }(seat), 300 + i * 250);
      }
      setTimeout(function () {
        for (var j = 1; j <= BOT_PROFILES.length; j++) {
          var s = self._seatEl(j);
          if (s) s.classList.remove('twitch');
        }
      }, duration + 100);
    });
  };

  OinkUI.prototype._showOinkButton = function (duration) {
    var self = this;
    var btn = $('#btn-oink');
    btn.hidden = false;
    btn.classList.add('pulse');
    var t0 = Date.now();
    clearInterval(this._oinkTimer);
    this._oinkTimer = setInterval(function () {
      var left = duration - (Date.now() - t0);
      if (left <= 0) {
        clearInterval(self._oinkTimer);
        btn.style.setProperty('--p', '0');
        try { if (self._game) self._game.oinkTick(); } catch (e) { /* ignore */ }
        return;
      }
      btn.style.setProperty('--p', String((left / duration) * 100));
    }, 50);
  };

  OinkUI.prototype._hideOinkButton = function () {
    clearInterval(this._oinkTimer);
    var btn = $('#btn-oink');
    btn.hidden = true;
    btn.classList.remove('pulse');
  };

  OinkUI.prototype._showDrawnPrompt = function (card) {
    var self = this;
    this._hideDrawnPrompt();
    var area = $('#hand-area');
    var p = el('div', 'drawn-prompt');
    p.innerHTML = '<span>You drew <b>' + C.label(card) + '</b> \u2014 play it?</span>';
    var play = el('button', 'btn primary small', 'Play it');
    var keep = el('button', 'btn ghost small', 'Keep');
    p.appendChild(play);
    p.appendChild(keep);
    play.addEventListener('click', function () {
      var go = function (color) {
        self._hideDrawnPrompt();
        try { self._game.playDrawn(0, color); } catch (e) { console.error(e); }
      };
      if (card.kind === 'wild') {
        self._showColorPicker().then(function (color) { if (color) go(color); });
      } else go(undefined);
    });
    keep.addEventListener('click', function () {
      self._hideDrawnPrompt();
      try { self._game.keepDrawn(0); } catch (e) { console.error(e); }
    });
    area.appendChild(p);
    this._renderHand();
  };

  OinkUI.prototype._hideDrawnPrompt = function () {
    var p = $('#hand-area .drawn-prompt');
    if (p) p.remove();
  };

  OinkUI.prototype._showRoundEnd = function (e) {
    var self = this;
    var stats = this._readStats();
    stats.played++;
    if (e.winner === 0) { stats.won++; sdk.happytime(); }
    localStorage.setItem('oink.stats', JSON.stringify(stats));

    var st = this._game.getState();
    var root = this._overlay();
    var won = e.winner === 0;
    audio.play(won ? 'win' : 'lose');

    var rows = '';
    for (var i = 0; i < st.players.length; i++) {
      rows += '<tr class="' + (i === e.winner ? 'winner-row' : '') + '">' +
        '<td>' + (st.players[i].isBot ? pigAvatar(BOT_PROFILES[i - 1].accent, BOT_PROFILES[i - 1].acc) : pigAvatar(HUMAN_ACCENT, 'crown')) + '</td>' +
        '<td>' + st.players[i].name + '</td>' +
        '<td>' + e.hands[i] + ' cards</td>' +
        '<td>' + e.points[i] + ' pts</td></tr>';
    }

    var box = el('div', 'modal round-end' + (won ? ' you-win' : ''));
    box.innerHTML =
      '<div class="end-pig">' + pigAvatar(won ? HUMAN_ACCENT : BOT_PROFILES[Math.max(0, e.winner - 1)].accent, won ? 'crown' : BOT_PROFILES[Math.max(0, e.winner - 1)].acc) + '</div>' +
      '<h1>' + (won ? 'You win!' : st.players[e.winner].name + ' wins!') + '</h1>' +
      '<table class="score">' + rows + '</table>' +
      '<p class="tally">Session: ' + stats.won + ' win' + (stats.won === 1 ? '' : 's') + ' in ' + stats.played + ' rounds</p>';
    var again = el('button', 'btn primary big', 'Play again');
    var menu = el('button', 'btn ghost', 'Menu');
    again.addEventListener('click', function () {
      audio.play('click');
      sdk.midgameAd(function () { self.startGame(self._cfg); });
    });
    menu.addEventListener('click', function () { audio.play('click'); self._closeOverlay(); self.stopToMenu(); });
    box.appendChild(again);
    box.appendChild(menu);
    root.appendChild(box);
    if (won) this._confetti(root);
  };

  OinkUI.prototype._confetti = function (root) {
    var colors = ['#e74c3c', '#f0b429', '#3aa76d', '#4a90d9', '#ff8fb3'];
    for (var i = 0; i < 40; i++) {
      (function (k) {
        setTimeout(function () {
          var p = el('div', 'confetti');
          p.style.left = (Math.random() * 100) + '%';
          p.style.background = colors[k % colors.length];
          p.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
          p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
          root.appendChild(p);
          setTimeout(function () { p.remove(); }, 2800);
        }, k * 40);
      })(i);
    }
  };

  OinkUI.prototype.showHowTo = function () {
    var self = this;
    var root = this._overlay();
    var box = el('div', 'modal howto');
    var glossary =
      ['skip', 'reverse', 'draw2', 'swap', 'wild', 'wild4', 'shhh'].map(function (k) {
        var desc = {
          skip: 'Next player loses a turn',
          reverse: 'Flips the direction of play',
          draw2: 'Next player draws 2 and loses a turn',
          swap: 'Trade hands with the next player',
          wild: 'Play anytime \u00B7 pick the color',
          wild4: 'Pick the color \u00B7 next player draws 4',
          shhh: 'Everyone freezes \u2014 first to touch draws 2!'
        }[k];
        var name = k === 'wild' ? C.WILDS.wild.name : k === 'wild4' ? C.WILDS.wild4.name : k === 'shhh' ? C.WILDS.shhh.name : C.EFFECTS[k].name;
        var sample = k === 'wild' || k === 'wild4' || k === 'shhh'
          ? cardEl({ id: 'x', kind: 'wild', color: null, effect: k })
          : cardEl({ id: 'x', kind: 'action', color: 'red', effect: k });
        return '<div class="gloss">' + sample.outerHTML + '<div class="gloss-txt"><b>' + name + '</b><span>' + desc + '</span></div></div>';
      }).join('');

    box.innerHTML =
      '<h2>How to play</h2>' +
      '<ul class="rules-list">' +
      '<li>Dump all your cards first to win.</li>' +
      '<li>On your turn, match the top card by <b>color</b>, <b>number</b> or <b>symbol</b>.</li>' +
      '<li>No match? Tap the deck to draw one card \u2014 if it plays, you may play it right away.</li>' +
      '<li>Down to your last card? Smack the <b>OINK!</b> button within 3 seconds or draw 2.</li>' +
      '</ul>' +
      '<div class="glossary">' + glossary + '</div>';
    var close = el('button', 'btn primary big', 'Got it!');
    close.addEventListener('click', function () { audio.play('click'); self._closeOverlay(); });
    box.appendChild(close);
    root.appendChild(box);
  };

  /* ---------- small fx ---------- */

  OinkUI.prototype._toast = function (text, tone) {
    var wrap = $('#toasts');
    while (wrap.children.length >= 3) wrap.removeChild(wrap.firstChild);
    var t = el('div', 'toast' + (tone ? ' ' + tone : ''), text);
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 1900);
    setTimeout(function () { t.remove(); }, 2300);
  };

  OinkUI.prototype._bubble = function (seatIdx, text) {
    var seat = this._seatEl(seatIdx);
    if (!seat) return;
    var b = seat.querySelector('.bubble');
    b.textContent = text;
    b.hidden = false;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    setTimeout(function () { b.hidden = true; }, 1400);
  };

  OinkUI.prototype._banner = function (text) {
    var b = $('#turn-banner');
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  };

  OinkUI.prototype._confettiCleanup = null;

  global.OINK = global.OINK || {};
  global.OINK.ui = new OinkUI();
  global.OINK._art = { cardEl: cardEl, pigAvatar: pigAvatar, ICONS: ICONS, SNOUT: SNOUT, BOT_PROFILES: BOT_PROFILES };
})(typeof window !== 'undefined' ? window : globalThis);
