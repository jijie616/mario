/* ============================================================
   SUPER MARIO · HTML5 — Web Audio chiptune engine
   All sound is synthesized at runtime. No audio files needed.
   ============================================================ */

(function () {
  "use strict";

  const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
  const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const noteCache = Object.create(null);

  function noteToHz(note) {
    if (!note) return 0;
    if (noteCache[note]) return noteCache[note];
    const m = NOTE_RE.exec(note);
    if (!m) return 0;
    let semitone = SEMITONES[m[1]];
    if (m[2] === "#") semitone += 1;
    if (m[2] === "b") semitone -= 1;
    const midi = (parseInt(m[3], 10) + 1) * 12 + semitone;
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    noteCache[note] = hz;
    return hz;
  }

  const TRACKS = {
    overworld: {
      bpm: 148,
      swing: 0.012,
      leadType: "square",
      lead: [
        "E5", "G5", "A5", "G5", "E5", null, "C5", null,
        "D5", "E5", "F5", "A5", "G5", null, "E5", null,
        "F5", "A5", "C6", "A5", "G5", "E5", "D5", null,
        "C5", "D5", "E5", "G5", "E5", null, "C5", null,
      ],
      bass: [
        "C3", null, "G3", null, "C3", null, "E3", null,
        "D3", null, "A3", null, "G3", null, "D3", null,
        "F3", null, "C4", null, "C3", null, "G3", null,
        "F3", null, "G3", null, "C3", null, "G3", null,
      ],
      drums: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 2, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 2, 2, 2],
    },
    underground: {
      bpm: 112,
      swing: 0,
      leadType: "square",
      lead: [
        "A4", null, "C5", null, "E5", null, "D5", null,
        "B4", null, "G4", null, "A4", null, null, null,
        "E4", null, "A4", null, "C5", null, "B4", null,
        "G4", null, "E4", null, "A4", null, null, null,
        "F4", null, "A4", null, "C5", null, "E5", null,
        "D5", null, "B4", null, "G4", null, null, null,
        "E4", "G4", "A4", "C5", "B4", "G4", "E4", "D4",
        "A4", null, null, null, null, null, null, null,
      ],
      bass: [
        "A2", null, null, null, "A2", null, "E2", null,
        "G2", null, null, null, "G2", null, "D2", null,
        "F2", null, null, null, "F2", null, "C3", null,
        "E2", null, null, null, "E2", null, "G2", null,
      ],
      drums: [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 3, 0],
      echo: true,
    },
    night: {
      bpm: 158,
      swing: 0.008,
      leadType: "triangle",
      lead: [
        "D5", "F#5", "A5", "F#5", "E5", "D5", "B4", null,
        "E5", "G5", "B5", "G5", "F#5", "E5", "D5", null,
        "F#5", "A5", "D6", "A5", "G5", "F#5", "E5", null,
        "D5", "B4", "G4", "B4", "D5", null, "A4", null,
      ],
      bass: [
        "D3", null, "A3", null, "D3", null, "F#3", null,
        "E3", null, "B3", null, "E3", null, "G3", null,
        "D3", null, "A3", null, "B3", null, "F#3", null,
        "G3", null, "D3", null, "A3", null, "A2", null,
      ],
      drums: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 2, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 2, 3, 0],
    },
    star: {
      bpm: 208,
      swing: 0,
      leadType: "square",
      lead: [
        "C5", "E5", "G5", "C6", "E6", "C6", "G5", "E5",
        "D5", "F#5", "A5", "D6", "F#6", "D6", "A5", "F#5",
        "E5", "G#5", "B5", "E6", "G#6", "E6", "B5", "G#5",
        "F5", "A5", "C6", "F6", "A6", "F6", "C6", "A5",
      ],
      bass: [
        "C3", null, "G3", null, "C3", null, "G3", null,
        "D3", null, "A3", null, "D3", null, "A3", null,
        "E3", null, "B3", null, "E3", null, "B3", null,
        "F3", null, "C4", null, "F3", null, "C4", null,
      ],
      drums: [1, 2, 2, 2, 1, 0, 2, 0, 1, 2, 2, 2, 1, 0, 2, 0, 1, 2, 2, 2, 1, 0, 2, 0, 1, 2, 2, 2, 1, 0, 2, 0],
    },
  };

  class AudioEngine {
    constructor() {
      this.ac = null;
      this.master = null;
      this.sfxBus = null;
      this.musicBus = null;
      this.noiseBuffer = null;
      this.muted = false;
      this.desiredTrack = null;
      this.currentTrackName = null;
      this.starMode = false;
      this.musicPaused = false;
      this.timer = null;
      this.stepIndex = 0;
      this.nextStepTime = 0;
      this.stepDuration = 0;
      this.track = null;
      this.initialized = false;

      try {
        this.muted = window.localStorage.getItem("mario-muted") === "1";
      } catch (err) {
        this.muted = false;
      }
    }

    init() {
      if (this.initialized) {
        if (this.ac && this.ac.state === "suspended") {
          this.ac.resume().catch(() => {});
        }
        return;
      }

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        this.initialized = true;
        this.unsupported = true;
        return;
      }

      try {
        this.ac = new Ctx();
        this.master = this.ac.createGain();
        this.master.gain.value = this.muted ? 0 : 0.58;
        this.master.connect(this.ac.destination);

        this.sfxBus = this.ac.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(this.master);

        this.musicBus = this.ac.createGain();
        this.musicBus.gain.value = 0.7;
        this.musicBus.connect(this.master);

        this.noiseBuffer = this._createNoiseBuffer();
        this.initialized = true;

        if (this.ac.state === "suspended") {
          this.ac.resume().catch(() => {});
        }
        if (this.desiredTrack && !this.musicPaused) {
          this._scheduleMusic();
        }
      } catch (err) {
        this.initialized = true;
        this.unsupported = true;
      }
    }

    _createNoiseBuffer() {
      const length = Math.floor(this.ac.sampleRate * 0.5);
      const buffer = this.ac.createBuffer(1, length, this.ac.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = 0.8 * last + 0.2 * white;
        data[i] = last;
      }
      return buffer;
    }

    setMuted(value) {
      this.muted = Boolean(value);
      try {
        window.localStorage.setItem("mario-muted", this.muted ? "1" : "0");
      } catch (err) {
        /* localStorage may be unavailable under file:// in some browsers. */
      }
      if (this.master && this.ac) {
        const now = this.ac.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(this.master.gain.value, now);
        this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.58, now + 0.08);
      }
      return this.muted;
    }

    toggleMute() {
      return this.setMuted(!this.muted);
    }

    _tone(freq, when, duration, options) {
      if (!this.ac || !freq) return;
      const opts = options || {};
      const osc = this.ac.createOscillator();
      const gain = this.ac.createGain();
      const destination = opts.music ? this.musicBus : this.sfxBus;
      const volume = Math.max(0.0001, opts.volume == null ? 0.07 : opts.volume);
      const attack = opts.attack == null ? 0.004 : opts.attack;

      osc.type = opts.type || "square";
      osc.frequency.setValueAtTime(Math.max(20, freq), when);

      if (opts.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), when + duration);
      }

      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + Math.min(attack, duration * 0.4));
      gain.gain.setValueAtTime(volume, when + Math.max(attack, duration * 0.35));
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(when);
      osc.stop(when + duration + 0.03);
    }

    _noise(when, duration, options) {
      if (!this.ac || !this.noiseBuffer) return;
      const opts = options || {};
      const source = this.ac.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = this.ac.createBiquadFilter();
      filter.type = opts.filterType || "highpass";
      filter.frequency.value = opts.frequency || 4000;
      filter.Q.value = opts.q || 0.7;
      const gain = this.ac.createGain();
      const volume = opts.volume == null ? 0.05 : opts.volume;

      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(opts.music ? this.musicBus : this.sfxBus);
      source.start(when);
      source.stop(when + duration + 0.02);
    }

    _sfxNow() {
      return this.ac ? this.ac.currentTime + 0.006 : 0;
    }

    play(name) {
      if (!this.initialized) this.init();
      if (!this.ac || this.muted) return;
      const t = this._sfxNow();

      switch (name) {
        case "jump":
          this._tone(310, t, 0.16, { type: "square", volume: 0.055, slideTo: 660, attack: 0.003 });
          this._tone(620, t + 0.025, 0.08, { type: "triangle", volume: 0.025, slideTo: 880 });
          break;
        case "bigJump":
          this._tone(260, t, 0.19, { type: "square", volume: 0.06, slideTo: 720 });
          this._tone(520, t + 0.04, 0.1, { type: "triangle", volume: 0.03, slideTo: 1040 });
          break;
        case "coin":
          this._tone(987.77, t, 0.075, { type: "square", volume: 0.045 });
          this._tone(1318.51, t + 0.075, 0.36, { type: "square", volume: 0.045 });
          this._tone(1975.53, t + 0.078, 0.22, { type: "triangle", volume: 0.02 });
          break;
        case "stomp":
          this._tone(240, t, 0.09, { type: "square", volume: 0.055, slideTo: 75 });
          this._noise(t, 0.055, { frequency: 900, volume: 0.025, filterType: "lowpass" });
          break;
        case "kick":
          this._tone(150, t, 0.07, { type: "square", volume: 0.05, slideTo: 340 });
          this._noise(t, 0.04, { frequency: 1800, volume: 0.022 });
          break;
        case "bump":
          this._tone(160, t, 0.075, { type: "square", volume: 0.05, slideTo: 92 });
          break;
        case "break":
          this._noise(t, 0.16, { frequency: 1700, volume: 0.06 });
          this._tone(220, t, 0.12, { type: "square", volume: 0.045, slideTo: 55 });
          this._noise(t + 0.05, 0.1, { frequency: 3000, volume: 0.035 });
          break;
        case "powerupAppear":
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this._tone(f, t + i * 0.075, 0.085, { type: "square", volume: 0.032 });
          });
          break;
        case "powerup":
          [392, 523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
            this._tone(f, t + i * 0.055, 0.095, { type: "square", volume: 0.042 });
          });
          break;
        case "powerdown":
          [523.25, 392, 329.63, 261.63, 196].forEach((f, i) => {
            this._tone(f, t + i * 0.06, 0.13, { type: "square", volume: 0.04 });
          });
          break;
        case "fireball":
          this._noise(t, 0.09, { frequency: 2400, volume: 0.025 });
          this._tone(880, t, 0.11, { type: "square", volume: 0.03, slideTo: 180 });
          break;
        case "pipe":
          this._tone(220, t, 0.28, { type: "square", volume: 0.04, slideTo: 55 });
          break;
        case "1up":
          ["E5", "G5", "E6", "C6", "D6", "G6"].forEach((n, i) => {
            this._tone(noteToHz(n), t + i * 0.09, 0.13, { type: "square", volume: 0.042 });
          });
          break;
        case "flag":
          this._tone(523.25, t, 0.4, { type: "square", volume: 0.025, slideTo: 1046.5 });
          [659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
            this._tone(f, t + 0.16 + i * 0.1, 0.22, { type: "triangle", volume: 0.035 });
          });
          break;
        case "clear": {
          const seq = [
            "C5", "E5", "G5", "C6", "E6", "G6", "E6", "C6",
            "D5", "F5", "A5", "D6", "F6", "A6", "F6", "D6",
            "E5", "G5", "B5", "E6", "G6", "B6", "C7", "G6",
          ];
          seq.forEach((n, i) => {
            this._tone(noteToHz(n), t + i * 0.115, 0.2, { type: "square", volume: 0.04 });
            if (i % 4 === 0) {
              this._tone(noteToHz(n) / 2, t + i * 0.115, 0.28, { type: "triangle", volume: 0.035 });
            }
          });
          break;
        }
        case "gameover":
          ["C5", "G4", "E4", "A4", "B4", "A4", "G4", "E4"].forEach((n, i) => {
            this._tone(noteToHz(n), t + i * 0.2, 0.28, { type: "square", volume: 0.04 });
          });
          this._tone(noteToHz("C4"), t + 1.65, 0.9, { type: "triangle", volume: 0.055 });
          break;
        case "die": {
          const notes = ["B4", "F4", "F4", "E4", "D4", "C4", "E3", "C3"];
          notes.forEach((n, i) => {
            this._tone(noteToHz(n), t + i * 0.13, i > 5 ? 0.5 : 0.12, {
              type: "square",
              volume: 0.042,
              slideTo: i === notes.length - 1 ? noteToHz("C2") : undefined,
            });
          });
          break;
        }
        case "pause":
          this._tone(660, t, 0.07, { type: "square", volume: 0.035 });
          this._tone(440, t + 0.08, 0.09, { type: "square", volume: 0.032 });
          break;
        case "select":
          this._tone(660, t, 0.05, { type: "square", volume: 0.035 });
          this._tone(880, t + 0.06, 0.09, { type: "square", volume: 0.035 });
          break;
        case "tick":
          this._tone(1200, t, 0.025, { type: "square", volume: 0.018 });
          break;
        case "hurry":
          [880, 1175, 1568].forEach((f, i) => {
            this._tone(f, t + i * 0.05, 0.06, { type: "square", volume: 0.032 });
          });
          break;
        default:
          break;
      }
    }

    startMusic(name) {
      if (!this.initialized) this.init();
      if (!TRACKS[name]) return;
      this.desiredTrack = name;
      this.starMode = false;
      this.musicPaused = false;
      this._refreshMusic();
    }

    setStar(active) {
      if (!this.initialized) return;
      const next = Boolean(active);
      if (this.starMode === next) return;
      this.starMode = next;
      this._refreshMusic();
    }

    pauseMusic() {
      this.musicPaused = true;
      this._stopScheduler();
      this._rampMusicGain(0);
    }

    resumeMusic() {
      if (!this.desiredTrack) return;
      this.musicPaused = false;
      this._refreshMusic();
    }

    stopMusic() {
      this.desiredTrack = null;
      this.starMode = false;
      this.musicPaused = false;
      this._stopScheduler();
      this._rampMusicGain(0);
    }

    _refreshMusic() {
      if (!this.ac) return;
      if (!this.desiredTrack || this.musicPaused) {
        this._stopScheduler();
        this._rampMusicGain(0);
        return;
      }
      const name = this.starMode ? "star" : this.desiredTrack;
      if (this.currentTrackName === name && this.timer) {
        this._rampMusicGain(0.7);
        return;
      }
      this._startScheduler(name);
    }

    _rampMusicGain(value) {
      if (!this.musicBus || !this.ac) return;
      const now = this.ac.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, now);
      this.musicBus.gain.linearRampToValueAtTime(value, now + 0.09);
    }

    _stopScheduler() {
      if (this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
      this.currentTrackName = null;
    }

    _startScheduler(name) {
      const track = TRACKS[name];
      if (!track || !this.ac) return;
      this._stopScheduler();
      this.currentTrackName = name;
      this.track = track;
      this.stepDuration = 60 / track.bpm / 2;
      this.stepIndex = 0;
      this.nextStepTime = this.ac.currentTime + 0.06;
      this._rampMusicGain(0.7);

      const self = this;
      this.timer = window.setInterval(() => self._scheduleAhead(), 25);
      this._scheduleAhead();
    }

    _scheduleAhead() {
      if (!this.ac || !this.track) return;
      const horizon = this.ac.currentTime + 0.16;
      let guard = 0;

      while (this.nextStepTime < horizon && guard < 32) {
        this._scheduleStep(this.track, this.stepIndex, this.nextStepTime, this.stepDuration);
        this.nextStepTime += this.stepDuration;
        this.stepIndex = (this.stepIndex + 1) % (this.track.lead.length || 1);
        guard++;
      }
    }

    _scheduleStep(track, index, when, stepDur) {
      const leadPattern = track.lead;
      const bassPattern = track.bass;
      const drumPattern = track.drums;
      const leadNote = leadPattern[index % leadPattern.length];
      const bassNote = bassPattern[index % bassPattern.length];
      const swing = track.swing ? (index % 2 === 1 ? track.swing : 0) : 0;
      const t = when + swing;

      if (leadNote) {
        const hz = noteToHz(leadNote);
        this._tone(hz, t, stepDur * (track.bpm > 180 ? 0.58 : 0.78), {
          type: track.leadType || "square",
          volume: track.leadType === "triangle" ? 0.038 : 0.028,
          music: true,
          attack: 0.004,
        });
        if (track.echo) {
          this._tone(hz, t + stepDur * 1.5, stepDur * 0.8, {
            type: "triangle",
            volume: 0.013,
            music: true,
          });
        }
      }

      if (bassNote) {
        const hz = noteToHz(bassNote);
        this._tone(hz, t, stepDur * 1.7, {
          type: "triangle",
          volume: 0.035,
          music: true,
        });
        this._tone(hz * 0.5, t, stepDur * 1.8, {
          type: "sine",
          volume: 0.018,
          music: true,
        });
      }

      if (drumPattern) {
        const drum = drumPattern[index % drumPattern.length];
        if (drum === 1) {
          this._tone(105, t, 0.075, {
            type: "sine",
            volume: 0.055,
            slideTo: 48,
            music: true,
          });
        } else if (drum === 2) {
          this._noise(t, 0.032, {
            frequency: 7200,
            volume: 0.011,
            music: true,
            filterType: "highpass",
          });
        } else if (drum === 3) {
          this._noise(t, 0.15, {
            frequency: 1600,
            volume: 0.018,
            music: true,
            filterType: "bandpass",
          });
        }
      }
    }
  }

  window.Sound = new AudioEngine();
})();
