const path = require('path');

module.exports = {
  entry: {
    app: './src/index.js',
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
