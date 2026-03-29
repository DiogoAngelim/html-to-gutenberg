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

declare const block: (
  htmlContent: string,
  options?: BlockOptions
) => Promise<GeneratedFiles | JobManifest>;

export default block;
