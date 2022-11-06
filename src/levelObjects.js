import Renderer from "./renderer";
import { Level } from "./level";

export class DroppedCoin {
  constructor(x, y) {
    let angle = Math.random() * (Math.PI / 4);
    this.type = "c";
    this.x = x;
    this.y = y;
    this.size = 0.9;
    this.vx = Math.cos(angle) * 0.14;
    if (Math.random() < 0.5) this.vx *= -1;
    this.vy = Math.sin(angle) * 0.2;
    this.fOff = Math.floor(Math.random() * 4);
    this.iframes = 60;
  }

  playCollectAnim() {
    this.type = "cc";
    this.iframes = Math.random() * 20 + 20;
    this.animLen = this.iframes;
  }

  tick(/** @type {Level} */ l) {
    // Dampen x velocity
    if (Math.abs(this.vx) > 0.005) {
      if (l.is_colliding(this.x, this.y - 0.1, this.size, this.size)) {
        this.vx -= Math.random() * Math.sign(this.vx) * 0.01;
        if (l.is_colliding(this.x + Math.sign(this.vx) * 0.1, this.y, this.size, this.size))
          this.vx *= -1;
      }
    }
    else
      this.vx = 0;
    
    this.vy -= 0.02;
    if (l.is_colliding(this.x, this.y - 0.1, this.size, this.size) && this.vy < -0.1) {
      this.vy = Math.abs(this.vy) * 0.9;
      if (this.vy <= 0.1) this.vy = 0;
    }
    if (this.iframes > 0) this.iframes--;

    if (this.y < 0) return false;
    if (this.type === "cc" && this.iframes-- <= 0) return false;

    let [x, y, vx, vy] = l.process_physics(this.x, this.y, this.vx, this.vy, this.size, this.size);
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    return true;
  }

  draw(/** @type {Renderer} */ r, gfxframe) {
    if (this.type == "c")
      r.draw("tex_coin", this.x, this.y, -0.1, 0, this.size, this.size, (Math.floor(gfxframe / 5) + this.fOff) % 4);
    else
      r.draw("tex_coin", this.x, this.y, -0.1, 0, this.size, this.size, 4 + Math.floor(this.iframes / this.animLen * 5));
    let rsize = Math.random()*0.5 + 3.75;
    r.draw("tex_light_yellow", this.x, this.y, 0.0, 0.0, rsize, rsize, Math.floor(Math.random() * 4));
  }
}

export function lvlObjectFromJSON(json) {
  if (json.type == "c" || json.type == "cc")
    Object.setPrototypeOf(json, DroppedCoin.prototype);
  return json;
}
