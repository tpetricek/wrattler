var fs = require("fs");
var path = require("path");
var HtmlWebpackPlugin = require('html-webpack-plugin');
var webpack = require("webpack");
var MonacoWebpackPlugin = require('../node_modules/monaco-editor-webpack-plugin');

var packageJson = JSON.parse(fs.readFileSync(resolve('../package.json')).toString());
var errorMsg = "{0} missing in package.json";

var config = {
  entry: {
    "app": "../src/wrattler.ts",
    // "editor.worker": 'monaco-editor/esm/vs/editor/editor.worker.js',
  },
  publicDir: resolve("../public"),
  buildDir: resolve("../build"),
  nodeModulesDir: resolve("../node_modules"),
  indexHtmlTemplate: resolve("../public/index.html")
}

function resolve(filePath) {
  return path.join(__dirname, filePath)
}

function forceGet(obj, path, errorMsg) {
  function forceGetInner(obj, head, tail) {
    if (head in obj) {
      var res = obj[head];
      return tail.length > 0 ? forceGetInner(res, tail[0], tail.slice(1)) : res;
    }
    throw new Error(errorMsg.replace("{0}", path));
  }
  var parts = path.split('.');
  return forceGetInner(obj, parts[0], parts.slice(1));
}

function getModuleRules(isProduction) {
  var babelOptions = {
    presets: [
      ["env", { "targets": { "browsers": "> 1%" }, "modules": false }]
    ],
  };

  return [
    {
      test: /\.ts|\.tsx?$/,
      loader: "ts-loader"
    },
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: babelOptions
      },
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    }
  ];
}

function getPlugins(isProduction) {
  return [
    new HtmlWebpackPlugin({
      filename: path.join(config.buildDir, "index.html"),
      template: config.indexHtmlTemplate,
      minify: false //isProduction ? {} : false
    }),
    new webpack.NamedModulesPlugin(),
    new MonacoWebpackPlugin(),
    new webpack.ContextReplacementPlugin(
      /monaco-editor(\\|\/)esm(\\|\/)vs(\\|\/)editor(\\|\/)common(\\|\/)services/,
      __dirname
    ),
    new webpack.DefinePlugin({
      PYTHONSERVICE_URI: JSON.stringify(typeof(process.env.PYTHONSERVICE_URI)=="undefined"?"http://localhost:7101":process.env.PYTHONSERVICE_URI),
      RSERVICE_URI: JSON.stringify(typeof(process.env.RSERVICE_URI)=="undefined"?"http://localhost:7103":process.env.RSERVICE_URI),
      RACKETSERVICE_URI: JSON.stringify(typeof(process.env.RACKETSERVICE_URI)=="undefined"?"http://localhost:7104":process.env.RACKETSERVICE_URI),
      DATASTORE_URI: JSON.stringify(typeof(process.env.DATASTORE_URI)=="undefined"?"http://localhost:7102":process.env.DATASTORE_URI),
      CLIENT_URI: JSON.stringify(typeof(process.env.CLIENT_URI)=="undefined"?"http://localhost:8080":process.env.CLIENT_URI),
      AIASERVICE_URI: JSON.stringify(typeof(process.env.AIASERVICE_URI)=="undefined"?"http://localhost:5050":process.env.AIASERVICE_URI)
    })
  ];
}

module.exports = {
  resolve: resolve,
  config: config,
  getModuleRules: getModuleRules,
  getPlugins: getPlugins
}
