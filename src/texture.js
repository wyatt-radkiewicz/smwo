export default class Texture {
  constructor(/** @type {WebGL2RenderingContext} */ gl, image_tag, filter) {
    /** @type {HTMLImageElement} */
    let image = document.getElementById(image_tag);
    /** @type {WebGLTexture} */
    this.texture = gl.createTexture();

    let filterMode = gl.NEAREST;
    if (filter == "linear") filterMode = gl.LINEAR;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    this.gl = gl;
  }

  use(slot) {
    switch (slot) {
      case 1:
        this.gl.activeTexture(this.gl.TEXTURE1);
        break;
      case 2:
        this.gl.activeTexture(this.gl.TEXTURE2);
        break;
      default:
        this.gl.activeTexture(this.gl.TEXTURE0);
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }

  delete() {
    this.gl.deleteTexture(this.texture);
  }
}
