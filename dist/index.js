"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasTailwindCdnSource = hasTailwindCdnSource;
exports.replaceSourceUrlVars = replaceSourceUrlVars;
// Utility functions exported for testing
function hasTailwindCdnSource(jsFiles) {
    const tailwindCdnRegex = /https:\/\/(cdn\.tailwindcss\.com(\?[^"'\s]*)?|cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4(\.\d+){0,2})/;
    return jsFiles.some((url) => tailwindCdnRegex.test(url));
}
function replaceSourceUrlVars(str, source) {
    if (!source)
        return str;
    const escapedSource = String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`var.url+'${escapedSource}([^']*)'`, 'g');
    return str.replace(pattern, (match, path) => `\${vars.url}${path}`);
}
//# sourceMappingURL=index.js.map