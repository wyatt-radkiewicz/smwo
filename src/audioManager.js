import { browserType } from "./browser";

export default class AudioManager {
  constructor() {
    this.ctx = new AudioContext();
  }

  load_content() {
    this.tracks = {};
    this.currentMus = null;
    
    if (this.ctx.state === "suspended")
      this.ctx.resume();

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.6;

    Array.prototype.slice.call(document.getElementsByTagName("audio")).forEach((/** @type {HTMLMediaElement} */ tag) => {
      this.tracks[tag.id] = {};
      this.tracks[tag.id].track = this.ctx.createMediaElementSource(tag);
      if (tag.id.slice(0, 3) == "mus") {
        this.tracks[tag.id].track.connect(this.musicGain).connect(this.ctx.destination);
      }
      else {
        this.tracks[tag.id].track.connect(this.ctx.destination);
      }
      this.tracks[tag.id].elem = tag;
    });
  }

  play(track, loop) {
    this.tracks[track].elem.currentTime = 0;
    this.tracks[track].elem.loop = loop;
    this.tracks[track].elem.play().then(() => {});
  }

  play_music(track) {
    if (this.currentMus != null) {
      if (track != null && this.currentMus == this.tracks[track]) return;
      this.currentMus.elem.pause();
    }
    setTimeout(() => {
      if (this.currentMus != null) {
        if (track != null && this.currentMus == this.tracks[track]) return;
        this.currentMus.elem.pause();
      }
      if (track != null) {
        this.play(track, true);
        this.currentMus = this.tracks[track];
      }
      else {
        this.currentMus = null;
      }
    }, 100);
  }
}
