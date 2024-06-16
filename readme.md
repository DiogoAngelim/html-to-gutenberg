# HTML to Gutenberg Converter

Convert HTML string to valid, editable WordPress Gutenberg blocks in seconds instead of hours.

## Installation

Install html-to-gutenberg with npm

```bash
  npm install html-to-gutenberg
```

## Usage/Examples

```javascript
import block from 'html-to-gutenberg';

const htmlString = '<div></div>';

block(htmlString, {
  name: 'My Block',
  prefix: 'wp_',
  category: 'common',
});
```

```bash
cd my_block
npm install && npm run build
```

## Options reference

| Key          | Description                                                                                     | Type     | Required?                              |
| ------------ | ----------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| name         | The name of your block                                                                          | string   | yes                                    |
| prefix       | A name prefix. e.g., "wp\_"                                                                     | string   | yes                                    |
| category     | Any existing WP Block category. e.g., "common"                                                  | string   | yes                                    |
| basePath     | Tells where to save the output folder to. Defaults to the current directory.                    | string   | no                                     |
| icon         | Any existing WordPress icon. Defaults to "shield".                                              | string   | no                                     |
| generateIcon | If set true, the program will render and save a preview of the block as an icon.                | boolean  | no                                     |
| chromePath   | The file path of your Chrome installation. Only useful if generating the icon preview.          | string   | yes, only if `generateIcon` is `true`. |
| cssFiles     | Optionally, include any URLs of css files that might be useful for generating the icon preview. | string[] | no                                     |
| jsFiles      | Optionally, include any URLs of js files that might be useful for generating the icon preview.  | string[] | no                                     |

## License

[MIT](https://choosealicense.com/licenses/mit/)
