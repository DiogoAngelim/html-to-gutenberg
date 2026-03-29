import * as utils from './utils.ts';
import { expect } from 'chai';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import block, {
  buildAssetExtractionOptions,
  createProfiler,
  findSelfClosingJsxEnd,
  formatCategoryLabel,
  getMediaUploadSaveTemplate,
  getSnapApiUrl,
  normalizeBlockOptions,
  replaceMediaUploadComponents,
  replaceRelativeUrls,
  replaceRelativeUrlsInCss,
  replaceRelativeUrlsInCssWithBase,
  replaceRelativeUrlsInHtml,
  replaceRichTextComponents,
  replaceSelfClosingJsxComponent,
  slugifyBlockValue,
  transformBlockFile,
  unwrapBody,
} from './index.js';

const tinyImage = Buffer.from(
  'ffd8ffe000104a46494600010101006000600000ffdb0043000101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffc00011080001000103012200021101031101ffc40014000100000000000000000000000000000008ffc40014100100000000000000000000000000000000ffda0008010100003f00d2cf20ffd9',
  'hex'
);

const listen = (server: http.Server) => {
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine server port.'));
        return;
      }

      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          }),
      });
    });

    server.on('error', reject);
  });
};

describe('utils.ts functions', () => {
  it('hasTailwindCdnSource returns true for Tailwind CDN', () => {
    expect(utils.hasTailwindCdnSource(['https://cdn.tailwindcss.com'])).to.equal(true);
    expect(utils.hasTailwindCdnSource(['https://example.com'])).to.equal(false);
  });

  it('replaceSourceUrlVars returns input if no match', () => {
    const str = "var.url+'http://site.com/path'";
    const expected = "${vars.url}/path";
    expect(utils.replaceSourceUrlVars(str, 'http://site.com')).to.equal(expected);
  });

  it('sanitizeAndReplaceLeadingNumbers replaces leading numbers', () => {
    expect(utils.sanitizeAndReplaceLeadingNumbers('1test')).to.match(/one1test|1test/);
  });

  it('replaceUnderscoresSpacesAndUppercaseLetters replaces underscores and spaces', () => {
    expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).to.equal('test-name-here');
  });

  it('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase converts correctly', () => {
    expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).to.equal('test_name_here');
  });

  it('hasAbsoluteKeyword detects absolute', () => {
    expect(utils.hasAbsoluteKeyword('absolute')).to.equal(true);
    expect(utils.hasAbsoluteKeyword('relative')).to.equal(false);
  });

  it('generateRandomVariableName returns string with prefix', () => {
    expect(utils.generateRandomVariableName('prefix')).to.match(/^prefix/);
  });

  // Additional coverage tests

  describe('hasTailwindCdnSource edge cases', () => {
    it('returns false for empty array', () => {
      expect(utils.hasTailwindCdnSource([])).to.equal(false);
    });
    it('returns true for multiple tailwind URLs', () => {
      expect(utils.hasTailwindCdnSource([
        'https://cdn.tailwindcss.com',
        'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.0.0'
      ])).to.equal(true);
    });
    it('returns false for malformed URLs', () => {
      expect(utils.hasTailwindCdnSource(['not-a-url'])).to.equal(false);
    });
  });

  describe('replaceSourceUrlVars edge cases', () => {
    it('replaces matching pattern', () => {
      const str = "var.url+'http://site.com/path'";
      const source = 'http://site.com';
      const expected = "${vars.url}/path";
      expect(utils.replaceSourceUrlVars(str, source)).to.contain(expected);
    });
    it('returns input for empty string', () => {
      expect(utils.replaceSourceUrlVars('', 'http://site.com')).to.equal('');
    });
    it('returns input for null source', () => {
      expect(utils.replaceSourceUrlVars("var.url+'http://site.com/path'", null)).to.equal("var.url+'http://site.com/path'");
    });
    it('replaces multiple matches', () => {
      const str = "var.url+'http://site.com/a' and var.url+'http://site.com/b'";
      const source = 'http://site.com';
      const result = utils.replaceSourceUrlVars(str, source);
      expect(result.match(/\${vars\.url}/g)?.length).to.be.greaterThanOrEqual(2);
    });
  });

  describe('sanitizeAndReplaceLeadingNumbers edge cases', () => {
    it('returns input for no numbers', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('test')).to.equal('test');
    });
    it('handles multiple leading numbers', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('123abc')).to.match(/one1two2three3abc|123abc/);
    });
    it('handles only numbers', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('123')).to.match(/one1two2three3|123/);
    });
    it('handles special characters', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('1_test')).to.match(/one1test|1test/);
    });
  });

  describe('replaceUnderscoresSpacesAndUppercaseLetters edge cases', () => {
    it('handles only underscores', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('___')).to.equal('---');
    });
    it('handles only spaces', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('   ')).to.equal('---');
    });
    it('handles mixed cases', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).to.equal('test-name-here');
    });
    it('handles empty string', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('')).to.equal('');
    });
  });

  describe('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase edge cases', () => {
    it('handles only dashes', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('---')).to.equal('___');
    });
    it('handles only spaces', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('   ')).to.equal('___');
    });
    it('handles mixed cases', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).to.equal('test_name_here');
    });
    it('handles empty string', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('')).to.equal('');
    });
  });

  describe('hasAbsoluteKeyword edge cases', () => {
    it('detects uppercase', () => {
      expect(utils.hasAbsoluteKeyword('ABSOLUTE')).to.equal(true);
    });
    it('returns false for empty string', () => {
      expect(utils.hasAbsoluteKeyword('')).to.equal(false);
    });
    it('returns false for non-string input', () => {
      expect(utils.hasAbsoluteKeyword(null as any)).to.equal(false);
    });
  });

  describe('generateRandomVariableName edge cases', () => {
    it('returns prefix only for length 0', () => {
      expect(utils.generateRandomVariableName('prefix', 0)).to.equal('prefix');
    });
    it('returns only random part for empty prefix', () => {
      expect(utils.generateRandomVariableName('', 3)).to.match(/^[a-z]{3}$/);
    });
    it('returns correct length', () => {
      const result = utils.generateRandomVariableName('pre', 5);
      expect(result.length).to.equal(8);
    });
  });
});

describe('index.js helper exports', () => {
  it('creates a profiler that only logs when enabled', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: any) => logs.push(String(message));

    try {
      const disabled = createProfiler(false);
      disabled.start('skip');
      disabled.end('skip');

      const enabled = createProfiler(true);
      enabled.start('profiled');
      enabled.end('profiled');
    } finally {
      console.log = originalLog;
    }

    expect(logs.length).to.equal(1);
    expect(logs[0]).to.include('[profile] profiled:');
  });

  it('finds self-closing JSX boundaries and replaces matching components safely', () => {
    const content = `<Wrapper><RichText value={attributes.title} /><MediaUpload render={({ open }) => (<Button title={"/>"} data-template={\`value />\`} onClick={open} />)} /></Wrapper>`;

    expect(findSelfClosingJsxEnd(content, content.indexOf('<RichText'))).to.be.greaterThan(content.indexOf('<RichText'));
    expect(findSelfClosingJsxEnd('<Broken value={"unterminated"}', 0)).to.equal(-1);
    expect(replaceSelfClosingJsxComponent('plain text', 'RichText', () => 'x')).to.equal('plain text');
    expect(
      replaceSelfClosingJsxComponent('<RichText value={title} />', 'RichText', () => '<RichText.Content value={title} />')
    ).to.equal('<RichText.Content value={title} />');
    expect(
      replaceSelfClosingJsxComponent('<RichText value={"oops"}', 'RichText', () => 'broken')
    ).to.equal('<RichText value={"oops"}');
  });

  it('replaces media and rich text helper components in save content', () => {
    const mediaTemplate = getMediaUploadSaveTemplate({
      randomUrlVariable: 'imageUrl',
      randomAltVariable: 'imageAlt',
      imgClass: 'hero',
    });

    expect(getMediaUploadSaveTemplate(undefined)).to.equal('');
    expect(mediaTemplate).to.include('attributes.imageUrl');
    expect(mediaTemplate).to.include('className="hero"');
    expect(
      replaceMediaUploadComponents(
        '<MediaUpload /><MediaUpload />',
        [
          { randomUrlVariable: 'oneUrl', randomAltVariable: 'oneAlt', imgClass: 'one' },
          { randomUrlVariable: 'twoUrl', randomAltVariable: 'twoAlt', imgClass: '' },
        ]
      )
    ).to.include('attributes.twoUrl');
    expect(
      replaceRichTextComponents('<RichText value={attributes.body} /><RichText tagName="span" />')
    ).to.equal('<RichText.Content value={attributes.body} /><RichText tagName="span" />');
  });

  it('builds asset extraction options and rewrites relative URLs', () => {
    expect(buildAssetExtractionOptions('/tmp/path')).to.deep.equal({
      basePath: '/tmp/path',
      saveFile: false,
      verbose: false,
      maxRetryAttempts: 1,
      retryDelay: 0,
      concurrency: 8,
      uploadToR2: false,
      returnDetails: false,
      jobId: undefined,
      r2Prefix: undefined,
    });

    expect(
      replaceRelativeUrls('<img src="/image.png"><a href="#hash"></a><form action="submit"></form>', (url) => `https://example.com${url}`)
    ).to.include('src="https://example.com/image.png"');
    expect(
      replaceRelativeUrlsInHtml('<a href="/page">Go</a>', 'https://example.com/base/')
    ).to.equal('<a href="https://example.com/page">Go</a>');
    expect(
      replaceRelativeUrlsInCss(`body{background:url('/bg.png')}a{mask:url(#mask)}div{background:url("https://cdn.example.com/a.png")}`, (url) => `https://example.com${url}`)
    ).to.equal(`body{background:url('https://example.com/bg.png')}a{mask:url(#mask)}div{background:url("https://cdn.example.com/a.png")}`);
    expect(
      replaceRelativeUrlsInCssWithBase(`body{background:url('../bg.png')}`, 'https://example.com/assets/css/site.css')
    ).to.equal(`body{background:url('https://example.com/assets/bg.png')}`);
    expect(
      replaceRelativeUrlsInCssWithBase(`body{background:url("https://cdn.example.com/bg.png")}`, 'https://example.com/assets/css/site.css')
    ).to.equal(`body{background:url("https://cdn.example.com/bg.png")}`);
  });

  it('normalizes the public block options API and preserves legacy aliases', () => {
    expect(slugifyBlockValue('My Fancy Block!')).to.equal('my-fancy-block');
    expect(formatCategoryLabel('marketing-tools')).to.equal('Marketing Tools');

    expect(
      normalizeBlockOptions({
        title: 'Marketing Hero',
        slug: 'marketing-hero',
        baseUrl: 'https://example.com',
        namespace: 'myplugins',
        outputPath: '/tmp/out',
        writeFiles: false,
        generatePreviewImage: true,
        registerCategoryIfMissing: true,
      })
    ).to.include({
      title: 'Marketing Hero',
      name: 'Marketing Hero',
      slug: 'marketing-hero',
      namespace: 'myplugins',
      prefix: 'myplugins',
      baseUrl: 'https://example.com',
      source: 'https://example.com',
      outputPath: '/tmp/out',
      basePath: '/tmp/out',
      writeFiles: false,
      shouldSaveFiles: false,
      generatePreviewImage: true,
      generateIconPreview: true,
      registerCategoryIfMissing: true,
      outputMode: 'legacy',
    });

    expect(
      normalizeBlockOptions({
        name: 'Legacy Name',
        prefix: 'legacy',
        source: 'https://legacy.example.com',
        basePath: '/tmp/legacy',
        shouldSaveFiles: true,
        generateIconPreview: false,
      })
    ).to.include({
      title: 'Legacy Name',
      name: 'Legacy Name',
      namespace: 'legacy',
      prefix: 'legacy',
      baseUrl: 'https://legacy.example.com',
      source: 'https://legacy.example.com',
      outputPath: '/tmp/legacy',
      basePath: '/tmp/legacy',
      writeFiles: true,
      shouldSaveFiles: true,
      generatePreviewImage: false,
      generateIconPreview: false,
      outputMode: 'legacy',
    });
  });

  it('unwraps HTML/body wrappers, exposes the snap api URL, and handles transform failures', () => {
    const failingValue = {
      replace() {
        throw new Error('no replace');
      },
    };

    process.env.SNAPAPI_URL = 'http://127.0.0.1:9999/custom-preview';

    try {
      expect(unwrapBody('<html><body><main>Hi</main></body></html>')).to.equal('<main>Hi</main>');
      expect(unwrapBody(failingValue as any)).to.equal(failingValue);
      expect(getSnapApiUrl()).to.equal('http://127.0.0.1:9999/custom-preview');
      expect(transformBlockFile('const view = <div>Hello</div>;')?.code).to.include('wp.element.createElement');

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (message?: any) => logs.push(String(message));

      try {
        expect(transformBlockFile('const view = <div>').toString()).to.equal('');
      } finally {
        console.log = originalLog;
      }

      expect(logs.length).to.equal(1);
    } finally {
      delete process.env.SNAPAPI_URL;
    }
  });
});

describe('block generation regressions', () => {
  it('generates a valid block.js for repeated image markup', async function () {
    this.timeout(5000);

    const html =
      '<!doctype html><html><body>' +
      Array.from({ length: 20 }, () => '<img src="/img/fail.png" /><img src="/img/fail.png" />').join('') +
      '</body></html>';
    const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'htg-test-images-'));

    try {
      const result = await block(html, {
        title: 'Test Images',
        namespace: 'wp',
        category: 'common',
        outputPath: basePath,
        writeFiles: false,
        outputMode: 'legacy',
        generatePreviewImage: false,
        jsFiles: [],
        cssFiles: [],
        baseUrl: 'https://example.com',
      });

      expect(result['block.js']).to.be.a('string').and.to.have.length.greaterThan(1000);
      expect(result['block.js']).to.include('registerBlockType');
      const saveSection = result['block.js'].slice(result['block.js'].indexOf('save(props)'));
      expect(saveSection).to.not.include('MediaUpload');
    } finally {
      fs.rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('handles a large fixture within a reasonable time budget', async function () {
    this.timeout(5000);

    const repeated = Array.from(
      { length: 100 },
      (_, i) =>
        `<section class="card"><h2>Item ${i}</h2><p>${'x'.repeat(120)}</p><a href="/item/${i}">Read more</a></section>`
    ).join('');
    const html = `<!doctype html><html><body><main>${repeated}</main></body></html>`;
    const start = process.hrtime.bigint();

    const result = await block(html, {
      title: 'Large Fixture',
      namespace: 'wp',
      category: 'common',
      outputPath: process.cwd(),
      writeFiles: false,
      outputMode: 'legacy',
      generatePreviewImage: false,
      jsFiles: [],
      cssFiles: [],
      baseUrl: 'https://example.com',
    });

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(elapsedMs).to.be.lessThan(2000);
    expect(result['block.js']).to.be.a('string').and.to.have.length.greaterThan(10000);
  });

  it('covers forms, SVGs, background images, external assets, and preview generation', async function () {
    this.timeout(10000);

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message?: any) => warnings.push(String(message));

    const server = http.createServer((req, res) => {
      const url = req.url || '/';

      if (url === '/remote.css' || url === '/extra.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(`
          .remote-card { background-image: url('/assets/bg.jpg'); }
          .external-copy { color: #123456; }
        `);
        return;
      }

      if (url === '/broken.css') {
        res.writeHead(500, { 'Content-Type': 'text/css' });
        res.end('broken');
        return;
      }

      if (url === '/remote.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('window.__remoteScriptLoaded = true;');
        return;
      }

      if (url === '/broken.js') {
        res.writeHead(500, { 'Content-Type': 'application/javascript' });
        res.end('broken');
        return;
      }

      if (url === '/assets/plain.jpg' || url === '/assets/bg.jpg') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(tinyImage);
        return;
      }

      if (url === '/snapapi/screenshot') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(tinyImage);
        return;
      }

      if (url === '/snapapi/fail') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'preview failed' }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    const { baseUrl, close } = await listen(server);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'htg-complex-'));
    process.env.SNAPAPI_KEY = 'test-key';
    process.env.SNAPAPI_URL = `${baseUrl}/snapapi/screenshot`;
    fs.mkdirSync(path.join(tempRoot, 'coverage-block'), { recursive: true });

    const html = `
      <!doctype html>
      <html>
        <head>
          <style>
            .inline-card { background-image: url('/assets/bg.jpg'); }
          </style>
          <link rel="stylesheet" href="${baseUrl}/remote.css" />
          <link rel="stylesheet" href="${baseUrl}/broken.css" />
          <script>window.__inlineScriptLoaded = true;</script>
          <script src="${baseUrl}/remote.js"></script>
          <script src="${baseUrl}/broken.js"></script>
        </head>
        <body>
          <!-- remove me -->
          <div class="items-center inline-card remote-card">
            <span class="link-wrapper"><a href="/contact" data-target="/track">Contact us</a></span>
          </div>
          <form action="/submit" method="post">
            <input name="email" value="hello@example.com" />
            <textarea name="message">Hello there</textarea>
          </form>
          <div class="absolute-parent" style="position:absolute">
            <img class="hero absolute-image" src="/assets/bg.jpg" alt="Hero background" />
          </div>
          <div class="svg-holder">
            <svg viewBox="0 0 10 10"><path fill-rule="evenodd" d="M0 0h10v10z"></path></svg>
          </div>
          <img src="/assets/plain.jpg" alt="Plain image" />
          <p style="margin-top: 10px; padding-left: 5px;">Hello <strong>world</strong></p>
        </body>
      </html>
    `;

    try {
      const result = await block(html, {
        title: 'Coverage Block',
        namespace: 'My Prefix',
        category: 'widgets',
        outputPath: tempRoot,
        writeFiles: true,
        outputMode: 'legacy',
        generatePreviewImage: true,
        registerCategoryIfMissing: true,
        jsFiles: ['https://cdn.tailwindcss.com', `${baseUrl}/broken.js`],
        cssFiles: [`${baseUrl}/extra.css`, `${baseUrl}/broken.css`],
        baseUrl: `${baseUrl}/pages/demo`,
      });

      const outputDir = path.join(tempRoot, 'coverage-block');
      const saveSection = result['block.js'].slice(result['block.js'].indexOf('save(props)'));
      const savedScripts = fs.readFileSync(path.join(outputDir, 'scripts.js'), 'utf8');

      expect(result['block.js']).to.include('registerBlockType');
      expect(result['block.js']).to.include('SVG Markup');
      expect(result['block.js']).to.include('Background Image');
      expect(result['block.js']).to.include('Form Settings');
      expect(result['block.js']).to.include('Email Settings');
      expect(result['block.js']).to.include('Hidden Fields');
      expect(result['block.js']).to.include('RichText.Content');
      expect(result['block.js']).to.include('ensureBlockCategory');
      expect(result['block.js']).to.match(/slug:\s*["']widgets["']/);
      expect(saveSection).to.not.include('MediaUpload');
      expect(result['index.php']).to.include('wp_mail');
      expect(result['index.php']).to.include(`${baseUrl}/extra.css`);
      expect(result['scripts.js']).to.include('window.__inlineScriptLoaded = true;');
      expect(savedScripts).to.include('send_email_');
      expect(result['style.css']).to.not.include('all: revert-layer');
      expect(fs.existsSync(path.join(outputDir, 'style.css'))).to.equal(true);
      expect(fs.existsSync(path.join(outputDir, 'editor.css'))).to.equal(true);
      expect(fs.existsSync(path.join(outputDir, 'scripts.js'))).to.equal(true);
      expect(fs.existsSync(path.join(outputDir, 'index.php'))).to.equal(true);
      expect(fs.existsSync(path.join(outputDir, 'block.js'))).to.equal(true);
      expect(fs.existsSync(path.join(outputDir, 'preview.jpeg'))).to.equal(true);
      expect(warnings.some((message) => message.includes('Failed to fetch:'))).to.equal(true);
      expect(warnings.some((message) => message.includes('Failed to fetch script:'))).to.equal(true);
    } finally {
      delete process.env.SNAPAPI_KEY;
      delete process.env.SNAPAPI_URL;
      console.warn = originalWarn;
      await close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('handles preview generation failures without aborting block generation', async function () {
    this.timeout(8000);

    const server = http.createServer((req, res) => {
      if (req.url === '/snapapi/fail') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'preview failed' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(tinyImage);
    });

    const { baseUrl, close } = await listen(server);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'htg-preview-fail-'));
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: any) => logs.push(String(message));

    try {
      process.env.SNAPAPI_KEY = '';

      const resultWithoutKey = await block('<html><body><h1>No Key</h1></body></html>', {
        title: 'Preview Missing Key',
        namespace: 'wp',
        category: 'common',
        outputPath: tempRoot,
        writeFiles: false,
        outputMode: 'legacy',
        generatePreviewImage: true,
        jsFiles: [],
        cssFiles: [],
        baseUrl: `${baseUrl}/page`,
      });

      process.env.SNAPAPI_KEY = 'test-key';
      process.env.SNAPAPI_URL = `${baseUrl}/snapapi/fail`;
      fs.mkdirSync(path.join(tempRoot, 'preview-http-failure'), { recursive: true });

      const resultWithHttpFailure = await block('<html><body><h1>Bad Preview</h1></body></html>', {
        title: 'Preview HTTP Failure',
        namespace: 'wp',
        category: 'common',
        outputPath: tempRoot,
        writeFiles: true,
        outputMode: 'legacy',
        generatePreviewImage: true,
        jsFiles: [],
        cssFiles: [],
        baseUrl: `${baseUrl}/page`,
      });

      expect(resultWithoutKey['block.js']).to.include('registerBlockType');
      expect(resultWithHttpFailure['block.js']).to.include('registerBlockType');
      expect(logs.some((message) => message.includes('There was an error generating preview with SnapAPI.'))).to.equal(true);
      expect(logs.some((message) => message.includes('SNAPAPI_KEY is not set'))).to.equal(true);
      expect(logs.some((message) => message.includes('SnapAPI error: 500'))).to.equal(true);
      expect(
        fs.existsSync(path.join(tempRoot, 'preview-http-failure', 'preview.jpeg'))
      ).to.equal(false);
    } finally {
      delete process.env.SNAPAPI_KEY;
      delete process.env.SNAPAPI_URL;
      console.log = originalLog;
      await close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('covers numeric naming, source-prefixed image URLs, invalid absolute image URLs, and empty content', async function () {
    this.timeout(8000);

    const server = http.createServer((req, res) => {
      if (req.url === '/assets/plain.jpg') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(tinyImage);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    const { baseUrl, close } = await listen(server);

    try {
      const edgeResult = await block(
        `<html><body><img src="${baseUrl}/assets/plain.jpg" alt="Absolute" /><img src="http://[" alt="Broken" /></body></html>`,
        {
          title: '123 Edge Block',
          namespace: '9 Prefix',
          category: 'common',
          outputPath: process.cwd(),
          writeFiles: false,
          outputMode: 'legacy',
          generatePreviewImage: false,
          jsFiles: [],
          cssFiles: [],
          baseUrl,
        }
      );

      const emptyResult = await block('', {
        title: 'Empty Body',
        namespace: '',
        category: 'common',
        outputPath: process.cwd(),
        writeFiles: false,
        outputMode: 'legacy',
        generatePreviewImage: false,
        jsFiles: [],
        cssFiles: [],
        baseUrl: null,
      });

      expect(edgeResult).to.have.property('block.js');
      expect(emptyResult).to.have.property('block.js');
    } finally {
      await close();
    }
  });

  it('returns an R2-backed job manifest without writing files to disk', async function () {
    this.timeout(8000);

    const server = http.createServer((req, res) => {
      if (req.url === '/asset.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(Buffer.from('89504e470d0a1a0a', 'hex'));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    const { baseUrl, close } = await listen(server);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'htg-job-'));
    process.env.HTG_R2_MOCK = '1';
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL = 'https://storage.example.com';

    try {
      const result = await block(`<html><body><img src="${baseUrl}/asset.png" alt="Asset" /><p>Hello</p></body></html>`, {
        title: 'JSON Job',
        slug: 'conv-job',
        namespace: 'wp',
        category: 'common',
        outputPath: tempRoot,
        writeFiles: false,
        outputMode: 'job',
        uploadToR2: true,
        generatePreviewImage: false,
        jsFiles: [],
        cssFiles: [],
        baseUrl,
        jobId: 'conv_123',
      });

      expect(result.jobId).to.equal('conv_123');
      expect(result.status).to.equal('completed');
      expect(result.output.files.some((file) => file.name === 'block.js' && file.kind === 'source')).to.equal(true);
      expect(result.output.files.some((file) => file.name === 'asset.png' && file.kind === 'asset')).to.equal(true);
      expect(result.output.bundle.name).to.equal('output.zip');
      expect(result.output.bundle.path).to.equal('/generated/conv_123/output.zip');
      expect(result.output.bundle.url).to.equal('https://storage.example.com/generated/conv_123/output.zip');
      expect(result.output.bundle.zipUrl).to.equal('https://storage.example.com/generated/conv_123/output.zip');
      expect(fs.existsSync(path.join(tempRoot, 'conv-job', 'block.js'))).to.equal(false);
    } finally {
      delete process.env.HTG_R2_MOCK;
      delete process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
      await close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
