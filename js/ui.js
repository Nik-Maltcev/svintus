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
    draw3: '<svg class="ic" viewBox="0 0 40 40"><g fill="currentColor"><circle cx="20" cy="23" r="10"/><circle cx="10" cy="16" r="3.4"/><circle cx="30" cy="14" r="4"/><circle cx="32" cy="26" r="2.6"/><circle cx="8" cy="26" r="2.2"/></g><text x="20" y="27" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="inherit">+3</text></svg>',
    hush: '<svg class="ic" viewBox="0 0 40 40"><circle cx="20" cy="21" r="13" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="15" cy="17" r="1.9" fill="currentColor"/><circle cx="25" cy="17" r="1.9" fill="currentColor"/><rect x="18" y="21" width="4" height="13" rx="2" fill="currentColor"/></svg>',
    slap: '<svg class="ic" viewBox="0 0 40 40"><path d="M11 31V15q0-4 4-4t4 4V8q0-4 4-4t4 4v8q0-4 4-4t4 4v15z" fill="currentColor"/><path d="M11 23l-5-4q-4-2-4 2l9 12" fill="currentColor"/></svg>',
    wild: '<svg class="ic" viewBox="0 0 40 40"><path d="M20 20 L20 5 A15 15 0 0 1 35 20 Z" fill="#e74c3c"/><path d="M20 20 L35 20 A15 15 0 0 1 20 35 Z" fill="#4a90d9"/><path d="M20 20 L20 35 A15 15 0 0 1 5 20 Z" fill="#eaa347"/><path d="M20 20 L5 20 A15 15 0 0 1 20 5 Z" fill="#3aa76d"/></svg>',
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

  var COLOR_ORDER = { red: 0, orange: 1, green: 2, blue: 3 };
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

  // Original character art drawn as SVG so every card stays crisp at any size.
  function pigScene(effect) {
    var props = {
      skip: '<path d="M16 85h88v8H16z" fill="#8c493e"/><path d="M28 93v18m64-18v18" stroke="#70362f" stroke-width="6"/><text x="83" y="35" fill="#fff" font-size="20" font-weight="900" transform="rotate(12 83 35)">Z z</text>',
      reverse: '<path d="M12 60c0-27 19-43 42-44" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M48 9l13 7-12 9" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M108 64c-2 25-19 40-43 42" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M71 113l-13-7 12-9" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
      draw3: '<path d="M20 93l-9-12 11-5-6-14 16 3 8-13 7 16 15 1-10 13 9 12-17-2-7 12-8-12z" fill="#74412e"/><circle cx="30" cy="68" r="5" fill="#74412e"/><circle cx="57" cy="58" r="4" fill="#74412e"/><text x="75" y="109" fill="#fff" font-size="25" font-weight="900">+3</text>',
      slap: '<path d="M12 103h96v9H12z" fill="#784239"/><path d="M87 27v42M77 36v34M97 40v31M69 52v23" fill="none" stroke="#f7b2b9" stroke-width="10" stroke-linecap="round"/><path d="M68 71q18-15 39-3l-7 22q-18 13-30-3z" fill="#f7b2b9" stroke="#794755" stroke-width="2"/><path d="M13 37l-6-8m20 2-1-9m9 17 8-5" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
      wild: '<path d="M11 88Q19 22 64 19Q100 18 111 80" fill="none" stroke="#e85c56" stroke-width="10"/><path d="M16 88Q24 31 64 27Q94 27 106 79" fill="none" stroke="#f3c74f" stroke-width="9"/><path d="M21 89Q30 39 64 36Q89 35 101 80" fill="none" stroke="#6dbd77" stroke-width="8"/><path d="M27 89Q37 48 64 44Q84 44 96 81" fill="none" stroke="#5c9bd2" stroke-width="7"/>',
      hush: '<path d="M76 60v-26c0-7 11-7 11 0v30" fill="#f5a8ad" stroke="#733e4c" stroke-width="2"/><circle cx="91" cy="30" r="3" fill="#fff"/><text x="83" y="105" text-anchor="middle" fill="#fff" font-size="17" font-weight="900">SHH!</text>'
    };
    return '<svg class="pig-scene" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="54" fill="rgba(255,255,255,.13)"/>' +
      '<path d="M23 97Q17 54 43 44L74 43Q102 58 98 99Z" fill="#603d57" stroke="#513348" stroke-width="2"/>' +
      '<path d="M29 49L23 19Q22 13 29 17L47 31M91 49l6-30q1-6-6-2L73 31" fill="#f9b4ba" stroke="#794755" stroke-width="3" stroke-linejoin="round"/>' +
      '<ellipse cx="60" cy="60" rx="37" ry="34" fill="#f8afb7" stroke="#794755" stroke-width="2.6"/>' +
      '<path d="M36 55q7-5 15 0m18 0q8-5 15 0" fill="none" stroke="#603d50" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="60" cy="76" rx="21" ry="14" fill="#ee8e9f" stroke="#794755" stroke-width="2"/>' +
      '<ellipse cx="51" cy="76" rx="3.8" ry="6" fill="#a55670"/><ellipse cx="69" cy="76" rx="3.8" ry="6" fill="#a55670"/>' +
      '<path d="M36 96q7 0 14 8m34-8q-7 0-14 8" fill="none" stroke="#f8afb7" stroke-width="9" stroke-linecap="round"/>' +
      (props[effect] || '') + '</svg>';
  }

  function cardEl(card, back) {
    var d = el('div', 'card');
    if (back || !card) {
      d.classList.add('back');
      d.innerHTML = '<div class="back-pattern"></div><div class="back-badge">' + SNOUT + '<strong>OINK!</strong></div>';
      return d;
    }
    d.classList.add('face', card.color || 'wild');
    d.classList.add(card.kind === 'number' ? 'number-card' : 'action-card');
    var idx = card.kind === 'number' ? String(card.value) : ICONS[card.effect];
    var center, name = C.label(card);
    if (card.kind === 'number') {
      center = '<div class="number-medallion"><span class="number-mark">' + SNOUT + '</span><span class="big">' + card.value + '</span></div>';
    } else {
      center = '<div class="scene-wrap">' + pigScene(card.effect) + '</div><div class="card-ribbon">' + name + '</div>';
    }
    d.setAttribute('aria-label', (card.color ? card.color + ' ' : '') + name);
    d.innerHTML = '<div class="card-inner"><span class="corner top">' + idx + '</span>' + center + '<span class="corner bottom">' + idx + '</span></div>';
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
    $('#deck .card').replaceWith(cardEl(null, true));
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
        if (st.turn !== e.player) break; // an interception can replace a queued turn
        this._updateSeats();
        if (st.players[e.player].isBot) {
          this._humanTurn = false;
          this._renderHand();
          if (!this._game.oink || this._game.oink.player !== 0) this._hideOinkButton();
          this._scheduleBot(e.player, 750 + Math.random() * 750);
        } else {
          this._humanTurn = true;
          this._renderHand();
          if (st.players[0].hand.length === 2 && !this._game.oink) this._showOinkButton(0);
          else if (!this._game.oink || this._game.oink.player !== 0) this._hideOinkButton();
          audio.play('turn');
          this._banner(st.pendingDraw ? 'Pass on +' + st.pendingDraw + ' or draw!' : 'Your turn!');
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
        if (e.card.effect === 'draw3') this._bubble(e.player, 'Grab Pig! +3');
        if (this._game && this._game.getState().discardTop.id === e.card.id) this._scheduleBotIntercept(e.player);
        break;
      }

      case 'intercept':
        this._toast(e.player === 0 ? 'Intercept! Your turn now.' : this._game.players[e.player].name + ' intercepted!', 'good');
        break;

      case 'attack':
        this._toast('Grab Pig: +' + e.count + ' to pass on or draw', 'bad');
        break;

      case 'draw': {
        audio.play('draw');
        if (e.player === 0 && e.reason === 'voluntary') this._hideOinkButton();
        var deckRect = $('#deck').getBoundingClientRect();
        var target = e.player === 0 ? $('#hand') : this._seatEl(e.player);
        if (deckRect && target) flyClone(deckRect, target.getBoundingClientRect(), cardEl(null, true), 300);
        await sleep(240);
        this._renderHand();
        this._updateSeats();
        this._updateCenter();
        if (e.reason === 'attack' && e.player === 0) this._toast('You draw ' + e.count + '!', 'bad');
        if (e.reason === 'oink' && e.player === 0) this._toast('Forgot to OINK! +3', 'bad');
        if (e.reason === 'hush') this._toast(e.player === 0 ? 'You broke the hush! +2 cards' : this._game.players[e.player].name + ' broke the hush! +2');
        if (e.reason === 'slap') this._toast(e.player === 0 ? 'Your move lost! +2 cards' : this._game.players[e.player].name + ' lost the clash! +2');
        break;
      }

      case 'skip':
        this._bubble(e.player, 'Snore Pig!');
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

      case 'hush':
        audio.play('shush');
        await this._showHush(e.duration);
        break;

      case 'slap':
        audio.play('click');
        await this._showSlap();
        break;

      case 'slapEnd':
        if (e.losers.indexOf(0) >= 0) audio.play('penalty');
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
        if (e.player === 0) { audio.play('penalty'); this._toast('You forgot to OINK! +3 cards', 'bad'); }
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
      if (token !== self._token || !self._game || self._game.phase !== 'playing' || self._game.turn !== idx) return;
      var a = OINK.bots.decide(self._game, idx);
      try {
        if (a.type === 'play' && self._game.players[idx].hand.length === 2) self._game.callOink(idx);
        if (a.type === 'play') self._game.playCard(idx, a.cardId, a.color);
        else self._game.drawCard(idx);
      } catch (err) { console.error('[oink] bot error', err); }
    }, delay);
  };

  OinkUI.prototype._scheduleBotIntercept = function (actor) {
    var self = this, token = this._token;
    if (!this._game || !this._game.interceptOpen) return;
    for (var idx = 1; idx < this._game.players.length; idx++) {
      if (idx === actor || Math.random() > .42) continue;
      (function (seatIdx) {
        setTimeout(function () {
          if (token !== self._token || !self._game || !self._game.interceptOpen) return;
          var card = self._game.players[seatIdx].hand.find(function (c) { return self._game.canIntercept(seatIdx, c); });
          if (!card) return;
          var color = card.kind === 'wild' ? OINK.bots.pickColor({}, self._game.rng) : undefined;
          try { self._game.interceptCard(seatIdx, card.id, color); } catch (err) { /* another player was faster */ }
        }, 350 + Math.random() * 500);
      })(idx);
    }
  };

  /* ---------- input ---------- */

  OinkUI.prototype._tryPlay = function (cardId, cardDiv) {
    if (!this._game || this._game.drawn) return;
    var st = this._game.getState();
    var card = null;
    for (var i = 0; i < st.players[0].hand.length; i++) {
      if (st.players[0].hand[i].id === cardId) { card = st.players[0].hand[i]; break; }
    }
    if (!card) return;
    var intercept = !this._humanTurn && this._game.canIntercept(0, card);
    if (!intercept && (!this._humanTurn || this._game.turn !== 0 || !this._game.canPlayCard(card))) {
      cardDiv.classList.add('shake');
      setTimeout(function () { cardDiv.classList.remove('shake'); }, 400);
      return;
    }
    var self = this;
    var play = function (color) {
      try {
        if (intercept) self._game.interceptCard(0, cardId, color);
        else self._game.playCard(0, cardId, color);
      } catch (e) { console.error(e); }
    };
    if (card.kind === 'wild') {
      this._showColorPicker().then(function (color) {
        if (!color) return;
        play(color);
      });
    } else {
      play(undefined);
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
        '<div class="count">8</div>';
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
      var shown = Math.min(n, 8);
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
      if ((this._humanTurn && st.turn === 0 && this._game.canPlayCard(sorted[i])) || this._game.canIntercept(0, sorted[i])) playableIds[sorted[i].id] = true;
    }
    hand.classList.toggle('many', sorted.length > 8);
    for (var j = 0; j < sorted.length; j++) {
      var d = cardEl(sorted[j]);
      d.dataset.id = sorted[j].id;
      if (playableIds[sorted[j].id]) d.classList.add('playable');
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
    var self = this, token = this._token;
    return new Promise(function (resolve) {
      var root = self._overlay();
      var box = el('div', 'hush');
      box.innerHTML =
        '<div class="hush-inner">' +
        '<div class="hush-icon">' + ICONS.hush + '</div>' +
        '<h2>SHHH&hellip;</h2>' +
        '<p>Don\u2019t click, tap, or press a key for 4 seconds!</p>' +
        '<div class="ring"><div class="ring-fill"></div></div>' +
        '</div>';
      root.appendChild(box);

      var done = false;
      function finish(offender) {
        if (done) return;
        done = true;
        clearInterval(iv);
        document.removeEventListener('keydown', onKey, true);
        box.classList.add('gone');
        setTimeout(function () { if (token === self._token && root.contains(box)) self._closeOverlay(); }, 200);
        try { if (token === self._token && self._game) self._game.resolveHush(offender); } catch (e) { console.error(e); }
        resolve();
      }
      function onKey(ev) { ev.preventDefault(); finish(0); }
      var iv = setInterval(function () {
        var pct = Math.max(0, 100 - ((Date.now() - t0) / duration) * 100);
        box.querySelector('.ring-fill').style.height = pct + '%';
        if (Date.now() - t0 >= duration) {
          var botOops = self._game && self._game.rng() < .28;
          finish(botOops ? 1 + Math.floor(self._game.rng() * (self._game.players.length - 1)) : false);
        }
      }, 50);
      var t0 = Date.now();
      box.addEventListener('pointerdown', function () { finish(0); });
      document.addEventListener('keydown', onKey, true);

      // Bots lean in and twitch; one may also fumble the quiet challenge.
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

  OinkUI.prototype._showSlap = function () {
    var self = this, token = this._token;
    return new Promise(function (resolve) {
      var root = self._overlay();
      var box = el('div', 'slap-challenge');
      box.innerHTML = '<div class="slap-inner"><div class="slap-art">' + ICONS.slap + '</div>' +
        '<h2>HOOF SLAP!</h2>' +
        '<p>Pick a move. No timer — the bots choose in secret.</p>' +
        '<div class="slap-rules">Slap beats Grab <span>•</span> Grab beats Dodge <span>•</span> Dodge beats Slap</div>' +
        '<div class="slap-choices">' +
          '<button type="button" data-choice="slap">✋<span>SLAP</span></button>' +
          '<button type="button" data-choice="dodge">↪<span>DODGE</span></button>' +
          '<button type="button" data-choice="grab">✊<span>GRAB</span></button>' +
        '</div>' +
        '<p class="slap-note">Losing moves take 2 cards. All same or all three? No penalty.</p>' +
        '<div class="slap-reveal" aria-live="polite"></div></div>';
      root.appendChild(box);
      box.querySelector('[data-choice="slap"]').focus();
      var botChoices = [];
      for (var i = 1; i < self._game.players.length; i++) {
        botChoices.push(RULES.SLAP_CHOICES[Math.floor(self._game.rng() * RULES.SLAP_CHOICES.length)]);
      }
      var done = false;
      box.querySelector('.slap-choices').addEventListener('click', function (ev) {
        var button = ev.target.closest('button[data-choice]');
        if (!button || done || token !== self._token || !self._game) return;
        done = true;
        var choices = [button.dataset.choice].concat(botChoices);
        var result;
        try { result = self._game.resolveSlap(choices); }
        catch (e) { console.error(e); self._closeOverlay(); resolve(); return; }
        var reveal = box.querySelector('.slap-reveal');
        reveal.innerHTML = choices.map(function (choice, idx) {
          var name = idx === 0 ? 'You' : self._game.players[idx].name;
          return '<div class="slap-result' + (result.losers.indexOf(idx) >= 0 ? ' lost' : '') + '"><b>' + name + '</b><span>' + choice.toUpperCase() + '</span></div>';
        }).join('') + '<strong>' + (result.losers.length ? 'Losing move: +2 cards' : 'Tie — no penalty!') + '</strong>';
        box.classList.add('revealed');
        setTimeout(function () {
          if (token === self._token) self._closeOverlay();
          resolve();
        }, 1800);
      });
    });
  };

  OinkUI.prototype._showOinkButton = function (duration) {
    var self = this;
    var btn = $('#btn-oink');
    btn.hidden = false;
    btn.classList.add('pulse');
    clearInterval(this._oinkTimer);
    if (!duration) { btn.style.setProperty('--p', '100'); return; }
    var t0 = Date.now();
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
        '<td>' + (i === e.winner ? '+' + e.roundScore + ' pts' : '') + '</td></tr>';
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
      ['skip', 'reverse', 'draw3', 'hush', 'slap', 'wild'].map(function (k) {
        var desc = {
          skip: 'Next player loses a turn',
          reverse: 'Flips the direction of play',
          draw3: 'Next player takes 3 or passes the growing penalty on',
          hush: 'No clicks, taps, or keys for 4 seconds or take 2',
          slap: 'Secretly choose Slap, Dodge or Grab; losing moves take 2 cards',
          wild: 'Play anytime and choose the next color'
        }[k];
        var name = k === 'wild' ? C.WILDS.wild.name : C.EFFECTS[k].name;
        var sample = k === 'wild'
          ? cardEl({ id: 'x', kind: 'wild', color: null, effect: k })
          : cardEl({ id: 'x', kind: 'action', color: 'red', effect: k });
        return '<div class="gloss">' + sample.outerHTML + '<div class="gloss-txt"><b>' + name + '</b><span>' + desc + '</span></div></div>';
      }).join('');

    box.innerHTML =
      '<h2>How to play</h2>' +
      '<ul class="rules-list">' +
      '<li>Start with 8 cards. Dump them all first to win.</li>' +
      '<li>On your turn, match the top card by <b>color</b>, <b>number</b> or <b>symbol</b>.</li>' +
      '<li>No match? Click or tap the deck to draw one card \u2014 if it plays, you may play it right away.</li>' +
      '<li>Two cards left? Call <b>OINK!</b> before playing one. Miss it and draw 3.</li>' +
      '<li>Have an identical card? Click or tap it out of turn to intercept.</li>' +
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
