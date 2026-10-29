/* Retro sound engine: every sound is synthesised with the Web Audio API (no audio files).
 *   SFX.play('openFolder')      play a named sound         SFX.names()      list all names
 *   SFX.blip(characterId)       per-letter speech voice    SFX.jingle(userId)   login jingle (deterministic per user)
 *   SFX.startLoop('dance') / SFX.stopLoop('dance')         SFX.demo()       play everything (test from the console)
 *   SFX.configure({enabled:true, volume:70, typing:true})  volume is 0-100
 * To add a sound: add one entry to SOUNDS below. */
(function () {
  let ctx = null, master = null;
  const cfg = { enabled: true, volume: 70, typing: true, hover: true }, last = {}, loops = {};
  const MIN_GAP = { typing: 45, hover: 150, blip: 22 };            // ms between repeats (stops pile-ups)

  function ensure() {
    if (ctx) return ctx;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A(); master = ctx.createGain(); master.connect(ctx.destination); applyVolume();
    return ctx;
  }
  function applyVolume() { if (master) master.gain.value = cfg.enabled ? Math.pow(Math.max(0, Math.min(100, cfg.volume)) / 100, 1.6) * 0.5 : 0; }
  function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, unlock, { passive: true }));

  /* ---- building blocks ---- */
  function tone(o) {                                                 // one beep: {f, to, d, v, type, at}
    const t = ctx.currentTime + (o.at || 0), g = ctx.createGain(), osc = ctx.createOscillator(), v = o.v == null ? 0.3 : o.v;
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + o.d + 0.03);
  }
  function noise(o) {                                                // filtered noise burst: {f, to, d, v, ft, q, at}
    const t = ctx.currentTime + (o.at || 0), n = Math.max(1, Math.floor(ctx.sampleRate * o.d)), buf = ctx.createBuffer(1, n, ctx.sampleRate), a = buf.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.d); f.Q.value = o.q || 1;
    g.gain.setValueAtTime(o.v == null ? 0.2 : o.v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const seq = (type, freqs, step, d, v) => freqs.forEach((f, i) => tone({ type, f, d, v, at: i * step }));
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  /* ---- the sound table ---- */
  const SOUNDS = {
    openFolder:  () => { tone({ f: 220, to: 520, d: .13, v: .22 }); noise({ f: 1800, d: .03, v: .12, ft: 'highpass' }); },        // door-click sweep up
    openFile:    () => { tone({ type: 'triangle', f: 880, d: .04, v: .22 }); tone({ type: 'triangle', f: 1320, d: .06, v: .2, at: .045 }); }, // page tick
    openApp:     () => seq('square', [523, 659, 784], .08, .09, .2),                                                          // 3-note startup
    close:       () => tone({ f: 460, to: 170, d: .15, v: .22 }),                                                             // sweep down
    minimise:    () => tone({ type: 'sine', f: 640, to: 220, d: .09, v: .3 }),                                                // pop
    maximise:    () => { noise({ f: 300, to: 2600, d: .18, v: .22, q: 2 }); tone({ type: 'triangle', f: 330, to: 660, d: .14, v: .12 }); },
    restore:     () => { noise({ f: 2600, to: 300, d: .18, v: .22, q: 2 }); tone({ type: 'triangle', f: 660, to: 330, d: .14, v: .12 }); },
    typing:      () => { if (cfg.typing) tone({ f: 1100 + Math.random() * 500, d: .022, v: .07 }); },                          // soft key tick
    send:        () => tone({ type: 'triangle', f: 660, to: 1000, d: .1, v: .25 }),
    receive:     () => { tone({ type: 'sine', f: 880, d: .09, v: .28 }); tone({ type: 'sine', f: 1175, d: .14, v: .28, at: .09 }); }, // two-note ping
    vote:        () => { tone({ f: 988, d: .05, v: .2 }); tone({ f: 1319, d: .28, v: .2, at: .05 }); },                       // coin
    comment:     () => { tone({ type: 'triangle', f: 523, d: .07, v: .25 }); tone({ type: 'triangle', f: 659, d: .1, v: .25, at: .07 }); },
    uploadStart: () => seq('triangle', [392, 494, 587], .06, .07, .22),
    uploadDone:  () => seq('square', [523, 659, 784, 1047], .075, .1, .18),
    error:       () => { tone({ type: 'sawtooth', f: 160, to: 110, d: .16, v: .22 }); tone({ type: 'sawtooth', f: 160, to: 100, d: .2, v: .22, at: .19 }); },
    bell:        () => { tone({ type: 'sine', f: 1568, d: .55, v: .25 }); tone({ type: 'sine', f: 2093, d: .4, v: .15, at: .02 }); },
    pageSwitch:  () => tone({ f: 400, to: 640, d: .06, v: .18 }),
    hover:       () => { if (cfg.hover) tone({ type: 'sine', f: 1000, d: .025, v: .04 }); },                                  // very soft
    tap:         () => { tone({ f: 900, to: 1500, d: .06, v: .2 }); tone({ f: 1500, to: 1100, d: .06, v: .2, at: .06 }); },   // chibi squeak
    pickUp:      () => { for (let i = 0; i < 6; i++) tone({ type: 'triangle', f: 300 + i * 70 + (i % 2 ? 40 : -40), d: .05, v: .2, at: i * .045 }); }, // rising wobble
    throw:       () => noise({ f: 400, to: 3000, d: .26, v: .25, q: 1.5 }),
    land:        () => { tone({ type: 'sine', f: 130, to: 45, d: .14, v: .45 }); noise({ f: 300, d: .08, v: .2, ft: 'lowpass' }); },
    getUp:       () => { tone({ type: 'sine', f: 200, to: 520, d: .14, v: .3 }); tone({ type: 'sine', f: 520, to: 260, d: .14, v: .3, at: .14 }); }, // boing
    dance:       () => seq('square', [392, 494, 587, 494], .09, .1, .16)
  };

  /* ---- loops (dance beat) ---- */
  const LOOPS = { dance: i => { const b = i % 8;
    if (b % 4 === 0) { tone({ type: 'sine', f: 150, to: 45, d: .12, v: .35 }); }
    if (b % 2 === 1) { noise({ f: 6000, d: .04, v: .08, ft: 'highpass' }); }
    if (b === 0 || b === 5) { tone({ type: 'triangle', f: b ? 131 : 110, d: .2, v: .14 }); } } };

  const SFX = {
    configure(o) { Object.assign(cfg, o); applyVolume(); },
    unlock,
    names: () => Object.keys(SOUNDS),
    play(name) {
      if (!cfg.enabled || !SOUNDS[name] || !ensure()) return;
      const now = Date.now(), gap = MIN_GAP[name] == null ? 25 : MIN_GAP[name];
      if (last[name] && now - last[name] < gap) return;
      last[name] = now; if (ctx.state === 'suspended') return;     // browser still blocking audio until a tap
      try { SOUNDS[name](); } catch (e) { /* never let a sound break the app */ }
    },
    blip(id) {                                                       // each character gets its own voice
      if (!cfg.enabled || !ensure() || ctx.state === 'suspended') return;
      const h = hash(id), now = Date.now(); if (last.blip && now - last.blip < MIN_GAP.blip) return; last.blip = now;
      tone({ type: ['square', 'triangle', 'sawtooth'][h % 3], f: (260 + (h % 14) * 38) * (0.96 + Math.random() * 0.08), d: .03, v: .08 });
    },
    jingle(id) {                                                     // same user -> same jingle, every time
      if (!cfg.enabled || !ensure()) return; unlock();
      const h = hash(id), types = ['square', 'triangle', 'sawtooth', 'sine'], scales = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 4, 7, 11, 12]];
      const root = 196 * Math.pow(2, (h % 7) / 12), sc = scales[(h >> 3) % 4], n = 4 + ((h >> 6) % 2), type = types[(h >> 5) % 4];
      for (let i = 0; i < n; i++) {
        const deg = sc[(h >> (8 + i * 3)) % 5], oct = (h >> (20 + i)) & 1 ? 2 : 1;
        tone({ type, f: root * oct * Math.pow(2, deg / 12), d: i === n - 1 ? .35 : .11, v: .22, at: i * .11 });
      }
    },
    startLoop(name) {
      if (loops[name] || !LOOPS[name] || !ensure()) return; let i = 0;
      loops[name] = setInterval(() => { if (cfg.enabled && ctx.state === 'running') LOOPS[name](i++); }, 150);
    },
    stopLoop(name) { clearInterval(loops[name]); delete loops[name]; },
    demo() { SFX.names().forEach((n, i) => setTimeout(() => { console.log('sound:', n); SFX.play(n); }, i * 650)); }
  };
  window.SFX = SFX;
})();
