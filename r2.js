import crypto from 'crypto';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import mime from 'mime-types';
import path from 'path';

dotenv.config({ quiet: true });

let r2Client;

const trimSlashes = (value = '') => value.replace(/^\/+|\/+$/g, '');

export const createJobId = () => {
  return `conv_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
};

export const inferContentType = (fileName, fallback = 'application/octet-stream') => {
  return mime.lookup(fileName) || fallback;
};

export const getR2Config = () => {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '';
  const endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  return {
    accountId,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
    endpoint,
    mockMode: process.env.HTG_R2_MOCK === '1',
  };
};

export const getR2Client = () => {
  if (r2Client) {
    return r2Client;
  }

  const config = getR2Config();

  if (!config.bucket) {
    throw new Error('CLOUDFLARE_R2_BUCKET is required.');
  }

  if (!config.endpoint) {
    throw new Error('CLOUDFLARE_R2_ACCOUNT_ID or CLOUDFLARE_R2_ENDPOINT is required.');
  }

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY are required.');
  }

  r2Client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return r2Client;
};

export const buildR2Url = (storageKey) => {
  const { publicBaseUrl, mockMode } = getR2Config();
  if (!publicBaseUrl) {
    if (mockMode) {
      return `https://storage.example.com/${trimSlashes(storageKey)}`;
    }
    throw new Error('CLOUDFLARE_R2_PUBLIC_BASE_URL is required for real R2 uploads.');
  }
  return `${publicBaseUrl}/${trimSlashes(storageKey)}`;
};

export const uploadBufferToR2 = async ({
  storageKey,
  body,
  contentType,
  cacheControl,
  metadata,
}) => {
  const config = getR2Config();
  const normalizedKey = trimSlashes(storageKey);
  const bufferBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const resolvedContentType = contentType || inferContentType(path.basename(normalizedKey));

  if (config.mockMode) {
    return {
      storageKey: normalizedKey,
      path: `/${normalizedKey}`,
      url: buildR2Url(normalizedKey),
      size: bufferBody.byteLength,
      type: resolvedContentType,
    };
  }

  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
      Body: bufferBody,
      ContentType: resolvedContentType,
      CacheControl: cacheControl,
      Metadata: metadata,
    })
  );

  return {
    storageKey: normalizedKey,
    path: `/${normalizedKey}`,
    url: buildR2Url(normalizedKey),
    size: bufferBody.byteLength,
    type: resolvedContentType,
  };
};

export const createFileRecord = ({
  id,
  name,
  kind,
  storageKey,
  size,
  type,
  url,
}) => {
  return {
    id,
    name,
    type,
    size,
    path: `/${trimSlashes(storageKey)}`,
    url,
    kind,
  };
};

export const zipEntriesToBuffer = async (entries) => {
  const zip = new JSZip();

  for (const entry of entries) {
    if (!entry || entry.body == null) {
      continue;
    }

    zip.file(trimSlashes(entry.zipPath || entry.name), entry.body);
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
};
