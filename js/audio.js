/*
 * Oink! — tiny WebAudio synth. No audio assets, no external requests
 * (CrazyGames requires self-contained media).
 */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ensure() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, opts) {
    opts = opts || {};
    var c = ensure();
    if (!c || !enabled) return;
    var t = c.currentTime;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + dur);
    var vol = (opts.vol == null ? 0.18 : opts.vol);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, opts) {
    opts = opts || {};
    var c = ensure();
    if (!c || !enabled) return;
    var t = c.currentTime;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var filter = c.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 1200, t);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    var gain = c.createGain();
    gain.gain.setValueAtTime(opts.vol == null ? 0.12 : opts.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
  }

  var SFX = {
    click:   function () { tone(700, 0.06, { type: 'triangle', vol: 0.08 }); },
    play:    function () { noise(0.1, { freq: 900, to: 2400 }); tone(340, 0.09, { type: 'triangle', to: 520, vol: 0.1 }); },
    draw:    function () { noise(0.12, { freq: 2000, to: 700, vol: 0.1 }); },
    turn:    function () { tone(660, 0.09, { type: 'sine', vol: 0.1 }); setTimeout(function () { tone(880, 0.12, { type: 'sine', vol: 0.1 }); }, 90); },
    oink:    function () { tone(180, 0.12, { type: 'square', to: 420, vol: 0.09 }); setTimeout(function () { tone(400, 0.16, { type: 'square', to: 130, vol: 0.09 }); }, 110); },
    fail:    function () { tone(300, 0.3, { type: 'sawtooth', to: 110, vol: 0.09 }); },
    penalty: function () { tone(150, 0.18, { type: 'sawtooth', to: 80, vol: 0.12 }); },
    shush:   function () { noise(0.5, { type: 'lowpass', freq: 800, to: 200, vol: 0.1 }); },
    swap:    function () { tone(500, 0.08, { type: 'sine', to: 700 }); setTimeout(function () { tone(700, 0.08, { type: 'sine', to: 500 }); }, 80); },
    win:     function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        (function (f, d) { setTimeout(function () { tone(f, 0.18, { type: 'triangle', vol: 0.12 }); }, d); })(notes[i], i * 130);
      }
    },
    lose:    function () { tone(400, 0.25, { type: 'triangle', to: 200, vol: 0.1 }); }
  };

  global.OINK = global.OINK || {};
  global.OINK.audio = {
    play: function (name) { if (SFX[name]) { try { SFX[name](); } catch (e) { /* audio is best-effort */ } } },
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    unlock: ensure
  };
})(typeof window !== 'undefined' ? window : globalThis);
