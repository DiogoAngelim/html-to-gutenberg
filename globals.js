const imports = `
  const { registerBlockType } = wp.blocks;
  const { RichText, MediaUpload, InspectorControls } = wp.blockEditor;
  const { Panel, PanelBody, PanelRow, TextareaControl } = wp.components;
`;

const panels = [];
const images = [];

const browserOptions = [
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36';

const pageOptions = {
  waitUntil: 'networkidle0',
};

const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const webpackConfig = `
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TerserPlugin from 'terser-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  entry: './block.js',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_fnames: true,
        },
      }),
    ],
  },
  output: {
    path: __dirname,
    filename: 'block.build.js',
  },
  module: {
    rules: [
      {
        test: /.(js|jsx)$/,
        use: {
          loader: 'babel-loader',
        },
        exclude: /(node_modules|bower_components)/,
      },
    ],
  },
};
`;

const packageJson = `
{
  "name": "wp-block",
  "version": "1.0.0",
  "main": "block.js",
  "type": "module",
  "devDependencies": {
    "@babel/core": "^7.24.7",
    "@babel/preset-react": "^7.24.7",
    "babel-loader": "^9.1.3",
    "cross-env": "^7.0.3",
    "webpack": "^5.92.0",
    "webpack-cli": "^5.1.4",
    "terser-webpack-plugin": "^5.3.10"
  },
  "scripts": {
    "build": "cross-env BABEL_ENV=default NODE_ENV=production webpack && rm -r node_modules",
    "dev": "cross-env BABEL_ENV=default webpack --watch"
  }
}
`;

const babelrc = `
{
	"presets": [
		[ "@babel/preset-react", {
      "pragma": "wp.element.createElement",
			"modules": false,
			"targets": {
				"browsers": [
					"last 2 Chrome versions",
					"last 2 Firefox versions",
					"last 2 Safari versions",
					"last 2 iOS versions",
					"last 1 Android version",
					"last 1 ChromeAndroid version",
					"ie 11"
				]
			}
		} ]
	]
}
`;

const editorStyles = `
.editor-styles-wrapper .wp-block {
    all: inherit;
}
`;

export {
  imports,
  panels,
  images,
  userAgent,
  pageOptions,
  characters,
  browserOptions,
  webpackConfig,
  packageJson,
  babelrc,
  editorStyles,
};
