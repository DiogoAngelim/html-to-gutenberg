import { expect } from 'chai';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

import extractAssets, {
  h,
  p,
  d,
  m,
  u,
  w,
  $,
  E,
  g,
  U,
  v,
  A,
  F,
  x,
  P,
  R,
  D,
} from './vendor/fetch-page-assets/index.js';

const tinyPng = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fea557a90000000049454e44ae426082',
  'hex'
);

const listen = (server: http.Server) => {
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine test server address.'));
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

describe('fetch-page-assets helpers', () => {
  it('logs through h and p only when verbose', () => {
    const errors: string[] = [];
    const logs: string[] = [];
    const originalError = console.error;
    const originalLog = console.log;

    console.error = (message?: any) => errors.push(String(message));
    console.log = (message?: any) => logs.push(String(message));

    try {
      h('failed', true);
      h('ignored', false);
      p('ok', true);
      p('ignored', false);
    } finally {
      console.error = originalError;
      console.log = originalLog;
    }

    expect(errors).to.deep.equal(['[Error] failed']);
    expect(logs).to.deep.equal(['[Success] ok']);
  });

  it('covers the URL and path helpers', () => {
    expect(d('//cdn.example.com')).to.equal(true);
    expect(d('https://example.com')).to.equal(false);
    expect(m('//cdn.example.com/image.png', 'http')).to.equal('http://cdn.example.com/image.png');
    expect(m('https://example.com/image.png')).to.equal('https://example.com/image.png');
    expect(u('/tmp/')).to.equal(true);
    expect(u('/tmp')).to.equal(false);
    expect(w('images/logo.png')).to.equal(true);
    expect(w('//cdn.example.com/logo.png')).to.equal(false);
    expect($(' "hello" ')).to.equal('hello');
    expect(E('images/logo.png', 'https://example.com/base/page')).to.equal('https://example.com/base/images/logo.png');
    expect(E('//cdn.example.com/logo.png', '', 'http')).to.equal('http://cdn.example.com/logo.png');
    expect(E('images/logo.png', 'not a valid url')).to.equal('images/logo.png');
    expect(g(['a', 'b', 'c'])).to.equal(path.join('a', 'b', 'c'));
    expect(A('image.png?foo=1#bar')).to.equal('image.png');
    expect(F('/tmp', 'asset.png?foo=1#bar')).to.equal(path.join('/tmp', 'asset.png'));
    expect(x('archive.tar.gz')).to.deep.equal(['archive', 'tar', 'gz']);
    expect(P({ Header: 'A', header: 'B' }, 'Header')).to.equal('A');
    expect(P({ header: 'B' }, 'Header')).to.equal('B');
  });

  it('covers file utilities and header parsing helpers', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-assets-helpers-'));
    const nestedDir = path.join(tempRoot, 'nested', 'dir');
    const html = '<img src="https://example.com/images/photo.png">';
    const destinationPath = path.join(tempRoot, 'images');
    const destinationFilePath = path.join(destinationPath, 'photo.png');

    try {
      U(nestedDir, false);
      expect(fs.existsSync(nestedDir)).to.equal(true);

      fs.mkdirSync(destinationPath, { recursive: true });
      v(
        {
          parsedUrl: 'https://example.com/images/photo.png',
          destinationFilePath,
        },
        html,
        tempRoot,
        true,
        false
      );

      const writtenHtml = fs.readFileSync(path.join(tempRoot, 'index.html'), 'utf8');
      expect(writtenHtml).to.include('images/photo.png');
      expect(R({ 'Content-Disposition': 'attachment; filename="report"' }, 'fallback')).to.equal('report');
      expect(R({ 'Content-Type': 'image/png' }, 'fallback')).to.equal('fallback.png');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('covers download progress logging for valid and invalid ratios', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: any) => logs.push(String(message));

    try {
      D({ loaded: 50, total: 100 });
      D({ loaded: Number.NaN, total: 100 });
    } finally {
      console.log = originalLog;
    }

    expect(logs).to.deep.equal(['Download progress: 50%', 'Download progress: 0%']);
  });
});

describe('fetch-page-assets integration', () => {
  it('downloads local file assets from file URLs', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-assets-local-'));
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-assets-source-'));
    const localFile = path.join(sourceDir, 'asset.txt');

    fs.writeFileSync(localFile, 'local file content');

    try {
      const html = `<img src="file://${localFile}" />`;
      const output = await extractAssets(html, {
        basePath: tempRoot,
        verbose: false,
        maxRetryAttempts: 1,
        retryDelay: 0,
      });

      expect(output).to.equal(html);
      expect(fs.existsSync(path.join(tempRoot, localFile.replace(/^\//, '')))).to.equal(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  it('fetches remote HTML, follows redirects, and de-duplicates repeated asset downloads', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-assets-remote-'));
    const requestCounts: Record<string, number> = {};
    const server = http.createServer((req, res) => {
      const url = req.url || '/';
      requestCounts[url] = (requestCounts[url] || 0) + 1;

      if (url === '/redirect-html') {
        res.writeHead(302, { Location: '/page' });
        res.end();
        return;
      }

      if (url === '/page') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <img src="/redirect-image.png" srcset="/ignored-1x.png 1x" sizes="100vw" />
              <img src="/redirect-image.png" />
              <source src="/video.mp4" />
              <script src="/script.js"></script>
              <link rel="stylesheet" href="/styles/site.css" />
              <div style="background-image:url('/backgrounds/bg.png')"></div>
            </body>
          </html>
        `);
        return;
      }

      if (url === '/redirect-image.png') {
        res.writeHead(302, { Location: '/images/logo-download' });
        res.end();
        return;
      }

      if (url === '/images/logo-download') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Disposition': 'attachment; filename="logo-file"',
        });
        res.end(tinyPng);
        return;
      }

      if (url === '/video.mp4') {
        res.writeHead(200, { 'Content-Type': 'video/mp4' });
        res.end(Buffer.from('video'));
        return;
      }

      if (url === '/script.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('window.__fetchedScript = true;');
        return;
      }

      if (url === '/styles/site.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(".hero { background-image: url('/backgrounds/bg.png'); }");
        return;
      }

      if (url === '/backgrounds/bg.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(tinyPng);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    const { baseUrl, close } = await listen(server);

    try {
      const output = await extractAssets(`${baseUrl}/redirect-html`, {
        basePath: tempRoot,
        protocol: 'http',
        verbose: false,
        maxRetryAttempts: 1,
        retryDelay: 0,
        concurrency: 4,
      });

      expect(output).to.include('<img src="/redirect-image.png"');
      expect(output).to.not.include('srcset=');
      expect(output).to.not.include('sizes=');
      expect(fs.existsSync(path.join(tempRoot, 'logo-file.png'))).to.equal(true);
      expect(fs.existsSync(path.join(tempRoot, 'styles', 'site.css'))).to.equal(true);
      expect(fs.existsSync(path.join(tempRoot, 'script.js'))).to.equal(true);
      expect(fs.existsSync(path.join(tempRoot, 'backgrounds', 'bg.png'))).to.equal(true);
      expect(requestCounts['/redirect-image.png']).to.equal(1);
      expect(requestCounts['/images/logo-download']).to.equal(1);
    } finally {
      await close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('handles invalid inputs, unsupported remote URLs, and failed asset downloads gracefully', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-assets-errors-'));
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (message?: any) => errors.push(String(message));

    const server = http.createServer((req, res) => {
      if (req.url === '/broken.png') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('broken');
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    const { baseUrl, close } = await listen(server);

    try {
      const invalidInput = await extractAssets(123 as any, {
        basePath: tempRoot,
        verbose: true,
      } as any);
      const unsupportedProtocol = await extractAssets('ftp://example.com/file.html', {
        basePath: tempRoot,
        verbose: true,
      });
      const unresolvedRelative = await extractAssets('<img src="/missing.png" />', {
        basePath: tempRoot,
        verbose: true,
        maxRetryAttempts: 1,
        retryDelay: 0,
      });
      const failedDownload = await extractAssets(`<img src="${baseUrl}/broken.png" />`, {
        basePath: tempRoot,
        verbose: true,
        maxRetryAttempts: 1,
        retryDelay: 0,
      });

      expect(invalidInput).to.equal('');
      expect(unsupportedProtocol).to.equal('');
      expect(unresolvedRelative).to.equal('<img src="/missing.png" />');
      expect(failedDownload).to.equal(`<img src="${baseUrl}/broken.png" />`);
      expect(errors.some((message) => message.includes('Invalid user input'))).to.equal(true);
      expect(errors.some((message) => message.includes('Invalid baseUrl'))).to.equal(true);
      expect(errors.some((message) => message.includes('A source URL is required'))).to.equal(true);
      expect(errors.some((message) => message.includes('HTTP error! Status: 500'))).to.equal(true);
    } finally {
      console.error = originalError;
      await close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('reuses a shared asset task cache and retries transient download failures', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-assets-cache-'));
    const sharedCache = new Map();
    const requestCounts: Record<string, number> = {};

    const server = http.createServer((req, res) => {
      const url = req.url || '/';
      requestCounts[url] = (requestCounts[url] || 0) + 1;

      if (url === '/cached.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(tinyPng);
        return;
      }

      if (url === '/flaky.png') {
        if (requestCounts[url] === 1) {
          req.socket.destroy();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(tinyPng);
        return;
      }

      if (url === '/broken-page') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('broken');
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    const { baseUrl, close } = await listen(server);

    try {
      await extractAssets(`<img src="${baseUrl}/cached.png" />`, {
        basePath: tempRoot,
        verbose: false,
        maxRetryAttempts: 1,
        retryDelay: 0,
        _assetTaskCache: sharedCache,
      });
      await extractAssets(`<img src="${baseUrl}/cached.png" />`, {
        basePath: tempRoot,
        verbose: false,
        maxRetryAttempts: 1,
        retryDelay: 0,
        _assetTaskCache: sharedCache,
      });
      await extractAssets(`<img src="${baseUrl}/flaky.png" />`, {
        basePath: tempRoot,
        verbose: false,
        maxRetryAttempts: 2,
        retryDelay: 0,
      });
      const brokenHtml = await extractAssets(`${baseUrl}/broken-page`, {
        basePath: tempRoot,
        verbose: false,
      });

      expect(requestCounts['/cached.png']).to.equal(1);
      expect(requestCounts['/flaky.png']).to.equal(2);
      expect(fs.existsSync(path.join(tempRoot, 'cached.png'))).to.equal(true);
      expect(fs.existsSync(path.join(tempRoot, 'flaky.png'))).to.equal(true);
      expect(brokenHtml).to.equal('');
    } finally {
      await close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('can upload extracted assets to mocked R2 and return asset metadata', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/asset.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(tinyPng);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    const { baseUrl, close } = await listen(server);
    process.env.HTG_R2_MOCK = '1';
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL = 'https://storage.example.com';

    try {
      const result = await extractAssets(`<img src="${baseUrl}/asset.png" />`, {
        basePath: process.cwd(),
        verbose: false,
        uploadToR2: true,
        returnDetails: true,
        jobId: 'conv_123',
        r2Prefix: 'generated/conv_123/assets',
      });

      expect(result.html).to.include(`${baseUrl}/asset.png`);
      expect(result.assets).to.have.length(1);
      expect(result.assets[0].name).to.equal('asset.png');
      expect(result.assets[0].url).to.equal('https://storage.example.com/generated/conv_123/assets/asset.png');
      expect(result.assets[0].path).to.equal('/generated/conv_123/assets/asset.png');
    } finally {
      delete process.env.HTG_R2_MOCK;
      delete process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
      await close();
    }
  });
});
