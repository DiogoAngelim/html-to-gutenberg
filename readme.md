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
  prefix: 'gut',
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
| prefix       | A name prefix. e.g., "wp"                                                                     | string   | yes                                    |
| category     | Any existing WP Block category. e.g., "common"                                                  | string   | yes                                    |
| basePath     | Tells where to save the output folder to. Defaults to the current directory.                    | string   | no                                     |

## License

[MIT](https://choosealicense.com/licenses/mit/)
