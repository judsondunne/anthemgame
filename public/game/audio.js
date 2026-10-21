"use strict";
const AudioGarden = {
  ctx: null,
  muted: false,
  started: false,
  tracks: [],
  urls: [],
  index: 0,
  player: new Audio(),
  timer: null,
  async start() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.gain.value =
        typeof YouTubeGarden !== "undefined" && YouTubeGarden.playing ? 0 : 1;
      this.music.connect(this.master);
      this.ambience();
      this.phrase = 0;
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 7000);
    }
    await this.ctx.resume();
    this.started = true;
    if (this.tracks.length && !this.muted) {
      this.player.play().catch(() => {});
    }
  },
  note(freq, when, duration, volume = 0.12, dest = this.music) {
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(volume, when + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + duration + 0.1);
    const overtone = this.ctx.createOscillator(),
      og = this.ctx.createGain();
    overtone.frequency.value = freq * 2;
    og.gain.setValueAtTime(volume * 0.12, when);
    og.gain.exponentialRampToValueAtTime(0.0001, when + duration * 0.6);
    overtone.connect(og);
    og.connect(dest);
    overtone.start(when);
    overtone.stop(when + duration);
  },
  schedule() {
    if (!this.ctx || document.hidden) return;
    let chords = [
        [146.83, 220, 293.66, 369.99],
        [130.81, 196, 261.63, 329.63],
        [164.81, 246.94, 329.63, 392],
        [110, 164.81, 220, 329.63],
      ],
      chord = chords[this.phrase++ % 4],
      t = this.ctx.currentTime + 0.08;
    chord.forEach((f, i) => {
      this.note(f, t + i * 0.55, 6, 0.07);
      this.note(f * 2, t + 3 + i * 0.6, 3, 0.025);
    });
  },
  ambience() {
    let b = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate * 4,
        this.ctx.sampleRate,
      ),
      a = b.getChannelData(0),
      last = 0;
    for (let i = 0; i < a.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      a[i] = last * 3;
    }
    let src = this.ctx.createBufferSource();
    src.buffer = b;
    src.loop = true;
    let filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    let g = this.ctx.createGain();
    g.gain.value = 0.12;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  },
  goose(pan = 0) {
    if (!this.ctx || this.muted || document.hidden || !world.started) return;
    const c = this.ctx,
      t = c.currentTime,
      duration = 0.68;
    const out = c.createGain(),
      stereo = c.createStereoPanner();
    stereo.pan.value = pan;
    out.connect(stereo);
    stereo.connect(this.master);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.065, t + 0.13);
    out.gain.setTargetAtTime(0.035, t + 0.24, 0.09);
    out.gain.setTargetAtTime(0, t + 0.42, 0.07);
    // Breathy nasal harmonics, rounded attack and a falling distant call.
    const base = 190 + Math.random() * 35;
    for (let h = 1; h <= 9; h++) {
      const o = c.createOscillator(),
        g = c.createGain();
      o.frequency.setValueAtTime(base * h * 0.88, t);
      o.frequency.exponentialRampToValueAtTime(base * h * 1.12, t + 0.17);
      o.frequency.exponentialRampToValueAtTime(base * h * 0.78, t + duration);
      g.gain.value = [
        0, 0.24, 0.35, 0.27, 0.17, 0.12, 0.07, 0.04, 0.025, 0.012,
      ][h];
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + duration + 0.2);
    }
    setTimeout(() => {
      out.disconnect();
      stereo.disconnect();
    }, 1300);
  },
  chime() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99].forEach((f, i) =>
      this.note(f, this.ctx.currentTime + i * 0.09, 1.6, 0.12, this.master),
    );
  },
  // Soft one-shot cues for the economy layer; all route through the master gain.
  blip(freqs, gap, duration, volume) {
    if (!this.ctx || this.muted || document.hidden) return;
    const t = this.ctx.currentTime;
    freqs.forEach((f, i) => this.note(f, t + i * gap, duration, volume, this.master));
  },
  coin() {
    this.blip([1318.5, 1760], 0.06, 0.45, 0.05);
  },
  pop() {
    this.blip([659.25, 987.77], 0.05, 0.35, 0.045);
  },
  soft() {
    this.blip([220, 196], 0.08, 0.3, 0.05);
  },
  fanfare() {
    this.blip([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.11, 1.8, 0.075);
  },
  lightClick() { this.blip([260, 350], .025, .06, .018); },
  wolfHowl(volume=1) {
    if(!this.ctx||this.muted||document.hidden)return;
    const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
    o.type='triangle';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(420,t+.65);o.frequency.exponentialRampToValueAtTime(240,t+2.2);f.type='lowpass';f.frequency.value=950;
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.09*volume,t+.4);g.gain.exponentialRampToValueAtTime(.0001,t+2.6);o.connect(f);f.connect(g);g.connect(this.master);o.start();o.stop(t+2.7);
  },
  wolfYelp() { this.blip([520, 720, 340], .07, .3, .04); },
  wolfJump() {
    if(!this.ctx||this.muted||document.hidden)return;
    const c=this.ctx,t=c.currentTime,src=c.createBufferSource(),b=c.createBuffer(1,c.sampleRate*.35,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    src.buffer=b;const f=c.createBiquadFilter(),g=c.createGain();f.type='lowpass';f.frequency.setValueAtTime(2600,t);f.frequency.exponentialRampToValueAtTime(240,t+.3);g.gain.value=.38;src.connect(f);f.connect(g);g.connect(this.master);src.start();
    this.blip([92,65],.06,.4,.16);
  },
  danger() { this.blip([155,146,110],.12,.9,.08); },
  splash(volume=.6) {
    if(!this.ctx||this.muted||document.hidden)return;
    const c=this.ctx,t=c.currentTime,b=c.createBuffer(1,c.sampleRate*.28,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    src.buffer=b;f.type='lowpass';f.frequency.setValueAtTime(1800,t);f.frequency.exponentialRampToValueAtTime(260,t+.28);g.gain.value=.08*volume;
    src.connect(f);f.connect(g);g.connect(this.master);src.start(t);
  },
  worldAmbience(night,waterDistance,fp) {
    if(!this.ctx||this.muted||document.hidden)return;
    const c=this.ctx,t=c.currentTime;
    const player=window.Garden?.cameraControl?.player;
    if(fp&&player&&Math.hypot(player.vx,player.vz)>.6&&t>(this.nextStep??0)){
      this.nextStep=t+(Math.hypot(player.vx,player.vz)>4?.27:.43);
      if(player.wading||player.swimming)this.splash(.22);else this.note(105,t,.075,.025,this.master);
    }
    if(!this.brookGain){const b=c.createBuffer(1,c.sampleRate*3,c.sampleRate),d=b.getChannelData(0);let brown=0;for(let i=0;i<d.length;i++){brown=(brown+(Math.random()*2-1)*.04)/1.025;d[i]=brown;}const src=c.createBufferSource();src.buffer=b;src.loop=true;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1100;filter.Q.value=.55;this.brookGain=c.createGain();this.brookGain.gain.value=0;src.connect(filter);filter.connect(this.brookGain);this.brookGain.connect(this.master);src.start();this.nextForestCall=0;}
    this.brookGain.gain.setTargetAtTime(Math.max(0,.5-Math.max(0,waterDistance)*.04)*(fp?1:.35),t,.8);
    if(t>this.nextForestCall){this.nextForestCall=t+3+Math.random()*6;if(night>.5){this.blip([880,940,880],.09,.22,.012);if(Math.random()<.13)this.blip([310,280],.3,.6,.016);}else this.blip([1800,2400,2100],.07,.13,.016);}
  },
  toggle() {
    this.muted = !this.muted;
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.22,
        this.ctx.currentTime,
        0.15,
      );
    this.player.muted = this.muted;
    document
      .querySelector("#sound")
      .setAttribute("aria-pressed", String(this.muted));
    document
      .querySelector("#sound")
      .setAttribute(
        "aria-label",
        this.muted ? "Unmute garden audio" : "Mute garden audio",
      );
    document.querySelector("#waves").style.opacity = this.muted ? 0.2 : 1;
  },
  async load(files) {
    this.player.pause();
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.tracks = [...files]
      .filter(
        (f) =>
          f.type.startsWith("audio/") ||
          /\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(f.name),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
    this.urls = this.tracks.map((f) => URL.createObjectURL(f));
    this.index = 0;
    if (!this.urls.length) return;
    await this.start();
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
    this.player.volume = 0.4;
    this.player.muted = this.muted;
    this.player.src = this.urls[0];
    try {
      await this.player.play();
    } catch {
      this.music.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
    }
  },
  visibility() {
    if (!this.ctx) return;
    if (document.hidden) {
      this.ctx.suspend();
      this.player.pause();
    } else {
      this.ctx.resume();
      if (this.tracks.length && !this.muted) this.player.play().catch(() => {});
    }
  },
};
AudioGarden.player.addEventListener("ended", () => {
  AudioGarden.index = (AudioGarden.index + 1) % AudioGarden.urls.length;
  AudioGarden.player.src = AudioGarden.urls[AudioGarden.index];
  AudioGarden.player.play().catch(() => {});
});
AudioGarden.player.addEventListener("error", () => {
  if (AudioGarden.ctx)
    AudioGarden.music.gain.setTargetAtTime(1, AudioGarden.ctx.currentTime, 0.4);
});
