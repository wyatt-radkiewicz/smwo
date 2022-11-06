export default class Framebuffer {
  constructor(/** @type {WebGL2RenderingContext} */ gl, includeDepth, numColorBuffers) {
    this.gl = gl;
    this.includeDepth = includeDepth;
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

    this.colorBuffers = [];

    for (let i = 0; i < numColorBuffers; i++) {
      let buffer = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, buffer);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0+i, gl.TEXTURE_2D, buffer, 0);
      this.colorBuffers.push(buffer);
    }
    if (numColorBuffers > 1) {
      let attachments = [];
      for (let i = 0; i < numColorBuffers; i++) attachments.push(gl.COLOR_ATTACHMENT0+i);
      gl.drawBuffers(attachments);
    }
    if (this.includeDepth) {
      this.rbo = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.rbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.rbo);
    }

    this.resize(gl.canvas.width, gl.canvas.height);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
      alert("couldn't create a framebuffer!");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  use() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
  }

  use_texture(slot) {
    this.colorBuffers.forEach((buffer, i) => {
      this.gl.activeTexture(this.gl.TEXTURE0+slot+i);
      this.gl.bindTexture(this.gl.TEXTURE_2D, buffer);
    });
  }

  use_none() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  resize(w, h) {
    this.colorBuffers.forEach(buffer => {
      this.gl.bindTexture(this.gl.TEXTURE_2D, buffer);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, w, h, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    });
    if (this.includeDepth) {
      this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.rbo);
      this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH24_STENCIL8, w, h);
    }
  }
}
