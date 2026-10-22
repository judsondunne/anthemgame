"use strict";
// Official album-audio uploads only. The player remains offscreen.
const ALBUM_SONGS = [
  "MyIF2A2CQa4",
  "2YYBk5cTt2s",
  "makCY8JSqgE",
  "gnCi_i92bZ8",
  "iHfr09egqVs",
  "Xu6pjU4D0a0",
  "r3xGsCx70n8",
  "8a_fS0_-UsY",
  "dB4ZTGUsfxY",
  "ySP25A2Rx3g",
  "N9qBsmZnB5w",
  "eA98xJByTzo",
  "yg7tTA1r9nw",
];
// One shuffled album queue per visit. Avoid repeating the previous visit's opener.
function shuffledAlbum(){const songs=[...ALBUM_SONGS];for(let i=songs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[songs[i],songs[j]]=[songs[j],songs[i]];}try{const last=localStorage.getItem('garden-album-last');if(songs[0]===last)[songs[0],songs[1]]=[songs[1],songs[0]];localStorage.setItem('garden-album-last',songs[0]);}catch{}return songs;}
const ALBUM_QUEUE=shuffledAlbum();
const YouTubeGarden = {
  player: null,
  loading: false,
  playing: false,
  failed: false,
  desired: false,
  ready: false,
  autoplayBlocked: false,
  prepare() {
    if (this.loading) return;
    this.loading = true;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => this.fallback();
    document.head.append(script);
  },
  start() {
    if (!world.started || !this.desired || AudioGarden.tracks.length) return;
    if (this.ready) {
      this.player.playVideo();
      return;
    }
    this.prepare();
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (!this.playing) this.fallback();
    }, 14000);
  },
  init() {
    const vars = {
      autoplay: 0,
      playsinline: 1,
      controls: 0,
      rel: 0,
      loop: 1,
    };
    if (location.protocol !== "file:") vars.origin = location.origin;
    this.player = new YT.Player("youtube-player", {
      videoId: ALBUM_QUEUE[0],
      width: 240,
      height: 135,
      playerVars: vars,
      events: {
        onReady: () => {
          this.ready = true;
          this.player.cuePlaylist(ALBUM_QUEUE, 0, 0);
          this.player.setLoop(true);
          this.player.setVolume(28);
          this.player
            .getIframe()
            .setAttribute("allow", "autoplay; encrypted-media");
          this.player.getIframe().setAttribute("tabindex", "-1");
          if (AudioGarden.muted) this.player.mute();
          if (
            world.started &&
            this.desired &&
            !document.hidden &&
            !AudioGarden.tracks.length
          )
            this.player.playVideo();
          else this.player.pauseVideo();
        },
        onStateChange: (e) => {
          this.playing = e.data === 1;
          if(e.data===5&&world.started&&this.desired&&!document.hidden&&!AudioGarden.tracks.length)this.player.playVideo();
          if (e.data === 1) {
            clearTimeout(this.timeout);
            this.failed = false;
            this.autoplayBlocked = false;
            this.player.setLoop(true);
            document.querySelector("#stream").dataset.state = "playing";
            if (AudioGarden.ctx)
              AudioGarden.music.gain.setTargetAtTime(
                0,
                AudioGarden.ctx.currentTime,
                1,
              );
            if (!this.desired || document.hidden || AudioGarden.tracks.length)
              this.player.pauseVideo();
          } else if (e.data === -1 || e.data === 2 || e.data === 0) {
            if (AudioGarden.ctx && !AudioGarden.tracks.length)
              AudioGarden.music.gain.setTargetAtTime(
                1,
                AudioGarden.ctx.currentTime,
                1,
              );
          }
        },
        onError: () => this.fallback(),
        onAutoplayBlocked: () => {
          this.autoplayBlocked = true;
          this.fallback();
        },
      },
    });
  },
  fallback() {
    this.failed = true;
    document.querySelector("#stream").dataset.state = "unavailable";
    document
      .querySelector("#stream")
      .setAttribute("aria-label", "Retry album music");
    if (AudioGarden.ctx && !AudioGarden.tracks.length)
      AudioGarden.music.gain.setTargetAtTime(
        1,
        AudioGarden.ctx.currentTime,
        0.5,
      );
  },
  mute() {
    if (!this.ready) return;
    AudioGarden.muted ? this.player.mute() : this.player.unMute();
  },
  pause() {
    if (this.ready) this.player.pauseVideo();
  },
  visibility() {
    if (document.hidden) this.pause();
    else if (this.desired && !AudioGarden.tracks.length) this.start();
  },
  panel() {
    this.desired = true;
    AudioGarden.tracks = [];
    AudioGarden.player.pause();
    this.start();
  },
  stopForLocal() {
    this.desired = false;
    this.pause();
    document.querySelector("#youtube-shell").classList.remove("open");
    document.querySelector("#stream").setAttribute("aria-expanded", "false");
  },
};
window.onYouTubeIframeAPIReady = () => YouTubeGarden.init();

// Prepare silently while the welcome card is visible. Continue is the playback gesture.
YouTubeGarden.prepare();
for (const event of ["pointerdown", "keydown"])
  document.addEventListener(
    event,
    () => {
      if (world.started && !YouTubeGarden.playing) YouTubeGarden.start();
    },
    { passive: true },
  );
