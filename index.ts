// Utility functions exported for testing
export function hasTailwindCdnSource(jsFiles: string[]): boolean {
  const tailwindCdnRegex = /https:\/\/(cdn\.tailwindcss\.com(\?[^"'\s]*)?|cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4(\.\d+){0,2})/;
  return jsFiles.some((url: string) => tailwindCdnRegex.test(url));
}

export function replaceSourceUrlVars(str: string, source: any): string {
  if (!source) return str;
  const escapedSource = String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`var.url+'${escapedSource}([^']*)'`, 'g');
  return str.replace(pattern, (match: string, path: string) => `\${vars.url}${path}`);
}

// ...existing code...

// Export the main block function as default
// (Moved block implementation from index.js below)

import fetch from 'node-fetch';
import presetReact from '@babel/preset-react';
import * as babel from '@babel/core';
import * as cheerio from 'cheerio';
import scopeCss from 'css-scoping';
import extractAssets from 'fetch-page-assets';
import fs from 'fs';
import dotenv from 'dotenv';
import pkg from './package.json';
import convert from 'node-html-to-jsx';
import path from 'path';

import {
  imports,
  images,
  characters
} from './globals.js';

const { version } = pkg;

export type BlockOptions = {
  title: string;
  slug?: string;
  baseUrl?: string | null;
  namespace?: string;
  category?: string;
  registerCategoryIfMissing?: boolean;
  outputPath?: string;
  writeFiles?: boolean;
  generatePreviewImage?: boolean;
  jsFiles?: string[];
  cssFiles?: string[];
  outputMode?: 'job' | 'legacy';
  uploadToR2?: boolean;
  jobId?: string;
  name?: string;
  prefix?: string;
  source?: string | null;
  basePath?: string;
  shouldSaveFiles?: boolean;
  generateIconPreview?: boolean;
};

const block = async (
  htmlContent: string,
  options: BlockOptions = {
    title: 'My block',
    namespace: 'wp',
    category: 'common',
    outputPath: process.cwd(),
    writeFiles: false,
    generatePreviewImage: false,
    jsFiles: [],
    cssFiles: [],
    baseUrl: null,
  }
) => {
  // ...existing block implementation from index.js...
};

export default block;

