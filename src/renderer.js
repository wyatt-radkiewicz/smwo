import Shader from "./shader.js"
import Model from "./model.js"
import Texture from "./texture.js"
import Camera from "./camera.js"
import Framebuffer from "./framebuffer.js"

import {mat4, vec3} from "gl-matrix";

export default class Renderer {
  constructor(canvas) {
    /** @type {WebGL2RenderingContext} */
    this.gl = canvas.getContext("webgl2");

    // Abort if we cant initialize webgl2
    if (this.gl === null) {
      alert("Couldn't initialize WebGL2. You're browser might not support it!");
      return;
    }

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    this.camera = new Camera();

    this.gl.canvas.width = window.innerWidth;
    this.gl.canvas.height = window.innerHeight;
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  get_gl() {
    return this.gl;
  }

  get_camera() {
    return this.camera;
  }

  get_cam_coord_x(px) {
    px = (px / this.gl.canvas.width) * 2 - 1;
    px *= this.camera.w * this.camera.scale;
    px += this.camera.x;
    return px;
  }

  get_cam_coord_y(py) {
    py = (1 - (py / this.gl.canvas.height)) * 2 - 1;
    py *= this.camera.h * this.camera.scale;
    py += this.camera.y;
    return py;
  }

  get_texture(id) {
    return this.textures[id];
  }

  load_content() {
    let verticies = [
      -0.5001, 0.5001, 0.0, 0.0,
      0.5001, 0.5001, 1.0, 0.0,
      0.5001, -0.5001, 1.0, 1.0,
      -0.5001, -0.5001, 0.0, 1.0,
    ];
    let indicies = [
      0, 1, 2, 0, 2, 3
    ];

    this.normal_shader = new Shader(this.gl, "normal_vert", "normal_frag");
    this.palette_shader = new Shader(this.gl, "paletted_vert", "paletted_frag");
    this.framebuffer_shader = new Shader(this.gl, "framebuffer_vert", "framebuffer_normal");
    this.water_shader = new Shader(this.gl, "framebuffer_vert", "framebuffer_water");
    this.dark_shader = new Shader(this.gl, "framebuffer_vert", "framebuffer_dark");
    this.heat_shader = new Shader(this.gl, "framebuffer_vert", "framebuffer_heat");
    this.quad = new Model(this.gl, verticies, indicies, this.gl.STATIC_DRAW);
    this.framebuffer = new Framebuffer(this.gl, true, 1);
    this.framebuffer_light = new Framebuffer(this.gl, false, 1);

    this.inst_buf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.inst_buf);
    this.gl.bindVertexArray(this.quad.vao);

    this.gl.enableVertexAttribArray(2);
    this.gl.vertexAttribPointer(2, 4, this.gl.FLOAT, false, Float32Array.BYTES_PER_ELEMENT*(4*5+1), Float32Array.BYTES_PER_ELEMENT*4*0);
    this.gl.enableVertexAttribArray(3);
    this.gl.vertexAttribPointer(3, 4, this.gl.FLOAT, false, Float32Array.BYTES_PER_ELEMENT*(4*5+1), Float32Array.BYTES_PER_ELEMENT*4*1);
    this.gl.enableVertexAttribArray(4);
    this.gl.vertexAttribPointer(4, 4, this.gl.FLOAT, false, Float32Array.BYTES_PER_ELEMENT*(4*5+1), Float32Array.BYTES_PER_ELEMENT*4*2);
    this.gl.enableVertexAttribArray(5);
    this.gl.vertexAttribPointer(5, 4, this.gl.FLOAT, false, Float32Array.BYTES_PER_ELEMENT*(4*5+1), Float32Array.BYTES_PER_ELEMENT*4*3);
    this.gl.enableVertexAttribArray(6);
    this.gl.vertexAttribPointer(6, 4, this.gl.FLOAT, false, Float32Array.BYTES_PER_ELEMENT*(4*5+1), Float32Array.BYTES_PER_ELEMENT*4*4);
    this.gl.enableVertexAttribArray(7);
    this.gl.vertexAttribPointer(7, 1, this.gl.FLOAT, false, Float32Array.BYTES_PER_ELEMENT*(4*5+1), Float32Array.BYTES_PER_ELEMENT*4*5);

    this.gl.vertexAttribDivisor(2, 1);
    this.gl.vertexAttribDivisor(3, 1);
    this.gl.vertexAttribDivisor(4, 1);
    this.gl.vertexAttribDivisor(5, 1);
    this.gl.vertexAttribDivisor(6, 1);
    this.gl.vertexAttribDivisor(7, 1);

    this.gl.bindVertexArray(null);

    this.textures = {};
    Array.prototype.slice.call(document.getElementsByTagName("img")).forEach((/** @type {HTMLElement} */ tag) => {
      this.textures[tag.id] = {};
      this.textures[tag.id].tex = new Texture(this.gl, tag.id, tag.getAttribute("filter"));
      this.textures[tag.id].buf = [];
      this.textures[tag.id].buf_p = [];
      this.textures[tag.id].num_instances = 0;
      this.textures[tag.id].num_instances_p = 0;
      this.textures[tag.id].columns = parseInt(tag.getAttribute("c"));
      this.textures[tag.id].rows = parseInt(tag.getAttribute("r"));
    });

    // Create an event for when the canvas is resized
    window.onresize = () => {
      if (this.gl.canvas.width == window.innerWidth &&
          this.gl.canvas.height == window.innerHeight)
        return;
      this.gl.canvas.width = window.innerWidth;
      this.gl.canvas.height = window.innerHeight;
      this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
      this.framebuffer.resize(this.gl.canvas.width, this.gl.canvas.height);
      this.framebuffer_light.resize(this.gl.canvas.width, this.gl.canvas.height);
    };
  }

  clear(r, g, b) {
    this.framebuffer.use();

    this.gl.clearColor(r, g, b, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    for (let [key, value] of Object.entries(this.textures)) {
      value.buf = [];
      value.num_instances = 0;
      value.buf_p = [];
      value.num_instances_p = 0;
    };
  }

  get_uv_for_frame(tex, f) {
    let texture = this.textures[tex];
    let max_frames = texture.rows * texture.columns;
    f = f % max_frames;

    return [
      (f % texture.columns) / texture.columns + 0.002,
      Math.floor(f / texture.columns) / texture.rows + 0.002,
      1.0 / texture.columns - 0.002,
      1.0 / texture.rows - 0.004,
    ];
  }

  draw_text(x, y, z, s, centered, str) {
    this.draw_text_paletted(x, y, z, s, centered, 16, str);
  }

  draw_text_paletted(x, y, z, s, centered, pal, str) {
    if (centered) x -= (str.length*s)/2;
    for (let i = 0; i < str.length; i++) {
      let frame = str.charCodeAt(i);
      this.draw_paletted("tex_font", x+(i*s), y, z, 0, s, s, frame, pal);
    }
  }

  draw(tex, x, y, z, r, w, h, f) {
    let [u, v, uw, vw] = this.get_uv_for_frame(tex, f);
    this._draw(tex, x, y, z, r, w, h, u, v, uw, vw, -1);
  }

  draw_paletted(tex, x, y, z, r, w, h, f, p) {
    let [u, v, uw, vw] = this.get_uv_for_frame(tex, f);
    this._draw(tex, x, y, z, r, w, h, u, v, uw, vw, p);
  }

  present_sprites() {
    this.quad.use();
    this.normal_shader.use();
    this.normal_shader.set_mat4("uProj", this.camera.get_proj(this.gl));
    this.normal_shader.set_mat4("uView", this.camera.get_view());
    this.normal_shader.set_int("uTexture", 0);
    this.normal_shader.set_vec4("uColor", 1.0, 1.0, 1.0, 1.0);
    for (let [key, value] of Object.entries(this.textures)) {
      if (key.startsWith("tex_light")) continue;
      if (value.num_instances <= 0) continue;
      value.tex.use(0);
      let buf = new Float32Array(value.buf);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.inst_buf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, buf, this.gl.DYNAMIC_DRAW, 0);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quad.vbo);
      this.gl.drawElementsInstanced(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_INT, 0, value.num_instances);
    };

    this.palette_shader.use();
    this.palette_shader.set_mat4("uProj", this.camera.get_proj(this.gl));
    this.palette_shader.set_mat4("uView", this.camera.get_view());
    this.palette_shader.set_int("uTexture", 0);
    this.palette_shader.set_int("uPalettes", 1);
    this.palette_shader.set_vec4("uColor", 1.0, 1.0, 1.0, 1.0);
    this.textures["tex_palettes"].tex.use(1);
    for (let [key, value] of Object.entries(this.textures)) {
      if (key.startsWith("tex_light")) continue;
      if (value.num_instances_p <= 0) continue;
      value.tex.use(0);
      let buf = new Float32Array(value.buf_p);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.inst_buf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, buf, this.gl.DYNAMIC_DRAW, 0);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quad.vbo);
      this.gl.drawElementsInstanced(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_INT, 0, value.num_instances_p);
    };

    this.framebuffer_light.use();
    this.gl.clearColor(0.5, 0.5, 0.5, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.normal_shader.use();
    this.normal_shader.set_mat4("uProj", this.camera.get_proj(this.gl));
    this.normal_shader.set_mat4("uView", this.camera.get_view());
    this.normal_shader.set_int("uTexture", 0);
    this.normal_shader.set_vec4("uColor", 1.0, 1.0, 1.0, 1.0);
    for (let [key, value] of Object.entries(this.textures)) {
      if (!key.startsWith("tex_light")) continue;
      if (value.num_instances <= 0) continue;
      value.tex.use(0);
      let buf = new Float32Array(value.buf);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.inst_buf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, buf, this.gl.DYNAMIC_DRAW, 0);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quad.vbo);
      this.gl.drawElementsInstanced(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_INT, 0, value.num_instances);
    };
  }

  finalize(use_water_shader, use_dark_shader, use_heat_shader, gfxframe) {
    this.framebuffer_light.use_none();

    this.quad.use();
    if (!use_water_shader && !use_dark_shader && !use_heat_shader) {
      this.framebuffer_shader.use();
      this.framebuffer_shader.set_int("screenTexture", 0);
    }
    else if (use_water_shader) {
      this.water_shader.use();
      this.textures["tex_water_normals"].tex.use(1);
      this.water_shader.set_int("screenTexture", 0);
      this.water_shader.set_int("waterNormals", 1);
      this.water_shader.set_float("gfxFrame", gfxframe);
    }
    else if (use_heat_shader) {
      this.heat_shader.use();
      this.textures["tex_heat_normals"].tex.use(1);
      this.heat_shader.set_int("screenTexture", 0);
      this.heat_shader.set_int("heatNormals", 1);
      this.heat_shader.set_float("gfxFrame", gfxframe);
    }
    else {
      this.dark_shader.use();
      this.dark_shader.set_int("screenTexture", 0);
      this.dark_shader.set_int("lightTexture", 1);
      this.framebuffer_light.use_texture(1);
    }
    this.framebuffer.use_texture(0);
    this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_INT, 0);
  }

  _draw(tex, x, y, z, r, w, h, u, v, uw, vw, p) {
    let model = mat4.create();
    mat4.translate(model, model, vec3.fromValues(x, y, z));
    mat4.rotateZ(model, model, r);
    mat4.scale(model, model, vec3.fromValues(w, h, 1));
    
    if (p == -1) {
      this.textures[tex].buf.push(u, v, uw, vw);
      model.forEach(float => {
        this.textures[tex].buf.push(float);
      });
      this.textures[tex].buf.push(0);
      this.textures[tex].num_instances += 1;
    }
    else {
      this.textures[tex].buf_p.push(u, v, uw, vw);
      model.forEach(float => {
        this.textures[tex].buf_p.push(float);
      });
      this.textures[tex].buf_p.push(p);
      this.textures[tex].num_instances_p += 1;
    }
  }
}
