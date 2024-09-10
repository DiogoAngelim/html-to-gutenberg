export const imports: string = `
  const { registerBlockType } = wp.blocks;
  const { RichText, MediaUpload, InspectorControls } = wp.blockEditor;
  const { Panel, PanelBody, PanelRow, TextareaControl, ToggleControl } = wp.components;
`;

export const panels: any[] = [];
export const images: any[] = [];

export const browserOptions: string[] = [
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

export const userAgent: string =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36';

export const pageOptions: any = {
  waitUntil: 'networkidle2',
};

export const characters: string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const webpackConfig: string = `

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
        parallel: true,
        terserOptions: {
          keep_fnames: true,
          ecma: 6,
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
        use: ['babel-loader'],
        exclude: /node_modules/,
      }
    ]
  }
};

`;

export const packageJson: string = `
{
  "name": "wp-block",
  "version": "1.0.0",
  "main": "block.js",
  "type": "module",
  "dependencies": {
    "@babel/core": "^7.25.2",
    "@babel/plugin-transform-react-jsx": "^7.25.2",
    "@babel/preset-env": "^7.25.4",
    "@babel/preset-react": "^7.24.7",
    "babel-loader": "^9.1.3",
    "cross-env": "^7.0.3",
    "terser-webpack-plugin": "^5.3.10",
    "webpack": "^5.94.0",
    "webpack-cli": "^5.1.4"
  },
  "scripts": {
    "build": "cross-env BABEL_ENV=default NODE_ENV=production webpack && rm -r node_modules",
    "dev": "cross-env BABEL_ENV=default webpack --watch"
  }
}



`;

export const babelrc: string = `
{
	"presets": [
		[
			"@babel/preset-react",
			{
				"pragma": "wp.element.createElement"
			}
		]
	],
	"plugins": [
		[
			"@babel/plugin-transform-react-jsx",
			{
				"pragma": "wp.element.createElement"
			}
		]
	]
}
`;

export const editorStyles: string = `
.editor-styles-wrapper .wp-block {
    all: inherit;
}
`;