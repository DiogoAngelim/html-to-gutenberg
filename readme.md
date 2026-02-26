# HTML to Gutenberg Converter

<!-- [![Build Status](https://github.com/DiogoAngelim/html-to-gutenberg/actions/workflows/main.yml/badge.svg?cacheBust=1)](https://github.com/DiogoAngelim/html-to-gutenberg/actions)
[![Coverage Status](https://coveralls.io/repos/github/DiogoAngelim/html-to-gutenberg/badge.svg?branch=main&cacheBust=1)](https://coveralls.io/github/DiogoAngelim/html-to-gutenberg?branch=main) -->
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/DiogoAngelim/html-to-gutenberg/blob/main/LICENSE.MD)

  

Convert HTML strings to valid, editable WordPress Gutenberg blocks in seconds instead of hours. With this lib, you can create and build valid Gutenberg blocks that feature editable text, forms, inline and background images, as well as SVGs.

## How it works

This package is actually an alternative when AI fails converting it, which is usually very common.

Most of the logic is just hard-coded patterns. It first converts from plain HTML to Jsx (using the `html-to-jsx` package), which is the supported format of Gutenberg. Then, it follows structured conversion rules that build the WordPress block, which is then validated and parsed using Babel.


## Features

  

- 🪄 **Instantly transforms static HTML into Gutenberg blocks**
Saves hours of manual work by automating block creation from any valid HTML snippet.

- 🔌 **Generates a complete, installable WordPress block plugin**
Outputs all necessary plugin files (JS, CSS, PHP) so you can drop them into WordPress immediately.
  

- 🎨 **Keeps your design intact**
Automatically extracts and preserves CSS from the original HTML into a separate `style.css`.


- 🧩 **Modular and scalable**
Separates assets (JS, CSS, components) into clean files, making it easy to maintain and extend.
  

- 📦 **Seamlessly integrates with dynamic block systems**
Works perfectly for headless or custom Gutenberg setups where blocks are registered via JS, not PHP.
  

- 🚀 **Speeds up prototyping**
Ideal for quickly testing block ideas or converting landing pages and templates into WordPress blocks.

  
- 🧠 **Works with your file system or plugin builder logic**
Since it returns all files as either strings or source files, you can save them however you like (via PHP, APIs, etc.).


- 🧰 **Built for automation and customization**
Can be embedded in custom tools, UIs, or pipelines to generate Gutenberg blocks on demand.

  
## Process Overview


Below is a visual overview of the block generation process:

![Block Generation Process](process.png)  


## Environment Variables

To use the screenshot preview feature, create a `.env` file in your project root:

```
SNAPAPI_KEY=sk_live_your_snapapi_key_here
```

You can get your SnapAPI key at [https://snapapi.pics/](https://snapapi.pics/).

An example file is provided as `.env.example`.

  

Install html-to-gutenberg with npm:

  

```bash

npm  install  html-to-gutenberg

```

  

## Usage/Examples

  

```javascript

// block-generator.js

import  block  from  'html-to-gutenberg';

const  htmlString = '<div>My content</div>';

{
	const files = await  block(htmlString, { name:  'My Block' });
	console.log(files);
}

```

  


When provided with a valid HTML string and the required options, the block function will generate the necessary WordPress block files with the specified configuration. To install the block and its assets, simply load the generated folder into the plugins folder and activate it.

If `generateIconPreview` is set to `true` and a `source` URL is provided, a `preview.jpeg` will be generated using SnapAPI and saved in your block's output folder.

  

## Example

  

[Working demo](https://www.html-to-gutenberg.io/)

  

## Options object reference


| Option              | Description                                                                                                                                           | Type     | Required?                                                                                          | Default            |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------|-------------------|
| name                | The name of your block. This will also be used for the folder name and internal references.                                                          | string   | Yes                                                                                                 | My block          |
| source              | A URL where relative paths resolve. E.g., `http://localhost/website`.                                                                     | string   | Yes, only if the HTML string or the stylesheet has relative paths.                             | null              |
| prefix              | A namespace prefix for the block name, typically aligned with your project (e.g., "wp" or "myplugins").                                              | string   | No                                                                                                  | wp                |
| category            | The WordPress block category where the block appears in the editor. Use an existing one or register a custom category if needed.                    | string   | No                                                                                                  | common            |
| basePath            | The absolute path where the output files and folders will be saved.                                                                                  | string   | No                                                                                                  | Current directory |
| generateIconPreview | If you enable the `generateIconPreview` option by setting it to `true`, this package will generate a static image preview of your block using the [SnapAPI](https://snapapi.pics/) screenshot service. You must provide a SnapAPI key in a `.env` file (see below), which will display it a replacement for the block icons in the WP dashboard. | boolean  | No                                                                                                  | false             |
| shouldSaveFiles     | When `true`, the generated block files are saved directly to disk. When `false`, returns an object containing the file contents as strings instead. | boolean  | No                                                                                                  | true              |
| jsFiles             | An array of external JavaScript file URLs to enqueue with the block on the editor and the frontend. Useful for adding remote libraries.             | string[] | No                                                                                                  | []                |
| cssFiles            | An array of external CSS file URLs to enqueue with the block on the editor and the frontend. Useful for adding additional remote stylesheets.        | string[] | No                                                                                                  | []                |



**Special thanks to [Alex Serebryakov](https://snapapi.pics/) for creating and maintaining SnapAPI!**


## Running Tests

To run the test suite, use:

```bash
npm test
```

This will execute all unit and integration tests using Mocha and Chai. Make sure all dependencies are installed with `npm install` before running tests.

Some tests (such as screenshot preview generation) may require a valid SnapAPI key in your `.env` file.


## License
  

[MIT](https://github.com/DiogoAngelim/html-to-gutenberg/blob/main/LICENSE.MD)