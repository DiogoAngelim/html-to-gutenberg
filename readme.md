# HTML to Gutenberg Converter

Convert HTML string to valid, editable WordPress Gutenberg blocks in seconds instead of hours. With this script, you can create & build valid Gutenberg blocks that have editable text, inline and background images, as well as SVGs.

## Installation

Install html-to-gutenberg with npm:

```bash
  npm install html-to-gutenberg
```

## Usage/Examples

```javascript
// block-generator.js
import block from 'html-to-gutenberg';

const htmlString = '<div>My content</div>';

{ 
  await block(htmlString, {
    name: 'My Block',
    prefix: 'gut',
    category: 'common',
  });
}
```

Provided a valid html string with the required options, the block function will create a new folder containing the WordPress block with the specified configuration. All you have to do after running the script is enter the directory where the files were created, install the required modules, and compile the block in webpack by running those two commands in the command line:

```bash
cd my_block
npm install && npm run build
```


The output will be a file called `block.build.js`, that can be enqueued by the PHP function in WordPress. That function is automatically generated, so you don't have to worry about it. To install the block and its assets, simply zip the package and upload as a plugin to your WordPress website. 

## Example

[Working demo](https://www.html-to-gutenberg.io/)

## Options object reference

| **Key** | **Description** | **Type** | **Required?** |
|---|---|---|---|
| name | The name of your block | string | yes |
| prefix | A name prefix. e.g., "wp" | string | yes |
| category | Any existing WP Block category. e.g., "common". Make sure to create any custom category if you need. | string | yes |
| basePath | Tells where to save the output folder to. Defaults to the current directory. | string | no |
| generateIconPreview | Tells whether you want to generate a page preview image or not. | boolean | no |            | boolean   | no                                     |

## License

[MIT](https://github.com/DiogoAngelim/html-to-gutenberg/blob/main/LICENSE.MD)
