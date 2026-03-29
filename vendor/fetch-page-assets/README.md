# fetch-page-assets

Download page assets, rewrite the HTML to point at the fetched assets, and optionally upload those downloads directly to Cloudflare R2 instead of writing them to disk.

## Installation

```bash
npm install fetch-page-assets
```

## Environment

Keep real secrets in `.env` and never commit them.

```bash
cp .env.example .env
```

Required for R2 uploads:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`

Optional:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_R2_ENDPOINT`

## Getting and rotating Cloudflare credentials

1. Open the Cloudflare dashboard.
2. Create or rotate the R2 access keys for the bucket you want to use.
3. Update `.env` with the new key values.
4. If you use a Cloudflare API token for verification or other account workflows, rotate it in the API Tokens section and update `.env`.
5. Restart the service after updating `.env`.
6. Revoke the old token or key after the new one is confirmed working.

To verify a token without exposing it in source code:

```bash
curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

## Usage

### Legacy local mode

```js
import extractAssets from 'fetch-page-assets';

const html = await extractAssets('<img src="/logo.png" />', {
  source: 'https://example.com',
  basePath: process.cwd(),
  saveFile: true
});
```

### R2 upload mode

```js
import extractAssets from 'fetch-page-assets';

const result = await extractAssets('<img src="/logo.png" />', {
  source: 'https://example.com',
  uploadToR2: true,
  returnDetails: true,
  jobId: 'conv_123',
  r2Prefix: 'generated/conv_123/assets'
});

console.log(result);
```

Example response:

```json
{
  "html": "<img src=\"https://storage.example.com/generated/conv_123/assets/logo.png\">",
  "assets": [
    {
      "id": "file_1",
      "name": "logo.png",
      "type": "image/png",
      "size": 48211,
      "path": "/generated/conv_123/assets/logo.png",
      "url": "https://storage.example.com/generated/conv_123/assets/logo.png",
      "kind": "asset"
    }
  ]
}
```

## Options

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| `source` | Base URL used to resolve relative asset paths. | `string` | `''` |
| `basePath` | Local base path used in legacy mode. | `string` | current directory |
| `saveFile` | Writes downloaded assets to disk in legacy mode. | `boolean` | `true` |
| `uploadToR2` | Uploads resolved assets to Cloudflare R2. | `boolean` | `false` |
| `returnDetails` | Returns `{ html, assets }` metadata instead of only the rewritten HTML string. | `boolean` | `false` |
| `jobId` | Stable conversion identifier used to build remote paths. | `string` | `conv_local` |
| `r2Prefix` | Remote storage prefix for uploaded assets. | `string` | derived from `jobId` |
| `concurrency` | Maximum number of simultaneous downloads. | `number` | `8` |
| `maxRetryAttempts` | Maximum attempts per asset. | `number` | `3` |
| `retryDelay` | Delay between attempts in milliseconds. | `number` | `1000` |
| `verbose` | Enables console logging. | `boolean` | `true` |

## Notes

- `returnDetails: true` is the recommended mode when using R2 because it gives you the uploaded asset metadata.
- Keep all Cloudflare credentials in `.env`.
- Do not hardcode tokens or access keys in code, documentation, tests, or shell history.
