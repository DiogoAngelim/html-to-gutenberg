import fs from 'fs';
import block from './index.js';

(async () => {
  const htmlContent = fs.readFileSync('index.html', 'utf8');
  const options = {
    name: 'TempBlockTest',
    prefix: 'wp',
    category: 'common',
    basePath: process.cwd(),
    shouldSaveFiles: true,
    generateIconPreview: true,
    jsFiles: [],
    cssFiles: [],
    source: 'https://diogoangelim.github.io/html-to-gutenberg/',
    };
  const result = await block(htmlContent, options);
  console.log('Block generation result:', Object.keys(result));
})();
