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


