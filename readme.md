# HTML to Gutenberg Converter

[![Build Status](https://github.com/DiogoAngelim/html-to-gutenberg/actions/workflows/main.yml/badge.svg)](https://github.com/DiogoAngelim/html-to-gutenberg/actions)
[![Coverage Status](https://coveralls.io/repos/github/DiogoAngelim/html-to-gutenberg/badge.svg?branch=main)](https://coveralls.io/github/DiogoAngelim/html-to-gutenberg?branch=main)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/DiogoAngelim/html-to-gutenberg/blob/main/LICENSE.MD)

  

Convert HTML strings to valid, editable WordPress Gutenberg blocks in seconds instead of hours. With this script, you can create and build valid Gutenberg blocks that feature editable text, forms, inline and background images, as well as SVGs. It includes support for TailwindCSS.

  

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

  
  

## Installation

  

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
| generateIconPreview | If `true`, generates a static image preview (JPEG) of the block's icon for display in the block picker.                                              | boolean  | No                                                                                                  | false             |
| shouldSaveFiles     | When `true`, the generated block files are saved directly to disk. When `false`, returns an object containing the file contents as strings instead. | boolean  | No                                                                                                  | true              |
| jsFiles             | An array of external JavaScript file URLs to enqueue with the block on the editor and the frontend. Useful for adding remote libraries.             | string[] | No                                                                                                  | []                |
| cssFiles            | An array of external CSS file URLs to enqueue with the block on the editor and the frontend. Useful for adding additional remote stylesheets.        | string[] | No                                                                                                  | []                |



## License
  

[MIT](https://github.com/DiogoAngelim/html-to-gutenberg/blob/main/LICENSE.MD)