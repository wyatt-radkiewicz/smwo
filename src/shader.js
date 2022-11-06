import {mat4} from "gl-matrix"

export default class Shader {
  constructor(/** @type {WebGL2RenderingContext} */ gl, vert_tag, frag_tag) {
    let vert = document.getElementById(vert_tag).innerHTML;
    let frag = document.getElementById(frag_tag).innerHTML;

    let vertShader = createShader(gl, vert, gl.VERTEX_SHADER);
    let fragShader = createShader(gl, frag, gl.FRAGMENT_SHADER);
    this.program = gl.createProgram();
    
    gl.attachShader(this.program, vertShader);
    gl.attachShader(this.program, fragShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw "Couldn't link the shader program!" + gl.getProgramInfoLog(this.program);
    }

    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);
    this.gl = gl;
  }

  set_mat4(name, mat) {
    this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, name), false, mat);
  }
  set_vec4(name, x, y, z, w) {
    this.gl.uniform4f(this.gl.getUniformLocation(this.program, name), x, y, z, w);
  }
  set_vec2(name, x, y) {
    this.gl.uniform2f(this.gl.getUniformLocation(this.program, name), x, y);
  }
  set_int(name, x) {
    this.gl.uniform1i(this.gl.getUniformLocation(this.program, name), x);
  }
  set_float(name, x) {
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, name), x);
  }

  use() {
    this.gl.useProgram(this.program);
  }

  delete() {
    this.gl.deleteProgram(this.program);
    this.program = null;
  }
}

/** @type {WebGLShader} */
function createShader(/** @type {WebGL2RenderingContext} */ gl, source, type) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw "Couldn't load a " + (type === gl.VERTEX_SHADER ? "Vertex" : "Fragment") + " shader!\nInfo:" + gl.getShaderInfoLog(shader);
  }

  return shader;
}
