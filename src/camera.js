import {mat4, vec3} from "gl-matrix";

export default class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.w = 8;
    this.h = 4;
  }

  move(x, y) {
    this.x = x;
    this.y = y;
  }

  get_x() {
    return this.x;
  }

  get_y() {
    return this.y;
  }

  size() {
    return Math.max(this.w, this.h);
  }

  get_proj(/** @type {WebGL2RenderingContext} */ gl) {
    let proj = mat4.create();
    if (gl.canvas.width / gl.canvas.height >= 4/3) {
      this.w = 8;
      this.h = (gl.canvas.height / gl.canvas.width) * this.w;
    }
    else {
      this.h = 6;
      this.w = (gl.canvas.width / gl.canvas.height) * this.h;
    }
    mat4.ortho(proj, -this.w, this.w, -this.h, this.h, 0, 100);
    return proj;
  }

  get_view() {
    let view = mat4.create();
    mat4.translate(view, view, vec3.fromValues(this.x, this.y, 0));
    mat4.scale(view, view, vec3.fromValues(this.scale, this.scale, 1));
    mat4.invert(view, view);
    return view;
  }
}
