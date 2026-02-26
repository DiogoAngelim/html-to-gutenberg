import { expect } from 'chai';
import block from './index.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('block screenshot integration', () => {
  const testHtml = '<html><body><h1>SnapAPI Test</h1></body></html>';
  const testOptions = {
    name: 'SnapAPITestBlock',
    prefix: 'wp',
    category: 'common',
    basePath: process.cwd(),
    shouldSaveFiles: true,
    generateIconPreview: true,
    jsFiles: [],
    cssFiles: [],
    source: 'https://example.com',
  };
  const previewPath = path.join(
    testOptions.basePath,
    'snapapitestblock',
    'preview.jpeg'
  );

  after(() => {
    if (fs.existsSync(previewPath)) {
      fs.unlinkSync(previewPath);
      fs.rmdirSync(path.dirname(previewPath), { recursive: true });
    }
  });

  it('should generate a preview.jpeg using SnapAPI', async function () {
    this.timeout(15000); // Allow time for API call
    await block(testHtml, testOptions);
    expect(fs.existsSync(previewPath)).to.equal(true);
    const stats = fs.statSync(previewPath);
    expect(stats.size).to.be.greaterThan(1000); // Should not be empty
  });
});
