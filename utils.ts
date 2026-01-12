// Utility functions for html-to-gutenberg
export function hasTailwindCdnSource(jsFiles: string[]): boolean {
  const tailwindCdnRegex = /https:\/\/(cdn\.tailwindcss\.com(\?[^"'\s]*)?|cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4(\.\d+){0,2})/;
  return jsFiles.some((url: string) => tailwindCdnRegex.test(url));
}

export function replaceSourceUrlVars(str: string, source: any): string {
  if (!source) return str;
  const escapedSource = String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`var\\.url\\+'${escapedSource}([^']*)'`, 'g');
  if (!pattern.test(str)) return str;
  return str.replace(pattern, (_match: string, path: string) => `\${vars.url}${path}`);
}

export function sanitizeAndReplaceLeadingNumbers(str: string): string {
  const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  let firstNumberReplaced = false;
  return str
    .toLowerCase()
    .replace(/[\s\-_]/g, '')
    .replace(/\d/g, (digit: string) => {
      if (!firstNumberReplaced) {
        firstNumberReplaced = true;
        return numberWords[parseInt(digit)] + digit;
      }
      return digit;
    })
    .replace(/^[^a-z]+/, '');
}

export function replaceUnderscoresSpacesAndUppercaseLetters(name: string = ''): string {
  return name.replace(new RegExp(/\W|_/, 'g'), '-').toLowerCase();
}

export function convertDashesSpacesAndUppercaseToUnderscoresAndLowercase(string: string): string {
  if (string) {
    return `${string.replaceAll('-', '_').replaceAll(' ', '_').toLowerCase()}`;
  }
  return '';
}

export function hasAbsoluteKeyword(str: string): boolean {
  if (typeof str !== 'string') return false;
  return str.toLowerCase().includes('absolute');
}

export function generateRandomVariableName(prefix: string = 'content', length: number = 3): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let suffix = '';
  for (let i = 0; i < length; i++) {
    suffix += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }
  return `${prefix}${suffix}`;
}