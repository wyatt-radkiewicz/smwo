export default class Model {
  constructor(/** @type {WebGL2RenderingContext} */ gl, verticies, indicies, usage) {
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    this.ebo = gl.createBuffer();

    let vert_data = new Float32Array(verticies);
    let idx_data = new Int32Array(indicies);

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vert_data, usage, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx_data, usage, 0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, gl.GL_FALSE, vert_data.BYTES_PER_ELEMENT*4, vert_data.BYTES_PER_ELEMENT*0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, gl.GL_FALSE, vert_data.BYTES_PER_ELEMENT*4, vert_data.BYTES_PER_ELEMENT*2);
    gl.enableVertexAttribArray(1);
    gl.bindVertexArray(null);

    this.gl = gl;
  }

  use() {
    this.gl.bindVertexArray(this.vao);
  }
}
