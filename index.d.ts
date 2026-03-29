export type GeneratedFiles = Record<string, string>;

export type JobOutputFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  url: string;
  kind: 'source' | 'asset' | 'bundle';
};

export type JobBundle = {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  url: string;
  zipUrl: string;
};

export type JobManifest = {
  jobId: string;
  status: 'completed';
  output: {
    files: JobOutputFile[];
    bundle: JobBundle;
  };
};

export type BlockOptions = {
  title?: string;
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

export type NormalizedBlockOptions = {
  title: string;
  name: string;
  slug: string;
  namespace: string;
  prefix: string;
  baseUrl: string | null;
  source: string | null;
  category: string;
  registerCategoryIfMissing: boolean;
  outputPath: string;
  basePath: string;
  writeFiles: boolean;
  shouldSaveFiles: boolean;
  generatePreviewImage: boolean;
  generateIconPreview: boolean;
  jsFiles: string[];
  cssFiles: string[];
  outputMode: 'job' | 'legacy';
  uploadToR2: boolean;
  jobId?: string;
};

export declare const createProfiler: (enabled: boolean) => {
  start(label: string): void;
  end(label: string): void;
};

export declare const findSelfClosingJsxEnd: (
  content: string,
  startIndex: number
) => number;

export declare const replaceSelfClosingJsxComponent: (
  content: string,
  componentName: string,
  replacer: (componentSource: string) => string
) => string;

export declare const getMediaUploadSaveTemplate: (
  image?: {
    randomUrlVariable: string;
    randomAltVariable: string;
    imgClass?: string;
  }
) => string;

export declare const replaceMediaUploadComponents: (
  content: string,
  imageRegistry: Array<{
    randomUrlVariable: string;
    randomAltVariable: string;
    imgClass?: string;
  }>
) => string;

export declare const replaceRichTextComponents: (content: string) => string;

export declare const buildAssetExtractionOptions: (
  basePath: string,
  options?: {
    uploadToR2?: boolean;
    returnDetails?: boolean;
    jobId?: string;
    r2Prefix?: string;
  }
) => {
  basePath: string;
  saveFile: false;
  verbose: false;
  maxRetryAttempts: 1;
  retryDelay: 0;
  concurrency: 8;
  uploadToR2: boolean;
  returnDetails: boolean;
  jobId?: string;
  r2Prefix?: string;
};

export declare const slugifyBlockValue: (value?: string) => string;
export declare const formatCategoryLabel: (category?: string) => string;
export declare const normalizeBlockOptions: (
  options?: BlockOptions
) => NormalizedBlockOptions;

export declare const replaceRelativeUrls: (
  html: string,
  replacer: (url: string) => string
) => string;

export declare const replaceRelativeUrlsInCss: (
  css: string,
  replacer: (url: string) => string
) => string;

export declare const replaceRelativeUrlsInHtml: (
  html: string,
  baseUrl: string
) => string;

export declare const replaceRelativeUrlsInCssWithBase: (
  css: string,
  cssFileUrl: string
) => string;

export declare const unwrapBody: (code: string) => string;

export declare const transformBlockFile: (
  blockCode: string
) => { code?: string } | string;

export declare const getSnapApiUrl: () => string;

declare const block: (
  htmlContent: string,
  options?: BlockOptions
) => Promise<GeneratedFiles | JobManifest>;

export default block;
