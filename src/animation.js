export default class Animation {
  constructor() {
    this.anim = 0;
    this.frame = 0;
    this.frames = 0;
    this.animations = [];
    for (let i = 0; i < arguments.length; i++) {
      this.animations.push(arguments[i]);
    }
  }

  set_anim(id) {
    this.anim = id;
  }

  set_speed(id, speed) {
    this.animations[id][2] = Math.floor(speed);
  }

  step() {
    this.frames++;
    if (this.frames % this.animations[this.anim][2] == 0) this.frame++;
    if (this.frame >= this.animations[this.anim][0]+this.animations[this.anim][1])
      this.frame = this.animations[this.anim][0];
    if (this.frame < this.animations[this.anim][0])
      this.frame = this.animations[this.anim][0];
  }

  get_frame() {
    return this.frame;
  }
}
